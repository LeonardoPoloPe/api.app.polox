/**
 * ==========================================
 * 🛡️ MIDDLEWARE DE RATE LIMITING ENTERPRISE
 * ==========================================
 */

const rateLimit = require('express-rate-limit');
const { logger } = require('../utils/logger');

/**
 * 🔒 Rate limiter para autenticação
 * Previne ataques de força bruta em login
 */
const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: (req) => {
    // Limite baseado no IP
    return 5; // 5 tentativas por 15 minutos
  },
  message: {
    success: false,
    error: 'Muitas tentativas de login',
    message: 'Aguarde 15 minutos antes de tentar novamente',
    retryAfter: 900 // 15 minutos em segundos
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Rate limit por IP + email (se fornecido)
    const email = req.body?.email || '';
    return `auth:${req.ip}:${email.toLowerCase()}`;
  },
  handler: (req, res) => {
    logger.warn('Rate limit excedido para autenticação', {
      ip: req.ip,
      email: req.body?.email,
      userAgent: req.get('User-Agent'),
      endpoint: req.path
    });

    res.status(429).json({
      success: false,
      error: 'Muitas tentativas de login',
      message: 'Aguarde 15 minutos antes de tentar novamente',
      retryAfter: 900,
      timestamp: new Date().toISOString()
    });
  },
  skip: (req) => {
    // Skip rate limiting em desenvolvimento se configurado
    return process.env.SKIP_RATE_LIMIT === 'true' && process.env.NODE_ENV === 'development';
  }
});

/**
 * 🔄 Rate limiter para renovação de tokens
 * Previne abuso na renovação de tokens
 */
const tokenRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutos
  max: 10, // 10 tentativas por 5 minutos
  message: {
    success: false,
    error: 'Muitas tentativas de renovação de token',
    message: 'Aguarde 5 minutos antes de tentar novamente',
    retryAfter: 300
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `token:${req.ip}`,
  handler: (req, res) => {
    logger.warn('Rate limit excedido para tokens', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      endpoint: req.path
    });

    res.status(429).json({
      success: false,
      error: 'Muitas tentativas de renovação de token',
      message: 'Aguarde 5 minutos antes de tentar novamente',
      retryAfter: 300,
      timestamp: new Date().toISOString()
    });
  },
  skip: (req) => {
    return process.env.SKIP_RATE_LIMIT === 'true' && process.env.NODE_ENV === 'development';
  }
});

/**
 * 🔑 Rate limiter para recuperação de senha
 * Previne spam de emails de recuperação
 */
const passwordRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 3, // 3 tentativas por hora
  message: {
    success: false,
    error: 'Muitas tentativas de recuperação de senha',
    message: 'Aguarde 1 hora antes de solicitar nova recuperação',
    retryAfter: 3600
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const email = req.body?.email || '';
    return `password:${req.ip}:${email.toLowerCase()}`;
  },
  handler: (req, res) => {
    logger.warn('Rate limit excedido para recuperação de senha', {
      ip: req.ip,
      email: req.body?.email,
      userAgent: req.get('User-Agent'),
      endpoint: req.path
    });

    res.status(429).json({
      success: false,
      error: 'Muitas tentativas de recuperação de senha',
      message: 'Aguarde 1 hora antes de solicitar nova recuperação',
      retryAfter: 3600,
      timestamp: new Date().toISOString()
    });
  },
  skip: (req) => {
    return process.env.SKIP_RATE_LIMIT === 'true' && process.env.NODE_ENV === 'development';
  }
});

/**
 * 🌐 Rate limiter geral para API
 * Limite geral para todas as rotas da API
 */
const generalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: (req) => {
    // Limite baseado no tipo de usuário se autenticado
    if (req.user) {
      // Usuários autenticados têm limite maior
      switch (req.user.role) {
        case 'super_admin':
          return 1000;
        case 'admin':
          return 500;
        case 'editor':
          return 300;
        default:
          return 200;
      }
    }
    // Usuários não autenticados
    return 100;
  },
  message: {
    success: false,
    error: 'Limite de requisições excedido',
    message: 'Aguarde antes de fazer mais requisições',
    retryAfter: 900
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    if (req.user) {
      return `api:user:${req.user.id}`;
    }
    return `api:ip:${req.ip}`;
  },
  handler: (req, res) => {
    logger.warn('Rate limit geral excedido', {
      ip: req.ip,
      userId: req.user?.id,
      userAgent: req.get('User-Agent'),
      endpoint: req.path,
      method: req.method
    });

    res.status(429).json({
      success: false,
      error: 'Limite de requisições excedido',
      message: 'Aguarde antes de fazer mais requisições',
      retryAfter: 900,
      timestamp: new Date().toISOString()
    });
  },
  skip: (req) => {
    return process.env.SKIP_RATE_LIMIT === 'true' && process.env.NODE_ENV === 'development';
  }
});

/**
 * 📊 Rate limiter para operações administrativas
 * Limite mais restritivo para operações sensíveis
 */
const adminRateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutos
  max: 50, // 50 operações por 10 minutos
  message: {
    success: false,
    error: 'Limite de operações administrativas excedido',
    message: 'Aguarde antes de realizar mais operações administrativas',
    retryAfter: 600
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `admin:${req.user?.id || req.ip}`,
  handler: (req, res) => {
    logger.warn('Rate limit administrativo excedido', {
      ip: req.ip,
      userId: req.user?.id,
      userAgent: req.get('User-Agent'),
      endpoint: req.path,
      method: req.method
    });

    res.status(429).json({
      success: false,
      error: 'Limite de operações administrativas excedido',
      message: 'Aguarde antes de realizar mais operações administrativas',
      retryAfter: 600,
      timestamp: new Date().toISOString()
    });
  },
  skip: (req) => {
    return process.env.SKIP_RATE_LIMIT === 'true' && process.env.NODE_ENV === 'development';
  }
});

/**
 * 🔄 Middleware para reset de rate limit
 * Permite que admins resetem rate limits em emergências
 */
const resetRateLimit = (req, res, next) => {
  // Apenas super admins podem resetar rate limits
  if (req.user?.role === 'super_admin' && req.headers['x-reset-rate-limit'] === 'true') {
    logger.info('Rate limit resetado por super admin', {
      adminId: req.user.id,
      ip: req.ip,
      target: req.headers['x-reset-target']
    });
    
    // Skip todos os rate limiters
    req.skipRateLimit = true;
  }
  next();
};

/**
 * 📈 Middleware para logging de rate limit
 */
const logRateLimit = (req, res, next) => {
  const originalSend = res.send;
  
  res.send = function(data) {
    // Log quando rate limit é aplicado mas não excedido
    const remaining = res.get('X-RateLimit-Remaining');
    const limit = res.get('X-RateLimit-Limit');
    
    if (remaining !== undefined && parseInt(remaining) < parseInt(limit) * 0.1) {
      logger.info('Rate limit próximo do limite', {
        ip: req.ip,
        userId: req.user?.id,
        endpoint: req.path,
        remaining: parseInt(remaining),
        limit: parseInt(limit),
        percentage: (parseInt(remaining) / parseInt(limit)) * 100
      });
    }
    
    originalSend.call(this, data);
  };
  
  next();
};

module.exports = {
  rateLimiter: {
    auth: authRateLimiter,
    token: tokenRateLimiter,
    password: passwordRateLimiter,
    general: generalRateLimiter,
    admin: adminRateLimiter
  },
  resetRateLimit,
  logRateLimit
};