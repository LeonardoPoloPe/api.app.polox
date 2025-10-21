const { query, transaction } = require('../config/database');
const { ApiError, ValidationError, NotFoundError } = require('../utils/errors');

/**
 * Model para gerenciamento de leads
 * Baseado no schema polox.leads
 */
class LeadModel {
  /**
   * Cria um novo lead
   * @param {Object} leadData - Dados do lead
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object>} Lead criado
   */
  static async create(leadData, companyId) {
    const {
      name,
      email,
      phone,
      company_name,
      position,
      source,
      score = 0,
      temperature = 'frio',
      city,
      state,
      country = 'BR',
      notes,
      interests = [],
      tags = [],
      user_id
    } = leadData;

    // Validar dados obrigatórios
    if (!name) {
      throw new ValidationError('Nome é obrigatório');
    }

    const insertQuery = `
      INSERT INTO polox.leads (
        company_id, user_id, name, email, phone, company_name, position,
        source, score, temperature, city, state, country, notes,
        interests, tags, created_at, updated_at
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11, $12, $13, $14,
        $15, $16, NOW(), NOW()
      )
      RETURNING 
        id, company_id, user_id, name, email, phone, company_name, position,
        status, source, score, temperature, city, state, country, notes,
        interests, tags, first_contact_at, last_contact_at, next_follow_up_at,
        converted_to_client_id, converted_at, conversion_value,
        created_at, updated_at
    `;

    try {
      const result = await query(insertQuery, [
        companyId, user_id, name, email, phone, company_name, position,
        source, score, temperature, city, state, country, notes,
        JSON.stringify(interests), JSON.stringify(tags)
      ], { companyId });

      return result.rows[0];
    } catch (error) {
      throw new ApiError(500, `Erro ao criar lead: ${error.message}`);
    }
  }

  /**
   * Busca lead por ID
   * @param {number} id - ID do lead
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object|null>} Lead encontrado ou null
   */
  static async findById(id, companyId) {
    const selectQuery = `
      SELECT 
        l.id, l.company_id, l.user_id, l.name, l.email, l.phone, 
        l.company_name, l.position, l.status, l.source, l.score, 
        l.temperature, l.city, l.state, l.country, l.notes,
        l.interests, l.tags, l.first_contact_at, l.last_contact_at, 
        l.next_follow_up_at, l.converted_to_client_id, l.converted_at, 
        l.conversion_value, l.created_at, l.updated_at,
        u.name as responsible_user_name,
        c.name as client_name
      FROM polox.leads l
      LEFT JOIN polox.users u ON l.user_id = u.id
      LEFT JOIN polox.clients c ON l.converted_to_client_id = c.id
      WHERE l.id = $1 AND l.company_id = $2 AND l.deleted_at IS NULL
    `;

    try {
      const result = await query(selectQuery, [id, companyId], { companyId });
      return result.rows[0] || null;
    } catch (error) {
      throw new ApiError(500, `Erro ao buscar lead: ${error.message}`);
    }
  }

  /**
   * Lista leads com filtros e paginação
   * @param {Object} options - Opções de busca
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object>} Lista de leads e metadados
   */
  static async list(options = {}, companyId) {
    const {
      page = 1,
      limit = 10,
      status = null,
      source = null,
      temperature = null,
      userId = null,
      search = null,
      sortBy = 'created_at',
      sortOrder = 'DESC'
    } = options;

    const offset = (page - 1) * limit;
    const conditions = ['l.company_id = $1', 'l.deleted_at IS NULL'];
    const values = [companyId];
    let paramCount = 2;

    // Adicionar filtros
    if (status) {
      conditions.push(`l.status = $${paramCount}`);
      values.push(status);
      paramCount++;
    }

    if (source) {
      conditions.push(`l.source = $${paramCount}`);
      values.push(source);
      paramCount++;
    }

    if (temperature) {
      conditions.push(`l.temperature = $${paramCount}`);
      values.push(temperature);
      paramCount++;
    }

    if (userId) {
      conditions.push(`l.user_id = $${paramCount}`);
      values.push(userId);
      paramCount++;
    }

    if (search) {
      conditions.push(`(l.name ILIKE $${paramCount} OR l.email ILIKE $${paramCount} OR l.company_name ILIKE $${paramCount})`);
      values.push(`%${search}%`);
      paramCount++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Query para contar total
    const countQuery = `
      SELECT COUNT(*) 
      FROM polox.leads l 
      ${whereClause}
    `;

    // Query para buscar dados
    const selectQuery = `
      SELECT 
        l.id, l.name, l.email, l.phone, l.company_name, l.position,
        l.status, l.source, l.score, l.temperature, l.city, l.state,
        l.first_contact_at, l.last_contact_at, l.next_follow_up_at,
        l.converted_at, l.conversion_value, l.created_at, l.updated_at,
        u.name as responsible_user_name
      FROM polox.leads l
      LEFT JOIN polox.users u ON l.user_id = u.id
      ${whereClause}
      ORDER BY l.${sortBy} ${sortOrder}
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
      throw new ApiError(500, `Erro ao listar leads: ${error.message}`);
    }
  }

  /**
   * Atualiza dados do lead
   * @param {number} id - ID do lead
   * @param {Object} updateData - Dados para atualizar
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object|null>} Lead atualizado ou null
   */
  static async update(id, updateData, companyId) {
    const allowedFields = [
      'name', 'email', 'phone', 'company_name', 'position', 'status',
      'source', 'score', 'temperature', 'city', 'state', 'country',
      'notes', 'interests', 'tags', 'user_id', 'next_follow_up_at'
    ];

    const updates = [];
    const values = [];
    let paramCount = 1;

    // Construir query dinamicamente
    for (const [key, value] of Object.entries(updateData)) {
      if (allowedFields.includes(key)) {
        if (key === 'interests' || key === 'tags') {
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
      UPDATE polox.leads 
      SET ${updates.join(', ')}
      WHERE id = $${paramCount} AND company_id = $${paramCount + 1} AND deleted_at IS NULL
      RETURNING 
        id, company_id, user_id, name, email, phone, company_name, position,
        status, source, score, temperature, city, state, country, notes,
        interests, tags, created_at, updated_at
    `;

    try {
      const result = await query(updateQuery, values, { companyId });
      return result.rows[0] || null;
    } catch (error) {
      throw new ApiError(500, `Erro ao atualizar lead: ${error.message}`);
    }
  }

  /**
   * Converte lead em cliente
   * @param {number} leadId - ID do lead
   * @param {Object} clientData - Dados do cliente
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object>} Cliente criado e lead atualizado
   */
  static async convertToClient(leadId, clientData, companyId) {
    return await transaction(async (client) => {
      // Buscar lead
      const leadResult = await client.query(
        'SELECT * FROM polox.leads WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL',
        [leadId, companyId]
      );

      if (leadResult.rows.length === 0) {
        throw new NotFoundError('Lead');
      }

      const lead = leadResult.rows[0];

      // Criar cliente
      const createClientQuery = `
        INSERT INTO polox.clients (
          company_id, converted_from_lead_id, name, email, phone, 
          company_name, type, acquisition_date, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_DATE, NOW(), NOW())
        RETURNING id, name, email, phone, company_name, created_at
      `;

      const clientResult = await client.query(createClientQuery, [
        companyId,
        leadId,
        clientData.name || lead.name,
        clientData.email || lead.email,
        clientData.phone || lead.phone,
        clientData.company_name || lead.company_name,
        clientData.type || 'person'
      ]);

      const newClient = clientResult.rows[0];

      // Atualizar lead
      const updateLeadQuery = `
        UPDATE polox.leads 
        SET 
          status = 'convertido',
          converted_to_client_id = $1,
          converted_at = NOW(),
          conversion_value = $2,
          updated_at = NOW()
        WHERE id = $3 AND company_id = $4
        RETURNING id, status, converted_at, conversion_value
      `;

      const updatedLeadResult = await client.query(updateLeadQuery, [
        newClient.id,
        clientData.conversion_value || 0,
        leadId,
        companyId
      ]);

      return {
        client: newClient,
        lead: updatedLeadResult.rows[0]
      };
    }, { companyId });
  }

  /**
   * Atualiza score do lead
   * @param {number} id - ID do lead
   * @param {number} newScore - Novo score (0-100)
   * @param {number} companyId - ID da empresa
   * @returns {Promise<boolean>} True se atualizado com sucesso
   */
  static async updateScore(id, newScore, companyId) {
    if (newScore < 0 || newScore > 100) {
      throw new ValidationError('Score deve estar entre 0 e 100');
    }

    const updateQuery = `
      UPDATE polox.leads 
      SET score = $1, updated_at = NOW()
      WHERE id = $2 AND company_id = $3 AND deleted_at IS NULL
    `;

    try {
      const result = await query(updateQuery, [newScore, id, companyId], { companyId });
      return result.rowCount > 0;
    } catch (error) {
      throw new ApiError(500, `Erro ao atualizar score: ${error.message}`);
    }
  }

  /**
   * Registra contato com lead
   * @param {number} id - ID do lead
   * @param {number} companyId - ID da empresa
   * @returns {Promise<boolean>} True se atualizado com sucesso
   */
  static async recordContact(id, companyId) {
    const updateQuery = `
      UPDATE polox.leads 
      SET 
        last_contact_at = NOW(),
        first_contact_at = COALESCE(first_contact_at, NOW()),
        updated_at = NOW()
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
   * Soft delete do lead
   * @param {number} id - ID do lead
   * @param {number} companyId - ID da empresa
   * @returns {Promise<boolean>} True se deletado com sucesso
   */
  static async softDelete(id, companyId) {
    const updateQuery = `
      UPDATE polox.leads 
      SET deleted_at = NOW(), updated_at = NOW()
      WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL
    `;

    try {
      const result = await query(updateQuery, [id, companyId], { companyId });
      return result.rowCount > 0;
    } catch (error) {
      throw new ApiError(500, `Erro ao deletar lead: ${error.message}`);
    }
  }

  /**
   * Obtém estatísticas de leads da empresa
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object>} Estatísticas dos leads
   */
  static async getStats(companyId) {
    const statsQuery = `
      SELECT 
        COUNT(*) as total_leads,
        COUNT(CASE WHEN status = 'novo' THEN 1 END) as novos,
        COUNT(CASE WHEN status = 'contactado' THEN 1 END) as contactados,
        COUNT(CASE WHEN status = 'qualificado' THEN 1 END) as qualificados,
        COUNT(CASE WHEN status = 'convertido' THEN 1 END) as convertidos,
        COUNT(CASE WHEN status = 'perdido' THEN 1 END) as perdidos,
        COUNT(CASE WHEN temperature = 'quente' THEN 1 END) as quentes,
        COUNT(CASE WHEN temperature = 'morno' THEN 1 END) as mornos,
        COUNT(CASE WHEN temperature = 'frio' THEN 1 END) as frios,
        AVG(score) as score_medio,
        COALESCE(SUM(conversion_value), 0) as valor_total_conversoes
      FROM polox.leads 
      WHERE company_id = $1 AND deleted_at IS NULL
    `;

    try {
      const result = await query(statsQuery, [companyId], { companyId });
      return result.rows[0];
    } catch (error) {
      throw new ApiError(500, `Erro ao obter estatísticas: ${error.message}`);
    }
  }
}

module.exports = LeadModel;