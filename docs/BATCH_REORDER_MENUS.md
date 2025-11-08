# 🔄 Batch Reorder - Reordenação de Menus em Lote

## 🎯 TL;DR - Quick Start

```bash
# 1️⃣ Busque os menus atuais (SEMPRE FAÇA ISSO PRIMEIRO!)
GET /api/v1/menu-items

# 2️⃣ Anote os parent_id de cada menu
# Exemplo:
# Menu 1: parent_id = null
# Menu 2: parent_id = null
# Menu 3: parent_id = 2  ← submenu!

# 3️⃣ Agrupe por parent_id e reordene
POST /api/v1/menu-items/batch-reorder
{
  "updates": [
    {
      "parent_id": null,
      "menus": [
        { "id": 1, "order_position": 1 },
        { "id": 2, "order_position": 2 }
        // ❌ NÃO inclua menu 3 aqui! (parent_id diferente)
      ]
    },
    {
      "parent_id": 2,  // ✅ Menu 3 vai aqui
      "menus": [
        { "id": 3, "order_position": 1 }
      ]
    }
  ]
}
```

⚠️ **REGRA DE OURO:** Só agrupe menus com o **mesmo** `parent_id`!

---

## � Índice

- [Visão Geral](#-visão-geral)
- [Como Usar](#-como-usar)
- [Payload](#-payload)
- [Exemplos de Uso](#-exemplos-de-uso)
- [Resposta](#-resposta)
- [Validações](#-validações)
- [Comparação: /reorder vs /batch-reorder](#-comparação-reorder-vs-batch-reorder)
- [Como Testar no Swagger](#-como-testar-no-swagger)
- [Integração com Frontend](#-integração-com-frontend)
- [Casos de Uso](#-casos-de-uso)
- [Performance](#-performance)
- [Troubleshooting](#-troubleshooting---erros-comuns)

---

## �📋 Visão Geral

O endpoint **POST /api/v1/menu-items/batch-reorder** foi criado para resolver problemas de reordenação de menus de forma **atômica e segura**.

## ❌ Problema Anterior

Com o endpoint `/reorder` individual, ao reordenar menus você poderia enfrentar:

```
❌ Conflito de constraint unique (parent_id, order_position)
❌ Estado inconsistente se uma atualização falhar
❌ Múltiplas chamadas HTTP necessárias
❌ Performance ruim com muitos menus
```

## ✅ Solução: Batch Reorder

### Vantagens

- **✅ Transação Atômica** - Ou tudo funciona, ou nada funciona (rollback automático)
- **✅ Sem Conflitos** - Todas as atualizações acontecem de uma vez
- **✅ Performance** - Uma única chamada HTTP
- **✅ Múltiplos Níveis** - Reordena menus raiz e submenus simultaneamente
- **✅ Validação Completa** - Verifica tudo antes de aplicar

---

## 🚀 Como Usar

### Endpoint

```
POST /api/v1/menu-items/batch-reorder
```

### Autenticação

```
Authorization: Bearer <jwt_token>
```

**⚠️ APENAS super_admin pode usar este endpoint**

---

## 📝 Payload

### Estrutura Básica

```json
{
  "updates": [
    {
      "parent_id": null, // ou ID do menu pai
      "menus": [
        { "id": 1, "order_position": 1 },
        { "id": 2, "order_position": 2 },
        { "id": 3, "order_position": 3 }
      ]
    }
  ]
}
```

### Campo `updates` (array, obrigatório)

Array com grupos de menus a serem reordenados.

| Campo       | Tipo            | Obrigatório | Descrição                                  |
| ----------- | --------------- | ----------- | ------------------------------------------ |
| `parent_id` | integer ou null | Não         | ID do menu pai. Use `null` para menus raiz |
| `menus`     | array           | Sim         | Lista de menus com novas posições          |

### Campo `menus` (array de objetos)

| Campo            | Tipo    | Obrigatório | Descrição          |
| ---------------- | ------- | ----------- | ------------------ |
| `id`             | integer | Sim         | ID do menu         |
| `order_position` | integer | Sim         | Nova posição (≥ 0) |

---

## 📚 Exemplos de Uso

### ⚠️ IMPORTANTE: Respeite a Hierarquia

**Você só pode reordenar menus que já pertencem ao mesmo `parent_id`!**

❌ **ERRO COMUM:**

```json
{
  "parent_id": null, // ← Tentando mover menu que tem parent_id diferente
  "menus": [
    { "id": 1, "order_position": 1 }, // OK - parent_id: null
    { "id": 3, "order_position": 2 } // ❌ ERRO - parent_id: 2 (não é null!)
  ]
}
```

**Erro retornado:**

```json
{
  "success": false,
  "message": "Menu 3 pertence a parent_id 2, mas foi enviado no grupo com parent_id null",
  "code": "VALIDATION_ERROR"
}
```

✅ **CORRETO:** Primeiro consulte os menus para saber seus `parent_id`:

```bash
# GET /api/v1/menu-items
[
  { "id": 1, "label": "Dashboard", "parent_id": null },
  { "id": 2, "label": "Contatos", "parent_id": null },
  { "id": 3, "label": "Leads", "parent_id": 2 },      // ← submenu de Contatos
  { "id": 4, "label": "Vendas", "parent_id": null }
]
```

---

### Exemplo 1: Reordenar Apenas Menus Raiz

```json
{
  "updates": [
    {
      "parent_id": null,
      "menus": [
        { "id": 2, "order_position": 1 },
        { "id": 4, "order_position": 2 },
        { "id": 1, "order_position": 3 }
      ]
    }
  ]
}
```

**Antes:**

```
1. Dashboard (id: 1, parent_id: null)
2. Contatos (id: 2, parent_id: null)
3. Vendas (id: 4, parent_id: null)
```

**Depois:**

```
1. Contatos (id: 2, parent_id: null)
2. Vendas (id: 4, parent_id: null)
3. Dashboard (id: 1, parent_id: null)
```

> 💡 Note que só incluímos menus com `parent_id: null`

---

### Exemplo 2: Reordenar Menus Raiz + Submenus

```json
{
  "updates": [
    {
      "parent_id": null,
      "menus": [
        { "id": 1, "order_position": 1 },
        { "id": 2, "order_position": 2 },
        { "id": 3, "order_position": 3 }
      ]
    },
    {
      "parent_id": 2,
      "menus": [
        { "id": 5, "order_position": 2 },
        { "id": 6, "order_position": 1 }
      ]
    }
  ]
}
```

Isso reordena:

- Menus de nível 1 (raiz)
- Submenus do menu ID 2

---

### Exemplo 3: Múltiplos Níveis Hierárquicos

```json
{
  "updates": [
    {
      "parent_id": null,
      "menus": [
        { "id": 1, "order_position": 1 },
        { "id": 2, "order_position": 2 }
      ]
    },
    {
      "parent_id": 1,
      "menus": [
        { "id": 10, "order_position": 1 },
        { "id": 11, "order_position": 2 }
      ]
    },
    {
      "parent_id": 2,
      "menus": [
        { "id": 20, "order_position": 1 },
        { "id": 21, "order_position": 2 },
        { "id": 22, "order_position": 3 }
      ]
    }
  ]
}
```

---

## 📤 Resposta

### Sucesso (200 OK)

```json
{
  "success": true,
  "message": "Menus reordenados em lote com sucesso",
  "data": {
    "root": [
      {
        "id": 1,
        "label": "Dashboard",
        "order_position": 1,
        "parent_id": null
      },
      {
        "id": 2,
        "label": "Contatos",
        "order_position": 2,
        "parent_id": null
      }
    ],
    "2": [
      {
        "id": 5,
        "label": "Leads",
        "order_position": 1,
        "parent_id": 2
      },
      {
        "id": 6,
        "label": "Clientes",
        "order_position": 2,
        "parent_id": 2
      }
    ]
  }
}
```

**Estrutura do `data`:**

- Chave `"root"` = menus com `parent_id: null`
- Chave numérica = menus com aquele `parent_id`

---

### Erro de Validação (400 Bad Request)

```json
{
  "success": false,
  "message": "Menu 5 pertence a parent_id 3, mas foi enviado no grupo com parent_id 2",
  "code": "VALIDATION_ERROR"
}
```

---

### Erro de Permissão (403 Forbidden)

```json
{
  "success": false,
  "message": "Acesso de Super Admin necessário",
  "code": "FORBIDDEN"
}
```

---

### Erro: Menu Não Encontrado (404 Not Found)

```json
{
  "success": false,
  "message": "Esperado 3 menus, mas encontrado 2",
  "code": "NOT_FOUND"
}
```

---

## 🔒 Validações

O endpoint faz as seguintes validações:

### 1. **Estrutura do Payload**

- ✅ `updates` deve ser um array não vazio
- ✅ Cada item deve ter `menus` (array)
- ✅ Cada menu deve ter `id` e `order_position`

### 2. **Valores**

- ✅ `order_position` deve ser inteiro ≥ 0
- ✅ `id` deve ser inteiro

### 3. **Existência**

- ✅ Todos os menus devem existir no banco
- ✅ Menus não deletados (`deleted_at IS NULL`)

### 4. **Hierarquia**

- ✅ Cada menu está no `parent_id` correto
- ✅ Não há conflito de hierarquia

### 5. **Permissão**

- ✅ Usuário é `super_admin`

---

## 🔄 Rollback Automático

Se **qualquer** validação falhar ou erro ocorrer:

```
BEGIN TRANSACTION
  ❌ Erro encontrado
ROLLBACK  ← Nenhuma mudança é aplicada
```

---

## 🆚 Comparação: `/reorder` vs `/batch-reorder`

| Característica        | `/reorder`            | `/batch-reorder` |
| --------------------- | --------------------- | ---------------- |
| **Transação Atômica** | ❌ Não                | ✅ Sim           |
| **Evita Conflitos**   | ❌ Pode ter           | ✅ Sim           |
| **Múltiplos Níveis**  | ❌ Não                | ✅ Sim           |
| **Performance**       | ⚠️ Múltiplas chamadas | ✅ Uma chamada   |
| **Rollback**          | ❌ Manual             | ✅ Automático    |
| **Recomendado**       | ❌ Legado             | ✅ **USE ESTE**  |

---

## 🧪 Exemplo com cURL

```bash
curl -X POST http://localhost:3000/api/v1/menu-items/batch-reorder \
  -H "Authorization: Bearer SEU_TOKEN_AQUI" \
  -H "Content-Type: application/json" \
  -H "Accept-Language: pt" \
  -d '{
    "updates": [
      {
        "parent_id": null,
        "menus": [
          { "id": 1, "order_position": 2 },
          { "id": 2, "order_position": 1 },
          { "id": 3, "order_position": 3 }
        ]
      }
    ]
  }'
```

---

## 🧩 Integração com Frontend

### React/Vue/Angular

```javascript
async function batchReorderMenus(updates) {
  const response = await fetch("/api/v1/menu-items/batch-reorder", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "Accept-Language": "pt",
    },
    body: JSON.stringify({ updates }),
  });

  if (!response.ok) {
    throw new Error("Falha ao reordenar menus");
  }

  return response.json();
}

// Uso:
const updates = [
  {
    parent_id: null,
    menus: [
      { id: 1, order_position: 1 },
      { id: 2, order_position: 2 },
      { id: 3, order_position: 3 },
    ],
  },
];

try {
  const result = await batchReorderMenus(updates);
  console.log("✅ Menus reordenados:", result.data);
} catch (error) {
  console.error("❌ Erro:", error.message);
}
```

---

## 🎯 Casos de Uso

### 1. Preparar Payload Correto (SEMPRE FAÇA ISSO PRIMEIRO!)

**Passo 1: Buscar estrutura atual**

```javascript
async function getCurrentMenuStructure() {
  const response = await fetch("/api/v1/menu-items", {
    headers: {
      Authorization: `Bearer ${token}`,
      "Accept-Language": "pt",
    },
  });

  const { data } = await response.json();
  return data; // Array de menus
}

// Resultado:
// [
//   { id: 1, label: "Dashboard", parent_id: null, order_position: 1 },
//   { id: 2, label: "Contatos", parent_id: null, order_position: 2 },
//   { id: 3, label: "Leads", parent_id: 2, order_position: 1 },
//   { id: 4, label: "Clientes", parent_id: 2, order_position: 2 }
// ]
```

**Passo 2: Agrupar por `parent_id`**

```javascript
function groupMenusByParentId(menus) {
  const grouped = {};

  menus.forEach((menu) => {
    const key = menu.parent_id === null ? "root" : menu.parent_id;
    if (!grouped[key]) {
      grouped[key] = [];
    }
    grouped[key].push(menu);
  });

  return grouped;
}

// Resultado:
// {
//   "root": [
//     { id: 1, label: "Dashboard", parent_id: null },
//     { id: 2, label: "Contatos", parent_id: null }
//   ],
//   "2": [
//     { id: 3, label: "Leads", parent_id: 2 },
//     { id: 4, label: "Clientes", parent_id: 2 }
//   ]
// }
```

**Passo 3: Montar payload de reordenação**

```javascript
function buildReorderPayload(groupedMenus) {
  const updates = [];

  for (const [parentKey, menus] of Object.entries(groupedMenus)) {
    const parent_id = parentKey === "root" ? null : parseInt(parentKey);

    updates.push({
      parent_id,
      menus: menus.map((menu, index) => ({
        id: menu.id,
        order_position: index + 1, // Recalcular posições
      })),
    });
  }

  return { updates };
}

// Resultado:
// {
//   "updates": [
//     {
//       "parent_id": null,
//       "menus": [
//         { "id": 1, "order_position": 1 },
//         { "id": 2, "order_position": 2 }
//       ]
//     },
//     {
//       "parent_id": 2,
//       "menus": [
//         { "id": 3, "order_position": 1 },
//         { "id": 4, "order_position": 2 }
//       ]
//     }
//   ]
// }
```

---

### 2. Drag & Drop no Frontend (COMPLETO)

Quando usuário arrasta menus para reordenar:

```javascript
// Ao finalizar drag & drop
async function onDragEnd(result) {
  if (!result.destination) return;

  // 1. Buscar estrutura atual
  const currentMenus = await getCurrentMenuStructure();

  // 2. Aplicar mudança do drag & drop
  const reorderedMenus = reorderArray(
    currentMenus,
    result.source.index,
    result.destination.index
  );

  // 3. Agrupar por parent_id
  const grouped = groupMenusByParentId(reorderedMenus);

  // 4. Construir payload
  const payload = buildReorderPayload(grouped);

  // 5. Enviar para API
  try {
    await batchReorderMenus(payload.updates);
    console.log("✅ Menus reordenados com sucesso!");
  } catch (error) {
    console.error("❌ Erro ao reordenar:", error.message);
    // Reverter mudança visual
  }
}
```

### 3. Import/Export de Configuração

Importar estrutura de menus de outra empresa:

```javascript
const importedStructure = loadFromFile();
await batchReorderMenus(importedStructure);
```

### 4. Reset para Ordem Padrão

```javascript
const defaultOrder = [
  {
    parent_id: null,
    menus: [
      { id: 1, order_position: 1 },
      { id: 2, order_position: 2 },
      { id: 3, order_position: 3 },
    ],
  },
];

await batchReorderMenus(defaultOrder);
```

---

## 🧪 Como Testar no Swagger

### Passo 1: Obter Token de Autenticação

1. Acesse `http://localhost:3000/api/v1/docs`
2. Encontre **POST /auth/login**
3. Execute com credenciais de super_admin:
   ```json
   {
     "email": "seu-super-admin@empresa.com",
     "password": "sua-senha"
   }
   ```
4. Copie o token JWT retornado

### Passo 2: Autorizar no Swagger

1. Clique no botão **🔓 Authorize** (canto superior direito)
2. Cole o token no campo `Value`:
   ```
   Bearer SEU_TOKEN_AQUI
   ```
3. Clique em **Authorize** e depois **Close**

### Passo 3: Buscar Menus Atuais

1. Encontre **GET /menu-items**
2. Clique em **Try it out**
3. Execute
4. **IMPORTANTE:** Anote os IDs e `parent_id` de cada menu!

**Exemplo de resposta:**

```json
{
  "data": [
    { "id": 1, "label": "Dashboard", "parent_id": null, "order_position": 1 },
    { "id": 2, "label": "Contatos", "parent_id": null, "order_position": 2 },
    { "id": 3, "label": "Leads", "parent_id": 2, "order_position": 1 }
  ]
}
```

### Passo 4: Montar Payload Corretamente

✅ **Use APENAS menus com o mesmo `parent_id` em cada grupo:**

```json
{
  "updates": [
    {
      "parent_id": null,
      "menus": [
        { "id": 1, "order_position": 2 },
        { "id": 2, "order_position": 1 }
      ]
    },
    {
      "parent_id": 2,
      "menus": [{ "id": 3, "order_position": 1 }]
    }
  ]
}
```

### Passo 5: Executar Batch Reorder

1. Encontre **POST /menu-items/batch-reorder**
2. Clique em **Try it out**
3. Selecione **Accept-Language**: `pt`
4. Cole o payload JSON
5. Clique em **Execute**

### Passo 6: Verificar Resultado

✅ **Sucesso (200):**

```json
{
  "success": true,
  "message": "Menus reordenados em lote com sucesso",
  "data": {
    "root": [...],  // Menus com parent_id: null
    "2": [...]      // Menus com parent_id: 2
  }
}
```

❌ **Erro (422):**

```json
{
  "success": false,
  "message": "Menu 3 pertence a parent_id 2, mas foi enviado no grupo com parent_id null"
}
```

→ **Solução:** Verifique os `parent_id` no Passo 3 e corrija o payload!

---

## ⚡ Performance

### Comparação de Chamadas

**Reordenar 20 menus:**

| Método                 | Chamadas HTTP | Tempo Aprox. |
| ---------------------- | ------------- | ------------ |
| Individual `/reorder`  | 20            | ~2-4s        |
| Batch `/batch-reorder` | 1             | ~0.2s        |

**Ganho: 10-20x mais rápido! 🚀**

---

## 🔍 Debugging

### Logs do Backend

```javascript
// Model
console.log("📦 Batch Reorder:", updates.length, "grupos");

// Validação
console.log("✅ Todos os", allIds.length, "menus existem");

// Transação
console.log("🔄 BEGIN TRANSACTION");
console.log("✅ COMMIT");
// ou
console.log("❌ ROLLBACK");
```

---

## 📖 Documentação Swagger

Acesse: `http://localhost:3000/api/v1/docs`

Procure por: **POST /menu-items/batch-reorder**

Você verá:

- 📘 Descrição completa
- 📝 Schema do payload
- 🎯 Exemplos interativos
- 📤 Respostas esperadas

---

## 🚨 Importante

1. **Sempre valide no frontend antes de enviar**

   - Verifique se IDs existem
   - Valide `order_position` >= 0
   - Agrupe corretamente por `parent_id`

2. **Rollback automático**

   - Se algo falhar, NADA é aplicado
   - Seguro para usar em produção

3. **Apenas super_admin**
   - Endpoint protegido
   - Retorna 403 se não for super_admin

---

## 🚨 Troubleshooting - Erros Comuns

### ❌ Erro 422: "Menu X pertence a parent_id Y, mas foi enviado no grupo com parent_id Y"

**Causa:** Bug de comparação de tipos (string vs number) na validação. **JÁ CORRIGIDO!** ✅

**Sintomas:**

```json
{
  "message": "Menu 7 pertence a parent_id 6, mas foi enviado no grupo com parent_id 6"
}
```

Note que os `parent_id` são **iguais** (6 = 6), mas ainda assim dá erro!

**✅ Solução Implementada no Backend:**

A validação agora normaliza ambos os valores antes de comparar:

```javascript
// Antes (bugado):
if (actualParentId !== expectedParentId) // ❌ Falha com tipos diferentes

// Depois (corrigido):
const normalizedActual = actualParentId === null ? null : parseInt(actualParentId, 10);
const normalizedExpected = expectedParentId === null ? null : parseInt(expectedParentId, 10);
if (normalizedActual !== normalizedExpected) // ✅ Compara corretamente
```

**Ação:** Reinicie o servidor backend e tente novamente!

---

### ❌ Erro: "Menu X pertence a parent_id Y, mas foi enviado no grupo com parent_id Z" (Y ≠ Z)

**Causa:** Você tentou reordenar um menu no grupo errado (parent_id realmente diferente).

**Solução:**

1. **Consulte a estrutura atual dos menus:**

   ```bash
   GET /api/v1/menu-items
   ```

2. **Verifique o `parent_id` de cada menu:**

   ```json
   [
     { "id": 1, "parent_id": null }, // Menu raiz
     { "id": 2, "parent_id": null }, // Menu raiz
     { "id": 3, "parent_id": 2 } // Submenu de 2
   ]
   ```

3. **Agrupe corretamente por `parent_id`:**
   ```json
   {
     "updates": [
       {
         "parent_id": null,
         "menus": [
           { "id": 1, "order_position": 1 },
           { "id": 2, "order_position": 2 }
           // ❌ NÃO inclua menu 3 aqui!
         ]
       },
       {
         "parent_id": 2, // ✅ Menu 3 vai aqui
         "menus": [{ "id": 3, "order_position": 1 }]
       }
     ]
   }
   ```

---

### ❌ Erro 500: "Cannot read properties of undefined (reading 'connect')"

**Causa:** Bug no acesso ao pool de conexões do banco de dados. **JÁ CORRIGIDO!** ✅

**Sintomas:**

```json
{
  "code": "INTERNAL_ERROR",
  "message": "Cannot read properties of undefined (reading 'connect')"
}
```

**✅ Solução Implementada:**

Corrigido o acesso ao pool de conexões:

```javascript
// Antes (bugado):
const client = await require("../config/database").pool.connect(); // ❌

// Depois (corrigido):
const db = require("../config/database");
const pool = db.getPool(); // ✅ Usa a função exportada
const client = await pool.connect();
```

**Ação:** Reinicie o servidor backend!

---

### ❌ Erro: "Esperado X menus, mas encontrado Y"

**Causa:** Um ou mais IDs de menus não existem no banco de dados.

**Solução:**

1. Verifique se os IDs estão corretos
2. Consulte `GET /api/v1/menu-items` para obter IDs válidos
3. Remova IDs inexistentes do payload

---

### ❌ Erro 403: "Acesso de Super Admin necessário"

**Causa:** Usuário não tem role `super_admin`.

**Solução:**

- Apenas usuários com `role: "super_admin"` podem reordenar menus
- Verifique o token JWT para confirmar a role
- Se necessário, peça acesso a um super_admin

---

### ❌ Erro 500: "duplicate key value violates unique constraint"

**Causa:** Conflito de constraint unique durante a reordenação. **JÁ CORRIGIDO!** ✅

**Sintomas:**

```json
{
  "code": "INTERNAL_ERROR",
  "message": "duplicate key value violates unique constraint \"idx_menu_items_order\"",
  "detail": "Key (order_position, COALESCE(parent_id, 0::bigint))=(1, 2) already exists."
}
```

**Problema Técnico:**

Ao atualizar múltiplos menus sequencialmente, pode ocorrer:

```sql
-- Situação inicial:
-- Menu 3: order_position = 1, parent_id = 2
-- Menu 5: order_position = 2, parent_id = 2

-- Tentativa de inversão:
UPDATE menu_items SET order_position = 2 WHERE id = 3; -- OK
UPDATE menu_items SET order_position = 1 WHERE id = 5; -- ❌ ERRO!
-- Menu 3 já tem position = 1 no parent_id = 2
```

**✅ Solução Implementada (Algoritmo de 2 Etapas):**

```javascript
// ETAPA 1: Mover para posições temporárias negativas
UPDATE menu_items SET order_position = -1 WHERE id = 3;
UPDATE menu_items SET order_position = -2 WHERE id = 5;

// ETAPA 2: Aplicar posições finais (sem conflito!)
UPDATE menu_items SET order_position = 2 WHERE id = 3;
UPDATE menu_items SET order_position = 1 WHERE id = 5;
```

**Ação:** Reinicie o servidor backend e tente novamente!

---

### ❌ Erro 422: Constraint Violation (Payload Inválido)

**Causa:** Payload enviado tem posições duplicadas no mesmo grupo.

**Solução:**

- Verifique se não há `order_position` duplicadas no mesmo grupo
- Garanta que cada menu tenha uma posição única dentro do seu `parent_id`

**Exemplo incorreto:**

```json
{
  "parent_id": null,
  "menus": [
    { "id": 1, "order_position": 1 },
    { "id": 2, "order_position": 1 } // ❌ Duplicado!
  ]
}
```

**Correto:**

```json
{
  "parent_id": null,
  "menus": [
    { "id": 1, "order_position": 1 },
    { "id": 2, "order_position": 2 } // ✅ Único
  ]
}
```

---

## 🎬 Fluxo Completo - Do Início ao Fim

### Cenário: Reordenar menus via Swagger

```
┌─────────────────────────────────────────────────────────────────┐
│ 1️⃣ FAZER LOGIN (POST /auth/login)                              │
├─────────────────────────────────────────────────────────────────┤
│ Request:                                                         │
│ {                                                                │
│   "email": "super@admin.com",                                    │
│   "password": "senha123"                                         │
│ }                                                                │
│                                                                  │
│ Response:                                                        │
│ {                                                                │
│   "token": "eyJhbGciOiJIUzI1NiIs..."                            │
│ }                                                                │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ 2️⃣ AUTORIZAR NO SWAGGER (Botão � Authorize)                   │
├─────────────────────────────────────────────────────────────────┤
│ Cole: Bearer eyJhbGciOiJIUzI1NiIs...                            │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ 3️⃣ BUSCAR MENUS ATUAIS (GET /menu-items)                       │
├─────────────────────────────────────────────────────────────────┤
│ Response:                                                        │
│ {                                                                │
│   "data": [                                                      │
│     { "id": 1, "label": "Dashboard", "parent_id": null },       │
│     { "id": 2, "label": "Contatos", "parent_id": null },        │
│     { "id": 3, "label": "Leads", "parent_id": 2 },    ← ⚠️     │
│     { "id": 4, "label": "Vendas", "parent_id": null }           │
│   ]                                                              │
│ }                                                                │
│                                                                  │
│ 💡 ATENÇÃO: Menu 3 tem parent_id = 2 (submenu de Contatos!)    │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ 4️⃣ AGRUPAR POR parent_id                                        │
├─────────────────────────────────────────────────────────────────┤
│ Grupo 1 (parent_id: null) - Menus raiz:                        │
│   • Menu 1 - Dashboard                                          │
│   • Menu 2 - Contatos                                           │
│   • Menu 4 - Vendas                                             │
│                                                                  │
│ Grupo 2 (parent_id: 2) - Submenus de Contatos:                 │
│   • Menu 3 - Leads                                              │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ 5️⃣ MONTAR PAYLOAD (POST /menu-items/batch-reorder)            │
├─────────────────────────────────────────────────────────────────┤
│ {                                                                │
│   "updates": [                                                   │
│     {                                                            │
│       "parent_id": null,  ← Grupo 1                             │
│       "menus": [                                                 │
│         { "id": 4, "order_position": 1 },  // Vendas primeiro   │
│         { "id": 2, "order_position": 2 },  // Contatos segundo  │
│         { "id": 1, "order_position": 3 }   // Dashboard terceiro│
│       ]                                                          │
│     },                                                           │
│     {                                                            │
│       "parent_id": 2,  ← Grupo 2 (submenus de Contatos)         │
│       "menus": [                                                 │
│         { "id": 3, "order_position": 1 }                         │
│       ]                                                          │
│     }                                                            │
│   ]                                                              │
│ }                                                                │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ 6️⃣ EXECUTAR E VERIFICAR RESPOSTA                               │
├─────────────────────────────────────────────────────────────────┤
│ ✅ Sucesso (200 OK):                                            │
│ {                                                                │
│   "success": true,                                               │
│   "message": "Menus reordenados em lote com sucesso",           │
│   "data": {                                                      │
│     "root": [                                                    │
│       { "id": 4, "order_position": 1 },                          │
│       { "id": 2, "order_position": 2 },                          │
│       { "id": 1, "order_position": 3 }                           │
│     ],                                                           │
│     "2": [                                                       │
│       { "id": 3, "order_position": 1 }                           │
│     ]                                                            │
│   }                                                              │
│ }                                                                │
│                                                                  │
│ Nova ordem:                                                      │
│ 1. Vendas                                                        │
│ 2. Contatos                                                      │
│    └── 2.1 Leads                                                │
│ 3. Dashboard                                                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## �📚 Veja Também

- [GUIA_IMPLEMENTACAO_4_CONTROLLERS.md](./GUIA_IMPLEMENTACAO_4_CONTROLLERS.md)
- [STATUS_TRADUCOES_CONTROLLERS.md](./STATUS_TRADUCOES_CONTROLLERS.md)
- [SWAGGER_MULTI_IDIOMAS_COMPANIES.md](./SWAGGER_MULTI_IDIOMAS_COMPANIES.md)

---

## ✅ Conclusão

O endpoint **batch-reorder** é a forma **recomendada e segura** de reordenar menus.

### ✅ Checklist Final:

- [ ] Sempre busque os menus atuais primeiro (`GET /menu-items`)
- [ ] Anote o `parent_id` de cada menu
- [ ] Agrupe menus **apenas** por `parent_id` igual
- [ ] Valide o payload antes de enviar
- [ ] Use token de **super_admin**
- [ ] Teste no Swagger antes de integrar

**Use sempre este endpoint ao invés do `/reorder` individual!**

🎉 Happy coding!
