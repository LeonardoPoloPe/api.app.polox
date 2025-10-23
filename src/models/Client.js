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
      tags = [], // Array de nomes de tags para associar via pivot
      interests = [], // Array de IDs de interesses para associar via pivot
      preferences = {},
      converted_from_lead_id
    } = clientData;

    // Validar dados obrigatórios
    if (!name) {
      throw new ValidationError('Nome é obrigatório');
    }

    return await transaction(async (client) => {
      const insertQuery = `
        INSERT INTO polox.clients (
          company_id, converted_from_lead_id, name, email, phone, company_name,
          document_number, document_type, type, category, status,
          address_street, address_number, address_complement, address_neighborhood,
          address_city, address_state, address_country, address_postal_code,
          acquisition_date, preferences, created_at, updated_at
        )
        VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10, $11,
          $12, $13, $14, $15,
          $16, $17, $18, $19,
          $20, $21, NOW(), NOW()
        )
        RETURNING id
      `;

      const result = await client.query(insertQuery, [
        companyId, converted_from_lead_id, name, email, phone, company_name,
        document_number, document_type, type, category, status,
        address_street, address_number, address_complement, address_neighborhood,
        address_city, address_state, address_country, address_postal_code,
        acquisition_date, JSON.stringify(preferences)
      ]);

      const clientId = result.rows[0].id;

      // Processar tags via pivot table
      if (Array.isArray(tags) && tags.length > 0) {
        for (const tagName of tags) {
          if (tagName && typeof tagName === 'string') {
            // Criar ou buscar tag
            const tagResult = await client.query(`
              INSERT INTO polox.tags (company_id, name, slug, color, created_at, updated_at)
              VALUES ($1, $2, $3, $4, NOW(), NOW())
              ON CONFLICT (company_id, slug) 
              DO UPDATE SET updated_at = NOW()
              RETURNING id
            `, [
              companyId,
              tagName.trim(),
              tagName.toLowerCase().trim().replace(/\s+/g, '-'),
              '#808080'
            ]);

            const tagId = tagResult.rows[0].id;

            // Associar tag ao cliente
            await client.query(`
              INSERT INTO polox.client_tags (client_id, tag_id, created_at)
              VALUES ($1, $2, NOW())
              ON CONFLICT (client_id, tag_id) DO NOTHING
            `, [clientId, tagId]);
          }
        }
      }

      // Processar interesses via pivot table
      if (Array.isArray(interests) && interests.length > 0) {
        for (const interestId of interests) {
          if (interestId) {
            await client.query(`
              INSERT INTO polox.client_interests (client_id, interest_id, created_at)
              VALUES ($1, $2, NOW())
              ON CONFLICT (client_id, interest_id) DO NOTHING
            `, [clientId, interestId]);
          }
        }
      }

      // Retornar cliente completo com tags e interests
      return await this.findById(clientId, companyId);
    }, { companyId });
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
        l.source as lead_source,
        (
          SELECT json_agg(
            json_build_object(
              'id', tags.id,
              'name', tags.name,
              'slug', tags.slug,
              'color', tags.color
            )
          )
          FROM polox.client_tags ct
          INNER JOIN polox.tags tags ON ct.tag_id = tags.id
          WHERE ct.client_id = c.id
        ) as tags,
        (
          SELECT json_agg(
            json_build_object(
              'id', i.id,
              'name', i.name,
              'slug', i.slug,
              'description', i.description
            )
          )
          FROM polox.client_interests ci
          INNER JOIN polox.interests i ON ci.interest_id = i.id
          WHERE ci.client_id = c.id
        ) as interests
      FROM polox.clients c
      LEFT JOIN polox.leads l ON c.converted_from_lead_id = l.id
      WHERE c.id = $1 AND c.company_id = $2 AND c.deleted_at IS NULL
    `;

    try {
      const result = await query(selectQuery, [id, companyId], { companyId });
      const clientData = result.rows[0] || null;
      
      // Garantir que tags e interests sejam arrays vazios se null
      if (clientData) {
        clientData.tags = clientData.tags || [];
        clientData.interests = clientData.interests || [];
      }
      
      return clientData;
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
        (SELECT COUNT(*) FROM polox.sales WHERE client_id = c.id AND deleted_at IS NULL) as sales_count,
        (
          SELECT json_agg(tags.name)
          FROM polox.client_tags ct
          INNER JOIN polox.tags tags ON ct.tag_id = tags.id
          WHERE ct.client_id = c.id
        ) as tags
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
      'next_follow_up_date', 'preferences'
    ];

    const updates = [];
    const values = [];
    let paramCount = 1;

    // Construir query dinamicamente
    for (const [key, value] of Object.entries(updateData)) {
      if (allowedFields.includes(key)) {
        if (key === 'preferences') {
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

  /**
   * Adiciona uma tag ao cliente
   * @param {number} clientId - ID do cliente
   * @param {string} tagName - Nome da tag
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object>} Tag associada
   */
  static async addTag(clientId, tagName, companyId) {
    if (!tagName || typeof tagName !== 'string') {
      throw new ValidationError('Nome da tag é obrigatório');
    }

    return await transaction(async (client) => {
      // Verificar se cliente existe
      const clientRecord = await client.query(
        'SELECT id FROM polox.clients WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL',
        [clientId, companyId]
      );

      if (clientRecord.rows.length === 0) {
        throw new NotFoundError('Cliente não encontrado');
      }

      // Criar ou buscar tag
      const tagResult = await client.query(`
        INSERT INTO polox.tags (company_id, name, slug, color, created_at, updated_at)
        VALUES ($1, $2, $3, $4, NOW(), NOW())
        ON CONFLICT (company_id, slug) 
        DO UPDATE SET updated_at = NOW()
        RETURNING id, name, slug, color
      `, [
        companyId,
        tagName.trim(),
        tagName.toLowerCase().trim().replace(/\s+/g, '-'),
        '#808080'
      ]);

      const tag = tagResult.rows[0];

      // Associar tag ao cliente
      await client.query(`
        INSERT INTO polox.client_tags (client_id, tag_id, created_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT (client_id, tag_id) DO NOTHING
      `, [clientId, tag.id]);

      return tag;
    }, { companyId });
  }

  /**
   * Obtém todas as tags de um cliente
   * @param {number} clientId - ID do cliente
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Array>} Lista de tags
   */
  static async getTags(clientId, companyId) {
    const selectQuery = `
      SELECT 
        t.id, t.name, t.slug, t.color,
        ct.created_at as associated_at
      FROM polox.client_tags ct
      INNER JOIN polox.tags t ON ct.tag_id = t.id
      INNER JOIN polox.clients c ON ct.client_id = c.id
      WHERE ct.client_id = $1 AND c.company_id = $2 AND c.deleted_at IS NULL
      ORDER BY t.name ASC
    `;

    try {
      const result = await query(selectQuery, [clientId, companyId], { companyId });
      return result.rows;
    } catch (error) {
      throw new ApiError(500, `Erro ao buscar tags: ${error.message}`);
    }
  }

  /**
   * Remove uma tag do cliente
   * @param {number} clientId - ID do cliente
   * @param {number} tagId - ID da tag
   * @param {number} companyId - ID da empresa
   * @returns {Promise<boolean>} True se removido com sucesso
   */
  static async removeTag(clientId, tagId, companyId) {
    const deleteQuery = `
      DELETE FROM polox.client_tags 
      WHERE client_id = $1 AND tag_id = $2
      AND EXISTS (
        SELECT 1 FROM polox.clients 
        WHERE id = $1 AND company_id = $3 AND deleted_at IS NULL
      )
    `;

    try {
      const result = await query(deleteQuery, [clientId, tagId, companyId], { companyId });
      return result.rowCount > 0;
    } catch (error) {
      throw new ApiError(500, `Erro ao remover tag: ${error.message}`);
    }
  }

  /**
   * Atualiza todas as tags de um cliente
   * @param {number} clientId - ID do cliente
   * @param {Array<string>} tagNames - Array de nomes de tags
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Array>} Lista de tags atualizadas
   */
  static async updateTags(clientId, tagNames, companyId) {
    if (!Array.isArray(tagNames)) {
      throw new ValidationError('tagNames deve ser um array');
    }

    return await transaction(async (client) => {
      // Verificar se cliente existe
      const clientRecord = await client.query(
        'SELECT id FROM polox.clients WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL',
        [clientId, companyId]
      );

      if (clientRecord.rows.length === 0) {
        throw new NotFoundError('Cliente não encontrado');
      }

      // Remover todas as tags atuais
      await client.query(
        'DELETE FROM polox.client_tags WHERE client_id = $1',
        [clientId]
      );

      // Adicionar novas tags
      const newTags = [];
      for (const tagName of tagNames) {
        if (tagName && typeof tagName === 'string') {
          // Criar ou buscar tag
          const tagResult = await client.query(`
            INSERT INTO polox.tags (company_id, name, slug, color, created_at, updated_at)
            VALUES ($1, $2, $3, $4, NOW(), NOW())
            ON CONFLICT (company_id, slug) 
            DO UPDATE SET updated_at = NOW()
            RETURNING id, name, slug, color
          `, [
            companyId,
            tagName.trim(),
            tagName.toLowerCase().trim().replace(/\s+/g, '-'),
            '#808080'
          ]);

          const tag = tagResult.rows[0];

          // Associar tag ao cliente
          await client.query(`
            INSERT INTO polox.client_tags (client_id, tag_id, created_at)
            VALUES ($1, $2, NOW())
            ON CONFLICT (client_id, tag_id) DO NOTHING
          `, [clientId, tag.id]);

          newTags.push(tag);
        }
      }

      return newTags;
    }, { companyId });
  }

  /**
   * Adiciona um interesse ao cliente
   * @param {number} clientId - ID do cliente
   * @param {number} interestId - ID do interesse
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object>} Interesse associado
   */
  static async addInterest(clientId, interestId, companyId) {
    return await transaction(async (client) => {
      // Verificar se cliente existe
      const clientRecord = await client.query(
        'SELECT id FROM polox.clients WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL',
        [clientId, companyId]
      );

      if (clientRecord.rows.length === 0) {
        throw new NotFoundError('Cliente não encontrado');
      }

      // Verificar se interesse existe
      const interestResult = await client.query(
        'SELECT * FROM polox.interests WHERE id = $1 AND company_id = $2',
        [interestId, companyId]
      );

      if (interestResult.rows.length === 0) {
        throw new NotFoundError('Interesse não encontrado');
      }

      const interest = interestResult.rows[0];

      // Associar interesse ao cliente
      await client.query(`
        INSERT INTO polox.client_interests (client_id, interest_id, created_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT (client_id, interest_id) DO NOTHING
      `, [clientId, interestId]);

      return interest;
    }, { companyId });
  }

  /**
   * Obtém todos os interesses de um cliente
   * @param {number} clientId - ID do cliente
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Array>} Lista de interesses
   */
  static async getInterests(clientId, companyId) {
    const selectQuery = `
      SELECT 
        i.id, i.name, i.slug, i.description,
        ci.created_at as associated_at
      FROM polox.client_interests ci
      INNER JOIN polox.interests i ON ci.interest_id = i.id
      INNER JOIN polox.clients c ON ci.client_id = c.id
      WHERE ci.client_id = $1 AND c.company_id = $2 AND c.deleted_at IS NULL
      ORDER BY i.name ASC
    `;

    try {
      const result = await query(selectQuery, [clientId, companyId], { companyId });
      return result.rows;
    } catch (error) {
      throw new ApiError(500, `Erro ao buscar interesses: ${error.message}`);
    }
  }

  /**
   * Remove um interesse do cliente
   * @param {number} clientId - ID do cliente
   * @param {number} interestId - ID do interesse
   * @param {number} companyId - ID da empresa
   * @returns {Promise<boolean>} True se removido com sucesso
   */
  static async removeInterest(clientId, interestId, companyId) {
    const deleteQuery = `
      DELETE FROM polox.client_interests 
      WHERE client_id = $1 AND interest_id = $2
      AND EXISTS (
        SELECT 1 FROM polox.clients 
        WHERE id = $1 AND company_id = $3 AND deleted_at IS NULL
      )
    `;

    try {
      const result = await query(deleteQuery, [clientId, interestId, companyId], { companyId });
      return result.rowCount > 0;
    } catch (error) {
      throw new ApiError(500, `Erro ao remover interesse: ${error.message}`);
    }
  }

  /**
   * Atualiza todos os interesses de um cliente
   * @param {number} clientId - ID do cliente
   * @param {Array<number>} interestIds - Array de IDs de interesses
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Array>} Lista de interesses atualizados
   */
  static async updateInterests(clientId, interestIds, companyId) {
    if (!Array.isArray(interestIds)) {
      throw new ValidationError('interestIds deve ser um array');
    }

    return await transaction(async (client) => {
      // Verificar se cliente existe
      const clientRecord = await client.query(
        'SELECT id FROM polox.clients WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL',
        [clientId, companyId]
      );

      if (clientRecord.rows.length === 0) {
        throw new NotFoundError('Cliente não encontrado');
      }

      // Remover todos os interesses atuais
      await client.query(
        'DELETE FROM polox.client_interests WHERE client_id = $1',
        [clientId]
      );

      // Adicionar novos interesses
      const newInterests = [];
      for (const interestId of interestIds) {
        if (interestId) {
          // Buscar interesse
          const interestResult = await client.query(
            'SELECT * FROM polox.interests WHERE id = $1 AND company_id = $2',
            [interestId, companyId]
          );

          if (interestResult.rows.length > 0) {
            const interest = interestResult.rows[0];

            // Associar interesse ao cliente
            await client.query(`
              INSERT INTO polox.client_interests (client_id, interest_id, created_at)
              VALUES ($1, $2, NOW())
              ON CONFLICT (client_id, interest_id) DO NOTHING
            `, [clientId, interestId]);

            newInterests.push(interest);
          }
        }
      }

      return newInterests;
    }, { companyId });
  }
}

module.exports = ClientModel;