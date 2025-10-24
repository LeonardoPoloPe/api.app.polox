/**
 * Migration 031: Triggers para Limpeza Automática de Custom Field Values
 * 
 * Problema: polox.custom_field_values usa design polimórfico (EAV)
 * - entity_id pode referenciar múltiplas tabelas (clients, leads, products, etc.)
 * - Não pode usar FOREIGN KEY nativa
 * - Quando entidade é deletada, valores ficam órfãos
 * 
 * Solução: Database Triggers
 * - Função genérica cleanup_custom_field_values()
 * - Triggers AFTER DELETE em cada tabela de entidade
 * - Limpeza automática e garantida no nível do banco
 * 
 * Data: 24/10/2025
 * Autor: Sistema
 */

/**
 * Executa a migration
 */
async function up(client) {
  console.log('🔄 Iniciando Migration 031: Triggers de Limpeza de Custom Field Values...');

  try {
    await client.query('BEGIN');

    // =================================================================
    // 1. CRIAR FUNÇÃO GENÉRICA DE LIMPEZA
    // =================================================================
    console.log('\n  📝 1. Criando função genérica de limpeza...');
    
    await client.query(`
      CREATE OR REPLACE FUNCTION polox.cleanup_custom_field_values()
      RETURNS TRIGGER AS $$
      DECLARE
        deleted_count INTEGER;
        entity_type_arg TEXT;
      BEGIN
        -- TG_ARGV[0] contém o entity_type ('client', 'lead', 'product', etc.)
        entity_type_arg := TG_ARGV[0];
        
        -- Deletar valores customizados desta entidade
        -- Filtra por entity_type para garantir que deletamos apenas
        -- valores dos campos corretos (evita deletar valores de outro tipo)
        DELETE FROM polox.custom_field_values
        WHERE entity_id = OLD.id
          AND custom_field_id IN (
            SELECT id 
            FROM polox.custom_fields 
            WHERE entity_type = entity_type_arg
          );
        
        GET DIAGNOSTICS deleted_count = ROW_COUNT;
        
        -- Log para debug (aparece nos logs do PostgreSQL)
        IF deleted_count > 0 THEN
          RAISE NOTICE 'Deletados % valores customizados para % id=%', 
            deleted_count, entity_type_arg, OLD.id;
        END IF;
        
        RETURN OLD;
      END;
      $$ LANGUAGE plpgsql;
    `);
    
    console.log('      ✓ Função polox.cleanup_custom_field_values() criada');

    // =================================================================
    // 2. CRIAR TRIGGERS PARA CADA ENTIDADE
    // =================================================================
    console.log('\n  📝 2. Criando triggers para cada entidade...');

    // Lista de entidades que usam custom fields
    // Baseado em CustomField.VALID_ENTITY_TYPES
    const entities = [
      { table: 'clients', type: 'client' },
      { table: 'leads', type: 'lead' },
      { table: 'products', type: 'product' },
      { table: 'sales', type: 'sale' },
      { table: 'tickets', type: 'ticket' },
      { table: 'events', type: 'event' },
      { table: 'suppliers', type: 'supplier' },
      { table: 'financial_transactions', type: 'financial_transaction' }
    ];

    for (const entity of entities) {
      const triggerName = `trg_${entity.table}_cleanup_custom_values`;
      
      // Verificar se trigger já existe antes de criar
      const checkTrigger = await client.query(`
        SELECT trigger_name 
        FROM information_schema.triggers 
        WHERE trigger_schema = 'polox' 
          AND event_object_table = $1
          AND trigger_name = $2
      `, [entity.table, triggerName]);

      if (checkTrigger.rows.length === 0) {
        await client.query(`
          CREATE TRIGGER ${triggerName}
          AFTER DELETE ON polox.${entity.table}
          FOR EACH ROW
          EXECUTE FUNCTION polox.cleanup_custom_field_values('${entity.type}')
        `);
        console.log(`      ✓ Trigger criado: ${triggerName} (entity_type='${entity.type}')`);
      } else {
        console.log(`      ⏭️  Trigger já existe: ${triggerName}`);
      }
    }

    // =================================================================
    // 3. LIMPEZA DE VALORES ÓRFÃOS EXISTENTES (OPCIONAL)
    // =================================================================
    console.log('\n  📝 3. Limpando valores órfãos existentes (opcional)...');
    
    // Para cada entity_type, deletar valores onde entity_id não existe mais
    for (const entity of entities) {
      const cleanupQuery = `
        DELETE FROM polox.custom_field_values
        WHERE custom_field_id IN (
          SELECT id FROM polox.custom_fields WHERE entity_type = $1
        )
        AND NOT EXISTS (
          SELECT 1 FROM polox.${entity.table} WHERE id = custom_field_values.entity_id
        )
      `;
      
      const result = await client.query(cleanupQuery, [entity.type]);
      
      if (result.rowCount > 0) {
        console.log(`      ⚠️  Deletados ${result.rowCount} valores órfãos de '${entity.type}'`);
      } else {
        console.log(`      ✓ Nenhum valor órfão encontrado para '${entity.type}'`);
      }
    }

    // =================================================================
    // 4. ADICIONAR COMENTÁRIOS PARA DOCUMENTAÇÃO
    // =================================================================
    await client.query(`
      COMMENT ON FUNCTION polox.cleanup_custom_field_values() IS 
      'Trigger function: Deleta automaticamente valores de custom_field_values quando entidade principal é deletada. 
       Usado para manter integridade referencial em design polimórfico (EAV).
       Uso: CREATE TRIGGER ... EXECUTE FUNCTION cleanup_custom_field_values(''entity_type'')';
    `);

    await client.query('COMMIT');
    
    console.log('\n✅ Migration 031 concluída com sucesso!');
    console.log('   - Função de limpeza criada: polox.cleanup_custom_field_values()');
    console.log('   - 8 triggers criados (clients, leads, products, sales, tickets, events, suppliers, financial_transactions)');
    console.log('   - Valores órfãos existentes foram limpos');
    console.log('   - Integridade referencial garantida via triggers');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('\n❌ Erro na Migration 031:', error.message);
    throw error;
  }
}

/**
 * Reverte a migration
 */
async function down(client) {
  console.log('🔄 Revertendo Migration 031: Removendo triggers de limpeza...');

  try {
    await client.query('BEGIN');

    // Remover triggers
    const entities = [
      'clients', 'leads', 'products', 'sales', 'tickets', 
      'events', 'suppliers', 'financial_transactions'
    ];

    console.log('\n  📝 Removendo triggers...');
    for (const table of entities) {
      const triggerName = `trg_${table}_cleanup_custom_values`;
      await client.query(`DROP TRIGGER IF EXISTS ${triggerName} ON polox.${table}`);
      console.log(`      ✓ Trigger removido: ${triggerName}`);
    }

    // Remover função
    console.log('\n  📝 Removendo função de limpeza...');
    await client.query('DROP FUNCTION IF EXISTS polox.cleanup_custom_field_values()');
    console.log('      ✓ Função polox.cleanup_custom_field_values() removida');

    await client.query('COMMIT');
    console.log('\n✅ Rollback da Migration 031 concluído!');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('\n❌ Erro ao reverter Migration 031:', error.message);
    throw error;
  }
}

module.exports = { up, down };
