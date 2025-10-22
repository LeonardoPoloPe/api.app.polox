/**
 * Migration: 008_add_missing_tables_from_003
 * Descrição: Adiciona as 10 tabelas que faltam em SANDBOX e PRODUÇÃO
 *            (achievements, events, financial_accounts, financial_transactions,
 *             notification_templates, product_categories, sale_items, suppliers,
 *             user_achievements, user_gamification_profiles)
 * Data: 2025-10-22
 * Motivo: A migration 003 foi marcada como executada mas não rodou efetivamente
 */

const up = async (client) => {
  console.log('🚀 Adicionando tabelas faltantes da migration 003...\n');

  // ==========================================
  // 🏷️ CATEGORIAS DE PRODUTOS
  // ==========================================
  
  console.log('1/10 🏷️ Criando categorias de produtos...');
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

    CREATE INDEX IF NOT EXISTS idx_product_categories_company_id ON polox.product_categories(company_id);
    CREATE INDEX IF NOT EXISTS idx_product_categories_parent_id ON polox.product_categories(parent_id);
  `);

  // ==========================================
  // 📋 ITENS DE VENDA
  // ==========================================
  
  console.log('2/10 📋 Criando itens de venda...');
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

    CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON polox.sale_items(sale_id);
    CREATE INDEX IF NOT EXISTS idx_sale_items_product_id ON polox.sale_items(product_id);
  `);

  // ==========================================
  // 🏦 CONTAS FINANCEIRAS
  // ==========================================
  
  console.log('3/10 🏦 Criando contas financeiras...');
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

    CREATE INDEX IF NOT EXISTS idx_financial_accounts_company_id ON polox.financial_accounts(company_id);
  `);

  // ==========================================
  // 💰 TRANSAÇÕES FINANCEIRAS
  // ==========================================
  
  console.log('4/10 💰 Criando transações financeiras...');
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
        
        client_id BIGINT REFERENCES polox.clients(id),
        sale_id BIGINT REFERENCES polox.sales(id),
        
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        deleted_at TIMESTAMP WITH TIME ZONE
    );

    CREATE INDEX IF NOT EXISTS idx_financial_transactions_company_id ON polox.financial_transactions(company_id);
    CREATE INDEX IF NOT EXISTS idx_financial_transactions_account_id ON polox.financial_transactions(account_id);
    CREATE INDEX IF NOT EXISTS idx_financial_transactions_type ON polox.financial_transactions(type);
    CREATE INDEX IF NOT EXISTS idx_financial_transactions_date ON polox.financial_transactions(transaction_date);
  `);

  // ==========================================
  // 🎯 PERFIS DE GAMIFICAÇÃO
  // ==========================================
  
  console.log('5/10 🎯 Criando perfis de gamificação...');
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

    CREATE INDEX IF NOT EXISTS idx_user_gamification_profiles_user_id ON polox.user_gamification_profiles(user_id);
    CREATE INDEX IF NOT EXISTS idx_user_gamification_profiles_company_id ON polox.user_gamification_profiles(company_id);
  `);

  // ==========================================
  // 🏆 CONQUISTAS
  // ==========================================
  
  console.log('6/10 🏆 Criando sistema de conquistas...');
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

    CREATE INDEX IF NOT EXISTS idx_achievements_company_id ON polox.achievements(company_id);
    CREATE INDEX IF NOT EXISTS idx_achievements_category ON polox.achievements(category);
  `);

  // ==========================================
  // 🎖️ CONQUISTAS DOS USUÁRIOS
  // ==========================================
  
  console.log('7/10 🎖️ Criando conquistas dos usuários...');
  await client.query(`
    CREATE TABLE IF NOT EXISTS polox.user_achievements (
        id BIGSERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL REFERENCES polox.users(id) ON DELETE CASCADE,
        achievement_id BIGINT NOT NULL REFERENCES polox.achievements(id) ON DELETE CASCADE,
        
        unlocked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        
        UNIQUE(user_id, achievement_id)
    );

    CREATE INDEX IF NOT EXISTS idx_user_achievements_user_id ON polox.user_achievements(user_id);
    CREATE INDEX IF NOT EXISTS idx_user_achievements_achievement_id ON polox.user_achievements(achievement_id);
  `);

  // ==========================================
  // 📅 EVENTOS
  // ==========================================
  
  console.log('8/10 📅 Criando sistema de eventos...');
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

    CREATE INDEX IF NOT EXISTS idx_events_company_id ON polox.events(company_id);
    CREATE INDEX IF NOT EXISTS idx_events_user_id ON polox.events(user_id);
    CREATE INDEX IF NOT EXISTS idx_events_client_id ON polox.events(client_id);
    CREATE INDEX IF NOT EXISTS idx_events_start_datetime ON polox.events(start_datetime);
    CREATE INDEX IF NOT EXISTS idx_events_type ON polox.events(type);
  `);

  // ==========================================
  // 🏭 FORNECEDORES
  // ==========================================
  
  console.log('9/10 🏭 Criando tabela de fornecedores...');
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
        
        address_street VARCHAR(255),
        address_number VARCHAR(20),
        address_complement VARCHAR(100),
        address_neighborhood VARCHAR(100),
        address_city VARCHAR(100),
        address_state VARCHAR(50),
        address_country VARCHAR(3) DEFAULT 'BR',
        address_postal_code VARCHAR(20),
        
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

    CREATE INDEX IF NOT EXISTS idx_suppliers_company_id ON polox.suppliers(company_id);
    CREATE INDEX IF NOT EXISTS idx_suppliers_status ON polox.suppliers(status);
    CREATE INDEX IF NOT EXISTS idx_suppliers_category ON polox.suppliers(category);
  `);

  // ==========================================
  // 📧 TEMPLATES DE NOTIFICAÇÃO
  // ==========================================
  
  console.log('10/10 📧 Criando templates de notificação...');
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

    CREATE INDEX IF NOT EXISTS idx_notification_templates_company_id ON polox.notification_templates(company_id);
    CREATE INDEX IF NOT EXISTS idx_notification_templates_code ON polox.notification_templates(code);
    CREATE INDEX IF NOT EXISTS idx_notification_templates_type ON polox.notification_templates(type);
  `);

  console.log('\n✅ Todas as 10 tabelas foram criadas com sucesso!');
  console.log('📊 Tabelas adicionadas:');
  console.log('   1. product_categories');
  console.log('   2. sale_items');
  console.log('   3. financial_accounts');
  console.log('   4. financial_transactions');
  console.log('   5. user_gamification_profiles');
  console.log('   6. achievements');
  console.log('   7. user_achievements');
  console.log('   8. events');
  console.log('   9. suppliers');
  console.log('   10. notification_templates\n');
};

const down = async (client) => {
  console.log('⚠️  Removendo as 10 tabelas adicionadas...\n');
  
  await client.query(`
    DROP TABLE IF EXISTS polox.notification_templates CASCADE;
    DROP TABLE IF EXISTS polox.user_achievements CASCADE;
    DROP TABLE IF EXISTS polox.achievements CASCADE;
    DROP TABLE IF EXISTS polox.user_gamification_profiles CASCADE;
    DROP TABLE IF EXISTS polox.suppliers CASCADE;
    DROP TABLE IF EXISTS polox.events CASCADE;
    DROP TABLE IF EXISTS polox.financial_transactions CASCADE;
    DROP TABLE IF EXISTS polox.financial_accounts CASCADE;
    DROP TABLE IF EXISTS polox.sale_items CASCADE;
    DROP TABLE IF EXISTS polox.product_categories CASCADE;
  `);
  
  console.log('✅ Tabelas removidas com sucesso');
};

module.exports = { up, down };