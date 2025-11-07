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

const jwt = require("jsonwebtoken");
const { query } = require("../config/database");
const { jwt: jwtConfig, security } = require("../config/auth");
const { ApiError } = require("../utils/errors");
const { logger } = require("../utils/logger");

/**
 * Middleware de autenticação JWT para sistema multi-tenant
 * Valida tokens e carrega dados do usuário com informações da empresa
 */

/**
 * Middleware principal de autenticação (versão simplificada)
 * Verifica token JWT e carrega dados do usuário
 */
const authMiddleware = async (req, res, next) => {
  try {
    // Extrair token do header Authorization
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new ApiError(401, "Token de acesso requerido");
    }

    const token = authHeader.substring(7); // Remove "Bearer "

    // Verificar e decodificar token (versão simplificada)
    let decoded;
    try {
      decoded = jwt.verify(
        token,
        process.env.JWT_SECRET ||
          (() => {
            throw new Error("JWT_SECRET não configurado!");
          })()
      );
    } catch (jwtError) {
      if (jwtError.name === "TokenExpiredError") {
        throw new ApiError(401, "Token expirado");
      } else if (jwtError.name === "JsonWebTokenError") {
        throw new ApiError(401, "Token inválido");
      } else {
        throw new ApiError(401, "Falha na verificação do token");
      }
    }

    // Buscar dados do usuário (versão simplificada)
    const userResult = await query(
      `
      SELECT 
        id, full_name, email, user_role, company_id, created_at
      FROM polox.users
      WHERE id = $1 AND deleted_at IS NULL
    `,
      [decoded.id]
    );

    if (userResult.rows.length === 0) {
      throw new ApiError(401, "Usuário não encontrado ou inativo");
    }

    const user = userResult.rows[0];

    // Adicionar dados do usuário ao request
    req.user = {
      id: user.id,
      companyId: user.company_id,
      name: user.full_name,
      email: user.email,
      role: user.user_role,
      createdAt: user.created_at,
    };

    // Log de atividade se em desenvolvimento
    if (process.env.NODE_ENV === "dev") {
      logger.info("Usuário autenticado:", {
        userId: user.id,
        email: user.email,
        role: user.role,
        endpoint: `${req.method} ${req.path}`,
      });
    }

    next();
  } catch (error) {
    // Retornar erro padronizado
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json({
        success: false,
        error: error.message,
        code: "AUTH_ERROR",
        timestamp: new Date().toISOString(),
      });
    }

    return res.status(500).json({
      success: false,
      error: "Erro interno de autenticação",
      code: "INTERNAL_AUTH_ERROR",
      timestamp: new Date().toISOString(),
    });
  }
};

/**
 * Middleware opcional de autenticação
 * Não falha se não houver token, mas carrega dados se houver
 */
const optionalAuthMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    // Sem token, continuar sem usuário
    req.user = null;
    return next();
  }

  // Tem token, tentar autenticar
  return authMiddleware(req, res, next);
};

/**
 * Verifica se token está em blacklist (versão simplificada)
 * @param {string} token - Token JWT
 * @returns {boolean} False por enquanto (não implementado)
 */
const checkTokenBlacklist = async (token) => {
  // Por enquanto, não verificamos blacklist até termos a tabela
  return false;
};

/**
 * Adiciona token à blacklist (versão simplificada)
 * @param {string} token - Token JWT
 * @param {number} expiresAt - Timestamp de expiração
 */
const blacklistToken = async (token, expiresAt) => {
  // Por enquanto, não implementamos blacklist
  logger.info("Blacklist de token não implementado ainda");
};

/**
 * Middleware para verificar se usuário tem role específico
 * @param {string|string[]} requiredRoles - Role(s) necessário(s)
 */
const requireRole = (requiredRoles) => {
  const roles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: "Autenticação requerida",
        code: "AUTH_REQUIRED",
        timestamp: new Date().toISOString(),
      });
    }

    if (!roles.includes(req.user.role)) {
      logger.warn("Acesso negado por role:", {
        userId: req.user.id,
        userRole: req.user.role,
        requiredRoles: roles,
        endpoint: `${req.method} ${req.path}`,
        timestamp: new Date().toISOString(),
      });

      return res.status(403).json({
        success: false,
        error: "Permissão insuficiente",
        code: "INSUFFICIENT_ROLE",
        timestamp: new Date().toISOString(),
      });
    }

    next();
  };
};

/**
 * Middleware para verificar se usuário é admin da empresa ou super admin
 */
const requireCompanyAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: "Autenticação requerida",
      code: "AUTH_REQUIRED",
      timestamp: new Date().toISOString(),
    });
  }

  const allowedRoles = ["super_admin", "company_admin"];
  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      error: "Acesso restrito a administradores",
      code: "ADMIN_REQUIRED",
      timestamp: new Date().toISOString(),
    });
  }

  next();
};

/**
 * Middleware para verificar se usuário é super admin
 */
const requireSuperAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: "Autenticação requerida",
      code: "AUTH_REQUIRED",
      timestamp: new Date().toISOString(),
    });
  }

  if (req.user.role !== "super_admin") {
    return res.status(403).json({
      success: false,
      error: "Acesso restrito a super administradores",
      code: "SUPER_ADMIN_REQUIRED",
      timestamp: new Date().toISOString(),
    });
  }

  next();
};

module.exports = {
  authMiddleware,
  authenticateToken: authMiddleware, // Alias para compatibilidade
  optionalAuthMiddleware,
  requireRole,
  requireCompanyAdmin,
  requireSuperAdmin,
  blacklistToken,
  checkTokenBlacklist,
};
