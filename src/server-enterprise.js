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
 * 🚀 SERVIDOR ENTERPRISE CRM POLOX
 * ==========================================
 */

require('dotenv').config();

const { 
  createIntegratedApp, 
  initializeServices, 
  setupGracefulShutdown 
} = require('./config/integrated');
const { logger } = require('./utils/logger');

/**
 * Servidor enterprise com todos os recursos integrados
 */
const startServer = async () => {
  try {
    logger.info('🚀 Iniciando servidor CRM Polox Enterprise...');
    
    // ==========================================
    // CONFIGURAÇÕES DO SERVIDOR
    // ==========================================
    
    const PORT = parseInt(process.env.PORT) || 3000;
    const HOST = process.env.HOST || '0.0.0.0';
    const NODE_ENV = process.env.NODE_ENV || 'development';
    
    logger.info('Configurações do servidor', {
      port: PORT,
      host: HOST,
      environment: NODE_ENV,
      nodeVersion: process.version,
      platform: process.platform
    });

    // ==========================================
    // INICIALIZAÇÃO DOS SERVIÇOS
    // ==========================================
    
    // Inicializar todos os serviços (cache, banco, agendador)
    await initializeServices();
    
    // ==========================================
    // CRIAÇÃO DA APLICAÇÃO
    // ==========================================
    
    // Criar app com todos os módulos integrados
    const app = createIntegratedApp();
    
    // ==========================================
    // INICIALIZAÇÃO DO SERVIDOR
    // ==========================================
    
    const server = app.listen(PORT, HOST, () => {
      logger.info(`✅ Servidor iniciado com sucesso!`, {
        port: PORT,
        host: HOST,
        environment: NODE_ENV,
        pid: process.pid,
        timestamp: new Date().toISOString(),
        urls: {
          local: `http://localhost:${PORT}`,
          network: `http://${HOST}:${PORT}`,
          health: `http://localhost:${PORT}/health`,
          metrics: `http://localhost:${PORT}/metrics`,
          apiDocs: NODE_ENV === 'development' ? `http://localhost:${PORT}/api-docs` : null
        }
      });
      
      // Log informações úteis para desenvolvimento
      if (NODE_ENV === 'development') {
        console.log('\n🔗 URLs Úteis:');
        console.log(`   Aplicação: http://localhost:${PORT}`);
        console.log(`   Health Check: http://localhost:${PORT}/health`);
        console.log(`   Métricas: http://localhost:${PORT}/metrics`);
        console.log(`   API Docs: http://localhost:${PORT}/api-docs`);
        console.log(`   Debug Config: http://localhost:${PORT}/debug/config`);
        console.log('\n📊 Monitoramento:');
        console.log(`   Logs: Consulte os arquivos em logs/`);
        console.log(`   Cache: ${process.env.REDIS_URL ? 'Redis conectado' : 'Redis desabilitado'}`);
        console.log(`   Scheduler: ${process.env.ENABLE_SCHEDULER === 'true' ? 'Ativo' : 'Inativo'}`);
        console.log('\n🔑 Autenticação:');
        console.log(`   JWT Secret: ${process.env.JWT_SECRET ? 'Configurado' : '❌ NÃO CONFIGURADO'}`);
        console.log(`   Refresh Secret: ${process.env.JWT_REFRESH_SECRET ? 'Configurado' : '❌ NÃO CONFIGURADO'}`);
        console.log('\n');
      }
    });

    // ==========================================
    // CONFIGURAÇÃO DE SHUTDOWN GRACIOSO
    // ==========================================
    
    setupGracefulShutdown(server);
    
    // ==========================================
    // TRATAMENTO DE ERROS DO SERVIDOR
    // ==========================================
    
    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        logger.error(`❌ Porta ${PORT} já está em uso`, {
          port: PORT,
          error: error.message
        });
        process.exit(1);
      } else {
        logger.error('Erro no servidor', { 
          error: error.message,
          code: error.code,
          stack: error.stack
        });
        process.exit(1);
      }
    });
    
    server.on('clientError', (error, socket) => {
      logger.warn('Erro de cliente', { 
        error: error.message,
        remoteAddress: socket.remoteAddress
      });
      socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
    });

    return server;

  } catch (error) {
    logger.error('❌ Falha ao iniciar servidor', {
      error: error.message,
      stack: error.stack
    });
    process.exit(1);
  }
};

// ==========================================
// VERIFICAÇÕES PRÉ-INICIALIZAÇÃO
// ==========================================

const validateEnvironment = () => {
  const required = [
    'JWT_SECRET',
    'JWT_REFRESH_SECRET',
    'DB_HOST',
    'DB_USER',
    'DB_PASSWORD',
    'DB_NAME'
  ];
  
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    logger.error('❌ Variáveis de ambiente obrigatórias não configuradas', {
      missing,
      total: missing.length
    });
    
    console.log('\n🔧 Configure as seguintes variáveis no arquivo .env:');
    missing.forEach(key => console.log(`   ${key}=`));
    console.log('\n');
    
    process.exit(1);
  }
  
  logger.info('✅ Variáveis de ambiente validadas');
};

// ==========================================
// INICIALIZAÇÃO
// ==========================================

if (require.main === module) {
  // Validar ambiente antes de iniciar
  validateEnvironment();
  
  // Iniciar servidor
  startServer().catch((error) => {
    logger.error('Erro fatal na inicialização', {
      error: error.message,
      stack: error.stack
    });
    process.exit(1);
  });
}

module.exports = { startServer, validateEnvironment };