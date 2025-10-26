# 🏢 Swagger Multi-Idiomas - Companies Controller

## ✅ Implementação Concluída

**Data:** 26 de outubro de 2025  
**Controller:** CompanyController (Super Admin)  
**Rotas Atualizadas:** 8 endpoints

---

## 🎯 Resumo das Alterações

### 1. **Swagger Routes (companies.js)**
Adicionado parâmetro `AcceptLanguage` em todos os endpoints:

#### ✅ Endpoints Atualizados:
1. `GET /companies` - Listar empresas com filtros
2. `POST /companies` - Criar nova empresa
3. `GET /companies/stats` - Estatísticas globais
4. `GET /companies/:id` - Detalhes da empresa
5. `PUT /companies/:id` - Atualizar empresa
6. `DELETE /companies/:id` - Deletar empresa
7. `PUT /companies/:id/modules` - Gerenciar módulos
8. `PUT /companies/:id/status` - Alterar status
9. `GET /companies/:id/analytics` - Analytics da empresa

**Código Adicionado em cada endpoint:**
```yaml
parameters:
  - $ref: '#/components/parameters/AcceptLanguage'
```

---

## 📋 Status da Tradução

### ✅ CompanyController
- **Controller:** 100% traduzido (já estava completo)
- **Service Layer:** Não existe (lógica no controller)
- **Arquivos JSON:** Completos em 3 idiomas

### 📁 Arquivos de Tradução
```
src/locales/controllers/
├── pt/companyController.json ✅ 54 chaves
├── en/companyController.json ✅ 54 chaves
└── es/companyController.json ✅ 54 chaves
```

---

## 🧪 Como Testar no Swagger

### 1. Acessar Swagger UI
```
http://localhost:3000/api/v1/docs
```

### 2. Autenticar como Super Admin
- Endpoint: `POST /api/v1/auth/login`
- Credenciais: Super Admin
- Copiar o token JWT
- Clicar em "Authorize" e colar: `Bearer {seu_token}`

### 3. Testar com Diferentes Idiomas

#### 🇧🇷 Português (pt)
```bash
# Criar Empresa (domínio duplicado)
POST /api/v1/companies
Accept-Language: pt

Response:
{
  "success": false,
  "message": "Domínio 'techcorp' já está em uso pela empresa: TechCorp Solutions"
}
```

#### 🇺🇸 Inglês (en)
```bash
POST /api/v1/companies
Accept-Language: en

Response:
{
  "success": false,
  "message": "Domain 'techcorp' is already in use by company: TechCorp Solutions"
}
```

#### 🇪🇸 Espanhol (es)
```bash
POST /api/v1/companies
Accept-Language: es

Response:
{
  "success": false,
  "message": "El dominio 'techcorp' ya está en uso por la empresa: TechCorp Solutions"
}
```

---

## 📊 Exemplos de Teste por Endpoint

### 1. Criar Empresa (POST /companies)
```json
// Request Body
{
  "name": "Test Corp",
  "domain": "testcorp",
  "admin_name": "Admin Test",
  "admin_email": "admin@testcorp.com",
  "plan": "starter"
}

// Cenários de erro traduzidos:
// - Domínio já existe
// - Email já está em uso
// - Validações de campos (nome, email, domínio)
```

### 2. Atualizar Empresa (PUT /companies/:id)
```json
// Request Body
{
  "name": "Updated Corp",
  "plan": "enterprise"
}

// Erros traduzidos:
// - Empresa não encontrada (404)
// - Campos inválidos (400)
```

### 3. Gerenciar Módulos (PUT /companies/:id/modules)
```json
// Request Body
{
  "enabled_modules": ["dashboard", "users", "leads", "invalid_module"]
}

// Erro traduzido:
// PT: "Módulos inválidos: invalid_module"
// EN: "Invalid modules: invalid_module"
// ES: "Módulos inválidos: invalid_module"
```

### 4. Alterar Status (PUT /companies/:id/status)
```json
// Request Body
{
  "status": "invalid_status"
}

// Erro traduzido:
// PT: "Status deve ser: active, inactive ou trial"
// EN: "Status must be: active, inactive or trial"
// ES: "El estado debe ser: active, inactive o trial"
```

---

## 🔍 Verificação de Segurança

### Super Admin Required
Todos os endpoints verificam se o usuário é Super Admin:

```javascript
// Middleware no controller
static requireSuperAdmin = asyncHandler(async (req, res, next) => {
  if (req.user.role !== "super_admin") {
    throw new ApiError(403, tc(req, "companyController", "security.super_admin_required"));
  }
  next();
});
```

**Mensagens traduzidas:**
- **PT:** "Acesso de Super Admin necessário"
- **EN:** "Super Admin access required"
- **ES:** "Se requiere acceso de Super Admin"

---

## 📝 Chaves de Tradução Disponíveis

### Validations
```json
{
  "name_min_length": "...",
  "name_required": "...",
  "domain_pattern": "...",
  "domain_required": "...",
  "admin_name_required": "...",
  "admin_email_valid": "...",
  "admin_email_required": "...",
  "modules_must_be_array": "...",
  "invalid_modules": "...",
  "invalid_status": "...",
  "no_fields_to_update": "..."
}
```

### CRUD Operations
```json
{
  "create": {
    "success": "...",
    "domain_in_use": "...",
    "email_in_use": "..."
  },
  "update": {
    "success": "...",
    "not_found": "..."
  },
  "delete": {
    "success": "...",
    "not_found": "..."
  },
  "show": {
    "not_found": "..."
  }
}
```

### Special Operations
```json
{
  "modules": {
    "update_success": "..."
  },
  "status": {
    "update_success": "..."
  }
}
```

### Security & Audit
```json
{
  "security": {
    "super_admin_required": "...",
    "unauthorized_access_attempt": "..."
  },
  "audit": {
    "company_created": "...",
    "company_updated": "...",
    "company_deleted": "...",
    "modules_updated": "...",
    "status_updated": "..."
  }
}
```

---

## 🎯 Diferenças com ClientController

### CompanyController:
✅ **Não tem Service Layer** - Toda lógica no controller  
✅ **Já estava 100% traduzido**  
✅ **Apenas adicionou Swagger params**  

### ClientController:
✅ **Tem Service Layer** - Teve que passar `req` para services  
✅ **Precisou modificar** `ClientService.createClient()` e `updateClient()`  
✅ **Adicionou Swagger params + Service translation**  

---

## ✅ Checklist de Testes

### Swagger UI
- [ ] Seletor de idioma aparece em todos os endpoints
- [ ] Dropdown mostra pt/en/es

### Funcionalidade
- [ ] Criar empresa com domínio duplicado (erro traduzido)
- [ ] Criar empresa com email duplicado (erro traduzido)
- [ ] Atualizar empresa inexistente (erro traduzido)
- [ ] Módulos inválidos (erro traduzido)
- [ ] Status inválido (erro traduzido)
- [ ] Acesso sem ser Super Admin (erro traduzido)

### 3 Idiomas
- [ ] Português (pt) - Todas as mensagens
- [ ] Inglês (en) - Todas as mensagens
- [ ] Espanhol (es) - Todas as mensagens

---

## 🚀 Próximos Passos

1. ✅ Testar no Swagger UI
2. ⏳ Aplicar para outros controllers:
   - LeadController
   - UserController
   - SaleController
   - ProductController
   - EventController
   - TicketController
   - SupplierController
   - FinancialTransactionController
   - CustomFieldController
   - ReportController
   - DashboardController

---

## 📚 Documentação Relacionada

- [GUIA_TESTE_SWAGGER_IDIOMAS.md](./GUIA_TESTE_SWAGGER_IDIOMAS.md) - Guia geral de testes
- [SWAGGER_MULTI_IDIOMAS_TESTES.md](./SWAGGER_MULTI_IDIOMAS_TESTES.md) - Testes Client
- [STATUS_TRADUCOES_CONTROLLERS.md](./STATUS_TRADUCOES_CONTROLLERS.md) - Status geral
- [RESUMO_COMPANYCONTROLLER_TRADUCOES.md](./RESUMO_COMPANYCONTROLLER_TRADUCOES.md) - Resumo Company

---

**✅ CompanyController 100% pronto para testes multi-idiomas no Swagger!**
