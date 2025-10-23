/**
 * Migration 020: Refatorar tabela polox.sales - Normalizar tags e remover notes
 *
 * Objetivo: Remover campos notes (TEXT) e tags (JSONB), criar tabela pivot sale_tags
 *
 * Changes:
 * - Remove colunas notes e tags da tabela sales
 * - Cria tabela polox.sale_tags (pivot table)
 * - Migra dados existentes de tags JSONB para tabela pivot
 * - Notes será removido (pode ser recriado como sale_notes se necessário)
 * - Adiciona constraints e índices para performance
 *
 * Data: 2025-10-23
 */

const { query, transaction } = require("../src/config/database");

/**
 * Aplica a migration
 */
async function up(client) {
  console.log(
    "🔄 Iniciando Migration 020: Refatorar tabela sales - tags e notes..."
  );

  try {
    // 1. Criar tabela pivot sale_tags
    console.log("📋 Criando tabela polox.sale_tags...");
    await client.query(`
        CREATE TABLE IF NOT EXISTS polox.sale_tags (
          sale_id BIGINT NOT NULL,
          tag_id BIGINT NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          
          PRIMARY KEY (sale_id, tag_id),
          
          CONSTRAINT fk_sale_tags_sale
            FOREIGN KEY (sale_id) 
            REFERENCES polox.sales(id) 
            ON DELETE CASCADE,
          
          CONSTRAINT fk_sale_tags_tag
            FOREIGN KEY (tag_id) 
            REFERENCES polox.tags(id) 
            ON DELETE CASCADE
        )
      `);

    // 2. Criar índices para performance
    console.log("📊 Criando índices na tabela sale_tags...");
    await client.query(`
        CREATE INDEX IF NOT EXISTS idx_sale_tags_sale_id 
        ON polox.sale_tags(sale_id)
      `);

    await client.query(`
        CREATE INDEX IF NOT EXISTS idx_sale_tags_tag_id 
        ON polox.sale_tags(tag_id)
      `);

    // 3. Verificar se existe coluna tags para migrar dados
    console.log("🔄 Verificando se existe coluna tags para migrar...");

    const hasTagsColumn = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'polox' AND table_name = 'sales' AND column_name = 'tags'
      `);

    if (hasTagsColumn.rows.length > 0) {
      console.log("📋 Coluna tags encontrada, migrando dados...");

      // Buscar vendas com tags
      const salesWithTags = await client.query(`
          SELECT id, tags, company_id
          FROM polox.sales
          WHERE tags IS NOT NULL 
            AND tags != 'null'::jsonb 
            AND jsonb_array_length(tags) > 0
            AND deleted_at IS NULL
        `);

      console.log(
        `   Encontradas ${salesWithTags.rows.length} vendas com tags para migrar`
      );
    } else {
      console.log(
        "⚠️  Coluna tags não existe na tabela sales - pulando migração de dados"
      );
      console.log("   A tabela sale_tags foi criada e está pronta para uso");
    }

    let totalTagsMigrated = 0;

    if (hasTagsColumn.rows.length > 0) {
      // Só executa migração se a coluna tags existir
      const salesWithTags = await client.query(`
          SELECT id, tags, company_id
          FROM polox.sales
          WHERE tags IS NOT NULL 
            AND tags != 'null'::jsonb 
            AND jsonb_array_length(tags) > 0
            AND deleted_at IS NULL
        `);

      for (const sale of salesWithTags.rows) {
        const tagsArray = sale.tags;

        if (Array.isArray(tagsArray) && tagsArray.length > 0) {
          for (const tagName of tagsArray) {
            if (
              tagName &&
              typeof tagName === "string" &&
              tagName.trim() !== ""
            ) {
              // Inserir tag na tabela polox.tags se não existir
              const tagResult = await client.query(
                `
                  INSERT INTO polox.tags (name, slug, company_id, created_at, updated_at)
                  VALUES ($1, $2, $3, NOW(), NOW())
                  ON CONFLICT (company_id, name, slug) 
                  WHERE company_id IS NOT NULL 
                  DO UPDATE SET name = EXCLUDED.name
                  RETURNING id
                `,
                [
                  tagName.trim(),
                  tagName.trim().toLowerCase().replace(/\s+/g, "-"),
                  sale.company_id,
                ]
              );

              const tagId = tagResult.rows[0].id;

              // Associar venda à tag na tabela pivot
              await client.query(
                `
                  INSERT INTO polox.sale_tags (sale_id, tag_id, created_at)
                  VALUES ($1, $2, NOW())
                  ON CONFLICT (sale_id, tag_id) DO NOTHING
                `,
                [sale.id, tagId]
              );

              totalTagsMigrated++;
            }
          }
        }
      }
    }

    console.log(
      `   ✅ Total de ${totalTagsMigrated} tags migradas com sucesso`
    );

    // 4. Verificar se há vendas com notes para alertar
    const hasNotesColumn = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'polox' AND table_name = 'sales' AND column_name = 'notes'
      `);

    if (hasNotesColumn.rows.length > 0) {
      const salesWithNotes = await client.query(`
          SELECT COUNT(*) as total
          FROM polox.sales
          WHERE notes IS NOT NULL 
            AND notes != '' 
            AND deleted_at IS NULL
        `);

      const notesCount = parseInt(salesWithNotes.rows[0].total);
      if (notesCount > 0) {
        console.log(
          `   ⚠️  ATENÇÃO: ${notesCount} vendas possuem notes que serão removidos`
        );
        console.log(
          `   💡 Se necessário, crie uma tabela sale_notes antes de executar esta migration`
        );
      }
    } else {
      console.log(
        "ℹ️  Coluna notes não existe na tabela sales - nada para alertar"
      );
    }

    // 5. Remover colunas notes e tags da tabela sales
    console.log("🗑️  Removendo colunas notes e tags da tabela sales...");
    await client.query(`
        ALTER TABLE polox.sales 
        DROP COLUMN IF EXISTS notes
      `);

    await client.query(`
        ALTER TABLE polox.sales 
        DROP COLUMN IF EXISTS tags
      `);

    console.log("✅ Migration 020 concluída com sucesso!");
  } catch (error) {
    console.error("❌ Erro na Migration 020:", error);
    throw error;
  }
}

/**
 * Reverte a migration
 */
async function down(client) {
  console.log("🔄 Revertendo Migration 020: Refatorar tabela sales...");

  try {
    // 1. Recriar colunas notes e tags na tabela sales
    console.log("📋 Recriando colunas notes e tags na tabela sales...");
    await client.query(`
        ALTER TABLE polox.sales 
        ADD COLUMN IF NOT EXISTS notes TEXT
      `);

    await client.query(`
        ALTER TABLE polox.sales 
        ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '[]'::jsonb
      `);

    // 2. Migrar tags de volta da tabela pivot para JSONB
    console.log("🔄 Migrando tags de volta para JSONB...");

    const salesWithPivotTags = await client.query(`
        SELECT DISTINCT sale_id
        FROM polox.sale_tags
      `);

    for (const row of salesWithPivotTags.rows) {
      const saleId = row.sale_id;

      // Buscar tags da venda
      const tagsResult = await client.query(
        `
          SELECT t.name
          FROM polox.tags t
          INNER JOIN polox.sale_tags st ON t.id = st.tag_id
          WHERE st.sale_id = $1
          ORDER BY t.name
        `,
        [saleId]
      );

      const tagNames = tagsResult.rows.map((r) => r.name);

      // Atualizar coluna tags com array JSON
      await client.query(
        `
          UPDATE polox.sales
          SET tags = $1::jsonb
          WHERE id = $2
        `,
        [JSON.stringify(tagNames), saleId]
      );
    }

    console.log(
      `   ✅ Tags migradas de volta para ${salesWithPivotTags.rows.length} vendas`
    );

    // 3. Remover tabela pivot (CASCADE remove índices automaticamente)
    console.log("🗑️  Removendo tabela sale_tags...");
    await client.query(`
        DROP TABLE IF EXISTS polox.sale_tags CASCADE
      `);

    console.log(
      "⚠️  ATENÇÃO: Coluna notes foi recriada vazia (dados não podem ser restaurados)"
    );
    console.log("✅ Migration 020 revertida com sucesso!");
  } catch (error) {
    console.error("❌ Erro ao reverter Migration 020:", error);
    throw error;
  }
}

module.exports = { up, down };
