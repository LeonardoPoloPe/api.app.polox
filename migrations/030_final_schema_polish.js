/**
 * Migration 030: Polimento Final do Esquema - Correções Críticas
 * 
 * Este script finaliza a refatoração do banco de dados:
 * 1. Corrige audit_logs (entity_id para int8, adiciona FKs)
 * 2. Renomeia colunas reservadas restantes (number, plan, options, content, etc.)
 * 3. Remove tabelas de backup/teste
 * 
 * Data: 24/10/2025
 * Autor: Sistema
 */

/**
 * Helper: Renomeia coluna apenas se ela existir
 */
async function renameColumnIfExists(client, schema, table, oldName, newName) {
  const checkQuery = `
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_schema = $1 
      AND table_name = $2 
      AND column_name = $3
  `;
  
  const result = await client.query(checkQuery, [schema, table, oldName]);
  
  if (result.rows.length > 0) {
    await client.query(`
      ALTER TABLE ${schema}.${table} 
      RENAME COLUMN "${oldName}" TO ${newName}
    `);
    console.log(`      ✓ ${schema}.${table}.${oldName} → ${newName}`);
    return true;
  }
  return false;
}

/**
 * Helper: Adiciona FK se não existir
 */
async function addForeignKeyIfNotExists(client, table, constraintName, columnName, refTable, refColumn, onDelete = 'CASCADE') {
  const checkQuery = `
    SELECT constraint_name 
    FROM information_schema.table_constraints 
    WHERE table_name = $1 
      AND constraint_name = $2
      AND constraint_type = 'FOREIGN KEY'
  `;
  
  const result = await client.query(checkQuery, [table, constraintName]);
  
  if (result.rows.length === 0) {
    await client.query(`
      ALTER TABLE ${table} 
      ADD CONSTRAINT ${constraintName} 
      FOREIGN KEY (${columnName}) 
      REFERENCES ${refTable}(${refColumn}) 
      ON DELETE ${onDelete}
    `);
    console.log(`      ✓ FK criada: ${constraintName}`);
    return true;
  }
  return false;
}

/**
 * Executa a migration
 */
async function up(client) {
  console.log('🔄 Iniciando Migration 030: Polimento Final do Esquema...');

  try {
    await client.query('BEGIN');

    // =================================================================
    // 1. CORREÇÕES CRÍTICAS NA polox.audit_logs
    // =================================================================
    console.log('\n  📝 1. Corrigindo polox.audit_logs...');
    
    // Alterar entity_id para int8 (bigint)
    console.log('     Convertendo entity_id para int8...');
    await client.query(`
      ALTER TABLE polox.audit_logs 
      ALTER COLUMN entity_id TYPE int8 USING entity_id::int8
    `);
    console.log('      ✓ entity_id agora é int8 (bigint)');

    // Adicionar Foreign Keys
    console.log('     Adicionando Foreign Keys...');
    await addForeignKeyIfNotExists(
      client,
      'polox.audit_logs',
      'fk_audit_logs_company',
      'company_id',
      'polox.companies',
      'id',
      'CASCADE'
    );
    
    await addForeignKeyIfNotExists(
      client,
      'polox.audit_logs',
      'fk_audit_logs_user',
      'user_id',
      'polox.users',
      'id',
      'SET NULL'
    );

    // =================================================================
    // 2. POLIMENTO FINAL: Renomear Colunas Reservadas Restantes
    // =================================================================
    console.log('\n  📝 2. Renomeando colunas reservadas restantes...');

    // polox.file_uploads - "number" é palavra reservada
    console.log('     polox.file_uploads:');
    await renameColumnIfExists(client, 'polox', 'file_uploads', 'number', 'file_number');

    // polox.companies - "plan" e "language" são palavras reservadas
    console.log('     polox.companies:');
    await renameColumnIfExists(client, 'polox', 'companies', 'plan', 'subscription_plan');
    await renameColumnIfExists(client, 'polox', 'companies', 'language', 'default_language');

    // polox.custom_fields - "options" é palavra reservada
    console.log('     polox.custom_fields:');
    await renameColumnIfExists(client, 'polox', 'custom_fields', 'options', 'field_options');

    // polox.users - "position" e "language" são palavras reservadas
    console.log('     polox.users:');
    await renameColumnIfExists(client, 'polox', 'users', 'position', 'user_position');
    await renameColumnIfExists(client, 'polox', 'users', 'language', 'user_language');

    // polox.client_notes - "content" é palavra reservada
    console.log('     polox.client_notes:');
    await renameColumnIfExists(client, 'polox', 'client_notes', 'content', 'note_content');

    // polox.lead_notes - "content" é palavra reservada
    console.log('     polox.lead_notes:');
    await renameColumnIfExists(client, 'polox', 'lead_notes', 'content', 'note_content');

    // polox.leads - "position" e "source" são palavras reservadas
    console.log('     polox.leads:');
    await renameColumnIfExists(client, 'polox', 'leads', 'position', 'lead_position');
    await renameColumnIfExists(client, 'polox', 'leads', 'source', 'lead_source');

    // =================================================================
    // 3. LIMPEZA: Remover Tabelas de Backup/Teste
    // =================================================================
    console.log('\n  📝 3. Limpando tabelas de backup/teste...');
    
    await client.query('DROP TABLE IF EXISTS polox.leads_backup_011');
    console.log('      ✓ polox.leads_backup_011 removida');
    
    await client.query('DROP TABLE IF EXISTS public.test_dev');
    console.log('      ✓ public.test_dev removida (se existia)');

    await client.query('COMMIT');
    console.log('\n✅ Migration 030 concluída com sucesso!');
    console.log('   - audit_logs.entity_id agora é int8');
    console.log('   - Foreign Keys adicionadas em audit_logs');
    console.log('   - 11 colunas reservadas renomeadas');
    console.log('   - Tabelas de backup removidas');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('\n❌ Erro na Migration 030:', error.message);
    throw error;
  }
}

/**
 * Reverte a migration
 */
async function down(client) {
  console.log('🔄 Revertendo Migration 030: Restaurando schema anterior...');

  try {
    await client.query('BEGIN');

    // Reverter renomeações (ordem inversa)
    console.log('  📝 Revertendo renomeações de colunas...');
    
    await renameColumnIfExists(client, 'polox', 'leads', 'lead_source', 'source');
    await renameColumnIfExists(client, 'polox', 'leads', 'lead_position', 'position');
    await renameColumnIfExists(client, 'polox', 'lead_notes', 'note_content', 'content');
    await renameColumnIfExists(client, 'polox', 'client_notes', 'note_content', 'content');
    await renameColumnIfExists(client, 'polox', 'users', 'user_language', 'language');
    await renameColumnIfExists(client, 'polox', 'users', 'user_position', 'position');
    await renameColumnIfExists(client, 'polox', 'custom_fields', 'field_options', 'options');
    await renameColumnIfExists(client, 'polox', 'companies', 'default_language', 'language');
    await renameColumnIfExists(client, 'polox', 'companies', 'subscription_plan', 'plan');
    await renameColumnIfExists(client, 'polox', 'file_uploads', 'file_number', 'number');

    // Remover FKs
    console.log('  📝 Removendo Foreign Keys...');
    await client.query('ALTER TABLE polox.audit_logs DROP CONSTRAINT IF EXISTS fk_audit_logs_company');
    await client.query('ALTER TABLE polox.audit_logs DROP CONSTRAINT IF EXISTS fk_audit_logs_user');

    // Reverter entity_id para texto (se necessário - cuidado com dados!)
    console.log('  📝 Revertendo entity_id para varchar...');
    await client.query(`
      ALTER TABLE polox.audit_logs 
      ALTER COLUMN entity_id TYPE varchar(255) USING entity_id::varchar
    `);

    await client.query('COMMIT');
    console.log('✅ Rollback da Migration 030 concluído!');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Erro ao reverter Migration 030:', error.message);
    throw error;
  }
}

module.exports = { up, down };
