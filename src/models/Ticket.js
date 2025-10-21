const { query, transaction } = require('../config/database');
const { ApiError, ValidationError, NotFoundError } = require('../utils/errors');

/**
 * Model para sistema de tickets/suporte
 * Baseado no schema polox.tickets
 */
class TicketModel {
  /**
   * Cria um novo ticket
   * @param {Object} ticketData - Dados do ticket
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object>} Ticket criado
   */
  static async create(ticketData, companyId) {
    const {
      client_id = null,
      user_id = null,
      title,
      description,
      category = 'general',
      priority = 'medium',
      status = 'open',
      source = 'manual',
      assigned_to = null,
      due_date = null,
      tags = null,
      custom_fields = null,
      attachments = null
    } = ticketData;

    // Validar dados obrigatórios
    if (!title) {
      throw new ValidationError('Título do ticket é obrigatório');
    }

    if (!description) {
      throw new ValidationError('Descrição do ticket é obrigatória');
    }

    if (!['low', 'medium', 'high', 'urgent'].includes(priority)) {
      throw new ValidationError('Prioridade deve ser: low, medium, high ou urgent');
    }

    if (!['open', 'in_progress', 'waiting_response', 'resolved', 'closed'].includes(status)) {
      throw new ValidationError('Status deve ser: open, in_progress, waiting_response, resolved ou closed');
    }

    return await transaction(async (client) => {
      // Gerar número único do ticket
      const ticketNumber = await this.generateTicketNumber(companyId, client);

      const insertQuery = `
        INSERT INTO polox.tickets (
          company_id, client_id, user_id, ticket_number, title, description,
          category, priority, status, source, assigned_to, due_date,
          tags, custom_fields, attachments, created_at, updated_at
        )
        VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10, $11, $12,
          $13, $14, $15, NOW(), NOW()
        )
        RETURNING 
          id, ticket_number, title, description, category, priority,
          status, source, assigned_to, due_date, created_at, updated_at
      `;

      const result = await client.query(insertQuery, [
        companyId, client_id, user_id, ticketNumber, title, description,
        category, priority, status, source, assigned_to, due_date,
        tags, custom_fields, attachments
      ]);

      return result.rows[0];
    }, { companyId });
  }

  /**
   * Gera número único do ticket
   * @param {number} companyId - ID da empresa
   * @param {Object} client - Cliente da transação
   * @returns {Promise<string>} Número do ticket
   */
  static async generateTicketNumber(companyId, client = null) {
    const queryClient = client || require('../config/database').query;
    
    const currentYear = new Date().getFullYear();
    const prefix = `TCK-${currentYear}`;
    
    const countQuery = `
      SELECT COUNT(*) as count 
      FROM polox.tickets 
      WHERE company_id = $1 AND ticket_number LIKE $2
    `;
    
    const countResult = await queryClient(countQuery, [companyId, `${prefix}%`]);
    const count = parseInt(countResult.rows[0].count) + 1;
    
    return `${prefix}-${count.toString().padStart(6, '0')}`;
  }

  /**
   * Busca ticket por ID
   * @param {number} id - ID do ticket
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object|null>} Ticket encontrado ou null
   */
  static async findById(id, companyId) {
    const selectQuery = `
      SELECT 
        t.*,
        c.name as client_name,
        c.email as client_email,
        c.phone as client_phone,
        u.name as user_name,
        u.email as user_email,
        assigned_user.name as assigned_user_name,
        assigned_user.email as assigned_user_email,
        (SELECT COUNT(*) FROM polox.ticket_comments WHERE ticket_id = t.id) as comment_count,
        (SELECT COUNT(*) FROM polox.ticket_history WHERE ticket_id = t.id) as history_count
      FROM polox.tickets t
      LEFT JOIN polox.clients c ON t.client_id = c.id
      LEFT JOIN polox.users u ON t.user_id = u.id
      LEFT JOIN polox.users assigned_user ON t.assigned_to = assigned_user.id
      WHERE t.id = $1 AND t.company_id = $2 AND t.deleted_at IS NULL
    `;

    try {
      const result = await query(selectQuery, [id, companyId], { companyId });
      return result.rows[0] || null;
    } catch (error) {
      throw new ApiError(500, `Erro ao buscar ticket: ${error.message}`);
    }
  }

  /**
   * Busca ticket por número
   * @param {string} ticketNumber - Número do ticket
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object|null>} Ticket encontrado ou null
   */
  static async findByNumber(ticketNumber, companyId) {
    const selectQuery = `
      SELECT 
        t.*,
        c.name as client_name,
        u.name as user_name,
        assigned_user.name as assigned_user_name
      FROM polox.tickets t
      LEFT JOIN polox.clients c ON t.client_id = c.id
      LEFT JOIN polox.users u ON t.user_id = u.id
      LEFT JOIN polox.users assigned_user ON t.assigned_to = assigned_user.id
      WHERE t.ticket_number = $1 AND t.company_id = $2 AND t.deleted_at IS NULL
    `;

    try {
      const result = await query(selectQuery, [ticketNumber, companyId], { companyId });
      return result.rows[0] || null;
    } catch (error) {
      throw new ApiError(500, `Erro ao buscar ticket por número: ${error.message}`);
    }
  }

  /**
   * Lista tickets com filtros e paginação
   * @param {Object} options - Opções de busca
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object>} Lista de tickets e metadados
   */
  static async list(options = {}, companyId) {
    const {
      page = 1,
      limit = 10,
      status = null,
      priority = null,
      category = null,
      assigned_to = null,
      client_id = null,
      date_from = null,
      date_to = null,
      search = null,
      sortBy = 'created_at',
      sortOrder = 'DESC'
    } = options;

    const offset = (page - 1) * limit;
    const conditions = ['t.company_id = $1', 't.deleted_at IS NULL'];
    const values = [companyId];
    let paramCount = 2;

    // Adicionar filtros
    if (status) {
      conditions.push(`t.status = $${paramCount}`);
      values.push(status);
      paramCount++;
    }

    if (priority) {
      conditions.push(`t.priority = $${paramCount}`);
      values.push(priority);
      paramCount++;
    }

    if (category) {
      conditions.push(`t.category = $${paramCount}`);
      values.push(category);
      paramCount++;
    }

    if (assigned_to) {
      conditions.push(`t.assigned_to = $${paramCount}`);
      values.push(assigned_to);
      paramCount++;
    }

    if (client_id) {
      conditions.push(`t.client_id = $${paramCount}`);
      values.push(client_id);
      paramCount++;
    }

    if (date_from) {
      conditions.push(`t.created_at >= $${paramCount}`);
      values.push(date_from);
      paramCount++;
    }

    if (date_to) {
      conditions.push(`t.created_at <= $${paramCount}`);
      values.push(date_to);
      paramCount++;
    }

    if (search) {
      conditions.push(`(t.title ILIKE $${paramCount} OR t.description ILIKE $${paramCount} OR t.ticket_number ILIKE $${paramCount})`);
      values.push(`%${search}%`);
      paramCount++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Query para contar total
    const countQuery = `
      SELECT COUNT(*) 
      FROM polox.tickets t
      LEFT JOIN polox.clients c ON t.client_id = c.id
      ${whereClause}
    `;

    // Query para buscar dados
    const selectQuery = `
      SELECT 
        t.id, t.ticket_number, t.title, t.description, t.category,
        t.priority, t.status, t.source, t.assigned_to, t.due_date,
        t.tags, t.created_at, t.updated_at,
        c.name as client_name,
        u.name as user_name,
        assigned_user.name as assigned_user_name,
        (SELECT COUNT(*) FROM polox.ticket_comments WHERE ticket_id = t.id) as comment_count,
        CASE 
          WHEN t.due_date IS NOT NULL AND t.due_date < NOW() AND t.status NOT IN ('resolved', 'closed') THEN true
          ELSE false
        END as is_overdue
      FROM polox.tickets t
      LEFT JOIN polox.clients c ON t.client_id = c.id
      LEFT JOIN polox.users u ON t.user_id = u.id
      LEFT JOIN polox.users assigned_user ON t.assigned_to = assigned_user.id
      ${whereClause}
      ORDER BY 
        CASE WHEN t.priority = 'urgent' THEN 1
             WHEN t.priority = 'high' THEN 2
             WHEN t.priority = 'medium' THEN 3
             WHEN t.priority = 'low' THEN 4
             ELSE 5 END,
        t.${sortBy} ${sortOrder}
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
      throw new ApiError(500, `Erro ao listar tickets: ${error.message}`);
    }
  }

  /**
   * Atualiza dados do ticket
   * @param {number} id - ID do ticket
   * @param {Object} updateData - Dados para atualizar
   * @param {number} companyId - ID da empresa
   * @param {number} userId - ID do usuário que fez a alteração
   * @returns {Promise<Object|null>} Ticket atualizado ou null
   */
  static async update(id, updateData, companyId, userId = null) {
    const allowedFields = [
      'title', 'description', 'category', 'priority', 'status',
      'assigned_to', 'due_date', 'tags', 'custom_fields'
    ];

    return await transaction(async (client) => {
      // Buscar ticket atual para histórico
      const currentTicket = await client.query(
        'SELECT * FROM polox.tickets WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL',
        [id, companyId]
      );

      if (currentTicket.rows.length === 0) {
        throw new NotFoundError('Ticket não encontrado');
      }

      const oldTicket = currentTicket.rows[0];
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
        UPDATE polox.tickets 
        SET ${updates.join(', ')}
        WHERE id = $${paramCount} AND company_id = $${paramCount + 1} AND deleted_at IS NULL
        RETURNING 
          id, ticket_number, title, description, category, priority,
          status, assigned_to, due_date, updated_at
      `;

      const result = await client.query(updateQuery, values);

      // Registrar mudanças no histórico
      for (const [field, newValue] of Object.entries(updateData)) {
        if (allowedFields.includes(field) && oldTicket[field] !== newValue) {
          await this.addHistory(id, companyId, {
            action: 'field_updated',
            field_name: field,
            old_value: oldTicket[field],
            new_value: newValue,
            user_id: userId
          }, client);
        }
      }

      return result.rows[0] || null;
    }, { companyId });
  }

  /**
   * Atualiza status do ticket
   * @param {number} id - ID do ticket
   * @param {string} newStatus - Novo status
   * @param {number} companyId - ID da empresa
   * @param {number} userId - ID do usuário
   * @param {string} comment - Comentário opcional
   * @returns {Promise<Object|null>} Ticket atualizado
   */
  static async updateStatus(id, newStatus, companyId, userId = null, comment = null) {
    if (!['open', 'in_progress', 'waiting_response', 'resolved', 'closed'].includes(newStatus)) {
      throw new ValidationError('Status inválido');
    }

    return await transaction(async (client) => {
      const currentTicket = await client.query(
        'SELECT * FROM polox.tickets WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL',
        [id, companyId]
      );

      if (currentTicket.rows.length === 0) {
        throw new NotFoundError('Ticket não encontrado');
      }

      const oldStatus = currentTicket.rows[0].status;

      // Definir campos adicionais baseados no status
      const additionalFields = {};
      if (newStatus === 'resolved') {
        additionalFields.resolved_at = 'NOW()';
      } else if (newStatus === 'closed') {
        additionalFields.closed_at = 'NOW()';
        if (!currentTicket.rows[0].resolved_at) {
          additionalFields.resolved_at = 'NOW()';
        }
      }

      const setClause = Object.keys(additionalFields).length > 0 
        ? `, ${Object.keys(additionalFields).map(field => `${field} = ${additionalFields[field]}`).join(', ')}`
        : '';

      const updateQuery = `
        UPDATE polox.tickets 
        SET status = $1, updated_at = NOW() ${setClause}
        WHERE id = $2 AND company_id = $3
        RETURNING *
      `;

      const result = await client.query(updateQuery, [newStatus, id, companyId]);

      // Adicionar histórico
      await this.addHistory(id, companyId, {
        action: 'status_changed',
        field_name: 'status',
        old_value: oldStatus,
        new_value: newStatus,
        user_id: userId,
        comment: comment
      }, client);

      return result.rows[0];
    }, { companyId });
  }

  /**
   * Atribui ticket a usuário
   * @param {number} id - ID do ticket
   * @param {number} assignedTo - ID do usuário responsável
   * @param {number} companyId - ID da empresa
   * @param {number} userId - ID do usuário que fez a atribuição
   * @returns {Promise<Object|null>} Ticket atualizado
   */
  static async assignTo(id, assignedTo, companyId, userId = null) {
    return await transaction(async (client) => {
      const currentTicket = await client.query(
        'SELECT * FROM polox.tickets WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL',
        [id, companyId]
      );

      if (currentTicket.rows.length === 0) {
        throw new NotFoundError('Ticket não encontrado');
      }

      const oldAssignedTo = currentTicket.rows[0].assigned_to;

      const updateQuery = `
        UPDATE polox.tickets 
        SET assigned_to = $1, updated_at = NOW()
        WHERE id = $2 AND company_id = $3
        RETURNING *
      `;

      const result = await client.query(updateQuery, [assignedTo, id, companyId]);

      // Adicionar histórico
      await this.addHistory(id, companyId, {
        action: 'assigned',
        field_name: 'assigned_to',
        old_value: oldAssignedTo,
        new_value: assignedTo,
        user_id: userId
      }, client);

      return result.rows[0];
    }, { companyId });
  }

  /**
   * Adiciona comentário ao ticket
   * @param {number} ticketId - ID do ticket
   * @param {number} companyId - ID da empresa
   * @param {Object} commentData - Dados do comentário
   * @returns {Promise<Object>} Comentário criado
   */
  static async addComment(ticketId, companyId, commentData) {
    const {
      user_id,
      content,
      is_internal = false,
      attachments = null
    } = commentData;

    if (!content) {
      throw new ValidationError('Conteúdo do comentário é obrigatório');
    }

    return await transaction(async (client) => {
      // Verificar se ticket existe
      const ticket = await client.query(
        'SELECT id FROM polox.tickets WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL',
        [ticketId, companyId]
      );

      if (ticket.rows.length === 0) {
        throw new NotFoundError('Ticket não encontrado');
      }

      const insertQuery = `
        INSERT INTO polox.ticket_comments (
          ticket_id, company_id, user_id, content, is_internal,
          attachments, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
        RETURNING 
          id, ticket_id, user_id, content, is_internal,
          attachments, created_at
      `;

      const result = await client.query(insertQuery, [
        ticketId, companyId, user_id, content, is_internal, attachments
      ]);

      // Atualizar timestamp do ticket
      await client.query(
        'UPDATE polox.tickets SET updated_at = NOW() WHERE id = $1',
        [ticketId]
      );

      // Adicionar histórico
      await this.addHistory(ticketId, companyId, {
        action: 'comment_added',
        user_id: user_id,
        comment: is_internal ? 'Comentário interno adicionado' : 'Comentário público adicionado'
      }, client);

      return result.rows[0];
    }, { companyId });
  }

  /**
   * Obtém comentários do ticket
   * @param {number} ticketId - ID do ticket
   * @param {number} companyId - ID da empresa
   * @param {Object} options - Opções de paginação
   * @returns {Promise<Object>} Lista de comentários
   */
  static async getComments(ticketId, companyId, options = {}) {
    const {
      page = 1,
      limit = 10,
      include_internal = true
    } = options;

    const offset = (page - 1) * limit;
    const conditions = ['tc.ticket_id = $1', 'tc.company_id = $2'];
    const values = [ticketId, companyId];
    let paramCount = 3;

    if (!include_internal) {
      conditions.push('tc.is_internal = FALSE');
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const selectQuery = `
      SELECT 
        tc.*,
        u.name as user_name,
        u.email as user_email
      FROM polox.ticket_comments tc
      LEFT JOIN polox.users u ON tc.user_id = u.id
      ${whereClause}
      ORDER BY tc.created_at ASC
      LIMIT $${paramCount} OFFSET $${paramCount + 1}
    `;

    const countQuery = `
      SELECT COUNT(*) 
      FROM polox.ticket_comments tc
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
      throw new ApiError(500, `Erro ao buscar comentários: ${error.message}`);
    }
  }

  /**
   * Adiciona entrada no histórico do ticket
   * @param {number} ticketId - ID do ticket
   * @param {number} companyId - ID da empresa
   * @param {Object} historyData - Dados do histórico
   * @param {Object} client - Cliente da transação
   * @returns {Promise<Object>} Entrada de histórico criada
   */
  static async addHistory(ticketId, companyId, historyData, client = null) {
    const {
      action,
      field_name = null,
      old_value = null,
      new_value = null,
      user_id = null,
      comment = null
    } = historyData;

    const queryClient = client || query;

    const insertQuery = `
      INSERT INTO polox.ticket_history (
        ticket_id, company_id, action, field_name, old_value,
        new_value, user_id, comment, created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      RETURNING *
    `;

    const result = await queryClient(insertQuery, [
      ticketId, companyId, action, field_name, old_value,
      new_value, user_id, comment
    ]);

    return result.rows[0];
  }

  /**
   * Obtém histórico do ticket
   * @param {number} ticketId - ID do ticket
   * @param {number} companyId - ID da empresa
   * @param {Object} options - Opções de paginação
   * @returns {Promise<Object>} Histórico do ticket
   */
  static async getHistory(ticketId, companyId, options = {}) {
    const {
      page = 1,
      limit = 20
    } = options;

    const offset = (page - 1) * limit;

    const selectQuery = `
      SELECT 
        th.*,
        u.name as user_name
      FROM polox.ticket_history th
      LEFT JOIN polox.users u ON th.user_id = u.id
      WHERE th.ticket_id = $1 AND th.company_id = $2
      ORDER BY th.created_at DESC
      LIMIT $3 OFFSET $4
    `;

    try {
      const result = await query(selectQuery, [ticketId, companyId, limit, offset], { companyId });
      return result.rows;
    } catch (error) {
      throw new ApiError(500, `Erro ao buscar histórico: ${error.message}`);
    }
  }

  /**
   * Obtém estatísticas de tickets
   * @param {number} companyId - ID da empresa
   * @param {Object} options - Opções de filtro
   * @returns {Promise<Object>} Estatísticas de tickets
   */
  static async getStats(companyId, options = {}) {
    const {
      date_from = null,
      date_to = null,
      assigned_to = null
    } = options;

    const conditions = ['company_id = $1', 'deleted_at IS NULL'];
    const values = [companyId];
    let paramCount = 2;

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

    if (assigned_to) {
      conditions.push(`assigned_to = $${paramCount}`);
      values.push(assigned_to);
      paramCount++;
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const statsQuery = `
      SELECT 
        COUNT(*) as total_tickets,
        COUNT(CASE WHEN status = 'open' THEN 1 END) as open_tickets,
        COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress_tickets,
        COUNT(CASE WHEN status = 'waiting_response' THEN 1 END) as waiting_response_tickets,
        COUNT(CASE WHEN status = 'resolved' THEN 1 END) as resolved_tickets,
        COUNT(CASE WHEN status = 'closed' THEN 1 END) as closed_tickets,
        COUNT(CASE WHEN priority = 'urgent' THEN 1 END) as urgent_tickets,
        COUNT(CASE WHEN priority = 'high' THEN 1 END) as high_priority_tickets,
        COUNT(CASE WHEN priority = 'medium' THEN 1 END) as medium_priority_tickets,
        COUNT(CASE WHEN priority = 'low' THEN 1 END) as low_priority_tickets,
        COUNT(CASE WHEN due_date IS NOT NULL AND due_date < NOW() AND status NOT IN ('resolved', 'closed') THEN 1 END) as overdue_tickets,
        COUNT(CASE WHEN assigned_to IS NOT NULL THEN 1 END) as assigned_tickets,
        COUNT(CASE WHEN assigned_to IS NULL THEN 1 END) as unassigned_tickets,
        COALESCE(AVG(EXTRACT(EPOCH FROM (COALESCE(resolved_at, NOW()) - created_at)) / 3600), 0) as avg_resolution_time_hours,
        COUNT(DISTINCT client_id) as unique_clients,
        COUNT(DISTINCT assigned_to) as unique_assignees
      FROM polox.tickets 
      ${whereClause}
    `;

    try {
      const result = await query(statsQuery, values, { companyId });
      return result.rows[0];
    } catch (error) {
      throw new ApiError(500, `Erro ao obter estatísticas: ${error.message}`);
    }
  }

  /**
   * Soft delete do ticket
   * @param {number} id - ID do ticket
   * @param {number} companyId - ID da empresa
   * @param {number} userId - ID do usuário
   * @returns {Promise<boolean>} True se deletado com sucesso
   */
  static async softDelete(id, companyId, userId = null) {
    return await transaction(async (client) => {
      const updateQuery = `
        UPDATE polox.tickets 
        SET deleted_at = NOW(), updated_at = NOW()
        WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL
      `;

      const result = await client.query(updateQuery, [id, companyId]);

      if (result.rowCount > 0) {
        // Adicionar histórico
        await this.addHistory(id, companyId, {
          action: 'deleted',
          user_id: userId,
          comment: 'Ticket deletado'
        }, client);
      }

      return result.rowCount > 0;
    }, { companyId });
  }

  /**
   * Obtém tickets em atraso
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Array>} Lista de tickets em atraso
   */
  static async getOverdueTickets(companyId) {
    const selectQuery = `
      SELECT 
        t.*,
        c.name as client_name,
        assigned_user.name as assigned_user_name,
        EXTRACT(EPOCH FROM (NOW() - t.due_date)) / 3600 as hours_overdue
      FROM polox.tickets t
      LEFT JOIN polox.clients c ON t.client_id = c.id
      LEFT JOIN polox.users assigned_user ON t.assigned_to = assigned_user.id
      WHERE t.company_id = $1 
        AND t.due_date IS NOT NULL 
        AND t.due_date < NOW() 
        AND t.status NOT IN ('resolved', 'closed')
        AND t.deleted_at IS NULL
      ORDER BY t.due_date ASC
    `;

    try {
      const result = await query(selectQuery, [companyId], { companyId });
      return result.rows;
    } catch (error) {
      throw new ApiError(500, `Erro ao buscar tickets em atraso: ${error.message}`);
    }
  }

  /**
   * Obtém tickets por categoria
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Array>} Tickets agrupados por categoria
   */
  static async getByCategory(companyId) {
    const categoryQuery = `
      SELECT 
        category,
        COUNT(*) as total_tickets,
        COUNT(CASE WHEN status = 'open' THEN 1 END) as open_tickets,
        COUNT(CASE WHEN status = 'resolved' THEN 1 END) as resolved_tickets,
        COUNT(CASE WHEN status = 'closed' THEN 1 END) as closed_tickets,
        COALESCE(AVG(EXTRACT(EPOCH FROM (COALESCE(resolved_at, NOW()) - created_at)) / 3600), 0) as avg_resolution_time_hours
      FROM polox.tickets 
      WHERE company_id = $1 AND deleted_at IS NULL
      GROUP BY category
      ORDER BY total_tickets DESC
    `;

    try {
      const result = await query(categoryQuery, [companyId], { companyId });
      return result.rows;
    } catch (error) {
      throw new ApiError(500, `Erro ao obter tickets por categoria: ${error.message}`);
    }
  }
}

module.exports = TicketModel;