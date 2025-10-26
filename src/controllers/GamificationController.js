/**
 * ==========================================
 * 🎮 GAMIFICATION CONTROLLER ENTERPRISE
 * ==========================================
 * 
 * Sistema completo de gamificação com:
 * - XP, Coins e Níveis
 * - Missões (diárias, semanais, mensais, one-time)
 * - Conquistas e Recompensas
 * - Ranking por empresa
 * - Histórico completo
 */

const { query, beginTransaction, commitTransaction, rollbackTransaction } = require('../models/database');
const { logger, auditLogger, securityLogger } = require('../utils/logger');
const { ApiError, asyncHandler } = require('../utils/errors');
const { successResponse, paginatedResponse } = require('../utils/formatters');
const { tc } = require('../config/i18n');
const Joi = require('joi');
const { v4: uuidv4 } = require('uuid');

class GamificationController {

  /**
   * 🔢 SISTEMA DE NÍVEIS - Fórmula progressiva
   */
  static calculateXPForLevel(level) {
    if (level <= 1) return 0;
    // Fórmula: level * 100 + (level - 1) * 50 progressivo
    return (level - 1) * 100 + ((level - 2) * (level - 1) / 2) * 50;
  }

  static calculateLevel(totalXP) {
    let level = 1;
    while (level <= 100 && GamificationController.calculateXPForLevel(level + 1) <= totalXP) {
      level++;
    }
    return level;
  }

  static getLevelInfo(totalXP) {
    const currentLevel = GamificationController.calculateLevel(totalXP);
    const currentLevelXP = GamificationController.calculateXPForLevel(currentLevel);
    const nextLevelXP = GamificationController.calculateXPForLevel(currentLevel + 1);
    const levelProgress = currentLevel >= 100 ? 100 : ((totalXP - currentLevelXP) / (nextLevelXP - currentLevelXP)) * 100;
    
    return {
      current_level: currentLevel,
      current_level_xp: currentLevelXP,
      next_level_xp: nextLevelXP,
      level_progress: Math.round(levelProgress),
      xp_to_next_level: Math.max(0, nextLevelXP - totalXP)
    };
  }

  /**
   * 📝 VALIDAÇÕES
   */
  static awardPointsSchema = Joi.object({
    user_id: Joi.string().uuid().optional(),
    xp_amount: Joi.number().integer().min(0).max(10000).default(0),
    coin_amount: Joi.number().integer().min(0).max(10000).default(0),
    reason: Joi.string().min(1).max(255).required(),
    action_type: Joi.string().valid(
      'login', 'first_login', 'task_completed', 'sale_made', 'client_created',
      'lead_converted', 'level_up', 'achievement_unlocked', 'mission_completed',
      'bonus', 'admin_award', 'other'
    ).default('other')
  });

  /**
   * 👤 PERFIL DE GAMIFICAÇÃO
   * GET /api/gamification/profile
   */
  static getProfile = asyncHandler(async (req, res) => {
    const profileQuery = `
      SELECT 
        ugp.*,
        u.full_name as user_name,
        u.position,
        COUNT(DISTINCT ua.id) as achievements_unlocked,
        COUNT(DISTINCT ur.id) as rewards_purchased,
        COUNT(DISTINCT ump.mission_id) as missions_completed,
        (
          SELECT COUNT(*) FROM achievements 
          WHERE company_id = $2 AND is_active = true
        ) as total_achievements_available,
        (
          SELECT COUNT(*) FROM missions 
          WHERE company_id = $2 AND is_active = true
        ) as total_missions_available
      FROM user_gamification_profiles ugp
      JOIN users u ON ugp.user_id = u.id
      LEFT JOIN user_achievements ua ON ugp.user_id = ua.user_id
      LEFT JOIN user_rewards ur ON ugp.user_id = ur.user_id
      LEFT JOIN user_mission_progress ump ON ugp.user_id = ump.user_id AND ump.is_completed = true
      WHERE ugp.user_id = $1 AND ugp.company_id = $2
      GROUP BY ugp.id, u.full_name, u.position
    `;

    const result = await query(profileQuery, [req.user.id, req.user.company_id]);
    
    if (result.rows.length === 0) {
      throw new ApiError(404, tc(req, 'gamificationController', 'validation.profile_not_found'));
    }

    const profile = result.rows[0];

    // Calcular informações de nível
    const levelInfo = GamificationController.getLevelInfo(profile.total_xp);

    // Atualizar nível se necessário
    if (levelInfo.current_level !== profile.current_level) {
      await query(
        'UPDATE user_gamification_profiles SET current_level = $1, updated_at = NOW() WHERE user_id = $2 AND company_id = $3',
        [levelInfo.current_level, req.user.id, req.user.company_id]
      );
      profile.current_level = levelInfo.current_level;
    }

    // Buscar posição no ranking
    const rankingQuery = `
      SELECT 
        rank,
        total_players
      FROM (
        SELECT 
          ugp.user_id,
          ugp.total_xp,
          ROW_NUMBER() OVER (ORDER BY ugp.total_xp DESC, ugp.current_level DESC, ugp.updated_at ASC) as rank,
          COUNT(*) OVER() as total_players
        FROM user_gamification_profiles ugp
        JOIN users u ON ugp.user_id = u.id
        WHERE ugp.company_id = $1 AND u.deleted_at IS NULL
      ) ranked
      WHERE user_id = $2
    `;

    const rankingResult = await query(rankingQuery, [req.user.company_id, req.user.id]);
    const ranking = rankingResult.rows[0] || { rank: 0, total_players: 0 };

    return successResponse(res, {
      ...profile,
      level_info: levelInfo,
      ranking: {
        current_rank: parseInt(ranking.rank),
        total_players: parseInt(ranking.total_players)
      },
      achievement_completion: profile.total_achievements_available > 0 
        ? Math.round((profile.achievements_unlocked / profile.total_achievements_available) * 100)
        : 0
    });
  });

  /**
   * 🎁 CONCEDER PONTOS (XP/Coins)
   * POST /api/gamification/award
   */
  static awardPoints = asyncHandler(async (req, res) => {
    const { error, value } = GamificationController.awardPointsSchema.validate(req.body);
    if (error) throw new ApiError(400, tc(req, 'gamificationController', 'validation.invalid_data'));

    const { user_id, xp_amount, coin_amount, reason, action_type } = value;
    const targetUserId = user_id || req.user.id;

    // Verificar permissões - apenas admins podem conceder pontos para outros usuários
    if (targetUserId !== req.user.id && !['company_admin', 'super_admin'].includes(req.user.role)) {
      throw new ApiError(403, tc(req, 'gamificationController', 'validation.admin_only'));
    }

    // Verificar se usuário existe na empresa
    const userCheck = await query(
      'SELECT id, full_name FROM users WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL',
      [targetUserId, req.user.company_id]
    );

    if (userCheck.rows.length === 0) {
      throw new ApiError(404, tc(req, 'gamificationController', 'validation.user_not_found'));
    }

    const targetUser = userCheck.rows[0];

    if (xp_amount === 0 && coin_amount === 0) {
      throw new ApiError(400, tc(req, 'gamificationController', 'validation.min_points_required'));
    }

    const client = await beginTransaction();
    
    try {
      // Atualizar perfil de gamificação
      const updateProfileQuery = `
        UPDATE user_gamification_profiles 
        SET 
          total_xp = total_xp + $1,
          current_coins = current_coins + $2,
          lifetime_coins = lifetime_coins + $2,
          updated_at = NOW()
        WHERE user_id = $3 AND company_id = $4
        RETURNING *
      `;

      const profileResult = await client.query(updateProfileQuery, [
        xp_amount, coin_amount, targetUserId, req.user.company_id
      ]);

      if (profileResult.rows.length === 0) {
        throw new ApiError(404, tc(req, 'gamificationController', 'validation.profile_not_found'));
      }

      const updatedProfile = profileResult.rows[0];

      // Registrar no histórico (XP e Coins separadamente)
      if (xp_amount > 0) {
        await client.query(`
          INSERT INTO gamification_history (
            id, user_id, company_id, type, amount, reason, action_type, 
            awarded_by_user_id, created_at
          ) VALUES ($1, $2, $3, 'xp', $4, $5, $6, $7, NOW())
        `, [uuidv4(), targetUserId, req.user.company_id, xp_amount, reason, action_type, req.user.id]);
      }

      if (coin_amount > 0) {
        await client.query(`
          INSERT INTO gamification_history (
            id, user_id, company_id, type, amount, reason, action_type,
            awarded_by_user_id, created_at
          ) VALUES ($1, $2, $3, 'coins', $4, $5, $6, $7, NOW())
        `, [uuidv4(), targetUserId, req.user.company_id, coin_amount, reason, action_type, req.user.id]);
      }

      // Verificar se subiu de nível
      const newLevel = GamificationController.calculateLevel(updatedProfile.total_xp);
      let leveledUp = false;
      let levelUpBonusCoins = 0;

      if (newLevel > updatedProfile.current_level) {
        await client.query(
          'UPDATE user_gamification_profiles SET current_level = $1 WHERE user_id = $2 AND company_id = $3',
          [newLevel, targetUserId, req.user.company_id]
        );
        
        leveledUp = true;
        
        // Bonus por subir de nível (10 coins por nível)
        levelUpBonusCoins = newLevel * 10;
        
        await client.query(
          'UPDATE user_gamification_profiles SET current_coins = current_coins + $1 WHERE user_id = $2 AND company_id = $3',
          [levelUpBonusCoins, targetUserId, req.user.company_id]
        );

        // Registrar bonus no histórico
        await client.query(`
          INSERT INTO gamification_history (
            id, user_id, company_id, type, amount, reason, action_type, created_at
          ) VALUES ($1, $2, $3, 'coins', $4, $5, 'level_up', NOW())
        `, [
          uuidv4(), targetUserId, req.user.company_id, 
          levelUpBonusCoins, `Level up bonus - Nível ${newLevel}`
        ]);
      }

      await commitTransaction(client);

      // Log de auditoria
      auditLogger(tc(req, 'gamificationController', 'audit.points_awarded', {
        xp: xp_amount,
        coins: coin_amount,
        userName: targetUser.name
      }), {
        awardedBy: req.user.id,
        targetUser: targetUserId,
        targetUserName: targetUser.name,
        xpAwarded: xp_amount,
        coinsAwarded: coin_amount,
        reason,
        actionType: action_type,
        leveledUp,
        newLevel,
        ip: req.ip
      });

      return successResponse(res, {
        awarded: { xp: xp_amount, coins: coin_amount },
        new_level: newLevel,
        leveled_up: leveledUp,
        level_up_bonus: leveledUp ? levelUpBonusCoins : 0,
        new_totals: {
          total_xp: updatedProfile.total_xp,
          current_coins: updatedProfile.current_coins + levelUpBonusCoins,
          current_level: newLevel
        },
        target_user: targetUser.name
      }, 'Pontos concedidos com sucesso');

    } catch (error) {
      await rollbackTransaction(client);
      throw error;
    }
  });

  /**
   * 🎯 LISTAR MISSÕES DISPONÍVEIS
   * GET /api/gamification/missions
   */
  static getMissions = asyncHandler(async (req, res) => {
    const today = new Date().toISOString().split('T')[0];
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const weekStartStr = weekStart.toISOString().split('T')[0];
    
    const monthStart = new Date();
    monthStart.setDate(1);
    const monthStartStr = monthStart.toISOString().split('T')[0];

    const missionsQuery = `
      SELECT 
        m.*,
        COALESCE(ump.current_count, 0) as current_count,
        COALESCE(ump.is_completed, false) as is_completed,
        ump.completed_at,
        ump.cycle_date,
        CASE 
          WHEN m.type = 'daily' THEN $3
          WHEN m.type = 'weekly' THEN $4  
          WHEN m.type = 'monthly' THEN $5
          ELSE NULL
        END as expected_cycle_date
      FROM missions m
      LEFT JOIN user_mission_progress ump ON m.id = ump.mission_id 
        AND ump.user_id = $1 
        AND (
          (m.type = 'daily' AND ump.cycle_date = $3) OR
          (m.type = 'weekly' AND ump.cycle_date = $4) OR
          (m.type = 'monthly' AND ump.cycle_date = $5) OR
          (m.type = 'one_time')
        )
      WHERE m.company_id = $2 AND m.is_active = true
      AND (m.starts_at IS NULL OR m.starts_at <= NOW())
      AND (m.ends_at IS NULL OR m.ends_at >= NOW())
      ORDER BY 
        CASE m.type 
          WHEN 'daily' THEN 1
          WHEN 'weekly' THEN 2  
          WHEN 'monthly' THEN 3
          WHEN 'one_time' THEN 4
        END,
        m.display_order NULLS LAST,
        m.name
    `;

    const result = await query(missionsQuery, [
      req.user.id, req.user.company_id, today, weekStartStr, monthStartStr
    ]);
    
    const missions = result.rows.map(mission => {
      const progressPercentage = mission.target_count > 0 
        ? Math.min(100, (mission.current_count / mission.target_count) * 100)
        : 0;

      return {
        ...mission,
        progress_percentage: Math.round(progressPercentage),
        remaining_count: Math.max(0, mission.target_count - mission.current_count),
        can_complete: mission.current_count >= mission.target_count && !mission.is_completed
      };
    });

    // Agrupar por tipo
    const groupedMissions = {
      daily: missions.filter(m => m.type === 'daily'),
      weekly: missions.filter(m => m.type === 'weekly'),
      monthly: missions.filter(m => m.type === 'monthly'),
      one_time: missions.filter(m => m.type === 'one_time')
    };

    return successResponse(res, {
      missions: groupedMissions,
      total_missions: missions.length,
      completed_today: missions.filter(m => m.is_completed && m.type === 'daily').length
    });
  });

  /**
   * ✅ COMPLETAR/PROGREDIR MISSÃO
   * POST /api/gamification/missions/:id/complete
   */
  static completeMission = asyncHandler(async (req, res) => {
    const missionId = req.params.id;
    const { progress_amount = 1 } = req.body;

    if (progress_amount < 1 || progress_amount > 100) {
      throw new ApiError(400, tc(req, 'gamificationController', 'validation.invalid_progress'));
    }

    // Buscar missão
    const missionQuery = `
      SELECT * FROM missions 
      WHERE id = $1 AND company_id = $2 AND is_active = true
      AND (starts_at IS NULL OR starts_at <= NOW())
      AND (ends_at IS NULL OR ends_at >= NOW())
    `;
    
    const missionResult = await query(missionQuery, [missionId, req.user.company_id]);
    
    if (missionResult.rows.length === 0) {
      throw new ApiError(404, tc(req, 'gamificationController', 'validation.mission_not_found'));
    }

    const mission = missionResult.rows[0];

    // Determinar data do ciclo
    let cycleDate;
    const today = new Date();
    
    switch (mission.type) {
      case 'daily':
        cycleDate = today.toISOString().split('T')[0];
        break;
      case 'weekly':
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - today.getDay());
        cycleDate = weekStart.toISOString().split('T')[0];
        break;
      case 'monthly':
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        cycleDate = monthStart.toISOString().split('T')[0];
        break;
      case 'one_time':
        cycleDate = null;
        break;
    }

    const client = await beginTransaction();
    
    try {
      // Verificar progresso atual
      const currentProgressQuery = `
        SELECT * FROM user_mission_progress
        WHERE user_id = $1 AND mission_id = $2 AND 
        (cycle_date = $3 OR (cycle_date IS NULL AND $3 IS NULL))
      `;

      const currentProgress = await client.query(currentProgressQuery, [
        req.user.id, missionId, cycleDate
      ]);

      if (currentProgress.rows.length > 0 && currentProgress.rows[0].is_completed) {
        throw new ApiError(400, tc(req, 'gamificationController', 'validation.mission_already_completed'));
      }

      // Atualizar ou criar progresso da missão
      const progressQuery = `
        INSERT INTO user_mission_progress (
          id, user_id, mission_id, cycle_date, current_count, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
        ON CONFLICT (user_id, mission_id, COALESCE(cycle_date, '1900-01-01'::date)) 
        DO UPDATE SET 
          current_count = user_mission_progress.current_count + $5,
          updated_at = NOW()
        RETURNING *
      `;

      const progressResult = await client.query(progressQuery, [
        uuidv4(), req.user.id, missionId, cycleDate, progress_amount
      ]);

      const progress = progressResult.rows[0];
      let missionCompleted = false;
      let rewardsEarned = null;

      // Verificar se missão foi completada
      if (!progress.is_completed && progress.current_count >= mission.target_count) {
        // Marcar como completada
        await client.query(`
          UPDATE user_mission_progress 
          SET is_completed = true, completed_at = NOW()
          WHERE id = $1
        `, [progress.id]);

        // Conceder recompensas
        if (mission.xp_reward > 0 || mission.coin_reward > 0) {
          await client.query(`
            UPDATE user_gamification_profiles 
            SET 
              total_xp = total_xp + $1,
              current_coins = current_coins + $2,
              lifetime_coins = lifetime_coins + $2
            WHERE user_id = $3 AND company_id = $4
          `, [mission.xp_reward, mission.coin_reward, req.user.id, req.user.company_id]);

          // Registrar recompensas no histórico
          if (mission.xp_reward > 0) {
            await client.query(`
              INSERT INTO gamification_history (
                id, user_id, company_id, type, amount, reason, action_type, created_at
              ) VALUES ($1, $2, $3, 'xp', $4, $5, 'mission_completed', NOW())
            `, [
              uuidv4(), req.user.id, req.user.company_id,
              mission.xp_reward, `Missão completada: ${mission.name}`
            ]);
          }

          if (mission.coin_reward > 0) {
            await client.query(`
              INSERT INTO gamification_history (
                id, user_id, company_id, type, amount, reason, action_type, created_at
              ) VALUES ($1, $2, $3, 'coins', $4, $5, 'mission_completed', NOW())
            `, [
              uuidv4(), req.user.id, req.user.company_id,
              mission.coin_reward, `Missão completada: ${mission.name}`
            ]);
          }
        }

        rewardsEarned = {
          xp: mission.xp_reward,
          coins: mission.coin_reward
        };
        missionCompleted = true;
      }

      await commitTransaction(client);

      // Log de auditoria
      auditLogger(tc(req, 'gamificationController', 'audit.mission_progress', {
        missionName: mission.name,
        progress: progress.current_count,
        target: mission.target_count
      }), {
        userId: req.user.id,
        missionId: mission.id,
        missionName: mission.name,
        progressAmount: progress_amount,
        totalProgress: progress.current_count,
        target: mission.target_count,
        completed: missionCompleted,
        cycleDate,
        ip: req.ip
      });

      return successResponse(res, {
        mission: {
          id: mission.id,
          name: mission.name,
          type: mission.type
        },
        progress: progress.current_count,
        target: mission.target_count,
        progress_percentage: Math.min(100, Math.round((progress.current_count / mission.target_count) * 100)),
        completed: missionCompleted,
        rewards_earned: rewardsEarned,
        cycle_date: cycleDate
      }, missionCompleted 
        ? tc(req, 'gamificationController', 'completeMission.completed') 
        : tc(req, 'gamificationController', 'completeMission.progress_updated')
      );

    } catch (error) {
      await rollbackTransaction(client);
      throw error;
    }
  });

  /**
   * 🏆 LISTAR CONQUISTAS DISPONÍVEIS
   * GET /api/gamification/achievements
   */
  static getAchievements = asyncHandler(async (req, res) => {
    const category = req.query.category;
    
    let whereClause = 'WHERE a.company_id = $1 AND a.is_active = true';
    const queryParams = [req.user.company_id];
    
    if (category) {
      whereClause += ` AND a.category = $2`;
      queryParams.push(category);
    }

    const achievementsQuery = `
      SELECT 
        a.*,
        ua.unlocked_at,
        CASE WHEN ua.id IS NOT NULL THEN true ELSE false END as is_unlocked
      FROM achievements a
      LEFT JOIN user_achievements ua ON a.id = ua.achievement_id AND ua.user_id = $${queryParams.length + 1}
      ${whereClause}
      ORDER BY 
        CASE WHEN ua.id IS NOT NULL THEN 1 ELSE 0 END DESC,
        a.category,
        a.display_order NULLS LAST,
        a.name
    `;

    queryParams.push(req.user.id);

    const result = await query(achievementsQuery, queryParams);
    
    const achievements = result.rows.map(achievement => ({
      ...achievement,
      unlock_criteria: JSON.parse(achievement.unlock_criteria || '{}')
    }));

    // Agrupar por categoria
    const groupedAchievements = {};
    achievements.forEach(achievement => {
      const cat = achievement.category || 'general';
      if (!groupedAchievements[cat]) {
        groupedAchievements[cat] = [];
      }
      groupedAchievements[cat].push(achievement);
    });

    const summary = {
      total_achievements: achievements.length,
      unlocked_achievements: achievements.filter(a => a.is_unlocked).length,
      completion_percentage: achievements.length > 0 
        ? Math.round((achievements.filter(a => a.is_unlocked).length / achievements.length) * 100)
        : 0
    };

    return successResponse(res, {
      achievements: groupedAchievements,
      summary
    });
  });

  /**
   * 🏆 CONQUISTAS DESBLOQUEADAS
   * GET /api/gamification/achievements/unlocked
   */
  static getUnlockedAchievements = asyncHandler(async (req, res) => {
    const unlockedQuery = `
      SELECT 
        a.*,
        ua.unlocked_at
      FROM user_achievements ua
      JOIN achievements a ON ua.achievement_id = a.id
      WHERE ua.user_id = $1 AND a.company_id = $2
      ORDER BY ua.unlocked_at DESC
    `;

    const result = await query(unlockedQuery, [req.user.id, req.user.company_id]);
    
    const achievements = result.rows.map(achievement => ({
      ...achievement,
      unlock_criteria: JSON.parse(achievement.unlock_criteria || '{}')
    }));

    return successResponse(res, achievements);
  });

  /**
   * 🏅 RANKING DA EMPRESA
   * GET /api/gamification/leaderboard
   */
  static getLeaderboard = asyncHandler(async (req, res) => {
    const period = req.query.period || 'all_time'; // all_time, monthly, weekly
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);

    let dateFilter = '';
    let periodName = 'Todos os Tempos';

    if (period === 'monthly') {
      dateFilter = "AND ugp.updated_at >= DATE_TRUNC('month', CURRENT_DATE)";
      periodName = 'Este Mês';
    } else if (period === 'weekly') {
      dateFilter = "AND ugp.updated_at >= DATE_TRUNC('week', CURRENT_DATE)";
      periodName = 'Esta Semana';
    }

    const leaderboardQuery = `
      SELECT 
        u.id, u.name, u.position,
        ugp.current_level, ugp.total_xp, ugp.current_coins,
        COUNT(DISTINCT ua.id) as achievements_count,
        COUNT(DISTINCT ump.mission_id) as missions_completed,
        ROW_NUMBER() OVER (ORDER BY ugp.total_xp DESC, ugp.current_level DESC, ugp.updated_at ASC) as rank
      FROM user_gamification_profiles ugp
      JOIN users u ON ugp.user_id = u.id
      LEFT JOIN user_achievements ua ON u.id = ua.user_id
      LEFT JOIN user_mission_progress ump ON u.id = ump.user_id AND ump.is_completed = true
      WHERE ugp.company_id = $1 AND u.deleted_at IS NULL ${dateFilter}
      GROUP BY u.id, u.full_name, u.position, ugp.current_level, ugp.total_xp, ugp.current_coins, ugp.updated_at
      ORDER BY ugp.total_xp DESC, ugp.current_level DESC, ugp.updated_at ASC
      LIMIT $2
    `;

    const result = await query(leaderboardQuery, [req.user.company_id, limit]);

    // Encontrar posição do usuário atual
    const currentUserRank = result.rows.findIndex(row => row.id === req.user.id);
    let currentUserPosition = null;

    if (currentUserRank === -1) {
      // Usuário não está no top, buscar sua posição
      const userRankQuery = `
        SELECT 
          rank,
          total_xp,
          current_level,
          total_players
        FROM (
          SELECT 
            u.id,
            ugp.total_xp,
            ugp.current_level,
            ROW_NUMBER() OVER (ORDER BY ugp.total_xp DESC, ugp.current_level DESC, ugp.updated_at ASC) as rank,
            COUNT(*) OVER() as total_players
          FROM user_gamification_profiles ugp
          JOIN users u ON ugp.user_id = u.id
          WHERE ugp.company_id = $1 AND u.deleted_at IS NULL ${dateFilter}
        ) ranked
        WHERE id = $2
      `;

      const userRankResult = await query(userRankQuery, [req.user.company_id, req.user.id]);
      if (userRankResult.rows.length > 0) {
        currentUserPosition = userRankResult.rows[0];
      }
    } else {
      currentUserPosition = {
        rank: currentUserRank + 1,
        total_xp: result.rows[currentUserRank].total_xp,
        current_level: result.rows[currentUserRank].current_level,
        total_players: result.rows.length
      };
    }

    // Estatísticas gerais
    const statsQuery = `
      SELECT 
        COUNT(DISTINCT ugp.user_id) as total_players,
        AVG(ugp.total_xp) as avg_xp,
        MAX(ugp.total_xp) as max_xp,
        AVG(ugp.current_level) as avg_level,
        MAX(ugp.current_level) as max_level
      FROM user_gamification_profiles ugp
      JOIN users u ON ugp.user_id = u.id
      WHERE ugp.company_id = $1 AND u.deleted_at IS NULL ${dateFilter}
    `;

    const statsResult = await query(statsQuery, [req.user.company_id]);
    const stats = statsResult.rows[0];

    return successResponse(res, {
      leaderboard: result.rows,
      current_user_position: currentUserPosition,
      period: {
        type: period,
        name: periodName
      },
      stats: {
        total_players: parseInt(stats.total_players) || 0,
        avg_xp: Math.round(parseFloat(stats.avg_xp) || 0),
        max_xp: parseInt(stats.max_xp) || 0,
        avg_level: Math.round(parseFloat(stats.avg_level) || 0),
        max_level: parseInt(stats.max_level) || 0
      }
    });
  });

  /**
   * 📈 HISTÓRICO DE PONTOS
   * GET /api/gamification/history
   */
  static getHistory = asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = (page - 1) * limit;
    const type = req.query.type; // 'xp' | 'coins'

    let whereClause = 'WHERE gh.user_id = $1 AND gh.company_id = $2';
    const queryParams = [req.user.id, req.user.company_id];

    if (type && ['xp', 'coins'].includes(type)) {
      whereClause += ` AND gh.type = $3`;
      queryParams.push(type);
    }

    const historyQuery = `
      SELECT 
        gh.*,
        u.full_name as awarded_by_name
      FROM gamification_history gh
      LEFT JOIN users u ON gh.awarded_by_user_id = u.id
      ${whereClause}
      ORDER BY gh.created_at DESC
      LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}
    `;

    queryParams.push(limit, offset);

    const countQuery = `
      SELECT COUNT(*) as total
      FROM gamification_history gh
      ${whereClause}
    `;

    const [historyResult, countResult] = await Promise.all([
      query(historyQuery, queryParams),
      query(countQuery, queryParams.slice(0, -2))
    ]);

    // Resumo por tipo
    const summaryQuery = `
      SELECT 
        type,
        SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) as total_gained,
        SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) as total_spent,
        COUNT(*) as total_transactions
      FROM gamification_history
      WHERE user_id = $1 AND company_id = $2
      GROUP BY type
    `;

    const summaryResult = await query(summaryQuery, [req.user.id, req.user.company_id]);

    return paginatedResponse(res, historyResult.rows, {
      page,
      limit,
      total: parseInt(countResult.rows[0].total),
      summary: summaryResult.rows
    });
  });

  /**
   * 🛍️ LOJA DE RECOMPENSAS
   * GET /api/gamification/rewards
   */
  static getRewards = asyncHandler(async (req, res) => {
    const category = req.query.category;
    
    let whereClause = 'WHERE r.company_id = $1 AND r.is_active = true';
    const queryParams = [req.user.company_id];
    
    if (category) {
      whereClause += ` AND r.category = $2`;
      queryParams.push(category);
    }

    const rewardsQuery = `
      SELECT 
        r.*,
        COUNT(ur.id) as times_purchased_by_user,
        COUNT(ur2.id) as total_purchases
      FROM rewards r
      LEFT JOIN user_rewards ur ON r.id = ur.reward_id AND ur.user_id = $${queryParams.length + 1}
      LEFT JOIN user_rewards ur2 ON r.id = ur2.reward_id
      ${whereClause}
      GROUP BY r.id
      ORDER BY r.category, r.coin_cost ASC, r.name
    `;

    queryParams.push(req.user.id);

    const result = await query(rewardsQuery, queryParams);

    // Buscar saldo atual do usuário
    const balanceQuery = `
      SELECT current_coins FROM user_gamification_profiles
      WHERE user_id = $1 AND company_id = $2
    `;

    const balanceResult = await query(balanceQuery, [req.user.id, req.user.company_id]);
    const currentCoins = balanceResult.rows[0]?.current_coins || 0;

    const rewards = result.rows.map(reward => ({
      ...reward,
      can_purchase: currentCoins >= reward.coin_cost && 
                   (reward.max_purchases_per_user === null || 
                    reward.times_purchased_by_user < reward.max_purchases_per_user),
      remaining_purchases: reward.max_purchases_per_user 
        ? Math.max(0, reward.max_purchases_per_user - reward.times_purchased_by_user)
        : null
    }));

    return successResponse(res, {
      rewards,
      user_balance: currentCoins
    });
  });

  /**
   * 🛒 COMPRAR RECOMPENSA
   * POST /api/gamification/rewards/:id/buy
   */
  static buyReward = asyncHandler(async (req, res) => {
    const rewardId = req.params.id;

    // Buscar recompensa
    const rewardQuery = `
      SELECT r.*, 
             COUNT(ur.id) as times_purchased_by_user
      FROM rewards r
      LEFT JOIN user_rewards ur ON r.id = ur.reward_id AND ur.user_id = $1
      WHERE r.id = $2 AND r.company_id = $3 AND r.is_active = true
      GROUP BY r.id
    `;

    const rewardResult = await query(rewardQuery, [req.user.id, rewardId, req.user.company_id]);
    
    if (rewardResult.rows.length === 0) {
      throw new ApiError(404, tc(req, 'gamificationController', 'validation.reward_not_found'));
    }

    const reward = rewardResult.rows[0];

    // Verificar se pode comprar
    if (reward.max_purchases_per_user && reward.times_purchased_by_user >= reward.max_purchases_per_user) {
      throw new ApiError(400, tc(req, 'gamificationController', 'validation.purchase_limit_reached'));
    }

    // Buscar saldo atual
    const balanceQuery = `
      SELECT current_coins FROM user_gamification_profiles
      WHERE user_id = $1 AND company_id = $2
    `;

    const balanceResult = await query(balanceQuery, [req.user.id, req.user.company_id]);
    const currentCoins = balanceResult.rows[0]?.current_coins || 0;

    if (currentCoins < reward.coin_cost) {
      throw new ApiError(400, tc(req, 'gamificationController', 'validation.insufficient_balance', {
        required: reward.coin_cost,
        current: currentCoins
      }));
    }

    const client = await beginTransaction();
    
    try {
      // Debitar coins
      await client.query(`
        UPDATE user_gamification_profiles
        SET current_coins = current_coins - $1
        WHERE user_id = $2 AND company_id = $3
      `, [reward.coin_cost, req.user.id, req.user.company_id]);

      // Registrar compra
      await client.query(`
        INSERT INTO user_rewards (id, user_id, reward_id, coin_cost_paid, purchased_at)
        VALUES ($1, $2, $3, $4, NOW())
      `, [uuidv4(), req.user.id, rewardId, reward.coin_cost]);

      // Registrar no histórico
      await client.query(`
        INSERT INTO gamification_history (
          id, user_id, company_id, type, amount, reason, action_type, created_at
        ) VALUES ($1, $2, $3, 'coins', $4, $5, 'reward_purchase', NOW())
      `, [
        uuidv4(), req.user.id, req.user.company_id,
        -reward.coin_cost, `Compra: ${reward.name}`
      ]);

      await commitTransaction(client);

      // Log de auditoria
      auditLogger(tc(req, 'gamificationController', 'audit.reward_purchased', {
        rewardName: reward.name,
        cost: reward.coin_cost
      }), {
        userId: req.user.id,
        rewardId: reward.id,
        rewardName: reward.name,
        coinCost: reward.coin_cost,
        remainingCoins: currentCoins - reward.coin_cost,
        ip: req.ip
      });

      return successResponse(res, {
        reward: {
          id: reward.id,
          name: reward.name,
          description: reward.description,
          coin_cost: reward.coin_cost
        },
        coins_spent: reward.coin_cost,
        remaining_coins: currentCoins - reward.coin_cost,
        purchased_at: new Date().toISOString()
      }, 'Recompensa comprada com sucesso!');

    } catch (error) {
      await rollbackTransaction(client);
      throw error;
    }
  });
}

module.exports = GamificationController;