# Migration 043 - Campo root_only_access nos Menu Items

## 📋 Resumo

Adiciona controle de acesso exclusivo para usuários root nos itens de menu através do campo `root_only_access`.

## 🎯 Objetivo

Permitir que determinados menus sejam visíveis e acessíveis **apenas para usuários root/administradores**, criando uma camada adicional de segurança para funcionalidades administrativas sensíveis.

## 🗄️ Alterações no Banco de Dados

### Nova Coluna

```sql
ALTER TABLE polox.menu_items
ADD COLUMN root_only_access BOOLEAN NOT NULL DEFAULT false;
```

- **Tipo**: `BOOLEAN`
- **Default**: `false`
- **NOT NULL**: Sim
- **Descrição**: Define se o menu é visível apenas para usuários root

### Índice

```sql
CREATE INDEX idx_menu_items_root_only_access
ON polox.menu_items(root_only_access)
WHERE deleted_at IS NULL;
```

Otimiza consultas filtrando por acesso root (apenas registros ativos).

## 📝 Estrutura da Tabela Atualizada

```sql
CREATE TABLE polox.menu_items (
  id bigserial PRIMARY KEY,
  label varchar(255) NOT NULL,
  translations jsonb DEFAULT '{}'::jsonb NOT NULL,
  icon varchar(100) NULL,
  route varchar(255) NULL,
  parent_id int8 NULL,
  order_position int4 DEFAULT 0 NOT NULL,
  visible_to_all bool DEFAULT true NOT NULL,
  root_only_access bool DEFAULT false NOT NULL,  -- ✨ NOVO
  is_active bool DEFAULT true NOT NULL,
  deleted_at timestamptz NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  svg_color varchar(7) NULL,
  background_color varchar(7) NULL,
  text_color varchar(7) NULL,
  -- constraints...
);
```

## 🔧 Alterações na API

### 1. Controller (`MenuItemController.js`)

#### Schema de Criação (POST)

```javascript
static createSchema = Joi.object({
  // ... campos existentes
  root_only_access: Joi.boolean().optional(),
});
```

#### Schema de Atualização (PUT)

```javascript
static updateSchema = Joi.object({
  // ... campos existentes
  root_only_access: Joi.boolean().optional(),
});
```

### 2. Model (`MenuItem.js`)

#### Queries SELECT atualizadas

Todas as queries SELECT agora incluem `root_only_access`:

- `findAll()`
- `findById()`
- `findByRoute()`

#### Query INSERT atualizada

```javascript
INSERT INTO polox.menu_items (
  label, icon, route, translations, order_position,
  parent_id, is_active, visible_to_all, root_only_access,
  svg_color, background_color, text_color,
  created_at, updated_at
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
```

#### Campos permitidos para UPDATE

```javascript
const allowedFields = {
  // ... campos existentes
  root_only_access: "root_only_access",
};
```

### 3. Routes/Swagger (`menus.js`)

#### Documentação POST `/menu-items`

```yaml
root_only_access:
  type: boolean
  default: false
  example: false
  description: "Define se o menu é visível apenas para usuários root/administradores"
```

#### Documentação PUT `/menu-items/{id}`

```yaml
root_only_access:
  type: boolean
  description: "Define se o menu é visível apenas para usuários root/administradores"
  example: false
```

#### Novos Exemplos no Swagger

**POST - Menu Principal:**

```json
{
  "label": "Analytics",
  "translations": {
    "pt-BR": "Analytics",
    "en-US": "Analytics",
    "es-ES": "Analytics"
  },
  "icon": "BarChart",
  "route": "/analytics",
  "parent_id": null,
  "order_position": 100,
  "visible_to_all": true,
  "is_active": true,
  "root_only_access": false // ✨ NOVO
}
```

**POST - Submenu Restrito:**

```json
{
  "label": "API Keys",
  "translations": {
    "pt-BR": "Chaves de API",
    "en-US": "API Keys",
    "es-ES": "Claves de API"
  },
  "icon": "Key",
  "route": "/settings/api-keys",
  "parent_id": 1,
  "order_position": 50,
  "visible_to_all": false,
  "is_active": true,
  "root_only_access": true // ✅ Apenas root pode ver
}
```

**PUT - Tornar Menu Exclusivo para Root:**

```json
{
  "root_only_access": true
}
```

## 🚀 Como Usar

### Criar Menu Exclusivo para Root

```bash
POST /api/menu-items
Content-Type: application/json
Authorization: Bearer {token}

{
  "label": "Logs do Sistema",
  "translations": {
    "pt-BR": "Logs do Sistema",
    "en-US": "System Logs",
    "es-ES": "Registros del Sistema"
  },
  "icon": "Terminal",
  "route": "/admin/logs",
  "parent_id": null,
  "order_position": 999,
  "visible_to_all": true,
  "is_active": true,
  "root_only_access": true
}
```

### Atualizar Menu Existente para Root Only

```bash
PUT /api/menu-items/15
Content-Type: application/json
Authorization: Bearer {token}

{
  "root_only_access": true
}
```

### Remover Restrição Root

```bash
PUT /api/menu-items/15
Content-Type: application/json
Authorization: Bearer {token}

{
  "root_only_access": false
}
```

## 🔍 Consultas SQL Úteis

### Listar todos os menus exclusivos para root

```sql
SELECT id, label, route, translations->>'pt-BR' as label_pt
FROM polox.menu_items
WHERE root_only_access = true
  AND deleted_at IS NULL
ORDER BY order_position;
```

### Verificar menus visíveis para não-root

```sql
SELECT id, label, route, visible_to_all, root_only_access
FROM polox.menu_items
WHERE root_only_access = false
  AND deleted_at IS NULL
ORDER BY order_position;
```

### Contar menus por tipo de acesso

```sql
SELECT
  root_only_access,
  COUNT(*) as total,
  COUNT(CASE WHEN is_active THEN 1 END) as ativos
FROM polox.menu_items
WHERE deleted_at IS NULL
GROUP BY root_only_access;
```

## 🎯 Casos de Uso

1. **Menus Administrativos Sensíveis**

   - Logs do sistema
   - Configurações críticas
   - Backup/Restore
   - Gerenciamento de licenças

2. **Menus de Debug**

   - Console de desenvolvimento
   - Ferramentas de diagnóstico
   - Métricas internas

3. **Funcionalidades Super Admin**
   - Gerenciamento de empresas
   - Configurações globais
   - Migrações de dados

## ⚠️ Importante

- Apenas usuários com `role = 'super_admin'` devem criar/editar menus com `root_only_access = true`
- O frontend deve respeitar este campo ao renderizar o menu
- A lógica de autorização no backend deve verificar este campo antes de permitir acesso às rotas

## 📦 Arquivos Modificados

1. ✅ `migrations/043_add_root_only_access_to_menu_items.js`
2. ✅ `src/controllers/MenuItemController.js`
3. ✅ `src/models/MenuItem.js`
4. ✅ `src/routes/menus.js`

## 🧪 Testes Recomendados

1. ✅ Criar menu com `root_only_access: true`
2. ✅ Criar menu com `root_only_access: false`
3. ✅ Atualizar menu existente para `root_only_access: true`
4. ✅ Verificar listagem inclui o campo
5. ✅ Testar busca por ID retorna o campo
6. ✅ Validar que frontend filtra menus root corretamente

## 🔄 Rollback

Para reverter esta migration:

```bash
npm run migrate:down
```

A migration irá:

1. Remover o índice `idx_menu_items_root_only_access`
2. Remover a coluna `root_only_access`

---

**Data de Criação**: 08/11/2025  
**Migration**: 043  
**Status**: ✅ Implementado
