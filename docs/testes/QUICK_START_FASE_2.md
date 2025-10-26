# 🚀 QUICK START - FASE 2: TESTES UNITÁRIOS

**Data:** 26/10/2025  
**Duração:** 1 semana  
**Meta:** 20-30% de cobertura  
**Status:** 📋 PRONTO PARA INICIAR

---

## ✅ PRÉ-REQUISITOS (JÁ CONCLUÍDOS)

- ✅ Estrutura de testes criada (`tests/unit/`, `tests/integration/`, `tests/e2e/`)
- ✅ Setup global implementado (`tests/setup.js` - 389 linhas)
- ✅ Test helpers implementados (`tests/helpers/database.js` - 339 linhas)
- ✅ Server de teste configurado (`src/server-test.js` - 90 linhas)
- ✅ Jest 29.7.0 e Supertest 6.3.3 instalados
- ✅ Banco de teste `app_polox_test` configurado

---

## 📋 CHECKLIST FASE 2

### 🔧 Refatoração (2 dias)

- [ ] **Tarefa 1:** Criar `src/services/LeadService.js`
  - [ ] Método `convertToClient(leadId, userId, companyId)`
  - [ ] Método `create(data, companyId)`
  - [ ] Método `update(id, data, companyId)`
  - [ ] Método `delete(id, companyId)`
  - [ ] Refatorar `src/controllers/LeadController.js`

- [ ] **Tarefa 2:** Criar `src/services/AuthService.js`
  - [ ] Método `register(data)`
  - [ ] Método `login(email, password)`
  - [ ] Método `generateToken(user)`
  - [ ] Método `validateToken(token)`
  - [ ] Refatorar `src/controllers/authController.js`

### 🧪 Testes Unitários - Utils (1 dia)

- [ ] **Tarefa 3:** Criar `tests/unit/utils/validators.test.js`
  - [ ] `validateEmail()` - 3+ casos
  - [ ] `validateCPF()` - 3+ casos
  - [ ] `validateCNPJ()` - 3+ casos

- [ ] **Tarefa 4:** Criar `tests/unit/utils/formatters.test.js`
  - [ ] `formatCurrency()` - 3+ casos
  - [ ] `formatDate()` - 3+ casos
  - [ ] `formatPhone()` - 3+ casos

### 🧪 Testes Unitários - Services (2 dias)

- [ ] **Tarefa 5:** Criar `tests/unit/services/AuthService.test.js`
  - [ ] `register()` - sucesso
  - [ ] `register()` - email duplicado (409)
  - [ ] `login()` - sucesso
  - [ ] `login()` - senha inválida (401)
  - [ ] `login()` - usuário não encontrado (404)
  - [ ] `generateToken()` - token válido

- [ ] **Tarefa 6:** Criar `tests/unit/services/LeadService.test.js`
  - [ ] `convertToClient()` - sucesso
  - [ ] `convertToClient()` - lead não encontrado (404)
  - [ ] `convertToClient()` - lead já convertido (400)
  - [ ] `create()` - sucesso
  - [ ] `create()` - validação falha (400)

### ✅ Validação (0.5 dia)

- [ ] `npm test` - todos os testes passando
- [ ] `npm run test:coverage` - verificar 20-30%
- [ ] Code review
- [ ] Commit: "feat: Phase 2 - Services and unit tests"

---

## 🚀 PASSO A PASSO

### PASSO 1: Criar LeadService.js (2 horas)

```bash
# Criar arquivo
touch src/services/LeadService.js
```

**Código base:**
```javascript
// src/services/LeadService.js
const LeadModel = require('../models/LeadModel');
const ClientModel = require('../models/ClientModel');
const GamificationService = require('./GamificationService');

class LeadService {
  /**
   * Converte um lead em cliente
   * @param {number} leadId - ID do lead
   * @param {number} userId - ID do usuário
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object>} Cliente criado
   */
  async convertToClient(leadId, userId, companyId) {
    // 1. Buscar lead
    const lead = await LeadModel.findByIdAndCompany(leadId, companyId);
    if (!lead) {
      throw new Error('Lead not found');
    }
    
    if (lead.status === 'converted') {
      throw new Error('Lead already converted');
    }
    
    // 2. Criar client a partir do lead
    const client = await ClientModel.create({
      company_id: companyId,
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
      address_street: lead.address_street,
      address_number: lead.address_number,
      address_complement: lead.address_complement,
      address_neighborhood: lead.address_neighborhood,
      address_city: lead.address_city,
      address_state: lead.address_state,
      address_zipcode: lead.address_zipcode,
      address_country: lead.address_country,
    });
    
    // 3. Atualizar lead
    await LeadModel.update(leadId, { 
      status: 'converted', 
      client_id: client.id 
    });
    
    // 4. Gamification (adicionar XP)
    try {
      await GamificationService.addXP(userId, 50, 'lead_conversion');
    } catch (error) {
      console.error('Gamification error:', error);
    }
    
    return client;
  }
}

module.exports = new LeadService();
```

**Refatorar LeadController.js:**
```javascript
// src/controllers/LeadController.js
const LeadService = require('../services/LeadService');

// Antes (50+ linhas de lógica)
async convertToClient(req, res) {
  const lead = await pool.query('SELECT ...');
  // ... muita lógica aqui ...
}

// Depois (3 linhas)
async convertToClient(req, res) {
  const client = await LeadService.convertToClient(
    req.params.id, req.user.id, req.user.companyId
  );
  res.ok(client, req.tc('lead.converted_successfully'));
}
```

---

### PASSO 2: Criar AuthService.js (2 horas)

```bash
# Criar arquivo
touch src/services/AuthService.js
```

**Código base:**
```javascript
// src/services/AuthService.js
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const UserModel = require('../models/UserModel');

class AuthService {
  /**
   * Registra novo usuário
   * @param {Object} data - { email, password, name, companyId }
   * @returns {Promise<Object>} Usuário criado
   */
  async register(data) {
    // 1. Verificar se email já existe
    const existingUser = await UserModel.findByEmail(data.email);
    if (existingUser) {
      throw new Error('Email already exists');
    }
    
    // 2. Hash da senha
    const hashedPassword = await bcrypt.hash(data.password, 12);
    
    // 3. Criar usuário
    const user = await UserModel.create({
      email: data.email,
      password: hashedPassword,
      name: data.name,
      company_id: data.companyId,
      role: data.role || 'user',
    });
    
    // 4. Remover senha do retorno
    delete user.password;
    
    return user;
  }
  
  /**
   * Faz login do usuário
   * @param {string} email - Email do usuário
   * @param {string} password - Senha do usuário
   * @returns {Promise<Object>} { user, token }
   */
  async login(email, password) {
    // 1. Buscar usuário
    const user = await UserModel.findByEmail(email);
    if (!user) {
      throw new Error('User not found');
    }
    
    // 2. Validar senha
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      throw new Error('Invalid password');
    }
    
    // 3. Gerar token
    const token = this.generateToken(user);
    
    // 4. Remover senha do retorno
    delete user.password;
    
    return { user, token };
  }
  
  /**
   * Gera token JWT
   * @param {Object} user - Usuário
   * @returns {string} Token JWT
   */
  generateToken(user) {
    return jwt.sign(
      { 
        id: user.id, 
        email: user.email, 
        companyId: user.company_id,
        role: user.role 
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
  }
}

module.exports = new AuthService();
```

---

### PASSO 3: Criar Testes Unitários (3 dias)

#### 3.1. Testes de Validators

```bash
mkdir -p tests/unit/utils
touch tests/unit/utils/validators.test.js
```

**Código:**
```javascript
// tests/unit/utils/validators.test.js
const { validateEmail, validateCPF, validateCNPJ } = require('../../../src/utils/validators');

describe('Validators', () => {
  describe('validateEmail', () => {
    it('deve validar email válido', () => {
      expect(validateEmail('test@example.com')).toBe(true);
      expect(validateEmail('user.name+tag@domain.co')).toBe(true);
    });
    
    it('deve rejeitar email inválido', () => {
      expect(validateEmail('invalid')).toBe(false);
      expect(validateEmail('invalid@')).toBe(false);
      expect(validateEmail('@domain.com')).toBe(false);
    });
  });
  
  describe('validateCPF', () => {
    it('deve validar CPF válido', () => {
      expect(validateCPF('123.456.789-09')).toBe(true);
      expect(validateCPF('12345678909')).toBe(true);
    });
    
    it('deve rejeitar CPF inválido', () => {
      expect(validateCPF('000.000.000-00')).toBe(false);
      expect(validateCPF('123')).toBe(false);
    });
  });
});
```

#### 3.2. Testes de AuthService

```bash
mkdir -p tests/unit/services
touch tests/unit/services/AuthService.test.js
```

**Código:**
```javascript
// tests/unit/services/AuthService.test.js
const AuthService = require('../../../src/services/AuthService');
const UserModel = require('../../../src/models/UserModel');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Mocks
jest.mock('../../../src/models/UserModel');
jest.mock('bcryptjs');
jest.mock('jsonwebtoken');

describe('AuthService', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });
  
  describe('register', () => {
    it('deve registrar novo usuário com sucesso', async () => {
      // Arrange
      UserModel.findByEmail.mockResolvedValue(null);
      bcrypt.hash.mockResolvedValue('hashedPassword123');
      UserModel.create.mockResolvedValue({
        id: 1,
        email: 'test@example.com',
        name: 'Test User',
        company_id: 1,
        role: 'user',
      });
      
      // Act
      const user = await AuthService.register({
        email: 'test@example.com',
        password: '123456',
        name: 'Test User',
        companyId: 1,
      });
      
      // Assert
      expect(user).toBeDefined();
      expect(user.id).toBe(1);
      expect(user.email).toBe('test@example.com');
      expect(bcrypt.hash).toHaveBeenCalledWith('123456', 12);
      expect(UserModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'test@example.com',
          password: 'hashedPassword123',
        })
      );
    });
    
    it('deve lançar erro se email já existe', async () => {
      // Arrange
      UserModel.findByEmail.mockResolvedValue({ id: 1, email: 'exists@test.com' });
      
      // Act & Assert
      await expect(AuthService.register({ email: 'exists@test.com' }))
        .rejects.toThrow('Email already exists');
    });
  });
  
  describe('login', () => {
    it('deve fazer login com sucesso', async () => {
      // Arrange
      const mockUser = {
        id: 1,
        email: 'test@example.com',
        password: 'hashedPassword123',
        company_id: 1,
        role: 'user',
      };
      
      UserModel.findByEmail.mockResolvedValue(mockUser);
      bcrypt.compare.mockResolvedValue(true);
      jwt.sign.mockReturnValue('token123');
      
      // Act
      const result = await AuthService.login('test@example.com', '123456');
      
      // Assert
      expect(result.user).toBeDefined();
      expect(result.token).toBe('token123');
      expect(bcrypt.compare).toHaveBeenCalledWith('123456', 'hashedPassword123');
    });
    
    it('deve lançar erro se senha inválida', async () => {
      // Arrange
      UserModel.findByEmail.mockResolvedValue({
        id: 1,
        email: 'test@example.com',
        password: 'hashedPassword123',
      });
      bcrypt.compare.mockResolvedValue(false);
      
      // Act & Assert
      await expect(AuthService.login('test@example.com', 'wrongpass'))
        .rejects.toThrow('Invalid password');
    });
  });
});
```

---

## 📊 VALIDAÇÃO

### Executar Testes

```bash
# Executar todos os testes
npm test

# Executar apenas testes unitários
npm run test:unit

# Executar com cobertura
npm run test:coverage

# Executar em modo watch (desenvolvimento)
npm run test:watch
```

### Verificar Cobertura

```bash
# Ver relatório no terminal
npm run test:coverage

# Abrir relatório HTML
open coverage/lcov-report/index.html
```

**Meta:** 20-30% de cobertura

---

## 📚 REFERÊNCIAS

- **Guia Completo:** `docs/atualizacoes/PLANO_IMPLEMENTACAO_TESTES_FASE_A_FASE.md` (900+ linhas)
- **Sumário Fase 1:** `docs/atualizacoes/SUMARIO_EXECUTIVO_FASE_1_CONCLUIDA.md`
- **Estratégia de Testes:** `docs/atualizacoes/ESTRATEGIA_TESTES_AUTOMATIZADOS_26_10_2025.md`

---

## 🎯 PRÓXIMA FASE

**Fase 3 (Semana 2):** Testes de Integração
- Testes com banco real (`app_polox_test`)
- Validação multi-tenancy isolation
- Validação i18n (Accept-Language)
- Testes de segurança (rate limiting, auth)
- Meta: 50-60% de cobertura

---

**🚀 Boa sorte na implementação!**
