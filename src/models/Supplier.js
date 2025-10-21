const { query, transaction } = require('../config/database');
const { ApiError, ValidationError, NotFoundError } = require('../utils/errors');

/**
 * Model para gerenciamento de fornecedores
 * Baseado no schema polox.suppliers
 */
class SupplierModel {
  /**
   * Cria um novo fornecedor
   * @param {Object} supplierData - Dados do fornecedor
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object>} Fornecedor criado
   */
  static async create(supplierData, companyId) {
    const {
      name,
      company_name = null,
      email = null,
      phone = null,
      document = null,
      document_type = 'cpf',
      address = null,
      city = null,
      state = null,
      zip_code = null,
      country = 'Brasil',
      website = null,
      category = 'general',
      status = 'active',
      payment_terms = null,
      credit_limit = null,
      notes = null,
      contact_person = null,
      contact_phone = null,
      contact_email = null,
      bank_info = null,
      tax_info = null,
      custom_fields = null
    } = supplierData;

    // Validar dados obrigatórios
    if (!name) {
      throw new ValidationError('Nome do fornecedor é obrigatório');
    }

    if (!['cpf', 'cnpj', 'passport', 'other'].includes(document_type)) {
      throw new ValidationError('Tipo de documento deve ser: cpf, cnpj, passport ou other');
    }

    if (!['active', 'inactive', 'blocked', 'pending'].includes(status)) {
      throw new ValidationError('Status deve ser: active, inactive, blocked ou pending');
    }

    return await transaction(async (client) => {
      // Verificar duplicação por documento se fornecido
      if (document) {
        const existingSupplier = await client.query(
          'SELECT id FROM polox.suppliers WHERE company_id = $1 AND document = $2 AND deleted_at IS NULL',
          [companyId, document]
        );

        if (existingSupplier.rows.length > 0) {
          throw new ValidationError('Já existe um fornecedor com este documento');
        }
      }

      // Gerar código único do fornecedor
      const supplierCode = await this.generateSupplierCode(companyId, client);

      const insertQuery = `
        INSERT INTO polox.suppliers (
          company_id, supplier_code, name, company_name, email, phone,
          document, document_type, address, city, state, zip_code,
          country, website, category, status, payment_terms, credit_limit,
          notes, contact_person, contact_phone, contact_email, bank_info,
          tax_info, custom_fields, created_at, updated_at
        )
        VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10, $11, $12,
          $13, $14, $15, $16, $17, $18,
          $19, $20, $21, $22, $23,
          $24, $25, NOW(), NOW()
        )
        RETURNING 
          id, supplier_code, name, company_name, email, phone,
          document, document_type, category, status, payment_terms,
          credit_limit, created_at, updated_at
      `;

      const result = await client.query(insertQuery, [
        companyId, supplierCode, name, company_name, email, phone,
        document, document_type, address, city, state, zip_code,
        country, website, category, status, payment_terms, credit_limit,
        notes, contact_person, contact_phone, contact_email, bank_info,
        tax_info, custom_fields
      ]);

      return result.rows[0];
    }, { companyId });
  }

  /**
   * Gera código único do fornecedor
   * @param {number} companyId - ID da empresa
   * @param {Object} client - Cliente da transação
   * @returns {Promise<string>} Código do fornecedor
   */
  static async generateSupplierCode(companyId, client = null) {
    const queryClient = client || require('../config/database').query;
    
    const prefix = 'SUP';
    
    const countQuery = `
      SELECT COUNT(*) as count 
      FROM polox.suppliers 
      WHERE company_id = $1 AND supplier_code LIKE $2
    `;
    
    const countResult = await queryClient(countQuery, [companyId, `${prefix}%`]);
    const count = parseInt(countResult.rows[0].count) + 1;
    
    return `${prefix}${count.toString().padStart(6, '0')}`;
  }

  /**
   * Busca fornecedor por ID
   * @param {number} id - ID do fornecedor
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object|null>} Fornecedor encontrado ou null
   */
  static async findById(id, companyId) {
    const selectQuery = `
      SELECT 
        s.*,
        (SELECT COUNT(*) FROM polox.purchase_orders WHERE supplier_id = s.id) as total_orders,
        (SELECT COALESCE(SUM(total_amount), 0) FROM polox.purchase_orders WHERE supplier_id = s.id AND status = 'completed') as total_purchased,
        (SELECT COUNT(*) FROM polox.products WHERE supplier_id = s.id) as products_count,
        (SELECT AVG(rating) FROM polox.supplier_evaluations WHERE supplier_id = s.id) as avg_rating
      FROM polox.suppliers s
      WHERE s.id = $1 AND s.company_id = $2 AND s.deleted_at IS NULL
    `;

    try {
      const result = await query(selectQuery, [id, companyId], { companyId });
      return result.rows[0] || null;
    } catch (error) {
      throw new ApiError(500, `Erro ao buscar fornecedor: ${error.message}`);
    }
  }

  /**
   * Busca fornecedor por código
   * @param {string} supplierCode - Código do fornecedor
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object|null>} Fornecedor encontrado ou null
   */
  static async findByCode(supplierCode, companyId) {
    const selectQuery = `
      SELECT s.*
      FROM polox.suppliers s
      WHERE s.supplier_code = $1 AND s.company_id = $2 AND s.deleted_at IS NULL
    `;

    try {
      const result = await query(selectQuery, [supplierCode, companyId], { companyId });
      return result.rows[0] || null;
    } catch (error) {
      throw new ApiError(500, `Erro ao buscar fornecedor por código: ${error.message}`);
    }
  }

  /**
   * Lista fornecedores com filtros e paginação
   * @param {Object} options - Opções de busca
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object>} Lista de fornecedores e metadados
   */
  static async list(options = {}, companyId) {
    const {
      page = 1,
      limit = 10,
      status = null,
      category = null,
      city = null,
      state = null,
      search = null,
      sortBy = 'created_at',
      sortOrder = 'DESC'
    } = options;

    const offset = (page - 1) * limit;
    const conditions = ['company_id = $1', 'deleted_at IS NULL'];
    const values = [companyId];
    let paramCount = 2;

    // Adicionar filtros
    if (status) {
      conditions.push(`status = $${paramCount}`);
      values.push(status);
      paramCount++;
    }

    if (category) {
      conditions.push(`category = $${paramCount}`);
      values.push(category);
      paramCount++;
    }

    if (city) {
      conditions.push(`city = $${paramCount}`);
      values.push(city);
      paramCount++;
    }

    if (state) {
      conditions.push(`state = $${paramCount}`);
      values.push(state);
      paramCount++;
    }

    if (search) {
      conditions.push(`(name ILIKE $${paramCount} OR company_name ILIKE $${paramCount} OR email ILIKE $${paramCount} OR supplier_code ILIKE $${paramCount})`);
      values.push(`%${search}%`);
      paramCount++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Query para contar total
    const countQuery = `
      SELECT COUNT(*) 
      FROM polox.suppliers 
      ${whereClause}
    `;

    // Query para buscar dados
    const selectQuery = `
      SELECT 
        id, supplier_code, name, company_name, email, phone,
        document, document_type, city, state, category, status,
        payment_terms, credit_limit, website, created_at, updated_at,
        (SELECT COUNT(*) FROM polox.purchase_orders WHERE supplier_id = polox.suppliers.id) as total_orders,
        (SELECT COALESCE(SUM(total_amount), 0) FROM polox.purchase_orders WHERE supplier_id = polox.suppliers.id AND status = 'completed') as total_purchased
      FROM polox.suppliers
      ${whereClause}
      ORDER BY ${sortBy} ${sortOrder}
      LIMIT $${paramCount} OFFSET $${paramCount + 1}
    `;

    try {
      const [countResult, dataResult] = await Promise.all([
        query(countQuery, values, { companyId }),
        query(selectQuery, [...values, limit, offset], { companyId })
      ]);

      const total = parseInt(countResult.rows[0].count);
      const totalPages = Math.ceil(total / limit);

      return {
        data: dataResult.rows,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      };
    } catch (error) {
      throw new ApiError(500, `Erro ao listar fornecedores: ${error.message}`);
    }
  }

  /**
   * Atualiza dados do fornecedor
   * @param {number} id - ID do fornecedor
   * @param {Object} updateData - Dados para atualizar
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object|null>} Fornecedor atualizado ou null
   */
  static async update(id, updateData, companyId) {
    const allowedFields = [
      'name', 'company_name', 'email', 'phone', 'document', 'document_type',
      'address', 'city', 'state', 'zip_code', 'country', 'website',
      'category', 'status', 'payment_terms', 'credit_limit', 'notes',
      'contact_person', 'contact_phone', 'contact_email', 'bank_info',
      'tax_info', 'custom_fields'
    ];

    return await transaction(async (client) => {
      // Verificar duplicação por documento se sendo atualizado
      if (updateData.document) {
        const existingSupplier = await client.query(
          'SELECT id FROM polox.suppliers WHERE company_id = $1 AND document = $2 AND id != $3 AND deleted_at IS NULL',
          [companyId, updateData.document, id]
        );

        if (existingSupplier.rows.length > 0) {
          throw new ValidationError('Já existe um fornecedor com este documento');
        }
      }

      const updates = [];
      const values = [];
      let paramCount = 1;

      // Construir query dinamicamente
      for (const [key, value] of Object.entries(updateData)) {
        if (allowedFields.includes(key)) {
          updates.push(`${key} = $${paramCount}`);
          values.push(value);
          paramCount++;
        }
      }

      if (updates.length === 0) {
        throw new ValidationError('Nenhum campo válido para atualizar');
      }

      updates.push('updated_at = NOW()');
      values.push(id, companyId);

      const updateQuery = `
        UPDATE polox.suppliers 
        SET ${updates.join(', ')}
        WHERE id = $${paramCount} AND company_id = $${paramCount + 1} AND deleted_at IS NULL
        RETURNING 
          id, supplier_code, name, company_name, email, phone,
          category, status, payment_terms, credit_limit,
          created_at, updated_at
      `;

      const result = await client.query(updateQuery, values);
      return result.rows[0] || null;
    }, { companyId });
  }

  /**
   * Atualiza status do fornecedor
   * @param {number} id - ID do fornecedor
   * @param {string} newStatus - Novo status
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object|null>} Fornecedor atualizado
   */
  static async updateStatus(id, newStatus, companyId) {
    if (!['active', 'inactive', 'blocked', 'pending'].includes(newStatus)) {
      throw new ValidationError('Status inválido');
    }

    const updateQuery = `
      UPDATE polox.suppliers 
      SET status = $1, updated_at = NOW()
      WHERE id = $2 AND company_id = $3 AND deleted_at IS NULL
      RETURNING id, name, status, updated_at
    `;

    try {
      const result = await query(updateQuery, [newStatus, id, companyId], { companyId });
      return result.rows[0] || null;
    } catch (error) {
      throw new ApiError(500, `Erro ao atualizar status do fornecedor: ${error.message}`);
    }
  }

  /**
   * Adiciona avaliação do fornecedor
   * @param {number} supplierId - ID do fornecedor
   * @param {number} companyId - ID da empresa
   * @param {Object} evaluationData - Dados da avaliação
   * @returns {Promise<Object>} Avaliação criada
   */
  static async addEvaluation(supplierId, companyId, evaluationData) {
    const {
      user_id,
      rating,
      quality_rating = null,
      delivery_rating = null,
      service_rating = null,
      price_rating = null,
      comment = null,
      order_id = null
    } = evaluationData;

    if (!rating || rating < 1 || rating > 5) {
      throw new ValidationError('Avaliação deve ser entre 1 e 5');
    }

    return await transaction(async (client) => {
      // Verificar se fornecedor existe
      const supplier = await client.query(
        'SELECT id FROM polox.suppliers WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL',
        [supplierId, companyId]
      );

      if (supplier.rows.length === 0) {
        throw new NotFoundError('Fornecedor não encontrado');
      }

      const insertQuery = `
        INSERT INTO polox.supplier_evaluations (
          supplier_id, company_id, user_id, rating, quality_rating,
          delivery_rating, service_rating, price_rating, comment,
          order_id, created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
        RETURNING 
          id, supplier_id, user_id, rating, quality_rating,
          delivery_rating, service_rating, price_rating,
          comment, created_at
      `;

      const result = await client.query(insertQuery, [
        supplierId, companyId, user_id, rating, quality_rating,
        delivery_rating, service_rating, price_rating, comment, order_id
      ]);

      return result.rows[0];
    }, { companyId });
  }

  /**
   * Obtém avaliações do fornecedor
   * @param {number} supplierId - ID do fornecedor
   * @param {number} companyId - ID da empresa
   * @param {Object} options - Opções de paginação
   * @returns {Promise<Object>} Lista de avaliações
   */
  static async getEvaluations(supplierId, companyId, options = {}) {
    const {
      page = 1,
      limit = 10
    } = options;

    const offset = (page - 1) * limit;

    const selectQuery = `
      SELECT 
        se.*,
        u.name as user_name
      FROM polox.supplier_evaluations se
      LEFT JOIN polox.users u ON se.user_id = u.id
      WHERE se.supplier_id = $1 AND se.company_id = $2
      ORDER BY se.created_at DESC
      LIMIT $3 OFFSET $4
    `;

    const countQuery = `
      SELECT COUNT(*) 
      FROM polox.supplier_evaluations 
      WHERE supplier_id = $1 AND company_id = $2
    `;

    try {
      const [dataResult, countResult] = await Promise.all([
        query(selectQuery, [supplierId, companyId, limit, offset], { companyId }),
        query(countQuery, [supplierId, companyId], { companyId })
      ]);

      const total = parseInt(countResult.rows[0].count);
      const totalPages = Math.ceil(total / limit);

      return {
        data: dataResult.rows,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      };
    } catch (error) {
      throw new ApiError(500, `Erro ao buscar avaliações: ${error.message}`);
    }
  }

  /**
   * Obtém produtos do fornecedor
   * @param {number} supplierId - ID do fornecedor
   * @param {number} companyId - ID da empresa
   * @param {Object} options - Opções de filtro
   * @returns {Promise<Object>} Produtos do fornecedor
   */
  static async getProducts(supplierId, companyId, options = {}) {
    const {
      page = 1,
      limit = 10,
      is_active = null
    } = options;

    const offset = (page - 1) * limit;
    const conditions = ['supplier_id = $1', 'company_id = $2', 'deleted_at IS NULL'];
    const values = [supplierId, companyId];
    let paramCount = 3;

    if (is_active !== null) {
      conditions.push(`is_active = $${paramCount}`);
      values.push(is_active);
      paramCount++;
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const selectQuery = `
      SELECT 
        id, name, description, sku, price, cost_price,
        stock_quantity, min_stock_level, is_active,
        created_at, updated_at
      FROM polox.products
      ${whereClause}
      ORDER BY name ASC
      LIMIT $${paramCount} OFFSET $${paramCount + 1}
    `;

    const countQuery = `
      SELECT COUNT(*) 
      FROM polox.products
      ${whereClause}
    `;

    try {
      const [dataResult, countResult] = await Promise.all([
        query(selectQuery, [...values, limit, offset], { companyId }),
        query(countQuery, values, { companyId })
      ]);

      const total = parseInt(countResult.rows[0].count);
      const totalPages = Math.ceil(total / limit);

      return {
        data: dataResult.rows,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      };
    } catch (error) {
      throw new ApiError(500, `Erro ao buscar produtos do fornecedor: ${error.message}`);
    }
  }

  /**
   * Obtém histórico de compras do fornecedor
   * @param {number} supplierId - ID do fornecedor
   * @param {number} companyId - ID da empresa
   * @param {Object} options - Opções de filtro
   * @returns {Promise<Object>} Histórico de compras
   */
  static async getPurchaseHistory(supplierId, companyId, options = {}) {
    const {
      page = 1,
      limit = 10,
      date_from = null,
      date_to = null,
      status = null
    } = options;

    const offset = (page - 1) * limit;
    const conditions = ['supplier_id = $1', 'company_id = $2'];
    const values = [supplierId, companyId];
    let paramCount = 3;

    if (date_from) {
      conditions.push(`created_at >= $${paramCount}`);
      values.push(date_from);
      paramCount++;
    }

    if (date_to) {
      conditions.push(`created_at <= $${paramCount}`);
      values.push(date_to);
      paramCount++;
    }

    if (status) {
      conditions.push(`status = $${paramCount}`);
      values.push(status);
      paramCount++;
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const selectQuery = `
      SELECT 
        id, order_number, total_amount, status, 
        expected_delivery_date, actual_delivery_date,
        created_at, updated_at
      FROM polox.purchase_orders
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramCount} OFFSET $${paramCount + 1}
    `;

    const countQuery = `
      SELECT COUNT(*) 
      FROM polox.purchase_orders
      ${whereClause}
    `;

    try {
      const [dataResult, countResult] = await Promise.all([
        query(selectQuery, [...values, limit, offset], { companyId }),
        query(countQuery, values, { companyId })
      ]);

      const total = parseInt(countResult.rows[0].count);
      const totalPages = Math.ceil(total / limit);

      return {
        data: dataResult.rows,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      };
    } catch (error) {
      throw new ApiError(500, `Erro ao buscar histórico de compras: ${error.message}`);
    }
  }

  /**
   * Obtém estatísticas de fornecedores
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object>} Estatísticas de fornecedores
   */
  static async getStats(companyId) {
    const statsQuery = `
      SELECT 
        COUNT(*) as total_suppliers,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_suppliers,
        COUNT(CASE WHEN status = 'inactive' THEN 1 END) as inactive_suppliers,
        COUNT(CASE WHEN status = 'blocked' THEN 1 END) as blocked_suppliers,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_suppliers,
        COUNT(CASE WHEN category = 'general' THEN 1 END) as general_suppliers,
        COUNT(CASE WHEN document_type = 'cnpj' THEN 1 END) as company_suppliers,
        COUNT(CASE WHEN document_type = 'cpf' THEN 1 END) as individual_suppliers,
        COUNT(DISTINCT state) as unique_states,
        COUNT(DISTINCT city) as unique_cities,
        (SELECT COUNT(*) FROM polox.purchase_orders po JOIN polox.suppliers s ON po.supplier_id = s.id WHERE s.company_id = $1) as total_orders,
        (SELECT COALESCE(SUM(total_amount), 0) FROM polox.purchase_orders po JOIN polox.suppliers s ON po.supplier_id = s.id WHERE s.company_id = $1 AND po.status = 'completed') as total_purchased,
        (SELECT COALESCE(AVG(rating), 0) FROM polox.supplier_evaluations se JOIN polox.suppliers s ON se.supplier_id = s.id WHERE s.company_id = $1) as avg_rating
      FROM polox.suppliers 
      WHERE company_id = $1 AND deleted_at IS NULL
    `;

    try {
      const result = await query(statsQuery, [companyId], { companyId });
      return result.rows[0];
    } catch (error) {
      throw new ApiError(500, `Erro ao obter estatísticas: ${error.message}`);
    }
  }

  /**
   * Obtém top fornecedores por volume de compras
   * @param {number} companyId - ID da empresa
   * @param {number} limit - Limite de resultados
   * @returns {Promise<Array>} Top fornecedores
   */
  static async getTopSuppliers(companyId, limit = 10) {
    const topQuery = `
      SELECT 
        s.*,
        COUNT(po.id) as total_orders,
        COALESCE(SUM(po.total_amount), 0) as total_purchased,
        COALESCE(AVG(se.rating), 0) as avg_rating,
        COUNT(se.id) as total_evaluations
      FROM polox.suppliers s
      LEFT JOIN polox.purchase_orders po ON s.id = po.supplier_id AND po.status = 'completed'
      LEFT JOIN polox.supplier_evaluations se ON s.id = se.supplier_id
      WHERE s.company_id = $1 AND s.deleted_at IS NULL AND s.status = 'active'
      GROUP BY s.id
      ORDER BY total_purchased DESC, total_orders DESC
      LIMIT $2
    `;

    try {
      const result = await query(topQuery, [companyId, limit], { companyId });
      return result.rows;
    } catch (error) {
      throw new ApiError(500, `Erro ao buscar top fornecedores: ${error.message}`);
    }
  }

  /**
   * Obtém fornecedores por categoria
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Array>} Fornecedores agrupados por categoria
   */
  static async getByCategory(companyId) {
    const categoryQuery = `
      SELECT 
        category,
        COUNT(*) as supplier_count,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_count,
        (SELECT COUNT(*) FROM polox.purchase_orders po WHERE po.supplier_id IN (
          SELECT id FROM polox.suppliers WHERE category = s.category AND company_id = $1
        )) as total_orders,
        (SELECT COALESCE(SUM(total_amount), 0) FROM polox.purchase_orders po WHERE po.supplier_id IN (
          SELECT id FROM polox.suppliers WHERE category = s.category AND company_id = $1
        ) AND po.status = 'completed') as total_purchased
      FROM polox.suppliers s
      WHERE s.company_id = $1 AND s.deleted_at IS NULL
      GROUP BY category
      ORDER BY supplier_count DESC
    `;

    try {
      const result = await query(categoryQuery, [companyId], { companyId });
      return result.rows;
    } catch (error) {
      throw new ApiError(500, `Erro ao obter fornecedores por categoria: ${error.message}`);
    }
  }

  /**
   * Soft delete do fornecedor
   * @param {number} id - ID do fornecedor
   * @param {number} companyId - ID da empresa
   * @returns {Promise<boolean>} True se deletado com sucesso
   */
  static async softDelete(id, companyId) {
    // Verificar se há pedidos pendentes
    const pendingOrdersQuery = `
      SELECT COUNT(*) FROM polox.purchase_orders 
      WHERE supplier_id = $1 AND status IN ('pending', 'approved', 'in_progress')
    `;

    try {
      const pendingResult = await query(pendingOrdersQuery, [id], { companyId });
      const pendingCount = parseInt(pendingResult.rows[0].count);

      if (pendingCount > 0) {
        throw new ValidationError('Não é possível deletar fornecedor com pedidos pendentes');
      }

      const updateQuery = `
        UPDATE polox.suppliers 
        SET 
          status = 'inactive',
          deleted_at = NOW(),
          updated_at = NOW()
        WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL
      `;

      const result = await query(updateQuery, [id, companyId], { companyId });
      return result.rowCount > 0;
    } catch (error) {
      if (error instanceof ValidationError) throw error;
      throw new ApiError(500, `Erro ao deletar fornecedor: ${error.message}`);
    }
  }

  /**
   * Busca fornecedores próximos por localização
   * @param {number} companyId - ID da empresa
   * @param {string} city - Cidade
   * @param {string} state - Estado
   * @returns {Promise<Array>} Fornecedores próximos
   */
  static async findNearbySuppliers(companyId, city = null, state = null) {
    const conditions = ['company_id = $1', 'deleted_at IS NULL', 'status = \'active\''];
    const values = [companyId];
    let paramCount = 2;

    if (city) {
      conditions.push(`city = $${paramCount}`);
      values.push(city);
      paramCount++;
    }

    if (state) {
      conditions.push(`state = $${paramCount}`);
      values.push(state);
      paramCount++;
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const selectQuery = `
      SELECT 
        id, supplier_code, name, company_name, email, phone,
        city, state, category, payment_terms,
        (SELECT COUNT(*) FROM polox.purchase_orders WHERE supplier_id = polox.suppliers.id) as total_orders,
        (SELECT COALESCE(AVG(rating), 0) FROM polox.supplier_evaluations WHERE supplier_id = polox.suppliers.id) as avg_rating
      FROM polox.suppliers
      ${whereClause}
      ORDER BY avg_rating DESC, total_orders DESC
    `;

    try {
      const result = await query(selectQuery, values, { companyId });
      return result.rows;
    } catch (error) {
      throw new ApiError(500, `Erro ao buscar fornecedores próximos: ${error.message}`);
    }
  }
}

module.exports = SupplierModel;