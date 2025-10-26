# ⚡ Quick Reference - Testes de Integração

> **Guia rápido para criar testes seguindo o padrão estabelecido**

---

## 🎯 Template Básico

```javascript
const DatabaseHelper = require('../helpers/database.helper');
const [Model] = require('../../src/models/[Model]');

describe('🎯 [Model] - [Funcionalidade]', () => {
  
  // Helper para criar contexto isolado
  async function createTestContext() {
    const helper = new DatabaseHelper();
    const testCompany = await helper.createCompany({
      fantasy_name: 'Test Company',
      legal_name: 'Test Company LTDA',
      document_number: helper.generateCNPJ(),
      email: 'test@company.com',
      country: 'BR'
    });
    const testUser = await helper.createUser({
      name: 'Test User',
      email: 'test@user.com',
      password: 'Test@123',
      company_id: testCompany.id
    });
    return { testCompany, testUser, helper };
  }

  afterEach(async () => {
    const helper = new DatabaseHelper();
    await helper.cleanup();
  });

  describe('✅ [Funcionalidade] - Português (pt-BR)', () => {
    test('deve [ação]', async () => {
      const { testCompany, testUser } = await createTestContext();
      
      const data = {
        // ⚠️ Usar nomes EXATOS das colunas do DDL
        // ⚠️ country: código ISO ('BR', 'US', 'ES')
        // ⚠️ Não especificar campos com DEFAULT
      };
      
      const result = await Model.method(data, testCompany.id, testUser.id);
      
      // ✅ Validar apenas campos do RETURNING clause
      expect(result.id).toBeDefined();
      expect(parseFloat(result.numeric_field)).toBe(expected); // ⚠️ parseFloat()
      // expect(result.campo_nao_retornado).toBe(value); // ❌ Não retornado
    });
  });

  describe('✅ [Funcionalidade] - English (en)', () => {
    test('should [action]', async () => {
      // Same pattern...
    });
  });

  describe('✅ [Funcionalidade] - Español (es)', () => {
    test('debe [acción]', async () => {
      // Same pattern...
    });
  });
});
```

---

## ⚠️ Pontos Críticos

### 1. Country Codes (VARCHAR(3))
```javascript
// ❌ ERRADO
country: 'Brasil'  // 6 chars - erro!
country: 'USA'     // OK mas não é padrão
country: 'España'  // 6 chars - erro!

// ✅ CORRETO (ISO codes)
country: 'BR'  // Brasil
country: 'US'  // United States
country: 'ES'  // España
```

### 2. Column Names
```javascript
// ⚠️ Consultar DDL para nomes exatos

// ❌ ERRADO (assumindo)
expect(lead.name).toBe('João Silva');

// ✅ CORRETO (DDL confirmado)
expect(lead.lead_name).toBe('João Silva');

// ⚠️ Clients: client_name mapeado para name
expect(client.name).toBe('João Silva'); // ✅ Mapeado pelo Model
```

### 3. Numeric Fields
```javascript
// ❌ ERRADO (PostgreSQL numeric retorna string)
expect(lead.conversion_value).toBe(50000);

// ✅ CORRETO
expect(parseFloat(lead.conversion_value)).toBe(50000);
```

### 4. Status/Default Values
```javascript
// ❌ ERRADO (especificando DEFAULT)
const data = {
  name: 'Test',
  status: 'novo' // ❌ Desnecessário
};

// ✅ CORRETO (deixar DB usar DEFAULT)
const data = {
  name: 'Test'
  // status usa DEFAULT 'novo'
};
```

### 5. RETURNING Clause
```javascript
// ⚠️ SEMPRE verificar no Model o que é retornado

// Model.js
RETURNING id, name, email, created_at  // ⚠️ Só estes 4 campos

// Test.js
expect(result.id).toBeDefined();        // ✅ Retornado
expect(result.name).toBe('Test');       // ✅ Retornado
expect(result.email).toBe('a@b.com');   // ✅ Retornado
expect(result.created_at).toBeDefined(); // ✅ Retornado
// expect(result.company_id).toBe(1);    // ❌ NÃO retornado
```

---

## 🔧 Configuração do Pool (database.js)

**⚠️ JÁ ESTÁ CONFIGURADO - NÃO MODIFICAR**

```javascript
// src/config/database.js

// Função transaction() - linhas 206-218
async function transaction(callback) {
  const activePool = (process.env.NODE_ENV === 'test' && global.testPool) 
    ? global.testPool 
    : pool;
  // ... resto
}

// Função query() - linhas 145-156
async function query(text, params) {
  const activePool = (process.env.NODE_ENV === 'test' && global.testPool) 
    ? global.testPool 
    : await createPool();
  return activePool.query(text, params);
}
```

**✅ Seguro para produção:** Só usa testPool quando NODE_ENV=test

---

## 📋 Checklist

- [ ] Consultar DDL para nomes exatos de colunas
- [ ] Verificar RETURNING clause no Model
- [ ] Country: usar ISO codes ('BR', 'US', 'ES')
- [ ] Numeric: usar parseFloat()
- [ ] Status: usar DEFAULT (não especificar)
- [ ] Validar apenas campos retornados
- [ ] Testar 3 idiomas (pt-BR, en, es)
- [ ] Criar contexto isolado (empresa + usuário)
- [ ] afterEach cleanup

---

## 🚀 Comandos

```bash
# Teste individual
npm test -- tests/integration/[file].test.js --forceExit

# Todos os testes
npm test --forceExit

# Com coverage
npm test -- --coverage
```

---

## 📊 Status Atual

```
✅ Infrastructure:      22/22  (100%)
✅ Simple CRUD:         23/23  (100%)
✅ Lead Model:           6/6   (100%)
─────────────────────────────────────
✅ TOTAL:               51/51  (100%)
```

---

## 🎓 Referências

- **Guia completo:** `docs/GUIA_TESTES_LEAD_MODEL.md`
- **DDL files:** `docs/sql/`
- **Exemplo pronto:** `tests/integration/lead-refactored.test.js`

