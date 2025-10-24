#!/usr/bin/env node

/**
 * Script para reverter Migration 029 em todos os ambientes
 * Restaura nomes originais das colunas
 * 
 * Uso:
 *   node scripts/rollback-migration-029.js [ambiente]
 */

const { Pool } = require('pg');
const readline = require('readline');
const migration = require('../migrations/029_rename_reserved_columns');

// AWS SDK para carregar secrets
let SecretsManagerClient, GetSecretValueCommand;
try {
  const awsSdk = require('@aws-sdk/client-secrets-manager');
  SecretsManagerClient = awsSdk.SecretsManagerClient;
  GetSecretValueCommand = awsSdk.GetSecretValueCommand;
} catch (error) {
  console.log('⚠️  AWS SDK não disponível. Verifique a instalação.');
}

/**
 * Carrega credenciais do AWS Secrets Manager
 */
async function loadSecretsFromAWS(secretName) {
  if (!SecretsManagerClient) {
    throw new Error('AWS SDK não disponível. Execute: npm install @aws-sdk/client-secrets-manager');
  }

  try {
    const client = new SecretsManagerClient({ 
      region: 'sa-east-1',
      requestHandler: { requestTimeout: 3000 }
    });
    const command = new GetSecretValueCommand({ SecretId: secretName });
    const response = await client.send(command);

    if (response.SecretString) {
      const secrets = JSON.parse(response.SecretString);
      console.log(`🔐 Credenciais carregadas do Secrets Manager: ${secretName}`);
      return {
        host: secrets.host,
        port: secrets.port || 5432,
        database: secrets.dbname || secrets.database,
        user: secrets.username,
        password: secrets.password,
      };
    }
  } catch (error) {
    throw new Error(`Erro ao carregar secret ${secretName}: ${error.message}`);
  }
}

// Mapeamento de ambientes para secrets
const environmentsConfig = {
  dev: {
    secretName: 'dev-mysql',
    description: '🧪 Desenvolvimento'
  },
  sandbox: {
    secretName: 'sandbox-mysql',
    description: '🏗️ Sandbox/Homologação'
  },
  prod: {
    secretName: 'prd-mysql',
    description: '🚀 Produção'
  }
};

function createInterface() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
}

function question(query) {
  const rl = createInterface();
  return new Promise(resolve => {
    rl.question(query, answer => {
      rl.close();
      resolve(answer);
    });
  });
}

async function rollbackMigration(env) {
  // Carregar config do AWS Secrets Manager
  const envConfig = environmentsConfig[env];
  if (!envConfig) {
    console.error(`❌ Ambiente inválido: ${env}`);
    return false;
  }

  console.log(`\n⏳ Carregando configuração do ambiente ${env}...`);
  
  let config;
  try {
    config = await loadSecretsFromAWS(envConfig.secretName);
  } catch (error) {
    console.error(`❌ Erro ao carregar credenciais: ${error.message}`);
    return false;
  }
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🔄 Revertendo Migration 029 em: ${env.toUpperCase()}`);
  console.log(`   Host: ${config.host}`);
  console.log(`   Database: ${config.database}`);
  console.log(`${'='.repeat(60)}\n`);

  const pool = new Pool({
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.user,
    password: config.password,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 30000,
    idleTimeoutMillis: 30000,
    max: 5,
  });
  const client = await pool.connect();

  try {
    await migration.down(client);

    // Remover registro da migration
    try {
      await client.query(`
        DELETE FROM public.migrations 
        WHERE migration_name = '029_rename_reserved_columns'
      `);
    } catch (error) {
      console.log('   ⚠️  Não foi possível remover o registro da migration.');
    }

    console.log(`\n✅ Rollback concluído com sucesso em ${env.toUpperCase()}!\n`);
    return true;

  } catch (error) {
    console.error(`\n❌ Erro ao reverter migration em ${env.toUpperCase()}:`, error.message);
    return false;
  } finally {
    client.release();
    await pool.end();
  }
}

async function main() {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║          ROLLBACK Migration 029: Restaurar Colunas           ║
║                                                               ║
║  ⚠️  ATENÇÃO: Esta operação irá REVERTER as alterações       ║
║  da Migration 029, restaurando os nomes originais.           ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
  `);

  const args = process.argv.slice(2);
  const targetEnv = args[0] || 'dev';

  if (!['dev', 'sandbox', 'prod'].includes(targetEnv)) {
    console.error('❌ Ambiente inválido. Use: dev, sandbox ou prod');
    process.exit(1);
  }

  console.log(`⚠️  Você está prestes a REVERTER a Migration 029 em ${targetEnv.toUpperCase()}`);
  console.log('   Isso irá restaurar os nomes originais das colunas com palavras reservadas.');
  
  const confirm = await question('\n   Digite "REVERTER" para confirmar: ');
  
  if (confirm !== 'REVERTER') {
    console.log('\n❌ Operação cancelada.\n');
    process.exit(0);
  }

  const success = await rollbackMigration(targetEnv);

  if (success) {
    console.log('✅ Rollback executado com sucesso!');
    console.log('\n⚠️  IMPORTANTE: Não esqueça de reverter o código também!\n');
  }

  process.exit(success ? 0 : 1);
}

main().catch(error => {
  console.error('\n❌ Erro fatal:', error);
  process.exit(1);
});
