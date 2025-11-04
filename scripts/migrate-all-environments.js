#!/usr/bin/env node
/**
 * Script para executar migrations em todos os ambientes
 * DEV, SANDBOX, PROD e TEST
 */

const { Pool } = require('pg');
const { execSync } = require('child_process');
require('dotenv').config();

const environments = [
  {
    name: 'DEV',
    database: 'app_polox_dev',
    user: 'polox_dev_user',
    color: '\x1b[36m' // Cyan
  },
  {
    name: 'SANDBOX',
    database: 'app_polox_sandbox',
    user: 'polox_sandbox_user',
    color: '\x1b[33m' // Yellow
  },
  {
    name: 'TEST',
    database: 'app_polox_test',
    user: 'polox_test_user',
    color: '\x1b[35m' // Magenta
  },
  {
    name: 'PROD',
    database: 'app_polox_prod',
    user: 'polox_prod_user',
    color: '\x1b[31m' // Red
  }
];

const reset = '\x1b[0m';
const bold = '\x1b[1m';

async function checkMigrationStatus(env) {
  const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 5432,
    database: env.database,
    user: env.user,
    password: process.env.DB_PASSWORD,
    ssl: { rejectUnauthorized: false }
  });

  try {
    // Verificar se a migration 034 já foi executada
    const result = await pool.query(`
      SELECT migration_name, executed_at 
      FROM migrations 
      WHERE migration_name = '034_refactor_to_contatos_negociacoes'
    `);

    if (result.rows.length > 0) {
      return {
        executed: true,
        date: result.rows[0].executed_at
      };
    }

    return { executed: false };
  } catch (error) {
    if (error.code === '42P01') {
      // Tabela migrations não existe
      return { executed: false, needsSetup: true };
    }
    throw error;
  } finally {
    await pool.end();
  }
}

async function checkDataInEnvironment(env) {
  const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 5432,
    database: env.database,
    user: env.user,
    password: process.env.DB_PASSWORD,
    ssl: { rejectUnauthorized: false }
  });

  try {
    // Verificar se as tabelas antigas ainda existem
    const tablesCheck = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'polox' 
      AND table_name IN ('leads', 'clients')
      ORDER BY table_name
    `);

    if (tablesCheck.rows.length === 0) {
      return { hasOldTables: false, ready: true };
    }

    // Se existem, verificar se têm dados
    let totalRecords = 0;
    for (const table of tablesCheck.rows) {
      const count = await pool.query(`
        SELECT COUNT(*) as total FROM polox.${table.table_name} WHERE deleted_at IS NULL
      `);
      totalRecords += parseInt(count.rows[0].total);
    }

    return { 
      hasOldTables: true, 
      ready: true,
      totalRecords 
    };
  } catch (error) {
    return { hasOldTables: false, ready: false, error: error.message };
  } finally {
    await pool.end();
  }
}

async function runMigrationForEnvironment(env) {
  console.log(`\n${env.color}${bold}═══════════════════════════════════════════════════════════════════${reset}`);
  console.log(`${env.color}${bold}  AMBIENTE: ${env.name}${reset}`);
  console.log(`${env.color}${bold}═══════════════════════════════════════════════════════════════════${reset}\n`);

  // 1. Verificar status da migration
  console.log(`${env.color}🔍 Verificando status da migration 034...${reset}`);
  const status = await checkMigrationStatus(env);

  if (status.executed) {
    console.log(`${env.color}✅ Migration 034 JÁ FOI EXECUTADA em ${status.date}${reset}`);
    console.log(`${env.color}⏭️  Pulando ${env.name}...${reset}`);
    return { skipped: true, reason: 'already_executed' };
  }

  if (status.needsSetup) {
    console.log(`${env.color}⚠️  Tabela migrations não existe. Será criada automaticamente.${reset}`);
  }

  // 2. Verificar dados
  console.log(`${env.color}🔍 Verificando dados no ambiente...${reset}`);
  const dataCheck = await checkDataInEnvironment(env);

  if (!dataCheck.ready) {
    console.log(`${env.color}❌ Erro ao verificar dados: ${dataCheck.error}${reset}`);
    return { success: false, error: dataCheck.error };
  }

  if (dataCheck.hasOldTables) {
    console.log(`${env.color}📊 Tabelas antigas encontradas com ${dataCheck.totalRecords} registros${reset}`);
    if (dataCheck.totalRecords > 0) {
      console.log(`${env.color}⚠️  ATENÇÃO: Há ${dataCheck.totalRecords} registros que serão DELETADOS!${reset}`);
    }
  } else {
    console.log(`${env.color}✅ Estrutura limpa ou já migrada${reset}`);
  }

  // 3. Confirmação para PROD
  if (env.name === 'PROD') {
    console.log(`\n${env.color}${bold}⚠️  ⚠️  ⚠️  ATENÇÃO: AMBIENTE DE PRODUÇÃO! ⚠️  ⚠️  ⚠️${reset}`);
    console.log(`${env.color}Esta migration é DESTRUTIVA e irá deletar dados!${reset}`);
    console.log(`${env.color}Aguardando 10 segundos antes de prosseguir...${reset}`);
    
    // Countdown
    for (let i = 10; i > 0; i--) {
      process.stdout.write(`\r${env.color}${bold}⏳ ${i} segundos... (Ctrl+C para cancelar)${reset}`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    console.log('\n');
  }

  // 4. Executar migration
  console.log(`${env.color}🚀 Executando migration 034 em ${env.name}...${reset}\n`);

  try {
    const envVars = {
      ...process.env,
      DB_NAME: env.database,
      DB_USER: env.user,
      NODE_ENV: env.name.toLowerCase()
    };

    const output = execSync('npm run migrate', {
      env: envVars,
      stdio: 'pipe',
      encoding: 'utf-8'
    });

    console.log(output);
    console.log(`\n${env.color}${bold}✅ Migration 034 executada com SUCESSO em ${env.name}!${reset}`);
    return { success: true };

  } catch (error) {
    console.error(`\n${env.color}${bold}❌ ERRO ao executar migration em ${env.name}:${reset}`);
    console.error(error.stdout || error.message);
    return { success: false, error: error.message };
  }
}

async function main() {
  console.log(`${bold}
╔═══════════════════════════════════════════════════════════════════╗
║                                                                   ║
║   🚀  EXECUÇÃO DE MIGRATIONS EM TODOS OS AMBIENTES  🚀            ║
║                                                                   ║
║   Migration 034: Refatoração Contatos/Negociações                ║
║   Ambientes: DEV → SANDBOX → TEST → PROD                         ║
║                                                                   ║
╚═══════════════════════════════════════════════════════════════════╝
${reset}`);

  const results = {};

  for (const env of environments) {
    try {
      results[env.name] = await runMigrationForEnvironment(env);
    } catch (error) {
      console.error(`${env.color}❌ Erro fatal em ${env.name}:${reset}`, error.message);
      results[env.name] = { success: false, error: error.message };
      
      // Se falhar, perguntar se deseja continuar
      if (env.name !== 'PROD') {
        console.log(`\n${bold}❓ Deseja continuar para os próximos ambientes? (Pressione Ctrl+C para cancelar)${reset}`);
        await new Promise(resolve => setTimeout(resolve, 3000));
      } else {
        break; // Se falhar em PROD, para tudo
      }
    }
  }

  // Resumo final
  console.log(`\n${bold}
╔═══════════════════════════════════════════════════════════════════╗
║                                                                   ║
║   📊  RESUMO FINAL DA EXECUÇÃO                                    ║
║                                                                   ║
╚═══════════════════════════════════════════════════════════════════╝
${reset}`);

  for (const [envName, result] of Object.entries(results)) {
    const env = environments.find(e => e.name === envName);
    if (result.skipped) {
      console.log(`${env.color}⏭️  ${envName.padEnd(10)} → PULADO (${result.reason})${reset}`);
    } else if (result.success) {
      console.log(`${env.color}✅ ${envName.padEnd(10)} → SUCESSO${reset}`);
    } else {
      console.log(`${env.color}❌ ${envName.padEnd(10)} → FALHOU (${result.error})${reset}`);
    }
  }

  const successCount = Object.values(results).filter(r => r.success).length;
  const total = Object.keys(results).length;

  console.log(`\n${bold}📈 Total: ${successCount}/${total} ambientes migrados com sucesso${reset}\n`);

  if (successCount === total) {
    console.log(`${bold}\x1b[32m🎉 TODAS AS MIGRATIONS FORAM EXECUTADAS COM SUCESSO! 🎉${reset}\n`);
  } else {
    console.log(`${bold}\x1b[33m⚠️  Alguns ambientes falharam ou foram pulados. Revise os logs acima.${reset}\n`);
  }
}

main().catch(console.error);
