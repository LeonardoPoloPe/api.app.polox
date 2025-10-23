const { query, transaction } = require('../config/database');
const { ApiError, ValidationError, NotFoundError } = require('../utils/errors');

/**
 * Model para sistema de eventos/agenda
 * Baseado no schema polox.events
 */
class EventModel {
  /**
   * Cria um novo evento
   * @param {Object} eventData - Dados do evento
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object>} Evento criado
   */
  static async create(eventData, companyId) {
    const {
      title,
      description = null,
      event_type = 'meeting',
      start_date,
      end_date = null,
      all_day = false,
      location = null,
      status = 'scheduled',
      priority = 'medium',
      organizer_id,
      client_id = null,
      lead_id = null,
      sale_id = null,
      recurrence_rule = null,
      reminder_minutes = 15,
      is_private = false,
      tags = [], // Array de nomes de tags - será processado separadamente
      custom_fields = null,
      attachments = null
    } = eventData;

    // Validar dados obrigatórios
    if (!title) {
      throw new ValidationError('Título do evento é obrigatório');
    }

    if (!start_date) {
      throw new ValidationError('Data de início é obrigatória');
    }

    if (!organizer_id) {
      throw new ValidationError('Organizador é obrigatório');
    }

    if (!['meeting', 'call', 'task', 'appointment', 'reminder', 'follow_up', 'demo', 'training', 'other'].includes(event_type)) {
      throw new ValidationError('Tipo de evento inválido');
    }

    if (!['scheduled', 'in_progress', 'completed', 'cancelled', 'postponed'].includes(status)) {
      throw new ValidationError('Status inválido');
    }

    // Validar datas
    const startDateTime = new Date(start_date);
    const endDateTime = end_date ? new Date(end_date) : null;

    if (endDateTime && endDateTime <= startDateTime) {
      throw new ValidationError('Data de fim deve ser posterior à data de início');
    }

    return await transaction(async (client) => {
      // 1. Criar o evento (sem tags)
      const insertQuery = `
        INSERT INTO polox.events (
          company_id, title, description, event_type, start_date, end_date,
          all_day, location, status, priority, organizer_id, client_id,
          lead_id, sale_id, recurrence_rule, reminder_minutes, is_private,
          custom_fields, attachments, created_at, updated_at
        )
        VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10, $11, $12,
          $13, $14, $15, $16, $17,
          $18, $19, NOW(), NOW()
        )
        RETURNING 
          id, title, description, event_type, start_date, end_date,
          all_day, location, status, priority, organizer_id,
          reminder_minutes, is_private, created_at, updated_at
      `;

      const result = await client.query(insertQuery, [
        companyId, title, description, event_type, start_date, end_date,
        all_day, location, status, priority, organizer_id, client_id,
        lead_id, sale_id, recurrence_rule, reminder_minutes, is_private,
        custom_fields, attachments
      ]);

      const event = result.rows[0];

      // 2. Adicionar tags
      if (tags && tags.length > 0) {
        for (const tagName of tags) {
          if (tagName && tagName.trim() !== '') {
            // Inserir tag se não existir (específica da empresa)
            const tagResult = await client.query(`
              INSERT INTO polox.tags (name, slug, company_id)
              VALUES ($1, $2, $3)
              ON CONFLICT (company_id, name, slug) 
              WHERE company_id IS NOT NULL 
              DO UPDATE SET name = EXCLUDED.name
              RETURNING id
            `, [tagName.trim(), tagName.trim().toLowerCase().replace(/\s+/g, '-'), companyId]);

            const tagId = tagResult.rows[0].id;

            // Associar tag ao evento
            await client.query(`
              INSERT INTO polox.event_tags (event_id, tag_id)
              VALUES ($1, $2)
              ON CONFLICT DO NOTHING
            `, [event.id, tagId]);
          }
        }
      }

      // 3. Retornar evento completo com tags
      return await this.findById(event.id, companyId);
    }, { companyId });
  }

  /**
   * Busca evento por ID
   * @param {number} id - ID do evento
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object|null>} Evento encontrado ou null
   */
  static async findById(id, companyId) {
    const selectQuery = `
      SELECT 
        e.*,
        u.name as organizer_name,
        u.email as organizer_email,
        c.name as client_name,
        c.email as client_email,
        l.name as lead_name,
        l.email as lead_email,
        s.sale_number,
        (SELECT COUNT(*) FROM polox.event_attendees WHERE event_id = e.id) as attendee_count
      FROM polox.events e
      LEFT JOIN polox.users u ON e.organizer_id = u.id
      LEFT JOIN polox.clients c ON e.client_id = c.id
      LEFT JOIN polox.leads l ON e.lead_id = l.id
      LEFT JOIN polox.sales s ON e.sale_id = s.id
      WHERE e.id = $1 AND e.company_id = $2 AND e.deleted_at IS NULL
    `;

    try {
      const result = await query(selectQuery, [id, companyId], { companyId });
      const event = result.rows[0];
      
      if (!event) {
        return null;
      }

      // Buscar tags do evento
      const tagsResult = await query(`
        SELECT t.id, t.name, t.slug, t.color
        FROM polox.tags t
        INNER JOIN polox.event_tags et ON t.id = et.tag_id
        WHERE et.event_id = $1
        ORDER BY t.name
      `, [id], { companyId });

      // Montar objeto completo
      return {
        ...event,
        tags: tagsResult.rows
      };
    } catch (error) {
      throw new ApiError(500, `Erro ao buscar evento: ${error.message}`);
    }
  }

  /**
   * Lista eventos com filtros e paginação
   * @param {Object} options - Opções de busca
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object>} Lista de eventos e metadados
   */
  static async list(options = {}, companyId) {
    const {
      page = 1,
      limit = 10,
      event_type = null,
      status = null,
      priority = null,
      organizer_id = null,
      client_id = null,
      lead_id = null,
      date_from = null,
      date_to = null,
      upcoming_only = false,
      search = null,
      sortBy = 'start_date',
      sortOrder = 'ASC'
    } = options;

    const offset = (page - 1) * limit;
    const conditions = ['e.company_id = $1', 'e.deleted_at IS NULL'];
    const values = [companyId];
    let paramCount = 2;

    // Adicionar filtros
    if (event_type) {
      conditions.push(`e.event_type = $${paramCount}`);
      values.push(event_type);
      paramCount++;
    }

    if (status) {
      conditions.push(`e.status = $${paramCount}`);
      values.push(status);
      paramCount++;
    }

    if (priority) {
      conditions.push(`e.priority = $${paramCount}`);
      values.push(priority);
      paramCount++;
    }

    if (organizer_id) {
      conditions.push(`e.organizer_id = $${paramCount}`);
      values.push(organizer_id);
      paramCount++;
    }

    if (client_id) {
      conditions.push(`e.client_id = $${paramCount}`);
      values.push(client_id);
      paramCount++;
    }

    if (lead_id) {
      conditions.push(`e.lead_id = $${paramCount}`);
      values.push(lead_id);
      paramCount++;
    }

    if (date_from) {
      conditions.push(`e.start_date >= $${paramCount}`);
      values.push(date_from);
      paramCount++;
    }

    if (date_to) {
      conditions.push(`e.start_date <= $${paramCount}`);
      values.push(date_to);
      paramCount++;
    }

    if (upcoming_only) {
      conditions.push('e.start_date >= NOW()');
      conditions.push('e.status IN (\'scheduled\', \'in_progress\')');
    }

    if (search) {
      conditions.push(`(e.title ILIKE $${paramCount} OR e.description ILIKE $${paramCount} OR e.location ILIKE $${paramCount})`);
      values.push(`%${search}%`);
      paramCount++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Query para contar total
    const countQuery = `
      SELECT COUNT(*) 
      FROM polox.events e
      ${whereClause}
    `;

    // Query para buscar dados
    const selectQuery = `
      SELECT 
        e.id, e.title, e.description, e.event_type, e.start_date,
        e.end_date, e.all_day, e.location, e.status, e.priority,
        e.organizer_id, e.client_id, e.lead_id, e.reminder_minutes,
        e.is_private, e.created_at, e.updated_at,
        u.name as organizer_name,
        c.name as client_name,
        l.name as lead_name,
        (SELECT COUNT(*) FROM polox.event_attendees WHERE event_id = e.id) as attendee_count,
        (SELECT json_agg(t.name) FROM polox.tags t INNER JOIN polox.event_tags et ON t.id = et.tag_id WHERE et.event_id = e.id) as tags,
        CASE 
          WHEN e.start_date < NOW() AND e.status = 'scheduled' THEN true
          ELSE false
        END as is_overdue
      FROM polox.events e
      LEFT JOIN polox.users u ON e.organizer_id = u.id
      LEFT JOIN polox.clients c ON e.client_id = c.id
      LEFT JOIN polox.leads l ON e.lead_id = l.id
      ${whereClause}
      ORDER BY 
        CASE WHEN e.priority = 'high' THEN 1
             WHEN e.priority = 'medium' THEN 2
             WHEN e.priority = 'low' THEN 3
             ELSE 4 END,
        e.${sortBy} ${sortOrder}
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
      throw new ApiError(500, `Erro ao listar eventos: ${error.message}`);
    }
  }

  /**
   * Atualiza dados do evento
   * @param {number} id - ID do evento
   * @param {Object} updateData - Dados para atualizar
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object|null>} Evento atualizado ou null
   */
  static async update(id, updateData, companyId) {
    const allowedFields = [
      'title', 'description', 'event_type', 'start_date', 'end_date',
      'all_day', 'location', 'status', 'priority', 'client_id', 'lead_id',
      'sale_id', 'recurrence_rule', 'reminder_minutes', 'is_private',
      'custom_fields'
    ];

    // Validar datas se fornecidas
    if (updateData.start_date && updateData.end_date) {
      const startDateTime = new Date(updateData.start_date);
      const endDateTime = new Date(updateData.end_date);

      if (endDateTime <= startDateTime) {
        throw new ValidationError('Data de fim deve ser posterior à data de início');
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
      UPDATE polox.events 
      SET ${updates.join(', ')}
      WHERE id = $${paramCount} AND company_id = $${paramCount + 1} AND deleted_at IS NULL
      RETURNING 
        id, title, description, event_type, start_date, end_date,
        all_day, location, status, priority, updated_at
    `;

    try {
      const result = await query(updateQuery, values, { companyId });
      return result.rows[0] || null;
    } catch (error) {
      throw new ApiError(500, `Erro ao atualizar evento: ${error.message}`);
    }
  }

  /**
   * Atualiza status do evento
   * @param {number} id - ID do evento
   * @param {string} newStatus - Novo status
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object|null>} Evento atualizado
   */
  static async updateStatus(id, newStatus, companyId) {
    if (!['scheduled', 'in_progress', 'completed', 'cancelled', 'postponed'].includes(newStatus)) {
      throw new ValidationError('Status inválido');
    }

    // Definir campos adicionais baseados no status
    const additionalFields = {};
    if (newStatus === 'completed') {
      additionalFields.completed_at = 'NOW()';
    } else if (newStatus === 'cancelled') {
      additionalFields.cancelled_at = 'NOW()';
    }

    const setClause = Object.keys(additionalFields).length > 0 
      ? `, ${Object.keys(additionalFields).map(field => `${field} = ${additionalFields[field]}`).join(', ')}`
      : '';

    const updateQuery = `
      UPDATE polox.events 
      SET status = $1, updated_at = NOW() ${setClause}
      WHERE id = $2 AND company_id = $3 AND deleted_at IS NULL
      RETURNING *
    `;

    try {
      const result = await query(updateQuery, [newStatus, id, companyId], { companyId });
      return result.rows[0] || null;
    } catch (error) {
      throw new ApiError(500, `Erro ao atualizar status do evento: ${error.message}`);
    }
  }

  /**
   * Adiciona participante ao evento
   * @param {number} eventId - ID do evento
   * @param {number} companyId - ID da empresa
   * @param {Object} attendeeData - Dados do participante
   * @returns {Promise<Object>} Participante adicionado
   */
  static async addAttendee(eventId, companyId, attendeeData) {
    const {
      user_id = null,
      email = null,
      name = null,
      status = 'invited',
      is_organizer = false
    } = attendeeData;

    if (!user_id && !email) {
      throw new ValidationError('ID do usuário ou email é obrigatório');
    }

    return await transaction(async (client) => {
      // Verificar se evento existe
      const event = await client.query(
        'SELECT id FROM polox.events WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL',
        [eventId, companyId]
      );

      if (event.rows.length === 0) {
        throw new NotFoundError('Evento não encontrado');
      }

      // Verificar se participante já foi adicionado
      let existingCheck = 'user_id = $3';
      let checkValue = user_id;
      
      if (!user_id && email) {
        existingCheck = 'email = $3';
        checkValue = email;
      }

      const existing = await client.query(
        `SELECT id FROM polox.event_attendees WHERE event_id = $1 AND company_id = $2 AND ${existingCheck}`,
        [eventId, companyId, checkValue]
      );

      if (existing.rows.length > 0) {
        throw new ValidationError('Participante já foi adicionado a este evento');
      }

      const insertQuery = `
        INSERT INTO polox.event_attendees (
          event_id, company_id, user_id, email, name, status,
          is_organizer, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
        RETURNING 
          id, event_id, user_id, email, name, status,
          is_organizer, created_at
      `;

      const result = await client.query(insertQuery, [
        eventId, companyId, user_id, email, name, status, is_organizer
      ]);

      return result.rows[0];
    }, { companyId });
  }

  /**
   * Atualiza status de participação
   * @param {number} eventId - ID do evento
   * @param {number} attendeeId - ID do participante
   * @param {string} status - Novo status
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object|null>} Participante atualizado
   */
  static async updateAttendeeStatus(eventId, attendeeId, status, companyId) {
    if (!['invited', 'accepted', 'declined', 'maybe', 'attended', 'no_show'].includes(status)) {
      throw new ValidationError('Status de participação inválido');
    }

    const updateQuery = `
      UPDATE polox.event_attendees 
      SET status = $1, updated_at = NOW()
      WHERE id = $2 AND event_id = $3 AND company_id = $4
      RETURNING *
    `;

    try {
      const result = await query(updateQuery, [status, attendeeId, eventId, companyId], { companyId });
      return result.rows[0] || null;
    } catch (error) {
      throw new ApiError(500, `Erro ao atualizar status de participação: ${error.message}`);
    }
  }

  /**
   * Obtém participantes do evento
   * @param {number} eventId - ID do evento
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Array>} Lista de participantes
   */
  static async getAttendees(eventId, companyId) {
    const selectQuery = `
      SELECT 
        ea.*,
        u.name as user_name,
        u.email as user_email
      FROM polox.event_attendees ea
      LEFT JOIN polox.users u ON ea.user_id = u.id
      WHERE ea.event_id = $1 AND ea.company_id = $2
      ORDER BY ea.is_organizer DESC, ea.created_at ASC
    `;

    try {
      const result = await query(selectQuery, [eventId, companyId], { companyId });
      return result.rows;
    } catch (error) {
      throw new ApiError(500, `Erro ao buscar participantes: ${error.message}`);
    }
  }

  /**
   * Obtém eventos por usuário (organizados ou participando)
   * @param {number} userId - ID do usuário
   * @param {number} companyId - ID da empresa
   * @param {Object} options - Opções de filtro
   * @returns {Promise<Object>} Eventos do usuário
   */
  static async getUserEvents(userId, companyId, options = {}) {
    const {
      page = 1,
      limit = 10,
      date_from = null,
      date_to = null,
      upcoming_only = false,
      role = null // 'organizer', 'attendee', 'all'
    } = options;

    const offset = (page - 1) * limit;
    const conditions = ['e.company_id = $1', 'e.deleted_at IS NULL'];
    const values = [companyId];
    let paramCount = 2;

    // Filtro por papel do usuário
    if (role === 'organizer') {
      conditions.push(`e.organizer_id = $${paramCount}`);
      values.push(userId);
      paramCount++;
    } else if (role === 'attendee') {
      conditions.push(`ea.user_id = $${paramCount}`);
      values.push(userId);
      paramCount++;
    } else {
      // Todos os eventos (organizados ou participando)
      conditions.push(`(e.organizer_id = $${paramCount} OR ea.user_id = $${paramCount})`);
      values.push(userId);
      paramCount++;
    }

    if (date_from) {
      conditions.push(`e.start_date >= $${paramCount}`);
      values.push(date_from);
      paramCount++;
    }

    if (date_to) {
      conditions.push(`e.start_date <= $${paramCount}`);
      values.push(date_to);
      paramCount++;
    }

    if (upcoming_only) {
      conditions.push('e.start_date >= NOW()');
      conditions.push('e.status IN (\'scheduled\', \'in_progress\')');
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const selectQuery = `
      SELECT DISTINCT
        e.*,
        organizer.name as organizer_name,
        CASE WHEN e.organizer_id = $1 THEN 'organizer' ELSE 'attendee' END as user_role
      FROM polox.events e
      LEFT JOIN polox.event_attendees ea ON e.id = ea.event_id
      LEFT JOIN polox.users organizer ON e.organizer_id = organizer.id
      ${whereClause}
      ORDER BY e.start_date ASC
      LIMIT $${paramCount} OFFSET $${paramCount + 1}
    `;

    try {
      const result = await query(selectQuery, [...values, limit, offset], { companyId });
      
      const countQuery = `
        SELECT COUNT(DISTINCT e.id) 
        FROM polox.events e
        LEFT JOIN polox.event_attendees ea ON e.id = ea.event_id
        ${whereClause}
      `;
      
      const countResult = await query(countQuery, values, { companyId });
      const total = parseInt(countResult.rows[0].count);
      const totalPages = Math.ceil(total / limit);

      return {
        data: result.rows,
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
      throw new ApiError(500, `Erro ao buscar eventos do usuário: ${error.message}`);
    }
  }

  /**
   * Obtém eventos da agenda (view de calendário)
   * @param {number} companyId - ID da empresa
   * @param {Object} options - Opções de filtro
   * @returns {Promise<Array>} Eventos para calendário
   */
  static async getCalendarEvents(companyId, options = {}) {
    const {
      user_id = null,
      date_from = null,
      date_to = null,
      include_private = true
    } = options;

    const conditions = ['e.company_id = $1', 'e.deleted_at IS NULL'];
    const values = [companyId];
    let paramCount = 2;

    if (user_id) {
      if (include_private) {
        conditions.push(`(e.organizer_id = $${paramCount} OR ea.user_id = $${paramCount} OR e.is_private = FALSE)`);
      } else {
        conditions.push(`(e.organizer_id = $${paramCount} OR ea.user_id = $${paramCount}) AND e.is_private = FALSE`);
      }
      values.push(user_id);
      paramCount++;
    } else if (!include_private) {
      conditions.push('e.is_private = FALSE');
    }

    if (date_from) {
      conditions.push(`e.start_date >= $${paramCount}`);
      values.push(date_from);
      paramCount++;
    }

    if (date_to) {
      conditions.push(`e.start_date <= $${paramCount}`);
      values.push(date_to);
      paramCount++;
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const selectQuery = `
      SELECT DISTINCT
        e.id, e.title, e.event_type, e.start_date, e.end_date,
        e.all_day, e.location, e.status, e.priority, e.is_private,
        organizer.name as organizer_name,
        c.name as client_name,
        l.name as lead_name
      FROM polox.events e
      LEFT JOIN polox.event_attendees ea ON e.id = ea.event_id
      LEFT JOIN polox.users organizer ON e.organizer_id = organizer.id
      LEFT JOIN polox.clients c ON e.client_id = c.id
      LEFT JOIN polox.leads l ON e.lead_id = l.id
      ${whereClause}
      ORDER BY e.start_date ASC
    `;

    try {
      const result = await query(selectQuery, values, { companyId });
      return result.rows;
    } catch (error) {
      throw new ApiError(500, `Erro ao buscar eventos do calendário: ${error.message}`);
    }
  }

  /**
   * Obtém estatísticas de eventos
   * @param {number} companyId - ID da empresa
   * @param {Object} options - Opções de filtro
   * @returns {Promise<Object>} Estatísticas de eventos
   */
  static async getStats(companyId, options = {}) {
    const {
      date_from = null,
      date_to = null,
      organizer_id = null
    } = options;

    const conditions = ['company_id = $1', 'deleted_at IS NULL'];
    const values = [companyId];
    let paramCount = 2;

    if (date_from) {
      conditions.push(`start_date >= $${paramCount}`);
      values.push(date_from);
      paramCount++;
    }

    if (date_to) {
      conditions.push(`start_date <= $${paramCount}`);
      values.push(date_to);
      paramCount++;
    }

    if (organizer_id) {
      conditions.push(`organizer_id = $${paramCount}`);
      values.push(organizer_id);
      paramCount++;
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const statsQuery = `
      SELECT 
        COUNT(*) as total_events,
        COUNT(CASE WHEN status = 'scheduled' THEN 1 END) as scheduled_events,
        COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress_events,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_events,
        COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_events,
        COUNT(CASE WHEN event_type = 'meeting' THEN 1 END) as meetings,
        COUNT(CASE WHEN event_type = 'call' THEN 1 END) as calls,
        COUNT(CASE WHEN event_type = 'appointment' THEN 1 END) as appointments,
        COUNT(CASE WHEN priority = 'high' THEN 1 END) as high_priority_events,
        COUNT(CASE WHEN start_date < NOW() AND status = 'scheduled' THEN 1 END) as overdue_events,
        COUNT(DISTINCT organizer_id) as unique_organizers,
        COUNT(DISTINCT client_id) as unique_clients,
        COALESCE(AVG(EXTRACT(EPOCH FROM (end_date - start_date)) / 60), 0) as avg_duration_minutes
      FROM polox.events 
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
   * Obtém próximos eventos
   * @param {number} companyId - ID da empresa
   * @param {number} limit - Limite de resultados
   * @param {number} userId - ID do usuário (opcional)
   * @returns {Promise<Array>} Próximos eventos
   */
  static async getUpcomingEvents(companyId, limit = 10, userId = null) {
    const conditions = ['e.company_id = $1', 'e.deleted_at IS NULL', 'e.start_date >= NOW()', 'e.status = \'scheduled\''];
    const values = [companyId];
    let paramCount = 2;

    if (userId) {
      conditions.push(`(e.organizer_id = $${paramCount} OR ea.user_id = $${paramCount})`);
      values.push(userId);
      paramCount++;
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const selectQuery = `
      SELECT DISTINCT
        e.id, e.title, e.event_type, e.start_date, e.end_date,
        e.location, e.priority, e.reminder_minutes,
        organizer.name as organizer_name,
        c.name as client_name,
        EXTRACT(EPOCH FROM (e.start_date - NOW())) / 3600 as hours_until_event
      FROM polox.events e
      LEFT JOIN polox.event_attendees ea ON e.id = ea.event_id
      LEFT JOIN polox.users organizer ON e.organizer_id = organizer.id
      LEFT JOIN polox.clients c ON e.client_id = c.id
      ${whereClause}
      ORDER BY e.start_date ASC
      LIMIT $${paramCount}
    `;

    try {
      const result = await query(selectQuery, [...values, limit], { companyId });
      return result.rows;
    } catch (error) {
      throw new ApiError(500, `Erro ao buscar próximos eventos: ${error.message}`);
    }
  }

  /**
   * Soft delete do evento
   * @param {number} id - ID do evento
   * @param {number} companyId - ID da empresa
   * @returns {Promise<boolean>} True se deletado com sucesso
   */
  static async softDelete(id, companyId) {
    const updateQuery = `
      UPDATE polox.events 
      SET deleted_at = NOW(), updated_at = NOW()
      WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL
    `;

    try {
      const result = await query(updateQuery, [id, companyId], { companyId });
      return result.rowCount > 0;
    } catch (error) {
      throw new ApiError(500, `Erro ao deletar evento: ${error.message}`);
    }
  }

  /**
   * Remove participante do evento
   * @param {number} eventId - ID do evento
   * @param {number} attendeeId - ID do participante
   * @param {number} companyId - ID da empresa
   * @returns {Promise<boolean>} True se removido com sucesso
   */
  static async removeAttendee(eventId, attendeeId, companyId) {
    const deleteQuery = `
      DELETE FROM polox.event_attendees 
      WHERE id = $1 AND event_id = $2 AND company_id = $3
    `;

    try {
      const result = await query(deleteQuery, [attendeeId, eventId, companyId], { companyId });
      return result.rowCount > 0;
    } catch (error) {
      throw new ApiError(500, `Erro ao remover participante: ${error.message}`);
    }
  }

  /**
   * Obtém conflitos de agenda
   * @param {number} organizerId - ID do organizador
   * @param {string} startDate - Data de início
   * @param {string} endDate - Data de fim
   * @param {number} companyId - ID da empresa
   * @param {number} excludeEventId - ID do evento a excluir da verificação
   * @returns {Promise<Array>} Eventos conflitantes
   */
  static async getScheduleConflicts(organizerId, startDate, endDate, companyId, excludeEventId = null) {
    const conditions = [
      'organizer_id = $1',
      'company_id = $2',
      'deleted_at IS NULL',
      'status IN (\'scheduled\', \'in_progress\')',
      '(start_date < $4 AND (end_date > $3 OR end_date IS NULL))'
    ];
    const values = [organizerId, companyId, startDate, endDate];
    let paramCount = 5;

    if (excludeEventId) {
      conditions.push(`id != $${paramCount}`);
      values.push(excludeEventId);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const selectQuery = `
      SELECT id, title, start_date, end_date, event_type, location
      FROM polox.events
      ${whereClause}
      ORDER BY start_date ASC
    `;

    try {
      const result = await query(selectQuery, values, { companyId });
      return result.rows;
    } catch (error) {
      throw new ApiError(500, `Erro ao verificar conflitos de agenda: ${error.message}`);
    }
  }

  /**
   * Adiciona uma tag ao evento
   * @param {number} eventId - ID do evento
   * @param {string} tagName - Nome da tag
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object>} Tag associada
   */
  static async addTag(eventId, tagName, companyId) {
    if (!tagName || tagName.trim() === '') {
      throw new ValidationError('Nome da tag é obrigatório');
    }

    return await transaction(async (client) => {
      // Verificar se evento existe
      const event = await client.query(
        'SELECT id FROM polox.events WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL',
        [eventId, companyId]
      );

      if (event.rows.length === 0) {
        throw new NotFoundError('Evento não encontrado');
      }

      // Inserir tag se não existir (específica da empresa)
      const tagResult = await client.query(`
        INSERT INTO polox.tags (name, slug, company_id)
        VALUES ($1, $2, $3)
        ON CONFLICT (company_id, name, slug) 
        WHERE company_id IS NOT NULL 
        DO UPDATE SET name = EXCLUDED.name
        RETURNING id, name, slug, color
      `, [tagName.trim(), tagName.trim().toLowerCase().replace(/\s+/g, '-'), companyId]);

      const tag = tagResult.rows[0];

      // Associar tag ao evento
      await client.query(`
        INSERT INTO polox.event_tags (event_id, tag_id)
        VALUES ($1, $2)
        ON CONFLICT DO NOTHING
      `, [eventId, tag.id]);

      return tag;
    }, { companyId });
  }

  /**
   * Busca todas as tags de um evento
   * @param {number} eventId - ID do evento
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Array>} Lista de tags
   */
  static async getTags(eventId, companyId) {
    const selectQuery = `
      SELECT t.id, t.name, t.slug, t.color, t.description
      FROM polox.tags t
      INNER JOIN polox.event_tags et ON t.id = et.tag_id
      WHERE et.event_id = $1
      ORDER BY t.name
    `;

    try {
      const result = await query(selectQuery, [eventId], { companyId });
      return result.rows;
    } catch (error) {
      throw new ApiError(500, `Erro ao buscar tags: ${error.message}`);
    }
  }

  /**
   * Remove uma tag do evento
   * @param {number} eventId - ID do evento
   * @param {number} tagId - ID da tag
   * @param {number} companyId - ID da empresa
   * @returns {Promise<boolean>} True se removido com sucesso
   */
  static async removeTag(eventId, tagId, companyId) {
    const deleteQuery = `
      DELETE FROM polox.event_tags
      WHERE event_id = $1 AND tag_id = $2
    `;

    try {
      const result = await query(deleteQuery, [eventId, tagId], { companyId });
      return result.rowCount > 0;
    } catch (error) {
      throw new ApiError(500, `Erro ao remover tag: ${error.message}`);
    }
  }

  /**
   * Atualiza todas as tags de um evento
   * @param {number} eventId - ID do evento
   * @param {Array<string>} tagNames - Array com nomes das tags
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Array>} Lista de tags atualizadas
   */
  static async updateTags(eventId, tagNames, companyId) {
    return await transaction(async (client) => {
      // Verificar se evento existe
      const event = await client.query(
        'SELECT id FROM polox.events WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL',
        [eventId, companyId]
      );

      if (event.rows.length === 0) {
        throw new NotFoundError('Evento não encontrado');
      }

      // Remover todas as tags antigas
      await client.query(`
        DELETE FROM polox.event_tags WHERE event_id = $1
      `, [eventId]);

      // Adicionar novas tags
      if (tagNames && tagNames.length > 0) {
        for (const tagName of tagNames) {
          if (tagName && tagName.trim() !== '') {
            // Inserir tag se não existir
            const tagResult = await client.query(`
              INSERT INTO polox.tags (name, slug, company_id)
              VALUES ($1, $2, $3)
              ON CONFLICT (company_id, name, slug) 
              WHERE company_id IS NOT NULL 
              DO UPDATE SET name = EXCLUDED.name
              RETURNING id
            `, [tagName.trim(), tagName.trim().toLowerCase().replace(/\s+/g, '-'), companyId]);

            const tagId = tagResult.rows[0].id;

            // Associar tag ao evento
            await client.query(`
              INSERT INTO polox.event_tags (event_id, tag_id)
              VALUES ($1, $2)
              ON CONFLICT DO NOTHING
            `, [eventId, tagId]);
          }
        }
      }

      // Retornar tags atualizadas
      const result = await client.query(`
        SELECT t.id, t.name, t.slug, t.color
        FROM polox.tags t
        INNER JOIN polox.event_tags et ON t.id = et.tag_id
        WHERE et.event_id = $1
        ORDER BY t.name
      `, [eventId]);

      return result.rows;
    }, { companyId });
  }
}

module.exports = EventModel;