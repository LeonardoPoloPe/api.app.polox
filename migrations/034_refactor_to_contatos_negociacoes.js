/**
 * Migration 034: Refatoração Completa - Leads/Clients → Contatos/Negociações
 * 
 * OBJETIVO: Implementar arquitetura "Identidade vs. Intenção"
 * - Identidade: polox.contatos (quem a pessoa é)
 * - Intenção: polox.negociacoes (o que ela quer comprar)
 * 
 * MUDANÇAS CRÍTICAS:
 * 1. DROP de todas as tabelas antigas (leads, clients, lead_notes, client_notes, etc.)
 * 2. CREATE de nova estrutura unificada
 * 3. 4 Constraints de integridade (UNIQUE + CHECK)
 * 4. PARTIAL INDEXES para handle NULL corretamente
 * 5. Atualização de FKs em outras tabelas (sales, tickets, events)
 * 
 * ⚠️  ATENÇÃO: Esta é uma migration DESTRUTIVA!
 *    Todos os dados de leads/clients serão DELETADOS.
 *    Execute apenas em DEV se não houver dados importantes.
 * 
 * Data: 2025-11-03
 * Autor: Leonardo Polo
 */

const up = async (client) => {
  console.log('🚀 Iniciando Migration 034: Refatoração Completa para Contatos/Negociações...');
  console.log('⚠️  ATENÇÃO: Esta migration é DESTRUTIVA e irá deletar dados existentes!');
  
  try {
    // ============================================================
    // FASE 1: REMOVER ESTRUTURA ANTIGA
    // ============================================================
    console.log('\n📋 FASE 1: Removendo estrutura antiga...');
    
    // 1.1: Remover tabelas satélite (dependências de leads/clients)
    console.log('🗑️  Removendo tabelas satélite...');
    
    await client.query(`DROP TABLE IF EXISTS polox.lead_notes CASCADE;`);
    console.log('   ✅ lead_notes removida');
    
    await client.query(`DROP TABLE IF EXISTS polox.lead_tags CASCADE;`);
    console.log('   ✅ lead_tags removida');
    
    await client.query(`DROP TABLE IF EXISTS polox.lead_interests CASCADE;`);
    console.log('   ✅ lead_interests removida');
    
    await client.query(`DROP TABLE IF EXISTS polox.client_notes CASCADE;`);
    console.log('   ✅ client_notes removida');
    
    await client.query(`DROP TABLE IF EXISTS polox.client_tags CASCADE;`);
    console.log('   ✅ client_tags removida');
    
    await client.query(`DROP TABLE IF EXISTS polox.client_interests CASCADE;`);
    console.log('   ✅ client_interests removida');
    
    // 1.2: Remover FKs de outras tabelas que apontam para clients/leads
    console.log('\n🔗 Removendo Foreign Keys...');
    
    await client.query(`
      ALTER TABLE polox.sales 
      DROP CONSTRAINT IF EXISTS sales_client_id_fkey CASCADE;
    `);
    console.log('   ✅ FK sales → clients removida');
    
    await client.query(`
      ALTER TABLE polox.tickets 
      DROP CONSTRAINT IF EXISTS tickets_client_id_fkey CASCADE;
    `);
    console.log('   ✅ FK tickets → clients removida');
    
    await client.query(`
      ALTER TABLE polox.events 
      DROP CONSTRAINT IF EXISTS events_client_id_fkey CASCADE;
    `);
    console.log('   ✅ FK events → clients removida');
    
    await client.query(`
      ALTER TABLE polox.financial_transactions 
      DROP CONSTRAINT IF EXISTS financial_transactions_client_id_fkey CASCADE;
    `);
    console.log('   ✅ FK financial_transactions → clients removida');
    
    // 1.3: Remover tabelas principais
    console.log('\n🗑️  Removendo tabelas principais (leads e clients)...');
    
    await client.query(`DROP TABLE IF EXISTS polox.leads CASCADE;`);
    console.log('   ✅ leads removida');
    
    await client.query(`DROP TABLE IF EXISTS polox.clients CASCADE;`);
    console.log('   ✅ clients removida');
    
    console.log('✅ FASE 1 CONCLUÍDA: Estrutura antiga removida com sucesso!\n');
    
    // ============================================================
    // FASE 2: CRIAR NOVA ESTRUTURA
    // ============================================================
    console.log('📋 FASE 2: Criando nova estrutura unificada...');
    
    // 2.1: Criar tabela CONTATOS (Fonte Única da Verdade)
    console.log('\n🔨 Criando tabela polox.contatos...');
    
    await client.query(`
      CREATE TABLE polox.contatos (
        id BIGSERIAL NOT NULL PRIMARY KEY,
        company_id BIGINT NOT NULL REFERENCES polox.companies(id) ON DELETE CASCADE,
        
        -- Colunas de Identidade
        nome VARCHAR(255) NOT NULL,
        email VARCHAR(255) NULL,
        phone VARCHAR(20) NULL,
        company_name VARCHAR(255) NULL,
        document_number VARCHAR(50) NULL,
        document_type VARCHAR(20) NULL,
        
        -- Coluna de Status (Lead ou Cliente)
        tipo VARCHAR(20) NOT NULL DEFAULT 'lead' 
          CHECK (tipo IN ('lead', 'cliente')),
        
        -- Rastreamento de Origem (campos de Lead)
        lead_source VARCHAR(100) NULL,
        first_contact_at TIMESTAMPTZ NULL,
        score INT DEFAULT 0,
        temperature VARCHAR(20) DEFAULT 'frio',
        
        -- Rastreamento de Cliente
        last_purchase_date DATE NULL,
        lifetime_value_cents BIGINT DEFAULT 0 NOT NULL,
        
        -- Endereço (movido de clients)
        address_street VARCHAR(255) NULL,
        address_number VARCHAR(20) NULL,
        address_complement VARCHAR(100) NULL,
        address_neighborhood VARCHAR(100) NULL,
        address_city VARCHAR(100) NULL,
        address_state VARCHAR(50) NULL,
        address_country VARCHAR(3) DEFAULT 'BR',
        address_postal_code VARCHAR(20) NULL,
        
        -- Owner (Responsável/Dono do contato)
        owner_id BIGINT NULL REFERENCES polox.users(id) ON DELETE SET NULL,
        
        -- Metadados
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        deleted_at TIMESTAMPTZ NULL,
        
        -- ========== CONSTRAINT ANTI-FANTASMA ==========
        -- Garante que todo contato tenha pelo menos 1 identificador
        -- AJUSTADO para permitir anonimização (LGPD)
        CONSTRAINT chk_contato_tem_identificador CHECK (
          deleted_at IS NOT NULL OR  -- Se deletado, não valida
          phone IS NOT NULL OR 
          email IS NOT NULL OR 
          document_number IS NOT NULL
        )
      );
    `);
    console.log('   ✅ Tabela contatos criada com sucesso!');
    
    // 2.2: Criar PARTIAL INDEXES (UNIQUE que respeita NULL)
    console.log('\n🔨 Criando PARTIAL INDEXES (UNIQUE + NULL handling)...');
    
    await client.query(`
      CREATE UNIQUE INDEX uk_contatos_company_phone 
      ON polox.contatos (company_id, phone) 
      WHERE phone IS NOT NULL AND deleted_at IS NULL;
    `);
    console.log('   ✅ UNIQUE INDEX: company_id + phone');
    
    await client.query(`
      CREATE UNIQUE INDEX uk_contatos_company_email 
      ON polox.contatos (company_id, email) 
      WHERE email IS NOT NULL AND deleted_at IS NULL;
    `);
    console.log('   ✅ UNIQUE INDEX: company_id + email');
    
    await client.query(`
      CREATE UNIQUE INDEX uk_contatos_company_document 
      ON polox.contatos (company_id, document_number) 
      WHERE document_number IS NOT NULL AND deleted_at IS NULL;
    `);
    console.log('   ✅ UNIQUE INDEX: company_id + document_number');
    
    // 2.3: Criar indexes de performance
    console.log('\n🔨 Criando indexes de performance...');
    
    await client.query(`
      CREATE INDEX idx_contatos_company_id 
      ON polox.contatos (company_id) 
      WHERE deleted_at IS NULL;
    `);
    
    await client.query(`
      CREATE INDEX idx_contatos_tipo 
      ON polox.contatos (company_id, tipo) 
      WHERE deleted_at IS NULL;
    `);
    
    await client.query(`
      CREATE INDEX idx_contatos_owner_id 
      ON polox.contatos (owner_id) 
      WHERE deleted_at IS NULL;
    `);
    
    await client.query(`
      CREATE INDEX idx_contatos_email 
      ON polox.contatos (email) 
      WHERE email IS NOT NULL AND deleted_at IS NULL;
    `);
    
    await client.query(`
      CREATE INDEX idx_contatos_phone 
      ON polox.contatos (phone) 
      WHERE phone IS NOT NULL AND deleted_at IS NULL;
    `);
    
    console.log('   ✅ Indexes de performance criados');
    
    // 2.4: Criar tabela NEGOCIACOES (Pipeline/Funil)
    console.log('\n🔨 Criando tabela polox.negociacoes...');
    
    await client.query(`
      CREATE TABLE polox.negociacoes (
        id BIGSERIAL NOT NULL PRIMARY KEY,
        company_id BIGINT NOT NULL REFERENCES polox.companies(id) ON DELETE CASCADE,
        contato_id BIGINT NOT NULL REFERENCES polox.contatos(id) ON DELETE RESTRICT,
        owner_id BIGINT NULL REFERENCES polox.users(id) ON DELETE SET NULL,
        
        titulo VARCHAR(255) NOT NULL,
        etapa_funil VARCHAR(50) NOT NULL DEFAULT 'novo' 
          CHECK (etapa_funil IN ('novo', 'qualificado', 'proposta', 'negociacao', 'ganhos', 'perdido')),
        valor_total_cents BIGINT DEFAULT 0 NOT NULL,
        origem VARCHAR(100) NULL,
        
        -- Timestamps de fechamento
        closed_at TIMESTAMPTZ NULL,
        motivo_perda TEXT NULL,
        
        -- Metadados
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        deleted_at TIMESTAMPTZ NULL
      );
    `);
    console.log('   ✅ Tabela negociacoes criada com sucesso!');
    
    // 2.5: Criar indexes para negociacoes
    console.log('\n🔨 Criando indexes para negociacoes...');
    
    await client.query(`
      CREATE INDEX idx_negociacoes_contato_id 
      ON polox.negociacoes (contato_id) 
      WHERE deleted_at IS NULL;
    `);
    
    await client.query(`
      CREATE INDEX idx_negociacoes_owner_id 
      ON polox.negociacoes (owner_id) 
      WHERE deleted_at IS NULL;
    `);
    
    await client.query(`
      CREATE INDEX idx_negociacoes_etapa_funil 
      ON polox.negociacoes (company_id, etapa_funil) 
      WHERE deleted_at IS NULL;
    `);
    
    await client.query(`
      CREATE INDEX idx_negociacoes_company_id 
      ON polox.negociacoes (company_id) 
      WHERE deleted_at IS NULL;
    `);
    
    console.log('   ✅ Indexes de negociacoes criados');
    
    // ============================================================
    // FASE 3: CRIAR TABELAS SATÉLITE UNIFICADAS
    // ============================================================
    console.log('\n📋 FASE 3: Criando tabelas satélite unificadas...');
    
    // 3.1: Criar CONTATO_NOTAS
    console.log('\n🔨 Criando tabela polox.contato_notas...');
    
    await client.query(`
      CREATE TABLE polox.contato_notas (
        id BIGSERIAL NOT NULL PRIMARY KEY,
        company_id BIGINT NOT NULL REFERENCES polox.companies(id) ON DELETE CASCADE,
        contato_id BIGINT NOT NULL REFERENCES polox.contatos(id) ON DELETE CASCADE,
        created_by_id BIGINT NOT NULL REFERENCES polox.users(id) ON DELETE RESTRICT,
        
        note_content TEXT NOT NULL,
        note_type VARCHAR(50) DEFAULT 'general',
        
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        deleted_at TIMESTAMPTZ NULL
      );
    `);
    
    await client.query(`
      CREATE INDEX idx_contato_notas_contato_id 
      ON polox.contato_notas (contato_id) 
      WHERE deleted_at IS NULL;
    `);
    
    await client.query(`
      CREATE INDEX idx_contato_notas_company_id 
      ON polox.contato_notas (company_id) 
      WHERE deleted_at IS NULL;
    `);
    
    console.log('   ✅ contato_notas criada');
    
    // 3.2: Criar CONTATO_TAGS
    console.log('\n🔨 Criando tabela polox.contato_tags...');
    
    await client.query(`
      CREATE TABLE polox.contato_tags (
        contato_id BIGINT NOT NULL REFERENCES polox.contatos(id) ON DELETE CASCADE,
        tag_id BIGINT NOT NULL REFERENCES polox.tags(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        PRIMARY KEY (contato_id, tag_id)
      );
    `);
    
    await client.query(`
      CREATE INDEX idx_contato_tags_contato_id 
      ON polox.contato_tags (contato_id);
    `);
    
    await client.query(`
      CREATE INDEX idx_contato_tags_tag_id 
      ON polox.contato_tags (tag_id);
    `);
    
    console.log('   ✅ contato_tags criada');
    
    // 3.3: Criar CONTATO_INTERESSES
    console.log('\n🔨 Criando tabela polox.contato_interesses...');
    
    await client.query(`
      CREATE TABLE polox.contato_interesses (
        contato_id BIGINT NOT NULL REFERENCES polox.contatos(id) ON DELETE CASCADE,
        interest_id BIGINT NOT NULL REFERENCES polox.interests(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        PRIMARY KEY (contato_id, interest_id)
      );
    `);
    
    await client.query(`
      CREATE INDEX idx_contato_interesses_contato_id 
      ON polox.contato_interesses (contato_id);
    `);
    
    await client.query(`
      CREATE INDEX idx_contato_interesses_interest_id 
      ON polox.contato_interesses (interest_id);
    `);
    
    console.log('   ✅ contato_interesses criada');
    
    console.log('✅ FASE 3 CONCLUÍDA: Tabelas satélite criadas com sucesso!\n');
    
    // ============================================================
    // FASE 4: ATUALIZAR FOREIGN KEYS DE OUTRAS TABELAS
    // ============================================================
    console.log('📋 FASE 4: Atualizando Foreign Keys em outras tabelas...');
    
    // 4.1: Atualizar tabela SALES
    console.log('\n🔨 Atualizando tabela sales...');
    
    // Primeiro, limpar dados órfãos (sales com client_id que não existe mais)
    const orphanSales = await client.query(`
      SELECT COUNT(*) as total FROM polox.sales WHERE client_id IS NOT NULL;
    `);
    console.log(`   ℹ️  Encontrados ${orphanSales.rows[0].total} registros em sales com client_id`);
    
    // Como deletamos clients, precisamos setar client_id como NULL
    await client.query(`
      UPDATE polox.sales SET client_id = NULL WHERE client_id IS NOT NULL;
    `);
    console.log(`   ✅ ${orphanSales.rows[0].total} registros de sales com client_id setados como NULL`);
    
    await client.query(`
      ALTER TABLE polox.sales 
      RENAME COLUMN client_id TO contato_id;
    `);
    
    await client.query(`
      ALTER TABLE polox.sales 
      ADD CONSTRAINT fk_sales_contato 
      FOREIGN KEY (contato_id) REFERENCES polox.contatos(id) ON DELETE SET NULL;
    `);
    
    console.log('   ✅ sales.client_id → sales.contato_id');
    
    // 4.2: Atualizar tabela TICKETS
    console.log('\n🔨 Atualizando tabela tickets...');
    
    // Limpar dados órfãos
    const orphanTickets = await client.query(`
      SELECT COUNT(*) as total FROM polox.tickets WHERE client_id IS NOT NULL;
    `);
    console.log(`   ℹ️  Encontrados ${orphanTickets.rows[0].total} registros em tickets com client_id`);
    
    await client.query(`
      UPDATE polox.tickets SET client_id = NULL WHERE client_id IS NOT NULL;
    `);
    console.log(`   ✅ ${orphanTickets.rows[0].total} registros de tickets com client_id setados como NULL`);
    
    await client.query(`
      ALTER TABLE polox.tickets 
      RENAME COLUMN client_id TO contato_id;
    `);
    
    await client.query(`
      ALTER TABLE polox.tickets 
      ADD CONSTRAINT fk_tickets_contato 
      FOREIGN KEY (contato_id) REFERENCES polox.contatos(id) ON DELETE SET NULL;
    `);
    
    console.log('   ✅ tickets.client_id → tickets.contato_id');
    
    // 4.3: Atualizar tabela EVENTS
    console.log('\n🔨 Atualizando tabela events...');
    
    // Limpar dados órfãos
    const orphanEvents = await client.query(`
      SELECT COUNT(*) as total FROM polox.events WHERE client_id IS NOT NULL;
    `);
    console.log(`   ℹ️  Encontrados ${orphanEvents.rows[0].total} registros em events com client_id`);
    
    await client.query(`
      UPDATE polox.events SET client_id = NULL WHERE client_id IS NOT NULL;
    `);
    console.log(`   ✅ ${orphanEvents.rows[0].total} registros de events com client_id setados como NULL`);
    
    await client.query(`
      ALTER TABLE polox.events 
      RENAME COLUMN client_id TO contato_id;
    `);
    
    await client.query(`
      ALTER TABLE polox.events 
      ADD CONSTRAINT fk_events_contato 
      FOREIGN KEY (contato_id) REFERENCES polox.contatos(id) ON DELETE SET NULL;
    `);
    
    console.log('   ✅ events.client_id → events.contato_id');
    
    // 4.4: Atualizar tabela FINANCIAL_TRANSACTIONS (se existir)
    const ftExists = await client.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'polox' 
        AND table_name = 'financial_transactions'
      );
    `);
    
    if (ftExists.rows[0].exists) {
      console.log('\n🔨 Atualizando tabela financial_transactions...');
      
      // Limpar dados órfãos
      const orphanFT = await client.query(`
        SELECT COUNT(*) as total FROM polox.financial_transactions WHERE client_id IS NOT NULL;
      `);
      console.log(`   ℹ️  Encontrados ${orphanFT.rows[0].total} registros em financial_transactions com client_id`);
      
      await client.query(`
        UPDATE polox.financial_transactions SET client_id = NULL WHERE client_id IS NOT NULL;
      `);
      console.log(`   ✅ ${orphanFT.rows[0].total} registros de financial_transactions com client_id setados como NULL`);
      
      await client.query(`
        ALTER TABLE polox.financial_transactions 
        RENAME COLUMN client_id TO contato_id;
      `);
      
      await client.query(`
        ALTER TABLE polox.financial_transactions 
        ADD CONSTRAINT fk_financial_transactions_contato 
        FOREIGN KEY (contato_id) REFERENCES polox.contatos(id) ON DELETE SET NULL;
      `);
      
      console.log('   ✅ financial_transactions.client_id → financial_transactions.contato_id');
    }
    
    console.log('✅ FASE 4 CONCLUÍDA: Foreign Keys atualizadas com sucesso!\n');
    
    // ============================================================
    // RESUMO FINAL
    // ============================================================
    console.log('\n' + '='.repeat(70));
    console.log('🎉 MIGRATION 034 CONCLUÍDA COM SUCESSO!');
    console.log('='.repeat(70));
    console.log('\n✅ Estrutura antiga REMOVIDA:');
    console.log('   - leads, clients');
    console.log('   - lead_notes, client_notes');
    console.log('   - lead_tags, client_tags');
    console.log('   - lead_interests, client_interests');
    console.log('\n✅ Nova estrutura CRIADA:');
    console.log('   - contatos (com 4 constraints de integridade)');
    console.log('   - negociacoes (pipeline/funil)');
    console.log('   - contato_notas (histórico unificado)');
    console.log('   - contato_tags (tags unificadas)');
    console.log('   - contato_interesses (interesses unificados)');
    console.log('\n✅ Foreign Keys ATUALIZADAS:');
    console.log('   - sales.contato_id');
    console.log('   - tickets.contato_id');
    console.log('   - events.contato_id');
    console.log('   - financial_transactions.contato_id');
    console.log('\n📚 Próximos passos:');
    console.log('   1. Criar Models: Contato.js, Negociacao.js');
    console.log('   2. Criar Controllers: ContatoController.js, NegociacaoController.js');
    console.log('   3. Criar Routes: /api/contatos, /api/negociacoes');
    console.log('   4. Atualizar frontend para usar novas APIs');
    console.log('\n' + '='.repeat(70));
    
  } catch (error) {
    console.error('\n❌ ERRO na Migration 034:', error.message);
    throw error;
  }
};

/**
 * Rollback da migration (não recomendado após executar)
 * ⚠️  ATENÇÃO: Rollback não é possível pois os dados foram deletados
 */
const down = async (client) => {
  console.log('⚠️  ROLLBACK da Migration 034...');
  console.log('❌ ATENÇÃO: Os dados originais foram deletados.');
  console.log('❌ Rollback completo não é possível!');
  console.log('\n💡 Opções:');
  console.log('   1. Restaurar backup do banco de dados');
  console.log('   2. Recriar estrutura antiga manualmente');
  
  throw new Error('Rollback não implementado - dados foram deletados com DROP TABLE');
};

module.exports = { up, down };
