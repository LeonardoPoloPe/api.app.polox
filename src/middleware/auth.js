const jwt = require('jsonwebtoken');
const { query } = require('../config/database');
const { jwt: jwtConfig, security } = require('../config/auth');
const { ApiError } = require('../utils/errors');
const { logger } = require('../utils/logger');

/**
 * Middleware de autenticação JWT para sistema multi-tenant
 * Valida tokens e carrega dados do usuário com informações da empresa
 */

/**
 * Middleware principal de autenticação
 * Verifica token JWT e carrega dados do usuário
 */
const authMiddleware = async (req, res, next) => {
  try {
    // Extrair token do header Authorization
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new ApiError(401, 'Token de acesso requerido');
    }

    const token = authHeader.substring(7); // Remove "Bearer "
    
    // Verificar se token não está em blacklist
    const isBlacklisted = await checkTokenBlacklist(token);
    if (isBlacklisted) {
      throw new ApiError(401, 'Token inválido ou expirado');
    }

    // Verificar e decodificar token
    let decoded;
    try {
      decoded = jwt.verify(token, jwtConfig.accessToken.secret, {
        algorithms: [jwtConfig.accessToken.algorithm],
        issuer: jwtConfig.accessToken.issuer,
        audience: jwtConfig.accessToken.audience
      });
    } catch (jwtError) {
      if (jwtError.name === 'TokenExpiredError') {
        throw new ApiError(401, 'Token expirado');
      } else if (jwtError.name === 'JsonWebTokenError') {
        throw new ApiError(401, 'Token inválido');
      } else {
        throw new ApiError(401, 'Falha na verificação do token');
      }
    }

    // Buscar dados completos do usuário
    const userResult = await query(`
      SELECT 
        u.id,
        u.company_id,
        u.name,
        u.email,
        u.role,
        u.permissions,
        u.status,
        u.last_login_at,
        c.name as company_name,
        c.domain as company_domain,
        c.plan as company_plan,
        c.enabled_modules as company_modules,
        c.status as company_status
      FROM users u
      JOIN companies c ON u.company_id = c.id
      WHERE u.id = $1 AND u.status = 'active' AND c.status = 'active'
    `, [decoded.userId]);

    if (userResult.rows.length === 0) {
      throw new ApiError(401, 'Usuário não encontrado ou inativo');
    }

    const user = userResult.rows[0];

    // Verificar se o token ainda é válido na sessão
    const sessionResult = await query(`
      SELECT id, expires_at, last_activity_at
      FROM user_sessions 
      WHERE user_id = $1 AND token_id = $2 AND status = 'active'
    `, [user.id, decoded.jti]);

    if (sessionResult.rows.length === 0) {
      throw new ApiError(401, 'Sessão inválida ou expirada');
    }

    const session = sessionResult.rows[0];

    // Verificar se sessão não expirou
    if (new Date() > new Date(session.expires_at)) {
      // Marcar sessão como expirada
      await query(`
        UPDATE user_sessions 
        SET status = 'expired' 
        WHERE id = $1
      `, [session.id]);
      
      throw new ApiError(401, 'Sessão expirada');
    }

    // Atualizar última atividade se configurado
    if (security.session.extendOnActivity) {
      await query(`
        UPDATE user_sessions 
        SET last_activity_at = NOW(),
            expires_at = NOW() + INTERVAL '${security.session.sessionTimeout} milliseconds'
        WHERE id = $1
      `, [session.id]);
    }

    // Adicionar dados do usuário e empresa ao request
    req.user = {
      id: user.id,
      companyId: user.company_id,
      name: user.name,
      email: user.email,
      role: user.role,
      permissions: user.permissions || [],
      status: user.status,
      lastLoginAt: user.last_login_at,
      company: {
        id: user.company_id,
        name: user.company_name,
        domain: user.company_domain,
        plan: user.company_plan,
        modules: user.company_modules || [],
        status: user.company_status
      },
      session: {
        id: session.id,
        tokenId: decoded.jti,
        lastActivity: session.last_activity_at
      }
    };

    // Log de atividade se habilitado
    if (security.audit.logTokenRefresh || process.env.NODE_ENV === 'development') {
      logger.info('Usuário autenticado:', {
        userId: user.id,
        companyId: user.company_id,
        role: user.role,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        endpoint: `${req.method} ${req.path}`,
        timestamp: new Date().toISOString()
      });
    }

    next();
  } catch (error) {
    // Log de tentativa de acesso negado
    if (security.audit.logPermissionDenied) {
      logger.warn('Tentativa de acesso negado:', {
        error: error.message,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        endpoint: `${req.method} ${req.path}`,
        timestamp: new Date().toISOString()
      });
    }

    // Retornar erro padronizado
    if (error instanceof ApiError) {
      return res.status(error.statusCode).json({
        success: false,
        error: error.message,
        code: 'AUTH_ERROR',
        timestamp: new Date().toISOString()
      });
    }

    return res.status(500).json({
      success: false,
      error: 'Erro interno de autenticação',
      code: 'INTERNAL_AUTH_ERROR',
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Middleware opcional de autenticação
 * Não falha se não houver token, mas carrega dados se houver
 */
const optionalAuthMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // Sem token, continuar sem usuário
    req.user = null;
    return next();
  }

  // Tem token, tentar autenticar
  return authMiddleware(req, res, next);
};

/**
 * Verifica se token está em blacklist
 * @param {string} token - Token JWT
 * @returns {boolean} True se está em blacklist
 */
const checkTokenBlacklist = async (token) => {
  try {
    const result = await query(`
      SELECT id FROM token_blacklist 
      WHERE token_hash = $1 AND expires_at > NOW()
    `, [require('crypto').createHash('sha256').update(token).digest('hex')]);
    
    return result.rows.length > 0;
  } catch (error) {
    logger.error('Erro ao verificar blacklist de token:', error);
    return false; // Em caso de erro, permitir (fail open)
  }
};

/**
 * Adiciona token à blacklist (usado no logout)
 * @param {string} token - Token JWT
 * @param {number} expiresAt - Timestamp de expiração
 */
const blacklistToken = async (token, expiresAt) => {
  try {
    const tokenHash = require('crypto').createHash('sha256').update(token).digest('hex');
    
    await query(`
      INSERT INTO token_blacklist (token_hash, expires_at, created_at)
      VALUES ($1, $2, NOW())
      ON CONFLICT (token_hash) DO NOTHING
    `, [tokenHash, new Date(expiresAt * 1000)]);
    
    logger.info('Token adicionado à blacklist', { tokenHash });
  } catch (error) {
    logger.error('Erro ao adicionar token à blacklist:', error);
    throw error;
  }
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
        error: 'Autenticação requerida',
        code: 'AUTH_REQUIRED',
        timestamp: new Date().toISOString()
      });
    }

    if (!roles.includes(req.user.role)) {
      logger.warn('Acesso negado por role:', {
        userId: req.user.id,
        userRole: req.user.role,
        requiredRoles: roles,
        endpoint: `${req.method} ${req.path}`,
        timestamp: new Date().toISOString()
      });

      return res.status(403).json({
        success: false,
        error: 'Permissão insuficiente',
        code: 'INSUFFICIENT_ROLE',
        timestamp: new Date().toISOString()
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
      error: 'Autenticação requerida',
      code: 'AUTH_REQUIRED',
      timestamp: new Date().toISOString()
    });
  }

  const allowedRoles = ['super_admin', 'company_admin'];
  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      error: 'Acesso restrito a administradores',
      code: 'ADMIN_REQUIRED',
      timestamp: new Date().toISOString()
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
      error: 'Autenticação requerida',
      code: 'AUTH_REQUIRED',
      timestamp: new Date().toISOString()
    });
  }

  if (req.user.role !== 'super_admin') {
    return res.status(403).json({
      success: false,
      error: 'Acesso restrito a super administradores',
      code: 'SUPER_ADMIN_REQUIRED',
      timestamp: new Date().toISOString()
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
  checkTokenBlacklist
};