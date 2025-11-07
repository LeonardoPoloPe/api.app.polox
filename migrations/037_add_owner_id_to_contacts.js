/**
 * ============================================================================
 * POLO X - Proprietary System / Sistema Proprietário
 * ============================================================================
 * 
 * Copyright (c) 2025 Polo X Manutencao de Equipamentos de Informatica LTDA
 * CNPJ: 55.419.946/0001-89
 * 
 * Legal Name / Razão Social: Polo X Manutencao de Equipamentos de Informatica LTDA
 * Trade Name / Nome Fantasia: Polo X
 * 
 * Developer / Desenvolvedor: Leonardo Polo Pereira
 * 
 * LICENSING STATUS / STATUS DE LICENCIAMENTO: Restricted Use / Uso Restrito
 * ALL RIGHTS RESERVED / TODOS OS DIREITOS RESERVADOS
 * 
 * This code is proprietary and confidential. It is strictly prohibited to:
 * Este código é proprietário e confidencial. É estritamente proibido:
 * - Copy, modify or distribute without express authorization
 * - Copiar, modificar ou distribuir sem autorização expressa
 * - Use or integrate in any other project
 * - Usar ou integrar em outros projetos
 * - Share with unauthorized third parties
 * - Compartilhar com terceiros não autorizados
 * 
 * Violations will be prosecuted under Brazilian Law:
 * Violações serão processadas conforme Lei Brasileira:
 * - Law 9.609/98 (Software Law / Lei do Software)
 * - Law 9.610/98 (Copyright Law / Lei de Direitos Autorais)
 * - Brazilian Penal Code Art. 184 (Código Penal Brasileiro Art. 184)
 * 
 * INPI Registration: In progress / Em andamento
 * 
 * For licensing / Para licenciamento: contato@polox.com.br
 * ============================================================================
 */

/**
 * Migration 037: Adicionar Coluna owner_id em Contacts
 * 
 * OBJETIVO: Rastrear o "dono" (vendedor responsável) de cada contato
 * - Quando um lead é criado, ele é atribuído a um vendedor (owner_id)
 * - Quando um deal é ganho, o contato herda o owner_id do deal
 * - Permite filtrar "Meus Contatos" e "Meus Clientes" por vendedor
 * 
 * MUDANÇAS:
 * 1. Adicionar coluna owner_id em polox.contacts
 * 2. Criar Foreign Key para polox.users(id)
 * 3. Criar Index para performance em filtros por owner
 * 
 * COMPORTAMENTO:
 * - ON DELETE SET NULL: Se o vendedor for deletado, o contato fica "órfão" (NULL)
 * - owner_id pode ser NULL (contatos criados antes desta migration)
 * 
 * REFERÊNCIA: docs/atividade/alteracao.md (Seção "Ajuste no Banco - owner_id")
 * 
 * Data: 2025-11-04
 * Autor: Leonardo Polo
 */

const up = async (client) => {
  console.log('🚀 Iniciando Migration 037: Adicionar owner_id em Contacts...');
  
  try {
    // ============================================================
    // FASE 1: VERIFICAR SE COLUNA JÁ EXISTE
    // ============================================================
    console.log('\n📋 FASE 1: Verificando se coluna owner_id já existe...');
    
    const ownerIdExists = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'polox' 
        AND table_name = 'contacts' 
        AND column_name = 'owner_id';
    `);
    
    if (ownerIdExists.rows.length > 0) {
      console.log('   ℹ️  Coluna owner_id já existe, pulando criação...');
      return;
    }
    
    // ============================================================
    // FASE 2: ADICIONAR COLUNA owner_id
    // ============================================================
    console.log('\n🔄 FASE 2: Adicionando coluna owner_id...');
    
    await client.query(`
      ALTER TABLE polox.contacts
      ADD COLUMN owner_id int8 NULL;
    `);
    console.log('   ✅ Coluna owner_id adicionada (tipo: int8, nullable: true)');
    
    // ============================================================
    // FASE 3: CRIAR FOREIGN KEY PARA users
    // ============================================================
    console.log('\n🔗 FASE 3: Criando Foreign Key para polox.users...');
    
    await client.query(`
      ALTER TABLE polox.contacts
      ADD CONSTRAINT fk_contacts_owner
      FOREIGN KEY (owner_id) 
      REFERENCES polox.users(id) 
      ON DELETE SET NULL;
    `);
    console.log('   ✅ Foreign Key fk_contacts_owner criada');
    console.log('   ℹ️  Comportamento: ON DELETE SET NULL (contato fica "órfão")');
    
    // ============================================================
    // FASE 4: CRIAR INDEX PARA PERFORMANCE
    // ============================================================
    console.log('\n📊 FASE 4: Criando Index para melhorar performance de filtros...');
    
    await client.query(`
      CREATE INDEX idx_contacts_owner_id 
      ON polox.contacts (owner_id);
    `);
    console.log('   ✅ Index idx_contacts_owner_id criado');
    console.log('   ℹ️  Queries do tipo "WHERE owner_id = X" serão muito mais rápidas');
    
    // ============================================================
    // FASE 5: CRIAR INDEX COMPOSTO (company_id + owner_id)
    // ============================================================
    console.log('\n📊 FASE 5: Criando Index composto para filtros multi-empresa...');
    
    await client.query(`
      CREATE INDEX idx_contacts_company_owner 
      ON polox.contacts (company_id, owner_id);
    `);
    console.log('   ✅ Index idx_contacts_company_owner criado');
    console.log('   ℹ️  Queries "Meus Contatos da Empresa X" serão otimizadas');
    
    // ============================================================
    // FASE 6: MIGRAR DADOS EXISTENTES (OPCIONAL)
    // ============================================================
    console.log('\n🔄 FASE 6: Verificando se há dados para migrar...');
    
    // Contar contatos existentes
    const contactCount = await client.query(`
      SELECT COUNT(*) as total FROM polox.contacts;
    `);
    const totalContacts = parseInt(contactCount.rows[0].total);
    
    if (totalContacts > 0) {
      console.log(`   ℹ️  Encontrados ${totalContacts} contatos existentes`);
      console.log('   ⚠️  owner_id ficará NULL para contatos existentes');
      console.log('   💡 DICA: Você pode atualizar manualmente depois:');
      console.log('      UPDATE polox.contacts SET owner_id = X WHERE ...');
    } else {
      console.log('   ℹ️  Nenhum contato existente, banco limpo');
    }
    
    // ============================================================
    // RESUMO FINAL
    // ============================================================
    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║  ✅ Migration 037 CONCLUÍDA COM SUCESSO!                      ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');
    console.log('\n📊 MUDANÇAS APLICADAS:');
    console.log('   1. ✅ Coluna owner_id adicionada (int8, nullable)');
    console.log('   2. ✅ Foreign Key fk_contacts_owner criada (→ users.id)');
    console.log('   3. ✅ Index idx_contacts_owner_id criado');
    console.log('   4. ✅ Index idx_contacts_company_owner criado (composto)');
    console.log('\n🎯 RESULTADO:');
    console.log('   - Cada contato agora pode ter um "dono" (vendedor responsável)');
    console.log('   - Filtros "Meus Contatos" / "Meus Clientes" habilitados');
    console.log('   - Performance otimizada para queries por owner');
    console.log('\n💡 USO NO CÓDIGO:');
    console.log('   - Criar contato: { ..., owner_id: req.user.id }');
    console.log('   - Ganhar deal: UPDATE contacts SET owner_id = deal.owner_id');
    console.log('   - Filtrar: WHERE owner_id = req.user.id');
    console.log('\n🔥 PRÓXIMO PASSO: Implementar endpoint get-or-create-with-negotiation');
    
  } catch (error) {
    console.error('\n❌ ERRO na Migration 037:', error.message);
    throw error;
  }
};

const down = async (client) => {
  console.log('🔙 Revertendo Migration 037: Removendo owner_id...');
  
  try {
    // Remover indexes
    console.log('🔄 Removendo index idx_contacts_company_owner...');
    await client.query(`
      DROP INDEX IF EXISTS polox.idx_contacts_company_owner;
    `);
    console.log('   ✅ Index idx_contacts_company_owner removido');
    
    console.log('🔄 Removendo index idx_contacts_owner_id...');
    await client.query(`
      DROP INDEX IF EXISTS polox.idx_contacts_owner_id;
    `);
    console.log('   ✅ Index idx_contacts_owner_id removido');
    
    // Remover Foreign Key
    console.log('🔄 Removendo Foreign Key fk_contacts_owner...');
    await client.query(`
      ALTER TABLE polox.contacts
      DROP CONSTRAINT IF EXISTS fk_contacts_owner;
    `);
    console.log('   ✅ Foreign Key fk_contacts_owner removida');
    
    // Remover coluna (⚠️ ATENÇÃO: Dados serão perdidos!)
    console.log('🔄 Removendo coluna owner_id...');
    await client.query(`
      ALTER TABLE polox.contacts
      DROP COLUMN IF EXISTS owner_id;
    `);
    console.log('   ✅ Coluna owner_id removida');
    console.log('   ⚠️  ATENÇÃO: Dados de propriedade (owner) foram perdidos!');
    
    console.log('\n✅ Rollback da Migration 037 concluído');
    
  } catch (error) {
    console.error('\n❌ ERRO no rollback da Migration 037:', error.message);
    throw error;
  }
};

module.exports = { up, down };
