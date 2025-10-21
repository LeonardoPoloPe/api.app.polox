const { query, beginTransaction, commit, rollback } = require('../models/database');
const { ApiError, asyncHandler } = require('../utils/errors');
const { successResponse, paginatedResponse } = require('../utils/formatters');
const Joi = require('joi');
const { v4: uuidv4 } = require('uuid');

class ScheduleController {

  // Schemas de validação
  static createEventSchema = Joi.object({
    title: Joi.string().min(2).max(255).required()
      .messages({
        'any.required': 'Título do evento é obrigatório',
        'string.min': 'Título deve ter pelo menos 2 caracteres'
      }),
    description: Joi.string().max(1000).allow('').default(''),
    start_date: Joi.date().required()
      .messages({
        'any.required': 'Data de início é obrigatória'
      }),
    end_date: Joi.date().greater(Joi.ref('start_date')).required()
      .messages({
        'any.required': 'Data de fim é obrigatória',
        'date.greater': 'Data de fim deve ser posterior à data de início'
      }),
    all_day: Joi.boolean().default(false),
    type: Joi.string().valid('meeting', 'call', 'task', 'reminder', 'event', 'appointment').default('meeting'),
    priority: Joi.string().valid('low', 'medium', 'high', 'urgent').default('medium'),
    status: Joi.string().valid('scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show').default('scheduled'),
    location: Joi.string().max(255).allow(''),
    virtual_meeting_url: Joi.string().uri().allow(''),
    client_id: Joi.string(),
    lead_id: Joi.string(),
    attendees: Joi.array().items(Joi.string()).default([]),
    recurring: Joi.boolean().default(false),
    recurring_frequency: Joi.string().valid('daily', 'weekly', 'monthly', 'yearly'),
    recurring_until: Joi.date(),
    recurring_count: Joi.number().integer().positive(),
    reminder_minutes: Joi.array().items(Joi.number().positive()).default([15]),
    tags: Joi.array().items(Joi.string()).default([]),
    custom_fields: Joi.object().default({}),
    is_private: Joi.boolean().default(false)
  });

  static updateEventSchema = Joi.object({
    title: Joi.string().min(2).max(255),
    description: Joi.string().max(1000).allow(''),
    start_date: Joi.date(),
    end_date: Joi.date(),
    all_day: Joi.boolean(),
    type: Joi.string().valid('meeting', 'call', 'task', 'reminder', 'event', 'appointment'),
    priority: Joi.string().valid('low', 'medium', 'high', 'urgent'),
    status: Joi.string().valid('scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show'),
    location: Joi.string().max(255).allow(''),
    virtual_meeting_url: Joi.string().uri().allow(''),
    client_id: Joi.string(),
    lead_id: Joi.string(),
    attendees: Joi.array().items(Joi.string()),
    recurring: Joi.boolean(),
    recurring_frequency: Joi.string().valid('daily', 'weekly', 'monthly', 'yearly'),
    recurring_until: Joi.date(),
    recurring_count: Joi.number().integer().positive(),
    reminder_minutes: Joi.array().items(Joi.number().positive()),
    tags: Joi.array().items(Joi.string()),
    custom_fields: Joi.object(),
    is_private: Joi.boolean()
  }).custom((value, helpers) => {
    // Validar end_date se start_date também for fornecido
    if (value.start_date && value.end_date && new Date(value.end_date) <= new Date(value.start_date)) {
      return helpers.error('date.greater');
    }
    return value;
  });

  // Listar eventos
  static getEvents = asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const offset = (page - 1) * limit;
    
    let whereClause = 'WHERE e.company_id = $1 AND e.deleted_at IS NULL';
    let queryParams = [req.user.company.id];
    let paramCount = 1;

    // Filtros
    if (req.query.user_id) {
      whereClause += ` AND (e.created_by = $${++paramCount} OR e.id IN (
        SELECT event_id FROM event_attendees WHERE user_id = $${paramCount} AND deleted_at IS NULL
      ))`;
      queryParams.push(req.query.user_id);
    }

    if (req.query.type) {
      whereClause += ` AND e.type = $${++paramCount}`;
      queryParams.push(req.query.type);
    }

    if (req.query.status) {
      whereClause += ` AND e.status = $${++paramCount}`;
      queryParams.push(req.query.status);
    }

    if (req.query.priority) {
      whereClause += ` AND e.priority = $${++paramCount}`;
      queryParams.push(req.query.priority);
    }

    if (req.query.date_from) {
      whereClause += ` AND e.start_date >= $${++paramCount}`;
      queryParams.push(req.query.date_from);
    }

    if (req.query.date_to) {
      whereClause += ` AND e.end_date <= $${++paramCount}`;
      queryParams.push(req.query.date_to);
    }

    if (req.query.client_id) {
      whereClause += ` AND e.client_id = $${++paramCount}`;
      queryParams.push(req.query.client_id);
    }

    if (req.query.lead_id) {
      whereClause += ` AND e.lead_id = $${++paramCount}`;
      queryParams.push(req.query.lead_id);
    }

    if (req.query.search) {
      whereClause += ` AND (e.title ILIKE $${++paramCount} OR e.description ILIKE $${++paramCount})`;
      const searchTerm = `%${req.query.search}%`;
      queryParams.push(searchTerm, searchTerm);
      paramCount++;
    }

    // Filtrar eventos privados (só o criador e participantes podem ver)
    if (req.query.include_private !== 'true') {
      whereClause += ` AND (e.is_private = false OR e.created_by = $${++paramCount} OR e.id IN (
        SELECT event_id FROM event_attendees WHERE user_id = $${paramCount} AND deleted_at IS NULL
      ))`;
      queryParams.push(req.user.id);
    }

    // Ordenação
    const validSortFields = ['start_date', 'created_at', 'title', 'priority'];
    const sortField = validSortFields.includes(req.query.sort) ? req.query.sort : 'start_date';
    const sortOrder = req.query.order === 'desc' ? 'DESC' : 'ASC';

    // Query principal
    const eventsQuery = `
      SELECT 
        e.*,
        c.name as client_name,
        l.name as lead_name,
        u.name as organizer_name,
        COALESCE(
          json_agg(
            CASE WHEN ea.user_id IS NOT NULL THEN
              json_build_object(
                'user_id', ea.user_id,
                'user_name', u_att.name,
                'status', ea.status,
                'added_at', ea.created_at
              )
            END
          ) FILTER (WHERE ea.user_id IS NOT NULL), 
          '[]'::json
        ) as attendees
      FROM schedule_events e
      LEFT JOIN clients c ON e.client_id = c.id AND c.company_id = e.company_id
      LEFT JOIN leads l ON e.lead_id = l.id AND l.company_id = e.company_id
      LEFT JOIN users u ON e.created_by = u.id
      LEFT JOIN event_attendees ea ON e.id = ea.event_id AND ea.deleted_at IS NULL
      LEFT JOIN users u_att ON ea.user_id = u_att.id
      ${whereClause}
      GROUP BY e.id, c.name, l.name, u.name
      ORDER BY e.${sortField} ${sortOrder}
      LIMIT $${++paramCount} OFFSET $${++paramCount}
    `;
    
    queryParams.push(limit, offset);

    // Query de contagem
    const countQuery = `SELECT COUNT(DISTINCT e.id) as total FROM schedule_events e ${whereClause}`;

    // Query de estatísticas
    const statsQuery = `
      SELECT 
        COUNT(*) as total_events,
        COUNT(CASE WHEN e.status = 'scheduled' THEN 1 END) as scheduled,
        COUNT(CASE WHEN e.status = 'confirmed' THEN 1 END) as confirmed,
        COUNT(CASE WHEN e.status = 'completed' THEN 1 END) as completed,
        COUNT(CASE WHEN e.status = 'cancelled' THEN 1 END) as cancelled,
        COUNT(CASE WHEN e.start_date >= CURRENT_DATE AND e.start_date < CURRENT_DATE + INTERVAL '7 days' THEN 1 END) as next_7_days,
        COUNT(CASE WHEN e.priority = 'urgent' OR e.priority = 'high' THEN 1 END) as high_priority
      FROM schedule_events e
      WHERE e.company_id = $1 AND e.deleted_at IS NULL
    `;

    const [eventsResult, countResult, statsResult] = await Promise.all([
      query(eventsQuery, queryParams),
      query(countQuery, queryParams.slice(0, -2)),
      query(statsQuery, [req.user.company.id])
    ]);

    return res.status(200).json({
      success: true,
      data: eventsResult.rows,
      pagination: {
        page,
        limit,
        total: parseInt(countResult.rows[0].total),
        pages: Math.ceil(parseInt(countResult.rows[0].total) / limit)
      },
      stats: statsResult.rows[0]
    });
  });

  // Criar evento
  static createEvent = asyncHandler(async (req, res) => {
    const { error, value } = ScheduleController.createEventSchema.validate(req.body);
    if (error) throw new ApiError(400, error.details[0].message);

    const eventData = value;
    const eventId = uuidv4();

    // Verificar conflitos de horário se solicitado
    if (req.query.check_conflicts === 'true') {
      const conflictUsers = [req.user.id, ...eventData.attendees].filter(Boolean);
      const conflicts = await ScheduleController.checkConflicts(
        req.user.company.id,
        eventData.start_date,
        eventData.end_date,
        conflictUsers
      );

      if (conflicts.length > 0 && req.query.ignore_conflicts !== 'true') {
        return res.status(409).json({
          success: false,
          message: 'Conflitos de horário detectados',
          conflicts: conflicts
        });
      }
    }

    const client = await beginTransaction();
    
    try {
      // Criar evento
      const createEventQuery = `
        INSERT INTO schedule_events (
          id, company_id, title, description, start_date, end_date,
          all_day, type, priority, status, location, virtual_meeting_url,
          client_id, lead_id, recurring, recurring_frequency, recurring_until,
          recurring_count, reminder_minutes, tags, custom_fields, 
          is_private, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
        RETURNING *
      `;

      const newEventResult = await client.query(createEventQuery, [
        eventId,
        req.user.company.id,
        eventData.title,
        eventData.description,
        eventData.start_date,
        eventData.end_date,
        eventData.all_day,
        eventData.type,
        eventData.priority,
        eventData.status,
        eventData.location,
        eventData.virtual_meeting_url,
        eventData.client_id,
        eventData.lead_id,
        eventData.recurring,
        eventData.recurring_frequency,
        eventData.recurring_until,
        eventData.recurring_count,
        JSON.stringify(eventData.reminder_minutes),
        JSON.stringify(eventData.tags),
        JSON.stringify(eventData.custom_fields),
        eventData.is_private,
        req.user.id
      ]);

      const newEvent = newEventResult.rows[0];

      // Adicionar participantes
      for (const userId of eventData.attendees) {
        if (userId && userId !== req.user.id) {
          await client.query(`
            INSERT INTO event_attendees (id, event_id, user_id, status)
            VALUES ($1, $2, $3, 'invited')
          `, [uuidv4(), newEvent.id, userId]);
        }
      }

      // Criar eventos recorrentes se aplicável
      if (eventData.recurring && eventData.recurring_frequency) {
        await ScheduleController.createRecurringEvents(
          client,
          newEvent,
          eventData.recurring_frequency,
          eventData.recurring_until,
          eventData.recurring_count
        );
      }

      // Conceder XP/Coins por criar evento
      const xpReward = eventData.type === 'meeting' ? 10 : 8;
      const coinReward = eventData.type === 'meeting' ? 5 : 4;

      await client.query(`
        UPDATE user_gamification_profiles 
        SET total_xp = total_xp + $1, current_coins = current_coins + $2
        WHERE user_id = $3 AND company_id = $4
      `, [xpReward, coinReward, req.user.id, req.user.company.id]);

      // Registrar no histórico de gamificação
      await client.query(`
        INSERT INTO gamification_history (id, user_id, company_id, type, amount, reason, action_type)
        VALUES 
          ($1, $2, $3, 'xp', $4, 'Evento agendado', 'event_created'),
          ($5, $2, $3, 'coins', $6, 'Evento agendado', 'event_created')
      `, [uuidv4(), req.user.id, req.user.company.id, xpReward, uuidv4(), coinReward]);

      // Log de auditoria
      await client.query(`
        INSERT INTO audit_logs (id, user_id, company_id, action, entity_type, entity_id, description, ip_address)
        VALUES ($1, $2, $3, 'create', 'schedule_event', $4, $5, $6)
      `, [
        uuidv4(),
        req.user.id,
        req.user.company.id,
        newEvent.id,
        `Evento criado: ${newEvent.title} (${eventData.type})`,
        req.ip
      ]);

      await commit(client);

      return res.status(201).json({
        success: true,
        data: newEvent,
        message: 'Evento criado com sucesso'
      });

    } catch (error) {
      await rollback(client);
      throw error;
    }
  });

  // Visualizar evento específico
  static show = asyncHandler(async (req, res) => {
    const eventId = req.params.id;

    const eventQuery = `
      SELECT 
        e.*,
        c.name as client_name,
        c.email as client_email,
        c.phone as client_phone,
        l.name as lead_name,
        l.email as lead_email,
        l.phone as lead_phone,
        u.name as organizer_name,
        u.email as organizer_email,
        COALESCE(
          json_agg(
            CASE WHEN ea.user_id IS NOT NULL THEN
              json_build_object(
                'id', ea.id,
                'user_id', ea.user_id,
                'user_name', u_att.name,
                'user_email', u_att.email,
                'status', ea.status,
                'added_at', ea.created_at,
                'updated_at', ea.updated_at
              )
            END
          ) FILTER (WHERE ea.user_id IS NOT NULL), 
          '[]'::json
        ) as attendees,
        parent_event.title as parent_event_title
      FROM schedule_events e
      LEFT JOIN clients c ON e.client_id = c.id AND c.company_id = e.company_id
      LEFT JOIN leads l ON e.lead_id = l.id AND l.company_id = e.company_id
      LEFT JOIN users u ON e.created_by = u.id
      LEFT JOIN event_attendees ea ON e.id = ea.event_id AND ea.deleted_at IS NULL
      LEFT JOIN users u_att ON ea.user_id = u_att.id
      LEFT JOIN schedule_events parent_event ON e.parent_event_id = parent_event.id
      WHERE e.id = $1 AND e.company_id = $2 AND e.deleted_at IS NULL
      GROUP BY e.id, c.name, c.email, c.phone, l.name, l.email, l.phone, u.name, u.email, parent_event.title
    `;

    const eventResult = await query(eventQuery, [eventId, req.user.company.id]);

    if (eventResult.rows.length === 0) {
      throw new ApiError(404, 'Evento não encontrado');
    }

    const event = eventResult.rows[0];

    // Verificar se usuário tem permissão para ver evento privado
    if (event.is_private && event.created_by !== req.user.id) {
      const isAttendee = event.attendees.some(attendee => attendee.user_id === req.user.id);
      if (!isAttendee) {
        throw new ApiError(403, 'Você não tem permissão para visualizar este evento');
      }
    }

    return res.status(200).json({
      success: true,
      data: event
    });
  });

  // Atualizar evento
  static update = asyncHandler(async (req, res) => {
    const eventId = req.params.id;
    const { error, value } = ScheduleController.updateEventSchema.validate(req.body);
    if (error) throw new ApiError(400, error.details[0].message);

    const updateData = value;

    // Verificar se evento existe e se usuário tem permissão
    const existingEvent = await query(
      'SELECT * FROM schedule_events WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL',
      [eventId, req.user.company.id]
    );

    if (existingEvent.rows.length === 0) {
      throw new ApiError(404, 'Evento não encontrado');
    }

    const event = existingEvent.rows[0];

    // Verificar permissão para editar
    if (event.created_by !== req.user.id) {
      throw new ApiError(403, 'Apenas o criador do evento pode editá-lo');
    }

    // Verificar conflitos se horário foi alterado
    if (req.query.check_conflicts === 'true' && (updateData.start_date || updateData.end_date)) {
      const startDate = updateData.start_date || event.start_date;
      const endDate = updateData.end_date || event.end_date;
      
      // Buscar participantes atuais se não fornecidos na atualização
      let attendeeIds = updateData.attendees;
      if (!attendeeIds) {
        const attendeesResult = await query(
          'SELECT user_id FROM event_attendees WHERE event_id = $1 AND deleted_at IS NULL',
          [eventId]
        );
        attendeeIds = attendeesResult.rows.map(row => row.user_id);
      }

      const conflictUsers = [req.user.id, ...attendeeIds].filter(Boolean);
      const conflicts = await ScheduleController.checkConflicts(
        req.user.company.id,
        startDate,
        endDate,
        conflictUsers,
        eventId
      );

      if (conflicts.length > 0 && req.query.ignore_conflicts !== 'true') {
        return res.status(409).json({
          success: false,
          message: 'Conflitos de horário detectados',
          conflicts: conflicts
        });
      }
    }

    const client = await beginTransaction();
    
    try {
      // Preparar dados para atualização
      const fieldsToUpdate = [];
      const values = [];
      let paramCount = 0;

      const updateableFields = {
        title: updateData.title,
        description: updateData.description,
        start_date: updateData.start_date,
        end_date: updateData.end_date,
        all_day: updateData.all_day,
        type: updateData.type,
        priority: updateData.priority,
        status: updateData.status,
        location: updateData.location,
        virtual_meeting_url: updateData.virtual_meeting_url,
        client_id: updateData.client_id,
        lead_id: updateData.lead_id,
        recurring: updateData.recurring,
        recurring_frequency: updateData.recurring_frequency,
        recurring_until: updateData.recurring_until,
        recurring_count: updateData.recurring_count,
        reminder_minutes: updateData.reminder_minutes ? JSON.stringify(updateData.reminder_minutes) : undefined,
        tags: updateData.tags ? JSON.stringify(updateData.tags) : undefined,
        custom_fields: updateData.custom_fields ? JSON.stringify(updateData.custom_fields) : undefined,
        is_private: updateData.is_private
      };

      Object.entries(updateableFields).forEach(([field, value]) => {
        if (value !== undefined) {
          fieldsToUpdate.push(`${field} = $${++paramCount}`);
          values.push(value);
        }
      });

      if (fieldsToUpdate.length === 0 && !updateData.attendees) {
        throw new ApiError(400, 'Nenhum campo para atualizar');
      }

      // Atualizar evento se há campos para atualizar
      if (fieldsToUpdate.length > 0) {
        fieldsToUpdate.push(`updated_at = NOW()`);
        values.push(eventId, req.user.company.id);

        const updateQuery = `
          UPDATE schedule_events 
          SET ${fieldsToUpdate.join(', ')}
          WHERE id = $${++paramCount} AND company_id = $${++paramCount} AND deleted_at IS NULL
          RETURNING *
        `;

        const updatedEventResult = await client.query(updateQuery, values);
      }

      // Atualizar participantes se fornecidos
      if (updateData.attendees) {
        // Remover participantes atuais (soft delete)
        await client.query(
          'UPDATE event_attendees SET deleted_at = NOW() WHERE event_id = $1',
          [eventId]
        );

        // Adicionar novos participantes
        for (const userId of updateData.attendees) {
          if (userId && userId !== req.user.id) {
            await client.query(`
              INSERT INTO event_attendees (id, event_id, user_id, status)
              VALUES ($1, $2, $3, 'invited')
            `, [uuidv4(), eventId, userId]);
          }
        }
      }

      // Log de auditoria
      await client.query(`
        INSERT INTO audit_logs (id, user_id, company_id, action, entity_type, entity_id, description, ip_address)
        VALUES ($1, $2, $3, 'update', 'schedule_event', $4, $5, $6)
      `, [
        uuidv4(),
        req.user.id,
        req.user.company.id,
        eventId,
        `Evento atualizado: ${updateData.title || event.title}`,
        req.ip
      ]);

      await commit(client);

      // Buscar evento atualizado
      const updatedEventQuery = `
        SELECT 
          e.*,
          COALESCE(
            json_agg(
              CASE WHEN ea.user_id IS NOT NULL THEN
                json_build_object(
                  'user_id', ea.user_id,
                  'user_name', u_att.name,
                  'status', ea.status
                )
              END
            ) FILTER (WHERE ea.user_id IS NOT NULL), 
            '[]'::json
          ) as attendees
        FROM schedule_events e
        LEFT JOIN event_attendees ea ON e.id = ea.event_id AND ea.deleted_at IS NULL
        LEFT JOIN users u_att ON ea.user_id = u_att.id
        WHERE e.id = $1 AND e.company_id = $2 AND e.deleted_at IS NULL
        GROUP BY e.id
      `;

      const finalEventResult = await query(updatedEventQuery, [eventId, req.user.company.id]);

      return res.status(200).json({
        success: true,
        data: finalEventResult.rows[0],
        message: 'Evento atualizado com sucesso'
      });

    } catch (error) {
      await rollback(client);
      throw error;
    }
  });

  // Deletar evento
  static destroy = asyncHandler(async (req, res) => {
    const eventId = req.params.id;

    // Verificar se evento existe e se usuário tem permissão
    const existingEvent = await query(
      'SELECT * FROM schedule_events WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL',
      [eventId, req.user.company.id]
    );

    if (existingEvent.rows.length === 0) {
      throw new ApiError(404, 'Evento não encontrado');
    }

    const event = existingEvent.rows[0];

    // Verificar permissão para deletar
    if (event.created_by !== req.user.id) {
      throw new ApiError(403, 'Apenas o criador do evento pode deletá-lo');
    }

    const client = await beginTransaction();
    
    try {
      // Soft delete do evento
      await client.query(
        'UPDATE schedule_events SET deleted_at = NOW() WHERE id = $1 AND company_id = $2',
        [eventId, req.user.company.id]
      );

      // Soft delete dos participantes
      await client.query(
        'UPDATE event_attendees SET deleted_at = NOW() WHERE event_id = $1',
        [eventId]
      );

      // Log de auditoria
      await client.query(`
        INSERT INTO audit_logs (id, user_id, company_id, action, entity_type, entity_id, description, ip_address)
        VALUES ($1, $2, $3, 'delete', 'schedule_event', $4, $5, $6)
      `, [
        uuidv4(),
        req.user.id,
        req.user.company.id,
        eventId,
        `Evento deletado: ${event.title}`,
        req.ip
      ]);

      await commit(client);

      return res.status(200).json({
        success: true,
        message: 'Evento deletado com sucesso'
      });

    } catch (error) {
      await rollback(client);
      throw error;
    }
  });

  // Verificar conflitos de horário
  static async checkConflicts(companyId, startDate, endDate, userIds, excludeEventId = null) {
    if (!userIds || userIds.length === 0) return [];

    let whereClause = `
      WHERE e.company_id = $1 
      AND e.deleted_at IS NULL
      AND e.status NOT IN ('cancelled', 'completed')
      AND (
        (e.start_date < $3 AND e.end_date > $2) OR
        (e.start_date >= $2 AND e.start_date < $3)
      )
      AND (
        e.created_by = ANY($4) OR
        e.id IN (SELECT event_id FROM event_attendees WHERE user_id = ANY($4) AND deleted_at IS NULL)
      )
    `;

    let queryParams = [companyId, startDate, endDate, userIds];

    if (excludeEventId) {
      whereClause += ` AND e.id != $5`;
      queryParams.push(excludeEventId);
    }

    const conflictQuery = `
      SELECT 
        e.id,
        e.title,
        e.start_date,
        e.end_date,
        e.type,
        e.priority,
        u.name as organizer_name,
        array_agg(DISTINCT ea.user_id) FILTER (WHERE ea.user_id IS NOT NULL) as conflicted_users
      FROM schedule_events e
      LEFT JOIN users u ON e.created_by = u.id
      LEFT JOIN event_attendees ea ON e.id = ea.event_id AND ea.deleted_at IS NULL AND ea.user_id = ANY($4)
      ${whereClause}
      GROUP BY e.id, e.title, e.start_date, e.end_date, e.type, e.priority, u.name
      ORDER BY e.start_date ASC
    `;

    const conflictResult = await query(conflictQuery, queryParams);
    return conflictResult.rows;
  }

  // Criar eventos recorrentes
  static async createRecurringEvents(client, baseEvent, frequency, until, count) {
    const maxRecurrences = count || 50; // Limite máximo para evitar loops infinitos
    let currentDate = new Date(baseEvent.start_date);
    const endDate = until ? new Date(until) : new Date(currentDate.getTime() + (365 * 24 * 60 * 60 * 1000)); // 1 ano se não especificado
    const duration = new Date(baseEvent.end_date) - new Date(baseEvent.start_date);
    let recurrenceCount = 0;

    while (currentDate < endDate && recurrenceCount < maxRecurrences) {
      // Calcular próxima data
      switch (frequency) {
        case 'daily':
          currentDate.setDate(currentDate.getDate() + 1);
          break;
        case 'weekly':
          currentDate.setDate(currentDate.getDate() + 7);
          break;
        case 'monthly':
          currentDate.setMonth(currentDate.getMonth() + 1);
          break;
        case 'yearly':
          currentDate.setFullYear(currentDate.getFullYear() + 1);
          break;
        default:
          return; // Frequência inválida
      }

      if (currentDate >= endDate) break;

      const nextEndDate = new Date(currentDate.getTime() + duration);

      // Criar evento recorrente
      await client.query(`
        INSERT INTO schedule_events (
          id, company_id, title, description, start_date, end_date,
          all_day, type, priority, status, location, virtual_meeting_url,
          client_id, lead_id, recurring, parent_event_id, reminder_minutes,
          tags, custom_fields, is_private, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
      `, [
        uuidv4(),
        baseEvent.company_id,
        baseEvent.title,
        baseEvent.description,
        currentDate,
        nextEndDate,
        baseEvent.all_day,
        baseEvent.type,
        baseEvent.priority,
        baseEvent.status,
        baseEvent.location,
        baseEvent.virtual_meeting_url,
        baseEvent.client_id,
        baseEvent.lead_id,
        false, // Eventos filhos não são recorrentes
        baseEvent.id, // Referência ao evento pai
        baseEvent.reminder_minutes,
        baseEvent.tags,
        baseEvent.custom_fields,
        baseEvent.is_private,
        baseEvent.created_by
      ]);

      recurrenceCount++;

      if (count && recurrenceCount >= count) break;
    }
  }

  // Visualização de calendário
  static getCalendarView = asyncHandler(async (req, res) => {
    const { start_date, end_date, view = 'month' } = req.query;

    if (!start_date || !end_date) {
      throw new ApiError(400, 'start_date e end_date são obrigatórios');
    }

    const calendarQuery = `
      SELECT 
        e.id,
        e.title,
        e.start_date,
        e.end_date,
        e.all_day,
        e.type,
        e.priority,
        e.status,
        e.location,
        e.is_private,
        c.name as client_name,
        l.name as lead_name,
        u.name as organizer_name,
        CASE 
          WHEN e.created_by = $4 THEN true
          WHEN e.id IN (SELECT event_id FROM event_attendees WHERE user_id = $4 AND deleted_at IS NULL) THEN true
          ELSE false
        END as is_participant
      FROM schedule_events e
      LEFT JOIN clients c ON e.client_id = c.id AND c.company_id = e.company_id
      LEFT JOIN leads l ON e.lead_id = l.id AND l.company_id = e.company_id
      LEFT JOIN users u ON e.created_by = u.id
      WHERE e.company_id = $1 
      AND e.deleted_at IS NULL
      AND e.start_date <= $3::timestamp + INTERVAL '1 day'
      AND e.end_date >= $2::timestamp
      AND (
        e.is_private = false OR 
        e.created_by = $4 OR
        e.id IN (SELECT event_id FROM event_attendees WHERE user_id = $4 AND deleted_at IS NULL)
      )
      ORDER BY e.start_date ASC
    `;

    const eventsResult = await query(calendarQuery, [
      req.user.company.id,
      start_date,
      end_date,
      req.user.id
    ]);

    // Agrupar eventos por data (para view de calendário)
    const eventsByDate = {};
    const eventsByWeek = {};
    
    eventsResult.rows.forEach(event => {
      const startDate = new Date(event.start_date);
      const dateKey = startDate.toISOString().split('T')[0];
      
      // Agrupamento por dia
      if (!eventsByDate[dateKey]) {
        eventsByDate[dateKey] = [];
      }
      eventsByDate[dateKey].push(event);

      // Agrupamento por semana (para views semanais)
      const weekStart = new Date(startDate);
      weekStart.setDate(startDate.getDate() - startDate.getDay());
      const weekKey = weekStart.toISOString().split('T')[0];
      
      if (!eventsByWeek[weekKey]) {
        eventsByWeek[weekKey] = [];
      }
      eventsByWeek[weekKey].push(event);
    });

    // Estatísticas do período
    const stats = {
      total_events: eventsResult.rows.length,
      by_status: eventsResult.rows.reduce((acc, event) => {
        acc[event.status] = (acc[event.status] || 0) + 1;
        return acc;
      }, {}),
      by_type: eventsResult.rows.reduce((acc, event) => {
        acc[event.type] = (acc[event.type] || 0) + 1;
        return acc;
      }, {}),
      by_priority: eventsResult.rows.reduce((acc, event) => {
        acc[event.priority] = (acc[event.priority] || 0) + 1;
        return acc;
      }, {})
    };

    return res.status(200).json({
      success: true,
      data: {
        view,
        period: { start_date, end_date },
        events: eventsResult.rows,
        events_by_date: eventsByDate,
        events_by_week: eventsByWeek,
        stats
      }
    });
  });

  // Alterar status do evento
  static updateStatus = asyncHandler(async (req, res) => {
    const eventId = req.params.id;
    const { status, notes } = req.body;

    if (!status || !['scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show'].includes(status)) {
      throw new ApiError(400, 'Status inválido');
    }

    // Verificar se evento existe
    const existingEvent = await query(
      'SELECT * FROM schedule_events WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL',
      [eventId, req.user.company.id]
    );

    if (existingEvent.rows.length === 0) {
      throw new ApiError(404, 'Evento não encontrado');
    }

    const event = existingEvent.rows[0];

    // Atualizar status
    const updateQuery = `
      UPDATE schedule_events 
      SET status = $1, updated_at = NOW()
      WHERE id = $2 AND company_id = $3
      RETURNING *
    `;

    const updatedEventResult = await query(updateQuery, [status, eventId, req.user.company.id]);
    const updatedEvent = updatedEventResult.rows[0];

    // Conceder XP/Coins por completar evento
    if (status === 'completed') {
      const xpReward = event.type === 'meeting' ? 15 : 10;
      const coinReward = event.type === 'meeting' ? 8 : 5;

      await query(`
        UPDATE user_gamification_profiles 
        SET total_xp = total_xp + $1, current_coins = current_coins + $2
        WHERE user_id = $3 AND company_id = $4
      `, [xpReward, coinReward, req.user.id, req.user.company.id]);

      // Registrar no histórico de gamificação
      await query(`
        INSERT INTO gamification_history (id, user_id, company_id, type, amount, reason, action_type)
        VALUES 
          ($1, $2, $3, 'xp', $4, 'Evento completado', 'event_completed'),
          ($5, $2, $3, 'coins', $6, 'Evento completado', 'event_completed')
      `, [uuidv4(), req.user.id, req.user.company.id, xpReward, uuidv4(), coinReward]);
    }

    // Log de auditoria
    await query(`
      INSERT INTO audit_logs (id, user_id, company_id, action, entity_type, entity_id, description, ip_address)
      VALUES ($1, $2, $3, 'update', 'schedule_event', $4, $5, $6)
    `, [
      uuidv4(),
      req.user.id,
      req.user.company.id,
      eventId,
      `Status do evento alterado para: ${status}${notes ? ` - ${notes}` : ''}`,
      req.ip
    ]);

    return res.status(200).json({
      success: true,
      data: updatedEvent,
      message: 'Status do evento atualizado com sucesso'
    });
  });
}

module.exports = ScheduleController;