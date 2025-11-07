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

/**
 * ==========================================
 * 🛡️ MIDDLEWARE DE SEGURANÇA ENTERPRISE
 * ==========================================
 */

const helmet = require("helmet");
const { logger } = require("../utils/logger");

/**
 * 🔒 Configuração avançada do Helmet
 * Aplica múltiplas camadas de segurança HTTP
 */

// Configuração CSP mais permissiva para desenvolvimento (incluindo Swagger UI)
const developmentCSP = {
  defaultSrc: ["'self'"],
  styleSrc: [
    "'self'",
    "'unsafe-inline'",
    "https://unpkg.com",
    "https://fonts.googleapis.com",
    "https://cdnjs.cloudflare.com",
  ],
  scriptSrc: [
    "'self'",
    "'unsafe-inline'",
    "'unsafe-eval'",
    "https://unpkg.com",
    "https://cdnjs.cloudflare.com",
  ],
  fontSrc: ["'self'", "https://fonts.gstatic.com"],
  imgSrc: ["'self'", "data:", "https:", "blob:"],
  connectSrc: ["'self'"],
  frameSrc: ["'none'"],
  objectSrc: ["'none'"],
  mediaSrc: ["'self'"],
  workerSrc: ["'self'", "blob:"],
  childSrc: ["'self'"],
  formAction: ["'self'"],
};

// Configuração CSP mais restritiva para produção
const productionCSP = {
  defaultSrc: ["'self'"],
  styleSrc: ["'self'", "https://fonts.googleapis.com"],
  scriptSrc: ["'self'"],
  fontSrc: ["'self'", "https://fonts.gstatic.com"],
  imgSrc: ["'self'", "data:", "https:"],
  connectSrc: ["'self'"],
  frameSrc: ["'none'"],
  objectSrc: ["'none'"],
  mediaSrc: ["'self'"],
  workerSrc: ["'none'"],
  childSrc: ["'none'"],
  formAction: ["'self'"],
  upgradeInsecureRequests: [],
};

const isDevelopment = process.env.NODE_ENV !== "production";

const securityHeaders = helmet({
  // Content Security Policy (dinâmica baseada no ambiente)
  contentSecurityPolicy: isDevelopment
    ? false
    : {
        directives: productionCSP,
      },

  // Cross-Origin Embedder Policy
  crossOriginEmbedderPolicy: {
    policy: "require-corp",
  },

  // Cross-Origin Opener Policy
  crossOriginOpenerPolicy: {
    policy: "same-origin",
  },

  // Cross-Origin Resource Policy
  crossOriginResourcePolicy: {
    policy: "cross-origin",
  },

  // DNS Prefetch Control
  dnsPrefetchControl: {
    allow: false,
  },

  // Expect Certificate Transparency
  expectCt: {
    enforce: true,
    maxAge: 86400, // 24 horas
  },

  // Frame Options
  frameguard: {
    action: "deny",
  },

  // Hide Powered By
  hidePoweredBy: true,

  // HTTP Strict Transport Security
  hsts: {
    maxAge: 31536000, // 1 ano
    includeSubDomains: true,
    preload: true,
  },

  // IE No Open
  ieNoOpen: true,

  // No Sniff
  noSniff: true,

  // Origin Agent Cluster
  originAgentCluster: true,

  // Permitted Cross Domain Policies
  permittedCrossDomainPolicies: {
    permittedPolicies: "none",
  },

  // Referrer Policy
  referrerPolicy: {
    policy: ["no-referrer", "same-origin"],
  },

  // X-XSS-Protection
  xssFilter: true,
});

/**
 * 🌐 Middleware CORS customizado
 * Controle fino de Cross-Origin Resource Sharing
 */
const corsHeaders = (req, res, next) => {
  const origin = req.headers.origin;
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .filter(Boolean);

  // Em desenvolvimento, permite localhost
  if (process.env.NODE_ENV === "development") {
    allowedOrigins.push(
      "http://localhost:3000",
      "http://localhost:3000",
      "http://127.0.0.1:3000"
    );
  }

  // Verifica se a origem está permitida
  if (allowedOrigins.includes(origin) || !origin) {
    res.setHeader("Access-Control-Allow-Origin", origin || "*");
  }

  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, PATCH, OPTIONS"
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization, X-Request-ID, X-Forwarded-For"
  );
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Max-Age", "86400"); // 24 horas

  // Handle preflight requests
  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  next();
};

/**
 * 🆔 Middleware para Request ID
 * Adiciona ID único para rastreamento de requests
 */
const requestId = (req, res, next) => {
  const requestId =
    req.headers["x-request-id"] ||
    `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  req.requestId = requestId;
  res.setHeader("X-Request-ID", requestId);

  next();
};

/**
 * 📝 Middleware para logging de segurança
 * Registra tentativas suspeitas e violações de segurança
 */
const securityLogger = (req, res, next) => {
  const suspiciousPatterns = [
    /\.\./, // Path traversal
    /<script/i, // XSS básico
    /javascript:/i, // JavaScript injection
    /vbscript:/i, // VBScript injection
    /onload=/i, // Event handlers
    /onclick=/i, // Event handlers
    /eval\(/i, // eval() function
    /union.*select/i, // SQL injection
    /insert.*into/i, // SQL injection
    /delete.*from/i, // SQL injection
    /drop.*table/i, // SQL injection
  ];

  const userAgent = req.get("User-Agent") || "";
  const url = req.url;
  const body = JSON.stringify(req.body);

  // Detectar padrões suspeitos
  const isSuspicious = suspiciousPatterns.some(
    (pattern) =>
      pattern.test(url) || pattern.test(body) || pattern.test(userAgent)
  );

  if (isSuspicious) {
    logger.warn("Atividade suspeita detectada", {
      ip: req.ip,
      userAgent,
      url,
      method: req.method,
      body: req.body,
      headers: req.headers,
      requestId: req.requestId,
    });
  }

  // Detectar user agents suspeitos
  const suspiciousUserAgents = [
    /sqlmap/i,
    /nikto/i,
    /nessus/i,
    /burpsuite/i,
    /wget/i,
    /curl/i,
  ];

  if (suspiciousUserAgents.some((pattern) => pattern.test(userAgent))) {
    logger.warn("User Agent suspeito detectado", {
      ip: req.ip,
      userAgent,
      url,
      requestId: req.requestId,
    });
  }

  next();
};

/**
 * 🚫 Middleware anti-fingerprinting
 * Remove headers que podem revelar informações do servidor
 */
const antiFingerprinting = (req, res, next) => {
  // Remove headers que podem revelar tecnologia
  res.removeHeader("X-Powered-By");
  res.removeHeader("Server");
  res.removeHeader("X-AspNet-Version");
  res.removeHeader("X-AspNetMvc-Version");

  // Headers customizados para confundir scanners
  res.setHeader("Server", "nginx/1.18.0");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");

  next();
};

/**
 * 🔍 Middleware de detecção de bots
 * Identifica e registra acessos automatizados
 */
const botDetection = (req, res, next) => {
  const userAgent = req.get("User-Agent") || "";

  const botPatterns = [
    /bot/i,
    /crawler/i,
    /spider/i,
    /scraper/i,
    /checker/i,
    /monitoring/i,
    /scanner/i,
    /curl/i,
    /wget/i,
    /python/i,
    /java/i,
    /go-http-client/i,
    /okhttp/i,
    /axios/i,
  ];

  const isBot = botPatterns.some((pattern) => pattern.test(userAgent));

  if (isBot) {
    logger.info("Bot detectado", {
      ip: req.ip,
      userAgent,
      url: req.url,
      method: req.method,
      requestId: req.requestId,
    });

    // Adiciona flag no request para outros middlewares
    req.isBot = true;
  }

  next();
};

/**
 * 📊 Middleware de métricas de segurança
 * Coleta métricas para monitoramento de segurança
 */
const securityMetrics = (req, res, next) => {
  const startTime = Date.now();

  // Override do res.end para coletar métricas
  const originalEnd = res.end;
  res.end = function (...args) {
    const duration = Date.now() - startTime;

    // Log requisições muito lentas (possível DoS)
    if (duration > 5000) {
      logger.warn("Requisição muito lenta detectada", {
        ip: req.ip,
        url: req.url,
        method: req.method,
        duration,
        userAgent: req.get("User-Agent"),
        requestId: req.requestId,
      });
    }

    // Log status codes de erro
    if (res.statusCode >= 400) {
      logger.info("Erro HTTP registrado", {
        ip: req.ip,
        url: req.url,
        method: req.method,
        statusCode: res.statusCode,
        duration,
        userAgent: req.get("User-Agent"),
        requestId: req.requestId,
      });
    }

    originalEnd.apply(this, args);
  };

  next();
};

/**
 * 🛡️ Middleware principal de segurança
 * Combina todos os middlewares de segurança
 */
const applySecurity = [
  securityHeaders,
  corsHeaders,
  requestId,
  securityLogger,
  antiFingerprinting,
  botDetection,
  securityMetrics,
];

module.exports = {
  securityHeaders: applySecurity,
  corsHeaders,
  requestId,
  securityLogger,
  antiFingerprinting,
  botDetection,
  securityMetrics,
};
