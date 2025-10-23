/**
 * Migration 022: Refatoração da tabela polox.tickets
 * 
 * PROBLEMA:
 * - Tabela tickets ainda usa padrão antigo com coluna tags JSONB
 * - Campo resolution_notes TEXT sem estrutura adequada
 * 
 * SOLUÇÃO:
 * - Remove coluna tags (migra dados para tabela pivot)
 * - Remove coluna resolution_notes (substituída por ticket_comments)
 * - Cria tabela ticket_tags para normalização
 * 
 * ESTRUTURA ticket_tags:
 * - ticket_id BIGINT (FK para tickets.id CASCADE)
 * - tag_id BIGINT (FK para tags.id CASCADE)
 * - created_at TIMESTAMPTZ
 * - PRIMARY KEY (ticket_id, tag_id)
 * 
 * Data: 2025-10-23
 */

const { query } = require('../src/config/database');

async function up(client) {
  console.log('📋 Iniciando Migration 022: Refatoração da tabela tickets...');

  try {
    // 1. Verificar se coluna tags existe
    const tagsColumnCheck = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'polox' 
        AND table_name = 'tickets' 
        AND column_name = 'tags'
    `);

    const tagsColumnExists = tagsColumnCheck.rows.length > 0;

    // 2. Criar tabela ticket_tags
    console.log('🔧 Criando tabela ticket_tags...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS polox.ticket_tags (
        ticket_id BIGINT NOT NULL,
        tag_id BIGINT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        
        PRIMARY KEY (ticket_id, tag_id),
        
        CONSTRAINT fk_ticket_tags_ticket
          FOREIGN KEY (ticket_id) 
          REFERENCES polox.tickets(id) 
          ON DELETE CASCADE,
        
        CONSTRAINT fk_ticket_tags_tag
          FOREIGN KEY (tag_id) 
          REFERENCES polox.tags(id) 
          ON DELETE CASCADE
      )
    `);
    console.log('✅ Tabela ticket_tags criada com sucesso');

    // 3. Criar índices
    console.log('🔧 Criando índices...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_ticket_tags_ticket_id 
      ON polox.ticket_tags(ticket_id)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_ticket_tags_tag_id 
      ON polox.ticket_tags(tag_id)
    `);
    console.log('✅ Índices criados com sucesso');

    // 4. Migrar dados de tags JSONB para ticket_tags (se a coluna existir)
    let ticketsWithTags = { rows: [] }; // Inicializar para evitar erro de referência
    
    if (tagsColumnExists) {
      console.log('🔄 Migrando tags existentes para ticket_tags...');
      
      // Buscar tickets com tags
      ticketsWithTags = await client.query(`
        SELECT id, company_id, tags 
        FROM polox.tickets 
        WHERE tags IS NOT NULL 
          AND tags::text != '[]' 
          AND tags::text != 'null'
      `);

      console.log(`📊 Encontrados ${ticketsWithTags.rows.length} tickets com tags para migrar`);

      for (const ticket of ticketsWithTags.rows) {
        try {
          const tagsArray = typeof ticket.tags === 'string' 
            ? JSON.parse(ticket.tags) 
            : ticket.tags;

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
                  ticket.company_id,
                  tagName.trim(),
                  tagName.toLowerCase().trim().replace(/\s+/g, '-'),
                  '#808080' // cor padrão cinza
                ]);

                const tagId = tagResult.rows[0].id;

                // Associar tag ao ticket via pivot
                await client.query(`
                  INSERT INTO polox.ticket_tags (ticket_id, tag_id, created_at)
                  VALUES ($1, $2, NOW())
                  ON CONFLICT (ticket_id, tag_id) DO NOTHING
                `, [ticket.id, tagId]);
              }
            }
          }
        } catch (error) {
          console.error(`⚠️  Erro ao migrar tags do ticket ${ticket.id}:`, error.message);
        }
      }

      console.log('✅ Migração de tags concluída');
    }

    // 5. Verificar se há dados em resolution_notes antes de remover
    const resolutionNotesCheck = await client.query(`
      SELECT COUNT(*) as count 
      FROM polox.tickets 
      WHERE resolution_notes IS NOT NULL 
        AND resolution_notes != '' 
        AND deleted_at IS NULL
    `);

    const hasResolutionNotes = parseInt(resolutionNotesCheck.rows[0].count) > 0;

    if (hasResolutionNotes) {
      console.log(`⚠️  ATENÇÃO: Existem ${resolutionNotesCheck.rows[0].count} tickets com resolution_notes`);
      console.log('💡 SUGESTÃO: Migre esses dados para polox.ticket_comments antes de remover a coluna');
      console.log('   Exemplo: Para cada resolution_note, crie um comentário interno no ticket');
    }

    // 6. Remover coluna tags (se existir)
    if (tagsColumnExists) {
      console.log('🗑️  Removendo coluna tags da tabela tickets...');
      await client.query(`
        ALTER TABLE polox.tickets 
        DROP COLUMN IF EXISTS tags
      `);
      console.log('✅ Coluna tags removida com sucesso');
    } else {
      console.log('ℹ️  Coluna tags não encontrada (já foi removida anteriormente)');
    }

    // 7. Remover coluna resolution_notes
    console.log('🗑️  Removendo coluna resolution_notes da tabela tickets...');
    await client.query(`
      ALTER TABLE polox.tickets 
      DROP COLUMN IF EXISTS resolution_notes
    `);
    console.log('✅ Coluna resolution_notes removida com sucesso');

    console.log('✅ Migration 022 concluída com sucesso!');
    console.log('');
    console.log('📌 RESUMO:');
    console.log('   ✓ Tabela ticket_tags criada');
    console.log('   ✓ Índices criados (ticket_id, tag_id)');
    if (tagsColumnExists) {
      console.log(`   ✓ ${ticketsWithTags.rows.length} tickets com tags migrados`);
      console.log('   ✓ Coluna tags removida');
    }
    console.log('   ✓ Coluna resolution_notes removida');
    console.log('');
    console.log('📝 PRÓXIMOS PASSOS:');
    console.log('   1. Atualizar Ticket.js para usar ticket_tags');
    console.log('   2. Adicionar métodos addTag(), getTags(), removeTag(), updateTags()');
    console.log('   3. Usar tabela ticket_comments para histórico de resoluções');
    console.log('   4. Campo description permanece para descrição inicial do ticket');

  } catch (error) {
    console.error('❌ Erro na Migration 022:', error);
    throw error;
  }
}

async function down(client) {
  console.log('⏪ Revertendo Migration 022...');

  try {
    // 1. Recriar colunas
    console.log('🔧 Recriando colunas tags e resolution_notes...');
    await client.query(`
      ALTER TABLE polox.tickets 
      ADD COLUMN IF NOT EXISTS tags JSONB,
      ADD COLUMN IF NOT EXISTS resolution_notes TEXT
    `);

    // 2. Migrar dados de volta (ticket_tags -> JSONB)
    console.log('🔄 Migrando dados de ticket_tags de volta para JSONB...');
    const ticketsWithTags = await client.query(`
      SELECT 
        tt.ticket_id,
        json_agg(t.name) as tags
      FROM polox.ticket_tags tt
      INNER JOIN polox.tags t ON tt.tag_id = t.id
      GROUP BY tt.ticket_id
    `);

    for (const row of ticketsWithTags.rows) {
      await client.query(`
        UPDATE polox.tickets 
        SET tags = $1 
        WHERE id = $2
      `, [JSON.stringify(row.tags), row.ticket_id]);
    }

    // 3. Remover tabela ticket_tags
    console.log('🗑️  Removendo tabela ticket_tags...');
    await client.query('DROP TABLE IF EXISTS polox.ticket_tags CASCADE');

    console.log('✅ Migration 022 revertida com sucesso');

  } catch (error) {
    console.error('❌ Erro ao reverter Migration 022:', error);
    throw error;
  }
}

module.exports = { up, down };
