const { query, transaction } = require('../config/database');
const { ApiError, ValidationError, NotFoundError } = require('../utils/errors');

/**
 * Model para missões do sistema de gamificação
 * Baseado no schema polox.missions e polox.user_missions
 */
class MissionModel {
  /**
   * Cria uma nova missão
   * @param {Object} missionData - Dados da missão
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object>} Missão criada
   */
  static async create(missionData, companyId) {
    const {
      name,
      description,
      type = 'daily',
      category = 'general',
      objective,
      target_value,
      current_progress = 0,
      points_reward,
      bonus_reward = null,
      start_date = new Date(),
      end_date = null,
      is_active = true,
      difficulty = 'medium',
      icon = null,
      instructions = null,
      auto_assign = true,
      prerequisite_missions = null
    } = missionData;

    // Validar dados obrigatórios
    if (!name) {
      throw new ValidationError('Nome da missão é obrigatório');
    }

    if (!description) {
      throw new ValidationError('Descrição da missão é obrigatória');
    }

    if (!type || !['daily', 'weekly', 'monthly', 'one_time', 'recurring'].includes(type)) {
      throw new ValidationError('Tipo deve ser: daily, weekly, monthly, one_time ou recurring');
    }

    if (!objective) {
      throw new ValidationError('Objetivo da missão é obrigatório');
    }

    if (!target_value || target_value <= 0) {
      throw new ValidationError('Valor alvo deve ser maior que zero');
    }

    if (!points_reward || points_reward <= 0) {
      throw new ValidationError('Recompensa em pontos deve ser maior que zero');
    }

    const insertQuery = `
      INSERT INTO polox.missions (
        company_id, name, description, type, category, objective,
        target_value, current_progress, points_reward, bonus_reward,
        start_date, end_date, is_active, difficulty, icon,
        instructions, auto_assign, prerequisite_missions,
        created_at, updated_at
      )
      VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10,
        $11, $12, $13, $14, $15,
        $16, $17, $18,
        NOW(), NOW()
      )
      RETURNING 
        id, name, description, type, category, objective,
        target_value, current_progress, points_reward, bonus_reward,
        start_date, end_date, is_active, difficulty,
        auto_assign, created_at, updated_at
    `;

    try {
      const result = await query(insertQuery, [
        companyId, name, description, type, category, objective,
        target_value, current_progress, points_reward, bonus_reward,
        start_date, end_date, is_active, difficulty, icon,
        instructions, auto_assign, prerequisite_missions
      ], { companyId });

      return result.rows[0];
    } catch (error) {
      throw new ApiError(500, `Erro ao criar missão: ${error.message}`);
    }
  }

  /**
   * Busca missão por ID
   * @param {number} id - ID da missão
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object|null>} Missão encontrada ou null
   */
  static async findById(id, companyId) {
    const selectQuery = `
      SELECT 
        m.*,
        (SELECT COUNT(*) FROM polox.user_missions WHERE mission_id = m.id) as total_assigned,
        (SELECT COUNT(*) FROM polox.user_missions WHERE mission_id = m.id AND status = 'completed') as total_completed,
        (SELECT COUNT(DISTINCT user_id) FROM polox.user_missions WHERE mission_id = m.id) as unique_users_assigned
      FROM polox.missions m
      WHERE m.id = $1 AND m.company_id = $2 AND m.deleted_at IS NULL
    `;

    try {
      const result = await query(selectQuery, [id, companyId], { companyId });
      return result.rows[0] || null;
    } catch (error) {
      throw new ApiError(500, `Erro ao buscar missão: ${error.message}`);
    }
  }

  /**
   * Lista missões com filtros e paginação
   * @param {Object} options - Opções de busca
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object>} Lista de missões e metadados
   */
  static async list(options = {}, companyId) {
    const {
      page = 1,
      limit = 10,
      type = null,
      category = null,
      is_active = null,
      difficulty = null,
      active_only = false,
      search = null,
      sortBy = 'created_at',
      sortOrder = 'DESC'
    } = options;

    const offset = (page - 1) * limit;
    const conditions = ['company_id = $1', 'deleted_at IS NULL'];
    const values = [companyId];
    let paramCount = 2;

    // Adicionar filtros
    if (type) {
      conditions.push(`type = $${paramCount}`);
      values.push(type);
      paramCount++;
    }

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

    if (difficulty) {
      conditions.push(`difficulty = $${paramCount}`);
      values.push(difficulty);
      paramCount++;
    }

    if (active_only) {
      conditions.push('start_date <= NOW()');
      conditions.push('(end_date IS NULL OR end_date >= NOW())');
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
      FROM polox.missions 
      ${whereClause}
    `;

    // Query para buscar dados
    const selectQuery = `
      SELECT 
        id, name, description, type, category, objective,
        target_value, points_reward, bonus_reward, start_date,
        end_date, is_active, difficulty, icon, auto_assign,
        created_at,
        (SELECT COUNT(*) FROM polox.user_missions WHERE mission_id = polox.missions.id) as total_assigned,
        (SELECT COUNT(*) FROM polox.user_missions WHERE mission_id = polox.missions.id AND status = 'completed') as total_completed,
        CASE 
          WHEN start_date <= NOW() AND (end_date IS NULL OR end_date >= NOW()) THEN true
          ELSE false
        END as is_currently_active
      FROM polox.missions
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
      throw new ApiError(500, `Erro ao listar missões: ${error.message}`);
    }
  }

  /**
   * Atualiza dados da missão
   * @param {number} id - ID da missão
   * @param {Object} updateData - Dados para atualizar
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object|null>} Missão atualizada ou null
   */
  static async update(id, updateData, companyId) {
    const allowedFields = [
      'name', 'description', 'category', 'objective', 'target_value',
      'points_reward', 'bonus_reward', 'start_date', 'end_date',
      'is_active', 'difficulty', 'icon', 'instructions', 'auto_assign'
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
      UPDATE polox.missions 
      SET ${updates.join(', ')}
      WHERE id = $${paramCount} AND company_id = $${paramCount + 1} AND deleted_at IS NULL
      RETURNING 
        id, name, description, type, category, objective,
        target_value, points_reward, is_active, difficulty,
        start_date, end_date, created_at, updated_at
    `;

    try {
      const result = await query(updateQuery, values, { companyId });
      return result.rows[0] || null;
    } catch (error) {
      throw new ApiError(500, `Erro ao atualizar missão: ${error.message}`);
    }
  }

  /**
   * Atribui missão a usuário
   * @param {number} userId - ID do usuário
   * @param {number} missionId - ID da missão
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object|null>} Atribuição criada ou null se já existe
   */
  static async assignToUser(userId, missionId, companyId) {
    return await transaction(async (client) => {
      // Verificar se missão existe e está ativa
      const mission = await client.query(
        'SELECT * FROM polox.missions WHERE id = $1 AND company_id = $2 AND is_active = TRUE AND deleted_at IS NULL',
        [missionId, companyId]
      );

      if (mission.rows.length === 0) {
        throw new NotFoundError('Missão não encontrada ou inativa');
      }

      const missionData = mission.rows[0];

      // Verificar se já está atribuída
      const existingAssignment = await client.query(
        'SELECT id FROM polox.user_missions WHERE user_id = $1 AND mission_id = $2 AND company_id = $3',
        [userId, missionId, companyId]
      );

      if (existingAssignment.rows.length > 0) {
        return null; // Já atribuída
      }

      // Verificar pré-requisitos se existirem
      if (missionData.prerequisite_missions) {
        const prerequisiteCheck = await client.query(
          `SELECT COUNT(*) as completed 
           FROM polox.user_missions 
           WHERE user_id = $1 AND company_id = $2 AND status = 'completed'
           AND mission_id = ANY($3::int[])`,
          [userId, companyId, missionData.prerequisite_missions]
        );

        const completedPrerequisites = parseInt(prerequisiteCheck.rows[0].completed);
        if (completedPrerequisites < missionData.prerequisite_missions.length) {
          throw new ValidationError('Pré-requisitos não atendidos para esta missão');
        }
      }

      // Calcular data de expiração baseada no tipo
      let expiresAt = null;
      const now = new Date();
      
      switch (missionData.type) {
        case 'daily':
          expiresAt = new Date(now);
          expiresAt.setDate(expiresAt.getDate() + 1);
          expiresAt.setHours(23, 59, 59, 999);
          break;
        case 'weekly':
          expiresAt = new Date(now);
          expiresAt.setDate(expiresAt.getDate() + (7 - expiresAt.getDay()));
          expiresAt.setHours(23, 59, 59, 999);
          break;
        case 'monthly':
          expiresAt = new Date(now.getFullYear(), now.getMonth() + 1, 0);
          expiresAt.setHours(23, 59, 59, 999);
          break;
        default:
          expiresAt = missionData.end_date;
          break;
      }

      // Criar atribuição
      const assignQuery = `
        INSERT INTO polox.user_missions (
          user_id, mission_id, company_id, status, current_progress,
          target_value, expires_at, assigned_at, created_at
        )
        VALUES ($1, $2, $3, 'assigned', 0, $4, $5, NOW(), NOW())
        RETURNING 
          id, user_id, mission_id, status, current_progress,
          target_value, expires_at, assigned_at, created_at
      `;

      const result = await client.query(assignQuery, [
        userId, missionId, companyId, missionData.target_value, expiresAt
      ]);

      return {
        ...result.rows[0],
        mission: missionData
      };
    }, { companyId });
  }

  /**
   * Atualiza progresso da missão do usuário
   * @param {number} userId - ID do usuário
   * @param {number} missionId - ID da missão
   * @param {number} companyId - ID da empresa
   * @param {number} progressIncrement - Incremento no progresso
   * @returns {Promise<Object|null>} Missão do usuário atualizada
   */
  static async updateUserProgress(userId, missionId, companyId, progressIncrement = 1) {
    return await transaction(async (client) => {
      // Buscar missão do usuário
      const userMission = await client.query(
        'SELECT * FROM polox.user_missions WHERE user_id = $1 AND mission_id = $2 AND company_id = $3 AND status IN (\'assigned\', \'in_progress\')',
        [userId, missionId, companyId]
      );

      if (userMission.rows.length === 0) {
        return null; // Missão não encontrada ou já completada
      }

      const userMissionData = userMission.rows[0];
      const newProgress = userMissionData.current_progress + progressIncrement;
      const isCompleted = newProgress >= userMissionData.target_value;

      // Atualizar progresso
      const updateQuery = `
        UPDATE polox.user_missions 
        SET 
          current_progress = $3,
          status = $4,
          completed_at = $5,
          updated_at = NOW()
        WHERE user_id = $1 AND mission_id = $2 AND company_id = $6
        RETURNING *
      `;

      const status = isCompleted ? 'completed' : 'in_progress';
      const completedAt = isCompleted ? new Date() : null;

      const updateResult = await client.query(updateQuery, [
        userId, missionId, newProgress, status, completedAt, companyId
      ]);

      // Se completada, dar recompensas
      if (isCompleted) {
        const mission = await client.query(
          'SELECT * FROM polox.missions WHERE id = $1 AND company_id = $2',
          [missionId, companyId]
        );

        if (mission.rows.length > 0) {
          const missionData = mission.rows[0];
          
          // Adicionar pontos
          const UserGamificationProfileModel = require('./UserGamificationProfile');
          await UserGamificationProfileModel.addPoints(
            userId, 
            companyId, 
            missionData.points_reward, 
            `Missão completada: ${missionData.name}`
          );

          // Processar recompensa bônus se existir
          if (missionData.bonus_reward) {
            // Aqui pode ser implementada lógica para diferentes tipos de bônus
            // Por exemplo, conquistas automáticas, recompensas especiais, etc.
          }
        }
      }

      return updateResult.rows[0];
    }, { companyId });
  }

  /**
   * Obtém missões do usuário
   * @param {number} userId - ID do usuário
   * @param {number} companyId - ID da empresa
   * @param {Object} options - Opções de filtro
   * @returns {Promise<Object>} Missões do usuário
   */
  static async getUserMissions(userId, companyId, options = {}) {
    const {
      page = 1,
      limit = 10,
      status = null,
      type = null,
      category = null,
      active_only = false
    } = options;

    const offset = (page - 1) * limit;
    const conditions = ['um.user_id = $1', 'um.company_id = $2'];
    const values = [userId, companyId];
    let paramCount = 3;

    if (status) {
      conditions.push(`um.status = $${paramCount}`);
      values.push(status);
      paramCount++;
    }

    if (type) {
      conditions.push(`m.type = $${paramCount}`);
      values.push(type);
      paramCount++;
    }

    if (category) {
      conditions.push(`m.category = $${paramCount}`);
      values.push(category);
      paramCount++;
    }

    if (active_only) {
      conditions.push('(um.expires_at IS NULL OR um.expires_at > NOW())');
      conditions.push('um.status IN (\'assigned\', \'in_progress\')');
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const selectQuery = `
      SELECT 
        um.*,
        m.name as mission_name,
        m.description as mission_description,
        m.type as mission_type,
        m.category as mission_category,
        m.difficulty as mission_difficulty,
        m.points_reward,
        m.bonus_reward,
        m.icon as mission_icon,
        m.instructions,
        CASE 
          WHEN um.expires_at IS NOT NULL AND um.expires_at <= NOW() THEN true
          ELSE false
        END as is_expired,
        CASE 
          WHEN um.current_progress >= um.target_value THEN 100
          ELSE ROUND((um.current_progress::float / um.target_value::float) * 100, 2)
        END as progress_percentage
      FROM polox.user_missions um
      LEFT JOIN polox.missions m ON um.mission_id = m.id
      ${whereClause}
      ORDER BY 
        CASE WHEN um.status = 'assigned' THEN 1
             WHEN um.status = 'in_progress' THEN 2
             WHEN um.status = 'completed' THEN 3
             ELSE 4 END,
        um.assigned_at DESC
      LIMIT $${paramCount} OFFSET $${paramCount + 1}
    `;

    const countQuery = `
      SELECT COUNT(*) 
      FROM polox.user_missions um
      LEFT JOIN polox.missions m ON um.mission_id = m.id
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
      throw new ApiError(500, `Erro ao buscar missões do usuário: ${error.message}`);
    }
  }

  /**
   * Auto-atribui missões elegíveis para usuário
   * @param {number} userId - ID do usuário
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Array>} Missões atribuídas
   */
  static async autoAssignMissions(userId, companyId) {
    const eligibleMissions = await query(
      `SELECT * FROM polox.missions 
       WHERE company_id = $1 
         AND is_active = TRUE 
         AND auto_assign = TRUE 
         AND deleted_at IS NULL
         AND start_date <= NOW()
         AND (end_date IS NULL OR end_date >= NOW())
         AND id NOT IN (
           SELECT mission_id FROM polox.user_missions 
           WHERE user_id = $2 AND company_id = $1
         )`,
      [companyId, userId],
      { companyId }
    );

    const assignedMissions = [];

    for (const mission of eligibleMissions.rows) {
      try {
        const assignment = await this.assignToUser(userId, mission.id, companyId);
        if (assignment) {
          assignedMissions.push(assignment);
        }
      } catch (error) {
        // Log error but continue with other missions
        console.error(`Erro ao auto-atribuir missão ${mission.id} para usuário ${userId}:`, error.message);
      }
    }

    return assignedMissions;
  }

  /**
   * Obtém estatísticas de missões
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object>} Estatísticas de missões
   */
  static async getStats(companyId) {
    const statsQuery = `
      SELECT 
        COUNT(*) as total_missions,
        COUNT(CASE WHEN is_active = TRUE THEN 1 END) as active_missions,
        COUNT(CASE WHEN type = 'daily' THEN 1 END) as daily_missions,
        COUNT(CASE WHEN type = 'weekly' THEN 1 END) as weekly_missions,
        COUNT(CASE WHEN type = 'monthly' THEN 1 END) as monthly_missions,
        COUNT(CASE WHEN type = 'one_time' THEN 1 END) as one_time_missions,
        COUNT(CASE WHEN difficulty = 'easy' THEN 1 END) as easy_missions,
        COUNT(CASE WHEN difficulty = 'medium' THEN 1 END) as medium_missions,
        COUNT(CASE WHEN difficulty = 'hard' THEN 1 END) as hard_missions,
        COALESCE(AVG(points_reward), 0) as avg_points_reward,
        COALESCE(AVG(target_value), 0) as avg_target_value,
        (SELECT COUNT(*) FROM polox.user_missions WHERE company_id = $1) as total_assignments,
        (SELECT COUNT(*) FROM polox.user_missions WHERE company_id = $1 AND status = 'completed') as total_completed,
        (SELECT COUNT(DISTINCT user_id) FROM polox.user_missions WHERE company_id = $1) as users_with_missions,
        (SELECT COALESCE(AVG(CASE WHEN target_value > 0 THEN (current_progress::float / target_value::float) * 100 ELSE 0 END), 0) 
         FROM polox.user_missions WHERE company_id = $1 AND status IN ('assigned', 'in_progress')) as avg_progress_percentage
      FROM polox.missions 
      WHERE company_id = $1 AND deleted_at IS NULL
    `;

    try {
      const result = await query(statsQuery, [companyId], { companyId });
      return result.rows[0];
    } catch (error) {
      throw new ApiError(500, `Erro ao obter estatísticas de missões: ${error.message}`);
    }
  }

  /**
   * Obtém missões mais completadas
   * @param {number} companyId - ID da empresa
   * @param {number} limit - Limite de resultados
   * @returns {Promise<Array>} Missões mais populares
   */
  static async getMostCompleted(companyId, limit = 10) {
    const popularQuery = `
      SELECT 
        m.*,
        COUNT(um.id) as total_assignments,
        COUNT(CASE WHEN um.status = 'completed' THEN 1 END) as completion_count,
        COUNT(DISTINCT um.user_id) as unique_users,
        CASE 
          WHEN COUNT(um.id) > 0 THEN 
            ROUND((COUNT(CASE WHEN um.status = 'completed' THEN 1 END)::float / COUNT(um.id)::float) * 100, 2)
          ELSE 0 
        END as completion_rate
      FROM polox.missions m
      LEFT JOIN polox.user_missions um ON m.id = um.mission_id
      WHERE m.company_id = $1 AND m.deleted_at IS NULL
      GROUP BY m.id
      ORDER BY completion_count DESC, completion_rate DESC
      LIMIT $2
    `;

    try {
      const result = await query(popularQuery, [companyId, limit], { companyId });
      return result.rows;
    } catch (error) {
      throw new ApiError(500, `Erro ao buscar missões mais completadas: ${error.message}`);
    }
  }

  /**
   * Processa missões expiradas
   * @param {number} companyId - ID da empresa
   * @returns {Promise<number>} Número de missões expiradas processadas
   */
  static async processExpiredMissions(companyId) {
    const updateQuery = `
      UPDATE polox.user_missions 
      SET status = 'expired', updated_at = NOW()
      WHERE company_id = $1 
        AND status IN ('assigned', 'in_progress')
        AND expires_at IS NOT NULL 
        AND expires_at <= NOW()
    `;

    try {
      const result = await query(updateQuery, [companyId], { companyId });
      return result.rowCount;
    } catch (error) {
      throw new ApiError(500, `Erro ao processar missões expiradas: ${error.message}`);
    }
  }

  /**
   * Soft delete da missão
   * @param {number} id - ID da missão
   * @param {number} companyId - ID da empresa
   * @returns {Promise<boolean>} True se deletada com sucesso
   */
  static async softDelete(id, companyId) {
    const updateQuery = `
      UPDATE polox.missions 
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
      throw new ApiError(500, `Erro ao deletar missão: ${error.message}`);
    }
  }

  /**
   * Ativa/desativa missão
   * @param {number} id - ID da missão
   * @param {boolean} isActive - Novo status
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object|null>} Missão atualizada
   */
  static async toggleActive(id, isActive, companyId) {
    const updateQuery = `
      UPDATE polox.missions 
      SET is_active = $3, updated_at = NOW()
      WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL
      RETURNING id, name, is_active, updated_at
    `;

    try {
      const result = await query(updateQuery, [id, companyId, isActive], { companyId });
      return result.rows[0] || null;
    } catch (error) {
      throw new ApiError(500, `Erro ao alterar status da missão: ${error.message}`);
    }
  }
}

module.exports = MissionModel;