/**
 * ==========================================
 * 🎫 TICKET CONTROLLER - COPILOT_PROMPT_6
 * ==========================================
 * Sistema completo de tickets e suporte
 * ==========================================
 */

const { query, beginTransaction, commitTransaction, rollbackTransaction } = require('../models/database');
const { asyncHandler, ApiError } = require('../utils/errors');
const { logger, auditLogger } = require('../utils/logger');
const { tc } = require('../config/i18n');
const { cache } = require('../config/cache');
const { trackUser } = require('../config/monitoring');
const { 
  validateTicketData, 
  validateUpdateData,
  sanitizeTicketOutput,
  formatPaginatedResponse 
} = require('../utils/validation');
const { v4: uuidv4 } = require('uuid');

class TicketController {

  /**
   * 📋 LISTAR TICKETS
   * GET /api/tickets
   */
  static index = asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = (page - 1) * limit;
    
    let whereClause = 'WHERE t.company_id = $1 AND t.deleted_at IS NULL';
    let queryParams = [req.user.companyId];
    let paramCount = 1;

    // Filtros avançados
    if (req.query.status) {
      whereClause += ` AND t.status = $${++paramCount}`;
      queryParams.push(req.query.status);
    }

    if (req.query.priority) {
      whereClause += ` AND t.priority = $${++paramCount}`;
      queryParams.push(req.query.priority);
    }

    if (req.query.department) {
      whereClause += ` AND t.department = $${++paramCount}`;
      queryParams.push(req.query.department);
    }

    if (req.query.assigned_to) {
      whereClause += ` AND t.assigned_to = $${++paramCount}`;
      queryParams.push(req.query.assigned_to);
    }

    if (req.query.search) {
      whereClause += ` AND (t.title ILIKE $${++paramCount} OR t.description ILIKE $${++paramCount} OR t.ticket_number ILIKE $${++paramCount})`;
      const searchTerm = `%${req.query.search}%`;
      queryParams.push(searchTerm, searchTerm, searchTerm);
      paramCount += 2;
    }

    if (req.query.created_by_me === 'true') {
      whereClause += ` AND t.created_by = $${++paramCount}`;
      queryParams.push(req.user.id);
    }

    if (req.query.assigned_to_me === 'true') {
      whereClause += ` AND t.assigned_to = $${++paramCount}`;
      queryParams.push(req.user.id);
    }

    // Query principal
    const ticketsQuery = `
      SELECT 
        t.*,
        creator.name as created_by_name,
        assignee.name as assigned_to_name,
        c.name as customer_name,
        COUNT(DISTINCT tr.id) as reply_count,
        MAX(tr.created_at) as last_reply_at,
        CASE 
          WHEN t.status = 'open' AND t.priority = 'urgent' AND t.created_at < NOW() - INTERVAL '2 hours' THEN true
          WHEN t.status = 'open' AND t.priority = 'high' AND t.created_at < NOW() - INTERVAL '4 hours' THEN true
          WHEN t.status = 'open' AND t.priority = 'medium' AND t.created_at < NOW() - INTERVAL '24 hours' THEN true
          WHEN t.status = 'open' AND t.priority = 'low' AND t.created_at < NOW() - INTERVAL '72 hours' THEN true
          ELSE false
        END as is_overdue
      FROM tickets t
      LEFT JOIN users creator ON t.created_by = creator.id
      LEFT JOIN users assignee ON t.assigned_to = assignee.id
      LEFT JOIN customers c ON t.customer_id = c.id
      LEFT JOIN ticket_replies tr ON t.id = tr.ticket_id AND tr.deleted_at IS NULL
      ${whereClause}
      GROUP BY t.id, creator.name, assignee.name, c.name
      ORDER BY 
        CASE 
          WHEN t.priority = 'urgent' THEN 1
          WHEN t.priority = 'high' THEN 2
          WHEN t.priority = 'medium' THEN 3
          WHEN t.priority = 'low' THEN 4
          ELSE 5
        END,
        CASE 
          WHEN t.status = 'open' THEN 1
          WHEN t.status = 'in_progress' THEN 2
          WHEN t.status = 'pending' THEN 3
          WHEN t.status = 'resolved' THEN 4
          WHEN t.status = 'closed' THEN 5
          ELSE 6
        END,
        t.created_at DESC
      LIMIT $${++paramCount} OFFSET $${++paramCount}
    `;
    
    queryParams.push(limit, offset);

    // Query de contagem
    const countQuery = `SELECT COUNT(*) as total FROM tickets t ${whereClause}`;

    // Query de estatísticas
    const statsQuery = `
      SELECT 
        COUNT(*) as total_tickets,
        COUNT(CASE WHEN status = 'open' THEN 1 END) as open_tickets,
        COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress_tickets,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_tickets,
        COUNT(CASE WHEN status = 'resolved' THEN 1 END) as resolved_tickets,
        COUNT(CASE WHEN status = 'closed' THEN 1 END) as closed_tickets,
        COUNT(CASE WHEN priority = 'urgent' AND status NOT IN ('resolved', 'closed') THEN 1 END) as urgent_open,
        COUNT(CASE WHEN priority = 'high' AND status NOT IN ('resolved', 'closed') THEN 1 END) as high_open,
        ROUND(AVG(CASE 
          WHEN status IN ('resolved', 'closed') AND resolved_at IS NOT NULL 
          THEN EXTRACT(EPOCH FROM (resolved_at - created_at))/3600 
        END), 2) as avg_resolution_hours
      FROM tickets t
      WHERE t.company_id = $1 AND t.deleted_at IS NULL
    `;

    const [ticketsResult, countResult, statsResult] = await Promise.all([
      query(ticketsQuery, queryParams),
      query(countQuery, queryParams.slice(0, -2)),
      query(statsQuery, [req.user.companyId])
    ]);

    // Processar dados dos tickets
    const tickets = ticketsResult.rows.map(ticket => ({
      ...sanitizeTicketOutput(ticket),
      reply_count: parseInt(ticket.reply_count),
      last_reply_at: ticket.last_reply_at,
      is_overdue: ticket.is_overdue
    }));

    res.json({
      success: true,
      data: tickets,
      pagination: {
        page,
        limit,
        total: parseInt(countResult.rows[0].total),
        pages: Math.ceil(countResult.rows[0].total / limit)
      },
      stats: statsResult.rows[0]
    });
  });

  /**
   * ➕ CRIAR TICKET
   * POST /api/tickets
   */
  static create = asyncHandler(async (req, res) => {
    const ticketData = req.body;

    // Validar dados
    const validation = validateTicketData(ticketData);
    if (!validation.isValid) {
      throw new ApiError(400, tc(req, 'ticketController', 'validation.invalid_data'), validation.errors);
    }

    const transaction = await beginTransaction();

    try {
      // Verificar se cliente existe (se fornecido)
      if (ticketData.customer_id) {
        const customerCheck = await query(
          'SELECT id FROM customers WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL',
          [ticketData.customer_id, req.user.companyId]
        );

        if (customerCheck.rows.length === 0) {
          throw new ApiError(404, tc(req, 'ticketController', 'validation.client_not_found'));
        }
      }

      // Verificar se usuário designado existe (se fornecido)
      if (ticketData.assigned_to) {
        const assigneeCheck = await query(
          'SELECT id FROM users WHERE id = $1 AND company_id = $2 AND active = true',
          [ticketData.assigned_to, req.user.companyId]
        );

        if (assigneeCheck.rows.length === 0) {
          throw new ApiError(404, tc(req, 'ticketController', 'validation.user_not_found'));
        }
      }

      // Gerar número do ticket
      const ticketNumber = await this.generateTicketNumber(req.user.companyId);

      // Criar ticket
      const ticketId = uuidv4();
      const createTicketQuery = `
        INSERT INTO tickets (
          id, company_id, ticket_number, title, description, priority, 
          department, status, customer_id, assigned_to, tags, 
          custom_fields, source, created_by, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW())
        RETURNING *
      `;

      const newTicketResult = await query(createTicketQuery, [
        ticketId,
        req.user.companyId,
        ticketNumber,
        ticketData.title,
        ticketData.description,
        ticketData.priority || 'medium',
        ticketData.department || 'support',
        'open',
        ticketData.customer_id || null,
        ticketData.assigned_to || null,
        JSON.stringify(ticketData.tags || []),
        JSON.stringify(ticketData.custom_fields || {}),
        ticketData.source || 'internal',
        req.user.id
      ]);

      const newTicket = newTicketResult.rows[0];

      // Criar histórico inicial
      await query(`
        INSERT INTO ticket_history (id, ticket_id, action_type, action_description, performed_by, created_at)
        VALUES ($1, $2, 'created', 'Ticket created', $3, NOW())
      `, [uuidv4(), ticketId, req.user.id]);

      // Se foi designado para alguém, criar notificação
      if (ticketData.assigned_to) {
        await query(`
          INSERT INTO notifications (id, user_id, company_id, type, title, message, data, created_at)
          VALUES ($1, $2, $3, 'ticket_assigned', $4, $5, $6, NOW())
        `, [
          uuidv4(),
          ticketData.assigned_to,
          req.user.companyId,
          'Ticket Designado',
          `Ticket #${ticketNumber} foi designado para você`,
          JSON.stringify({ ticket_id: ticketId, ticket_number: ticketNumber })
        ]);
      }

      await commitTransaction(transaction);

      // Conceder XP/Coins por criar ticket
      const xpReward = ticketData.priority === 'urgent' ? 25 : 
                      ticketData.priority === 'high' ? 20 : 15;
      const coinReward = 8;

      await query(`
        UPDATE user_gamification_profiles 
        SET total_xp = total_xp + $1, current_coins = current_coins + $2
        WHERE user_id = $3 AND company_id = $4
      `, [xpReward, coinReward, req.user.id, req.user.companyId]);

      // Registrar no histórico de gamificação
      await query(`
        INSERT INTO gamification_history (id, user_id, company_id, event_type, amount, reason, action_type, reference_id)
        VALUES 
          ($1, $2, $3, 'xp', $4, 'Ticket created', 'ticket_created', $5),
          ($6, $2, $3, 'coins', $7, 'Ticket created', 'ticket_created', $5)
      `, [uuidv4(), req.user.id, req.user.companyId, xpReward, ticketId, uuidv4(), coinReward]);

      // Limpar cache
      await cache.del(`tickets:${req.user.companyId}`, `ticket_stats:${req.user.companyId}`);

      // Log de auditoria
      auditLogger(tc(req, 'ticketController', 'audit.ticket_created', {
        number: ticketNumber,
        title: ticketData.title
      }), {
        userId: req.user.id,
        ticketId: ticketId,
        ticketNumber: ticketNumber,
        title: ticketData.title,
        priority: ticketData.priority,
        department: ticketData.department,
        assignedTo: ticketData.assigned_to,
        companyId: req.user.companyId,
        ip: req.ip
      });

      // Métricas
      trackUser.operation(req.user.companyId, 'ticket_created', 'success');

      res.status(201).json({
        success: true,
        message: tc(req, 'ticketController', 'create.success'),
        data: sanitizeTicketOutput(newTicket),
        gamification: {
          xp: xpReward,
          coins: coinReward,
          action: 'ticket_created'
        }
      });

    } catch (error) {
      await rollbackTransaction(transaction);
      trackUser.operation(req.user.companyId, 'ticket_created', 'failure');
      throw error;
    }
  });

  /**
   * 👁️ OBTER TICKET
   * GET /api/tickets/:id
   */
  static show = asyncHandler(async (req, res) => {
    const ticketId = req.params.id;

    const ticketQuery = `
      SELECT 
        t.*,
        creator.name as created_by_name,
        creator.email as created_by_email,
        assignee.name as assigned_to_name,
        assignee.email as assigned_to_email,
        c.name as customer_name,
        c.email as customer_email
      FROM tickets t
      LEFT JOIN users creator ON t.created_by = creator.id
      LEFT JOIN users assignee ON t.assigned_to = assignee.id
      LEFT JOIN customers c ON t.customer_id = c.id
      WHERE t.id = $1 AND t.company_id = $2 AND t.deleted_at IS NULL
    `;

    const ticketResult = await query(ticketQuery, [ticketId, req.user.companyId]);

    if (ticketResult.rows.length === 0) {
      throw new ApiError(404, tc(req, 'ticketController', 'validation.not_found'));
    }

    const ticket = ticketResult.rows[0];

    // Buscar respostas/comentários
    const repliesQuery = `
      SELECT 
        tr.*,
        u.full_name as user_name,
        u.email as user_email
      FROM ticket_replies tr
      LEFT JOIN users u ON tr.user_id = u.id
      WHERE tr.ticket_id = $1 AND tr.deleted_at IS NULL
      ORDER BY tr.created_at ASC
    `;

    const repliesResult = await query(repliesQuery, [ticketId]);

    // Buscar histórico
    const historyQuery = `
      SELECT 
        th.*,
        u.full_name as user_name
      FROM ticket_history th
      LEFT JOIN users u ON th.performed_by = u.id
      WHERE th.ticket_id = $1
      ORDER BY th.created_at DESC
      LIMIT 20
    `;

    const historyResult = await query(historyQuery, [ticketId]);

    res.json({
      success: true,
      data: {
        ...sanitizeTicketOutput(ticket),
        replies: repliesResult.rows,
        history: historyResult.rows,
        reply_count: repliesResult.rows.length
      }
    });
  });

  /**
   * ✏️ ATUALIZAR TICKET
   * PUT /api/tickets/:id
   */
  static update = asyncHandler(async (req, res) => {
    const ticketId = req.params.id;
    const updateData = req.body;

    // Validar dados de atualização
    const validation = validateUpdateData(updateData, 'ticket');
    if (!validation.isValid) {
      throw new ApiError(400, tc(req, 'ticketController', 'validation.invalid_data'), validation.errors);
    }

    const transaction = await beginTransaction();

    try {
      // Verificar se ticket existe
      const ticketCheck = await query(
        'SELECT * FROM tickets WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL',
        [ticketId, req.user.companyId]
      );

      if (ticketCheck.rows.length === 0) {
        throw new ApiError(404, tc(req, 'ticketController', 'validation.not_found'));
      }

      const currentTicket = ticketCheck.rows[0];

      // Verificar permissões (apenas criador, designado ou admin pode editar)
      if (currentTicket.created_by !== req.user.id && 
          currentTicket.assigned_to !== req.user.id && 
          req.user.role !== 'admin') {
        throw new ApiError(403, tc(req, 'ticketController', 'validation.no_permission_edit'));
      }

      // Construir query de atualização dinâmica
      const updateFields = [];
      const updateValues = [];
      let paramCount = 0;

      const allowedFields = [
        'title', 'description', 'priority', 'department', 'status', 
        'assigned_to', 'tags', 'custom_fields'
      ];

      const historyEntries = [];

      allowedFields.forEach(field => {
        if (updateData.hasOwnProperty(field)) {
          const oldValue = currentTicket[field];
          const newValue = updateData[field];

          if (field === 'tags' || field === 'custom_fields') {
            if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
              updateFields.push(`${field} = $${++paramCount}`);
              updateValues.push(JSON.stringify(newValue));
              historyEntries.push({
                action: `${field}_updated`,
                description: `${field} updated`
              });
            }
          } else if (oldValue !== newValue) {
            updateFields.push(`${field} = $${++paramCount}`);
            updateValues.push(newValue);
            
            historyEntries.push({
              action: `${field}_updated`,
              description: `${field} changed from "${oldValue}" to "${newValue}"`
            });
          }
        }
      });

      if (updateFields.length === 0) {
        throw new ApiError(400, tc(req, 'ticketController', 'validation.no_changes'));
      }

      // Atualizar timestamp de resolução se status mudou para resolved/closed
      if (updateData.status && ['resolved', 'closed'].includes(updateData.status) && 
          !['resolved', 'closed'].includes(currentTicket.status)) {
        updateFields.push(`resolved_at = NOW()`);
      }

      updateFields.push(`updated_at = NOW()`);
      updateValues.push(ticketId, req.user.companyId);

      const updateQuery = `
        UPDATE tickets 
        SET ${updateFields.join(', ')}
        WHERE id = $${++paramCount} AND company_id = $${++paramCount}
        RETURNING *
      `;

      const updatedTicketResult = await query(updateQuery, updateValues);
      const updatedTicket = updatedTicketResult.rows[0];

      // Registrar histórico de mudanças
      for (const entry of historyEntries) {
        await query(`
          INSERT INTO ticket_history (id, ticket_id, action_type, action_description, performed_by, created_at)
          VALUES ($1, $2, $3, $4, $5, NOW())
        `, [uuidv4(), ticketId, entry.action, entry.description, req.user.id]);
      }

      // Notificar designado se mudou
      if (updateData.assigned_to && updateData.assigned_to !== currentTicket.assigned_to) {
        await query(`
          INSERT INTO notifications (id, user_id, company_id, type, title, message, data, created_at)
          VALUES ($1, $2, $3, 'ticket_assigned', $4, $5, $6, NOW())
        `, [
          uuidv4(),
          updateData.assigned_to,
          req.user.companyId,
          'Ticket Reatribuído',
          `Ticket #${currentTicket.ticket_number} foi designado para você`,
          JSON.stringify({ ticket_id: ticketId, ticket_number: currentTicket.ticket_number })
        ]);
      }

      await commitTransaction(transaction);

      // Conceder XP/Coins se resolveu ticket
      if (updateData.status && ['resolved', 'closed'].includes(updateData.status) && 
          !['resolved', 'closed'].includes(currentTicket.status)) {
        
        const xpReward = currentTicket.priority === 'urgent' ? 50 : 
                        currentTicket.priority === 'high' ? 35 : 
                        currentTicket.priority === 'medium' ? 25 : 15;
        const coinReward = Math.floor(xpReward / 2);

        await query(`
          UPDATE user_gamification_profiles 
          SET total_xp = total_xp + $1, current_coins = current_coins + $2
          WHERE user_id = $3 AND company_id = $4
        `, [xpReward, coinReward, req.user.id, req.user.companyId]);

        // Registrar gamificação
        await query(`
          INSERT INTO gamification_history (id, user_id, company_id, event_type, amount, reason, action_type, reference_id)
          VALUES 
            ($1, $2, $3, 'xp', $4, 'Ticket resolved', 'ticket_resolved', $5),
            ($6, $2, $3, 'coins', $7, 'Ticket resolved', 'ticket_resolved', $5)
        `, [uuidv4(), req.user.id, req.user.companyId, xpReward, ticketId, uuidv4(), coinReward]);
      }

      // Limpar cache
      await cache.del(`ticket:${ticketId}`, `tickets:${req.user.companyId}`);

      // Log de auditoria
      auditLogger(tc(req, 'ticketController', 'audit.ticket_updated', {
        number: currentTicket.ticket_number
      }), {
        userId: req.user.id,
        ticketId: ticketId,
        ticketNumber: currentTicket.ticket_number,
        updatedFields: Object.keys(updateData),
        companyId: req.user.companyId,
        ip: req.ip
      });

      res.json({
        success: true,
        message: tc(req, 'ticketController', 'update.success'),
        data: sanitizeTicketOutput(updatedTicket),
        gamification: updateData.status && ['resolved', 'closed'].includes(updateData.status) ? {
          xp: currentTicket.priority === 'urgent' ? 50 : 35,
          coins: currentTicket.priority === 'urgent' ? 25 : 17,
          action: 'ticket_resolved'
        } : null
      });

    } catch (error) {
      await rollbackTransaction(transaction);
      throw error;
    }
  });

  /**
   * 🗑️ DELETAR TICKET
   * DELETE /api/tickets/:id
   */
  static destroy = asyncHandler(async (req, res) => {
    const ticketId = req.params.id;

    const transaction = await beginTransaction();

    try {
      // Verificar se ticket existe
      const ticketResult = await query(
        'SELECT id, ticket_number, created_by, status FROM tickets WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL',
        [ticketId, req.user.companyId]
      );

      if (ticketResult.rows.length === 0) {
        throw new ApiError(404, tc(req, 'ticketController', 'validation.not_found'));
      }

      const ticket = ticketResult.rows[0];

      // Verificar permissões (apenas criador ou admin pode deletar)
      if (ticket.created_by !== req.user.id && req.user.role !== 'admin') {
        throw new ApiError(403, tc(req, 'ticketController', 'validation.no_permission_delete'));
      }

      // Não permitir deletar tickets resolvidos/fechados (apenas admin)
      if (['resolved', 'closed'].includes(ticket.status) && req.user.role !== 'admin') {
        throw new ApiError(400, tc(req, 'ticketController', 'validation.cannot_delete_closed'));
      }

      // Soft delete do ticket
      await query(
        'UPDATE tickets SET deleted_at = NOW() WHERE id = $1 AND company_id = $2',
        [ticketId, req.user.companyId]
      );

      // Soft delete das respostas relacionadas
      await query(
        'UPDATE ticket_replies SET deleted_at = NOW() WHERE ticket_id = $1',
        [ticketId]
      );

      // Registrar no histórico
      await query(`
        INSERT INTO ticket_history (id, ticket_id, action_type, action_description, performed_by, created_at)
        VALUES ($1, $2, 'deleted', 'Ticket deleted', $3, NOW())
      `, [uuidv4(), ticketId, req.user.id]);

      await commitTransaction(transaction);

      // Limpar cache
      await cache.del(`ticket:${ticketId}`, `tickets:${req.user.companyId}`);

      // Log de auditoria
      auditLogger(tc(req, 'ticketController', 'audit.ticket_deleted', {
        number: ticket.ticket_number
      }), {
        userId: req.user.id,
        ticketId: ticketId,
        ticketNumber: ticket.ticket_number,
        companyId: req.user.companyId,
        ip: req.ip
      });

      res.json({
        success: true,
        message: tc(req, 'ticketController', 'delete.success')
      });

    } catch (error) {
      await rollbackTransaction(transaction);
      throw error;
    }
  });

  /**
   * 💬 ADICIONAR RESPOSTA
   * POST /api/tickets/:id/replies
   */
  static addReply = asyncHandler(async (req, res) => {
    const ticketId = req.params.id;
    const { message, is_internal = false } = req.body;

    if (!message || message.trim().length === 0) {
      throw new ApiError(400, tc(req, 'ticketController', 'validation.message_required'));
    }

    const transaction = await beginTransaction();

    try {
      // Verificar se ticket existe
      const ticketResult = await query(
        'SELECT id, ticket_number, status, created_by, assigned_to FROM tickets WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL',
        [ticketId, req.user.companyId]
      );

      if (ticketResult.rows.length === 0) {
        throw new ApiError(404, tc(req, 'ticketController', 'validation.not_found'));
      }

      const ticket = ticketResult.rows[0];

      // Verificar se pode responder (ticket não fechado)
      if (ticket.status === 'closed') {
        throw new ApiError(400, tc(req, 'ticketController', 'validation.cannot_reply_closed'));
      }

      // Criar resposta
      const replyId = uuidv4();
      const createReplyQuery = `
        INSERT INTO ticket_replies (
          id, ticket_id, user_id, message, is_internal, created_at
        ) VALUES ($1, $2, $3, $4, $5, NOW())
        RETURNING *
      `;

      const newReplyResult = await query(createReplyQuery, [
        replyId,
        ticketId,
        req.user.id,
        message.trim(),
        is_internal
      ]);

      const newReply = newReplyResult.rows[0];

      // Atualizar status do ticket se necessário
      let statusUpdate = null;
      if (ticket.status === 'pending') {
        statusUpdate = 'in_progress';
        await query(
          'UPDATE tickets SET status = $1, updated_at = NOW() WHERE id = $2',
          ['in_progress', ticketId]
        );
      }

      // Registrar no histórico
      await query(`
        INSERT INTO ticket_history (id, ticket_id, action_type, action_description, performed_by, created_at)
        VALUES ($1, $2, 'reply_added', $3, $4, NOW())
      `, [
        uuidv4(), 
        ticketId, 
        is_internal ? 'Internal reply added' : 'Reply added',
        req.user.id
      ]);

      // Notificar pessoas envolvidas (exceto quem escreveu)
      const notifyUsers = [];
      if (ticket.created_by !== req.user.id) notifyUsers.push(ticket.created_by);
      if (ticket.assigned_to && ticket.assigned_to !== req.user.id) notifyUsers.push(ticket.assigned_to);

      for (const userId of notifyUsers) {
        await query(`
          INSERT INTO notifications (id, user_id, company_id, type, title, message, data, created_at)
          VALUES ($1, $2, $3, 'ticket_reply', $4, $5, $6, NOW())
        `, [
          uuidv4(),
          userId,
          req.user.companyId,
          'Nova Resposta no Ticket',
          `Nova resposta no ticket #${ticket.ticket_number}`,
          JSON.stringify({ 
            ticket_id: ticketId, 
            ticket_number: ticket.ticket_number,
            is_internal: is_internal
          })
        ]);
      }

      await commitTransaction(transaction);

      // Conceder XP/Coins por responder
      const xpReward = 10;
      const coinReward = 3;

      await query(`
        UPDATE user_gamification_profiles 
        SET total_xp = total_xp + $1, current_coins = current_coins + $2
        WHERE user_id = $3 AND company_id = $4
      `, [xpReward, coinReward, req.user.id, req.user.companyId]);

      // Log de auditoria
      auditLogger(tc(req, 'ticketController', 'audit.ticket_reply_added', {
        number: ticket.ticket_number
      }), {
        userId: req.user.id,
        ticketId: ticketId,
        ticketNumber: ticket.ticket_number,
        replyId: replyId,
        isInternal: is_internal,
        companyId: req.user.companyId,
        ip: req.ip
      });

      res.status(201).json({
        success: true,
        message: tc(req, 'ticketController', 'addReply.success'),
        data: newReply,
        status_updated: statusUpdate,
        gamification: {
          xp: xpReward,
          coins: coinReward,
          action: 'ticket_reply'
        }
      });

    } catch (error) {
      await rollbackTransaction(transaction);
      throw error;
    }
  });

  /**
   * 🔝 ESCALAR TICKET
   * PUT /api/tickets/:id/escalate
   */
  static escalateTicket = asyncHandler(async (req, res) => {
    const ticketId = req.params.id;
    const { reason, escalate_to } = req.body;

    if (!reason || reason.trim().length === 0) {
      throw new ApiError(400, tc(req, 'ticketController', 'validation.escalation_reason_required'));
    }

    const transaction = await beginTransaction();

    try {
      // Verificar se ticket existe
      const ticketResult = await query(
        'SELECT * FROM tickets WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL',
        [ticketId, req.user.companyId]
      );

      if (ticketResult.rows.length === 0) {
        throw new ApiError(404, tc(req, 'ticketController', 'validation.not_found'));
      }

      const ticket = ticketResult.rows[0];

      // Verificar se pode escalar
      if (['resolved', 'closed'].includes(ticket.status)) {
        throw new ApiError(400, tc(req, 'ticketController', 'validation.cannot_escalate_closed'));
      }

      // Definir nova prioridade baseada na atual
      const priorityEscalation = {
        'low': 'medium',
        'medium': 'high', 
        'high': 'urgent',
        'urgent': 'urgent' // Já é o máximo
      };

      const newPriority = priorityEscalation[ticket.priority];

      // Atualizar ticket
      const updateQuery = `
        UPDATE tickets 
        SET priority = $1, assigned_to = $2, status = 'open', updated_at = NOW()
        WHERE id = $3
        RETURNING *
      `;

      const updatedTicketResult = await query(updateQuery, [
        newPriority,
        escalate_to || null,
        ticketId
      ]);

      const updatedTicket = updatedTicketResult.rows[0];

      // Registrar escalação no histórico
      await query(`
        INSERT INTO ticket_history (id, ticket_id, action_type, action_description, performed_by, created_at)
        VALUES ($1, $2, 'escalated', $3, $4, NOW())
      `, [
        uuidv4(),
        ticketId,
        `Ticket escalated: ${reason}. Priority changed to ${newPriority}`,
        req.user.id
      ]);

      // Adicionar comentário automático
      await query(`
        INSERT INTO ticket_replies (id, ticket_id, user_id, message, is_internal, created_at)
        VALUES ($1, $2, $3, $4, true, NOW())
      `, [
        uuidv4(),
        ticketId,
        req.user.id,
        `🔺 TICKET ESCALADO\nMotivo: ${reason}\nPrioridade alterada para: ${newPriority.toUpperCase()}`
      ]);

      // Notificar novo responsável (se designado)
      if (escalate_to) {
        await query(`
          INSERT INTO notifications (id, user_id, company_id, type, title, message, data, created_at)
          VALUES ($1, $2, $3, 'ticket_escalated', $4, $5, $6, NOW())
        `, [
          uuidv4(),
          escalate_to,
          req.user.companyId,
          'Ticket Escalado',
          `Ticket #${ticket.ticket_number} foi escalado para você`,
          JSON.stringify({ 
            ticket_id: ticketId, 
            ticket_number: ticket.ticket_number,
            reason: reason,
            old_priority: ticket.priority,
            new_priority: newPriority
          })
        ]);
      }

      await commitTransaction(transaction);

      // Log de auditoria
      auditLogger(tc(req, 'ticketController', 'audit.ticket_escalated', {
        number: ticket.ticket_number,
        priority: newPriority
      }), {
        userId: req.user.id,
        ticketId: ticketId,
        ticketNumber: ticket.ticket_number,
        reason: reason,
        oldPriority: ticket.priority,
        newPriority: newPriority,
        escalatedTo: escalate_to,
        companyId: req.user.companyId,
        ip: req.ip
      });

      res.json({
        success: true,
        message: tc(req, 'ticketController', 'escalateTicket.success'),
        data: {
          ...sanitizeTicketOutput(updatedTicket),
          escalation_reason: reason,
          old_priority: ticket.priority,
          new_priority: newPriority
        }
      });

    } catch (error) {
      await rollbackTransaction(transaction);
      throw error;
    }
  });

  /**
   * 🔄 ALTERAR STATUS
   * PUT /api/tickets/:id/status
   */
  static changeStatus = asyncHandler(async (req, res) => {
    const ticketId = req.params.id;
    const { status, reason } = req.body;

    const validStatuses = ['open', 'in_progress', 'pending', 'resolved', 'closed'];
    
    if (!status || !validStatuses.includes(status)) {
      throw new ApiError(400, tc(req, 'ticketController', 'validation.invalid_status'));
    }

    const transaction = await beginTransaction();

    try {
      // Verificar se ticket existe
      const ticketResult = await query(
        'SELECT * FROM tickets WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL',
        [ticketId, req.user.companyId]
      );

      if (ticketResult.rows.length === 0) {
        throw new ApiError(404, tc(req, 'ticketController', 'validation.not_found'));
      }

      const ticket = ticketResult.rows[0];

      // Verificar se mudança é válida
      if (ticket.status === status) {
        throw new ApiError(400, tc(req, 'ticketController', 'validation.already_in_status'));
      }

      // Atualizar ticket
      let updateQuery = `
        UPDATE tickets 
        SET status = $1, updated_at = NOW()
      `;
      let updateParams = [status];
      let paramCount = 1;

      // Se está resolvendo/fechando, definir resolved_at
      if (['resolved', 'closed'].includes(status) && !['resolved', 'closed'].includes(ticket.status)) {
        updateQuery += `, resolved_at = NOW()`;
      }

      updateQuery += ` WHERE id = $${++paramCount} RETURNING *`;
      updateParams.push(ticketId);

      const updatedTicketResult = await query(updateQuery, updateParams);
      const updatedTicket = updatedTicketResult.rows[0];

      // Registrar no histórico
      await query(`
        INSERT INTO ticket_history (id, ticket_id, action_type, action_description, performed_by, created_at)
        VALUES ($1, $2, 'status_changed', $3, $4, NOW())
      `, [
        uuidv4(),
        ticketId,
        `Status changed from ${ticket.status} to ${status}${reason ? '. Reason: ' + reason : ''}`,
        req.user.id
      ]);

      // Adicionar comentário se há motivo
      if (reason && reason.trim().length > 0) {
        await query(`
          INSERT INTO ticket_replies (id, ticket_id, user_id, message, is_internal, created_at)
          VALUES ($1, $2, $3, $4, true, NOW())
        `, [
          uuidv4(),
          ticketId,
          req.user.id,
          `📋 Status alterado para: ${status.toUpperCase()}\nMotivo: ${reason.trim()}`
        ]);
      }

      await commitTransaction(transaction);

      // Conceder XP/Coins se resolveu
      let gamificationReward = null;
      if (['resolved', 'closed'].includes(status) && !['resolved', 'closed'].includes(ticket.status)) {
        const xpReward = ticket.priority === 'urgent' ? 50 : 
                        ticket.priority === 'high' ? 35 : 25;
        const coinReward = Math.floor(xpReward / 2);

        await query(`
          UPDATE user_gamification_profiles 
          SET total_xp = total_xp + $1, current_coins = current_coins + $2
          WHERE user_id = $3 AND company_id = $4
        `, [xpReward, coinReward, req.user.id, req.user.companyId]);

        gamificationReward = { xp: xpReward, coins: coinReward, action: 'ticket_resolved' };
      }

      res.json({
        success: true,
        message: tc(req, 'ticketController', 'changeStatus.success', { status }),
        data: sanitizeTicketOutput(updatedTicket),
        gamification: gamificationReward
      });

    } catch (error) {
      await rollbackTransaction(transaction);
      throw error;
    }
  });

  /**
   * 👤 DESIGNAR TICKET
   * PUT /api/tickets/:id/assign
   */
  static assignTicket = asyncHandler(async (req, res) => {
    const ticketId = req.params.id;
    const { assigned_to, reason } = req.body;

    const transaction = await beginTransaction();

    try {
      // Verificar se ticket existe
      const ticketResult = await query(
        'SELECT * FROM tickets WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL',
        [ticketId, req.user.companyId]
      );

      if (ticketResult.rows.length === 0) {
        throw new ApiError(404, tc(req, 'ticketController', 'validation.not_found'));
      }

      const ticket = ticketResult.rows[0];

      // Verificar se usuário designado existe (se fornecido)
      if (assigned_to) {
        const assigneeCheck = await query(
          'SELECT id, full_name FROM users WHERE id = $1 AND company_id = $2 AND active = true',
          [assigned_to, req.user.companyId]
        );

        if (assigneeCheck.rows.length === 0) {
          throw new ApiError(404, tc(req, 'ticketController', 'validation.user_not_found'));
        }
      }

      // Atualizar ticket
      await query(
        'UPDATE tickets SET assigned_to = $1, updated_at = NOW() WHERE id = $2',
        [assigned_to || null, ticketId]
      );

      // Registrar no histórico
      const description = assigned_to 
        ? `Ticket assigned to user ${assigned_to}${reason ? '. Reason: ' + reason : ''}`
        : `Ticket unassigned${reason ? '. Reason: ' + reason : ''}`;

      await query(`
        INSERT INTO ticket_history (id, ticket_id, action_type, action_description, performed_by, created_at)
        VALUES ($1, $2, 'assigned', $3, $4, NOW())
      `, [uuidv4(), ticketId, description, req.user.id]);

      // Notificar novo designado
      if (assigned_to) {
        await query(`
          INSERT INTO notifications (id, user_id, company_id, type, title, message, data, created_at)
          VALUES ($1, $2, $3, 'ticket_assigned', $4, $5, $6, NOW())
        `, [
          uuidv4(),
          assigned_to,
          req.user.companyId,
          'Ticket Designado',
          `Ticket #${ticket.ticket_number} foi designado para você`,
          JSON.stringify({ ticket_id: ticketId, ticket_number: ticket.ticket_number })
        ]);
      }

      await commitTransaction(transaction);

      res.json({
        success: true,
        message: assigned_to 
          ? tc(req, 'ticketController', 'assignTicket.success') 
          : tc(req, 'ticketController', 'assignTicket.removed'),
        data: {
          ticket_id: ticketId,
          assigned_to: assigned_to,
          reason: reason
        }
      });

    } catch (error) {
      await rollbackTransaction(transaction);
      throw error;
    }
  });

  /**
   * 📊 RELATÓRIOS DE TICKETS
   * GET /api/tickets/reports
   */
  static getReports = asyncHandler(async (req, res) => {
    const { report_type = 'overview', period = 'month' } = req.query;

    let dateFilter = '';
    switch (period) {
      case 'week':
        dateFilter = "AND t.created_at >= DATE_TRUNC('week', CURRENT_DATE)";
        break;
      case 'month':
        dateFilter = "AND t.created_at >= DATE_TRUNC('month', CURRENT_DATE)";
        break;
      case 'quarter':
        dateFilter = "AND t.created_at >= DATE_TRUNC('quarter', CURRENT_DATE)";
        break;
      case 'year':
        dateFilter = "AND t.created_at >= DATE_TRUNC('year', CURRENT_DATE)";
        break;
    }

    if (report_type === 'overview') {
      // Relatório geral de tickets
      const overviewQuery = `
        SELECT 
          COUNT(*) as total_tickets,
          COUNT(CASE WHEN status = 'open' THEN 1 END) as open_tickets,
          COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress_tickets,
          COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_tickets,
          COUNT(CASE WHEN status = 'resolved' THEN 1 END) as resolved_tickets,
          COUNT(CASE WHEN status = 'closed' THEN 1 END) as closed_tickets,
          
          COUNT(CASE WHEN priority = 'urgent' THEN 1 END) as urgent_tickets,
          COUNT(CASE WHEN priority = 'high' THEN 1 END) as high_tickets,
          COUNT(CASE WHEN priority = 'medium' THEN 1 END) as medium_tickets,
          COUNT(CASE WHEN priority = 'low' THEN 1 END) as low_tickets,
          
          ROUND(AVG(CASE 
            WHEN status IN ('resolved', 'closed') AND resolved_at IS NOT NULL 
            THEN EXTRACT(EPOCH FROM (resolved_at - created_at))/3600 
          END), 2) as avg_resolution_hours,
          
          COUNT(CASE 
            WHEN status IN ('resolved', 'closed') AND resolved_at IS NOT NULL 
            AND resolved_at <= created_at + INTERVAL '24 hours'
            THEN 1 
          END) as resolved_within_24h
          
        FROM tickets t
        WHERE t.company_id = $1 AND t.deleted_at IS NULL ${dateFilter}
      `;

      const overviewResult = await query(overviewQuery, [req.user.companyId]);

      // Tickets por departamento
      const departmentQuery = `
        SELECT 
          COALESCE(department, 'Não definido') as department,
          COUNT(*) as ticket_count,
          COUNT(CASE WHEN status IN ('resolved', 'closed') THEN 1 END) as resolved_count
        FROM tickets t
        WHERE t.company_id = $1 AND t.deleted_at IS NULL ${dateFilter}
        GROUP BY COALESCE(department, 'Não definido')
        ORDER BY ticket_count DESC
      `;

      const departmentResult = await query(departmentQuery, [req.user.companyId]);

      res.json({
        success: true,
        data: {
          report_type: 'overview',
          period,
          overview: overviewResult.rows[0],
          by_department: departmentResult.rows
        }
      });

    } else if (report_type === 'performance') {
      // Relatório de performance por usuário
      const performanceQuery = `
        SELECT 
          u.id, u.full_name,
          COUNT(DISTINCT t.id) as total_assigned,
          COUNT(CASE WHEN t.status IN ('resolved', 'closed') THEN 1 END) as resolved_count,
          ROUND(AVG(CASE 
            WHEN t.status IN ('resolved', 'closed') AND t.resolved_at IS NOT NULL 
            THEN EXTRACT(EPOCH FROM (t.resolved_at - t.created_at))/3600 
          END), 2) as avg_resolution_hours,
          COUNT(CASE WHEN t.priority = 'urgent' AND t.status NOT IN ('resolved', 'closed') THEN 1 END) as urgent_pending
        FROM users u
        LEFT JOIN tickets t ON u.id = t.assigned_to AND t.deleted_at IS NULL ${dateFilter}
        WHERE u.company_id = $1 AND u.active = true
        GROUP BY u.id, u.full_name
        HAVING COUNT(DISTINCT t.id) > 0
        ORDER BY resolved_count DESC, avg_resolution_hours ASC
      `;

      const performanceResult = await query(performanceQuery, [req.user.companyId]);

      res.json({
        success: true,
        data: {
          report_type: 'performance',
          period,
          user_performance: performanceResult.rows
        }
      });

    } else {
      throw new ApiError(400, tc(req, 'ticketController', 'validation.invalid_report_type'));
    }
  });

  /**
   * 🔢 GERAR NÚMERO DO TICKET
   */
  static async generateTicketNumber(companyId) {
    const currentYear = new Date().getFullYear();
    
    // Buscar último número do ano
    const prefix = `TK-${currentYear}`;
    
    const lastTicketQuery = `
      SELECT ticket_number FROM tickets 
      WHERE company_id = $1 
      AND ticket_number LIKE '${prefix}%'
      ORDER BY id DESC 
      LIMIT 1
    `;
    
    const lastTicketResult = await query(lastTicketQuery, [companyId]);
    
    let nextNumber = 1;
    if (lastTicketResult.rows.length > 0) {
      const lastNumber = lastTicketResult.rows[0].ticket_number;
      const lastSequence = parseInt(lastNumber.split('-')[2]);
      nextNumber = lastSequence + 1;
    }
    
    return `${prefix}-${nextNumber.toString().padStart(6, '0')}`;
  }
}

module.exports = TicketController;