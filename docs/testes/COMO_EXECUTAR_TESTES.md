# 🧪 COMO EXECUTAR TESTES - GUIA PRÁTICO

**Data:** 26/10/2025  
**Status:** Fase 1 implementada ✅  
**Próximo:** Fase 2 (criar testes)

---

## ⚡ COMANDOS RÁPIDOS

### 1. Executar TODOS os testes
```bash
npm test
```

### 2. Executar com relatório de cobertura
```bash
npm run test:coverage
```

### 3. Executar em modo watch (desenvolvimento)
```bash
npm run test:watch
```

### 4. Executar teste específico
```bash
npm test -- tests/unit/services/AuthService.test.js
```

### 5. Executar testes por padrão
```bash
# Todos os testes unitários
npm test -- tests/unit

# Todos os testes de integração
npm test -- tests/integration

# Todos os testes E2E
npm test -- tests/e2e
```

---

## 📊 STATUS ATUAL

### ✅ O que está pronto:
- ✅ Estrutura de testes (`tests/`, `tests/unit/`, `tests/integration/`, `tests/e2e/`)
- ✅ Setup global (`tests/setup.js` - 389 linhas)
- ✅ Test helpers (`tests/helpers/database.js` - 339 linhas)
- ✅ Server de teste (`src/server-test.js` - 90 linhas)
- ✅ Jest configurado (`jest.config.json`)

### 📋 O que falta (Fase 2):
- 📋 Criar testes unitários (validators, formatters, services)
- 📋 Criar services (LeadService, AuthService)
- 📋 Refatorar controllers

---

## 🧪 TESTANDO A INFRAESTRUTURA

### Passo 1: Verificar se Jest está funcionando

```bash
npm test
```

**Resultado esperado:**
```
No tests found, exiting with code 1
```
Isso é normal! Significa que o Jest está funcionando, mas ainda não há testes.

---

### Passo 2: Testar o Setup Global

Vamos criar um teste simples para validar:

```bash
# Criar arquivo de teste temporário
cat > tests/test-infrastructure.test.js << 'EOF'
describe('Infraestrutura de Testes', () => {
  it('deve conectar ao banco de teste', async () => {
    expect(global.testPool).toBeDefined();
  });
  
  it('deve ter DatabaseHelper disponível', () => {
    const DatabaseHelper = require('./helpers/database');
    expect(DatabaseHelper).toBeDefined();
  });
});
EOF

# Executar teste
npm test -- tests/test-infrastructure.test.js
```

**Resultado esperado:**
```
PASS  tests/test-infrastructure.test.js
  Infraestrutura de Testes
    ✓ deve conectar ao banco de teste (5 ms)
    ✓ deve ter DatabaseHelper disponível (2 ms)

Test Suites: 1 passed, 1 total
Tests:       2 passed, 2 total
```

---

### Passo 3: Testar DatabaseHelper

```bash
# Criar teste para DatabaseHelper
cat > tests/test-database-helper.test.js << 'EOF'
const DatabaseHelper = require('./helpers/database');

describe('DatabaseHelper', () => {
  let helper;
  
  beforeAll(() => {
    helper = new DatabaseHelper(global.testPool);
  });
  
  it('deve criar empresa de teste', async () => {
    const company = await helper.createTestCompany({
      name: 'Empresa Teste'
    });
    
    expect(company).toBeDefined();
    expect(company.id).toBeDefined();
    expect(company.name).toBe('Empresa Teste');
  });
  
  it('deve criar usuário de teste', async () => {
    const company = await helper.createTestCompany();
    const user = await helper.createTestUser(company.id, {
      email: 'test@example.com',
      password: '123456'
    });
    
    expect(user).toBeDefined();
    expect(user.id).toBeDefined();
    expect(user.email).toBe('test@example.com');
  });
  
  it('deve gerar token JWT', () => {
    const user = { id: 1, email: 'test@example.com', company_id: 1 };
    const token = helper.generateTestToken(user);
    
    expect(token).toBeDefined();
    expect(typeof token).toBe('string');
  });
});
EOF

# Executar teste
npm test -- tests/test-database-helper.test.js
```

---

### Passo 4: Testar Server de Teste (Supertest)

```bash
# Criar teste para server-test.js
cat > tests/test-server.test.js << 'EOF'
const request = require('supertest');
const app = require('../src/server-test');

describe('Server de Teste', () => {
  it('GET /health deve retornar 200', async () => {
    const res = await request(app).get('/health');
    
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
  
  it('GET / deve retornar info da API', async () => {
    const res = await request(app).get('/');
    
    expect(res.status).toBe(200);
    expect(res.body.message).toContain('Polox');
  });
  
  it('GET /rota-inexistente deve retornar 404', async () => {
    const res = await request(app).get('/rota-inexistente');
    
    expect(res.status).toBe(404);
  });
});
EOF

# Executar teste
npm test -- tests/test-server.test.js
```

---

## 📊 VER COBERTURA DE CÓDIGO

### Gerar relatório de cobertura

```bash
npm run test:coverage
```

**Saída esperada:**
```
----------------------|---------|----------|---------|---------|-------------------
File                  | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s 
----------------------|---------|----------|---------|---------|-------------------
All files             |       0 |        0 |       0 |       0 |                   
----------------------|---------|----------|---------|---------|-------------------

Test Suites: 0 passed, 0 total
Tests:       0 passed, 0 total
```

Após criar testes na Fase 2, você verá algo como:
```
----------------------|---------|----------|---------|---------|-------------------
File                  | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s 
----------------------|---------|----------|---------|---------|-------------------
All files             |   25.5  |   18.2   |   30.1  |   26.3  |                   
 services             |   45.0  |   35.0   |   50.0  |   46.2  |                   
  AuthService.js      |   80.0  |   70.0   |   85.0  |   82.1  | 45-52,78-82       
  LeadService.js      |   75.0  |   65.0   |   80.0  |   76.3  | 34-41,89-95       
 utils                |   15.2  |   10.5   |   18.3  |   16.1  |                   
  validators.js       |   60.0  |   50.0   |   65.0  |   62.5  | 12-18,34-40       
----------------------|---------|----------|---------|---------|-------------------
```

### Abrir relatório HTML

```bash
# Gerar cobertura
npm run test:coverage

# Abrir no navegador (macOS)
open coverage/lcov-report/index.html

# Linux
xdg-open coverage/lcov-report/index.html

# Windows
start coverage/lcov-report/index.html
```

---

## 🐛 TROUBLESHOOTING

### Erro: "Cannot find module 'supertest'"

**Solução:**
```bash
npm install
```

### Erro: "Connection refused" ou "Database not found"

**Solução:**
O setup deve criar o banco automaticamente. Mas você pode criar manualmente:

```bash
# Conectar ao PostgreSQL
psql -U postgres

# Criar banco de teste
CREATE DATABASE app_polox_test;

# Sair
\q
```

### Erro: "Jest timeout"

**Solução:**
O timeout padrão é 30s. Se precisar de mais:

```javascript
// No seu teste
jest.setTimeout(60000); // 60 segundos
```

### Erro: "Port already in use"

**Solução:**
O `server-test.js` **não** inicia servidor HTTP, então não deve ter esse erro.
Se aparecer, verifique se não está usando `server.js` em vez de `server-test.js`.

### Testes antigos falhando

**Solução:**
Existem alguns testes antigos na pasta `tests/` que podem falhar:
- `controllers.test.js`
- `copilot-prompt-*.test.js`
- `test-company-model.js`
- `test-structure.js`

**Opção 1:** Ignorar temporariamente:
```bash
# Mover para pasta temporária
mkdir tests/old
mv tests/*.test.js tests/old/
mv tests/test-*.js tests/old/
```

**Opção 2:** Deletar:
```bash
rm tests/controllers.test.js
rm tests/copilot-prompt-*.test.js
rm tests/test-*.js
```

---

## 🎯 MODO WATCH (DESENVOLVIMENTO)

Para executar testes automaticamente quando você salvar arquivos:

```bash
npm run test:watch
```

**Comandos dentro do watch mode:**
- Pressione `a` para executar todos os testes
- Pressione `f` para executar apenas testes que falharam
- Pressione `p` para filtrar por nome de arquivo
- Pressione `t` para filtrar por nome de teste
- Pressione `q` para sair

---

## 📝 PRÓXIMOS PASSOS (FASE 2)

### 1. Criar primeiro teste unitário

```bash
# Criar diretório
mkdir -p tests/unit/utils

# Criar teste
touch tests/unit/utils/validators.test.js
```

**Código base:**
```javascript
// tests/unit/utils/validators.test.js
const { validateEmail } = require('../../../src/utils/validators');

describe('Validators', () => {
  describe('validateEmail', () => {
    it('deve validar email válido', () => {
      expect(validateEmail('test@example.com')).toBe(true);
    });
    
    it('deve rejeitar email inválido', () => {
      expect(validateEmail('invalid')).toBe(false);
    });
  });
});
```

### 2. Executar teste

```bash
npm test -- tests/unit/utils/validators.test.js
```

### 3. Ver cobertura

```bash
npm run test:coverage
```

---

## 📚 REFERÊNCIAS

- **Guia Completo:** [PLANO_IMPLEMENTACAO_TESTES_FASE_A_FASE.md](./PLANO_IMPLEMENTACAO_TESTES_FASE_A_FASE.md)
- **Quick Start Fase 2:** [QUICK_START_FASE_2.md](./QUICK_START_FASE_2.md)
- **Sumário Fase 1:** [SUMARIO_EXECUTIVO_FASE_1_CONCLUIDA.md](./SUMARIO_EXECUTIVO_FASE_1_CONCLUIDA.md)
- **Jest Docs:** https://jestjs.io/docs/getting-started
- **Supertest Docs:** https://github.com/ladjs/supertest

---

## 🎉 VALIDAÇÃO RÁPIDA

Execute estes 3 comandos para validar tudo:

```bash
# 1. Verificar Jest
npm test --version

# 2. Testar infraestrutura (criar teste temporário acima)
npm test -- tests/test-infrastructure.test.js

# 3. Ver se cobertura funciona
npm run test:coverage
```

Se todos funcionarem: **✅ Infraestrutura pronta para Fase 2!**

---

**Última atualização:** 26/10/2025
