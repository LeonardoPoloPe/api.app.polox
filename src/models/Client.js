const { query, transaction } = require('../config/database');
const { ApiError, ValidationError, NotFoundError } = require('../utils/errors');

/**
 * Model para gerenciamento de clientes
 * Baseado no schema polox.clients
 */
class ClientModel {
  /**
   * Cria um novo cliente
   * @param {Object} clientData - Dados do cliente
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object>} Cliente criado
   */
  static async create(clientData, companyId) {
    const {
      name,
      email,
      phone,
      company_name,
      document_number,
      document_type,
      type = 'person',
      category,
      status = 'ativo',
      address_street,
      address_number,
      address_complement,
      address_neighborhood,
      address_city,
      address_state,
      address_country = 'BR',
      address_postal_code,
      acquisition_date,
      tags = [],
      preferences = {},
      notes,
      converted_from_lead_id
    } = clientData;

    // Validar dados obrigatórios
    if (!name) {
      throw new ValidationError('Nome é obrigatório');
    }

    const insertQuery = `
      INSERT INTO polox.clients (
        company_id, converted_from_lead_id, name, email, phone, company_name,
        document_number, document_type, type, category, status,
        address_street, address_number, address_complement, address_neighborhood,
        address_city, address_state, address_country, address_postal_code,
        acquisition_date, tags, preferences, notes, created_at, updated_at
      )
      VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10, $11,
        $12, $13, $14, $15,
        $16, $17, $18, $19,
        $20, $21, $22, $23, NOW(), NOW()
      )
      RETURNING 
        id, company_id, converted_from_lead_id, name, email, phone, company_name,
        document_number, document_type, type, category, status,
        address_street, address_number, address_complement, address_neighborhood,
        address_city, address_state, address_country, address_postal_code,
        total_spent, total_orders, average_order_value, lifetime_value,
        acquisition_date, last_purchase_date, last_contact_date, next_follow_up_date,
        tags, preferences, notes, created_at, updated_at
    `;

    try {
      const result = await query(insertQuery, [
        companyId, converted_from_lead_id, name, email, phone, company_name,
        document_number, document_type, type, category, status,
        address_street, address_number, address_complement, address_neighborhood,
        address_city, address_state, address_country, address_postal_code,
        acquisition_date, JSON.stringify(tags), JSON.stringify(preferences), notes
      ], { companyId });

      return result.rows[0];
    } catch (error) {
      if (error.code === '23505') {
        throw new ValidationError('Já existe um cliente com estes dados');
      }
      throw new ApiError(500, `Erro ao criar cliente: ${error.message}`);
    }
  }

  /**
   * Busca cliente por ID
   * @param {number} id - ID do cliente
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object|null>} Cliente encontrado ou null
   */
  static async findById(id, companyId) {
    const selectQuery = `
      SELECT 
        c.*,
        l.name as lead_name,
        l.source as lead_source
      FROM polox.clients c
      LEFT JOIN polox.leads l ON c.converted_from_lead_id = l.id
      WHERE c.id = $1 AND c.company_id = $2 AND c.deleted_at IS NULL
    `;

    try {
      const result = await query(selectQuery, [id, companyId], { companyId });
      return result.rows[0] || null;
    } catch (error) {
      throw new ApiError(500, `Erro ao buscar cliente: ${error.message}`);
    }
  }

  /**
   * Busca cliente por email
   * @param {string} email - Email do cliente
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object|null>} Cliente encontrado ou null
   */
  static async findByEmail(email, companyId) {
    const selectQuery = `
      SELECT * FROM polox.clients 
      WHERE email = $1 AND company_id = $2 AND deleted_at IS NULL
    `;

    try {
      const result = await query(selectQuery, [email, companyId], { companyId });
      return result.rows[0] || null;
    } catch (error) {
      throw new ApiError(500, `Erro ao buscar cliente por email: ${error.message}`);
    }
  }

  /**
   * Lista clientes com filtros e paginação
   * @param {Object} options - Opções de busca
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object>} Lista de clientes e metadados
   */
  static async list(options = {}, companyId) {
    const {
      page = 1,
      limit = 10,
      status = null,
      category = null,
      type = null,
      search = null,
      sortBy = 'created_at',
      sortOrder = 'DESC'
    } = options;

    const offset = (page - 1) * limit;
    const conditions = ['c.company_id = $1', 'c.deleted_at IS NULL'];
    const values = [companyId];
    let paramCount = 2;

    // Adicionar filtros
    if (status) {
      conditions.push(`c.status = $${paramCount}`);
      values.push(status);
      paramCount++;
    }

    if (category) {
      conditions.push(`c.category = $${paramCount}`);
      values.push(category);
      paramCount++;
    }

    if (type) {
      conditions.push(`c.type = $${paramCount}`);
      values.push(type);
      paramCount++;
    }

    if (search) {
      conditions.push(`(c.name ILIKE $${paramCount} OR c.email ILIKE $${paramCount} OR c.company_name ILIKE $${paramCount} OR c.document_number ILIKE $${paramCount})`);
      values.push(`%${search}%`);
      paramCount++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Query para contar total
    const countQuery = `
      SELECT COUNT(*) 
      FROM polox.clients c 
      ${whereClause}
    `;

    // Query para buscar dados
    const selectQuery = `
      SELECT 
        c.id, c.name, c.email, c.phone, c.company_name, c.document_number,
        c.document_type, c.type, c.category, c.status, c.address_city,
        c.address_state, c.total_spent, c.total_orders, c.average_order_value,
        c.lifetime_value, c.acquisition_date, c.last_purchase_date,
        c.last_contact_date, c.created_at, c.updated_at,
        (SELECT COUNT(*) FROM polox.sales WHERE client_id = c.id AND deleted_at IS NULL) as sales_count
      FROM polox.clients c
      ${whereClause}
      ORDER BY c.${sortBy} ${sortOrder}
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
      throw new ApiError(500, `Erro ao listar clientes: ${error.message}`);
    }
  }

  /**
   * Atualiza dados do cliente
   * @param {number} id - ID do cliente
   * @param {Object} updateData - Dados para atualizar
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object|null>} Cliente atualizado ou null
   */
  static async update(id, updateData, companyId) {
    const allowedFields = [
      'name', 'email', 'phone', 'company_name', 'document_number', 'document_type',
      'type', 'category', 'status', 'address_street', 'address_number',
      'address_complement', 'address_neighborhood', 'address_city', 'address_state',
      'address_country', 'address_postal_code', 'last_contact_date',
      'next_follow_up_date', 'tags', 'preferences', 'notes'
    ];

    const updates = [];
    const values = [];
    let paramCount = 1;

    // Construir query dinamicamente
    for (const [key, value] of Object.entries(updateData)) {
      if (allowedFields.includes(key)) {
        if (key === 'tags' || key === 'preferences') {
          updates.push(`${key} = $${paramCount}`);
          values.push(JSON.stringify(value));
        } else {
          updates.push(`${key} = $${paramCount}`);
          values.push(value);
        }
        paramCount++;
      }
    }

    if (updates.length === 0) {
      throw new ValidationError('Nenhum campo válido para atualizar');
    }

    updates.push('updated_at = NOW()');
    values.push(id, companyId);

    const updateQuery = `
      UPDATE polox.clients 
      SET ${updates.join(', ')}
      WHERE id = $${paramCount} AND company_id = $${paramCount + 1} AND deleted_at IS NULL
      RETURNING 
        id, company_id, name, email, phone, company_name, document_number,
        document_type, type, category, status, total_spent, total_orders,
        average_order_value, lifetime_value, created_at, updated_at
    `;

    try {
      const result = await query(updateQuery, values, { companyId });
      return result.rows[0] || null;
    } catch (error) {
      throw new ApiError(500, `Erro ao atualizar cliente: ${error.message}`);
    }
  }

  /**
   * Atualiza estatísticas comerciais do cliente
   * @param {number} clientId - ID do cliente
   * @param {number} companyId - ID da empresa
   * @returns {Promise<boolean>} True se atualizado com sucesso
   */
  static async updateCommercialStats(clientId, companyId) {
    const updateQuery = `
      UPDATE polox.clients 
      SET 
        total_spent = COALESCE((
          SELECT SUM(net_amount) 
          FROM polox.sales 
          WHERE client_id = $1 AND status = 'confirmed' AND deleted_at IS NULL
        ), 0),
        total_orders = COALESCE((
          SELECT COUNT(*) 
          FROM polox.sales 
          WHERE client_id = $1 AND status = 'confirmed' AND deleted_at IS NULL
        ), 0),
        average_order_value = COALESCE((
          SELECT AVG(net_amount) 
          FROM polox.sales 
          WHERE client_id = $1 AND status = 'confirmed' AND deleted_at IS NULL
        ), 0),
        last_purchase_date = (
          SELECT MAX(sale_date) 
          FROM polox.sales 
          WHERE client_id = $1 AND status = 'confirmed' AND deleted_at IS NULL
        ),
        updated_at = NOW()
      WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL
    `;

    try {
      const result = await query(updateQuery, [clientId, companyId], { companyId });
      return result.rowCount > 0;
    } catch (error) {
      throw new ApiError(500, `Erro ao atualizar estatísticas: ${error.message}`);
    }
  }

  /**
   * Obtém histórico de vendas do cliente
   * @param {number} clientId - ID do cliente
   * @param {number} companyId - ID da empresa
   * @param {Object} options - Opções de paginação
   * @returns {Promise<Object>} Histórico de vendas
   */
  static async getSalesHistory(clientId, companyId, options = {}) {
    const { page = 1, limit = 10 } = options;
    const offset = (page - 1) * limit;

    const salesQuery = `
      SELECT 
        s.id, s.sale_number, s.total_amount, s.discount_amount, s.net_amount,
        s.status, s.payment_status, s.sale_date, s.payment_date, s.description,
        u.name as seller_name
      FROM polox.sales s
      LEFT JOIN polox.users u ON s.user_id = u.id
      WHERE s.client_id = $1 AND s.company_id = $2 AND s.deleted_at IS NULL
      ORDER BY s.sale_date DESC
      LIMIT $3 OFFSET $4
    `;

    const countQuery = `
      SELECT COUNT(*) 
      FROM polox.sales 
      WHERE client_id = $1 AND company_id = $2 AND deleted_at IS NULL
    `;

    try {
      const [salesResult, countResult] = await Promise.all([
        query(salesQuery, [clientId, companyId, limit, offset], { companyId }),
        query(countQuery, [clientId, companyId], { companyId })
      ]);

      const total = parseInt(countResult.rows[0].count);
      const totalPages = Math.ceil(total / limit);

      return {
        data: salesResult.rows,
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
      throw new ApiError(500, `Erro ao buscar histórico de vendas: ${error.message}`);
    }
  }

  /**
   * Soft delete do cliente
   * @param {number} id - ID do cliente
   * @param {number} companyId - ID da empresa
   * @returns {Promise<boolean>} True se deletado com sucesso
   */
  static async softDelete(id, companyId) {
    const updateQuery = `
      UPDATE polox.clients 
      SET 
        status = 'inativo',
        deleted_at = NOW(),
        updated_at = NOW()
      WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL
    `;

    try {
      const result = await query(updateQuery, [id, companyId], { companyId });
      return result.rowCount > 0;
    } catch (error) {
      throw new ApiError(500, `Erro ao deletar cliente: ${error.message}`);
    }
  }

  /**
   * Registra contato com cliente
   * @param {number} id - ID do cliente
   * @param {number} companyId - ID da empresa
   * @returns {Promise<boolean>} True se atualizado com sucesso
   */
  static async recordContact(id, companyId) {
    const updateQuery = `
      UPDATE polox.clients 
      SET last_contact_date = CURRENT_DATE, updated_at = NOW()
      WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL
    `;

    try {
      const result = await query(updateQuery, [id, companyId], { companyId });
      return result.rowCount > 0;
    } catch (error) {
      throw new ApiError(500, `Erro ao registrar contato: ${error.message}`);
    }
  }

  /**
   * Obtém estatísticas de clientes da empresa
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object>} Estatísticas dos clientes
   */
  static async getStats(companyId) {
    const statsQuery = `
      SELECT 
        COUNT(*) as total_clients,
        COUNT(CASE WHEN status = 'ativo' THEN 1 END) as ativos,
        COUNT(CASE WHEN status = 'inativo' THEN 1 END) as inativos,
        COUNT(CASE WHEN type = 'person' THEN 1 END) as pessoas_fisicas,
        COUNT(CASE WHEN type = 'company' THEN 1 END) as pessoas_juridicas,
        COALESCE(SUM(total_spent), 0) as receita_total,
        COALESCE(AVG(total_spent), 0) as ticket_medio,
        COALESCE(SUM(total_orders), 0) as pedidos_total,
        COUNT(CASE WHEN last_contact_date >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as contactados_30_dias,
        COUNT(CASE WHEN acquisition_date >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as novos_30_dias
      FROM polox.clients 
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
   * Busca clientes VIP (top gastos)
   * @param {number} companyId - ID da empresa
   * @param {number} limit - Quantidade de clientes
   * @returns {Promise<Array>} Lista de clientes VIP
   */
  static async getVipClients(companyId, limit = 10) {
    const selectQuery = `
      SELECT 
        id, name, email, company_name, total_spent, total_orders,
        average_order_value, last_purchase_date, created_at
      FROM polox.clients 
      WHERE company_id = $1 AND deleted_at IS NULL AND total_spent > 0
      ORDER BY total_spent DESC
      LIMIT $2
    `;

    try {
      const result = await query(selectQuery, [companyId, limit], { companyId });
      return result.rows;
    } catch (error) {
      throw new ApiError(500, `Erro ao buscar clientes VIP: ${error.message}`);
    }
  }
}

module.exports = ClientModel;