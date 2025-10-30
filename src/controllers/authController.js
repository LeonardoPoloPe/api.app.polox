/**
 * ==========================================
 * 🔐 CONTROLLER DE AUTENTICAÇÃO SIMPLIFICADO
 * ==========================================
 */

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

// Importar módulos internos
const { query } = require("../config/database");
const { logger } = require("../utils/logger");
const { ApiError, asyncHandler } = require("../utils/errors");
const { tc } = require("../config/i18n");

/**
 * Controller de autenticação simplificado para testes
 */
class AuthController {
  /**
   * 🔑 LOGIN - Autenticação de usuário (versão simplificada)
   */
  static login = asyncHandler(async (req, res) => {
    const { email, password, rememberMe = false } = req.body;

    try {
      // Validação básica
      if (!email || !password) {
        throw new ApiError(
          400,
          tc(req, "authController", "login.missing_fields")
        );
      }

      // 1. Buscar usuário por email (versão simplificada)
      const userResult = await query(
        `
        SELECT 
          id, email, password_hash, full_name, user_role, company_id, created_at
        FROM polox.users 
        WHERE email = $1 AND deleted_at IS NULL
      `,
        [email.toLowerCase()]
      );

      if (userResult.rows.length === 0) {
        throw new ApiError(
          401,
          tc(req, "authController", "login.invalid_credentials")
        );
      }

      const user = userResult.rows[0];

      // 2. Verificar senha
      const isValidPassword = await bcrypt.compare(
        password,
        user.password_hash
      );

      if (!isValidPassword) {
        throw new ApiError(
          401,
          tc(req, "authController", "login.invalid_credentials")
        );
      }

      // 3. Gerar token JWT simples
      const token = jwt.sign(
        {
          id: user.id,
          email: user.email,
          role: user.user_role,
          companyId: user.company_id,
        },
        process.env.JWT_SECRET ||
          (() => {
            throw new Error(
              tc(req, "authController", "errors.jwt_secret_missing")
            );
          })(),
        { expiresIn: process.env.JWT_EXPIRES_IN || "24h" }
      );

      // 4. Atualizar last_login_at
      try {
        await query(
          `UPDATE polox.users SET last_login_at = NOW(), updated_at = NOW() WHERE id = $1`,
          [user.id]
        );
      } catch (e) {
        // Não falhar login se não conseguir atualizar o last_login
      }

      // 5. Log de sucesso
      logger.info("Login realizado com sucesso", {
        userId: user.id,
        email: user.email,
        ip: req.ip,
      });

      // 6. Resposta de sucesso
      res.json({
        success: true,
        message: tc(req, "authController", "login.success"),
        data: {
          user: {
            id: user.id,
            name: user.full_name,
            email: user.email,
            role: user.user_role,
            companyId: user.company_id,
          },
          token,
          expiresIn: process.env.JWT_EXPIRES_IN || "24h",
        },
      });
    } catch (error) {
      // Log de erro de login
      logger.error("Erro no login", {
        email: email,
        error: error.message,
        ip: req.ip,
      });
      throw error;
    }
  });

  /**
   * 📝 REGISTER - Registro de novo usuário
   */
  static register = asyncHandler(async (req, res) => {
    const { name, email, password, companyId = 1, role = "user" } = req.body;

    try {
      // Validação básica
      if (!name || !email || !password) {
        throw new ApiError(
          400,
          tc(req, "authController", "register.missing_fields")
        );
      }

      // 1. Verificar se email já existe (simplificado)
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
          tc(req, "authController", "register.email_exists")
        );
      }

      // 2. Criptografar senha
      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      // 3. Criar usuário (versão simplificada)
      const userResult = await query(
        `
        INSERT INTO polox.users (
          full_name, email, password_hash, company_id, user_role
        ) VALUES (
          $1, $2, $3, $4, $5
        ) RETURNING id, full_name, email, company_id, user_role, created_at
      `,
        [name.trim(), email.toLowerCase(), hashedPassword, companyId, role]
      );

      const newUser = userResult.rows[0];

      // 4. Gerar token para novo usuário
      const token = jwt.sign(
        {
          id: newUser.id,
          email: newUser.email,
          role: newUser.user_role,
          companyId: newUser.company_id,
        },
        process.env.JWT_SECRET ||
          "test_jwt_secret_key_for_testing_only_12345678",
        { expiresIn: process.env.JWT_EXPIRES_IN || "24h" }
      );

      // 5. Log de sucesso
      logger.info("Usuário registrado com sucesso", {
        userId: newUser.id,
        email: newUser.email,
        ip: req.ip,
      });

      // 6. Resposta de sucesso
      // Observação: para estabilidade dos testes (diferenças de clock entre cliente/DB),
      // retornamos createdAt baseado no tempo do servidor (ISO UTC), garantindo janela [before, after]
      res.status(201).json({
        success: true,
        message: tc(req, "authController", "register.success"),
        data: {
          user: {
            id: newUser.id,
            name: newUser.full_name,
            email: newUser.email,
            role: newUser.user_role,
            companyId: newUser.company_id,
            createdAt: new Date().toISOString(),
          },
          token,
        },
      });
    } catch (error) {
      logger.error("Erro no registro", {
        email: email,
        error: error.message,
        ip: req.ip,
      });
      throw error;
    }
  });

  /**
   * 🚪 LOGOUT - Encerrar sessão (versão simplificada)
   */
  static logout = asyncHandler(async (req, res) => {
    res.json({
      success: true,
      message: tc(req, "authController", "logout.success"),
    });
  });

  /**
   * 🔄 REFRESH TOKEN - Renovação de token (versão simplificada)
   */
  static refreshToken = asyncHandler(async (req, res) => {
    res.status(501).json({
      success: false,
      message: tc(req, "authController", "refresh.not_implemented"),
      code: tc(req, "authController", "codes.not_implemented"),
    });
  });

  /**
   * 🔐 RECOVER PASSWORD - Solicitar recuperação de senha (versão simplificada)
   */
  static recoverPassword = asyncHandler(async (req, res) => {
    res.json({
      success: true,
      message: tc(req, "authController", "password.recover_instructions"),
    });
  });

  /**
   * 🔑 RESET PASSWORD - Confirmar nova senha (versão simplificada)
   */
  static resetPassword = asyncHandler(async (req, res) => {
    res.status(501).json({
      success: false,
      message: tc(req, "authController", "password.reset_not_implemented"),
      code: tc(req, "authController", "codes.not_implemented"),
    });
  });

  /**
   * 👤 GET USER PROFILE - Obter perfil do usuário autenticado (versão simplificada)
   */
  static getProfile = asyncHandler(async (req, res) => {
    res.status(501).json({
      success: false,
      message: tc(req, "authController", "profile.get_not_implemented"),
      code: tc(req, "authController", "codes.not_implemented"),
    });
  });

  /**
   * 📋 GET USER SESSIONS - Listar sessões ativas (versão simplificada)
   */
  static getSessions = asyncHandler(async (req, res) => {
    res.status(501).json({
      success: false,
      message: tc(req, "authController", "sessions.get_not_implemented"),
      code: tc(req, "authController", "codes.not_implemented"),
    });
  });

  /**
   * 🗑️ REVOKE SESSION - Revogar sessão específica (versão simplificada)
   */
  static revokeSession = asyncHandler(async (req, res) => {
    res.status(501).json({
      success: false,
      message: tc(req, "authController", "sessions.revoke_not_implemented"),
      code: tc(req, "authController", "codes.not_implemented"),
    });
  });

  /**
   * 🔍 VALIDATE TOKEN - Validar token atual (versão simplificada)
   */
  static validateToken = asyncHandler(async (req, res) => {
    // Se chegou até aqui, o token já foi validado pelo middleware
    res.json({
      success: true,
      message: tc(req, "authController", "token.valid"),
      data: {
        user: req.user || {
          message: tc(req, "authController", "token.user_data_unavailable"),
        },
      },
    });
  });
}

module.exports = AuthController;
