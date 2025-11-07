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
 * Model para recompensas dos usuários
 * Baseado no schema polox.user_rewards
 */
class UserRewardModel {
  /**
   * Concede uma recompensa para um usuário
   * @param {Object} rewardData - Dados da recompensa
   * @returns {Promise<Object>} Recompensa concedida
   */
  static async grant(rewardData) {
    const {
      user_id,
      reward_id,
      quantity = 1,
      metadata = {},
      granted_by_user_id = null,
      auto_claim = false
    } = rewardData;

    // Validar dados obrigatórios
    if (!user_id || !reward_id) {
      throw new ValidationError('User ID e Reward ID são obrigatórios');
    }

    if (quantity <= 0) {
      throw new ValidationError('Quantidade deve ser maior que zero');
    }

    const insertQuery = `
      INSERT INTO polox.user_rewards (
        user_id, reward_id, quantity, status, metadata,
        granted_by_user_id, granted_at, claimed_at, expires_at, created_at, updated_at
      )
      VALUES (
        $1, $2, $3, 
        CASE WHEN $4 THEN 'claimed' ELSE 'available' END,
        $5, $6, NOW(),
        CASE WHEN $4 THEN NOW() ELSE NULL END,
        NOW() + INTERVAL '30 days',
        NOW(), NOW()
      )
      RETURNING 
        id, user_id, reward_id, quantity, status, metadata,
        granted_by_user_id, granted_at, claimed_at, expires_at,
        created_at, updated_at
    `;

    try {
      const result = await query(insertQuery, [
        user_id, reward_id, quantity, auto_claim,
        JSON.stringify(metadata), granted_by_user_id
      ]);

      const userReward = result.rows[0];
      
      // Parse metadata
      userReward.metadata = typeof userReward.metadata === 'string' 
        ? JSON.parse(userReward.metadata) 
        : userReward.metadata;

      return userReward;
    } catch (error) {
      if (error.code === '23503') {
        if (error.constraint?.includes('user')) {
          throw new ValidationError('Usuário informado não existe');
        }
        if (error.constraint?.includes('reward')) {
          throw new ValidationError('Recompensa informada não existe');
        }
      }
      throw new ApiError(500, `Erro ao conceder recompensa: ${error.message}`);
    }
  }

  /**
   * Busca recompensa de usuário por ID
   * @param {number} id - ID da recompensa do usuário
   * @param {number} companyId - ID da empresa (multi-tenant)
   * @returns {Promise<Object|null>} Recompensa encontrada ou null
   */
  static async findById(id, companyId) {
    const selectQuery = `
      SELECT 
        ur.id, ur.user_id, ur.reward_id, ur.quantity, ur.status,
        ur.metadata, ur.granted_by_user_id, ur.granted_at, ur.claimed_at,
        ur.expires_at, ur.created_at, ur.updated_at,
        r.title as reward_title,
        r.description as reward_description,
        r.type as reward_type,
        r.icon as reward_icon,
        r.points_cost as reward_points_cost,
        r.rarity as reward_rarity,
        r.config as reward_config,
        u.full_name as user_name,
        u.email as user_email,
        gb.name as granted_by_name
      FROM polox.user_rewards ur
      INNER JOIN polox.users u ON ur.user_id = u.id
      INNER JOIN polox.rewards r ON ur.reward_id = r.id
      LEFT JOIN polox.users gb ON ur.granted_by_user_id = gb.id
      WHERE ur.id = $1 AND u.company_id = $2 AND ur.deleted_at IS NULL
    `;

    try {
      const result = await query(selectQuery, [id, companyId], { companyId });
      const userReward = result.rows[0];
      
      if (userReward) {
        // Parse JSON fields
        userReward.metadata = typeof userReward.metadata === 'string' 
          ? JSON.parse(userReward.metadata) 
          : userReward.metadata;
        userReward.reward_config = typeof userReward.reward_config === 'string' 
          ? JSON.parse(userReward.reward_config) 
          : userReward.reward_config;
      }

      return userReward || null;
    } catch (error) {
      throw new ApiError(500, `Erro ao buscar recompensa: ${error.message}`);
    }
  }

  /**
   * Lista todas as recompensas de um usuário
   * @param {number} userId - ID do usuário
   * @param {number} companyId - ID da empresa
   * @param {Object} options - Opções de filtro
   * @returns {Promise<Array>} Lista de recompensas
   */
  static async findByUser(userId, companyId, options = {}) {
    const { 
      status = null,
      type = null,
      rarity = null,
      include_expired = false,
      page = 1, 
      limit = 50
    } = options;
    
    const offset = (page - 1) * limit;
    
    let whereClause = `
      WHERE ur.user_id = $1 AND u.company_id = $2 AND ur.deleted_at IS NULL
    `;
    const params = [userId, companyId];
    
    if (status) {
      whereClause += ` AND ur.status = $${params.length + 1}`;
      params.push(status);
    }

    if (type) {
      whereClause += ` AND r.type = $${params.length + 1}`;
      params.push(type);
    }

    if (rarity) {
      whereClause += ` AND r.rarity = $${params.length + 1}`;
      params.push(rarity);
    }

    if (!include_expired) {
      whereClause += ` AND (ur.expires_at IS NULL OR ur.expires_at > NOW())`;
    }

    const selectQuery = `
      SELECT 
        ur.id, ur.user_id, ur.reward_id, ur.quantity, ur.status,
        ur.metadata, ur.granted_by_user_id, ur.granted_at, ur.claimed_at,
        ur.expires_at, ur.created_at, ur.updated_at,
        r.title as reward_title,
        r.description as reward_description,
        r.type as reward_type,
        r.icon as reward_icon,
        r.points_cost as reward_points_cost,
        r.rarity as reward_rarity,
        r.config as reward_config,
        CASE 
          WHEN ur.expires_at IS NOT NULL AND ur.expires_at <= NOW() THEN true
          ELSE false
        END as is_expired,
        CASE 
          WHEN ur.expires_at IS NOT NULL THEN 
            EXTRACT(days FROM (ur.expires_at - NOW()))
          ELSE NULL
        END as days_to_expire
      FROM polox.user_rewards ur
      INNER JOIN polox.users u ON ur.user_id = u.id
      INNER JOIN polox.rewards r ON ur.reward_id = r.id
      ${whereClause}
      ORDER BY 
        ur.status ASC,
        CASE r.rarity 
          WHEN 'legendary' THEN 1
          WHEN 'epic' THEN 2
          WHEN 'rare' THEN 3
          WHEN 'uncommon' THEN 4
          WHEN 'common' THEN 5
          ELSE 6
        END,
        ur.expires_at NULLS LAST,
        ur.granted_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    params.push(limit, offset);

    try {
      const result = await query(selectQuery, params, { companyId });
      
      return result.rows.map(ur => {
        // Parse JSON fields
        ur.metadata = typeof ur.metadata === 'string' ? JSON.parse(ur.metadata) : ur.metadata;
        ur.reward_config = typeof ur.reward_config === 'string' 
          ? JSON.parse(ur.reward_config) 
          : ur.reward_config;
        ur.days_to_expire = ur.days_to_expire ? Math.floor(parseFloat(ur.days_to_expire)) : null;
        
        return ur;
      });
    } catch (error) {
      throw new ApiError(500, `Erro ao buscar recompensas do usuário: ${error.message}`);
    }
  }

  /**
   * Lista usuários que receberam uma recompensa específica
   * @param {number} rewardId - ID da recompensa
   * @param {number} companyId - ID da empresa
   * @param {Object} options - Opções de filtro
   * @returns {Promise<Array>} Lista de usuários com a recompensa
   */
  static async findByReward(rewardId, companyId, options = {}) {
    const { 
      status = null,
      page = 1, 
      limit = 50
    } = options;
    
    const offset = (page - 1) * limit;
    
    let whereClause = `
      WHERE ur.reward_id = $1 AND u.company_id = $2 AND ur.deleted_at IS NULL
    `;
    const params = [rewardId, companyId];
    
    if (status) {
      whereClause += ` AND ur.status = $${params.length + 1}`;
      params.push(status);
    }

    const selectQuery = `
      SELECT 
        ur.id, ur.user_id, ur.reward_id, ur.quantity, ur.status,
        ur.granted_at, ur.claimed_at, ur.expires_at, ur.metadata,
        u.full_name as user_name,
        u.email as user_email,
        u.avatar_url as user_avatar,
        up.level as user_level,
        up.total_points as user_total_points
      FROM polox.user_rewards ur
      INNER JOIN polox.users u ON ur.user_id = u.id
      LEFT JOIN polox.user_gamification_profiles up ON u.id = up.user_id
      ${whereClause}
      ORDER BY ur.granted_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    params.push(limit, offset);

    try {
      const result = await query(selectQuery, params, { companyId });
      
      return result.rows.map(ur => {
        // Parse JSON fields
        ur.metadata = typeof ur.metadata === 'string' ? JSON.parse(ur.metadata) : ur.metadata;
        return ur;
      });
    } catch (error) {
      throw new ApiError(500, `Erro ao buscar usuários da recompensa: ${error.message}`);
    }
  }

  /**
   * Reivindica uma recompensa
   * @param {number} id - ID da recompensa do usuário
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object>} Recompensa reivindicada
   */
  static async claim(id, companyId) {
    // Verificar se recompensa existe e pode ser reivindicada
    const existing = await this.findById(id, companyId);
    if (!existing) {
      throw new NotFoundError('Recompensa não encontrada');
    }

    if (existing.status === 'claimed') {
      throw new ValidationError('Recompensa já foi reivindicada');
    }

    if (existing.status === 'expired') {
      throw new ValidationError('Recompensa expirou');
    }

    if (existing.expires_at && new Date(existing.expires_at) <= new Date()) {
      throw new ValidationError('Recompensa expirou');
    }

    const updateQuery = `
      UPDATE polox.user_rewards 
      SET 
        status = 'claimed',
        claimed_at = NOW(),
        updated_at = NOW()
      WHERE id = $1 AND deleted_at IS NULL
      RETURNING 
        id, user_id, reward_id, quantity, status, metadata,
        granted_by_user_id, granted_at, claimed_at, expires_at,
        created_at, updated_at
    `;

    try {
      const result = await query(updateQuery, [id]);
      
      if (result.rows.length === 0) {
        throw new NotFoundError('Recompensa não encontrada');
      }

      const userReward = result.rows[0];
      
      // Parse metadata
      userReward.metadata = typeof userReward.metadata === 'string' 
        ? JSON.parse(userReward.metadata) 
        : userReward.metadata;

      return userReward;
    } catch (error) {
      throw new ApiError(500, `Erro ao reivindicar recompensa: ${error.message}`);
    }
  }

  /**
   * Marca recompensas expiradas
   * @param {number} companyId - ID da empresa
   * @returns {Promise<number>} Número de recompensas marcadas como expiradas
   */
  static async markExpired(companyId) {
    const updateQuery = `
      UPDATE polox.user_rewards 
      SET status = 'expired', updated_at = NOW()
      WHERE expires_at <= NOW() 
        AND status = 'available' 
        AND deleted_at IS NULL
        AND user_id IN (
          SELECT id FROM polox.users WHERE company_id = $1
        )
    `;

    try {
      const result = await query(updateQuery, [companyId]);
      return result.rowCount;
    } catch (error) {
      throw new ApiError(500, `Erro ao marcar recompensas expiradas: ${error.message}`);
    }
  }

  /**
   * Remove uma recompensa de um usuário (soft delete)
   * @param {number} id - ID da recompensa do usuário
   * @param {number} companyId - ID da empresa
   * @returns {Promise<boolean>} True se removido com sucesso
   */
  static async revoke(id, companyId) {
    // Verificar se recompensa existe
    const existing = await this.findById(id, companyId);
    if (!existing) {
      throw new NotFoundError('Recompensa não encontrada');
    }

    const deleteQuery = `
      UPDATE polox.user_rewards 
      SET deleted_at = NOW()
      WHERE id = $1 AND deleted_at IS NULL
    `;

    try {
      const result = await query(deleteQuery, [id]);
      return result.rowCount > 0;
    } catch (error) {
      throw new ApiError(500, `Erro ao revogar recompensa: ${error.message}`);
    }
  }

  /**
   * Estatísticas de recompensas de um usuário
   * @param {number} userId - ID do usuário
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object>} Estatísticas
   */
  static async getStatsByUser(userId, companyId) {
    const statsQuery = `
      SELECT 
        COUNT(*) as total_rewards,
        COUNT(CASE WHEN ur.status = 'available' THEN 1 END) as available_rewards,
        COUNT(CASE WHEN ur.status = 'claimed' THEN 1 END) as claimed_rewards,
        COUNT(CASE WHEN ur.status = 'expired' THEN 1 END) as expired_rewards,
        COALESCE(SUM(ur.quantity), 0) as total_quantity,
        COALESCE(SUM(CASE WHEN ur.status = 'claimed' THEN ur.quantity ELSE 0 END), 0) as claimed_quantity,
        COUNT(CASE WHEN r.type = 'points' AND ur.status = 'claimed' THEN 1 END) as points_rewards_claimed,
        COUNT(CASE WHEN r.type = 'item' AND ur.status = 'claimed' THEN 1 END) as item_rewards_claimed,
        COUNT(CASE WHEN r.type = 'badge' AND ur.status = 'claimed' THEN 1 END) as badge_rewards_claimed,
        COUNT(CASE WHEN r.rarity = 'common' AND ur.status = 'claimed' THEN 1 END) as common_claimed,
        COUNT(CASE WHEN r.rarity = 'uncommon' AND ur.status = 'claimed' THEN 1 END) as uncommon_claimed,
        COUNT(CASE WHEN r.rarity = 'rare' AND ur.status = 'claimed' THEN 1 END) as rare_claimed,
        COUNT(CASE WHEN r.rarity = 'epic' AND ur.status = 'claimed' THEN 1 END) as epic_claimed,
        COUNT(CASE WHEN r.rarity = 'legendary' AND ur.status = 'claimed' THEN 1 END) as legendary_claimed
      FROM polox.user_rewards ur
      INNER JOIN polox.users u ON ur.user_id = u.id
      INNER JOIN polox.rewards r ON ur.reward_id = r.id
      WHERE ur.user_id = $1 AND u.company_id = $2 AND ur.deleted_at IS NULL
    `;

    try {
      const result = await query(statsQuery, [userId, companyId], { companyId });
      const stats = result.rows[0];

      return {
        total_rewards: parseInt(stats.total_rewards) || 0,
        available_rewards: parseInt(stats.available_rewards) || 0,
        claimed_rewards: parseInt(stats.claimed_rewards) || 0,
        expired_rewards: parseInt(stats.expired_rewards) || 0,
        total_quantity: parseInt(stats.total_quantity) || 0,
        claimed_quantity: parseInt(stats.claimed_quantity) || 0,
        claim_rate: stats.total_rewards > 0 
          ? ((stats.claimed_rewards / stats.total_rewards) * 100).toFixed(2)
          : 0,
        by_type: {
          points: parseInt(stats.points_rewards_claimed) || 0,
          item: parseInt(stats.item_rewards_claimed) || 0,
          badge: parseInt(stats.badge_rewards_claimed) || 0
        },
        by_rarity: {
          common: parseInt(stats.common_claimed) || 0,
          uncommon: parseInt(stats.uncommon_claimed) || 0,
          rare: parseInt(stats.rare_claimed) || 0,
          epic: parseInt(stats.epic_claimed) || 0,
          legendary: parseInt(stats.legendary_claimed) || 0
        }
      };
    } catch (error) {
      throw new ApiError(500, `Erro ao buscar estatísticas: ${error.message}`);
    }
  }

  /**
   * Lista recompensas próximas do vencimento
   * @param {number} companyId - ID da empresa
   * @param {number} days - Dias para vencimento (padrão: 3)
   * @returns {Promise<Array>} Lista de recompensas próximas do vencimento
   */
  static async findExpiringSoon(companyId, days = 3) {
    const selectQuery = `
      SELECT 
        ur.id, ur.user_id, ur.reward_id, ur.quantity, ur.expires_at,
        ur.granted_at, ur.metadata,
        u.full_name as user_name,
        u.email as user_email,
        r.title as reward_title,
        r.description as reward_description,
        r.icon as reward_icon,
        r.rarity as reward_rarity,
        EXTRACT(days FROM (ur.expires_at - NOW())) as days_to_expire
      FROM polox.user_rewards ur
      INNER JOIN polox.users u ON ur.user_id = u.id
      INNER JOIN polox.rewards r ON ur.reward_id = r.id
      WHERE u.company_id = $1 
        AND ur.status = 'available'
        AND ur.expires_at IS NOT NULL
        AND ur.expires_at BETWEEN NOW() AND (NOW() + INTERVAL '${days} days')
        AND ur.deleted_at IS NULL
      ORDER BY ur.expires_at ASC, r.rarity ASC
    `;

    try {
      const result = await query(selectQuery, [companyId], { companyId });
      return result.rows.map(ur => ({
        ...ur,
        days_to_expire: Math.floor(parseFloat(ur.days_to_expire)),
        metadata: typeof ur.metadata === 'string' ? JSON.parse(ur.metadata) : ur.metadata
      }));
    } catch (error) {
      throw new ApiError(500, `Erro ao buscar recompensas próximas do vencimento: ${error.message}`);
    }
  }

  /**
   * Conta o total de recompensas por usuário
   * @param {number} userId - ID do usuário
   * @param {number} companyId - ID da empresa
   * @param {Object} filters - Filtros opcionais
   * @returns {Promise<number>} Total de recompensas
   */
  static async count(userId, companyId, filters = {}) {
    let whereClause = `
      WHERE ur.user_id = $1 AND u.company_id = $2 AND ur.deleted_at IS NULL
    `;
    const params = [userId, companyId];

    if (filters.status) {
      whereClause += ` AND ur.status = $${params.length + 1}`;
      params.push(filters.status);
    }

    if (filters.type) {
      whereClause += ` AND r.type = $${params.length + 1}`;
      params.push(filters.type);
    }

    if (filters.rarity) {
      whereClause += ` AND r.rarity = $${params.length + 1}`;
      params.push(filters.rarity);
    }

    if (!filters.include_expired) {
      whereClause += ` AND (ur.expires_at IS NULL OR ur.expires_at > NOW())`;
    }

    const countQuery = `
      SELECT COUNT(*) as total
      FROM polox.user_rewards ur
      INNER JOIN polox.users u ON ur.user_id = u.id
      INNER JOIN polox.rewards r ON ur.reward_id = r.id
      ${whereClause}
    `;

    try {
      const result = await query(countQuery, params, { companyId });
      return parseInt(result.rows[0].total);
    } catch (error) {
      throw new ApiError(500, `Erro ao contar recompensas: ${error.message}`);
    }
  }
}

module.exports = UserRewardModel;