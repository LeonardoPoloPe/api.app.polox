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
 * Migration 018: Refatorar tabela financial_transactions
 * 
 * Objetivos:
 * - Remover coluna notes (usar description em vez disso)
 * - Remover coluna tags (normalizar relacionamento)
 * - Criar tabela pivot financial_transaction_tags
 * 
 * Padrão:
 * - Usar description para notas/descrição da transação
 * - Relacionamento N:N entre financial_transactions e tags via financial_transaction_tags
 * 
 * Data: 2025-10-23
 */

const { query } = require('../src/config/database');

/**
 * Aplica as alterações (UP)
 */
async function up(client) {
  console.log('🔄 Iniciando migration 018: Refatorar tabela financial_transactions...');

  try {
    // 1. Criar tabela financial_transaction_tags ANTES de remover a coluna tags
    console.log('📋 Criando tabela polox.financial_transaction_tags...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS polox.financial_transaction_tags (
        financial_transaction_id BIGINT NOT NULL,
        tag_id BIGINT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        
        -- Primary key composta
        PRIMARY KEY (financial_transaction_id, tag_id),
        
        -- Foreign keys
        CONSTRAINT fk_financial_transaction_tags_transaction 
          FOREIGN KEY (financial_transaction_id) 
          REFERENCES polox.financial_transactions(id) 
          ON DELETE CASCADE,
        
        CONSTRAINT fk_financial_transaction_tags_tag 
          FOREIGN KEY (tag_id) 
          REFERENCES polox.tags(id) 
          ON DELETE CASCADE
      );
    `);
    console.log('✅ Tabela financial_transaction_tags criada');

    // 2. Criar índices para performance
    console.log('📌 Criando índices...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_financial_transaction_tags_transaction_id 
      ON polox.financial_transaction_tags(financial_transaction_id);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_financial_transaction_tags_tag_id 
      ON polox.financial_transaction_tags(tag_id);
    `);
    console.log('✅ Índices criados');

    // 3. Migrar dados existentes da coluna tags (se houver)
    console.log('🔄 Migrando dados da coluna tags...');
    
    // Verificar se a coluna tags existe
    const tagsColumnExists = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'polox' 
        AND table_name = 'financial_transactions' 
        AND column_name = 'tags'
    `);

    if (tagsColumnExists.rows.length > 0) {
      // Buscar transações com tags
      const transactionsWithTags = await client.query(`
        SELECT id, tags, company_id 
        FROM polox.financial_transactions 
        WHERE tags IS NOT NULL 
          AND tags != 'null'::jsonb 
          AND jsonb_array_length(tags) > 0
      `);

      console.log(`  📊 Encontrados ${transactionsWithTags.rows.length} transações com tags`);

      let migratedTags = 0;
      let errors = 0;

      for (const transaction of transactionsWithTags.rows) {
        try {
          const tagNames = transaction.tags; // Array de strings
          
          if (Array.isArray(tagNames)) {
            for (const tagName of tagNames) {
              if (tagName && tagName.trim() !== '') {
                // Inserir tag se não existir (como tag da empresa)
                const tagResult = await client.query(`
                  INSERT INTO polox.tags (name, slug, company_id)
                  VALUES ($1, $2, $3)
                  ON CONFLICT (company_id, name, slug) 
                  WHERE company_id IS NOT NULL 
                  DO UPDATE SET name = EXCLUDED.name
                  RETURNING id
                `, [
                  tagName.trim(), 
                  tagName.trim().toLowerCase().replace(/\s+/g, '-'),
                  transaction.company_id
                ]);

                const tagId = tagResult.rows[0].id;

                // Inserir relacionamento
                await client.query(`
                  INSERT INTO polox.financial_transaction_tags (financial_transaction_id, tag_id)
                  VALUES ($1, $2)
                  ON CONFLICT DO NOTHING
                `, [transaction.id, tagId]);

                migratedTags++;
              }
            }
          }
        } catch (error) {
          console.log(`  ⚠️  Erro ao migrar tags da transação ${transaction.id}: ${error.message}`);
          errors++;
        }
      }

      console.log(`  ✅ Migradas ${migratedTags} associações de tags`);
      if (errors > 0) {
        console.log(`  ⚠️  ${errors} erros durante migração (tags continuam na coluna original)`);
      }
    } else {
      console.log('  ℹ️  Coluna tags não existe, pulando migração de dados');
    }

    // 4. Remover coluna notes (se existir)
    console.log('🗑️  Removendo coluna notes...');
    const notesColumnExists = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'polox' 
        AND table_name = 'financial_transactions' 
        AND column_name = 'notes'
    `);

    if (notesColumnExists.rows.length > 0) {
      // Antes de remover, vamos copiar notes para description onde description estiver vazio
      console.log('  📝 Migrando notes para description...');
      const migratedNotes = await client.query(`
        UPDATE polox.financial_transactions 
        SET description = COALESCE(description, '') || 
                         CASE 
                           WHEN description IS NULL OR description = '' THEN notes
                           WHEN notes IS NOT NULL AND notes != '' THEN E'\n\n--- Notas ---\n' || notes
                           ELSE ''
                         END
        WHERE notes IS NOT NULL AND notes != ''
      `);
      console.log(`  ✅ ${migratedNotes.rowCount} notas migradas para description`);

      await client.query(`
        ALTER TABLE polox.financial_transactions 
        DROP COLUMN IF EXISTS notes;
      `);
      console.log('✅ Coluna notes removida');
    } else {
      console.log('ℹ️  Coluna notes não existe, pulando...');
    }

    // 5. Remover coluna tags (se existir)
    console.log('🗑️  Removendo coluna tags...');
    if (tagsColumnExists.rows.length > 0) {
      await client.query(`
        ALTER TABLE polox.financial_transactions 
        DROP COLUMN IF EXISTS tags;
      `);
      console.log('✅ Coluna tags removida');
    } else {
      console.log('ℹ️  Coluna tags não existe, pulando...');
    }

    // 6. Adicionar comentários
    console.log('📝 Adicionando comentários...');
    await client.query(`
      COMMENT ON TABLE polox.financial_transaction_tags IS 
      'Tabela pivot para relacionamento N:N entre transações financeiras e tags';
    `);
    await client.query(`
      COMMENT ON COLUMN polox.financial_transaction_tags.financial_transaction_id IS 
      'ID da transação financeira (FK para polox.financial_transactions)';
    `);
    await client.query(`
      COMMENT ON COLUMN polox.financial_transaction_tags.tag_id IS 
      'ID da tag (FK para polox.tags)';
    `);
    console.log('✅ Comentários adicionados');

    console.log('✅ Migration 018 concluída com sucesso!');
    console.log('');
    console.log('📋 Resumo das alterações:');
    console.log('  - Coluna notes removida (dados migrados para description)');
    console.log('  - Coluna tags removida (dados migrados para financial_transaction_tags)');
    console.log('  - Tabela financial_transaction_tags criada');
    console.log('  - Relacionamento N:N entre financial_transactions e tags estabelecido');
    console.log('');
    console.log('🎯 Resultado:');
    console.log('  - Estrutura normalizada');
    console.log('  - description usado para notas/descrição');
    console.log('  - Tags gerenciadas via tabela pivot');
    console.log('  - Integridade referencial com CASCADE');

  } catch (error) {
    console.error('❌ Erro na migration 018:', error.message);
    throw error;
  }
}

/**
 * Reverte as alterações (DOWN)
 */
async function down(client) {
  console.log('🔄 Revertendo migration 018: Refatorar tabela financial_transactions...');

  try {
    // 1. Recriar coluna tags
    console.log('📝 Recriando coluna tags...');
    await client.query(`
      ALTER TABLE polox.financial_transactions 
      ADD COLUMN IF NOT EXISTS tags JSONB;
    `);
    console.log('✅ Coluna tags recriada');

    // 2. Migrar dados de financial_transaction_tags de volta para tags
    console.log('🔄 Migrando dados de financial_transaction_tags de volta...');
    const transactions = await client.query(`
      SELECT DISTINCT financial_transaction_id 
      FROM polox.financial_transaction_tags
    `);

    for (const transaction of transactions.rows) {
      const transactionTags = await client.query(`
        SELECT t.name 
        FROM polox.tags t
        INNER JOIN polox.financial_transaction_tags ftt ON t.id = ftt.tag_id
        WHERE ftt.financial_transaction_id = $1
      `, [transaction.financial_transaction_id]);

      const tagNames = transactionTags.rows.map(t => t.name);
      
      await client.query(`
        UPDATE polox.financial_transactions 
        SET tags = $1::jsonb
        WHERE id = $2
      `, [JSON.stringify(tagNames), transaction.financial_transaction_id]);
    }
    console.log(`✅ ${transactions.rows.length} transações migradas`);

    // 3. Recriar coluna notes
    console.log('📝 Recriando coluna notes...');
    await client.query(`
      ALTER TABLE polox.financial_transactions 
      ADD COLUMN IF NOT EXISTS notes TEXT;
    `);
    console.log('✅ Coluna notes recriada');

    // 4. Remover tabela financial_transaction_tags
    console.log('🗑️  Removendo tabela financial_transaction_tags...');
    await client.query(`DROP TABLE IF EXISTS polox.financial_transaction_tags;`);
    console.log('✅ Tabela financial_transaction_tags removida');

    console.log('✅ Migration 018 revertida com sucesso');
    console.log('⚠️  Nota: Os dados de notes não podem ser recuperados automaticamente');

  } catch (error) {
    console.error('❌ Erro ao reverter migration 018:', error.message);
    throw error;
  }
}

module.exports = { up, down };
