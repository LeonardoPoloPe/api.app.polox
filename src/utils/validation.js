const Joi = require("joi");
const { logger } = require("../models");

/**
 * Schemas de validação para usuários
 */
const userValidationSchemas = {
  register: Joi.object({
    name: Joi.string().min(2).max(100).required().messages({
      "string.min": "Nome deve ter pelo menos 2 caracteres",
      "string.max": "Nome deve ter no máximo 100 caracteres",
      "any.required": "Nome é obrigatório",
    }),

    email: Joi.string().email().required().messages({
      "string.email": "Email deve ter um formato válido",
      "any.required": "Email é obrigatório",
    }),

    password: Joi.string()
      .min(8)
      .max(128)
      .pattern(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/
      )
      .required()
      .messages({
        "string.min": "Senha deve ter pelo menos 8 caracteres",
        "string.max": "Senha deve ter no máximo 128 caracteres",
        "string.pattern.base":
          "Senha deve conter pelo menos: 1 letra minúscula, 1 maiúscula, 1 número e 1 caractere especial",
        "any.required": "Senha é obrigatória",
      }),
  }),

  login: Joi.object({
    email: Joi.string().email().required().messages({
      "string.email": "Email deve ter um formato válido",
      "any.required": "Email é obrigatório",
    }),

    password: Joi.string().required().messages({
      "any.required": "Senha é obrigatória",
    }),
  }),

  updateProfile: Joi.object({
    name: Joi.string().min(2).max(100).messages({
      "string.min": "Nome deve ter pelo menos 2 caracteres",
      "string.max": "Nome deve ter no máximo 100 caracteres",
    }),

    email: Joi.string().email().messages({
      "string.email": "Email deve ter um formato válido",
    }),
  })
    .min(1)
    .messages({
      "object.min": "Pelo menos um campo deve ser fornecido para atualização",
    }),

  refresh: Joi.object({
    refresh_token: Joi.string().required().messages({
      "any.required": "Refresh token é obrigatório",
    }),
  }),

  getUserById: Joi.object({
    id: Joi.number().integer().positive().required().messages({
      "number.base": "ID deve ser um número",
      "number.integer": "ID deve ser um número inteiro",
      "number.positive": "ID deve ser um número positivo",
      "any.required": "ID é obrigatório",
    }),
  }),
};

/**
 * Schemas de validação para paginação
 */
const paginationSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1).messages({
    "number.base": "Página deve ser um número",
    "number.integer": "Página deve ser um número inteiro",
    "number.min": "Página deve ser maior que 0",
  }),

  limit: Joi.number().integer().min(1).max(100).default(10).messages({
    "number.base": "Limite deve ser um número",
    "number.integer": "Limite deve ser um número inteiro",
    "number.min": "Limite deve ser maior que 0",
    "number.max": "Limite deve ser menor ou igual a 100",
  }),
});

/**
 * Middleware para validação de request
 * @param {Joi.Schema} schema - Schema Joi para validação
 * @param {string} property - Propriedade do request para validar ('body', 'params', 'query')
 * @returns {Function} Middleware function
 */
const validateRequest = (schema, property = "body") => {
  return (req, res, next) => {
    try {
      const dataToValidate = req[property];

      const { error, value } = schema.validate(dataToValidate, {
        abortEarly: false, // Retorna todos os erros, não apenas o primeiro
        stripUnknown: true, // Remove campos não especificados no schema
        convert: true, // Converte tipos quando possível
      });

      if (error) {
        const validationErrors = error.details.map((detail) => ({
          field: detail.path.join("."),
          message: detail.message,
          value: detail.context?.value,
        }));

        logger.warn("Erro de validação:", {
          property,
          errors: validationErrors,
          originalData: dataToValidate,
        });

        return res.status(400).json({
          error: "Dados inválidos",
          details: validationErrors,
          timestamp: new Date().toISOString(),
        });
      }

      // Substitui os dados originais pelos validados e limpos
      req[property] = value;
      next();
    } catch (validationError) {
      logger.error("Erro interno na validação:", validationError);
      return res.status(500).json({
        error: "Erro interno na validação",
        timestamp: new Date().toISOString(),
      });
    }
  };
};

/**
 * Valida parâmetros de paginação
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @param {Function} next - Next middleware function
 */
const validatePagination = (req, res, next) => {
  const { error, value } = paginationSchema.validate(req.query, {
    stripUnknown: true,
    convert: true,
  });

  if (error) {
    const validationErrors = error.details.map((detail) => ({
      field: detail.path.join("."),
      message: detail.message,
    }));

    return res.status(400).json({
      error: "Parâmetros de paginação inválidos",
      details: validationErrors,
      timestamp: new Date().toISOString(),
    });
  }

  // Adiciona os valores validados ao request
  req.pagination = value;
  next();
};

/**
 * Valida se um email tem formato válido
 * @param {string} email - Email para validar
 * @returns {boolean} True se o email for válido
 */
const isValidEmail = (email) => {
  const emailSchema = Joi.string().email();
  const { error } = emailSchema.validate(email);
  return !error;
};

/**
 * Valida se uma senha atende aos critérios de segurança
 * @param {string} password - Senha para validar
 * @returns {Object} Objeto com isValid e detalhes dos erros
 */
const validatePassword = (password) => {
  const schema = Joi.string()
    .min(8)
    .max(128)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/);

  const { error } = schema.validate(password);

  return {
    isValid: !error,
    errors: error ? error.details.map((detail) => detail.message) : [],
  };
};

/**
 * Sanitiza dados removendo campos sensíveis
 * @param {Object} data - Dados para sanitizar
 * @param {Array} fieldsToRemove - Campos a serem removidos
 * @returns {Object} Dados sanitizados
 */
const sanitizeData = (data, fieldsToRemove = ["password", "password_hash"]) => {
  if (!data || typeof data !== "object") {
    return data;
  }

  const sanitized = { ...data };

  fieldsToRemove.forEach((field) => {
    delete sanitized[field];
  });

  return sanitized;
};

/**
 * Formata dados de usuário removendo informações sensíveis
 * @param {Object} user - Dados do usuário
 * @returns {Object} Usuário formatado
 */
const formatUser = (user) => {
  if (!user) return null;

  return sanitizeData(user, ["password", "password_hash"]);
};

/**
 * Formata resposta de paginação
 * @param {Array} data - Dados da página
 * @param {Object} pagination - Metadados de paginação
 * @returns {Object} Resposta formatada
 */
const formatPaginatedResponse = (data, pagination) => {
  return {
    data,
    pagination: {
      current_page: pagination.page,
      per_page: pagination.limit,
      total_items: pagination.total,
      total_pages: pagination.totalPages,
      has_next: pagination.hasNext,
      has_previous: pagination.hasPrev,
    },
    timestamp: new Date().toISOString(),
  };
};

module.exports = {
  userValidationSchemas,
  paginationSchema,
  validateRequest,
  validatePagination,
  isValidEmail,
  validatePassword,
  sanitizeData,
  formatUser,
  formatPaginatedResponse,
};
