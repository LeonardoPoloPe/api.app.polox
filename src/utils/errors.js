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

const { logger } = require("./logger");

/**
 * Classes e funções para tratamento estruturado de erros
 * Sistema enterprise com diferentes tipos de erro e logging automático
 */

/**
 * Classe base para erros da API
 * Permite erros estruturados com códigos e contextos
 */
class ApiError extends Error {
  constructor(
    statusCode,
    message,
    code = null,
    details = null,
    isOperational = true
  ) {
    super(message);

    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code || this.getDefaultCode(statusCode);
    this.details = details;
    this.isOperational = isOperational;
    this.timestamp = new Date().toISOString();

    // Capturar stack trace
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Gera código padrão baseado no status code
   * @param {number} statusCode - HTTP status code
   * @returns {string} Código do erro
   */
  getDefaultCode(statusCode) {
    const codes = {
      400: "BAD_REQUEST",
      401: "UNAUTHORIZED",
      403: "FORBIDDEN",
      404: "NOT_FOUND",
      409: "CONFLICT",
      422: "VALIDATION_ERROR",
      429: "RATE_LIMIT_EXCEEDED",
      500: "INTERNAL_ERROR",
      502: "BAD_GATEWAY",
      503: "SERVICE_UNAVAILABLE",
    };

    return codes[statusCode] || "UNKNOWN_ERROR";
  }

  /**
   * Serializa o erro para resposta JSON
   * @returns {Object} Objeto serializado
   */
  toJSON() {
    return {
      success: false,
      // Para compatibilidade com testes e clientes, expomos tanto 'message' quanto 'error'
      message: this.message,
      error: this.message,
      code: this.code,
      statusCode: this.statusCode,
      details: this.details,
      timestamp: this.timestamp,
    };
  }
}

/**
 * Erro de validação (422)
 */
class ValidationError extends ApiError {
  constructor(message, details = null) {
    super(422, message, "VALIDATION_ERROR", details);
  }
}

/**
 * Erro de autenticação (401)
 */
class AuthenticationError extends ApiError {
  constructor(message = "Não autorizado", details = null) {
    super(401, message, "AUTHENTICATION_ERROR", details);
  }
}

/**
 * Erro de autorização (403)
 */
class AuthorizationError extends ApiError {
  constructor(message = "Acesso negado", details = null) {
    super(403, message, "AUTHORIZATION_ERROR", details);
  }
}

/**
 * Erro de recurso não encontrado (404)
 */
class NotFoundError extends ApiError {
  constructor(resource = "Recurso", details = null) {
    super(404, `${resource} não encontrado`, "NOT_FOUND", details);
  }
}

/**
 * Erro de conflito (409)
 */
class ConflictError extends ApiError {
  constructor(message, details = null) {
    super(409, message, "CONFLICT", details);
  }
}

/**
 * Erro de banco de dados
 */
class DatabaseError extends ApiError {
  constructor(message, originalError = null) {
    super(500, "Erro interno do banco de dados", "DATABASE_ERROR", {
      originalMessage: message,
      originalError: originalError?.message,
    });
  }
}

/**
 * Erro de rate limiting (429)
 */
class RateLimitError extends ApiError {
  constructor(
    message = "Muitas requisições. Tente novamente mais tarde.",
    retryAfter = null
  ) {
    super(429, message, "RATE_LIMIT_EXCEEDED", { retryAfter });
  }
}

/**
 * Erro de limite de plano (402)
 */
class PlanLimitError extends ApiError {
  constructor(limitType, current, max, plan) {
    const message = `Limite do plano ${plan} excedido para ${limitType}`;
    super(402, message, "PLAN_LIMIT_EXCEEDED", {
      limitType,
      current,
      max,
      plan,
    });
  }
}

/**
 * Middleware global de tratamento de erros
 * Processa todos os erros da aplicação de forma consistente
 */
const errorHandler = (err, req, res, next) => {
  let error = err;

  // Se não é um ApiError, converter para um
  if (!(error instanceof ApiError)) {
    // Erros de validação do Joi
    if (error.name === "ValidationError" && error.details) {
      const details = error.details.map((detail) => ({
        field: detail.path.join("."),
        message: detail.message,
        value: detail.context?.value,
      }));

      error = new ValidationError("Dados inválidos", details);
    }
    // Erros do PostgreSQL
    else if (error.code && error.code.startsWith("23")) {
      if (error.code === "23505") {
        // Unique violation
        error = new ConflictError("Recurso já existe", {
          constraint: error.constraint,
          detail: error.detail,
        });
      } else if (error.code === "23503") {
        // Foreign key violation
        error = new ValidationError("Referência inválida", {
          constraint: error.constraint,
          detail: error.detail,
        });
      } else {
        error = new DatabaseError(error.message, error);
      }
    }
    // Erros do JWT
    else if (error.name === "JsonWebTokenError") {
      error = new AuthenticationError("Token inválido");
    } else if (error.name === "TokenExpiredError") {
      error = new AuthenticationError("Token expirado");
    }
    // Erro genérico
    else {
      error = new ApiError(
        error.statusCode || 500,
        error.message || "Erro interno do servidor",
        error.code || "INTERNAL_ERROR",
        process.env.NODE_ENV === "development"
          ? {
              stack: error.stack,
              name: error.name,
            }
          : null
      );
    }
  }

  // Log do erro
  const logContext = {
    errorCode: error.code,
    statusCode: error.statusCode,
    method: req.method,
    url: req.originalUrl,
    userId: req.user?.id,
    companyId: req.user?.companyId,
    ip: req.ip,
    userAgent: req.get("User-Agent"),
    body: req.method !== "GET" ? sanitizeBody(req.body) : undefined,
    query: req.query,
    params: req.params,
  };

  if (error.statusCode >= 500) {
    logger.error(`Server Error: ${error.message}`, {
      ...logContext,
      stack: error.stack,
      details: error.details,
    });
  } else if (error.statusCode >= 400) {
    logger.warn(`Client Error: ${error.message}`, {
      ...logContext,
      details: error.details,
    });
  }

  // Preparar resposta
  const response = error.toJSON();

  // Remover stack trace em produção
  if (process.env.NODE_ENV === "production" && response.details?.stack) {
    delete response.details.stack;
  }

  // Adicionar headers específicos
  if (error instanceof RateLimitError && error.details?.retryAfter) {
    res.set("Retry-After", error.details.retryAfter);
  }

  res.status(error.statusCode).json(response);
};

/**
 * Middleware para capturar erros assíncronos
 * Wrapper para funções async que garante que erros sejam capturados
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Sanitiza dados sensíveis do body para logs
 * @param {Object} body - Body da requisição
 * @returns {Object} Body sanitizado
 */
const sanitizeBody = (body) => {
  if (!body || typeof body !== "object") return body;

  const sanitized = { ...body };
  const sensitiveFields = [
    "password",
    "token",
    "secret",
    "key",
    "authorization",
    "passwd",
    "pwd",
    "pin",
    "ssn",
    "credit_card",
    "cvv",
  ];

  const sanitizeObject = (obj) => {
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const lowerKey = key.toLowerCase();

        if (sensitiveFields.some((field) => lowerKey.includes(field))) {
          obj[key] = "[REDACTED]";
        } else if (typeof obj[key] === "object" && obj[key] !== null) {
          sanitizeObject(obj[key]);
        }
      }
    }
  };

  sanitizeObject(sanitized);
  return sanitized;
};

/**
 * Middleware para validar IDs numéricos
 * @param {string} paramName - Nome do parâmetro a validar
 */
const validateNumericId = (paramName = "id") => {
  return (req, res, next) => {
    const id = req.params[paramName];

    if (!id) {
      return next(new ValidationError(`Parâmetro ${paramName} é obrigatório`));
    }

    const numericId = parseInt(id);
    if (isNaN(numericId) || numericId <= 0) {
      return next(
        new ValidationError(`Parâmetro ${paramName} deve ser um número válido`)
      );
    }

    req.params[paramName] = numericId;
    next();
  };
};

/**
 * Middleware para tratar 404 (rota não encontrada)
 */
const notFoundHandler = (req, res, next) => {
  const error = new NotFoundError("Endpoint", {
    method: req.method,
    url: req.originalUrl,
    availableEndpoints:
      process.env.NODE_ENV === "development"
        ? "Consulte a documentação da API"
        : undefined,
  });

  next(error);
};

/**
 * Helper para criar respostas de erro consistentes
 * @param {Response} res - Response object
 * @param {number} statusCode - HTTP status code
 * @param {string} message - Mensagem do erro
 * @param {string} code - Código do erro
 * @param {Object} details - Detalhes adicionais
 */
const sendError = (res, statusCode, message, code = null, details = null) => {
  const error = new ApiError(statusCode, message, code, details);
  res.status(statusCode).json(error.toJSON());
};

module.exports = {
  // Classes de erro
  ApiError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  DatabaseError,
  RateLimitError,
  PlanLimitError,

  // Middleware e handlers
  errorHandler,
  asyncHandler,
  notFoundHandler,
  validateNumericId,

  // Utilities
  sendError,
  sanitizeBody,
};
