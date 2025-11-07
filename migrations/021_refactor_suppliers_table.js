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
 * Migration 021: Refatorar tabela polox.suppliers - Normalizar tags e remover notes
 * 
 * Objetivo: Remover campos notes (TEXT) e tags (JSONB), criar tabela pivot supplier_tags
 * 
 * Changes:
 * - Remove colunas notes e tags da tabela suppliers
 * - Cria tabela polox.supplier_tags (pivot table)
 * - Migra dados existentes de tags JSONB para tabela pivot
 * - Notes será removido (pode ser recriado como supplier_notes se necessário)
 * - Adiciona constraints e índices para performance
 * 
 * Data: 2025-10-23
 */

const { query, transaction } = require('../src/config/database');

/**
 * Aplica a migration
 */
async function up(client) {
  console.log('🔄 Iniciando Migration 021: Refatorar tabela suppliers - tags e notes...');

  try {
    // 1. Criar tabela pivot supplier_tags
    console.log('📋 Criando tabela polox.supplier_tags...');
    await client.query(`
        CREATE TABLE IF NOT EXISTS polox.supplier_tags (
          supplier_id BIGINT NOT NULL,
          tag_id BIGINT NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          
          PRIMARY KEY (supplier_id, tag_id),
          
          CONSTRAINT fk_supplier_tags_supplier
            FOREIGN KEY (supplier_id) 
            REFERENCES polox.suppliers(id) 
            ON DELETE CASCADE,
          
          CONSTRAINT fk_supplier_tags_tag
            FOREIGN KEY (tag_id) 
            REFERENCES polox.tags(id) 
            ON DELETE CASCADE
        )
      `);

      // 2. Criar índices para performance
      console.log('📊 Criando índices na tabela supplier_tags...');
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_supplier_tags_supplier_id 
        ON polox.supplier_tags(supplier_id)
      `);

      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_supplier_tags_tag_id 
        ON polox.supplier_tags(tag_id)
      `);

      // 3. Migrar tags existentes do JSONB para tabela pivot
      console.log('🔄 Migrando tags existentes de JSONB para tabela pivot...');
      
      // Verificar se a coluna tags existe antes de tentar migrar
      const columnCheck = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'polox' 
          AND table_name = 'suppliers' 
          AND column_name = 'tags'
      `);

      if (columnCheck.rows.length > 0) {
        // Buscar fornecedores com tags
        const suppliersWithTags = await client.query(`
          SELECT id, tags, company_id
          FROM polox.suppliers
          WHERE tags IS NOT NULL 
            AND tags != 'null'::jsonb 
            AND jsonb_array_length(tags) > 0
            AND deleted_at IS NULL
        `);

        console.log(`   Encontrados ${suppliersWithTags.rows.length} fornecedores com tags para migrar`);

        let totalTagsMigrated = 0;

        for (const supplier of suppliersWithTags.rows) {
          const tagsArray = supplier.tags;
          
          if (Array.isArray(tagsArray) && tagsArray.length > 0) {
            for (const tagName of tagsArray) {
              if (tagName && typeof tagName === 'string' && tagName.trim() !== '') {
                // Inserir tag na tabela polox.tags se não existir
                const tagResult = await client.query(`
                  INSERT INTO polox.tags (name, slug, company_id, created_at, updated_at)
                  VALUES ($1, $2, $3, NOW(), NOW())
                  ON CONFLICT (company_id, name, slug) 
                  WHERE company_id IS NOT NULL 
                  DO UPDATE SET name = EXCLUDED.name
                  RETURNING id
                `, [
                  tagName.trim(),
                  tagName.trim().toLowerCase().replace(/\s+/g, '-'),
                  supplier.company_id
                ]);

                const tagId = tagResult.rows[0].id;

                // Associar fornecedor à tag na tabela pivot
                await client.query(`
                  INSERT INTO polox.supplier_tags (supplier_id, tag_id, created_at)
                  VALUES ($1, $2, NOW())
                  ON CONFLICT (supplier_id, tag_id) DO NOTHING
                `, [supplier.id, tagId]);

                totalTagsMigrated++;
              }
            }
          }
        }

        console.log(`   ✅ Total de ${totalTagsMigrated} tags migradas com sucesso`);
      } else {
        console.log(`   ℹ️  Coluna 'tags' não existe na tabela suppliers (já foi removida)`);
      }

      // 4. Verificar se há fornecedores com notes para alertar
      const notesColumnCheck = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'polox' 
          AND table_name = 'suppliers' 
          AND column_name = 'notes'
      `);

      if (notesColumnCheck.rows.length > 0) {
        const suppliersWithNotes = await client.query(`
          SELECT COUNT(*) as total
          FROM polox.suppliers
          WHERE notes IS NOT NULL 
            AND notes != '' 
            AND deleted_at IS NULL
        `);

        const notesCount = parseInt(suppliersWithNotes.rows[0].total);
        if (notesCount > 0) {
          console.log(`   ⚠️  ATENÇÃO: ${notesCount} fornecedores possuem notes que serão removidos`);
          console.log(`   💡 Se necessário, crie uma tabela supplier_notes antes de executar esta migration`);
        }
      }

      // 5. Remover colunas notes e tags da tabela suppliers
      console.log('🗑️  Removendo colunas notes e tags da tabela suppliers...');
      await client.query(`
        ALTER TABLE polox.suppliers 
        DROP COLUMN IF EXISTS notes
      `);

      await client.query(`
        ALTER TABLE polox.suppliers 
        DROP COLUMN IF EXISTS tags
      `);

      console.log('✅ Migration 021 concluída com sucesso!');
  } catch (error) {
    console.error('❌ Erro na Migration 021:', error);
    throw error;
  }
}

/**
 * Reverte a migration
 */
async function down(client) {
  console.log('🔄 Revertendo Migration 021: Refatorar tabela suppliers...');

  try {
    // 1. Recriar colunas notes e tags na tabela suppliers
    console.log('📋 Recriando colunas notes e tags na tabela suppliers...');
    await client.query(`
        ALTER TABLE polox.suppliers 
        ADD COLUMN IF NOT EXISTS notes TEXT
      `);

      await client.query(`
        ALTER TABLE polox.suppliers 
        ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '[]'::jsonb
      `);

      // 2. Migrar tags de volta da tabela pivot para JSONB
      console.log('🔄 Migrando tags de volta para JSONB...');
      
      const suppliersWithPivotTags = await client.query(`
        SELECT DISTINCT supplier_id
        FROM polox.supplier_tags
      `);

      for (const row of suppliersWithPivotTags.rows) {
        const supplierId = row.supplier_id;

        // Buscar tags do fornecedor
        const tagsResult = await client.query(`
          SELECT t.name
          FROM polox.tags t
          INNER JOIN polox.supplier_tags st ON t.id = st.tag_id
          WHERE st.supplier_id = $1
          ORDER BY t.name
        `, [supplierId]);

        const tagNames = tagsResult.rows.map(r => r.name);

        // Atualizar coluna tags com array JSON
        await client.query(`
          UPDATE polox.suppliers
          SET tags = $1::jsonb
          WHERE id = $2
        `, [JSON.stringify(tagNames), supplierId]);
      }

      console.log(`   ✅ Tags migradas de volta para ${suppliersWithPivotTags.rows.length} fornecedores`);

      // 3. Remover tabela pivot (CASCADE remove índices automaticamente)
      console.log('🗑️  Removendo tabela supplier_tags...');
      await client.query(`
        DROP TABLE IF EXISTS polox.supplier_tags CASCADE
      `);

      console.log('⚠️  ATENÇÃO: Coluna notes foi recriada vazia (dados não podem ser restaurados)');
      console.log('✅ Migration 021 revertida com sucesso!');
  } catch (error) {
    console.error('❌ Erro ao reverter Migration 021:', error);
    throw error;
  }
}

module.exports = { up, down };
