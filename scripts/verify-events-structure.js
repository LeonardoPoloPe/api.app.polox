/**
 * Script para verificar estrutura das tabelas events e event_tags
 */

const { query } = require('../src/config/database');

async function verifyEventsStructure() {
  try {
    console.log('\n📋 Verificando estrutura da tabela polox.events...');
    
    // Verificar colunas da tabela events
    const eventsColumns = await query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_schema = 'polox' AND table_name = 'events'
      ORDER BY ordinal_position
    `);
    
    console.log('\nColunas da tabela events:');
    eventsColumns.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });

    // Verificar se notes e tags foram removidos
    const hasNotes = eventsColumns.rows.find(c => c.column_name === 'notes');
    const hasTags = eventsColumns.rows.find(c => c.column_name === 'tags');
    const hasDescription = eventsColumns.rows.find(c => c.column_name === 'description');
    
    console.log('\n✅ Verificações:');
    console.log(`  - Coluna 'notes' removida: ${!hasNotes ? '✅ SIM' : '❌ NÃO'}`);
    console.log(`  - Coluna 'tags' removida: ${!hasTags ? '✅ SIM' : '❌ NÃO'}`);
    console.log(`  - Coluna 'description' existe: ${hasDescription ? '✅ SIM' : '❌ NÃO'}`);

    console.log('\n📋 Verificando tabela polox.event_tags...');
    
    // Verificar colunas da tabela event_tags
    const eventTagsColumns = await query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_schema = 'polox' AND table_name = 'event_tags'
      ORDER BY ordinal_position
    `);
    
    console.log('\nColunas da tabela event_tags:');
    eventTagsColumns.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });

    // Verificar constraints
    const constraints = await query(`
      SELECT 
        con.conname AS constraint_name,
        con.contype AS constraint_type,
        pg_get_constraintdef(con.oid) AS constraint_definition
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
      JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
      WHERE nsp.nspname = 'polox'
        AND rel.relname = 'event_tags'
      ORDER BY con.contype, con.conname
    `);
    
    console.log('\nConstraints da tabela event_tags:');
    constraints.rows.forEach(c => {
      const type = c.constraint_type === 'p' ? 'PRIMARY KEY' : 
                   c.constraint_type === 'f' ? 'FOREIGN KEY' : 
                   c.constraint_type === 'u' ? 'UNIQUE' : c.constraint_type;
      console.log(`  - ${c.constraint_name} (${type})`);
      console.log(`    → ${c.constraint_definition}`);
    });

    // Verificar índices
    const indexes = await query(`
      SELECT indexname, indexdef 
      FROM pg_indexes 
      WHERE schemaname = 'polox' AND tablename = 'event_tags'
      ORDER BY indexname
    `);
    
    console.log('\nÍndices da tabela event_tags:');
    indexes.rows.forEach(idx => {
      console.log(`  - ${idx.indexname}`);
    });

    console.log('\n✅ Verificação concluída com sucesso!\n');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Erro:', error.message);
    console.error(error);
    process.exit(1);
  }
}

verifyEventsStructure();
