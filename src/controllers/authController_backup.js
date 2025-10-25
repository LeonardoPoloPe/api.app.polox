/**
 * ==========================================
 * 🔐 CONTROLLER DE AUTENTICAÇÃO ENTERPRISE
 * ==========================================
 */

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");

// Importar módulos internos
const { query, transaction } = require("../config/database");
const { logger } = require("../utils/logger");
const { ApiError, asyncHandler } = require("../utils/errors");

/**
 * Controller de autenticação enterprise
 * Gerencia login, registro, tokens e sessões com segurança avançada
 */
class AuthController {
  /**
   * 🔑 LOGIN - Autenticação de usuário (versão simplificada)
   */
  static login = asyncHandler(async (req, res) => {
    const { email, password, rememberMe = false } = req.body;

    try {
      // 1. Buscar usuário por email (versão simplificada)
      const userResult = await query(
        `
        SELECT 
          id, email, password_hash, name, role, company_id, created_at
        FROM users 
        WHERE email = $1 AND deleted_at IS NULL
      `,
        [email.toLowerCase()]
      );

      if (userResult.rows.length === 0) {
        throw new ApiError(401, "Credenciais inválidas");
      }

      const user = userResult.rows[0];

      // 2. Verificar senha
      const isValidPassword = await bcrypt.compare(
        password,
        user.password_hash
      );

      if (!isValidPassword) {
        throw new ApiError(401, "Credenciais inválidas");
      }

      // 3. Gerar token JWT simples
      const token = jwt.sign(
        {
          id: user.id,
          email: user.email,
          role: user.role,
          companyId: user.company_id,
        },
        process.env.JWT_SECRET || "your-secret-key",
        { expiresIn: process.env.JWT_EXPIRES_IN || "24h" }
      );

      // 4. Resposta de sucesso
      res.json({
        success: true,
        message: "Login realizado com sucesso",
        data: {
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            companyId: user.company_id,
          },
          token,
          expiresIn: process.env.JWT_EXPIRES_IN || "24h",
        },
      });
    } catch (error) {
      throw error;
    }
  });

  /**
   * 📝 REGISTER - Registro de novo usuário
   */
  static register = asyncHandler(async (req, res) => {
    const {
      name,
      email,
      password,
      companyId = 1,
      role = "viewer",
      department,
      position,
      phone,
      permissions = [],
    } = req.body;

    try {
      // Versão simplificada para testes

      // 1. Verificar se email já existe (simplificado)
      const existingUser = await query(
        `
        SELECT id FROM users 
        WHERE email = $1 AND deleted_at IS NULL
      `,
        [email.toLowerCase()]
      );

      if (existingUser.rows.length > 0) {
        throw new ApiError(409, "Email já cadastrado");
      }

      // 2. Criptografar senha
      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      // 3. Criar usuário (versão simplificada)
      const userResult = await query(
        `
        INSERT INTO users (
          name, email, password_hash, company_id, role
        ) VALUES (
          $1, $2, $3, $4, $5
        ) RETURNING id, name, email, company_id, role, created_at
      `,
        [name.trim(), email.toLowerCase(), hashedPassword, companyId, role]
      );

      const newUser = userResult.rows[0];

      // 8. Resposta de sucesso (sem dados sensíveis)
      res.status(201).json({
        success: true,
        message: "Usuário registrado com sucesso",
        data: {
          user: {
            id: newUser.id,
            name: newUser.name,
            email: newUser.email,
            role: newUser.role,
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
   * 🔄 REFRESH TOKEN - Renovação de token de acesso (versão simplificada)
   */
  static refreshToken = asyncHandler(async (req, res) => {
    // Implementação simplificada para testes
    res.status(501).json({
      success: false,
      message: "Refresh token não implementado ainda",
      code: "NOT_IMPLEMENTED",
    });
  });

  /**
   * 🚪 LOGOUT - Encerrar sessão (versão simplificada)
   */
  static logout = asyncHandler(async (req, res) => {
    res.json({
      success: true,
      message: "Logout realizado com sucesso",
    });
  });

  /**
   * 🔐 RECOVER PASSWORD - Solicitar recuperação de senha (versão simplificada)
   */
  static recoverPassword = asyncHandler(async (req, res) => {
    res.json({
      success: true,
      message:
        "Se o email estiver cadastrado, você receberá instruções para redefinir sua senha",
    });
  });

  /**
   * 🔑 RESET PASSWORD - Confirmar nova senha
   */
  static resetPassword = asyncHandler(async (req, res) => {
    const { token, newPassword } = req.body;

    try {
      // 1. Verificar token de recuperação
      const resetResult = await query(
        `
        SELECT pr.user_id, pr.expires_at, u.email, u.name
        FROM password_resets pr
        INNER JOIN users u ON pr.user_id = u.id
        WHERE pr.token = $1 AND pr.expires_at > NOW()
      `,
        [token]
      );

      if (resetResult.rows.length === 0) {
        throw new ApiError(400, "Token de recuperação inválido ou expirado");
      }

      const reset = resetResult.rows[0];

      // 2. Criptografar nova senha
      const hashedPassword = await hashPassword(newPassword);

      // 3. Atualizar senha do usuário
      await query(
        `
        UPDATE users 
        SET password = $1, updated_at = NOW()
        WHERE id = $2
      `,
        [hashedPassword, reset.user_id]
      );

      // 4. Remover token de recuperação usado
      await query(
        `
        DELETE FROM password_resets WHERE user_id = $1
      `,
        [reset.user_id]
      );

      // 5. Invalidar todas as sessões do usuário
      await query(
        `
        DELETE FROM polox.user_sessions WHERE user_id = $1
      `,
        [reset.user_id]
      );

      // 6. Log de auditoria
      auditLogger("Senha redefinida via recuperação", {
        userId: reset.user_id,
        email: reset.email,
        ip: req.ip,
        userAgent: req.get("User-Agent"),
      });

      res.json({
        success: true,
        message: "Senha redefinida com sucesso. Faça login com sua nova senha.",
      });
    } catch (error) {
      throw error;
    }
  });

  /**
   * 👤 GET USER PROFILE - Obter perfil do usuário autenticado
   */
  static getProfile = asyncHandler(async (req, res) => {
    try {
      // Buscar dados completos do usuário
      const userResult = await query(
        `
        SELECT 
          u.id, u.name, u.email, u.role, u.department, u.position, u.phone,
          u.permissions, u.created_at, u.last_login,
          c.id as company_id, c.name as company_name, c.plan as company_plan,
          c.modules as company_modules
        FROM users u
        INNER JOIN companies c ON u.company_id = c.id
        WHERE u.id = $1 AND u.deleted_at IS NULL
      `,
        [req.user.id]
      );

      if (userResult.rows.length === 0) {
        throw new ApiError(404, "Usuário não encontrado");
      }

      const user = userResult.rows[0];

      res.json({
        success: true,
        data: {
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            department: user.department,
            position: user.position,
            phone: user.phone,
            permissions: user.permissions || [],
            createdAt: user.created_at,
            lastLogin: user.last_login,
            company: {
              id: user.company_id,
              name: user.company_name,
              plan: user.company_plan,
              modules: user.company_modules || [],
            },
          },
        },
      });
    } catch (error) {
      throw error;
    }
  });

  /**
   * 📋 GET USER SESSIONS - Listar sessões ativas do usuário
   */
  static getSessions = asyncHandler(async (req, res) => {
    try {
      const sessionsResult = await query(
        `
        SELECT 
          id, ip_address, user_agent, created_at, last_activity, expires_at
        FROM polox.user_sessions
        WHERE user_id = $1 AND company_id = $2
        ORDER BY last_activity DESC
      `,
        [req.user.id, req.user.company_id]
      );

      const sessions = sessionsResult.rows.map((session) => ({
        id: session.id,
        ipAddress: session.ip_address,
        userAgent: session.user_agent,
        createdAt: session.created_at,
        lastActivity: session.last_activity,
        expiresAt: session.expires_at,
        isCurrent: session.id === req.user.sessionId,
      }));

      res.json({
        success: true,
        data: { sessions },
      });
    } catch (error) {
      throw error;
    }
  });

  /**
   * 🗑️ REVOKE SESSION - Revogar sessão específica
   */
  static revokeSession = asyncHandler(async (req, res) => {
    const { sessionId } = req.params;

    try {
      const result = await query(
        `
        DELETE FROM polox.user_sessions 
        WHERE id = $1 AND user_id = $2 AND company_id = $3
        RETURNING id
      `,
        [sessionId, req.user.id, req.user.company_id]
      );

      if (result.rows.length === 0) {
        throw new ApiError(404, "Sessão não encontrada");
      }

      auditLogger("Sessão revogada pelo usuário", {
        userId: req.user.id,
        revokedSessionId: sessionId,
        currentSessionId: req.user.sessionId,
        ip: req.ip,
      });

      res.json({
        success: true,
        message: "Sessão revogada com sucesso",
      });
    } catch (error) {
      throw error;
    }
  });

  /**
   * 🔍 VALIDATE TOKEN - Validar token atual
   */
  static validateToken = asyncHandler(async (req, res) => {
    // Se chegou até aqui, o token já foi validado pelo middleware
    res.json({
      success: true,
      message: "Token válido",
      data: {
        user: {
          id: req.user.id,
          email: req.user.email,
          name: req.user.name,
          role: req.user.role,
          companyId: req.user.companyId,
          permissions: req.user.permissions,
        },
      },
    });
  });

  /**
   * 🏢 HELPER - Obter roles permitidas por plano
   */
  static getRolesForPlan(plan) {
    const rolesByPlan = {
      basic: ["viewer"],
      professional: ["viewer", "editor"],
      enterprise: ["viewer", "editor", "admin"],
      premium: ["viewer", "editor", "admin", "super_admin"],
    };

    return rolesByPlan[plan] || ["viewer"];
  }
}

module.exports = AuthController;
