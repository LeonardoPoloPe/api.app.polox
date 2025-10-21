const { Pool } = require("pg");
const winston = require("winston");
const { getCurrentSSLConfig } = require("../config/ssl-config");

// Configuração do logger
const logger = winston.createLogger({
  level: "info",
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
    return 'polox-app-proxy.proxy-cd2em8e0a6ot.sa-east-1.rds.amazonaws.com';
  } else {
    // Usar conexão direta para dev, sandbox e outros ambientes
    return process.env.DB_HOST || 'database-1.cd2em8e0a6ot.sa-east-1.rds.amazonaws.com';
  }
};

// Configuração do banco de dados baseada nas variáveis de ambiente
const dbConfig = {
  host: getDbHost(),
  port: parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: getCurrentSSLConfig(), // ✅ Configuração SSL segura e flexível
  // Configurações de pool otimizadas para Lambda + VPC
  max: 3, // Reduzido para Lambda (máximo de conexões simultâneas)
  min: 0, // Sem conexões mínimas (Lambda é stateless)
  acquire: 60000, // Tempo máximo para obter conexão (aumentado para VPC)
  idle: 5000, // Tempo curto para idle (Lambda pode ser reciclada)
  evict: 1000, // Intervalo para verificar conexões expiradas
  connectionTimeoutMillis: 60000, // Aumentado para VPC
  idleTimeoutMillis: 10000, // Reduzido para Lambda
  statement_timeout: 45000, // Timeout para statements
  query_timeout: 45000, // Timeout para queries
};

// Pool de conexões
let pool = null;

/**
 * Inicializa o pool de conexões PostgreSQL
 * @returns {Pool} Instância do pool de conexões
 */
const initializePool = () => {
  if (!pool) {
    try {
      // Log do host sendo usado para debugging
      logger.info(`Configurando conexão PostgreSQL:`, {
        environment: process.env.NODE_ENV || 'development',
        host: dbConfig.host,
        database: dbConfig.database,
        usingProxy: process.env.NODE_ENV === 'prod'
      });

      pool = new Pool(dbConfig);

      // Event listeners para monitoramento
      pool.on("connect", () => {
        logger.info("Conectado ao PostgreSQL");
      });

      pool.on("error", (err) => {
        logger.error("Erro no pool PostgreSQL:", err);
      });

      // Teste de conexão
      pool.query("SELECT NOW()", (err, result) => {
        if (err) {
          logger.error("Erro ao testar conexão:", err);
        } else {
          logger.info(
            "Conexão PostgreSQL testada com sucesso:",
            result.rows[0]
          );
        }
      });
    } catch (error) {
      logger.error("Erro ao inicializar pool PostgreSQL:", error);
      throw error;
    }
  }

  return pool;
};

/**
 * Executa uma query no banco de dados
 * @param {string} text - Query SQL
 * @param {Array} params - Parâmetros da query
 * @returns {Promise} Resultado da query
 */
const query = async (text, params = []) => {
  const client = await getPool().connect();

  try {
    const start = Date.now();
    const result = await client.query(text, params);
    const duration = Date.now() - start;

    logger.info("Query executada:", {
      text: text.substring(0, 100),
      duration: `${duration}ms`,
      rows: result.rowCount,
    });

    return result;
  } catch (error) {
    logger.error("Erro na query:", {
      text: text.substring(0, 100),
      error: error.message,
      params: params,
    });
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Executa uma transação
 * @param {Function} callback - Função que executa as queries da transação
 * @returns {Promise} Resultado da transação
 */
const transaction = async (callback) => {
  const client = await getPool().connect();

  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");

    logger.info("Transação commitada com sucesso");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    logger.error("Transação cancelada:", error.message);
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Retorna o pool de conexões (singleton)
 * @returns {Pool} Pool de conexões
 */
const getPool = () => {
  if (!pool) {
    return initializePool();
  }
  return pool;
};

/**
 * Fecha todas as conexões do pool
 * @returns {Promise} Promise resolvida quando o pool for fechado
 */
const closePool = async () => {
  if (pool) {
    try {
      await pool.end();
      pool = null;
      logger.info("Pool PostgreSQL fechado");
    } catch (error) {
      logger.error("Erro ao fechar pool:", error);
      throw error;
    }
  }
};

/**
 * Verifica se a conexão está saudável
 * @returns {Promise<boolean>} True se a conexão estiver OK
 */
const healthCheck = async () => {
  try {
    const result = await query("SELECT 1 as health");
    return result.rows[0].health === 1;
  } catch (error) {
    logger.error("Health check falhou:", error);
    return false;
  }
};

module.exports = {
  initializePool,
  query,
  transaction,
  getPool,
  closePool,
  healthCheck,
  logger,
};
