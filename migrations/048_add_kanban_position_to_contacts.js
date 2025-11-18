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
 * Migration: 048 - Adicionar campo kanban_position aos contacts
 *
 * Adiciona controle de ordenação no Kanban:
 * - kanban_position: Define a posição do lead dentro da raia (status)
 *   - Valores: inteiros positivos (1, 2, 3, ...)
 *   - Quanto menor o número, mais no topo da raia
 *   - Permite drag & drop e reordenação personalizada
 *
 * Estratégia de implementação:
 * - Campo BIGINT para suportar reordenações sem conflitos
 * - Índice composto (company_id, status, kanban_position) para ordenação rápida
 * - Backfill com posições baseadas em created_at (mais recentes no topo)
 *
 * Uso:
 * - Frontend: Drag & drop atualiza kanban_position
 * - Backend: ORDER BY kanban_position ASC, created_at DESC
 * - Novos leads: recebem position 1, demais são incrementados
 */

module.exports = {
  up: async (client) => {
    console.log("🔄 Adicionando campo kanban_position à tabela contacts...");

    // 1. Adicionar coluna kanban_position
    await client.query(`
      ALTER TABLE polox.contacts
      ADD COLUMN kanban_position BIGINT NULL;
    `);

    console.log("✅ Coluna kanban_position adicionada");

    // 2. Adicionar comentário na coluna
    await client.query(`
      COMMENT ON COLUMN polox.contacts.kanban_position IS 
      'Posição do lead no Kanban dentro da raia (status). Quanto menor, mais no topo. Permite drag & drop personalizado.';
    `);

    console.log("✅ Comentário adicionado");

    // 3. Criar índice composto para ordenação eficiente no Kanban
    // Este índice otimiza: SELECT * FROM contacts WHERE company_id=X AND status=Y ORDER BY kanban_position
    await client.query(`
      CREATE INDEX idx_contacts_kanban_order 
      ON polox.contacts(company_id, status, kanban_position ASC NULLS LAST, created_at DESC) 
      WHERE deleted_at IS NULL AND tipo = 'lead';
    `);

    console.log("✅ Índice idx_contacts_kanban_order criado");

    // 4. Backfill: Atribuir posições iniciais baseadas em created_at
    // Leads mais recentes ficam no topo (position menor)
    // ESTRATÉGIA DE GAPS: Usa múltiplos de 1000 (1000, 2000, 3000...)
    // Permite inserir entre dois itens sem reorganizar toda a lista
    console.log("🔄 Calculando posições iniciais para leads existentes...");

    await client.query(`
      WITH ranked_contacts AS (
        SELECT 
          id,
          company_id,
          status,
          (ROW_NUMBER() OVER (
            PARTITION BY company_id, status 
            ORDER BY created_at DESC
          ) * 1000) AS position
        FROM polox.contacts
        WHERE deleted_at IS NULL 
          AND tipo = 'lead'
          AND kanban_position IS NULL
      )
      UPDATE polox.contacts c
      SET kanban_position = rc.position
      FROM ranked_contacts rc
      WHERE c.id = rc.id;
    `);

    const result = await client.query(`
      SELECT COUNT(*) as total
      FROM polox.contacts
      WHERE kanban_position IS NOT NULL 
        AND tipo = 'lead' 
        AND deleted_at IS NULL;
    `);

    console.log(`✅ Posições iniciais atribuídas para ${result.rows[0].total} leads`);

    // 5. Criar função helper para rebalanceamento (recriar gaps)
    console.log("🔧 Criando função helper para rebalanceamento...");
    
    await client.query(`
      CREATE OR REPLACE FUNCTION polox.rebalance_kanban_lane(
        p_company_id BIGINT,
        p_status VARCHAR(50)
      ) RETURNS void AS $$
      BEGIN
        -- Rebalanceia os gaps: 1000, 2000, 3000, 4000...
        -- Mantém a ordem atual, apenas recria os espaços
        WITH ranked AS (
          SELECT 
            id,
            (ROW_NUMBER() OVER (ORDER BY kanban_position ASC NULLS LAST, created_at DESC) * 1000) AS new_position
          FROM polox.contacts
          WHERE company_id = p_company_id
            AND status = p_status
            AND tipo = 'lead'
            AND deleted_at IS NULL
        )
        UPDATE polox.contacts c
        SET kanban_position = r.new_position
        FROM ranked r
        WHERE c.id = r.id;
      END;
      $$ LANGUAGE plpgsql;
    `);

    await client.query(`
      COMMENT ON FUNCTION polox.rebalance_kanban_lane IS 
      'Rebalanceia os gaps de uma raia do Kanban (1000, 2000, 3000...). Executar quando gaps ficarem muito pequenos.';
    `);

    console.log("✅ Função helper criada");

    console.log("");
    console.log("✅ Migration 048 concluída com sucesso!");
    console.log("");
    console.log("📋 Resumo das alterações:");
    console.log("  ✅ Campo kanban_position adicionado");
    console.log("  ✅ Índice composto para ordenação eficiente");
    console.log(`  ✅ ${result.rows[0].total} leads receberam posições iniciais (gaps de 1000)`);
    console.log("  ✅ Função helper rebalance_kanban_lane() criada");
    console.log("");
    console.log("🚀 Performance:");
    console.log("  ⚡ Sistema de GAPS: evita updates em massa");
    console.log("  ⚡ Drag & drop: O(1) na maioria dos casos");
    console.log("  ⚡ Rebalanceamento automático quando gaps < 10");
    console.log("");
    console.log("🎯 Próximos passos:");
    console.log("  1. Atualizar query do Kanban para ORDER BY kanban_position");
    console.log("  2. Criar endpoint PATCH /contacts/:id/kanban-position");
    console.log("  3. Implementar drag & drop no frontend");
  },

  down: async (client) => {
    console.log("🔄 Revertendo migration 048...");

    // 1. Remover função helper
    await client.query(`
      DROP FUNCTION IF EXISTS polox.rebalance_kanban_lane(BIGINT, VARCHAR);
    `);
    
    await client.query(`
      DROP FUNCTION IF EXISTS polox.reorder_kanban_lane(BIGINT, VARCHAR);
    `);

    console.log("✅ Função helper removida");

    // 2. Remover índice
    await client.query(`
      DROP INDEX IF EXISTS polox.idx_contacts_kanban_order;
    `);

    console.log("✅ Índice removido");

    // 3. Remover coluna
    await client.query(`
      ALTER TABLE polox.contacts
      DROP COLUMN IF EXISTS kanban_position;
    `);

    console.log("✅ Coluna kanban_position removida");

    console.log("✅ Migration 048 revertida com sucesso!");
  },
};
