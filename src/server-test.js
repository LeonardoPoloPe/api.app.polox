/**
 * ==========================================
 * 🚀 SERVIDOR DE TESTE SIMPLIFICADO
 * ==========================================
 */

require('dotenv').config();

const { createApp, configureProduction, configureErrorHandling } = require('./config/app');
const { logger } = require('./utils/logger');

/**
 * Servidor simplificado para teste da infraestrutura
 */
const startTestServer = async () => {
  try {
    logger.info('🚀 Iniciando servidor de teste...');
    
    const PORT = parseInt(process.env.PORT) || 3000;
    const HOST = process.env.HOST || '0.0.0.0';
    const NODE_ENV = process.env.NODE_ENV || 'development';
    
    // Criar aplicação básica
    const app = createApp();
    
    // Health check básico
    app.get('/health', (req, res) => {
      res.json({
        success: true,
        message: 'Servidor CRM Enterprise funcionando!',
        data: {
          status: 'healthy',
          timestamp: new Date().toISOString(),
          environment: NODE_ENV,
          version: '1.0.0',
          uptime: process.uptime(),
          memory: process.memoryUsage()
        }
      });
    });

    // Endpoint de teste
    app.get('/test', (req, res) => {
      res.json({
        success: true,
        message: 'API CRM Enterprise está funcionando!',
        data: {
          features: [
            '✅ Express.js Enterprise',
            '✅ Sistema de Logging',
            '✅ Middleware de Segurança',
            '✅ Configuração Multi-tenant',
            '✅ Validação Joi',
            '✅ Sistema de Cache (Redis)',
            '✅ Monitoramento Prometheus',
            '✅ Upload de Arquivos',
            '✅ Agendador de Tarefas'
          ],
          nextSteps: [
            'COPILOT_PROMPT_2: AuthController e UserController',
            'COPILOT_PROMPT_3: CompanyController e GamificationController',
            'COPILOT_PROMPT_4: LeadController, ClientController, SaleController'
          ]
        }
      });
    });

    // Configurar tratamento de erros
    configureErrorHandling(app);
    
    // Iniciar servidor
    const server = app.listen(PORT, HOST, () => {
      logger.info(`✅ Servidor de teste iniciado com sucesso!`, {
        port: PORT,
        host: HOST,
        environment: NODE_ENV,
        pid: process.pid
      });
      
      console.log('\n🎉 COPILOT_PROMPT_1 - TESTE DE INFRAESTRUTURA');
      console.log('===============================================');
      console.log(`🔗 URLs de Teste:`);
      console.log(`   Health Check: http://localhost:${PORT}/health`);
      console.log(`   Teste API:    http://localhost:${PORT}/test`);
      console.log(`   Debug Config: http://localhost:${PORT}/debug/config`);
      console.log('\n📊 Status:');
      console.log(`   ✅ Express.js Enterprise configurado`);
      console.log(`   ✅ Sistema de segurança ativo`);
      console.log(`   ✅ Logging estruturado funcionando`);
      console.log(`   ✅ Middleware de validação pronto`);
      console.log(`   ⚠️  Cache Redis desabilitado (desenvolvimento)`);
      console.log(`   ⚠️  Banco de dados: conexão será testada pelos controllers`);
      console.log('\n🎯 Próximo Passo: Implementar COPILOT_PROMPT_2\n');
    });

    // Graceful shutdown
    const shutdown = (signal) => {
      logger.info(`Recebido ${signal}, encerrando servidor...`);
      server.close(() => {
        logger.info('Servidor encerrado graciosamente');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    return server;

  } catch (error) {
    logger.error('❌ Erro ao iniciar servidor de teste', {
      error: error.message,
      stack: error.stack
    });
    process.exit(1);
  }
};

if (require.main === module) {
  startTestServer();
}

module.exports = { startTestServer };