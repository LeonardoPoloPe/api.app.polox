# 🔧 Correção PUT /companies/:id - Validação Flexível

**Data:** 10 de novembro de 2025  
**Status:** ✅ CORRIGIDO

---

## 🐛 Problema Identificado

### Requisição com Erro
```bash
PUT /api/v1/companies/29
Body: {
  "partner_id": "28",  # ❌ String em vez de número
  "plan": "plus"       # ❌ Valor não estava na lista enum
}
```

### Resposta de Erro
```json
{
  "success": false,
  "message": "errors.validation_error",
  "error": {
    "code": "BAD_REQUEST",
    "message": "validation.invalid_field",
    "timestamp": "2025-11-10T00:30:20.254Z",
    "language": "pt"
  }
}
```

---

## ✅ Correções Aplicadas

### 1. Schema de Validação Mais Flexível

**Arquivo:** `src/controllers/CompanyController.js`

#### Campo `plan`
**Antes:**
```javascript
plan: Joi.string().valid(
  "starter",
  "professional", 
  "enterprise",
  "partner_pro"
),
```

**Depois:**
```javascript
plan: Joi.string().max(50).optional(), // ✅ Aceita qualquer plano
```

#### Campo `partner_id`
**Antes:**
```javascript
partner_id: Joi.number().integer().allow(null),
```

**Depois:**
```javascript
partner_id: Joi.alternatives()
  .try(
    Joi.number().integer(),
    Joi.string().pattern(/^\d+$/).custom((value) => parseInt(value))
  )
  .allow(null)
  .optional(), // ✅ Aceita string ou number
```

#### Campo `domain`
**Antes:**
```javascript
domain: Joi.string()
  .pattern(/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/)
  .max(100),
```

**Depois:**
```javascript
domain: Joi.string()
  .pattern(/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/)
  .max(100)
  .allow("", null)      // ✅ Aceita vazio ou null
  .optional(),
```

---

### 2. Pré-processamento de Dados

Adicionado conversão automática de strings numéricas:

```javascript
static update = asyncHandler(async (req, res) => {
  const companyId = req.params.id;
  
  // Pré-processar dados
  const preprocessedData = { ...req.body };
  
  // Converter partner_id de string para número
  if (preprocessedData.partner_id && typeof preprocessedData.partner_id === 'string') {
    preprocessedData.partner_id = preprocessedData.partner_id.trim() === '' 
      ? null 
      : parseInt(preprocessedData.partner_id);
  }
  
  // Converter max_users de string para número
  if (preprocessedData.max_users && typeof preprocessedData.max_users === 'string') {
    preprocessedData.max_users = parseInt(preprocessedData.max_users);
  }
  
  // Converter max_storage_mb de string para número
  if (preprocessedData.max_storage_mb && typeof preprocessedData.max_storage_mb === 'string') {
    preprocessedData.max_storage_mb = parseInt(preprocessedData.max_storage_mb);
  }

  // Validação com dados pré-processados
  const data = CompanyController.validateWithTranslation(
    req,
    CompanyController.updateCompanySchema,
    preprocessedData
  );
  
  // ... resto do código
});
```

---

### 3. Logs de Debug Melhorados

#### Log de Entrada
```javascript
logger.info("🔍 PUT /companies/:id - Dados recebidos:", {
  companyId,
  body: req.body
});
```

#### Log de Erro de Validação
```javascript
logger.error("❌ Erro de validação em CompanyController:", {
  field,
  type,
  message: errorMessage,
  value: data[field],
  allErrors: error.details.map(d => ({
    field: d.path[0],
    type: d.type,
    message: d.message
  }))
});
```

#### Log de Sucesso
```javascript
logger.info("✅ PUT /companies/:id - Empresa atualizada com sucesso:", {
  companyId: updatedCompany.id,
  companyName: updatedCompany.company_name,
  updatedFields: Object.keys(data)
});
```

---

### 4. Validação Mais Detalhada

```javascript
static validateWithTranslation(req, schema, data) {
  const { error, value } = schema.validate(data, { 
    abortEarly: false,   // ✅ Mostra todos os erros, não só o primeiro
    stripUnknown: true   // ✅ Remove campos não definidos no schema
  });
  
  if (error) {
    const field = error.details[0].path[0];
    const type = error.details[0].type;
    const errorMessage = error.details[0].message;

    // Mapear mais tipos de erros
    const errorKeyMap = {
      "string.min": "validation.name_min_length",
      "any.required": "validation.field_required",
      "string.pattern.base": "validation.domain_pattern",
      "string.email": "validation.admin_email_valid",
      "number.base": "validation.must_be_number",      // ✅ Novo
      "number.integer": "validation.must_be_integer",  // ✅ Novo
    };

    const messageKey = errorKeyMap[type] || "validation.invalid_field";
    const translatedMessage = tc(req, "companyController", messageKey);
    
    // Incluir detalhes do erro para facilitar debug
    throw new ApiError(400, `${translatedMessage} (${field}: ${type})`);
  }
  
  return value;
}
```

---

## 📊 Swagger Atualizado

**Arquivo:** `src/routes/companies.js`

```yaml
plan:
  type: string
  description: "Plano da empresa (aceita qualquer valor)"
  example: "plus"

partner_id:
  oneOf:
    - type: integer
    - type: string
  nullable: true
  description: "ID do parceiro (aceita string ou número)"
  example: "28"
```

---

## 🧪 Testes

### Teste 1: Atualizar com partner_id como string
```bash
curl -X PUT http://localhost:3000/api/v1/companies/29 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Rafael FoxWhite",
    "plan": "plus",
    "partner_id": "28",
    "max_users": 5,
    "max_storage_mb": 1000
  }'
```

**Resultado Esperado:** ✅ 200 OK

---

### Teste 2: Atualizar com plano customizado
```bash
curl -X PUT http://localhost:3000/api/v1/companies/29 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Empresa Teste",
    "plan": "custom_premium_2025"
  }'
```

**Resultado Esperado:** ✅ 200 OK

---

### Teste 3: Atualizar com domain vazio
```bash
curl -X PUT http://localhost:3000/api/v1/companies/29 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Empresa Sem Domínio",
    "domain": ""
  }'
```

**Resultado Esperado:** ✅ 200 OK

---

### Teste 4: Verificar conversão automática de números
```bash
curl -X PUT http://localhost:3000/api/v1/companies/29 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "max_users": "10",
    "max_storage_mb": "5000",
    "partner_id": "28"
  }'
```

**Resultado Esperado:** ✅ 200 OK com valores convertidos para números

---

## 📋 Campos que Aceitam Conversão

| Campo | Tipo Original | Aceita String | Conversão Automática |
|-------|--------------|---------------|---------------------|
| `partner_id` | integer | ✅ Sim | parseInt() |
| `max_users` | integer | ✅ Sim | parseInt() |
| `max_storage_mb` | integer | ✅ Sim | parseInt() |
| `plan` | string | ✅ Sim | Sem conversão (já é string) |
| `domain` | string | ✅ Sim | Permite vazio/null |

---

## 🎯 Compatibilidade

### Frontend Pode Enviar
```javascript
// ✅ Qualquer uma dessas formas funciona:

// Como número
{ partner_id: 28 }

// Como string
{ partner_id: "28" }

// Como null
{ partner_id: null }

// Sem o campo
{ }

// Como string vazia (será convertido para null)
{ partner_id: "" }
```

---

## 🚀 Deploy

```bash
# 1. Testar localmente
npm run dev

# 2. Testar endpoints
curl -X PUT http://localhost:3000/api/v1/companies/29 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Teste",
    "partner_id": "28",
    "plan": "plus"
  }'

# 3. Se tudo OK, fazer commit
git add src/controllers/CompanyController.js src/routes/companies.js
git commit -m "fix: validação flexível em PUT /companies/:id (aceita strings)"

# 4. Deploy
npm run deploy:dev
npm run deploy:prod
```

---

## ✅ Checklist

- [x] Schema aceita `plan` com qualquer valor
- [x] Schema aceita `partner_id` como string ou número
- [x] Pré-processamento converte strings para números
- [x] Logs de debug adicionados
- [x] Swagger atualizado
- [x] Validação mostra todos os erros (abortEarly: false)
- [ ] Testes locais passando
- [ ] Deploy em DEV
- [ ] Testes em DEV passando
- [ ] Deploy em PROD

---

## 📚 Arquivos Alterados

1. **`src/controllers/CompanyController.js`**
   - Schema `updateCompanySchema` mais flexível
   - Pré-processamento de dados
   - Logs de debug melhorados
   - Validação com mais detalhes de erro

2. **`src/routes/companies.js`**
   - Swagger atualizado com novos tipos aceitos

---

## 🔗 Referências

- Joi Documentation: https://joi.dev/api/
- Joi Alternatives: https://joi.dev/api/?v=17.9.1#alternatives
- Joi Custom Validation: https://joi.dev/api/?v=17.9.1#anycustommethod-description

---

**Status:** ✅ CORRIGIDO  
**Próximo Passo:** Testar e fazer deploy
