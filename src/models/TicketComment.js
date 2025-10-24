const { query, transaction } = require('../config/database');
const { ApiError, ValidationError, NotFoundError } = require('../utils/errors');

/**
 * Model para comentários de tickets
 * Baseado no schema polox.ticket_comments
 */
class TicketCommentModel {
  /**
   * Cria um novo comentário
   * @param {Object} commentData - Dados do comentário
   * @returns {Promise<Object>} Comentário criado
   */
  static async create(commentData) {
    const {
      ticket_id,
      user_id,
      content,
      is_internal = false,
      attachments = []
    } = commentData;

    // Validar dados obrigatórios
    if (!ticket_id || !user_id || !content) {
      throw new ValidationError('Ticket ID, User ID e conteúdo são obrigatórios');
    }

    if (content.trim().length === 0) {
      throw new ValidationError('Conteúdo não pode estar vazio');
    }

    const insertQuery = `
      INSERT INTO polox.ticket_comments (
        ticket_id, user_id, content, is_internal, attachments,
        created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
      RETURNING 
        id, ticket_id, user_id, content, is_internal, attachments,
        created_at, updated_at
    `;

    try {
      const result = await query(insertQuery, [
        ticket_id, user_id, content, is_internal, JSON.stringify(attachments)
      ]);

      return result.rows[0];
    } catch (error) {
      if (error.code === '23503') {
        if (error.constraint?.includes('ticket')) {
          throw new ValidationError('Ticket informado não existe');
        }
        if (error.constraint?.includes('user')) {
          throw new ValidationError('Usuário informado não existe');
        }
      }
      throw new ApiError(500, `Erro ao criar comentário: ${error.message}`);
    }
  }

  /**
   * Busca comentário por ID
   * @param {number} id - ID do comentário
   * @param {number} companyId - ID da empresa (multi-tenant)
   * @returns {Promise<Object|null>} Comentário encontrado ou null
   */
  static async findById(id, companyId) {
    const selectQuery = `
      SELECT 
        tc.id, tc.ticket_id, tc.user_id, tc.content, tc.is_internal, 
        tc.attachments, tc.created_at, tc.updated_at,
        u.full_name as user_name,
        u.avatar_url as user_avatar,
        u.role as user_role,
        t.title as ticket_title,
        t.company_id
      FROM polox.ticket_comments tc
      INNER JOIN polox.users u ON tc.user_id = u.id
      INNER JOIN polox.tickets t ON tc.ticket_id = t.id
      WHERE tc.id = $1 AND t.company_id = $2
    `;

    try {
      const result = await query(selectQuery, [id, companyId], { companyId });
      const comment = result.rows[0];
      
      if (comment && comment.attachments) {
        comment.attachments = typeof comment.attachments === 'string' 
          ? JSON.parse(comment.attachments) 
          : comment.attachments;
      }

      return comment || null;
    } catch (error) {
      throw new ApiError(500, `Erro ao buscar comentário: ${error.message}`);
    }
  }

  /**
   * Lista comentários de um ticket
   * @param {number} ticketId - ID do ticket
   * @param {number} companyId - ID da empresa
   * @param {Object} options - Opções de filtro
   * @returns {Promise<Array>} Lista de comentários
   */
  static async findByTicket(ticketId, companyId, options = {}) {
    const { 
      include_internal = true,
      user_id = null,
      page = 1, 
      limit = 50
    } = options;
    
    const offset = (page - 1) * limit;
    
    let whereClause = 'WHERE tc.ticket_id = $1 AND t.company_id = $2';
    const params = [ticketId, companyId];
    
    if (!include_internal) {
      whereClause += ' AND tc.is_internal = false';
    }

    if (user_id) {
      whereClause += ` AND tc.user_id = $${params.length + 1}`;
      params.push(user_id);
    }

    const selectQuery = `
      SELECT 
        tc.id, tc.ticket_id, tc.user_id, tc.content, tc.is_internal, 
        tc.attachments, tc.created_at, tc.updated_at,
        u.full_name as user_name,
        u.avatar_url as user_avatar,
        u.role as user_role
      FROM polox.ticket_comments tc
      INNER JOIN polox.users u ON tc.user_id = u.id
      INNER JOIN polox.tickets t ON tc.ticket_id = t.id
      ${whereClause}
      ORDER BY tc.created_at ASC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    params.push(limit, offset);

    try {
      const result = await query(selectQuery, params, { companyId });
      
      return result.rows.map(comment => {
        if (comment.attachments) {
          comment.attachments = typeof comment.attachments === 'string' 
            ? JSON.parse(comment.attachments) 
            : comment.attachments;
        }
        return comment;
      });
    } catch (error) {
      throw new ApiError(500, `Erro ao buscar comentários: ${error.message}`);
    }
  }

  /**
   * Lista comentários públicos de um ticket (para clientes)
   * @param {number} ticketId - ID do ticket
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Array>} Lista de comentários públicos
   */
  static async findPublicByTicket(ticketId, companyId) {
    return await this.findByTicket(ticketId, companyId, {
      include_internal: false,
      limit: 100
    });
  }

  /**
   * Lista comentários internos de um ticket (para equipe)
   * @param {number} ticketId - ID do ticket
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Array>} Lista de comentários internos
   */
  static async findInternalByTicket(ticketId, companyId) {
    const selectQuery = `
      SELECT 
        tc.id, tc.ticket_id, tc.user_id, tc.content, tc.is_internal, 
        tc.attachments, tc.created_at, tc.updated_at,
        u.full_name as user_name,
        u.avatar_url as user_avatar,
        u.role as user_role
      FROM polox.ticket_comments tc
      INNER JOIN polox.users u ON tc.user_id = u.id
      INNER JOIN polox.tickets t ON tc.ticket_id = t.id
      WHERE tc.ticket_id = $1 AND t.company_id = $2 AND tc.is_internal = true
      ORDER BY tc.created_at ASC
    `;

    try {
      const result = await query(selectQuery, [ticketId, companyId], { companyId });
      
      return result.rows.map(comment => {
        if (comment.attachments) {
          comment.attachments = typeof comment.attachments === 'string' 
            ? JSON.parse(comment.attachments) 
            : comment.attachments;
        }
        return comment;
      });
    } catch (error) {
      throw new ApiError(500, `Erro ao buscar comentários internos: ${error.message}`);
    }
  }

  /**
   * Atualiza um comentário
   * @param {number} id - ID do comentário
   * @param {Object} updateData - Dados para atualização
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object>} Comentário atualizado
   */
  static async update(id, updateData, companyId) {
    // Verificar se comentário existe e pertence à empresa
    const existing = await this.findById(id, companyId);
    if (!existing) {
      throw new NotFoundError('Comentário não encontrado');
    }

    const {
      content,
      is_internal,
      attachments
    } = updateData;

    // Validação de conteúdo
    if (content !== undefined && content.trim().length === 0) {
      throw new ValidationError('Conteúdo não pode estar vazio');
    }

    const updateFields = [];
    const params = [];
    let paramCount = 1;

    if (content !== undefined) {
      updateFields.push(`content = $${paramCount++}`);
      params.push(content);
    }

    if (is_internal !== undefined) {
      updateFields.push(`is_internal = $${paramCount++}`);
      params.push(is_internal);
    }

    if (attachments !== undefined) {
      updateFields.push(`attachments = $${paramCount++}`);
      params.push(JSON.stringify(attachments));
    }

    if (updateFields.length === 0) {
      throw new ValidationError('Nenhum campo para atualizar');
    }

    updateFields.push(`updated_at = NOW()`);
    params.push(id);

    const updateQuery = `
      UPDATE polox.ticket_comments 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramCount++}
      RETURNING 
        id, ticket_id, user_id, content, is_internal, attachments,
        created_at, updated_at
    `;

    try {
      const result = await query(updateQuery, params);
      
      if (result.rows.length === 0) {
        throw new NotFoundError('Comentário não encontrado');
      }

      return result.rows[0];
    } catch (error) {
      throw new ApiError(500, `Erro ao atualizar comentário: ${error.message}`);
    }
  }

  /**
   * Remove um comentário
   * @param {number} id - ID do comentário
   * @param {number} companyId - ID da empresa
   * @returns {Promise<boolean>} True se removido com sucesso
   */
  static async delete(id, companyId) {
    // Verificar se comentário existe
    const existing = await this.findById(id, companyId);
    if (!existing) {
      throw new NotFoundError('Comentário não encontrado');
    }

    const deleteQuery = `
      DELETE FROM polox.ticket_comments 
      WHERE id = $1
    `;

    try {
      const result = await query(deleteQuery, [id]);
      return result.rowCount > 0;
    } catch (error) {
      throw new ApiError(500, `Erro ao remover comentário: ${error.message}`);
    }
  }

  /**
   * Conta comentários de um ticket
   * @param {number} ticketId - ID do ticket
   * @param {number} companyId - ID da empresa
   * @param {boolean} includeInternal - Se deve incluir comentários internos
   * @returns {Promise<Object>} Contadores
   */
  static async countByTicket(ticketId, companyId, includeInternal = true) {
    let whereClause = 'WHERE tc.ticket_id = $1 AND t.company_id = $2';
    const params = [ticketId, companyId];

    const countQuery = `
      SELECT 
        COUNT(*) as total_comments,
        COUNT(CASE WHEN tc.is_internal = false THEN 1 END) as public_comments,
        COUNT(CASE WHEN tc.is_internal = true THEN 1 END) as internal_comments,
        COUNT(DISTINCT tc.user_id) as unique_commenters
      FROM polox.ticket_comments tc
      INNER JOIN polox.tickets t ON tc.ticket_id = t.id
      ${whereClause}
    `;

    try {
      const result = await query(countQuery, params, { companyId });
      const counts = result.rows[0];

      return {
        total_comments: parseInt(counts.total_comments) || 0,
        public_comments: parseInt(counts.public_comments) || 0,
        internal_comments: parseInt(counts.internal_comments) || 0,
        unique_commenters: parseInt(counts.unique_commenters) || 0
      };
    } catch (error) {
      throw new ApiError(500, `Erro ao contar comentários: ${error.message}`);
    }
  }

  /**
   * Busca último comentário de um ticket
   * @param {number} ticketId - ID do ticket
   * @param {number} companyId - ID da empresa
   * @param {boolean} includeInternal - Se deve incluir comentários internos
   * @returns {Promise<Object|null>} Último comentário ou null
   */
  static async findLastByTicket(ticketId, companyId, includeInternal = true) {
    let whereClause = 'WHERE tc.ticket_id = $1 AND t.company_id = $2';
    const params = [ticketId, companyId];

    if (!includeInternal) {
      whereClause += ' AND tc.is_internal = false';
    }

    const selectQuery = `
      SELECT 
        tc.id, tc.ticket_id, tc.user_id, tc.content, tc.is_internal, 
        tc.attachments, tc.created_at, tc.updated_at,
        u.full_name as user_name,
        u.avatar_url as user_avatar,
        u.role as user_role
      FROM polox.ticket_comments tc
      INNER JOIN polox.users u ON tc.user_id = u.id
      INNER JOIN polox.tickets t ON tc.ticket_id = t.id
      ${whereClause}
      ORDER BY tc.created_at DESC
      LIMIT 1
    `;

    try {
      const result = await query(selectQuery, params, { companyId });
      const comment = result.rows[0];
      
      if (comment && comment.attachments) {
        comment.attachments = typeof comment.attachments === 'string' 
          ? JSON.parse(comment.attachments) 
          : comment.attachments;
      }

      return comment || null;
    } catch (error) {
      throw new ApiError(500, `Erro ao buscar último comentário: ${error.message}`);
    }
  }

  /**
   * Lista comentários recentes da empresa
   * @param {number} companyId - ID da empresa
   * @param {Object} options - Opções de filtro
   * @returns {Promise<Array>} Lista de comentários recentes
   */
  static async findRecentByCompany(companyId, options = {}) {
    const { 
      limit = 10,
      days = 7,
      include_internal = true,
      user_id = null
    } = options;
    
    let whereClause = `
      WHERE t.company_id = $1 
      AND tc.created_at > NOW() - INTERVAL '${days} days'
    `;
    const params = [companyId];

    if (!include_internal) {
      whereClause += ' AND tc.is_internal = false';
    }

    if (user_id) {
      whereClause += ` AND tc.user_id = $${params.length + 1}`;
      params.push(user_id);
    }

    const selectQuery = `
      SELECT 
        tc.id, tc.ticket_id, tc.user_id, tc.content, tc.is_internal, 
        tc.attachments, tc.created_at, tc.updated_at,
        u.full_name as user_name,
        u.avatar_url as user_avatar,
        t.title as ticket_title,
        t.status as ticket_status
      FROM polox.ticket_comments tc
      INNER JOIN polox.users u ON tc.user_id = u.id
      INNER JOIN polox.tickets t ON tc.ticket_id = t.id
      ${whereClause}
      ORDER BY tc.created_at DESC
      LIMIT $${params.length + 1}
    `;

    params.push(limit);

    try {
      const result = await query(selectQuery, params, { companyId });
      
      return result.rows.map(comment => {
        if (comment.attachments) {
          comment.attachments = typeof comment.attachments === 'string' 
            ? JSON.parse(comment.attachments) 
            : comment.attachments;
        }
        return comment;
      });
    } catch (error) {
      throw new ApiError(500, `Erro ao buscar comentários recentes: ${error.message}`);
    }
  }

  /**
   * Busca comentários com anexos
   * @param {number} ticketId - ID do ticket
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Array>} Lista de comentários com anexos
   */
  static async findWithAttachments(ticketId, companyId) {
    const selectQuery = `
      SELECT 
        tc.id, tc.ticket_id, tc.user_id, tc.content, tc.is_internal, 
        tc.attachments, tc.created_at, tc.updated_at,
        u.full_name as user_name,
        u.avatar_url as user_avatar
      FROM polox.ticket_comments tc
      INNER JOIN polox.users u ON tc.user_id = u.id
      INNER JOIN polox.tickets t ON tc.ticket_id = t.id
      WHERE tc.ticket_id = $1 AND t.company_id = $2 
        AND tc.attachments IS NOT NULL 
        AND tc.attachments != '[]'
      ORDER BY tc.created_at ASC
    `;

    try {
      const result = await query(selectQuery, [ticketId, companyId], { companyId });
      
      return result.rows.map(comment => {
        comment.attachments = typeof comment.attachments === 'string' 
          ? JSON.parse(comment.attachments) 
          : comment.attachments;
        return comment;
      });
    } catch (error) {
      throw new ApiError(500, `Erro ao buscar comentários com anexos: ${error.message}`);
    }
  }

  /**
   * Estatísticas de comentários por usuário
   * @param {number} companyId - ID da empresa
   * @param {Object} dateRange - Período para análise
   * @returns {Promise<Array>} Estatísticas por usuário
   */
  static async getStatsPerUser(companyId, dateRange = {}) {
    const { start_date, end_date } = dateRange;

    let whereClause = 'WHERE t.company_id = $1';
    const params = [companyId];

    if (start_date) {
      whereClause += ` AND tc.created_at >= $${params.length + 1}`;
      params.push(start_date);
    }

    if (end_date) {
      whereClause += ` AND tc.created_at <= $${params.length + 1}`;
      params.push(end_date);
    }

    const statsQuery = `
      SELECT 
        u.id as user_id,
        u.full_name as user_name,
        u.role as user_role,
        COUNT(*) as total_comments,
        COUNT(CASE WHEN tc.is_internal = true THEN 1 END) as internal_comments,
        COUNT(CASE WHEN tc.is_internal = false THEN 1 END) as public_comments,
        COUNT(DISTINCT tc.ticket_id) as tickets_commented,
        MIN(tc.created_at) as first_comment_date,
        MAX(tc.created_at) as last_comment_date
      FROM polox.ticket_comments tc
      INNER JOIN polox.users u ON tc.user_id = u.id
      INNER JOIN polox.tickets t ON tc.ticket_id = t.id
      ${whereClause}
      GROUP BY u.id, u.full_name, u.role
      ORDER BY total_comments DESC
    `;

    try {
      const result = await query(statsQuery, params, { companyId });
      return result.rows.map(row => ({
        ...row,
        total_comments: parseInt(row.total_comments),
        internal_comments: parseInt(row.internal_comments),
        public_comments: parseInt(row.public_comments),
        tickets_commented: parseInt(row.tickets_commented)
      }));
    } catch (error) {
      throw new ApiError(500, `Erro ao buscar estatísticas: ${error.message}`);
    }
  }
}

module.exports = TicketCommentModel;