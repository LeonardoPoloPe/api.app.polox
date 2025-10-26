# 🧪 Estratégia de Testes Automatizados - API Polox

**Data:** 26 de outubro de 2025  
**Objetivo:** Alcançar 70% de cobertura de testes em 2-3 semanas  
**Status Atual:** 0% de cobertura  
**Meta:** 70% de cobertura (mínimo produção)

---

## 📊 STACK DE TESTES RECOMENDADA

### ✅ Tecnologias Principais (Já instaladas)

```json
{
  "devDependencies": {
    "jest": "^29.7.0",                    // ✅ Framework de testes
    "supertest": "^6.3.3",                // ✅ Testes HTTP/API
    "@types/jest": "^29.5.5",             // ✅ TypeScript types
    "ts-jest": "^29.1.1"                  // ✅ Jest + TypeScript
  }
}
```

### 🆕 Tecnologias Adicionais Necessárias

```bash
npm install --save-dev \
  jest-extended \
  @jest/globals \
  jest-mock-extended \
  supertest \
  faker \
  @faker-js/faker \
  nock \
  msw \
  aws-sdk-mock \
  redis-mock
```

**Justificativa:**
- **jest-extended**: Matchers extras (toBeArray, toContainKey, etc.)
- **faker**: Geração de dados fake para testes
- **nock**: Mock de HTTP requests externos
- **msw**: Mock Service Worker para APIs externas
- **aws-sdk-mock**: Mock de serviços AWS (Secrets Manager, S3)
- **redis-mock**: Mock do Redis (já que não está implementado ainda)

---

## 🎯 ESTRATÉGIA DE TESTES (3 CAMADAS)

### 1️⃣ Testes Unitários (Unit Tests) - 40% da cobertura

**O que testar:**
- ✅ Utils (formatters, validators, helpers)
- ✅ Middlewares (auth, security, tenant)
- ✅ Services (lógica de negócio)
- ✅ Models (quando tiver)

**Características:**
- 🚀 Rápidos (< 10ms por teste)
- 🔒 Isolados (sem DB, sem rede)
- 📦 Mocks de dependências
- 🎯 Foco em lógica pura

**Estrutura:**
```
tests/
├── unit/
│   ├── utils/
│   │   ├── formatters.test.js
│   │   ├── validators.test.js
│   │   └── logger.test.js
│   ├── middleware/
│   │   ├── auth.test.js
│   │   ├── security.test.js
│   │   └── tenant.test.js
│   └── services/
│       ├── ClientService.test.js
│       ├── ProductService.test.js
│       └── UserService.test.js
```

### 2️⃣ Testes de Integração (Integration Tests) - 50% da cobertura

**O que testar:**
- ✅ Controllers completos
- ✅ Rotas com middlewares
- ✅ Interação com DB (banco de teste)
- ✅ Fluxos multi-camada (controller → service → db)

**Características:**
- ⚡ Moderadamente rápidos (< 100ms por teste)
- 🗄️ Banco de dados de teste
- 🔗 Testa integração real
- 🎭 Alguns mocks (AWS, Redis)

**Estrutura:**
```
tests/
├── integration/
│   ├── controllers/
│   │   ├── ClientController.test.js
│   │   ├── ProductController.test.js
│   │   ├── SaleController.test.js
│   │   └── UserController.test.js
│   ├── routes/
│   │   ├── clients.routes.test.js
│   │   └── products.routes.test.js
│   └── flows/
│       ├── lead-conversion.test.js
│       └── sale-creation.test.js
```

### 3️⃣ Testes E2E (End-to-End) - 10% da cobertura

**O que testar:**
- ✅ Fluxos completos do usuário
- ✅ Autenticação + Autorização
- ✅ Casos de uso críticos
- ✅ Validações de ponta a ponta

**Características:**
- 🐢 Lentos (< 1s por teste)
- 🌐 Ambiente completo
- 💯 Zero mocks (tudo real)
- 🎬 Cenários reais

**Estrutura:**
```
tests/
├── e2e/
│   ├── auth-flow.test.js
│   ├── lead-to-sale-flow.test.js
│   ├── multi-tenant-isolation.test.js
│   └── i18n-flow.test.js
```

---

## 🛠️ CONFIGURAÇÃO DO AMBIENTE DE TESTES

### 1. Jest Configuration (jest.config.js)

```javascript
module.exports = {
  // Ambiente de execução
  testEnvironment: 'node',
  
  // Cobertura de código
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html', 'json-summary'],
  
  // Thresholds mínimos
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  },
  
  // Arquivos de teste
  testMatch: [
    '**/tests/**/*.test.js',
    '**/tests/**/*.spec.js'
  ],
  
  // Ignorar
  testPathIgnorePatterns: [
    '/node_modules/',
    '/coverage/',
    '/dist/'
  ],
  
  // Setup
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  
  // Timeout
  testTimeout: 10000, // 10s para testes de integração
  
  // Mocks
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
  
  // Verbose
  verbose: true,
  
  // Extensions
  setupFiles: ['jest-extended/all']
};
```

### 2. Setup Global (tests/setup.js)

```javascript
const { Pool } = require('pg');
const redis = require('redis-mock');

// Variáveis de ambiente para testes
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_jwt_secret_key_for_testing_only';
process.env.DB_NAME = 'app_polox_test';
process.env.DB_HOST = 'localhost';
process.env.DB_PORT = '5432';
process.env.DB_USER = 'postgres';
process.env.DB_PASSWORD = 'postgres';
process.env.LOG_LEVEL = 'error'; // Silenciar logs em testes

// Mock do Redis (até implementar de verdade)
jest.mock('redis', () => require('redis-mock'));

// Mock do AWS Secrets Manager
jest.mock('@aws-sdk/client-secrets-manager', () => ({
  SecretsManagerClient: jest.fn(() => ({
    send: jest.fn()
  })),
  GetSecretValueCommand: jest.fn()
}));

// Mock do Sentry
jest.mock('@sentry/node', () => ({
  init: jest.fn(),
  captureException: jest.fn(),
  captureMessage: jest.fn()
}));

// Configuração do pool de conexões de teste
let testPool;

beforeAll(async () => {
  // Criar banco de teste se não existir
  const adminPool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: 'postgres'
  });
  
  try {
    await adminPool.query(`CREATE DATABASE ${process.env.DB_NAME}`);
  } catch (err) {
    // Database já existe
  }
  
  await adminPool.end();
  
  // Conectar ao banco de teste
  testPool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
  });
  
  // Rodar migrations
  const { runMigrations } = require('../migrations/migration-runner');
  await runMigrations(testPool, 'up');
});

afterAll(async () => {
  // Fechar conexões
  if (testPool) {
    await testPool.end();
  }
});

// Limpar dados entre testes
afterEach(async () => {
  if (testPool) {
    // Limpar tabelas (exceto migrations)
    const tables = [
      'lead_notes', 'leads', 'client_notes', 'clients',
      'sales', 'products', 'tickets', 'financial_transactions',
      'gamification_history', 'events', 'notifications',
      'custom_field_values', 'custom_fields',
      'tags', 'interests', 'users', 'companies'
    ];
    
    for (const table of tables) {
      await testPool.query(`TRUNCATE TABLE polox.${table} CASCADE`);
    }
  }
});

// Export do pool para usar nos testes
global.testPool = testPool;
```

### 3. Database Test Helper (tests/helpers/database.js)

```javascript
const { Pool } = require('pg');

class DatabaseHelper {
  constructor() {
    this.pool = global.testPool;
  }
  
  // Criar empresa de teste
  async createTestCompany(data = {}) {
    const query = `
      INSERT INTO polox.companies (
        name, cnpj, email, phone, status
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    
    const values = [
      data.name || 'Test Company',
      data.cnpj || '12345678901234',
      data.email || 'test@company.com',
      data.phone || '11999999999',
      data.status || 'active'
    ];
    
    const result = await this.pool.query(query, values);
    return result.rows[0];
  }
  
  // Criar usuário de teste
  async createTestUser(companyId, data = {}) {
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash(data.password || 'Test@123', 12);
    
    const query = `
      INSERT INTO polox.users (
        company_id, name, email, password, role, status
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    
    const values = [
      companyId,
      data.name || 'Test User',
      data.email || `test${Date.now()}@test.com`,
      hashedPassword,
      data.role || 'user',
      data.status || 'active'
    ];
    
    const result = await this.pool.query(query, values);
    return result.rows[0];
  }
  
  // Criar cliente de teste
  async createTestClient(companyId, data = {}) {
    const query = `
      INSERT INTO polox.clients (
        company_id, name, email, phone, type, status
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    
    const values = [
      companyId,
      data.name || 'Test Client',
      data.email || `client${Date.now()}@test.com`,
      data.phone || '11888888888',
      data.type || 'individual',
      data.status || 'active'
    ];
    
    const result = await this.pool.query(query, values);
    return result.rows[0];
  }
  
  // Criar produto de teste
  async createTestProduct(companyId, data = {}) {
    const query = `
      INSERT INTO polox.products (
        company_id, name, description, price, stock, status
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    
    const values = [
      companyId,
      data.name || 'Test Product',
      data.description || 'Test Description',
      data.price || 100.00,
      data.stock || 10,
      data.status || 'active'
    ];
    
    const result = await this.pool.query(query, values);
    return result.rows[0];
  }
  
  // Gerar JWT de teste
  generateTestToken(user) {
    const jwt = require('jsonwebtoken');
    return jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        company_id: user.company_id
      },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
  }
  
  // Limpar todas as tabelas
  async cleanDatabase() {
    const tables = [
      'lead_notes', 'leads', 'client_notes', 'clients',
      'sales', 'products', 'tickets', 'financial_transactions',
      'gamification_history', 'events', 'notifications',
      'custom_field_values', 'custom_fields',
      'tags', 'interests', 'users', 'companies'
    ];
    
    for (const table of tables) {
      await this.pool.query(`TRUNCATE TABLE polox.${table} CASCADE`);
    }
  }
}

module.exports = new DatabaseHelper();
```

---

## 📝 EXEMPLOS PRÁTICOS DE TESTES

### 1️⃣ Teste Unitário: Utils/Validators

**Arquivo:** `tests/unit/utils/validators.test.js`

```javascript
const { describe, it, expect } = require('@jest/globals');
const { validateEmail, validateCPF, validateCNPJ } = require('../../../src/utils/validators');

describe('Utils - Validators', () => {
  describe('validateEmail', () => {
    it('should validate correct email', () => {
      expect(validateEmail('test@example.com')).toBe(true);
      expect(validateEmail('user.name@domain.co.uk')).toBe(true);
    });
    
    it('should reject invalid email', () => {
      expect(validateEmail('invalid')).toBe(false);
      expect(validateEmail('test@')).toBe(false);
      expect(validateEmail('@example.com')).toBe(false);
      expect(validateEmail('')).toBe(false);
      expect(validateEmail(null)).toBe(false);
    });
    
    it('should handle edge cases', () => {
      expect(validateEmail('test+tag@example.com')).toBe(true);
      expect(validateEmail('test..test@example.com')).toBe(false);
    });
  });
  
  describe('validateCPF', () => {
    it('should validate correct CPF', () => {
      expect(validateCPF('123.456.789-09')).toBe(true);
      expect(validateCPF('12345678909')).toBe(true);
    });
    
    it('should reject invalid CPF', () => {
      expect(validateCPF('000.000.000-00')).toBe(false);
      expect(validateCPF('111.111.111-11')).toBe(false);
      expect(validateCPF('12345')).toBe(false);
    });
  });
  
  describe('validateCNPJ', () => {
    it('should validate correct CNPJ', () => {
      expect(validateCNPJ('11.222.333/0001-81')).toBe(true);
      expect(validateCNPJ('11222333000181')).toBe(true);
    });
    
    it('should reject invalid CNPJ', () => {
      expect(validateCNPJ('00.000.000/0000-00')).toBe(false);
      expect(validateCNPJ('11.111.111/1111-11')).toBe(false);
    });
  });
});
```

### 2️⃣ Teste Unitário: Middleware/Auth

**Arquivo:** `tests/unit/middleware/auth.test.js`

```javascript
const { describe, it, expect, jest, beforeEach } = require('@jest/globals');
const jwt = require('jsonwebtoken');
const { authenticateToken, requireCompanyAdmin } = require('../../../src/middleware/auth');

describe('Middleware - Auth', () => {
  let req, res, next;
  
  beforeEach(() => {
    req = {
      headers: {},
      user: null
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    next = jest.fn();
  });
  
  describe('authenticateToken', () => {
    it('should authenticate valid token', () => {
      const user = { id: 1, email: 'test@test.com', role: 'user' };
      const token = jwt.sign(user, process.env.JWT_SECRET);
      req.headers.authorization = `Bearer ${token}`;
      
      authenticateToken(req, res, next);
      
      expect(req.user).toBeDefined();
      expect(req.user.id).toBe(1);
      expect(next).toHaveBeenCalled();
    });
    
    it('should reject missing token', () => {
      authenticateToken(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.stringContaining('Token')
        })
      );
      expect(next).not.toHaveBeenCalled();
    });
    
    it('should reject invalid token', () => {
      req.headers.authorization = 'Bearer invalid_token';
      
      authenticateToken(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });
    
    it('should reject expired token', () => {
      const user = { id: 1, email: 'test@test.com' };
      const token = jwt.sign(user, process.env.JWT_SECRET, { expiresIn: '-1h' });
      req.headers.authorization = `Bearer ${token}`;
      
      authenticateToken(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(403);
    });
  });
  
  describe('requireCompanyAdmin', () => {
    it('should allow company_admin', () => {
      req.user = { id: 1, role: 'company_admin' };
      
      requireCompanyAdmin(req, res, next);
      
      expect(next).toHaveBeenCalled();
    });
    
    it('should allow super_admin', () => {
      req.user = { id: 1, role: 'super_admin' };
      
      requireCompanyAdmin(req, res, next);
      
      expect(next).toHaveBeenCalled();
    });
    
    it('should reject regular user', () => {
      req.user = { id: 1, role: 'user' };
      
      requireCompanyAdmin(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });
  });
});
```

### 3️⃣ Teste de Integração: ProductController

**Arquivo:** `tests/integration/controllers/ProductController.test.js`

```javascript
const request = require('supertest');
const app = require('../../../src/handler');
const dbHelper = require('../../helpers/database');

describe('ProductController - Integration Tests', () => {
  let company, user, token;
  
  beforeEach(async () => {
    // Criar empresa e usuário de teste
    company = await dbHelper.createTestCompany();
    user = await dbHelper.createTestUser(company.id, {
      role: 'company_admin'
    });
    token = dbHelper.generateTestToken(user);
  });
  
  describe('POST /products', () => {
    it('should create product with valid data', async () => {
      const productData = {
        name: 'Notebook Dell',
        description: 'Notebook para desenvolvimento',
        price: 3500.00,
        stock: 10,
        category: 'electronics'
      };
      
      const response = await request(app)
        .post('/dev/products')
        .set('Authorization', `Bearer ${token}`)
        .send(productData)
        .expect(201);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        name: productData.name,
        price: productData.price,
        company_id: company.id
      });
      expect(response.body.data.id).toBeDefined();
    });
    
    it('should reject product without authentication', async () => {
      const response = await request(app)
        .post('/dev/products')
        .send({ name: 'Test' })
        .expect(401);
      
      expect(response.body.success).toBe(false);
    });
    
    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/dev/products')
        .set('Authorization', `Bearer ${token}`)
        .send({ price: 100 }) // Falta name
        .expect(400);
      
      expect(response.body.success).toBe(false);
      expect(response.body.message).toMatch(/name/i);
    });
    
    it('should validate price format', async () => {
      const response = await request(app)
        .post('/dev/products')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Test Product',
          price: -100 // Preço negativo
        })
        .expect(400);
      
      expect(response.body.success).toBe(false);
    });
  });
  
  describe('GET /products', () => {
    beforeEach(async () => {
      // Criar produtos de teste
      await dbHelper.createTestProduct(company.id, { name: 'Product 1', price: 100 });
      await dbHelper.createTestProduct(company.id, { name: 'Product 2', price: 200 });
      await dbHelper.createTestProduct(company.id, { name: 'Product 3', price: 300 });
    });
    
    it('should list all products with pagination', async () => {
      const response = await request(app)
        .get('/dev/products?page=1&limit=10')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeArray();
      expect(response.body.data).toHaveLength(3);
      expect(response.body.pagination).toMatchObject({
        page: 1,
        limit: 10,
        total: 3
      });
    });
    
    it('should filter products by search', async () => {
      const response = await request(app)
        .get('/dev/products?search=Product 1')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].name).toBe('Product 1');
    });
    
    it('should respect multi-tenancy', async () => {
      // Criar outra empresa
      const otherCompany = await dbHelper.createTestCompany({ name: 'Other Company' });
      await dbHelper.createTestProduct(otherCompany.id, { name: 'Other Product' });
      
      const response = await request(app)
        .get('/dev/products')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      
      // Deve retornar apenas produtos da empresa do usuário
      expect(response.body.data).toHaveLength(3);
      expect(response.body.data.every(p => p.company_id === company.id)).toBe(true);
    });
  });
  
  describe('GET /products/:id', () => {
    it('should get product by id', async () => {
      const product = await dbHelper.createTestProduct(company.id);
      
      const response = await request(app)
        .get(`/dev/products/${product.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(product.id);
    });
    
    it('should return 404 for non-existent product', async () => {
      const response = await request(app)
        .get('/dev/products/99999')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
      
      expect(response.body.success).toBe(false);
    });
    
    it('should not access product from other company', async () => {
      const otherCompany = await dbHelper.createTestCompany();
      const otherProduct = await dbHelper.createTestProduct(otherCompany.id);
      
      const response = await request(app)
        .get(`/dev/products/${otherProduct.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(404); // Ou 403, dependendo da implementação
    });
  });
  
  describe('PUT /products/:id', () => {
    it('should update product', async () => {
      const product = await dbHelper.createTestProduct(company.id);
      
      const response = await request(app)
        .put(`/dev/products/${product.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ price: 999.99 })
        .expect(200);
      
      expect(response.body.data.price).toBe('999.99');
    });
  });
  
  describe('DELETE /products/:id', () => {
    it('should soft delete product', async () => {
      const product = await dbHelper.createTestProduct(company.id);
      
      await request(app)
        .delete(`/dev/products/${product.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      
      // Verificar que foi soft deleted
      const result = await global.testPool.query(
        'SELECT status FROM polox.products WHERE id = $1',
        [product.id]
      );
      
      expect(result.rows[0].status).toBe('inactive');
    });
  });
});
```

### 4️⃣ Teste E2E: Lead to Sale Flow

**Arquivo:** `tests/e2e/lead-to-sale-flow.test.js`

```javascript
const request = require('supertest');
const app = require('../../src/handler');
const dbHelper = require('../helpers/database');

describe('E2E - Lead to Sale Flow', () => {
  let company, adminUser, salesUser, adminToken, salesToken;
  
  beforeAll(async () => {
    // Setup completo
    company = await dbHelper.createTestCompany();
    adminUser = await dbHelper.createTestUser(company.id, {
      role: 'company_admin',
      email: 'admin@test.com'
    });
    salesUser = await dbHelper.createTestUser(company.id, {
      role: 'sales',
      email: 'sales@test.com'
    });
    
    adminToken = dbHelper.generateTestToken(adminUser);
    salesToken = dbHelper.generateTestToken(salesUser);
  });
  
  it('should complete full lead to sale flow', async () => {
    // 1. Criar Lead
    const leadResponse = await request(app)
      .post('/dev/leads')
      .set('Authorization', `Bearer ${salesToken}`)
      .send({
        name: 'João Silva',
        email: 'joao@example.com',
        phone: '11999999999',
        source: 'website',
        status: 'new'
      })
      .expect(201);
    
    const leadId = leadResponse.body.data.id;
    expect(leadId).toBeDefined();
    
    // 2. Adicionar nota ao lead
    await request(app)
      .post(`/dev/leads/${leadId}/notes`)
      .set('Authorization', `Bearer ${salesToken}`)
      .send({
        content: 'Cliente interessado em notebook'
      })
      .expect(201);
    
    // 3. Atualizar status do lead
    await request(app)
      .put(`/dev/leads/${leadId}`)
      .set('Authorization', `Bearer ${salesToken}`)
      .send({
        status: 'qualified'
      })
      .expect(200);
    
    // 4. Converter lead em cliente
    const clientResponse = await request(app)
      .post(`/dev/leads/${leadId}/convert`)
      .set('Authorization', `Bearer ${salesToken}`)
      .expect(200);
    
    const clientId = clientResponse.body.data.client.id;
    expect(clientId).toBeDefined();
    
    // 5. Criar produto
    const productResponse = await request(app)
      .post('/dev/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Notebook Dell',
        price: 3500.00,
        stock: 10
      })
      .expect(201);
    
    const productId = productResponse.body.data.id;
    
    // 6. Criar venda
    const saleResponse = await request(app)
      .post('/dev/sales')
      .set('Authorization', `Bearer ${salesToken}`)
      .send({
        client_id: clientId,
        items: [
          {
            product_id: productId,
            quantity: 1,
            unit_price: 3500.00
          }
        ],
        payment_method: 'credit_card',
        status: 'completed'
      })
      .expect(201);
    
    const saleId = saleResponse.body.data.id;
    expect(saleResponse.body.data.total).toBe(3500.00);
    
    // 7. Verificar gamificação (XP ganho)
    const gamificationResponse = await request(app)
      .get('/dev/gamification/history')
      .set('Authorization', `Bearer ${salesToken}`)
      .expect(200);
    
    const saleXp = gamificationResponse.body.data.find(
      h => h.action === 'sale_completed' && h.reference_id === saleId
    );
    
    expect(saleXp).toBeDefined();
    expect(saleXp.xp_earned).toBeGreaterThan(0);
    
    // 8. Verificar estoque atualizado
    const productCheckResponse = await request(app)
      .get(`/dev/products/${productId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    
    expect(productCheckResponse.body.data.stock).toBe(9); // 10 - 1
    
    // 9. Verificar lead status
    const leadCheckResponse = await request(app)
      .get(`/dev/leads/${leadId}`)
      .set('Authorization', `Bearer ${salesToken}`)
      .expect(200);
    
    expect(leadCheckResponse.body.data.status).toBe('converted');
  });
});
```

### 5️⃣ Teste de Multi-tenancy

**Arquivo:** `tests/integration/multi-tenancy.test.js`

```javascript
const request = require('supertest');
const app = require('../../src/handler');
const dbHelper = require('../helpers/database');

describe('Multi-tenancy Isolation', () => {
  let companyA, companyB, userA, userB, tokenA, tokenB;
  
  beforeEach(async () => {
    // Criar duas empresas
    companyA = await dbHelper.createTestCompany({ name: 'Company A' });
    companyB = await dbHelper.createTestCompany({ name: 'Company B' });
    
    // Criar usuários
    userA = await dbHelper.createTestUser(companyA.id);
    userB = await dbHelper.createTestUser(companyB.id);
    
    // Gerar tokens
    tokenA = dbHelper.generateTestToken(userA);
    tokenB = dbHelper.generateTestToken(userB);
  });
  
  it('should isolate products between companies', async () => {
    // Company A cria produto
    const productA = await request(app)
      .post('/dev/products')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: 'Product A', price: 100 })
      .expect(201);
    
    // Company B não deve ver produto de Company A
    const listB = await request(app)
      .get('/dev/products')
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200);
    
    expect(listB.body.data).toHaveLength(0);
    
    // Company B não deve acessar produto de Company A
    await request(app)
      .get(`/dev/products/${productA.body.data.id}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(404);
  });
  
  it('should isolate clients between companies', async () => {
    // Company A cria cliente
    const clientA = await dbHelper.createTestClient(companyA.id);
    
    // Company B não deve ver
    const listB = await request(app)
      .get('/dev/clients')
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200);
    
    expect(listB.body.data).toHaveLength(0);
  });
  
  it('should prevent cross-company data manipulation', async () => {
    const productA = await dbHelper.createTestProduct(companyA.id);
    
    // Company B tenta atualizar produto de Company A
    await request(app)
      .put(`/dev/products/${productA.id}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ price: 999 })
      .expect(404); // Ou 403
    
    // Company B tenta deletar produto de Company A
    await request(app)
      .delete(`/dev/products/${productA.id}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(404); // Ou 403
  });
});
```

---

## 📦 ESTRUTURA FINAL DE TESTES

```
tests/
├── setup.js                          # Configuração global
├── helpers/
│   ├── database.js                   # Helper para DB de teste
│   ├── auth.js                       # Helper para autenticação
│   └── fixtures.js                   # Dados fake para testes
│
├── unit/                             # 40% da cobertura
│   ├── utils/
│   │   ├── formatters.test.js
│   │   ├── validators.test.js
│   │   ├── logger.test.js
│   │   └── errors.test.js
│   ├── middleware/
│   │   ├── auth.test.js
│   │   ├── security.test.js
│   │   ├── tenant.test.js
│   │   └── rateLimiter.test.js
│   └── services/
│       ├── ClientService.test.js
│       ├── ProductService.test.js
│       ├── SaleService.test.js
│       └── UserService.test.js
│
├── integration/                      # 50% da cobertura
│   ├── controllers/
│   │   ├── ClientController.test.js
│   │   ├── CompanyController.test.js
│   │   ├── LeadController.test.js
│   │   ├── ProductController.test.js
│   │   ├── SaleController.test.js
│   │   ├── UserController.test.js
│   │   ├── TicketController.test.js
│   │   ├── FinanceController.test.js
│   │   ├── GamificationController.test.js
│   │   ├── ScheduleController.test.js
│   │   ├── NotificationController.test.js
│   │   └── SupplierController.test.js
│   ├── routes/
│   │   ├── clients.routes.test.js
│   │   └── products.routes.test.js
│   └── multi-tenancy.test.js
│
└── e2e/                              # 10% da cobertura
    ├── auth-flow.test.js
    ├── lead-to-sale-flow.test.js
    ├── gamification-flow.test.js
    └── i18n-flow.test.js
```

---

## 🚀 PLANO DE IMPLEMENTAÇÃO (3 SEMANAS)

### 📅 Semana 1: Setup + Testes Unitários

**Dias 1-2: Configuração**
- [ ] Instalar dependências de teste
- [ ] Configurar jest.config.js
- [ ] Criar tests/setup.js
- [ ] Criar database helper
- [ ] Configurar banco de teste

**Dias 3-5: Testes Unitários**
- [ ] Utils (formatters, validators, logger)
- [ ] Middleware (auth, security, tenant)
- [ ] Response helpers

**Meta:** 20% de cobertura

### 📅 Semana 2: Testes de Integração (Controllers)

**Dias 1-5: Controllers mais importantes**
- [ ] ProductController (completo)
- [ ] ClientController (completo)
- [ ] SaleController (completo)
- [ ] UserController (completo)
- [ ] LeadController (completo)

**Meta:** 50% de cobertura

### 📅 Semana 3: Testes de Integração + E2E

**Dias 1-3: Controllers restantes**
- [ ] TicketController
- [ ] FinanceController
- [ ] GamificationController
- [ ] Restantes

**Dias 4-5: Testes E2E**
- [ ] Lead to Sale flow
- [ ] Auth flow
- [ ] Multi-tenancy isolation
- [ ] i18n flow

**Meta:** 70% de cobertura

---

## 📊 SCRIPTS NPM

Adicionar ao `package.json`:

```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:unit": "jest tests/unit",
    "test:integration": "jest tests/integration",
    "test:e2e": "jest tests/e2e",
    "test:ci": "jest --ci --coverage --maxWorkers=2",
    "test:debug": "node --inspect-brk node_modules/.bin/jest --runInBand"
  }
}
```

---

## 🎯 MÉTRICAS DE SUCESSO

### Cobertura Mínima (70%)

```javascript
// jest.config.js
coverageThreshold: {
  global: {
    branches: 70,
    functions: 70,
    lines: 70,
    statements: 70
  },
  // Por tipo de arquivo
  './src/controllers/': {
    branches: 80,
    functions: 80,
    lines: 80
  },
  './src/middleware/': {
    branches: 85,
    functions: 85,
    lines: 85
  },
  './src/utils/': {
    branches: 90,
    functions: 90,
    lines: 90
  }
}
```

### Performance

- ⚡ Testes unitários: < 10ms cada
- ⚡ Testes integração: < 100ms cada
- ⚡ Testes E2E: < 1s cada
- ⚡ Suite completa: < 2 minutos

### Qualidade

- ✅ Zero flaky tests (testes instáveis)
- ✅ 100% dos testes passando
- ✅ Cobertura de casos felizes e edge cases
- ✅ Testes de erro e validação

---

## 🔧 CI/CD Integration

### GitHub Actions

**Arquivo:** `.github/workflows/tests.yml`

```yaml
name: Tests

on:
  push:
    branches: [main, dev]
  pull_request:
    branches: [main, dev]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: app_polox_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run tests
        env:
          NODE_ENV: test
          DB_HOST: localhost
          DB_PORT: 5432
          DB_NAME: app_polox_test
          DB_USER: postgres
          DB_PASSWORD: postgres
          JWT_SECRET: test_secret
        run: npm run test:ci
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
          fail_ci_if_error: true
      
      - name: Check coverage threshold
        run: |
          COVERAGE=$(node -pe "require('./coverage/coverage-summary.json').total.lines.pct")
          if (( $(echo "$COVERAGE < 70" | bc -l) )); then
            echo "Coverage $COVERAGE% is below 70%"
            exit 1
          fi
```

---

## ✅ CHECKLIST DE IMPLEMENTAÇÃO

### Setup
- [ ] Instalar dependências de teste
- [ ] Configurar jest.config.js
- [ ] Criar setup.js com mocks globais
- [ ] Configurar banco de teste PostgreSQL
- [ ] Criar database helper
- [ ] Criar auth helper
- [ ] Criar fixtures helper

### Testes Unitários
- [ ] Utils (validators, formatters, logger, errors)
- [ ] Middleware (auth, security, tenant, rateLimiter)
- [ ] Response helpers
- [ ] Config helpers

### Testes de Integração
- [ ] ProductController (CRUD + business logic)
- [ ] ClientController (CRUD + notes)
- [ ] SaleController (create + items + payment)
- [ ] UserController (CRUD + permissions)
- [ ] LeadController (CRUD + conversion)
- [ ] TicketController
- [ ] FinanceController
- [ ] GamificationController
- [ ] ScheduleController
- [ ] NotificationController
- [ ] SupplierController
- [ ] Multi-tenancy isolation

### Testes E2E
- [ ] Auth flow (login, logout, refresh)
- [ ] Lead to Sale flow (completo)
- [ ] Gamification flow (XP, coins, achievements)
- [ ] i18n flow (pt, en, es)

### CI/CD
- [ ] GitHub Actions configurado
- [ ] Testes rodando no CI
- [ ] Coverage report
- [ ] Badge de cobertura no README

### Documentação
- [ ] README com instruções de teste
- [ ] Documentar helpers
- [ ] Exemplos de testes
- [ ] Guia de contribuição

---

## 🎓 BOAS PRÁTICAS

### 1. AAA Pattern (Arrange, Act, Assert)

```javascript
it('should create product', async () => {
  // Arrange - Preparar
  const productData = { name: 'Test', price: 100 };
  
  // Act - Executar
  const response = await request(app)
    .post('/products')
    .send(productData);
  
  // Assert - Verificar
  expect(response.status).toBe(201);
  expect(response.body.data.name).toBe('Test');
});
```

### 2. Testes Isolados

```javascript
// ❌ Ruim - depende de ordem
it('should create product', async () => { /* ... */ });
it('should update product', async () => {
  // Depende do produto criado no teste anterior
});

// ✅ Bom - cada teste é independente
it('should update product', async () => {
  const product = await createTestProduct(); // Setup próprio
  // ...
});
```

### 3. Nomenclatura Clara

```javascript
// ❌ Ruim
it('test 1', () => { /* ... */ });

// ✅ Bom
it('should validate email format correctly', () => { /* ... */ });
it('should reject invalid email addresses', () => { /* ... */ });
it('should handle edge cases with special characters', () => { /* ... */ });
```

### 4. DRY (Don't Repeat Yourself)

```javascript
// Use helpers e factories
const createAuthenticatedRequest = (token) => {
  return request(app).set('Authorization', `Bearer ${token}`);
};

it('should list products', async () => {
  const response = await createAuthenticatedRequest(token)
    .get('/products')
    .expect(200);
});
```

---

## 📚 RECURSOS E REFERÊNCIAS

- **Jest Documentation:** https://jestjs.io/
- **Supertest:** https://github.com/visionmedia/supertest
- **Testing Best Practices:** https://testingjavascript.com/
- **Test Patterns:** https://martinfowler.com/articles/practical-test-pyramid.html

---

**Próximos Passos:**
1. Revisar e aprovar esta estratégia
2. Começar implementação pela Semana 1
3. Code review semanal
4. Ajustar métricas conforme necessário

**Objetivo:** 70% de cobertura em 3 semanas ✅
