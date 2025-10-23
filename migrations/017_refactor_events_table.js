/**
 * Migration 017: Refatorar tabela events
 * 
 * Objetivos:
 * - Remover coluna notes (usar description em vez disso)
 * - Remover coluna tags (normalizar relacionamento)
 * - Criar tabela pivot event_tags
 * 
 * Padrão:
 * - Usar description para notas/descrição do evento
 * - Relacionamento N:N entre events e tags via event_tags
 * 
 * Data: 2025-10-23
 */

const { query } = require('../src/config/database');

/**
 * Aplica as alterações (UP)
 */
async function up(client) {
  console.log('🔄 Iniciando migration 017: Refatorar tabela events...');

  try {
    // 1. Criar tabela event_tags ANTES de remover a coluna tags
    console.log('📋 Criando tabela polox.event_tags...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS polox.event_tags (
        event_id BIGINT NOT NULL,
        tag_id BIGINT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        
        -- Primary key composta
        PRIMARY KEY (event_id, tag_id),
        
        -- Foreign keys
        CONSTRAINT fk_event_tags_event 
          FOREIGN KEY (event_id) 
          REFERENCES polox.events(id) 
          ON DELETE CASCADE,
        
        CONSTRAINT fk_event_tags_tag 
          FOREIGN KEY (tag_id) 
          REFERENCES polox.tags(id) 
          ON DELETE CASCADE
      );
    `);
    console.log('✅ Tabela event_tags criada');

    // 2. Criar índices para performance
    console.log('📌 Criando índices...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_event_tags_event_id 
      ON polox.event_tags(event_id);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_event_tags_tag_id 
      ON polox.event_tags(tag_id);
    `);
    console.log('✅ Índices criados');

    // 3. Migrar dados existentes da coluna tags (se houver)
    console.log('🔄 Migrando dados da coluna tags...');
    
    // Verificar se a coluna tags existe
    const tagsColumnExists = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'polox' 
        AND table_name = 'events' 
        AND column_name = 'tags'
    `);

    if (tagsColumnExists.rows.length > 0) {
      // Buscar eventos com tags
      const eventsWithTags = await client.query(`
        SELECT id, tags, company_id 
        FROM polox.events 
        WHERE tags IS NOT NULL 
          AND tags != 'null'::jsonb 
          AND jsonb_array_length(tags) > 0
      `);

      console.log(`  📊 Encontrados ${eventsWithTags.rows.length} eventos com tags`);

      let migratedTags = 0;
      let errors = 0;

      for (const event of eventsWithTags.rows) {
        try {
          const tagNames = event.tags; // Array de strings
          
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
                  event.company_id
                ]);

                const tagId = tagResult.rows[0].id;

                // Inserir relacionamento
                await client.query(`
                  INSERT INTO polox.event_tags (event_id, tag_id)
                  VALUES ($1, $2)
                  ON CONFLICT DO NOTHING
                `, [event.id, tagId]);

                migratedTags++;
              }
            }
          }
        } catch (error) {
          console.log(`  ⚠️  Erro ao migrar tags do evento ${event.id}: ${error.message}`);
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
        AND table_name = 'events' 
        AND column_name = 'notes'
    `);

    if (notesColumnExists.rows.length > 0) {
      // Antes de remover, vamos copiar notes para description onde description estiver vazio
      console.log('  📝 Migrando notes para description...');
      const migratedNotes = await client.query(`
        UPDATE polox.events 
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
        ALTER TABLE polox.events 
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
        ALTER TABLE polox.events 
        DROP COLUMN IF EXISTS tags;
      `);
      console.log('✅ Coluna tags removida');
    } else {
      console.log('ℹ️  Coluna tags não existe, pulando...');
    }

    // 6. Adicionar comentários
    console.log('📝 Adicionando comentários...');
    await client.query(`
      COMMENT ON TABLE polox.event_tags IS 
      'Tabela pivot para relacionamento N:N entre eventos e tags';
    `);
    await client.query(`
      COMMENT ON COLUMN polox.event_tags.event_id IS 
      'ID do evento (FK para polox.events)';
    `);
    await client.query(`
      COMMENT ON COLUMN polox.event_tags.tag_id IS 
      'ID da tag (FK para polox.tags)';
    `);
    console.log('✅ Comentários adicionados');

    console.log('✅ Migration 017 concluída com sucesso!');
    console.log('');
    console.log('📋 Resumo das alterações:');
    console.log('  - Coluna notes removida (dados migrados para description)');
    console.log('  - Coluna tags removida (dados migrados para event_tags)');
    console.log('  - Tabela event_tags criada');
    console.log('  - Relacionamento N:N entre events e tags estabelecido');
    console.log('');
    console.log('🎯 Resultado:');
    console.log('  - Estrutura normalizada');
    console.log('  - description usado para notas/descrição');
    console.log('  - Tags gerenciadas via tabela pivot');
    console.log('  - Integridade referencial com CASCADE');

  } catch (error) {
    console.error('❌ Erro na migration 017:', error.message);
    throw error;
  }
}

/**
 * Reverte as alterações (DOWN)
 */
async function down(client) {
  console.log('🔄 Revertendo migration 017: Refatorar tabela events...');

  try {
    // 1. Recriar coluna tags
    console.log('📝 Recriando coluna tags...');
    await client.query(`
      ALTER TABLE polox.events 
      ADD COLUMN IF NOT EXISTS tags JSONB;
    `);
    console.log('✅ Coluna tags recriada');

    // 2. Migrar dados de event_tags de volta para tags
    console.log('🔄 Migrando dados de event_tags de volta...');
    const events = await client.query(`
      SELECT DISTINCT event_id 
      FROM polox.event_tags
    `);

    for (const event of events.rows) {
      const eventTags = await client.query(`
        SELECT t.name 
        FROM polox.tags t
        INNER JOIN polox.event_tags et ON t.id = et.tag_id
        WHERE et.event_id = $1
      `, [event.event_id]);

      const tagNames = eventTags.rows.map(t => t.name);
      
      await client.query(`
        UPDATE polox.events 
        SET tags = $1::jsonb
        WHERE id = $2
      `, [JSON.stringify(tagNames), event.event_id]);
    }
    console.log(`✅ ${events.rows.length} eventos migrados`);

    // 3. Recriar coluna notes
    console.log('📝 Recriando coluna notes...');
    await client.query(`
      ALTER TABLE polox.events 
      ADD COLUMN IF NOT EXISTS notes TEXT;
    `);
    console.log('✅ Coluna notes recriada');

    // 4. Remover tabela event_tags
    console.log('🗑️  Removendo tabela event_tags...');
    await client.query(`DROP TABLE IF EXISTS polox.event_tags;`);
    console.log('✅ Tabela event_tags removida');

    console.log('✅ Migration 017 revertida com sucesso');
    console.log('⚠️  Nota: Os dados de notes não podem ser recuperados automaticamente');

  } catch (error) {
    console.error('❌ Erro ao reverter migration 017:', error.message);
    throw error;
  }
}

module.exports = { up, down };
