#!/usr/bin/env node

/**
 * Script para mostrar o status de migrations em TODOS os ambientes
 */

const { Pool } = require('pg');

const environments = {
  dev: {
    DB_HOST: 'database-1.cd2em8e0a6ot.sa-east-1.rds.amazonaws.com',
    DB_PORT: 5432,
    DB_NAME: 'app_polox_dev',
    DB_USER: 'polox_dev_user',
    DB_PASSWORD: 'SenhaSeguraDev123!',
    emoji: '🧪',
    description: 'Desenvolvimento'
  },
  sandbox: {
    DB_HOST: 'database-1.cd2em8e0a6ot.sa-east-1.rds.amazonaws.com',
    DB_PORT: 5432,
    DB_NAME: 'app_polox_sandbox',
    DB_USER: 'polox_sandbox_user', 
    DB_PASSWORD: 'PoloxHjdfhrhcvfBCSsgdo2x12',
    emoji: '🏗️',
    description: 'Sandbox'
  },
  prod: {
    DB_HOST: 'database-1.cd2em8e0a6ot.sa-east-1.rds.amazonaws.com',
    DB_PORT: 5432,
    DB_NAME: 'app_polox_prod',
    DB_USER: 'polox_prod_user',
    DB_PASSWORD: 'Hsagasdbghnsafdnjsgvdlknfg',
    emoji: '🚀',
    description: 'Produção'
  }
};

async function getEnvironmentStatus(envName, config) {
  const pool = new Pool({
    host: config.DB_HOST,
    port: config.DB_PORT,
    database: config.DB_NAME,
    user: config.DB_USER,
    password: config.DB_PASSWORD,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 5000
  });

  try {
    // Contar migrations executadas
    const migrationsResult = await pool.query('SELECT COUNT(*) as count FROM migrations');
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
      SELECT name FROM migrations 
      ORDER BY executed_at DESC 
      LIMIT 3
    `);
    const lastMigrations = lastMigrationsResult.rows.map(r => r.name);

    return {
      success: true,
      migrationsCount,
      tablesCount,
      lastMigrations
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  } finally {
    await pool.end();
  }
}

async function main() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║   📊 RELATÓRIO DE STATUS - MIGRATIONS - API POLOX          ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  console.log(`📅 Data/Hora: ${new Date().toLocaleString('pt-BR')}\n`);

  for (const [envName, config] of Object.entries(environments)) {
    console.log(`${config.emoji} ${config.description.toUpperCase()}`);
    console.log('─'.repeat(60));
    
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
    
    console.log('');
  }

  console.log('═'.repeat(60));
  console.log('✅ Relatório concluído!\n');
}

main().catch(error => {
  console.error('❌ Erro ao gerar relatório:', error.message);
  process.exit(1);
});
