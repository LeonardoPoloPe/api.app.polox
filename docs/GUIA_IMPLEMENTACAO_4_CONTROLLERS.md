# 🚀 Guia de Implementação - 4 Novos Controllers

**Controllers:** ProductController, SaleController, TicketController, UserController  
**Data:** 25 de outubro de 2025  
**Status:** ✅ JSON Criados | ⏳ Aguardando Implementação nos Controllers

---

## 📋 Checklist de Implementação

### ✅ Passos Completados

- [x] Criar arquivos JSON (pt, en, es) para os 4 controllers
- [x] Validar sintaxe de todos os JSON
- [x] Registrar namespaces no `i18n.js`
- [x] Documentar estrutura das traduções

### ⏳ Próximos Passos

- [ ] Implementar `tc()` no ProductController
- [ ] Implementar `tc()` no SaleController
- [ ] Implementar `tc()` no TicketController
- [ ] Implementar `tc()` no UserController
- [ ] Testar endpoints nos 3 idiomas
- [ ] Criar documentação detalhada de cada controller

---

## 🔧 Como Implementar em Cada Controller

### **1. ProductController**

#### Passo 1: Adicionar import
```javascript
const { tc } = require("../config/i18n");
```

#### Passo 2: Criar método validateWithTranslation()
```javascript
static validateWithTranslation(req, schema, data) {
  const { error, value } = schema.validate(data);
  if (error) {
    const errorDetail = error.details[0];
    const field = errorDetail.path.join(".");
    const type = errorDetail.type;

    const errorKeyMap = {
      "string.min": "validation.name_min_length",
      "string.max": "validation.name_max_length",
      "any.required": `validation.${field}_required`,
      "number.min": "validation.price_min",
    };

    const errorKey = errorKeyMap[type] || "validation.invalid_data";
    throw new ApiError(400, tc(req, "productController", errorKey));
  }
  return value;
}
```

#### Passo 3: Substituir mensagens hardcoded

**Exemplo - Método index():**
```javascript
// ANTES
return res.status(200).json({
  success: true,
  data: productsResult.rows,
  // ...
});

// DEPOIS
auditLogger(tc(req, "productController", "audit.products_listed"), {
  userId: req.user.id,
  companyId: req.user.companyId
});

return res.status(200).json({
  success: true,
  message: tc(req, "productController", "list.success"),
  data: productsResult.rows,
  // ...
});
```

**Exemplo - Método create():**
```javascript
// ANTES
const { error, value } = ProductController.createProductSchema.validate(req.body);
if (error) throw new ApiError(400, error.details[0].message);

// DEPOIS
const value = ProductController.validateWithTranslation(
  req,
  ProductController.createProductSchema,
  req.body
);
```

**Exemplo - Validação de SKU:**
```javascript
// ANTES
if (existingSku.rows.length > 0) {
  throw new ApiError(400, "SKU já existe para outro produto");
}

// DEPOIS
if (existingSku.rows.length > 0) {
  throw new ApiError(400, tc(req, "productController", "validation.sku_exists"));
}
```

**Exemplo - Ajuste de estoque:**
```javascript
// ANTES
return successResponse(res, movement, "Estoque ajustado com sucesso");

// DEPOIS
auditLogger(tc(req, "productController", "audit.stock_adjusted"), {
  userId: req.user.id,
  productId,
  type: value.type,
  quantity: value.quantity
});

return successResponse(
  res, 
  movement, 
  tc(req, "productController", "stock.adjust_success")
);
```

---

### **2. SaleController**

#### Passo 1: Adicionar import
```javascript
const { tc } = require("../config/i18n");
```

#### Passo 2: Criar método validateWithTranslation()
```javascript
static validateWithTranslation(req, schema, data) {
  const { error, value } = schema.validate(data);
  if (error) {
    const errorDetail = error.details[0];
    const field = errorDetail.path.join(".");
    const type = errorDetail.type;

    const errorKeyMap = {
      "any.required": `validation.${field}_required`,
      "array.min": "validation.items_min",
    };

    const errorKey = errorKeyMap[type] || "validation.invalid_data";
    throw new ApiError(400, tc(req, "saleController", errorKey));
  }
  return value;
}
```

#### Passo 3: Substituir mensagens hardcoded

**Exemplo - Método create():**
```javascript
// ANTES
const { error, value } = SaleController.createSaleSchema.validate(req.body);
if (error) throw new ApiError(400, error.details[0].message);

if (clientCheck.rows.length === 0) {
  throw new ApiError(404, "Cliente não encontrado");
}

// DEPOIS
const value = SaleController.validateWithTranslation(
  req,
  SaleController.createSaleSchema,
  req.body
);

if (clientCheck.rows.length === 0) {
  throw new ApiError(404, tc(req, "saleController", "validation.client_not_found"));
}
```

**Exemplo - Sistema de conquistas:**
```javascript
// ANTES
console.log("🏆 Conquista desbloqueada:", achievement.name);

// DEPOIS
const achievementMessage = tc(req, "saleController", "achievement.unlocked", {
  achievement: tc(req, "saleController", `achievement.${achievement.code}`)
});

logger.info(achievementMessage, {
  userId,
  achievementId: achievement.id
});
```

---

### **3. TicketController**

#### Passo 1: Adicionar import
```javascript
const { tc } = require("../config/i18n");
```

#### Passo 2: Substituir validações

**Exemplo - Método create():**
```javascript
// ANTES
const validation = validateTicketData(ticketData);
if (!validation.isValid) {
  throw new ApiError(400, validation.error);
}

// DEPOIS
const validation = validateTicketData(ticketData);
if (!validation.isValid) {
  throw new ApiError(400, tc(req, "ticketController", "validation.invalid_data"));
}
```

**Exemplo - Método show():**
```javascript
// ANTES
if (ticketResult.rows.length === 0) {
  throw new ApiError(404, "Ticket não encontrado");
}

// DEPOIS
if (ticketResult.rows.length === 0) {
  throw new ApiError(404, tc(req, "ticketController", "show.not_found"));
}
```

**Exemplo - Escalação:**
```javascript
// ANTES
auditLogger("Ticket escalado", { /* ... */ });
return res.json({
  success: true,
  message: "Ticket escalado com sucesso",
  data: ticket
});

// DEPOIS
auditLogger(tc(req, "ticketController", "audit.ticket_escalated"), {
  userId: req.user.id,
  ticketId,
  oldPriority,
  newPriority
});

return res.json({
  success: true,
  message: tc(req, "ticketController", "escalate.success"),
  data: ticket
});
```

---

### **4. UserController**

#### Passo 1: Adicionar import
```javascript
const { tc } = require("../config/i18n");
```

#### Passo 2: Substituir mensagens

**Exemplo - Método getUsers():**
```javascript
// ANTES
res.json({
  success: true,
  data: { users, pagination }
});

// DEPOIS
res.json({
  success: true,
  message: tc(req, "userController", "list.success"),
  data: { users, pagination }
});
```

**Exemplo - Método getUserById():**
```javascript
// ANTES
if (userResult.rows.length === 0) {
  throw new ApiError(404, "Usuário não encontrado");
}

// DEPOIS
if (userResult.rows.length === 0) {
  throw new ApiError(404, tc(req, "userController", "show.not_found"));
}
```

**Exemplo - Método updateProfile():**
```javascript
// ANTES
if (!name || !email) {
  throw new ApiError(400, "Nome e email são obrigatórios");
}

if (existingUser.rows.length > 0) {
  throw new ApiError(409, "Email já está em uso");
}

res.json({
  success: true,
  message: "Perfil atualizado com sucesso",
  data: { user }
});

// DEPOIS
if (!name || !email) {
  throw new ApiError(400, tc(req, "userController", "validation.name_and_email_required"));
}

if (existingUser.rows.length > 0) {
  throw new ApiError(409, tc(req, "userController", "validation.email_in_use"));
}

auditLogger(tc(req, "userController", "audit.profile_updated"), {
  userId: req.user.id
});

res.json({
  success: true,
  message: tc(req, "userController", "profile.update_success"),
  data: { user }
});
```

---

## 🧪 Como Testar

### Teste Manual com cURL

```bash
# Português (padrão)
curl -X GET "http://localhost:3000/api/products" \
  -H "Authorization: Bearer TOKEN"

# Inglês
curl -X GET "http://localhost:3000/api/products" \
  -H "Authorization: Bearer TOKEN" \
  -H "Accept-Language: en"

# Espanhol
curl -X GET "http://localhost:3000/api/products" \
  -H "Authorization: Bearer TOKEN" \
  -H "Accept-Language: es"
```

### Teste de Erro

```bash
# Criar produto sem nome (erro de validação)
curl -X POST "http://localhost:3000/api/products" \
  -H "Authorization: Bearer TOKEN" \
  -H "Accept-Language: en" \
  -H "Content-Type: application/json" \
  -d '{"price": 100}'

# Resposta esperada em inglês:
# {"success": false, "message": "Product name is required"}
```

---

## 📚 Chaves Disponíveis por Controller

### ProductController (42 chaves)
```
validation.*   - 13 chaves de validação
list.success
create.success
show.not_found, show.success
update.not_found, update.success
delete.not_found, delete.success, delete.has_sales
stock.adjust_success, stock.low_stock_success, stock.product_not_found
category.list_success, category.create_success, category.name_exists
reports.success
audit.*        - 10 chaves de auditoria
```

### SaleController (28 chaves)
```
validation.*   - 4 chaves de validação
list.success
create.success
show.not_found, show.success
update.not_found, update.success, update.cannot_update_completed
delete.not_found, delete.success, delete.already_cancelled
achievement.*  - 6 chaves de conquistas
audit.*        - 8 chaves de auditoria
```

### TicketController (42 chaves)
```
validation.*   - 6 chaves de validação
list.success
create.success
show.not_found, show.success
update.not_found, update.success
delete.not_found, delete.success
reply.add_success, reply.ticket_not_found
escalate.success, escalate.not_found, escalate.already_max_priority
status.change_success, status.not_found, status.invalid_transition
assign.success, assign.not_found, assign.user_not_found
reports.success
audit.*        - 10 chaves de auditoria
```

### UserController (16 chaves)
```
validation.*   - 4 chaves de validação
list.success
show.not_found, show.success
profile.get_success, profile.update_success, profile.not_found
audit.*        - 4 chaves de auditoria
```

---

## ⚡ Padrões Importantes

### 1. Sempre usar tc() para mensagens visíveis ao usuário
```javascript
// ✅ BOM
return successResponse(res, data, tc(req, "controller", "action.success"));

// ❌ RUIM
return successResponse(res, data, "Operação realizada com sucesso");
```

### 2. Usar validateWithTranslation() para Joi
```javascript
// ✅ BOM
const value = Controller.validateWithTranslation(req, schema, data);

// ❌ RUIM
const { error, value } = schema.validate(data);
if (error) throw new ApiError(400, error.details[0].message);
```

### 3. Traduzir logs de auditoria
```javascript
// ✅ BOM
auditLogger(tc(req, "controller", "audit.action_performed"), { ... });

// ❌ RUIM
auditLogger("Ação realizada", { ... });
```

### 4. Usar interpolação quando necessário
```javascript
// ✅ BOM
tc(req, "controller", "message.with_var", { count: 5 })

// ❌ RUIM
`Você tem ${count} itens` // Hardcoded
```

---

## ✅ Conclusão

Todos os arquivos JSON estão criados e validados. Agora basta implementar as mudanças nos 4 controllers seguindo este guia.

**Tempo estimado de implementação:** 2-3 horas (30-45 min por controller)

**Próximo passo:** Começar pelo **UserController** (mais simples) e depois ProductController, SaleController e TicketController.

---

**Desenvolvido por:** Sistema de IA  
**Data:** 25 de outubro de 2025  
**Status:** ✅ JSON Prontos | ⏳ Aguardando Implementação
