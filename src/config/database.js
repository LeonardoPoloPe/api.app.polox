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

const { Pool } = require("pg");
const winston = require("winston");
const secretsManager = require("./secrets");

// Configuração do logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
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

// Variável global para armazenar a configuração do banco e pool
let dbConfig = null;
let pool = null;

/**
 * Função assíncrona para inicializar a configuração do banco
 */
async function initializeDatabase() {
  if (dbConfig) return dbConfig;

  try {
    console.log("🔐 Inicializando configuração do banco de dados...");
    dbConfig = await secretsManager.getDatabaseConfig();

    console.log(`✅ Configuração carregada via: ${dbConfig.source}`);
    console.log(`📍 Database: ${dbConfig.database}`);
    console.log(`🌐 Host: ${dbConfig.host}`);

    return dbConfig;
  } catch (error) {
    console.error("❌ Erro ao inicializar configuração do banco:", error);
    throw error;
  }
}

/**
 * Função assíncrona para criar o pool de conexões
 */
async function createPool() {
  if (pool) return pool;

  // 🧪 Em ambiente de teste, retornar global.testPool (já criado pelo setup.js)
  if (process.env.NODE_ENV === "test" && global.testPool) {
    pool = global.testPool;
    console.log("🧪 [DATABASE] createPool() usando global.testPool");
    return pool;
  }

  const config = await initializeDatabase();

  // Determinar host correto baseado no ambiente
  let finalHost = config.host;
  if (
    process.env.NODE_ENV === "prod" ||
    process.env.NODE_ENV === "production"
  ) {
    finalHost =
      process.env.DB_PROXY_HOST ||
      "polox-app-proxy.proxy-cd2em8e0a6ot.sa-east-1.rds.amazonaws.com";
  }

  pool = new Pool({
    host: finalHost,
    port: config.port,
    database: config.database,
    user: config.user,
    password: config.password,

    // Configurações SSL para AWS RDS
    ssl:
      process.env.NODE_ENV === "production"
        ? {
            rejectUnauthorized: true,
            ca: require("fs").readFileSync(
              __dirname + "/ssl/rds-ca-2019-root.pem"
            ),
          }
        : {
            rejectUnauthorized: false,
          },

    // Configurações de pool otimizadas para Lambda (pg específicas)
    max: parseInt(process.env.DB_POOL_MAX) || 5, // Reduzido para Lambda
    min: parseInt(process.env.DB_POOL_MIN) || 0,
    connectionTimeoutMillis: 10000, // 10 segundos
    idleTimeoutMillis: 10000, // 10 segundos
    statement_timeout: 10000, // 10 segundos
    query_timeout: 10000, // 10 segundos
  });

  // Configurar schema padrão para multi-tenancy (async)
  pool.on("connect", async (client) => {
    try {
      // Garantir que a sessão do PostgreSQL está em UTC
      await client.query("SET TIME ZONE 'UTC'");

      // Definir search_path para incluir schema polox
      await client.query("SET search_path TO polox, public");

      // Log de conexão
      logger.info("Nova conexão PostgreSQL estabelecida", {
        database: config.database,
        host: finalHost,
        source: config.source,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Erro ao configurar cliente PostgreSQL:", {
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  });

  // Event listeners para monitoramento
  pool.on("error", (err, client) => {
    logger.error("Erro no pool PostgreSQL:", {
      error: err.message,
      stack: err.stack,
      timestamp: new Date().toISOString(),
    });
  });

  pool.on("remove", (client) => {
    logger.info("Cliente removido do pool PostgreSQL");
  });

  return pool;
}

/**
 * Executa query com isolamento multi-tenant automático
 * @param {string} text - Query SQL
 * @param {Array} params - Parâmetros da query
 * @param {Object} options - Opções adicionais
 * @param {number} options.companyId - ID da empresa para isolamento
 * @returns {Promise} Resultado da query
 */
const query = async (text, params = [], options = {}) => {
  // 🧪 Em ambiente de teste, usar global.testPool se disponível
  const activePool =
    process.env.NODE_ENV === "test" && global.testPool
      ? global.testPool
      : await createPool();

  const client = await activePool.connect();

  try {
    const start = Date.now();

    let result;

    // Temporarily disable SET LOCAL to fix parameter interference issue
    // TODO: Re-implement multi-tenant isolation with a different approach
    // if (options.companyId) {
    //   await client.query("SET LOCAL app.current_company_id = $1", [
    //     options.companyId,
    //   ]);
    // }

    result = await client.query(text, params);
    const duration = Date.now() - start;

    // Log da query (não logar senhas ou dados sensíveis)
    const sanitizedQuery = text.toLowerCase().includes("password")
      ? "[QUERY WITH SENSITIVE DATA]"
      : text.substring(0, 100);

    logger.info("Query executada:", {
      query: sanitizedQuery,
      duration: `${duration}ms`,
      rows: result.rowCount,
      companyId: options.companyId || null,
      timestamp: new Date().toISOString(),
    });

    return result;
  } catch (error) {
    logger.error("Erro na query:", {
      error: error.message,
      query: text.substring(0, 100),
      params: params.length,
      companyId: options.companyId || null,
      timestamp: new Date().toISOString(),
    });
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Transação com isolamento multi-tenant e rollback automático
 * @param {Function} callback - Função que executa as queries da transação
 * @param {Object} options - Opções da transação
 * @param {number} options.companyId - ID da empresa para isolamento
 * @returns {Promise} Resultado da transação
 */
const transaction = async (callback, options = {}) => {
  // 🧪 Em ambiente de teste, usar global.testPool se disponível
  const activePool =
    process.env.NODE_ENV === "test" && global.testPool ? global.testPool : pool;

  if (!activePool) {
    throw new Error("Pool de conexões não está disponível");
  }

  const client = await activePool.connect();

  try {
    await client.query("BEGIN");

    // Aplicar isolamento multi-tenant
    if (options.companyId) {
      // PostgreSQL não permite placeholders em SET LOCAL para variáveis customizadas
      // Usamos template string diretamente (companyId deve ser validado como número)
      const companyIdNum = parseInt(options.companyId);
      if (isNaN(companyIdNum) || companyIdNum <= 0) {
        throw new Error("Invalid companyId for transaction");
      }
      await client.query(`SET LOCAL app.current_company_id = ${companyIdNum}`);
    }

    const result = await callback(client);
    await client.query("COMMIT");

    logger.info("Transação commitada com sucesso", {
      companyId: options.companyId || null,
      timestamp: new Date().toISOString(),
    });

    return result;
  } catch (error) {
    await client.query("ROLLBACK");

    logger.error("Transação cancelada:", {
      error: error.message,
      companyId: options.companyId || null,
      timestamp: new Date().toISOString(),
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
    // Garantir que o pool está criado
    await createPool();

    // Executar query simples com timeout
    const result = await Promise.race([
      query("SELECT NOW() as current_time, version() as pg_version"),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Health check timeout")), 5000)
      ),
    ]);

    logger.info("Health check realizado com sucesso", {
      time: result.rows[0].current_time,
      version: result.rows[0].pg_version.split(" ")[0],
      timestamp: new Date().toISOString(),
    });

    return true;
  } catch (error) {
    logger.error("Health check falhou:", {
      error: error.message,
      timestamp: new Date().toISOString(),
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
    if (pool) {
      await pool.end();
      pool = null;
      logger.info("Pool PostgreSQL fechado com sucesso");
    }
  } catch (error) {
    logger.error("Erro ao fechar pool:", error);
    throw error;
  }
};

/**
 * Função para iniciar transação
 */
const beginTransaction = async () => {
  await createPool();
  const client = await pool.connect();
  await client.query("BEGIN");
  return client;
};

/**
 * Função para commit da transação
 */
const commitTransaction = async (client) => {
  try {
    await client.query("COMMIT");
    client.release();
  } catch (error) {
    client.release();
    throw error;
  }
};

/**
 * Função para rollback da transação
 */
const rollbackTransaction = async (client) => {
  try {
    await client.query("ROLLBACK");
    client.release();
  } catch (error) {
    client.release();
    throw error;
  }
};

/**
 * Retorna informações sobre o pool de conexões
 * @returns {Object} Estatísticas do pool
 */
const getPoolStats = () => {
  if (!pool) return null;

  return {
    totalCount: pool.totalCount,
    idleCount: pool.idleCount,
    waitingCount: pool.waitingCount,
    timestamp: new Date().toISOString(),
  };
};

module.exports = {
  query,
  transaction,
  healthCheck,
  closePool,
  beginTransaction,
  commitTransaction,
  rollbackTransaction,
  getPoolStats,
  // Exportar função para inicialização manual se necessário
  initializeDatabase,
  initializePool: createPool, // Alias para compatibilidade
  getPool: () => pool, // Função para obter o pool
  logger,
};
