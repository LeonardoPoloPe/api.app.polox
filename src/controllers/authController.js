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
        throw new ApiError(400, "Email e senha são obrigatórios");
      }

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
        process.env.JWT_SECRET ||
          (() => {
            throw new Error("JWT_SECRET não configurado!");
          })(),
        { expiresIn: process.env.JWT_EXPIRES_IN || "24h" }
      );

      // 4. Log de sucesso
      logger.info("Login realizado com sucesso", {
        userId: user.id,
        email: user.email,
        ip: req.ip,
      });

      // 5. Resposta de sucesso
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
    const { name, email, password, companyId = 1, role = "viewer" } = req.body;

    try {
      // Validação básica
      if (!name || !email || !password) {
        throw new ApiError(400, "Nome, email e senha são obrigatórios");
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

      // 4. Log de sucesso
      logger.info("Usuário registrado com sucesso", {
        userId: newUser.id,
        email: newUser.email,
        ip: req.ip,
      });

      // 5. Resposta de sucesso
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
      message: "Logout realizado com sucesso",
    });
  });

  /**
   * 🔄 REFRESH TOKEN - Renovação de token (versão simplificada)
   */
  static refreshToken = asyncHandler(async (req, res) => {
    res.status(501).json({
      success: false,
      message: "Refresh token não implementado ainda",
      code: "NOT_IMPLEMENTED",
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
   * 🔑 RESET PASSWORD - Confirmar nova senha (versão simplificada)
   */
  static resetPassword = asyncHandler(async (req, res) => {
    res.status(501).json({
      success: false,
      message: "Reset de senha não implementado ainda",
      code: "NOT_IMPLEMENTED",
    });
  });

  /**
   * 👤 GET USER PROFILE - Obter perfil do usuário autenticado (versão simplificada)
   */
  static getProfile = asyncHandler(async (req, res) => {
    res.status(501).json({
      success: false,
      message: "Get profile não implementado ainda",
      code: "NOT_IMPLEMENTED",
    });
  });

  /**
   * 📋 GET USER SESSIONS - Listar sessões ativas (versão simplificada)
   */
  static getSessions = asyncHandler(async (req, res) => {
    res.status(501).json({
      success: false,
      message: "Get sessions não implementado ainda",
      code: "NOT_IMPLEMENTED",
    });
  });

  /**
   * 🗑️ REVOKE SESSION - Revogar sessão específica (versão simplificada)
   */
  static revokeSession = asyncHandler(async (req, res) => {
    res.status(501).json({
      success: false,
      message: "Revoke session não implementado ainda",
      code: "NOT_IMPLEMENTED",
    });
  });

  /**
   * 🔍 VALIDATE TOKEN - Validar token atual (versão simplificada)
   */
  static validateToken = asyncHandler(async (req, res) => {
    // Se chegou até aqui, o token já foi validado pelo middleware
    res.json({
      success: true,
      message: "Token válido",
      data: {
        user: req.user || { message: "Dados do usuário não disponíveis" },
      },
    });
  });
}

module.exports = AuthController;
