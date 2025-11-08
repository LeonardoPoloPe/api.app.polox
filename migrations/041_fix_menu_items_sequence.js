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
