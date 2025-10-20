const { Pool } = require('pg');
const winston = require('winston');

// Configuração do logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple(),
    }),
  ],
});

// Determina qual host usar baseado no ambiente
const getDbHost = () => {
  if (process.env.NODE_ENV === 'prod') {
    // Usar RDS Proxy em produção
    return process.env.DB_PROXY_HOST || 'polox-app-proxy.proxy-cd2em8e0a6ot.sa-east-1.rds.amazonaws.com';
  } else {
    // Usar conexão direta para dev, sandbox e outros ambientes
    return process.env.DB_HOST || 'database-1.cd2em8e0a6ot.sa-east-1.rds.amazonaws.com';
  }
};

// Configuração do pool PostgreSQL com suporte multi-tenant
const pool = new Pool({
  host: getDbHost(),
  port: parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'app_polox_dev',
  user: process.env.DB_USER || 'polox_dev_user',
  password: process.env.DB_PASSWORD,
  
  // Configurações SSL para AWS RDS
  ssl: process.env.NODE_ENV === 'production' ? {
    rejectUnauthorized: true,
    ca: require('fs').readFileSync(__dirname + '/ssl/rds-ca-2019-root.pem'),
  } : false,
  
  // Configurações de pool otimizadas para multi-tenant
  max: parseInt(process.env.DB_POOL_MAX) || 20,
  min: parseInt(process.env.DB_POOL_MIN) || 0,
  acquire: 30000,
  idle: 10000,
  evict: 1000,
  connectionTimeoutMillis: 30000,
  idleTimeoutMillis: 30000,
  statement_timeout: 30000,
  query_timeout: 30000,
});

// Configurar schema padrão para multi-tenancy
pool.on('connect', (client) => {
  // Definir search_path para incluir schema polox
  client.query('SET search_path TO polox, public');
  
  // Log de conexão
  logger.info('Nova conexão PostgreSQL estabelecida', {
    database: process.env.DB_NAME,
    host: getDbHost(),
    timestamp: new Date().toISOString()
  });
});

// Event listeners para monitoramento
pool.on('error', (err, client) => {
  logger.error('Erro no pool PostgreSQL:', {
    error: err.message,
    stack: err.stack,
    timestamp: new Date().toISOString()
  });
});

pool.on('remove', (client) => {
  logger.info('Cliente removido do pool PostgreSQL');
});

/**
 * Executa query com isolamento multi-tenant automático
 * @param {string} text - Query SQL
 * @param {Array} params - Parâmetros da query
 * @param {Object} options - Opções adicionais
 * @param {number} options.companyId - ID da empresa para isolamento
 * @returns {Promise} Resultado da query
 */
const query = async (text, params = [], options = {}) => {
  const client = await pool.connect();
  
  try {
    const start = Date.now();
    
    // Aplicar isolamento multi-tenant se companyId fornecido
    if (options.companyId) {
      await client.query('SET LOCAL app.current_company_id = $1', [options.companyId]);
    }
    
    const result = await client.query(text, params);
    const duration = Date.now() - start;

    // Log da query (não logar senhas ou dados sensíveis)
    const sanitizedQuery = text.toLowerCase().includes('password') ? 
      '[QUERY WITH SENSITIVE DATA]' : text.substring(0, 100);
      
    logger.info('Query executada:', {
      query: sanitizedQuery,
      duration: `${duration}ms`,
      rows: result.rowCount,
      companyId: options.companyId || null,
      timestamp: new Date().toISOString()
    });

    return result;
  } catch (error) {
    logger.error('Erro na query:', {
      error: error.message,
      query: text.substring(0, 100),
      params: params.length,
      companyId: options.companyId || null,
      timestamp: new Date().toISOString()
    });
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Executa transação com isolamento multi-tenant
 * @param {Function} callback - Função que executa as queries da transação
 * @param {Object} options - Opções da transação
 * @param {number} options.companyId - ID da empresa para isolamento
 * @returns {Promise} Resultado da transação
 */
const transaction = async (callback, options = {}) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    
    // Aplicar isolamento multi-tenant
    if (options.companyId) {
      await client.query('SET LOCAL app.current_company_id = $1', [options.companyId]);
    }
    
    const result = await callback(client);
    await client.query('COMMIT');

    logger.info('Transação commitada com sucesso', {
      companyId: options.companyId || null,
      timestamp: new Date().toISOString()
    });
    
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    
    logger.error('Transação cancelada:', {
      error: error.message,
      companyId: options.companyId || null,
      timestamp: new Date().toISOString()
    });
    
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Verifica se a conexão está saudável
 * @returns {Promise<boolean>} True se a conexão estiver OK
 */
const healthCheck = async () => {
  try {
    const result = await query('SELECT NOW() as current_time, version() as pg_version');
    
    logger.info('Health check realizado com sucesso', {
      time: result.rows[0].current_time,
      version: result.rows[0].pg_version.split(' ')[0],
      timestamp: new Date().toISOString()
    });
    
    return true;
  } catch (error) {
    logger.error('Health check falhou:', {
      error: error.message,
      timestamp: new Date().toISOString()
    });
    return false;
  }
};

/**
 * Fecha todas as conexões do pool
 * @returns {Promise} Promise resolvida quando o pool for fechado
 */
const closePool = async () => {
  try {
    await pool.end();
    logger.info('Pool PostgreSQL fechado com sucesso');
  } catch (error) {
    logger.error('Erro ao fechar pool:', error);
    throw error;
  }
};

/**
 * Retorna informações sobre o pool de conexões
 * @returns {Object} Estatísticas do pool
 */
const getPoolStats = () => {
  return {
    totalCount: pool.totalCount,
    idleCount: pool.idleCount,
    waitingCount: pool.waitingCount,
    timestamp: new Date().toISOString()
  };
};

module.exports = {
  pool,
  query,
  transaction,
  healthCheck,
  closePool,
  getPoolStats,
  logger
};