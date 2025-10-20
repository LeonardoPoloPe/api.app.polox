/**
 * ==========================================
 * ✅ SISTEMA DE VALIDAÇÃO AVANÇADA
 * ==========================================
 */

const Joi = require('joi');
const { ApiError } = require('./errors');
const { logger } = require('./logger');

/**
 * Sistema de validação robusto com Joi
 * Inclui validações customizadas para CRM
 */

// Validações customizadas
const customValidations = {
  // CPF brasileiro
  cpf: Joi.string().custom((value, helpers) => {
    const cpf = value.replace(/[^\d]/g, '');
    
    if (cpf.length !== 11) {
      return helpers.error('any.invalid');
    }
    
    // Verificar se todos os dígitos são iguais
    if (/^(\d)\1{10}$/.test(cpf)) {
      return helpers.error('any.invalid');
    }
    
    // Validar dígitos verificadores
    let sum = 0;
    for (let i = 0; i < 9; i++) {
      sum += parseInt(cpf.charAt(i)) * (10 - i);
    }
    let remainder = (sum * 10) % 11;
    if (remainder === 10) remainder = 0;
    if (remainder !== parseInt(cpf.charAt(9))) {
      return helpers.error('any.invalid');
    }
    
    sum = 0;
    for (let i = 0; i < 10; i++) {
      sum += parseInt(cpf.charAt(i)) * (11 - i);
    }
    remainder = (sum * 10) % 11;
    if (remainder === 10) remainder = 0;
    if (remainder !== parseInt(cpf.charAt(10))) {
      return helpers.error('any.invalid');
    }
    
    return value;
  }, 'CPF validation'),

  // CNPJ brasileiro
  cnpj: Joi.string().custom((value, helpers) => {
    const cnpj = value.replace(/[^\d]/g, '');
    
    if (cnpj.length !== 14) {
      return helpers.error('any.invalid');
    }
    
    // Verificar se todos os dígitos são iguais
    if (/^(\d)\1{13}$/.test(cnpj)) {
      return helpers.error('any.invalid');
    }
    
    // Validar primeiro dígito verificador
    let sum = 0;
    let weight = 2;
    for (let i = 11; i >= 0; i--) {
      sum += parseInt(cnpj.charAt(i)) * weight;
      weight++;
      if (weight > 9) weight = 2;
    }
    let remainder = sum % 11;
    let digit1 = remainder < 2 ? 0 : 11 - remainder;
    
    if (digit1 !== parseInt(cnpj.charAt(12))) {
      return helpers.error('any.invalid');
    }
    
    // Validar segundo dígito verificador
    sum = 0;
    weight = 2;
    for (let i = 12; i >= 0; i--) {
      sum += parseInt(cnpj.charAt(i)) * weight;
      weight++;
      if (weight > 9) weight = 2;
    }
    remainder = sum % 11;
    let digit2 = remainder < 2 ? 0 : 11 - remainder;
    
    if (digit2 !== parseInt(cnpj.charAt(13))) {
      return helpers.error('any.invalid');
    }
    
    return value;
  }, 'CNPJ validation'),

  // CEP brasileiro
  cep: Joi.string().pattern(/^\d{5}-?\d{3}$/).message('CEP deve ter formato 00000-000'),
  
  // Telefone brasileiro
  phone: Joi.string().pattern(/^\(\d{2}\)\s?\d{4,5}-?\d{4}$/).message('Telefone deve ter formato (00) 00000-0000'),
  
  // Senha forte
  strongPassword: Joi.string()
    .min(8)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .message('Senha deve ter pelo menos 8 caracteres, incluindo maiúscula, minúscula, número e símbolo'),
  
  // ObjectId do MongoDB/PostgreSQL UUID
  objectId: Joi.alternatives().try(
    Joi.string().length(24).hex(),
    Joi.string().uuid()
  ),
  
  // Coordenadas geográficas
  latitude: Joi.number().min(-90).max(90),
  longitude: Joi.number().min(-180).max(180),
  
  // Valor monetário
  currency: Joi.alternatives().try(
    Joi.number().min(0),
    Joi.string().pattern(/^\d+(\.\d{1,2})?$/)
  )
};

// Schemas de validação para entidades principais
const schemas = {
  // ==========================================
  // USUÁRIOS
  // ==========================================
  user: {
    create: Joi.object({
      name: Joi.string().min(2).max(100).required(),
      email: Joi.string().email().required(),
      password: customValidations.strongPassword.required(),
      role: Joi.string().valid('admin', 'manager', 'salesperson', 'support', 'viewer').default('viewer'),
      phone: customValidations.phone.optional(),
      cpf: customValidations.cpf.optional(),
      department: Joi.string().max(50).optional(),
      position: Joi.string().max(50).optional(),
      permissions: Joi.array().items(Joi.string()).optional(),
      isActive: Joi.boolean().default(true),
      metadata: Joi.object().optional()
    }),
    
    update: Joi.object({
      name: Joi.string().min(2).max(100).optional(),
      phone: customValidations.phone.optional(),
      department: Joi.string().max(50).optional(),
      position: Joi.string().max(50).optional(),
      permissions: Joi.array().items(Joi.string()).optional(),
      isActive: Joi.boolean().optional(),
      metadata: Joi.object().optional()
    }),
    
    login: Joi.object({
      email: Joi.string().email().required(),
      password: Joi.string().required(),
      rememberMe: Joi.boolean().default(false)
    }),
    
    changePassword: Joi.object({
      currentPassword: Joi.string().required(),
      newPassword: customValidations.strongPassword.required(),
      confirmPassword: Joi.string().valid(Joi.ref('newPassword')).required()
    })
  },

  // ==========================================
  // EMPRESAS
  // ==========================================
  company: {
    create: Joi.object({
      name: Joi.string().min(2).max(100).required(),
      tradeName: Joi.string().max(100).optional(),
      cnpj: customValidations.cnpj.required(),
      email: Joi.string().email().required(),
      phone: customValidations.phone.required(),
      website: Joi.string().uri().optional(),
      plan: Joi.string().valid('basic', 'professional', 'enterprise').default('basic'),
      industry: Joi.string().max(50).optional(),
      size: Joi.string().valid('micro', 'small', 'medium', 'large').optional(),
      address: Joi.object({
        street: Joi.string().max(200).required(),
        number: Joi.string().max(10).required(),
        complement: Joi.string().max(100).optional(),
        neighborhood: Joi.string().max(100).required(),
        city: Joi.string().max(100).required(),
        state: Joi.string().length(2).required(),
        cep: customValidations.cep.required(),
        country: Joi.string().default('BR')
      }).required(),
      settings: Joi.object().optional()
    }),
    
    update: Joi.object({
      name: Joi.string().min(2).max(100).optional(),
      tradeName: Joi.string().max(100).optional(),
      email: Joi.string().email().optional(),
      phone: customValidations.phone.optional(),
      website: Joi.string().uri().optional(),
      industry: Joi.string().max(50).optional(),
      size: Joi.string().valid('micro', 'small', 'medium', 'large').optional(),
      address: Joi.object({
        street: Joi.string().max(200).optional(),
        number: Joi.string().max(10).optional(),
        complement: Joi.string().max(100).optional(),
        neighborhood: Joi.string().max(100).optional(),
        city: Joi.string().max(100).optional(),
        state: Joi.string().length(2).optional(),
        cep: customValidations.cep.optional(),
        country: Joi.string().optional()
      }).optional(),
      settings: Joi.object().optional()
    })
  },

  // ==========================================
  // CLIENTES/LEADS
  // ==========================================
  client: {
    create: Joi.object({
      name: Joi.string().min(2).max(100).required(),
      email: Joi.string().email().optional(),
      phone: customValidations.phone.optional(),
      cpf: customValidations.cpf.optional(),
      cnpj: customValidations.cnpj.optional(),
      type: Joi.string().valid('individual', 'company').default('individual'),
      status: Joi.string().valid('lead', 'prospect', 'client', 'inactive').default('lead'),
      source: Joi.string().max(50).optional(),
      tags: Joi.array().items(Joi.string()).optional(),
      assignedTo: customValidations.objectId.optional(),
      address: Joi.object({
        street: Joi.string().max(200).optional(),
        number: Joi.string().max(10).optional(),
        complement: Joi.string().max(100).optional(),
        neighborhood: Joi.string().max(100).optional(),
        city: Joi.string().max(100).optional(),
        state: Joi.string().length(2).optional(),
        cep: customValidations.cep.optional(),
        country: Joi.string().default('BR')
      }).optional(),
      notes: Joi.string().max(1000).optional(),
      customFields: Joi.object().optional()
    }),
    
    update: Joi.object({
      name: Joi.string().min(2).max(100).optional(),
      email: Joi.string().email().optional(),
      phone: customValidations.phone.optional(),
      status: Joi.string().valid('lead', 'prospect', 'client', 'inactive').optional(),
      source: Joi.string().max(50).optional(),
      tags: Joi.array().items(Joi.string()).optional(),
      assignedTo: customValidations.objectId.optional(),
      address: Joi.object({
        street: Joi.string().max(200).optional(),
        number: Joi.string().max(10).optional(),
        complement: Joi.string().max(100).optional(),
        neighborhood: Joi.string().max(100).optional(),
        city: Joi.string().max(100).optional(),
        state: Joi.string().length(2).optional(),
        cep: customValidations.cep.optional(),
        country: Joi.string().optional()
      }).optional(),
      notes: Joi.string().max(1000).optional(),
      customFields: Joi.object().optional()
    })
  },

  // ==========================================
  // VENDAS/OPORTUNIDADES
  // ==========================================
  sale: {
    create: Joi.object({
      title: Joi.string().min(2).max(200).required(),
      description: Joi.string().max(1000).optional(),
      clientId: customValidations.objectId.required(),
      assignedTo: customValidations.objectId.required(),
      value: customValidations.currency.required(),
      stage: Joi.string().valid(
        'prospecting', 'qualification', 'proposal', 
        'negotiation', 'closing', 'won', 'lost'
      ).default('prospecting'),
      probability: Joi.number().min(0).max(100).default(10),
      expectedCloseDate: Joi.date().min('now').required(),
      source: Joi.string().max(50).optional(),
      products: Joi.array().items(Joi.object({
        name: Joi.string().required(),
        quantity: Joi.number().min(1).required(),
        unitPrice: customValidations.currency.required(),
        totalPrice: customValidations.currency.required()
      })).optional(),
      customFields: Joi.object().optional()
    }),
    
    update: Joi.object({
      title: Joi.string().min(2).max(200).optional(),
      description: Joi.string().max(1000).optional(),
      assignedTo: customValidations.objectId.optional(),
      value: customValidations.currency.optional(),
      stage: Joi.string().valid(
        'prospecting', 'qualification', 'proposal', 
        'negotiation', 'closing', 'won', 'lost'
      ).optional(),
      probability: Joi.number().min(0).max(100).optional(),
      expectedCloseDate: Joi.date().min('now').optional(),
      source: Joi.string().max(50).optional(),
      products: Joi.array().items(Joi.object({
        name: Joi.string().required(),
        quantity: Joi.number().min(1).required(),
        unitPrice: customValidations.currency.required(),
        totalPrice: customValidations.currency.required()
      })).optional(),
      customFields: Joi.object().optional()
    })
  },

  // ==========================================
  // PRODUTOS/SERVIÇOS
  // ==========================================
  product: {
    create: Joi.object({
      name: Joi.string().min(2).max(100).required(),
      description: Joi.string().max(500).optional(),
      sku: Joi.string().max(50).optional(),
      category: Joi.string().max(50).optional(),
      price: customValidations.currency.required(),
      cost: customValidations.currency.optional(),
      isActive: Joi.boolean().default(true),
      inventory: Joi.object({
        trackInventory: Joi.boolean().default(false),
        quantity: Joi.number().min(0).optional(),
        minQuantity: Joi.number().min(0).optional()
      }).optional(),
      customFields: Joi.object().optional()
    }),
    
    update: Joi.object({
      name: Joi.string().min(2).max(100).optional(),
      description: Joi.string().max(500).optional(),
      sku: Joi.string().max(50).optional(),
      category: Joi.string().max(50).optional(),
      price: customValidations.currency.optional(),
      cost: customValidations.currency.optional(),
      isActive: Joi.boolean().optional(),
      inventory: Joi.object({
        trackInventory: Joi.boolean().optional(),
        quantity: Joi.number().min(0).optional(),
        minQuantity: Joi.number().min(0).optional()
      }).optional(),
      customFields: Joi.object().optional()
    })
  },

  // ==========================================
  // ATIVIDADES/TAREFAS
  // ==========================================
  activity: {
    create: Joi.object({
      type: Joi.string().valid(
        'call', 'email', 'meeting', 'task', 
        'note', 'proposal', 'contract'
      ).required(),
      title: Joi.string().min(2).max(200).required(),
      description: Joi.string().max(1000).optional(),
      clientId: customValidations.objectId.optional(),
      saleId: customValidations.objectId.optional(),
      assignedTo: customValidations.objectId.required(),
      dueDate: Joi.date().optional(),
      priority: Joi.string().valid('low', 'medium', 'high', 'urgent').default('medium'),
      status: Joi.string().valid('pending', 'in_progress', 'completed', 'cancelled').default('pending'),
      isCompleted: Joi.boolean().default(false),
      customFields: Joi.object().optional()
    }),
    
    update: Joi.object({
      title: Joi.string().min(2).max(200).optional(),
      description: Joi.string().max(1000).optional(),
      assignedTo: customValidations.objectId.optional(),
      dueDate: Joi.date().optional(),
      priority: Joi.string().valid('low', 'medium', 'high', 'urgent').optional(),
      status: Joi.string().valid('pending', 'in_progress', 'completed', 'cancelled').optional(),
      isCompleted: Joi.boolean().optional(),
      customFields: Joi.object().optional()
    })
  },

  // ==========================================
  // PARÂMETROS COMUNS
  // ==========================================
  pagination: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    sortBy: Joi.string().optional(),
    sortOrder: Joi.string().valid('asc', 'desc').default('desc')
  }),

  filters: Joi.object({
    search: Joi.string().max(100).optional(),
    status: Joi.string().optional(),
    dateFrom: Joi.date().optional(),
    dateTo: Joi.date().optional(),
    assignedTo: customValidations.objectId.optional()
  })
};

/**
 * Middleware de validação
 */
const validate = (schema, property = 'body') => {
  return (req, res, next) => {
    try {
      const { error, value } = schema.validate(req[property], {
        abortEarly: false,
        allowUnknown: false,
        stripUnknown: true
      });

      if (error) {
        const errors = error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message,
          value: detail.context?.value
        }));

        logger.warn('Erro de validação', {
          property,
          errors,
          originalData: req[property]
        });

        throw new ApiError(400, 'Dados inválidos', errors);
      }

      // Substituir dados validados
      req[property] = value;
      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Validação de parâmetros de consulta
 */
const validateQuery = (schema) => validate(schema, 'query');

/**
 * Validação de parâmetros de rota
 */
const validateParams = (schema) => validate(schema, 'params');

module.exports = {
  schemas,
  validate,
  validateQuery,
  validateParams,
  customValidations
};