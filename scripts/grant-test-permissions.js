/**
 * Script para conceder permissões no schema public
 * Uso: node scripts/grant-test-permissions.js
 * 
 * IMPORTANTE: Execute este script ANTES de rodar os testes
 */

const { Pool } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

// Carregar .env (assumindo que você tem as credenciais do postgres no .env)
dotenv.config();

async function grantPermissions() {
  // Usar credenciais do usuário postgres (master user)
  const pool = new Pool({
    host: process.env.DB_HOST || 'database-1.cd2em8e0a6ot.sa-east-1.rds.amazonaws.com',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: 'app_polox_test',
    user: 'postgres', // IMPORTANTE: Usar usuário master
    password: process.env.POSTGRES_PASSWORD, // Senha do usuário postgres
    ssl: {
      rejectUnauthorized: false
    },
  });

  try {
    console.log('🔐 Concedendo permissões ao polox_dev_user...');
    console.log(`📊 Host: ${pool.options.host}`);
    console.log(`🗄️  Banco: app_polox_test`);
    console.log(`👤 Usuário Master: postgres\n`);

    // Conceder permissões no schema public
    await pool.query('GRANT ALL PRIVILEGES ON SCHEMA public TO polox_dev_user');
    console.log('✅ Permissões no schema public concedidas');

    // Permissões em objetos existentes no public
    await pool.query('GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO polox_dev_user');
    console.log('✅ Permissões em tabelas do public concedidas');

    await pool.query('GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO polox_dev_user');
    console.log('✅ Permissões em sequences do public concedidas');

    await pool.query('GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO polox_dev_user');
    console.log('✅ Permissões em functions do public concedidas');

    // Permissões padrão para objetos futuros no public
    await pool.query('ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO polox_dev_user');
    console.log('✅ Permissões padrão para tabelas futuras concedidas');

    await pool.query('ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO polox_dev_user');
    console.log('✅ Permissões padrão para sequences futuras concedidas');

    await pool.query('ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO polox_dev_user');
    console.log('✅ Permissões padrão para functions futuras concedidas');

    // Verificar permissões
    const result = await pool.query(`
      SELECT nspname AS schema_name, nspacl AS permissions
      FROM pg_namespace
      WHERE nspname IN ('public', 'polox')
      ORDER BY nspname
    `);

    console.log('\n📋 Permissões atuais:');
    result.rows.forEach(row => {
      console.log(`   ${row.schema_name}: ${row.permissions || 'default'}`);
    });

    console.log('\n🎉 Permissões concedidas com sucesso!');
    console.log('💡 Agora você pode executar os testes: npm test\n');
  } catch (error) {
    console.error('\n❌ Erro ao conceder permissões:', error.message);
    
    if (error.message.includes('password authentication failed')) {
      console.error('\n💡 DICA: Configure a senha do usuário postgres:');
      console.error('   export POSTGRES_PASSWORD="sua_senha_postgres"');
      console.error('   ou adicione POSTGRES_PASSWORD no arquivo .env\n');
    }
    
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Verificar se a senha do postgres foi fornecida
if (!process.env.POSTGRES_PASSWORD) {
  console.error('❌ Erro: POSTGRES_PASSWORD não configurado');
  console.error('');
  console.error('Configure a senha do usuário postgres (master user):');
  console.error('  export POSTGRES_PASSWORD="sua_senha_postgres"');
  console.error('  ou adicione no arquivo .env:');
  console.error('  POSTGRES_PASSWORD=sua_senha_postgres');
  console.error('');
  console.error('Depois execute: node scripts/grant-test-permissions.js');
  process.exit(1);
}

grantPermissions();
