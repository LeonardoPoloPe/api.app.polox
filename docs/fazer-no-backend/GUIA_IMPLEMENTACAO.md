# 🚀 Sistema de Perfis e Menus - Guia de Implementação

**Data:** 2025-11-07  
**Status:** ✅ IMPLEMENTADO  
**Versão:** 1.0

---

## 📋 O QUE FOI IMPLEMENTADO

### ✅ 1. Banco de Dados (PostgreSQL)

#### Tabelas Criadas:

- ✅ `polox.profiles` - Perfis de usuário com permissões
- ✅ `polox.menu_items` - Menus do sistema
- ✅ `polox.menu_company_permissions` - Controle de menus por empresa
- ✅ `polox.users.profile_id` - Coluna adicionada (FK para profiles)

#### Recursos:

- ✅ Soft delete (`deleted_at`)
- ✅ Internacionalização (JSONB com pt-BR, en-US, es-ES)
- ✅ Índices otimizados (incluindo GIN para JSONB)
- ✅ Triggers para `updated_at`
- ✅ Constraints de unicidade

---

### ✅ 2. Models

#### `src/models/Profile.js`

Métodos implementados:

- `findAll(filters)` - Lista com filtros e paginação
- `findById(id)` - Busca por ID
- `create(data)` - Cria perfil
- `update(id, data)` - Atualiza perfil
- `delete(id)` - Soft delete (valida usuários ativos)
- `toggleStatus(id)` - Ativa/desativa
- `validateScreenIds(screenIds)` - Valida permissões
- `reassignUsers(from, to)` - Move usuários entre perfis
- `getSystemProfiles()` - Lista perfis do sistema
- `getProfilesForCompany(companyId)` - Lista perfis disponíveis

#### `src/models/MenuItem.js`

Métodos implementados:

- `findAll(filters)` - Lista com filtros
- `findById(id)` - Busca por ID
- `findByRoute(route)` - Busca por rota
- `create(data)` - Cria menu
- `update(id, data)` - Atualiza menu
- `delete(id)` - Soft delete (valida dependências)
- `toggleStatus(id)` - Ativa/desativa (com warning)
- `reorder(data, parentId)` - Reordena múltiplos menus
- `getHierarchy()` - Busca hierarquia completa
- `getMenusForCompany(companyId, isAdmin)` - Menus filtrados por empresa

---

### ✅ 3. Controllers

#### `src/controllers/ProfileController.js`

Endpoints implementados:

- `GET /api/profiles` - Lista perfis (filtrado por empresa)
- `GET /api/profiles/system-defaults` - Perfis padrão do sistema
- `GET /api/profiles/:id` - Busca por ID
- `POST /api/profiles` - Cria perfil
- `PUT /api/profiles/:id` - Atualiza perfil
- `DELETE /api/profiles/:id` - Deleta perfil
- `PATCH /api/profiles/:id/toggle-status` - Ativa/desativa
- `POST /api/profiles/:id/reassign` - Reassign usuários

#### `src/controllers/MenuItemController.js`

Endpoints implementados:

- `GET /api/menu-items` - Lista menus
- `GET /api/menu-items/hierarchy` - Hierarquia completa
- `GET /api/menu-items/for-company` - Menus da empresa
- `GET /api/menu-items/:id` - Busca por ID
- `POST /api/menu-items` - Cria menu (APENAS super_admin)
- `PUT /api/menu-items/:id` - Atualiza menu (APENAS super_admin)
- `DELETE /api/menu-items/:id` - Deleta menu (APENAS super_admin)
- `PATCH /api/menu-items/:id/toggle-status` - Ativa/desativa (APENAS super_admin)
- `POST /api/menu-items/reorder` - Reordena menus (APENAS super_admin)

---

### ✅ 4. Middleware

#### `src/middleware/checkPermission.js`

Funções implementadas:

- `checkPermission(screenId)` - Valida acesso a tela específica
- `isSuperAdmin()` - Verifica se é super_admin
- `isAdmin()` - Verifica se é admin (super_admin OU admin)
- `checkAnyPermission(screenIds)` - Valida múltiplas permissões (OR)

---

### ✅ 5. Routes

#### `src/routes/profiles.js`

- Todas rotas protegidas por `authMiddleware`
- Controle de acesso por empresa
- Validações de permissão

#### `src/routes/menus.js`

- Todas rotas protegidas por `authMiddleware`
- Operações CRUD restritas a super_admin
- Leitura disponível para admins

---

## 🔧 COMO USAR

### 1️⃣ **EXECUTAR SQL NO BANCO**

```bash
psql -U postgres -d seu_banco_de_dados
\i docs/fazer-no-backend/CREATE_PROFILES_MENUS_TABLES.sql
```

Isso vai criar:

- ✅ Tabela `profiles`
- ✅ Tabela `menu_items`
- ✅ Tabela `menu_company_permissions`
- ✅ Coluna `profile_id` em `users`
- ✅ 4 perfis padrão (Administrador, Vendedor, Gerente, Visualizador)
- ✅ 17 menus padrão

---

### 2️⃣ **TESTAR ENDPOINTS**

#### 🔐 Autenticação Necessária

Todas as rotas requerem JWT token no header:

```http
Authorization: Bearer <seu_jwt_token>
```

---

#### 📋 **PROFILES - Exemplos de Requisições**

##### 1. Listar Perfis

```http
GET /api/profiles
Authorization: Bearer <token>

Query Params (opcionais):
- search: string (busca por nome/descrição)
- is_active: boolean
- page: number (default: 1)
- limit: number (default: 50)
```

**Resposta:**

```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 10
  }
}
```

---

##### 2. Criar Perfil

```http
POST /api/profiles
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Vendedor Sênior",
  "description": "Vendedor com acesso a relatórios",
  "translations": {
    "pt-BR": {
      "name": "Vendedor Sênior",
      "description": "Vendedor com acesso a relatórios"
    },
    "en-US": {
      "name": "Senior Salesperson",
      "description": "Salesperson with access to reports"
    },
    "es-ES": {
      "name": "Vendedor Senior",
      "description": "Vendedor con acceso a informes"
    }
  },
  "screen_ids": ["1", "2", "3", "4", "5"],
  "is_active": true
}
```

**⚠️ IMPORTANTE:**

- **Admin:** `company_id` será automaticamente setado como `user.company_id`
- **Super_admin:** Pode especificar `company_id` ou deixar `null` (perfil sistema)

---

##### 3. Atualizar Perfil

```http
PUT /api/profiles/5
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Vendedor Pleno",
  "screen_ids": ["1", "2", "3", "4"],
  "is_active": true
}
```

---

##### 4. Reassign Usuários

```http
POST /api/profiles/5/reassign
Authorization: Bearer <token>
Content-Type: application/json

{
  "target_profile_id": 3
}
```

**Resposta:**

```json
{
  "success": true,
  "data": {
    "reassigned_users": 25
  }
}
```

---

#### 🗂️ **MENUS - Exemplos de Requisições**

##### 1. Listar Menus

```http
GET /api/menu-items
Authorization: Bearer <token>

Query Params (opcionais):
- is_active: boolean
- admin_only: boolean
- is_special: boolean
- parent_id: number | 'null'
- search: string
```

---

##### 2. Criar Menu (APENAS SUPER_ADMIN)

```http
POST /api/menu-items
Authorization: Bearer <token>
Content-Type: application/json

{
  "label": "Campanhas",
  "icon": "Megaphone",
  "route": "/portal/campaigns",
  "description": "Gerenciamento de campanhas",
  "translations": {
    "pt-BR": {
      "label": "Campanhas",
      "description": "Gerenciamento de campanhas"
    },
    "en-US": {
      "label": "Campaigns",
      "description": "Campaign management"
    },
    "es-ES": {
      "label": "Campañas",
      "description": "Gestión de campañas"
    }
  },
  "order_position": 18,
  "parent_id": null,
  "is_active": true,
  "is_special": false,
  "admin_only": false,
  "visible_to_all": true,
  "link_type": "internal"
}
```

---

##### 3. Reordenar Menus (APENAS SUPER_ADMIN)

```http
POST /api/menu-items/reorder
Authorization: Bearer <token>
Content-Type: application/json

{
  "menus": [
    { "id": 1, "order_position": 1 },
    { "id": 2, "order_position": 2 },
    { "id": 3, "order_position": 3 }
  ],
  "parent_id": null
}
```

---

##### 4. Buscar Hierarquia Completa

```http
GET /api/menu-items/hierarchy
Authorization: Bearer <token>
```

**Resposta:**

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "label": "Dashboard",
      "icon": "House",
      "route": "/portal/dashboard",
      "order_position": 1,
      "children": []
    },
    {
      "id": 2,
      "label": "Leads",
      "icon": "Funnel",
      "route": "/portal/leads",
      "order_position": 2,
      "children": [
        {
          "id": 21,
          "label": "Novo Lead",
          "icon": "Plus",
          "route": "/portal/leads/new",
          "order_position": 1,
          "children": []
        }
      ]
    }
  ]
}
```

---

### 3️⃣ **PROTEGER ROTAS COM PERMISSÕES**

#### Exemplo 1: Proteger rota de leads

```javascript
const { authMiddleware } = require("../middleware/auth");
const { checkPermission } = require("../middleware/checkPermission");
const LeadController = require("../controllers/LeadController");

// Apenas usuários com permissão 'leads' (screen_id)
router.get(
  "/leads",
  authMiddleware,
  checkPermission("2"), // ID do menu "Leads"
  LeadController.list
);
```

---

#### Exemplo 2: Rota apenas para super_admin

```javascript
const { authMiddleware } = require("../middleware/auth");
const { isSuperAdmin } = require("../middleware/checkPermission");
const CompanyController = require("../controllers/CompanyController");

router.post(
  "/companies",
  authMiddleware,
  isSuperAdmin,
  CompanyController.create
);
```

---

#### Exemplo 3: Múltiplas permissões (OR)

```javascript
const { authMiddleware } = require("../middleware/auth");
const { checkAnyPermission } = require("../middleware/checkPermission");
const ReportController = require("../controllers/ReportController");

// Usuário precisa ter permissão de 'reports' OU 'dashboard'
router.get(
  "/reports",
  authMiddleware,
  checkAnyPermission(["5", "1"]), // IDs dos menus
  ReportController.list
);
```

---

## 📊 REGRAS DE NEGÓCIO IMPLEMENTADAS

### ✅ PERFIS

1. ✅ **Multi-tenant:**

   - `company_id = NULL` → Perfil do sistema (visível para todos)
   - `company_id = ID` → Perfil de empresa (visível apenas para essa empresa)

2. ✅ **Criação:**

   - Admin: Perfil criado automaticamente para sua empresa
   - Super_admin: Pode criar perfis do sistema ou de empresas

3. ✅ **Edição/Deleção:**

   - Perfis com `is_system_default=true` APENAS super_admin
   - Admin: Apenas perfis da sua empresa

4. ✅ **Validações:**

   - Nome único por empresa (constraint)
   - Ao menos 1 `screen_id`
   - Não deletar se houver usuários ativos
   - `screen_ids` devem existir e estar ativos

5. ✅ **Soft Delete:**
   - `deleted_at` em vez de DELETE físico

---

### ✅ MENUS

1. ✅ **Gestão:**

   - **APENAS super_admin** pode criar/editar/deletar menus
   - Admins de empresa ESCOLHEM menus existentes para seus perfis

2. ✅ **Validações:**

   - Rota única
   - `order_position` único por `parent_id`
   - Não deletar se houver perfis dependentes
   - Não deletar se houver submenus

3. ✅ **Toggle Status:**

   - Warning se há perfis usando o menu
   - `force=true` para ignorar warning

4. ✅ **Hierarquia:**
   - Suporte a `parent_id` (submenus)
   - Endpoint `/hierarchy` retorna estrutura completa

---

## 🎯 PRÓXIMOS PASSOS (OPCIONAL)

### Melhorias Futuras:

1. **Cache Redis:**

   - Cachear permissões do usuário (evitar query a cada request)
   - Invalidar cache ao alterar perfil

2. **Auditoria:**

   - Criar tabela `profile_audit_log`
   - Registrar quem alterou o quê

3. **Limites por Plano:**

   - Empresas "starter" limitadas a 3 perfis customizados
   - Campo `max_custom_profiles` em `companies`

4. **Herança de Perfis:**

   - Campo `parent_profile_id`
   - Permissões = pai + próprias

5. **Perfis com Expiração:**
   - Campo `expires_at`
   - Job cron para desativar automaticamente

---

## 🧪 TESTES

### Checklist de Testes Manuais:

#### Perfis:

- [ ] Super_admin cria perfil do sistema (company_id=NULL)
- [ ] Admin cria perfil da empresa (company_id auto-set)
- [ ] Admin NÃO consegue editar perfis do sistema
- [ ] Admin NÃO consegue deletar perfil com usuários ativos
- [ ] Validação de screen_ids inválidos
- [ ] Reassign de usuários entre perfis

#### Menus:

- [ ] Super_admin cria menu
- [ ] Admin NÃO consegue criar menu (403)
- [ ] Validação de rota duplicada
- [ ] Validação de order_position duplicada
- [ ] Toggle status com warning de perfis dependentes
- [ ] Reordenação de múltiplos menus
- [ ] Hierarquia completa (com submenus)

#### Middleware:

- [ ] `checkPermission()` bloqueia usuário sem permissão
- [ ] `isSuperAdmin()` bloqueia admin
- [ ] `checkAnyPermission()` aceita qualquer permissão válida
- [ ] Super_admin bypassa todos checks

---

## 📚 ARQUIVOS CRIADOS/MODIFICADOS

### Criados:

✅ `docs/fazer-no-backend/CREATE_PROFILES_MENUS_TABLES.sql` (corrigido)
✅ `src/models/Profile.js`
✅ `src/models/MenuItem.js`
✅ `src/controllers/ProfileController.js`
✅ `src/controllers/MenuItemController.js`
✅ `src/routes/profiles.js`
✅ `src/routes/menus.js`
✅ `src/middleware/checkPermission.js`
✅ `docs/fazer-no-backend/GUIA_IMPLEMENTACAO.md` (este arquivo)

### Modificados:

✅ `src/routes/index.js` (adicionadas rotas /profiles e /menu-items)

---

## ✅ CHECKLIST FINAL

- [x] ✅ SQL corrigido (ordem profiles → users.profile_id)
- [x] ✅ Soft delete (deleted_at) em profiles e menu_items
- [x] ✅ Model Profile.js com todos métodos
- [x] ✅ Model MenuItem.js com todos métodos
- [x] ✅ ProfileController.js com validações
- [x] ✅ MenuItemController.js com restrição super_admin
- [x] ✅ Routes profiles.js e menus.js
- [x] ✅ Middleware checkPermission.js
- [x] ✅ Integração no routes/index.js
- [x] ✅ Documentação completa

---

## 🎉 SISTEMA PRONTO PARA USO!

**Próximos passos:**

1. Executar SQL no banco
2. Testar endpoints com Postman/Insomnia
3. Integrar no frontend
4. (Opcional) Implementar melhorias futuras

---

**Desenvolvedor:** Leonardo Polo Pereira  
**Empresa:** POLO X Manutencao de Equipamentos de Informatica LTDA  
**Data:** 2025-11-07

**© 2025 POLO X - Todos os direitos reservados**
