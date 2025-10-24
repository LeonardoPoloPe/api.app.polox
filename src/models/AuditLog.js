const { query, transaction } = require('../config/database');
const { ApiError, ValidationError } = require('../utils/errors');

/**
 * Model para log de auditoria
 * Baseado no schema polox.audit_logs
 */
class AuditLogModel {
  /**
   * Cria um novo log de auditoria
   * @param {Object} logData - Dados do log
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object>} Log criado
   */
  static async create(logData, companyId) {
    const {
      user_id = null,
      audit_action,
      entity_type,
      entity_id,
      entity_name = null,
      old_values = null,
      new_values = null,
      ip_address = null,
      user_agent = null,
      session_id = null,
      category = 'general',
      severity = 'info',
      description = null,
      metadata = null
    } = logData;

    // Validar dados obrigatórios
    if (!audit_action) {
      throw new ValidationError('Ação é obrigatória');
    }

    if (!entity_type) {
      throw new ValidationError('Tipo de entidade é obrigatório');
    }

    if (!entity_id) {
      throw new ValidationError('ID da entidade é obrigatório');
    }

    const validActions = [
      'create', 'read', 'update', 'delete', 'login', 'logout',
      'export', 'import', 'send', 'receive', 'approve', 'reject',
      'activate', 'deactivate', 'assign', 'unassign', 'upload',
      'download', 'share', 'archive', 'restore'
    ];

    if (!validActions.includes(audit_action)) {
      throw new ValidationError(`Ação deve ser uma de: ${validActions.join(', ')}`);
    }

    const validSeverities = ['debug', 'info', 'warning', 'error', 'critical'];

    if (!validSeverities.includes(severity)) {
      throw new ValidationError(`Severidade deve ser uma de: ${validSeverities.join(', ')}`);
    }

    const insertQuery = `
      INSERT INTO polox.audit_logs (
        company_id, user_id, audit_action, entity_type, entity_id,
        entity_name, old_values, new_values, ip_address,
        user_agent, session_id, category, severity, description,
        metadata, created_at
      )
      VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9,
        $10, $11, $12, $13, $14,
        $15, NOW()
      )
      RETURNING 
        id, audit_action, entity_type, entity_id, entity_name,
        category, severity, created_at
    `;

    try {
      const result = await query(insertQuery, [
        companyId, user_id, audit_action, entity_type, entity_id,
        entity_name, old_values, new_values, ip_address,
        user_agent, session_id, category, severity, description,
        metadata
      ], { companyId });

      return result.rows[0];
    } catch (error) {
      throw new ApiError(500, `Erro ao criar log de auditoria: ${error.message}`);
    }
  }

  /**
   * Lista logs com filtros e paginação
   * @param {Object} options - Opções de busca
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object>} Lista de logs e metadados
   */
  static async list(options = {}, companyId) {
    const {
      page = 1,
      limit = 50,
      user_id = null,
      audit_action = null,
      entity_type = null,
      entity_id = null,
      category = null,
      severity = null,
      date_from = null,
      date_to = null,
      search = null,
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

    if (action) {
      conditions.push(`action = $${paramCount}`);
      values.push(action);
      paramCount++;
    }

    if (entity_type) {
      conditions.push(`entity_type = $${paramCount}`);
      values.push(entity_type);
      paramCount++;
    }

    if (entity_id) {
      conditions.push(`entity_id = $${paramCount}`);
      values.push(entity_id);
      paramCount++;
    }

    if (category) {
      conditions.push(`category = $${paramCount}`);
      values.push(category);
      paramCount++;
    }

    if (severity) {
      conditions.push(`severity = $${paramCount}`);
      values.push(severity);
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

    if (search) {
      conditions.push(`(
        audit_action ILIKE $${paramCount} OR 
        entity_name ILIKE $${paramCount} OR 
        description ILIKE $${paramCount}
      )`);
      values.push(`%${search}%`);
      paramCount++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Query para contar total
    const countQuery = `
      SELECT COUNT(*) 
      FROM polox.audit_logs 
      ${whereClause}
    `;

    // Query para buscar dados
    const selectQuery = `
      SELECT 
        al.id, al.audit_action, al.entity_type, al.entity_id, al.entity_name,
        al.category, al.severity, al.description, al.ip_address,
        al.created_at,
        u.full_name as user_name,
        u.email as user_email
      FROM polox.audit_logs al
      LEFT JOIN polox.users u ON al.user_id = u.id
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
        data: dataResult.rows.map(log => ({
          ...log,
          action_display: this.getActionDisplay(log.audit_action),
          severity_display: this.getSeverityDisplay(log.severity),
          time_ago: this.getTimeAgo(log.created_at)
        })),
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
      throw new ApiError(500, `Erro ao listar logs de auditoria: ${error.message}`);
    }
  }

  /**
   * Busca logs de uma entidade específica
   * @param {string} entityType - Tipo da entidade
   * @param {number} entityId - ID da entidade
   * @param {number} companyId - ID da empresa
   * @param {Object} options - Opções de filtro
   * @returns {Promise<Array>} Lista de logs da entidade
   */
  static async getEntityLogs(entityType, entityId, companyId, options = {}) {
    const {
      limit = 20,
      action = null,
      user_id = null,
      date_from = null,
      date_to = null
    } = options;

    const conditions = [
      'entity_type = $1',
      'entity_id = $2',
      'company_id = $3'
    ];
    const values = [entityType, entityId, companyId];
    let paramCount = 4;

    if (action) {
      conditions.push(`action = $${paramCount}`);
      values.push(action);
      paramCount++;
    }

    if (user_id) {
      conditions.push(`user_id = $${paramCount}`);
      values.push(user_id);
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

    const selectQuery = `
      SELECT 
        al.id, al.action, al.old_values, al.new_values,
        al.description, al.created_at, al.ip_address,
        u.name as user_name,
        u.email as user_email
      FROM polox.audit_logs al
      LEFT JOIN polox.users u ON al.user_id = u.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY al.created_at DESC
      LIMIT $${paramCount}
    `;

    try {
      const result = await query(selectQuery, [...values, limit], { companyId });
      
      return result.rows.map(log => ({
        ...log,
        action_display: this.getActionDisplay(log.action),
        changes: this.formatChanges(log.old_values, log.new_values),
        time_ago: this.getTimeAgo(log.created_at)
      }));
    } catch (error) {
      throw new ApiError(500, `Erro ao buscar logs da entidade: ${error.message}`);
    }
  }

  /**
   * Busca logs de um usuário específico
   * @param {number} userId - ID do usuário
   * @param {number} companyId - ID da empresa
   * @param {Object} options - Opções de filtro
   * @returns {Promise<Object>} Lista de logs do usuário
   */
  static async getUserLogs(userId, companyId, options = {}) {
    const {
      page = 1,
      limit = 20,
      action = null,
      entity_type = null,
      date_from = null,
      date_to = null
    } = options;

    const offset = (page - 1) * limit;
    const conditions = ['user_id = $1', 'company_id = $2'];
    const values = [userId, companyId];
    let paramCount = 3;

    if (action) {
      conditions.push(`action = $${paramCount}`);
      values.push(action);
      paramCount++;
    }

    if (entity_type) {
      conditions.push(`entity_type = $${paramCount}`);
      values.push(entity_type);
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

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const countQuery = `SELECT COUNT(*) FROM polox.audit_logs ${whereClause}`;

    const selectQuery = `
      SELECT 
        id, action, entity_type, entity_id, entity_name,
        description, created_at, ip_address
      FROM polox.audit_logs
      ${whereClause}
      ORDER BY created_at DESC
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
        data: dataResult.rows.map(log => ({
          ...log,
          action_display: this.getActionDisplay(log.action),
          time_ago: this.getTimeAgo(log.created_at)
        })),
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
      throw new ApiError(500, `Erro ao buscar logs do usuário: ${error.message}`);
    }
  }

  /**
   * Obtém estatísticas de auditoria
   * @param {number} companyId - ID da empresa
   * @param {Object} filters - Filtros opcionais
   * @returns {Promise<Object>} Estatísticas de auditoria
   */
  static async getStats(companyId, filters = {}) {
    const { date_from, date_to, user_id, entity_type } = filters;
    
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

    if (user_id) {
      conditions.push(`user_id = $${paramCount}`);
      values.push(user_id);
      paramCount++;
    }

    if (entity_type) {
      conditions.push(`entity_type = $${paramCount}`);
      values.push(entity_type);
      paramCount++;
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const statsQuery = `
      SELECT 
        COUNT(*) as total_logs,
        COUNT(CASE WHEN action = 'create' THEN 1 END) as create_actions,
        COUNT(CASE WHEN action = 'update' THEN 1 END) as update_actions,
        COUNT(CASE WHEN action = 'delete' THEN 1 END) as delete_actions,
        COUNT(CASE WHEN action = 'login' THEN 1 END) as login_actions,
        COUNT(CASE WHEN action = 'logout' THEN 1 END) as logout_actions,
        COUNT(CASE WHEN severity = 'error' THEN 1 END) as error_logs,
        COUNT(CASE WHEN severity = 'warning' THEN 1 END) as warning_logs,
        COUNT(CASE WHEN severity = 'critical' THEN 1 END) as critical_logs,
        COUNT(DISTINCT user_id) as unique_users,
        COUNT(DISTINCT entity_type) as entity_types,
        COUNT(DISTINCT ip_address) as unique_ips,
        MAX(created_at) as last_activity,
        MIN(created_at) as first_activity
      FROM polox.audit_logs 
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
   * Obtém estatísticas por ação
   * @param {number} companyId - ID da empresa
   * @param {Object} filters - Filtros opcionais
   * @returns {Promise<Array>} Estatísticas por ação
   */
  static async getStatsByAction(companyId, filters = {}) {
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

    const actionStatsQuery = `
      SELECT 
        action,
        COUNT(*) as count,
        COUNT(DISTINCT user_id) as unique_users,
        COUNT(DISTINCT entity_type) as entity_types,
        MAX(created_at) as last_occurrence,
        MIN(created_at) as first_occurrence
      FROM polox.audit_logs 
      ${whereClause}
      GROUP BY action
      ORDER BY count DESC
    `;

    try {
      const result = await query(actionStatsQuery, values, { companyId });
      
      return result.rows.map(row => ({
        ...row,
        action_display: this.getActionDisplay(row.action),
        percentage: 0 // Será calculado no frontend se necessário
      }));
    } catch (error) {
      throw new ApiError(500, `Erro ao obter estatísticas por ação: ${error.message}`);
    }
  }

  /**
   * Obtém atividade por hora do dia
   * @param {number} companyId - ID da empresa
   * @param {Object} filters - Filtros opcionais
   * @returns {Promise<Array>} Atividade por hora
   */
  static async getActivityByHour(companyId, filters = {}) {
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

    const hourStatsQuery = `
      SELECT 
        EXTRACT(HOUR FROM created_at) as hour,
        COUNT(*) as activity_count,
        COUNT(DISTINCT user_id) as unique_users,
        COUNT(CASE WHEN severity IN ('error', 'critical') THEN 1 END) as error_count
      FROM polox.audit_logs 
      ${whereClause}
      GROUP BY EXTRACT(HOUR FROM created_at)
      ORDER BY hour
    `;

    try {
      const result = await query(hourStatsQuery, values, { companyId });
      
      // Preencher horas sem atividade
      const hourlyData = Array.from({ length: 24 }, (_, i) => ({
        hour: i,
        activity_count: 0,
        unique_users: 0,
        error_count: 0
      }));

      result.rows.forEach(row => {
        hourlyData[row.hour] = row;
      });

      return hourlyData;
    } catch (error) {
      throw new ApiError(500, `Erro ao obter atividade por hora: ${error.message}`);
    }
  }

  /**
   * Busca logs de segurança (logins, falhas, etc.)
   * @param {number} companyId - ID da empresa
   * @param {Object} options - Opções de filtro
   * @returns {Promise<Object>} Logs de segurança
   */
  static async getSecurityLogs(companyId, options = {}) {
    const {
      page = 1,
      limit = 50,
      severity = null,
      date_from = null,
      date_to = null,
      ip_address = null
    } = options;

    const offset = (page - 1) * limit;
    const conditions = [
      'company_id = $1',
      "(action IN ('login', 'logout') OR severity IN ('error', 'warning', 'critical'))"
    ];
    const values = [companyId];
    let paramCount = 2;

    if (severity) {
      conditions.push(`severity = $${paramCount}`);
      values.push(severity);
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

    if (ip_address) {
      conditions.push(`ip_address = $${paramCount}`);
      values.push(ip_address);
      paramCount++;
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const countQuery = `SELECT COUNT(*) FROM polox.audit_logs ${whereClause}`;

    const selectQuery = `
      SELECT 
        al.id, al.action, al.severity, al.description, 
        al.ip_address, al.user_agent, al.created_at,
        u.name as user_name,
        u.email as user_email
      FROM polox.audit_logs al
      LEFT JOIN polox.users u ON al.user_id = u.id
      ${whereClause}
      ORDER BY al.created_at DESC
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
        data: dataResult.rows.map(log => ({
          ...log,
          action_display: this.getActionDisplay(log.action),
          severity_display: this.getSeverityDisplay(log.severity),
          risk_level: this.getRiskLevel(log.action, log.severity),
          time_ago: this.getTimeAgo(log.created_at)
        })),
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
      throw new ApiError(500, `Erro ao buscar logs de segurança: ${error.message}`);
    }
  }

  /**
   * Detecta atividade suspeita
   * @param {number} companyId - ID da empresa
   * @param {Object} options - Opções de análise
   * @returns {Promise<Object>} Relatório de atividade suspeita
   */
  static async detectSuspiciousActivity(companyId, options = {}) {
    const { hours = 24 } = options;

    const suspiciousQueries = {
      // Múltiplos logins falhados
      failedLogins: `
        SELECT 
          ip_address,
          user_agent,
          COUNT(*) as failed_attempts,
          MAX(created_at) as last_attempt,
          STRING_AGG(DISTINCT COALESCE(u.email, 'Unknown'), ', ') as attempted_users
        FROM polox.audit_logs al
        LEFT JOIN polox.users u ON al.user_id = u.id
        WHERE al.company_id = $1 
          AND al.action = 'login'
          AND al.severity = 'error'
          AND al.created_at > NOW() - INTERVAL '${hours} hours'
        GROUP BY ip_address, user_agent
        HAVING COUNT(*) >= 3
        ORDER BY failed_attempts DESC
      `,

      // Atividade fora do horário normal
      afterHoursActivity: `
        SELECT 
          u.name as user_name,
          u.email as user_email,
          al.action,
          al.entity_type,
          COUNT(*) as activity_count,
          MIN(al.created_at) as first_activity,
          MAX(al.created_at) as last_activity
        FROM polox.audit_logs al
        JOIN polox.users u ON al.user_id = u.id
        WHERE al.company_id = $1 
          AND al.created_at > NOW() - INTERVAL '${hours} hours'
          AND (EXTRACT(HOUR FROM al.created_at) < 6 OR EXTRACT(HOUR FROM al.created_at) > 22)
        GROUP BY u.id, u.name, u.email, al.action, al.entity_type
        HAVING COUNT(*) >= 5
        ORDER BY activity_count DESC
      `,

      // Múltiplos IPs para mesmo usuário
      multipleIps: `
        SELECT 
          u.name as user_name,
          u.email as user_email,
          COUNT(DISTINCT al.ip_address) as unique_ips,
          STRING_AGG(DISTINCT al.ip_address, ', ') as ip_addresses,
          MIN(al.created_at) as first_login,
          MAX(al.created_at) as last_login
        FROM polox.audit_logs al
        JOIN polox.users u ON al.user_id = u.id
        WHERE al.company_id = $1 
          AND al.action = 'login'
          AND al.created_at > NOW() - INTERVAL '${hours} hours'
        GROUP BY u.id, u.name, u.email
        HAVING COUNT(DISTINCT al.ip_address) >= 3
        ORDER BY unique_ips DESC
      `
    };

    try {
      const results = {};

      for (const [key, queryString] of Object.entries(suspiciousQueries)) {
        const result = await query(queryString, [companyId], { companyId });
        results[key] = result.rows;
      }

      return {
        period_hours: hours,
        detected_at: new Date(),
        suspicious_activities: results,
        summary: {
          failed_login_sources: results.failedLogins.length,
          after_hours_users: results.afterHoursActivity.length,
          multi_ip_users: results.multipleIps.length,
          total_risks: results.failedLogins.length + 
                      results.afterHoursActivity.length + 
                      results.multipleIps.length
        }
      };
    } catch (error) {
      throw new ApiError(500, `Erro ao detectar atividade suspeita: ${error.message}`);
    }
  }

  /**
   * Limpa logs antigos
   * @param {number} companyId - ID da empresa
   * @param {number} daysToKeep - Número de dias para manter (padrão: 365)
   * @returns {Promise<number>} Número de logs removidos
   */
  static async cleanOldLogs(companyId, daysToKeep = 365) {
    const deleteQuery = `
      DELETE FROM polox.audit_logs 
      WHERE company_id = $1 
        AND created_at < NOW() - INTERVAL '${daysToKeep} days'
        AND severity NOT IN ('error', 'critical')
    `;

    try {
      const result = await query(deleteQuery, [companyId], { companyId });
      return result.rowCount;
    } catch (error) {
      throw new ApiError(500, `Erro ao limpar logs antigos: ${error.message}`);
    }
  }

  /**
   * Métodos auxiliares para formatação
   */
  static getActionDisplay(action) {
    const actionMap = {
      'create': 'Criado',
      'read': 'Visualizado',
      'update': 'Atualizado',
      'delete': 'Deletado',
      'login': 'Login',
      'logout': 'Logout',
      'export': 'Exportado',
      'import': 'Importado',
      'send': 'Enviado',
      'receive': 'Recebido',
      'approve': 'Aprovado',
      'reject': 'Rejeitado',
      'activate': 'Ativado',
      'deactivate': 'Desativado',
      'assign': 'Atribuído',
      'unassign': 'Desatribuído',
      'upload': 'Upload',
      'download': 'Download',
      'share': 'Compartilhado',
      'archive': 'Arquivado',
      'restore': 'Restaurado'
    };

    return actionMap[action] || action;
  }

  static getSeverityDisplay(severity) {
    const severityMap = {
      'debug': 'Debug',
      'info': 'Informação',
      'warning': 'Aviso',
      'error': 'Erro',
      'critical': 'Crítico'
    };

    return severityMap[severity] || severity;
  }

  static getRiskLevel(action, severity) {
    if (severity === 'critical') return 'high';
    if (severity === 'error') return 'medium';
    if (action === 'delete' || action === 'login') return 'medium';
    return 'low';
  }

  static formatChanges(oldValues, newValues) {
    if (!oldValues || !newValues) return null;

    try {
      const old = typeof oldValues === 'string' ? JSON.parse(oldValues) : oldValues;
      const new_ = typeof newValues === 'string' ? JSON.parse(newValues) : newValues;

      const changes = [];

      for (const [key, newValue] of Object.entries(new_)) {
        const oldValue = old[key];
        if (oldValue !== newValue) {
          changes.push({
            field: key,
            old_value: oldValue,
            new_value: newValue
          });
        }
      }

      return changes;
    } catch (error) {
      return null;
    }
  }

  static getTimeAgo(date) {
    if (!date) return '';

    const now = new Date();
    const logDate = new Date(date);
    const diffMs = now - logDate;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) {
      return `${diffDays} dia(s) atrás`;
    } else if (diffHours > 0) {
      return `${diffHours} hora(s) atrás`;
    } else {
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      return `${diffMinutes} minuto(s) atrás`;
    }
  }

  /**
   * Logs específicos para diferentes ações
   */
  
  /**
   * Log de criação de entidade
   * @param {string} entityType - Tipo da entidade
   * @param {number} entityId - ID da entidade
   * @param {string} entityName - Nome da entidade
   * @param {Object} newValues - Valores da nova entidade
   * @param {number} userId - ID do usuário
   * @param {number} companyId - ID da empresa
   * @param {Object} requestInfo - Informações da requisição
   * @returns {Promise<Object>} Log criado
   */
  static async logCreate(entityType, entityId, entityName, newValues, userId, companyId, requestInfo = {}) {
    return await this.create({
      user_id: userId,
      action: 'create',
      entity_type: entityType,
      entity_id: entityId,
      entity_name: entityName,
      new_values: newValues,
      ip_address: requestInfo.ip,
      user_agent: requestInfo.userAgent,
      session_id: requestInfo.sessionId,
      category: 'crud',
      severity: 'info',
      description: `${entityType} '${entityName}' foi criado(a)`
    }, companyId);
  }

  /**
   * Log de atualização de entidade
   * @param {string} entityType - Tipo da entidade
   * @param {number} entityId - ID da entidade
   * @param {string} entityName - Nome da entidade
   * @param {Object} oldValues - Valores anteriores
   * @param {Object} newValues - Novos valores
   * @param {number} userId - ID do usuário
   * @param {number} companyId - ID da empresa
   * @param {Object} requestInfo - Informações da requisição
   * @returns {Promise<Object>} Log criado
   */
  static async logUpdate(entityType, entityId, entityName, oldValues, newValues, userId, companyId, requestInfo = {}) {
    return await this.create({
      user_id: userId,
      action: 'update',
      entity_type: entityType,
      entity_id: entityId,
      entity_name: entityName,
      old_values: oldValues,
      new_values: newValues,
      ip_address: requestInfo.ip,
      user_agent: requestInfo.userAgent,
      session_id: requestInfo.sessionId,
      category: 'crud',
      severity: 'info',
      description: `${entityType} '${entityName}' foi atualizado(a)`
    }, companyId);
  }

  /**
   * Log de login
   * @param {number} userId - ID do usuário
   * @param {string} userEmail - Email do usuário
   * @param {boolean} success - Se o login foi bem-sucedido
   * @param {number} companyId - ID da empresa
   * @param {Object} requestInfo - Informações da requisição
   * @returns {Promise<Object>} Log criado
   */
  static async logLogin(userId, userEmail, success, companyId, requestInfo = {}) {
    return await this.create({
      user_id: success ? userId : null,
      action: 'login',
      entity_type: 'users',
      entity_id: userId,
      entity_name: userEmail,
      ip_address: requestInfo.ip,
      user_agent: requestInfo.userAgent,
      session_id: requestInfo.sessionId,
      category: 'authentication',
      severity: success ? 'info' : 'error',
      description: success 
        ? `Login realizado com sucesso para ${userEmail}`
        : `Tentativa de login falhou para ${userEmail}`
    }, companyId);
  }
}

module.exports = AuditLogModel;