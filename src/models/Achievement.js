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

/**
 * Model para conquistas/achievements do sistema de gamificação
 * Baseado no schema polox.achievements e polox.user_achievements
 */
class AchievementModel {
  /**
   * Cria uma nova conquista
   * @param {Object} achievementData - Dados da conquista
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object>} Conquista criada
   */
  static async create(achievementData, companyId) {
    const {
      name,
      description,
      icon = null,
      badge_color = '#FFD700',
      category = 'general',
      points_reward = 0,
      criteria_type,
      criteria_value,
      criteria_config = null,
      is_active = true,
      is_repeatable = false,
      rarity = 'common',
      unlock_message = null
    } = achievementData;

    // Validar dados obrigatórios
    if (!name) {
      throw new ValidationError('Nome da conquista é obrigatório');
    }

    if (!description) {
      throw new ValidationError('Descrição da conquista é obrigatória');
    }

    if (!criteria_type) {
      throw new ValidationError('Tipo de critério é obrigatório');
    }

    if (!criteria_value) {
      throw new ValidationError('Valor do critério é obrigatório');
    }

    const insertQuery = `
      INSERT INTO polox.achievements (
        company_id, name, description, icon, badge_color, category,
        points_reward, criteria_type, criteria_value, criteria_config,
        is_active, is_repeatable, rarity, unlock_message,
        created_at, updated_at
      )
      VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10,
        $11, $12, $13, $14,
        NOW(), NOW()
      )
      RETURNING 
        id, name, description, icon, badge_color, category,
        points_reward, criteria_type, criteria_value, is_active,
        is_repeatable, rarity, unlock_message, created_at, updated_at
    `;

    try {
      const result = await query(insertQuery, [
        companyId, name, description, icon, badge_color, category,
        points_reward, criteria_type, criteria_value, criteria_config,
        is_active, is_repeatable, rarity, unlock_message
      ], { companyId });

      return result.rows[0];
    } catch (error) {
      throw new ApiError(500, `Erro ao criar conquista: ${error.message}`);
    }
  }

  /**
   * Busca conquista por ID
   * @param {number} id - ID da conquista
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object|null>} Conquista encontrada ou null
   */
  static async findById(id, companyId) {
    const selectQuery = `
      SELECT 
        a.*,
        (SELECT COUNT(*) FROM polox.user_achievements WHERE achievement_id = a.id) as total_unlocks,
        (SELECT COUNT(DISTINCT user_id) FROM polox.user_achievements WHERE achievement_id = a.id) as unique_users_unlocked
      FROM polox.achievements a
      WHERE a.id = $1 AND a.company_id = $2 AND a.deleted_at IS NULL
    `;

    try {
      const result = await query(selectQuery, [id, companyId], { companyId });
      return result.rows[0] || null;
    } catch (error) {
      throw new ApiError(500, `Erro ao buscar conquista: ${error.message}`);
    }
  }

  /**
   * Lista conquistas com filtros e paginação
   * @param {Object} options - Opções de busca
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object>} Lista de conquistas e metadados
   */
  static async list(options = {}, companyId) {
    const {
      page = 1,
      limit = 10,
      category = null,
      is_active = null,
      rarity = null,
      is_repeatable = null,
      search = null,
      sortBy = 'created_at',
      sortOrder = 'DESC'
    } = options;

    const offset = (page - 1) * limit;
    const conditions = ['company_id = $1', 'deleted_at IS NULL'];
    const values = [companyId];
    let paramCount = 2;

    // Adicionar filtros
    if (category) {
      conditions.push(`category = $${paramCount}`);
      values.push(category);
      paramCount++;
    }

    if (is_active !== null) {
      conditions.push(`is_active = $${paramCount}`);
      values.push(is_active);
      paramCount++;
    }

    if (rarity) {
      conditions.push(`rarity = $${paramCount}`);
      values.push(rarity);
      paramCount++;
    }

    if (is_repeatable !== null) {
      conditions.push(`is_repeatable = $${paramCount}`);
      values.push(is_repeatable);
      paramCount++;
    }

    if (search) {
      conditions.push(`(name ILIKE $${paramCount} OR description ILIKE $${paramCount})`);
      values.push(`%${search}%`);
      paramCount++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Query para contar total
    const countQuery = `
      SELECT COUNT(*) 
      FROM polox.achievements 
      ${whereClause}
    `;

    // Query para buscar dados
    const selectQuery = `
      SELECT 
        id, name, description, icon, badge_color, category,
        points_reward, criteria_type, criteria_value, is_active,
        is_repeatable, rarity, unlock_message, created_at,
        (SELECT COUNT(*) FROM polox.user_achievements WHERE achievement_id = polox.achievements.id) as total_unlocks
      FROM polox.achievements
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
      throw new ApiError(500, `Erro ao listar conquistas: ${error.message}`);
    }
  }

  /**
   * Atualiza dados da conquista
   * @param {number} id - ID da conquista
   * @param {Object} updateData - Dados para atualizar
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object|null>} Conquista atualizada ou null
   */
  static async update(id, updateData, companyId) {
    const allowedFields = [
      'name', 'description', 'icon', 'badge_color', 'category',
      'points_reward', 'criteria_value', 'criteria_config',
      'is_active', 'is_repeatable', 'rarity', 'unlock_message'
    ];

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
      UPDATE polox.achievements 
      SET ${updates.join(', ')}
      WHERE id = $${paramCount} AND company_id = $${paramCount + 1} AND deleted_at IS NULL
      RETURNING 
        id, name, description, icon, badge_color, category,
        points_reward, is_active, is_repeatable, rarity,
        created_at, updated_at
    `;

    try {
      const result = await query(updateQuery, values, { companyId });
      return result.rows[0] || null;
    } catch (error) {
      throw new ApiError(500, `Erro ao atualizar conquista: ${error.message}`);
    }
  }

  /**
   * Desbloqueio de conquista para usuário
   * @param {number} userId - ID do usuário
   * @param {number} achievementId - ID da conquista
   * @param {number} companyId - ID da empresa
   * @param {Object} unlockData - Dados do desbloqueio
   * @returns {Promise<Object|null>} Desbloqueio criado ou null se já existe
   */
  static async unlockForUser(userId, achievementId, companyId, unlockData = {}) {
    const {
      progress_value = null,
      unlock_message = null
    } = unlockData;

    return await transaction(async (client) => {
      // Verificar se conquista existe e está ativa
      const achievement = await client.query(
        'SELECT * FROM polox.achievements WHERE id = $1 AND company_id = $2 AND is_active = TRUE AND deleted_at IS NULL',
        [achievementId, companyId]
      );

      if (achievement.rows.length === 0) {
        throw new NotFoundError('Conquista não encontrada ou inativa');
      }

      const achievementData = achievement.rows[0];

      // Verificar se usuário já desbloqueou (se não for repetível)
      if (!achievementData.is_repeatable) {
        const existingUnlock = await client.query(
          'SELECT id FROM polox.user_achievements WHERE user_id = $1 AND achievement_id = $2 AND company_id = $3',
          [userId, achievementId, companyId]
        );

        if (existingUnlock.rows.length > 0) {
          return null; // Já desbloqueada
        }
      }

      // Criar desbloqueio
      const unlockQuery = `
        INSERT INTO polox.user_achievements (
          user_id, achievement_id, company_id, progress_value,
          unlock_message, unlocked_at, created_at
        )
        VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
        RETURNING 
          id, user_id, achievement_id, progress_value,
          unlock_message, unlocked_at, created_at
      `;

      const unlockResult = await client.query(unlockQuery, [
        userId, achievementId, companyId, progress_value,
        unlock_message || achievementData.unlock_message
      ]);

      // Adicionar pontos ao usuário se especificado
      if (achievementData.points_reward > 0) {
        const UserGamificationProfileModel = require('./UserGamificationProfile');
        await UserGamificationProfileModel.addPoints(
          userId, 
          companyId, 
          achievementData.points_reward, 
          `Conquista desbloqueada: ${achievementData.name}`
        );
      }

      // Atualizar contador de conquistas no perfil
      await client.query(
        `UPDATE polox.user_gamification_profiles 
         SET total_achievements = total_achievements + 1, updated_at = NOW()
         WHERE user_id = $1 AND company_id = $2`,
        [userId, companyId]
      );

      return {
        ...unlockResult.rows[0],
        achievement: achievementData
      };
    }, { companyId });
  }

  /**
   * Verifica progresso e desbloqueios automáticos
   * @param {number} userId - ID do usuário
   * @param {number} companyId - ID da empresa
   * @param {string} criteriaType - Tipo de critério a verificar
   * @param {number} currentValue - Valor atual do progresso
   * @returns {Promise<Array>} Lista de conquistas desbloqueadas
   */
  static async checkAndUnlock(userId, companyId, criteriaType, currentValue) {
    const candidateAchievements = await query(
      `SELECT * FROM polox.achievements 
       WHERE company_id = $1 AND criteria_type = $2 AND is_active = TRUE AND deleted_at IS NULL
       AND criteria_value <= $3`,
      [companyId, criteriaType, currentValue],
      { companyId }
    );

    const newUnlocks = [];

    for (const achievement of candidateAchievements.rows) {
      const unlock = await this.unlockForUser(userId, achievement.id, companyId, {
        progress_value: currentValue
      });

      if (unlock) {
        newUnlocks.push(unlock);
      }
    }

    return newUnlocks;
  }

  /**
   * Obtém conquistas do usuário
   * @param {number} userId - ID do usuário
   * @param {number} companyId - ID da empresa
   * @param {Object} options - Opções de filtro
   * @returns {Promise<Object>} Conquistas do usuário
   */
  static async getUserAchievements(userId, companyId, options = {}) {
    const {
      page = 1,
      limit = 10,
      category = null,
      rarity = null,
      unlocked_only = false
    } = options;

    const offset = (page - 1) * limit;
    const conditions = ['a.company_id = $1', 'a.deleted_at IS NULL'];
    const values = [companyId];
    let paramCount = 2;

    if (category) {
      conditions.push(`a.category = $${paramCount}`);
      values.push(category);
      paramCount++;
    }

    if (rarity) {
      conditions.push(`a.rarity = $${paramCount}`);
      values.push(rarity);
      paramCount++;
    }

    if (unlocked_only) {
      conditions.push(`ua.user_id = $${paramCount}`);
      values.push(userId);
      paramCount++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const joinClause = unlocked_only ? 
      'INNER JOIN polox.user_achievements ua ON a.id = ua.achievement_id' :
      `LEFT JOIN polox.user_achievements ua ON a.id = ua.achievement_id AND ua.user_id = ${userId}`;

    const selectQuery = `
      SELECT 
        a.*,
        ua.unlocked_at,
        ua.progress_value,
        ua.unlock_message as user_unlock_message,
        CASE WHEN ua.id IS NOT NULL THEN true ELSE false END as is_unlocked
      FROM polox.achievements a
      ${joinClause}
      ${whereClause}
      ORDER BY 
        CASE WHEN ua.unlocked_at IS NOT NULL THEN ua.unlocked_at ELSE a.created_at END DESC
      LIMIT $${paramCount} OFFSET $${paramCount + 1}
    `;

    const countQuery = `
      SELECT COUNT(*) 
      FROM polox.achievements a
      ${joinClause}
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
      throw new ApiError(500, `Erro ao buscar conquistas do usuário: ${error.message}`);
    }
  }

  /**
   * Obtém estatísticas de conquistas
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object>} Estatísticas de conquistas
   */
  static async getStats(companyId) {
    const statsQuery = `
      SELECT 
        COUNT(*) as total_achievements,
        COUNT(CASE WHEN is_active = TRUE THEN 1 END) as active_achievements,
        COUNT(CASE WHEN is_repeatable = TRUE THEN 1 END) as repeatable_achievements,
        COUNT(CASE WHEN category = 'sales' THEN 1 END) as sales_achievements,
        COUNT(CASE WHEN category = 'social' THEN 1 END) as social_achievements,
        COUNT(CASE WHEN category = 'activity' THEN 1 END) as activity_achievements,
        COUNT(CASE WHEN rarity = 'common' THEN 1 END) as common_achievements,
        COUNT(CASE WHEN rarity = 'rare' THEN 1 END) as rare_achievements,
        COUNT(CASE WHEN rarity = 'epic' THEN 1 END) as epic_achievements,
        COUNT(CASE WHEN rarity = 'legendary' THEN 1 END) as legendary_achievements,
        COALESCE(AVG(points_reward), 0) as avg_points_reward,
        COALESCE(SUM(points_reward), 0) as total_points_available,
        (SELECT COUNT(*) FROM polox.user_achievements WHERE company_id = $1) as total_unlocks,
        (SELECT COUNT(DISTINCT user_id) FROM polox.user_achievements WHERE company_id = $1) as users_with_achievements
      FROM polox.achievements 
      WHERE company_id = $1 AND deleted_at IS NULL
    `;

    try {
      const result = await query(statsQuery, [companyId], { companyId });
      return result.rows[0];
    } catch (error) {
      throw new ApiError(500, `Erro ao obter estatísticas de conquistas: ${error.message}`);
    }
  }

  /**
   * Obtém conquistas mais desbloqueadas
   * @param {number} companyId - ID da empresa
   * @param {number} limit - Limite de resultados
   * @returns {Promise<Array>} Conquistas mais populares
   */
  static async getMostUnlocked(companyId, limit = 10) {
    const popularQuery = `
      SELECT 
        a.*,
        COUNT(ua.id) as unlock_count,
        COUNT(DISTINCT ua.user_id) as unique_users
      FROM polox.achievements a
      LEFT JOIN polox.user_achievements ua ON a.id = ua.achievement_id
      WHERE a.company_id = $1 AND a.deleted_at IS NULL
      GROUP BY a.id
      ORDER BY unlock_count DESC, unique_users DESC
      LIMIT $2
    `;

    try {
      const result = await query(popularQuery, [companyId, limit], { companyId });
      return result.rows;
    } catch (error) {
      throw new ApiError(500, `Erro ao buscar conquistas mais desbloqueadas: ${error.message}`);
    }
  }

  /**
   * Soft delete da conquista
   * @param {number} id - ID da conquista
   * @param {number} companyId - ID da empresa
   * @returns {Promise<boolean>} True se deletada com sucesso
   */
  static async softDelete(id, companyId) {
    const updateQuery = `
      UPDATE polox.achievements 
      SET 
        is_active = FALSE,
        deleted_at = NOW(),
        updated_at = NOW()
      WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL
    `;

    try {
      const result = await query(updateQuery, [id, companyId], { companyId });
      return result.rowCount > 0;
    } catch (error) {
      throw new ApiError(500, `Erro ao deletar conquista: ${error.message}`);
    }
  }

  /**
   * Ativa/desativa conquista
   * @param {number} id - ID da conquista
   * @param {boolean} isActive - Novo status
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object|null>} Conquista atualizada
   */
  static async toggleActive(id, isActive, companyId) {
    const updateQuery = `
      UPDATE polox.achievements 
      SET is_active = $3, updated_at = NOW()
      WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL
      RETURNING id, name, is_active, updated_at
    `;

    try {
      const result = await query(updateQuery, [id, companyId, isActive], { companyId });
      return result.rows[0] || null;
    } catch (error) {
      throw new ApiError(500, `Erro ao alterar status da conquista: ${error.message}`);
    }
  }
}

module.exports = AchievementModel;