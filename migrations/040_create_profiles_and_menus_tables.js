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
 * Migration: 040 - Criar tabelas de Perfis e Menus
 *
 * Implementa sistema completo de perfis de acesso e menus com:
 * - Perfis do sistema (company_id NULL) e perfis customizados por empresa
 * - Menus hierárquicos com traduções i18n (pt-BR, en-US, es-ES)
 * - Controle de visibilidade e permissões por empresa
 * - Soft delete (deleted_at)
 */

module.exports = {
  up: async (client) => {
    console.log("🔄 Criando tabela profiles...");

    // 1. Criar tabela de perfis
    await client.query(`
      CREATE TABLE polox.profiles (
        id BIGSERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        company_id BIGINT NULL,
        translations JSONB NOT NULL DEFAULT '{}',
        screen_ids TEXT[] NOT NULL DEFAULT '{}',
        is_system_default BOOLEAN NOT NULL DEFAULT FALSE,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        deleted_at TIMESTAMPTZ NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        
        CONSTRAINT fk_profiles_company 
          FOREIGN KEY (company_id) 
          REFERENCES polox.companies(id) 
          ON DELETE CASCADE,
        
        CONSTRAINT chk_system_profile_no_company 
          CHECK (
            (is_system_default = TRUE AND company_id IS NULL) OR 
            (is_system_default = FALSE)
          )
      );
    `);

    // Índices para profiles
    await client.query(`
      CREATE INDEX idx_profiles_company_id ON polox.profiles(company_id);
      CREATE INDEX idx_profiles_is_system_default ON polox.profiles(is_system_default);
      CREATE INDEX idx_profiles_deleted_at ON polox.profiles(deleted_at);
      CREATE UNIQUE INDEX idx_profiles_name_company 
        ON polox.profiles(name, COALESCE(company_id, 0)) 
        WHERE deleted_at IS NULL;
    `);

    console.log("✅ Tabela profiles criada");

    // 2. Adicionar coluna profile_id na tabela users
    console.log("🔄 Adicionando profile_id à tabela users...");

    await client.query(`
      ALTER TABLE polox.users 
      ADD COLUMN profile_id BIGINT NULL,
      ADD CONSTRAINT fk_users_profile 
        FOREIGN KEY (profile_id) 
        REFERENCES polox.profiles(id) 
        ON DELETE SET NULL;
    `);

    await client.query(`
      CREATE INDEX idx_users_profile_id ON polox.users(profile_id);
    `);

    console.log("✅ Coluna profile_id adicionada à tabela users");

    // 3. Criar tabela de menus
    console.log("🔄 Criando tabela menu_items...");

    await client.query(`
      CREATE TABLE polox.menu_items (
        id BIGSERIAL PRIMARY KEY,
        label VARCHAR(255) NOT NULL,
        translations JSONB NOT NULL DEFAULT '{}',
        icon VARCHAR(100) NULL,
        route VARCHAR(255) NULL,
        parent_id BIGINT NULL,
        order_position INTEGER NOT NULL DEFAULT 0,
        visible_to_all BOOLEAN NOT NULL DEFAULT TRUE,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        deleted_at TIMESTAMPTZ NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        
        CONSTRAINT fk_menu_items_parent 
          FOREIGN KEY (parent_id) 
          REFERENCES polox.menu_items(id) 
          ON DELETE CASCADE,
        
        CONSTRAINT chk_route_or_children 
          CHECK (route IS NOT NULL OR parent_id IS NULL)
      );
    `);

    // Índices para menu_items
    await client.query(`
      CREATE INDEX idx_menu_items_parent_id ON polox.menu_items(parent_id);
      CREATE INDEX idx_menu_items_deleted_at ON polox.menu_items(deleted_at);
      CREATE UNIQUE INDEX idx_menu_items_route 
        ON polox.menu_items(route) 
        WHERE route IS NOT NULL AND deleted_at IS NULL;
      CREATE UNIQUE INDEX idx_menu_items_order 
        ON polox.menu_items(order_position, COALESCE(parent_id, 0)) 
        WHERE deleted_at IS NULL;
    `);

    console.log("✅ Tabela menu_items criada");

    // 4. Criar tabela de permissões de menus por empresa
    console.log("🔄 Criando tabela menu_company_permissions...");

    await client.query(`
      CREATE TABLE polox.menu_company_permissions (
        id BIGSERIAL PRIMARY KEY,
        menu_item_id BIGINT NOT NULL,
        company_id BIGINT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        
        CONSTRAINT fk_menu_company_permissions_menu 
          FOREIGN KEY (menu_item_id) 
          REFERENCES polox.menu_items(id) 
          ON DELETE CASCADE,
        
        CONSTRAINT fk_menu_company_permissions_company 
          FOREIGN KEY (company_id) 
          REFERENCES polox.companies(id) 
          ON DELETE CASCADE,
        
        CONSTRAINT uk_menu_company_permissions 
          UNIQUE (menu_item_id, company_id)
      );
    `);

    await client.query(`
      CREATE INDEX idx_menu_company_permissions_menu ON polox.menu_company_permissions(menu_item_id);
      CREATE INDEX idx_menu_company_permissions_company ON polox.menu_company_permissions(company_id);
    `);

    console.log("✅ Tabela menu_company_permissions criada");

    // 5. Inserir perfis padrão do sistema
    console.log("🔄 Inserindo perfis padrão do sistema...");

    await client.query(`
      INSERT INTO polox.profiles (name, company_id, translations, screen_ids, is_system_default, is_active) VALUES
      (
        'Administrador',
        NULL,
        '{"pt-BR": "Administrador", "en-US": "Administrator", "es-ES": "Administrador"}'::jsonb,
        ARRAY['1','2','3','4','5','6','7','8','9','10','11','12','13','14','15','16','17'],
        TRUE,
        TRUE
      ),
      (
        'Vendedor',
        NULL,
        '{"pt-BR": "Vendedor", "en-US": "Salesperson", "es-ES": "Vendedor"}'::jsonb,
        ARRAY['2','3','4','5'],
        TRUE,
        TRUE
      ),
      (
        'Gerente',
        NULL,
        '{"pt-BR": "Gerente", "en-US": "Manager", "es-ES": "Gerente"}'::jsonb,
        ARRAY['2','3','4','5','6','7','8','9'],
        TRUE,
        TRUE
      ),
      (
        'Visualizador',
        NULL,
        '{"pt-BR": "Visualizador", "en-US": "Viewer", "es-ES": "Visualizador"}'::jsonb,
        ARRAY['2','6'],
        TRUE,
        TRUE
      );
    `);

    console.log("✅ Perfis padrão inseridos");

    // 6. Inserir menus padrão do sistema
    console.log("🔄 Inserindo menus padrão do sistema...");

    await client.query(`
      INSERT INTO polox.menu_items (id, label, translations, icon, route, parent_id, order_position, visible_to_all) VALUES
      (1, 'Configurações', '{"pt-BR": "Configurações", "en-US": "Settings", "es-ES": "Configuraciones"}'::jsonb, 'settings', NULL, NULL, 1, TRUE),
      (2, 'CRM', '{"pt-BR": "CRM", "en-US": "CRM", "es-ES": "CRM"}'::jsonb, 'users', NULL, NULL, 2, TRUE),
      (3, 'Leads', '{"pt-BR": "Leads", "en-US": "Leads", "es-ES": "Leads"}'::jsonb, 'target', '/leads', 2, 1, TRUE),
      (4, 'Clientes', '{"pt-BR": "Clientes", "en-US": "Clients", "es-ES": "Clientes"}'::jsonb, 'user-check', '/clients', 2, 2, TRUE),
      (5, 'Empresas', '{"pt-BR": "Empresas", "en-US": "Companies", "es-ES": "Empresas"}'::jsonb, 'building', '/companies', 2, 3, TRUE),
      (6, 'Relatórios', '{"pt-BR": "Relatórios", "en-US": "Reports", "es-ES": "Informes"}'::jsonb, 'file-text', NULL, NULL, 3, TRUE),
      (7, 'Relatório de Leads', '{"pt-BR": "Relatório de Leads", "en-US": "Leads Report", "es-ES": "Informe de Leads"}'::jsonb, 'trending-up', '/reports/leads', 6, 1, TRUE),
      (8, 'Relatório de Vendas', '{"pt-BR": "Relatório de Vendas", "en-US": "Sales Report", "es-ES": "Informe de Ventas"}'::jsonb, 'dollar-sign', '/reports/sales', 6, 2, TRUE),
      (9, 'Relatório de Conversões', '{"pt-BR": "Relatório de Conversões", "en-US": "Conversion Report", "es-ES": "Informe de Conversiones"}'::jsonb, 'percent', '/reports/conversions', 6, 3, TRUE),
      (10, 'Usuários', '{"pt-BR": "Usuários", "en-US": "Users", "es-ES": "Usuarios"}'::jsonb, 'users', '/users', 1, 1, FALSE),
      (11, 'Perfis', '{"pt-BR": "Perfis", "en-US": "Profiles", "es-ES": "Perfiles"}'::jsonb, 'shield', '/profiles', 1, 2, FALSE),
      (12, 'Menus', '{"pt-BR": "Menus", "en-US": "Menus", "es-ES": "Menús"}'::jsonb, 'menu', '/menu-items', 1, 3, FALSE),
      (13, 'Campos Customizados', '{"pt-BR": "Campos Customizados", "en-US": "Custom Fields", "es-ES": "Campos Personalizados"}'::jsonb, 'sliders', '/custom-fields', 1, 4, FALSE),
      (14, 'Produtos', '{"pt-BR": "Produtos", "en-US": "Products", "es-ES": "Productos"}'::jsonb, 'package', '/products', 2, 4, TRUE),
      (15, 'Agendamentos', '{"pt-BR": "Agendamentos", "en-US": "Schedules", "es-ES": "Agendamientos"}'::jsonb, 'calendar', '/schedules', 2, 5, TRUE),
      (16, 'Campanhas', '{"pt-BR": "Campanhas", "en-US": "Campaigns", "es-ES": "Campañas"}'::jsonb, 'megaphone', '/campaigns', 2, 6, TRUE),
      (17, 'Integrações', '{"pt-BR": "Integrações", "en-US": "Integrations", "es-ES": "Integraciones"}'::jsonb, 'link', '/integrations', 1, 5, FALSE);
    `);

    console.log("✅ Menus padrão inseridos");

    console.log("✅ Migration 040 concluída com sucesso!");
  },

  down: async (client) => {
    console.log("🔄 Revertendo migration 040...");

    // Remover na ordem reversa das FKs
    await client.query(
      `DROP TABLE IF EXISTS polox.menu_company_permissions CASCADE;`
    );
    console.log("✅ Tabela menu_company_permissions removida");

    await client.query(`DROP TABLE IF EXISTS polox.menu_items CASCADE;`);
    console.log("✅ Tabela menu_items removida");

    await client.query(
      `ALTER TABLE polox.users DROP COLUMN IF EXISTS profile_id;`
    );
    console.log("✅ Coluna profile_id removida da tabela users");

    await client.query(`DROP TABLE IF EXISTS polox.profiles CASCADE;`);
    console.log("✅ Tabela profiles removida");

    console.log("✅ Rollback da migration 040 concluído");
  },
};
