#!/usr/bin/env node

/**
 * 🔍 Testar conexões com os bancos de dados
 * 
 * Testa a conectividade com os bancos DEV, SANDBOX e PROD
 */

const { Pool } = require('pg');

const environments = {
  dev: {
    host: 'database-1.cd2em8e0a6ot.sa-east-1.rds.amazonaws.com',
    port: 5432,
    database: 'app_polox_dev',
    user: 'polox_dev_user',
    password: 'SenhaSeguraDev123!'
  },
  sandbox: {
    host: 'database-1.cd2em8e0a6ot.sa-east-1.rds.amazonaws.com',
    port: 5432,
    database: 'app_polox_sandbox',
    user: 'polox_sandbox_user',
    password: 'PoloxHjdfhrhcvfBCSsgdo2x12'
  }
};

async function testConnection(envName, config) {
  console.log(`\n🔍 Testando ${envName.toUpperCase()}...`);
  console.log(`   Host: ${config.host}`);
  console.log(`   Database: ${config.database}`);
  console.log(`   User: ${config.user}`);
  
  const pool = new Pool({
    ...config,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 5000
  });
  
  try {
    const client = await pool.connect();
    
    // Testar query simples
    const result = await client.query('SELECT NOW() as current_time, current_database() as db_name');
    
    // Contar usuários
    const usersCount = await client.query('SELECT COUNT(*) as total FROM polox.users');
    
    // Contar empresas
    const companiesCount = await client.query('SELECT COUNT(*) as total FROM polox.companies');
    
    console.log(`   ✅ Conexão bem-sucedida!`);
    console.log(`   📊 Banco: ${result.rows[0].db_name}`);
    console.log(`   ⏰ Hora: ${result.rows[0].current_time}`);
    console.log(`   👥 Usuários: ${usersCount.rows[0].total}`);
    console.log(`   🏢 Empresas: ${companiesCount.rows[0].total}`);
    
    client.release();
    await pool.end();
    
    return true;
  } catch (error) {
    console.log(`   ❌ Erro: ${error.message}`);
    await pool.end();
    return false;
  }
}

async function main() {
  console.log('🚀 Testando conexões com os bancos de dados...\n');
  console.log('=' .repeat(60));
  
  const results = {};
  
  for (const [envName, config] of Object.entries(environments)) {
    results[envName] = await testConnection(envName, config);
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('\n📊 RESUMO:');
  
  for (const [envName, success] of Object.entries(results)) {
    console.log(`   ${success ? '✅' : '❌'} ${envName.toUpperCase()}: ${success ? 'OK' : 'FALHOU'}`);
  }
  
  const allSuccess = Object.values(results).every(r => r);
  
  if (allSuccess) {
    console.log('\n✨ Todos os ambientes estão conectando corretamente!');
    process.exit(0);
  } else {
    console.log('\n⚠️  Alguns ambientes falharam na conexão.');
    process.exit(1);
  }
}

main().catch(error => {
  console.error('\n💥 Erro fatal:', error);
  process.exit(1);
});
