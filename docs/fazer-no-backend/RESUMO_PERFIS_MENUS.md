# Resumo: Sistema de Perfis e Menus - Backend

**Data:** 2025-11-07  
**Desenvolvedor:** Leonardo Polo Pereira

---

## 🎯 O Que Já Existe no Banco (NÃO CRIAR)

### ✅ Tabela `polox.companies`

- **Estrutura:** `id` (bigserial), `company_name`, `status`, `subscription_plan`, etc.
- **Status:** JÁ EXISTE - Usar como está

### ✅ Tabela `polox.users`

- **Estrutura:** `id` (bigserial), `company_id`, `full_name`, `email`, `user_role`, etc.
- **Status:** JÁ EXISTE
- **⚠️ AÇÃO NECESSÁRIA:** Adicionar coluna `profile_id` (BIGINT, nullable, FK para profiles)

---

## 🆕 O Que Precisa Ser Criado

### 1. Tabela `polox.profiles`

Define perfis de usuário com permissões por tela.

**Campos principais:**

- `id` (BIGSERIAL) - PK
- `company_id` (BIGINT, NULL) - 🆕 FK para empresas (NULL = perfil do sistema)
- `name` (VARCHAR(100)) - Nome do perfil (fallback pt-BR)
- `description` (TEXT) - Descrição (fallback pt-BR)
- `translations` (JSONB) - 🌍 **Traduções** em pt-BR, en-US, es-ES
- `screen_ids` (TEXT[]) - Array de IDs das telas permitidas
- `is_active` (BOOLEAN)
- `is_system_default` (BOOLEAN) - Perfil padrão do sistema (protegido)
- `created_at`, `updated_at` (TIMESTAMPTZ)

**Constraint:** `UNIQUE (company_id, name)` - Nome único por empresa

**Exemplos de perfis padrão do sistema:**

- **Administrador** (company_id: NULL, is_system_default: true): acesso total
- **Vendedor** (company_id: NULL, is_system_default: true): dashboard, leads, clients, sales
- **Gerente** (company_id: NULL, is_system_default: true): dashboard, leads, clients, sales, reports, users
- **Visualizador** (company_id: NULL, is_system_default: true): apenas dashboard e reports

**Modelo de Multi-Tenant:**

- **Perfis do Sistema** (`company_id = NULL`): Visíveis para todas as empresas, criados/editados apenas por super_admin
- **Perfis de Empresa** (`company_id = <id>`): Criados por admins de empresa, visíveis apenas para sua empresa
- Cada empresa pode ter perfis com nomes iguais aos de outras empresas (constraint permite)

---

### 2. Tabela `polox.menu_items`

Define itens do menu de navegação.

**Campos principais:**

- `id` (BIGSERIAL) - PK
- `label` (VARCHAR(100)) - Texto do menu (fallback pt-BR)
- `icon` (VARCHAR(50)) - Nome do ícone (Phosphor Icons)
- `route` (VARCHAR(255)) - Rota da aplicação
- `description` (TEXT) - Descrição (fallback pt-BR)
- `translations` (JSONB) - 🌍 **Traduções** em pt-BR, en-US, es-ES
- `order_position` (INTEGER) - Ordem de exibição
- `parent_id` (BIGINT, nullable) - Menu pai (para submenus futuros)
- `is_active` (BOOLEAN) - Ativo/inativo
- `is_special` (BOOLEAN) - Item de gamificação
- `admin_only` (BOOLEAN) - Apenas super_admin
- `visible_to_all` (BOOLEAN) - Visível para todas empresas
- `link_type` (VARCHAR) - 'internal' ou 'external'
- `created_at`, `updated_at` (TIMESTAMPTZ)

**Constraint:** `UNIQUE (parent_id, order_position)` - Ordem única por nível

---

### 3. Tabela `polox.menu_company_permissions`

Controla quais empresas veem determinados menus (quando `visible_to_all = false`).

**Campos:**

- `id` (BIGSERIAL) - PK
- `menu_item_id` (BIGINT) - FK para menu_items
- `company_id` (BIGINT) - FK para companies
- `created_at` (TIMESTAMPTZ)

**Constraint:** `UNIQUE (menu_item_id, company_id)`

---

## 🌍 Internacionalização (i18n)

### Estrutura JSONB

Ambas as tabelas (`profiles` e `menu_items`) possuem campo `translations`:

```json
{
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
}
```

### Vantagens da Abordagem JSONB

✅ **Cadastro único:** Super_admin cadastra uma vez com os 3 idiomas  
✅ **Performance:** JSONB é indexável (índice GIN criado automaticamente)  
✅ **Flexibilidade:** Fácil adicionar novos idiomas no futuro  
✅ **Simplicidade:** Frontend escolhe idioma com `translations[locale]`  
✅ **Fallback:** Campos `name/label` e `description` servem como backup (pt-BR)

### Uso no Frontend

```typescript
// Obter idioma do usuário
const locale = user.preferredLanguage || "pt-BR"; // pt-BR, en-US, es-ES

// Buscar tradução com fallback
const menuLabel = menu.translations[locale]?.label || menu.label;
const menuDesc = menu.translations[locale]?.description || menu.description;
```

### Idiomas Suportados

- 🇧🇷 **pt-BR** - Português (Brasil) - **Padrão**
- 🇺🇸 **en-US** - English (United States)
- 🇪🇸 **es-ES** - Español (España)

---

## 📋 Checklist de Implementação

### Fase 1: Estrutura de Banco

- [ ] Executar script `CREATE_PROFILES_MENUS_TABLES.sql`
- [ ] Verificar criação das 3 novas tabelas
- [ ] Confirmar que `polox.users.profile_id` foi adicionado
- [ ] Inserir perfis padrão (seed data)
- [ ] Inserir menus padrão (seed data)

### Fase 2: Endpoints da API

- [ ] **Profiles CRUD:**

  - [ ] `GET /api/profiles` - Listar
  - [ ] `GET /api/profiles/:id` - Buscar por ID
  - [ ] `POST /api/profiles` - Criar
  - [ ] `PUT /api/profiles/:id` - Atualizar
  - [ ] `DELETE /api/profiles/:id` - Deletar
  - [ ] `PATCH /api/profiles/:id/toggle-status` - Ativar/desativar

- [ ] **Menu Items CRUD:**

  - [ ] `GET /api/menu-items` - Listar
  - [ ] `GET /api/menu-items/:id` - Buscar por ID
  - [ ] `POST /api/menu-items` - Criar
  - [ ] `PUT /api/menu-items/:id` - Atualizar
  - [ ] `DELETE /api/menu-items/:id` - Deletar
  - [ ] `PATCH /api/menu-items/:id/toggle-status` - Ativar/desativar
  - [ ] `POST /api/menu-items/reorder` - Reordenar múltiplos

- [ ] **Users:**

  - [ ] `GET /api/users/:id/permissions` - Permissões efetivas do usuário

- [ ] **Companies:**
  - [ ] `GET /api/companies` - Listar (apenas super_admin)
  - [ ] `POST /api/companies` - Criar (apenas super_admin)

### Fase 3: Middleware de Autorização

- [ ] **Authentication Middleware**

  - [ ] Verificar token JWT
  - [ ] Buscar usuário no banco
  - [ ] Adicionar `req.user`

- [ ] **Authorization Middleware**

  - [ ] Verificar `role` (super_admin vs admin)
  - [ ] Verificar permissões do perfil (`screen_ids`)
  - [ ] Retornar 403 se não autorizado

- [ ] **Company Scope Middleware**
  - [ ] Filtrar dados por `company_id` para admins
  - [ ] Permitir acesso total para super_admins

### Fase 4: Regras de Negócio

**Perfis:**

- [ ] Validar unicidade de nome por empresa (constraint: unique_profile_name_per_company)
- [ ] Impedir deleção de perfil com usuários ativos
- [ ] Validar array `screen_ids` (ao menos 1 tela)
- [ ] Filtro de listagem: retornar perfis do sistema (company_id=NULL) + perfis da empresa do usuário
- [ ] Super_admin pode criar perfis do sistema (company_id=NULL)
- [ ] Admin só pode criar perfis para sua empresa (company_id obrigatório = user.company_id)
- [ ] Perfis com `is_system_default=true` só podem ser editados/deletados por super_admin

**Menus:**

- [ ] Validar ordem única de menus por nível (parent_id)
- [ ] Validar que `visible_to_all=false` tem ao menos 1 empresa configurada
- [ ] **APENAS super_admin pode criar/editar/deletar menu_items**
- [ ] Admins de empresa podem apenas escolher menus existentes para seus perfis

---

## 🔒 Controle de Acesso

### Roles do Sistema

- **`super_admin`:** Acesso total, gerencia empresas e configurações globais
- **`admin`:** Administrador da empresa, limitado ao escopo da sua empresa

### Lógica de Permissões

1. Buscar perfil do usuário (`users.profile_id → profiles`)
2. Obter `screen_ids` do perfil
3. Filtrar menus:
   - Se `super_admin`: todos os menus ativos
   - Se `admin`: menus ativos onde `admin_only = false` OU menus visíveis para sua empresa
4. Retornar apenas menus que o perfil permite (screen_id no array)

### Exemplo de Validação

```javascript
// Verificar se usuário pode acessar tela 'leads'
const profile = await Profile.findById(user.profile_id);
const canAccess = profile.screen_ids.includes("leads");

if (!canAccess) {
  return res.status(403).json({ error: "Access denied" });
}
```

---

## 📊 Dados Iniciais (Seed)

### Perfis Padrão

1. **Administrador** - Todas as telas
2. **Vendedor** - Dashboard, Leads, Clients, Sales, Reports
3. **Gerente** - Dashboard, Leads, Clients, Sales, Reports, Users
4. **Visualizador** - Dashboard, Reports

### Menus Padrão

1. Dashboard (ordem: 1)
2. Leads (ordem: 2)
3. Clientes (ordem: 3)
4. Vendas (ordem: 4)
5. Relatórios (ordem: 5)
6. Missões (ordem: 6, especial: true)
7. Roletas (ordem: 7, especial: true)
8. Balões (ordem: 8, especial: true)
9. Raspadinhas (ordem: 9, especial: true)
10. Loja (ordem: 10, especial: true)
11. Conquistas (ordem: 11, especial: true)
12. Automações (ordem: 12)
13. Empresas (ordem: 13, admin_only: true)
14. Usuários (ordem: 14, admin_only: true)
15. Perfis (ordem: 15, admin_only: true)
16. Menus (ordem: 16, admin_only: true)
17. Configurações (ordem: 17, admin_only: true)

---

## 🚀 Recursos Futuros

### Implementar Depois

1. **Submenus hierárquicos** - Usar `parent_id` para criar estrutura de árvore
2. **Duplicar perfil/menu** - Endpoints `POST /api/profiles/:id/duplicate` e `POST /api/menu-items/:id/duplicate`
3. **Drag & drop** - Frontend com `@dnd-kit/core` + endpoint de reordenação
4. **Notificações toast** - react-hot-toast no frontend + mensagens padronizadas no backend
5. **Permissões granulares** - CRUD por tela (read, create, update, delete)
6. **Auditoria** - Tabela de logs para rastrear alterações

---

## 🛠️ Arquivos Importantes

- **`PERFIS_MENUS_API_SPEC.md`** - Documentação completa da API
- **`CREATE_PROFILES_MENUS_TABLES.sql`** - Script SQL para criar tabelas
- **`ddl.md`** - DDL atual do banco (referência)

---

## 📞 Contato

**Desenvolvedor:** Leonardo Polo Pereira  
**Empresa:** POLO X Manutencao de Equipamentos de Informatica LTDA  
**CNPJ:** 55.419.946/0001-89  
**Email:** contato@polox.com.br

---

**© 2025 POLO X - Todos os direitos reservados**
