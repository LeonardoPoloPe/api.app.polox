const { query, transaction } = require('../config/database');
const { ApiError, ValidationError, NotFoundError } = require('../utils/errors');

/**
 * Model para histórico de gamificação
 * Baseado no schema polox.gamification_history
 */
class GamificationHistoryModel {
  /**
   * Registra um evento de gamificação
   * @param {Object} eventData - Dados do evento
   * @returns {Promise<Object>} Evento registrado
   */
  static async logEvent(eventData) {
    const {
      user_id,
      event_type,
      points_awarded = 0,
      points_deducted = 0,
      description,
      metadata = {},
      related_entity_type = null,
      related_entity_id = null,
      triggered_by_user_id = null
    } = eventData;

    // Validar dados obrigatórios
    if (!user_id || !event_type) {
      throw new ValidationError('User ID e tipo de evento são obrigatórios');
    }

    if (points_awarded < 0 || points_deducted < 0) {
      throw new ValidationError('Pontos não podem ser negativos');
    }

    if (points_awarded > 0 && points_deducted > 0) {
      throw new ValidationError('Não é possível conceder e deduzir pontos no mesmo evento');
    }

    const insertQuery = `
      INSERT INTO polox.gamification_history (
        user_id, event_type, points_awarded, points_deducted, description,
        metadata, related_entity_type, related_entity_id, triggered_by_user_id,
        created_at
      )
      VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, NOW()
      )
      RETURNING 
        id, user_id, event_type, points_awarded, points_deducted, description,
        metadata, related_entity_type, related_entity_id, triggered_by_user_id,
        created_at
    `;

    try {
      const result = await query(insertQuery, [
        user_id, event_type, points_awarded, points_deducted, description,
        JSON.stringify(metadata), related_entity_type, related_entity_id, triggered_by_user_id
      ]);

      const historyEvent = result.rows[0];
      
      // Parse metadata
      historyEvent.metadata = typeof historyEvent.metadata === 'string' 
        ? JSON.parse(historyEvent.metadata) 
        : historyEvent.metadata;

      return historyEvent;
    } catch (error) {
      if (error.code === '23503') {
        if (error.constraint?.includes('user')) {
          throw new ValidationError('Usuário informado não existe');
        }
        if (error.constraint?.includes('triggered_by')) {
          throw new ValidationError('Usuário que acionou o evento não existe');
        }
      }
      throw new ApiError(500, `Erro ao registrar evento: ${error.message}`);
    }
  }

  /**
   * Busca evento por ID
   * @param {number} id - ID do evento
   * @param {number} companyId - ID da empresa (multi-tenant)
   * @returns {Promise<Object|null>} Evento encontrado ou null
   */
  static async findById(id, companyId) {
    const selectQuery = `
      SELECT 
        gh.id, gh.user_id, gh.event_type, gh.points_awarded, gh.points_deducted,
        gh.description, gh.metadata, gh.related_entity_type, gh.related_entity_id,
        gh.triggered_by_user_id, gh.created_at,
        u.full_name as user_name,
        u.email as user_email,
        tb.name as triggered_by_name
      FROM polox.gamification_history gh
      INNER JOIN polox.users u ON gh.user_id = u.id
      LEFT JOIN polox.users tb ON gh.triggered_by_user_id = tb.id
      WHERE gh.id = $1 AND u.company_id = $2
    `;

    try {
      const result = await query(selectQuery, [id, companyId], { companyId });
      const event = result.rows[0];
      
      if (event) {
        // Parse JSON fields
        event.metadata = typeof event.metadata === 'string' 
          ? JSON.parse(event.metadata) 
          : event.metadata;
      }

      return event || null;
    } catch (error) {
      throw new ApiError(500, `Erro ao buscar evento: ${error.message}`);
    }
  }

  /**
   * Lista histórico de gamificação de um usuário
   * @param {number} userId - ID do usuário
   * @param {number} companyId - ID da empresa
   * @param {Object} options - Opções de filtro
   * @returns {Promise<Array>} Lista de eventos
   */
  static async findByUser(userId, companyId, options = {}) {
    const { 
      event_type = null,
      related_entity_type = null,
      points_only = false,
      start_date = null,
      end_date = null,
      page = 1, 
      limit = 50
    } = options;
    
    const offset = (page - 1) * limit;
    
    let whereClause = `
      WHERE gh.user_id = $1 AND u.company_id = $2
    `;
    const params = [userId, companyId];
    
    if (event_type) {
      whereClause += ` AND gh.event_type = $${params.length + 1}`;
      params.push(event_type);
    }

    if (related_entity_type) {
      whereClause += ` AND gh.related_entity_type = $${params.length + 1}`;
      params.push(related_entity_type);
    }

    if (points_only) {
      whereClause += ` AND (gh.points_awarded > 0 OR gh.points_deducted > 0)`;
    }

    if (start_date) {
      whereClause += ` AND gh.created_at >= $${params.length + 1}`;
      params.push(start_date);
    }

    if (end_date) {
      whereClause += ` AND gh.created_at <= $${params.length + 1}`;
      params.push(end_date);
    }

    const selectQuery = `
      SELECT 
        gh.id, gh.user_id, gh.event_type, gh.points_awarded, gh.points_deducted,
        gh.description, gh.metadata, gh.related_entity_type, gh.related_entity_id,
        gh.triggered_by_user_id, gh.created_at,
        tb.name as triggered_by_name,
        (gh.points_awarded - gh.points_deducted) as net_points
      FROM polox.gamification_history gh
      INNER JOIN polox.users u ON gh.user_id = u.id
      LEFT JOIN polox.users tb ON gh.triggered_by_user_id = tb.id
      ${whereClause}
      ORDER BY gh.created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    params.push(limit, offset);

    try {
      const result = await query(selectQuery, params, { companyId });
      
      return result.rows.map(event => {
        // Parse JSON fields
        event.metadata = typeof event.metadata === 'string' 
          ? JSON.parse(event.metadata) 
          : event.metadata;
        event.net_points = parseInt(event.net_points) || 0;
        
        return event;
      });
    } catch (error) {
      throw new ApiError(500, `Erro ao buscar histórico do usuário: ${error.message}`);
    }
  }

  /**
   * Lista eventos por tipo
   * @param {string} eventType - Tipo do evento
   * @param {number} companyId - ID da empresa
   * @param {Object} options - Opções de filtro
   * @returns {Promise<Array>} Lista de eventos
   */
  static async findByEventType(eventType, companyId, options = {}) {
    const { 
      user_id = null,
      start_date = null,
      end_date = null,
      page = 1, 
      limit = 50
    } = options;
    
    const offset = (page - 1) * limit;
    
    let whereClause = `
      WHERE gh.event_type = $1 AND u.company_id = $2
    `;
    const params = [eventType, companyId];
    
    if (user_id) {
      whereClause += ` AND gh.user_id = $${params.length + 1}`;
      params.push(user_id);
    }

    if (start_date) {
      whereClause += ` AND gh.created_at >= $${params.length + 1}`;
      params.push(start_date);
    }

    if (end_date) {
      whereClause += ` AND gh.created_at <= $${params.length + 1}`;
      params.push(end_date);
    }

    const selectQuery = `
      SELECT 
        gh.id, gh.user_id, gh.event_type, gh.points_awarded, gh.points_deducted,
        gh.description, gh.metadata, gh.related_entity_type, gh.related_entity_id,
        gh.triggered_by_user_id, gh.created_at,
        u.full_name as user_name,
        u.email as user_email,
        u.avatar_url as user_avatar
      FROM polox.gamification_history gh
      INNER JOIN polox.users u ON gh.user_id = u.id
      LEFT JOIN polox.users tb ON gh.triggered_by_user_id = tb.id
      ${whereClause}
      ORDER BY gh.created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    params.push(limit, offset);

    try {
      const result = await query(selectQuery, params, { companyId });
      
      return result.rows.map(event => {
        // Parse JSON fields
        event.metadata = typeof event.metadata === 'string' 
          ? JSON.parse(event.metadata) 
          : event.metadata;
        
        return event;
      });
    } catch (error) {
      throw new ApiError(500, `Erro ao buscar eventos por tipo: ${error.message}`);
    }
  }

  /**
   * Lista eventos relacionados a uma entidade
   * @param {string} entityType - Tipo da entidade
   * @param {number} entityId - ID da entidade
   * @param {number} companyId - ID da empresa
   * @param {Object} options - Opções de filtro
   * @returns {Promise<Array>} Lista de eventos
   */
  static async findByEntity(entityType, entityId, companyId, options = {}) {
    const { 
      event_type = null,
      user_id = null,
      page = 1, 
      limit = 50
    } = options;
    
    const offset = (page - 1) * limit;
    
    let whereClause = `
      WHERE gh.related_entity_type = $1 AND gh.related_entity_id = $2 AND u.company_id = $3
    `;
    const params = [entityType, entityId, companyId];
    
    if (event_type) {
      whereClause += ` AND gh.event_type = $${params.length + 1}`;
      params.push(event_type);
    }

    if (user_id) {
      whereClause += ` AND gh.user_id = $${params.length + 1}`;
      params.push(user_id);
    }

    const selectQuery = `
      SELECT 
        gh.id, gh.user_id, gh.event_type, gh.points_awarded, gh.points_deducted,
        gh.description, gh.metadata, gh.related_entity_type, gh.related_entity_id,
        gh.triggered_by_user_id, gh.created_at,
        u.full_name as user_name,
        u.email as user_email,
        tb.name as triggered_by_name
      FROM polox.gamification_history gh
      INNER JOIN polox.users u ON gh.user_id = u.id
      LEFT JOIN polox.users tb ON gh.triggered_by_user_id = tb.id
      ${whereClause}
      ORDER BY gh.created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    params.push(limit, offset);

    try {
      const result = await query(selectQuery, params, { companyId });
      
      return result.rows.map(event => {
        // Parse JSON fields
        event.metadata = typeof event.metadata === 'string' 
          ? JSON.parse(event.metadata) 
          : event.metadata;
        
        return event;
      });
    } catch (error) {
      throw new ApiError(500, `Erro ao buscar eventos da entidade: ${error.message}`);
    }
  }

  /**
   * Estatísticas de gamificação de um usuário
   * @param {number} userId - ID do usuário
   * @param {number} companyId - ID da empresa
   * @param {Object} options - Opções de período
   * @returns {Promise<Object>} Estatísticas
   */
  static async getStatsByUser(userId, companyId, options = {}) {
    const { 
      start_date = null,
      end_date = null
    } = options;
    
    let whereClause = `
      WHERE gh.user_id = $1 AND u.company_id = $2
    `;
    const params = [userId, companyId];
    
    if (start_date) {
      whereClause += ` AND gh.created_at >= $${params.length + 1}`;
      params.push(start_date);
    }

    if (end_date) {
      whereClause += ` AND gh.created_at <= $${params.length + 1}`;
      params.push(end_date);
    }

    const statsQuery = `
      SELECT 
        COUNT(*) as total_events,
        COALESCE(SUM(gh.points_awarded), 0) as total_points_awarded,
        COALESCE(SUM(gh.points_deducted), 0) as total_points_deducted,
        COALESCE(SUM(gh.points_awarded) - SUM(gh.points_deducted), 0) as net_points,
        COUNT(DISTINCT gh.event_type) as unique_event_types,
        COUNT(CASE WHEN gh.points_awarded > 0 THEN 1 END) as positive_events,
        COUNT(CASE WHEN gh.points_deducted > 0 THEN 1 END) as negative_events,
        COUNT(CASE WHEN gh.event_type = 'achievement_unlocked' THEN 1 END) as achievements_unlocked,
        COUNT(CASE WHEN gh.event_type = 'mission_completed' THEN 1 END) as missions_completed,
        COUNT(CASE WHEN gh.event_type = 'level_up' THEN 1 END) as level_ups,
        COUNT(CASE WHEN gh.event_type = 'reward_claimed' THEN 1 END) as rewards_claimed
      FROM polox.gamification_history gh
      INNER JOIN polox.users u ON gh.user_id = u.id
      ${whereClause}
    `;

    try {
      const result = await query(statsQuery, params, { companyId });
      const stats = result.rows[0];

      return {
        total_events: parseInt(stats.total_events) || 0,
        total_points_awarded: parseInt(stats.total_points_awarded) || 0,
        total_points_deducted: parseInt(stats.total_points_deducted) || 0,
        net_points: parseInt(stats.net_points) || 0,
        unique_event_types: parseInt(stats.unique_event_types) || 0,
        positive_events: parseInt(stats.positive_events) || 0,
        negative_events: parseInt(stats.negative_events) || 0,
        events_breakdown: {
          achievements_unlocked: parseInt(stats.achievements_unlocked) || 0,
          missions_completed: parseInt(stats.missions_completed) || 0,
          level_ups: parseInt(stats.level_ups) || 0,
          rewards_claimed: parseInt(stats.rewards_claimed) || 0
        }
      };
    } catch (error) {
      throw new ApiError(500, `Erro ao buscar estatísticas: ${error.message}`);
    }
  }

  /**
   * Ranking de usuários por pontos em um período
   * @param {number} companyId - ID da empresa
   * @param {Object} options - Opções de período e limite
   * @returns {Promise<Array>} Ranking de usuários
   */
  static async getPointsRanking(companyId, options = {}) {
    const { 
      start_date = null,
      end_date = null,
      limit = 20
    } = options;
    
    let whereClause = `
      WHERE u.company_id = $1
    `;
    const params = [companyId];
    
    if (start_date) {
      whereClause += ` AND gh.created_at >= $${params.length + 1}`;
      params.push(start_date);
    }

    if (end_date) {
      whereClause += ` AND gh.created_at <= $${params.length + 1}`;
      params.push(end_date);
    }

    const rankingQuery = `
      SELECT 
        u.id as user_id,
        u.full_name as user_name,
        u.email as user_email,
        u.avatar_url as user_avatar,
        COALESCE(SUM(gh.points_awarded), 0) as total_points_awarded,
        COALESCE(SUM(gh.points_deducted), 0) as total_points_deducted,
        COALESCE(SUM(gh.points_awarded) - SUM(gh.points_deducted), 0) as net_points,
        COUNT(gh.id) as total_events,
        up.level as current_level,
        up.total_points as total_lifetime_points
      FROM polox.users u
      LEFT JOIN polox.gamification_history gh ON u.id = gh.user_id
      LEFT JOIN polox.user_gamification_profiles up ON u.id = up.user_id
      ${whereClause}
      GROUP BY u.id, u.full_name, u.email, u.avatar_url, up.level, up.total_points
      HAVING COALESCE(SUM(gh.points_awarded) - SUM(gh.points_deducted), 0) > 0
      ORDER BY net_points DESC, total_events DESC
      LIMIT $${params.length + 1}
    `;

    params.push(limit);

    try {
      const result = await query(rankingQuery, params, { companyId });
      
      return result.rows.map((user, index) => ({
        ...user,
        rank: index + 1,
        total_points_awarded: parseInt(user.total_points_awarded) || 0,
        total_points_deducted: parseInt(user.total_points_deducted) || 0,
        net_points: parseInt(user.net_points) || 0,
        total_events: parseInt(user.total_events) || 0,
        total_lifetime_points: parseInt(user.total_lifetime_points) || 0
      }));
    } catch (error) {
      throw new ApiError(500, `Erro ao buscar ranking: ${error.message}`);
    }
  }

  /**
   * Estatísticas globais de gamificação da empresa
   * @param {number} companyId - ID da empresa
   * @param {Object} options - Opções de período
   * @returns {Promise<Object>} Estatísticas globais
   */
  static async getGlobalStats(companyId, options = {}) {
    const { 
      start_date = null,
      end_date = null
    } = options;
    
    let whereClause = `
      WHERE u.company_id = $1
    `;
    const params = [companyId];
    
    if (start_date) {
      whereClause += ` AND gh.created_at >= $${params.length + 1}`;
      params.push(start_date);
    }

    if (end_date) {
      whereClause += ` AND gh.created_at <= $${params.length + 1}`;
      params.push(end_date);
    }

    const globalStatsQuery = `
      SELECT 
        COUNT(DISTINCT u.id) as active_users,
        COUNT(gh.id) as total_events,
        COALESCE(SUM(gh.points_awarded), 0) as total_points_awarded,
        COALESCE(SUM(gh.points_deducted), 0) as total_points_deducted,
        COALESCE(AVG(gh.points_awarded), 0) as avg_points_per_event,
        COUNT(CASE WHEN gh.event_type = 'achievement_unlocked' THEN 1 END) as total_achievements,
        COUNT(CASE WHEN gh.event_type = 'mission_completed' THEN 1 END) as total_missions_completed,
        COUNT(CASE WHEN gh.event_type = 'level_up' THEN 1 END) as total_level_ups,
        COUNT(DISTINCT CASE WHEN gh.points_awarded > 0 THEN u.id END) as users_earning_points
      FROM polox.users u
      LEFT JOIN polox.gamification_history gh ON u.id = gh.user_id
      ${whereClause}
    `;

    try {
      const result = await query(globalStatsQuery, params, { companyId });
      const stats = result.rows[0];

      return {
        active_users: parseInt(stats.active_users) || 0,
        total_events: parseInt(stats.total_events) || 0,
        total_points_awarded: parseInt(stats.total_points_awarded) || 0,
        total_points_deducted: parseInt(stats.total_points_deducted) || 0,
        net_points: (parseInt(stats.total_points_awarded) || 0) - (parseInt(stats.total_points_deducted) || 0),
        avg_points_per_event: parseFloat(stats.avg_points_per_event) || 0,
        participation_rate: stats.active_users > 0 
          ? ((stats.users_earning_points / stats.active_users) * 100).toFixed(2)
          : 0,
        event_breakdown: {
          achievements: parseInt(stats.total_achievements) || 0,
          missions_completed: parseInt(stats.total_missions_completed) || 0,
          level_ups: parseInt(stats.total_level_ups) || 0
        }
      };
    } catch (error) {
      throw new ApiError(500, `Erro ao buscar estatísticas globais: ${error.message}`);
    }
  }

  /**
   * Lista eventos recentes da empresa
   * @param {number} companyId - ID da empresa
   * @param {number} limit - Limite de resultados (padrão: 20)
   * @returns {Promise<Array>} Lista de eventos recentes
   */
  static async findRecentEvents(companyId, limit = 20) {
    const selectQuery = `
      SELECT 
        gh.id, gh.user_id, gh.event_type, gh.points_awarded, gh.points_deducted,
        gh.description, gh.metadata, gh.related_entity_type, gh.related_entity_id,
        gh.created_at,
        u.full_name as user_name,
        u.avatar_url as user_avatar
      FROM polox.gamification_history gh
      INNER JOIN polox.users u ON gh.user_id = u.id
      WHERE u.company_id = $1
      ORDER BY gh.created_at DESC
      LIMIT $2
    `;

    try {
      const result = await query(selectQuery, [companyId, limit], { companyId });
      
      return result.rows.map(event => {
        // Parse JSON fields
        event.metadata = typeof event.metadata === 'string' 
          ? JSON.parse(event.metadata) 
          : event.metadata;
        
        return event;
      });
    } catch (error) {
      throw new ApiError(500, `Erro ao buscar eventos recentes: ${error.message}`);
    }
  }

  /**
   * Conta o total de eventos por usuário
   * @param {number} userId - ID do usuário
   * @param {number} companyId - ID da empresa
   * @param {Object} filters - Filtros opcionais
   * @returns {Promise<number>} Total de eventos
   */
  static async count(userId, companyId, filters = {}) {
    let whereClause = `
      WHERE gh.user_id = $1 AND u.company_id = $2
    `;
    const params = [userId, companyId];

    if (filters.event_type) {
      whereClause += ` AND gh.event_type = $${params.length + 1}`;
      params.push(filters.event_type);
    }

    if (filters.start_date) {
      whereClause += ` AND gh.created_at >= $${params.length + 1}`;
      params.push(filters.start_date);
    }

    if (filters.end_date) {
      whereClause += ` AND gh.created_at <= $${params.length + 1}`;
      params.push(filters.end_date);
    }

    const countQuery = `
      SELECT COUNT(*) as total
      FROM polox.gamification_history gh
      INNER JOIN polox.users u ON gh.user_id = u.id
      ${whereClause}
    `;

    try {
      const result = await query(countQuery, params, { companyId });
      return parseInt(result.rows[0].total);
    } catch (error) {
      throw new ApiError(500, `Erro ao contar eventos: ${error.message}`);
    }
  }
}

module.exports = GamificationHistoryModel;