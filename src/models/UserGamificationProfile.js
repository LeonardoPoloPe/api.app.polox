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
 * Model para perfis de gamificação dos usuários
 * Baseado no schema polox.user_gamification_profiles
 */
class UserGamificationProfileModel {
  /**
   * Cria ou atualiza perfil de gamificação do usuário
   * @param {number} userId - ID do usuário
   * @param {number} companyId - ID da empresa
   * @param {Object} profileData - Dados do perfil (opcional)
   * @returns {Promise<Object>} Perfil criado ou existente
   */
  static async createOrUpdate(userId, companyId, profileData = {}) {
    const {
      points = 0,
      level = 1,
      experience_points = 0,
      total_achievements = 0,
      current_streak = 0,
      longest_streak = 0,
      last_activity_date = new Date(),
      preferred_challenges = null,
      notification_preferences = { achievements: true, levels: true, rewards: true }
    } = profileData;

    return await transaction(async (client) => {
      // Verificar se perfil já existe
      const existingProfile = await client.query(
        'SELECT * FROM polox.user_gamification_profiles WHERE user_id = $1 AND company_id = $2',
        [userId, companyId]
      );

      if (existingProfile.rows.length > 0) {
        // Atualizar perfil existente
        const updateQuery = `
          UPDATE polox.user_gamification_profiles 
          SET 
            points = $3,
            level = $4,
            experience_points = $5,
            total_achievements = $6,
            current_streak = $7,
            longest_streak = $8,
            last_activity_date = $9,
            preferred_challenges = $10,
            notification_preferences = $11,
            updated_at = NOW()
          WHERE user_id = $1 AND company_id = $2
          RETURNING *
        `;

        const result = await client.query(updateQuery, [
          userId, companyId, points, level, experience_points,
          total_achievements, current_streak, longest_streak,
          last_activity_date, preferred_challenges, notification_preferences
        ]);

        return result.rows[0];
      } else {
        // Criar novo perfil
        const insertQuery = `
          INSERT INTO polox.user_gamification_profiles (
            user_id, company_id, points, level, experience_points,
            total_achievements, current_streak, longest_streak,
            last_activity_date, preferred_challenges, notification_preferences,
            created_at, updated_at
          )
          VALUES (
            $1, $2, $3, $4, $5,
            $6, $7, $8,
            $9, $10, $11,
            NOW(), NOW()
          )
          RETURNING *
        `;

        const result = await client.query(insertQuery, [
          userId, companyId, points, level, experience_points,
          total_achievements, current_streak, longest_streak,
          last_activity_date, preferred_challenges, notification_preferences
        ]);

        return result.rows[0];
      }
    }, { companyId });
  }

  /**
   * Busca perfil de gamificação por usuário
   * @param {number} userId - ID do usuário
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object|null>} Perfil encontrado ou null
   */
  static async findByUserId(userId, companyId) {
    const selectQuery = `
      SELECT 
        ugp.*,
        u.full_name as user_name,
        u.email as user_email,
        (SELECT COUNT(*) FROM polox.user_achievements WHERE user_id = ugp.user_id AND company_id = ugp.company_id) as total_unlocked_achievements,
        (SELECT COUNT(*) FROM polox.user_rewards WHERE user_id = ugp.user_id AND company_id = ugp.company_id AND redeemed_at IS NOT NULL) as total_redeemed_rewards,
        (SELECT COUNT(*) FROM polox.user_missions WHERE user_id = ugp.user_id AND company_id = ugp.company_id AND status = 'completed') as total_completed_missions
      FROM polox.user_gamification_profiles ugp
      LEFT JOIN polox.users u ON ugp.user_id = u.id
      WHERE ugp.user_id = $1 AND ugp.company_id = $2
    `;

    try {
      const result = await query(selectQuery, [userId, companyId], { companyId });
      return result.rows[0] || null;
    } catch (error) {
      throw new ApiError(500, `Erro ao buscar perfil de gamificação: ${error.message}`);
    }
  }

  /**
   * Lista perfis de gamificação com ranking
   * @param {Object} options - Opções de busca
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object>} Lista de perfis e metadados
   */
  static async listWithRanking(options = {}, companyId) {
    const {
      page = 1,
      limit = 10,
      sortBy = 'points',
      sortOrder = 'DESC',
      level_min = null,
      level_max = null,
      search = null
    } = options;

    const offset = (page - 1) * limit;
    const conditions = ['ugp.company_id = $1'];
    const values = [companyId];
    let paramCount = 2;

    // Adicionar filtros
    if (level_min) {
      conditions.push(`ugp.level >= $${paramCount}`);
      values.push(level_min);
      paramCount++;
    }

    if (level_max) {
      conditions.push(`ugp.level <= $${paramCount}`);
      values.push(level_max);
      paramCount++;
    }

    if (search) {
      conditions.push(`u.name ILIKE $${paramCount}`);
      values.push(`%${search}%`);
      paramCount++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Query para contar total
    const countQuery = `
      SELECT COUNT(*) 
      FROM polox.user_gamification_profiles ugp
      LEFT JOIN polox.users u ON ugp.user_id = u.id
      ${whereClause}
    `;

    // Query para buscar dados com ranking
    const selectQuery = `
      SELECT 
        ugp.*,
        u.full_name as user_name,
        u.email as user_email,
        ROW_NUMBER() OVER (ORDER BY ugp.${sortBy} ${sortOrder}) as ranking,
        (SELECT COUNT(*) FROM polox.user_achievements WHERE user_id = ugp.user_id AND company_id = ugp.company_id) as total_achievements_unlocked
      FROM polox.user_gamification_profiles ugp
      LEFT JOIN polox.users u ON ugp.user_id = u.id
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
      throw new ApiError(500, `Erro ao listar perfis de gamificação: ${error.message}`);
    }
  }

  /**
   * Adiciona pontos ao usuário
   * @param {number} userId - ID do usuário
   * @param {number} companyId - ID da empresa
   * @param {number} points - Pontos a adicionar
   * @param {string} reason - Motivo da pontuação
   * @returns {Promise<Object>} Perfil atualizado
   */
  static async addPoints(userId, companyId, points, reason = null) {
    if (points <= 0) {
      throw new ValidationError('Pontos devem ser maior que zero');
    }

    return await transaction(async (client) => {
      // Buscar perfil atual
      let profile = await client.query(
        'SELECT * FROM polox.user_gamification_profiles WHERE user_id = $1 AND company_id = $2',
        [userId, companyId]
      );

      if (profile.rows.length === 0) {
        // Criar perfil se não existir
        const createResult = await this.createOrUpdate(userId, companyId);
        profile = { rows: [createResult] };
      }

      const currentProfile = profile.rows[0];
      const newPoints = currentProfile.points + points;
      const newExperiencePoints = currentProfile.experience_points + points;

      // Calcular novo nível baseado na experiência
      const newLevel = this.calculateLevel(newExperiencePoints);

      // Atualizar perfil
      const updateQuery = `
        UPDATE polox.user_gamification_profiles 
        SET 
          points = $3,
          level = $4,
          experience_points = $5,
          last_activity_date = NOW(),
          updated_at = NOW()
        WHERE user_id = $1 AND company_id = $2
        RETURNING *
      `;

      const updateResult = await client.query(updateQuery, [
        userId, companyId, newPoints, newLevel, newExperiencePoints
      ]);

      // Registrar histórico de pontos
      await client.query(
        `INSERT INTO polox.point_history (user_id, company_id, points_earned, reason, earned_at)
         VALUES ($1, $2, $3, $4, NOW())`,
        [userId, companyId, points, reason]
      );

      return updateResult.rows[0];
    }, { companyId });
  }

  /**
   * Remove pontos do usuário
   * @param {number} userId - ID do usuário
   * @param {number} companyId - ID da empresa
   * @param {number} points - Pontos a remover
   * @param {string} reason - Motivo da remoção
   * @returns {Promise<Object>} Perfil atualizado
   */
  static async removePoints(userId, companyId, points, reason = null) {
    if (points <= 0) {
      throw new ValidationError('Pontos devem ser maior que zero');
    }

    return await transaction(async (client) => {
      // Buscar perfil atual
      const profile = await client.query(
        'SELECT * FROM polox.user_gamification_profiles WHERE user_id = $1 AND company_id = $2',
        [userId, companyId]
      );

      if (profile.rows.length === 0) {
        throw new NotFoundError('Perfil de gamificação não encontrado');
      }

      const currentProfile = profile.rows[0];
      const newPoints = Math.max(0, currentProfile.points - points);

      // Atualizar perfil
      const updateQuery = `
        UPDATE polox.user_gamification_profiles 
        SET 
          points = $3,
          last_activity_date = NOW(),
          updated_at = NOW()
        WHERE user_id = $1 AND company_id = $2
        RETURNING *
      `;

      const updateResult = await client.query(updateQuery, [userId, companyId, newPoints]);

      // Registrar histórico de pontos
      await client.query(
        `INSERT INTO polox.point_history (user_id, company_id, points_earned, reason, earned_at)
         VALUES ($1, $2, $3, $4, NOW())`,
        [userId, companyId, -points, reason]
      );

      return updateResult.rows[0];
    }, { companyId });
  }

  /**
   * Atualiza streak do usuário
   * @param {number} userId - ID do usuário
   * @param {number} companyId - ID da empresa
   * @param {boolean} incrementStreak - Se deve incrementar ou resetar streak
   * @returns {Promise<Object>} Perfil atualizado
   */
  static async updateStreak(userId, companyId, incrementStreak = true) {
    return await transaction(async (client) => {
      const profile = await client.query(
        'SELECT * FROM polox.user_gamification_profiles WHERE user_id = $1 AND company_id = $2',
        [userId, companyId]
      );

      if (profile.rows.length === 0) {
        throw new NotFoundError('Perfil de gamificação não encontrado');
      }

      const currentProfile = profile.rows[0];
      let newCurrentStreak = incrementStreak ? currentProfile.current_streak + 1 : 0;
      let newLongestStreak = Math.max(currentProfile.longest_streak, newCurrentStreak);

      const updateQuery = `
        UPDATE polox.user_gamification_profiles 
        SET 
          current_streak = $3,
          longest_streak = $4,
          last_activity_date = NOW(),
          updated_at = NOW()
        WHERE user_id = $1 AND company_id = $2
        RETURNING *
      `;

      const result = await client.query(updateQuery, [
        userId, companyId, newCurrentStreak, newLongestStreak
      ]);

      return result.rows[0];
    }, { companyId });
  }

  /**
   * Calcula nível baseado nos pontos de experiência
   * @param {number} experiencePoints - Pontos de experiência
   * @returns {number} Nível calculado
   */
  static calculateLevel(experiencePoints) {
    // Fórmula: Level = floor(sqrt(experiencePoints / 100)) + 1
    // Cada nível requer progressivamente mais pontos
    if (experiencePoints < 100) return 1;
    return Math.floor(Math.sqrt(experiencePoints / 100)) + 1;
  }

  /**
   * Calcula pontos necessários para o próximo nível
   * @param {number} currentLevel - Nível atual
   * @returns {number} Pontos necessários para próximo nível
   */
  static getPointsForNextLevel(currentLevel) {
    // Pontos necessários = (level^2) * 100
    return Math.pow(currentLevel, 2) * 100;
  }

  /**
   * Obtém histórico de pontos do usuário
   * @param {number} userId - ID do usuário
   * @param {number} companyId - ID da empresa
   * @param {Object} options - Opções de paginação
   * @returns {Promise<Object>} Histórico de pontos
   */
  static async getPointsHistory(userId, companyId, options = {}) {
    const {
      page = 1,
      limit = 10,
      date_from = null,
      date_to = null
    } = options;

    const offset = (page - 1) * limit;
    const conditions = ['user_id = $1', 'company_id = $2'];
    const values = [userId, companyId];
    let paramCount = 3;

    if (date_from) {
      conditions.push(`earned_at >= $${paramCount}`);
      values.push(date_from);
      paramCount++;
    }

    if (date_to) {
      conditions.push(`earned_at <= $${paramCount}`);
      values.push(date_to);
      paramCount++;
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const historyQuery = `
      SELECT 
        id, points_earned, reason, earned_at
      FROM polox.point_history
      ${whereClause}
      ORDER BY earned_at DESC
      LIMIT $${paramCount} OFFSET $${paramCount + 1}
    `;

    const countQuery = `
      SELECT COUNT(*) 
      FROM polox.point_history
      ${whereClause}
    `;

    try {
      const [historyResult, countResult] = await Promise.all([
        query(historyQuery, [...values, limit, offset], { companyId }),
        query(countQuery, values, { companyId })
      ]);

      const total = parseInt(countResult.rows[0].count);
      const totalPages = Math.ceil(total / limit);

      return {
        data: historyResult.rows,
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
      throw new ApiError(500, `Erro ao buscar histórico de pontos: ${error.message}`);
    }
  }

  /**
   * Obtém estatísticas de gamificação da empresa
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object>} Estatísticas de gamificação
   */
  static async getStats(companyId) {
    const statsQuery = `
      SELECT 
        COUNT(*) as total_profiles,
        COUNT(CASE WHEN last_activity_date >= NOW() - INTERVAL '7 days' THEN 1 END) as active_users_week,
        COUNT(CASE WHEN last_activity_date >= NOW() - INTERVAL '30 days' THEN 1 END) as active_users_month,
        COALESCE(AVG(points), 0) as average_points,
        COALESCE(AVG(level), 0) as average_level,
        COALESCE(AVG(experience_points), 0) as average_experience,
        COALESCE(MAX(points), 0) as highest_points,
        COALESCE(MAX(level), 0) as highest_level,
        COALESCE(MAX(current_streak), 0) as longest_current_streak,
        COALESCE(MAX(longest_streak), 0) as all_time_longest_streak,
        COALESCE(SUM(total_achievements), 0) as total_achievements_unlocked
      FROM polox.user_gamification_profiles 
      WHERE company_id = $1
    `;

    try {
      const result = await query(statsQuery, [companyId], { companyId });
      return result.rows[0];
    } catch (error) {
      throw new ApiError(500, `Erro ao obter estatísticas de gamificação: ${error.message}`);
    }
  }

  /**
   * Obtém leaderboard por pontos
   * @param {number} companyId - ID da empresa
   * @param {number} limit - Limite de usuários no ranking
   * @returns {Promise<Array>} Top usuários por pontos
   */
  static async getLeaderboard(companyId, limit = 10) {
    const leaderboardQuery = `
      SELECT 
        ugp.user_id,
        ugp.points,
        ugp.level,
        ugp.current_streak,
        u.full_name as user_name,
        u.email as user_email,
        ROW_NUMBER() OVER (ORDER BY ugp.points DESC) as ranking
      FROM polox.user_gamification_profiles ugp
      LEFT JOIN polox.users u ON ugp.user_id = u.id
      WHERE ugp.company_id = $1
      ORDER BY ugp.points DESC
      LIMIT $2
    `;

    try {
      const result = await query(leaderboardQuery, [companyId, limit], { companyId });
      return result.rows;
    } catch (error) {
      throw new ApiError(500, `Erro ao obter leaderboard: ${error.message}`);
    }
  }

  /**
   * Atualiza preferências de notificação
   * @param {number} userId - ID do usuário
   * @param {number} companyId - ID da empresa
   * @param {Object} preferences - Novas preferências
   * @returns {Promise<Object>} Perfil atualizado
   */
  static async updateNotificationPreferences(userId, companyId, preferences) {
    const updateQuery = `
      UPDATE polox.user_gamification_profiles 
      SET 
        notification_preferences = $3,
        updated_at = NOW()
      WHERE user_id = $1 AND company_id = $2
      RETURNING *
    `;

    try {
      const result = await query(updateQuery, [userId, companyId, preferences], { companyId });
      return result.rows[0] || null;
    } catch (error) {
      throw new ApiError(500, `Erro ao atualizar preferências: ${error.message}`);
    }
  }
}

module.exports = UserGamificationProfileModel;