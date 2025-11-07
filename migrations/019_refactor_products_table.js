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
 * Migration 019: Refatorar tabela polox.products - Normalizar tags
 *
 * Objetivo: Remover campo tags (JSONB) e criar tabela pivot product_tags
 *
 * Changes:
 * - Remove coluna tags da tabela products
 * - Cria tabela polox.product_tags (pivot table)
 * - Migra dados existentes de tags JSONB para tabela pivot
 * - Adiciona constraints e índices para performance
 *
 * Data: 2025-10-23
 */

const { query } = require("../src/config/database");

/**
 * Aplica a migration
 */
async function up(client) {
  console.log(
    "🔄 Iniciando Migration 019: Refatorar tabela products - tags..."
  );

  try {
    // 1. Criar tabela pivot product_tags
    console.log("📋 Criando tabela polox.product_tags...");
    await client.query(`
        CREATE TABLE IF NOT EXISTS polox.product_tags (
          product_id BIGINT NOT NULL,
          tag_id BIGINT NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          
          PRIMARY KEY (product_id, tag_id),
          
          CONSTRAINT fk_product_tags_product
            FOREIGN KEY (product_id) 
            REFERENCES polox.products(id) 
            ON DELETE CASCADE,
          
          CONSTRAINT fk_product_tags_tag
            FOREIGN KEY (tag_id) 
            REFERENCES polox.tags(id) 
            ON DELETE CASCADE
        )
      `);

    // 2. Criar índices para performance
    console.log("📊 Criando índices na tabela product_tags...");
    await client.query(`
        CREATE INDEX IF NOT EXISTS idx_product_tags_product_id 
        ON polox.product_tags(product_id)
      `);

    await client.query(`
        CREATE INDEX IF NOT EXISTS idx_product_tags_tag_id 
        ON polox.product_tags(tag_id)
      `);

    // 3. Verificar se existe coluna tags para migrar dados
    console.log("🔄 Verificando se existe coluna tags para migrar...");

    const hasTagsColumn = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'polox' AND table_name = 'products' AND column_name = 'tags'
      `);

    if (hasTagsColumn.rows.length > 0) {
      console.log("📋 Coluna tags encontrada, migrando dados...");

      // Buscar produtos com tags
      const productsWithTags = await client.query(`
          SELECT id, tags, company_id
          FROM polox.products
          WHERE tags IS NOT NULL 
            AND tags != 'null'::jsonb 
            AND jsonb_array_length(tags) > 0
            AND deleted_at IS NULL
        `);

      console.log(
        `   Encontrados ${productsWithTags.rows.length} produtos com tags para migrar`
      );
    } else {
      console.log(
        "⚠️  Coluna tags não existe na tabela products - pulando migração de dados"
      );
      console.log("   A tabela product_tags foi criada e está pronta para uso");
    }

    let totalTagsMigrated = 0;

    if (hasTagsColumn.rows.length > 0) {
      // Só executa migração se a coluna tags existir
      const productsWithTags = await client.query(`
        SELECT id, tags, company_id
        FROM polox.products
        WHERE tags IS NOT NULL 
          AND tags != 'null'::jsonb 
          AND jsonb_array_length(tags) > 0
          AND deleted_at IS NULL
      `);

      for (const product of productsWithTags.rows) {
        const tagsArray = product.tags;

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
                  product.company_id,
                ]
              );

              const tagId = tagResult.rows[0].id;

              // Associar produto à tag na tabela pivot
              await client.query(
                `
                  INSERT INTO polox.product_tags (product_id, tag_id, created_at)
                  VALUES ($1, $2, NOW())
                  ON CONFLICT (product_id, tag_id) DO NOTHING
                `,
                [product.id, tagId]
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

    // 4. Remover coluna tags da tabela products
    console.log("🗑️  Removendo coluna tags da tabela products...");
    await client.query(`
        ALTER TABLE polox.products 
        DROP COLUMN IF EXISTS tags
      `);

    console.log("✅ Migration 019 concluída com sucesso!");
  } catch (error) {
    console.error("❌ Erro na Migration 019:", error);
    throw error;
  }
}

/**
 * Reverte a migration
 */
async function down(client) {
  console.log("🔄 Revertendo Migration 019: Refatorar tabela products...");

  try {
    // 1. Recriar coluna tags na tabela products
    console.log("📋 Recriando coluna tags na tabela products...");
    await client.query(`
      ALTER TABLE polox.products 
      ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '[]'::jsonb
    `);

    // 2. Migrar tags de volta da tabela pivot para JSONB
    console.log("🔄 Migrando tags de volta para JSONB...");

    const productsWithPivotTags = await client.query(`
        SELECT DISTINCT product_id
        FROM polox.product_tags
      `);

    for (const row of productsWithPivotTags.rows) {
      const productId = row.product_id;

      // Buscar tags do produto
      const tagsResult = await client.query(
        `
          SELECT t.name
          FROM polox.tags t
          INNER JOIN polox.product_tags pt ON t.id = pt.tag_id
          WHERE pt.product_id = $1
          ORDER BY t.name
        `,
        [productId]
      );

      const tagNames = tagsResult.rows.map((r) => r.name);

      // Atualizar coluna tags com array JSON
      await client.query(
        `
          UPDATE polox.products
          SET tags = $1::jsonb
          WHERE id = $2
        `,
        [JSON.stringify(tagNames), productId]
      );
    }

    console.log(
      `   ✅ Tags migradas de volta para ${productsWithPivotTags.rows.length} produtos`
    );

    // 3. Remover tabela pivot (CASCADE remove índices automaticamente)
    console.log("🗑️  Removendo tabela product_tags...");
    await client.query(`
        DROP TABLE IF EXISTS polox.product_tags CASCADE
      `);

    console.log("✅ Migration 019 revertida com sucesso!");
  } catch (error) {
    console.error("❌ Erro ao reverter Migration 019:", error);
    throw error;
  }
}

module.exports = { up, down };
