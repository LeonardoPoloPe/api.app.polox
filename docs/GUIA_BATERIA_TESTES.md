# 🧪 Guia Completo da Bateria de Testes

**Data de Atualização:** 30 de outubro de 2025  
**Versão:** 2.0  
**Status:** ✅ Implementado e Testado

---

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [Estrutura de Testes](#estrutura-de-testes)
3. [Como Executar](#como-executar)
4. [Tipos de Testes](#tipos-de-testes)
5. [Coverage](#coverage)
6. [Boas Práticas](#boas-práticas)

---

## 🎯 Visão Geral

A bateria de testes foi completamente reformulada e expandida para cobrir:

- ✅ **Testes de Integração** - Operações CRUD e banco de dados
- ✅ **Testes de Validação** - Regras de negócio e validações
- ✅ **Testes de Performance** - Carga e otimização
- ✅ **Testes de Relacionamentos** - Integridade referencial
- ✅ **Testes Unitários** - Helpers e utilitários

### 📊 Estatísticas

- **Total de Suítes:** 8
- **Total de Testes:** 150+
- **Coverage Estimado:** 70%+
- **Tempo Médio:** ~30 segundos

---

## 📁 Estrutura de Testes

```
tests/
├── setup.js                        # Configuração global
├── helpers/
│   └── database.js                 # Helpers para testes
├── integration/                    # Testes de Integração
│   ├── simple-crud.test.js         # CRUD básico (25 testes)
│   ├── company-model.test.js       # Model de Company (15 testes)
│   ├── company-validation.test.js  # Validações (40+ testes) ✨ NOVO
│   ├── performance.test.js         # Performance (30+ testes) ✨ NOVO
│   ├── relationships.test.js       # Relacionamentos (40+ testes) ✨ NOVO
│   └── lead-refactored.test.js     # Leads refatorado
└── unit/                           # Testes Unitários
    └── helpers.test.js             # Helpers (30+ testes) ✨ NOVO
```

---

## 🚀 Como Executar

### Executar Todos os Testes

```bash
npm test
```

### Executar Testes Específicos

```bash
# Apenas testes de integração
npm test -- tests/integration

# Apenas testes unitários
npm test -- tests/unit

# Arquivo específico
npm test -- tests/integration/company-validation.test.js

# Com pattern no nome
npm test -- --testNamePattern="domínios"
```

### Executar com Coverage

```bash
npm test -- --coverage
```

### Modo Watch (desenvolvimento)

```bash
npm test -- --watch
```

### Verbose (mais detalhes)

```bash
npm test -- --verbose
```

---

## 🧪 Tipos de Testes

### 1️⃣ **Testes de CRUD Simples** (`simple-crud.test.js`)

**Objetivo:** Validar operações básicas de criação de dados

**Testes:**
- ✅ Criação de empresas (PT, EN, ES)
- ✅ Criação de usuários com diferentes roles
- ✅ Geração de tokens JWT
- ✅ Geradores de dados fake (CNPJ, CPF)
- ✅ Validação multi-idioma
- ✅ Consultas diretas ao banco

**Comando:**
```bash
npm test -- tests/integration/simple-crud.test.js
```

**Tempo Estimado:** ~8 segundos  
**Total de Testes:** 25

---

### 2️⃣ **Testes de Validação** (`company-validation.test.js`) ✨ NOVO

**Objetivo:** Validar regras de negócio e constraints

**Categorias:**
- 🔐 Validação de Domínios
  - Formatos válidos (com pontos, hífens, etc)
  - Unicidade de domínio
  - Domínios internacionais
  
- 🔖 Validação de Slugs
  - Geração automática
  - Unicidade
  
- 📧 Validação de Emails
  - Formatos válidos
  - Unicidade de admin_email
  
- ⏰ Validação de Timestamps
  - created_at e updated_at
  - Atualização automática
  
- 🗑️ Soft Delete
  - Deleção lógica
  - Reutilização de domínios
  
- 🌍 Dados Multilíngue
  - Caracteres especiais (PT, ES)
  - Nomes longos

**Comando:**
```bash
npm test -- tests/integration/company-validation.test.js
```

**Tempo Estimado:** ~5 segundos  
**Total de Testes:** 40+

---

### 3️⃣ **Testes de Performance** (`performance.test.js`) ✨ NOVO

**Objetivo:** Validar performance e escalabilidade

**Categorias:**
- 📦 Criação em Massa
  - 10 empresas em < 10 segundos
  - 20 usuários em < 15 segundos
  - 50 leads em < 15 segundos
  
- ⚡ Consultas Otimizadas
  - Busca por ID < 100ms
  - Contagem múltipla < 500ms
  - JOIN < 200ms
  - LIKE < 500ms
  
- 📄 Paginação
  - Páginas corretas
  - Cálculo de total
  
- 🔄 Transações
  - Commit em transação
  - Rollback em erro
  
- 📊 Índices
  - Verificação de índices
  - Otimização de consultas

**Comando:**
```bash
npm test -- tests/integration/performance.test.js
```

**Tempo Estimado:** ~10 segundos  
**Total de Testes:** 30+

---

### 4️⃣ **Testes de Relacionamentos** (`relationships.test.js`) ✨ NOVO

**Objetivo:** Validar integridade referencial e isolamento

**Categorias:**
- 🏢 Company <-> Users
  - Múltiplos usuários por empresa
  - Diferentes roles
  
- 🎯 Company <-> Leads
  - Leads atribuídos a usuários
  - Status e filtros
  
- 👥 Company <-> Clients
  - Isolamento de dados
  
- 📦 Company <-> Products
  - Catálogo por empresa
  
- 💰 Relacionamentos Complexos
  - Vendas com clientes e produtos
  - JOINs múltiplos
  
- 🔒 Integridade Referencial
  - Foreign keys
  - Cascata
  
- 🏠 Isolamento entre Empresas
  - Multi-tenancy
  - Dados segregados
  
- 📊 Agregações
  - COUNT, GROUP BY
  - Estatísticas

**Comando:**
```bash
npm test -- tests/integration/relationships.test.js
```

**Tempo Estimado:** ~6 segundos  
**Total de Testes:** 40+

---

### 5️⃣ **Testes Unitários - Helpers** (`helpers.test.js`) ✨ NOVO

**Objetivo:** Validar funções auxiliares

**Categorias:**
- 🔢 Geradores
  - CNPJ (formato, unicidade)
  - CPF (formato, unicidade)
  
- 🔑 JWT
  - Geração de tokens
  - Formato válido
  
- ⏱️ Utilitários
  - Helper de espera (wait)
  - Instância do helper
  
- ✅ Validação de Dados
  - Parâmetros opcionais
  - Valores padrão
  
- 📝 Tipos de Dados
  - IDs inteiros
  - Timestamps válidos
  - Status string
  
- 📏 Limites
  - Nomes longos
  - Emails longos
  - Telefones diversos formatos
  
- 🔐 Segurança
  - Hash de senhas
  - Não retorna password_hash

**Comando:**
```bash
npm test -- tests/unit/helpers.test.js
```

**Tempo Estimado:** ~3 segundos  
**Total de Testes:** 30+

---

## 📈 Coverage

### Executar Coverage Completo

```bash
npm test -- --coverage --coverageReporters=text --coverageReporters=html
```

### Visualizar Report HTML

```bash
open coverage/index.html
```

### Coverage Esperado

| Categoria | Coverage Alvo |
|-----------|---------------|
| **Models** | 80%+ |
| **Controllers** | 70%+ |
| **Helpers** | 90%+ |
| **Utils** | 85%+ |
| **Routes** | 60%+ |
| **Global** | 70%+ |

---

## 🎯 Boas Práticas

### ✅ DO (Faça)

1. **Use timestamps únicos**
   ```javascript
   const timestamp = Date.now();
   const email = `user${timestamp}@test.com`;
   ```

2. **Limpe dados após cada teste**
   ```javascript
   afterEach(async () => {
     // Limpeza automática pelo setup.js
   });
   ```

3. **Teste casos de erro**
   ```javascript
   await expect(
     helper.createTestUser(99999)
   ).rejects.toThrow();
   ```

4. **Use espera quando necessário**
   ```javascript
   await helper.wait(10); // 10ms
   ```

5. **Organize testes em describe aninhados**
   ```javascript
   describe('Companies', () => {
     describe('Validations', () => {
       it('should validate domain', () => {});
     });
   });
   ```

### ❌ DON'T (Não Faça)

1. ❌ Não use dados fixos
   ```javascript
   // ERRADO
   email: 'test@test.com'
   
   // CORRETO
   email: `test${Date.now()}@test.com`
   ```

2. ❌ Não faça testes dependentes
   ```javascript
   // ERRADO - depende de outro teste
   const company = globalCompany;
   
   // CORRETO - cria próprio dado
   const company = await helper.createTestCompany();
   ```

3. ❌ Não execute em produção
   ```javascript
   if (process.env.NODE_ENV !== 'test') {
     throw new Error('Testes apenas em ambiente test!');
   }
   ```

4. ❌ Não compartilhe estado entre testes
   ```javascript
   // ERRADO
   let sharedCompany;
   
   // CORRETO - crie dentro de cada teste
   ```

---

## 🐛 Debugging

### Rodar teste específico com log

```bash
npm test -- tests/integration/company-validation.test.js --verbose
```

### Rodar apenas um teste (it.only)

```javascript
it.only('deve testar apenas isso', async () => {
  // ...
});
```

### Ver queries SQL

Adicione no teste:
```javascript
const result = await global.testPool.query(query, values);
console.log('Query:', query);
console.log('Values:', values);
console.log('Result:', result.rows);
```

---

## 📊 Scripts NPM

```json
{
  "test": "jest",
  "test:unit": "jest tests/unit",
  "test:integration": "jest tests/integration",
  "test:coverage": "jest --coverage",
  "test:watch": "jest --watch",
  "test:verbose": "jest --verbose"
}
```

---

## 🔄 CI/CD Integration

### GitHub Actions (exemplo)

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      - run: npm ci
      - run: npm test -- --coverage
      - uses: codecov/codecov-action@v2
```

---

## 📞 Troubleshooting

### Erro: "Pool already closed"

**Solução:** Verifique se o `setup.js` está configurado corretamente

### Erro: "ECONNREFUSED"

**Solução:** Verifique se as credenciais do banco estão corretas em `.env.test`

### Testes lentos

**Solução:** 
- Use `maxWorkers: 1` no `jest.config.json`
- Adicione `await helper.wait(10)` entre criações

### Erros de duplicação

**Solução:** Use timestamps únicos em todos os campos únicos (email, domain, etc)

---

## ✅ Checklist de Qualidade

- [ ] Todos os testes passam
- [ ] Coverage > 70%
- [ ] Tempo de execução < 60s
- [ ] Sem testes.skip desnecessários
- [ ] Sem console.log em produção
- [ ] Documentação atualizada
- [ ] Boas práticas seguidas

---

## 📚 Recursos Adicionais

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)
- [SQL Testing Guide](https://www.postgresql.org/docs/current/regress.html)

---

**✅ Bateria de testes completamente implementada e documentada!**

**Próximos Passos:**
1. Executar todos os testes: `npm test`
2. Verificar coverage: `npm test -- --coverage`
3. Integrar com CI/CD
4. Monitorar performance dos testes
