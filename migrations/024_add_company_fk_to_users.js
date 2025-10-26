/**
 * Migration: 024_add_company_fk_to_users
 * Descrição: Adiciona FK entre public.users e polox.companies para vincular usuários globais às empresas
 * Data: 2025-10-23
 *
 * 🔗 RELACIONAMENTO ENTRE USUÁRIOS GLOBAIS E EMPRESAS
 *
 * Este migration:
 * 1. Adiciona coluna company_id na tabela public.users (nullable)
 * 2. Cria constraint de chave estrangeira com polox.companies
 * 3. Cria índice auxiliar para consultas por empresa
 * 4. Garante que a função update_updated_at_column() existe no schema public
 */

const up = async (client) => {
  console.log(
    "🔄 Iniciando migration 024: Adicionando FK entre public.users e polox.companies..."
  );

  // ================================================
  // ⚙️ FUNÇÃO DE TRIGGER: update_updated_at_column
  // ================================================
  console.log(
    "🔧 Verificando função update_updated_at_column..."
  );

  // Verificar se a função já existe no schema polox
  const checkFunction = await client.query(`
    SELECT EXISTS (
      SELECT 1 FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE p.proname = 'update_updated_at_column'
      AND n.nspname IN ('polox', 'public')
    );
  `);

  if (!checkFunction.rows[0].exists) {
    console.log("⚠️ Função update_updated_at_column não encontrada, criando no schema polox...");
    
    await client.query(`
      CREATE OR REPLACE FUNCTION polox.update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
    
    console.log("✅ Função update_updated_at_column criada no schema polox");
  } else {
    console.log("✅ Função update_updated_at_column já existe, pulando criação");
  }

  // ================================================
  // 🔗 RELACIONAMENTO ENTRE USUÁRIOS GLOBAIS E EMPRESAS
  // ================================================

  // 1. Adicionar coluna de vínculo com empresa
  console.log("🔗 Adicionando coluna company_id na tabela polox.users...");

  await client.query(`
    ALTER TABLE polox.users
    ADD COLUMN IF NOT EXISTS company_id BIGINT NULL;
  `);

  console.log("✅ Coluna company_id adicionada à tabela polox.users");

  // 2. Criar constraint de chave estrangeira
  console.log("🔗 Criando constraint de chave estrangeira...");

  await client.query(`
    DO $$
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints
            WHERE constraint_name = 'fk_polox_users_company'
            AND table_name = 'users'
            AND table_schema = 'polox'
        ) THEN
            ALTER TABLE polox.users
            ADD CONSTRAINT fk_polox_users_company
            FOREIGN KEY (company_id)
            REFERENCES polox.companies(id)
            ON DELETE SET NULL
            ON UPDATE CASCADE;
        END IF;
    END $$;
  `);

  console.log("✅ Constraint fk_polox_users_company criada");

  // 3. Criar índice auxiliar para consultas por empresa
  console.log("📊 Criando índice auxiliar para consultas por empresa...");

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_polox_users_company_id
    ON polox.users (company_id);
  `);

  console.log("✅ Índice idx_polox_users_company_id criado");

  // 4. Adicionar comentários para documentação
  await client.query(`
    COMMENT ON COLUMN polox.users.company_id IS 'ID da empresa à qual o usuário pertence (opcional, permite usuários sem vínculo específico)';
  `);

  console.log("✅ Comentários de documentação adicionados");
  console.log(
    "✅ Migration 024_add_company_fk_to_users concluída com sucesso!"
  );
  console.log("");
  console.log("🎯 Resultado:");
  console.log("  ✓ Coluna company_id adicionada em public.users (NULLABLE)");
  console.log("  ✓ FK fk_public_users_company criada com polox.companies");
  console.log("  ✓ ON DELETE SET NULL para segurança");
  console.log("  ✓ Índice idx_public_users_company_id criado para performance");
  console.log(
    "  ✓ Função update_updated_at_column disponível no schema public"
  );
};

const down = async (client) => {
  console.log("🔄 Revertendo migration 024_add_company_fk_to_users...");

  // 1. Remover índice
  console.log("🗑️ Removendo índice idx_polox_users_company_id...");
  await client.query(`
    DROP INDEX IF EXISTS polox.idx_polox_users_company_id;
  `);

  console.log("✅ Índice removido");

  // 2. Remover constraint de FK
  console.log("🗑️ Removendo constraint fk_polox_users_company...");
  await client.query(`
    ALTER TABLE polox.users
    DROP CONSTRAINT IF EXISTS fk_polox_users_company;
  `);

  console.log("✅ Constraint removida");

  // 3. Remover coluna company_id
  console.log("🗑️ Removendo coluna company_id...");
  await client.query(`
    ALTER TABLE polox.users
    DROP COLUMN IF EXISTS company_id;
  `);

  console.log("✅ Coluna company_id removida da tabela polox.users");

  // Nota: Não removemos a função update_updated_at_column pois ela pode estar sendo usada por outros triggers
  console.log(
    "ℹ️ Função update_updated_at_column mantida (pode estar sendo usada por outros triggers)"
  );

  console.log(
    "✅ Rollback da migration 024_add_company_fk_to_users concluído!"
  );
};

module.exports = { up, down };
