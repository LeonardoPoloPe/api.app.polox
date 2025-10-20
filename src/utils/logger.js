const winston = require('winston');
const path = require('path');

/**
 * Sistema de logs estruturado para aplicação enterprise
 * Configuração flexível baseada no ambiente
 */

// Configurações de formato baseado no ambiente
const isDevelopment = process.env.NODE_ENV === 'development';
const isProduction = process.env.NODE_ENV === 'production';

// Formato customizado para logs estruturados
const customFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, stack, ...metadata }) => {
    let log = {
      timestamp,
      level: level.toUpperCase(),
      message,
      ...metadata
    };

    if (stack) {
      log.stack = stack;
    }

    return JSON.stringify(log, null, isDevelopment ? 2 : 0);
  })
);

// Formato simples para console em desenvolvimento
const consoleFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'HH:mm:ss'
  }),
  winston.format.colorize(),
  winston.format.printf(({ timestamp, level, message, ...metadata }) => {
    let log = `${timestamp} [${level}] ${message}`;
    
    if (Object.keys(metadata).length > 0) {
      log += ` ${JSON.stringify(metadata, null, 2)}`;
    }
    
    return log;
  })
);

// Configurar transports baseado no ambiente
const transports = [];

// Console transport (sempre presente)
transports.push(
  new winston.transports.Console({
    level: process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info'),
    format: isDevelopment ? consoleFormat : customFormat,
    handleExceptions: true,
    handleRejections: true
  })
);

// File transports para produção
if (isProduction) {
  // Log de erro separado
  transports.push(
    new winston.transports.File({
      filename: path.join(process.cwd(), 'logs', 'error.log'),
      level: 'error',
      format: customFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 5,
      handleExceptions: true,
      handleRejections: true
    })
  );

  // Log combinado
  transports.push(
    new winston.transports.File({
      filename: path.join(process.cwd(), 'logs', 'combined.log'),
      level: 'info',
      format: customFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 5
    })
  );

  // Log de auditoria separado
  transports.push(
    new winston.transports.File({
      filename: path.join(process.cwd(), 'logs', 'audit.log'),
      level: 'info',
      format: customFormat,
      maxsize: 10485760, // 10MB
      maxFiles: 10
    })
  );
}

// Criar logger principal
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info'),
  format: customFormat,
  defaultMeta: {
    service: 'polox-api',
    environment: process.env.NODE_ENV || 'development',
    version: process.env.npm_package_version || '1.0.0'
  },
  transports,
  exitOnError: false
});

// Logger específico para auditoria
const auditLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json(),
    winston.format.printf(({ timestamp, level, message, ...metadata }) => {
      return JSON.stringify({
        timestamp,
        type: 'AUDIT',
        level: level.toUpperCase(),
        message,
        ...metadata
      }, null, 0);
    })
  ),
  defaultMeta: {
    service: 'polox-audit',
    environment: process.env.NODE_ENV || 'development'
  },
  transports: [
    new winston.transports.Console({
      format: customFormat
    }),
    ...(isProduction ? [
      new winston.transports.File({
        filename: path.join(process.cwd(), 'logs', 'audit.log'),
        maxsize: 10485760, // 10MB
        maxFiles: 10
      })
    ] : [])
  ]
});

// Logger específico para performance
const performanceLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: {
    service: 'polox-performance',
    environment: process.env.NODE_ENV || 'development'
  },
  transports: [
    ...(isProduction ? [
      new winston.transports.File({
        filename: path.join(process.cwd(), 'logs', 'performance.log'),
        maxsize: 5242880, // 5MB
        maxFiles: 3
      })
    ] : [])
  ]
});

// Logger específico para segurança
const securityLogger = winston.createLogger({
  level: 'warn',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json(),
    winston.format.printf(({ timestamp, level, message, ...metadata }) => {
      return JSON.stringify({
        timestamp,
        type: 'SECURITY',
        level: level.toUpperCase(),
        message,
        ...metadata
      }, null, 0);
    })
  ),
  defaultMeta: {
    service: 'polox-security',
    environment: process.env.NODE_ENV || 'development'
  },
  transports: [
    new winston.transports.Console({
      format: customFormat
    }),
    ...(isProduction ? [
      new winston.transports.File({
        filename: path.join(process.cwd(), 'logs', 'security.log'),
        maxsize: 10485760, // 10MB
        maxFiles: 10
      })
    ] : [])
  ]
});

// Funções helper para diferentes tipos de log
const loggers = {
  /**
   * Log geral da aplicação
   */
  app: logger,

  /**
   * Log de auditoria para ações importantes
   * @param {string} action - Ação realizada
   * @param {Object} details - Detalhes da ação
   */
  audit: (action, details = {}) => {
    auditLogger.info(action, {
      action,
      ...details,
      timestamp: new Date().toISOString()
    });
  },

  /**
   * Log de performance para requisições lentas
   * @param {string} operation - Operação realizada
   * @param {number} duration - Duração em ms
   * @param {Object} details - Detalhes adicionais
   */
  performance: (operation, duration, details = {}) => {
    if (duration > (process.env.SLOW_QUERY_THRESHOLD || 1000)) {
      performanceLogger.warn('Slow operation detected', {
        operation,
        duration: `${duration}ms`,
        threshold: `${process.env.SLOW_QUERY_THRESHOLD || 1000}ms`,
        ...details
      });
    } else {
      performanceLogger.info(operation, {
        operation,
        duration: `${duration}ms`,
        ...details
      });
    }
  },

  /**
   * Log de segurança para eventos suspeitos
   * @param {string} event - Evento de segurança
   * @param {Object} details - Detalhes do evento
   */
  security: (event, details = {}) => {
    securityLogger.warn(event, {
      securityEvent: event,
      ...details,
      timestamp: new Date().toISOString()
    });
  },

  /**
   * Log de erro com contexto completo
   * @param {Error} error - Erro ocorrido
   * @param {Object} context - Contexto do erro
   */
  error: (error, context = {}) => {
    logger.error(error.message, {
      error: {
        message: error.message,
        name: error.name,
        stack: error.stack,
        code: error.code
      },
      ...context,
      timestamp: new Date().toISOString()
    });
  },

  /**
   * Log de database com contexto de query
   * @param {string} query - Query executada
   * @param {number} duration - Duração da query
   * @param {Object} context - Contexto adicional
   */
  database: (query, duration, context = {}) => {
    const sanitizedQuery = query.toLowerCase().includes('password') 
      ? '[QUERY WITH SENSITIVE DATA]' 
      : query.substring(0, 200);

    logger.debug('Database query', {
      query: sanitizedQuery,
      duration: `${duration}ms`,
      ...context
    });

    // Log performance se query for lenta
    if (duration > (process.env.SLOW_DB_QUERY_THRESHOLD || 500)) {
      performanceLogger.warn('Slow database query', {
        query: sanitizedQuery,
        duration: `${duration}ms`,
        threshold: `${process.env.SLOW_DB_QUERY_THRESHOLD || 500}ms`,
        ...context
      });
    }
  },

  /**
   * Log de requisição HTTP
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   * @param {number} duration - Duração da requisição
   */
  request: (req, res, duration) => {
    const logData = {
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      userId: req.user?.id,
      companyId: req.user?.companyId,
      timestamp: new Date().toISOString()
    };

    if (res.statusCode >= 400) {
      logger.warn('HTTP request failed', logData);
    } else {
      logger.info('HTTP request', logData);
    }

    // Log performance para requisições lentas
    if (duration > (process.env.SLOW_REQUEST_THRESHOLD || 2000)) {
      performanceLogger.warn('Slow HTTP request', {
        ...logData,
        threshold: `${process.env.SLOW_REQUEST_THRESHOLD || 2000}ms`
      });
    }
  }
};

// Criar diretório de logs se não existir (apenas em produção)
if (isProduction) {
  const fs = require('fs');
  const logsDir = path.join(process.cwd(), 'logs');
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
}

// Middleware de logging de requisições
const requestLogger = (req, res, next) => {
  const start = Date.now();

  // Interceptar o fim da resposta
  res.on('finish', () => {
    const duration = Date.now() - start;
    loggers.request(req, res, duration);
  });

  next();
};

// Handle de exceções não capturadas
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', {
    error: {
      message: error.message,
      name: error.name,
      stack: error.stack
    },
    timestamp: new Date().toISOString()
  });
  
  // Dar tempo para o log ser escrito antes de sair
  setTimeout(() => {
    process.exit(1);
  }, 1000);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection:', {
    reason: reason,
    promise: promise,
    timestamp: new Date().toISOString()
  });
});

module.exports = {
  logger: loggers.app,
  auditLogger: loggers.audit,
  performanceLogger: loggers.performance,
  securityLogger: loggers.security,
  errorLogger: loggers.error,
  databaseLogger: loggers.database,
  requestLogger,
  loggers
};