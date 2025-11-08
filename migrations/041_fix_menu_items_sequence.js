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
 * Migration: 041 - Fix menu_items sequence
 * Data: 2025-11-08
 * Descrição: Corrige a sequência do BIGSERIAL após inserções com IDs explícitos
 *
 * Problema: A migration 040 inseriu 17 menus com IDs explícitos (1-17),
 * mas não resetou a sequência. Ao tentar inserir novos registros,
 * PostgreSQL tenta usar IDs 1, 2, 3... que já existem, causando erro:
 * "duplicate key value violates unique constraint menu_items_pkey"
 *
 * Solução: Resetar a sequência para MAX(id) + 1
 */

module.exports = {
  up: async (client) => {
    console.log("🔄 Executando migration 041: Fix menu_items sequence...");

    // Resetar sequência do menu_items para o próximo ID disponível
    await client.query(`
      SELECT setval(
        pg_get_serial_sequence('polox.menu_items', 'id'),
        COALESCE(MAX(id), 1),
        true
      )
      FROM polox.menu_items;
    `);

    console.log("✅ Sequência de menu_items corrigida");

    // Também corrigir a sequência do profiles, por precaução
    await client.query(`
      SELECT setval(
        pg_get_serial_sequence('polox.profiles', 'id'),
        COALESCE(MAX(id), 1),
        true
      )
      FROM polox.profiles;
    `);

    console.log("✅ Sequência de profiles corrigida");

    console.log("✅ Migration 041 concluída com sucesso!");
  },

  down: async (client) => {
    console.log("🔄 Revertendo migration 041...");

    // Não há necessidade de reverter, mas podemos resetar para 1
    // (isso não afeta os dados existentes, apenas a próxima inserção)
    await client.query(`
      SELECT setval(
        pg_get_serial_sequence('polox.menu_items', 'id'),
        1,
        false
      );
    `);

    await client.query(`
      SELECT setval(
        pg_get_serial_sequence('polox.profiles', 'id'),
        1,
        false
      );
    `);

    console.log("✅ Rollback da migration 041 concluído");
  },
};
