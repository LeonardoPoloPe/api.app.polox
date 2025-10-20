const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');

// Imports internos
const { requestLogger } = require('../utils/logger');
const { errorHandler, notFoundHandler } = require('../utils/errors');
const { security } = require('../config/auth');

/**
 * Configuração empresarial do Express.js
 * Inclui todos os middleware de segurança e performance necessários
 */

function createApp() {
  const app = express();

  // ==========================================
  // CONFIGURAÇÕES BÁSICAS
  // ==========================================

  // Trust proxy (importante para AWS Lambda, Load Balancers)
  app.set('trust proxy', 1);

  // Desabilitar header X-Powered-By por segurança
  app.disable('x-powered-by');

  // ==========================================
  // MIDDLEWARE DE SEGURANÇA
  // ==========================================

  // Helmet - Headers de segurança
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "https:"],
        scriptSrc: ["'self'"],
        connectSrc: ["'self'"],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"]
        // upgradeInsecureRequests: process.env.NODE_ENV === 'production' // Remover esta linha
      }
    },
    crossOriginEmbedderPolicy: false, // Permite embedding para Swagger UI
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    }
  }));

  // CORS - Configuração detalhada
  const corsOptions = {
    origin: function (origin, callback) {
      // Permitir requests sem origin (mobile apps, postman, etc.)
      if (!origin) return callback(null, true);
      
      const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
        'http://localhost:3000',
        'http://localhost:3001',
        'https://app.polox.com',
        'https://polox.com',
        'https://dev.polox.com',
        'https://staging.polox.com'
      ];

      if (allowedOrigins.includes(origin) || process.env.NODE_ENV === 'development') {
        callback(null, true);
      } else {
        callback(new Error('Não permitido pelo CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Origin',
      'X-Requested-With',
      'Content-Type',
      'Accept',
      'Authorization',
      'X-Bypass-Tenant',
      'X-Target-Company-Id',
      'X-Request-ID'
    ],
    exposedHeaders: ['X-Total-Count', 'X-Page-Count', 'Retry-After'],
    maxAge: 86400 // 24 horas
  };

  app.use(cors(corsOptions));

  // Rate Limiting Avançado
  const createRateLimit = (windowMs, max, message, skipSuccessfulRequests = true) => {
    return rateLimit({
      windowMs,
      max,
      message: {
        success: false,
        error: message,
        code: 'RATE_LIMIT_EXCEEDED',
        timestamp: new Date().toISOString()
      },
      standardHeaders: true,
      legacyHeaders: false,
      skipSuccessfulRequests,
      skip: (req) => {
        // Pular rate limit para super admins se configurado
        return process.env.SKIP_RATE_LIMIT_FOR_SUPER_ADMIN === 'true' && 
               req.user?.role === 'super_admin';
      },
      keyGenerator: (req) => {
        // Rate limit por usuário se autenticado, senão por IP
        return req.user?.id ? `user:${req.user.id}` : `ip:${req.ip}`;
      }
    });
  };

  // Rate limits diferentes para diferentes rotas
  app.use('/api/auth/login', createRateLimit(
    15 * 60 * 1000, // 15 minutos
    5, // 5 tentativas
    'Muitas tentativas de login. Tente novamente em 15 minutos.',
    false // Contar tentativas falhadas
  ));

  app.use('/api/auth/register', createRateLimit(
    60 * 60 * 1000, // 1 hora
    3, // 3 registros
    'Muitos registros. Tente novamente em 1 hora.',
    false
  ));

  app.use('/api/auth/forgot-password', createRateLimit(
    60 * 60 * 1000, // 1 hora
    3, // 3 tentativas
    'Muitas solicitações de recuperação. Tente novamente em 1 hora.',
    false
  ));

  // Rate limit geral para API
  app.use('/api/', createRateLimit(
    15 * 60 * 1000, // 15 minutos
    security.rateLimiting.maxAttempts || 100,
    'Muitas requisições. Tente novamente mais tarde.'
  ));

  // Slow Down - Delay progressivo
  app.use('/api/', slowDown({
    windowMs: 15 * 60 * 1000, // 15 minutos
    delayAfter: 50, // Permitir 50 requests na velocidade total
    delayMs: () => 500, // Função que retorna 500ms de delay por request adicional
    maxDelayMs: 20000, // Máximo de 20 segundos de delay
    skip: (req) => req.user?.role === 'super_admin',
    validate: { delayMs: false } // Desabilitar warning
  }));

  // ==========================================
  // MIDDLEWARE DE PARSING E SANITIZAÇÃO
  // ==========================================

  // Compressão GZIP
  app.use(compression({
    filter: (req, res) => {
      // Não comprimir se o cliente explicitamente não aceitar
      if (req.headers['x-no-compression']) {
        return false;
      }
      return compression.filter(req, res);
    },
    level: 6, // Nível de compressão balanceado
    threshold: 1024 // Só comprimir se > 1KB
  }));

  // Body parsing com limites
  app.use(express.json({
    limit: process.env.JSON_LIMIT || '10mb',
    verify: (req, res, buf) => {
      // Verificar se é JSON válido
      try {
        JSON.parse(buf);
      } catch (e) {
        res.status(400).json({
          success: false,
          error: 'JSON inválido',
          code: 'INVALID_JSON',
          timestamp: new Date().toISOString()
        });
        return;
      }
    }
  }));

  app.use(express.urlencoded({
    extended: true,
    limit: process.env.URL_LIMIT || '10mb',
    parameterLimit: 1000
  }));

  // Sanitização NoSQL Injection
  app.use(mongoSanitize({
    replaceWith: '_'
  }));

  // Sanitização XSS
  app.use(xss());

  // Proteção HTTP Parameter Pollution
  app.use(hpp({
    whitelist: ['sort', 'fields', 'tags', 'categories'] // Permitir arrays para estes campos
  }));

  // ==========================================
  // MIDDLEWARE DE LOGGING E MONITORAMENTO
  // ==========================================

  // Request ID único para rastreamento
  app.use((req, res, next) => {
    const requestId = req.headers['x-request-id'] || 
                     require('crypto').randomUUID();
    req.id = requestId;
    res.setHeader('X-Request-ID', requestId);
    next();
  });

  // Logging de requisições
  app.use(requestLogger);

  // Middleware de timing
  app.use((req, res, next) => {
    req.startTime = Date.now();
    
    // Interceptar response para adicionar timing header
    const originalSend = res.send;
    res.send = function(data) {
      const duration = Date.now() - req.startTime;
      res.setHeader('X-Response-Time', `${duration}ms`);
      return originalSend.call(this, data);
    };
    
    next();
  });

  // ==========================================
  // HEALTH CHECK BÁSICO
  // ==========================================

  app.get('/health', (req, res) => {
    res.status(200).json({
      success: true,
      status: 'healthy',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      version: process.env.npm_package_version || '1.0.0',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      requestId: req.id
    });
  });

  // Endpoint para verificar configurações (apenas desenvolvimento)
  if (process.env.NODE_ENV === 'development') {
    app.get('/debug/config', (req, res) => {
      res.json({
        environment: process.env.NODE_ENV,
        rateLimiting: security.rateLimiting,
        cors: corsOptions,
        nodeVersion: process.version,
        timestamp: new Date().toISOString()
      });
    });
  }

  // ==========================================
  // MIDDLEWARE DE SEGURANÇA ADICIONAL
  // ==========================================

  // Middleware para detectar tentativas de scan/ataques
  app.use((req, res, next) => {
    const suspiciousPatterns = [
      /\.\.\//, // Path traversal
      /\bselect\b.*\bfrom\b/i, // SQL injection básico
      /<script>/i, // XSS básico
      /\bwget\b|\bcurl\b/i, // Command injection
      /\beval\b|\bexec\b/i // Code injection
    ];

    const userAgent = req.get('User-Agent') || '';
    const url = req.originalUrl;
    
    // Pular verificação para rotas de desenvolvimento e health
    const skipPaths = ['/health', '/test', '/debug'];
    const shouldSkip = skipPaths.some(path => url.startsWith(path));
    
    if (shouldSkip) {
      return next();
    }
    
    const isSuspicious = suspiciousPatterns.some(pattern => 
      pattern.test(url) || pattern.test(userAgent)
    );

    if (isSuspicious) {
      // Log tentativa suspeita
      require('../utils/logger').securityLogger('Tentativa de ataque detectada', {
        ip: req.ip,
        userAgent,
        url,
        method: req.method,
        timestamp: new Date().toISOString()
      });

      return res.status(400).json({
        success: false,
        error: 'Requisição inválida',
        code: 'INVALID_REQUEST',
        timestamp: new Date().toISOString()
      });
    }

    next();
  });

  // ==========================================
  // MIDDLEWARE DE VALIDAÇÃO DE EMPRESA
  // ==========================================

  // Middleware para verificar se empresa está ativa (para rotas da API)
  app.use('/api', (req, res, next) => {
    // Pular verificação para rotas de auth e health
    if (req.path.startsWith('/auth') || req.path === '/health') {
      return next();
    }

    // Será aplicado depois que o usuário for autenticado
    next();
  });

  return app;
}

/**
 * Configuração adicional para produção
 * @param {Express} app - Instância do Express
 */
function configureProduction(app) {
  if (process.env.NODE_ENV !== 'production') return;

  // Force HTTPS em produção
  app.use((req, res, next) => {
    if (req.header('x-forwarded-proto') !== 'https') {
      return res.redirect(`https://${req.header('host')}${req.url}`);
    }
    next();
  });

  // Headers adicionais de segurança para produção
  app.use((req, res, next) => {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    next();
  });
}

/**
 * Configuração de middleware de erro global
 * @param {Express} app - Instância do Express
 */
function configureErrorHandling(app) {
  // Handler para 404 (deve vir antes do error handler)
  app.use(notFoundHandler);

  // Error handler global (deve ser o último middleware)
  app.use(errorHandler);
}

module.exports = {
  createApp,
  configureProduction,
  configureErrorHandling
};