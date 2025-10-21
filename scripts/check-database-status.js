/**
 * Script para verificar o status atual do banco de dados
 */

const { Pool } = require('pg');
require('dotenv').config();

const dbConfig = {
  host: process.env.DB_HOST || 'database-1.cd2em8e0a6ot.sa-east-1.rds.amazonaws.com',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'app_polox_dev',
  user: process.env.DB_USER || 'polox_dev_user',
  password: process.env.DB_PASSWORD,
  ssl: {
    rejectUnauthorized: false
  }
};

async function checkDatabaseStatus() {
  const pool = new Pool(dbConfig);
  
  try {
    console.log('🔍 Verificando status do banco de dados...');
    console.log('🔗 Conectando ao banco:', dbConfig.database, 'em', dbConfig.host);
    
    // Verificar tabelas existentes
    const tablesResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);
    
    console.log('\n📋 Tabelas existentes no banco:');
    if (tablesResult.rows.length === 0) {
      console.log('   ❌ Nenhuma tabela encontrada');
    } else {
      tablesResult.rows.forEach(row => {
        console.log(`   ✅ ${row.table_name}`);
      });
    }
    
    // Verificar se existe tabela migrations
    const migrationsTableExists = tablesResult.rows.some(row => row.table_name === 'migrations');
    
    if (migrationsTableExists) {
      console.log('\n📝 Migrations registradas:');
      const migrationsResult = await pool.query(`
        SELECT name, executed_at 
        FROM migrations 
        ORDER BY executed_at;
      `);
      
      if (migrationsResult.rows.length === 0) {
        console.log('   ❌ Nenhuma migration registrada na tabela');
      } else {
        migrationsResult.rows.forEach(row => {
          console.log(`   ✅ ${row.name} - ${row.executed_at}`);
        });
      }
    } else {
      console.log('\n❌ Tabela migrations não existe');
    }
    
    // Verificar estrutura da tabela users se existe
    const usersTableExists = tablesResult.rows.some(row => row.table_name === 'users');
    if (usersTableExists) {
      console.log('\n🔍 Estrutura da tabela users:');
      const columnsResult = await pool.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_name = 'users' 
        ORDER BY ordinal_position;
      `);
      
      columnsResult.rows.forEach(row => {
        console.log(`   📄 ${row.column_name}: ${row.data_type} ${row.is_nullable === 'NO' ? 'NOT NULL' : ''}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Erro ao verificar banco:', error);
  } finally {
    await pool.end();
  }
}

checkDatabaseStatus();