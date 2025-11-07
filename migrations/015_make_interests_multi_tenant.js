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
 * Migration: 015_make_interests_multi_tenant
 * Descrição: Torna a tabela interests multi-tenant com suporte para interesses globais e da empresa
 * Data: 2025-10-23
 * 
 * Mudanças:
 * - Adiciona coluna company_id (NULLABLE) à tabela interests
 * - Adiciona FK para polox.companies(id) com ON DELETE CASCADE
 * - Remove constraint UNIQUE antiga em name
 * - Adiciona índices únicos parciais:
 *   * Interesses da empresa: UNIQUE (company_id, name) WHERE company_id IS NOT NULL
 *   * Interesses globais: UNIQUE (name) WHERE company_id IS NULL
 */

const up = async (client) => {
  console.log('🔄 Tornando tabela interests multi-tenant...');

  // 1. Adicionar coluna company_id (NULLABLE)
  await client.query(`
    ALTER TABLE polox.interests 
    ADD COLUMN IF NOT EXISTS company_id BIGINT NULL;
  `);
  console.log('✅ Coluna company_id adicionada');

  // 2. Adicionar Foreign Key para polox.companies(id) com ON DELETE CASCADE
  await client.query(`
    DO $$ 
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_interests_company'
        AND table_schema = 'polox'
        AND table_name = 'interests'
      ) THEN
        ALTER TABLE polox.interests 
        ADD CONSTRAINT fk_interests_company 
        FOREIGN KEY (company_id) 
        REFERENCES polox.companies(id) 
        ON DELETE CASCADE;
        
        RAISE NOTICE 'Foreign key fk_interests_company criada';
      ELSE
        RAISE NOTICE 'Foreign key fk_interests_company já existe';
      END IF;
    END $$;
  `);
  console.log('✅ Foreign key para companies adicionada');

  // 3. Remover constraint UNIQUE antiga em name (se existir)
  await client.query(`
    DO $$ 
    BEGIN
      -- Verificar e remover interests_name_key
      IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'interests_name_key' 
        AND connamespace = 'polox'::regnamespace
      ) THEN
        ALTER TABLE polox.interests DROP CONSTRAINT interests_name_key;
        RAISE NOTICE 'Constraint interests_name_key removida';
      ELSE
        RAISE NOTICE 'Constraint interests_name_key não existe';
      END IF;
      
      -- Verificar e remover outros possíveis nomes de constraint UNIQUE em name
      IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conrelid = 'polox.interests'::regclass
        AND contype = 'u'
        AND conkey = ARRAY[(
          SELECT attnum FROM pg_attribute 
          WHERE attrelid = 'polox.interests'::regclass 
          AND attname = 'name'
        )]
      ) THEN
        DECLARE
          constraint_name TEXT;
        BEGIN
          SELECT conname INTO constraint_name
          FROM pg_constraint 
          WHERE conrelid = 'polox.interests'::regclass
          AND contype = 'u'
          AND conkey = ARRAY[(
            SELECT attnum FROM pg_attribute 
            WHERE attrelid = 'polox.interests'::regclass 
            AND attname = 'name'
          )]
          LIMIT 1;
          
          IF constraint_name IS NOT NULL THEN
            EXECUTE format('ALTER TABLE polox.interests DROP CONSTRAINT %I', constraint_name);
            RAISE NOTICE 'Constraint % removida', constraint_name;
          END IF;
        END;
      END IF;
    END $$;
  `);
  console.log('✅ Constraints UNIQUE antigas removidas');

  // 4. Criar índice único parcial para interesses da empresa
  await client.query(`
    DROP INDEX IF EXISTS polox.idx_interests_company_name_unique;
    
    CREATE UNIQUE INDEX idx_interests_company_name_unique 
    ON polox.interests (company_id, name) 
    WHERE company_id IS NOT NULL;
  `);
  console.log('✅ Índice único para interesses da empresa criado');

  // 5. Criar índice único parcial para interesses globais
  await client.query(`
    DROP INDEX IF EXISTS polox.idx_interests_global_name_unique;
    
    CREATE UNIQUE INDEX idx_interests_global_name_unique 
    ON polox.interests (name) 
    WHERE company_id IS NULL;
  `);
  console.log('✅ Índice único para interesses globais criado');

  // 6. Adicionar índice para melhorar performance de queries por company_id
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_interests_company_id 
    ON polox.interests(company_id) 
    WHERE company_id IS NOT NULL;
  `);
  console.log('✅ Índice de performance em company_id criado');

  // 7. Atualizar comentários para documentação
  await client.query(`
    COMMENT ON COLUMN polox.interests.company_id IS 
      'ID da empresa dona do interesse. NULL = interesse global do sistema, INT = interesse específico da empresa';
  `);

  await client.query(`
    COMMENT ON TABLE polox.interests IS 
      'Tabela de interesses - suporta interesses globais (company_id NULL) e específicos por empresa (company_id NOT NULL)';
  `);
  console.log('✅ Comentários atualizados');

  console.log('✅ Migration 015_make_interests_multi_tenant concluída com sucesso!');
  console.log('ℹ️  Agora a tabela interests suporta:');
  console.log('   - Interesses globais: company_id IS NULL (sistema, não editáveis)');
  console.log('   - Interesses da empresa: company_id NOT NULL (específicos da empresa)');
};

const down = async (client) => {
  console.log('🔄 Revertendo migration 015_make_interests_multi_tenant...');

  // 1. Remover índices criados
  await client.query('DROP INDEX IF EXISTS polox.idx_interests_company_id;');
  await client.query('DROP INDEX IF EXISTS polox.idx_interests_global_name_unique;');
  await client.query('DROP INDEX IF EXISTS polox.idx_interests_company_name_unique;');
  console.log('✅ Índices únicos parciais removidos');

  // 2. Recriar constraint UNIQUE simples em name (antes de remover company_id)
  // Nota: Isso pode falhar se houver duplicatas
  await client.query(`
    DO $$ 
    BEGIN
      -- Verificar se há duplicatas antes de criar constraint
      IF NOT EXISTS (
        SELECT name, COUNT(*) 
        FROM polox.interests 
        GROUP BY name 
        HAVING COUNT(*) > 1
      ) THEN
        ALTER TABLE polox.interests 
        ADD CONSTRAINT interests_name_key UNIQUE (name);
        RAISE NOTICE 'Constraint UNIQUE interests_name_key recriada';
      ELSE
        RAISE WARNING 'Não foi possível recriar constraint UNIQUE - existem nomes duplicados';
        RAISE WARNING 'Você precisará resolver as duplicatas manualmente';
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Erro ao recriar constraint: %', SQLERRM;
    END $$;
  `);

  // 3. Remover Foreign Key
  await client.query(`
    ALTER TABLE polox.interests 
    DROP CONSTRAINT IF EXISTS fk_interests_company;
  `);
  console.log('✅ Foreign key removida');

  // 4. Remover coluna company_id
  await client.query(`
    ALTER TABLE polox.interests 
    DROP COLUMN IF EXISTS company_id;
  `);
  console.log('✅ Coluna company_id removida');

  console.log('✅ Rollback da migration 015_make_interests_multi_tenant concluído!');
  console.log('⚠️  ATENÇÃO: Se havia dados com company_id específico, eles foram perdidos!');
};

module.exports = { up, down };
