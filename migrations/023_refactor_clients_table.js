/**
 * Migration 023: Refatoração da tabela polox.clients
 * 
 * PROBLEMA:
 * - Tabela clients ainda usa padrão antigo com coluna tags JSONB
 * - Campo notes TEXT redundante (sem uso específico)
 * 
 * SOLUÇÃO:
 * - Remove coluna tags (migra dados para tabela pivot)
 * - Remove coluna notes (redundante)
 * - Cria tabela client_tags para normalização de tags
 * - Cria tabela client_interests para normalização de interesses
 * 
 * ESTRUTURAS:
 * - client_tags: (client_id, tag_id, created_at) PK: (client_id, tag_id)
 * - client_interests: (client_id, interest_id, created_at) PK: (client_id, interest_id)
 * 
 * Data: 2025-10-23
 */

const { query } = require('../src/config/database');

/**
 * Aplica a migration
 */
async function up(client) {
  console.log('📋 Iniciando Migration 023: Refatoração da tabela clients...');

  try {
    // 1. Verificar se colunas existem
    const tagsColumnCheck = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'polox' 
        AND table_name = 'clients' 
        AND column_name = 'tags'
    `);

    const notesColumnCheck = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'polox' 
        AND table_name = 'clients' 
        AND column_name = 'notes'
    `);

    const tagsColumnExists = tagsColumnCheck.rows.length > 0;
    const notesColumnExists = notesColumnCheck.rows.length > 0;

    // 2. Criar tabela client_tags
    console.log('🔧 Criando tabela client_tags...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS polox.client_tags (
        client_id BIGINT NOT NULL,
        tag_id BIGINT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        
        PRIMARY KEY (client_id, tag_id),
        
        CONSTRAINT fk_client_tags_client
          FOREIGN KEY (client_id) 
          REFERENCES polox.clients(id) 
          ON DELETE CASCADE,
        
        CONSTRAINT fk_client_tags_tag
          FOREIGN KEY (tag_id) 
          REFERENCES polox.tags(id) 
          ON DELETE CASCADE
      )
    `);
    console.log('✅ Tabela client_tags criada com sucesso');

    // 3. Criar índices para client_tags
    console.log('🔧 Criando índices para client_tags...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_client_tags_client_id 
      ON polox.client_tags(client_id)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_client_tags_tag_id 
      ON polox.client_tags(tag_id)
    `);
    console.log('✅ Índices criados com sucesso');

    // 4. Criar tabela client_interests
    console.log('🔧 Criando tabela client_interests...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS polox.client_interests (
        client_id BIGINT NOT NULL,
        interest_id BIGINT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        
        PRIMARY KEY (client_id, interest_id),
        
        CONSTRAINT fk_client_interests_client
          FOREIGN KEY (client_id) 
          REFERENCES polox.clients(id) 
          ON DELETE CASCADE,
        
        CONSTRAINT fk_client_interests_interest
          FOREIGN KEY (interest_id) 
          REFERENCES polox.interests(id) 
          ON DELETE CASCADE
      )
    `);
    console.log('✅ Tabela client_interests criada com sucesso');

    // 5. Criar índices para client_interests
    console.log('🔧 Criando índices para client_interests...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_client_interests_client_id 
      ON polox.client_interests(client_id)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_client_interests_interest_id 
      ON polox.client_interests(interest_id)
    `);
    console.log('✅ Índices criados com sucesso');

    // 6. Migrar dados de tags JSONB para client_tags (se a coluna existir)
    let clientsWithTags = { rows: [] }; // Inicializar para evitar erro de referência
    
    if (tagsColumnExists) {
      console.log('🔄 Migrando tags existentes para client_tags...');
      
      // Buscar clientes com tags
      clientsWithTags = await client.query(`
        SELECT id, company_id, tags 
        FROM polox.clients 
        WHERE tags IS NOT NULL 
          AND tags::text != '[]' 
          AND tags::text != 'null'
      `);

      console.log(`📊 Encontrados ${clientsWithTags.rows.length} clientes com tags para migrar`);

      for (const clientRecord of clientsWithTags.rows) {
        try {
          const tagsArray = typeof clientRecord.tags === 'string' 
            ? JSON.parse(clientRecord.tags) 
            : clientRecord.tags;

          if (Array.isArray(tagsArray) && tagsArray.length > 0) {
            for (const tagName of tagsArray) {
              if (tagName && typeof tagName === 'string') {
                // Criar ou buscar tag
                const tagResult = await client.query(`
                  INSERT INTO polox.tags (company_id, name, slug, color, created_at, updated_at)
                  VALUES ($1, $2, $3, $4, NOW(), NOW())
                  ON CONFLICT (company_id, slug) 
                  DO UPDATE SET updated_at = NOW()
                  RETURNING id
                `, [
                  clientRecord.company_id,
                  tagName.trim(),
                  tagName.toLowerCase().trim().replace(/\s+/g, '-'),
                  '#808080' // cor padrão cinza
                ]);

                const tagId = tagResult.rows[0].id;

                // Associar tag ao cliente via pivot
                await client.query(`
                  INSERT INTO polox.client_tags (client_id, tag_id, created_at)
                  VALUES ($1, $2, NOW())
                  ON CONFLICT (client_id, tag_id) DO NOTHING
                `, [clientRecord.id, tagId]);
              }
            }
          }
        } catch (error) {
          console.error(`⚠️  Erro ao migrar tags do cliente ${clientRecord.id}:`, error.message);
        }
      }

      console.log('✅ Migração de tags concluída');
    }

    // 7. Verificar se há dados em notes antes de remover
    if (notesColumnExists) {
      const notesCheck = await client.query(`
        SELECT COUNT(*) as count 
        FROM polox.clients 
        WHERE notes IS NOT NULL 
          AND notes != '' 
          AND deleted_at IS NULL
      `);

      const hasNotes = parseInt(notesCheck.rows[0].count) > 0;

      if (hasNotes) {
        console.log(`⚠️  ATENÇÃO: Existem ${notesCheck.rows[0].count} clientes com notes`);
        console.log('💡 SUGESTÃO: Considere migrar esses dados antes de remover a coluna');
      }
    }

    // 8. Remover coluna tags (se existir)
    if (tagsColumnExists) {
      console.log('🗑️  Removendo coluna tags da tabela clients...');
      await client.query(`
        ALTER TABLE polox.clients 
        DROP COLUMN IF EXISTS tags
      `);
      console.log('✅ Coluna tags removida com sucesso');
    } else {
      console.log('ℹ️  Coluna tags não encontrada (já foi removida anteriormente)');
    }

    // 9. Remover coluna notes (se existir)
    if (notesColumnExists) {
      console.log('🗑️  Removendo coluna notes da tabela clients...');
      await client.query(`
        ALTER TABLE polox.clients 
        DROP COLUMN IF EXISTS notes
      `);
      console.log('✅ Coluna notes removida com sucesso');
    } else {
      console.log('ℹ️  Coluna notes não encontrada (já foi removida anteriormente)');
    }

    console.log('✅ Migration 023 concluída com sucesso!');
    console.log('');
    console.log('📌 RESUMO:');
    console.log('   ✓ Tabela client_tags criada');
    console.log('   ✓ Tabela client_interests criada');
    console.log('   ✓ Índices criados (client_id, tag_id, interest_id)');
    if (tagsColumnExists) {
      console.log(`   ✓ ${clientsWithTags.rows.length} clientes com tags migrados`);
      console.log('   ✓ Coluna tags removida');
    }
    if (notesColumnExists) {
      console.log('   ✓ Coluna notes removida');
    }
    console.log('');
    console.log('📝 PRÓXIMOS PASSOS:');
    console.log('   1. Atualizar Client.js para usar client_tags');
    console.log('   2. Atualizar Client.js para usar client_interests');
    console.log('   3. Adicionar métodos addTag(), getTags(), removeTag(), updateTags()');
    console.log('   4. Adicionar métodos addInterest(), getInterests(), removeInterest(), updateInterests()');

  } catch (error) {
    console.error('❌ Erro na Migration 023:', error);
    throw error;
  }
}

/**
 * Reverte a migration
 */
async function down(client) {
  console.log('⏪ Revertendo Migration 023...');

  try {
    // 1. Recriar colunas
    console.log('🔧 Recriando colunas tags e notes...');
    await client.query(`
      ALTER TABLE polox.clients 
      ADD COLUMN IF NOT EXISTS tags JSONB,
      ADD COLUMN IF NOT EXISTS notes TEXT
    `);

    // 2. Migrar dados de volta (client_tags -> JSONB)
    console.log('🔄 Migrando dados de client_tags de volta para JSONB...');
    const clientsWithTags = await client.query(`
      SELECT 
        ct.client_id,
        json_agg(t.name) as tags
      FROM polox.client_tags ct
      INNER JOIN polox.tags t ON ct.tag_id = t.id
      GROUP BY ct.client_id
    `);

    for (const row of clientsWithTags.rows) {
      await client.query(`
        UPDATE polox.clients 
        SET tags = $1 
        WHERE id = $2
      `, [JSON.stringify(row.tags), row.client_id]);
    }

    // 3. Remover tabelas pivot
    console.log('🗑️  Removendo tabelas client_tags e client_interests...');
    await client.query('DROP TABLE IF EXISTS polox.client_tags CASCADE');
    await client.query('DROP TABLE IF EXISTS polox.client_interests CASCADE');

    console.log('✅ Migration 023 revertida com sucesso');

  } catch (error) {
    console.error('❌ Erro ao reverter Migration 023:', error);
    throw error;
  }
}

module.exports = { up, down };
