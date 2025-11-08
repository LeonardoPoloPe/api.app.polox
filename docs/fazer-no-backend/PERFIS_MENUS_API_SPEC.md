# API Backend - Perfis e Menus

## Especificação de Tabelas e Endpoints

**Data de Criação:** 2025-11-07  
**Última Atualização:** 2025-11-07  
**Versão:** 2.0 - Multi-Tenant  
**Objetivo:** Documentar a estrutura de banco de dados e endpoints necessários para suportar o sistema de Perfis, Menus e Permissões

---

## 🆕 Novidades da Versão 2.0 - Multi-Tenant

### Mudanças Principais:

1. **Campo `company_id` adicionado à tabela `profiles`:**

   - Perfis do sistema: `company_id = NULL` (visíveis para todas as empresas)
   - Perfis de empresa: `company_id = <id>` (visíveis apenas para a empresa proprietária)
   - Constraint: `UNIQUE (company_id, name)` - permite nomes iguais em empresas diferentes

2. **Regras de Ownership:**

   - **Super_admin:** Pode criar perfis do sistema (company_id=NULL) ou de empresas específicas
   - **Admin de empresa:** Cria perfis automaticamente vinculados à sua empresa (company_id=user.company_id)
   - Filtro de listagem: admins veem perfis do sistema + perfis da sua empresa

3. **Gestão de Menus:**

   - **APENAS super_admin pode criar/editar/deletar menu_items**
   - Menus são globais do sistema, não pertencem a empresas
   - Admins de empresa PODEM escolher quais menus seus perfis terão acesso (via `screen_ids`)

4. **Proteção de Perfis do Sistema:**

   - Perfis com `is_system_default=true` só podem ser editados/deletados por super_admin
   - Garante que perfis padrão não sejam alterados por empresas

5. **🌍 Internacionalização (i18n):**
   - **Campo `translations` (JSONB)** adicionado em `profiles` e `menu_items`
   - Suporte nativo para **3 idiomas**: Português (pt-BR), Inglês (en-US), Espanhol (es-ES)
   - Super_admin cadastra conteúdo **uma única vez** com todas as traduções
   - Frontend escolhe idioma automaticamente baseado na preferência do usuário
   - Campos `name/label` e `description` servem como fallback (pt-BR padrão)
   - Facilmente extensível para adicionar novos idiomas no futuro

---

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [Estrutura de Tabelas](#estrutura-de-tabelas)
3. [Relacionamentos](#relacionamentos)
4. [Endpoints da API](#endpoints-da-api)
5. [Regras de Negócio](#regras-de-negócio)
6. [Recursos Futuros](#recursos-futuros)

---

## 🎯 Visão Geral

O sistema de Perfis e Menus permite:

- ✅ Gerenciamento de perfis de usuário com permissões por tela
- ✅ Controle de acesso baseado em perfis (`super_admin` e `admin`)
- ✅ Configuração dinâmica de menus com hierarquia
- ✅ Permissões específicas por empresa
- 🔜 Submenus/Menus aninhados (via `parentId`)
- 🔜 Duplicação de perfis e menus
- 🔜 Drag & drop para reordenação
- 🔜 Notificações toast

---

## 📊 Estrutura de Tabelas

> **⚠️ IMPORTANTE:** As tabelas `companies` e `users` **JÁ EXISTEM** no schema `polox`. Apenas criar as novas tabelas de perfis e menus.

### Tabelas Existentes (NÃO CRIAR)

#### ✅ **Tabela: `polox.companies`** - JÁ EXISTE

```sql
-- JÁ EXISTE - Usar a tabela existente
-- Estrutura: id (bigserial), company_name, status, subscription_plan, etc.
```

#### ✅ **Tabela: `polox.users`** - JÁ EXISTE

```sql
-- JÁ EXISTE - Mas precisa de ALTERAÇÃO (adicionar profile_id)
-- Estrutura atual: id (bigserial), company_id, full_name, email, user_role, etc.

-- ⚙️ ALTERAÇÃO NECESSÁRIA: Adicionar coluna profile_id
ALTER TABLE polox.users
ADD COLUMN profile_id BIGINT NULL REFERENCES polox.profiles(id) ON DELETE SET NULL;

CREATE INDEX idx_users_profile_id ON polox.users(profile_id);
```

**Observações sobre tabelas existentes:**

- `polox.companies.id` usa **BIGSERIAL** (não UUID)
- `polox.users.id` usa **BIGSERIAL** (não UUID)
- `polox.users.user_role` contém roles como 'user', 'admin', 'manager'
- Será necessário mapear os roles existentes para os novos: 'super_admin' e 'admin'

---

### Novas Tabelas a Criar

### 1. **Tabela: `polox.profiles`** 🆕

Define perfis de usuário e suas permissões.

```sql
CREATE TABLE polox.profiles (
  id BIGSERIAL PRIMARY KEY,
  company_id BIGINT NULL REFERENCES polox.companies(id) ON DELETE CASCADE, -- NULL = perfil do sistema
  name VARCHAR(100) NOT NULL, -- Fallback pt-BR
  description TEXT, -- Fallback pt-BR
  translations JSONB NOT NULL DEFAULT '{
    "pt-BR": {"name": "", "description": ""},
    "en-US": {"name": "", "description": ""},
    "es-ES": {"name": "", "description": ""}
  }'::jsonb, -- Traduções multi-idioma
  screen_ids TEXT[] DEFAULT '{}', -- Array de IDs de telas/menus permitidos
  is_active BOOLEAN DEFAULT true,
  is_system_default BOOLEAN DEFAULT false, -- Perfil padrão do sistema (só super_admin edita)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_profile_name_per_company UNIQUE (company_id, name)
);

CREATE INDEX idx_profiles_company_id ON polox.profiles(company_id);
CREATE INDEX idx_profiles_name ON polox.profiles(name);
CREATE INDEX idx_profiles_is_active ON polox.profiles(is_active);
CREATE INDEX idx_profiles_is_system_default ON polox.profiles(is_system_default);
CREATE INDEX idx_profiles_translations ON polox.profiles USING GIN (translations); -- Indexar JSONB

-- Trigger para atualizar updated_at
CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON polox.profiles
FOR EACH ROW EXECUTE FUNCTION polox.update_updated_at_column();
```

**Atributos:**

- `id`: Identificador único do perfil
- `company_id`: ID da empresa que criou o perfil (NULL para perfis padrão do sistema)
- `name`: Nome do perfil (único por empresa, fallback pt-BR)
- `description`: Descrição do perfil (fallback pt-BR)
- `translations`: **JSONB** com traduções em 3 idiomas (pt-BR, en-US, es-ES)
- `screen_ids`: Array de IDs das telas/menus que o perfil pode acessar
- `is_active`: Status ativo/inativo
- `is_system_default`: Perfil padrão do sistema (protegido, apenas super_admin pode editar/deletar)
- `created_at`: Data de criação
- `updated_at`: Data de atualização

**🌍 Internacionalização (i18n):**

O campo `translations` armazena traduções em JSONB:

```json
{
  "pt-BR": {
    "name": "Administrador",
    "description": "Acesso completo ao sistema"
  },
  "en-US": {
    "name": "Administrator",
    "description": "Full system access"
  },
  "es-ES": {
    "name": "Administrador",
    "description": "Acceso completo al sistema"
  }
}
```

- Perfis são cadastrados **uma única vez** com os 3 idiomas
- Frontend exibe nome/descrição baseado no idioma do usuário
- Campos `name` e `description` servem como **fallback** (pt-BR padrão)

**Observações:**

- Se uma tela/menu está no array `screen_ids`, o usuário tem acesso TOTAL (ler, criar, editar, deletar)
- Abordagem simplificada: permissão binária (tem acesso ou não tem)

**🔐 Regras de Propriedade e Acesso:**

1. **Perfis Padrão do Sistema** (`company_id = NULL`, `is_system_default = true`):

   - Criados e gerenciados apenas por **super_admin**
   - Aparecem para TODAS as empresas
   - Não podem ser editados/deletados por admins de empresa
   - Exemplos: Administrador, Vendedor, Gerente, Visualizador

2. **Perfis Customizados da Empresa** (`company_id != NULL`, `is_system_default = false`):
   - Podem ser criados por **admins de qualquer empresa**
   - Aparecem APENAS para a empresa que criou (`company_id`)
   - Podem ser editados/deletados pelo admin da própria empresa
   - Nome precisa ser único apenas dentro da mesma empresa
   - Empresa escolhe quais menus o perfil terá acesso (via `screen_ids`)---

### 2. **Tabela: `polox.menu_items`** 🆕

Define os itens de menu da aplicação.

````sql
CREATE TABLE polox.menu_items (
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
  is_special BOOLEAN DEFAULT false, -- Item de gamificação
  admin_only BOOLEAN DEFAULT false, -- Apenas super_admin
  visible_to_all BOOLEAN DEFAULT true, -- Visível para todas empresas
  link_type VARCHAR(20) DEFAULT 'internal' CHECK (link_type IN ('internal', 'external')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_order_per_parent UNIQUE (parent_id, order_position)
);

CREATE INDEX idx_menu_items_parent_id ON polox.menu_items(parent_id);
CREATE INDEX idx_menu_items_order ON polox.menu_items(order_position);
CREATE INDEX idx_menu_items_is_active ON polox.menu_items(is_active);
CREATE INDEX idx_menu_items_admin_only ON polox.menu_items(admin_only);
CREATE INDEX idx_menu_items_translations ON polox.menu_items USING GIN (translations); -- Indexar JSONB

-- Trigger para atualizar updated_at
CREATE TRIGGER update_menu_items_updated_at
BEFORE UPDATE ON polox.menu_items
FOR EACH ROW EXECUTE FUNCTION polox.update_updated_at_column();
```

**Atributos:**

- `id`: Identificador único do menu
- `label`: Texto exibido no menu (fallback pt-BR)
- `icon`: Nome do ícone (Phosphor Icons)
- `route`: Rota da aplicação (ex: "/portal/leads")
- `description`: Descrição do item (fallback pt-BR)
- `translations`: **JSONB** com traduções em 3 idiomas (pt-BR, en-US, es-ES)
- `order_position`: Ordem de exibição no menu
- `parent_id`: ID do menu pai (null para menus principais) - **IMPLEMENTAÇÃO FUTURA**
- `is_active`: Status ativo/inativo
- `is_special`: Indica se é item de gamificação (Loja, Conquistas, etc)
- `admin_only`: Visível apenas para super_admin
- `visible_to_all`: Se false, precisa configurar empresas específicas
- `link_type`: Tipo de link (interno ou externo)
- `created_at`: Data de criação
- `updated_at`: Data de atualização

**🔐 IMPORTANTE - Gestão de Menus:**

- **APENAS super_admin pode cadastrar, editar ou deletar MENUS**
- Menus são globais do sistema, não pertencem a empresas específicas
- Admins de empresa NÃO podem criar novos menus
- Admins de empresa PODEM escolher quais menus seus perfis terão acesso (via `screen_ids` em profiles)
- Quando uma empresa cria um perfil customizado, ela seleciona dentre os menus existentes

**🌍 Internacionalização (i18n):**

O campo `translations` armazena traduções em JSONB:

```json
{
  "pt-BR": {
    "label": "Painel Principal",
    "description": "Visão geral do sistema"
  },
  "en-US": {
    "label": "Dashboard",
    "description": "System overview"
  },
  "es-ES": {
    "label": "Panel Principal",
    "description": "Visión general del sistema"
  }
}
```

- Super_admin cadastra o menu **uma única vez** com os 3 idiomas
- Frontend escolhe o idioma baseado na preferência do usuário
- Campos `label` e `description` servem como **fallback** (pt-BR padrão)
- Facilmente extensível para adicionar novos idiomas no futuro

**Observações:**

- `parent_id` existe mas não é usado atualmente na UI (implementação futura)
- `order_position` é usado para ordenação manual dos itens
- Constraint garante que não há duas ordens iguais no mesmo nível

---

### 3. **Tabela: `polox.menu_company_permissions`** 🆕

Define quais empresas têm acesso a menus específicos (quando `visible_to_all = false`).

```sql
CREATE TABLE polox.menu_company_permissions (
  id BIGSERIAL PRIMARY KEY,
  menu_item_id BIGINT NOT NULL REFERENCES polox.menu_items(id) ON DELETE CASCADE,
  company_id BIGINT NOT NULL REFERENCES polox.companies(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_menu_company UNIQUE (menu_item_id, company_id)
);

CREATE INDEX idx_menu_company_permissions_menu_id ON polox.menu_company_permissions(menu_item_id);
CREATE INDEX idx_menu_company_permissions_company_id ON polox.menu_company_permissions(company_id);
```**Atributos:**

- `id`: Identificador único
- `menu_item_id`: ID do item de menu
- `company_id`: ID da empresa
- `created_at`: Data de criação

**Observações:**

- Usado apenas quando `menu_items.visible_to_all = false`
- Permite controle granular de quais empresas veem determinados menus

---

## 🔗 Relacionamentos

````

companies (1) ----< (N) users
profiles (1) ----< (N) users
menu_items (1) ----< (N) menu_items (hierarquia - FUTURO)
menu_items (1) ----< (N) menu_company_permissions >---- (N) companies

```

**Diagrama Conceitual:**

```

┌─────────────┐
│ companies │
└──────┬──────┘
│ 1
│
│ N
┌──────▼──────┐ N ┌──────────┐ 1
│ users ├────────►│ profiles │
└─────────────┘ └──────────┘

┌──────────────┐
│ menu_items │◄─────┐ (self-reference)
└──────┬───────┘ │ parent_id
│ │
│ 1 │
│ │
│ N │
┌──────▼──────────────────────┐
│ menu_company_permissions │
└──────┬──────────────────────┘
│
│ N
┌──────▼──────┐
│ companies │
└─────────────┘

````

---

## 🔌 Endpoints da API

### **Profiles (Perfis)**

#### `GET /api/profiles`

Listar perfis - retorna perfis do sistema + perfis da empresa do usuário

**Query Parameters:**

- `search` (opcional): Filtro por nome/descrição
- `is_active` (opcional): Filtrar por status (true/false)
- `page` (opcional): Número da página (paginação)
- `limit` (opcional): Itens por página (default: 50)

**Lógica de Filtragem:**
- **super_admin:** Retorna TODOS os perfis do sistema
- **admin:** Retorna perfis do sistema (company_id=NULL) + perfis da sua empresa (company_id=user.company_id)

**Response 200:**

```json
{
  "data": [
    {
      "id": 1,
      "companyId": null,
      "name": "Vendedor",
      "description": "Perfil com acesso a leads e clientes",
      "translations": {
        "pt-BR": {
          "name": "Vendedor",
          "description": "Perfil com acesso a leads e clientes"
        },
        "en-US": {
          "name": "Salesperson",
          "description": "Profile with access to leads and clients"
        },
        "es-ES": {
          "name": "Vendedor",
          "description": "Perfil con acceso a prospectos y clientes"
        }
      },
      "screenIds": ["dashboard", "leads", "clients"],
      "isActive": true,
      "isSystemDefault": true,
      "createdAt": "2025-11-07T10:00:00Z",
      "updatedAt": "2025-11-07T10:00:00Z"
    },
    {
      "id": 5,
      "companyId": 3,
      "name": "Vendedor Premium",
      "description": "Perfil customizado da empresa",
      "translations": {
        "pt-BR": {
          "name": "Vendedor Premium",
          "description": "Perfil customizado da empresa"
        },
        "en-US": {
          "name": "Premium Salesperson",
          "description": "Company custom profile"
        },
        "es-ES": {
          "name": "Vendedor Premium",
          "description": "Perfil personalizado de la empresa"
        }
      },
      "screenIds": ["dashboard", "leads", "clients", "rewards-shop"],
      "isActive": true,
      "isSystemDefault": false,
      "createdAt": "2025-11-07T11:30:00Z",
      "updatedAt": "2025-11-07T11:30:00Z"
    }
  ],
  "pagination": {
    "total": 10,
    "page": 1,
    "limit": 50,
    "totalPages": 1
  },
  "stats": {
    "total": 10,
    "active": 8,
    "inactive": 2
  }
}
````

---

#### `GET /api/profiles/:id`

Buscar perfil por ID

**Response 200:**

```json
{
  "id": 1,
  "companyId": null,
  "name": "Vendedor",
  "description": "Perfil com acesso a leads e clientes",
  "translations": {
    "pt-BR": {
      "name": "Vendedor",
      "description": "Perfil com acesso a leads e clientes"
    },
    "en-US": {
      "name": "Salesperson",
      "description": "Profile with access to leads and clients"
    },
    "es-ES": {
      "name": "Vendedor",
      "description": "Perfil con acceso a prospectos y clientes"
    }
  },
  "screenIds": ["dashboard", "leads", "clients"],
  "isActive": true,
  "isSystemDefault": true,
  "createdAt": "2025-11-07T10:00:00Z",
  "updatedAt": "2025-11-07T10:00:00Z"
}
```

**Response 404:**

```json
{
  "error": "Profile not found"
}
```

---

#### `POST /api/profiles`

Criar novo perfil

**Request Body (admin de empresa):**

```json
{
  "name": "Gerente",
  "description": "Perfil com acesso total às vendas",
  "translations": {
    "pt-BR": {
      "name": "Gerente",
      "description": "Perfil com acesso total às vendas"
    },
    "en-US": {
      "name": "Manager",
      "description": "Profile with full sales access"
    },
    "es-ES": {
      "name": "Gerente",
      "description": "Perfil con acceso total a ventas"
    }
  },
  "screenIds": ["dashboard", "leads", "clients", "sales", "reports"],
  "isActive": true
}
```

**Request Body (super_admin - criar perfil do sistema):**

```json
{
  "companyId": null,
  "name": "Operador",
  "description": "Novo perfil padrão do sistema",
  "translations": {
    "pt-BR": {
      "name": "Operador",
      "description": "Novo perfil padrão do sistema"
    },
    "en-US": {
      "name": "Operator",
      "description": "New system default profile"
    },
    "es-ES": {
      "name": "Operador",
      "description": "Nuevo perfil predeterminado del sistema"
    }
  },
  "screenIds": ["dashboard", "leads"],
  "isActive": true,
  "isSystemDefault": true
}
```

**Validações:**

- `companyId`:
  - **admin:** Automaticamente preenchido com user.company_id (não pode ser alterado)
  - **super_admin:** Pode ser null (perfil do sistema) ou ID de empresa específica
- `name`: obrigatório, min 3 caracteres, único por empresa (constraint: unique_profile_name_per_company)
- `description`: opcional
- `translations`: **obrigatório**, deve conter os 3 idiomas (pt-BR, en-US, es-ES)
- `screenIds`: obrigatório, array de strings, ao menos 1 item
- `isActive`: opcional, default true
- `isSystemDefault`: opcional, default false (apenas super_admin pode definir como true)

**Response 201:**

```json
{
  "id": 8,
  "companyId": 3,
  "name": "Gerente",
  "description": "Perfil com acesso total às vendas",
  "translations": {
    "pt-BR": {
      "name": "Gerente",
      "description": "Perfil com acesso total às vendas"
    },
    "en-US": {
      "name": "Manager",
      "description": "Profile with full sales access"
    },
    "es-ES": {
      "name": "Gerente",
      "description": "Perfil con acceso total a ventas"
    }
  },
  "screenIds": ["dashboard", "leads", "clients", "sales", "reports"],
  "isActive": true,
  "isSystemDefault": false,
  "createdAt": "2025-11-07T10:00:00Z",
  "updatedAt": "2025-11-07T10:00:00Z"
}
```

**Response 400:**

```json
{
  "error": "Validation error",
  "details": {
    "name": "Name is required"
  }
}
```

---

#### `PUT /api/profiles/:id`

Atualizar perfil existente

**Regras de Autorização:**

- **admin:** Pode editar apenas perfis da sua empresa (company_id = user.company_id)
- **super_admin:** Pode editar qualquer perfil (sistema ou de empresa)
- Perfis com `is_system_default=true` só podem ser editados por super_admin

**Request Body:**

```json
{
  "name": "Gerente de Vendas",
  "description": "Perfil atualizado",
  "translations": {
    "pt-BR": {
      "name": "Gerente de Vendas",
      "description": "Perfil atualizado para gerenciamento de vendas"
    },
    "en-US": {
      "name": "Sales Manager",
      "description": "Updated profile for sales management"
    },
    "es-ES": {
      "name": "Gerente de Ventas",
      "description": "Perfil actualizado para gestión de ventas"
    }
  },
  "screenIds": ["dashboard", "leads", "clients", "sales"],
  "isActive": true
}
```

**Response 200:**

```json
{
  "id": 8,
  "companyId": 3,
  "name": "Gerente de Vendas",
  "description": "Perfil atualizado",
  "translations": {
    "pt-BR": {
      "name": "Gerente de Vendas",
      "description": "Perfil atualizado para gerenciamento de vendas"
    },
    "en-US": {
      "name": "Sales Manager",
      "description": "Updated profile for sales management"
    },
    "es-ES": {
      "name": "Gerente de Ventas",
      "description": "Perfil actualizado para gestión de ventas"
    }
  },
  "screenIds": ["dashboard", "leads", "clients", "sales"],
  "isActive": true,
  "isSystemDefault": false,
  "createdAt": "2025-11-07T10:00:00Z",
  "updatedAt": "2025-11-07T12:00:00Z"
}
```

---

#### `DELETE /api/profiles/:id`

Deletar perfil

**Regras de Autorização:**

- **admin:** Pode deletar apenas perfis da sua empresa (company_id = user.company_id)
- **super_admin:** Pode deletar qualquer perfil (sistema ou de empresa)
- Perfis com `is_system_default=true` só podem ser deletados por super_admin

**Response 200:**

```json
{
  "message": "Profile deleted successfully"
}
```

**Response 400:**

```json
{
  "error": "Cannot delete profile with active users"
}
```

**Response 403:**

```json
{
  "error": "Cannot delete system default profile. Only super_admin can delete system profiles."
}
```

**Regras:**

- Não pode deletar perfil se há usuários ativos vinculados
- Fazer SET NULL no `profile_id` dos usuários ou retornar erro
- Admin só pode deletar perfis da sua empresa
- Perfis do sistema (company_id=NULL) só podem ser deletados por super_admin

---

#### `PATCH /api/profiles/:id/toggle-status`

Ativar/desativar perfil

**Response 200:**

```json
{
  "id": "uuid",
  "isActive": false,
  "updatedAt": "2025-11-07T12:00:00Z"
}
```

---

#### `POST /api/profiles/:id/duplicate` _(IMPLEMENTAÇÃO FUTURA)_

Duplicar perfil existente

**Request Body:**

```json
{
  "name": "Vendedor Júnior (Cópia)"
}
```

**Response 201:**

```json
{
  "id": "new-uuid",
  "name": "Vendedor Júnior (Cópia)",
  "description": "Perfil com acesso a leads e clientes",
  "screenIds": ["dashboard", "leads", "clients"],
  "isActive": true,
  "createdAt": "2025-11-07T13:00:00Z",
  "updatedAt": "2025-11-07T13:00:00Z"
}
```

---

### **Menu Items (Menus)**

#### `GET /api/menu-items`

Listar todos os menus

**Query Parameters:**

- `search` (opcional): Filtro por label/descrição
- `is_active` (opcional): Filtrar por status
- `admin_only` (opcional): Filtrar menus apenas admin
- `company_id` (opcional): Filtrar menus visíveis para empresa específica
- `include_children` (opcional): Incluir submenus (default: true)

**Response 200:**

```json
{
  "data": [
    {
      "id": "uuid",
      "label": "Dashboard",
      "icon": "House",
      "route": "/portal/dashboard",
      "description": "Painel principal",
      "translations": {
        "pt-BR": {
          "label": "Painel Principal",
          "description": "Visão geral do sistema"
        },
        "en-US": {
          "label": "Dashboard",
          "description": "System overview"
        },
        "es-ES": {
          "label": "Panel Principal",
          "description": "Visión general del sistema"
        }
      },
      "order": 1,
      "parentId": null,
      "isActive": true,
      "isSpecial": false,
      "adminOnly": false,
      "visibleToAll": true,
      "linkType": "internal",
      "companyIds": [],
      "children": [],
      "createdAt": "2025-11-07T10:00:00Z",
      "updatedAt": "2025-11-07T10:00:00Z"
    }
  ],
  "stats": {
    "total": 15,
    "active": 12,
    "inactive": 3,
    "special": 2
  }
}
```

---

#### `GET /api/menu-items/:id`

Buscar menu por ID

**Response 200:**

```json
{
  "id": "uuid",
  "label": "Leads",
  "icon": "Funnel",
  "route": "/portal/leads",
  "description": "Gerenciamento de leads",
  "translations": {
    "pt-BR": {
      "label": "Leads",
      "description": "Gerenciamento de leads"
    },
    "en-US": {
      "label": "Leads",
      "description": "Lead management"
    },
    "es-ES": {
      "label": "Prospectos",
      "description": "Gestión de prospectos"
    }
  },
  "order": 2,
  "parentId": null,
  "isActive": true,
  "isSpecial": false,
  "adminOnly": false,
  "visibleToAll": true,
  "linkType": "internal",
  "companyIds": [],
  "children": [],
  "createdAt": "2025-11-07T10:00:00Z",
  "updatedAt": "2025-11-07T10:00:00Z"
}
```

---

#### `POST /api/menu-items`

Criar novo menu

**Request Body:**

```json
{
  "label": "Configurações",
  "icon": "Gear",
  "route": "/portal/settings",
  "description": "Configurações do sistema",
  "translations": {
    "pt-BR": {
      "label": "Configurações",
      "description": "Configurações do sistema"
    },
    "en-US": {
      "label": "Settings",
      "description": "System settings"
    },
    "es-ES": {
      "label": "Configuraciones",
      "description": "Configuraciones del sistema"
    }
  },
  "order": 10,
  "parentId": null,
  "isActive": true,
  "isSpecial": false,
  "adminOnly": true,
  "visibleToAll": false,
  "companyIds": ["company-uuid-1", "company-uuid-2"],
  "linkType": "internal"
}
```

**Validações:**

- `label`: obrigatório, min 2 caracteres
- `icon`: obrigatório
- `route`: obrigatório, único para menus ativos
- `order`: obrigatório, >= 0
- `translations`: **obrigatório**, deve conter os 3 idiomas (pt-BR, en-US, es-ES)
- `parentId`: opcional (UUID ou null)
- `linkType`: "internal" ou "external"
- Se `visibleToAll = false`, `companyIds` deve ter ao menos 1 empresa

**Response 201:**

```json
{
  "id": "uuid",
  "label": "Configurações",
  "icon": "Gear",
  "route": "/portal/settings",
  "description": "Configurações do sistema",
  "translations": {
    "pt-BR": {
      "label": "Configurações",
      "description": "Configurações do sistema"
    },
    "en-US": {
      "label": "Settings",
      "description": "System settings"
    },
    "es-ES": {
      "label": "Configuraciones",
      "description": "Configuraciones del sistema"
    }
  },
  "order": 10,
  "parentId": null,
  "isActive": true,
  "isSpecial": false,
  "adminOnly": true,
  "visibleToAll": false,
  "linkType": "internal",
  "companyIds": ["company-uuid-1", "company-uuid-2"],
  "children": [],
  "createdAt": "2025-11-07T10:00:00Z",
  "updatedAt": "2025-11-07T10:00:00Z"
}
```

---

#### `PUT /api/menu-items/:id`

Atualizar menu

**Request Body:**

```json
{
  "label": "Configurações Avançadas",
  "icon": "GearSix",
  "route": "/portal/settings/advanced",
  "description": "Configurações avançadas",
  "translations": {
    "pt-BR": {
      "label": "Configurações Avançadas",
      "description": "Configurações avançadas do sistema"
    },
    "en-US": {
      "label": "Advanced Settings",
      "description": "Advanced system settings"
    },
    "es-ES": {
      "label": "Configuraciones Avanzadas",
      "description": "Configuraciones avanzadas del sistema"
    }
  },
  "order": 11,
  "parentId": "parent-menu-uuid",
  "isActive": true,
  "isSpecial": false,
  "adminOnly": true,
  "visibleToAll": true,
  "companyIds": [],
  "linkType": "internal"
}
```

**Response 200:**

```json
{
  "id": "uuid",
  "label": "Configurações Avançadas",
  "icon": "GearSix",
  "route": "/portal/settings/advanced",
  "description": "Configurações avançadas",
  "translations": {
    "pt-BR": {
      "label": "Configurações Avançadas",
      "description": "Configurações avançadas do sistema"
    },
    "en-US": {
      "label": "Advanced Settings",
      "description": "Advanced system settings"
    },
    "es-ES": {
      "label": "Configuraciones Avanzadas",
      "description": "Configuraciones avanzadas del sistema"
    }
  },
  "order": 11,
  "parentId": "parent-menu-uuid",
  "isActive": true,
  "isSpecial": false,
  "adminOnly": true,
  "visibleToAll": true,
  "linkType": "internal",
  "companyIds": [],
  "children": [],
  "createdAt": "2025-11-07T10:00:00Z",
  "updatedAt": "2025-11-07T14:00:00Z"
}
```

---

#### `DELETE /api/menu-items/:id`

Deletar menu

**Response 200:**

```json
{
  "message": "Menu item deleted successfully"
}
```

**Regras:**

- Se o menu tem filhos (submenus), deletar recursivamente ou retornar erro

---

#### `PATCH /api/menu-items/:id/toggle-status`

Ativar/desativar menu

**Response 200:**

```json
{
  "id": "uuid",
  "isActive": false,
  "updatedAt": "2025-11-07T14:00:00Z"
}
```

---

#### `POST /api/menu-items/reorder`

Reordenar menus

**Request Body:**

```json
{
  "orders": [
    { "id": "uuid-1", "order": 1 },
    { "id": "uuid-2", "order": 2 },
    { "id": "uuid-3", "order": 3 }
  ]
}
```

**Response 200:**

```json
{
  "message": "Menus reordered successfully",
  "updated": 3
}
```

**Observações:**

- Atualizar o campo `order_position` de todos os menus enviados
- Validar que não há conflitos de ordem no mesmo nível (mesmo `parent_id`)

---

#### `POST /api/menu-items/:id/duplicate` _(IMPLEMENTAÇÃO FUTURA)_

Duplicar menu

**Request Body:**

```json
{
  "label": "Leads Premium (Cópia)"
}
```

**Response 201:**

```json
{
  "id": "new-uuid",
  "label": "Leads Premium (Cópia)",
  "icon": "Funnel",
  "route": "/portal/leads-premium-copy",
  "description": "Gerenciamento de leads",
  "order": 15,
  "parentId": null,
  "isActive": true,
  "isSpecial": false,
  "adminOnly": false,
  "visibleToAll": true,
  "linkType": "internal",
  "companyIds": [],
  "children": [],
  "createdAt": "2025-11-07T15:00:00Z",
  "updatedAt": "2025-11-07T15:00:00Z"
}
```

**Observações:**

- Duplicar também as permissões de empresa (`menu_company_permissions`)
- Gerar nova rota única automaticamente ou exigir no request

---

### **Users (Usuários)**

#### `GET /api/users`

Listar usuários

**Query Parameters:**

- `company_id` (opcional): Filtrar por empresa
- `profile_id` (opcional): Filtrar por perfil
- `role` (opcional): Filtrar por role (super_admin/admin)
- `is_active` (opcional): Filtrar por status

**Response 200:**

```json
{
  "data": [
    {
      "id": "uuid",
      "companyId": "company-uuid",
      "profileId": "profile-uuid",
      "name": "João Silva",
      "email": "joao@empresa.com",
      "role": "admin",
      "isActive": true,
      "lastLogin": "2025-11-07T09:30:00Z",
      "createdAt": "2025-11-01T10:00:00Z",
      "updatedAt": "2025-11-07T10:00:00Z"
    }
  ]
}
```

---

#### `GET /api/users/:id/permissions`

Obter permissões efetivas do usuário

**Response 200:**

```json
{
  "userId": "uuid",
  "role": "admin",
  "profile": {
    "id": "profile-uuid",
    "name": "Vendedor",
    "screenIds": ["dashboard", "leads", "clients"]
  },
  "allowedScreens": ["dashboard", "leads", "clients"],
  "allowedMenus": [
    {
      "id": "menu-uuid-1",
      "label": "Dashboard",
      "route": "/portal/dashboard"
    },
    {
      "id": "menu-uuid-2",
      "label": "Leads",
      "route": "/portal/leads"
    }
  ]
}
```

**Lógica:**

1. Buscar perfil do usuário
2. Filtrar menus:
   - Se `role = super_admin`: todos os menus ativos
   - Se `role = admin`: menus ativos onde `adminOnly = false` OU (menus visíveis para sua empresa)
3. Retornar apenas menus que o perfil permite (`screenIds`)

---

### **Companies (Empresas)**

#### `GET /api/companies`

Listar empresas (apenas super_admin)

**Response 200:**

```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Empresa ABC",
      "cnpj": "12.345.678/0001-90",
      "email": "contato@empresa.com",
      "phone": "(11) 98765-4321",
      "address": "Rua Exemplo, 123",
      "isActive": true,
      "createdAt": "2025-10-01T10:00:00Z",
      "updatedAt": "2025-11-07T10:00:00Z"
    }
  ]
}
```

---

#### `POST /api/companies`

Criar empresa (apenas super_admin)

**Request Body:**

```json
{
  "name": "Nova Empresa",
  "cnpj": "98.765.432/0001-10",
  "email": "contato@novaempresa.com",
  "phone": "(11) 99999-9999",
  "address": "Av. Principal, 456",
  "isActive": true
}
```

**Response 201:**

```json
{
  "id": "uuid",
  "name": "Nova Empresa",
  "cnpj": "98.765.432/0001-10",
  "email": "contato@novaempresa.com",
  "phone": "(11) 99999-9999",
  "address": "Av. Principal, 456",
  "isActive": true,
  "createdAt": "2025-11-07T10:00:00Z",
  "updatedAt": "2025-11-07T10:00:00Z"
}
```

---

## 🔐 Middleware de Autorização

### Implementação Necessária

#### 1. **Authentication Middleware**

Verificar token JWT e autenticar usuário.

```javascript
// Pseudocódigo
async function authenticate(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    const user = await User.findById(decoded.userId);

    if (!user || !user.isActive) {
      return res.status(401).json({ error: "Invalid user" });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ error: "Invalid token" });
  }
}
```

---

#### 2. **Authorization Middleware**

Verificar permissões baseadas em role e perfil.

```javascript
// Pseudocódigo
function authorize(options = {}) {
  return async (req, res, next) => {
    const { user } = req;
    const { requireSuperAdmin, requiredScreen } = options;

    // Verificar se requer super_admin
    if (requireSuperAdmin && user.role !== "super_admin") {
      return res.status(403).json({
        error: "Access denied. Super admin only.",
      });
    }

    // Verificar permissão de tela específica
    if (requiredScreen) {
      const profile = await Profile.findById(user.profileId);

      if (!profile || !profile.screenIds.includes(requiredScreen)) {
        return res.status(403).json({
          error: "Access denied. Insufficient permissions.",
        });
      }
    }

    next();
  };
}
```

**Exemplos de Uso:**

```javascript
// Rota apenas para super_admin
app.get(
  "/api/companies",
  authenticate,
  authorize({ requireSuperAdmin: true }),
  getCompanies
);

// Rota que requer acesso à tela 'leads'
app.get(
  "/api/leads",
  authenticate,
  authorize({ requiredScreen: "leads" }),
  getLeads
);

// Rota que requer acesso à tela 'profiles' e ser super_admin
app.post(
  "/api/profiles",
  authenticate,
  authorize({
    requireSuperAdmin: true,
    requiredScreen: "profiles",
  }),
  createProfile
);

// Deletar perfil - verificar se é perfil do sistema
app.delete(
  "/api/profiles/:id",
  authenticate,
  authorize({ requireSuperAdmin: true }),
  async (req, res) => {
    const profile = await Profile.findById(req.params.id);

    if (profile.isSystemDefault && req.user.role !== "super_admin") {
      return res.status(403).json({
        error: "Cannot delete system default profile",
      });
    }

    // Continuar com a deleção
  }
);
```

---

#### 3. **Company Scope Middleware**

Garantir que admins só acessem dados da própria empresa.

```javascript
// Pseudocódigo
function enforceCompanyScope(req, res, next) {
  const { user } = req;

  // Super admin pode acessar qualquer empresa
  if (user.role === "super_admin") {
    return next();
  }

  // Admin só pode acessar sua própria empresa
  // Adicionar automaticamente filtro de companyId nas queries
  req.companyScope = {
    companyId: user.companyId,
  };

  next();
}

// Aplicar em rotas de profiles para filtrar resultados
function getProfilesWithCompanyScope(req, res) {
  const { user } = req;

  let query;
  if (user.role === "super_admin") {
    // Retorna todos os perfis
    query = db.profiles.findAll();
  } else {
    // Retorna perfis do sistema + perfis da empresa
    query = db.profiles.findAll({
      where: {
        OR: [
          { company_id: null }, // Perfis do sistema
          { company_id: user.companyId }, // Perfis da empresa
        ],
      },
    });
  }

  return query;
}
```

---

## 📐 Regras de Negócio

### Perfis

1. ✅ Nome do perfil deve ser único **por empresa** (constraint: unique_profile_name_per_company)
2. ✅ Não é possível deletar perfil com usuários ativos vinculados
3. ✅ Perfis inativos não podem ser atribuídos a novos usuários
4. ✅ Um perfil deve ter ao menos 1 tela permitida
5. ✅ Perfis com `is_system_default = true` só podem ser editados/deletados por super_admin
6. ✅ **Perfis do sistema** (company_id = NULL): Visíveis para todas as empresas, criados/editados apenas por super_admin
7. ✅ **Perfis de empresa** (company_id = ID): Criados por admin da empresa, visíveis apenas para sua empresa
8. ✅ Admin de empresa cria perfis automaticamente com seu company_id (não pode alterar)
9. ✅ Super_admin pode criar perfis do sistema (company_id = NULL) ou de empresas específicas
10. ✅ Filtro de listagem: admins veem perfis do sistema + perfis da sua empresa
11. ✅ Campo `translations` deve conter os 3 idiomas obrigatórios: pt-BR, en-US, es-ES
12. 🔜 Duplicação de perfil copia todas as permissões (mas não o status de system_default)

### Menus

1. ✅ **APENAS super_admin pode criar, editar ou deletar menu_items**
2. ✅ Admins de empresa NÃO podem criar novos menus
3. ✅ Admins de empresa PODEM escolher quais menus existentes seus perfis terão acesso (via screen_ids)
4. ✅ A combinação (parent_id, order_position) deve ser única
5. ✅ Rotas devem ser únicas para menus ativos
6. ✅ Se `visibleToAll = false`, deve ter ao menos 1 empresa associada
7. ✅ Menus com `adminOnly = true` só aparecem para super_admin
8. ✅ Menus inativos não aparecem na navegação
9. ✅ Campo `translations` deve conter os 3 idiomas obrigatórios: pt-BR, en-US, es-ES
10. 🔜 Ao deletar menu pai, deletar ou reparentar submenus
11. 🔜 Duplicação de menu copia permissões de empresa
12. 🔜 Drag & drop atualiza `order_position` de múltiplos menus

### Usuários

1. ✅ Email deve ser único
2. ✅ `super_admin` não tem company_id (null)
3. ✅ `admin` deve ter company_id obrigatório
4. ✅ Senha deve ter no mínimo 8 caracteres
5. ✅ Apenas super_admin pode criar outros super_admins
6. ✅ Admin só pode criar usuários na própria empresa

### Autorização

1. ✅ Super_admin tem acesso total ao sistema
2. ✅ Admin só acessa recursos da própria empresa
3. ✅ Acesso às telas é controlado pelo perfil (`screen_ids`)
4. ✅ Menus são filtrados por role, empresa e perfil
5. ✅ Tokens JWT devem expirar em 24h

---

## 🚀 Recursos Futuros

### 1. **Submenus/Menus Aninhados**

- ✅ Campo `parent_id` já existe nas tabelas
- 🔜 Implementar na UI recursão para renderizar submenus
- 🔜 Adicionar endpoint para buscar árvore de menus
- 🔜 Validar profundidade máxima (ex: 3 níveis)

**Endpoint Sugerido:**

```
GET /api/menu-items/tree
```

**Response:**

```json
{
  "data": [
    {
      "id": "uuid",
      "label": "Configurações",
      "children": [
        {
          "id": "child-uuid",
          "label": "Usuários",
          "children": []
        }
      ]
    }
  ]
}
```

---

### 2. **Duplicar Perfil/Menu**

- 🔜 Endpoint `POST /api/profiles/:id/duplicate`
- 🔜 Endpoint `POST /api/menu-items/:id/duplicate`
- 🔜 Validar unicidade de nome/rota ao duplicar
- 🔜 Copiar todas as relações (permissões de empresa)

---

### 3. **Drag & Drop para Reordenação**

- 🔜 Frontend: Implementar biblioteca `@dnd-kit/core`
- 🔜 Backend: Endpoint `POST /api/menu-items/reorder` (batch update)
- 🔜 Validar conflitos de ordem no mesmo nível
- 🔜 Retornar lista atualizada após reordenação

---

### 4. **Notificações Toast**

- 🔜 Frontend: Implementar sistema de notificações (react-hot-toast)
- 🔜 Backend: Retornar mensagens padronizadas
- 🔜 Tipos: success, error, warning, info

**Exemplo de Response:**

```json
{
  "success": true,
  "message": "Perfil criado com sucesso!",
  "data": { ... }
}
```

---

### 5. **Permissões Granulares (Opcional)**

Evoluir de permissão binária para CRUD por tela.

**Nova estrutura:**

```json
{
  "screenPermissions": [
    {
      "screenId": "leads",
      "permissions": {
        "read": true,
        "create": true,
        "update": true,
        "delete": false
      }
    }
  ]
}
```

**Alteração de Tabela:**

```sql
-- Substituir screen_ids por tabela de relacionamento
CREATE TABLE profile_screen_permissions (
  id UUID PRIMARY KEY,
  profile_id UUID REFERENCES profiles(id),
  screen_id VARCHAR(50),
  can_read BOOLEAN DEFAULT false,
  can_create BOOLEAN DEFAULT false,
  can_update BOOLEAN DEFAULT false,
  can_delete BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 📊 Métricas e Logging

### Logs Recomendados

- ✅ Login/logout de usuários
- ✅ Criação/edição/exclusão de perfis
- ✅ Criação/edição/exclusão de menus
- ✅ Tentativas de acesso negado (403)
- ✅ Alterações de permissões

### Tabela de Auditoria (Opcional)

```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  action VARCHAR(50) NOT NULL, -- 'CREATE', 'UPDATE', 'DELETE', 'LOGIN', etc
  entity_type VARCHAR(50) NOT NULL, -- 'profile', 'menu', 'user', etc
  entity_id UUID,
  changes JSONB, -- Armazenar before/after em JSON
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 🧪 Testes Sugeridos

### Testes Unitários

- ✅ Validação de criação de perfis
- ✅ Validação de criação de menus
- ✅ Lógica de autorização
- ✅ Filtro de menus por perfil/empresa

### Testes de Integração

- ✅ Fluxo completo de autenticação
- ✅ Criação de usuário + perfil + menu
- ✅ Tentativa de acesso não autorizado
- ✅ Reordenação de menus

### Testes End-to-End

- ✅ Login como super_admin → criar empresa → criar usuário admin
- ✅ Login como admin → visualizar apenas recursos da empresa
- ✅ Usuário com perfil limitado → não acessa telas restritas

---

## 📚 Referências

### Tecnologias Sugeridas

- **Backend:** Node.js (Express/Fastify) ou NestJS
- **Database:** PostgreSQL 14+
- **ORM:** Prisma, TypeORM ou Sequelize
- **Auth:** JWT (jsonwebtoken)
- **Validation:** Zod, Joi ou class-validator
- **Migration:** Knex.js, TypeORM migrations ou Prisma migrate

### Bibliotecas Frontend (já em uso)

- **UI Components:** @polox/ui
- **Icons:** Phosphor React
- **Forms:** React Hook Form + Zod
- **Notifications:** react-hot-toast (a implementar)
- **Drag & Drop:** @dnd-kit/core (a implementar)

---

## 📝 Notas Finais

### Prioridades de Implementação

1. **Fase 1 (MVP):** Tabelas base + CRUD de Perfis/Menus/Usuários
2. **Fase 2 (Auth):** Middleware de autenticação e autorização
3. **Fase 3 (Filtros):** Filtro de menus por empresa e perfil
4. **Fase 4 (Recursos):** Duplicação, reordenação, submenus, notificações

### Pendências do Frontend

- 🔜 Integrar com API real (atualmente usa dados mockados)
- 🔜 Implementar notificações toast
- 🔜 Implementar drag & drop
- 🔜 Implementar duplicação de perfis/menus
- 🔜 Implementar interface para submenus hierárquicos

---

**Documento criado por:** Leonardo Polo Pereira  
**Empresa:** POLO X Manutencao de Equipamentos de Informatica LTDA  
**CNPJ:** 55.419.946/0001-89  
**Contato:** contato@polox.com.br

---

**© 2025 POLO X - Todos os direitos reservados**
