/**
 * ==========================================
 * 👥 CONTROLLER DE USUÁRIOS SIMPLIFICADO
 * ==========================================
 */

// Importar módulos internos
const { query } = require('../config/database');
const { logger, auditLogger } = require('../utils/logger');
const { ApiError, asyncHandler } = require('../utils/errors');
const { tc } = require('../config/i18n');

/**
 * Controller de usuários simplificado
 */
class UserController {

  /**
   * 📋 GET ALL USERS - Listar usuários (versão simplificada)
   */
  static getUsers = asyncHandler(async (req, res) => {
    const { 
      page = 1, 
      limit = 20, 
      search = ''
    } = req.query;

    try {
      // Versão simplificada - buscar todos os usuários
      let whereClause = 'WHERE deleted_at IS NULL';
      let queryParams = [];
      
      // Filtro de busca por nome ou email
      if (search) {
        whereClause += ' AND (full_name ILIKE $1 OR email ILIKE $1)';
        queryParams.push(`%${search}%`);
      }

      // Query para contar total de usuários
      const countResult = await query(`
        SELECT COUNT(*) as total 
        FROM users 
        ${whereClause}
      `, queryParams);

      const totalUsers = parseInt(countResult.rows[0].total);

      // Query para buscar usuários com paginação
      const offset = (page - 1) * limit;
      const usersResult = await query(`
        SELECT 
          id, full_name, email, user_role, company_id, created_at
        FROM users 
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}
      `, [...queryParams, limit, offset]);

      // Formatar resposta
      const users = usersResult.rows.map(user => ({
        id: user.id,
        name: user.full_name,
        email: user.email,
        role: user.user_role,
        companyId: user.company_id,
        createdAt: user.created_at
      }));

      // Log de auditoria
      auditLogger(tc(req, 'userController', 'audit.users_listed'), {
        userId: req.user?.id,
        companyId: req.user?.companyId,
        count: users.length,
        ip: req.ip
      });

      res.json({
        success: true,
        message: tc(req, 'userController', 'list.success'),
        data: {
          users,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: totalUsers,
            pages: Math.ceil(totalUsers / limit)
          }
        }
      });

    } catch (error) {
      throw error;
    }
  });

  /**
   * 👤 GET USER BY ID - Obter usuário específico
   */
  static getUserById = asyncHandler(async (req, res) => {
    const { id } = req.params;

    try {
      const userResult = await query(`
        SELECT 
          id, full_name, email, user_role, company_id, created_at
        FROM users 
        WHERE id = $1 AND deleted_at IS NULL
      `, [id]);

      if (userResult.rows.length === 0) {
        throw new ApiError(404, tc(req, 'userController', 'validation.user_not_found'));
      }

      const user = userResult.rows[0];

      // Log de auditoria
      auditLogger(tc(req, 'userController', 'audit.user_viewed'), {
        userId: req.user?.id,
        viewedUserId: id,
        ip: req.ip
      });

      res.json({
        success: true,
        message: tc(req, 'userController', 'show.success'),
        data: {
          user: {
            id: user.id,
            name: user.full_name,
            email: user.email,
            role: user.user_role,
            companyId: user.company_id,
            createdAt: user.created_at
          }
        }
      });

    } catch (error) {
      throw error;
    }
  });

  /**
   * 📊 GET USER PROFILE - Obter perfil do usuário autenticado
   */
  static getProfile = asyncHandler(async (req, res) => {
    try {
      const userResult = await query(`
        SELECT 
          id, full_name, email, user_role, company_id, created_at
        FROM users 
        WHERE id = $1 AND deleted_at IS NULL
      `, [req.user.id]);

      if (userResult.rows.length === 0) {
        throw new ApiError(404, tc(req, 'userController', 'profile.not_found'));
      }

      const user = userResult.rows[0];

      // Log de auditoria
      auditLogger(tc(req, 'userController', 'audit.profile_viewed'), {
        userId: req.user.id,
        ip: req.ip
      });

      res.json({
        success: true,
        message: tc(req, 'userController', 'profile.get_success'),
        data: {
          user: {
            id: user.id,
            name: user.full_name,
            email: user.email,
            role: user.user_role,
            companyId: user.company_id,
            createdAt: user.created_at
          }
        }
      });

    } catch (error) {
      throw error;
    }
  });

  /**
   * ✏️ UPDATE USER PROFILE - Atualizar perfil do usuário
   */
  static updateProfile = asyncHandler(async (req, res) => {
    const { name, email } = req.body;

    try {
      // Validações básicas
      if (!name || !email) {
        throw new ApiError(400, tc(req, 'userController', 'validation.name_and_email_required'));
      }

      // Verificar se email já existe para outro usuário
      if (email !== req.user.email) {
        const existingUser = await query(`
          SELECT id FROM users 
          WHERE email = $1 AND id != $2 AND deleted_at IS NULL
        `, [email.toLowerCase(), req.user.id]);

        if (existingUser.rows.length > 0) {
          throw new ApiError(409, tc(req, 'userController', 'validation.email_in_use'));
        }
      }

      // Atualizar usuário
      const userResult = await query(`
        UPDATE users 
        SET full_name = $1, email = $2, updated_at = NOW()
        WHERE id = $3 AND deleted_at IS NULL
        RETURNING id, full_name, email, user_role, company_id, created_at, updated_at
      `, [name.trim(), email.toLowerCase(), req.user.id]);

      if (userResult.rows.length === 0) {
        throw new ApiError(404, tc(req, 'userController', 'profile.not_found'));
      }

      const user = userResult.rows[0];

      // Log de auditoria
      auditLogger(tc(req, 'userController', 'audit.profile_updated'), {
        userId: req.user.id,
        changes: { name, email },
        ip: req.ip
      });

      res.json({
        success: true,
        message: tc(req, 'userController', 'profile.update_success'),
        data: {
          user: {
            id: user.id,
            name: user.full_name,
            email: user.email,
            role: user.user_role,
            companyId: user.company_id,
            createdAt: user.created_at,
            updatedAt: user.updated_at
          }
        }
      });

    } catch (error) {
      throw error;
    }
  });

}

module.exports = UserController;