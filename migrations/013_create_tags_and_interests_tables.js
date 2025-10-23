/**
 * Migration: 013_create_tags_and_interests_tables
 * Descrição: Cria tabelas de tags e interests com relação Muitos-para-Muitos
 * Data: 2025-10-22
 * 
 * Normaliza os campos 'tags' e 'interests' que antes eram TEXT na tabela leads.
 * Agora usa padrão de tabelas pivot para relacionamento N:N.
 */

const up = async (client) => {
  console.log('🔄 Criando tabelas de tags e interests...');

  // 1. Criar tabela mestre de TAGS
  await client.query(`
    CREATE TABLE IF NOT EXISTS polox.tags (
      id BIGSERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL UNIQUE,
      color VARCHAR(7) DEFAULT '#808080',
      description TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      
      CONSTRAINT chk_tags_color CHECK (color ~* '^#[0-9A-F]{6}$')
    );
  `);

  console.log('✅ Tabela tags criada');

  // Criar índice para busca rápida por nome
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_tags_name 
      ON polox.tags(name);
  `);

  // 2. Criar tabela PIVOT lead_tags
  await client.query(`
    CREATE TABLE IF NOT EXISTS polox.lead_tags (
      lead_id BIGINT NOT NULL,
      tag_id BIGINT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      
      PRIMARY KEY (lead_id, tag_id),
      
      CONSTRAINT fk_lead_tags_lead 
        FOREIGN KEY (lead_id) 
        REFERENCES polox.leads(id) 
        ON DELETE CASCADE,
        
      CONSTRAINT fk_lead_tags_tag 
        FOREIGN KEY (tag_id) 
        REFERENCES polox.tags(id) 
        ON DELETE CASCADE
    );
  `);

  console.log('✅ Tabela pivot lead_tags criada');

  // Criar índices para a pivot
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_lead_tags_lead_id 
      ON polox.lead_tags(lead_id);
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_lead_tags_tag_id 
      ON polox.lead_tags(tag_id);
  `);

  // 3. Criar tabela mestre de INTERESTS
  await client.query(`
    CREATE TABLE IF NOT EXISTS polox.interests (
      id BIGSERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL UNIQUE,
      category VARCHAR(50),
      description TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      
      CONSTRAINT chk_interests_category 
        CHECK (category IN ('product', 'service', 'industry', 'technology', 'other') OR category IS NULL)
    );
  `);

  console.log('✅ Tabela interests criada');

  // Criar índice para busca rápida por nome
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_interests_name 
      ON polox.interests(name);
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_interests_category 
      ON polox.interests(category) 
      WHERE category IS NOT NULL;
  `);

  // 4. Criar tabela PIVOT lead_interests
  await client.query(`
    CREATE TABLE IF NOT EXISTS polox.lead_interests (
      lead_id BIGINT NOT NULL,
      interest_id BIGINT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      
      PRIMARY KEY (lead_id, interest_id),
      
      CONSTRAINT fk_lead_interests_lead 
        FOREIGN KEY (lead_id) 
        REFERENCES polox.leads(id) 
        ON DELETE CASCADE,
        
      CONSTRAINT fk_lead_interests_interest 
        FOREIGN KEY (interest_id) 
        REFERENCES polox.interests(id) 
        ON DELETE CASCADE
    );
  `);

  console.log('✅ Tabela pivot lead_interests criada');

  // Criar índices para a pivot
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_lead_interests_lead_id 
      ON polox.lead_interests(lead_id);
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_lead_interests_interest_id 
      ON polox.lead_interests(interest_id);
  `);

  // Adicionar comentários para documentação
  await client.query(`
    COMMENT ON TABLE polox.tags IS 
      'Tabela mestre de tags - palavras-chave para categorizar leads';
  `);

  await client.query(`
    COMMENT ON TABLE polox.lead_tags IS 
      'Tabela pivot - relacionamento N:N entre leads e tags';
  `);

  await client.query(`
    COMMENT ON TABLE polox.interests IS 
      'Tabela mestre de interesses - áreas de interesse dos leads';
  `);

  await client.query(`
    COMMENT ON TABLE polox.lead_interests IS 
      'Tabela pivot - relacionamento N:N entre leads e interesses';
  `);

  console.log('✅ Comentários adicionados às tabelas');

  // Migrar dados antigos do backup (se existir)
  await client.query(`
    DO $$ 
    DECLARE
      lead_record RECORD;
      tag_array TEXT[];
      interest_array TEXT[];
      tag_name TEXT;
      interest_name TEXT;
      tag_id_var BIGINT;
      interest_id_var BIGINT;
      has_tags_column BOOLEAN := FALSE;
      has_interests_column BOOLEAN := FALSE;
    BEGIN
      -- Verificar se a tabela de backup existe
      IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'polox' 
        AND table_name = 'leads_backup_011'
      ) THEN
        -- Verificar quais colunas existem no backup
        SELECT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_schema = 'polox' 
            AND table_name = 'leads_backup_011' 
            AND column_name = 'tags'
        ) INTO has_tags_column;
        
        SELECT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_schema = 'polox' 
            AND table_name = 'leads_backup_011' 
            AND column_name = 'interests'
        ) INTO has_interests_column;
        
        -- Migrar TAGS se a coluna existir
        IF has_tags_column THEN
          BEGIN
            FOR lead_record IN 
              SELECT id, tags 
              FROM polox.leads_backup_011 
              WHERE tags IS NOT NULL AND tags != '' AND tags != '[]'
            LOOP
              BEGIN
                -- Verificar se é JSON válido antes de tentar parse
                IF tags ~ '^\[.*\]$' THEN
                  BEGIN
                    -- Tentar fazer parse como JSON array
                    tag_array := ARRAY(SELECT json_array_elements_text(tags::json));
                  EXCEPTION WHEN OTHERS THEN
                    -- Tratar como string simples separada por vírgula
                    tag_array := string_to_array(REPLACE(REPLACE(lead_record.tags, '[', ''), ']', ''), ',');
                  END;
                ELSE
                  -- Tratar como string simples separada por vírgula
                  tag_array := string_to_array(lead_record.tags, ',');
                END IF;
              EXCEPTION WHEN OTHERS THEN
                -- Se ainda assim falhar, pular este registro
                RAISE NOTICE 'Pulando migração de tags do lead %: erro de parse', lead_record.id;
                CONTINUE;
              END;
            
            FOREACH tag_name IN ARRAY tag_array
            LOOP
              tag_name := TRIM(BOTH '"' FROM TRIM(tag_name));
              IF tag_name != '' THEN
                -- Inserir tag se não existir
                INSERT INTO polox.tags (name) 
                VALUES (tag_name) 
                ON CONFLICT (name) DO NOTHING;
                
                -- Pegar ID da tag
                SELECT id INTO tag_id_var FROM polox.tags WHERE name = tag_name;
                
                -- Associar tag ao lead
                INSERT INTO polox.lead_tags (lead_id, tag_id) 
                VALUES (lead_record.id, tag_id_var)
                ON CONFLICT DO NOTHING;
              END IF;
            END LOOP;
            END LOOP;
            RAISE NOTICE 'Tags migradas do backup';
          EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Erro ao migrar tags, pulando: %', SQLERRM;
          END;
        ELSE
          RAISE NOTICE 'Backup não possui coluna tags, pulando migração';
        END IF;
        
        -- Migrar INTERESTS se a coluna existir
        IF has_interests_column THEN
          BEGIN
            FOR lead_record IN 
              SELECT id, interests 
              FROM polox.leads_backup_011 
              WHERE interests IS NOT NULL AND interests != '' AND interests != '[]'
            LOOP
              BEGIN
                -- Verificar se é JSON válido antes de tentar parse
                IF interests ~ '^\[.*\]$' THEN
                  BEGIN
                    -- Tentar fazer parse como JSON array
                    interest_array := ARRAY(SELECT json_array_elements_text(interests::json));
                  EXCEPTION WHEN OTHERS THEN
                    -- Tratar como string simples separada por vírgula
                    interest_array := string_to_array(REPLACE(REPLACE(lead_record.interests, '[', ''), ']', ''), ',');
                  END;
                ELSE
                  -- Tratar como string simples separada por vírgula
                  interest_array := string_to_array(lead_record.interests, ',');
                END IF;
              EXCEPTION WHEN OTHERS THEN
                -- Se ainda assim falhar, pular este registro
                RAISE NOTICE 'Pulando migração de interests do lead %: erro de parse', lead_record.id;
                CONTINUE;
              END;
              
              FOREACH interest_name IN ARRAY interest_array
              LOOP
                interest_name := TRIM(BOTH '"' FROM TRIM(interest_name));
                IF interest_name != '' THEN
                  -- Inserir interest se não existir
                  INSERT INTO polox.interests (name, category) 
                  VALUES (interest_name, 'other') 
                  ON CONFLICT (name) DO NOTHING;
                  
                  -- Pegar ID do interest
                  SELECT id INTO interest_id_var FROM polox.interests WHERE name = interest_name;
                  
                  -- Associar interest ao lead
                  INSERT INTO polox.lead_interests (lead_id, interest_id) 
                  VALUES (lead_record.id, interest_id_var)
                  ON CONFLICT DO NOTHING;
                END IF;
              END LOOP;
            END LOOP;
            RAISE NOTICE 'Interests migrados do backup';
          EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Erro ao migrar interests, pulando: %', SQLERRM;
          END;
        ELSE
          RAISE NOTICE 'Backup não possui coluna interests, pulando migração';
        END IF;
      ELSE
        RAISE NOTICE 'Backup não encontrado, pulando migração de dados';
      END IF;
    END $$;
  `);

  console.log('✅ Migration 013_create_tags_and_interests_tables concluída com sucesso!');
};

const down = async (client) => {
  console.log('🔄 Revertendo migration 013_create_tags_and_interests_tables...');

  // Remover tabelas na ordem correta (pivot primeiro, depois mestres)
  await client.query('DROP TABLE IF EXISTS polox.lead_interests CASCADE;');
  console.log('✅ Tabela lead_interests removida');

  await client.query('DROP TABLE IF EXISTS polox.interests CASCADE;');
  console.log('✅ Tabela interests removida');

  await client.query('DROP TABLE IF EXISTS polox.lead_tags CASCADE;');
  console.log('✅ Tabela lead_tags removida');

  await client.query('DROP TABLE IF EXISTS polox.tags CASCADE;');
  console.log('✅ Tabela tags removida');

  console.log('✅ Rollback da migration 013_create_tags_and_interests_tables concluído!');
};

module.exports = { up, down };
