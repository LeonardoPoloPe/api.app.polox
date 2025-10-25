const { query, transaction } = require("../config/database");
const { ApiError, ValidationError, NotFoundError } = require("../utils/errors");

/**
 * Model para sessões de usuário (JWT tracking)
 * Baseado no schema polox.user_sessions
 */
class UserSessionModel {
  /**
   * Cria uma nova sessão
   * @param {Object} sessionData - Dados da sessão
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object>} Sessão criada
   */
  static async create(sessionData, companyId) {
    const {
      user_id,
      token_id, // jti do JWT
      refresh_token,
      ip_address,
      user_agent,
      device_info = {},
      expires_at,
    } = sessionData;

    // Validar dados obrigatórios
    if (!user_id || !token_id || !expires_at) {
      throw new ValidationError(
        "User ID, Token ID e data de expiração são obrigatórios"
      );
    }

    const insertQuery = `
      INSERT INTO polox.user_sessions (
        user_id, token_id, refresh_token, ip_address, user_agent, 
        device_info, company_id, expires_at, created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
      RETURNING 
        id, user_id, token_id, refresh_token, ip_address, user_agent,
        device_info, company_id, expires_at, revoked_at, created_at
    `;

    try {
      const result = await query(insertQuery, [
        user_id,
        token_id,
        refresh_token,
        ip_address,
        user_agent,
        JSON.stringify(device_info),
        companyId,
        expires_at,
      ]);

      return result.rows[0];
    } catch (error) {
      if (error.code === "23505") {
        if (error.constraint?.includes("token_id")) {
          throw new ValidationError("Token ID já existe");
        }
        if (error.constraint?.includes("refresh_token")) {
          throw new ValidationError("Refresh token já existe");
        }
      }
      if (error.code === "23503") {
        throw new ValidationError("Usuário informado não existe");
      }
      throw new ApiError(500, `Erro ao criar sessão: ${error.message}`);
    }
  }

  /**
   * Busca sessão por token ID
   * @param {string} tokenId - Token ID (jti do JWT)
   * @returns {Promise<Object|null>} Sessão encontrada ou null
   */
  static async findByTokenId(tokenId) {
    const selectQuery = `
      SELECT 
        s.id, s.user_id, s.token_id, s.refresh_token, s.ip_address,
        s.user_agent, s.device_info, s.company_id, s.expires_at, s.revoked_at, s.created_at,
        u.full_name as user_name,
        u.email as user_email,
        c.name as company_name
      FROM polox.user_sessions s
      INNER JOIN polox.users u ON s.user_id = u.id
      INNER JOIN polox.companies c ON s.company_id = c.id
      WHERE s.token_id = $1
    `;

    try {
      const result = await query(selectQuery, [tokenId]);
      return result.rows[0] || null;
    } catch (error) {
      throw new ApiError(500, `Erro ao buscar sessão: ${error.message}`);
    }
  }

  /**
   * Busca sessão por refresh token
   * @param {string} refreshToken - Refresh token
   * @returns {Promise<Object|null>} Sessão encontrada ou null
   */
  static async findByRefreshToken(refreshToken) {
    const selectQuery = `
      SELECT 
        s.id, s.user_id, s.token_id, s.refresh_token, s.ip_address,
        s.user_agent, s.device_info, s.expires_at, s.revoked_at, s.created_at,
        u.full_name as user_name,
        u.email as user_email,
        u.company_id,
        c.name as company_name
      FROM polox.user_sessions s
      INNER JOIN polox.users u ON s.user_id = u.id
      INNER JOIN polox.companies c ON u.company_id = c.id
      WHERE s.refresh_token = $1 AND s.revoked_at IS NULL
    `;

    try {
      const result = await query(selectQuery, [refreshToken]);
      return result.rows[0] || null;
    } catch (error) {
      throw new ApiError(500, `Erro ao buscar sessão: ${error.message}`);
    }
  }

  /**
   * Lista sessões ativas de um usuário
   * @param {number} userId - ID do usuário
   * @param {Object} options - Opções de filtro
   * @returns {Promise<Array>} Lista de sessões
   */
  static async findByUser(userId, options = {}) {
    const { include_expired = false, page = 1, limit = 10 } = options;

    const offset = (page - 1) * limit;

    let whereClause = "WHERE s.user_id = $1 AND s.revoked_at IS NULL";
    const params = [userId];

    if (!include_expired) {
      whereClause += " AND s.expires_at > NOW()";
    }

    const selectQuery = `
      SELECT 
        s.id, s.user_id, s.token_id, s.refresh_token, s.ip_address,
        s.user_agent, s.device_info, s.expires_at, s.revoked_at, s.created_at
      FROM polox.user_sessions s
      ${whereClause}
      ORDER BY s.created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    params.push(limit, offset);

    try {
      const result = await query(selectQuery, params);
      return result.rows;
    } catch (error) {
      throw new ApiError(500, `Erro ao buscar sessões: ${error.message}`);
    }
  }

  /**
   * Verifica se uma sessão é válida
   * @param {string} tokenId - Token ID
   * @returns {Promise<boolean>} True se válida
   */
  static async isValid(tokenId) {
    const selectQuery = `
      SELECT id
      FROM polox.user_sessions 
      WHERE token_id = $1 
        AND revoked_at IS NULL 
        AND expires_at > NOW()
    `;

    try {
      const result = await query(selectQuery, [tokenId]);
      return result.rows.length > 0;
    } catch (error) {
      throw new ApiError(500, `Erro ao verificar sessão: ${error.message}`);
    }
  }

  /**
   * Revoga uma sessão
   * @param {string} tokenId - Token ID
   * @returns {Promise<boolean>} True se revogada
   */
  static async revoke(tokenId) {
    const revokeQuery = `
      UPDATE polox.user_sessions 
      SET revoked_at = NOW()
      WHERE token_id = $1 AND revoked_at IS NULL
    `;

    try {
      const result = await query(revokeQuery, [tokenId]);
      return result.rowCount > 0;
    } catch (error) {
      throw new ApiError(500, `Erro ao revogar sessão: ${error.message}`);
    }
  }

  /**
   * Revoga todas as sessões de um usuário
   * @param {number} userId - ID do usuário
   * @param {string} exceptTokenId - Token ID para não revogar (sessão atual)
   * @returns {Promise<number>} Número de sessões revogadas
   */
  static async revokeAllByUser(userId, exceptTokenId = null) {
    let revokeQuery = `
      UPDATE polox.user_sessions 
      SET revoked_at = NOW()
      WHERE user_id = $1 AND revoked_at IS NULL
    `;
    const params = [userId];

    if (exceptTokenId) {
      revokeQuery += ` AND token_id != $${params.length + 1}`;
      params.push(exceptTokenId);
    }

    try {
      const result = await query(revokeQuery, params);
      return result.rowCount;
    } catch (error) {
      throw new ApiError(500, `Erro ao revogar sessões: ${error.message}`);
    }
  }

  /**
   * Atualiza refresh token de uma sessão
   * @param {string} tokenId - Token ID
   * @param {string} newRefreshToken - Novo refresh token
   * @returns {Promise<Object>} Sessão atualizada
   */
  static async updateRefreshToken(tokenId, newRefreshToken) {
    const updateQuery = `
      UPDATE polox.user_sessions 
      SET refresh_token = $1
      WHERE token_id = $2 AND revoked_at IS NULL
      RETURNING 
        id, user_id, token_id, refresh_token, ip_address,
        user_agent, device_info, expires_at, revoked_at, created_at
    `;

    try {
      const result = await query(updateQuery, [newRefreshToken, tokenId]);

      if (result.rows.length === 0) {
        throw new NotFoundError("Sessão não encontrada ou já revogada");
      }

      return result.rows[0];
    } catch (error) {
      if (error.code === "23505") {
        throw new ValidationError("Refresh token já existe");
      }
      throw new ApiError(
        500,
        `Erro ao atualizar refresh token: ${error.message}`
      );
    }
  }

  /**
   * Remove sessões expiradas
   * @returns {Promise<number>} Número de sessões removidas
   */
  static async cleanupExpired() {
    const cleanupQuery = `
      DELETE FROM polox.user_sessions 
      WHERE expires_at < NOW() OR revoked_at < NOW() - INTERVAL '30 days'
    `;

    try {
      const result = await query(cleanupQuery);
      return result.rowCount;
    } catch (error) {
      throw new ApiError(500, `Erro ao limpar sessões: ${error.message}`);
    }
  }

  /**
   * Estatísticas de sessões ativas
   * @param {number} companyId - ID da empresa (opcional)
   * @returns {Promise<Object>} Estatísticas
   */
  static async getActiveStats(companyId = null) {
    let whereClause = `
      WHERE s.revoked_at IS NULL AND s.expires_at > NOW()
    `;
    const params = [];

    if (companyId) {
      whereClause += ` AND u.company_id = $${params.length + 1}`;
      params.push(companyId);
    }

    const statsQuery = `
      SELECT 
        COUNT(*) as total_active_sessions,
        COUNT(DISTINCT s.user_id) as unique_active_users,
        AVG(EXTRACT(EPOCH FROM (s.expires_at - s.created_at))/3600) as avg_session_duration_hours,
        COUNT(CASE WHEN s.created_at > NOW() - INTERVAL '1 day' THEN 1 END) as sessions_last_24h,
        COUNT(CASE WHEN s.created_at > NOW() - INTERVAL '1 hour' THEN 1 END) as sessions_last_hour
      FROM polox.user_sessions s
      INNER JOIN polox.users u ON s.user_id = u.id
      ${whereClause}
    `;

    try {
      const result = await query(statsQuery, params);
      const stats = result.rows[0];

      return {
        total_active_sessions: parseInt(stats.total_active_sessions) || 0,
        unique_active_users: parseInt(stats.unique_active_users) || 0,
        avg_session_duration_hours:
          parseFloat(stats.avg_session_duration_hours) || 0,
        sessions_last_24h: parseInt(stats.sessions_last_24h) || 0,
        sessions_last_hour: parseInt(stats.sessions_last_hour) || 0,
      };
    } catch (error) {
      throw new ApiError(500, `Erro ao buscar estatísticas: ${error.message}`);
    }
  }

  /**
   * Lista sessões com informações de dispositivo
   * @param {number} userId - ID do usuário
   * @returns {Promise<Array>} Lista de sessões com info de dispositivo
   */
  static async getUserDevices(userId) {
    const selectQuery = `
      SELECT 
        s.id,
        s.token_id,
        s.ip_address,
        s.user_agent,
        s.device_info,
        s.expires_at,
        s.created_at,
        CASE 
          WHEN s.revoked_at IS NOT NULL THEN 'revoked'
          WHEN s.expires_at < NOW() THEN 'expired'
          ELSE 'active'
        END as status
      FROM polox.user_sessions s
      WHERE s.user_id = $1
      ORDER BY s.created_at DESC
      LIMIT 20
    `;

    try {
      const result = await query(selectQuery, [userId]);
      return result.rows.map((session) => ({
        ...session,
        device_info:
          typeof session.device_info === "string"
            ? JSON.parse(session.device_info)
            : session.device_info,
      }));
    } catch (error) {
      throw new ApiError(500, `Erro ao buscar dispositivos: ${error.message}`);
    }
  }

  /**
   * Conta sessões ativas por empresa
   * @param {number} companyId - ID da empresa
   * @returns {Promise<number>} Número de sessões ativas
   */
  static async countActiveByCompany(companyId) {
    const countQuery = `
      SELECT COUNT(*) as total
      FROM polox.user_sessions s
      INNER JOIN polox.users u ON s.user_id = u.id
      WHERE u.company_id = $1 
        AND s.revoked_at IS NULL 
        AND s.expires_at > NOW()
    `;

    try {
      const result = await query(countQuery, [companyId]);
      return parseInt(result.rows[0].total);
    } catch (error) {
      throw new ApiError(500, `Erro ao contar sessões: ${error.message}`);
    }
  }

  /**
   * Busca sessões suspeitas (múltiplos IPs para mesmo usuário)
   * @param {number} companyId - ID da empresa (opcional)
   * @returns {Promise<Array>} Lista de usuários com múltiplos IPs
   */
  static async findSuspiciousSessions(companyId = null) {
    let whereClause = `
      WHERE s.revoked_at IS NULL 
        AND s.expires_at > NOW()
        AND s.created_at > NOW() - INTERVAL '24 hours'
    `;
    const params = [];

    if (companyId) {
      whereClause += ` AND u.company_id = $${params.length + 1}`;
      params.push(companyId);
    }

    const suspiciousQuery = `
      SELECT 
        s.user_id,
        u.full_name as user_name,
        u.email as user_email,
        COUNT(DISTINCT s.ip_address) as unique_ips,
        array_agg(DISTINCT s.ip_address) as ip_addresses,
        COUNT(*) as session_count
      FROM polox.user_sessions s
      INNER JOIN polox.users u ON s.user_id = u.id
      ${whereClause}
      GROUP BY s.user_id, u.name, u.email
      HAVING COUNT(DISTINCT s.ip_address) > 3
      ORDER BY unique_ips DESC
    `;

    try {
      const result = await query(suspiciousQuery, params);
      return result.rows;
    } catch (error) {
      throw new ApiError(
        500,
        `Erro ao buscar sessões suspeitas: ${error.message}`
      );
    }
  }
}

module.exports = UserSessionModel;
