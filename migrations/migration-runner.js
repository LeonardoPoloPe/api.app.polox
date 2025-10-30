const { Pool } = require("pg");
const fs = require("fs");
const path = require("path");
const winston = require("winston");

// Carregar variáveis de ambiente
require("dotenv").config();

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

const MIGRATIONS_SCHEMA = process.env.MIGRATIONS_SCHEMA || "public";

// Configuração do banco de dados (construída em runtime)
function buildDbConfigFromEnv() {
  return {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: {
      rejectUnauthorized: false,
    },
    connectionTimeoutMillis: 30000,
    idleTimeoutMillis: 30000,
    max: 5,
  };
}

class MigrationRunner {
  constructor() {
    // Lê as variáveis de ambiente no momento da construção para suportar carregamento tardio (ex.: AWS Secrets)
    this.pool = new Pool(buildDbConfigFromEnv());
    this.migrationsDir = __dirname;
    this.migrationColumn = null; // será resolvido em runtime: 'migration_name' ou 'name'
  }

  /**
   * Cria a tabela de controle de migrations se não existir
   */
  async createMigrationsTable() {
    const query = `
      -- 1) Garantir existência da tabela com a coluna correta (migration_name)
      CREATE TABLE IF NOT EXISTS ${MIGRATIONS_SCHEMA}.migrations (
        id SERIAL PRIMARY KEY,
        migration_name VARCHAR(255) UNIQUE NOT NULL,
        executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      -- 2) Corrigir tabelas antigas que ainda usam coluna 'name'
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = '${MIGRATIONS_SCHEMA}' AND table_name = 'migrations' AND column_name = 'name'
        ) AND NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = '${MIGRATIONS_SCHEMA}' AND table_name = 'migrations' AND column_name = 'migration_name'
        ) THEN
          ALTER TABLE ${MIGRATIONS_SCHEMA}.migrations RENAME COLUMN name TO migration_name;
        END IF;
      END$$;

      -- 3) Garantir índice na coluna correta
      CREATE INDEX IF NOT EXISTS idx_migrations_name ON ${MIGRATIONS_SCHEMA}.migrations(migration_name);
    `;

    try {
      await this.pool.query(query);
      logger.info("Tabela de migrations criada/verificada com sucesso");
    } catch (error) {
      logger.error("Erro ao criar tabela de migrations:", error);
      throw error;
    }
  }

  /**
   * Obtém lista de migrations executadas
   */
  async getExecutedMigrations() {
    const client = await this.pool.connect();
    try {
      // Descobrir coluna correta em runtime (migration_name vs name)
      const col = await this.resolveMigrationColumn(client);
      const result = await client.query(
        `SELECT ${col} AS migration_name
         FROM ${MIGRATIONS_SCHEMA}.migrations
         ORDER BY executed_at ASC`
      );
      return result.rows.map((row) => row.migration_name);
    } catch (error) {
      logger.error("Erro ao buscar migrations executadas:", error);
      throw error;
    } finally {
      client.release();
    }
  }

  async resolveMigrationColumn(client) {
    if (this.migrationColumn) return this.migrationColumn;
    const q = `SELECT column_name FROM information_schema.columns
               WHERE table_schema = $1 AND table_name = 'migrations' AND column_name IN ('migration_name','name')`;
    const res = await client.query(q, [MIGRATIONS_SCHEMA]);
    const names = res.rows.map((r) => r.column_name);
    this.migrationColumn = names.includes("migration_name")
      ? "migration_name"
      : "name";
    return this.migrationColumn;
  }

  /**
   * Obtém lista de arquivos de migration disponíveis
   */
  getMigrationFiles() {
    try {
      const files = fs
        .readdirSync(this.migrationsDir)
        .filter(
          (file) => file.endsWith(".js") && file !== "migration-runner.js"
        )
        .sort();

      return files;
    } catch (error) {
      logger.error("Erro ao ler arquivos de migration:", error);
      throw error;
    }
  }

  /**
   * Executa uma migration específica
   */
  async executeMigration(migrationFile) {
    const migrationPath = path.join(this.migrationsDir, migrationFile);
    const migrationName = path.basename(migrationFile, ".js");

    try {
      // Importa o arquivo de migration
      delete require.cache[require.resolve(migrationPath)];
      const migration = require(migrationPath);

      logger.info(`Executando migration: ${migrationName}`);

      // Executa a migration dentro de uma transação
      const client = await this.pool.connect();

      try {
        await client.query("BEGIN");

        // Executa o método up da migration
        await migration.up(client);

        // Registra a migration como executada
        const col = await this.resolveMigrationColumn(client);
        await client.query(
          `INSERT INTO ${MIGRATIONS_SCHEMA}.migrations (${col}) VALUES ($1)`,
          [migrationName]
        );

        await client.query("COMMIT");
        logger.info(`Migration ${migrationName} executada com sucesso`);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      logger.error(`Erro ao executar migration ${migrationName}:`, error);
      throw error;
    }
  }

  /**
   * Reverte uma migration específica
   */
  async rollbackMigration(migrationFile) {
    const migrationPath = path.join(this.migrationsDir, migrationFile);
    const migrationName = path.basename(migrationFile, ".js");

    try {
      // Importa o arquivo de migration
      delete require.cache[require.resolve(migrationPath)];
      const migration = require(migrationPath);

      if (!migration.down) {
        throw new Error(
          `Migration ${migrationName} não possui método down() para rollback`
        );
      }

      logger.info(`Revertendo migration: ${migrationName}`);

      // Executa o rollback dentro de uma transação
      const client = await this.pool.connect();

      try {
        await client.query("BEGIN");

        // Executa o método down da migration
        await migration.down(client);

        // Remove o registro da migration
        const col = await this.resolveMigrationColumn(client);
        await client.query(
          `DELETE FROM ${MIGRATIONS_SCHEMA}.migrations WHERE ${col} = $1`,
          [migrationName]
        );

        await client.query("COMMIT");
        logger.info(`Migration ${migrationName} revertida com sucesso`);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      logger.error(`Erro ao reverter migration ${migrationName}:`, error);
      throw error;
    }
  }

  /**
   * Executa todas as migrations pendentes
   */
  async runPendingMigrations() {
    try {
      await this.createMigrationsTable();

      const executedMigrations = await this.getExecutedMigrations();
      const migrationFiles = this.getMigrationFiles();

      const pendingMigrations = migrationFiles.filter(
        (file) => !executedMigrations.includes(path.basename(file, ".js"))
      );

      if (pendingMigrations.length === 0) {
        logger.info("Nenhuma migration pendente encontrada");
        return;
      }

      logger.info(
        `Executando ${pendingMigrations.length} migration(s) pendente(s)`
      );

      for (const migrationFile of pendingMigrations) {
        await this.executeMigration(migrationFile);
      }

      logger.info("Todas as migrations foram executadas com sucesso");
    } catch (error) {
      logger.error("Erro ao executar migrations:", error);
      throw error;
    }
  }

  /**
   * Reverte a última migration executada
   */
  async rollbackLastMigration() {
    try {
      await this.createMigrationsTable();

      const executedMigrations = await this.getExecutedMigrations();

      if (executedMigrations.length === 0) {
        logger.info("Nenhuma migration para reverter");
        return;
      }

      const lastMigration = executedMigrations[executedMigrations.length - 1];
      const migrationFile = `${lastMigration}.js`;

      await this.rollbackMigration(migrationFile);
    } catch (error) {
      logger.error("Erro ao reverter migration:", error);
      throw error;
    }
  }

  /**
   * Mostra o status das migrations
   */
  async showStatus() {
    try {
      await this.createMigrationsTable();

      const executedMigrations = await this.getExecutedMigrations();
      const migrationFiles = this.getMigrationFiles();
      const fileNames = migrationFiles.map((file) =>
        path.basename(file, ".js")
      );

      // Calcular pendentes com base em nomes, não apenas em contagem
      const pendingMigrations = fileNames.filter(
        (name) => !executedMigrations.includes(name)
      );
      // Detectar migrations executadas que não existem mais no diretório (ex.: removidas/renomeadas)
      const executedButMissing = executedMigrations.filter(
        (name) => !fileNames.includes(name)
      );

      console.log("\n📊 STATUS DAS MIGRATIONS");
      console.log("========================\n");

      if (migrationFiles.length === 0) {
        console.log("Nenhum arquivo de migration encontrado.\n");
        return;
      }

      migrationFiles.forEach((file) => {
        const migrationName = path.basename(file, ".js");
        const isExecuted = executedMigrations.includes(migrationName);
        const status = isExecuted ? "✅ EXECUTADA" : "⏳ PENDENTE";

        console.log(`${status} - ${migrationName}`);
      });

      // Resumo com contagens consistentes
      console.log(`\nTotal: ${migrationFiles.length} migrations`);
      console.log(`Executadas: ${executedMigrations.length}`);
      console.log(`Pendentes: ${pendingMigrations.length}`);

      if (executedButMissing.length > 0) {
        console.log(
          "\n⚠️  Observação: Existem migrations marcadas como executadas que não existem no diretório atual:"
        );
        executedButMissing.forEach((name) => console.log(`   - ${name}`));
        console.log(
          "   Isso pode ocorrer quando um arquivo foi renomeado ou removido após execução.\n"
        );
      } else {
        console.log("");
      }
    } catch (error) {
      logger.error("Erro ao verificar status:", error);
      throw error;
    }
  }

  /**
   * Fecha o pool de conexões
   */
  async close() {
    await this.pool.end();
  }
}

// CLI Interface
async function main() {
  const command = process.argv[2];
  const runner = new MigrationRunner();

  try {
    switch (command) {
      case "up":
        await runner.runPendingMigrations();
        break;

      case "down":
        await runner.rollbackLastMigration();
        break;

      case "status":
        await runner.showStatus();
        break;

      default:
        console.log(`
🚀 MIGRATION RUNNER - API Polox

Comandos disponíveis:
  
  npm run migrate           - Executa migrations pendentes
  npm run migrate:rollback  - Reverte última migration
  npm run migrate:status    - Mostra status das migrations

Ou diretamente:
  node migrations/migration-runner.js up
  node migrations/migration-runner.js down  
  node migrations/migration-runner.js status
        `);
    }
  } catch (error) {
    logger.error("Erro:", error);
    process.exit(1);
  } finally {
    await runner.close();
  }
}

// Executa apenas se chamado diretamente
if (require.main === module) {
  main();
}

module.exports = MigrationRunner;
