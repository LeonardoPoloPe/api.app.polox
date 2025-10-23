const { query } = require('../config/database');
const { ApiError, ValidationError, NotFoundError } = require('../utils/errors');

/**
 * Model para gerenciamento de anotações de clientes
 * Baseado no schema polox.client_notes
 */
class ClientNoteModel {
  /**
   * Cria uma nova anotação para um cliente
   * @param {Object} noteData - Dados da anotação
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object>} Anotação criada
   */
  static async create(noteData, companyId) {
    const {
      client_id,
      created_by_id,
      content,
      type = 'general'
    } = noteData;

    // Validar dados obrigatórios
    if (!client_id) {
      throw new ValidationError('ID do cliente é obrigatório');
    }

    if (!content || content.trim().length === 0) {
      throw new ValidationError('Conteúdo da anotação é obrigatório');
    }

    if (!created_by_id) {
      throw new ValidationError('ID do usuário criador é obrigatório');
    }

    const insertQuery = `
      INSERT INTO polox.client_notes (
        client_id, created_by_id, content, type, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, NOW(), NOW())
      RETURNING 
        id, client_id, created_by_id, content, type, 
        created_at, updated_at, deleted_at
    `;

    try {
      const result = await query(insertQuery, [
        client_id,
        created_by_id,
        content,
        type
      ], { companyId });

      return result.rows[0];
    } catch (error) {
      if (error.code === '23503') {
        throw new ValidationError('Cliente ou usuário não encontrado');
      }
      throw new ApiError(500, `Erro ao criar anotação: ${error.message}`);
    }
  }

  /**
   * Busca anotação por ID
   * @param {number} id - ID da anotação
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object|null>} Anotação encontrada ou null
   */
  static async findById(id, companyId) {
    const selectQuery = `
      SELECT 
        cn.*,
        c.name as client_name,
        c.email as client_email,
        u.name as created_by_name,
        u.email as created_by_email
      FROM polox.client_notes cn
      INNER JOIN polox.clients c ON cn.client_id = c.id
      INNER JOIN polox.users u ON cn.created_by_id = u.id
      WHERE cn.id = $1 
        AND c.company_id = $2 
        AND cn.deleted_at IS NULL
        AND c.deleted_at IS NULL
    `;

    try {
      const result = await query(selectQuery, [id, companyId], { companyId });
      return result.rows[0] || null;
    } catch (error) {
      throw new ApiError(500, `Erro ao buscar anotação: ${error.message}`);
    }
  }

  /**
   * Lista anotações de um cliente
   * @param {number} clientId - ID do cliente
   * @param {Object} options - Opções de busca
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object>} Lista de anotações e metadados
   */
  static async listByClient(clientId, options = {}, companyId) {
    const {
      page = 1,
      limit = 10,
      type = null,
      sortBy = 'created_at',
      sortOrder = 'DESC'
    } = options;

    const offset = (page - 1) * limit;
    const conditions = [
      'cn.client_id = $1',
      'c.company_id = $2',
      'cn.deleted_at IS NULL',
      'c.deleted_at IS NULL'
    ];
    const values = [clientId, companyId];
    let paramCount = 3;

    // Adicionar filtro por tipo
    if (type) {
      conditions.push(`cn.type = $${paramCount}`);
      values.push(type);
      paramCount++;
    }

    const whereClause = conditions.join(' AND ');

    // Query para contar total
    const countQuery = `
      SELECT COUNT(*) 
      FROM polox.client_notes cn
      INNER JOIN polox.clients c ON cn.client_id = c.id
      WHERE ${whereClause}
    `;

    // Query para buscar dados
    const selectQuery = `
      SELECT 
        cn.id, cn.client_id, cn.created_by_id, cn.content, cn.type,
        cn.created_at, cn.updated_at,
        u.name as created_by_name,
        u.email as created_by_email
      FROM polox.client_notes cn
      INNER JOIN polox.clients c ON cn.client_id = c.id
      LEFT JOIN polox.users u ON cn.created_by_id = u.id
      WHERE ${whereClause}
      ORDER BY cn.${sortBy} ${sortOrder}
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
      throw new ApiError(500, `Erro ao listar anotações: ${error.message}`);
    }
  }

  /**
   * Lista todas as anotações da empresa
   * @param {Object} options - Opções de busca
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object>} Lista de anotações e metadados
   */
  static async list(options = {}, companyId) {
    const {
      page = 1,
      limit = 10,
      type = null,
      client_id = null,
      created_by_id = null,
      search = null,
      sortBy = 'created_at',
      sortOrder = 'DESC'
    } = options;

    const offset = (page - 1) * limit;
    const conditions = [
      'c.company_id = $1',
      'cn.deleted_at IS NULL',
      'c.deleted_at IS NULL'
    ];
    const values = [companyId];
    let paramCount = 2;

    // Adicionar filtros
    if (type) {
      conditions.push(`cn.type = $${paramCount}`);
      values.push(type);
      paramCount++;
    }

    if (client_id) {
      conditions.push(`cn.client_id = $${paramCount}`);
      values.push(client_id);
      paramCount++;
    }

    if (created_by_id) {
      conditions.push(`cn.created_by_id = $${paramCount}`);
      values.push(created_by_id);
      paramCount++;
    }

    if (search) {
      conditions.push(`(cn.content ILIKE $${paramCount} OR c.name ILIKE $${paramCount})`);
      values.push(`%${search}%`);
      paramCount++;
    }

    const whereClause = conditions.join(' AND ');

    // Query para contar total
    const countQuery = `
      SELECT COUNT(*) 
      FROM polox.client_notes cn
      INNER JOIN polox.clients c ON cn.client_id = c.id
      WHERE ${whereClause}
    `;

    // Query para buscar dados
    const selectQuery = `
      SELECT 
        cn.id, cn.client_id, cn.created_by_id, cn.content, cn.type,
        cn.created_at, cn.updated_at,
        c.name as client_name,
        c.email as client_email,
        u.name as created_by_name,
        u.email as created_by_email
      FROM polox.client_notes cn
      INNER JOIN polox.clients c ON cn.client_id = c.id
      LEFT JOIN polox.users u ON cn.created_by_id = u.id
      WHERE ${whereClause}
      ORDER BY cn.${sortBy} ${sortOrder}
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
      throw new ApiError(500, `Erro ao listar anotações: ${error.message}`);
    }
  }

  /**
   * Atualiza dados da anotação
   * @param {number} id - ID da anotação
   * @param {Object} updateData - Dados para atualizar
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object|null>} Anotação atualizada ou null
   */
  static async update(id, updateData, companyId) {
    const allowedFields = ['content', 'type'];

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
      UPDATE polox.client_notes cn
      SET ${updates.join(', ')}
      FROM polox.clients c
      WHERE cn.id = $${paramCount} 
        AND cn.client_id = c.id
        AND c.company_id = $${paramCount + 1} 
        AND cn.deleted_at IS NULL
        AND c.deleted_at IS NULL
      RETURNING 
        cn.id, cn.client_id, cn.created_by_id, cn.content, cn.type,
        cn.created_at, cn.updated_at
    `;

    try {
      const result = await query(updateQuery, values, { companyId });
      return result.rows[0] || null;
    } catch (error) {
      throw new ApiError(500, `Erro ao atualizar anotação: ${error.message}`);
    }
  }

  /**
   * Soft delete da anotação
   * @param {number} id - ID da anotação
   * @param {number} companyId - ID da empresa
   * @returns {Promise<boolean>} True se deletado com sucesso
   */
  static async softDelete(id, companyId) {
    const updateQuery = `
      UPDATE polox.client_notes cn
      SET 
        deleted_at = NOW(),
        updated_at = NOW()
      FROM polox.clients c
      WHERE cn.id = $1 
        AND cn.client_id = c.id
        AND c.company_id = $2 
        AND cn.deleted_at IS NULL
    `;

    try {
      const result = await query(updateQuery, [id, companyId], { companyId });
      return result.rowCount > 0;
    } catch (error) {
      throw new ApiError(500, `Erro ao deletar anotação: ${error.message}`);
    }
  }

  /**
   * Obtém estatísticas de anotações de um cliente
   * @param {number} clientId - ID do cliente
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object>} Estatísticas das anotações
   */
  static async getClientStats(clientId, companyId) {
    const statsQuery = `
      SELECT 
        COUNT(*) as total_notes,
        COUNT(CASE WHEN type = 'general' THEN 1 END) as general_notes,
        COUNT(CASE WHEN type = 'call' THEN 1 END) as call_notes,
        COUNT(CASE WHEN type = 'meeting' THEN 1 END) as meeting_notes,
        COUNT(CASE WHEN type = 'email' THEN 1 END) as email_notes,
        COUNT(CASE WHEN type = 'other' THEN 1 END) as other_notes,
        MAX(cn.created_at) as last_note_date,
        MIN(cn.created_at) as first_note_date
      FROM polox.client_notes cn
      INNER JOIN polox.clients c ON cn.client_id = c.id
      WHERE cn.client_id = $1 
        AND c.company_id = $2 
        AND cn.deleted_at IS NULL
        AND c.deleted_at IS NULL
    `;

    try {
      const result = await query(statsQuery, [clientId, companyId], { companyId });
      return result.rows[0];
    } catch (error) {
      throw new ApiError(500, `Erro ao obter estatísticas: ${error.message}`);
    }
  }

  /**
   * Obtém estatísticas gerais de anotações da empresa
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object>} Estatísticas das anotações
   */
  static async getCompanyStats(companyId) {
    const statsQuery = `
      SELECT 
        COUNT(*) as total_notes,
        COUNT(DISTINCT cn.client_id) as clients_with_notes,
        COUNT(DISTINCT cn.created_by_id) as users_created_notes,
        COUNT(CASE WHEN type = 'general' THEN 1 END) as general_notes,
        COUNT(CASE WHEN type = 'call' THEN 1 END) as call_notes,
        COUNT(CASE WHEN type = 'meeting' THEN 1 END) as meeting_notes,
        COUNT(CASE WHEN type = 'email' THEN 1 END) as email_notes,
        COUNT(CASE WHEN type = 'other' THEN 1 END) as other_notes,
        COUNT(CASE WHEN cn.created_at >= CURRENT_DATE - INTERVAL '7 days' THEN 1 END) as notes_last_7_days,
        COUNT(CASE WHEN cn.created_at >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as notes_last_30_days
      FROM polox.client_notes cn
      INNER JOIN polox.clients c ON cn.client_id = c.id
      WHERE c.company_id = $1 
        AND cn.deleted_at IS NULL
        AND c.deleted_at IS NULL
    `;

    try {
      const result = await query(statsQuery, [companyId], { companyId });
      return result.rows[0];
    } catch (error) {
      throw new ApiError(500, `Erro ao obter estatísticas: ${error.message}`);
    }
  }

  /**
   * Busca as últimas anotações de um cliente
   * @param {number} clientId - ID do cliente
   * @param {number} limit - Quantidade de anotações
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Array>} Lista de anotações recentes
   */
  static async getRecentByClient(clientId, limit = 5, companyId) {
    const selectQuery = `
      SELECT 
        cn.id, cn.client_id, cn.created_by_id, cn.content, cn.type,
        cn.created_at, cn.updated_at,
        u.name as created_by_name
      FROM polox.client_notes cn
      INNER JOIN polox.clients c ON cn.client_id = c.id
      LEFT JOIN polox.users u ON cn.created_by_id = u.id
      WHERE cn.client_id = $1 
        AND c.company_id = $2 
        AND cn.deleted_at IS NULL
        AND c.deleted_at IS NULL
      ORDER BY cn.created_at DESC
      LIMIT $3
    `;

    try {
      const result = await query(selectQuery, [clientId, companyId, limit], { companyId });
      return result.rows;
    } catch (error) {
      throw new ApiError(500, `Erro ao buscar anotações recentes: ${error.message}`);
    }
  }
}

module.exports = ClientNoteModel;
