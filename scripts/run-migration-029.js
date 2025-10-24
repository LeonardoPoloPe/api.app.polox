#!/usr/bin/env node

/**
 * Script para executar Migration 029 em todos os ambientes
 * Renomeia colunas com palavras reservadas SQL
 * 
 * Uso:
 *   node scripts/run-migration-029.js [ambiente]
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
 * Valida configuração do ambiente
 */
function validateConfig(env, config) {
  const required = ['host', 'database', 'user', 'password'];
  const missing = required.filter(key => !config[key]);
  
  if (missing.length > 0) {
    console.error(`❌ Configuração incompleta para ${env}. Faltam: ${missing.join(', ')}`);
    console.error(`   Verifique o AWS Secrets Manager: ${environmentsConfig[env].secretName}`);
    return false;
  }
  
  return true;
}

/**
 * Executa migration em um ambiente específico
 */
async function runMigration(env) {
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
  
  if (!validateConfig(env, config)) {
    return false;
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`🚀 Executando Migration 029 em: ${env.toUpperCase()}`);
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
      WHERE migration_name = '029_rename_reserved_columns'
    `;
    
    try {
      const checkResult = await client.query(checkQuery);
      
      if (checkResult.rows.length > 0) {
        console.log('⚠️  Migration 029 já foi executada neste ambiente.');
        const answer = await question('   Deseja executar novamente? (s/N): ');
        
        if (answer.toLowerCase() !== 's' && answer.toLowerCase() !== 'sim') {
          console.log('   ⏭️  Pulando este ambiente.\n');
          return true;
        }
      }
    } catch (error) {
      // Tabela migrations pode não existir ainda ou coluna pode ter nome antigo
      console.log('   ℹ️  Primeira execução ou tabela migrations não encontrada.');
    }

    // Executar a migration
    await migration.up(client);

    // Registrar execução
    try {
      await client.query(`
        INSERT INTO public.migrations (migration_name, executed_at)
        VALUES ('029_rename_reserved_columns', NOW())
        ON CONFLICT (migration_name) DO UPDATE 
        SET executed_at = NOW()
      `);
    } catch (error) {
      console.log('   ⚠️  Não foi possível registrar a migration:', error.message);
    }

    console.log(`\n✅ Migration 029 concluída com sucesso em ${env.toUpperCase()}!\n`);
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
 * Cria backup antes de executar
 */
async function createBackup(env) {
  console.log(`📦 Recomendação: Criar backup do banco ${env.toUpperCase()} antes de continuar.`);
  console.log(`   Execute: pg_dump -h [host] -U [user] -d [database] > backup_${env}_${Date.now()}.sql\n`);
  
  const answer = await question('   Já fez o backup? (s/N): ');
  return answer.toLowerCase() === 's' || answer.toLowerCase() === 'sim';
}

/**
 * Função principal
 */
async function main() {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║        Migration 029: Renomear Colunas Reservadas SQL        ║
║                                                               ║
║  Esta migration renomeia colunas que usam palavras           ║
║  reservadas do SQL (name, type, role, action, domain, etc.)  ║
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
    console.log('⚠️  ATENÇÃO: Você está prestes a executar esta migration em PRODUÇÃO!');
    console.log('   Esta operação irá renomear várias colunas no banco de dados.');
    console.log('   Certifique-se de que:');
    console.log('   1. Você fez backup do banco de dados');
    console.log('   2. Você testou em DEV e SANDBOX');
    console.log('   3. A aplicação está em modo de manutenção (se necessário)');
    console.log('   4. Os models foram atualizados no código');
    
    const confirm = await question('\n   Digite "CONFIRMAR" para continuar: ');
    
    if (confirm !== 'CONFIRMAR') {
      console.log('\n❌ Operação cancelada.\n');
      process.exit(0);
    }
  }

  // Executar migrations
  const envs = targetEnv === 'all' ? ['dev', 'sandbox', 'prod'] : [targetEnv];
  const results = [];

  for (const env of envs) {
    // Pedir confirmação de backup (exceto para dev)
    if (env !== 'dev') {
      const hasBackup = await createBackup(env);
      if (!hasBackup) {
        console.log(`\n⏭️  Pulando ambiente ${env.toUpperCase()}.\n`);
        results.push({ env, success: false, skipped: true });
        continue;
      }
    }

    const success = await runMigration(env);
    results.push({ env, success, skipped: false });

    // Pausa entre ambientes
    if (envs.length > 1 && env !== envs[envs.length - 1]) {
      console.log('⏸️  Aguardando 3 segundos antes do próximo ambiente...\n');
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }

  // Resumo final
  console.log(`\n${'='.repeat(60)}`);
  console.log('📊 RESUMO DA EXECUÇÃO:');
  console.log(`${'='.repeat(60)}\n`);

  results.forEach(({ env, success, skipped }) => {
    const status = skipped ? '⏭️  Pulado' : success ? '✅ Sucesso' : '❌ Falhou';
    console.log(`   ${env.toUpperCase().padEnd(10)} - ${status}`);
  });

  const allSuccess = results.filter(r => !r.skipped).every(r => r.success);
  
  if (allSuccess && results.some(r => !r.skipped)) {
    console.log(`\n✅ Todas as migrations foram executadas com sucesso!`);
    console.log(`\n📋 PRÓXIMOS PASSOS:`);
    console.log(`   1. Verificar se a aplicação está funcionando corretamente`);
    console.log(`   2. Testar as principais funcionalidades`);
    console.log(`   3. Monitorar logs por erros relacionados a queries`);
    console.log(`   4. Se necessário, executar rollback: node scripts/rollback-migration-029.js\n`);
  } else {
    console.log(`\n⚠️  Algumas migrations falharam ou foram puladas.`);
    console.log(`   Verifique os logs acima para detalhes.\n`);
  }

  process.exit(allSuccess ? 0 : 1);
}

// Executar
main().catch(error => {
  console.error('\n❌ Erro fatal:', error);
  process.exit(1);
});
