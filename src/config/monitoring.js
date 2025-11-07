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
 * 📊 SISTEMA DE MONITORAMENTO E MÉTRICAS
 * ==========================================
 */

const promClient = require('prom-client');
const { logger } = require('../utils/logger');

/**
 * Sistema de monitoramento com Prometheus
 * Coleta métricas de performance, erro e negócio
 */

// Configurar registro de métricas
const register = new promClient.Registry();

// Adicionar métricas padrão do Node.js
promClient.collectDefaultMetrics({
  register,
  prefix: 'crm_',
  gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5]
});

// ==========================================
// MÉTRICAS CUSTOMIZADAS
// ==========================================

// Contador de requests HTTP
const httpRequestsTotal = new promClient.Counter({
  name: 'crm_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code', 'company_id'],
  registers: [register]
});

// Duração de requests HTTP
const httpRequestDuration = new promClient.Histogram({
  name: 'crm_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code', 'company_id'],
  buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10],
  registers: [register]
});

// Tamanho das respostas HTTP
const httpResponseSize = new promClient.Histogram({
  name: 'crm_http_response_size_bytes',
  help: 'Size of HTTP responses in bytes',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000],
  registers: [register]
});

// Conexões ativas do banco de dados
const dbConnectionsActive = new promClient.Gauge({
  name: 'crm_db_connections_active',
  help: 'Number of active database connections',
  registers: [register]
});

// Duração de queries do banco
const dbQueryDuration = new promClient.Histogram({
  name: 'crm_db_query_duration_seconds',
  help: 'Duration of database queries in seconds',
  labelNames: ['query_type', 'table', 'company_id'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
  registers: [register]
});

// Cache hits/misses
const cacheOperations = new promClient.Counter({
  name: 'crm_cache_operations_total',
  help: 'Total number of cache operations',
  labelNames: ['operation', 'result', 'company_id'],
  registers: [register]
});

// Usuários ativos por empresa
const activeUsers = new promClient.Gauge({
  name: 'crm_active_users',
  help: 'Number of active users by company',
  labelNames: ['company_id', 'time_window'],
  registers: [register]
});

// Métricas de negócio - Vendas
const salesMetrics = {
  total: new promClient.Counter({
    name: 'crm_sales_total',
    help: 'Total number of sales',
    labelNames: ['company_id', 'stage', 'source'],
    registers: [register]
  }),
  
  value: new promClient.Counter({
    name: 'crm_sales_value_total',
    help: 'Total value of sales',
    labelNames: ['company_id', 'stage', 'currency'],
    registers: [register]
  }),
  
  conversionRate: new promClient.Gauge({
    name: 'crm_sales_conversion_rate',
    help: 'Sales conversion rate percentage',
    labelNames: ['company_id', 'source'],
    registers: [register]
  })
};

// Métricas de negócio - Clientes/Leads
const clientMetrics = {
  total: new promClient.Gauge({
    name: 'crm_clients_total',
    help: 'Total number of clients',
    labelNames: ['company_id', 'status', 'type'],
    registers: [register]
  }),
  
  newClients: new promClient.Counter({
    name: 'crm_new_clients_total',
    help: 'Total number of new clients',
    labelNames: ['company_id', 'source'],
    registers: [register]
  })
};

// Métricas de autenticação
const authMetrics = {
  logins: new promClient.Counter({
    name: 'crm_auth_logins_total',
    help: 'Total number of login attempts',
    labelNames: ['company_id', 'result', 'method'],
    registers: [register]
  }),
  
  sessions: new promClient.Gauge({
    name: 'crm_auth_sessions_active',
    help: 'Number of active sessions',
    labelNames: ['company_id'],
    registers: [register]
  })
};

// ==========================================
// MIDDLEWARE DE MONITORAMENTO SIMPLES
// ==========================================

/**
 * Middleware simplificado para coleta de métricas HTTP
 */
const metricsMiddleware = () => {
  return (req, res, next) => {
    // Pular métricas para o endpoint /metrics
    if (req.path === '/metrics') {
      return next();
    }

    const startTime = process.hrtime();

    // Interceptar final da resposta
    res.on('finish', () => {
      const hrTime = process.hrtime(startTime);
      const duration = hrTime[0] + hrTime[1] / 1e9;

      const labels = {
        method: req.method,
        route: req.route?.path || req.path,
        status_code: res.statusCode.toString(),
        company_id: req.user?.companyId || 'anonymous'
      };

      // Atualizar métricas
      httpRequestsTotal.inc(labels);
      httpRequestDuration.observe(labels, duration);
      
      // Tamanho da resposta
      const responseSize = parseInt(res.get('Content-Length')) || 0;
      if (responseSize > 0) {
        httpResponseSize.observe({
          method: req.method,
          route: req.route?.path || req.path,
          status_code: res.statusCode.toString()
        }, responseSize);
      }
    });

    next();
  };
};

/**
 * Middleware customizado para métricas detalhadas
 */
const customMetricsMiddleware = (req, res, next) => {
  const startTime = Date.now();
  const startHrTime = process.hrtime();

  // Interceptar final da resposta
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const hrDuration = process.hrtime(startHrTime);
    const durationSeconds = hrDuration[0] + hrDuration[1] / 1e9;

    const labels = {
      method: req.method,
      route: req.route?.path || req.path,
      status_code: res.statusCode.toString(),
      company_id: req.user?.companyId || 'anonymous'
    };

    // Atualizar métricas
    httpRequestsTotal.inc(labels);
    httpRequestDuration.observe(labels, durationSeconds);
    
    // Tamanho da resposta
    const responseSize = parseInt(res.get('Content-Length')) || 0;
    if (responseSize > 0) {
      httpResponseSize.observe({
        method: req.method,
        route: req.route?.path || req.path,
        status_code: res.statusCode.toString()
      }, responseSize);
    }

    // Log para análise
    logger.debug('Métricas HTTP coletadas', {
      ...labels,
      duration: durationSeconds,
      responseSize
    });
  });

  next();
};

/**
 * Coleta métricas de banco de dados
 */
const trackDbQuery = (queryType, table, companyId, duration) => {
  dbQueryDuration.observe({
    query_type: queryType,
    table: table || 'unknown',
    company_id: companyId || 'unknown'
  }, duration);
};

/**
 * Coleta métricas de cache
 */
const trackCacheOperation = (operation, result, companyId) => {
  cacheOperations.inc({
    operation, // get, set, del
    result,    // hit, miss, success, error
    company_id: companyId || 'unknown'
  });
};

/**
 * Coleta métricas de autenticação
 */
const trackAuth = {
  login: (companyId, result, method = 'password') => {
    authMetrics.logins.inc({
      company_id: companyId || 'unknown',
      result, // success, failure
      method
    });
  },
  
  updateActiveSessions: (companyId, count) => {
    authMetrics.sessions.set({
      company_id: companyId || 'unknown'
    }, count);
  }
};

/**
 * Coleta métricas de negócio
 */
const trackBusiness = {
  sale: {
    created: (companyId, stage, source, value, currency = 'BRL') => {
      salesMetrics.total.inc({
        company_id: companyId,
        stage,
        source: source || 'unknown'
      });
      
      if (value) {
        salesMetrics.value.inc({
          company_id: companyId,
          stage,
          currency
        }, parseFloat(value));
      }
    },
    
    updateConversionRate: (companyId, source, rate) => {
      salesMetrics.conversionRate.set({
        company_id: companyId,
        source: source || 'unknown'
      }, rate);
    }
  },
  
  client: {
    created: (companyId, source) => {
      clientMetrics.newClients.inc({
        company_id: companyId,
        source: source || 'unknown'
      });
    },
    
    updateTotals: (companyId, status, type, count) => {
      clientMetrics.total.set({
        company_id: companyId,
        status,
        type
      }, count);
    }
  }
};

/**
 * Endpoint para métricas customizadas
 */
const getMetrics = async (req, res) => {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (error) {
    logger.error('Erro ao gerar métricas', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
};

/**
 * Health check endpoint
 */
const getHealth = async (req, res) => {
  try {
    const health = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      version: process.env.npm_package_version || '1.0.0'
    };

    res.json({
      success: true,
      data: health
    });
  } catch (error) {
    logger.error('Erro no health check', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
};

module.exports = {
  register,
  metricsMiddleware,
  customMetricsMiddleware,
  trackDbQuery,
  trackCacheOperation,
  trackAuth,
  trackBusiness,
  getMetrics,
  getHealth,
  
  // Métricas individuais para uso direto
  metrics: {
    httpRequestsTotal,
    httpRequestDuration,
    httpResponseSize,
    dbConnectionsActive,
    dbQueryDuration,
    cacheOperations,
    activeUsers,
    salesMetrics,
    clientMetrics,
    authMetrics
  }
};