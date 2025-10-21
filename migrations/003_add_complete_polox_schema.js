/**
 * Migration: 003_add_complete_polox_schema
 * Descrição: [Descreva o que esta migration faz]
 * Data: 2025-10-21
 */

/**
 * Migration: 003_add_complete_polox_schema
 * Descrição: Adiciona todas as tabelas restantes do schema polox completo
 * Data: 2025-10-21
 * Versão: 1.0
 * Baseado: DATABASE_SCHEMA.sql completo
 */

const up = async (client) => {
  console.log('🚀 Criando schema polox completo...');

  // ==========================================
  // 🎯 VENDAS & RELACIONAMENTOS
  // ==========================================
  
  console.log('📊 Criando tabelas de leads...');
  await client.query(`
    CREATE TABLE IF NOT EXISTS polox.leads (
        id BIGSERIAL PRIMARY KEY,
        company_id BIGINT NOT NULL REFERENCES polox.companies(id) ON DELETE CASCADE,
        user_id BIGINT REFERENCES polox.users(id),
        
        -- Dados do Lead
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255),
        phone VARCHAR(20),
        company_name VARCHAR(255),
        position VARCHAR(100),
        
        -- Status e Classificação
        status VARCHAR(50) NOT NULL DEFAULT 'novo',
        source VARCHAR(100),
        score INTEGER DEFAULT 0,
        temperature VARCHAR(20) DEFAULT 'frio',
        
        -- Localização
        city VARCHAR(100),
        state VARCHAR(50),
        country VARCHAR(3) DEFAULT 'BR',
        
        -- Informações Adicionais
        notes TEXT,
        interests JSONB DEFAULT '[]'::jsonb,
        tags JSONB DEFAULT '[]'::jsonb,
        
        -- Tracking
        first_contact_at TIMESTAMP WITH TIME ZONE,
        last_contact_at TIMESTAMP WITH TIME ZONE,
        next_follow_up_at TIMESTAMP WITH TIME ZONE,
        
        -- Conversão
        converted_to_client_id BIGINT,
        converted_at TIMESTAMP WITH TIME ZONE,
        conversion_value DECIMAL(15,2),
        
        -- Auditoria
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        deleted_at TIMESTAMP WITH TIME ZONE
    );

    CREATE INDEX idx_leads_company_id ON polox.leads(company_id);
    CREATE INDEX idx_leads_user_id ON polox.leads(user_id);
    CREATE INDEX idx_leads_status ON polox.leads(status);
    CREATE INDEX idx_leads_source ON polox.leads(source);
    CREATE INDEX idx_leads_created_at ON polox.leads(created_at);
  `);

  console.log('👥 Criando tabelas de clientes...');
  await client.query(`
    CREATE TABLE IF NOT EXISTS polox.clients (
        id BIGSERIAL PRIMARY KEY,
        company_id BIGINT NOT NULL REFERENCES polox.companies(id) ON DELETE CASCADE,
        converted_from_lead_id BIGINT REFERENCES polox.leads(id),
        
        -- Dados do Cliente
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255),
        phone VARCHAR(20),
        company_name VARCHAR(255),
        document_number VARCHAR(50),
        document_type VARCHAR(20),
        
        -- Classificação
        type VARCHAR(50) DEFAULT 'person',
        category VARCHAR(100),
        status VARCHAR(50) NOT NULL DEFAULT 'ativo',
        
        -- Endereço
        address_street VARCHAR(255),
        address_number VARCHAR(20),
        address_complement VARCHAR(100),
        address_neighborhood VARCHAR(100),
        address_city VARCHAR(100),
        address_state VARCHAR(50),
        address_country VARCHAR(3) DEFAULT 'BR',
        address_postal_code VARCHAR(20),
        
        -- Informações Comerciais
        total_spent DECIMAL(15,2) DEFAULT 0.00,
        total_orders INTEGER DEFAULT 0,
        average_order_value DECIMAL(15,2) DEFAULT 0.00,
        lifetime_value DECIMAL(15,2) DEFAULT 0.00,
        
        -- Relacionamento
        acquisition_date DATE,
        last_purchase_date DATE,
        last_contact_date DATE,
        next_follow_up_date DATE,
        
        -- Personalização
        tags JSONB DEFAULT '[]'::jsonb,
        preferences JSONB DEFAULT '{}'::jsonb,
        notes TEXT,
        
        -- Auditoria
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        deleted_at TIMESTAMP WITH TIME ZONE
    );

    CREATE INDEX idx_clients_company_id ON polox.clients(company_id);
    CREATE INDEX idx_clients_email ON polox.clients(email);
    CREATE INDEX idx_clients_status ON polox.clients(status);
    CREATE INDEX idx_clients_category ON polox.clients(category);
    CREATE INDEX idx_clients_created_at ON polox.clients(created_at);
  `);

  console.log('💰 Criando tabelas de vendas...');
  await client.query(`
    CREATE TABLE IF NOT EXISTS polox.sales (
        id BIGSERIAL PRIMARY KEY,
        company_id BIGINT NOT NULL REFERENCES polox.companies(id) ON DELETE CASCADE,
        client_id BIGINT REFERENCES polox.clients(id),
        user_id BIGINT REFERENCES polox.users(id),
        
        sale_number VARCHAR(100) UNIQUE,
        
        total_amount DECIMAL(15,2) NOT NULL,
        discount_amount DECIMAL(15,2) DEFAULT 0.00,
        tax_amount DECIMAL(15,2) DEFAULT 0.00,
        net_amount DECIMAL(15,2) NOT NULL,
        
        status VARCHAR(50) NOT NULL DEFAULT 'pending',
        sale_date DATE NOT NULL,
        delivery_date DATE,
        
        payment_method VARCHAR(100),
        payment_status VARCHAR(50) DEFAULT 'pending',
        payment_due_date DATE,
        payment_date DATE,
        
        description TEXT,
        notes TEXT,
        tags JSONB DEFAULT '[]'::jsonb,
        
        commission_percentage DECIMAL(5,2) DEFAULT 0.00,
        commission_amount DECIMAL(15,2) DEFAULT 0.00,
        commission_paid BOOLEAN DEFAULT FALSE,
        
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        deleted_at TIMESTAMP WITH TIME ZONE
    );

    CREATE INDEX idx_sales_company_id ON polox.sales(company_id);
    CREATE INDEX idx_sales_client_id ON polox.sales(client_id);
    CREATE INDEX idx_sales_user_id ON polox.sales(user_id);
    CREATE INDEX idx_sales_status ON polox.sales(status);
    CREATE INDEX idx_sales_sale_date ON polox.sales(sale_date);
  `);

  // ==========================================
  // 📦 PRODUTOS & CATÁLOGO
  // ==========================================
  
  console.log('🏷️ Criando categorias de produtos...');
  await client.query(`
    CREATE TABLE IF NOT EXISTS polox.product_categories (
        id BIGSERIAL PRIMARY KEY,
        company_id BIGINT NOT NULL REFERENCES polox.companies(id) ON DELETE CASCADE,
        parent_id BIGINT REFERENCES polox.product_categories(id),
        
        name VARCHAR(255) NOT NULL,
        slug VARCHAR(255) NOT NULL,
        description TEXT,
        image_url VARCHAR(500),
        
        is_active BOOLEAN DEFAULT TRUE,
        sort_order INTEGER DEFAULT 0,
        
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        deleted_at TIMESTAMP WITH TIME ZONE,
        
        UNIQUE(company_id, slug)
    );

    CREATE INDEX idx_product_categories_company_id ON polox.product_categories(company_id);
    CREATE INDEX idx_product_categories_parent_id ON polox.product_categories(parent_id);
  `);

  console.log('📦 Criando tabela de produtos...');
  await client.query(`
    CREATE TABLE IF NOT EXISTS polox.products (
        id BIGSERIAL PRIMARY KEY,
        company_id BIGINT NOT NULL REFERENCES polox.companies(id) ON DELETE CASCADE,
        category_id BIGINT REFERENCES polox.product_categories(id),
        supplier_id BIGINT,
        
        name VARCHAR(255) NOT NULL,
        description TEXT,
        code VARCHAR(100),
        barcode VARCHAR(100),
        
        type VARCHAR(50) DEFAULT 'product',
        status VARCHAR(50) DEFAULT 'active',
        
        -- Preços
        cost_price DECIMAL(15,2) DEFAULT 0.00,
        sale_price DECIMAL(15,2) NOT NULL,
        markup_percentage DECIMAL(5,2) DEFAULT 0.00,
        
        -- Estoque
        stock_quantity INTEGER DEFAULT 0,
        min_stock_level INTEGER DEFAULT 0,
        max_stock_level INTEGER,
        stock_unit VARCHAR(20) DEFAULT 'unit',
        
        -- Dimensões e Peso
        weight DECIMAL(8,3),
        length DECIMAL(8,2),
        width DECIMAL(8,2),
        height DECIMAL(8,2),
        
        -- SEO e Marketing
        slug VARCHAR(255),
        meta_title VARCHAR(255),
        meta_description TEXT,
        tags JSONB DEFAULT '[]'::jsonb,
        
        -- Mídia
        featured_image_url VARCHAR(500),
        gallery_images JSONB DEFAULT '[]'::jsonb,
        
        -- Configurações
        is_featured BOOLEAN DEFAULT FALSE,
        is_digital BOOLEAN DEFAULT FALSE,
        requires_shipping BOOLEAN DEFAULT TRUE,
        
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        deleted_at TIMESTAMP WITH TIME ZONE,
        
        UNIQUE(company_id, code)
    );

    CREATE INDEX idx_products_company_id ON polox.products(company_id);
    CREATE INDEX idx_products_category_id ON polox.products(category_id);
    CREATE INDEX idx_products_code ON polox.products(code);
    CREATE INDEX idx_products_status ON polox.products(status);
  `);

  console.log('📋 Criando itens de venda...');
  await client.query(`
    CREATE TABLE IF NOT EXISTS polox.sale_items (
        id BIGSERIAL PRIMARY KEY,
        sale_id BIGINT NOT NULL REFERENCES polox.sales(id) ON DELETE CASCADE,
        product_id BIGINT REFERENCES polox.products(id),
        
        product_name VARCHAR(255) NOT NULL,
        quantity DECIMAL(10,3) NOT NULL,
        unit_price DECIMAL(15,2) NOT NULL,
        total_price DECIMAL(15,2) NOT NULL,
        
        discount_percentage DECIMAL(5,2) DEFAULT 0.00,
        discount_amount DECIMAL(15,2) DEFAULT 0.00,
        
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE INDEX idx_sale_items_sale_id ON polox.sale_items(sale_id);
    CREATE INDEX idx_sale_items_product_id ON polox.sale_items(product_id);
  `);

  // ==========================================
  // 💳 FINANCEIRO
  // ==========================================
  
  console.log('🏦 Criando contas financeiras...');
  await client.query(`
    CREATE TABLE IF NOT EXISTS polox.financial_accounts (
        id BIGSERIAL PRIMARY KEY,
        company_id BIGINT NOT NULL REFERENCES polox.companies(id) ON DELETE CASCADE,
        
        name VARCHAR(255) NOT NULL,
        type VARCHAR(50) NOT NULL,
        bank_name VARCHAR(255),
        account_number VARCHAR(100),
        agency VARCHAR(20),
        
        current_balance DECIMAL(15,2) DEFAULT 0.00,
        initial_balance DECIMAL(15,2) DEFAULT 0.00,
        
        is_active BOOLEAN DEFAULT TRUE,
        is_default BOOLEAN DEFAULT FALSE,
        
        description TEXT,
        
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        deleted_at TIMESTAMP WITH TIME ZONE
    );

    CREATE INDEX idx_financial_accounts_company_id ON polox.financial_accounts(company_id);
  `);

  console.log('💰 Criando transações financeiras...');
  await client.query(`
    CREATE TABLE IF NOT EXISTS polox.financial_transactions (
        id BIGSERIAL PRIMARY KEY,
        company_id BIGINT NOT NULL REFERENCES polox.companies(id) ON DELETE CASCADE,
        account_id BIGINT NOT NULL REFERENCES polox.financial_accounts(id),
        
        type VARCHAR(50) NOT NULL,
        category VARCHAR(100),
        
        amount DECIMAL(15,2) NOT NULL,
        description TEXT NOT NULL,
        
        transaction_date DATE NOT NULL,
        due_date DATE,
        paid_date DATE,
        
        status VARCHAR(50) DEFAULT 'pending',
        payment_method VARCHAR(100),
        
        reference_document VARCHAR(100),
        notes TEXT,
        tags JSONB DEFAULT '[]'::jsonb,
        
        -- Relacionamentos
        client_id BIGINT REFERENCES polox.clients(id),
        sale_id BIGINT REFERENCES polox.sales(id),
        
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        deleted_at TIMESTAMP WITH TIME ZONE
    );

    CREATE INDEX idx_financial_transactions_company_id ON polox.financial_transactions(company_id);
    CREATE INDEX idx_financial_transactions_account_id ON polox.financial_transactions(account_id);
    CREATE INDEX idx_financial_transactions_type ON polox.financial_transactions(type);
    CREATE INDEX idx_financial_transactions_date ON polox.financial_transactions(transaction_date);
  `);

  // ==========================================
  // 🎮 GAMIFICAÇÃO
  // ==========================================
  
  console.log('🎯 Criando sistema de gamificação...');
  await client.query(`
    CREATE TABLE IF NOT EXISTS polox.user_gamification_profiles (
        id BIGSERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL REFERENCES polox.users(id) ON DELETE CASCADE,
        company_id BIGINT NOT NULL REFERENCES polox.companies(id) ON DELETE CASCADE,
        
        total_xp INTEGER DEFAULT 0,
        current_level INTEGER DEFAULT 1,
        current_level_xp INTEGER DEFAULT 0,
        next_level_xp INTEGER DEFAULT 100,
        
        total_coins INTEGER DEFAULT 0,
        available_coins INTEGER DEFAULT 0,
        spent_coins INTEGER DEFAULT 0,
        
        achievements_count INTEGER DEFAULT 0,
        missions_completed INTEGER DEFAULT 0,
        rewards_claimed INTEGER DEFAULT 0,
        
        streak_days INTEGER DEFAULT 0,
        longest_streak INTEGER DEFAULT 0,
        last_activity_date DATE,
        
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        
        UNIQUE(user_id, company_id)
    );

    CREATE INDEX idx_user_gamification_profiles_user_id ON polox.user_gamification_profiles(user_id);
    CREATE INDEX idx_user_gamification_profiles_company_id ON polox.user_gamification_profiles(company_id);
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS polox.achievements (
        id BIGSERIAL PRIMARY KEY,
        company_id BIGINT NOT NULL REFERENCES polox.companies(id) ON DELETE CASCADE,
        
        name VARCHAR(255) NOT NULL,
        description TEXT,
        category VARCHAR(100),
        
        icon_url VARCHAR(500),
        badge_color VARCHAR(20) DEFAULT '#FFD700',
        
        xp_reward INTEGER DEFAULT 0,
        coin_reward INTEGER DEFAULT 0,
        
        criteria JSONB NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        is_secret BOOLEAN DEFAULT FALSE,
        
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE INDEX idx_achievements_company_id ON polox.achievements(company_id);
    CREATE INDEX idx_achievements_category ON polox.achievements(category);
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS polox.user_achievements (
        id BIGSERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL REFERENCES polox.users(id) ON DELETE CASCADE,
        achievement_id BIGINT NOT NULL REFERENCES polox.achievements(id) ON DELETE CASCADE,
        
        unlocked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        
        UNIQUE(user_id, achievement_id)
    );

    CREATE INDEX idx_user_achievements_user_id ON polox.user_achievements(user_id);
    CREATE INDEX idx_user_achievements_achievement_id ON polox.user_achievements(achievement_id);
  `);

  // ==========================================
  // 🎫 MÓDULOS ESPECÍFICOS
  // ==========================================
  
  console.log('🎫 Criando sistema de tickets...');
  await client.query(`
    CREATE TABLE IF NOT EXISTS polox.tickets (
        id BIGSERIAL PRIMARY KEY,
        company_id BIGINT NOT NULL REFERENCES polox.companies(id) ON DELETE CASCADE,
        client_id BIGINT REFERENCES polox.clients(id),
        created_by_user_id BIGINT REFERENCES polox.users(id),
        assigned_to_user_id BIGINT REFERENCES polox.users(id),
        
        title VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        
        status VARCHAR(50) NOT NULL DEFAULT 'open',
        priority VARCHAR(20) NOT NULL DEFAULT 'medium',
        category VARCHAR(100),
        
        tags JSONB DEFAULT '[]'::jsonb,
        
        due_date TIMESTAMP WITH TIME ZONE,
        resolved_at TIMESTAMP WITH TIME ZONE,
        closed_at TIMESTAMP WITH TIME ZONE,
        
        resolution_notes TEXT,
        satisfaction_rating INTEGER,
        
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        deleted_at TIMESTAMP WITH TIME ZONE
    );

    CREATE INDEX idx_tickets_company_id ON polox.tickets(company_id);
    CREATE INDEX idx_tickets_client_id ON polox.tickets(client_id);
    CREATE INDEX idx_tickets_assigned_to_user_id ON polox.tickets(assigned_to_user_id);
    CREATE INDEX idx_tickets_status ON polox.tickets(status);
    CREATE INDEX idx_tickets_priority ON polox.tickets(priority);
  `);

  console.log('📅 Criando sistema de eventos...');
  await client.query(`
    CREATE TABLE IF NOT EXISTS polox.events (
        id BIGSERIAL PRIMARY KEY,
        company_id BIGINT NOT NULL REFERENCES polox.companies(id) ON DELETE CASCADE,
        user_id BIGINT NOT NULL REFERENCES polox.users(id),
        client_id BIGINT REFERENCES polox.clients(id),
        
        title VARCHAR(255) NOT NULL,
        description TEXT,
        
        start_datetime TIMESTAMP WITH TIME ZONE NOT NULL,
        end_datetime TIMESTAMP WITH TIME ZONE NOT NULL,
        timezone VARCHAR(50) DEFAULT 'America/Sao_Paulo',
        
        type VARCHAR(50) NOT NULL DEFAULT 'meeting',
        status VARCHAR(50) NOT NULL DEFAULT 'scheduled',
        
        location VARCHAR(255),
        meeting_link VARCHAR(500),
        
        is_all_day BOOLEAN DEFAULT FALSE,
        is_recurring BOOLEAN DEFAULT FALSE,
        recurrence_pattern JSONB,
        
        reminder_minutes INTEGER DEFAULT 15,
        
        notes TEXT,
        tags JSONB DEFAULT '[]'::jsonb,
        
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        deleted_at TIMESTAMP WITH TIME ZONE
    );

    CREATE INDEX idx_events_company_id ON polox.events(company_id);
    CREATE INDEX idx_events_user_id ON polox.events(user_id);
    CREATE INDEX idx_events_client_id ON polox.events(client_id);
    CREATE INDEX idx_events_start_datetime ON polox.events(start_datetime);
    CREATE INDEX idx_events_type ON polox.events(type);
  `);

  console.log('🏭 Criando tabela de fornecedores...');
  await client.query(`
    CREATE TABLE IF NOT EXISTS polox.suppliers (
        id BIGSERIAL PRIMARY KEY,
        company_id BIGINT NOT NULL REFERENCES polox.companies(id) ON DELETE CASCADE,
        
        name VARCHAR(255) NOT NULL,
        company_name VARCHAR(255),
        document_number VARCHAR(50),
        document_type VARCHAR(20),
        
        email VARCHAR(255),
        phone VARCHAR(20),
        website VARCHAR(255),
        
        category VARCHAR(100),
        status VARCHAR(50) NOT NULL DEFAULT 'ativo',
        
        -- Endereço
        address_street VARCHAR(255),
        address_number VARCHAR(20),
        address_complement VARCHAR(100),
        address_neighborhood VARCHAR(100),
        address_city VARCHAR(100),
        address_state VARCHAR(50),
        address_country VARCHAR(3) DEFAULT 'BR',
        address_postal_code VARCHAR(20),
        
        -- Informações Comerciais
        payment_terms VARCHAR(100),
        credit_limit DECIMAL(15,2) DEFAULT 0.00,
        
        contact_person VARCHAR(255),
        contact_phone VARCHAR(20),
        contact_email VARCHAR(255),
        
        notes TEXT,
        tags JSONB DEFAULT '[]'::jsonb,
        
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        deleted_at TIMESTAMP WITH TIME ZONE
    );

    CREATE INDEX idx_suppliers_company_id ON polox.suppliers(company_id);
    CREATE INDEX idx_suppliers_status ON polox.suppliers(status);
    CREATE INDEX idx_suppliers_category ON polox.suppliers(category);
  `);

  // ==========================================
  // 🔔 NOTIFICAÇÕES
  // ==========================================
  
  console.log('🔔 Criando sistema de notificações...');
  await client.query(`
    CREATE TABLE IF NOT EXISTS polox.notification_templates (
        id BIGSERIAL PRIMARY KEY,
        company_id BIGINT REFERENCES polox.companies(id) ON DELETE CASCADE,
        
        code VARCHAR(100) NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        
        type VARCHAR(50) NOT NULL,
        category VARCHAR(100),
        
        subject_template TEXT,
        body_template TEXT NOT NULL,
        
        variables JSONB DEFAULT '[]'::jsonb,
        
        is_active BOOLEAN DEFAULT TRUE,
        is_system BOOLEAN DEFAULT FALSE,
        
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        
        UNIQUE(code, company_id)
    );

    CREATE INDEX idx_notification_templates_company_id ON polox.notification_templates(company_id);
    CREATE INDEX idx_notification_templates_code ON polox.notification_templates(code);
    CREATE INDEX idx_notification_templates_type ON polox.notification_templates(type);
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS polox.notifications (
        id BIGSERIAL PRIMARY KEY,
        company_id BIGINT NOT NULL REFERENCES polox.companies(id) ON DELETE CASCADE,
        recipient_user_id BIGINT NOT NULL REFERENCES polox.users(id) ON DELETE CASCADE,
        template_id BIGINT REFERENCES polox.notification_templates(id),
        
        type VARCHAR(50) NOT NULL,
        channel VARCHAR(50) NOT NULL DEFAULT 'in_app',
        
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        
        status VARCHAR(50) NOT NULL DEFAULT 'pending',
        priority VARCHAR(20) NOT NULL DEFAULT 'normal',
        
        scheduled_for TIMESTAMP WITH TIME ZONE,
        sent_at TIMESTAMP WITH TIME ZONE,
        read_at TIMESTAMP WITH TIME ZONE,
        
        metadata JSONB DEFAULT '{}'::jsonb,
        
        related_entity_type VARCHAR(100),
        related_entity_id BIGINT,
        
        action_url VARCHAR(500),
        action_label VARCHAR(100),
        
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE INDEX idx_notifications_company_id ON polox.notifications(company_id);
    CREATE INDEX idx_notifications_recipient_user_id ON polox.notifications(recipient_user_id);
    CREATE INDEX idx_notifications_type ON polox.notifications(type);
    CREATE INDEX idx_notifications_status ON polox.notifications(status);
    CREATE INDEX idx_notifications_scheduled_for ON polox.notifications(scheduled_for);
  `);

  // ==========================================
  // 🚀 TRIGGERS
  // ==========================================
  
  console.log('⚙️ Criando triggers...');
  await client.query(`
    -- Trigger para atualizar updated_at nas novas tabelas
    DROP TRIGGER IF EXISTS update_leads_updated_at ON polox.leads;
    CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON polox.leads 
        FOR EACH ROW EXECUTE FUNCTION polox.update_updated_at_column();

    DROP TRIGGER IF EXISTS update_clients_updated_at ON polox.clients;
    CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON polox.clients 
        FOR EACH ROW EXECUTE FUNCTION polox.update_updated_at_column();

    DROP TRIGGER IF EXISTS update_sales_updated_at ON polox.sales;
    CREATE TRIGGER update_sales_updated_at BEFORE UPDATE ON polox.sales 
        FOR EACH ROW EXECUTE FUNCTION polox.update_updated_at_column();

    DROP TRIGGER IF EXISTS update_products_updated_at ON polox.products;
    CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON polox.products 
        FOR EACH ROW EXECUTE FUNCTION polox.update_updated_at_column();

    DROP TRIGGER IF EXISTS update_financial_accounts_updated_at ON polox.financial_accounts;
    CREATE TRIGGER update_financial_accounts_updated_at BEFORE UPDATE ON polox.financial_accounts 
        FOR EACH ROW EXECUTE FUNCTION polox.update_updated_at_column();

    DROP TRIGGER IF EXISTS update_financial_transactions_updated_at ON polox.financial_transactions;
    CREATE TRIGGER update_financial_transactions_updated_at BEFORE UPDATE ON polox.financial_transactions 
        FOR EACH ROW EXECUTE FUNCTION polox.update_updated_at_column();

    DROP TRIGGER IF EXISTS update_tickets_updated_at ON polox.tickets;
    CREATE TRIGGER update_tickets_updated_at BEFORE UPDATE ON polox.tickets 
        FOR EACH ROW EXECUTE FUNCTION polox.update_updated_at_column();

    DROP TRIGGER IF EXISTS update_events_updated_at ON polox.events;
    CREATE TRIGGER update_events_updated_at BEFORE UPDATE ON polox.events 
        FOR EACH ROW EXECUTE FUNCTION polox.update_updated_at_column();

    DROP TRIGGER IF EXISTS update_suppliers_updated_at ON polox.suppliers;
    CREATE TRIGGER update_suppliers_updated_at BEFORE UPDATE ON polox.suppliers 
        FOR EACH ROW EXECUTE FUNCTION polox.update_updated_at_column();
  `);

  // Adicionar foreign keys faltantes
  console.log('🔗 Adicionando relacionamentos...');
  await client.query(`
    -- Relacionar leads com clientes convertidos
    ALTER TABLE polox.leads ADD CONSTRAINT fk_leads_converted_client 
        FOREIGN KEY (converted_to_client_id) REFERENCES polox.clients(id);

    -- Relacionar produtos com fornecedores
    ALTER TABLE polox.products ADD CONSTRAINT fk_products_supplier 
        FOREIGN KEY (supplier_id) REFERENCES polox.suppliers(id);
  `);

  console.log('🎉 Schema polox completo criado com sucesso!');
};

const down = async (client) => {
  console.log('🗑️ Removendo schema polox completo...');

  await client.query(`
    -- Remover foreign keys
    ALTER TABLE polox.leads DROP CONSTRAINT IF EXISTS fk_leads_converted_client;
    ALTER TABLE polox.products DROP CONSTRAINT IF EXISTS fk_products_supplier;

    -- Remover triggers
    DROP TRIGGER IF EXISTS update_leads_updated_at ON polox.leads;
    DROP TRIGGER IF EXISTS update_clients_updated_at ON polox.clients;
    DROP TRIGGER IF EXISTS update_sales_updated_at ON polox.sales;
    DROP TRIGGER IF EXISTS update_products_updated_at ON polox.products;
    DROP TRIGGER IF EXISTS update_financial_accounts_updated_at ON polox.financial_accounts;
    DROP TRIGGER IF EXISTS update_financial_transactions_updated_at ON polox.financial_transactions;
    DROP TRIGGER IF EXISTS update_tickets_updated_at ON polox.tickets;
    DROP TRIGGER IF EXISTS update_events_updated_at ON polox.events;
    DROP TRIGGER IF EXISTS update_suppliers_updated_at ON polox.suppliers;

    -- Remover tabelas em ordem reversa (respeitando foreign keys)
    DROP TABLE IF EXISTS polox.notifications CASCADE;
    DROP TABLE IF EXISTS polox.notification_templates CASCADE;
    DROP TABLE IF EXISTS polox.suppliers CASCADE;
    DROP TABLE IF EXISTS polox.events CASCADE;
    DROP TABLE IF EXISTS polox.tickets CASCADE;
    DROP TABLE IF EXISTS polox.user_achievements CASCADE;
    DROP TABLE IF EXISTS polox.achievements CASCADE;
    DROP TABLE IF EXISTS polox.user_gamification_profiles CASCADE;
    DROP TABLE IF EXISTS polox.financial_transactions CASCADE;
    DROP TABLE IF EXISTS polox.financial_accounts CASCADE;
    DROP TABLE IF EXISTS polox.sale_items CASCADE;
    DROP TABLE IF EXISTS polox.products CASCADE;
    DROP TABLE IF EXISTS polox.product_categories CASCADE;
    DROP TABLE IF EXISTS polox.sales CASCADE;
    DROP TABLE IF EXISTS polox.clients CASCADE;
    DROP TABLE IF EXISTS polox.leads CASCADE;
  `);

  console.log('✅ Rollback do schema polox realizado com sucesso');
};

module.exports = {
  up,
  down
};