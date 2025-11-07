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
const { logger } = require("../models");

/**
 * Gera um token JWT
 * @param {Object} payload - Dados do usuário para incluir no token
 * @param {string} expiresIn - Tempo de expiração (ex: '1h', '7d')
 * @returns {string} Token JWT
 */
const generateToken = (payload, expiresIn = "1h") => {
  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error("JWT_SECRET não configurado");
    }

    return jwt.sign(payload, secret, {
      expiresIn,
      issuer: "api-polox",
      audience: "polox-users",
    });
  } catch (error) {
    logger.error("Erro ao gerar token:", error);
    throw new Error("Erro ao gerar token de autenticação");
  }
};

/**
 * Gera tokens de acesso e refresh
 * @param {Object} user - Dados do usuário
 * @returns {Object} Objeto com access_token e refresh_token
 */
const generateTokens = (user) => {
  const payload = {
    id: user.id,
    email: user.email,
    name: user.name,
  };

  const accessToken = generateToken(payload, "1h");
  const refreshToken = generateToken({ id: user.id }, "7d");

  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_in: 3600, // 1 hora em segundos
    token_type: "Bearer",
  };
};

/**
 * Verifica e decodifica um token JWT
 * @param {string} token - Token JWT
 * @returns {Object} Payload decodificado
 */
const verifyToken = (token) => {
  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error("JWT_SECRET não configurado");
    }

    return jwt.verify(token, secret, {
      issuer: "api-polox",
      audience: "polox-users",
    });
  } catch (error) {
    if (error.name === "JsonWebTokenError") {
      throw new Error("Token inválido");
    }
    if (error.name === "TokenExpiredError") {
      throw new Error("Token expirado");
    }
    throw new Error("Erro ao verificar token");
  }
};

/**
 * Middleware para autenticação via JWT
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @param {Function} next - Next middleware function
 */
const authenticateToken = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        error: "Token de autenticação não fornecido",
        message: "Acesso negado. Faça login para continuar.",
        timestamp: new Date().toISOString(),
      });
    }

    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7)
      : authHeader;

    if (!token) {
      return res.status(401).json({
        error: "Formato de token inválido",
        message: "Use o formato: Bearer <token>",
        timestamp: new Date().toISOString(),
      });
    }

    const decoded = verifyToken(token);
    req.user = decoded;

    // Log de autenticação bem-sucedida
    logger.info("Usuário autenticado:", {
      userId: decoded.id,
      email: decoded.email,
      route: req.path,
      method: req.method,
    });

    next();
  } catch (error) {
    logger.warn("Falha na autenticação:", {
      error: error.message,
      route: req.path,
      method: req.method,
      ip: req.ip,
    });

    return res.status(401).json({
      error: "Token inválido",
      message: error.message,
      timestamp: new Date().toISOString(),
    });
  }
};

/**
 * Middleware para autorização baseada em roles (exemplo para futura implementação)
 * @param {Array} allowedRoles - Roles permitidas
 * @returns {Function} Middleware function
 */
const authorize = (allowedRoles = []) => {
  return (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          error: "Usuário não autenticado",
          timestamp: new Date().toISOString(),
        });
      }

      // Se não há roles específicas, permite qualquer usuário autenticado
      if (allowedRoles.length === 0) {
        return next();
      }

      // Verifica se o usuário tem uma das roles permitidas
      const userRoles = req.user.roles || [];
      const hasPermission = allowedRoles.some((role) =>
        userRoles.includes(role)
      );

      if (!hasPermission) {
        logger.warn("Acesso negado por role:", {
          userId: req.user.id,
          userRoles,
          requiredRoles: allowedRoles,
          route: req.path,
        });

        return res.status(403).json({
          error: "Acesso negado",
          message: "Você não tem permissão para acessar este recurso",
          timestamp: new Date().toISOString(),
        });
      }

      next();
    } catch (error) {
      logger.error("Erro na autorização:", error);
      return res.status(500).json({
        error: "Erro interno na verificação de permissões",
        timestamp: new Date().toISOString(),
      });
    }
  };
};

/**
 * Extrai token do header Authorization
 * @param {Object} req - Request object
 * @returns {string|null} Token extraído ou null
 */
const extractToken = (req) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return null;
  }

  return authHeader.startsWith("Bearer ") ? authHeader.slice(7) : authHeader;
};

/**
 * Middleware opcional de autenticação (não falha se não houver token)
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @param {Function} next - Next middleware function
 */
const optionalAuth = (req, res, next) => {
  try {
    const token = extractToken(req);

    if (token) {
      const decoded = verifyToken(token);
      req.user = decoded;
    }

    next();
  } catch (error) {
    // Em caso de erro, continua sem autenticação
    logger.info("Token inválido em rota opcional:", error.message);
    next();
  }
};

module.exports = {
  generateToken,
  generateTokens,
  verifyToken,
  authenticateToken,
  authorize,
  extractToken,
  optionalAuth,
};
