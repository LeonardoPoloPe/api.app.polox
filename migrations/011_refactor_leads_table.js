/**
 * Migration: 011_refactor_leads_table
 * Descrição: Refatora tabela leads - renomeia colunas ambíguas e remove campos que serão normalizados
 * Data: 2025-10-22
 * 
 * Mudanças:
 * - Renomeia user_id para created_by_id (quem criou o lead)
 * - Renomeia assigned_to_id para owner_id (quem é o dono/responsável)
 * - Remove colunas notes, interests, tags (serão normalizadas em tabelas separadas)
 */

const up = async (client) => {
  console.log('🔄 Refatorando tabela leads...');

  // 1. Renomear user_id para created_by_id
  await client.query(`
    DO $$ 
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'polox' 
        AND table_name = 'leads' 
        AND column_name = 'user_id'
      ) THEN
        ALTER TABLE polox.leads RENAME COLUMN user_id TO created_by_id;
        RAISE NOTICE 'Coluna user_id renomeada para created_by_id';
      ELSE
        RAISE NOTICE 'Coluna user_id não existe, pulando renomeação';
      END IF;
    END $$;
  `);

  // 2. Renomear assigned_to_id para owner_id (se existir)
  await client.query(`
    DO $$ 
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'polox' 
        AND table_name = 'leads' 
        AND column_name = 'assigned_to_id'
      ) THEN
        ALTER TABLE polox.leads RENAME COLUMN assigned_to_id TO owner_id;
        RAISE NOTICE 'Coluna assigned_to_id renomeada para owner_id';
      ELSE
        RAISE NOTICE 'Coluna assigned_to_id não existe, pulando renomeação';
      END IF;
    END $$;
  `);

  // 3. Verificar quais colunas existem e criar backup apenas dos dados existentes
  const columnsCheck = await client.query(`
    SELECT column_name 
    FROM information_schema.columns 
    WHERE table_schema = 'polox' 
      AND table_name = 'leads' 
      AND column_name IN ('notes', 'interests', 'tags')
  `);
  
  const existingColumns = columnsCheck.rows.map(row => row.column_name);
  console.log(`ℹ️  Colunas encontradas para backup: ${existingColumns.join(', ') || 'nenhuma'}`);
  
  // Criar backup apenas se houver colunas
  if (existingColumns.length > 0) {
    const selectColumns = ['id', ...existingColumns].join(', ');
    const conditions = existingColumns.map(col => `${col} IS NOT NULL`).join(' OR ');
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS polox.leads_backup_011 AS 
      SELECT ${selectColumns}
      FROM polox.leads 
      WHERE ${conditions};
    `);
    
    console.log('✅ Backup criado em leads_backup_011');
  } else {
    console.log('ℹ️  Nenhuma coluna para fazer backup, pulando...');
  }

  // 4. Remover colunas se existirem
  await client.query(`
    ALTER TABLE polox.leads 
    DROP COLUMN IF EXISTS notes,
    DROP COLUMN IF EXISTS interests,
    DROP COLUMN IF EXISTS tags;
  `);

  console.log('✅ Colunas notes, interests, tags removidas');

  // 5. Atualizar comentários das colunas renomeadas
  await client.query(`
    COMMENT ON COLUMN polox.leads.created_by_id IS 
      'ID do usuário que criou o lead (FK para users.id)';
  `);

  await client.query(`
    DO $$ 
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'polox' 
        AND table_name = 'leads' 
        AND column_name = 'owner_id'
      ) THEN
        EXECUTE 'COMMENT ON COLUMN polox.leads.owner_id IS ''ID do usuário responsável/dono do lead (FK para users.id)''';
      END IF;
    END $$;
  `);

  console.log('✅ Migration 011_refactor_leads_table concluída com sucesso!');
  console.log('ℹ️  Backup dos dados antigos disponível em polox.leads_backup_011');
};

const down = async (client) => {
  console.log('🔄 Revertendo migration 011_refactor_leads_table...');

  // 1. Adicionar de volta as colunas removidas
  await client.query(`
    ALTER TABLE polox.leads 
    ADD COLUMN IF NOT EXISTS notes TEXT,
    ADD COLUMN IF NOT EXISTS interests TEXT,
    ADD COLUMN IF NOT EXISTS tags TEXT;
  `);

  console.log('✅ Colunas notes, interests, tags restauradas');

  // 2. Restaurar dados do backup (se existir)
  await client.query(`
    DO $$ 
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'polox' 
        AND table_name = 'leads_backup_011'
      ) THEN
        -- Verificar quais colunas existem no backup
        DECLARE
          has_notes BOOLEAN;
          has_interests BOOLEAN;
          has_tags BOOLEAN;
        BEGIN
          SELECT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'polox' 
              AND table_name = 'leads_backup_011' 
              AND column_name = 'notes'
          ) INTO has_notes;
          
          SELECT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'polox' 
              AND table_name = 'leads_backup_011' 
              AND column_name = 'interests'
          ) INTO has_interests;
          
          SELECT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'polox' 
              AND table_name = 'leads_backup_011' 
              AND column_name = 'tags'
          ) INTO has_tags;
          
          -- Restaurar apenas colunas que existem
          IF has_notes THEN
            UPDATE polox.leads l
            SET notes = b.notes
            FROM polox.leads_backup_011 b
            WHERE l.id = b.id;
          END IF;
          
          IF has_interests THEN
            UPDATE polox.leads l
            SET interests = b.interests
            FROM polox.leads_backup_011 b
            WHERE l.id = b.id;
          END IF;
          
          IF has_tags THEN
            UPDATE polox.leads l
            SET tags = b.tags
            FROM polox.leads_backup_011 b
            WHERE l.id = b.id;
          END IF;
          
          RAISE NOTICE 'Dados restaurados do backup';
        END;
      END IF;
    END $$;
  `);

  // 3. Renomear created_by_id de volta para user_id
  await client.query(`
    DO $$ 
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'polox' 
        AND table_name = 'leads' 
        AND column_name = 'created_by_id'
      ) THEN
        ALTER TABLE polox.leads RENAME COLUMN created_by_id TO user_id;
        RAISE NOTICE 'Coluna created_by_id renomeada de volta para user_id';
      END IF;
    END $$;
  `);

  // 4. Renomear owner_id de volta para assigned_to_id (se existir)
  await client.query(`
    DO $$ 
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'polox' 
        AND table_name = 'leads' 
        AND column_name = 'owner_id'
      ) THEN
        ALTER TABLE polox.leads RENAME COLUMN owner_id TO assigned_to_id;
        RAISE NOTICE 'Coluna owner_id renomeada de volta para assigned_to_id';
      END IF;
    END $$;
  `);

  // 5. Remover tabela de backup
  await client.query(`
    DROP TABLE IF EXISTS polox.leads_backup_011;
  `);

  console.log('✅ Rollback da migration 011_refactor_leads_table concluído!');
};

module.exports = { up, down };
