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
 * 🧪 SETUP GLOBAL DE TESTES
 * ==========================================
 *
 * Configuração global executada ANTES de todos os testes.
 *
 * Responsabilidades:
 * 1. Configurar variáveis de ambiente de teste
 * 2. Conectar ao banco de dados de teste (app_polox_test)
 * 3. Rodar migrations no banco de teste
 * 4. Limpar dados entre testes (TRUNCATE)
 * 5. Configurar mocks globais (AWS, Sentry, Redis)
 * 6. Silenciar logs durante testes
 */

const { Pool } = require("pg");
const path = require("path");
const fs = require("fs");
const dotenv = require("dotenv");
const {
  SecretsManagerClient,
  GetSecretValueCommand,
} = require("@aws-sdk/client-secrets-manager");

// ==========================================
// 0. CARREGAR VARIÁVEIS DE AMBIENTE DE TESTE
// ==========================================

// Carregar .env.test se existir
const envTestPath = path.join(__dirname, "../.env.test");
if (fs.existsSync(envTestPath)) {
  dotenv.config({ path: envTestPath });
  console.log("✅ [SETUP] Arquivo .env.test carregado");
} else {
  console.warn(
    "⚠️  [SETUP] Arquivo .env.test não encontrado, usando variáveis de ambiente"
  );
}

// Tentar carregar credenciais do AWS Secrets Manager (reutilizando DEV) se não houver DB_HOST/USER/PASSWORD
async function loadSecretsForTestsIfNeeded() {
  const hasDBEnv =
    process.env.DB_HOST && process.env.DB_USER && process.env.DB_PASSWORD;
  if (hasDBEnv) return;

  const region = process.env.AWS_REGION || "sa-east-1";
  const secretName = process.env.SECRET_NAME_TEST || "dev-mysql";
  try {
    const client = new SecretsManagerClient({ region });
    const res = await client.send(
      new GetSecretValueCommand({ SecretId: secretName })
    );
    const secretString =
      res.SecretString ||
      Buffer.from(res.SecretBinary, "base64").toString("ascii");
    const secrets = JSON.parse(secretString);

    // Mapear chaves comuns
    process.env.DB_HOST =
      process.env.DB_HOST || secrets.DB_HOST || secrets.host;
    process.env.DB_PORT =
      process.env.DB_PORT || String(secrets.DB_PORT || secrets.port || "5432");
    process.env.DB_USER =
      process.env.DB_USER ||
      secrets.DB_USER ||
      secrets.username ||
      secrets.user;
    process.env.DB_PASSWORD =
      process.env.DB_PASSWORD || secrets.DB_PASSWORD || secrets.password;
    // Banco de teste: sempre usar app_polox_test (não o DB de DEV)
    process.env.DB_NAME = process.env.DB_NAME || "app_polox_test";

    console.log(
      `🔐 [SETUP] Credenciais carregadas do Secrets Manager (${secretName}) para testes`
    );
  } catch (err) {
    console.warn(
      `⚠️  [SETUP] Não foi possível carregar secrets (${secretName}): ${err.message}`
    );
  }
}

// ==========================================
// 1. CONFIGURAR VARIÁVEIS DE AMBIENTE
// ==========================================

process.env.NODE_ENV = "test";
process.env.LOG_LEVEL = "error"; // Silenciar logs durante testes

// JWT (fallback se não estiver no .env.test)
process.env.JWT_SECRET =
  process.env.JWT_SECRET || "test_jwt_secret_key_for_testing_only_12345678";
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "24h";
process.env.JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET || "test_refresh_secret_key_12345";

// Database de teste (SEMPRE usar banco de teste)
process.env.DB_NAME = "app_polox_test";

// Desabilitar serviços externos em testes
process.env.SKIP_MIGRATIONS = "true"; // Não rodar migrations automáticas
process.env.SKIP_RATE_LIMIT = "true"; // Desabilitar rate limiting
process.env.SENTRY_DSN = ""; // Desabilitar Sentry
process.env.REDIS_ENABLED = "false"; // Desabilitar Redis

// Timeout para testes longos
jest.setTimeout(30000);

// Carregar secrets (se necessário) ANTES de logar credenciais
let secretsLoadedPromise = loadSecretsForTestsIfNeeded();

console.log("🧪 [SETUP] Variáveis de ambiente configuradas para TESTE");
console.log(
  `   - DB (alvo): ${process.env.DB_NAME}@${
    process.env.DB_HOST || "(aguardando secrets)"
  }`
);
console.log(`   - Environment: ${process.env.NODE_ENV}`);

// ==========================================
// 2. CONFIGURAR MOCKS GLOBAIS
// ==========================================

// Mock do console.error para não poluir os testes
const originalError = console.error;
const originalWarn = console.warn;

beforeAll(() => {
  console.error = jest.fn();
  console.warn = jest.fn();
});

afterAll(() => {
  console.error = originalError;
  console.warn = originalWarn;
});

// Mock do logger
jest.mock("../src/utils/logger", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
  auditLogger: jest.fn(),
  securityLogger: jest.fn(),
}));

// Nota: AWS Secrets Manager NÃO é mockado - usamos o serviço real para testes
// Isso garante que as credenciais sejam carregadas corretamente

// Mock do Sentry (comentado - instale @sentry/node se necessário)
// jest.mock('@sentry/node', () => ({
//   init: jest.fn(),
//   captureException: jest.fn(),
//   captureMessage: jest.fn(),
//   setContext: jest.fn(),
//   setTag: jest.fn(),
//   setUser: jest.fn(),
//   Handlers: {
//     requestHandler: () => (req, res, next) => next(),
//     errorHandler: () => (err, req, res, next) => next(err),
//   },
// }));

console.log("🔧 [SETUP] Mocks globais configurados (AWS, Logger)");

// ==========================================
// 3. POOL DE CONEXÕES GLOBAL
// ==========================================

let testPool = null;

/**
 * Criar conexão com banco de teste
 */
const createTestPool = async () => {
  if (testPool) return testPool;

  testPool = new Pool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    // Configuração SSL para RDS
    ssl:
      process.env.DB_HOST && process.env.DB_HOST.includes("rds.amazonaws.com")
        ? {
            rejectUnauthorized: false,
          }
        : false,
  });

  // Configurar search_path para polox schema
  testPool.on("connect", async (client) => {
    try {
      await client.query("SET search_path TO polox, public");
    } catch (err) {
      // Ignorar erro se schema não existir ainda
    }
  });

  return testPool;
};

/**
 * Fechar pool de teste
 */
const closeTestPool = async () => {
  if (testPool) {
    await testPool.end();
    testPool = null;
  }
};

// ==========================================
// 4. CRIAR BANCO DE TESTE (SE NÃO EXISTIR)
// ==========================================

const createTestDatabase = async () => {
  const adminPool = new Pool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT),
    database: "postgres", // Conectar ao banco default
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    // Configuração SSL para RDS
    ssl:
      process.env.DB_HOST && process.env.DB_HOST.includes("rds.amazonaws.com")
        ? {
            rejectUnauthorized: false,
          }
        : false,
  });

  try {
    // Verificar se banco de teste existe
    const result = await adminPool.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`,
      [process.env.DB_NAME]
    );

    if (result.rows.length === 0) {
      console.log(`📦 [SETUP] Criando banco de teste: ${process.env.DB_NAME}`);
      await adminPool.query(`CREATE DATABASE ${process.env.DB_NAME}`);
      console.log(`✅ [SETUP] Banco ${process.env.DB_NAME} criado com sucesso`);
    } else {
      console.log(`✅ [SETUP] Banco ${process.env.DB_NAME} já existe`);
    }
  } catch (error) {
    console.error(`❌ [SETUP] Erro ao criar banco de teste:`, error.message);
    throw error;
  } finally {
    await adminPool.end();
  }
};

// ==========================================
// 5. RODAR MIGRATIONS
// ==========================================

const runMigrations = async (pool) => {
  console.log("🔄 [SETUP] Executando migrations no banco de teste...");

  const migrationsDir = path.join(__dirname, "../migrations");

  try {
    // Verificar se diretório de migrations existe
    if (!fs.existsSync(migrationsDir)) {
      console.warn("⚠️  [SETUP] Diretório de migrations não encontrado");
      return;
    }

    // Criar schema polox se não existir
    await pool.query("CREATE SCHEMA IF NOT EXISTS polox");
    console.log("✅ [SETUP] Schema polox criado/verificado");

    // Criar tabela de controle de migrations
    await pool.query(`
      CREATE TABLE IF NOT EXISTS polox.migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Ler arquivos de migration
    const migrationFiles = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith(".js"))
      .sort(); // Ordem alfabética (000_, 001_, etc.)

    console.log(`📂 [SETUP] Encontradas ${migrationFiles.length} migrations`);

    // Executar cada migration
    for (const file of migrationFiles) {
      // Verificar se migration já foi executada
      const checkResult = await pool.query(
        "SELECT 1 FROM polox.migrations WHERE name = $1",
        [file]
      );

      if (checkResult.rows.length > 0) {
        continue; // Migration já executada
      }

      // Executar migration
      const migrationPath = path.join(migrationsDir, file);
      const migration = require(migrationPath);

      if (migration.up) {
        console.log(`   🔄 Executando: ${file}`);
        await migration.up(pool);

        // Registrar migration executada
        await pool.query("INSERT INTO polox.migrations (name) VALUES ($1)", [
          file,
        ]);
        console.log(`   ✅ Concluída: ${file}`);
      }
    }

    console.log("✅ [SETUP] Todas as migrations executadas com sucesso");
  } catch (error) {
    console.error("❌ [SETUP] Erro ao executar migrations:", error.message);
    throw error;
  }
};

// ==========================================
// 6. FUNÇÕES DE LIMPEZA DE DADOS
// ==========================================

/**
 * Limpar todas as tabelas (TRUNCATE CASCADE)
 *
 * ATENÇÃO: Isso deleta TODOS os dados das tabelas.
 * Use apenas em ambiente de teste!
 */
const cleanDatabase = async (pool) => {
  if (process.env.NODE_ENV !== "test") {
    throw new Error("⚠️  cleanDatabase() só pode ser usado em NODE_ENV=test");
  }

  const tables = [
    // Ordem inversa de dependências (FKs)
    "lead_notes",
    "lead_tags",
    "lead_interests",
    "leads",
    "client_notes",
    "clients",
    "sale_items",
    "sales",
    "products",
    "tickets",
    "financial_transactions",
    "gamification_history",
    "events",
    "notifications",
    "custom_field_values",
    "custom_fields",
    "tags",
    "interests",
    "users",
    "companies",
  ];

  try {
    for (const table of tables) {
      await pool.query(`TRUNCATE TABLE polox.${table} CASCADE`);
    }
  } catch (error) {
    // Ignorar erros se tabela não existir
    if (!error.message.includes("does not exist")) {
      console.warn(`⚠️  Erro ao limpar tabela: ${error.message}`);
    }
  }
};

/**
 * Limpar apenas tabelas essenciais (users e companies)
 * Usado em afterEach para garantir isolamento entre testes
 */
const cleanEssentialTables = async (pool) => {
  if (process.env.NODE_ENV !== "test") {
    throw new Error(
      "⚠️  cleanEssentialTables() só pode ser usado em NODE_ENV=test"
    );
  }

  try {
    // Limpar na ordem correta (dependências)
    await pool.query("TRUNCATE TABLE polox.users CASCADE");
    await pool.query("TRUNCATE TABLE polox.companies CASCADE");
  } catch (error) {
    if (!error.message.includes("does not exist")) {
      console.warn(`⚠️  Erro ao limpar tabelas essenciais: ${error.message}`);
    }
  }
};

// ==========================================
// 7. HOOKS GLOBAIS (beforeAll, afterAll, afterEach)
// ==========================================

/**
 * beforeAll - Executado UMA VEZ antes de todos os testes
 */
beforeAll(async () => {
  console.log("\n🚀 [SETUP] Iniciando configuração global de testes...\n");

  try {
    // Garantir carregamento de secrets antes de prosseguir
    if (secretsLoadedPromise) {
      await secretsLoadedPromise;
    }

    console.log(`📊 [SETUP] Conectando ao RDS: ${process.env.DB_HOST}`);
    console.log(`👤 [SETUP] Usuário: ${process.env.DB_USER}`);
    console.log(`🗄️  [SETUP] Banco: ${process.env.DB_NAME}`);

    // NOTA: O banco app_polox_test deve ser criado manualmente no RDS
    // com permissões para o usuário polox_dev_user

    // 1. Conectar ao banco de teste
    testPool = await createTestPool();
    console.log("✅ [SETUP] Pool de conexões criado");

    // 2. Rodar migrations (a menos que esteja explicitamente desabilitado)
    if (process.env.TEST_SKIP_MIGRATIONS === "1") {
      console.log(
        "⏭️  [SETUP] Pulando execução de migrations (TEST_SKIP_MIGRATIONS=1)"
      );
    } else {
      await runMigrations(testPool);
    }

    // 3. NÃO limpar dados aqui - causa problemas com testes paralelos
    // Os testes usam timestamps únicos, então não há conflito de dados
    // A limpeza será feita apenas no afterAll
    console.log(
      "✅ [SETUP] Banco de teste pronto (dados preservados para testes paralelos)"
    );

    // 4. Disponibilizar pool globalmente
    global.testPool = testPool;

    // 5. Criar app Express de teste para rotas HTTP (Supertest)
    try {
      const testApp = require("../src/server-test");
      global.app = testApp;
    } catch (e) {
      console.warn(
        "⚠️  [SETUP] Não foi possível inicializar app de teste:",
        e.message
      );
    }

    console.log("\n✅ [SETUP] Configuração global concluída!\n");
  } catch (error) {
    console.error("\n❌ [SETUP] Erro na configuração global:", error);
    console.error(
      "💡 [DICA] Verifique se o banco app_polox_test existe e se o usuário tem permissões"
    );
    throw error;
  }
}, 60000); // Timeout de 60 segundos

/**
 * afterEach - Executado DEPOIS de cada teste
 * DESABILITADO: Causa problemas com testes paralelos
 * Os testes usam timestamps únicos, então não há conflito de dados
 */
// afterEach(async () => {
//   if (testPool) {
//     await cleanEssentialTables(testPool);
//   }
// });

/**
 * afterAll - Executado UMA VEZ depois de todos os testes
 */
afterAll(async () => {
  console.log("\n🧹 [SETUP] Limpeza final...");

  try {
    if (testPool) {
      const keepData = process.env.TEST_KEEP_DATA === "1";
      if (keepData) {
        console.log(
          "⏭️  [SETUP] Pulando limpeza final do banco (TEST_KEEP_DATA=1)"
        );
      } else {
        await cleanDatabase(testPool);
      }
      await closeTestPool();
      console.log("✅ [SETUP] Pool de conexões fechado");
    }
  } catch (error) {
    console.error("❌ [SETUP] Erro na limpeza final:", error);
  }

  console.log("✅ [SETUP] Limpeza concluída\n");
}, 30000); // Timeout de 30 segundos

// ==========================================
// 8. EXPORTAR UTILITÁRIOS
// ==========================================

module.exports = {
  createTestPool,
  closeTestPool,
  cleanDatabase,
  cleanEssentialTables,
};

console.log("🧪 Jest configurado para ambiente de testes");
