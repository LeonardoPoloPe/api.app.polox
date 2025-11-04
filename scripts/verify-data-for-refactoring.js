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

async function checkDataInTables() {
  try {
    console.log('🔍 VERIFICANDO DADOS NO BANCO app_polox_dev');
    console.log('='.repeat(70));
    
    // Verificar se as tabelas existem
    const tablesCheck = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'polox' 
      AND table_name IN ('leads', 'clients', 'lead_notes', 'client_notes', 'sales', 'tickets', 'events')
      ORDER BY table_name
    `);
    
    console.log('\n📋 Tabelas encontradas no schema polox:');
    tablesCheck.rows.forEach(r => console.log(`  ✅ ${r.table_name}`));
    
    if (tablesCheck.rows.length === 0) {
      console.log('  ❌ Nenhuma tabela encontrada no schema polox');
      console.log('\n⚠️  As migrations principais ainda não foram executadas!');
      await pool.end();
      return;
    }
    
    console.log('\n📊 CONTAGEM DE REGISTROS:');
    console.log('-'.repeat(70));
    
    let totalRecords = 0;
    
    // Verificar cada tabela que existe
    for (const table of tablesCheck.rows) {
      const tableName = table.table_name;
      
      try {
        const countResult = await pool.query(`
          SELECT COUNT(*) as total FROM polox.${tableName} WHERE deleted_at IS NULL
        `);
        const count = parseInt(countResult.rows[0].total);
        totalRecords += count;
        
        const icon = count > 0 ? '🚨' : '✅';
        console.log(`${icon} polox.${tableName.padEnd(20)} → ${count} registros ativos`);
        
      } catch (err) {
        console.log(`⚠️  polox.${tableName.padEnd(20)} → Erro: ${err.message}`);
      }
    }
    
    console.log('\n' + '='.repeat(70));
    console.log(`📊 TOTAL DE REGISTROS QUE SERIAM AFETADOS: ${totalRecords}`);
    console.log('='.repeat(70));
    
    if (totalRecords > 0) {
      console.log('\n🚨 ATENÇÃO: HÁ DADOS NO BANCO!');
      console.log('\n⚠️  DECISÃO: Use MIGRAÇÃO SEGURA (Opção A)');
      console.log('   → NÃO use DROP TABLE');
      console.log('   → Criar tabelas novas em paralelo (contatos, negociacoes)');
      console.log('   → Migrar dados gradualmente');
      console.log('   → Manter convivência de APIs (v1 + v2)');
      console.log('   → Rollback possível');
    } else {
      console.log('\n✅ BANCO LIMPO - NENHUM DADO ENCONTRADO!');
      console.log('\n✅ DECISÃO: Pode usar DROP TABLE (Opção B)');
      console.log('   → Todos os ambientes estão vazios');
      console.log('   → Reconstrução total é segura');
      console.log('   → Implementação mais rápida (2-3 dias)');
    }
    
    // Verificar também se existem FKs apontando para clients
    console.log('\n🔗 VERIFICANDO FOREIGN KEYS:');
    const fksResult = await pool.query(`
      SELECT 
        tc.table_name, 
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name 
      FROM information_schema.table_constraints AS tc 
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY' 
        AND tc.table_schema = 'polox'
        AND (ccu.table_name = 'leads' OR ccu.table_name = 'clients')
      ORDER BY tc.table_name
    `);
    
    if (fksResult.rows.length > 0) {
      console.log('   ⚠️  Tabelas que apontam para leads/clients:');
      fksResult.rows.forEach(r => {
        console.log(`      ${r.table_name}.${r.column_name} → ${r.foreign_table_name}.${r.foreign_column_name}`);
      });
    } else {
      console.log('   ✅ Nenhuma FK apontando para leads/clients');
    }
    
  } catch (err) {
    console.error('\n❌ ERRO:', err.message);
  } finally {
    await pool.end();
  }
}

checkDataInTables();
