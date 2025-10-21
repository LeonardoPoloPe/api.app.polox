const { query, transaction } = require('../config/database');
const { ApiError, ValidationError, NotFoundError } = require('../utils/errors');

/**
 * Model para recompensas do sistema de gamificação
 * Baseado no schema polox.rewards e polox.user_rewards
 */
class RewardModel {
  /**
   * Cria uma nova recompensa
   * @param {Object} rewardData - Dados da recompensa
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object>} Recompensa criada
   */
  static async create(rewardData, companyId) {
    const {
      name,
      description,
      type = 'discount',
      value,
      points_cost,
      icon = null,
      category = 'general',
      is_active = true,
      stock_quantity = null,
      expiration_days = null,
      usage_limit_per_user = null,
      minimum_level = 1,
      terms_conditions = null,
      image_url = null
    } = rewardData;

    // Validar dados obrigatórios
    if (!name) {
      throw new ValidationError('Nome da recompensa é obrigatório');
    }

    if (!description) {
      throw new ValidationError('Descrição da recompensa é obrigatória');
    }

    if (!type || !['discount', 'product', 'service', 'experience', 'digital'].includes(type)) {
      throw new ValidationError('Tipo deve ser: discount, product, service, experience ou digital');
    }

    if (!value) {
      throw new ValidationError('Valor da recompensa é obrigatório');
    }

    if (!points_cost || points_cost <= 0) {
      throw new ValidationError('Custo em pontos deve ser maior que zero');
    }

    const insertQuery = `
      INSERT INTO polox.rewards (
        company_id, name, description, type, value, points_cost,
        icon, category, is_active, stock_quantity, expiration_days,
        usage_limit_per_user, minimum_level, terms_conditions, image_url,
        created_at, updated_at
      )
      VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10, $11,
        $12, $13, $14, $15,
        NOW(), NOW()
      )
      RETURNING 
        id, name, description, type, value, points_cost,
        icon, category, is_active, stock_quantity, expiration_days,
        usage_limit_per_user, minimum_level, created_at, updated_at
    `;

    try {
      const result = await query(insertQuery, [
        companyId, name, description, type, value, points_cost,
        icon, category, is_active, stock_quantity, expiration_days,
        usage_limit_per_user, minimum_level, terms_conditions, image_url
      ], { companyId });

      return result.rows[0];
    } catch (error) {
      throw new ApiError(500, `Erro ao criar recompensa: ${error.message}`);
    }
  }

  /**
   * Busca recompensa por ID
   * @param {number} id - ID da recompensa
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object|null>} Recompensa encontrada ou null
   */
  static async findById(id, companyId) {
    const selectQuery = `
      SELECT 
        r.*,
        (SELECT COUNT(*) FROM polox.user_rewards WHERE reward_id = r.id) as total_claimed,
        (SELECT COUNT(*) FROM polox.user_rewards WHERE reward_id = r.id AND redeemed_at IS NOT NULL) as total_redeemed,
        (SELECT COUNT(DISTINCT user_id) FROM polox.user_rewards WHERE reward_id = r.id) as unique_users_claimed
      FROM polox.rewards r
      WHERE r.id = $1 AND r.company_id = $2 AND r.deleted_at IS NULL
    `;

    try {
      const result = await query(selectQuery, [id, companyId], { companyId });
      return result.rows[0] || null;
    } catch (error) {
      throw new ApiError(500, `Erro ao buscar recompensa: ${error.message}`);
    }
  }

  /**
   * Lista recompensas com filtros e paginação
   * @param {Object} options - Opções de busca
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object>} Lista de recompensas e metadados
   */
  static async list(options = {}, companyId) {
    const {
      page = 1,
      limit = 10,
      type = null,
      category = null,
      is_active = null,
      available_only = false,
      user_level = null,
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

    if (available_only) {
      conditions.push('(stock_quantity IS NULL OR stock_quantity > 0)');
    }

    if (user_level !== null) {
      conditions.push(`minimum_level <= $${paramCount}`);
      values.push(user_level);
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
      FROM polox.rewards 
      ${whereClause}
    `;

    // Query para buscar dados
    const selectQuery = `
      SELECT 
        id, name, description, type, value, points_cost,
        icon, category, is_active, stock_quantity, expiration_days,
        usage_limit_per_user, minimum_level, image_url, created_at,
        (SELECT COUNT(*) FROM polox.user_rewards WHERE reward_id = polox.rewards.id) as total_claimed,
        CASE 
          WHEN stock_quantity IS NULL THEN true
          WHEN stock_quantity > 0 THEN true
          ELSE false
        END as is_available
      FROM polox.rewards
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
      throw new ApiError(500, `Erro ao listar recompensas: ${error.message}`);
    }
  }

  /**
   * Atualiza dados da recompensa
   * @param {number} id - ID da recompensa
   * @param {Object} updateData - Dados para atualizar
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object|null>} Recompensa atualizada ou null
   */
  static async update(id, updateData, companyId) {
    const allowedFields = [
      'name', 'description', 'type', 'value', 'points_cost',
      'icon', 'category', 'is_active', 'stock_quantity', 'expiration_days',
      'usage_limit_per_user', 'minimum_level', 'terms_conditions', 'image_url'
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
      UPDATE polox.rewards 
      SET ${updates.join(', ')}
      WHERE id = $${paramCount} AND company_id = $${paramCount + 1} AND deleted_at IS NULL
      RETURNING 
        id, name, description, type, value, points_cost,
        is_active, stock_quantity, minimum_level,
        created_at, updated_at
    `;

    try {
      const result = await query(updateQuery, values, { companyId });
      return result.rows[0] || null;
    } catch (error) {
      throw new ApiError(500, `Erro ao atualizar recompensa: ${error.message}`);
    }
  }

  /**
   * Resgata recompensa para usuário
   * @param {number} userId - ID do usuário
   * @param {number} rewardId - ID da recompensa
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object>} Resgate criado
   */
  static async claimReward(userId, rewardId, companyId) {
    return await transaction(async (client) => {
      // Buscar recompensa
      const reward = await client.query(
        'SELECT * FROM polox.rewards WHERE id = $1 AND company_id = $2 AND is_active = TRUE AND deleted_at IS NULL',
        [rewardId, companyId]
      );

      if (reward.rows.length === 0) {
        throw new NotFoundError('Recompensa não encontrada ou inativa');
      }

      const rewardData = reward.rows[0];

      // Buscar perfil do usuário
      const UserGamificationProfileModel = require('./UserGamificationProfile');
      const userProfile = await UserGamificationProfileModel.findByUserId(userId, companyId);

      if (!userProfile) {
        throw new NotFoundError('Perfil de gamificação do usuário não encontrado');
      }

      // Verificar se usuário tem pontos suficientes
      if (userProfile.points < rewardData.points_cost) {
        throw new ValidationError('Pontos insuficientes para resgatar esta recompensa');
      }

      // Verificar nível mínimo
      if (userProfile.level < rewardData.minimum_level) {
        throw new ValidationError(`Nível mínimo necessário: ${rewardData.minimum_level}`);
      }

      // Verificar estoque
      if (rewardData.stock_quantity !== null && rewardData.stock_quantity <= 0) {
        throw new ValidationError('Recompensa fora de estoque');
      }

      // Verificar limite por usuário
      if (rewardData.usage_limit_per_user) {
        const userClaimsCount = await client.query(
          'SELECT COUNT(*) FROM polox.user_rewards WHERE user_id = $1 AND reward_id = $2 AND company_id = $3',
          [userId, rewardId, companyId]
        );

        if (parseInt(userClaimsCount.rows[0].count) >= rewardData.usage_limit_per_user) {
          throw new ValidationError('Limite de uso por usuário excedido');
        }
      }

      // Calcular data de expiração
      let expiresAt = null;
      if (rewardData.expiration_days) {
        expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + rewardData.expiration_days);
      }

      // Criar resgate
      const claimQuery = `
        INSERT INTO polox.user_rewards (
          user_id, reward_id, company_id, points_spent,
          expires_at, claimed_at, created_at
        )
        VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
        RETURNING 
          id, user_id, reward_id, points_spent,
          expires_at, claimed_at, created_at
      `;

      const claimResult = await client.query(claimQuery, [
        userId, rewardId, companyId, rewardData.points_cost, expiresAt
      ]);

      // Debitar pontos do usuário
      await UserGamificationProfileModel.removePoints(
        userId, 
        companyId, 
        rewardData.points_cost, 
        `Resgate de recompensa: ${rewardData.name}`
      );

      // Reduzir estoque se aplicável
      if (rewardData.stock_quantity !== null) {
        await client.query(
          'UPDATE polox.rewards SET stock_quantity = stock_quantity - 1, updated_at = NOW() WHERE id = $1',
          [rewardId]
        );
      }

      return {
        ...claimResult.rows[0],
        reward: rewardData
      };
    }, { companyId });
  }

  /**
   * Marca recompensa como resgatada/utilizada
   * @param {number} userRewardId - ID do user_reward
   * @param {number} companyId - ID da empresa
   * @param {Object} redeemData - Dados do resgate
   * @returns {Promise<Object|null>} Resgate atualizado
   */
  static async redeemReward(userRewardId, companyId, redeemData = {}) {
    const {
      redeemed_by = null,
      redemption_notes = null
    } = redeemData;

    const updateQuery = `
      UPDATE polox.user_rewards 
      SET 
        redeemed_at = NOW(),
        redeemed_by = $3,
        redemption_notes = $4,
        updated_at = NOW()
      WHERE id = $1 AND company_id = $2 AND redeemed_at IS NULL
      RETURNING 
        id, user_id, reward_id, points_spent,
        claimed_at, redeemed_at, redeemed_by,
        redemption_notes, expires_at
    `;

    try {
      const result = await query(updateQuery, [userRewardId, companyId, redeemed_by, redemption_notes], { companyId });
      return result.rows[0] || null;
    } catch (error) {
      throw new ApiError(500, `Erro ao marcar recompensa como resgatada: ${error.message}`);
    }
  }

  /**
   * Obtém recompensas do usuário
   * @param {number} userId - ID do usuário
   * @param {number} companyId - ID da empresa
   * @param {Object} options - Opções de filtro
   * @returns {Promise<Object>} Recompensas do usuário
   */
  static async getUserRewards(userId, companyId, options = {}) {
    const {
      page = 1,
      limit = 10,
      status = null, // 'claimed', 'redeemed', 'expired'
      type = null
    } = options;

    const offset = (page - 1) * limit;
    const conditions = ['ur.user_id = $1', 'ur.company_id = $2'];
    const values = [userId, companyId];
    let paramCount = 3;

    // Adicionar filtros de status
    if (status === 'claimed') {
      conditions.push('ur.redeemed_at IS NULL AND (ur.expires_at IS NULL OR ur.expires_at > NOW())');
    } else if (status === 'redeemed') {
      conditions.push('ur.redeemed_at IS NOT NULL');
    } else if (status === 'expired') {
      conditions.push('ur.redeemed_at IS NULL AND ur.expires_at IS NOT NULL AND ur.expires_at <= NOW()');
    }

    if (type) {
      conditions.push(`r.type = $${paramCount}`);
      values.push(type);
      paramCount++;
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const selectQuery = `
      SELECT 
        ur.*,
        r.name as reward_name,
        r.description as reward_description,
        r.type as reward_type,
        r.value as reward_value,
        r.icon as reward_icon,
        r.image_url as reward_image,
        r.terms_conditions,
        CASE 
          WHEN ur.redeemed_at IS NOT NULL THEN 'redeemed'
          WHEN ur.expires_at IS NOT NULL AND ur.expires_at <= NOW() THEN 'expired'
          ELSE 'claimed'
        END as status
      FROM polox.user_rewards ur
      LEFT JOIN polox.rewards r ON ur.reward_id = r.id
      ${whereClause}
      ORDER BY ur.claimed_at DESC
      LIMIT $${paramCount} OFFSET $${paramCount + 1}
    `;

    const countQuery = `
      SELECT COUNT(*) 
      FROM polox.user_rewards ur
      LEFT JOIN polox.rewards r ON ur.reward_id = r.id
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
      throw new ApiError(500, `Erro ao buscar recompensas do usuário: ${error.message}`);
    }
  }

  /**
   * Atualiza estoque da recompensa
   * @param {number} id - ID da recompensa
   * @param {number} quantity - Nova quantidade
   * @param {string} operation - Operação: 'add', 'subtract', 'set'
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object|null>} Recompensa atualizada
   */
  static async updateStock(id, quantity, operation = 'set', companyId) {
    let updateExpression;
    
    switch (operation) {
      case 'add':
        updateExpression = 'stock_quantity = COALESCE(stock_quantity, 0) + $1';
        break;
      case 'subtract':
        updateExpression = 'stock_quantity = GREATEST(0, COALESCE(stock_quantity, 0) - $1)';
        break;
      case 'set':
      default:
        updateExpression = 'stock_quantity = $1';
        break;
    }

    const updateQuery = `
      UPDATE polox.rewards 
      SET ${updateExpression}, updated_at = NOW()
      WHERE id = $2 AND company_id = $3 AND deleted_at IS NULL
      RETURNING id, name, stock_quantity, updated_at
    `;

    try {
      const result = await query(updateQuery, [quantity, id, companyId], { companyId });
      return result.rows[0] || null;
    } catch (error) {
      throw new ApiError(500, `Erro ao atualizar estoque: ${error.message}`);
    }
  }

  /**
   * Obtém estatísticas de recompensas
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object>} Estatísticas de recompensas
   */
  static async getStats(companyId) {
    const statsQuery = `
      SELECT 
        COUNT(*) as total_rewards,
        COUNT(CASE WHEN is_active = TRUE THEN 1 END) as active_rewards,
        COUNT(CASE WHEN stock_quantity IS NOT NULL AND stock_quantity > 0 THEN 1 END) as in_stock_rewards,
        COUNT(CASE WHEN stock_quantity = 0 THEN 1 END) as out_of_stock_rewards,
        COUNT(CASE WHEN type = 'discount' THEN 1 END) as discount_rewards,
        COUNT(CASE WHEN type = 'product' THEN 1 END) as product_rewards,
        COUNT(CASE WHEN type = 'service' THEN 1 END) as service_rewards,
        COALESCE(AVG(points_cost), 0) as avg_points_cost,
        COALESCE(MIN(points_cost), 0) as min_points_cost,
        COALESCE(MAX(points_cost), 0) as max_points_cost,
        (SELECT COUNT(*) FROM polox.user_rewards WHERE company_id = $1) as total_claims,
        (SELECT COUNT(*) FROM polox.user_rewards WHERE company_id = $1 AND redeemed_at IS NOT NULL) as total_redeemed,
        (SELECT COUNT(DISTINCT user_id) FROM polox.user_rewards WHERE company_id = $1) as users_with_rewards,
        (SELECT COALESCE(SUM(points_spent), 0) FROM polox.user_rewards WHERE company_id = $1) as total_points_spent
      FROM polox.rewards 
      WHERE company_id = $1 AND deleted_at IS NULL
    `;

    try {
      const result = await query(statsQuery, [companyId], { companyId });
      return result.rows[0];
    } catch (error) {
      throw new ApiError(500, `Erro ao obter estatísticas de recompensas: ${error.message}`);
    }
  }

  /**
   * Obtém recompensas mais populares
   * @param {number} companyId - ID da empresa
   * @param {number} limit - Limite de resultados
   * @returns {Promise<Array>} Recompensas mais resgatadas
   */
  static async getMostClaimed(companyId, limit = 10) {
    const popularQuery = `
      SELECT 
        r.*,
        COUNT(ur.id) as claim_count,
        COUNT(CASE WHEN ur.redeemed_at IS NOT NULL THEN 1 END) as redeem_count,
        COUNT(DISTINCT ur.user_id) as unique_users
      FROM polox.rewards r
      LEFT JOIN polox.user_rewards ur ON r.id = ur.reward_id
      WHERE r.company_id = $1 AND r.deleted_at IS NULL
      GROUP BY r.id
      ORDER BY claim_count DESC, redeem_count DESC
      LIMIT $2
    `;

    try {
      const result = await query(popularQuery, [companyId, limit], { companyId });
      return result.rows;
    } catch (error) {
      throw new ApiError(500, `Erro ao buscar recompensas mais populares: ${error.message}`);
    }
  }

  /**
   * Verifica recompensas expiradas
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Array>} Recompensas expiradas
   */
  static async getExpiredRewards(companyId) {
    const expiredQuery = `
      SELECT 
        ur.*,
        r.name as reward_name,
        u.name as user_name,
        u.email as user_email
      FROM polox.user_rewards ur
      LEFT JOIN polox.rewards r ON ur.reward_id = r.id
      LEFT JOIN polox.users u ON ur.user_id = u.id
      WHERE ur.company_id = $1 
        AND ur.redeemed_at IS NULL 
        AND ur.expires_at IS NOT NULL 
        AND ur.expires_at <= NOW()
      ORDER BY ur.expires_at ASC
    `;

    try {
      const result = await query(expiredQuery, [companyId], { companyId });
      return result.rows;
    } catch (error) {
      throw new ApiError(500, `Erro ao buscar recompensas expiradas: ${error.message}`);
    }
  }

  /**
   * Soft delete da recompensa
   * @param {number} id - ID da recompensa
   * @param {number} companyId - ID da empresa
   * @returns {Promise<boolean>} True se deletada com sucesso
   */
  static async softDelete(id, companyId) {
    const updateQuery = `
      UPDATE polox.rewards 
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
      throw new ApiError(500, `Erro ao deletar recompensa: ${error.message}`);
    }
  }

  /**
   * Ativa/desativa recompensa
   * @param {number} id - ID da recompensa
   * @param {boolean} isActive - Novo status
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object|null>} Recompensa atualizada
   */
  static async toggleActive(id, isActive, companyId) {
    const updateQuery = `
      UPDATE polox.rewards 
      SET is_active = $3, updated_at = NOW()
      WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL
      RETURNING id, name, is_active, updated_at
    `;

    try {
      const result = await query(updateQuery, [id, companyId, isActive], { companyId });
      return result.rows[0] || null;
    } catch (error) {
      throw new ApiError(500, `Erro ao alterar status da recompensa: ${error.message}`);
    }
  }
}

module.exports = RewardModel;