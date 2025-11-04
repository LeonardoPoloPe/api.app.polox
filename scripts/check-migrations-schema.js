const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: 5432,
  database: 'app_polox_dev',
  user: 'polox_dev_user',
  password: process.env.DB_PASSWORD,
  ssl: { rejectUnauthorized: false }
});

async function check() {
  try {
    console.log('🔍 Verificando estrutura da tabela migrations...\n');
    
    const cols = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'migrations' 
      ORDER BY ordinal_position
    `);
    
    console.log('Colunas da tabela migrations:');
    cols.rows.forEach(r => console.log(`  - ${r.column_name} (${r.data_type})`));
    
    console.log('\n📝 Registros na tabela migrations:');
    const migs = await pool.query('SELECT * FROM migrations ORDER BY id LIMIT 5');
    console.log(`  Total: ${migs.rows.length} migrations`);
    migs.rows.forEach(r => console.log(`  - ${JSON.stringify(r)}`));
    
  } catch (err) {
    console.error('❌ Erro:', err.message);
  } finally {
    await pool.end();
  }
}

check();
