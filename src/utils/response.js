/**
 * Utilitários para padronização de respostas da API
 * Garante consistência em todas as respostas do sistema
 */

const path = require('path');
const fs = require('fs');

// Cache de traduções
let translationsCache = {};

/**
 * Carrega traduções para respostas
 */
function loadResponseTranslations() {
  if (Object.keys(translationsCache).length > 0) {
    return translationsCache;
  }

  try {
    const languages = ['pt', 'en', 'es'];

    languages.forEach((lang) => {
      const filePath = path.join(__dirname, `../locales/utils/${lang}/response.json`);
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        translationsCache[lang] = JSON.parse(content);
      }
    });

    return translationsCache;
  } catch (error) {
    console.error('[RESPONSE.JS] Erro ao carregar traduções:', error);
    return {};
  }
}

/**
 * Traduz mensagem de resposta
 * @param {Object} req - Request object (para pegar idioma)
 * @param {string} key - Chave da tradução
 * @param {string} fallback - Mensagem fallback
 */
function tr(req, key, fallback) {
  try {
    const translations = loadResponseTranslations();
    
    // Pegar idioma do header ou usar português como padrão
    const acceptLanguage = req?.headers?.['accept-language'] || 'pt';
    const primaryLang = acceptLanguage.split(',')[0].split('-')[0];
    const lang = ['pt', 'en', 'es'].includes(primaryLang) ? primaryLang : 'pt';

    const keys = key.split('.');
    let value = translations[lang];

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return fallback;
      }
    }

    return typeof value === 'string' ? value : fallback;
  } catch (error) {
    return fallback;
  }
}

/**
 * Resposta de sucesso padrão
 * @param {Response} res - Response object do Express
 * @param {*} data - Dados a serem retornados
 * @param {string} message - Mensagem de sucesso
 * @param {number} statusCode - HTTP status code (default: 200)
 * @param {Object} meta - Metadados adicionais
 * @returns {Response} Response com formato padronizado
 */
const successResponse = (res, data = null, message = null, statusCode = 200, meta = {}) => {
  // Se message não foi fornecida, usar tradução padrão
  const finalMessage = message || tr(res.req, 'success.default', 'Operação realizada com sucesso');
  
  const response = {
    success: true,
    message: finalMessage,
    data,
    timestamp: new Date().toISOString(),
    ...meta
  };

  return res.status(statusCode).json(response);
};

/**
 * Resposta paginada padrão
 * @param {Response} res - Response object do Express
 * @param {Array} data - Array de dados
 * @param {Object} pagination - Informações de paginação
 * @param {string} message - Mensagem de sucesso
 * @param {Object} meta - Metadados adicionais
 * @returns {Response} Response paginada
 */
const paginatedResponse = (res, data, pagination, message = null, meta = {}) => {
  // Se message não foi fornecida, usar tradução
  const finalMessage = message || tr(res.req, 'success.data_retrieved', 'Dados obtidos com sucesso');
  
  const response = {
    success: true,
    message: finalMessage,
    data,
    pagination: {
      currentPage: parseInt(pagination.page) || 1,
      totalPages: pagination.totalPages || 1,
      totalItems: pagination.totalItems || data.length,
      itemsPerPage: parseInt(pagination.limit) || data.length,
      hasNextPage: pagination.hasNextPage || false,
      hasPreviousPage: pagination.hasPreviousPage || false,
      ...pagination
    },
    timestamp: new Date().toISOString(),
    ...meta
  };

  return res.status(200).json(response);
};

/**
 * Resposta de criação de recurso
 * @param {Response} res - Response object do Express
 * @param {*} data - Dados do recurso criado
 * @param {string} message - Mensagem de sucesso
 * @param {string} resourceType - Tipo do recurso criado
 * @returns {Response} Response de criação
 */
const createdResponse = (res, data, message = null, resourceType = 'Recurso') => {
  const finalMessage = message || `${resourceType} criado com sucesso`;
  
  return successResponse(res, data, finalMessage, 201, {
    created: true,
    resourceType
  });
};

/**
 * Resposta de atualização de recurso
 * @param {Response} res - Response object do Express
 * @param {*} data - Dados do recurso atualizado
 * @param {string} message - Mensagem de sucesso
 * @param {string} resourceType - Tipo do recurso atualizado
 * @returns {Response} Response de atualização
 */
const updatedResponse = (res, data, message = null, resourceType = 'Recurso') => {
  const finalMessage = message || `${resourceType} atualizado com sucesso`;
  
  return successResponse(res, data, finalMessage, 200, {
    updated: true,
    resourceType
  });
};

/**
 * Resposta de exclusão de recurso
 * @param {Response} res - Response object do Express
 * @param {string} message - Mensagem de sucesso
 * @param {string} resourceType - Tipo do recurso excluído
 * @param {*} data - Dados adicionais (opcional)
 * @returns {Response} Response de exclusão
 */
const deletedResponse = (res, message = null, resourceType = 'Recurso', data = null) => {
  const finalMessage = message || `${resourceType} excluído com sucesso`;
  
  return successResponse(res, data, finalMessage, 200, {
    deleted: true,
    resourceType
  });
};

/**
 * Resposta de operação sem conteúdo
 * @param {Response} res - Response object do Express
 * @param {string} message - Mensagem de sucesso
 * @returns {Response} Response 204 No Content
 */
const noContentResponse = (res, message = 'Operação realizada com sucesso') => {
  res.status(204).json({
    success: true,
    message,
    timestamp: new Date().toISOString()
  });
};

/**
 * Resposta de dados em cache
 * @param {Response} res - Response object do Express
 * @param {*} data - Dados cacheados
 * @param {string} message - Mensagem de sucesso
 * @param {Object} cacheInfo - Informações do cache
 * @returns {Response} Response com informações de cache
 */
const cachedResponse = (res, data, message = 'Dados obtidos do cache', cacheInfo = {}) => {
  return successResponse(res, data, message, 200, {
    cached: true,
    cacheInfo: {
      hit: true,
      ttl: cacheInfo.ttl || null,
      generatedAt: cacheInfo.generatedAt || null,
      ...cacheInfo
    }
  });
};

/**
 * Resposta de operação assíncrona iniciada
 * @param {Response} res - Response object do Express
 * @param {string} taskId - ID da tarefa assíncrona
 * @param {string} message - Mensagem de sucesso
 * @param {Object} taskInfo - Informações da tarefa
 * @returns {Response} Response de tarefa iniciada
 */
const asyncTaskResponse = (res, taskId, message = 'Tarefa iniciada com sucesso', taskInfo = {}) => {
  return successResponse(res, {
    taskId,
    ...taskInfo
  }, message, 202, {
    async: true,
    taskStarted: true
  });
};

/**
 * Resposta de upload de arquivo
 * @param {Response} res - Response object do Express
 * @param {Object} fileInfo - Informações do arquivo
 * @param {string} message - Mensagem de sucesso
 * @returns {Response} Response de upload
 */
const fileUploadResponse = (res, fileInfo, message = 'Arquivo enviado com sucesso') => {
  return successResponse(res, {
    file: {
      id: fileInfo.id,
      name: fileInfo.name,
      size: fileInfo.size,
      type: fileInfo.type,
      url: fileInfo.url,
      uploadedAt: fileInfo.uploadedAt || new Date().toISOString()
    }
  }, message, 201, {
    uploaded: true,
    fileType: fileInfo.type
  });
};

/**
 * Resposta de export/download
 * @param {Response} res - Response object do Express
 * @param {string} downloadUrl - URL para download
 * @param {string} message - Mensagem de sucesso
 * @param {Object} exportInfo - Informações do export
 * @returns {Response} Response de export
 */
const exportResponse = (res, downloadUrl, message = 'Export gerado com sucesso', exportInfo = {}) => {
  return successResponse(res, {
    downloadUrl,
    expiresAt: exportInfo.expiresAt,
    format: exportInfo.format,
    size: exportInfo.size
  }, message, 200, {
    exported: true,
    ...exportInfo
  });
};

/**
 * Resposta de validação de dados
 * @param {Response} res - Response object do Express
 * @param {Object} validationResult - Resultado da validação
 * @param {string} message - Mensagem de sucesso
 * @returns {Response} Response de validação
 */
const validationResponse = (res, validationResult, message = 'Validação realizada') => {
  return successResponse(res, {
    isValid: validationResult.isValid,
    errors: validationResult.errors || [],
    warnings: validationResult.warnings || []
  }, message, 200, {
    validated: true,
    hasErrors: (validationResult.errors || []).length > 0,
    hasWarnings: (validationResult.warnings || []).length > 0
  });
};

/**
 * Resposta de health check
 * @param {Response} res - Response object do Express
 * @param {Object} healthData - Dados de saúde do sistema
 * @returns {Response} Response de health check
 */
const healthResponse = (res, healthData) => {
  const isHealthy = healthData.status === 'healthy';
  const statusCode = isHealthy ? 200 : 503;
  
  return res.status(statusCode).json({
    success: isHealthy,
    status: healthData.status,
    timestamp: new Date().toISOString(),
    data: healthData,
    checks: healthData.checks || {}
  });
};

/**
 * Helper para calcular informações de paginação
 * @param {number} page - Página atual
 * @param {number} limit - Itens por página
 * @param {number} totalItems - Total de itens
 * @returns {Object} Objeto com informações de paginação
 */
const calculatePagination = (page = 1, limit = 10, totalItems = 0) => {
  const currentPage = Math.max(1, parseInt(page));
  const itemsPerPage = Math.max(1, Math.min(100, parseInt(limit))); // Limite máximo de 100
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
  const offset = (currentPage - 1) * itemsPerPage;
  
  return {
    page: currentPage,
    limit: itemsPerPage,
    totalPages,
    totalItems,
    offset,
    hasNextPage: currentPage < totalPages,
    hasPreviousPage: currentPage > 1,
    isFirstPage: currentPage === 1,
    isLastPage: currentPage === totalPages
  };
};

/**
 * Helper para formatação de dados de resposta
 * @param {*} data - Dados a serem formatados
 * @param {Object} options - Opções de formatação
 * @returns {*} Dados formatados
 */
const formatResponseData = (data, options = {}) => {
  if (!data) return data;
  
  const {
    excludeFields = [],
    includeFields = null,
    transforms = {},
    dateFormat = 'iso'
  } = options;

  const formatItem = (item) => {
    if (!item || typeof item !== 'object') return item;
    
    let formatted = { ...item };
    
    // Incluir apenas campos especificados
    if (includeFields && Array.isArray(includeFields)) {
      const filtered = {};
      includeFields.forEach(field => {
        if (formatted.hasOwnProperty(field)) {
          filtered[field] = formatted[field];
        }
      });
      formatted = filtered;
    }
    
    // Excluir campos sensíveis
    excludeFields.forEach(field => {
      delete formatted[field];
    });
    
    // Aplicar transformações
    Object.keys(transforms).forEach(field => {
      if (formatted.hasOwnProperty(field)) {
        formatted[field] = transforms[field](formatted[field]);
      }
    });
    
    // Formatar datas
    if (dateFormat === 'iso') {
      Object.keys(formatted).forEach(key => {
        if (formatted[key] instanceof Date) {
          formatted[key] = formatted[key].toISOString();
        }
      });
    }
    
    return formatted;
  };

  if (Array.isArray(data)) {
    return data.map(formatItem);
  } else {
    return formatItem(data);
  }
};

module.exports = {
  // Respostas padrão
  successResponse,
  paginatedResponse,
  createdResponse,
  updatedResponse,
  deletedResponse,
  noContentResponse,
  
  // Respostas especializadas
  cachedResponse,
  asyncTaskResponse,
  fileUploadResponse,
  exportResponse,
  validationResponse,
  healthResponse,
  
  // Helpers
  calculatePagination,
  formatResponseData
};