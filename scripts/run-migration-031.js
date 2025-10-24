#!/usr/bin/env node

/**
 * Script para executar Migration 031 em todos os ambientes
 * Cria triggers para limpeza automática de custom_field_values
 * 
 * Uso:
 *   node scripts/run-migration-031.js [ambiente]
 * 
 * Ambientes disponíveis:
 *   - dev (padrão)
 *   - sandbox
 *   - prod
 *   - all (todos os ambientes em sequência)
 */

const { Pool } = require('pg');
const readline = require('readline');

// Importar a migration
const migration = require('../migrations/031_create_custom_field_values_cleanup_triggers');

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

/**
 * Cria interface para input do usuário
 */
function createInterface() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
}

/**
 * Pergunta ao usuário
 */
function question(query) {
  const rl = createInterface();
  return new Promise(resolve => {
    rl.question(query, answer => {
      rl.close();
      resolve(answer);
    });
  });
}

/**
 * Executa migration em um ambiente específico
 */
async function runMigration(env) {
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
  console.log(`🚀 Executando Migration 031 em: ${env.toUpperCase()}`);
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
    // Verificar se a migration já foi executada
    const checkQuery = `
      SELECT migration_name 
      FROM public.migrations 
      WHERE migration_name = '031_create_custom_field_values_cleanup_triggers'
    `;
    
    try {
      const checkResult = await client.query(checkQuery);
      
      if (checkResult.rows.length > 0) {
        console.log('⚠️  Migration 031 já foi executada neste ambiente.');
        const answer = await question('   Deseja executar novamente? (s/N): ');
        
        if (answer.toLowerCase() !== 's' && answer.toLowerCase() !== 'sim') {
          console.log('   ⏭️  Pulando este ambiente.\n');
          return true;
        }
      }
    } catch (error) {
      console.log('   ℹ️  Primeira execução da migration.');
    }

    // Executar a migration
    await migration.up(client);

    // Registrar execução
    try {
      await client.query(`
        INSERT INTO public.migrations (migration_name, executed_at)
        VALUES ('031_create_custom_field_values_cleanup_triggers', NOW())
        ON CONFLICT (migration_name) DO UPDATE 
        SET executed_at = NOW()
      `);
    } catch (error) {
      console.log('   ⚠️  Não foi possível registrar a migration.');
    }

    console.log(`\n✅ Migration 031 concluída com sucesso em ${env.toUpperCase()}!\n`);
    return true;

  } catch (error) {
    console.error(`\n❌ Erro ao executar migration em ${env.toUpperCase()}:`, error.message);
    console.error('   Stack:', error.stack);
    return false;
  } finally {
    client.release();
    await pool.end();
  }
}

/**
 * Função principal
 */
async function main() {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║   Migration 031: Triggers de Limpeza de Custom Field Values  ║
║                                                               ║
║  Esta migration cria triggers automáticos para deletar       ║
║  valores órfãos de custom_field_values quando uma entidade   ║
║  principal (client, lead, product, etc.) é deletada.         ║
║                                                               ║
║  Solução: Database Triggers (garantia no nível do banco)     ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
  `);

  const args = process.argv.slice(2);
  let targetEnv = args[0] || 'dev';

  if (!['dev', 'sandbox', 'prod', 'all'].includes(targetEnv)) {
    console.error('❌ Ambiente inválido. Use: dev, sandbox, prod ou all');
    process.exit(1);
  }

  // Confirmar execução em produção
  if (targetEnv === 'prod' || targetEnv === 'all') {
    console.log('⚠️  ATENÇÃO: Você está prestes a executar em PRODUÇÃO!');
    console.log('   Esta migration:');
    console.log('   1. Cria 1 função e 8 triggers no banco');
    console.log('   2. Limpa valores órfãos existentes');
    console.log('   3. É segura e reversível\n');
    
    const confirm = await question('   Digite "CONFIRMAR" para continuar: ');
    
    if (confirm !== 'CONFIRMAR') {
      console.log('\n❌ Operação cancelada.\n');
      process.exit(0);
    }
  }

  // Executar migrations
  const envs = targetEnv === 'all' ? ['dev', 'sandbox', 'prod'] : [targetEnv];
  const results = [];

  for (const env of envs) {
    const success = await runMigration(env);
    results.push({ env, success, skipped: false });

    if (!success && targetEnv === 'all') {
      console.log(`\n⚠️  Parando execução devido a erro em ${env.toUpperCase()}`);
      break;
    }
  }

  // Resumo final
  console.log(`\n${'='.repeat(60)}`);
  console.log('📊 RESUMO DA EXECUÇÃO:');
  console.log(`${'='.repeat(60)}\n`);

  results.forEach(({ env, success, skipped }) => {
    const status = skipped ? '⏭️  Pulado' : (success ? '✅ Sucesso' : '❌ Falhou');
    console.log(`   ${env.toUpperCase().padEnd(10)} - ${status}`);
  });

  const allSuccess = results.filter(r => !r.skipped).every(r => r.success);
  
  if (allSuccess && results.some(r => !r.skipped)) {
    console.log('\n✅ Migration 031 executada com sucesso!');
    console.log('\n📋 PRÓXIMOS PASSOS:');
    console.log('   1. Testar deletando um client/lead e verificar limpeza automática');
    console.log('   2. Atualizar CustomFieldValue.js (opcional - triggers funcionam automaticamente)');
    console.log('   3. Continuar com refatoração de models restantes');
  } else {
    console.log('\n⚠️  Algumas migrations falharam.');
    console.log('   Verifique os logs acima para detalhes.');
  }

  process.exit(allSuccess ? 0 : 1);
}

// Executar
main().catch(error => {
  console.error('\n❌ Erro fatal:', error);
  process.exit(1);
});
