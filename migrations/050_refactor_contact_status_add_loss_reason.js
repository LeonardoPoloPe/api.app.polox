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
 * Migration: 050 - Refatorar status de contatos e adicionar loss_reason
 *
 * OBJETIVO: Higienizar o funil de vendas separando triagem de negociação
 *
 * MUDANÇAS:
 * 1. Adicionar coluna 'loss_reason' (TEXT, nullable)
 *    - Armazena o motivo de perda/descarte do lead
 *    - Obrigatório quando status = 'perdido' ou 'descartado'
 *
 * 2. Refatorar status para focar apenas em triagem:
 *    - REMOVER: 'proposta_enviada', 'em_negociacao', 'fechado'
 *    - MANTER: 'novo', 'em_contato', 'qualificado', 'perdido'
 *    - ADICIONAR: 'descartado'
 *
 * 3. Migração de dados:
 *    - Status removidos são mapeados para novos status equivalentes
 *    - Leads com status antigos recebem motivo automático em loss_reason
 *
 * ESTRATÉGIA DE MIGRAÇÃO:
 * - 'proposta_enviada' → 'qualificado' (lead avançou na triagem)
 * - 'em_negociacao' → 'qualificado' (lead avançou na triagem)
 * - 'fechado' → 'qualificado' (manter registro de sucesso, deal separado)
 *
 * ARQUITETURA NOVA:
 * - Contact.status: Fase de TRIAGEM do lead (novo → qualificado)
 * - Deal.status: Fase de NEGOCIAÇÃO (proposta → fechado)
 * - Separação clara: "Identidade vs. Intenção"
 */

module.exports = {
  up: async (client) => {
    console.log("🔄 Migration 050: Refatorando status de contatos...");

    // ====================================================================
    // PASSO 1: Adicionar coluna loss_reason
    // ====================================================================
    
    console.log("📝 Adicionando coluna loss_reason à tabela contacts...");
    
    await client.query(`
      ALTER TABLE polox.contacts
      ADD COLUMN IF NOT EXISTS loss_reason TEXT NULL;
    `);
    
    await client.query(`
      COMMENT ON COLUMN polox.contacts.loss_reason IS 
      'Motivo de perda ou descarte do lead. Obrigatório quando status = perdido ou descartado.';
    `);
    
    console.log("✅ Coluna loss_reason adicionada");

    // ====================================================================
    // PASSO 2: Migrar dados dos status antigos para novos
    // ====================================================================
    
    console.log("🔄 Migrando dados de status antigos para novos...");
    
    // 2.1. Migrar 'proposta_enviada' → 'qualificado'
    const proposta = await client.query(`
      UPDATE polox.contacts
      SET 
        status = 'qualificado',
        loss_reason = 'Status migrado automaticamente: proposta_enviada → qualificado (Migration 050)',
        updated_at = NOW()
      WHERE status = 'proposta_enviada'
        AND deleted_at IS NULL
      RETURNING id;
    `);
    console.log(`   ✅ Migrados ${proposta.rowCount} leads de 'proposta_enviada' → 'qualificado'`);
    
    // 2.2. Migrar 'em_negociacao' → 'qualificado'
    const negociacao = await client.query(`
      UPDATE polox.contacts
      SET 
        status = 'qualificado',
        loss_reason = 'Status migrado automaticamente: em_negociacao → qualificado (Migration 050)',
        updated_at = NOW()
      WHERE status = 'em_negociacao'
        AND deleted_at IS NULL
      RETURNING id;
    `);
    console.log(`   ✅ Migrados ${negociacao.rowCount} leads de 'em_negociacao' → 'qualificado'`);
    
    // 2.3. Migrar 'fechado' → 'qualificado' (sucesso registrado em Deal)
    const fechado = await client.query(`
      UPDATE polox.contacts
      SET 
        status = 'qualificado',
        loss_reason = 'Status migrado automaticamente: fechado → qualificado (Migration 050). Negociação registrada em Deal.',
        updated_at = NOW()
      WHERE status = 'fechado'
        AND deleted_at IS NULL
      RETURNING id;
    `);
    console.log(`   ✅ Migrados ${fechado.rowCount} leads de 'fechado' → 'qualificado'`);

    // ====================================================================
    // PASSO 3: Criar constraint CHECK para status permitidos
    // ====================================================================
    
    console.log("🔒 Criando constraint de validação de status...");
    
    // Remover constraint antiga se existir
    await client.query(`
      ALTER TABLE polox.contacts
      DROP CONSTRAINT IF EXISTS chk_contacts_status;
    `);
    
    // Criar nova constraint com status permitidos
    await client.query(`
      ALTER TABLE polox.contacts
      ADD CONSTRAINT chk_contacts_status
      CHECK (status IN ('novo', 'em_contato', 'qualificado', 'perdido', 'descartado'));
    `);
    
    console.log("✅ Constraint de status criada: ['novo', 'em_contato', 'qualificado', 'perdido', 'descartado']");

    // ====================================================================
    // PASSO 4: Criar índice para loss_reason (para análises)
    // ====================================================================
    
    console.log("📊 Criando índice para análise de motivos de perda...");
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_contacts_loss_reason
      ON polox.contacts (company_id, status, loss_reason)
      WHERE status IN ('perdido', 'descartado') 
        AND deleted_at IS NULL;
    `);
    
    console.log("✅ Índice idx_contacts_loss_reason criado");

    // ====================================================================
    // PASSO 5: Criar função helper para validação de loss_reason
    // ====================================================================
    
    console.log("🔧 Criando função de validação de loss_reason...");
    
    await client.query(`
      CREATE OR REPLACE FUNCTION polox.validate_contact_loss_reason()
      RETURNS TRIGGER AS $$
      BEGIN
        -- Se status for 'perdido' ou 'descartado', loss_reason é obrigatório
        IF NEW.status IN ('perdido', 'descartado') AND (NEW.loss_reason IS NULL OR TRIM(NEW.loss_reason) = '') THEN
          RAISE EXCEPTION 'loss_reason é obrigatório quando status = perdido ou descartado';
        END IF;
        
        -- Se status for outro, limpar loss_reason (não faz sentido)
        IF NEW.status NOT IN ('perdido', 'descartado') THEN
          NEW.loss_reason := NULL;
        END IF;
        
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
    
    await client.query(`
      DROP TRIGGER IF EXISTS trg_validate_contact_loss_reason ON polox.contacts;
      
      CREATE TRIGGER trg_validate_contact_loss_reason
      BEFORE INSERT OR UPDATE ON polox.contacts
      FOR EACH ROW
      EXECUTE FUNCTION polox.validate_contact_loss_reason();
    `);
    
    console.log("✅ Trigger de validação criado");

    // ====================================================================
    // PASSO 6: Atualizar comentários das colunas
    // ====================================================================
    
    await client.query(`
      COMMENT ON COLUMN polox.contacts.status IS 
      'Fase de TRIAGEM do lead (novo → qualificado). Status de NEGOCIAÇÃO ficam em Deal. Valores permitidos: novo, em_contato, qualificado, perdido, descartado';
    `);

    // ====================================================================
    // RESUMO
    // ====================================================================
    
    const totalMigrated = proposta.rowCount + negociacao.rowCount + fechado.rowCount;
    
    console.log("");
    console.log("✅ Migration 050 concluída com sucesso!");
    console.log("");
    console.log("📋 Resumo das alterações:");
    console.log("  ✅ Coluna loss_reason adicionada");
    console.log(`  ✅ ${totalMigrated} leads migrados para novos status`);
    console.log("  ✅ Constraint de status criada");
    console.log("  ✅ Índice de análise criado");
    console.log("  ✅ Trigger de validação criado");
    console.log("");
    console.log("📊 Status permitidos:");
    console.log("  ✅ novo - Lead novo, não contatado");
    console.log("  ✅ em_contato - Em processo de contato");
    console.log("  ✅ qualificado - Lead qualificado para negociação");
    console.log("  ✅ perdido - Lead perdido (loss_reason obrigatório)");
    console.log("  ✅ descartado - Lead descartado (loss_reason obrigatório)");
    console.log("");
    console.log("🎯 Próximos passos:");
    console.log("  1. Atualizar ContactController.js (Joi validation)");
    console.log("  2. Atualizar Contact.js (Model)");
    console.log("  3. Atualizar Swagger documentation");
    console.log("  4. Testar fluxo de perda/descarte no frontend");
  },

  down: async (client) => {
    console.log("🔄 Revertendo Migration 050...");
    
    // Remover trigger
    await client.query(`
      DROP TRIGGER IF EXISTS trg_validate_contact_loss_reason ON polox.contacts;
    `);
    
    await client.query(`
      DROP FUNCTION IF EXISTS polox.validate_contact_loss_reason();
    `);
    
    console.log("✅ Trigger e função removidos");
    
    // Remover índice
    await client.query(`
      DROP INDEX IF EXISTS polox.idx_contacts_loss_reason;
    `);
    
    console.log("✅ Índice removido");
    
    // Remover constraint
    await client.query(`
      ALTER TABLE polox.contacts
      DROP CONSTRAINT IF EXISTS chk_contacts_status;
    `);
    
    console.log("✅ Constraint removida");
    
    // Reverter dados (tentar voltar aos status originais se possível)
    await client.query(`
      UPDATE polox.contacts
      SET 
        status = 'proposta_enviada',
        loss_reason = NULL,
        updated_at = NOW()
      WHERE loss_reason LIKE '%proposta_enviada%'
        AND status = 'qualificado';
    `);
    
    await client.query(`
      UPDATE polox.contacts
      SET 
        status = 'em_negociacao',
        loss_reason = NULL,
        updated_at = NOW()
      WHERE loss_reason LIKE '%em_negociacao%'
        AND status = 'qualificado';
    `);
    
    await client.query(`
      UPDATE polox.contacts
      SET 
        status = 'fechado',
        loss_reason = NULL,
        updated_at = NOW()
      WHERE loss_reason LIKE '%fechado%'
        AND status = 'qualificado';
    `);
    
    console.log("✅ Dados revertidos (parcialmente)");
    
    // Remover coluna
    await client.query(`
      ALTER TABLE polox.contacts
      DROP COLUMN IF EXISTS loss_reason;
    `);
    
    console.log("✅ Coluna loss_reason removida");
    
    console.log("✅ Migration 050 revertida com sucesso!");
  },
};
