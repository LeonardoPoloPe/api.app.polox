#!/usr/bin/env node
/**
 * 🧪 Script de teste - Migrações usando AWS SSM
 * Testa se as credenciais do AWS Parameter Store estão funcionando
 */

const { getDatabaseConfig } = require('./load-secrets-from-ssm');
const { Pool } = require('pg');

async function testMigrationWithSSM(environment) {
  console.log(`\n🧪 Testando ambiente: ${environment.toUpperCase()}`);
  console.log('=' .repeat(50));
  
  try {
    // 1. Carregar config do SSM
    console.log('🔐 Carregando credenciais do AWS SSM...');
    const dbConfig = await getDatabaseConfig(environment);
    
    console.log(`✅ Credenciais carregadas:`);
    console.log(`   Host: ${dbConfig.host}`);
    console.log(`   Database: ${dbConfig.database}`);
    console.log(`   User: ${dbConfig.user}`);
    console.log(`   Password: ***hidden***`);
    
    // 2. Testar conectividade
    console.log('\n🔗 Testando conectividade...');
    const pool = new Pool(dbConfig);
    
    const client = await pool.connect();
    const result = await client.query('SELECT NOW() as now, current_database() as db, current_user as user');
    
    console.log(`✅ Conectividade OK:`);
    console.log(`   Timestamp: ${result.rows[0].now}`);
    console.log(`   Database: ${result.rows[0].db}`);
    console.log(`   User: ${result.rows[0].user}`);
    
    // 3. Verificar schema polox
    console.log('\n📊 Verificando schema polox...');
    const schemaResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'polox' 
      ORDER BY table_name
    `);
    
    console.log(`✅ Schema polox encontrado com ${schemaResult.rows.length} tabelas:`);
    schemaResult.rows.forEach((row, i) => {
      console.log(`   ${i + 1}. ${row.table_name}`);
    });
    
    // 4. Verificar tabela de migrations
    console.log('\n🔄 Verificando tabela de migrations...');
    const migrationsResult = await client.query(`
      SELECT name, executed_at 
      FROM migrations 
      ORDER BY executed_at ASC
    `);
    
    console.log(`✅ Migrations executadas (${migrationsResult.rows.length}):`);
    migrationsResult.rows.forEach((row, i) => {
      console.log(`   ${i + 1}. ${row.name} (${new Date(row.executed_at).toLocaleString()})`);
    });
    
    client.release();
    await pool.end();
    
    return {
      success: true,
      tablesCount: schemaResult.rows.length,
      migrationsCount: migrationsResult.rows.length
    };
    
  } catch (error) {
    console.error(`❌ Erro no ambiente ${environment}:`, error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

async function main() {
  console.log('🚀 TESTE DE MIGRAÇÕES COM AWS SSM');
  console.log('Verificando se as credenciais do Parameter Store funcionam\n');
  
  const environments = ['dev', 'sandbox', 'prod'];
  const results = {};
  
  for (const env of environments) {
    results[env] = await testMigrationWithSSM(env);
    
    if (results[env].success) {
      console.log(`\n✅ ${env.toUpperCase()}: SUCESSO`);
    } else {
      console.log(`\n❌ ${env.toUpperCase()}: FALHA - ${results[env].error}`);
    }
    
    // Pausa entre testes
    if (env !== 'prod') {
      console.log('\n⏳ Aguardando 2 segundos...\n');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  // Resumo final
  console.log('\n' + '='.repeat(60));
  console.log('📋 RESUMO DOS TESTES');
  console.log('='.repeat(60));
  
  let allSuccess = true;
  environments.forEach(env => {
    const result = results[env];
    const status = result.success ? '✅ OK' : '❌ ERRO';
    const details = result.success 
      ? `(${result.tablesCount} tabelas, ${result.migrationsCount} migrations)`
      : `(${result.error})`;
    
    console.log(`${env.toUpperCase().padEnd(8)} ${status} ${details}`);
    
    if (!result.success) {
      allSuccess = false;
    }
  });
  
  console.log('='.repeat(60));
  
  if (allSuccess) {
    console.log('🎉 TODOS OS AMBIENTES FUNCIONANDO COM AWS SSM!');
    console.log('✅ As credenciais foram migradas com sucesso');
    console.log('✅ Conectividade OK em todos os ambientes');
    console.log('✅ Schema polox presente e funcional');
  } else {
    console.log('⚠️  ALGUNS AMBIENTES FALHARAM');
    console.log('🔧 Verifique os erros acima e as credenciais no AWS SSM');
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  main().catch(error => {
    console.error('💥 Erro fatal:', error);
    process.exit(1);
  });
}

module.exports = { testMigrationWithSSM };