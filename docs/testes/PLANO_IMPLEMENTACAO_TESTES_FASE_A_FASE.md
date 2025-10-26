# 🚀 Plano de Implementação de Testes - FASE POR FASE

**Data:** 26 de outubro de 2025  
**Objetivo:** Implementar 70% de cobertura de testes em 3 semanas  
**Status:** ✅ Configuração Base Concluída

---

## ✅ FASE 1: CONFIGURAÇÃO E PREPARAÇÃO CRÍTICA (CONCLUÍDA)

### 📁 Estrutura de Pastas Criada

```
tests/
├── setup.js                        ✅ CRIADO
├── helpers/
│   └── database.js                 ✅ CRIADO
├── unit/                           ✅ CRIADO
├── integration/                    ✅ CRIADO
└── e2e/                            ✅ CRIADO

src/
└── server-test.js                  ✅ ATUALIZADO
```

### ⚙️ Arquivos de Configuração

#### ✅ `tests/setup.js` - Setup Global
**Responsabilidades Implementadas:**
- [x] Configuração de variáveis de ambiente (NODE_ENV=test)
- [x] Conexão com banco de teste (app_polox_test)
- [x] Criação automática do banco se não existir
- [x] Execução automática de migrations
- [x] Limpeza de dados (TRUNCATE) em afterEach
- [x] Mocks globais (AWS Secrets Manager, Sentry, Logger)
- [x] Silenciar logs durante testes

**Hooks Implementados:**
- `beforeAll()` - Criar banco, rodar migrations, limpar dados
- `afterEach()` - Limpar users e companies (isolamento)
- `afterAll()` - Limpeza final e fechar conexões

#### ✅ `tests/helpers/database.js` - Database Helper
**Funções Implementadas:**
- [x] `createTestCompany()` - Criar empresa de teste
- [x] `createTestUser()` - Criar usuário comum
- [x] `createTestAdmin()` - Criar usuário admin
- [x] `createTestSuperAdmin()` - Criar super admin
- [x] `createTestClient()` - Criar cliente
- [x] `createTestLead()` - Criar lead
- [x] `createTestProduct()` - Criar produto
- [x] `createTestSale()` - Criar venda
- [x] `generateTestToken()` - Gerar JWT para testes
- [x] `cleanDatabase()` - Limpar todas as tabelas
- [x] `generateCNPJ()` / `generateCPF()` - Gerar docs fake

#### ✅ `src/server-test.js` - Express para Testes
**Características:**
- [x] Instância Express sem listener HTTP
- [x] Usado por Supertest para requisições simuladas
- [x] Middlewares simplificados (sem Sentry real)
- [x] CORS aberto para testes
- [x] Logs silenciados (NODE_ENV=test)
- [x] Rotas da API registradas
- [x] Error handling configurado

#### ✅ `jest.config.json` - Configuração Jest
**Configurações:**
- [x] testEnvironment: node
- [x] setupFilesAfterEnv: tests/setup.js
- [x] Coverage configurado (70% threshold)
- [x] Timeout: 30s para testes longos

---

## 📋 FASE 2: TESTES UNITÁRIOS E SERVICES (PRÓXIMA ETAPA)

### 🎯 Objetivos da Fase 2

1. **Mover lógica de negócio para Services**
2. **Criar testes unitários para utils e services**
3. **Atingir 20-30% de cobertura**

### 📝 Tarefas a Fazer

#### 2.1 Criar LeadService.js

**Arquivo:** `src/services/LeadService.js`

**Responsabilidades:**
- Mover `convertToClient()` do LeadController para Service
- Centralizar lógica de negócio de leads
- Facilitar testes isolados

**Exemplo de Implementação:**

```javascript
class LeadService {
  /**
   * Converter lead para cliente
   */
  static async convertToClient(leadId, clientData, companyId) {
    // Buscar lead
    const lead = await LeadModel.findById(leadId, companyId);
    
    if (!lead) {
      throw new ApiError(404, 'Lead não encontrado');
    }
    
    if (lead.converted_to_client_id) {
      throw new ApiError(400, 'Lead já foi convertido');
    }
    
    // Criar cliente
    const client = await ClientModel.create({
      ...clientData,
      company_id: companyId,
    });
    
    // Atualizar lead
    await LeadModel.update(leadId, {
      status: 'converted',
      converted_to_client_id: client.id,
      converted_at: new Date(),
    }, companyId);
    
    // Adicionar XP para usuário (gamificação)
    if (lead.owner_id) {
      await GamificationService.addXP(
        lead.owner_id,
        50, // XP por conversão
        'lead_conversion',
        leadId,
        companyId
      );
    }
    
    return { lead, client };
  }
}
```

**Checklist:**
- [ ] Criar `src/services/LeadService.js`
- [ ] Mover `convertToClient()` para o service
- [ ] Atualizar `LeadController.js` para usar o service
- [ ] Testar manualmente no Postman

---

#### 2.2 Criar AuthService.js

**Arquivo:** `src/services/AuthService.js`

**Responsabilidades:**
- Lógica de registro de usuário
- Lógica de login
- Validação de credenciais
- Geração de tokens

**Exemplo:**

```javascript
class AuthService {
  /**
   * Registrar novo usuário
   */
  static async register(data) {
    // Verificar se email já existe
    const existingUser = await UserModel.findByEmail(data.email);
    if (existingUser) {
      throw new ApiError(409, 'Email já cadastrado');
    }
    
    // Hash da senha
    const hashedPassword = await bcrypt.hash(data.password, 12);
    
    // Criar usuário
    const user = await UserModel.create({
      ...data,
      password_hash: hashedPassword,
    });
    
    // Remover senha da resposta
    delete user.password_hash;
    
    return user;
  }
  
  /**
   * Fazer login
   */
  static async login(email, password) {
    // Buscar usuário
    const user = await UserModel.findByEmail(email);
    if (!user) {
      throw new ApiError(401, 'Credenciais inválidas');
    }
    
    // Verificar senha
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      throw new ApiError(401, 'Credenciais inválidas');
    }
    
    // Gerar token
    const token = this.generateToken(user);
    
    return { user, token };
  }
  
  /**
   * Gerar JWT token
   */
  static generateToken(user) {
    return jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.user_role,
        companyId: user.company_id,
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
  }
}
```

**Checklist:**
- [ ] Criar `src/services/AuthService.js`
- [ ] Mover lógica de `authController.js` para service
- [ ] Atualizar controller para usar service
- [ ] Testar manualmente

---

#### 2.3 Testes Unitários - Utils

##### Teste: `tests/unit/utils/validators.test.js`

```javascript
const { validateEmail, validateCPF, validateCNPJ } = require('../../../src/utils/validators');

describe('Utils - Validators', () => {
  describe('validateEmail', () => {
    it('should validate correct email', () => {
      expect(validateEmail('test@example.com')).toBe(true);
      expect(validateEmail('user@domain.co')).toBe(true);
    });
    
    it('should reject invalid email', () => {
      expect(validateEmail('invalid')).toBe(false);
      expect(validateEmail('test@')).toBe(false);
      expect(validateEmail('')).toBe(false);
    });
  });
  
  describe('validateCPF', () => {
    it('should validate correct CPF', () => {
      expect(validateCPF('123.456.789-09')).toBe(true);
    });
    
    it('should reject invalid CPF', () => {
      expect(validateCPF('000.000.000-00')).toBe(false);
      expect(validateCPF('12345')).toBe(false);
    });
  });
});
```

**Checklist:**
- [ ] Criar `tests/unit/utils/validators.test.js`
- [ ] Testar `validateEmail()`
- [ ] Testar `validateCPF()`
- [ ] Testar `validateCNPJ()`
- [ ] Testar `validatePhone()`

---

##### Teste: `tests/unit/utils/formatters.test.js`

```javascript
const { formatCurrency, formatDate, formatPhone } = require('../../../src/utils/formatters');

describe('Utils - Formatters', () => {
  describe('formatCurrency', () => {
    it('should format Brazilian currency', () => {
      expect(formatCurrency(1000)).toBe('R$ 1.000,00');
      expect(formatCurrency(1234.56)).toBe('R$ 1.234,56');
    });
    
    it('should handle zero', () => {
      expect(formatCurrency(0)).toBe('R$ 0,00');
    });
  });
  
  describe('formatDate', () => {
    it('should format date to Brazilian format', () => {
      const date = new Date('2025-10-26');
      expect(formatDate(date)).toBe('26/10/2025');
    });
  });
  
  describe('formatPhone', () => {
    it('should format phone number', () => {
      expect(formatPhone('11999999999')).toBe('(11) 99999-9999');
      expect(formatPhone('1133333333')).toBe('(11) 3333-3333');
    });
  });
});
```

**Checklist:**
- [ ] Criar `tests/unit/utils/formatters.test.js`
- [ ] Testar `formatCurrency()`
- [ ] Testar `formatDate()`
- [ ] Testar `formatPhone()`

---

#### 2.4 Testes Unitários - Services

##### Teste: `tests/unit/services/AuthService.test.js`

```javascript
const AuthService = require('../../../src/services/AuthService');
const UserModel = require('../../../src/models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Mockar dependências
jest.mock('../../../src/models/User');
jest.mock('bcryptjs');
jest.mock('jsonwebtoken');

describe('AuthService', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });
  
  describe('register', () => {
    it('should register new user successfully', async () => {
      // Arrange
      const userData = {
        name: 'Test User',
        email: 'test@test.com',
        password: 'Test@123',
      };
      
      UserModel.findByEmail.mockResolvedValue(null); // Email não existe
      bcrypt.hash.mockResolvedValue('hashed_password');
      UserModel.create.mockResolvedValue({
        id: 1,
        name: 'Test User',
        email: 'test@test.com',
      });
      
      // Act
      const user = await AuthService.register(userData);
      
      // Assert
      expect(user).toHaveProperty('id');
      expect(user.email).toBe('test@test.com');
      expect(UserModel.findByEmail).toHaveBeenCalledWith('test@test.com');
      expect(bcrypt.hash).toHaveBeenCalledWith('Test@123', 12);
    });
    
    it('should throw error if email already exists', async () => {
      // Arrange
      UserModel.findByEmail.mockResolvedValue({ id: 1, email: 'test@test.com' });
      
      // Act & Assert
      await expect(
        AuthService.register({
          email: 'test@test.com',
          password: 'Test@123',
        })
      ).rejects.toThrow('Email já cadastrado');
    });
  });
  
  describe('login', () => {
    it('should login successfully with valid credentials', async () => {
      // Arrange
      const user = {
        id: 1,
        email: 'test@test.com',
        password_hash: 'hashed_password',
        user_role: 'admin',
      };
      
      UserModel.findByEmail.mockResolvedValue(user);
      bcrypt.compare.mockResolvedValue(true);
      jwt.sign.mockReturnValue('fake_token');
      
      // Act
      const result = await AuthService.login('test@test.com', 'Test@123');
      
      // Assert
      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('token');
      expect(result.token).toBe('fake_token');
      expect(bcrypt.compare).toHaveBeenCalledWith('Test@123', 'hashed_password');
    });
    
    it('should throw error with invalid password', async () => {
      // Arrange
      UserModel.findByEmail.mockResolvedValue({
        id: 1,
        password_hash: 'hashed_password',
      });
      bcrypt.compare.mockResolvedValue(false);
      
      // Act & Assert
      await expect(
        AuthService.login('test@test.com', 'WrongPassword')
      ).rejects.toThrow('Credenciais inválidas');
    });
  });
});
```

**Checklist:**
- [ ] Criar `tests/unit/services/AuthService.test.js`
- [ ] Testar `register()` - sucesso
- [ ] Testar `register()` - email já existe
- [ ] Testar `login()` - sucesso
- [ ] Testar `login()` - senha inválida
- [ ] Testar `generateToken()`

---

##### Teste: `tests/unit/services/LeadService.test.js`

```javascript
const LeadService = require('../../../src/services/LeadService');
const LeadModel = require('../../../src/models/Lead');
const ClientModel = require('../../../src/models/Client');

jest.mock('../../../src/models/Lead');
jest.mock('../../../src/models/Client');

describe('LeadService', () => {
  describe('convertToClient', () => {
    it('should convert lead to client successfully', async () => {
      // Arrange
      const lead = {
        id: 1,
        name: 'Lead Name',
        email: 'lead@test.com',
        converted_to_client_id: null,
      };
      
      LeadModel.findById.mockResolvedValue(lead);
      ClientModel.create.mockResolvedValue({
        id: 10,
        name: 'Lead Name',
        email: 'lead@test.com',
      });
      LeadModel.update.mockResolvedValue(true);
      
      // Act
      const result = await LeadService.convertToClient(1, {}, 1);
      
      // Assert
      expect(result).toHaveProperty('lead');
      expect(result).toHaveProperty('client');
      expect(ClientModel.create).toHaveBeenCalled();
      expect(LeadModel.update).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ status: 'converted' }),
        1
      );
    });
    
    it('should throw error if lead not found', async () => {
      // Arrange
      LeadModel.findById.mockResolvedValue(null);
      
      // Act & Assert
      await expect(
        LeadService.convertToClient(999, {}, 1)
      ).rejects.toThrow('Lead não encontrado');
    });
    
    it('should throw error if lead already converted', async () => {
      // Arrange
      LeadModel.findById.mockResolvedValue({
        id: 1,
        converted_to_client_id: 10, // Já convertido
      });
      
      // Act & Assert
      await expect(
        LeadService.convertToClient(1, {}, 1)
      ).rejects.toThrow('Lead já foi convertido');
    });
  });
});
```

**Checklist:**
- [ ] Criar `tests/unit/services/LeadService.test.js`
- [ ] Testar `convertToClient()` - sucesso
- [ ] Testar `convertToClient()` - lead não encontrado
- [ ] Testar `convertToClient()` - lead já convertido

---

### 📊 Meta da Fase 2

- **Cobertura Esperada:** 20-30%
- **Tempo Estimado:** 1 semana
- **Arquivos a Criar:** 5-7 testes unitários

**Próximos Passos Após Fase 2:**
1. Validar cobertura com `npm run test:coverage`
2. Revisar code review
3. Passar para Fase 3 (Testes de Integração)

---

## 🚀 COMANDOS PARA EXECUTAR

```bash
# Instalar dependências (se necessário)
npm install

# Rodar todos os testes
npm test

# Rodar testes com coverage
npm run test:coverage

# Rodar apenas testes unitários
npm run test:unit

# Rodar testes em modo watch
npm run test:watch

# Rodar teste específico
npm test -- tests/unit/services/AuthService.test.js
```

---

## ✅ CHECKLIST GERAL DA FASE 2

### Services
- [ ] Criar `src/services/LeadService.js`
- [ ] Criar `src/services/AuthService.js`
- [ ] Atualizar controllers para usar services

### Testes Unitários - Utils
- [ ] `tests/unit/utils/validators.test.js`
- [ ] `tests/unit/utils/formatters.test.js`

### Testes Unitários - Services
- [ ] `tests/unit/services/AuthService.test.js`
- [ ] `tests/unit/services/LeadService.test.js`

### Validação
- [ ] Rodar `npm test` - todos os testes passando
- [ ] Rodar `npm run test:coverage` - verificar 20-30%
- [ ] Code review
- [ ] Commit changes

---

**Status Atual:** ✅ Fase 1 Concluída  
**Próximo Passo:** Iniciar Fase 2 - Criar Services e Testes Unitários  
**Prazo:** 1 semana para Fase 2
