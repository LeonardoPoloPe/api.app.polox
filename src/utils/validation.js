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
 * 🛡️ VALIDAÇÕES ENTERPRISE
 * ==========================================
 */

const Joi = require("joi");
const { logger } = require("../utils/logger");

/**
 * 🔐 Schemas de validação para autenticação enterprise
 */
const authValidationSchemas = {
  register: Joi.object({
    name: Joi.string().min(2).max(100).trim().required().messages({
      "string.min": "Nome deve ter pelo menos 2 caracteres",
      "string.max": "Nome deve ter no máximo 100 caracteres",
      "any.required": "Nome é obrigatório",
    }),

    email: Joi.string().email().lowercase().required().messages({
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

    companyId: Joi.string().uuid().required().messages({
      "string.uuid": "ID da empresa deve ser um UUID válido",
      "any.required": "ID da empresa é obrigatório",
    }),

    role: Joi.string().valid('viewer', 'editor', 'admin', 'super_admin').default('viewer').messages({
      "any.only": "Role deve ser: viewer, editor, admin ou super_admin",
    }),

    department: Joi.string().max(100).trim().allow(null, '').messages({
      "string.max": "Departamento deve ter no máximo 100 caracteres",
    }),

    position: Joi.string().max(100).trim().allow(null, '').messages({
      "string.max": "Posição deve ter no máximo 100 caracteres",
    }),

    phone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).allow(null, '').messages({
      "string.pattern.base": "Telefone deve estar no formato internacional (+5511999999999)",
    }),

    permissions: Joi.array().items(Joi.string()).default([]).messages({
      "array.base": "Permissões devem ser um array de strings",
    }),
  }),

  login: Joi.object({
    email: Joi.string().email().lowercase().required().messages({
      "string.email": "Email deve ter um formato válido",
      "any.required": "Email é obrigatório",
    }),

    password: Joi.string().required().messages({
      "any.required": "Senha é obrigatória",
    }),

    rememberMe: Joi.boolean().default(false).messages({
      "boolean.base": "RememberMe deve ser um valor booleano",
    }),
  }),

  refresh: Joi.object({
    refreshToken: Joi.string().required().messages({
      "any.required": "Refresh token é obrigatório",
    }),
  }),

  recoverPassword: Joi.object({
    email: Joi.string().email().lowercase().required().messages({
      "string.email": "Email deve ter um formato válido",
      "any.required": "Email é obrigatório",
    }),
  }),

  resetPassword: Joi.object({
    token: Joi.string().required().messages({
      "any.required": "Token de recuperação é obrigatório",
    }),

    newPassword: Joi.string()
      .min(8)
      .max(128)
      .pattern(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/
      )
      .required()
      .messages({
        "string.min": "Nova senha deve ter pelo menos 8 caracteres",
        "string.max": "Nova senha deve ter no máximo 128 caracteres",
        "string.pattern.base":
          "Nova senha deve conter pelo menos: 1 letra minúscula, 1 maiúscula, 1 número e 1 caractere especial",
        "any.required": "Nova senha é obrigatória",
      }),
  }),
};

/**
 * 👥 Schemas de validação para usuários enterprise
 */
const userValidationSchemas = {
  // Para compatibilidade com sistema legado
  register: authValidationSchemas.register,
  login: authValidationSchemas.login,
  refresh: authValidationSchemas.refresh,

  createUser: Joi.object({
    name: Joi.string().min(2).max(100).trim().required().messages({
      "string.min": "Nome deve ter pelo menos 2 caracteres",
      "string.max": "Nome deve ter no máximo 100 caracteres",
      "any.required": "Nome é obrigatório",
    }),

    email: Joi.string().email().lowercase().required().messages({
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

    role: Joi.string().valid('viewer', 'editor', 'admin', 'super_admin').default('viewer').messages({
      "any.only": "Role deve ser: viewer, editor, admin ou super_admin",
    }),

    department: Joi.string().max(100).trim().allow(null, '').messages({
      "string.max": "Departamento deve ter no máximo 100 caracteres",
    }),

    position: Joi.string().max(100).trim().allow(null, '').messages({
      "string.max": "Posição deve ter no máximo 100 caracteres",
    }),

    phone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).allow(null, '').messages({
      "string.pattern.base": "Telefone deve estar no formato internacional (+5511999999999)",
    }),

    permissions: Joi.array().items(Joi.string()).default([]).messages({
      "array.base": "Permissões devem ser um array de strings",
    }),
  }),

  updateUser: Joi.object({
    name: Joi.string().min(2).max(100).trim().messages({
      "string.min": "Nome deve ter pelo menos 2 caracteres",
      "string.max": "Nome deve ter no máximo 100 caracteres",
    }),

    email: Joi.string().email().lowercase().messages({
      "string.email": "Email deve ter um formato válido",
    }),

    role: Joi.string().valid('viewer', 'editor', 'admin', 'super_admin').messages({
      "any.only": "Role deve ser: viewer, editor, admin ou super_admin",
    }),

    department: Joi.string().max(100).trim().allow(null, '').messages({
      "string.max": "Departamento deve ter no máximo 100 caracteres",
    }),

    position: Joi.string().max(100).trim().allow(null, '').messages({
      "string.max": "Posição deve ter no máximo 100 caracteres",
    }),

    phone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).allow(null, '').messages({
      "string.pattern.base": "Telefone deve estar no formato internacional (+5511999999999)",
    }),

    permissions: Joi.array().items(Joi.string()).messages({
      "array.base": "Permissões devem ser um array de strings",
    }),

    isActive: Joi.boolean().messages({
      "boolean.base": "IsActive deve ser um valor booleano",
    }),

    password: Joi.string()
      .min(8)
      .max(128)
      .pattern(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/
      )
      .messages({
        "string.min": "Senha deve ter pelo menos 8 caracteres",
        "string.max": "Senha deve ter no máximo 128 caracteres",
        "string.pattern.base":
          "Senha deve conter pelo menos: 1 letra minúscula, 1 maiúscula, 1 número e 1 caractere especial",
      }),
  }).min(1).messages({
    "object.min": "Pelo menos um campo deve ser fornecido para atualização",
  }),

  updateProfile: Joi.object({
    name: Joi.string().min(2).max(100).trim().messages({
      "string.min": "Nome deve ter pelo menos 2 caracteres",
      "string.max": "Nome deve ter no máximo 100 caracteres",
    }),

    email: Joi.string().email().lowercase().messages({
      "string.email": "Email deve ter um formato válido",
    }),

    phone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).allow(null, '').messages({
      "string.pattern.base": "Telefone deve estar no formato internacional (+5511999999999)",
    }),

    password: Joi.string()
      .min(8)
      .max(128)
      .pattern(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/
      )
      .messages({
        "string.min": "Senha deve ter pelo menos 8 caracteres",
        "string.max": "Senha deve ter no máximo 128 caracteres",
        "string.pattern.base":
          "Senha deve conter pelo menos: 1 letra minúscula, 1 maiúscula, 1 número e 1 caractere especial",
      }),
  }).min(1).messages({
    "object.min": "Pelo menos um campo deve ser fornecido para atualização",
  }),

  getUserById: Joi.object({
    id: Joi.string().uuid().required().messages({
      "string.uuid": "ID deve ser um UUID válido",
      "any.required": "ID é obrigatório",
    }),
  }),
};

/**
 * 📄 Schemas de validação para paginação
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
 * 🔧 Middleware para validação de request
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
          success: false,
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
        success: false,
        error: "Erro interno na validação",
        timestamp: new Date().toISOString(),
      });
    }
  };
};

/**
 * 📄 Valida parâmetros de paginação
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
      success: false,
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
 * 📧 Valida se um email tem formato válido
 * @param {string} email - Email para validar
 * @returns {boolean} True se o email for válido
 */
const isValidEmail = (email) => {
  const emailSchema = Joi.string().email();
  const { error } = emailSchema.validate(email);
  return !error;
};

/**
 * 🔒 Valida se uma senha atende aos critérios de segurança
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
 * 🧹 Sanitiza dados removendo campos sensíveis
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
 * 👤 Formata dados de usuário removendo informações sensíveis
 * @param {Object} user - Dados do usuário
 * @returns {Object} Usuário formatado
 */
const formatUser = (user) => {
  if (!user) return null;

  return sanitizeData(user, ["password", "password_hash"]);
};

/**
 * 🧹 SANITIZA OUTPUT DE USUÁRIO - Remove dados sensíveis
 * @param {Object} user - Dados do usuário
 * @returns {Object} Usuário sanitizado
 */
const sanitizeUserOutput = (user) => {
  if (!user) return null;

  const sanitized = { ...user };
  
  // Remove campos sensíveis
  delete sanitized.password;
  delete sanitized.password_hash;
  delete sanitized.failed_attempts;
  delete sanitized.locked_until;
  
  // Converte permissões de string para array se necessário
  if (typeof sanitized.permissions === 'string') {
    try {
      sanitized.permissions = JSON.parse(sanitized.permissions);
    } catch (e) {
      sanitized.permissions = [];
    }
  }

  return sanitized;
};

/**
 * 📄 Formata resposta de paginação
 * @param {Array} data - Dados da página
 * @param {Object} pagination - Metadados de paginação
 * @returns {Object} Resposta formatada
 */
const formatPaginatedResponse = (data, pagination) => {
  return {
    success: true,
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

/**
 * 🔍 VALIDAÇÃO DE DADOS DE USUÁRIO
 * @param {Object} userData - Dados do usuário para validar
 * @returns {Object} Resultado da validação
 */
const validateUserData = (userData) => {
  const schema = userValidationSchemas.createUser;
  const { error, value } = schema.validate(userData, {
    abortEarly: false,
    stripUnknown: true,
    convert: true,
  });

  if (error) {
    const errors = error.details.map((detail) => ({
      field: detail.path.join("."),
      message: detail.message,
      value: detail.context?.value,
    }));

    return {
      isValid: false,
      errors,
      value: null
    };
  }

  return {
    isValid: true,
    errors: [],
    value
  };
};

/**
 * 🔍 VALIDAÇÃO DE DADOS DE ATUALIZAÇÃO
 * @param {Object} updateData - Dados de atualização para validar
 * @returns {Object} Resultado da validação
 */
const validateUpdateData = (updateData) => {
  const schema = userValidationSchemas.updateUser;
  const { error, value } = schema.validate(updateData, {
    abortEarly: false,
    stripUnknown: true,
    convert: true,
  });

  if (error) {
    const errors = error.details.map((detail) => ({
      field: detail.path.join("."),
      message: detail.message,
      value: detail.context?.value,
    }));

    return {
      isValid: false,
      errors,
      value: null
    };
  }

  return {
    isValid: true,
    errors: [],
    value
  };
};

module.exports = {
  // Schemas
  authValidationSchemas,
  userValidationSchemas,
  paginationSchema,
  
  // Middlewares
  validateRequest,
  validatePagination,
  
  // Validações básicas
  isValidEmail,
  validatePassword,
  validateUserData,
  validateUpdateData,
  
  // Sanitização e formatação
  sanitizeData,
  formatUser,
  sanitizeUserOutput,
  formatPaginatedResponse,
};
