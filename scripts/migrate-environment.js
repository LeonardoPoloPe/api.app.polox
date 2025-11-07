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

#!/usr/bin/env node

/**
 * Script para executar migrações em diferentes ambientes
 * Uso: node scripts/migrate-environment.js [ambiente] [comando]
 *
 * Ambientes: dev, sandbox, prod
 * Comandos: status, migrate, rollback
 *
 * Exemplos:
 *   node scripts/migrate-environment.js sandbox status
 *   node scripts/migrate-environment.js sandbox migrate
 *   node scripts/migrate-environment.js prod status
 */

const { Pool } = require("pg");
const fs = require("fs");
const path = require("path");

// AWS SDK para carregar secrets
let SecretsManagerClient, GetSecretValueCommand;
try {
  const awsSdk = require("@aws-sdk/client-secrets-manager");
  SecretsManagerClient = awsSdk.SecretsManagerClient;
  GetSecretValueCommand = awsSdk.GetSecretValueCommand;
} catch (error) {
  console.log("ℹ️  AWS SDK não disponível. Usando credenciais locais.");
}

/**
 * Carrega credenciais do AWS Secrets Manager
 */
async function loadSecretsFromAWS(secretName) {
  if (!SecretsManagerClient) {
    return null;
  }

  try {
    const client = new SecretsManagerClient({ region: "sa-east-1" });
    const command = new GetSecretValueCommand({ SecretId: secretName });
    const response = await client.send(command);

    if (response.SecretString) {
      const secrets = JSON.parse(response.SecretString);
      console.log(
        `🔐 Credenciais carregadas do Secrets Manager: ${secretName}`
      );
      return {
        DB_HOST: secrets.host,
        DB_PORT: secrets.port,
        DB_NAME: secrets.dbname || secrets.database,
        DB_USER: secrets.username,
        DB_PASSWORD: secrets.password,
      };
    }
  } catch (error) {
    console.log(
      `⚠️  Não foi possível carregar secret ${secretName}: ${error.message}`
    );
    console.log("🔄 Usando credenciais de fallback...");
  }

  return null;
}

// Configurações dos ambientes - APENAS Secrets Manager + env vars
const environmentsConfig = {
  dev: {
    secretName: "dev-mysql", // Secret no AWS Secrets Manager
    description: "🧪 Desenvolvimento",
  },
  sandbox: {
    secretName: "sandbox-mysql", // Secret no AWS Secrets Manager
    description: "🏗️ Sandbox/Homologação",
  },
  prod: {
    secretName: "prd-mysql", // Secret no AWS Secrets Manager
    description: "🚀 Produção",
  },
};

/**
 * Constrói a configuração do ambiente, priorizando:
 * 1. Variáveis de ambiente
 * 2. AWS Secrets Manager
 * 3. Credenciais de fallback
 */
async function buildEnvironmentConfig(envName) {
  const config = environmentsConfig[envName];
  if (!config) return null;

  // Tenta carregar do Secrets Manager
  let secretsConfig = null;
  if (config.secretName) {
    secretsConfig = await loadSecretsFromAWS(config.secretName);
  }

  // Se não conseguiu carregar do Secrets Manager E não tem env vars, erro!
  if (!secretsConfig && !process.env.DB_PASSWORD) {
    throw new Error(`❌ FALHA AO CARREGAR CREDENCIAIS: 
    Para ${envName}, é obrigatório:
    1. AWS Secrets Manager: secret '${config.secretName}' na região sa-east-1 (RECOMENDADO), OU
    2. Variáveis de ambiente: DB_PASSWORD, DB_USER, etc.
    
    ✅ Secrets disponíveis na AWS: dev-mysql, sandbox-mysql, prd-mysql
    ⚠️  NUNCA MAIS harcode senhas no código!`);
  }

  // Prioridade: env vars > secrets
  return {
    DB_HOST: process.env.DB_HOST || secretsConfig.DB_HOST,
    DB_PORT: process.env.DB_PORT
      ? Number(process.env.DB_PORT)
      : secretsConfig.DB_PORT,
    DB_NAME: process.env.DB_NAME || secretsConfig.DB_NAME,
    DB_USER: process.env.DB_USER || secretsConfig.DB_USER,
    DB_PASSWORD: process.env.DB_PASSWORD || secretsConfig.DB_PASSWORD,
    description: config.description,
  };
}

class EnvironmentMigrationRunner {
  constructor(envConfig) {
    this.config = envConfig;
    this.pool = new Pool({
      host: envConfig.DB_HOST,
      port: envConfig.DB_PORT,
      database: envConfig.DB_NAME,
      user: envConfig.DB_USER,
      password: envConfig.DB_PASSWORD,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 30000,
      idleTimeoutMillis: 30000,
      max: 5,
    });
    this.migrationsDir = path.join(__dirname, "..", "migrations");
  }

  async createMigrationsTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        migration_name VARCHAR(255) UNIQUE NOT NULL,
        executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_migrations_name ON migrations(migration_name);
    `;
    await this.pool.query(query);
    console.log("✅ Tabela de migrations criada/verificada");
  }

  async getExecutedMigrations() {
    const result = await this.pool.query(
      "SELECT migration_name FROM migrations ORDER BY executed_at ASC"
    );
    return result.rows.map((row) => row.migration_name);
  }

  getMigrationFiles() {
    return fs
      .readdirSync(this.migrationsDir)
      .filter((file) => file.endsWith(".js") && file !== "migration-runner.js")
      .sort();
  }

  async executeMigration(migrationFile) {
    const migrationPath = path.join(this.migrationsDir, migrationFile);
    const migrationName = path.basename(migrationFile, ".js");

    delete require.cache[require.resolve(migrationPath)];
    const migration = require(migrationPath);

    console.log(`� Executando: ${migrationName}`);

    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await migration.up(client);
      await client.query(
        "INSERT INTO migrations (migration_name) VALUES ($1)",
        [migrationName]
      );
      await client.query("COMMIT");
      console.log(`✅ ${migrationName} executada com sucesso`);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async rollbackMigration(migrationFile) {
    const migrationPath = path.join(this.migrationsDir, migrationFile);
    const migrationName = path.basename(migrationFile, ".js");

    delete require.cache[require.resolve(migrationPath)];
    const migration = require(migrationPath);

    if (!migration.down) {
      throw new Error(`Migration ${migrationName} não possui método down()`);
    }

    console.log(`🔄 Revertendo: ${migrationName}`);

    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await migration.down(client);
      await client.query("DELETE FROM migrations WHERE migration_name = $1", [
        migrationName,
      ]);
      await client.query("COMMIT");
      console.log(`✅ ${migrationName} revertida com sucesso`);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async showStatus() {
    await this.createMigrationsTable();
    const executedMigrations = await this.getExecutedMigrations();
    const migrationFiles = this.getMigrationFiles();
    const fileNames = migrationFiles.map((f) => path.basename(f, ".js"));

    // Derivar pendentes e executadas-ausentes por nome
    const pendingNames = fileNames.filter(
      (name) => !executedMigrations.includes(name)
    );
    const executedButMissing = executedMigrations.filter(
      (name) => !fileNames.includes(name)
    );

    console.log("\n📊 STATUS DAS MIGRATIONS");
    console.log("========================\n");

    migrationFiles.forEach((file) => {
      const migrationName = path.basename(file, ".js");
      const isExecuted = executedMigrations.includes(migrationName);
      const status = isExecuted ? "✅ EXECUTADA" : "⏳ PENDENTE";
      console.log(`${status} - ${migrationName}`);
    });

    console.log(`\nTotal: ${migrationFiles.length} migrations`);
    console.log(`Executadas: ${executedMigrations.length}`);
    console.log(`Pendentes: ${pendingNames.length}`);

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
  }

  async runPendingMigrations() {
    await this.createMigrationsTable();
    const executedMigrations = await this.getExecutedMigrations();
    const migrationFiles = this.getMigrationFiles();
    const pendingMigrations = migrationFiles.filter(
      (file) => !executedMigrations.includes(path.basename(file, ".js"))
    );

    if (pendingMigrations.length === 0) {
      console.log("✅ Nenhuma migration pendente");
      return;
    }

    console.log(
      `🚀 Executando ${pendingMigrations.length} migration(s) pendente(s)\n`
    );

    for (const migrationFile of pendingMigrations) {
      await this.executeMigration(migrationFile);
    }

    console.log("\n🎉 Todas as migrations foram executadas com sucesso!");
  }

  async rollbackLastMigration() {
    await this.createMigrationsTable();
    const executedMigrations = await this.getExecutedMigrations();

    if (executedMigrations.length === 0) {
      console.log("ℹ️ Nenhuma migration para reverter");
      return;
    }

    const lastMigration = executedMigrations[executedMigrations.length - 1];
    const migrationFile = `${lastMigration}.js`;
    await this.rollbackMigration(migrationFile);
  }

  async close() {
    await this.pool.end();
  }
}

async function main() {
  const environment = process.argv[2] || "dev";
  const command = process.argv[3] || "status";

  // Verifica se o ambiente existe
  if (!environmentsConfig[environment]) {
    console.error(`❌ Ambiente '${environment}' não encontrado.`);
    console.log(
      `\nAmbientes disponíveis: ${Object.keys(environmentsConfig).join(", ")}`
    );
    console.log(
      `\nUso: node scripts/migrate-environment.js [ambiente] [comando]`
    );
    console.log(`Comandos: status, migrate, rollback\n`);
    process.exit(1);
  }

  // Carrega configuração do ambiente (async)
  console.log("⏳ Carregando configuração do ambiente...");
  const config = await buildEnvironmentConfig(environment);

  if (!config) {
    console.error(
      `❌ Não foi possível carregar configuração para '${environment}'`
    );
    process.exit(1);
  }

  console.log(`\n${config.description}`);
  console.log(`📍 Database: ${config.DB_NAME}`);
  console.log(`🌐 Host: ${config.DB_HOST}\n`);

  // Confirmação de segurança para produção
  if (environment === "prod" && command === "migrate") {
    console.log("⚠️  ATENÇÃO: MIGRAÇÕES EM PRODUÇÃO!\n");
    console.log("🔐 Certifique-se:");
    console.log("  ✓ Backup recente do banco");
    console.log("  ✓ Migrações testadas em sandbox");
    console.log("  ✓ Autorização para alterar produção\n");
    console.log("⏱️  Aguardando 5 segundos...\n");

    await new Promise((resolve) => setTimeout(resolve, 5000));
  }

  const runner = new EnvironmentMigrationRunner(config);

  try {
    switch (command) {
      case "status":
        await runner.showStatus();
        break;

      case "migrate":
        await runner.runPendingMigrations();
        break;

      case "rollback":
        if (environment === "prod") {
          console.error("❌ Rollback em produção não é permitido!");
          console.log(
            "💡 Crie uma migration corretiva ao invés de fazer rollback.\n"
          );
          process.exit(1);
        }
        await runner.rollbackLastMigration();
        break;

      default:
        console.error(`❌ Comando '${command}' não reconhecido`);
        console.log("Comandos disponíveis: status, migrate, rollback\n");
        process.exit(1);
    }
  } catch (error) {
    console.error("\n❌ Erro:", error.message);
    process.exit(1);
  } finally {
    await runner.close();
  }
}

main();
