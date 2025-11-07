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
 * Migration: 000_create_polox_schema
 * Descrição: Cria o schema polox completo baseado em DATABASE_SCHEMA.sql
 * Data: 2025-10-21
 * Versão: 1.0
 */

const up = async (client) => {
  console.log("🚀 Iniciando criação do schema polox...");

  const createSchemaQuery = `
    -- ==========================================
    -- 🗄️ POLOX CRM - DATABASE SCHEMA
    -- ==========================================
    
    -- Criar schema polox se não existir
    CREATE SCHEMA IF NOT EXISTS polox;
    
    -- Definir search_path para incluir schema polox
    SET search_path TO polox, public;
    
    -- ==========================================
    -- 🔐 EMPRESAS (Multi-Tenant)
    -- ==========================================

    -- Se existir uma tabela companies sem a coluna 'domain' (estado antigo/corrompido),
    -- descarta e recria com o layout correto. Isso protege ambientes de TESTE.
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'polox' AND table_name = 'companies'
      ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'polox' AND table_name = 'companies' AND column_name = 'domain'
      ) THEN
        RAISE NOTICE 'Recriando polox.companies pois coluna domain não existe';
        DROP TABLE polox.companies CASCADE;
      END IF;
    END$$;

    CREATE TABLE IF NOT EXISTS polox.companies (
        id BIGSERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        domain VARCHAR(100) UNIQUE NOT NULL,
        slug VARCHAR(100) UNIQUE NOT NULL,
        
        -- Planos e Status
        plan VARCHAR(50) NOT NULL DEFAULT 'starter',
        status VARCHAR(50) NOT NULL DEFAULT 'active',
        max_users INTEGER NOT NULL DEFAULT 5,
        max_storage_mb INTEGER NOT NULL DEFAULT 1000,
        
        -- Informações da Empresa
        industry VARCHAR(100),
        company_size VARCHAR(50),
        country VARCHAR(3) DEFAULT 'BR',
        timezone VARCHAR(50) DEFAULT 'America/Sao_Paulo',
        language VARCHAR(5) DEFAULT 'pt-BR',
        
        -- Módulos Habilitados (JSON)
        enabled_modules JSONB DEFAULT '["dashboard", "users"]'::jsonb,
        
        -- Configurações da Empresa (JSON)
        settings JSONB DEFAULT '{
            "maxUploadSize": "5MB",
            "allowPublicRegistration": false,
            "requireEmailVerification": true
        }'::jsonb,
        
        -- Informações do Admin Principal
        admin_name VARCHAR(255),
        admin_email VARCHAR(255),
        admin_phone VARCHAR(20),
        
        -- Auditoria
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        deleted_at TIMESTAMP WITH TIME ZONE,
        
        -- Tracking
        last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        trial_ends_at TIMESTAMP WITH TIME ZONE,
        subscription_ends_at TIMESTAMP WITH TIME ZONE
    );
    
  -- Índices para companies
  CREATE INDEX IF NOT EXISTS idx_companies_domain ON polox.companies(domain);
    CREATE INDEX IF NOT EXISTS idx_companies_status ON polox.companies(status);
    CREATE INDEX IF NOT EXISTS idx_companies_plan ON polox.companies(plan);
    CREATE INDEX IF NOT EXISTS idx_companies_created_at ON polox.companies(created_at);
    
    -- ==========================================
    -- 👤 USUÁRIOS
    -- ==========================================
    
    CREATE TABLE IF NOT EXISTS polox.users (
        id BIGSERIAL PRIMARY KEY,
        company_id BIGINT NOT NULL REFERENCES polox.companies(id) ON DELETE CASCADE,
        
        -- Dados Pessoais
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        email_verified_at TIMESTAMP WITH TIME ZONE,
        password_hash VARCHAR(255) NOT NULL,
        
        -- Hierarquia e Permissões
        role VARCHAR(50) NOT NULL DEFAULT 'user',
        permissions JSONB DEFAULT '[]'::jsonb,
        
        -- Perfil
        avatar_url VARCHAR(500),
        phone VARCHAR(20),
        position VARCHAR(100),
        department VARCHAR(100),
        
        -- Status e Configurações
        status VARCHAR(50) NOT NULL DEFAULT 'active',
        language VARCHAR(5) DEFAULT 'pt-BR',
        timezone VARCHAR(50) DEFAULT 'America/Sao_Paulo',
        
        -- Configurações Pessoais (JSON)
        preferences JSONB DEFAULT '{
            "notifications": true,
            "emailUpdates": true,
            "dashboard_layout": "default"
        }'::jsonb,
        
        -- Segurança
        last_login_at TIMESTAMP WITH TIME ZONE,
        last_login_ip INET,
        failed_login_attempts INTEGER DEFAULT 0,
        locked_until TIMESTAMP WITH TIME ZONE,
        
        -- Tokens
        remember_token VARCHAR(100),
        verification_token VARCHAR(100),
        reset_password_token VARCHAR(100),
        reset_password_expires_at TIMESTAMP WITH TIME ZONE,
        
        -- Auditoria
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        deleted_at TIMESTAMP WITH TIME ZONE,
        
        -- Unique por empresa
        UNIQUE(company_id, email)
    );
    
    -- Índices para users
    CREATE INDEX IF NOT EXISTS idx_users_company_id ON polox.users(company_id);
    CREATE INDEX IF NOT EXISTS idx_users_email ON polox.users(email);
    CREATE INDEX IF NOT EXISTS idx_users_role ON polox.users(role);
    CREATE INDEX IF NOT EXISTS idx_users_status ON polox.users(status);
    CREATE INDEX IF NOT EXISTS idx_users_created_at ON polox.users(created_at);
    
    -- ==========================================
    -- 🔑 SESSÕES DE USUÁRIO (JWT Tracking)
    -- ==========================================
    
    CREATE TABLE IF NOT EXISTS polox.user_sessions (
        id BIGSERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL REFERENCES polox.users(id) ON DELETE CASCADE,
        
        token_id VARCHAR(255) NOT NULL UNIQUE,
        refresh_token VARCHAR(255) UNIQUE,
        
        ip_address INET,
        user_agent TEXT,
        device_info JSONB,
        
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        revoked_at TIMESTAMP WITH TIME ZONE,
        status VARCHAR(20) DEFAULT 'active',
        
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    
    -- Índices para user_sessions
    CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON polox.user_sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_user_sessions_token_id ON polox.user_sessions(token_id);
    CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON polox.user_sessions(expires_at);
    CREATE INDEX IF NOT EXISTS idx_user_sessions_status ON polox.user_sessions(status);
    
    -- ==========================================
    -- 🚫 TOKEN BLACKLIST
    -- ==========================================
    
    CREATE TABLE IF NOT EXISTS polox.token_blacklist (
        id BIGSERIAL PRIMARY KEY,
        token_hash VARCHAR(64) NOT NULL UNIQUE,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    
    -- Índices para token_blacklist
    CREATE INDEX IF NOT EXISTS idx_token_blacklist_token_hash ON polox.token_blacklist(token_hash);
    CREATE INDEX IF NOT EXISTS idx_token_blacklist_expires_at ON polox.token_blacklist(expires_at);
  `;

  await client.query(createSchemaQuery);
  console.log("✅ Schema polox e tabelas principais criadas");

  // Criar triggers
  const createTriggersQuery = `
    -- ==========================================
    -- 🚀 TRIGGERS E FUNÇÕES
    -- ==========================================
    
    -- Função para atualizar updated_at automaticamente
    CREATE OR REPLACE FUNCTION polox.update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
    END;
    $$ language 'plpgsql';
    
    -- Aplicar trigger em tabelas principais
    DROP TRIGGER IF EXISTS update_companies_updated_at ON polox.companies;
    CREATE TRIGGER update_companies_updated_at 
        BEFORE UPDATE ON polox.companies 
        FOR EACH ROW EXECUTE FUNCTION polox.update_updated_at_column();
    
    DROP TRIGGER IF EXISTS update_users_updated_at ON polox.users;
    CREATE TRIGGER update_users_updated_at 
        BEFORE UPDATE ON polox.users 
        FOR EACH ROW EXECUTE FUNCTION polox.update_updated_at_column();
  `;

  await client.query(createTriggersQuery);
  console.log("✅ Triggers criados");

  // Inserir dados iniciais
  const insertInitialDataQuery = `
    -- ==========================================
    -- 📊 DADOS INICIAIS
    -- ==========================================
    
    -- Inserir empresa padrão para desenvolvimento (se não existir)
    INSERT INTO polox.companies (
        name, domain, slug, plan, status, industry, company_size,
        admin_name, admin_email, enabled_modules
    ) 
    SELECT 
        'Polox Demo Company', 
        'demo.polox.com', 
        'demo-polox', 
        'enterprise', 
        'active', 
        'technology', 
        '6-20',
        'Admin Demo', 
        'admin@demo.polox.com',
        '["dashboard", "users", "leads", "clients", "sales", "products", "finance", "schedule", "tickets", "suppliers", "analytics", "gamification", "notifications"]'::jsonb
    WHERE NOT EXISTS (
        SELECT 1 FROM polox.companies WHERE domain = 'demo.polox.com'
    );
  `;

  await client.query(insertInitialDataQuery);
  console.log("✅ Dados iniciais inseridos");

  console.log("🎉 Schema polox criado com sucesso!");
};

const down = async (client) => {
  console.log("🗑️ Removendo schema polox...");

  const dropSchemaQuery = `
    -- Remover triggers
    DROP TRIGGER IF EXISTS update_companies_updated_at ON polox.companies;
    DROP TRIGGER IF EXISTS update_users_updated_at ON polox.users;
    
    -- Remover função
    DROP FUNCTION IF EXISTS polox.update_updated_at_column();
    
    -- Remover schema completo (CASCADE remove todas as tabelas)
    DROP SCHEMA IF EXISTS polox CASCADE;
  `;

  await client.query(dropSchemaQuery);
  console.log("✅ Schema polox removido com sucesso");
};

module.exports = {
  up,
  down,
};
