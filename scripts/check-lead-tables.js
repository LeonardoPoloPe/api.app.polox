require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: {
    rejectUnauthorized: false
  }
});

async function checkLeadTables() {
  try {
    const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'polox' 
      AND table_name IN ('leads', 'lead_notes', 'tags', 'lead_tags', 'interests', 'lead_interests', 'leads_backup_011')
      ORDER BY table_name
    `);
    
    console.log('\n📊 Tabelas relacionadas a leads no ambiente DEV:\n');
    result.rows.forEach(row => {
      console.log(`  ✅ ${row.table_name}`);
    });
    
    console.log(`\nTotal: ${result.rows.length} tabelas encontradas\n`);
    
    // Verificar estrutura da tabela leads
    const leadsColumns = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'polox' 
      AND table_name = 'leads'
      ORDER BY ordinal_position
    `);
    
    console.log('📋 Colunas da tabela leads:');
    leadsColumns.rows.forEach(row => {
      console.log(`  - ${row.column_name} (${row.data_type})`);
    });
    
    await pool.end();
  } catch (error) {
    console.error('Erro ao verificar tabelas:', error.message);
    process.exit(1);
  }
}

checkLeadTables();
