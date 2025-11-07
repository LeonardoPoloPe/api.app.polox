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
const bcrypt = require('bcryptjs');
const { ApiError, ValidationError, NotFoundError, ConflictError } = require('../utils/errors');
const { bcrypt: bcryptConfig } = require('../config/auth');

/**
 * Model para gerenciamento de usuários (multi-tenant)
 * Baseado no schema polox.users
 */
class UserModel {
  /**
   * Cria um novo usuário
   * @param {Object} userData - Dados do usuário
   * @returns {Promise<Object>} Usuário criado (sem senha)
   */
  static async create(userData) {
    const {
      company_id,
      full_name,
      email,
      password,
      user_role = 'user',
      permissions = [],
      avatar_url = null,
      phone,
      position,
      department,
      language = 'pt-BR',
      timezone = 'America/Sao_Paulo',
      preferences = {}
    } = userData;

    // Validar dados obrigatórios
    if (!company_id || !full_name || !email || !password) {
      throw new ValidationError('Company ID, nome, email e senha são obrigatórios');
    }

    // Hash da senha
    const passwordHash = await bcrypt.hash(password, bcryptConfig.rounds);

    const insertQuery = `
      INSERT INTO polox.users (
        company_id, full_name, email, password_hash, user_role, permissions,
        avatar_url, phone, position, department, language, timezone, 
        preferences, status, failed_login_attempts, created_at, updated_at
      )
      VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10, $11, $12,
        $13, 'active', 0, NOW(), NOW()
      )
      RETURNING 
        id, company_id, full_name, email, user_role, permissions,
        avatar_url, phone, position, department, language, timezone, 
        preferences, status, created_at, updated_at
    `;

    try {
      const result = await query(insertQuery, [
        company_id, full_name, email, passwordHash, user_role, JSON.stringify(permissions),
        avatar_url, phone, position, department, language, timezone, 
        JSON.stringify(preferences)
      ], { companyId: company_id });

      return result.rows[0];
    } catch (error) {
      if (error.code === '23505') {
        throw new ConflictError('Email já está em uso nesta empresa');
      }
      if (error.code === '23503' && error.constraint?.includes('company_id')) {
        throw new ValidationError('Empresa não encontrada');
      }
      throw new ApiError(500, `Erro ao criar usuário: ${error.message}`);
    }
  }

  /**
   * Busca usuário por email (dentro de uma empresa específica)
   * @param {string} email - Email do usuário
   * @param {number} companyId - ID da empresa (para isolamento multi-tenant)
   * @returns {Promise<Object|null>} Usuário encontrado ou null
   */
  static async findByEmail(email, companyId = null) {
    let selectQuery;
    let params;

    if (companyId) {
      // Busca com isolamento multi-tenant
      selectQuery = `
        SELECT 
          u.id, u.company_id, u.full_name, u.email, u.password_hash, u.user_role, 
          u.permissions, u.status, u.avatar_url, u.phone, u.position, u.department,
          u.language, u.timezone, u.preferences, u.last_login_at, u.last_login_ip,
          u.failed_login_attempts, u.locked_until, u.email_verified_at,
          u.created_at, u.updated_at,
          c.company_name, c.company_domain, 
          c.plan as company_plan, c.enabled_modules as company_modules,
          c.status as company_status
        FROM polox.users u
        JOIN polox.companies c ON u.company_id = c.id
        WHERE u.email = $1 AND u.company_id = $2 
          AND u.status = 'active' AND u.deleted_at IS NULL
          AND c.status = 'active' AND c.deleted_at IS NULL
      `;
      params = [email, companyId];
    } else {
      // Busca global (para super admin)
      selectQuery = `
        SELECT 
          u.id, u.company_id, u.full_name, u.email, u.password_hash, u.user_role, 
          u.permissions, u.status, u.phone, u.position, u.department,
          u.language, u.timezone, u.preferences, u.last_login_at,
          u.created_at, u.updated_at,
          c.company_name, c.company_domain, 
          c.plan as company_plan, c.enabled_modules as company_modules,
          c.status as company_status
        FROM users u
        LEFT JOIN companies c ON u.company_id = c.id
        WHERE u.email = $1 AND u.status = 'active' AND u.deleted_at IS NULL
      `;
      params = [email];
    }

    try {
      const result = await query(selectQuery, params);
      return result.rows[0] || null;
    } catch (error) {
      throw new ApiError(500, `Erro ao buscar usuário: ${error.message}`);
    }
  }

  /**
   * Busca usuário por ID
   * @param {number} id - ID do usuário
   * @param {number} companyId - ID da empresa (para isolamento multi-tenant)
   * @returns {Promise<Object|null>} Usuário encontrado ou null (sem senha)
   */
  static async findById(id, companyId = null) {
    let selectQuery;
    let params;

    if (companyId) {
      // Busca com isolamento multi-tenant
      selectQuery = `
        SELECT 
          u.id, u.company_id, u.full_name, u.email, u.user_role, u.permissions, 
          u.status, u.phone, u.position, u.department, u.language, 
          u.timezone, u.preferences, u.last_login_at, u.created_at, u.updated_at,
          c.company_name, c.company_domain, 
          c.plan as company_plan, c.enabled_modules as company_modules,
          c.status as company_status
        FROM users u
        JOIN companies c ON u.company_id = c.id
        WHERE u.id = $1 AND u.company_id = $2 
          AND u.status = 'active' AND u.deleted_at IS NULL
          AND c.status = 'active' AND c.deleted_at IS NULL
      `;
      params = [id, companyId];
    } else {
      // Busca global (para super admin)
      selectQuery = `
        SELECT 
          u.id, u.company_id, u.full_name, u.email, u.user_role, u.permissions, 
          u.status, u.phone, u.position, u.department, u.language, 
          u.timezone, u.preferences, u.last_login_at, u.created_at, u.updated_at,
          c.company_name, c.company_domain, 
          c.plan as company_plan, c.enabled_modules as company_modules,
          c.status as company_status
        FROM users u
        LEFT JOIN companies c ON u.company_id = c.id
        WHERE u.id = $1 AND u.status = 'active' AND u.deleted_at IS NULL
      `;
      params = [id];
    }

    try {
      const result = await query(selectQuery, params);
      return result.rows[0] || null;
    } catch (error) {
      throw new ApiError(500, `Erro ao buscar usuário: ${error.message}`);
    }
  }

  /**
   * Verifica se a senha está correta
   * @param {string} password - Senha fornecida
   * @param {string} hash - Hash armazenado no banco
   * @returns {Promise<boolean>} True se a senha estiver correta
   */
  static async verifyPassword(password, hash) {
    try {
      return await bcrypt.compare(password, hash);
    } catch (error) {
      throw new ApiError(500, `Erro ao verificar senha: ${error.message}`);
    }
  }

  /**
   * Atualiza dados do usuário
   * @param {number} id - ID do usuário
   * @param {Object} updateData - Dados para atualizar
   * @param {number} companyId - ID da empresa (para isolamento multi-tenant)
   * @returns {Promise<Object|null>} Usuário atualizado ou null
   */
  static async update(id, updateData, companyId = null) {
    const allowedFields = [
      'full_name', 'email', 'phone', 'position', 'department', 
      'language', 'timezone', 'preferences', 'user_role', 'permissions'
    ];
    
    const updates = [];
    const values = [];
    let paramCount = 1;

    // Construir query dinamicamente
    for (const [key, value] of Object.entries(updateData)) {
      if (allowedFields.includes(key)) {
        if (key === 'preferences' || key === 'permissions') {
          updates.push(`${key} = $${paramCount}`);
          values.push(JSON.stringify(value));
        } else {
          updates.push(`${key} = $${paramCount}`);
          values.push(value);
        }
        paramCount++;
      }
    }

    if (updates.length === 0) {
      throw new ValidationError('Nenhum campo válido para atualizar');
    }

    updates.push('updated_at = NOW()');
    values.push(id);

    let whereClause = `id = $${paramCount}`;
    if (companyId) {
      values.push(companyId);
      whereClause += ` AND company_id = $${paramCount + 1}`;
    }
    whereClause += ` AND deleted_at IS NULL`;

    const updateQuery = `
      UPDATE users 
      SET ${updates.join(', ')}
      WHERE ${whereClause}
      RETURNING 
        id, company_id, full_name, email, user_role, permissions, status,
        phone, position, department, language, timezone, preferences,
        created_at, updated_at
    `;

    try {
      const result = await query(updateQuery, values);
      return result.rows[0] || null;
    } catch (error) {
      if (error.code === '23505') {
        throw new ConflictError('Email já está em uso');
      }
      throw new ApiError(500, `Erro ao atualizar usuário: ${error.message}`);
    }
  }

  /**
   * Atualiza senha do usuário
   * @param {number} id - ID do usuário
   * @param {string} newPassword - Nova senha
   * @param {number} companyId - ID da empresa (para isolamento multi-tenant)
   * @returns {Promise<boolean>} True se atualizada com sucesso
   */
  static async updatePassword(id, newPassword, companyId = null) {
    const passwordHash = await bcrypt.hash(newPassword, bcryptConfig.rounds);
    
    let whereClause = 'id = $1';
    let params = [passwordHash, id];
    
    if (companyId) {
      whereClause += ' AND company_id = $3';
      params.push(companyId);
    }
    whereClause += ' AND deleted_at IS NULL';

    const updateQuery = `
      UPDATE users 
      SET 
        password_hash = $1,
        updated_at = NOW(),
        failed_login_attempts = 0,
        locked_until = NULL
      WHERE ${whereClause}
      RETURNING id
    `;

    try {
      const result = await query(updateQuery, params);
      return result.rowCount > 0;
    } catch (error) {
      throw new ApiError(500, `Erro ao atualizar senha: ${error.message}`);
    }
  }

  /**
   * Atualiza último login do usuário
   * @param {number} id - ID do usuário
   * @param {string} ip - IP do login
   * @returns {Promise<boolean>} True se atualizado com sucesso
   */
  static async updateLastLogin(id, ip = null) {
    const updateQuery = `
      UPDATE users 
      SET 
        last_login_at = NOW(),
        last_login_ip = $2,
        failed_login_attempts = 0,
        updated_at = NOW()
      WHERE id = $1 AND deleted_at IS NULL
      RETURNING id
    `;

    try {
      const result = await query(updateQuery, [id, ip]);
      return result.rowCount > 0;
    } catch (error) {
      throw new ApiError(500, `Erro ao atualizar último login: ${error.message}`);
    }
  }

  /**
   * Incrementa tentativas de login falhadas
   * @param {number} id - ID do usuário
   * @returns {Promise<Object>} Status do bloqueio
   */
  static async incrementFailedAttempts(id) {
    const { security } = require('../config/auth');
    const maxAttempts = security.login.maxFailedAttempts;
    const lockoutDuration = security.login.lockoutDuration;

    const updateQuery = `
      UPDATE users 
      SET 
        failed_login_attempts = failed_login_attempts + 1,
        locked_until = CASE 
          WHEN failed_login_attempts + 1 >= $2 
          THEN NOW() + INTERVAL '${lockoutDuration} milliseconds'
          ELSE locked_until
        END,
        updated_at = NOW()
      WHERE id = $1 AND deleted_at IS NULL
      RETURNING failed_login_attempts, locked_until
    `;

    try {
      const result = await query(updateQuery, [id, maxAttempts]);
      const user = result.rows[0];
      
      return {
        attempts: user.failed_login_attempts,
        isLocked: user.locked_until && new Date(user.locked_until) > new Date(),
        lockedUntil: user.locked_until
      };
    } catch (error) {
      throw new ApiError(500, `Erro ao incrementar tentativas: ${error.message}`);
    }
  }

  /**
   * Verifica se usuário está bloqueado
   * @param {number} id - ID do usuário
   * @returns {Promise<boolean>} True se estiver bloqueado
   */
  static async isLocked(id) {
    const selectQuery = `
      SELECT locked_until
      FROM users
      WHERE id = $1 AND deleted_at IS NULL
    `;

    try {
      const result = await query(selectQuery, [id]);
      if (result.rows.length === 0) return false;
      
      const lockedUntil = result.rows[0].locked_until;
      return lockedUntil && new Date(lockedUntil) > new Date();
    } catch (error) {
      throw new ApiError(500, `Erro ao verificar bloqueio: ${error.message}`);
    }
  }

  /**
   * Desativa um usuário (soft delete)
   * @param {number} id - ID do usuário
   * @param {number} companyId - ID da empresa (para isolamento multi-tenant)
   * @returns {Promise<boolean>} True se o usuário foi desativado
   */
  static async deactivate(id, companyId = null) {
    let whereClause = 'id = $1';
    let params = [id];
    
    if (companyId) {
      whereClause += ' AND company_id = $2';
      params.push(companyId);
    }
    whereClause += ' AND deleted_at IS NULL';

    const updateQuery = `
      UPDATE users 
      SET 
        status = 'inactive', 
        deleted_at = NOW(),
        updated_at = NOW()
      WHERE ${whereClause}
      RETURNING id
    `;

    try {
      const result = await query(updateQuery, params);
      return result.rowCount > 0;
    } catch (error) {
      throw new ApiError(500, `Erro ao desativar usuário: ${error.message}`);
    }
  }

  /**
   * Lista usuários com paginação e filtros
   * @param {Object} options - Opções de busca
   * @returns {Promise<Object>} Lista de usuários e metadados
   */
  static async list(options = {}) {
    const {
      page = 1,
      limit = 10,
      companyId = null,
      status = 'active',
      role = null,
      search = null,
      sortBy = 'created_at',
      sortOrder = 'DESC'
    } = options;

    const offset = (page - 1) * limit;
    const conditions = ['u.deleted_at IS NULL'];
    const values = [];
    let paramCount = 1;

    // Filtro por empresa (obrigatório se não for super admin)
    if (companyId) {
      conditions.push(`u.company_id = $${paramCount}`);
      values.push(companyId);
      paramCount++;
    }

    // Filtro por status
    if (status) {
      conditions.push(`u.status = $${paramCount}`);
      values.push(status);
      paramCount++;
    }

    // Filtro por role
    if (role) {
      conditions.push(`u.user_role = $${paramCount}`);
      values.push(role);
      paramCount++;
    }

    // Busca textual
    if (search) {
      conditions.push(`(u.name ILIKE $${paramCount} OR u.email ILIKE $${paramCount} OR u.position ILIKE $${paramCount})`);
      values.push(`%${search}%`);
      paramCount++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    
    // Query para contar total
    const countQuery = `
      SELECT COUNT(*) 
      FROM users u 
      ${whereClause}
    `;
    
    // Query para buscar dados
    const selectQuery = `
      SELECT 
        u.id, u.company_id, u.full_name, u.email, u.user_role, u.permissions,
        u.status, u.phone, u.position, u.department, u.language,
        u.timezone, u.last_login_at, u.created_at, u.updated_at,
        c.company_name, c.company_domain
      FROM users u
      LEFT JOIN companies c ON u.company_id = c.id
      ${whereClause}
      ORDER BY u.${sortBy} ${sortOrder}
      LIMIT $${paramCount} OFFSET $${paramCount + 1}
    `;

    try {
      const [countResult, dataResult] = await Promise.all([
        query(countQuery, values),
        query(selectQuery, [...values, limit, offset])
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
      throw new ApiError(500, `Erro ao listar usuários: ${error.message}`);
    }
  }

  /**
   * Conta usuários por empresa
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object>} Contadores por status
   */
  static async countByCompany(companyId) {
    const countQuery = `
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active,
        COUNT(CASE WHEN status = 'inactive' THEN 1 END) as inactive,
        COUNT(CASE WHEN user_role = 'company_admin' THEN 1 END) as admins,
        COUNT(CASE WHEN user_role = 'manager' THEN 1 END) as managers,
        COUNT(CASE WHEN user_role = 'user' THEN 1 END) as users
      FROM users
      WHERE company_id = $1 AND deleted_at IS NULL
    `;

    try {
      const result = await query(countQuery, [companyId]);
      return result.rows[0];
    } catch (error) {
      throw new ApiError(500, `Erro ao contar usuários: ${error.message}`);
    }
  }

  /**
   * Busca usuários por role
   * @param {string} user_role - Role a buscar
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Array>} Lista de usuários
   */
  static async findByRole(user_role, companyId = null) {
    let whereClause = 'user_role = $1 AND status = \'active\' AND deleted_at IS NULL';
    let params = [user_role];

    if (companyId) {
      whereClause += ' AND company_id = $2';
      params.push(companyId);
    }

    const selectQuery = `
      SELECT 
        id, company_id, full_name, email, user_role, phone, position,
        created_at, updated_at
      FROM users
      WHERE ${whereClause}
      ORDER BY full_name
    `;

    try {
      const result = await query(selectQuery, params);
      return result.rows;
    } catch (error) {
      throw new ApiError(500, `Erro ao buscar usuários por role: ${error.message}`);
    }
  }

  /**
   * Verifica se email já existe na empresa
   * @param {string} email - Email a verificar
   * @param {number} companyId - ID da empresa
   * @param {number} excludeUserId - ID do usuário a excluir da verificação
   * @returns {Promise<boolean>} True se email existe
   */
  static async emailExists(email, companyId, excludeUserId = null) {
    let whereClause = 'email = $1 AND company_id = $2 AND deleted_at IS NULL';
    let params = [email, companyId];

    if (excludeUserId) {
      whereClause += ' AND id != $3';
      params.push(excludeUserId);
    }

    const selectQuery = `
      SELECT id FROM polox.users WHERE ${whereClause} LIMIT 1
    `;

    try {
      const result = await query(selectQuery, params, { companyId });
      return result.rows.length > 0;
    } catch (error) {
      throw new ApiError(500, `Erro ao verificar email: ${error.message}`);
    }
  }

  /**
   * Atualiza último login do usuário
   * @param {number} userId - ID do usuário
   * @param {string} ipAddress - IP do login
   * @returns {Promise<boolean>} True se atualizado
   */
  static async updateLastLogin(userId, ipAddress = null) {
    const updateQuery = `
      UPDATE polox.users 
      SET last_login_at = NOW(), last_login_ip = $2, failed_login_attempts = 0
      WHERE id = $1
    `;

    try {
      const result = await query(updateQuery, [userId, ipAddress]);
      return result.rowCount > 0;
    } catch (error) {
      throw new ApiError(500, `Erro ao atualizar último login: ${error.message}`);
    }
  }

  /**
   * Incrementa tentativas de login falhadas
   * @param {number} userId - ID do usuário
   * @returns {Promise<number>} Número atual de tentativas
   */
  static async incrementFailedAttempts(userId) {
    const updateQuery = `
      UPDATE polox.users 
      SET failed_login_attempts = failed_login_attempts + 1
      WHERE id = $1
      RETURNING failed_login_attempts
    `;

    try {
      const result = await query(updateQuery, [userId]);
      return result.rows[0]?.failed_login_attempts || 0;
    } catch (error) {
      throw new ApiError(500, `Erro ao incrementar tentativas: ${error.message}`);
    }
  }

  /**
   * Bloqueia usuário por tentativas excessivas
   * @param {number} userId - ID do usuário
   * @param {number} minutes - Minutos para bloquear
   * @returns {Promise<boolean>} True se bloqueado
   */
  static async lockUser(userId, minutes = 30) {
    const updateQuery = `
      UPDATE polox.users 
      SET locked_until = NOW() + INTERVAL '${minutes} minutes'
      WHERE id = $1
    `;

    try {
      const result = await query(updateQuery, [userId]);
      return result.rowCount > 0;
    } catch (error) {
      throw new ApiError(500, `Erro ao bloquear usuário: ${error.message}`);
    }
  }

  /**
   * Gera token de verificação de email
   * @param {number} userId - ID do usuário
   * @returns {Promise<string>} Token gerado
   */
  static async generateVerificationToken(userId) {
    const crypto = require('crypto');
    const token = crypto.randomBytes(32).toString('hex');

    const updateQuery = `
      UPDATE polox.users 
      SET verification_token = $2
      WHERE id = $1
    `;

    try {
      await query(updateQuery, [userId, token]);
      return token;
    } catch (error) {
      throw new ApiError(500, `Erro ao gerar token: ${error.message}`);
    }
  }

  /**
   * Verifica email do usuário
   * @param {string} token - Token de verificação
   * @returns {Promise<boolean>} True se verificado
   */
  static async verifyEmail(token) {
    const updateQuery = `
      UPDATE polox.users 
      SET email_verified_at = NOW(), verification_token = NULL
      WHERE verification_token = $1 AND email_verified_at IS NULL
    `;

    try {
      const result = await query(updateQuery, [token]);
      return result.rowCount > 0;
    } catch (error) {
      throw new ApiError(500, `Erro ao verificar email: ${error.message}`);
    }
  }

  /**
   * Gera token de reset de senha
   * @param {string} email - Email do usuário
   * @param {number} companyId - ID da empresa
   * @returns {Promise<string|null>} Token gerado ou null se usuário não encontrado
   */
  static async generatePasswordResetToken(email, companyId) {
    const crypto = require('crypto');
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

    const updateQuery = `
      UPDATE polox.users 
      SET reset_password_token = $3, reset_password_expires_at = $4
      WHERE email = $1 AND company_id = $2 AND deleted_at IS NULL
    `;

    try {
      const result = await query(updateQuery, [email, companyId, token, expiresAt], { companyId });
      return result.rowCount > 0 ? token : null;
    } catch (error) {
      throw new ApiError(500, `Erro ao gerar token de reset: ${error.message}`);
    }
  }

  /**
   * Reseta senha usando token
   * @param {string} token - Token de reset
   * @param {string} newPassword - Nova senha
   * @returns {Promise<boolean>} True se resetado
   */
  static async resetPassword(token, newPassword) {
    const passwordHash = await bcrypt.hash(newPassword, bcryptConfig.rounds);

    const updateQuery = `
      UPDATE polox.users 
      SET password_hash = $2, reset_password_token = NULL, reset_password_expires_at = NULL
      WHERE reset_password_token = $1 
        AND reset_password_expires_at > NOW()
        AND deleted_at IS NULL
    `;

    try {
      const result = await query(updateQuery, [token, passwordHash]);
      return result.rowCount > 0;
    } catch (error) {
      throw new ApiError(500, `Erro ao resetar senha: ${error.message}`);
    }
  }

  /**
   * Atualiza avatar do usuário
   * @param {number} userId - ID do usuário
   * @param {string} avatarUrl - URL do avatar
   * @param {number} companyId - ID da empresa
   * @returns {Promise<boolean>} True se atualizado
   */
  static async updateAvatar(userId, avatarUrl, companyId) {
    const updateQuery = `
      UPDATE polox.users 
      SET avatar_url = $2, updated_at = NOW()
      WHERE id = $1 AND company_id = $3 AND deleted_at IS NULL
    `;

    try {
      const result = await query(updateQuery, [userId, avatarUrl, companyId], { companyId });
      return result.rowCount > 0;
    } catch (error) {
      throw new ApiError(500, `Erro ao atualizar avatar: ${error.message}`);
    }
  }
}

module.exports = UserModel;
