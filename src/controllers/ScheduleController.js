/**
 * ==========================================
 * 📅 SCHEDULE CONTROLLER - SISTEMA DE AGENDAMENTOS
 * ==========================================
 *
 * Gestão de eventos e compromissos
 * Estrutura unificada com contato_id (não mais client_id/lead_id)
 * Tabela: polox.events
 *
 * Features:
 * - Criar/listar/editar/deletar eventos
 * - Vinculação com contatos unificados
 * - Controle de conflitos de horário
 * - Status de eventos (scheduled, confirmed, completed, cancelled)
 */

const { query, transaction } = require("../config/database");
const {
  ApiError,
  asyncHandler,
  ValidationError,
  NotFoundError,
} = require("../utils/errors");
const { successResponse, paginatedResponse } = require("../utils/response");
const { tc } = require("../config/i18n");
const { auditLogger } = require("../utils/logger");
const Joi = require("joi");

class ScheduleController {
  /**
   * 📝 VALIDAÇÕES JOI
   */
  static createEventSchema = Joi.object({
    title: Joi.string().min(2).max(255).required(),
    description: Joi.string().max(1000).allow("", null),
    start_datetime: Joi.date().required(),
    end_datetime: Joi.date().greater(Joi.ref("start_datetime")).required(),
    is_all_day: Joi.boolean().default(false),
    event_type: Joi.string()
      .valid("meeting", "call", "task", "reminder", "event", "appointment")
      .default("meeting"),
    status: Joi.string()
      .valid(
        "scheduled",
        "confirmed",
        "in_progress",
        "completed",
        "cancelled",
        "no_show"
      )
      .default("scheduled"),
    event_location: Joi.string().max(255).allow("", null),
    meeting_link: Joi.string().uri().allow("", null),
    contato_id: Joi.number().integer().allow(null),
    timezone: Joi.string().default("America/Sao_Paulo"),
    reminder_minutes: Joi.number().integer().min(0).default(15), // Permitir 0
    is_recurring: Joi.boolean().default(false),
    recurrence_pattern: Joi.object().allow(null),
  });

  static updateEventSchema = Joi.object({
    title: Joi.string().min(2).max(255),
    description: Joi.string().max(1000).allow("", null),
    start_datetime: Joi.date(),
    end_datetime: Joi.date(),
    is_all_day: Joi.boolean(),
    event_type: Joi.string().valid(
      "meeting",
      "call",
      "task",
      "reminder",
      "event",
      "appointment"
    ),
    status: Joi.string().valid(
      "scheduled",
      "confirmed",
      "in_progress",
      "completed",
      "cancelled",
      "no_show"
    ),
    event_location: Joi.string().max(255).allow("", null),
    meeting_link: Joi.string().uri().allow("", null),
    contato_id: Joi.number().integer().allow(null),
    timezone: Joi.string(),
    reminder_minutes: Joi.number().integer().min(0), // Permitir 0
    is_recurring: Joi.boolean(),
    recurrence_pattern: Joi.object().allow(null),
  }).custom((value, helpers) => {
    if (
      value.start_datetime &&
      value.end_datetime &&
      new Date(value.end_datetime) <= new Date(value.start_datetime)
    ) {
      return helpers.error("date.greater");
    }
    return value;
  });

  /**
   * 📋 Listar eventos
   * GET /api/schedule/events
   */
  static getEvents = asyncHandler(async (req, res) => {
    const companyId = req.user.companyId;
    const {
      contato_id,
      event_type,
      status,
      priority,
      date_from,
      date_to,
      search,
      sort_by = "start_datetime",
      sort_order = "ASC",
      limit = 50,
      offset = 0,
    } = req.query;

    const conditions = ["e.company_id = $1", "e.deleted_at IS NULL"];
    const params = [companyId];
    let paramIndex = 2;

    // Filtros
    if (contato_id) {
      conditions.push(`e.contato_id = $${paramIndex}`);
      params.push(contato_id);
      paramIndex++;
    }

    if (event_type) {
      conditions.push(`e.event_type = $${paramIndex}`);
      params.push(event_type);
      paramIndex++;
    }

    if (status) {
      conditions.push(`e.status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    }

    // Priority removido - não existe na tabela

    if (date_from) {
      conditions.push(`e.start_datetime >= $${paramIndex}`);
      params.push(date_from);
      paramIndex++;
    }

    if (date_to) {
      conditions.push(`e.end_datetime <= $${paramIndex}`);
      params.push(date_to);
      paramIndex++;
    }

    if (search) {
      conditions.push(
        `(e.title ILIKE $${paramIndex} OR e.description ILIKE $${paramIndex})`
      );
      params.push(`%${search}%`);
      paramIndex++;
    }

    // Todos os eventos são visíveis para usuários da empresa (removido filtro de visibilidade)

    // Validar sort_by
    const allowedSortFields = ["start_datetime", "created_at", "title"];
    const sortField = allowedSortFields.includes(sort_by)
      ? sort_by
      : "start_datetime";
    const sortDirection = sort_order.toUpperCase() === "DESC" ? "DESC" : "ASC";

    const whereClause = conditions.join(" AND ");

    const eventsQuery = `
      SELECT 
        e.*,
        c.nome as contact_name,
        c.tipo as contact_type,
        c.email as contact_email,
        c.phone as contact_phone,
        u.full_name as organizer_name
      FROM polox.events e
      LEFT JOIN polox.contacts c ON e.contato_id = c.id AND c.company_id = e.company_id AND c.deleted_at IS NULL
      LEFT JOIN polox.users u ON e.user_id = u.id
      WHERE ${whereClause}
      ORDER BY e.${sortField} ${sortDirection}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    params.push(parseInt(limit), parseInt(offset));

    const countQuery = `
      SELECT COUNT(*) as total
      FROM polox.events e
      WHERE ${whereClause}
    `;

    const [eventsResult, countResult] = await Promise.all([
      query(eventsQuery, params),
      query(countQuery, params.slice(0, -2)),
    ]);

    return paginatedResponse(
      res,
      eventsResult.rows,
      {
        page: Math.floor(parseInt(offset) / parseInt(limit)) + 1,
        totalPages: Math.ceil(
          parseInt(countResult.rows[0].total) / parseInt(limit)
        ),
        totalItems: parseInt(countResult.rows[0].total),
        limit: parseInt(limit),
        hasNextPage:
          parseInt(offset) + parseInt(limit) <
          parseInt(countResult.rows[0].total),
        hasPreviousPage: parseInt(offset) > 0,
      },
      tc(req, "scheduleController", "list.success")
    );
  });

  /**
   * ➕ Criar evento
   * POST /api/schedule/events
   */
  static createEvent = asyncHandler(async (req, res) => {
    const companyId = req.user.companyId;
    const userId = req.user.id;

    // Validação
    const { error, value } = ScheduleController.createEventSchema.validate(
      req.body,
      {
        abortEarly: false,
      }
    );

    if (error) {
      const messages = error.details.map((d) => d.message).join(", ");
      throw new ValidationError(messages);
    }

    // Verificar se contato existe (se fornecido)
    if (value.contato_id) {
      const contactExists = await query(
        "SELECT id FROM polox.contacts WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL",
        [value.contato_id, companyId]
      );

      if (contactExists.rows.length === 0) {
        throw new ValidationError("Contato não encontrado");
      }
    }

    // Verificar conflitos de horário se solicitado
    if (req.query.check_conflicts === "true") {
      const conflicts = await ScheduleController.checkConflicts(
        companyId,
        value.start_datetime,
        value.end_datetime,
        userId
      );

      if (conflicts.length > 0 && req.query.ignore_conflicts !== "true") {
        return res.status(409).json({
          success: false,
          message: "Conflitos de horário detectados",
          conflicts: conflicts,
        });
      }
    }

    // Criar evento
    const event = await transaction(async (client) => {
      const insertQuery = `
        INSERT INTO polox.events (
          company_id, user_id, contato_id, event_type, title, description,
          event_location, meeting_link, start_datetime, end_datetime, timezone, 
          is_all_day, status, reminder_minutes, is_recurring, recurrence_pattern,
          created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW(), NOW())
        RETURNING *
      `;

      const result = await client.query(insertQuery, [
        companyId,
        userId,
        value.contato_id,
        value.event_type,
        value.title,
        value.description,
        value.event_location,
        value.meeting_link,
        value.start_datetime,
        value.end_datetime,
        value.timezone,
        value.is_all_day,
        value.status,
        value.reminder_minutes,
        value.is_recurring,
        value.recurrence_pattern
          ? JSON.stringify(value.recurrence_pattern)
          : null,
      ]);

      return result.rows[0];
    });

    // Audit log
    auditLogger({
      action: "Evento criado",
      userId,
      companyId,
      resourceType: "event",
      resourceId: event.id,
      changes: value,
    });

    return successResponse(
      res,
      event,
      tc(req, "scheduleController", "create.success"),
      201
    );
  });

  /**
   * 🔍 Buscar evento por ID
   * GET /api/schedule/events/:id
   */
  static show = asyncHandler(async (req, res) => {
    const companyId = req.user.companyId;
    const userId = req.user.id;
    const { id } = req.params;

    const eventQuery = `
      SELECT 
        e.*,
        c.nome as contact_name,
        c.tipo as contact_type,
        c.email as contact_email,
        c.phone as contact_phone,
        u.full_name as organizer_name,
        u.email as organizer_email
      FROM polox.events e
      LEFT JOIN polox.contacts c ON e.contato_id = c.id AND c.company_id = e.company_id AND c.deleted_at IS NULL
      LEFT JOIN polox.users u ON e.user_id = u.id
      WHERE e.id = $1 AND e.company_id = $2 AND e.deleted_at IS NULL
    `;

    const result = await query(eventQuery, [id, companyId]);

    if (result.rows.length === 0) {
      throw new NotFoundError("Evento não encontrado");
    }

    const event = result.rows[0];

    // Todos os eventos são visíveis para usuários da mesma empresa

    return successResponse(
      res,
      event,
      tc(req, "scheduleController", "show.success")
    );
  });

  /**
   * ✏️ Atualizar evento
   * PUT /api/schedule/events/:id
   */
  static update = asyncHandler(async (req, res) => {
    const companyId = req.user.companyId;
    const userId = req.user.id;
    const { id } = req.params;

    // Validação
    const { error, value } = ScheduleController.updateEventSchema.validate(
      req.body,
      {
        abortEarly: false,
      }
    );

    if (error) {
      const messages = error.details.map((d) => d.message).join(", ");
      throw new ValidationError(messages);
    }

    // Verificar se evento existe e se usuário tem permissão
    const existingEvent = await query(
      "SELECT * FROM polox.events WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL",
      [id, companyId]
    );

    if (existingEvent.rows.length === 0) {
      throw new NotFoundError("Evento não encontrado");
    }

    const event = existingEvent.rows[0];

    // Verificar permissão para editar (só o criador)
    if (event.user_id !== userId) {
      throw new ApiError(403, "Sem permissão para editar este evento");
    }

    // Verificar se contato existe (se fornecido)
    if (value.contato_id) {
      const contactExists = await query(
        "SELECT id FROM polox.contacts WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL",
        [value.contato_id, companyId]
      );

      if (contactExists.rows.length === 0) {
        throw new ValidationError("Contato não encontrado");
      }
    }

    // Atualizar evento
    const updates = [];
    const params = [id, companyId];
    let paramIndex = 3;

    Object.keys(value).forEach((key) => {
      if (value[key] !== undefined) {
        if (key === "metadata") {
          updates.push(`${key} = $${paramIndex}`);
          params.push(JSON.stringify(value[key]));
        } else {
          updates.push(`${key} = $${paramIndex}`);
          params.push(value[key]);
        }
        paramIndex++;
      }
    });

    if (updates.length === 0) {
      throw new ValidationError("Nenhum campo para atualizar");
    }

    updates.push("updated_at = NOW()");

    const updateQuery = `
      UPDATE polox.events
      SET ${updates.join(", ")}
      WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL
      RETURNING *
    `;

    const result = await query(updateQuery, params);
    const updatedEvent = result.rows[0];

    // Audit log
    auditLogger({
      action: "Evento atualizado",
      userId,
      companyId,
      resourceType: "event",
      resourceId: id,
      changes: value,
    });

    return successResponse(
      res,
      updatedEvent,
      tc(req, "scheduleController", "update.success")
    );
  });

  /**
   * 🗑️ Deletar evento (soft delete)
   * DELETE /api/schedule/events/:id
   */
  static delete = asyncHandler(async (req, res) => {
    const companyId = req.user.companyId;
    const userId = req.user.id;
    const { id } = req.params;

    // Verificar se evento existe e se usuário tem permissão
    const existingEvent = await query(
      "SELECT * FROM polox.events WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL",
      [id, companyId]
    );

    if (existingEvent.rows.length === 0) {
      throw new NotFoundError("Evento não encontrado");
    }

    const event = existingEvent.rows[0];

    // Verificar permissão para deletar (só o criador)
    if (event.user_id !== userId) {
      throw new ApiError(403, "Sem permissão para deletar este evento");
    }

    // Soft delete
    await query(
      "UPDATE polox.events SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1 AND company_id = $2",
      [id, companyId]
    );

    // Audit log
    auditLogger({
      action: "Evento deletado",
      userId,
      companyId,
      resourceType: "event",
      resourceId: id,
    });

    return successResponse(
      res,
      null,
      tc(req, "scheduleController", "delete.success")
    );
  });

  /**
   * 🔄 Alterar status do evento
   * PUT /api/schedule/events/:id/status
   */
  static updateStatus = asyncHandler(async (req, res) => {
    const companyId = req.user.companyId;
    const userId = req.user.id;
    const { id } = req.params;
    const { status, notes } = req.body;

    const validStatuses = [
      "scheduled",
      "confirmed",
      "in_progress",
      "completed",
      "cancelled",
      "no_show",
    ];
    if (!status || !validStatuses.includes(status)) {
      throw new ValidationError("Status inválido");
    }

    // Verificar se evento existe
    const existingEvent = await query(
      "SELECT * FROM polox.events WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL",
      [id, companyId]
    );

    if (existingEvent.rows.length === 0) {
      throw new NotFoundError("Evento não encontrado");
    }

    // Atualizar status
    const result = await query(
      "UPDATE polox.events SET status = $1, updated_at = NOW() WHERE id = $2 AND company_id = $3 RETURNING *",
      [status, id, companyId]
    );

    const updatedEvent = result.rows[0];

    // Audit log
    auditLogger({
      action: `Status do evento alterado para: ${status}${
        notes ? ` - ${notes}` : ""
      }`,
      userId,
      companyId,
      resourceType: "event",
      resourceId: id,
    });

    return successResponse(
      res,
      updatedEvent,
      tc(req, "scheduleController", "updateStatus.success")
    );
  });

  /**
   * 🔍 Verificar conflitos de horário
   */
  static async checkConflicts(
    companyId,
    startDatetime,
    endDatetime,
    userId,
    excludeEventId = null
  ) {
    let whereClause = `
      WHERE e.company_id = $1 
      AND e.deleted_at IS NULL
      AND e.status NOT IN ('cancelled', 'completed')
      AND e.user_id = $4
      AND (
        (e.start_datetime < $3 AND e.end_datetime > $2) OR
        (e.start_datetime >= $2 AND e.start_datetime < $3)
      )
    `;

    let params = [companyId, startDatetime, endDatetime, userId];

    if (excludeEventId) {
      whereClause += " AND e.id != $5";
      params.push(excludeEventId);
    }

    const conflictQuery = `
      SELECT 
        e.id,
        e.title,
        e.start_datetime,
        e.end_datetime,
        e.event_type,
        u.full_name as organizer_name
      FROM polox.events e
      LEFT JOIN polox.users u ON e.user_id = u.id
      ${whereClause}
      ORDER BY e.start_datetime ASC
    `;

    const result = await query(conflictQuery, params);
    return result.rows;
  }

  /**
   * 📊 Estatísticas de eventos
   * GET /api/schedule/stats
   */
  static getStats = asyncHandler(async (req, res) => {
    const companyId = req.user.companyId;
    const { date_from, date_to } = req.query;

    let whereClause = "WHERE company_id = $1 AND deleted_at IS NULL";
    const params = [companyId];
    let paramIndex = 2;

    if (date_from) {
      whereClause += ` AND start_datetime >= $${paramIndex}`;
      params.push(date_from);
      paramIndex++;
    }

    if (date_to) {
      whereClause += ` AND end_datetime <= $${paramIndex}`;
      params.push(date_to);
      paramIndex++;
    }

    const statsQuery = `
      SELECT 
        COUNT(*) as total_events,
        COUNT(CASE WHEN status = 'scheduled' THEN 1 END) as scheduled,
        COUNT(CASE WHEN status = 'confirmed' THEN 1 END) as confirmed,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
        COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled,
        COUNT(CASE WHEN event_type = 'meeting' THEN 1 END) as meetings,
        COUNT(CASE WHEN event_type = 'call' THEN 1 END) as calls,
        0 as high_priority, -- Campo priority removido da tabela
        COUNT(CASE WHEN start_datetime >= CURRENT_DATE AND start_datetime < CURRENT_DATE + INTERVAL '7 days' THEN 1 END) as next_7_days
      FROM polox.events
      ${whereClause}
    `;

    const result = await query(statsQuery, params);

    return successResponse(
      res,
      result.rows[0],
      tc(req, "scheduleController", "stats.success")
    );
  });
}

module.exports = ScheduleController;
