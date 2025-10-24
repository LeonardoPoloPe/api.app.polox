/**
 * Migration: 028_fix_leads_table_columns
 * Descrição: Adiciona/ajusta colunas faltantes na tabela leads
 * Data: 2025-10-23
 * 
 * Mudanças:
 * - Garante que todas as colunas necessárias existam
 * - Adiciona índices para performance
 * - Ajusta tipos de dados conforme necessário
 */

const up = async (client) => {
  console.log('🔄 Ajustando colunas da tabela leads...');

  // 1. Adicionar colunas que podem estar faltando
  await client.query(`
    DO $$ 
    BEGIN
      -- Coluna company_id (obrigatória para multi-tenant)
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'polox' 
        AND table_name = 'leads' 
        AND column_name = 'company_id'
      ) THEN
        ALTER TABLE polox.leads ADD COLUMN company_id INTEGER NOT NULL;
        ALTER TABLE polox.leads ADD CONSTRAINT fk_leads_company 
          FOREIGN KEY (company_id) REFERENCES polox.companies(id) ON DELETE CASCADE;
        RAISE NOTICE 'Coluna company_id adicionada';
      END IF;

      -- Coluna created_by_id
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'polox' 
        AND table_name = 'leads' 
        AND column_name = 'created_by_id'
      ) THEN
        ALTER TABLE polox.leads ADD COLUMN created_by_id INTEGER;
        ALTER TABLE polox.leads ADD CONSTRAINT fk_leads_created_by 
          FOREIGN KEY (created_by_id) REFERENCES polox.users(id) ON DELETE SET NULL;
        RAISE NOTICE 'Coluna created_by_id adicionada';
      END IF;

      -- Coluna owner_id (responsável pelo lead)
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'polox' 
        AND table_name = 'leads' 
        AND column_name = 'owner_id'
      ) THEN
        ALTER TABLE polox.leads ADD COLUMN owner_id INTEGER;
        ALTER TABLE polox.leads ADD CONSTRAINT fk_leads_owner 
          FOREIGN KEY (owner_id) REFERENCES polox.users(id) ON DELETE SET NULL;
        RAISE NOTICE 'Coluna owner_id adicionada';
      END IF;

      -- Colunas de informação básica
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'polox' AND table_name = 'leads' AND column_name = 'name'
      ) THEN
        ALTER TABLE polox.leads ADD COLUMN name VARCHAR(255) NOT NULL;
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'polox' AND table_name = 'leads' AND column_name = 'email'
      ) THEN
        ALTER TABLE polox.leads ADD COLUMN email VARCHAR(255);
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'polox' AND table_name = 'leads' AND column_name = 'phone'
      ) THEN
        ALTER TABLE polox.leads ADD COLUMN phone VARCHAR(20);
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'polox' AND table_name = 'leads' AND column_name = 'company_name'
      ) THEN
        ALTER TABLE polox.leads ADD COLUMN company_name VARCHAR(255);
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'polox' AND table_name = 'leads' AND column_name = 'position'
      ) THEN
        ALTER TABLE polox.leads ADD COLUMN position VARCHAR(100);
      END IF;

      -- Colunas de status e categorização
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'polox' AND table_name = 'leads' AND column_name = 'status'
      ) THEN
        ALTER TABLE polox.leads ADD COLUMN status VARCHAR(50) DEFAULT 'new';
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'polox' AND table_name = 'leads' AND column_name = 'source'
      ) THEN
        ALTER TABLE polox.leads ADD COLUMN source VARCHAR(50);
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'polox' AND table_name = 'leads' AND column_name = 'score'
      ) THEN
        ALTER TABLE polox.leads ADD COLUMN score INTEGER DEFAULT 0;
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'polox' AND table_name = 'leads' AND column_name = 'temperature'
      ) THEN
        ALTER TABLE polox.leads ADD COLUMN temperature VARCHAR(20) DEFAULT 'cold';
      END IF;

      -- Colunas de localização
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'polox' AND table_name = 'leads' AND column_name = 'city'
      ) THEN
        ALTER TABLE polox.leads ADD COLUMN city VARCHAR(100);
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'polox' AND table_name = 'leads' AND column_name = 'state'
      ) THEN
        ALTER TABLE polox.leads ADD COLUMN state VARCHAR(2);
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'polox' AND table_name = 'leads' AND column_name = 'country'
      ) THEN
        ALTER TABLE polox.leads ADD COLUMN country VARCHAR(100) DEFAULT 'BR';
      END IF;

      -- Colunas de datas de interação
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'polox' AND table_name = 'leads' AND column_name = 'first_contact_at'
      ) THEN
        ALTER TABLE polox.leads ADD COLUMN first_contact_at TIMESTAMP;
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'polox' AND table_name = 'leads' AND column_name = 'last_contact_at'
      ) THEN
        ALTER TABLE polox.leads ADD COLUMN last_contact_at TIMESTAMP;
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'polox' AND table_name = 'leads' AND column_name = 'next_follow_up_at'
      ) THEN
        ALTER TABLE polox.leads ADD COLUMN next_follow_up_at TIMESTAMP;
      END IF;

      -- Colunas de conversão
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'polox' AND table_name = 'leads' AND column_name = 'converted_to_client_id'
      ) THEN
        ALTER TABLE polox.leads ADD COLUMN converted_to_client_id INTEGER;
        ALTER TABLE polox.leads ADD CONSTRAINT fk_leads_converted_client 
          FOREIGN KEY (converted_to_client_id) REFERENCES polox.clients(id) ON DELETE SET NULL;
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'polox' AND table_name = 'leads' AND column_name = 'converted_at'
      ) THEN
        ALTER TABLE polox.leads ADD COLUMN converted_at TIMESTAMP;
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'polox' AND table_name = 'leads' AND column_name = 'conversion_value'
      ) THEN
        ALTER TABLE polox.leads ADD COLUMN conversion_value DECIMAL(15,2);
      END IF;

      -- Colunas de auditoria
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'polox' AND table_name = 'leads' AND column_name = 'created_at'
      ) THEN
        ALTER TABLE polox.leads ADD COLUMN created_at TIMESTAMP DEFAULT NOW();
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'polox' AND table_name = 'leads' AND column_name = 'updated_at'
      ) THEN
        ALTER TABLE polox.leads ADD COLUMN updated_at TIMESTAMP DEFAULT NOW();
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'polox' AND table_name = 'leads' AND column_name = 'deleted_at'
      ) THEN
        ALTER TABLE polox.leads ADD COLUMN deleted_at TIMESTAMP;
      END IF;

      RAISE NOTICE 'Verificação de colunas concluída';
    END $$;
  `);

  // 2. Criar índices para performance
  await client.query(`
    -- Índice para company_id (multi-tenant)
    CREATE INDEX IF NOT EXISTS idx_leads_company_id 
      ON polox.leads(company_id) WHERE deleted_at IS NULL;

    -- Índice para status
    CREATE INDEX IF NOT EXISTS idx_leads_status 
      ON polox.leads(status) WHERE deleted_at IS NULL;

    -- Índice para owner_id
    CREATE INDEX IF NOT EXISTS idx_leads_owner_id 
      ON polox.leads(owner_id) WHERE deleted_at IS NULL;

    -- Índice para source
    CREATE INDEX IF NOT EXISTS idx_leads_source 
      ON polox.leads(source) WHERE deleted_at IS NULL;

    -- Índice para temperatura
    CREATE INDEX IF NOT EXISTS idx_leads_temperature 
      ON polox.leads(temperature) WHERE deleted_at IS NULL;

    -- Índice para score
    CREATE INDEX IF NOT EXISTS idx_leads_score 
      ON polox.leads(score DESC) WHERE deleted_at IS NULL;

    -- Índice para email (busca)
    CREATE INDEX IF NOT EXISTS idx_leads_email 
      ON polox.leads(email) WHERE deleted_at IS NULL AND email IS NOT NULL;

    -- Índice para created_at (ordenação)
    CREATE INDEX IF NOT EXISTS idx_leads_created_at 
      ON polox.leads(created_at DESC) WHERE deleted_at IS NULL;

    -- Índice para deleted_at (soft delete)
    CREATE INDEX IF NOT EXISTS idx_leads_deleted_at 
      ON polox.leads(deleted_at);

    -- Índice composto para listagem filtrada por empresa
    CREATE INDEX IF NOT EXISTS idx_leads_company_status_created 
      ON polox.leads(company_id, status, created_at DESC) WHERE deleted_at IS NULL;

    -- Índice para busca de texto (name, email, company_name)
    CREATE INDEX IF NOT EXISTS idx_leads_search_name 
      ON polox.leads USING gin(to_tsvector('portuguese', COALESCE(name, '')));
    
    CREATE INDEX IF NOT EXISTS idx_leads_search_company 
      ON polox.leads USING gin(to_tsvector('portuguese', COALESCE(company_name, '')));
  `);

  console.log('✅ Índices criados');

  // 3. Adicionar comentários nas colunas
  await client.query(`
    COMMENT ON TABLE polox.leads IS 'Tabela de leads/prospects do CRM';
    COMMENT ON COLUMN polox.leads.company_id IS 'ID da empresa (multi-tenant)';
    COMMENT ON COLUMN polox.leads.created_by_id IS 'ID do usuário que criou o lead';
    COMMENT ON COLUMN polox.leads.owner_id IS 'ID do usuário responsável pelo lead';
    COMMENT ON COLUMN polox.leads.status IS 'Status do lead: new, contacted, qualified, proposal, negotiation, won, lost';
    COMMENT ON COLUMN polox.leads.temperature IS 'Temperatura do lead: cold, warm, hot';
    COMMENT ON COLUMN polox.leads.score IS 'Pontuação do lead (0-100)';
    COMMENT ON COLUMN polox.leads.source IS 'Origem do lead';
    COMMENT ON COLUMN polox.leads.converted_to_client_id IS 'ID do cliente após conversão';
    COMMENT ON COLUMN polox.leads.deleted_at IS 'Data de exclusão (soft delete)';
  `);

  console.log('✅ Migration 028_fix_leads_table_columns concluída com sucesso!');
};

const down = async (client) => {
  console.log('🔄 Revertendo migration 028_fix_leads_table_columns...');

  // Remover índices
  await client.query(`
    DROP INDEX IF EXISTS polox.idx_leads_company_id;
    DROP INDEX IF EXISTS polox.idx_leads_status;
    DROP INDEX IF EXISTS polox.idx_leads_owner_id;
    DROP INDEX IF EXISTS polox.idx_leads_source;
    DROP INDEX IF EXISTS polox.idx_leads_temperature;
    DROP INDEX IF EXISTS polox.idx_leads_score;
    DROP INDEX IF EXISTS polox.idx_leads_email;
    DROP INDEX IF EXISTS polox.idx_leads_created_at;
    DROP INDEX IF EXISTS polox.idx_leads_deleted_at;
    DROP INDEX IF EXISTS polox.idx_leads_company_status_created;
    DROP INDEX IF EXISTS polox.idx_leads_search_name;
    DROP INDEX IF EXISTS polox.idx_leads_search_company;
  `);

  console.log('⚠️  Rollback concluído. Nota: As colunas não foram removidas para evitar perda de dados.');
  console.log('⚠️  Se necessário, remova as colunas manualmente após backup dos dados.');
};

module.exports = { up, down };
