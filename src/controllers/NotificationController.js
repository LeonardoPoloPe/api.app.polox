/**
 * ==========================================
 * 🔔 NOTIFICATION CONTROLLER - COPILOT_PROMPT_6
 * ==========================================
 * Sistema completo de notificações
 * ==========================================
 */

const { query, beginTransaction, commitTransaction, rollbackTransaction } = require('../models/database');
const { asyncHandler, ApiError } = require('../utils/errors');
const { logger, auditLogger } = require('../utils/logger');
const { cache } = require('../config/cache');
const { trackUser } = require('../config/monitoring');
const { 
  validateNotificationData, 
  sanitizeNotificationOutput,
  formatPaginatedResponse 
} = require('../utils/validation');
const { v4: uuidv4 } = require('uuid');

class NotificationController {

  /**
   * 📋 LISTAR NOTIFICAÇÕES
   * GET /api/notifications
   */
  static index = asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = (page - 1) * limit;
    
    let whereClause = 'WHERE n.user_id = $1 AND n.deleted_at IS NULL';
    let queryParams = [req.user.id];
    let paramCount = 1;

    // Filtros
    if (req.query.type) {
      whereClause += ` AND n.notification_type = $${++paramCount}`;
      queryParams.push(req.query.type);
    }

    if (req.query.read_status) {
      if (req.query.read_status === 'read') {
        whereClause += ` AND n.read_at IS NOT NULL`;
      } else if (req.query.read_status === 'unread') {
        whereClause += ` AND n.read_at IS NULL`;
      }
    }

    if (req.query.priority) {
      whereClause += ` AND n.priority = $${++paramCount}`;
      queryParams.push(req.query.priority);
    }

    if (req.query.search) {
      whereClause += ` AND (n.title ILIKE $${++paramCount} OR n.message ILIKE $${++paramCount})`;
      const searchTerm = `%${req.query.search}%`;
      queryParams.push(searchTerm, searchTerm);
      paramCount++;
    }

    // Query principal
    const notificationsQuery = `
      SELECT 
        n.id,
        n.notification_type,
        n.title,
        n.message,
        n.data,
        n.priority,
        n.read_at,
        n.action_url,
        n.expires_at,
        n.created_at,
        CASE 
          WHEN n.expires_at IS NOT NULL AND n.expires_at < NOW() THEN true
          ELSE false
        END as is_expired,
        CASE 
          WHEN n.read_at IS NULL THEN true
          ELSE false
        END as is_unread
      FROM notifications n
      ${whereClause}
      ORDER BY 
        CASE WHEN n.read_at IS NULL THEN 0 ELSE 1 END,
        CASE 
          WHEN n.priority = 'urgent' THEN 1
          WHEN n.priority = 'high' THEN 2
          WHEN n.priority = 'medium' THEN 3
          WHEN n.priority = 'low' THEN 4
          ELSE 5
        END,
        n.created_at DESC
      LIMIT $${++paramCount} OFFSET $${++paramCount}
    `;
    
    queryParams.push(limit, offset);

    // Query de contagem
    const countQuery = `SELECT COUNT(*) as total FROM notifications n ${whereClause}`;

    // Query de estatísticas
    const statsQuery = `
      SELECT 
        COUNT(*) as total_notifications,
        COUNT(CASE WHEN read_at IS NULL THEN 1 END) as unread_count,
        COUNT(CASE WHEN read_at IS NOT NULL THEN 1 END) as read_count,
        COUNT(CASE WHEN priority = 'urgent' AND read_at IS NULL THEN 1 END) as urgent_unread,
        COUNT(CASE WHEN priority = 'high' AND read_at IS NULL THEN 1 END) as high_unread,
        COUNT(CASE WHEN expires_at IS NOT NULL AND expires_at < NOW() THEN 1 END) as expired_count
      FROM notifications n
      WHERE n.user_id = $1 AND n.deleted_at IS NULL
    `;

    const [notificationsResult, countResult, statsResult] = await Promise.all([
      query(notificationsQuery, queryParams),
      query(countQuery, queryParams.slice(0, -2)),
      query(statsQuery, [req.user.id])
    ]);

    // Processar dados das notificações
    const notifications = notificationsResult.rows.map(notification => ({
      ...sanitizeNotificationOutput(notification),
      is_expired: notification.is_expired,
      is_unread: notification.is_unread,
      data: notification.data ? JSON.parse(notification.data) : null
    }));

    res.json({
      success: true,
      data: notifications,
      pagination: {
        page,
        limit,
        total: parseInt(countResult.rows[0].total),
        pages: Math.ceil(countResult.rows[0].total / limit)
      },
      stats: {
        ...statsResult.rows[0],
        total_notifications: parseInt(statsResult.rows[0].total_notifications),
        unread_count: parseInt(statsResult.rows[0].unread_count),
        read_count: parseInt(statsResult.rows[0].read_count),
        urgent_unread: parseInt(statsResult.rows[0].urgent_unread),
        high_unread: parseInt(statsResult.rows[0].high_unread),
        expired_count: parseInt(statsResult.rows[0].expired_count)
      }
    });
  });

  /**
   * ➕ CRIAR NOTIFICAÇÃO
   * POST /api/notifications
   */
  static create = asyncHandler(async (req, res) => {
    const notificationData = req.body;

    // Validar dados
    const validation = validateNotificationData(notificationData);
    if (!validation.isValid) {
      throw new ApiError(400, 'Dados inválidos', validation.errors);
    }

    const transaction = await beginTransaction();

    try {
      // Determinar destinatários
      let recipients = [];

      if (notificationData.user_ids && Array.isArray(notificationData.user_ids)) {
        // Notificação para usuários específicos
        recipients = notificationData.user_ids;
      } else if (notificationData.send_to_all) {
        // Notificação para todos os usuários da empresa
        const allUsersResult = await query(
          'SELECT id FROM users WHERE company_id = $1 AND active = true',
          [req.user.companyId]
        );
        recipients = allUsersResult.rows.map(row => row.id);
      } else if (notificationData.send_to_role) {
        // Notificação para usuários de um papel específico
        const roleUsersResult = await query(
          'SELECT id FROM users WHERE company_id = $1 AND role = $2 AND active = true',
          [req.user.companyId, notificationData.send_to_role]
        );
        recipients = roleUsersResult.rows.map(row => row.id);
      } else {
        // Notificação apenas para o usuário atual (auto-notificação)
        recipients = [req.user.id];
      }

      if (recipients.length === 0) {
        throw new ApiError(400, 'Nenhum destinatário válido encontrado');
      }

      const createdNotifications = [];

      // Criar notificação para cada destinatário
      for (const userId of recipients) {
        const notificationId = uuidv4();
        
        const createNotificationQuery = `
          INSERT INTO notifications (
            id, user_id, company_id, notification_type, title, message, data, 
            priority, action_url, expires_at, created_by, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
          RETURNING *
        `;

        const newNotificationResult = await query(createNotificationQuery, [
          notificationId,
          userId,
          req.user.companyId,
          notificationData.type || 'info',
          notificationData.title,
          notificationData.message,
          JSON.stringify(notificationData.data || {}),
          notificationData.priority || 'medium',
          notificationData.action_url || null,
          notificationData.expires_at || null,
          req.user.id
        ]);

        createdNotifications.push(newNotificationResult.rows[0]);
      }

      await commitTransaction(transaction);

      // Limpar cache de notificações dos usuários afetados
      for (const userId of recipients) {
        await cache.del(`notifications:${userId}`, `notification_stats:${userId}`);
      }

      // Conceder XP/Coins por criar notificação (apenas para admin/supervisor)
      if (['admin', 'supervisor'].includes(req.user.role)) {
        const xpReward = 5;
        const coinReward = 2;

        await query(`
          UPDATE user_gamification_profiles 
          SET total_xp = total_xp + $1, current_coins = current_coins + $2
          WHERE user_id = $3 AND company_id = $4
        `, [xpReward, coinReward, req.user.id, req.user.companyId]);

        // Registrar no histórico de gamificação
        await query(`
          INSERT INTO gamification_history (id, user_id, company_id, event_type, amount, reason, action_type, reference_id)
          VALUES 
            ($1, $2, $3, 'xp', $4, 'Notification created', 'notification_created', $5),
            ($6, $2, $3, 'coins', $7, 'Notification created', 'notification_created', $5)
        `, [uuidv4(), req.user.id, req.user.companyId, xpReward, createdNotifications[0].id, uuidv4(), coinReward]);
      }

      // Log de auditoria
      auditLogger('Notifications created', {
        userId: req.user.id,
        notificationType: notificationData.type,
        title: notificationData.title,
        recipientCount: recipients.length,
        priority: notificationData.priority,
        companyId: req.user.companyId,
        ip: req.ip
      });

      // Métricas
      trackUser.operation(req.user.companyId, 'notification_created', 'success');

      res.status(201).json({
        success: true,
        message: `${createdNotifications.length} notificação(ões) criada(s) com sucesso`,
        data: {
          notifications_created: createdNotifications.length,
          recipients: recipients,
          sample_notification: sanitizeNotificationOutput(createdNotifications[0])
        },
        gamification: ['admin', 'supervisor'].includes(req.user.role) ? {
          xp: 5,
          coins: 2,
          action: 'notification_created'
        } : null
      });

    } catch (error) {
      await rollbackTransaction(transaction);
      trackUser.operation(req.user.companyId, 'notification_created', 'failure');
      throw error;
    }
  });

  /**
   * ✅ MARCAR COMO LIDA
   * PUT /api/notifications/:id/read
   */
  static markAsRead = asyncHandler(async (req, res) => {
    const notificationId = req.params.id;

    const transaction = await beginTransaction();

    try {
      // Verificar se notificação existe e pertence ao usuário
      const notificationResult = await query(
        'SELECT id, title, read_at FROM notifications WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL',
        [notificationId, req.user.id]
      );

      if (notificationResult.rows.length === 0) {
        throw new ApiError(404, 'Notificação não encontrada');
      }

      const notification = notificationResult.rows[0];

      // Verificar se já está lida
      if (notification.read_at) {
        return res.json({
          success: true,
          message: 'Notificação já estava marcada como lida',
          data: { notification_id: notificationId, already_read: true }
        });
      }

      // Marcar como lida
      await query(
        'UPDATE notifications SET read_at = NOW() WHERE id = $1',
        [notificationId]
      );

      await commitTransaction(transaction);

      // Limpar cache
      await cache.del(`notifications:${req.user.id}`, `notification_stats:${req.user.id}`);

      // Conceder XP/Coins por ler notificação importante
      const importantTypes = ['ticket_assigned', 'urgent_alert', 'system_alert'];
      if (importantTypes.includes(notification.notification_type)) {
        const xpReward = 2;
        const coinReward = 1;

        await query(`
          UPDATE user_gamification_profiles 
          SET total_xp = total_xp + $1, current_coins = current_coins + $2
          WHERE user_id = $3 AND company_id = $4
        `, [xpReward, coinReward, req.user.id, req.user.companyId]);
      }

      // Log de auditoria
      auditLogger('Notification marked as read', {
        userId: req.user.id,
        notificationId: notificationId,
        notificationTitle: notification.title,
        companyId: req.user.companyId,
        ip: req.ip
      });

      res.json({
        success: true,
        message: 'Notificação marcada como lida',
        data: { notification_id: notificationId, read_at: new Date().toISOString() }
      });

    } catch (error) {
      await rollbackTransaction(transaction);
      throw error;
    }
  });

  /**
   * ✅ MARCAR TODAS COMO LIDAS
   * PUT /api/notifications/read-all
   */
  static markAllAsRead = asyncHandler(async (req, res) => {
    const { type, priority } = req.body; // Filtros opcionais

    const transaction = await beginTransaction();

    try {
      let whereClause = 'WHERE user_id = $1 AND read_at IS NULL AND deleted_at IS NULL';
      let queryParams = [req.user.id];
      let paramCount = 1;

      // Aplicar filtros se fornecidos
      if (type) {
        whereClause += ` AND type = $${++paramCount}`;
        queryParams.push(type);
      }

      if (priority) {
        whereClause += ` AND priority = $${++paramCount}`;
        queryParams.push(priority);
      }

      // Contar quantas serão marcadas
      const countQuery = `SELECT COUNT(*) as count FROM notifications ${whereClause}`;
      const countResult = await query(countQuery, queryParams);
      const totalToMark = parseInt(countResult.rows[0].count);

      if (totalToMark === 0) {
        return res.json({
          success: true,
          message: 'Nenhuma notificação não lida encontrada com os critérios especificados',
          data: { notifications_marked: 0 }
        });
      }

      // Marcar todas como lidas
      const updateQuery = `
        UPDATE notifications 
        SET read_at = NOW() 
        ${whereClause}
        RETURNING id, type
      `;

      const updatedResult = await query(updateQuery, queryParams);

      await commitTransaction(transaction);

      // Limpar cache
      await cache.del(`notifications:${req.user.id}`, `notification_stats:${req.user.id}`);

      // Conceder XP/Coins por marcar muitas notificações (bulk action)
      if (totalToMark >= 10) {
        const xpReward = Math.min(totalToMark, 50); // Max 50 XP
        const coinReward = Math.min(Math.floor(totalToMark / 2), 25); // Max 25 coins

        await query(`
          UPDATE user_gamification_profiles 
          SET total_xp = total_xp + $1, current_coins = current_coins + $2
          WHERE user_id = $3 AND company_id = $4
        `, [xpReward, coinReward, req.user.id, req.user.companyId]);

        // Registrar no histórico
        await query(`
          INSERT INTO gamification_history (id, user_id, company_id, event_type, amount, reason, action_type, reference_id)
          VALUES 
            ($1, $2, $3, 'xp', $4, 'Bulk notifications read', 'notifications_bulk_read', $5),
            ($6, $2, $3, 'coins', $7, 'Bulk notifications read', 'notifications_bulk_read', $5)
        `, [uuidv4(), req.user.id, req.user.companyId, xpReward, null, uuidv4(), coinReward]);
      }

      // Log de auditoria
      auditLogger('Bulk notifications marked as read', {
        userId: req.user.id,
        notificationsMarked: totalToMark,
        filters: { type, priority },
        companyId: req.user.companyId,
        ip: req.ip
      });

      res.json({
        success: true,
        message: `${totalToMark} notificação(ões) marcada(s) como lida(s)`,
        data: { 
          notifications_marked: totalToMark,
          marked_notifications: updatedResult.rows
        },
        gamification: totalToMark >= 10 ? {
          xp: Math.min(totalToMark, 50),
          coins: Math.min(Math.floor(totalToMark / 2), 25),
          action: 'notifications_bulk_read'
        } : null
      });

    } catch (error) {
      await rollbackTransaction(transaction);
      throw error;
    }
  });

  /**
   * 🗑️ DELETAR NOTIFICAÇÃO
   * DELETE /api/notifications/:id
   */
  static deleteNotification = asyncHandler(async (req, res) => {
    const notificationId = req.params.id;

    const transaction = await beginTransaction();

    try {
      // Verificar se notificação existe e pertence ao usuário
      const notificationResult = await query(
        'SELECT id, title, type FROM notifications WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL',
        [notificationId, req.user.id]
      );

      if (notificationResult.rows.length === 0) {
        throw new ApiError(404, 'Notificação não encontrada');
      }

      const notification = notificationResult.rows[0];

      // Verificar se é deletável (algumas notificações do sistema podem ser protegidas)
      const protectedTypes = ['system_critical', 'security_alert'];
      if (protectedTypes.includes(notification.notification_type) && req.user.role !== 'admin') {
        throw new ApiError(403, 'Esta notificação não pode ser removida');
      }

      // Soft delete da notificação
      await query(
        'UPDATE notifications SET deleted_at = NOW() WHERE id = $1',
        [notificationId]
      );

      await commitTransaction(transaction);

      // Limpar cache
      await cache.del(`notifications:${req.user.id}`, `notification_stats:${req.user.id}`);

      // Log de auditoria
      auditLogger('Notification deleted', {
        userId: req.user.id,
        notificationId: notificationId,
        notificationTitle: notification.title,
        notificationType: notification.notification_type,
        companyId: req.user.companyId,
        ip: req.ip
      });

      res.json({
        success: true,
        message: 'Notificação removida com sucesso',
        data: { notification_id: notificationId }
      });

    } catch (error) {
      await rollbackTransaction(transaction);
      throw error;
    }
  });

  /**
   * 🔔 OBTER CONTADORES DE NOTIFICAÇÃO
   * GET /api/notifications/counters
   */
  static getCounters = asyncHandler(async (req, res) => {
    // Verificar cache primeiro
    const cacheKey = `notification_counters:${req.user.id}`;
    const cachedCounters = await cache.get(cacheKey);
    
    if (cachedCounters) {
      return res.json({
        success: true,
        data: cachedCounters,
        cached: true
      });
    }

    const countersQuery = `
      SELECT 
        COUNT(*) as total_notifications,
        COUNT(CASE WHEN read_at IS NULL THEN 1 END) as unread_count,
        COUNT(CASE WHEN priority = 'urgent' AND read_at IS NULL THEN 1 END) as urgent_unread,
        COUNT(CASE WHEN priority = 'high' AND read_at IS NULL THEN 1 END) as high_unread,
        COUNT(CASE WHEN type = 'ticket_assigned' AND read_at IS NULL THEN 1 END) as ticket_assignments,
        COUNT(CASE WHEN type = 'sale_created' AND read_at IS NULL THEN 1 END) as new_sales,
        COUNT(CASE WHEN type = 'customer_created' AND read_at IS NULL THEN 1 END) as new_customers,
        COUNT(CASE WHEN type = 'system_alert' AND read_at IS NULL THEN 1 END) as system_alerts,
        COUNT(CASE WHEN expires_at IS NOT NULL AND expires_at < NOW() THEN 1 END) as expired_count,
        COUNT(CASE WHEN created_at >= NOW() - INTERVAL '24 hours' THEN 1 END) as recent_count
      FROM notifications
      WHERE user_id = $1 AND deleted_at IS NULL
    `;

    const countersResult = await query(countersQuery, [req.user.id]);
    const counters = {
      ...countersResult.rows[0],
      total_notifications: parseInt(countersResult.rows[0].total_notifications),
      unread_count: parseInt(countersResult.rows[0].unread_count),
      urgent_unread: parseInt(countersResult.rows[0].urgent_unread),
      high_unread: parseInt(countersResult.rows[0].high_unread),
      ticket_assignments: parseInt(countersResult.rows[0].ticket_assignments),
      new_sales: parseInt(countersResult.rows[0].new_sales),
      new_customers: parseInt(countersResult.rows[0].new_customers),
      system_alerts: parseInt(countersResult.rows[0].system_alerts),
      expired_count: parseInt(countersResult.rows[0].expired_count),
      recent_count: parseInt(countersResult.rows[0].recent_count)
    };

    // Cache por 2 minutos
    await cache.set(cacheKey, counters, 120);

    res.json({
      success: true,
      data: counters,
      cached: false
    });
  });

  /**
   * 🔄 LIMPAR NOTIFICAÇÕES EXPIRADAS
   * DELETE /api/notifications/cleanup-expired
   */
  static cleanupExpired = asyncHandler(async (req, res) => {
    // Apenas admins podem fazer limpeza
    if (req.user.role !== 'admin') {
      throw new ApiError(403, 'Apenas administradores podem limpar notificações expiradas');
    }

    const transaction = await beginTransaction();

    try {
      // Contar notificações expiradas
      const expiredCountQuery = `
        SELECT COUNT(*) as count 
        FROM notifications 
        WHERE company_id = $1 AND expires_at IS NOT NULL AND expires_at < NOW() AND deleted_at IS NULL
      `;

      const expiredCountResult = await query(expiredCountQuery, [req.user.companyId]);
      const expiredCount = parseInt(expiredCountResult.rows[0].count);

      if (expiredCount === 0) {
        return res.json({
          success: true,
          message: 'Nenhuma notificação expirada encontrada',
          data: { cleaned_notifications: 0 }
        });
      }

      // Remover notificações expiradas (soft delete)
      await query(`
        UPDATE notifications 
        SET deleted_at = NOW() 
        WHERE company_id = $1 AND expires_at IS NOT NULL AND expires_at < NOW() AND deleted_at IS NULL
      `, [req.user.companyId]);

      await commitTransaction(transaction);

      // Limpar cache de todos os usuários da empresa (pode ser custoso, mas necessário)
      const allUsersResult = await query('SELECT id FROM users WHERE company_id = $1', [req.user.companyId]);
      for (const user of allUsersResult.rows) {
        await cache.del(`notifications:${user.id}`, `notification_stats:${user.id}`, `notification_counters:${user.id}`);
      }

      // Log de auditoria
      auditLogger('Expired notifications cleanup', {
        userId: req.user.id,
        cleanedCount: expiredCount,
        companyId: req.user.companyId,
        ip: req.ip
      });

      res.json({
        success: true,
        message: `${expiredCount} notificação(ões) expirada(s) removida(s)`,
        data: { cleaned_notifications: expiredCount }
      });

    } catch (error) {
      await rollbackTransaction(transaction);
      throw error;
    }
  });

  /**
   * 📊 ESTATÍSTICAS DE NOTIFICAÇÕES
   * GET /api/notifications/stats
   */
  static getStats = asyncHandler(async (req, res) => {
    const { period = 'month' } = req.query;

    let dateFilter = '';
    switch (period) {
      case 'week':
        dateFilter = "AND created_at >= DATE_TRUNC('week', CURRENT_DATE)";
        break;
      case 'month':
        dateFilter = "AND created_at >= DATE_TRUNC('month', CURRENT_DATE)";
        break;
      case 'quarter':
        dateFilter = "AND created_at >= DATE_TRUNC('quarter', CURRENT_DATE)";
        break;
      case 'year':
        dateFilter = "AND created_at >= DATE_TRUNC('year', CURRENT_DATE)";
        break;
    }

    // Estatísticas por tipo
    const typeStatsQuery = `
      SELECT 
        type,
        COUNT(*) as total_count,
        COUNT(CASE WHEN read_at IS NOT NULL THEN 1 END) as read_count,
        COUNT(CASE WHEN read_at IS NULL THEN 1 END) as unread_count,
        ROUND(
          (COUNT(CASE WHEN read_at IS NOT NULL THEN 1 END)::decimal / COUNT(*)) * 100, 2
        ) as read_percentage
      FROM notifications
      WHERE user_id = $1 AND deleted_at IS NULL ${dateFilter}
      GROUP BY type
      ORDER BY total_count DESC
    `;

    // Estatísticas por prioridade
    const priorityStatsQuery = `
      SELECT 
        priority,
        COUNT(*) as total_count,
        COUNT(CASE WHEN read_at IS NOT NULL THEN 1 END) as read_count,
        COUNT(CASE WHEN read_at IS NULL THEN 1 END) as unread_count
      FROM notifications
      WHERE user_id = $1 AND deleted_at IS NULL ${dateFilter}
      GROUP BY priority
      ORDER BY 
        CASE 
          WHEN priority = 'urgent' THEN 1
          WHEN priority = 'high' THEN 2
          WHEN priority = 'medium' THEN 3
          WHEN priority = 'low' THEN 4
          ELSE 5
        END
    `;

    // Notificações por dia (últimos 30 dias)
    const dailyStatsQuery = `
      SELECT 
        DATE(created_at) as notification_date,
        COUNT(*) as daily_count,
        COUNT(CASE WHEN read_at IS NOT NULL THEN 1 END) as daily_read
      FROM notifications
      WHERE user_id = $1 AND deleted_at IS NULL 
      AND created_at >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY DATE(created_at)
      ORDER BY notification_date ASC
    `;

    // Tempo médio de leitura
    const readTimeStatsQuery = `
      SELECT 
        AVG(EXTRACT(EPOCH FROM (read_at - created_at))/60) as avg_read_time_minutes,
        MIN(EXTRACT(EPOCH FROM (read_at - created_at))/60) as min_read_time_minutes,
        MAX(EXTRACT(EPOCH FROM (read_at - created_at))/60) as max_read_time_minutes
      FROM notifications
      WHERE user_id = $1 AND read_at IS NOT NULL AND deleted_at IS NULL ${dateFilter}
    `;

    try {
      const [
        typeStatsResult,
        priorityStatsResult,
        dailyStatsResult,
        readTimeStatsResult
      ] = await Promise.all([
        query(typeStatsQuery, [req.user.id]),
        query(priorityStatsQuery, [req.user.id]),
        query(dailyStatsQuery, [req.user.id]),
        query(readTimeStatsQuery, [req.user.id])
      ]);

      const stats = {
        period: period,
        by_type: typeStatsResult.rows.map(row => ({
          type: row.type,
          total_count: parseInt(row.total_count),
          read_count: parseInt(row.read_count),
          unread_count: parseInt(row.unread_count),
          read_percentage: parseFloat(row.read_percentage) || 0
        })),
        by_priority: priorityStatsResult.rows.map(row => ({
          priority: row.priority,
          total_count: parseInt(row.total_count),
          read_count: parseInt(row.read_count),
          unread_count: parseInt(row.unread_count)
        })),
        daily_trend: dailyStatsResult.rows.map(row => ({
          date: row.notification_date,
          total: parseInt(row.daily_count),
          read: parseInt(row.daily_read)
        })),
        read_time_analysis: readTimeStatsResult.rows[0] ? {
          avg_read_time_minutes: parseFloat(readTimeStatsResult.rows[0].avg_read_time_minutes) || 0,
          min_read_time_minutes: parseFloat(readTimeStatsResult.rows[0].min_read_time_minutes) || 0,
          max_read_time_minutes: parseFloat(readTimeStatsResult.rows[0].max_read_time_minutes) || 0
        } : { avg_read_time_minutes: 0, min_read_time_minutes: 0, max_read_time_minutes: 0 }
      };

      res.json({
        success: true,
        data: stats
      });

    } catch (error) {
      logger.error('Notification stats error:', error);
      throw new ApiError(500, 'Erro ao gerar estatísticas de notificações');
    }
  });
}

module.exports = NotificationController;