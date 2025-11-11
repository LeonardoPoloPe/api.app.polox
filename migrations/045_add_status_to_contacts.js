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
 * Migration: 045 - Adicionar campo status aos contacts
 *
 * Adiciona controle de status do lead/cliente:
 * - status: Define o estágio atual do contato no funil de vendas
 *   Valores possíveis: novo, em_contato, qualificado, proposta_enviada,
 *   em_negociacao, fechado, perdido (default: novo)
 *
 * Este campo permite acompanhar a evolução dos contatos no pipeline de vendas.
 */

module.exports = {
  up: async (client) => {
    console.log("🔄 Adicionando campo status à tabela contacts...");

    // Adicionar coluna status
    await client.query(`
      ALTER TABLE polox.contacts
      ADD COLUMN status VARCHAR(50) NOT NULL DEFAULT 'novo';
    `);

    console.log("✅ Coluna status adicionada");

    // Adicionar constraint de validação para valores permitidos
    await client.query(`
      ALTER TABLE polox.contacts
      ADD CONSTRAINT chk_contacts_status 
        CHECK (status IN ('novo', 'em_contato', 'qualificado', 'proposta_enviada', 'em_negociacao', 'fechado', 'perdido'));
    `);

    console.log("✅ Constraint de validação adicionada");

    // Adicionar comentário na coluna
    await client.query(`
      COMMENT ON COLUMN polox.contacts.status IS 'Status do contato no pipeline: novo, em_contato, qualificado, proposta_enviada, em_negociacao, fechado, perdido';
    `);

    console.log("✅ Comentário adicionado");

    // Criar índice para otimizar consultas por status em registros ativos
    await client.query(`
      CREATE INDEX idx_contacts_status_active 
      ON polox.contacts(status) 
      WHERE deleted_at IS NULL;
    `);

    console.log("✅ Índice idx_contacts_status_active criado");

    // Backfill: definir status 'novo' para contatos existentes (já é o default)
    console.log("🔄 Aplicando status padrão aos contatos existentes...");

    await client.query(`
      UPDATE polox.contacts 
      SET status = 'novo' 
      WHERE status IS NULL AND deleted_at IS NULL;
    `);

    console.log("✅ Status padrão aplicado aos contatos existentes");

    console.log("✅ Migration 045 concluída com sucesso!");
  },

  down: async (client) => {
    console.log("🔄 Revertendo migration 045...");

    // Remover índice
    await client.query(`
      DROP INDEX IF EXISTS polox.idx_contacts_status_active;
    `);

    console.log("✅ Índice removido");

    // Remover constraint
    await client.query(`
      ALTER TABLE polox.contacts
      DROP CONSTRAINT IF EXISTS chk_contacts_status;
    `);

    console.log("✅ Constraint removida");

    // Remover coluna
    await client.query(`
      ALTER TABLE polox.contacts
      DROP COLUMN IF EXISTS status;
    `);

    console.log("✅ Coluna status removida");

    console.log("✅ Migration 045 revertida com sucesso!");
  },
};
