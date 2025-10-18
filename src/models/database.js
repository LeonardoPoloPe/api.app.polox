const { Pool } = require("pg");
const winston = require("winston");

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

// Configuração do banco de dados baseada nas variáveis de ambiente
const dbConfig = {
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: {
    rejectUnauthorized: false,
  },
  // Configurações de pool para Lambda
  max: 5, // Máximo de conexões
  min: 0, // Mínimo de conexões
  acquire: 30000, // Tempo máximo para obter conexão
  idle: 10000, // Tempo máximo que uma conexão pode ficar idle
  evict: 1000, // Intervalo para verificar conexões expiradas
  connectionTimeoutMillis: 30000,
  idleTimeoutMillis: 30000,
  statement_timeout: 30000,
  query_timeout: 30000,
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
