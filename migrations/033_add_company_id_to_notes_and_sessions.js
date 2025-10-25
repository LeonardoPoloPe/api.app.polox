/**
 * Migration: 033_add_company_id_to_notes_and_sessions
 * Descrição: Adiciona coluna company_id em 4 tabelas para garantir multi-tenancy
 * Data: 2025-10-25
 *
 * 🔒 REFATORAÇÃO DE SEGURANÇA MULTI-TENANT
 *
 * Este migration adiciona company_id às seguintes tabelas:
 * 1. polox.client_notes - via polox.clients.company_id
 * 2. polox.lead_notes - via polox.leads.company_id
 * 3. polox.gamification_history - via polox.users.company_id
 * 4. polox.user_sessions - via polox.users.company_id
 *
 * Para cada tabela:
 * - Adiciona coluna company_id (INT8, nullable)
 * - Popula com dados existentes da tabela relacionada
 * - Aplica NOT NULL + FK constraint
 * - Cria índice para performance
 */

const up = async (client) => {
  console.log(
    "🔄 Iniciando migration 033: Adicionando company_id para multi-tenancy..."
  );

  // ================================================
  // 📋 TABELA [1/4]: polox.client_notes
  // ================================================
  console.log("🔧 [1/4] Processando tabela polox.client_notes...");

  // 1.1: Adicionar a coluna (permitindo null)
  console.log("  ➕ Adicionando coluna company_id...");
  await client.query(`
    ALTER TABLE polox.client_notes 
    ADD COLUMN IF NOT EXISTS company_id INT8;
  `);

  // 1.2: Popular a coluna com dados existentes
  console.log("  📊 Populando company_id com dados existentes...");
  await client.query(`
    UPDATE polox.client_notes cn
    SET company_id = (
      SELECT c.company_id 
      FROM polox.clients c 
      WHERE c.id = cn.client_id
    )
    WHERE cn.company_id IS NULL;
  `);

  // 1.3: Aplicar NOT NULL e Chave Estrangeira
  console.log("  🔒 Aplicando NOT NULL e FK constraint...");
  await client.query(`
    ALTER TABLE polox.client_notes 
    ALTER COLUMN company_id SET NOT NULL;
  `);

  await client.query(`
    DO $$
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints
            WHERE constraint_name = 'fk_client_notes_company'
            AND table_name = 'client_notes'
            AND table_schema = 'polox'
        ) THEN
            ALTER TABLE polox.client_notes
            ADD CONSTRAINT fk_client_notes_company 
            FOREIGN KEY (company_id) REFERENCES polox.companies(id) ON DELETE CASCADE;
        END IF;
    END $$;
  `);

  console.log("✅ [1/4] polox.client_notes processada com sucesso");

  // ================================================
  // 📋 TABELA [2/4]: polox.lead_notes
  // ================================================
  console.log("🔧 [2/4] Processando tabela polox.lead_notes...");

  // 2.1: Adicionar a coluna (permitindo null)
  console.log("  ➕ Adicionando coluna company_id...");
  await client.query(`
    ALTER TABLE polox.lead_notes 
    ADD COLUMN IF NOT EXISTS company_id INT8;
  `);

  // 2.2: Popular a coluna com dados existentes
  console.log("  📊 Populando company_id com dados existentes...");
  await client.query(`
    UPDATE polox.lead_notes ln
    SET company_id = (
      SELECT l.company_id 
      FROM polox.leads l 
      WHERE l.id = ln.lead_id
    )
    WHERE ln.company_id IS NULL;
  `);

  // 2.3: Aplicar NOT NULL e Chave Estrangeira
  console.log("  🔒 Aplicando NOT NULL e FK constraint...");
  await client.query(`
    ALTER TABLE polox.lead_notes 
    ALTER COLUMN company_id SET NOT NULL;
  `);

  await client.query(`
    DO $$
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints
            WHERE constraint_name = 'fk_lead_notes_company'
            AND table_name = 'lead_notes'
            AND table_schema = 'polox'
        ) THEN
            ALTER TABLE polox.lead_notes
            ADD CONSTRAINT fk_lead_notes_company 
            FOREIGN KEY (company_id) REFERENCES polox.companies(id) ON DELETE CASCADE;
        END IF;
    END $$;
  `);

  console.log("✅ [2/4] polox.lead_notes processada com sucesso");

  // ================================================
  // 📋 TABELA [3/4]: polox.gamification_history
  // ================================================
  console.log("🔧 [3/4] Processando tabela polox.gamification_history...");

  // 3.1: Adicionar a coluna (permitindo null)
  console.log("  ➕ Adicionando coluna company_id...");
  await client.query(`
    ALTER TABLE polox.gamification_history 
    ADD COLUMN IF NOT EXISTS company_id INT8;
  `);

  // 3.2: Popular a coluna com dados existentes
  console.log("  📊 Populando company_id com dados existentes...");
  await client.query(`
    UPDATE polox.gamification_history gh
    SET company_id = (
      SELECT u.company_id 
      FROM polox.users u 
      WHERE u.id = gh.user_id
    )
    WHERE gh.company_id IS NULL;
  `);

  // 3.3: Aplicar NOT NULL e Chave Estrangeira
  console.log("  🔒 Aplicando NOT NULL e FK constraint...");
  await client.query(`
    ALTER TABLE polox.gamification_history 
    ALTER COLUMN company_id SET NOT NULL;
  `);

  await client.query(`
    DO $$
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints
            WHERE constraint_name = 'fk_gamification_history_company'
            AND table_name = 'gamification_history'
            AND table_schema = 'polox'
        ) THEN
            ALTER TABLE polox.gamification_history
            ADD CONSTRAINT fk_gamification_history_company 
            FOREIGN KEY (company_id) REFERENCES polox.companies(id) ON DELETE CASCADE;
        END IF;
    END $$;
  `);

  console.log("✅ [3/4] polox.gamification_history processada com sucesso");

  // ================================================
  // 📋 TABELA [4/4]: polox.user_sessions
  // ================================================
  console.log("🔧 [4/4] Processando tabela polox.user_sessions...");

  // 4.1: Adicionar a coluna (permitindo null)
  console.log("  ➕ Adicionando coluna company_id...");
  await client.query(`
    ALTER TABLE polox.user_sessions 
    ADD COLUMN IF NOT EXISTS company_id INT8;
  `);

  // 4.2: Popular a coluna com dados existentes
  console.log("  📊 Populando company_id com dados existentes...");
  await client.query(`
    UPDATE polox.user_sessions us
    SET company_id = (
      SELECT u.company_id 
      FROM polox.users u 
      WHERE u.id = us.user_id
    )
    WHERE us.company_id IS NULL;
  `);

  // 4.3: Aplicar NOT NULL e Chave Estrangeira
  console.log("  🔒 Aplicando NOT NULL e FK constraint...");
  await client.query(`
    ALTER TABLE polox.user_sessions 
    ALTER COLUMN company_id SET NOT NULL;
  `);

  await client.query(`
    DO $$
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints
            WHERE constraint_name = 'fk_user_sessions_company'
            AND table_name = 'user_sessions'
            AND table_schema = 'polox'
        ) THEN
            ALTER TABLE polox.user_sessions
            ADD CONSTRAINT fk_user_sessions_company 
            FOREIGN KEY (company_id) REFERENCES polox.companies(id) ON DELETE CASCADE;
        END IF;
    END $$;
  `);

  console.log("✅ [4/4] polox.user_sessions processada com sucesso");

  // ================================================
  // 📈 ÍNDICES PARA PERFORMANCE
  // ================================================
  console.log("📊 Criando índices para otimização de consultas...");

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_client_notes_company_id 
    ON polox.client_notes(company_id);
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_lead_notes_company_id 
    ON polox.lead_notes(company_id);
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_gamification_history_company_id 
    ON polox.gamification_history(company_id);
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_user_sessions_company_id 
    ON polox.user_sessions(company_id);
  `);

  console.log("✅ Índices criados com sucesso");

  // ================================================
  // 📝 DOCUMENTAÇÃO
  // ================================================
  console.log("📝 Adicionando comentários de documentação...");

  await client.query(`
    COMMENT ON COLUMN polox.client_notes.company_id IS 'ID da empresa - herdado de polox.clients para multi-tenancy';
    COMMENT ON COLUMN polox.lead_notes.company_id IS 'ID da empresa - herdado de polox.leads para multi-tenancy';
    COMMENT ON COLUMN polox.gamification_history.company_id IS 'ID da empresa - herdado de polox.users para multi-tenancy';
    COMMENT ON COLUMN polox.user_sessions.company_id IS 'ID da empresa - herdado de polox.users para multi-tenancy';
  `);

  console.log("✅ Comentários de documentação adicionados");

  // ================================================
  // 🎯 RESUMO FINAL
  // ================================================
  console.log("");
  console.log(
    "✅ Migration 033_add_company_id_to_notes_and_sessions concluída com sucesso!"
  );
  console.log("");
  console.log("🎯 Resultado da migração:");
  console.log("  ✓ polox.client_notes.company_id - NOT NULL + FK + Índice");
  console.log("  ✓ polox.lead_notes.company_id - NOT NULL + FK + Índice");
  console.log(
    "  ✓ polox.gamification_history.company_id - NOT NULL + FK + Índice"
  );
  console.log("  ✓ polox.user_sessions.company_id - NOT NULL + FK + Índice");
  console.log("  ✓ Todos os dados existentes foram migrados corretamente");
  console.log("  ✓ Multi-tenancy garantido com ON DELETE CASCADE");
  console.log("  ✓ Performance otimizada com índices nas novas colunas");
  console.log("");
  console.log("🔒 Segurança: Multi-tenancy implementado com sucesso!");
};

const down = async (client) => {
  console.log(
    "🔄 Revertendo migration 033_add_company_id_to_notes_and_sessions..."
  );

  // ================================================
  // 🗑️ REMOVER ÍNDICES
  // ================================================
  console.log("🗑️ Removendo índices...");

  await client.query(`
    DROP INDEX IF EXISTS polox.idx_client_notes_company_id;
  `);

  await client.query(`
    DROP INDEX IF EXISTS polox.idx_lead_notes_company_id;
  `);

  await client.query(`
    DROP INDEX IF EXISTS polox.idx_gamification_history_company_id;
  `);

  await client.query(`
    DROP INDEX IF EXISTS polox.idx_user_sessions_company_id;
  `);

  console.log("✅ Índices removidos");

  // ================================================
  // 🗑️ REMOVER CONSTRAINTS E COLUNAS
  // ================================================

  // [1/4] polox.client_notes
  console.log("🗑️ [1/4] Revertendo polox.client_notes...");
  await client.query(`
    ALTER TABLE polox.client_notes
    DROP CONSTRAINT IF EXISTS fk_client_notes_company;
  `);
  await client.query(`
    ALTER TABLE polox.client_notes
    DROP COLUMN IF EXISTS company_id;
  `);

  // [2/4] polox.lead_notes
  console.log("🗑️ [2/4] Revertendo polox.lead_notes...");
  await client.query(`
    ALTER TABLE polox.lead_notes
    DROP CONSTRAINT IF EXISTS fk_lead_notes_company;
  `);
  await client.query(`
    ALTER TABLE polox.lead_notes
    DROP COLUMN IF EXISTS company_id;
  `);

  // [3/4] polox.gamification_history
  console.log("🗑️ [3/4] Revertendo polox.gamification_history...");
  await client.query(`
    ALTER TABLE polox.gamification_history
    DROP CONSTRAINT IF EXISTS fk_gamification_history_company;
  `);
  await client.query(`
    ALTER TABLE polox.gamification_history
    DROP COLUMN IF EXISTS company_id;
  `);

  // [4/4] polox.user_sessions
  console.log("🗑️ [4/4] Revertendo polox.user_sessions...");
  await client.query(`
    ALTER TABLE polox.user_sessions
    DROP CONSTRAINT IF EXISTS fk_user_sessions_company;
  `);
  await client.query(`
    ALTER TABLE polox.user_sessions
    DROP COLUMN IF EXISTS company_id;
  `);

  console.log(
    "✅ Rollback da migration 033_add_company_id_to_notes_and_sessions concluído!"
  );
  console.log("");
  console.log("⚠️  Multi-tenancy removido das 4 tabelas");
  console.log("🔄 Estado anterior restaurado");
};

module.exports = { up, down };
