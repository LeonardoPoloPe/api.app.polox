const { t, getCurrentLanguage } = require("../config/i18n");

/**
 * Middleware para padronizar respostas da API com suporte a i18n
 */

/**
 * Cria resposta de sucesso padronizada
 * @param {Object} res - Objeto de resposta Express
 * @param {*} data - Dados para retornar
 * @param {string} messageKey - Chave da mensagem de sucesso
 * @param {number} statusCode - Código de status HTTP
 * @param {Object} meta - Metadados adicionais
 */
const sendSuccessResponse = (
  res,
  data = null,
  messageKey = "messages.success",
  statusCode = 200,
  meta = {}
) => {
  const language = getCurrentLanguage(res.req);

  const response = {
    success: true,
    message: t(res.req, messageKey),
    data,
    meta: {
      timestamp: new Date().toISOString(),
      language,
      ...meta,
    },
  };

  res.status(statusCode).json(response);
};

/**
 * Cria resposta de erro padronizada
 * @param {Object} res - Objeto de resposta Express
 * @param {string} messageKey - Chave da mensagem de erro
 * @param {number} statusCode - Código de status HTTP
 * @param {*} details - Detalhes do erro
 * @param {string} errorCode - Código interno do erro
 */
const sendErrorResponse = (
  res,
  messageKey = "errors.internal_server_error",
  statusCode = 500,
  details = null,
  errorCode = null
) => {
  const language = getCurrentLanguage(res.req);

  const response = {
    success: false,
    message: t(res.req, messageKey),
    error: {
      code: errorCode,
      details,
      timestamp: new Date().toISOString(),
      language,
    },
  };

  // Em desenvolvimento, incluir stack trace se disponível
  if (process.env.NODE_ENV === "development" && details && details.stack) {
    response.error.stackTrace = details.stack;
  }

  res.status(statusCode).json(response);
};

/**
 * Cria resposta de validação com erros específicos
 * @param {Object} res - Objeto de resposta Express
 * @param {Array|Object} validationErrors - Erros de validação
 * @param {string} messageKey - Chave da mensagem principal
 */
const sendValidationErrorResponse = (
  res,
  validationErrors,
  messageKey = "errors.validation_error"
) => {
  const language = getCurrentLanguage(res.req);

  const response = {
    success: false,
    message: t(res.req, messageKey),
    errors: validationErrors,
    meta: {
      timestamp: new Date().toISOString(),
      language,
    },
  };

  res.status(400).json(response);
};

/**
 * Cria resposta paginada
 * @param {Object} res - Objeto de resposta Express
 * @param {Array} data - Dados paginados
 * @param {Object} pagination - Informações de paginação
 * @param {string} messageKey - Chave da mensagem
 */
const sendPaginatedResponse = (
  res,
  data,
  pagination,
  messageKey = "messages.success"
) => {
  const language = getCurrentLanguage(res.req);

  const response = {
    success: true,
    message: t(res.req, messageKey),
    data,
    pagination: {
      currentPage: pagination.page || 1,
      totalPages: pagination.totalPages || 1,
      totalItems: pagination.totalItems || data.length,
      itemsPerPage: pagination.limit || data.length,
      hasNextPage: pagination.hasNextPage || false,
      hasPreviousPage: pagination.hasPreviousPage || false,
    },
    meta: {
      timestamp: new Date().toISOString(),
      language,
    },
  };

  res.status(200).json(response);
};

/**
 * Middleware para capturar erros não tratados e formatar resposta
 */
const errorHandler = (error, req, res, next) => {
  console.error("Erro não tratado:", error);

  const language = getCurrentLanguage(req);

  // Determinar tipo de erro e resposta apropriada
  let statusCode = 500;
  let messageKey = "errors.internal_server_error";
  let errorCode = "INTERNAL_ERROR";

  // Priorizar statusCode se existir (para ApiError e similares)
  if (error.statusCode) {
    statusCode = error.statusCode;
    errorCode = error.code || "ERROR";

    // Mapear statusCode para messageKey padrão
    if (statusCode === 400) {
      messageKey = "errors.validation_error";
    } else if (statusCode === 401) {
      messageKey = "errors.unauthorized";
    } else if (statusCode === 403) {
      messageKey = "errors.forbidden";
    } else if (statusCode === 404) {
      messageKey = "errors.not_found";
    } else if (statusCode >= 500) {
      messageKey = "errors.internal_server_error";
    }
  } else if (error.name === "ValidationError") {
    statusCode = 400;
    messageKey = "errors.validation_error";
    errorCode = "VALIDATION_ERROR";
  } else if (error.name === "UnauthorizedError") {
    statusCode = 401;
    messageKey = "errors.unauthorized";
    errorCode = "UNAUTHORIZED";
  } else if (error.name === "ForbiddenError") {
    statusCode = 403;
    messageKey = "errors.forbidden";
    errorCode = "FORBIDDEN";
  } else if (error.name === "NotFoundError") {
    statusCode = 404;
    messageKey = "errors.not_found";
    errorCode = "NOT_FOUND";
  } else if (error.code === "ECONNREFUSED" || error.code === "ENOTFOUND") {
    statusCode = 503;
    messageKey = "errors.connection_error";
    errorCode = "CONNECTION_ERROR";
  }

  const response = {
    success: false,
    message: t(req, messageKey),
    error: {
      code: errorCode,
      message: error.message,
      timestamp: new Date().toISOString(),
      language,
    },
  };

  // Em desenvolvimento, incluir mais detalhes
  if (process.env.NODE_ENV === "development") {
    response.error.details = {
      name: error.name,
      stack: error.stack,
      originalError: error,
    };
  }

  res.status(statusCode).json(response);
};

/**
 * Middleware para capturar 404 (rota não encontrada)
 */
const notFoundHandler = (req, res) => {
  sendErrorResponse(
    res,
    "errors.not_found",
    404,
    {
      path: req.originalUrl,
      method: req.method,
    },
    "ROUTE_NOT_FOUND"
  );
};

/**
 * Middleware para adicionar métodos de resposta ao objeto res
 */
const responseHelpers = (req, res, next) => {
  // Adicionar métodos helper ao objeto res
  res.sendSuccess = (data, messageKey, statusCode, meta) => {
    return sendSuccessResponse(res, data, messageKey, statusCode, meta);
  };

  res.sendError = (messageKey, statusCode, details, errorCode) => {
    return sendErrorResponse(res, messageKey, statusCode, details, errorCode);
  };

  res.sendValidationError = (validationErrors, messageKey) => {
    return sendValidationErrorResponse(res, validationErrors, messageKey);
  };

  res.sendPaginated = (data, pagination, messageKey) => {
    return sendPaginatedResponse(res, data, pagination, messageKey);
  };

  next();
};

/**
 * Resposta para health check com informações de idioma
 */
const healthCheckResponse = (req, res) => {
  const language = getCurrentLanguage(req);

  const response = {
    success: true,
    message: t(req, "api.status"),
    data: {
      status: t(req, "api.healthy"),
      version: process.env.API_VERSION || "1.0.0",
      environment: process.env.NODE_ENV || "development",
      timestamp: new Date().toISOString(),
      database: t(req, "api.database_connected"),
      language: {
        current: language,
        supported: ["pt", "en", "es"],
      },
    },
  };

  res.status(200).json(response);
};

module.exports = {
  sendSuccessResponse,
  sendErrorResponse,
  sendValidationErrorResponse,
  sendPaginatedResponse,
  errorHandler,
  notFoundHandler,
  responseHelpers,
  healthCheckResponse,
};
