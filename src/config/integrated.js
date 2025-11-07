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
 * 🔧 CONFIGURAÇÃO INTEGRADA DO SISTEMA
 * ==========================================
 */

const { createApp, configureProduction, configureErrorHandling } = require('./app');
const { logger } = require('../utils/logger');
const { cache } = require('./cache');
const { initScheduler, stopScheduler } = require('./scheduler');
const { metricsMiddleware, customMetricsMiddleware, getMetrics, getHealth } = require('./monitoring');

/**
 * Configuração completa do sistema com todos os módulos integrados
 */
const createIntegratedApp = () => {
  const app = createApp();

  // ==========================================
  // INTEGRAÇÃO DE MONITORAMENTO
  // ==========================================
  
  // Métricas Prometheus
  app.use(metricsMiddleware());
  app.use(customMetricsMiddleware);

  // Endpoint de métricas
  app.get('/metrics', getMetrics);
  
  // Health check aprimorado
  app.get('/health', getHealth);

  // ==========================================
  // CONFIGURAÇÃO DE UPLOAD
  // ==========================================
  
  const { handleUploadError } = require('./upload');
  app.use(handleUploadError);

  // ==========================================
  // ROTAS DA API
  // ==========================================
  
  // Importar rotas quando estiverem disponíveis
  try {
    // Rotas de autenticação
    const authRoutes = require('../routes/auth');
    app.use('/api/auth', authRoutes);
    
    // Rotas de usuários
    const userRoutes = require('../routes/users');
    app.use('/api/users', userRoutes);
    
    // Rotas de empresas
    const companyRoutes = require('../routes/companies');
    app.use('/api/companies', companyRoutes);
    
    // Rotas de contatos (nova arquitetura - substitui leads + clients)
    const contactsRoutes = require('../routes/contacts');
    app.use('/api/contacts', contactsRoutes);
    
    // Rotas de negociações (pipeline de vendas)
    const dealsRoutes = require('../routes/deals');
    app.use('/api/deals', dealsRoutes);
    
    // Rotas de vendas
    const salesRoutes = require('../routes/sales');
    app.use('/api/sales', salesRoutes);
    
    // Rotas de produtos
    const productRoutes = require('../routes/products');
    app.use('/api/products', productRoutes);
    
    // Rotas de atividades
    const activityRoutes = require('../routes/activities');
    app.use('/api/activities', activityRoutes);
    
    // Rotas de relatórios
    const reportRoutes = require('../routes/reports');
    app.use('/api/reports', reportRoutes);
    
    // Rotas de webhooks
    const webhookRoutes = require('../routes/webhooks');
    app.use('/api/webhooks', webhookRoutes);
    
    logger.info('Todas as rotas carregadas com sucesso');
    
  } catch (error) {
    logger.warn('Algumas rotas ainda não estão disponíveis', { 
      error: error.message 
    });
  }

  // ==========================================
  // DOCUMENTAÇÃO DA API
  // ==========================================
  
  if (process.env.NODE_ENV !== 'production') {
    try {
      const swaggerUi = require('swagger-ui-express');
      const swaggerSpec = require('./swagger');
      
      app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
        customCss: `
          .swagger-ui .topbar { display: none }
          .swagger-ui .info { margin: 20px 0 }
          .swagger-ui .scheme-container { background: #fafafa; padding: 10px; border-radius: 5px; }
        `,
        customSiteTitle: 'CRM API Documentation',
        customfavIcon: '/favicon.ico',
        swaggerOptions: {
          persistAuthorization: true,
          displayRequestDuration: true,
          filter: true,
          showExtensions: true,
          showCommonExtensions: true
        }
      }));
      
      logger.info('Documentação Swagger disponível em /api-docs');
    } catch (error) {
      logger.warn('Swagger não pôde ser carregado', { error: error.message });
    }
  }

  // ==========================================
  // CONFIGURAÇÕES FINAIS
  // ==========================================
  
  // Configuração para produção
  configureProduction(app);
  
  // Configuração de tratamento de erros
  configureErrorHandling(app);

  return app;
};

/**
 * Inicializa todos os serviços do sistema
 */
const initializeServices = async () => {
  logger.info('Inicializando serviços do sistema...');

  try {
    // ==========================================
    // CACHE (REDIS)
    // ==========================================
    
    if (process.env.REDIS_URL) {
      logger.info('Inicializando sistema de cache Redis...');
      // O cache é inicializado automaticamente no construtor
      setTimeout(async () => {
        const info = await cache.getInfo();
        if (info) {
          logger.info('Cache Redis inicializado com sucesso', { 
            connected: info.connected 
          });
        }
      }, 1000);
    } else {
      logger.warn('Redis não configurado - cache desabilitado');
    }

    // ==========================================
    // AGENDADOR DE TAREFAS
    // ==========================================
    
    if (process.env.NODE_ENV === 'production' || process.env.ENABLE_SCHEDULER === 'true') {
      logger.info('Inicializando sistema de agendamento...');
      initScheduler();
    } else {
      logger.info('Agendador registrado mas não iniciado (desenvolvimento)');
    }

    // ==========================================
    // BANCO DE DADOS
    // ==========================================
    
    logger.info('Verificando conexão com banco de dados...');
    const { query } = require('../models/database');
    await query('SELECT 1');
    logger.info('Conexão com banco de dados estabelecida');

    logger.info('Todos os serviços inicializados com sucesso');

  } catch (error) {
    logger.error('Erro ao inicializar serviços', { 
      error: error.message,
      stack: error.stack 
    });
    throw error;
  }
};

/**
 * Encerra todos os serviços graciosamente
 */
const shutdownServices = async () => {
  logger.info('Encerrando serviços...');

  try {
    // Parar agendador
    stopScheduler();
    
    // Desconectar cache
    if (cache && cache.disconnect) {
      await cache.disconnect();
    }
    
    // Fechar pool de conexões do banco
    const { closePool } = require('../models/database');
    if (closePool) {
      await closePool();
    }
    
    logger.info('Todos os serviços encerrados');
    
  } catch (error) {
    logger.error('Erro ao encerrar serviços', { error: error.message });
  }
};

/**
 * Configura handlers para shutdown gracioso
 */
const setupGracefulShutdown = (server) => {
  const shutdown = async (signal) => {
    logger.info(`Recebido sinal ${signal}, iniciando shutdown gracioso...`);
    
    // Parar de aceitar novas conexões
    server.close(async () => {
      logger.info('Servidor HTTP fechado');
      
      try {
        await shutdownServices();
        process.exit(0);
      } catch (error) {
        logger.error('Erro durante shutdown', { error: error.message });
        process.exit(1);
      }
    });
    
    // Forçar saída após timeout
    setTimeout(() => {
      logger.error('Timeout durante shutdown, forçando saída');
      process.exit(1);
    }, parseInt(process.env.SHUTDOWN_TIMEOUT) || 30000);
  };

  // Registrar handlers para sinais de sistema
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  
  // Handler para erros não capturados
  process.on('uncaughtException', (error) => {
    logger.error('Erro não capturado', { 
      error: error.message, 
      stack: error.stack 
    });
    process.exit(1);
  });
  
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Promise rejeitada não tratada', { 
      reason, 
      promise 
    });
    process.exit(1);
  });
};

module.exports = {
  createIntegratedApp,
  initializeServices,
  shutdownServices,
  setupGracefulShutdown
};