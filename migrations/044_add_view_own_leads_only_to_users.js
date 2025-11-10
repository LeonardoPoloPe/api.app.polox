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
 * Migration: 044 - Adicionar campo view_own_leads_only aos users
 *
 * Adiciona controle de visibilidade de leads:
 * - view_own_leads_only: Define se o usuário vê apenas seus próprios leads (default: false)
 *
 * Este campo permite restringir a visibilidade de leads por usuário.
 */

module.exports = {
  up: async (client) => {
    console.log("🔄 Adicionando campo view_own_leads_only à tabela users...");

    // Adicionar coluna view_own_leads_only
    await client.query(`
      ALTER TABLE polox.users
      ADD COLUMN view_own_leads_only BOOLEAN NOT NULL DEFAULT false;
    `);

    console.log("✅ Coluna view_own_leads_only adicionada");

    // Adicionar comentário na coluna
    await client.query(`
      COMMENT ON COLUMN polox.users.view_own_leads_only IS 'Controla visibilidade de leads: true = vê apenas próprios leads, false = pode ver leads de outros conforme permissões';
    `);

    console.log("✅ Comentário adicionado");

    // Criar índice para otimizar consultas por view_own_leads_only
    await client.query(`
      CREATE INDEX idx_users_view_own_leads_only 
      ON polox.users(view_own_leads_only) 
      WHERE deleted_at IS NULL;
    `);

    console.log("✅ Índice idx_users_view_own_leads_only criado");

    console.log("✅ Migration 044 concluída com sucesso!");
  },

  down: async (client) => {
    console.log("🔄 Revertendo migration 044...");

    // Remover índice
    await client.query(`
      DROP INDEX IF EXISTS polox.idx_users_view_own_leads_only;
    `);

    console.log("✅ Índice removido");

    // Remover coluna
    await client.query(`
      ALTER TABLE polox.users
      DROP COLUMN IF EXISTS view_own_leads_only;
    `);

    console.log("✅ Coluna view_own_leads_only removida");

    console.log("✅ Migration 044 revertida com sucesso!");
  },
};
