/**
 * Migration 026: Adicionar campos de White Label em polox.companies
 *
 * - company_type: VARCHAR(10) NOT NULL DEFAULT 'tenant' + CHECK in ('tenant','partner') + index
 * - partner_id: BIGINT NULL + FK para polox.companies(id) ON DELETE SET NULL + index
 * - Campos de branding: logo_url, favicon_url, primary_color, secondary_color,
 *   custom_domain (UNIQUE), support_email, support_phone, terms_url, privacy_url
 * - tenant_plan: VARCHAR(50) NULL + CHECK para somente tenants
 *
 * Data: 23/10/2025
 */

async function up(client) {
  console.log("📋 Iniciando Migration 026: Adicionar campos White Label em polox.companies...");

  // 1) Novas colunas
  await client.query(`
    ALTER TABLE polox.companies
      ADD COLUMN IF NOT EXISTS company_type VARCHAR(10) NOT NULL DEFAULT 'tenant',
      ADD COLUMN IF NOT EXISTS partner_id BIGINT NULL,
      ADD COLUMN IF NOT EXISTS logo_url VARCHAR(500),
      ADD COLUMN IF NOT EXISTS favicon_url VARCHAR(500),
      ADD COLUMN IF NOT EXISTS primary_color VARCHAR(7),
      ADD COLUMN IF NOT EXISTS secondary_color VARCHAR(7),
      ADD COLUMN IF NOT EXISTS custom_domain VARCHAR(100),
      ADD COLUMN IF NOT EXISTS support_email VARCHAR(255),
      ADD COLUMN IF NOT EXISTS support_phone VARCHAR(20),
      ADD COLUMN IF NOT EXISTS terms_url VARCHAR(500),
      ADD COLUMN IF NOT EXISTS privacy_url VARCHAR(500),
      ADD COLUMN IF NOT EXISTS tenant_plan VARCHAR(50);
  `);

  console.log("✅ Colunas adicionadas/verificadas");

  // 2) Constraints
  // 2.1) CHECK company_type
  await client.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'companies_company_type_check'
          AND conrelid = 'polox.companies'::regclass
      ) THEN
        ALTER TABLE polox.companies
          ADD CONSTRAINT companies_company_type_check
          CHECK (company_type IN ('tenant','partner'));
      END IF;
    END$$;
  `);
  console.log("✅ CHECK de company_type criado/verificado");

  // 2.2) FK partner_id -> companies(id) ON DELETE SET NULL
  await client.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'companies_partner_id_fkey'
          AND conrelid = 'polox.companies'::regclass
      ) THEN
        ALTER TABLE polox.companies
          ADD CONSTRAINT companies_partner_id_fkey
          FOREIGN KEY (partner_id)
          REFERENCES polox.companies(id)
          ON DELETE SET NULL;
      END IF;
    END$$;
  `);
  console.log("✅ FK partner_id -> companies.id criada/verificada");

  // 2.3) UNIQUE custom_domain
  await client.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'companies_custom_domain_key'
          AND conrelid = 'polox.companies'::regclass
      ) THEN
        ALTER TABLE polox.companies
          ADD CONSTRAINT companies_custom_domain_key
          UNIQUE (custom_domain);
      END IF;
    END$$;
  `);
  console.log("✅ UNIQUE(custom_domain) criado/verificado");

  // 2.4) CHECK tenant_plan somente para tenants
  await client.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'companies_tenant_plan_check'
          AND conrelid = 'polox.companies'::regclass
      ) THEN
        ALTER TABLE polox.companies
          ADD CONSTRAINT companies_tenant_plan_check
          CHECK ( (company_type = 'partner' AND tenant_plan IS NULL) OR (company_type = 'tenant') );
      END IF;
    END$$;
  `);
  console.log("✅ CHECK de tenant_plan criado/verificado");

  // 3) Índices
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_companies_company_type 
    ON polox.companies (company_type);
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_companies_partner_id 
    ON polox.companies (partner_id);
  `);
  console.log("✅ Índices criados/verificados");

  console.log("🎉 Migration 026 concluída com sucesso");
}

async function down(client) {
  console.log("🔄 Revertendo Migration 026: Removendo campos White Label de polox.companies...");

  // Remover índices
  await client.query(`
    DROP INDEX IF EXISTS idx_companies_partner_id;
  `);
  await client.query(`
    DROP INDEX IF EXISTS idx_companies_company_type;
  `);

  // Remover constraints
  await client.query(`
    ALTER TABLE polox.companies
      DROP CONSTRAINT IF EXISTS companies_tenant_plan_check,
      DROP CONSTRAINT IF EXISTS companies_custom_domain_key,
      DROP CONSTRAINT IF EXISTS companies_partner_id_fkey,
      DROP CONSTRAINT IF EXISTS companies_company_type_check;
  `);

  // Remover colunas adicionadas
  await client.query(`
    ALTER TABLE polox.companies
      DROP COLUMN IF EXISTS tenant_plan,
      DROP COLUMN IF EXISTS privacy_url,
      DROP COLUMN IF EXISTS terms_url,
      DROP COLUMN IF EXISTS support_phone,
      DROP COLUMN IF EXISTS support_email,
      DROP COLUMN IF EXISTS custom_domain,
      DROP COLUMN IF EXISTS secondary_color,
      DROP COLUMN IF EXISTS primary_color,
      DROP COLUMN IF EXISTS favicon_url,
      DROP COLUMN IF EXISTS logo_url,
      DROP COLUMN IF EXISTS partner_id,
      DROP COLUMN IF EXISTS company_type;
  `);

  console.log("✅ Migration 026 revertida com sucesso");
}

module.exports = { up, down };
