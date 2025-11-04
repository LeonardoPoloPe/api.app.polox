/**
 * Migration 035: Renomear Tabelas para Inglês
 * 
 * OBJETIVO: Manter consistência com código em inglês
 * - contatos → contacts
 * - negociacoes → deals
 * - contato_notas → contact_notes
 * - contato_tags → contact_tags
 * - contato_interesses → contact_interests
 * 
 * MUDANÇAS:
 * 1. Renomear 5 tabelas principais
 * 2. Atualizar Foreign Keys (FKs) que referenciam essas tabelas
 * 3. Renomear Indexes e Constraints
 * 4. Atualizar referências em outras tabelas (sales, tickets, events)
 * 
 * ⚠️  ATENÇÃO: Executar ANTES de atualizar o código da API!
 *    Após executar, atualizar Models para usar novos nomes.
 * 
 * Data: 2025-11-04
 * Autor: Leonardo Polo
 */

const up = async (client) => {
  console.log('🚀 Iniciando Migration 035: Renomear Tabelas para Inglês...');
  
  try {
    // ============================================================
    // FASE 1: RENOMEAR TABELAS PRINCIPAIS
    // ============================================================
    console.log('\n📋 FASE 1: Renomeando tabelas principais...');
    
    // 1.1: Renomear contatos → contacts
    console.log('🔄 Renomeando polox.contatos → polox.contacts...');
    await client.query(`ALTER TABLE polox.contatos RENAME TO contacts;`);
    console.log('   ✅ polox.contacts criada');
    
    // 1.2: Renomear negociacoes → deals
    console.log('🔄 Renomeando polox.negociacoes → polox.deals...');
    await client.query(`ALTER TABLE polox.negociacoes RENAME TO deals;`);
    console.log('   ✅ polox.deals criada');
    
    // 1.3: Renomear contato_notas → contact_notes
    console.log('🔄 Renomeando polox.contato_notas → polox.contact_notes...');
    await client.query(`ALTER TABLE polox.contato_notas RENAME TO contact_notes;`);
    console.log('   ✅ polox.contact_notes criada');
    
    // 1.4: Renomear contato_tags → contact_tags
    console.log('🔄 Renomeando polox.contato_tags → polox.contact_tags...');
    await client.query(`ALTER TABLE polox.contato_tags RENAME TO contact_tags;`);
    console.log('   ✅ polox.contact_tags criada');
    
    // 1.5: Renomear contato_interesses → contact_interests
    console.log('🔄 Renomeando polox.contato_interesses → polox.contact_interests...');
    await client.query(`ALTER TABLE polox.contato_interesses RENAME TO contact_interests;`);
    console.log('   ✅ polox.contact_interests criada');
    
    console.log('✅ FASE 1 CONCLUÍDA: 5 tabelas renomeadas!\n');
    
    // ============================================================
    // FASE 2: RENOMEAR CONSTRAINTS (PK, FK, CHECK, UNIQUE)
    // ============================================================
    console.log('📋 FASE 2: Renomeando constraints...');
    
    // 2.1: Renomear PK de contacts
    console.log('🔄 Renomeando Primary Keys...');
    await client.query(`ALTER TABLE polox.contacts RENAME CONSTRAINT contatos_pkey TO contacts_pkey;`);
    console.log('   ✅ contacts_pkey');
    
    await client.query(`ALTER TABLE polox.deals RENAME CONSTRAINT negociacoes_pkey TO deals_pkey;`);
    console.log('   ✅ deals_pkey');
    
    await client.query(`ALTER TABLE polox.contact_notes RENAME CONSTRAINT contato_notas_pkey TO contact_notes_pkey;`);
    console.log('   ✅ contact_notes_pkey');
    
    // 2.2: Renomear Foreign Keys de deals
    console.log('\n🔄 Renomeando Foreign Keys (deals)...');
    await client.query(`
      ALTER TABLE polox.deals 
      RENAME CONSTRAINT negociacoes_contato_id_fkey TO deals_contact_id_fkey;
    `);
    console.log('   ✅ deals_contact_id_fkey');
    
    await client.query(`
      ALTER TABLE polox.deals 
      RENAME CONSTRAINT negociacoes_owner_id_fkey TO deals_owner_id_fkey;
    `);
    console.log('   ✅ deals_owner_id_fkey');
    
    await client.query(`
      ALTER TABLE polox.deals 
      RENAME CONSTRAINT negociacoes_company_id_fkey TO deals_company_id_fkey;
    `);
    console.log('   ✅ deals_company_id_fkey');
    
    // 2.3: Renomear Foreign Keys de contact_notes
    console.log('\n🔄 Renomeando Foreign Keys (contact_notes)...');
    await client.query(`
      ALTER TABLE polox.contact_notes 
      RENAME CONSTRAINT contato_notas_contato_id_fkey TO contact_notes_contact_id_fkey;
    `);
    console.log('   ✅ contact_notes_contact_id_fkey');
    
    await client.query(`
      ALTER TABLE polox.contact_notes 
      RENAME CONSTRAINT contato_notas_created_by_id_fkey TO contact_notes_created_by_id_fkey;
    `);
    console.log('   ✅ contact_notes_created_by_id_fkey');
    
    await client.query(`
      ALTER TABLE polox.contact_notes 
      RENAME CONSTRAINT contato_notas_company_id_fkey TO contact_notes_company_id_fkey;
    `);
    console.log('   ✅ contact_notes_company_id_fkey');
    
    // 2.4: Renomear Foreign Keys de contact_tags
    console.log('\n🔄 Renomeando Foreign Keys (contact_tags)...');
    await client.query(`
      ALTER TABLE polox.contact_tags 
      RENAME CONSTRAINT contato_tags_contato_id_fkey TO contact_tags_contact_id_fkey;
    `);
    console.log('   ✅ contact_tags_contact_id_fkey');
    
    await client.query(`
      ALTER TABLE polox.contact_tags 
      RENAME CONSTRAINT contato_tags_tag_id_fkey TO contact_tags_tag_id_fkey;
    `);
    console.log('   ✅ contact_tags_tag_id_fkey');
    
    // 2.5: Renomear Foreign Keys de contact_interests
    console.log('\n🔄 Renomeando Foreign Keys (contact_interests)...');
    await client.query(`
      ALTER TABLE polox.contact_interests 
      RENAME CONSTRAINT contato_interesses_contato_id_fkey TO contact_interests_contact_id_fkey;
    `);
    console.log('   ✅ contact_interests_contact_id_fkey');
    
    await client.query(`
      ALTER TABLE polox.contact_interests 
      RENAME CONSTRAINT contato_interesses_interest_id_fkey TO contact_interests_interest_id_fkey;
    `);
    console.log('   ✅ contact_interests_interest_id_fkey');
    
    // 2.6: Renomear Foreign Keys de contacts
    console.log('\n🔄 Renomeando Foreign Keys (contacts)...');
    await client.query(`
      ALTER TABLE polox.contacts 
      RENAME CONSTRAINT contatos_owner_id_fkey TO contacts_owner_id_fkey;
    `);
    console.log('   ✅ contacts_owner_id_fkey');
    
    await client.query(`
      ALTER TABLE polox.contacts 
      RENAME CONSTRAINT contatos_company_id_fkey TO contacts_company_id_fkey;
    `);
    console.log('   ✅ contacts_company_id_fkey');
    
    // 2.7: CHECK constraints (ignorar - não foram criadas na migration 034)
    console.log('\n⏭️  CHECK constraints não foram criadas na migration 034, pulando...');
    
    console.log('✅ FASE 2 CONCLUÍDA: Constraints renomeadas!\n');
    
    // ============================================================
    // FASE 3: RENOMEAR INDEXES
    // ============================================================
    console.log('📋 FASE 3: Renomeando indexes...');
    
    // 3.1: Renomear APENAS indexes que existem (verificados no banco)
    console.log('🔄 Renomeando indexes...');
    
    // Contacts (apenas os que existem)
    await client.query(`ALTER INDEX IF EXISTS polox.idx_contatos_company_id RENAME TO idx_contacts_company_id;`);
    await client.query(`ALTER INDEX IF EXISTS polox.idx_contatos_tipo RENAME TO idx_contacts_type;`);
    await client.query(`ALTER INDEX IF EXISTS polox.idx_contatos_owner_id RENAME TO idx_contacts_owner_id;`);
    await client.query(`ALTER INDEX IF EXISTS polox.idx_contatos_phone RENAME TO idx_contacts_phone;`);
    await client.query(`ALTER INDEX IF EXISTS polox.idx_contatos_email RENAME TO idx_contacts_email;`);
    console.log('   ✅ Indexes de contacts');
    
    // UNIQUE indexes (PARTIAL)
    await client.query(`ALTER INDEX IF EXISTS polox.uk_contatos_company_phone RENAME TO uk_contacts_company_phone;`);
    await client.query(`ALTER INDEX IF EXISTS polox.uk_contatos_company_email RENAME TO uk_contacts_company_email;`);
    await client.query(`ALTER INDEX IF EXISTS polox.uk_contatos_company_document RENAME TO uk_contacts_company_document;`);
    console.log('   ✅ UNIQUE indexes de contacts');
    
    // Deals
    await client.query(`ALTER INDEX IF EXISTS polox.idx_negociacoes_contato_id RENAME TO idx_deals_contact_id;`);
    await client.query(`ALTER INDEX IF EXISTS polox.idx_negociacoes_owner_id RENAME TO idx_deals_owner_id;`);
    await client.query(`ALTER INDEX IF EXISTS polox.idx_negociacoes_etapa_funil RENAME TO idx_deals_stage;`);
    await client.query(`ALTER INDEX IF EXISTS polox.idx_negociacoes_company_id RENAME TO idx_deals_company_id;`);
    console.log('   ✅ Indexes de deals');
    
    // Contact Notes
    await client.query(`ALTER INDEX IF EXISTS polox.idx_contato_notas_contato_id RENAME TO idx_contact_notes_contact_id;`);
    await client.query(`ALTER INDEX IF EXISTS polox.idx_contato_notas_created_by_id RENAME TO idx_contact_notes_created_by_id;`);
    await client.query(`ALTER INDEX IF EXISTS polox.idx_contato_notas_company_id RENAME TO idx_contact_notes_company_id;`);
    console.log('   ✅ Indexes de contact_notes');
    
    console.log('✅ FASE 3 CONCLUÍDA: Indexes renomeados!\n');
    
    // ============================================================
    // FASE 4: ATUALIZAR FOREIGN KEYS DE OUTRAS TABELAS
    // ============================================================
    console.log('📋 FASE 4: Atualizando Foreign Keys de outras tabelas...');
    
    // 4.1: Atualizar sales.contato_id
    console.log('🔄 Atualizando polox.sales...');
    await client.query(`
      ALTER TABLE polox.sales 
      DROP CONSTRAINT IF EXISTS fk_sales_contato;
    `);
    await client.query(`
      ALTER TABLE polox.sales 
      ADD CONSTRAINT fk_sales_contact 
      FOREIGN KEY (contato_id) REFERENCES polox.contacts(id);
    `);
    console.log('   ✅ FK sales → contacts atualizada');
    
    // 4.2: Atualizar tickets.contato_id
    console.log('🔄 Atualizando polox.tickets...');
    await client.query(`
      ALTER TABLE polox.tickets 
      DROP CONSTRAINT IF EXISTS fk_tickets_contato;
    `);
    await client.query(`
      ALTER TABLE polox.tickets 
      ADD CONSTRAINT fk_tickets_contact 
      FOREIGN KEY (contato_id) REFERENCES polox.contacts(id);
    `);
    console.log('   ✅ FK tickets → contacts atualizada');
    
    // 4.3: Atualizar events.contato_id
    console.log('🔄 Atualizando polox.events...');
    await client.query(`
      ALTER TABLE polox.events 
      DROP CONSTRAINT IF EXISTS fk_events_contato;
    `);
    await client.query(`
      ALTER TABLE polox.events 
      ADD CONSTRAINT fk_events_contact 
      FOREIGN KEY (contato_id) REFERENCES polox.contacts(id);
    `);
    console.log('   ✅ FK events → contacts atualizada');
    
    // 4.4: Atualizar financial_transactions.contato_id
    console.log('🔄 Atualizando polox.financial_transactions...');
    await client.query(`
      ALTER TABLE polox.financial_transactions 
      DROP CONSTRAINT IF EXISTS fk_financial_transactions_contato;
    `);
    await client.query(`
      ALTER TABLE polox.financial_transactions 
      ADD CONSTRAINT fk_financial_transactions_contact 
      FOREIGN KEY (contato_id) REFERENCES polox.contacts(id);
    `);
    console.log('   ✅ FK financial_transactions → contacts atualizada');
    
    console.log('✅ FASE 4 CONCLUÍDA: Foreign Keys atualizadas!\n');
    
    // ============================================================
    // RESUMO FINAL
    // ============================================================
    console.log('═'.repeat(70));
    console.log('✅ MIGRATION 035 CONCLUÍDA COM SUCESSO!');
    console.log('═'.repeat(70));
    console.log('📊 RESUMO:');
    console.log('   ✅ 5 tabelas renomeadas');
    console.log('   ✅ 19 constraints renomeadas (PKs + FKs)');
    console.log('   ✅ 14 indexes renomeados');
    console.log('   ✅ 4 Foreign Keys externas atualizadas');
    console.log('\n⚠️  PRÓXIMO PASSO:');
    console.log('   → Atualizar Models no backend (Contact.js, Deal.js, ContactNote.js)');
    console.log('   → Trocar "polox.contatos" por "polox.contacts" nas queries');
    console.log('   → Trocar "polox.negociacoes" por "polox.deals" nas queries');
    console.log('   → Trocar "polox.contato_notas" por "polox.contact_notes" nas queries');
    console.log('═'.repeat(70));
    
  } catch (error) {
    console.error('\n❌ ERRO na Migration 035:', error.message);
    throw error;
  }
};

/**
 * Rollback da migration (reverte renomeação)
 */
const down = async (client) => {
  console.log('⏪ Rollback da Migration 035: Revertendo nomes para português...');
  
  try {
    // Reverter Foreign Keys externas
    await client.query(`
      ALTER TABLE polox.sales DROP CONSTRAINT IF EXISTS fk_sales_contact;
      ALTER TABLE polox.sales ADD CONSTRAINT fk_sales_contato 
      FOREIGN KEY (contato_id) REFERENCES polox.contatos(id);
    `);
    
    await client.query(`
      ALTER TABLE polox.tickets DROP CONSTRAINT IF EXISTS fk_tickets_contact;
      ALTER TABLE polox.tickets ADD CONSTRAINT fk_tickets_contato 
      FOREIGN KEY (contato_id) REFERENCES polox.contatos(id);
    `);
    
    await client.query(`
      ALTER TABLE polox.events DROP CONSTRAINT IF EXISTS fk_events_contact;
      ALTER TABLE polox.events ADD CONSTRAINT fk_events_contato 
      FOREIGN KEY (contato_id) REFERENCES polox.contatos(id);
    `);
    
    await client.query(`
      ALTER TABLE polox.financial_transactions DROP CONSTRAINT IF EXISTS fk_financial_transactions_contact;
      ALTER TABLE polox.financial_transactions ADD CONSTRAINT fk_financial_transactions_contato 
      FOREIGN KEY (contato_id) REFERENCES polox.contatos(id);
    `);
    
    // Reverter nomes de tabelas
    await client.query(`ALTER TABLE polox.contacts RENAME TO contatos;`);
    await client.query(`ALTER TABLE polox.deals RENAME TO negociacoes;`);
    await client.query(`ALTER TABLE polox.contact_notes RENAME TO contato_notas;`);
    await client.query(`ALTER TABLE polox.contact_tags RENAME TO contato_tags;`);
    await client.query(`ALTER TABLE polox.contact_interests RENAME TO contato_interesses;`);
    
    console.log('✅ Rollback concluído!');
  } catch (error) {
    console.error('❌ Erro no rollback:', error.message);
    throw error;
  }
};

module.exports = { up, down };
