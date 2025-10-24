const { query, transaction } = require('../config/database');
const { ApiError, ValidationError, NotFoundError } = require('../utils/errors');

/**
 * Model para conquistas dos usuários
 * Baseado no schema polox.user_achievements
 */
class UserAchievementModel {
  /**
   * Concede uma conquista para um usuário
   * @param {Object} achievementData - Dados da conquista
   * @returns {Promise<Object>} Conquista concedida
   */
  static async grant(achievementData) {
    const {
      user_id,
      achievement_id,
      progress = 100,
      metadata = {},
      granted_by_user_id = null
    } = achievementData;

    // Validar dados obrigatórios
    if (!user_id || !achievement_id) {
      throw new ValidationError('User ID e Achievement ID são obrigatórios');
    }

    if (progress < 0 || progress > 100) {
      throw new ValidationError('Progresso deve estar entre 0 e 100');
    }

    // Verificar se conquista já foi concedida
    const existingQuery = `
      SELECT id FROM polox.user_achievements 
      WHERE user_id = $1 AND achievement_id = $2 AND deleted_at IS NULL
    `;

    try {
      const existing = await query(existingQuery, [user_id, achievement_id]);
      if (existing.rows.length > 0) {
        throw new ValidationError('Conquista já foi concedida para este usuário');
      }

      const insertQuery = `
        INSERT INTO polox.user_achievements (
          user_id, achievement_id, progress, unlocked_at, metadata,
          granted_by_user_id, created_at, updated_at
        )
        VALUES (
          $1, $2, $3, 
          CASE WHEN $3 >= 100 THEN NOW() ELSE NULL END,
          $4, $5, NOW(), NOW()
        )
        RETURNING 
          id, user_id, achievement_id, progress, unlocked_at, metadata,
          granted_by_user_id, created_at, updated_at
      `;

      const result = await query(insertQuery, [
        user_id, achievement_id, progress,
        JSON.stringify(metadata), granted_by_user_id
      ]);

      const userAchievement = result.rows[0];
      
      // Parse metadata
      userAchievement.metadata = typeof userAchievement.metadata === 'string' 
        ? JSON.parse(userAchievement.metadata) 
        : userAchievement.metadata;

      return userAchievement;
    } catch (error) {
      if (error.code === '23503') {
        if (error.constraint?.includes('user')) {
          throw new ValidationError('Usuário informado não existe');
        }
        if (error.constraint?.includes('achievement')) {
          throw new ValidationError('Conquista informada não existe');
        }
      }
      throw new ApiError(500, `Erro ao conceder conquista: ${error.message}`);
    }
  }

  /**
   * Busca conquista de usuário por ID
   * @param {number} id - ID da conquista do usuário
   * @param {number} companyId - ID da empresa (multi-tenant)
   * @returns {Promise<Object|null>} Conquista encontrada ou null
   */
  static async findById(id, companyId) {
    const selectQuery = `
      SELECT 
        ua.id, ua.user_id, ua.achievement_id, ua.progress, ua.unlocked_at,
        ua.metadata, ua.granted_by_user_id, ua.created_at, ua.updated_at,
        a.title as achievement_title,
        a.description as achievement_description,
        a.icon as achievement_icon,
        a.points as achievement_points,
        a.category as achievement_category,
        a.rarity as achievement_rarity,
        u.full_name as user_name,
        u.email as user_email,
        gb.name as granted_by_name
      FROM polox.user_achievements ua
      INNER JOIN polox.users u ON ua.user_id = u.id
      INNER JOIN polox.achievements a ON ua.achievement_id = a.id
      LEFT JOIN polox.users gb ON ua.granted_by_user_id = gb.id
      WHERE ua.id = $1 AND u.company_id = $2 AND ua.deleted_at IS NULL
    `;

    try {
      const result = await query(selectQuery, [id, companyId], { companyId });
      const userAchievement = result.rows[0];
      
      if (userAchievement) {
        // Parse JSON fields
        userAchievement.metadata = typeof userAchievement.metadata === 'string' 
          ? JSON.parse(userAchievement.metadata) 
          : userAchievement.metadata;
      }

      return userAchievement || null;
    } catch (error) {
      throw new ApiError(500, `Erro ao buscar conquista: ${error.message}`);
    }
  }

  /**
   * Lista todas as conquistas de um usuário
   * @param {number} userId - ID do usuário
   * @param {number} companyId - ID da empresa
   * @param {Object} options - Opções de filtro
   * @returns {Promise<Array>} Lista de conquistas
   */
  static async findByUser(userId, companyId, options = {}) {
    const { 
      unlocked_only = false,
      category = null,
      rarity = null,
      page = 1, 
      limit = 50
    } = options;
    
    const offset = (page - 1) * limit;
    
    let whereClause = `
      WHERE ua.user_id = $1 AND u.company_id = $2 AND ua.deleted_at IS NULL
    `;
    const params = [userId, companyId];
    
    if (unlocked_only) {
      whereClause += ` AND ua.unlocked_at IS NOT NULL`;
    }

    if (category) {
      whereClause += ` AND a.category = $${params.length + 1}`;
      params.push(category);
    }

    if (rarity) {
      whereClause += ` AND a.rarity = $${params.length + 1}`;
      params.push(rarity);
    }

    const selectQuery = `
      SELECT 
        ua.id, ua.user_id, ua.achievement_id, ua.progress, ua.unlocked_at,
        ua.metadata, ua.granted_by_user_id, ua.created_at, ua.updated_at,
        a.title as achievement_title,
        a.description as achievement_description,
        a.icon as achievement_icon,
        a.points as achievement_points,
        a.category as achievement_category,
        a.rarity as achievement_rarity,
        a.requirements as achievement_requirements
      FROM polox.user_achievements ua
      INNER JOIN polox.users u ON ua.user_id = u.id
      INNER JOIN polox.achievements a ON ua.achievement_id = a.id
      ${whereClause}
      ORDER BY 
        ua.unlocked_at DESC NULLS LAST,
        CASE a.rarity 
          WHEN 'legendary' THEN 1
          WHEN 'epic' THEN 2
          WHEN 'rare' THEN 3
          WHEN 'uncommon' THEN 4
          WHEN 'common' THEN 5
          ELSE 6
        END,
        a.points DESC,
        ua.created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    params.push(limit, offset);

    try {
      const result = await query(selectQuery, params, { companyId });
      
      return result.rows.map(ua => {
        // Parse JSON fields
        ua.metadata = typeof ua.metadata === 'string' ? JSON.parse(ua.metadata) : ua.metadata;
        ua.achievement_requirements = typeof ua.achievement_requirements === 'string' 
          ? JSON.parse(ua.achievement_requirements) 
          : ua.achievement_requirements;
        
        return ua;
      });
    } catch (error) {
      throw new ApiError(500, `Erro ao buscar conquistas do usuário: ${error.message}`);
    }
  }

  /**
   * Lista usuários que possuem uma conquista específica
   * @param {number} achievementId - ID da conquista
   * @param {number} companyId - ID da empresa
   * @param {Object} options - Opções de filtro
   * @returns {Promise<Array>} Lista de usuários com a conquista
   */
  static async findByAchievement(achievementId, companyId, options = {}) {
    const { 
      unlocked_only = true,
      page = 1, 
      limit = 50
    } = options;
    
    const offset = (page - 1) * limit;
    
    let whereClause = `
      WHERE ua.achievement_id = $1 AND u.company_id = $2 AND ua.deleted_at IS NULL
    `;
    const params = [achievementId, companyId];
    
    if (unlocked_only) {
      whereClause += ` AND ua.unlocked_at IS NOT NULL`;
    }

    const selectQuery = `
      SELECT 
        ua.id, ua.user_id, ua.achievement_id, ua.progress, ua.unlocked_at,
        ua.metadata, ua.created_at,
        u.full_name as user_name,
        u.email as user_email,
        u.avatar_url as user_avatar,
        up.level as user_level,
        up.total_points as user_total_points
      FROM polox.user_achievements ua
      INNER JOIN polox.users u ON ua.user_id = u.id
      LEFT JOIN polox.user_gamification_profiles up ON u.id = up.user_id
      ${whereClause}
      ORDER BY ua.unlocked_at DESC, ua.progress DESC, ua.created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    params.push(limit, offset);

    try {
      const result = await query(selectQuery, params, { companyId });
      
      return result.rows.map(ua => {
        // Parse JSON fields
        ua.metadata = typeof ua.metadata === 'string' ? JSON.parse(ua.metadata) : ua.metadata;
        return ua;
      });
    } catch (error) {
      throw new ApiError(500, `Erro ao buscar usuários da conquista: ${error.message}`);
    }
  }

  /**
   * Atualiza o progresso de uma conquista
   * @param {number} userId - ID do usuário
   * @param {number} achievementId - ID da conquista
   * @param {number} progress - Novo progresso (0-100)
   * @param {Object} metadata - Metadados adicionais
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object>} Conquista atualizada
   */
  static async updateProgress(userId, achievementId, progress, metadata = {}, companyId) {
    if (progress < 0 || progress > 100) {
      throw new ValidationError('Progresso deve estar entre 0 e 100');
    }

    // Verificar se conquista existe
    const existingQuery = `
      SELECT ua.id, ua.progress, ua.unlocked_at
      FROM polox.user_achievements ua
      INNER JOIN polox.users u ON ua.user_id = u.id
      WHERE ua.user_id = $1 AND ua.achievement_id = $2 
        AND u.company_id = $3 AND ua.deleted_at IS NULL
    `;

    try {
      const existing = await query(existingQuery, [userId, achievementId, companyId]);
      
      if (existing.rows.length === 0) {
        throw new NotFoundError('Conquista não encontrada para este usuário');
      }

      const currentAchievement = existing.rows[0];
      
      // Se já está desbloqueada, não permitir reduzir progresso
      if (currentAchievement.unlocked_at && progress < 100) {
        throw new ValidationError('Não é possível reduzir progresso de conquista já desbloqueada');
      }

      const updateQuery = `
        UPDATE polox.user_achievements 
        SET 
          progress = $1,
          unlocked_at = CASE 
            WHEN $1 >= 100 AND unlocked_at IS NULL THEN NOW() 
            ELSE unlocked_at 
          END,
          metadata = $2,
          updated_at = NOW()
        WHERE user_id = $3 AND achievement_id = $4 AND deleted_at IS NULL
        RETURNING 
          id, user_id, achievement_id, progress, unlocked_at, metadata,
          granted_by_user_id, created_at, updated_at
      `;

      const result = await query(updateQuery, [
        progress, 
        JSON.stringify(metadata), 
        userId, 
        achievementId
      ]);

      const userAchievement = result.rows[0];
      
      // Parse metadata
      userAchievement.metadata = typeof userAchievement.metadata === 'string' 
        ? JSON.parse(userAchievement.metadata) 
        : userAchievement.metadata;

      return userAchievement;
    } catch (error) {
      throw new ApiError(500, `Erro ao atualizar progresso: ${error.message}`);
    }
  }

  /**
   * Remove uma conquista de um usuário (soft delete)
   * @param {number} userId - ID do usuário
   * @param {number} achievementId - ID da conquista
   * @param {number} companyId - ID da empresa
   * @returns {Promise<boolean>} True se removido com sucesso
   */
  static async revoke(userId, achievementId, companyId) {
    // Verificar se conquista existe
    const existingQuery = `
      SELECT ua.id
      FROM polox.user_achievements ua
      INNER JOIN polox.users u ON ua.user_id = u.id
      WHERE ua.user_id = $1 AND ua.achievement_id = $2 
        AND u.company_id = $3 AND ua.deleted_at IS NULL
    `;

    try {
      const existing = await query(existingQuery, [userId, achievementId, companyId]);
      
      if (existing.rows.length === 0) {
        throw new NotFoundError('Conquista não encontrada para este usuário');
      }

      const deleteQuery = `
        UPDATE polox.user_achievements 
        SET deleted_at = NOW()
        WHERE user_id = $1 AND achievement_id = $2 AND deleted_at IS NULL
      `;

      const result = await query(deleteQuery, [userId, achievementId]);
      return result.rowCount > 0;
    } catch (error) {
      throw new ApiError(500, `Erro ao revogar conquista: ${error.message}`);
    }
  }

  /**
   * Estatísticas de conquistas de um usuário
   * @param {number} userId - ID do usuário
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object>} Estatísticas
   */
  static async getStatsByUser(userId, companyId) {
    const statsQuery = `
      SELECT 
        COUNT(*) as total_achievements,
        COUNT(CASE WHEN ua.unlocked_at IS NOT NULL THEN 1 END) as unlocked_achievements,
        COUNT(CASE WHEN ua.progress < 100 THEN 1 END) as in_progress_achievements,
        COALESCE(AVG(ua.progress), 0) as average_progress,
        COUNT(CASE WHEN a.rarity = 'common' AND ua.unlocked_at IS NOT NULL THEN 1 END) as common_unlocked,
        COUNT(CASE WHEN a.rarity = 'uncommon' AND ua.unlocked_at IS NOT NULL THEN 1 END) as uncommon_unlocked,
        COUNT(CASE WHEN a.rarity = 'rare' AND ua.unlocked_at IS NOT NULL THEN 1 END) as rare_unlocked,
        COUNT(CASE WHEN a.rarity = 'epic' AND ua.unlocked_at IS NOT NULL THEN 1 END) as epic_unlocked,
        COUNT(CASE WHEN a.rarity = 'legendary' AND ua.unlocked_at IS NOT NULL THEN 1 END) as legendary_unlocked
      FROM polox.user_achievements ua
      INNER JOIN polox.users u ON ua.user_id = u.id
      INNER JOIN polox.achievements a ON ua.achievement_id = a.id
      WHERE ua.user_id = $1 AND u.company_id = $2 AND ua.deleted_at IS NULL
    `;

    try {
      const result = await query(statsQuery, [userId, companyId], { companyId });
      const stats = result.rows[0];

      return {
        total_achievements: parseInt(stats.total_achievements) || 0,
        unlocked_achievements: parseInt(stats.unlocked_achievements) || 0,
        in_progress_achievements: parseInt(stats.in_progress_achievements) || 0,
        average_progress: parseFloat(stats.average_progress) || 0,
        completion_rate: stats.total_achievements > 0 
          ? ((stats.unlocked_achievements / stats.total_achievements) * 100).toFixed(2)
          : 0,
        by_rarity: {
          common: parseInt(stats.common_unlocked) || 0,
          uncommon: parseInt(stats.uncommon_unlocked) || 0,
          rare: parseInt(stats.rare_unlocked) || 0,
          epic: parseInt(stats.epic_unlocked) || 0,
          legendary: parseInt(stats.legendary_unlocked) || 0
        }
      };
    } catch (error) {
      throw new ApiError(500, `Erro ao buscar estatísticas: ${error.message}`);
    }
  }

  /**
   * Lista conquistas recentes desbloqueadas
   * @param {number} companyId - ID da empresa
   * @param {number} days - Dias para buscar (padrão: 7)
   * @param {number} limit - Limite de resultados
   * @returns {Promise<Array>} Lista de conquistas recentes
   */
  static async findRecentUnlocked(companyId, days = 7, limit = 20) {
    const selectQuery = `
      SELECT 
        ua.id, ua.user_id, ua.achievement_id, ua.unlocked_at,
        ua.metadata, ua.progress,
        u.full_name as user_name,
        u.avatar_url as user_avatar,
        a.title as achievement_title,
        a.description as achievement_description,
        a.icon as achievement_icon,
        a.points as achievement_points,
        a.rarity as achievement_rarity
      FROM polox.user_achievements ua
      INNER JOIN polox.users u ON ua.user_id = u.id
      INNER JOIN polox.achievements a ON ua.achievement_id = a.id
      WHERE u.company_id = $1 
        AND ua.unlocked_at IS NOT NULL
        AND ua.unlocked_at >= (NOW() - INTERVAL '${days} days')
        AND ua.deleted_at IS NULL
      ORDER BY ua.unlocked_at DESC
      LIMIT $2
    `;

    try {
      const result = await query(selectQuery, [companyId, limit], { companyId });
      
      return result.rows.map(ua => {
        // Parse JSON fields
        ua.metadata = typeof ua.metadata === 'string' ? JSON.parse(ua.metadata) : ua.metadata;
        return ua;
      });
    } catch (error) {
      throw new ApiError(500, `Erro ao buscar conquistas recentes: ${error.message}`);
    }
  }

  /**
   * Conta o total de conquistas por usuário
   * @param {number} userId - ID do usuário
   * @param {number} companyId - ID da empresa
   * @param {Object} filters - Filtros opcionais
   * @returns {Promise<number>} Total de conquistas
   */
  static async count(userId, companyId, filters = {}) {
    let whereClause = `
      WHERE ua.user_id = $1 AND u.company_id = $2 AND ua.deleted_at IS NULL
    `;
    const params = [userId, companyId];

    if (filters.unlocked_only) {
      whereClause += ` AND ua.unlocked_at IS NOT NULL`;
    }

    if (filters.category) {
      whereClause += ` AND a.category = $${params.length + 1}`;
      params.push(filters.category);
    }

    if (filters.rarity) {
      whereClause += ` AND a.rarity = $${params.length + 1}`;
      params.push(filters.rarity);
    }

    const countQuery = `
      SELECT COUNT(*) as total
      FROM polox.user_achievements ua
      INNER JOIN polox.users u ON ua.user_id = u.id
      INNER JOIN polox.achievements a ON ua.achievement_id = a.id
      ${whereClause}
    `;

    try {
      const result = await query(countQuery, params, { companyId });
      return parseInt(result.rows[0].total);
    } catch (error) {
      throw new ApiError(500, `Erro ao contar conquistas: ${error.message}`);
    }
  }
}

module.exports = UserAchievementModel;