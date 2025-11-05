/**
 * ==========================================
 * 👥 CONTROLLER DE USUÁRIOS SIMPLIFICADO
 * ==========================================
 */

// Importar módulos internos
const { query } = require("../config/database");
const { logger, auditLogger } = require("../utils/logger");
const { ApiError, asyncHandler } = require("../utils/errors");
const { tc } = require("../config/i18n");

/**
 * Controller de usuários simplificado
 */
class UserController {
  /**
   * 📋 GET ALL USERS - Listar usuários (versão simplificada)
   */
  static getUsers = asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, search = "", companyId } = req.query;

    try {
      let whereClause = "WHERE deleted_at IS NULL";
      let queryParams = [];
      let paramIndex = 1;

      // Filtro de busca por nome ou email
      if (search) {
        whereClause += ` AND (full_name ILIKE $${paramIndex} OR email ILIKE $${paramIndex})`;
        queryParams.push(`%${search}%`);
        paramIndex++;
      }

      // Filtro por companyId
      if (companyId) {
        whereClause += ` AND company_id = $${paramIndex}`;
        queryParams.push(companyId);
        paramIndex++;
      }

      // Query para contar total de usuários
      const countResult = await query(
        `
        SELECT COUNT(*) as total 
        FROM users 
        ${whereClause}
      `,
        queryParams
      );

      const totalUsers = parseInt(countResult.rows[0].total);

      // Query para buscar usuários com paginação
      const offset = (page - 1) * limit;
      const usersResult = await query(
        `
        SELECT 
          id, full_name, email, user_role, company_id, created_at
        FROM users 
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `,
        [...queryParams, limit, offset]
      );

      // Formatar resposta
      const users = usersResult.rows.map((user) => ({
        id: user.id,
        name: user.full_name,
        email: user.email,
        role: user.user_role,
        companyId: user.company_id,
        createdAt: user.created_at,
      }));

      // Log de auditoria
      auditLogger(tc(req, "userController", "audit.users_listed"), {
        userId: req.user?.id,
        companyId: req.user?.companyId,
        count: users.length,
        ip: req.ip,
      });

      res.json({
        success: true,
        message: tc(req, "userController", "list.success"),
        data: {
          users,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: totalUsers,
            pages: Math.ceil(totalUsers / limit),
          },
        },
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
      const userResult = await query(
        `
        SELECT 
          id, full_name, email, user_role, company_id, created_at
        FROM users 
        WHERE id = $1 AND deleted_at IS NULL
      `,
        [id]
      );

      if (userResult.rows.length === 0) {
        throw new ApiError(
          404,
          tc(req, "userController", "validation.user_not_found")
        );
      }

      const user = userResult.rows[0];

      // Log de auditoria
      auditLogger(tc(req, "userController", "audit.user_viewed"), {
        userId: req.user?.id,
        viewedUserId: id,
        ip: req.ip,
      });

      res.json({
        success: true,
        message: tc(req, "userController", "show.success"),
        data: {
          user: {
            id: user.id,
            name: user.full_name,
            email: user.email,
            role: user.user_role,
            companyId: user.company_id,
            createdAt: user.created_at,
          },
        },
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
      const userResult = await query(
        `
        SELECT 
          id, full_name, email, user_role, company_id, created_at
        FROM users 
        WHERE id = $1 AND deleted_at IS NULL
      `,
        [req.user.id]
      );

      if (userResult.rows.length === 0) {
        throw new ApiError(404, tc(req, "userController", "profile.not_found"));
      }

      const user = userResult.rows[0];

      // Log de auditoria
      auditLogger(tc(req, "userController", "audit.profile_viewed"), {
        userId: req.user.id,
        ip: req.ip,
      });

      res.json({
        success: true,
        message: tc(req, "userController", "profile.get_success"),
        data: {
          user: {
            id: user.id,
            name: user.full_name,
            email: user.email,
            role: user.user_role,
            companyId: user.company_id,
            createdAt: user.created_at,
          },
        },
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
        throw new ApiError(
          400,
          tc(req, "userController", "validation.name_and_email_required")
        );
      }

      // Verificar se email já existe para outro usuário
      if (email !== req.user.email) {
        const existingUser = await query(
          `
          SELECT id FROM users 
          WHERE email = $1 AND id != $2 AND deleted_at IS NULL
        `,
          [email.toLowerCase(), req.user.id]
        );

        if (existingUser.rows.length > 0) {
          throw new ApiError(
            409,
            tc(req, "userController", "validation.email_in_use")
          );
        }
      }

      // Atualizar usuário
      const userResult = await query(
        `
        UPDATE users 
        SET full_name = $1, email = $2, updated_at = NOW()
        WHERE id = $3 AND deleted_at IS NULL
        RETURNING id, full_name, email, user_role, company_id, created_at, updated_at
      `,
        [name.trim(), email.toLowerCase(), req.user.id]
      );

      if (userResult.rows.length === 0) {
        throw new ApiError(404, tc(req, "userController", "profile.not_found"));
      }

      const user = userResult.rows[0];

      // Log de auditoria
      auditLogger(tc(req, "userController", "audit.profile_updated"), {
        userId: req.user.id,
        changes: { name, email },
        ip: req.ip,
      });

      res.json({
        success: true,
        message: tc(req, "userController", "profile.update_success"),
        data: {
          user: {
            id: user.id,
            name: user.full_name,
            email: user.email,
            role: user.user_role,
            companyId: user.company_id,
            createdAt: user.created_at,
            updatedAt: user.updated_at,
          },
        },
      });
    } catch (error) {
      throw error;
    }
  });

  /**
   * ✨ CREATE USER - Criar novo usuário (admin)
   */
  static createUser = asyncHandler(async (req, res) => {
    const { name, email, password, role = "user", company_id } = req.body;

    try {
      // Validações básicas
      if (!name || !email || !password) {
        throw new ApiError(
          400,
          tc(req, "userController", "validation.name_email_password_required")
        );
      }

      if (password.length < 6) {
        throw new ApiError(
          400,
          tc(req, "userController", "validation.password_min_length")
        );
      }

      // Determinar company_id: usar o do body se fornecido, senão usar do usuário autenticado
      const targetCompanyId =
        company_id || req.user.company_id || req.user.companyId;

      if (!targetCompanyId) {
        throw new ApiError(
          400,
          tc(req, "userController", "validation.company_id_required")
        );
      }

      // Verificar se email já existe
      const existingUser = await query(
        `
        SELECT id FROM users 
        WHERE email = $1 AND deleted_at IS NULL
      `,
        [email.toLowerCase()]
      );

      if (existingUser.rows.length > 0) {
        throw new ApiError(
          409,
          tc(req, "userController", "validation.email_in_use")
        );
      }

      // Criptografar senha
      const bcrypt = require("bcryptjs");
      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      // Criar usuário
      const userResult = await query(
        `
        INSERT INTO users (
          full_name, email, password_hash, user_role, company_id
        ) VALUES (
          $1, $2, $3, $4, $5
        ) RETURNING id, full_name, email, user_role, company_id, created_at
      `,
        [
          name.trim(),
          email.toLowerCase(),
          hashedPassword,
          role,
          parseInt(targetCompanyId),
        ]
      );

      const newUser = userResult.rows[0];

      // Log de auditoria
      auditLogger(tc(req, "userController", "audit.user_created"), {
        userId: req.user.id,
        createdUserId: newUser.id,
        createdUserEmail: newUser.email,
        ip: req.ip,
      });

      res.status(201).json({
        success: true,
        message: tc(req, "userController", "create.success"),
        data: {
          user: {
            id: newUser.id,
            name: newUser.full_name,
            email: newUser.email,
            role: newUser.user_role,
            companyId: newUser.company_id,
            createdAt: newUser.created_at,
          },
        },
      });
    } catch (error) {
      throw error;
    }
  });

  /**
   * 🔑 RESET PASSWORD - Resetar senha do usuário
   */
  static resetPassword = asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const { newPassword } = req.body;

    try {
      // Validações básicas
      if (!newPassword) {
        throw new ApiError(
          400,
          tc(req, "userController", "validation.new_password_required")
        );
      }

      if (newPassword.length < 6) {
        throw new ApiError(
          400,
          tc(req, "userController", "validation.password_min_length")
        );
      }

      // Verificar se usuário existe
      const userResult = await query(
        `
        SELECT id, email, full_name FROM users 
        WHERE id = $1 AND deleted_at IS NULL
      `,
        [userId]
      );

      if (userResult.rows.length === 0) {
        throw new ApiError(
          404,
          tc(req, "userController", "validation.user_not_found")
        );
      }

      const user = userResult.rows[0];

      // Criptografar nova senha
      const bcrypt = require("bcryptjs");
      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

      // Atualizar senha
      await query(
        `
        UPDATE users 
        SET password_hash = $1, updated_at = NOW()
        WHERE id = $2
      `,
        [hashedPassword, userId]
      );

      // Log de auditoria
      auditLogger(tc(req, "userController", "audit.password_reset"), {
        userId: req.user.id,
        targetUserId: userId,
        targetUserEmail: user.email,
        ip: req.ip,
      });

      res.json({
        success: true,
        message: tc(req, "userController", "reset_password.success"),
        data: {
          userId: parseInt(userId),
          email: user.email,
        },
      });
    } catch (error) {
      throw error;
    }
  });

  /**
   * 🔑 CHANGE PASSWORD - Alterar própria senha
   */
  static changePassword = asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    try {
      // Validações básicas
      if (!currentPassword || !newPassword) {
        throw new ApiError(
          400,
          tc(
            req,
            "userController",
            "validation.current_and_new_password_required"
          )
        );
      }

      if (newPassword.length < 6) {
        throw new ApiError(
          400,
          tc(req, "userController", "validation.password_min_length")
        );
      }

      // Buscar usuário atual
      const userResult = await query(
        `
        SELECT id, email, password_hash, full_name FROM users 
        WHERE id = $1 AND deleted_at IS NULL
      `,
        [req.user.id]
      );

      if (userResult.rows.length === 0) {
        throw new ApiError(
          404,
          tc(req, "userController", "validation.user_not_found")
        );
      }

      const user = userResult.rows[0];

      // Verificar senha atual
      const bcrypt = require("bcryptjs");
      const isValidPassword = await bcrypt.compare(
        currentPassword,
        user.password_hash
      );

      if (!isValidPassword) {
        throw new ApiError(
          401,
          tc(req, "userController", "validation.invalid_current_password")
        );
      }

      // Criptografar nova senha
      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

      // Atualizar senha
      await query(
        `
        UPDATE users 
        SET password_hash = $1, updated_at = NOW()
        WHERE id = $2
      `,
        [hashedPassword, req.user.id]
      );

      // Log de auditoria
      auditLogger(tc(req, "userController", "audit.password_changed"), {
        userId: req.user.id,
        email: user.email,
        ip: req.ip,
      });

      res.json({
        success: true,
        message: tc(req, "userController", "change_password.success"),
      });
    } catch (error) {
      throw error;
    }
  });
}

module.exports = UserController;
