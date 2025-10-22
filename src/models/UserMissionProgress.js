const { query, transaction } = require('../config/database');
const { ApiError, ValidationError, NotFoundError } = require('../utils/errors');

/**
 * Model para progresso das missões dos usuários
 * Baseado no schema polox.user_mission_progress
 */
class UserMissionProgressModel {
  /**
   * Inicia uma missão para um usuário
   * @param {Object} progressData - Dados do progresso
   * @returns {Promise<Object>} Progresso criado
   */
  static async start(progressData) {
    const {
      user_id,
      mission_id,
      current_value = 0,
      metadata = {}
    } = progressData;

    // Validar dados obrigatórios
    if (!user_id || !mission_id) {
      throw new ValidationError('User ID e Mission ID são obrigatórios');
    }

    if (current_value < 0) {
      throw new ValidationError('Valor atual não pode ser negativo');
    }

    // Verificar se missão já foi iniciada
    const existingQuery = `
      SELECT id FROM polox.user_mission_progress 
      WHERE user_id = $1 AND mission_id = $2 AND deleted_at IS NULL
    `;

    try {
      const existing = await query(existingQuery, [user_id, mission_id]);
      if (existing.rows.length > 0) {
        throw new ValidationError('Missão já foi iniciada para este usuário');
      }

      const insertQuery = `
        INSERT INTO polox.user_mission_progress (
          user_id, mission_id, status, current_value, target_value,
          progress_percentage, metadata, started_at, created_at, updated_at
        )
        SELECT 
          $1, $2, 'in_progress', $3, m.target_value,
          CASE 
            WHEN m.target_value > 0 THEN LEAST(($3 * 100.0 / m.target_value), 100)
            ELSE 0
          END,
          $4, NOW(), NOW(), NOW()
        FROM polox.missions m
        WHERE m.id = $2
        RETURNING 
          id, user_id, mission_id, status, current_value, target_value,
          progress_percentage, metadata, started_at, completed_at,
          created_at, updated_at
      `;

      const result = await query(insertQuery, [
        user_id, mission_id, current_value, JSON.stringify(metadata)
      ]);

      const userMissionProgress = result.rows[0];
      
      // Parse metadata
      userMissionProgress.metadata = typeof userMissionProgress.metadata === 'string' 
        ? JSON.parse(userMissionProgress.metadata) 
        : userMissionProgress.metadata;

      return userMissionProgress;
    } catch (error) {
      if (error.code === '23503') {
        if (error.constraint?.includes('user')) {
          throw new ValidationError('Usuário informado não existe');
        }
        if (error.constraint?.includes('mission')) {
          throw new ValidationError('Missão informada não existe');
        }
      }
      throw new ApiError(500, `Erro ao iniciar missão: ${error.message}`);
    }
  }

  /**
   * Busca progresso de missão por ID
   * @param {number} id - ID do progresso
   * @param {number} companyId - ID da empresa (multi-tenant)
   * @returns {Promise<Object|null>} Progresso encontrado ou null
   */
  static async findById(id, companyId) {
    const selectQuery = `
      SELECT 
        ump.id, ump.user_id, ump.mission_id, ump.status, ump.current_value,
        ump.target_value, ump.progress_percentage, ump.metadata,
        ump.started_at, ump.completed_at, ump.created_at, ump.updated_at,
        m.title as mission_title,
        m.description as mission_description,
        m.type as mission_type,
        m.category as mission_category,
        m.difficulty as mission_difficulty,
        m.points_reward as mission_points_reward,
        m.requirements as mission_requirements,
        m.config as mission_config,
        u.name as user_name,
        u.email as user_email
      FROM polox.user_mission_progress ump
      INNER JOIN polox.users u ON ump.user_id = u.id
      INNER JOIN polox.missions m ON ump.mission_id = m.id
      WHERE ump.id = $1 AND u.company_id = $2 AND ump.deleted_at IS NULL
    `;

    try {
      const result = await query(selectQuery, [id, companyId], { companyId });
      const progress = result.rows[0];
      
      if (progress) {
        // Parse JSON fields
        progress.metadata = typeof progress.metadata === 'string' 
          ? JSON.parse(progress.metadata) 
          : progress.metadata;
        progress.mission_requirements = typeof progress.mission_requirements === 'string' 
          ? JSON.parse(progress.mission_requirements) 
          : progress.mission_requirements;
        progress.mission_config = typeof progress.mission_config === 'string' 
          ? JSON.parse(progress.mission_config) 
          : progress.mission_config;
      }

      return progress || null;
    } catch (error) {
      throw new ApiError(500, `Erro ao buscar progresso: ${error.message}`);
    }
  }

  /**
   * Lista progresso de missões de um usuário
   * @param {number} userId - ID do usuário
   * @param {number} companyId - ID da empresa
   * @param {Object} options - Opções de filtro
   * @returns {Promise<Array>} Lista de progressos
   */
  static async findByUser(userId, companyId, options = {}) {
    const { 
      status = null,
      category = null,
      difficulty = null,
      type = null,
      page = 1, 
      limit = 50
    } = options;
    
    const offset = (page - 1) * limit;
    
    let whereClause = `
      WHERE ump.user_id = $1 AND u.company_id = $2 AND ump.deleted_at IS NULL
    `;
    const params = [userId, companyId];
    
    if (status) {
      whereClause += ` AND ump.status = $${params.length + 1}`;
      params.push(status);
    }

    if (category) {
      whereClause += ` AND m.category = $${params.length + 1}`;
      params.push(category);
    }

    if (difficulty) {
      whereClause += ` AND m.difficulty = $${params.length + 1}`;
      params.push(difficulty);
    }

    if (type) {
      whereClause += ` AND m.type = $${params.length + 1}`;
      params.push(type);
    }

    const selectQuery = `
      SELECT 
        ump.id, ump.user_id, ump.mission_id, ump.status, ump.current_value,
        ump.target_value, ump.progress_percentage, ump.metadata,
        ump.started_at, ump.completed_at, ump.created_at, ump.updated_at,
        m.title as mission_title,
        m.description as mission_description,
        m.type as mission_type,
        m.category as mission_category,
        m.difficulty as mission_difficulty,
        m.points_reward as mission_points_reward,
        m.icon as mission_icon,
        CASE 
          WHEN ump.status = 'completed' THEN 100
          WHEN m.target_value > 0 THEN LEAST((ump.current_value * 100.0 / m.target_value), 100)
          ELSE 0
        END as calculated_percentage
      FROM polox.user_mission_progress ump
      INNER JOIN polox.users u ON ump.user_id = u.id
      INNER JOIN polox.missions m ON ump.mission_id = m.id
      ${whereClause}
      ORDER BY 
        CASE ump.status 
          WHEN 'in_progress' THEN 1
          WHEN 'completed' THEN 2
          WHEN 'failed' THEN 3
          ELSE 4
        END,
        ump.progress_percentage DESC,
        ump.started_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    params.push(limit, offset);

    try {
      const result = await query(selectQuery, params, { companyId });
      
      return result.rows.map(progress => {
        // Parse JSON fields
        progress.metadata = typeof progress.metadata === 'string' 
          ? JSON.parse(progress.metadata) 
          : progress.metadata;
        progress.calculated_percentage = parseFloat(progress.calculated_percentage) || 0;
        
        return progress;
      });
    } catch (error) {
      throw new ApiError(500, `Erro ao buscar progressos do usuário: ${error.message}`);
    }
  }

  /**
   * Lista usuários com progresso em uma missão específica
   * @param {number} missionId - ID da missão
   * @param {number} companyId - ID da empresa
   * @param {Object} options - Opções de filtro
   * @returns {Promise<Array>} Lista de usuários com progresso
   */
  static async findByMission(missionId, companyId, options = {}) {
    const { 
      status = null,
      page = 1, 
      limit = 50
    } = options;
    
    const offset = (page - 1) * limit;
    
    let whereClause = `
      WHERE ump.mission_id = $1 AND u.company_id = $2 AND ump.deleted_at IS NULL
    `;
    const params = [missionId, companyId];
    
    if (status) {
      whereClause += ` AND ump.status = $${params.length + 1}`;
      params.push(status);
    }

    const selectQuery = `
      SELECT 
        ump.id, ump.user_id, ump.mission_id, ump.status, ump.current_value,
        ump.target_value, ump.progress_percentage, ump.started_at, ump.completed_at,
        u.name as user_name,
        u.email as user_email,
        u.avatar_url as user_avatar,
        up.level as user_level,
        up.total_points as user_total_points
      FROM polox.user_mission_progress ump
      INNER JOIN polox.users u ON ump.user_id = u.id
      LEFT JOIN polox.user_gamification_profiles up ON u.id = up.user_id
      ${whereClause}
      ORDER BY ump.progress_percentage DESC, ump.started_at ASC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    params.push(limit, offset);

    try {
      const result = await query(selectQuery, params, { companyId });
      return result.rows;
    } catch (error) {
      throw new ApiError(500, `Erro ao buscar usuários da missão: ${error.message}`);
    }
  }

  /**
   * Atualiza o progresso de uma missão
   * @param {number} userId - ID do usuário
   * @param {number} missionId - ID da missão
   * @param {number} newValue - Novo valor atual
   * @param {Object} metadata - Metadados adicionais
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object>} Progresso atualizado
   */
  static async updateProgress(userId, missionId, newValue, metadata = {}, companyId) {
    if (newValue < 0) {
      throw new ValidationError('Valor atual não pode ser negativo');
    }

    // Verificar se progresso existe
    const existingQuery = `
      SELECT ump.id, ump.current_value, ump.target_value, ump.status, ump.metadata
      FROM polox.user_mission_progress ump
      INNER JOIN polox.users u ON ump.user_id = u.id
      WHERE ump.user_id = $1 AND ump.mission_id = $2 
        AND u.company_id = $3 AND ump.deleted_at IS NULL
    `;

    try {
      const existing = await query(existingQuery, [userId, missionId, companyId]);
      
      if (existing.rows.length === 0) {
        throw new NotFoundError('Progresso de missão não encontrado para este usuário');
      }

      const currentProgress = existing.rows[0];
      
      // Se missão já está completa, não permitir alteração
      if (currentProgress.status === 'completed') {
        throw new ValidationError('Não é possível alterar progresso de missão já completa');
      }

      // Mesclar metadata existente com novo
      const existingMetadata = typeof currentProgress.metadata === 'string' 
        ? JSON.parse(currentProgress.metadata) 
        : currentProgress.metadata;
      const mergedMetadata = { ...existingMetadata, ...metadata };

      // Calcular novo percentual e status
      const progressPercentage = currentProgress.target_value > 0 
        ? Math.min((newValue * 100.0 / currentProgress.target_value), 100) 
        : 0;
      
      const newStatus = progressPercentage >= 100 ? 'completed' : 'in_progress';

      const updateQuery = `
        UPDATE polox.user_mission_progress 
        SET 
          current_value = $1,
          progress_percentage = $2,
          status = $3,
          completed_at = CASE WHEN $3 = 'completed' AND completed_at IS NULL THEN NOW() ELSE completed_at END,
          metadata = $4,
          updated_at = NOW()
        WHERE user_id = $5 AND mission_id = $6 AND deleted_at IS NULL
        RETURNING 
          id, user_id, mission_id, status, current_value, target_value,
          progress_percentage, metadata, started_at, completed_at,
          created_at, updated_at
      `;

      const result = await query(updateQuery, [
        newValue, 
        progressPercentage,
        newStatus,
        JSON.stringify(mergedMetadata), 
        userId, 
        missionId
      ]);

      const userMissionProgress = result.rows[0];
      
      // Parse metadata
      userMissionProgress.metadata = typeof userMissionProgress.metadata === 'string' 
        ? JSON.parse(userMissionProgress.metadata) 
        : userMissionProgress.metadata;

      return userMissionProgress;
    } catch (error) {
      throw new ApiError(500, `Erro ao atualizar progresso: ${error.message}`);
    }
  }

  /**
   * Incrementa o progresso de uma missão
   * @param {number} userId - ID do usuário
   * @param {number} missionId - ID da missão
   * @param {number} increment - Valor para incrementar
   * @param {Object} metadata - Metadados adicionais
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object>} Progresso atualizado
   */
  static async incrementProgress(userId, missionId, increment = 1, metadata = {}, companyId) {
    if (increment <= 0) {
      throw new ValidationError('Incremento deve ser maior que zero');
    }

    // Buscar progresso atual
    const existingQuery = `
      SELECT ump.id, ump.current_value, ump.target_value, ump.status
      FROM polox.user_mission_progress ump
      INNER JOIN polox.users u ON ump.user_id = u.id
      WHERE ump.user_id = $1 AND ump.mission_id = $2 
        AND u.company_id = $3 AND ump.deleted_at IS NULL
    `;

    try {
      const existing = await query(existingQuery, [userId, missionId, companyId]);
      
      if (existing.rows.length === 0) {
        throw new NotFoundError('Progresso de missão não encontrado para este usuário');
      }

      const currentProgress = existing.rows[0];
      const newValue = currentProgress.current_value + increment;

      return await this.updateProgress(userId, missionId, newValue, metadata, companyId);
    } catch (error) {
      throw new ApiError(500, `Erro ao incrementar progresso: ${error.message}`);
    }
  }

  /**
   * Marca uma missão como completa
   * @param {number} userId - ID do usuário
   * @param {number} missionId - ID da missão
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object>} Progresso atualizado
   */
  static async markAsCompleted(userId, missionId, companyId) {
    // Buscar target_value da missão
    const missionQuery = `
      SELECT m.target_value
      FROM polox.missions m
      WHERE m.id = $1
    `;

    try {
      const missionResult = await query(missionQuery, [missionId]);
      
      if (missionResult.rows.length === 0) {
        throw new NotFoundError('Missão não encontrada');
      }

      const targetValue = missionResult.rows[0].target_value;
      
      return await this.updateProgress(userId, missionId, targetValue, {}, companyId);
    } catch (error) {
      throw new ApiError(500, `Erro ao marcar missão como completa: ${error.message}`);
    }
  }

  /**
   * Marca uma missão como falhada
   * @param {number} userId - ID do usuário
   * @param {number} missionId - ID da missão
   * @param {string} failureReason - Motivo da falha
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object>} Progresso atualizado
   */
  static async markAsFailed(userId, missionId, failureReason = '', companyId) {
    // Verificar se progresso existe
    const existingQuery = `
      SELECT ump.id, ump.status
      FROM polox.user_mission_progress ump
      INNER JOIN polox.users u ON ump.user_id = u.id
      WHERE ump.user_id = $1 AND ump.mission_id = $2 
        AND u.company_id = $3 AND ump.deleted_at IS NULL
    `;

    try {
      const existing = await query(existingQuery, [userId, missionId, companyId]);
      
      if (existing.rows.length === 0) {
        throw new NotFoundError('Progresso de missão não encontrado para este usuário');
      }

      const currentProgress = existing.rows[0];
      
      if (currentProgress.status === 'completed') {
        throw new ValidationError('Não é possível marcar missão completa como falhada');
      }

      const updateQuery = `
        UPDATE polox.user_mission_progress 
        SET 
          status = 'failed',
          metadata = jsonb_set(
            COALESCE(metadata, '{}')::jsonb, 
            '{failure_reason}', 
            to_jsonb($3::text)
          ),
          updated_at = NOW()
        WHERE user_id = $1 AND mission_id = $2 AND deleted_at IS NULL
        RETURNING 
          id, user_id, mission_id, status, current_value, target_value,
          progress_percentage, metadata, started_at, completed_at,
          created_at, updated_at
      `;

      const result = await query(updateQuery, [userId, missionId, failureReason]);

      const userMissionProgress = result.rows[0];
      
      // Parse metadata
      userMissionProgress.metadata = typeof userMissionProgress.metadata === 'string' 
        ? JSON.parse(userMissionProgress.metadata) 
        : userMissionProgress.metadata;

      return userMissionProgress;
    } catch (error) {
      throw new ApiError(500, `Erro ao marcar missão como falhada: ${error.message}`);
    }
  }

  /**
   * Remove um progresso de missão (soft delete)
   * @param {number} userId - ID do usuário
   * @param {number} missionId - ID da missão
   * @param {number} companyId - ID da empresa
   * @returns {Promise<boolean>} True se removido com sucesso
   */
  static async delete(userId, missionId, companyId) {
    // Verificar se progresso existe
    const existingQuery = `
      SELECT ump.id
      FROM polox.user_mission_progress ump
      INNER JOIN polox.users u ON ump.user_id = u.id
      WHERE ump.user_id = $1 AND ump.mission_id = $2 
        AND u.company_id = $3 AND ump.deleted_at IS NULL
    `;

    try {
      const existing = await query(existingQuery, [userId, missionId, companyId]);
      
      if (existing.rows.length === 0) {
        throw new NotFoundError('Progresso de missão não encontrado para este usuário');
      }

      const deleteQuery = `
        UPDATE polox.user_mission_progress 
        SET deleted_at = NOW()
        WHERE user_id = $1 AND mission_id = $2 AND deleted_at IS NULL
      `;

      const result = await query(deleteQuery, [userId, missionId]);
      return result.rowCount > 0;
    } catch (error) {
      throw new ApiError(500, `Erro ao remover progresso: ${error.message}`);
    }
  }

  /**
   * Estatísticas de missões de um usuário
   * @param {number} userId - ID do usuário
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object>} Estatísticas
   */
  static async getStatsByUser(userId, companyId) {
    const statsQuery = `
      SELECT 
        COUNT(*) as total_missions,
        COUNT(CASE WHEN ump.status = 'in_progress' THEN 1 END) as in_progress_missions,
        COUNT(CASE WHEN ump.status = 'completed' THEN 1 END) as completed_missions,
        COUNT(CASE WHEN ump.status = 'failed' THEN 1 END) as failed_missions,
        COALESCE(AVG(ump.progress_percentage), 0) as average_progress,
        COUNT(CASE WHEN m.difficulty = 'easy' AND ump.status = 'completed' THEN 1 END) as easy_completed,
        COUNT(CASE WHEN m.difficulty = 'medium' AND ump.status = 'completed' THEN 1 END) as medium_completed,
        COUNT(CASE WHEN m.difficulty = 'hard' AND ump.status = 'completed' THEN 1 END) as hard_completed,
        COALESCE(SUM(CASE WHEN ump.status = 'completed' THEN m.points_reward ELSE 0 END), 0) as total_points_earned
      FROM polox.user_mission_progress ump
      INNER JOIN polox.users u ON ump.user_id = u.id
      INNER JOIN polox.missions m ON ump.mission_id = m.id
      WHERE ump.user_id = $1 AND u.company_id = $2 AND ump.deleted_at IS NULL
    `;

    try {
      const result = await query(statsQuery, [userId, companyId], { companyId });
      const stats = result.rows[0];

      return {
        total_missions: parseInt(stats.total_missions) || 0,
        in_progress_missions: parseInt(stats.in_progress_missions) || 0,
        completed_missions: parseInt(stats.completed_missions) || 0,
        failed_missions: parseInt(stats.failed_missions) || 0,
        average_progress: parseFloat(stats.average_progress) || 0,
        completion_rate: stats.total_missions > 0 
          ? ((stats.completed_missions / stats.total_missions) * 100).toFixed(2)
          : 0,
        by_difficulty: {
          easy: parseInt(stats.easy_completed) || 0,
          medium: parseInt(stats.medium_completed) || 0,
          hard: parseInt(stats.hard_completed) || 0
        },
        total_points_earned: parseInt(stats.total_points_earned) || 0
      };
    } catch (error) {
      throw new ApiError(500, `Erro ao buscar estatísticas: ${error.message}`);
    }
  }

  /**
   * Lista missões próximas da conclusão
   * @param {number} companyId - ID da empresa
   * @param {number} threshold - Percentual mínimo de progresso (padrão: 80)
   * @returns {Promise<Array>} Lista de missões próximas da conclusão
   */
  static async findNearCompletion(companyId, threshold = 80) {
    const selectQuery = `
      SELECT 
        ump.id, ump.user_id, ump.mission_id, ump.current_value, ump.target_value,
        ump.progress_percentage, ump.started_at,
        u.name as user_name,
        u.email as user_email,
        m.title as mission_title,
        m.description as mission_description,
        m.points_reward as mission_points_reward,
        m.difficulty as mission_difficulty
      FROM polox.user_mission_progress ump
      INNER JOIN polox.users u ON ump.user_id = u.id
      INNER JOIN polox.missions m ON ump.mission_id = m.id
      WHERE u.company_id = $1 
        AND ump.status = 'in_progress'
        AND ump.progress_percentage >= $2
        AND ump.deleted_at IS NULL
      ORDER BY ump.progress_percentage DESC, ump.started_at ASC
    `;

    try {
      const result = await query(selectQuery, [companyId, threshold], { companyId });
      return result.rows;
    } catch (error) {
      throw new ApiError(500, `Erro ao buscar missões próximas da conclusão: ${error.message}`);
    }
  }

  /**
   * Conta o total de progressos por usuário
   * @param {number} userId - ID do usuário
   * @param {number} companyId - ID da empresa
   * @param {Object} filters - Filtros opcionais
   * @returns {Promise<number>} Total de progressos
   */
  static async count(userId, companyId, filters = {}) {
    let whereClause = `
      WHERE ump.user_id = $1 AND u.company_id = $2 AND ump.deleted_at IS NULL
    `;
    const params = [userId, companyId];

    if (filters.status) {
      whereClause += ` AND ump.status = $${params.length + 1}`;
      params.push(filters.status);
    }

    if (filters.category) {
      whereClause += ` AND m.category = $${params.length + 1}`;
      params.push(filters.category);
    }

    if (filters.difficulty) {
      whereClause += ` AND m.difficulty = $${params.length + 1}`;
      params.push(filters.difficulty);
    }

    const countQuery = `
      SELECT COUNT(*) as total
      FROM polox.user_mission_progress ump
      INNER JOIN polox.users u ON ump.user_id = u.id
      INNER JOIN polox.missions m ON ump.mission_id = m.id
      ${whereClause}
    `;

    try {
      const result = await query(countQuery, params, { companyId });
      return parseInt(result.rows[0].total);
    } catch (error) {
      throw new ApiError(500, `Erro ao contar progressos: ${error.message}`);
    }
  }
}

module.exports = UserMissionProgressModel;