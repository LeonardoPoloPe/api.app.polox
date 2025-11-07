/**
 * ============================================================================
 * POLO X - Proprietary System / Sistema Proprietário
 * ============================================================================
 * 
 * Copyright (c) 2025 Polo X Manutencao de Equipamentos de Informatica LTDA
 * CNPJ: 55.419.946/0001-89
 * 
 * Legal Name / Razão Social: Polo X Manutencao de Equipamentos de Informatica LTDA
 * Trade Name / Nome Fantasia: Polo X
 * 
 * Developer / Desenvolvedor: Leonardo Polo Pereira
 * 
 * LICENSING STATUS / STATUS DE LICENCIAMENTO: Restricted Use / Uso Restrito
 * ALL RIGHTS RESERVED / TODOS OS DIREITOS RESERVADOS
 * 
 * This code is proprietary and confidential. It is strictly prohibited to:
 * Este código é proprietário e confidencial. É estritamente proibido:
 * - Copy, modify or distribute without express authorization
 * - Copiar, modificar ou distribuir sem autorização expressa
 * - Use or integrate in any other project
 * - Usar ou integrar em outros projetos
 * - Share with unauthorized third parties
 * - Compartilhar com terceiros não autorizados
 * 
 * Violations will be prosecuted under Brazilian Law:
 * Violações serão processadas conforme Lei Brasileira:
 * - Law 9.609/98 (Software Law / Lei do Software)
 * - Law 9.610/98 (Copyright Law / Lei de Direitos Autorais)
 * - Brazilian Penal Code Art. 184 (Código Penal Brasileiro Art. 184)
 * 
 * INPI Registration: In progress / Em andamento
 * 
 * For licensing / Para licenciamento: contato@polox.com.br
 * ============================================================================
 */

const { query, transaction } = require('../config/database');
const { ApiError, ValidationError, NotFoundError } = require('../utils/errors');
const NotificationTemplateModel = require('./NotificationTemplate');

/**
 * Model para notificações
 * Baseado no schema polox.notifications
 */
class NotificationModel {
  /**
   * Cria uma nova notificação
   * @param {Object} notificationData - Dados da notificação
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object>} Notificação criada
   */
  static async create(notificationData, companyId) {
    const {
      user_id = null,
      template_id = null,
      type,
      title,
      message,
      channel = 'in_app',
      recipient_type = 'user',
      recipient_id = null,
      recipient_email = null,
      recipient_phone = null,
      status = 'pending',
      priority = 'medium',
      category = 'general',
      reference_type = null,
      reference_id = null,
      metadata = null,
      scheduled_for = null,
      expires_at = null,
      retry_count = 0,
      max_retries = 3,
      delivery_attempts = 0,
      variables = null
    } = notificationData;

    // Validar dados obrigatórios
    if (!type) {
      throw new ValidationError('Tipo da notificação é obrigatório');
    }

    if (!title) {
      throw new ValidationError('Título da notificação é obrigatório');
    }

    if (!message) {
      throw new ValidationError('Mensagem da notificação é obrigatória');
    }

    if (!['email', 'sms', 'push', 'webhook', 'in_app'].includes(channel)) {
      throw new ValidationError('Canal deve ser: email, sms, push, webhook ou in_app');
    }

    if (!['low', 'medium', 'high', 'urgent'].includes(priority)) {
      throw new ValidationError('Prioridade deve ser: low, medium, high ou urgent');
    }

    if (!['user', 'client', 'lead', 'external'].includes(recipient_type)) {
      throw new ValidationError('Tipo de destinatário deve ser: user, client, lead ou external');
    }

    return await transaction(async (client) => {
      // Se usar template, processar com variáveis
      let processedTitle = title;
      let processedMessage = message;

      if (template_id && variables) {
        const template = await NotificationTemplateModel.findById(template_id, companyId);
        if (template) {
          const processed = NotificationTemplateModel.processTemplate(template, variables);
          processedTitle = processed.title;
          processedMessage = processed.content;
        }
      }

      // Gerar número único para a notificação
      const numberResult = await client.query(
        'SELECT COALESCE(MAX(CAST(SUBSTRING(number FROM 5) AS INTEGER)), 0) + 1 as next_number FROM polox.notifications WHERE company_id = $1 AND number ~ $2',
        [companyId, '^NOT\\d{6}$']
      );

      const nextNumber = numberResult.rows[0].next_number;
      const notificationNumber = `NOT${nextNumber.toString().padStart(6, '0')}`;

      const insertQuery = `
        INSERT INTO polox.notifications (
          company_id, user_id, template_id, number, type, title, message,
          channel, recipient_type, recipient_id, recipient_email,
          recipient_phone, status, priority, category, reference_type,
          reference_id, metadata, scheduled_for, expires_at, retry_count,
          max_retries, delivery_attempts, variables, created_at, updated_at
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          $8, $9, $10, $11, $12, $13, $14, $15, $16,
          $17, $18, $19, $20, $21, $22, $23, $24, NOW(), NOW()
        )
        RETURNING 
          id, number, type, title, message, channel, status,
          priority, recipient_type, recipient_email, recipient_phone,
          scheduled_for, expires_at, created_at, updated_at
      `;

      const result = await client.query(insertQuery, [
        companyId, user_id, template_id, notificationNumber, type, processedTitle, processedMessage,
        channel, recipient_type, recipient_id, recipient_email,
        recipient_phone, status, priority, category, reference_type,
        reference_id, metadata, scheduled_for, expires_at, retry_count,
        max_retries, delivery_attempts, variables
      ]);

      return result.rows[0];
    }, { companyId });
  }

  /**
   * Busca notificação por ID
   * @param {number} id - ID da notificação
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object|null>} Notificação encontrada ou null
   */
  static async findById(id, companyId) {
    const selectQuery = `
      SELECT 
        n.*,
        nt.name as template_name,
        CASE 
          WHEN n.recipient_type = 'user' THEN u.name
          WHEN n.recipient_type = 'client' THEN c.name
          WHEN n.recipient_type = 'lead' THEN l.name
          ELSE n.recipient_email
        END as recipient_name
      FROM polox.notifications n
      LEFT JOIN polox.notification_templates nt ON n.template_id = nt.id
      LEFT JOIN polox.users u ON n.recipient_type = 'user' AND n.recipient_id = u.id::text
      LEFT JOIN polox.clients c ON n.recipient_type = 'client' AND n.recipient_id = c.id::text
      LEFT JOIN polox.leads l ON n.recipient_type = 'lead' AND n.recipient_id = l.id::text
      WHERE n.id = $1 AND n.company_id = $2
    `;

    try {
      const result = await query(selectQuery, [id, companyId], { companyId });
      return result.rows[0] || null;
    } catch (error) {
      throw new ApiError(500, `Erro ao buscar notificação: ${error.message}`);
    }
  }

  /**
   * Busca notificação por número
   * @param {string} number - Número da notificação
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object|null>} Notificação encontrada ou null
   */
  static async findByNumber(number, companyId) {
    const selectQuery = `
      SELECT * FROM polox.notifications
      WHERE number = $1 AND company_id = $2
    `;

    try {
      const result = await query(selectQuery, [number, companyId], { companyId });
      return result.rows[0] || null;
    } catch (error) {
      throw new ApiError(500, `Erro ao buscar notificação por número: ${error.message}`);
    }
  }

  /**
   * Lista notificações com filtros e paginação
   * @param {Object} options - Opções de busca
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object>} Lista de notificações e metadados
   */
  static async list(options = {}, companyId) {
    const {
      page = 1,
      limit = 10,
      user_id = null,
      type = null,
      channel = null,
      status = null,
      priority = null,
      category = null,
      recipient_type = null,
      search = null,
      date_from = null,
      date_to = null,
      sortBy = 'created_at',
      sortOrder = 'DESC'
    } = options;

    const offset = (page - 1) * limit;
    const conditions = ['company_id = $1'];
    const values = [companyId];
    let paramCount = 2;

    // Adicionar filtros
    if (user_id) {
      conditions.push(`user_id = $${paramCount}`);
      values.push(user_id);
      paramCount++;
    }

    if (type) {
      conditions.push(`type = $${paramCount}`);
      values.push(type);
      paramCount++;
    }

    if (channel) {
      conditions.push(`channel = $${paramCount}`);
      values.push(channel);
      paramCount++;
    }

    if (status) {
      conditions.push(`status = $${paramCount}`);
      values.push(status);
      paramCount++;
    }

    if (priority) {
      conditions.push(`priority = $${paramCount}`);
      values.push(priority);
      paramCount++;
    }

    if (category) {
      conditions.push(`category = $${paramCount}`);
      values.push(category);
      paramCount++;
    }

    if (recipient_type) {
      conditions.push(`recipient_type = $${paramCount}`);
      values.push(recipient_type);
      paramCount++;
    }

    if (search) {
      conditions.push(`(number ILIKE $${paramCount} OR title ILIKE $${paramCount} OR message ILIKE $${paramCount})`);
      values.push(`%${search}%`);
      paramCount++;
    }

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

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Query para contar total
    const countQuery = `
      SELECT COUNT(*) 
      FROM polox.notifications 
      ${whereClause}
    `;

    // Query para buscar dados
    const selectQuery = `
      SELECT 
        n.id, n.number, n.type, n.title, n.message, n.channel,
        n.status, n.priority, n.recipient_type, n.recipient_email,
        n.recipient_phone, n.scheduled_for, n.sent_at, n.delivered_at,
        n.read_at, n.created_at, n.updated_at,
        nt.name as template_name,
        CASE 
          WHEN n.recipient_type = 'user' THEN u.name
          WHEN n.recipient_type = 'client' THEN c.name
          WHEN n.recipient_type = 'lead' THEN l.name
          ELSE n.recipient_email
        END as recipient_name
      FROM polox.notifications n
      LEFT JOIN polox.notification_templates nt ON n.template_id = nt.id
      LEFT JOIN polox.users u ON n.recipient_type = 'user' AND n.recipient_id = u.id::text
      LEFT JOIN polox.clients c ON n.recipient_type = 'client' AND n.recipient_id = c.id::text
      LEFT JOIN polox.leads l ON n.recipient_type = 'lead' AND n.recipient_id = l.id::text
      ${whereClause}
      ORDER BY ${sortBy} ${sortOrder}
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
      throw new ApiError(500, `Erro ao listar notificações: ${error.message}`);
    }
  }

  /**
   * Lista notificações do usuário
   * @param {number} userId - ID do usuário
   * @param {Object} options - Opções de busca
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object>} Lista de notificações do usuário
   */
  static async getUserNotifications(userId, options = {}, companyId) {
    const {
      page = 1,
      limit = 10,
      status = null,
      unread_only = false,
      type = null,
      sortBy = 'created_at',
      sortOrder = 'DESC'
    } = options;

    const offset = (page - 1) * limit;
    const conditions = [
      'company_id = $1',
      '(user_id = $2 OR (recipient_type = \'user\' AND recipient_id = $2::text))'
    ];
    const values = [companyId, userId];
    let paramCount = 3;

    // Adicionar filtros
    if (status) {
      conditions.push(`status = $${paramCount}`);
      values.push(status);
      paramCount++;
    }

    if (unread_only) {
      conditions.push('read_at IS NULL');
    }

    if (type) {
      conditions.push(`type = $${paramCount}`);
      values.push(type);
      paramCount++;
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    // Query para contar total
    const countQuery = `
      SELECT COUNT(*) 
      FROM polox.notifications 
      ${whereClause}
    `;

    // Query para buscar dados
    const selectQuery = `
      SELECT 
        id, number, type, title, message, channel, status, priority,
        scheduled_for, sent_at, delivered_at, read_at, created_at,
        CASE WHEN read_at IS NULL THEN TRUE ELSE FALSE END as is_unread
      FROM polox.notifications
      ${whereClause}
      ORDER BY ${sortBy} ${sortOrder}
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
      throw new ApiError(500, `Erro ao listar notificações do usuário: ${error.message}`);
    }
  }

  /**
   * Atualiza status da notificação
   * @param {number} id - ID da notificação
   * @param {string} status - Novo status
   * @param {number} companyId - ID da empresa
   * @param {Object} additionalData - Dados adicionais (error_message, etc.)
   * @returns {Promise<Object|null>} Notificação atualizada
   */
  static async updateStatus(id, status, companyId, additionalData = {}) {
    const validStatuses = ['pending', 'processing', 'sent', 'delivered', 'read', 'failed', 'cancelled'];
    
    if (!validStatuses.includes(status)) {
      throw new ValidationError(`Status deve ser um de: ${validStatuses.join(', ')}`);
    }

    return await transaction(async (client) => {
      const updates = ['status = $3', 'updated_at = NOW()'];
      const values = [id, companyId, status];
      let paramCount = 4;

      // Adicionar timestamps baseados no status
      if (status === 'sent' && !additionalData.sent_at) {
        updates.push('sent_at = NOW()');
      } else if (additionalData.sent_at) {
        updates.push(`sent_at = $${paramCount}`);
        values.push(additionalData.sent_at);
        paramCount++;
      }

      if (status === 'delivered' && !additionalData.delivered_at) {
        updates.push('delivered_at = NOW()');
      } else if (additionalData.delivered_at) {
        updates.push(`delivered_at = $${paramCount}`);
        values.push(additionalData.delivered_at);
        paramCount++;
      }

      if (status === 'read' && !additionalData.read_at) {
        updates.push('read_at = NOW()');
      } else if (additionalData.read_at) {
        updates.push(`read_at = $${paramCount}`);
        values.push(additionalData.read_at);
        paramCount++;
      }

      // Adicionar contadores
      if (status === 'processing') {
        updates.push('delivery_attempts = delivery_attempts + 1');
      }

      if (status === 'failed') {
        updates.push('retry_count = retry_count + 1');
        if (additionalData.error_message) {
          updates.push(`error_message = $${paramCount}`);
          values.push(additionalData.error_message);
          paramCount++;
        }
      }

      const updateQuery = `
        UPDATE polox.notifications 
        SET ${updates.join(', ')}
        WHERE id = $1 AND company_id = $2
        RETURNING 
          id, number, status, sent_at, delivered_at, read_at,
          retry_count, delivery_attempts, updated_at
      `;

      const result = await client.query(updateQuery, values);
      return result.rows[0] || null;
    }, { companyId });
  }

  /**
   * Marca notificação como lida
   * @param {number} id - ID da notificação
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object|null>} Notificação atualizada
   */
  static async markAsRead(id, companyId) {
    return await this.updateStatus(id, 'read', companyId);
  }

  /**
   * Marca notificações como lidas em lote
   * @param {Array} ids - IDs das notificações
   * @param {number} companyId - ID da empresa
   * @returns {Promise<number>} Número de notificações atualizadas
   */
  static async markMultipleAsRead(ids, companyId) {
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new ValidationError('IDs das notificações são obrigatórios');
    }

    const updateQuery = `
      UPDATE polox.notifications 
      SET status = 'read', read_at = NOW(), updated_at = NOW()
      WHERE id = ANY($1) AND company_id = $2 AND status != 'read'
    `;

    try {
      const result = await query(updateQuery, [ids, companyId], { companyId });
      return result.rowCount;
    } catch (error) {
      throw new ApiError(500, `Erro ao marcar notificações como lidas: ${error.message}`);
    }
  }

  /**
   * Programa notificação para envio futuro
   * @param {number} id - ID da notificação
   * @param {Date} scheduledFor - Data/hora do agendamento
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object|null>} Notificação agendada
   */
  static async schedule(id, scheduledFor, companyId) {
    const updateQuery = `
      UPDATE polox.notifications 
      SET 
        scheduled_for = $3,
        status = 'pending',
        updated_at = NOW()
      WHERE id = $1 AND company_id = $2
      RETURNING id, scheduled_for, status, updated_at
    `;

    try {
      const result = await query(updateQuery, [id, companyId, scheduledFor], { companyId });
      return result.rows[0] || null;
    } catch (error) {
      throw new ApiError(500, `Erro ao agendar notificação: ${error.message}`);
    }
  }

  /**
   * Busca notificações prontas para envio
   * @param {number} companyId - ID da empresa
   * @param {number} limit - Limite de notificações
   * @returns {Promise<Array>} Notificações para processar
   */
  static async getPendingNotifications(companyId, limit = 100) {
    const selectQuery = `
      SELECT 
        n.*,
        nt.from_email, nt.from_name, nt.subject, nt.html_content,
        nt.sms_content, nt.push_content, nt.webhook_payload
      FROM polox.notifications n
      LEFT JOIN polox.notification_templates nt ON n.template_id = nt.id
      WHERE n.company_id = $1 
        AND n.status = 'pending'
        AND (n.scheduled_for IS NULL OR n.scheduled_for <= NOW())
        AND (n.expires_at IS NULL OR n.expires_at > NOW())
        AND n.retry_count < n.max_retries
      ORDER BY n.priority DESC, n.created_at ASC
      LIMIT $2
    `;

    try {
      const result = await query(selectQuery, [companyId, limit], { companyId });
      return result.rows;
    } catch (error) {
      throw new ApiError(500, `Erro ao buscar notificações pendentes: ${error.message}`);
    }
  }

  /**
   * Busca notificações que falharam e podem ser reprocessadas
   * @param {number} companyId - ID da empresa
   * @param {number} limit - Limite de notificações
   * @returns {Promise<Array>} Notificações para retry
   */
  static async getRetryNotifications(companyId, limit = 50) {
    const selectQuery = `
      SELECT 
        n.*,
        nt.from_email, nt.from_name, nt.subject, nt.html_content,
        nt.sms_content, nt.push_content, nt.webhook_payload
      FROM polox.notifications n
      LEFT JOIN polox.notification_templates nt ON n.template_id = nt.id
      WHERE n.company_id = $1 
        AND n.status = 'failed'
        AND n.retry_count < n.max_retries
        AND (n.expires_at IS NULL OR n.expires_at > NOW())
        AND n.updated_at < NOW() - INTERVAL '1 hour' -- Aguardar 1 hora antes de retry
      ORDER BY n.priority DESC, n.updated_at ASC
      LIMIT $2
    `;

    try {
      const result = await query(selectQuery, [companyId, limit], { companyId });
      return result.rows;
    } catch (error) {
      throw new ApiError(500, `Erro ao buscar notificações para retry: ${error.message}`);
    }
  }

  /**
   * Obtém estatísticas de notificações
   * @param {number} companyId - ID da empresa
   * @param {Object} filters - Filtros opcionais (período, tipo, etc.)
   * @returns {Promise<Object>} Estatísticas das notificações
   */
  static async getStats(companyId, filters = {}) {
    const { date_from, date_to, type, channel } = filters;
    
    const conditions = ['company_id = $1'];
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

    if (type) {
      conditions.push(`type = $${paramCount}`);
      values.push(type);
      paramCount++;
    }

    if (channel) {
      conditions.push(`channel = $${paramCount}`);
      values.push(channel);
      paramCount++;
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const statsQuery = `
      SELECT 
        COUNT(*) as total_notifications,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count,
        COUNT(CASE WHEN status = 'processing' THEN 1 END) as processing_count,
        COUNT(CASE WHEN status = 'sent' THEN 1 END) as sent_count,
        COUNT(CASE WHEN status = 'delivered' THEN 1 END) as delivered_count,
        COUNT(CASE WHEN status = 'read' THEN 1 END) as read_count,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_count,
        COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_count,
        COUNT(CASE WHEN channel = 'email' THEN 1 END) as email_count,
        COUNT(CASE WHEN channel = 'sms' THEN 1 END) as sms_count,
        COUNT(CASE WHEN channel = 'push' THEN 1 END) as push_count,
        COUNT(CASE WHEN channel = 'webhook' THEN 1 END) as webhook_count,
        COUNT(CASE WHEN channel = 'in_app' THEN 1 END) as in_app_count,
        COUNT(CASE WHEN priority = 'urgent' THEN 1 END) as urgent_count,
        COUNT(CASE WHEN priority = 'high' THEN 1 END) as high_count,
        COUNT(CASE WHEN priority = 'medium' THEN 1 END) as medium_count,
        COUNT(CASE WHEN priority = 'low' THEN 1 END) as low_count,
        AVG(CASE WHEN sent_at IS NOT NULL AND delivered_at IS NOT NULL 
            THEN EXTRACT(EPOCH FROM (delivered_at - sent_at)) END) as avg_delivery_time_seconds,
        COUNT(CASE WHEN read_at IS NOT NULL THEN 1 END)::decimal / 
        NULLIF(COUNT(CASE WHEN delivered_at IS NOT NULL THEN 1 END), 0) * 100 as read_rate_percentage
      FROM polox.notifications 
      ${whereClause}
    `;

    try {
      const result = await query(statsQuery, values, { companyId });
      const stats = result.rows[0];

      // Calcular taxa de entrega
      stats.delivery_rate_percentage = stats.total_notifications > 0 
        ? ((stats.delivered_count / stats.total_notifications) * 100).toFixed(2)
        : 0;

      // Calcular taxa de sucesso
      stats.success_rate_percentage = stats.total_notifications > 0 
        ? (((stats.sent_count + stats.delivered_count + stats.read_count) / stats.total_notifications) * 100).toFixed(2)
        : 0;

      // Calcular taxa de falha
      stats.failure_rate_percentage = stats.total_notifications > 0 
        ? ((stats.failed_count / stats.total_notifications) * 100).toFixed(2)
        : 0;

      return stats;
    } catch (error) {
      throw new ApiError(500, `Erro ao obter estatísticas: ${error.message}`);
    }
  }

  /**
   * Obtém estatísticas por canal
   * @param {number} companyId - ID da empresa
   * @param {Object} filters - Filtros opcionais
   * @returns {Promise<Array>} Estatísticas por canal
   */
  static async getStatsByChannel(companyId, filters = {}) {
    const { date_from, date_to } = filters;
    
    const conditions = ['company_id = $1'];
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

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const channelStatsQuery = `
      SELECT 
        channel,
        COUNT(*) as total_notifications,
        COUNT(CASE WHEN status = 'sent' THEN 1 END) as sent_count,
        COUNT(CASE WHEN status = 'delivered' THEN 1 END) as delivered_count,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_count,
        COUNT(CASE WHEN status = 'read' THEN 1 END) as read_count,
        AVG(CASE WHEN sent_at IS NOT NULL AND delivered_at IS NOT NULL 
            THEN EXTRACT(EPOCH FROM (delivered_at - sent_at)) END) as avg_delivery_time_seconds
      FROM polox.notifications 
      ${whereClause}
      GROUP BY channel
      ORDER BY total_notifications DESC
    `;

    try {
      const result = await query(channelStatsQuery, values, { companyId });
      
      return result.rows.map(row => ({
        ...row,
        delivery_rate_percentage: row.total_notifications > 0 
          ? ((row.delivered_count / row.total_notifications) * 100).toFixed(2)
          : 0,
        success_rate_percentage: row.total_notifications > 0 
          ? (((row.sent_count + row.delivered_count + row.read_count) / row.total_notifications) * 100).toFixed(2)
          : 0,
        failure_rate_percentage: row.total_notifications > 0 
          ? ((row.failed_count / row.total_notifications) * 100).toFixed(2)
          : 0
      }));
    } catch (error) {
      throw new ApiError(500, `Erro ao obter estatísticas por canal: ${error.message}`);
    }
  }

  /**
   * Conta notificações não lidas do usuário
   * @param {number} userId - ID do usuário
   * @param {number} companyId - ID da empresa
   * @returns {Promise<number>} Número de notificações não lidas
   */
  static async getUnreadCount(userId, companyId) {
    const countQuery = `
      SELECT COUNT(*) 
      FROM polox.notifications 
      WHERE company_id = $1 
        AND (user_id = $2 OR (recipient_type = 'user' AND recipient_id = $2::text))
        AND status IN ('sent', 'delivered')
        AND read_at IS NULL
    `;

    try {
      const result = await query(countQuery, [companyId, userId], { companyId });
      return parseInt(result.rows[0].count);
    } catch (error) {
      throw new ApiError(500, `Erro ao contar notificações não lidas: ${error.message}`);
    }
  }

  /**
   * Cancela notificação
   * @param {number} id - ID da notificação
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object|null>} Notificação cancelada
   */
  static async cancel(id, companyId) {
    return await this.updateStatus(id, 'cancelled', companyId);
  }

  /**
   * Cancela notificações em lote
   * @param {Array} ids - IDs das notificações
   * @param {number} companyId - ID da empresa
   * @returns {Promise<number>} Número de notificações canceladas
   */
  static async cancelMultiple(ids, companyId) {
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new ValidationError('IDs das notificações são obrigatórios');
    }

    const updateQuery = `
      UPDATE polox.notifications 
      SET status = 'cancelled', updated_at = NOW()
      WHERE id = ANY($1) AND company_id = $2 AND status IN ('pending', 'processing')
    `;

    try {
      const result = await query(updateQuery, [ids, companyId], { companyId });
      return result.rowCount;
    } catch (error) {
      throw new ApiError(500, `Erro ao cancelar notificações: ${error.message}`);
    }
  }

  /**
   * Limpa notificações antigas
   * @param {number} companyId - ID da empresa
   * @param {number} daysOld - Número de dias (padrão: 90)
   * @returns {Promise<number>} Número de notificações removidas
   */
  static async cleanOldNotifications(companyId, daysOld = 90) {
    const deleteQuery = `
      DELETE FROM polox.notifications 
      WHERE company_id = $1 
        AND created_at < NOW() - INTERVAL '${daysOld} days'
        AND status IN ('delivered', 'read', 'failed', 'cancelled')
    `;

    try {
      const result = await query(deleteQuery, [companyId], { companyId });
      return result.rowCount;
    } catch (error) {
      throw new ApiError(500, `Erro ao limpar notificações antigas: ${error.message}`);
    }
  }

  /**
   * Cria notificação a partir de template
   * @param {string} templateName - Nome do template
   * @param {Object} variables - Variáveis para o template
   * @param {Object} recipientData - Dados do destinatário
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object>} Notificação criada
   */
  static async createFromTemplate(templateName, variables, recipientData, companyId) {
    const template = await NotificationTemplateModel.findByName(templateName, companyId);
    
    if (!template) {
      throw new NotFoundError(`Template '${templateName}' não encontrado`);
    }

    if (!template.is_active) {
      throw new ValidationError(`Template '${templateName}' está inativo`);
    }

    // Validar variáveis do template
    const validation = NotificationTemplateModel.validateVariables(template, variables);
    if (!validation.isValid) {
      throw new ValidationError(`Variáveis obrigatórias ausentes: ${validation.missingVars.join(', ')}`);
    }

    // Processar template
    const processed = NotificationTemplateModel.processTemplate(template, variables);

    const notificationData = {
      template_id: template.id,
      type: template.type,
      title: processed.title,
      message: processed.content,
      channel: template.channel,
      category: template.category,
      variables,
      ...recipientData
    };

    return await this.create(notificationData, companyId);
  }

  /**
   * Envia notificação de boas-vindas
   * @param {Object} userData - Dados do usuário
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object>} Notificação enviada
   */
  static async sendWelcomeNotification(userData, companyId) {
    return await this.createFromTemplate(
      'welcome_user',
      {
        user_name: userData.name,
        user_email: userData.email,
        company_name: userData.company_name
      },
      {
        recipient_type: 'user',
        recipient_id: userData.id,
        recipient_email: userData.email,
        priority: 'medium'
      },
      companyId
    );
  }

  /**
   * Envia notificação de novo lead
   * @param {Object} leadData - Dados do lead
   * @param {Object} assignedUser - Usuário responsável
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object>} Notificação enviada
   */
  static async sendNewLeadNotification(leadData, assignedUser, companyId) {
    return await this.createFromTemplate(
      'new_lead_assigned',
      {
        lead_name: leadData.name,
        lead_email: leadData.email,
        lead_phone: leadData.phone,
        assigned_user_name: assignedUser.name,
        source: leadData.source
      },
      {
        recipient_type: 'user',
        recipient_id: assignedUser.id,
        recipient_email: assignedUser.email,
        priority: 'high',
        reference_type: 'lead',
        reference_id: leadData.id
      },
      companyId
    );
  }
}

module.exports = NotificationModel;