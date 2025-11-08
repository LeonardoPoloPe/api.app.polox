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
 * Migration: 043 - Adicionar campo root_only_access aos menu_items
 *
 * Adiciona controle de acesso exclusivo para usuários root:
 * - root_only_access: Define se o menu é visível apenas para usuários root (default: false)
 *
 * Este campo permite criar menus administrativos restritos que apenas
 * usuários com privilégios de root podem visualizar e acessar.
 */

module.exports = {
  up: async (client) => {
    console.log("🔄 Adicionando campo root_only_access à tabela menu_items...");

    // Adicionar coluna root_only_access
    await client.query(`
      ALTER TABLE polox.menu_items
      ADD COLUMN root_only_access BOOLEAN NOT NULL DEFAULT false;
    `);

    console.log("✅ Coluna root_only_access adicionada");

    // Adicionar comentário na coluna
    await client.query(`
      COMMENT ON COLUMN polox.menu_items.root_only_access IS 'Define se o menu é visível apenas para usuários root/administradores';
    `);

    console.log("✅ Comentário adicionado");

    // Criar índice para otimizar consultas por root_only_access
    await client.query(`
      CREATE INDEX idx_menu_items_root_only_access 
      ON polox.menu_items(root_only_access) 
      WHERE deleted_at IS NULL;
    `);

    console.log("✅ Índice idx_menu_items_root_only_access criado");

    console.log("✅ Migration 043 concluída com sucesso!");
  },

  down: async (client) => {
    console.log("🔄 Revertendo migration 043...");

    // Remover índice
    await client.query(`
      DROP INDEX IF EXISTS polox.idx_menu_items_root_only_access;
    `);

    console.log("✅ Índice removido");

    // Remover coluna
    await client.query(`
      ALTER TABLE polox.menu_items
      DROP COLUMN IF EXISTS root_only_access;
    `);

    console.log("✅ Coluna root_only_access removida");

    console.log("✅ Migration 043 revertida com sucesso!");
  },
};
