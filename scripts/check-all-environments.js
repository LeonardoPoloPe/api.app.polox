#!/usr/bin/env node

/**
 * Script para mostrar o status de migrations em TODOS os ambientes
 */

const { Pool } = require("pg");

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
  }

  return null;
}

// Configurações dos ambientes - APENAS Secrets Manager + env vars
const environmentsConfig = {
  dev: {
    secretName: "dev-mysql", // Secret no AWS Secrets Manager
    emoji: "🧪",
    description: "Desenvolvimento",
  },
  sandbox: {
    secretName: "sandbox-mysql", // Secret no AWS Secrets Manager
    emoji: "🏗️",
    description: "Sandbox",
  },
  prod: {
    secretName: "prd-mysql", // Secret no AWS Secrets Manager
    emoji: "🚀",
    description: "Produção",
  },
};

/**
 * Constrói a configuração do ambiente, priorizando AWS Secrets Manager
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
    emoji: config.emoji,
    description: config.description,
  };
}

// ✅ Configuração antiga removida - agora usa apenas environmentsConfig com Secrets Manager

async function getEnvironmentStatus(envName, config) {
  const pool = new Pool({
    host: config.DB_HOST,
    port: config.DB_PORT,
    database: config.DB_NAME,
    user: config.DB_USER,
    password: config.DB_PASSWORD,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 5000,
  });

  try {
    // Contar migrations executadas
    const migrationsResult = await pool.query(
      "SELECT COUNT(*) as count FROM migrations"
    );
    const migrationsCount = parseInt(migrationsResult.rows[0].count);

    // Contar tabelas
    const tablesResult = await pool.query(`
      SELECT COUNT(*) as count 
      FROM information_schema.tables 
      WHERE table_schema = 'polox'
    `);
    const tablesCount = parseInt(tablesResult.rows[0].count);

    // Últimas migrations
    const lastMigrationsResult = await pool.query(`
      SELECT migration_name FROM migrations 
      ORDER BY executed_at DESC 
      LIMIT 3
    `);
    const lastMigrations = lastMigrationsResult.rows.map((r) => r.migration_name);

    return {
      success: true,
      migrationsCount,
      tablesCount,
      lastMigrations,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  } finally {
    await pool.end();
  }
}

async function main() {
  console.log(
    "\n╔════════════════════════════════════════════════════════════╗"
  );
  console.log("║   📊 RELATÓRIO DE STATUS - MIGRATIONS - API POLOX          ║");
  console.log(
    "╚════════════════════════════════════════════════════════════╝\n"
  );
  console.log(`📅 Data/Hora: ${new Date().toLocaleString("pt-BR")}\n`);

  for (const envName of Object.keys(environmentsConfig)) {
    // Carrega configuração do ambiente de forma assíncrona
    console.log(`⏳ Carregando configuração para ${envName}...`);
    const config = await buildEnvironmentConfig(envName);
    if (!config) {
      console.log(`❌ Erro ao carregar configuração para ${envName}\n`);
      continue;
    }

    console.log(`${config.emoji} ${config.description.toUpperCase()}`);
    console.log("─".repeat(60));

    const status = await getEnvironmentStatus(envName, config);

    if (status.success) {
      console.log(`✅ Status: ONLINE`);
      console.log(`📊 Migrations executadas: ${status.migrationsCount}`);
      console.log(`🗄️  Tabelas no schema polox: ${status.tablesCount}`);
      console.log(`📝 Últimas 3 migrations:`);
      status.lastMigrations.forEach((m, i) => {
        console.log(`   ${i + 1}. ${m}`);
      });
    } else {
      console.log(`❌ Status: ERRO`);
      console.log(`⚠️  Erro: ${status.error}`);
    }

    console.log("");
  }

  console.log("═".repeat(60));
  console.log("✅ Relatório concluído!\n");
}

main().catch((error) => {
  console.error("❌ Erro ao gerar relatório:", error.message);
  process.exit(1);
});
