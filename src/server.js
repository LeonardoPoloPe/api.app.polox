#!/usr/bin/env node

/**
 * 🚀 POLOX CRM API - SERVER
 * 
 * Entry point para desenvolvimento local
 * Para produção, usar handler.js via Lambda
 */

require('dotenv').config();

const { createApp, configureProduction, configureErrorHandling } = require('./config/app');
const { healthCheck } = require('./config/database');
const { logger } = require('./utils/logger');
const { utils } = require('./config/auth');

// Importar rotas (serão implementadas nos próximos prompts)
// const authRoutes = require('./src/routes/auth');
// const userRoutes = require('./src/routes/users');
// const companyRoutes = require('./src/routes/companies');

async function startServer() {
  try {
    // Validar configurações críticas
    const warnings = utils.validateJWTConfig();
    if (warnings.length > 0) {
      warnings.forEach(warning => logger.warn(warning));
    }

    // Criar aplicação Express
    const app = createApp();

    // Configurar para produção se necessário
    configureProduction(app);

    // ==========================================
    // ROTAS DA APLICAÇÃO
    // ==========================================

    // Rota raiz com informações da API
    app.get('/', (req, res) => {
      res.json({
        success: true,
        message: 'Polox CRM API - Sistema Multi-Tenant Enterprise',
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        timestamp: new Date().toISOString(),
        documentation: process.env.ENABLE_SWAGGER === 'true' ? '/api/docs' : null,
        endpoints: {
          health: '/health',
          auth: '/api/auth',
          users: '/api/users',
          companies: '/api/companies',
          leads: '/api/leads',
          clients: '/api/clients',
          sales: '/api/sales'
        },
        features: {
          multiTenant: true,
          authentication: 'JWT Enterprise',
          database: 'PostgreSQL',
          gamification: process.env.GAMIFICATION_ENABLED === 'true',
          swagger: process.env.ENABLE_SWAGGER === 'true',
          rateLimiting: true,
          monitoring: true,
          auditLogs: true
        }
      });
    });

    // Importar e usar as rotas da API enterprise
    const apiRoutes = require('./routes');
    app.use('/api', apiRoutes);

    // Health check endpoint
    app.get('/health', async (req, res) => {
      try {
        const dbHealthy = await healthCheck();
        res.json({
          success: true,
          status: 'healthy',
          database: dbHealthy ? 'connected' : 'disconnected',
          timestamp: new Date().toISOString(),
          version: process.env.npm_package_version || '1.0.0',
          environment: process.env.NODE_ENV || 'development'
        });
      } catch (error) {
        res.status(503).json({
          success: false,
          status: 'unhealthy',
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    });

    // Configurar tratamento de erros
    configureErrorHandling(app);

    // ==========================================
    // TESTAR CONEXÃO COM BANCO
    // ==========================================
    
    logger.info('🔍 Testando conexão com banco de dados...');
    const dbHealthy = await healthCheck();
    
    if (!dbHealthy) {
      logger.error('❌ Falha na conexão com banco de dados');
      logger.error('Verifique as configurações de DB no arquivo .env');
      process.exit(1);
    }
    
    logger.info('✅ Conexão com banco de dados estabelecida');

    // ==========================================
    // INICIAR SERVIDOR
    // ==========================================
    
    const PORT = process.env.PORT || 3000;
    const server = app.listen(PORT, () => {
      logger.info('🚀 Polox CRM API iniciada com sucesso!');
      logger.info(`📍 Servidor rodando na porta: ${PORT}`);
      logger.info(`🌍 Ambiente: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`🔗 URL local: http://localhost:${PORT}`);
      logger.info(`❤️  Health check: http://localhost:${PORT}/health`);
      logger.info(`📚 API info: http://localhost:${PORT}/api`);
      
      if (process.env.ENABLE_SWAGGER === 'true') {
        logger.info(`📖 Swagger docs: http://localhost:${PORT}/api/docs`);
      }
      
      logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      logger.info('🎯 COPILOT_PROMPT_1 - ESTRUTURA BASE IMPLEMENTADA');
      logger.info('');
      logger.info('✅ Configurações de banco multi-tenant');
      logger.info('✅ Sistema de autenticação JWT');
      logger.info('✅ Middleware de segurança crítico');
      logger.info('✅ Sistema de logs estruturado');
      logger.info('✅ Tratamento de erros empresarial');
      logger.info('✅ Express.js configurado para produção');
      logger.info('');
      logger.info('📝 PRÓXIMO PASSO: COPILOT_PROMPT_2');
      logger.info('   → Implementar AuthController e UserController');
      logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    });

    // ==========================================
    // GRACEFUL SHUTDOWN
    // ==========================================
    
    const gracefulShutdown = (signal) => {
      logger.info(`📥 Recebido sinal ${signal}, iniciando shutdown graceful...`);
      
      server.close(() => {
        logger.info('🔒 Servidor HTTP fechado');
        
        // Fechar conexões do banco
        const { closePool } = require('./config/database');
        closePool()
          .then(() => {
            logger.info('🗄️  Pool de conexões PostgreSQL fechado');
            logger.info('✅ Shutdown completo');
            process.exit(0);
          })
          .catch((error) => {
            logger.error('❌ Erro ao fechar pool de conexões:', error);
            process.exit(1);
          });
      });

      // Force shutdown after 10 seconds
      setTimeout(() => {
        logger.error('⏰ Shutdown forçado após timeout');
        process.exit(1);
      }, 10000);
    };

    // Registrar handlers de shutdown
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Handler para erros não capturados
    process.on('uncaughtException', (error) => {
      logger.error('💥 Uncaught Exception:', error);
      gracefulShutdown('UNCAUGHT_EXCEPTION');
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('💥 Unhandled Rejection:', { reason, promise });
      gracefulShutdown('UNHANDLED_REJECTION');
    });

  } catch (error) {
    logger.error('❌ Falha ao iniciar servidor:', error);
    process.exit(1);
  }
}

// Iniciar servidor apenas se executado diretamente
if (require.main === module) {
  startServer();
}

module.exports = { startServer };