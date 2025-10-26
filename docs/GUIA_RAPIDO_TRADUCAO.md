# 🚀 Guia Rápido: Como Traduzir um Novo Controller

**Tempo estimado:** 30-60 minutos por controller  
**Dificuldade:** Intermediária

---

## 📋 Checklist Rápido

```
[ ] 1. Criar 3 arquivos JSON (pt, en, es)
[ ] 2. Registrar namespace em i18n.js
[ ] 3. Adicionar import tc() no controller
[ ] 4. Criar método validateWithTranslation()
[ ] 5. Substituir todas as mensagens
[ ] 6. Validar JSON
[ ] 7. Testar endpoints
[ ] 8. Criar documentação
```

---

## 🎯 Passo a Passo

### 1️⃣ Criar Arquivos JSON (5 min)

**Localização:** `src/locales/controllers/{lang}/{controller}.json`

**Template básico:**
```json
{
  "validation": {
    "field_required": "Campo obrigatório",
    "field_invalid": "Campo inválido"
  },
  "list": {
    "success": "Listado com sucesso"
  },
  "create": {
    "success": "Criado com sucesso"
  },
  "show": {
    "not_found": "Não encontrado",
    "success": "Retornado com sucesso"
  },
  "update": {
    "not_found": "Não encontrado",
    "success": "Atualizado com sucesso"
  },
  "delete": {
    "not_found": "Não encontrado",
    "success": "Excluído com sucesso"
  },
  "audit": {
    "item_created": "Item criado",
    "item_updated": "Item atualizado",
    "item_deleted": "Item excluído"
  }
}
```

**Criar para 3 idiomas:**
- `src/locales/controllers/pt/{controller}.json`
- `src/locales/controllers/en/{controller}.json`
- `src/locales/controllers/es/{controller}.json`

---

### 2️⃣ Registrar Namespace (1 min)

**Arquivo:** `src/config/i18n.js`

**Adicionar no array `ns`:**
```javascript
ns: [
  "common",
  "authController",
  "userController",
  "clientController",
  "companyController",
  "leadController",
  "seuNovoController",  // ← ADICIONE AQUI
  // ...
],
```

---

### 3️⃣ Atualizar Controller (20-40 min)

#### a) Adicionar import
```javascript
const { tc } = require("../utils/i18n");
```

#### b) Adicionar método validateWithTranslation()
```javascript
class SeuController {
  /**
   * Valida dados com Joi e retorna erros traduzidos
   */
  static validateWithTranslation(req, schema, data) {
    const { error, value } = schema.validate(data);
    if (error) {
      const errorDetail = error.details[0];
      const field = errorDetail.path.join(".");
      const type = errorDetail.type;

      // Mapeamento de erros Joi para chaves de tradução
      const errorKeyMap = {
        "string.min": "validation.name_min_length",
        "string.email": "validation.email_invalid",
        "any.required": `validation.${field}_required`,
        "array.min": `validation.${field}_required`,
      };

      const errorKey = errorKeyMap[type] || "validation.invalid_data";
      throw new ApiError(400, tc(req, "seuController", errorKey));
    }
    return value;
  }

  // ... métodos
}
```

#### c) Substituir validações
**❌ ANTES:**
```javascript
const { error, value } = SeuController.createSchema.validate(req.body);
if (error) throw new ApiError(400, error.details[0].message);
```

**✅ DEPOIS:**
```javascript
const value = SeuController.validateWithTranslation(
  req,
  SeuController.createSchema,
  req.body
);
```

#### d) Substituir mensagens
**❌ ANTES:**
```javascript
return successResponse(res, data, "Item criado com sucesso");
```

**✅ DEPOIS:**
```javascript
return successResponse(res, data, tc(req, "seuController", "create.success"));
```

#### e) Substituir erros
**❌ ANTES:**
```javascript
if (!item) {
  throw new ApiError(404, "Item não encontrado");
}
```

**✅ DEPOIS:**
```javascript
if (!item) {
  throw new ApiError(404, tc(req, "seuController", "show.not_found"));
}
```

#### f) Substituir logs de auditoria
**❌ ANTES:**
```javascript
auditLogger("Item criado", { userId: req.user.id });
```

**✅ DEPOIS:**
```javascript
auditLogger(tc(req, "seuController", "audit.item_created"), { 
  userId: req.user.id 
});
```

---

### 4️⃣ Validar JSON (2 min)

**Comando para cada idioma:**
```bash
# Validar português
node -e "console.log('PT:', JSON.parse(require('fs').readFileSync('src/locales/controllers/pt/seuController.json', 'utf8')).validation ? 'OK' : 'FAIL')"

# Validar inglês
node -e "console.log('EN:', JSON.parse(require('fs').readFileSync('src/locales/controllers/en/seuController.json', 'utf8')).validation ? 'OK' : 'FAIL')"

# Validar espanhol
node -e "console.log('ES:', JSON.parse(require('fs').readFileSync('src/locales/controllers/es/seuController.json', 'utf8')).validation ? 'OK' : 'FAIL')"
```

**Resultado esperado:**
```
PT: OK
EN: OK
ES: OK
```

---

### 5️⃣ Testar Endpoints (10 min)

#### Teste em Português
```bash
curl -X POST http://localhost:3000/api/seu-recurso \
  -H "Content-Type: application/json" \
  -d '{"name": "Teste"}'
```

**Resposta esperada:**
```json
{
  "success": true,
  "message": "Item criado com sucesso",
  "data": { ... }
}
```

#### Teste em Inglês
```bash
curl -X POST "http://localhost:3000/api/seu-recurso?lang=en" \
  -H "Content-Type: application/json" \
  -d '{"name": "Test"}'
```

**Resposta esperada:**
```json
{
  "success": true,
  "message": "Item created successfully",
  "data": { ... }
}
```

#### Teste em Espanhol
```bash
curl -X POST "http://localhost:3000/api/seu-recurso?lang=es" \
  -H "Content-Type: application/json" \
  -d '{"name": "Prueba"}'
```

**Resposta esperada:**
```json
{
  "success": true,
  "message": "Item creado con éxito",
  "data": { ... }
}
```

---

### 6️⃣ Criar Documentação (10 min)

**Criar arquivo:** `docs/TRADUCAO_{CONTROLLER}_COMPLETO.md`

**Template mínimo:**
```markdown
# Tradução do {Controller}

## Status
✅ CONCLUÍDO

## Arquivos Criados
- src/locales/controllers/pt/{controller}.json (X chaves)
- src/locales/controllers/en/{controller}.json (X chaves)
- src/locales/controllers/es/{controller}.json (X chaves)

## Arquivos Modificados
- src/config/i18n.js (namespace registrado)
- src/controllers/{Controller}.js (métodos traduzidos)

## Métodos Traduzidos
- [ ] index()
- [ ] create()
- [ ] show()
- [ ] update()
- [ ] destroy()

## Total de Traduções
X chaves × 3 idiomas = Y traduções

## Validação
✅ JSON validado
✅ Código sem erros
✅ Testes executados
```

---

## 💡 Dicas e Truques

### 1. Use Find & Replace com Cuidado
**Buscar:** `"Mensagem específica"`  
**Substituir:** `tc(req, "controller", "key")`

⚠️ **Atenção:** Sempre revise manualmente após o replace.

---

### 2. Organize Chaves por Contexto
```json
{
  "validation": { ... },   // Validações
  "create": { ... },       // Criação
  "update": { ... },       // Atualização
  "delete": { ... },       // Exclusão
  "special": { ... },      // Operações especiais
  "audit": { ... }         // Logs
}
```

---

### 3. Use Nomes Descritivos
❌ **Ruim:**
```json
{
  "msg1": "Sucesso",
  "msg2": "Erro"
}
```

✅ **Bom:**
```json
{
  "create": {
    "success": "Item criado com sucesso",
    "duplicate": "Item já existe"
  }
}
```

---

### 4. Mantenha Consistência
Se usou `"not_found"` no ClientController, use o mesmo padrão em outros controllers.

---

### 5. Interpolação de Variáveis
**JSON:**
```json
{
  "error": {
    "duplicate": "O email {{email}} já está em uso"
  }
}
```

**Código:**
```javascript
tc(req, "controller", "error.duplicate", { email: value.email })
```

---

## 🔍 Referências Rápidas

### Controllers já Traduzidos (use como referência)
1. ✅ `src/controllers/ClientController.js` - Exemplo básico
2. ✅ `src/controllers/CompanyController.js` - Exemplo com interpolação
3. ✅ `src/controllers/LeadController.js` - Exemplo com sub-recursos

### Documentação
1. 📄 `docs/README-i18n.md` - Guia completo do sistema
2. 📄 `docs/STATUS_TRADUCOES_CONTROLLERS.md` - Status geral
3. 📄 `docs/TRADUCAO_LEADCONTROLLER_COMPLETO.md` - Exemplo detalhado

---

## ❓ Troubleshooting

### Problema: Mensagem não traduz
**Causa:** Namespace não registrado em i18n.js  
**Solução:** Adicionar no array `ns`

---

### Problema: JSON inválido
**Causa:** Vírgula extra, aspas faltando  
**Solução:** Validar com `node -e "JSON.parse(...)"`

---

### Problema: Erro "key not found"
**Causa:** Chave não existe no JSON  
**Solução:** Verificar se a chave está correta em todos os idiomas

---

### Problema: Sempre retorna português
**Causa:** Middleware i18n não configurado ou query param errado  
**Solução:** Usar `?lang=en` ou `Accept-Language: en-US`

---

## 🎯 Exemplo Completo Mínimo

### 1. JSON (pt)
```json
{
  "validation": {
    "name_required": "Nome obrigatório"
  },
  "create": {
    "success": "Criado com sucesso"
  },
  "audit": {
    "item_created": "Item criado"
  }
}
```

### 2. Controller
```javascript
const { tc } = require("../utils/i18n");

class ExemploController {
  static validateWithTranslation(req, schema, data) {
    const { error, value } = schema.validate(data);
    if (error) {
      throw new ApiError(400, tc(req, "exemploController", "validation.name_required"));
    }
    return value;
  }

  static create = asyncHandler(async (req, res) => {
    const value = ExemploController.validateWithTranslation(
      req,
      ExemploController.createSchema,
      req.body
    );

    const item = await ExemploModel.create(value);

    auditLogger(tc(req, "exemploController", "audit.item_created"), {
      userId: req.user.id,
      itemId: item.id
    });

    return successResponse(
      res,
      item,
      tc(req, "exemploController", "create.success"),
      201
    );
  });
}
```

### 3. Registrar namespace
```javascript
// src/config/i18n.js
ns: ["common", "exemploController"]
```

---

## ✅ Finalização

Após completar todos os passos:

1. ✅ Commit das mudanças:
```bash
git add .
git commit -m "feat(i18n): Add translations for {Controller}"
```

2. ✅ Atualizar `docs/STATUS_TRADUCOES_CONTROLLERS.md`

3. ✅ Comunicar à equipe que o controller está traduzido

---

**Dúvidas?** Consulte os controllers já traduzidos como referência!

**Boa sorte! 🚀**
