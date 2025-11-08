-- ============================================================================
-- SCRIPT DE CRIAÇÃO: SISTEMA DE PERFIS E MENUS
-- ============================================================================
-- Data: 2025-11-07
-- Autor: Leonardo Polo Pereira
-- Empresa: POLO X Manutencao de Equipamentos de Informatica LTDA
-- CNPJ: 55.419.946/0001-89
--
-- IMPORTANTE:
-- - As tabelas polox.companies e polox.users JÁ EXISTEM no banco
-- - Este script cria apenas as novas tabelas de perfis e menus
-- - Execute este script em ordem
-- ============================================================================

-- ============================================================================
-- 1. TABELA: PROFILES (Perfis de Usuário)
-- ============================================================================
-- ⚠️ IMPORTANTE: Criar PROFILES primeiro, antes de adicionar FK em users!

CREATE TABLE IF NOT EXISTS polox.profiles (
  id BIGSERIAL PRIMARY KEY,
  company_id BIGINT NULL, -- NULL = perfil padrão do sistema (visível para todos)
  name VARCHAR(100) NOT NULL, -- Fallback pt-BR
  description TEXT, -- Fallback pt-BR
  translations JSONB NOT NULL DEFAULT '{
    "pt-BR": {"name": "", "description": ""},
    "en-US": {"name": "", "description": ""},
    "es-ES": {"name": "", "description": ""}
  }'::jsonb, -- Traduções multi-idioma
  screen_ids TEXT[] DEFAULT '{}', -- Array de IDs de telas permitidas
  is_active BOOLEAN DEFAULT true,
  is_system_default BOOLEAN DEFAULT false, -- Perfil padrão do sistema (só super_admin edita)
  deleted_at TIMESTAMPTZ NULL, -- Soft delete
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Chave estrangeira
  CONSTRAINT fk_profiles_company FOREIGN KEY (company_id) 
    REFERENCES polox.companies(id) ON DELETE CASCADE,
  
  -- Constraint: nome único por empresa (permite mesmo nome em empresas diferentes)
  CONSTRAINT unique_profile_name_per_company UNIQUE (company_id, name)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_profiles_name ON polox.profiles(name);
CREATE INDEX IF NOT EXISTS idx_profiles_company_id ON polox.profiles(company_id);
CREATE INDEX IF NOT EXISTS idx_profiles_is_active ON polox.profiles(is_active);
CREATE INDEX IF NOT EXISTS idx_profiles_is_system_default ON polox.profiles(is_system_default);
CREATE INDEX IF NOT EXISTS idx_profiles_deleted_at ON polox.profiles(deleted_at);
CREATE INDEX IF NOT EXISTS idx_profiles_translations ON polox.profiles USING GIN (translations); -- Indexar JSONB

-- Trigger para atualizar updated_at automaticamente
DROP TRIGGER IF EXISTS update_profiles_updated_at ON polox.profiles;
CREATE TRIGGER update_profiles_updated_at 
BEFORE UPDATE ON polox.profiles 
FOR EACH ROW EXECUTE FUNCTION polox.update_updated_at_column();

-- Comentários
COMMENT ON TABLE polox.profiles IS 'Perfis de usuário com permissões por tela';
COMMENT ON COLUMN polox.profiles.company_id IS 'ID da empresa proprietária (NULL = perfil do sistema)';
COMMENT ON COLUMN polox.profiles.name IS 'Nome do perfil (único por empresa)';
COMMENT ON COLUMN polox.profiles.description IS 'Descrição do perfil';
COMMENT ON COLUMN polox.profiles.screen_ids IS 'Array de IDs das telas que o perfil pode acessar';
COMMENT ON COLUMN polox.profiles.is_active IS 'Status ativo/inativo do perfil';
COMMENT ON COLUMN polox.profiles.is_system_default IS 'Perfil padrão do sistema - Apenas super_admin pode editar/deletar';
COMMENT ON COLUMN polox.profiles.deleted_at IS 'Data de exclusão (soft delete)';

-- ============================================================================
-- 2. ALTERAÇÃO NA TABELA USERS (Adicionar profile_id)
-- ============================================================================
-- ⚠️ Agora SIM podemos adicionar FK, pois polox.profiles já existe!

-- Adicionar coluna profile_id na tabela users existente
ALTER TABLE polox.users 
ADD COLUMN IF NOT EXISTS profile_id BIGINT NULL 
REFERENCES polox.profiles(id) ON DELETE SET NULL;

-- Criar índice para performance
CREATE INDEX IF NOT EXISTS idx_users_profile_id ON polox.users(profile_id);

COMMENT ON COLUMN polox.users.profile_id IS 'Referência ao perfil de acesso do usuário';

-- ============================================================================
-- 3. TABELA: MENU_ITEMS (Itens de Menu)
-- ============================================================================

CREATE TABLE IF NOT EXISTS polox.menu_items (
  id BIGSERIAL PRIMARY KEY,
  label VARCHAR(100) NOT NULL, -- Fallback pt-BR
  icon VARCHAR(50) NOT NULL,
  route VARCHAR(255) NOT NULL,
  description TEXT, -- Fallback pt-BR
  translations JSONB NOT NULL DEFAULT '{
    "pt-BR": {"label": "", "description": ""},
    "en-US": {"label": "", "description": ""},
    "es-ES": {"label": "", "description": ""}
  }'::jsonb, -- Traduções multi-idioma
  order_position INTEGER NOT NULL DEFAULT 0,
  parent_id BIGINT REFERENCES polox.menu_items(id) ON DELETE CASCADE, -- Para submenus
  is_active BOOLEAN DEFAULT true,
  is_special BOOLEAN DEFAULT false, -- Item de gamificação (Loja, Conquistas)
  admin_only BOOLEAN DEFAULT false, -- Visível apenas para super_admin
  visible_to_all BOOLEAN DEFAULT true, -- Visível para todas empresas
  link_type VARCHAR(20) DEFAULT 'internal' CHECK (link_type IN ('internal', 'external')),
  deleted_at TIMESTAMPTZ NULL, -- Soft delete
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT unique_order_per_parent UNIQUE (parent_id, order_position)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_menu_items_parent_id ON polox.menu_items(parent_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_order ON polox.menu_items(order_position);
CREATE INDEX IF NOT EXISTS idx_menu_items_is_active ON polox.menu_items(is_active);
CREATE INDEX IF NOT EXISTS idx_menu_items_admin_only ON polox.menu_items(admin_only);
CREATE INDEX IF NOT EXISTS idx_menu_items_route ON polox.menu_items(route);
CREATE INDEX IF NOT EXISTS idx_menu_items_deleted_at ON polox.menu_items(deleted_at);
CREATE INDEX IF NOT EXISTS idx_menu_items_translations ON polox.menu_items USING GIN (translations); -- Indexar JSONB

-- Trigger para atualizar updated_at automaticamente
DROP TRIGGER IF EXISTS update_menu_items_updated_at ON polox.menu_items;
CREATE TRIGGER update_menu_items_updated_at 
BEFORE UPDATE ON polox.menu_items 
FOR EACH ROW EXECUTE FUNCTION polox.update_updated_at_column();

-- Comentários
COMMENT ON TABLE polox.menu_items IS 'Itens de menu da aplicação';
COMMENT ON COLUMN polox.menu_items.label IS 'Texto exibido no menu';
COMMENT ON COLUMN polox.menu_items.icon IS 'Nome do ícone (Phosphor Icons)';
COMMENT ON COLUMN polox.menu_items.route IS 'Rota da aplicação';
COMMENT ON COLUMN polox.menu_items.order_position IS 'Ordem de exibição no menu';
COMMENT ON COLUMN polox.menu_items.parent_id IS 'ID do menu pai (para submenus hierárquicos)';
COMMENT ON COLUMN polox.menu_items.is_special IS 'Item de gamificação (Loja, Conquistas, etc)';
COMMENT ON COLUMN polox.menu_items.admin_only IS 'Visível apenas para super_admin';
COMMENT ON COLUMN polox.menu_items.visible_to_all IS 'Se false, precisa configurar empresas específicas';
COMMENT ON COLUMN polox.menu_items.deleted_at IS 'Data de exclusão (soft delete)';

-- ============================================================================
-- 4. TABELA: MENU_COMPANY_PERMISSIONS (Permissões de Menu por Empresa)
-- ============================================================================

CREATE TABLE IF NOT EXISTS polox.menu_company_permissions (
  id BIGSERIAL PRIMARY KEY,
  menu_item_id BIGINT NOT NULL REFERENCES polox.menu_items(id) ON DELETE CASCADE,
  company_id BIGINT NOT NULL REFERENCES polox.companies(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT unique_menu_company UNIQUE (menu_item_id, company_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_menu_company_permissions_menu_id ON polox.menu_company_permissions(menu_item_id);
CREATE INDEX IF NOT EXISTS idx_menu_company_permissions_company_id ON polox.menu_company_permissions(company_id);

-- Comentários
COMMENT ON TABLE polox.menu_company_permissions IS 'Define quais empresas têm acesso a menus específicos';
COMMENT ON COLUMN polox.menu_company_permissions.menu_item_id IS 'ID do item de menu';
COMMENT ON COLUMN polox.menu_company_permissions.company_id IS 'ID da empresa';

-- ============================================================================
-- 5. DADOS INICIAIS (SEED)
-- ============================================================================

-- Inserir perfis padrão do sistema (company_id = NULL, is_system_default = true)
-- Estes perfis são visíveis para todas as empresas e só podem ser editados por super_admin
INSERT INTO polox.profiles (company_id, name, description, translations, screen_ids, is_active, is_system_default) VALUES
(NULL, 'Administrador', 'Acesso completo ao sistema',
 '{"pt-BR": {"name": "Administrador", "description": "Acesso completo ao sistema"}, 
   "en-US": {"name": "Administrator", "description": "Full system access"}, 
   "es-ES": {"name": "Administrador", "description": "Acceso completo al sistema"}}'::jsonb,
 ARRAY['dashboard', 'leads', 'clients', 'sales', 'reports', 'settings', 'users', 'companies', 'profiles', 'menus'],
 true, true),
(NULL, 'Vendedor', 'Acesso a leads, clientes e vendas',
 '{"pt-BR": {"name": "Vendedor", "description": "Acesso a leads, clientes e vendas"}, 
   "en-US": {"name": "Salesperson", "description": "Access to leads, clients and sales"}, 
   "es-ES": {"name": "Vendedor", "description": "Acceso a prospectos, clientes y ventas"}}'::jsonb,
 ARRAY['dashboard', 'leads', 'clients', 'sales', 'reports'],
 true, true),
(NULL, 'Gerente', 'Acesso a vendas e relatórios gerenciais',
 '{"pt-BR": {"name": "Gerente", "description": "Acesso a vendas e relatórios gerenciais"}, 
   "en-US": {"name": "Manager", "description": "Access to sales and management reports"}, 
   "es-ES": {"name": "Gerente", "description": "Acceso a ventas e informes de gestión"}}'::jsonb,
 ARRAY['dashboard', 'leads', 'clients', 'sales', 'reports', 'users'],
 true, true),
(NULL, 'Visualizador', 'Apenas visualização de dados',
 '{"pt-BR": {"name": "Visualizador", "description": "Apenas visualização de dados"}, 
   "en-US": {"name": "Viewer", "description": "View-only access"}, 
   "es-ES": {"name": "Visualizador", "description": "Solo visualización de datos"}}'::jsonb,
 ARRAY['dashboard', 'reports'],
 true, true)
ON CONFLICT (company_id, name) DO NOTHING;

-- Inserir menus padrão com traduções
INSERT INTO polox.menu_items (label, icon, route, description, translations, order_position, is_active, admin_only, is_special) VALUES
('Dashboard', 'House', '/portal/dashboard', 'Painel principal',
 '{"pt-BR": {"label": "Painel Principal", "description": "Visão geral do sistema"}, "en-US": {"label": "Dashboard", "description": "System overview"}, "es-ES": {"label": "Panel Principal", "description": "Visión general del sistema"}}'::jsonb,
 1, true, false, false),
('Leads', 'Funnel', '/portal/leads', 'Gerenciamento de leads',
 '{"pt-BR": {"label": "Leads", "description": "Gerenciamento de leads"}, "en-US": {"label": "Leads", "description": "Lead management"}, "es-ES": {"label": "Prospectos", "description": "Gestión de prospectos"}}'::jsonb,
 2, true, false, false),
('Clientes', 'Users', '/portal/clients', 'Gerenciamento de clientes',
 '{"pt-BR": {"label": "Clientes", "description": "Gerenciamento de clientes"}, "en-US": {"label": "Clients", "description": "Client management"}, "es-ES": {"label": "Clientes", "description": "Gestión de clientes"}}'::jsonb,
 3, true, false, false),
('Vendas', 'ShoppingCart', '/portal/sales', 'Registro de vendas',
 '{"pt-BR": {"label": "Vendas", "description": "Registro de vendas"}, "en-US": {"label": "Sales", "description": "Sales records"}, "es-ES": {"label": "Ventas", "description": "Registro de ventas"}}'::jsonb,
 4, true, false, false),
('Relatórios', 'ChartBar', '/portal/reports', 'Relatórios e análises',
 '{"pt-BR": {"label": "Relatórios", "description": "Relatórios e análises"}, "en-US": {"label": "Reports", "description": "Reports and analytics"}, "es-ES": {"label": "Informes", "description": "Informes y análisis"}}'::jsonb,
 5, true, false, false),
('Missões', 'Target', '/portal/missions', 'Missões e desafios',
 '{"pt-BR": {"label": "Missões", "description": "Missões e desafios"}, "en-US": {"label": "Missions", "description": "Missions and challenges"}, "es-ES": {"label": "Misiones", "description": "Misiones y desafíos"}}'::jsonb,
 6, true, false, false),
('Roletas', 'Roulette', '/portal/custom-wheels', 'Roletas personalizadas',
 '{"pt-BR": {"label": "Roletas", "description": "Roletas personalizadas"}, "en-US": {"label": "Wheels", "description": "Custom wheels"}, "es-ES": {"label": "Ruletas", "description": "Ruletas personalizadas"}}'::jsonb,
 7, true, false, true),
('Balões', 'Balloon', '/portal/balloon-games', 'Bolão de bexigas',
 '{"pt-BR": {"label": "Balões", "description": "Bolão de bexigas"}, "en-US": {"label": "Balloons", "description": "Balloon games"}, "es-ES": {"label": "Globos", "description": "Juegos de globos"}}'::jsonb,
 8, true, false, true),
('Raspadinhas', 'MagicWand', '/portal/scratch-cards', 'Raspadinhas interativas',
 '{"pt-BR": {"label": "Raspadinhas", "description": "Raspadinhas interativas"}, "en-US": {"label": "Scratch Cards", "description": "Interactive scratch cards"}, "es-ES": {"label": "Raspaditas", "description": "Tarjetas raspaditas interactivas"}}'::jsonb,
 9, true, false, true),
('Loja', 'ShoppingBag', '/portal/rewards-shop', 'Loja de recompensas',
 '{"pt-BR": {"label": "Loja", "description": "Loja de recompensas"}, "en-US": {"label": "Shop", "description": "Rewards shop"}, "es-ES": {"label": "Tienda", "description": "Tienda de recompensas"}}'::jsonb,
 10, true, false, true),
('Conquistas', 'Trophy', '/portal/achievements', 'Conquistas desbloqueadas',
 '{"pt-BR": {"label": "Conquistas", "description": "Conquistas desbloqueadas"}, "en-US": {"label": "Achievements", "description": "Unlocked achievements"}, "es-ES": {"label": "Logros", "description": "Logros desbloqueados"}}'::jsonb,
 11, true, false, true),
('Automações', 'Lightning', '/portal/automations', 'Automações do sistema',
 '{"pt-BR": {"label": "Automações", "description": "Automações do sistema"}, "en-US": {"label": "Automations", "description": "System automations"}, "es-ES": {"label": "Automatizaciones", "description": "Automatizaciones del sistema"}}'::jsonb,
 12, true, false, false),
('Empresas', 'Buildings', '/portal/companies', 'Gerenciamento de empresas',
 '{"pt-BR": {"label": "Empresas", "description": "Gerenciamento de empresas"}, "en-US": {"label": "Companies", "description": "Company management"}, "es-ES": {"label": "Empresas", "description": "Gestión de empresas"}}'::jsonb,
 13, true, true, false),
('Usuários', 'UserCircle', '/portal/users', 'Gerenciamento de usuários',
 '{"pt-BR": {"label": "Usuários", "description": "Gerenciamento de usuários"}, "en-US": {"label": "Users", "description": "User management"}, "es-ES": {"label": "Usuarios", "description": "Gestión de usuarios"}}'::jsonb,
 14, true, true, false),
('Perfis', 'UserCircleGear', '/portal/profiles', 'Perfis de acesso',
 '{"pt-BR": {"label": "Perfis", "description": "Perfis de acesso"}, "en-US": {"label": "Profiles", "description": "Access profiles"}, "es-ES": {"label": "Perfiles", "description": "Perfiles de acceso"}}'::jsonb,
 15, true, true, false),
('Menus', 'List', '/portal/menus', 'Configuração de menus',
 '{"pt-BR": {"label": "Menus", "description": "Configuração de menus"}, "en-US": {"label": "Menus", "description": "Menu configuration"}, "es-ES": {"label": "Menús", "description": "Configuración de menús"}}'::jsonb,
 16, true, true, false),
('Configurações', 'Gear', '/portal/settings', 'Configurações do sistema',
 '{"pt-BR": {"label": "Configurações", "description": "Configurações do sistema"}, "en-US": {"label": "Settings", "description": "System settings"}, "es-ES": {"label": "Configuraciones", "description": "Configuraciones del sistema"}}'::jsonb,
 17, true, true, false)
ON CONFLICT (parent_id, order_position) DO NOTHING;

-- ============================================================================
-- 6. VERIFICAÇÕES E VALIDAÇÕES
-- ============================================================================

-- Verificar se as tabelas foram criadas
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'polox' AND table_name = 'profiles') THEN
        RAISE NOTICE '✓ Tabela polox.profiles criada com sucesso';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'polox' AND table_name = 'menu_items') THEN
        RAISE NOTICE '✓ Tabela polox.menu_items criada com sucesso';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'polox' AND table_name = 'menu_company_permissions') THEN
        RAISE NOTICE '✓ Tabela polox.menu_company_permissions criada com sucesso';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_schema = 'polox' AND table_name = 'users' AND column_name = 'profile_id') THEN
        RAISE NOTICE '✓ Coluna profile_id adicionada em polox.users';
    END IF;
END $$;

-- Contar registros inseridos
SELECT 
    (SELECT COUNT(*) FROM polox.profiles) as perfis_criados,
    (SELECT COUNT(*) FROM polox.profiles WHERE is_system_default = true) as perfis_sistema,
    (SELECT COUNT(*) FROM polox.menu_items) as menus_criados;

-- ============================================================================
-- INFORMAÇÕES IMPORTANTES SOBRE is_system_default
-- ============================================================================

-- PERFIS PADRÃO DO SISTEMA (is_system_default = true):
-- 1. Aparecem para TODAS as empresas automaticamente
-- 2. Apenas SUPER_ADMIN pode editar ou deletar
-- 3. Não podem ser deletados se houver usuários vinculados
-- 4. Garantem perfis básicos sempre disponíveis
--
-- Perfis padrão criados:
--   - Administrador (acesso total)
--   - Vendedor (dashboard, leads, clients, sales, reports)
--   - Gerente (dashboard, leads, clients, sales, reports, users)
--   - Visualizador (dashboard, reports)
--
-- PERFIS CUSTOMIZADOS (is_system_default = false):
-- 1. Podem ser criados por admins de cada empresa
-- 2. Visíveis apenas para a empresa que criou
-- 3. Podem ser editados/deletados pelo admin da empresa

-- ============================================================================
-- FIM DO SCRIPT
-- ============================================================================

-- Mensagem final
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Script executado com sucesso!';
    RAISE NOTICE 'Sistema de Perfis e Menus configurado.';
    RAISE NOTICE '';
    RAISE NOTICE '✓ Perfis padrão do sistema criados';
    RAISE NOTICE '✓ Apenas super_admin pode editá-los';
    RAISE NOTICE '✓ Perfis aparecem para todas empresas';
    RAISE NOTICE '========================================';
END $$;
