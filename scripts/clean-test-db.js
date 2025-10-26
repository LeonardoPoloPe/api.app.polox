/**
 * Script para limpar o banco de teste
 * Uso: node scripts/clean-test-db.js
 */

const { Pool } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

// Carregar .env.test
dotenv.config({ path: path.join(__dirname, '../.env.test') });

async function cleanTestDatabase() {
  const pool = new Pool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: process.env.DB_HOST && process.env.DB_HOST.includes('rds.amazonaws.com') ? {
      rejectUnauthorized: false
    } : false,
  });

  try {
    console.log('🧹 Limpando banco de teste...');
    console.log(`📊 Host: ${process.env.DB_HOST}`);
    console.log(`🗄️  Banco: ${process.env.DB_NAME}`);

    // Remover schema polox (cascade remove todas as tabelas)
    await pool.query('DROP SCHEMA IF EXISTS polox CASCADE');
    console.log('✅ Schema polox removido');

    // Remover tabela de migrations se existir no schema public
    await pool.query('DROP TABLE IF EXISTS migrations CASCADE');
    console.log('✅ Tabela migrations removida');

    console.log('\n🎉 Banco de teste limpo com sucesso!');
    console.log('💡 Execute os testes para recriar as tabelas: npm test\n');
  } catch (error) {
    console.error('❌ Erro ao limpar banco:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

cleanTestDatabase();
