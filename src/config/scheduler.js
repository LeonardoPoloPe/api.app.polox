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
 * ⏰ SISTEMA DE AGENDAMENTO DE TAREFAS
 * ==========================================
 */

const cron = require('node-cron');
const { logger } = require('../utils/logger');
const { cache } = require('../config/cache');
const { trackBusiness } = require('../config/monitoring');

/**
 * Sistema de agendamento robusto com node-cron
 * Executa tarefas de manutenção, relatórios e limpeza
 */

class SchedulerManager {
  constructor() {
    this.tasks = new Map();
    this.isRunning = false;
  }

  /**
   * Registra uma nova tarefa agendada
   */
  addTask(name, schedule, task, options = {}) {
    try {
      const cronTask = cron.schedule(schedule, async () => {
        const startTime = Date.now();
        
        try {
          logger.info(`Executando tarefa agendada: ${name}`);
          await task();
          
          const duration = Date.now() - startTime;
          logger.info(`Tarefa concluída: ${name}`, { duration });
          
        } catch (error) {
          logger.error(`Erro na tarefa agendada: ${name}`, {
            error: error.message,
            stack: error.stack
          });
        }
      }, {
        scheduled: false,
        timezone: options.timezone || 'America/Sao_Paulo'
      });

      this.tasks.set(name, {
        task: cronTask,
        schedule,
        description: options.description || '',
        enabled: options.enabled !== false
      });

      logger.info(`Tarefa agendada registrada: ${name}`, { schedule });
      
      if (this.isRunning && options.enabled !== false) {
        cronTask.start();
      }

      return cronTask;
    } catch (error) {
      logger.error(`Erro ao registrar tarefa: ${name}`, { error: error.message });
      throw error;
    }
  }

  /**
   * Remove uma tarefa agendada
   */
  removeTask(name) {
    const taskInfo = this.tasks.get(name);
    if (taskInfo) {
      taskInfo.task.stop();
      taskInfo.task.destroy();
      this.tasks.delete(name);
      logger.info(`Tarefa removida: ${name}`);
      return true;
    }
    return false;
  }

  /**
   * Inicia todas as tarefas
   */
  start() {
    logger.info('Iniciando sistema de agendamento');
    
    this.tasks.forEach((taskInfo, name) => {
      if (taskInfo.enabled) {
        taskInfo.task.start();
        logger.info(`Tarefa iniciada: ${name}`);
      }
    });

    this.isRunning = true;
  }

  /**
   * Para todas as tarefas
   */
  stop() {
    logger.info('Parando sistema de agendamento');
    
    this.tasks.forEach((taskInfo, name) => {
      taskInfo.task.stop();
      logger.info(`Tarefa parada: ${name}`);
    });

    this.isRunning = false;
  }

  /**
   * Lista todas as tarefas
   */
  listTasks() {
    const taskList = [];
    this.tasks.forEach((taskInfo, name) => {
      taskList.push({
        name,
        schedule: taskInfo.schedule,
        description: taskInfo.description,
        enabled: taskInfo.enabled,
        running: taskInfo.task.getStatus() === 'scheduled'
      });
    });
    return taskList;
  }
}

// Instância singleton
const scheduler = new SchedulerManager();

// ==========================================
// TAREFAS PREDEFINIDAS
// ==========================================

/**
 * Limpeza de tokens expirados (executa a cada 6 horas)
 */
const cleanupExpiredTokens = async () => {
  const { query } = require('../models/database');
  
  try {
    const result = await query(`
      DELETE FROM user_sessions 
      WHERE expires_at < NOW()
    `);
    
    logger.info('Limpeza de tokens concluída', { 
      tokensRemovidos: result.rowCount 
    });
    
  } catch (error) {
    logger.error('Erro na limpeza de tokens', { error: error.message });
  }
};

/**
 * Backup incremental do cache (executa diariamente às 2h)
 */
const backupCache = async () => {
  try {
    const info = await cache.getInfo();
    if (info) {
      logger.info('Backup de cache iniciado', { memoryUsage: info.memory });
      
      // Aqui seria implementada a lógica de backup específica
      // Por exemplo, salvar dados críticos do cache no banco
      
      logger.info('Backup de cache concluído');
    }
  } catch (error) {
    logger.error('Erro no backup de cache', { error: error.message });
  }
};

/**
 * Relatório de métricas diárias (executa diariamente às 23h)
 */
const generateDailyReport = async () => {
  const { query } = require('../models/database');
  
  try {
    // Obter estatísticas do dia
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const [
      newUsers,
      newClients,
      newSales,
      totalSalesValue
    ] = await Promise.all([
      query(`
        SELECT COUNT(*) as count, company_id
        FROM users 
        WHERE created_at >= $1 
        GROUP BY company_id
      `, [today]),
      
      query(`
        SELECT COUNT(*) as count, company_id
        FROM polox.contacts 
        WHERE created_at >= $1 AND tipo = 'cliente'
        GROUP BY company_id
      `, [today]),
      
      query(`
        SELECT COUNT(*) as count, company_id
        FROM sales 
        WHERE created_at >= $1 
        GROUP BY company_id
      `, [today]),
      
      query(`
        SELECT SUM(value) as total, company_id
        FROM sales 
        WHERE created_at >= $1 AND stage = 'won'
        GROUP BY company_id
      `, [today])
    ]);

    // Atualizar métricas de negócio
    newUsers.rows.forEach(row => {
      trackBusiness.client.updateTotals(
        row.company_id, 
        'active', 
        'user', 
        parseInt(row.count)
      );
    });

    logger.info('Relatório diário gerado', {
      newUsers: newUsers.rowCount,
      newClients: newClients.rowCount,
      newSales: newSales.rowCount,
      totalSalesValue: totalSalesValue.rows.reduce((sum, row) => sum + (parseFloat(row.total) || 0), 0)
    });
    
  } catch (error) {
    logger.error('Erro na geração do relatório diário', { error: error.message });
  }
};

/**
 * Limpeza de logs antigos (executa semanalmente)
 */
const cleanupOldLogs = async () => {
  const { query } = require('../models/database');
  
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const result = await query(`
      DELETE FROM activity_logs 
      WHERE created_at < $1
    `, [thirtyDaysAgo]);
    
    logger.info('Limpeza de logs concluída', { 
      logsRemovidos: result.rowCount 
    });
    
  } catch (error) {
    logger.error('Erro na limpeza de logs', { error: error.message });
  }
};

/**
 * Otimização de banco de dados (executa semanalmente)
 */
const optimizeDatabase = async () => {
  const { query } = require('../models/database');
  
  try {
    // Executar VACUUM ANALYZE nas tabelas principais
    const tables = [
      'users', 'companies', 'clients', 'sales', 
      'products', 'activities', 'user_sessions'
    ];
    
    for (const table of tables) {
      await query(`VACUUM ANALYZE ${table}`);
      logger.debug(`VACUUM ANALYZE executado na tabela: ${table}`);
    }
    
    logger.info('Otimização de banco concluída', { 
      tabelas: tables.length 
    });
    
  } catch (error) {
    logger.error('Erro na otimização do banco', { error: error.message });
  }
};

/**
 * Verificação de saúde do sistema (executa a cada 5 minutos)
 */
const healthCheck = async () => {
  try {
    const { query } = require('../models/database');
    
    // Testar conexão com banco
    await query('SELECT 1');
    
    // Testar cache se disponível
    if (cache.isConnected) {
      await cache.set('health_check', Date.now(), 60);
    }
    
    logger.debug('Health check concluído');
    
  } catch (error) {
    logger.error('Falha no health check', { error: error.message });
  }
};

/**
 * Atualização de estatísticas em tempo real (executa a cada minuto)
 */
const updateRealTimeStats = async () => {
  try {
    const { query } = require('../models/database');
    
    // Atualizar contadores por empresa
    const stats = await query(`
      SELECT 
        company_id,
        COUNT(CASE WHEN created_at >= NOW() - INTERVAL '24 hours' THEN 1 END) as new_clients_24h,
        COUNT(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN 1 END) as new_clients_7d,
        COUNT(*) as total_clients
      FROM polox.contacts 
      WHERE deleted_at IS NULL AND tipo = 'cliente'
      GROUP BY company_id
    `);
    
    // Cachear estatísticas
    for (const stat of stats.rows) {
      await cache.set(
        `stats:company:${stat.company_id}`, 
        stat, 
        300, // 5 minutos
        stat.company_id
      );
    }
    
    logger.debug('Estatísticas em tempo real atualizadas', { 
      empresas: stats.rowCount 
    });
    
  } catch (error) {
    logger.error('Erro na atualização de estatísticas', { error: error.message });
  }
};

// ==========================================
// REGISTRO DAS TAREFAS
// ==========================================

/**
 * Registra todas as tarefas padrão
 */
const registerDefaultTasks = () => {
  // Limpeza de tokens - a cada 6 horas
  scheduler.addTask(
    'cleanup-expired-tokens',
    '0 */6 * * *',
    cleanupExpiredTokens,
    { description: 'Limpa tokens de sessão expirados' }
  );

  // Backup de cache - diariamente às 2h
  scheduler.addTask(
    'backup-cache',
    '0 2 * * *',
    backupCache,
    { description: 'Realiza backup incremental do cache' }
  );

  // Relatório diário - diariamente às 23h
  scheduler.addTask(
    'daily-report',
    '0 23 * * *',
    generateDailyReport,
    { description: 'Gera relatório de métricas diárias' }
  );

  // Limpeza de logs - domingos às 1h
  scheduler.addTask(
    'cleanup-old-logs',
    '0 1 * * 0',
    cleanupOldLogs,
    { description: 'Remove logs antigos (>30 dias)' }
  );

  // Otimização de banco - domingos às 3h
  scheduler.addTask(
    'optimize-database',
    '0 3 * * 0',
    optimizeDatabase,
    { description: 'Executa otimização das tabelas do banco' }
  );

  // Health check - a cada 5 minutos
  scheduler.addTask(
    'health-check',
    '*/5 * * * *',
    healthCheck,
    { description: 'Verifica saúde dos serviços' }
  );

  // Estatísticas em tempo real - a cada minuto
  scheduler.addTask(
    'update-stats',
    '* * * * *',
    updateRealTimeStats,
    { description: 'Atualiza estatísticas em tempo real' }
  );

  logger.info('Tarefas padrão registradas', { 
    total: scheduler.listTasks().length 
  });
};

/**
 * Inicializa o sistema de agendamento
 */
const initScheduler = () => {
  try {
    registerDefaultTasks();
    
    // Só inicia as tarefas em produção ou se explicitamente habilitado
    if (process.env.NODE_ENV === 'production' || process.env.ENABLE_SCHEDULER === 'true') {
      scheduler.start();
      logger.info('Sistema de agendamento iniciado');
    } else {
      logger.info('Sistema de agendamento registrado mas não iniciado (desenvolvimento)');
    }
    
  } catch (error) {
    logger.error('Erro ao inicializar sistema de agendamento', { 
      error: error.message 
    });
  }
};

/**
 * Encerra o sistema de agendamento
 */
const stopScheduler = () => {
  scheduler.stop();
  logger.info('Sistema de agendamento parado');
};

module.exports = {
  scheduler,
  initScheduler,
  stopScheduler,
  registerDefaultTasks,
  
  // Tarefas individuais para uso manual
  tasks: {
    cleanupExpiredTokens,
    backupCache,
    generateDailyReport,
    cleanupOldLogs,
    optimizeDatabase,
    healthCheck,
    updateRealTimeStats
  }
};