/**
 * Migration 036: Adicionar Constraints de Unicidade
 * 
 * OBJETIVO: Implementar "Fonte Única da Verdade" por empresa
 * - Impedir contatos duplicados por document_number, phone ou email
 * - Impedir "contatos fantasmas" sem nenhum identificador
 * 
 * CONSTRAINTS ADICIONADAS:
 * 1. UNIQUE (company_id, document_number) - Anti-duplicidade CPF/CNPJ
 * 2. UNIQUE (company_id, phone) - Anti-duplicidade telefone (WhatsApp)
 * 3. UNIQUE (company_id, email) - Anti-duplicidade e-mail
 * 4. CHECK anti-fantasma - Obriga pelo menos 1 identificador preenchido
 * 
 * ⚠️  ATENÇÃO: Esta migration pode FALHAR se já existirem dados duplicados!
 *    Executar apenas em ambientes limpos ou após limpeza de duplicatas.
 * 
 * REFERÊNCIA: docs/atividade/alteracao.md (Seção "Fonte Única da Verdade")
 * 
 * Data: 2025-11-04
 * Autor: Leonardo Polo
 */

const up = async (client) => {
  console.log('🚀 Iniciando Migration 036: Adicionar Constraints de Unicidade...');
  
  try {
    // ============================================================
    // FASE 1: ADICIONAR COLUNAS FALTANTES (SE NÃO EXISTIREM)
    // ============================================================
    console.log('\n📋 FASE 1: Verificando e adicionando colunas necessárias...');
    
    // 1.1: Verificar se document_number existe
    const documentNumberExists = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'polox' 
        AND table_name = 'contacts' 
        AND column_name = 'document_number';
    `);
    
    if (documentNumberExists.rows.length === 0) {
      console.log('🔄 Adicionando coluna document_number...');
      await client.query(`
        ALTER TABLE polox.contacts 
        ADD COLUMN document_number varchar(50) NULL;
      `);
      console.log('   ✅ Coluna document_number adicionada');
    } else {
      console.log('   ℹ️  Coluna document_number já existe');
    }
    
    // 1.2: Verificar se document_type existe
    const documentTypeExists = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'polox' 
        AND table_name = 'contacts' 
        AND column_name = 'document_type';
    `);
    
    if (documentTypeExists.rows.length === 0) {
      console.log('🔄 Adicionando coluna document_type...');
      await client.query(`
        ALTER TABLE polox.contacts 
        ADD COLUMN document_type varchar(20) NULL;
      `);
      console.log('   ✅ Coluna document_type adicionada');
    } else {
      console.log('   ℹ️  Coluna document_type já existe');
    }
    
    // ============================================================
    // FASE 2: LIMPAR DADOS DUPLICADOS (PREPARAÇÃO)
    // ============================================================
    console.log('\n🧹 FASE 2: Verificando duplicatas existentes...');
    
    // 2.1: Verificar duplicatas por document_number
    const duplicateDocuments = await client.query(`
      SELECT company_id, document_number, COUNT(*) as total
      FROM polox.contacts
      WHERE document_number IS NOT NULL AND document_number != ''
      GROUP BY company_id, document_number
      HAVING COUNT(*) > 1;
    `);
    
    if (duplicateDocuments.rows.length > 0) {
      console.warn('   ⚠️  ATENÇÃO: Encontradas', duplicateDocuments.rows.length, 'duplicatas por document_number');
      console.warn('   📋 Duplicatas:', JSON.stringify(duplicateDocuments.rows, null, 2));
      throw new Error('Existem contatos duplicados por document_number. Limpe os dados antes de executar esta migration.');
    } else {
      console.log('   ✅ Nenhuma duplicata por document_number');
    }
    
    // 2.2: Verificar duplicatas por phone
    const duplicatePhones = await client.query(`
      SELECT company_id, phone, COUNT(*) as total
      FROM polox.contacts
      WHERE phone IS NOT NULL AND phone != ''
      GROUP BY company_id, phone
      HAVING COUNT(*) > 1;
    `);
    
    if (duplicatePhones.rows.length > 0) {
      console.warn('   ⚠️  ATENÇÃO: Encontradas', duplicatePhones.rows.length, 'duplicatas por phone');
      console.warn('   📋 Duplicatas:', JSON.stringify(duplicatePhones.rows, null, 2));
      throw new Error('Existem contatos duplicados por phone. Limpe os dados antes de executar esta migration.');
    } else {
      console.log('   ✅ Nenhuma duplicata por phone');
    }
    
    // 2.3: Verificar duplicatas por email
    const duplicateEmails = await client.query(`
      SELECT company_id, email, COUNT(*) as total
      FROM polox.contacts
      WHERE email IS NOT NULL AND email != ''
      GROUP BY company_id, email
      HAVING COUNT(*) > 1;
    `);
    
    if (duplicateEmails.rows.length > 0) {
      console.warn('   ⚠️  ATENÇÃO: Encontradas', duplicateEmails.rows.length, 'duplicatas por email');
      console.warn('   📋 Duplicatas:', JSON.stringify(duplicateEmails.rows, null, 2));
      throw new Error('Existem contatos duplicados por email. Limpe os dados antes de executar esta migration.');
    } else {
      console.log('   ✅ Nenhuma duplicata por email');
    }
    
    // 2.4: Verificar "contatos fantasmas" (sem nenhum identificador)
    const phantomContacts = await client.query(`
      SELECT id, company_id, nome
      FROM polox.contacts
      WHERE (phone IS NULL OR phone = '')
        AND (email IS NULL OR email = '')
        AND (document_number IS NULL OR document_number = '');
    `);
    
    if (phantomContacts.rows.length > 0) {
      console.warn('   ⚠️  ATENÇÃO: Encontrados', phantomContacts.rows.length, 'contatos fantasmas (sem identificador)');
      console.warn('   📋 Fantasmas:', JSON.stringify(phantomContacts.rows, null, 2));
      throw new Error('Existem contatos sem phone/email/document. Corrija os dados antes de executar esta migration.');
    } else {
      console.log('   ✅ Nenhum contato fantasma encontrado');
    }
    
    // ============================================================
    // FASE 3: ADICIONAR CONSTRAINTS DE UNICIDADE
    // ============================================================
    console.log('\n🔒 FASE 3: Adicionando constraints de unicidade...');
    
    // 3.1: UNIQUE (company_id, document_number)
    console.log('🔄 Verificando/criando constraint uk_contacts_company_document...');
    await client.query(`
      DO $$ 
      BEGIN
        ALTER TABLE polox.contacts
        ADD CONSTRAINT uk_contacts_company_document 
        UNIQUE (company_id, document_number);
        RAISE NOTICE '   ✅ Constraint uk_contacts_company_document criada';
      EXCEPTION 
        WHEN duplicate_object THEN
          RAISE NOTICE '   ℹ️  Constraint uk_contacts_company_document já existe';
        WHEN duplicate_table THEN
          RAISE NOTICE '   ℹ️  Constraint uk_contacts_company_document já existe (index)';
      END $$;
    `);
    console.log('   ✅ Constraint uk_contacts_company_document processada');
    
    // 3.2: UNIQUE (company_id, phone)
    console.log('🔄 Verificando/criando constraint uk_contacts_company_phone...');
    await client.query(`
      DO $$ 
      BEGIN
        ALTER TABLE polox.contacts
        ADD CONSTRAINT uk_contacts_company_phone 
        UNIQUE (company_id, phone);
        RAISE NOTICE '   ✅ Constraint uk_contacts_company_phone criada';
      EXCEPTION 
        WHEN duplicate_object THEN
          RAISE NOTICE '   ℹ️  Constraint uk_contacts_company_phone já existe';
        WHEN duplicate_table THEN
          RAISE NOTICE '   ℹ️  Constraint uk_contacts_company_phone já existe (index)';
      END $$;
    `);
    console.log('   ✅ Constraint uk_contacts_company_phone processada');
    
    // 3.3: UNIQUE (company_id, email)
    console.log('🔄 Verificando/criando constraint uk_contacts_company_email...');
    await client.query(`
      DO $$ 
      BEGIN
        ALTER TABLE polox.contacts
        ADD CONSTRAINT uk_contacts_company_email 
        UNIQUE (company_id, email);
        RAISE NOTICE '   ✅ Constraint uk_contacts_company_email criada';
      EXCEPTION 
        WHEN duplicate_object THEN
          RAISE NOTICE '   ℹ️  Constraint uk_contacts_company_email já existe';
        WHEN duplicate_table THEN
          RAISE NOTICE '   ℹ️  Constraint uk_contacts_company_email já existe (index)';
      END $$;
    `);
    console.log('   ✅ Constraint uk_contacts_company_email processada');
    
    // ============================================================
    // FASE 4: ADICIONAR CHECK CONSTRAINT "ANTI-FANTASMA"
    // ============================================================
    console.log('\n🚫 FASE 4: Adicionando constraint CHECK anti-fantasma...');
    console.log('🔄 Verificando/criando constraint chk_contact_has_identifier...');
    await client.query(`
      DO $$ 
      BEGIN
        ALTER TABLE polox.contacts
        ADD CONSTRAINT chk_contact_has_identifier
        CHECK (
          (phone IS NOT NULL AND phone != '') OR
          (email IS NOT NULL AND email != '') OR
          (document_number IS NOT NULL AND document_number != '')
        );
        RAISE NOTICE '   ✅ Constraint chk_contact_has_identifier criada';
      EXCEPTION 
        WHEN duplicate_object THEN
          RAISE NOTICE '   ℹ️  Constraint chk_contact_has_identifier já existe';
      END $$;
    `);
    console.log('   ✅ Constraint chk_contact_has_identifier processada');
    console.log('   ℹ️  Agora é IMPOSSÍVEL criar contatos sem phone/email/document');
    
    // ============================================================
    // RESUMO FINAL
    // ============================================================
    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║  ✅ Migration 036 CONCLUÍDA COM SUCESSO!                      ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');
    console.log('\n📊 CONSTRAINTS ADICIONADAS:');
    console.log('   1. ✅ uk_contacts_company_document (UNIQUE company_id + document_number)');
    console.log('   2. ✅ uk_contacts_company_phone (UNIQUE company_id + phone)');
    console.log('   3. ✅ uk_contacts_company_email (UNIQUE company_id + email)');
    console.log('   4. ✅ chk_contact_has_identifier (CHECK anti-fantasma)');
    console.log('\n🎯 RESULTADO:');
    console.log('   - Duplicidade ZERO por empresa (company_id)');
    console.log('   - Extensão WhatsApp: 1 telefone = 1 contato (problema RESOLVIDO)');
    console.log('   - Landing Pages: 1 e-mail = 1 contato');
    console.log('   - Contratos: 1 CPF/CNPJ = 1 contato');
    console.log('   - Contatos fantasmas: BLOQUEADOS');
    console.log('\n🔥 PRÓXIMO PASSO: Migration 037 (adicionar owner_id)');
    
  } catch (error) {
    console.error('\n❌ ERRO na Migration 036:', error.message);
    throw error;
  }
};

const down = async (client) => {
  console.log('🔙 Revertendo Migration 036: Removendo Constraints de Unicidade...');
  
  try {
    // Remover CHECK constraint
    console.log('🔄 Removendo constraint chk_contact_has_identifier...');
    await client.query(`
      ALTER TABLE polox.contacts
      DROP CONSTRAINT IF EXISTS chk_contact_has_identifier;
    `);
    console.log('   ✅ Constraint chk_contact_has_identifier removida');
    
    // Remover UNIQUE constraints
    console.log('🔄 Removendo constraint uk_contacts_company_email...');
    await client.query(`
      ALTER TABLE polox.contacts
      DROP CONSTRAINT IF EXISTS uk_contacts_company_email;
    `);
    console.log('   ✅ Constraint uk_contacts_company_email removida');
    
    console.log('🔄 Removendo constraint uk_contacts_company_phone...');
    await client.query(`
      ALTER TABLE polox.contacts
      DROP CONSTRAINT IF EXISTS uk_contacts_company_phone;
    `);
    console.log('   ✅ Constraint uk_contacts_company_phone removida');
    
    console.log('🔄 Removendo constraint uk_contacts_company_document...');
    await client.query(`
      ALTER TABLE polox.contacts
      DROP CONSTRAINT IF EXISTS uk_contacts_company_document;
    `);
    console.log('   ✅ Constraint uk_contacts_company_document removida');
    
    // Nota: NÃO removemos as colunas document_number e document_type
    // porque podem ter dados importantes
    console.log('\n⚠️  NOTA: Colunas document_number e document_type NÃO foram removidas');
    console.log('   (podem conter dados importantes)');
    
    console.log('\n✅ Rollback da Migration 036 concluído');
    
  } catch (error) {
    console.error('\n❌ ERRO no rollback da Migration 036:', error.message);
    throw error;
  }
};

module.exports = { up, down };
