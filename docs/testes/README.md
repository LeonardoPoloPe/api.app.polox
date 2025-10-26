# 🧪 DOCUMENTAÇÃO DE TESTES AUTOMATIZADOS

**Projeto:** Polox CRM API  
**Última Atualização:** 26/10/2025  
**Status:** ✅ 51/51 testes passando (100%)  
**Objetivo:** Expandir cobertura de testes para todos os Models

---

## 🎉 **STATUS ATUAL: 51/51 TESTES PASSANDO (100%)** ✅

```
✅ Infrastructure:      22/22  (100%)
✅ Simple CRUD:         23/23  (100%)
✅ Lead Model:           6/6   (100%)
─────────────────────────────────────
✅ TOTAL:               51/51  (100%)

Tempo médio: ~775ms por teste
Tempo total: ~38s para suite completa
```

---

## 📚 ÍNDICE DE DOCUMENTOS

### 🎯 **LEIA PRIMEIRO - Implementação de Testes Lead Model**

1. **[GUIA_TESTES_LEAD_MODEL.md](./GUIA_TESTES_LEAD_MODEL.md)** ⭐ **REFERÊNCIA PRINCIPAL**
   - Documentação completa de 800+ linhas
   - 6 problemas resolvidos com soluções detalhadas
   - Pool de conexão configurado com segurança
   - Validações de schema (country codes, column names, numeric types)
   - Padrões multi-idioma (pt-BR, en, es)
   - Checklist completo para novos testes
   - **USE ESTE GUIA** para implementar testes de outros Models

2. **[QUICK_REFERENCE_TESTES.md](./QUICK_REFERENCE_TESTES.md)** ⭐ **CONSULTA RÁPIDA**
   - Guia rápido e prático para consulta
   - Template básico de testes
   - Pontos críticos resumidos
   - Comandos úteis e checklist

3. **[TESTES_LEAD_MODEL_COMPLETO_26_10_2025.md](./TESTES_LEAD_MODEL_COMPLETO_26_10_2025.md)** ⭐ **RESUMO EXECUTIVO**
   - Resumo executivo da implementação
   - Resultados finais e métricas
   - Problemas resolvidos e lições aprendidas
   - Próximos passos recomendados

---

## 📖 DOCUMENTAÇÃO COMPLETA

### 📊 Status e Progresso

**[STATUS_TESTES_26_10_2025.md](./STATUS_TESTES_26_10_2025.md)**
- Status atual de todos os testes
- Progresso de implementação
- Próximos passos

**[TESTES_REALIZADOS_26_10_2025.md](./TESTES_REALIZADOS_26_10_2025.md)**
- Histórico detalhado de testes
- Resultados e métricas
- Cobertura atual

**[RESUMO_TESTES_INTEGRACAO_26_10_2025.md](./RESUMO_TESTES_INTEGRACAO_26_10_2025.md)**
- Resumo dos testes de integração
- Validações realizadas
- Performance e qualidade

### 🚀 Configuração e Execução

**[COMO_EXECUTAR_TESTES.md](./COMO_EXECUTAR_TESTES.md)**
- Guia completo de como executar testes
- Comandos úteis
- Troubleshooting

**[SETUP_BANCO_TESTE.md](./SETUP_BANCO_TESTE.md)**
- Configuração do banco de testes
- Credenciais e conexão
- Migrations automáticas

### 📊 Avaliação e Estratégia

**[AVALIACAO_COMPLETA_PROJETO_26_10_2025.md](./AVALIACAO_COMPLETA_PROJETO_26_10_2025.md)**
- ✅ Avaliação completa do projeto com scoring (0-10)
- **Segurança:** 8.5/10
- **Escalabilidade:** 9.0/10
- **Manutenibilidade:** 8.0/10

**[ESTRATEGIA_TESTES_AUTOMATIZADOS_26_10_2025.md](./ESTRATEGIA_TESTES_AUTOMATIZADOS_26_10_2025.md)**
- ✅ Estratégia completa de 3 camadas
- **Unit Tests:** 40% da cobertura
- **Integration Tests:** 50% da cobertura
- **E2E Tests:** 10% da cobertura
- Stack: Jest + Supertest + PostgreSQL

### 📋 Planos de Implementação

**[PLANO_IMPLEMENTACAO_TESTES_FASE_A_FASE.md](./PLANO_IMPLEMENTACAO_TESTES_FASE_A_FASE.md)** (900+ linhas)
- ✅ **Fase 1 (CONCLUÍDA):** Configuração e preparação crítica
- 📋 **Fase 2 (PRÓXIMA):** Testes unitários e refatoração de services
- 📅 **Fase 3:** Testes de integração (multi-tenancy, i18n, security)
- 📅 **Fase 4:** Testes E2E (lead conversion flow)
- 100+ exemplos de código completos

**[SUMARIO_EXECUTIVO_FASE_1_CONCLUIDA.md](./SUMARIO_EXECUTIVO_FASE_1_CONCLUIDA.md)**
- Sumário executivo da Fase 1
- Arquivos implementados
- Próximos passos

**[QUICK_START_FASE_2.md](./QUICK_START_FASE_2.md)**
- Quick start para Fase 2
- Código pronto para copiar
- Checklists práticos

---

## 🚀 PROGRESSO DE IMPLEMENTAÇÃO

| Fase | Descrição | Status | Testes |
|------|-----------|--------|--------|
| **Infraestrutura** | Setup & Validação | ✅ **CONCLUÍDA** | 22/22 ✅ |
| **CRUD Simples** | Models diretos | ✅ **CONCLUÍDA** | 23/23 ✅ |
| **Lead Model** | Conversão lead→cliente | ✅ **CONCLUÍDA** | 6/6 ✅ |
| **Client Model** | CRUD + relacionamentos | 📋 **PRÓXIMA** | 0/6 |
| **Product Model** | CRUD + estoque | 📅 Planejada | 0/6 |
| **Sale Model** | Transações complexas | 📅 Planejada | 0/8 |
| **Controllers HTTP** | Routes + Supertest | 📅 Planejada | 0/24 |

---

## 📦 ARQUIVOS IMPLEMENTADOS

### ✅ Arquivos de Teste (51 testes passando)

```
tests/
├── setup.js (424 linhas) ✅ FUNCIONANDO
│   ├── Carregamento de .env.test
│   ├── Configuração de variáveis de ambiente
│   ├── Mocks globais (Logger, AWS SDK)
│   ├── Pool de conexões com RDS (SSL configurado)
│   ├── Execução de migrations automática
│   ├── Limpeza de dados entre testes
│   └── Hooks beforeAll/afterAll/afterEach
│
├── helpers/
│   └── database.helper.js (415 linhas) ✅ FUNCIONANDO
│       ├── createCompany() - cria empresa de teste
│       ├── createUser() - cria usuário de teste
│       ├── generateTestToken() - gera JWT válido
│       ├── generateCNPJ() - gera CNPJ fake
│       ├── generateCPF() - gera CPF fake
│       └── cleanup() - limpa dados de teste
│
├── validacao-infraestrutura.test.js (206 linhas) ✅ 22/22 PASSANDO
│   ├── Valida setup global
│   ├── Valida DatabaseHelper
│   ├── Valida Server de Teste (Supertest)
│   └── Valida conexão com banco
│
├── integration/
│   ├── simple-crud.test.js (366 linhas) ✅ 23/23 PASSANDO
│   │   ├── CRUD de empresas (pt-BR, en, es)
│   │   ├── CRUD de usuários
│   │   ├── Geração de JWT
│   │   └── Queries diretas de contagem
│   │
│   ├── lead-refactored.test.js (279 linhas) ✅ 6/6 PASSANDO
│   │   ├── Criação de leads (pt-BR, en, es)
│   │   └── Conversão lead→cliente (pt-BR, en, es)
│   │
│   ├── company.test.js (bloqueado - routes não registradas)
│   └── lead.test.js (bloqueado - routes não registradas)
│
├── _old/ (testes antigos isolados)
├── unit/ (vazio - aguardando Fase 2)
└── e2e/ (vazio - aguardando Fase 4)
```

### ✅ Código de Produção Modificado

```
src/
├── config/
│   └── database.js (368 linhas) ⚠️ MODIFICADO (pool handling)
│       ├── query() - suporta global.testPool
│       └── transaction() - suporta global.testPool
│       └── ✅ Seguro para produção (runtime checks)
│
└── server-test.js (90 linhas) ✅ FUNCIONANDO
    ├── Express app sem HTTP listener
    ├── Middlewares configurados
    ├── Rotas carregadas
    └── Pronto para Supertest
```

### 📚 Documentação Criada

```
docs/testes/
├── GUIA_TESTES_LEAD_MODEL.md ⭐ (800+ linhas)
│   └── Guia completo com 6 problemas resolvidos
│
├── QUICK_REFERENCE_TESTES.md ⭐ (200+ linhas)
│   └── Referência rápida e template básico
│
├── TESTES_LEAD_MODEL_COMPLETO_26_10_2025.md ⭐ (400+ linhas)
│   └── Resumo executivo e lições aprendidas
│
├── README.md (este arquivo)
├── COMO_EXECUTAR_TESTES.md
├── SETUP_BANCO_TESTE.md
├── STATUS_TESTES_26_10_2025.md
├── TESTES_REALIZADOS_26_10_2025.md
├── RESUMO_TESTES_INTEGRACAO_26_10_2025.md
├── AVALIACAO_COMPLETA_PROJETO_26_10_2025.md
├── ESTRATEGIA_TESTES_AUTOMATIZADOS_26_10_2025.md
├── PLANO_IMPLEMENTACAO_TESTES_FASE_A_FASE.md
├── SUMARIO_EXECUTIVO_FASE_1_CONCLUIDA.md
└── QUICK_START_FASE_2.md
```

---

## 🔧 COMANDOS ÚTEIS

### Executar Testes

```bash
# Executar todos os testes (51 testes)
npm test --forceExit

# Executar teste de validação da infraestrutura (22 testes)
npm test -- tests/validacao-infraestrutura.test.js --forceExit

# Executar testes CRUD simples (23 testes)
npm test -- tests/integration/simple-crud.test.js --forceExit

# Executar testes Lead Model (6 testes)
npm test -- tests/integration/lead-refactored.test.js --forceExit

# Executar com coverage
npm test -- --coverage --forceExit

# Executar em modo watch (desenvolvimento)
npm test -- --watch

# Executar teste específico
npm test -- tests/integration/lead-refactored.test.js --testNamePattern="deve criar um lead" --forceExit
```

### Validar Cobertura

```bash
# Ver cobertura no terminal
npm test -- --coverage --forceExit

# Abrir relatório HTML
open coverage/lcov-report/index.html
```

---

## 🎯 PRÓXIMOS PASSOS RECOMENDADOS

### 1. Implementar Testes de ClientModel (Meta: 6 testes)

**Arquivo:** `tests/integration/client.test.js`

**Seguir o padrão de:** `tests/integration/lead-refactored.test.js`

**Testes:**
- ✅ Criar cliente (pt-BR, en, es) - 3 testes
- ✅ Atualizar cliente (pt-BR, en, es) - 3 testes

**Guia:** Consultar `GUIA_TESTES_LEAD_MODEL.md` e `QUICK_REFERENCE_TESTES.md`

### 2. Implementar Testes de ProductModel (Meta: 6 testes)

**Arquivo:** `tests/integration/product.test.js`

**Testes:**
- ✅ Criar produto (pt-BR, en, es) - 3 testes
- ✅ Atualizar estoque (pt-BR, en, es) - 3 testes

### 3. Implementar Testes de SaleModel (Meta: 8 testes)

**Arquivo:** `tests/integration/sale.test.js`

**Testes:**
- ✅ Criar venda (pt-BR, en, es) - 3 testes
- ✅ Adicionar items (pt-BR, en, es) - 3 testes
- ✅ Calcular totais - 2 testes

### 4. Registrar Routes e Testar Controllers (Meta: 24 testes)

**Bloqueador:** Routes não registradas em `src/routes.js`

**Testes HTTP com Supertest:**
- CompanyController (8 testes)
- LeadController (8 testes)
- ClientController (8 testes)

---

## 🎓 PADRÕES E BOAS PRÁTICAS ESTABELECIDAS

### ✅ O Que Fazer

1. **Sempre usar códigos ISO** para country, language, currency
2. **Sempre verificar RETURNING clause** do Model antes de assertions
3. **Sempre usar parseFloat()** para campos numeric/decimal
4. **Sempre consultar DDL** do banco (fonte da verdade)
5. **Sempre testar 3 idiomas** (pt-BR, en, es)
6. **Sempre comentar campos não retornados** com `// ❌ Não retornado`
7. **Sempre criar contexto isolado** (empresa + usuário por teste)
8. **Sempre usar afterEach** para cleanup automático

### ⚠️ Armadilhas a Evitar

1. ❌ **Não assumir nomes de colunas** → Sempre consultar DDL
2. ❌ **Não validar campos não retornados** → Verificar RETURNING clause
3. ❌ **Não usar valores completos em VARCHAR limitado** → Usar ISO codes
4. ❌ **Não especificar DEFAULT values** → Deixar DB usar defaults
5. ❌ **Não comparar numeric sem parseFloat()** → node-postgres retorna string
6. ❌ **Não modificar produção sem safety checks** → Runtime checks apenas

### Template Básico de Teste

```javascript
const DatabaseHelper = require('../helpers/database.helper');
const LeadModel = require('../../src/models/Lead');

describe('🎯 Lead Model - Funcionalidade', () => {
  
  async function createTestContext() {
    const helper = new DatabaseHelper();
    const testCompany = await helper.createCompany({
      fantasy_name: 'Test Company',
      legal_name: 'Test Company LTDA',
      document_number: helper.generateCNPJ(),
      email: 'test@company.com',
      country: 'BR' // ⚠️ ISO code
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

  describe('✅ Funcionalidade - Português (pt-BR)', () => {
    test('deve criar um lead', async () => {
      const { testCompany, testUser } = await createTestContext();
      
      const leadData = {
        lead_name: 'João Silva', // ⚠️ lead_name, não "name"
        email: 'joao@empresa.com.br',
        country: 'BR', // ⚠️ ISO code
        conversion_value: 50000 // ⚠️ Usar parseFloat() na assertion
      };
      
      const lead = await LeadModel.create(leadData, testCompany.id, testUser.id);
      
      expect(lead.id).toBeDefined();
      expect(lead.lead_name).toBe('João Silva');
      expect(parseFloat(lead.conversion_value)).toBe(50000); // ⚠️ parseFloat()
    });
  });
});
```

---

## 📊 MÉTRICAS DE QUALIDADE

### Cobertura Atual

```
✅ Infrastructure:      100%  (22/22 testes)
✅ Simple CRUD:         100%  (23/23 testes)
✅ Lead Model:          100%  (6/6 testes)
❌ Client Model:        0%    (0 testes)
❌ Product Model:       0%    (0 testes)
❌ Sale Model:          0%    (0 testes)
❌ Controllers HTTP:    0%    (0 testes)
─────────────────────────────────────────
Cobertura Total:        ~15%
Meta Próxima:           30%   (Client + Product Models)
Meta Final:             70%   (Todos os Models + Controllers)
```

### Performance

```
Tempo Médio por Teste:  775ms
Tempo Total (51 testes): ~38s
Cleanup:                 Automático (afterEach)
Isolamento:              100% (cada teste independente)
```

---

## 📞 SUPORTE E REFERÊNCIAS

### Documentação Principal

- **Índice Geral:** `/docs/INDICE.md`
- **README Principal:** `/README.md`
- **Guia de Migrations:** `/docs/GUIA_MIGRATIONS_COMPLETO.md`

### Problemas Comuns

**Problema:** Testes falhando com erro de conexão DB
- **Solução:** Verificar se `app_polox_test` existe e tem permissões
- **Comando:** `npm test` (cria DB automaticamente no beforeAll)

**Problema:** Country VARCHAR(3) error
- **Solução:** Usar códigos ISO ('BR', 'US', 'ES') não nomes completos
- **Ver:** `GUIA_TESTES_LEAD_MODEL.md` - Problema 2

**Problema:** Column name undefined (ex: lead.name)
- **Solução:** Usar nome exato do DDL (ex: lead.lead_name)
- **Ver:** `GUIA_TESTES_LEAD_MODEL.md` - Problema 3

**Problema:** Numeric comparison failing
- **Solução:** Usar `parseFloat(value)` para comparar
- **Ver:** `QUICK_REFERENCE_TESTES.md` - Pontos Críticos #3

---

## 🎉 CONCLUSÃO

A **infraestrutura de testes está 100% funcional** com:

✅ 51/51 testes passando (100%)  
✅ Pool de conexão configurado com segurança  
✅ Padrões multi-idioma estabelecidos  
✅ Documentação completa criada  
✅ Template reutilizável pronto  
✅ Guias práticos para referência  

**Próximo passo:** Implementar testes de **ClientModel** seguindo o padrão estabelecido.

**Referência Principal:** [GUIA_TESTES_LEAD_MODEL.md](./GUIA_TESTES_LEAD_MODEL.md)

---

**Documentação organizada em 26/10/2025**

---

## 📖 DOCUMENTAÇÃO COMPLETA

### 📊 Avaliação do Projeto

**[AVALIACAO_COMPLETA_PROJETO_26_10_2025.md](./AVALIACAO_COMPLETA_PROJETO_26_10_2025.md)**
- ✅ Avaliação completa do projeto com scoring (0-10)
- **Segurança:** 8.5/10
- **Escalabilidade:** 9.0/10
- **Manutenibilidade:** 8.0/10
- **Gap Crítico:** 0% de cobertura de testes

### 🎯 Estratégia de Testes

**[ESTRATEGIA_TESTES_AUTOMATIZADOS_26_10_2025.md](./ESTRATEGIA_TESTES_AUTOMATIZADOS_26_10_2025.md)**
- ✅ Estratégia completa de 3 camadas
- **Unit Tests:** 40% da cobertura
- **Integration Tests:** 50% da cobertura
- **E2E Tests:** 10% da cobertura
- Stack: Jest + Supertest + PostgreSQL

### 📋 Plano de Implementação Fase a Fase

**[PLANO_IMPLEMENTACAO_TESTES_FASE_A_FASE.md](./PLANO_IMPLEMENTACAO_TESTES_FASE_A_FASE.md)** (900+ linhas)
- ✅ **Fase 1 (CONCLUÍDA):** Configuração e preparação crítica
- 📋 **Fase 2 (PRÓXIMA):** Testes unitários e refatoração de services
- 📅 **Fase 3:** Testes de integração (multi-tenancy, i18n, security)
- 📅 **Fase 4:** Testes E2E (lead conversion flow)
- 100+ exemplos de código completos
- Checklists detalhados

---

## 🚀 PROGRESSO DE IMPLEMENTAÇÃO

| Fase | Descrição | Status | Cobertura | Duração |
|------|-----------|--------|-----------|---------|
| **1** | Setup & Configuração | ✅ **CONCLUÍDA** (26/10/2025) | Infraestrutura | 1 dia |
| **2** | Unit Tests & Services | 📋 **PRÓXIMA** | 20-30% | 1 semana |
| **3** | Integration Tests | 📅 Planejada | 50-60% | 1 semana |
| **4** | E2E Tests | 📅 Planejada | 70%+ | 1 semana |

### ✅ **Fase 1 - CONCLUÍDA (26/10/2025)**

**Infraestrutura de Testes 100% Funcional**

✅ **Testes de Validação:** 22/22 passando (100%)
- Setup Global: 3/3 ✅
- DatabaseHelper: 9/9 ✅  
- Server de Teste: 5/5 ✅
- Conexão com Banco: 5/5 ✅

✅ **Banco de Dados:**
- `app_polox_test` criado no RDS
- 35 migrations executadas com sucesso
- Schema `polox` configurado
- Permissões configuradas para `polox_dev_user`

✅ **Configuração:**
- `.env.test` com credenciais do RDS
- SSL configurado para conexão RDS
- Jest configurado (timeout, coverage, setup)
- Mocks globais (Logger, AWS SDK)

**Próxima Ação:** Iniciar Fase 2 - ver [QUICK_START_FASE_2.md](./QUICK_START_FASE_2.md)

---

## 📦 ARQUIVOS IMPLEMENTADOS (FASE 1 - CONCLUÍDA)

### ✅ Arquivos de Teste

```
tests/
├── setup.js (456 linhas) ✅ FUNCIONANDO
│   ├── Carregamento de .env.test
│   ├── Configuração de variáveis de ambiente
│   ├── Mocks globais (Logger, AWS SDK)
│   ├── Pool de conexões com RDS (SSL configurado)
│   ├── Execução de migrations automática
│   ├── Limpeza de dados entre testes
│   └── Hooks beforeAll/afterAll/afterEach
│
├── helpers/
│   └── database.js (333 linhas) ✅ FUNCIONANDO
│       ├── createTestCompany() - cria empresa de teste
│       ├── createTestUser() - cria usuário de teste
│       ├── generateTestToken() - gera JWT válido
│       ├── generateCNPJ() - gera CNPJ fake
│       └── generateCPF() - gera CPF fake
│
├── validacao-infraestrutura.test.js (206 linhas) ✅ 22/22 PASSANDO
│   ├── Valida setup global
│   ├── Valida DatabaseHelper
│   ├── Valida Server de Teste (Supertest)
│   └── Valida conexão com banco
│
├── _old/ (testes antigos isolados)
├── unit/ (vazio - aguardando Fase 2)
├── integration/ (vazio - aguardando Fase 3)
└── e2e/ (vazio - aguardando Fase 4)
```

### ✅ Servidor de Teste

```
src/
└── server-test.js (90 linhas) ✅ FUNCIONANDO
    ├── Express app sem HTTP listener
    ├── Middlewares configurados
    ├── Rotas carregadas
    └── Pronto para Supertest
```

### ✅ Configuração Jest

```
jest.config.json ✅ FUNCIONANDO
├── setupFilesAfterEnv: ['./tests/setup.js']
├── testEnvironment: 'node'
├── testTimeout: 30000
├── collectCoverageFrom: ['src/**/*.js']
└── coverageThreshold: { global: { branches: 70, functions: 70, lines: 70 } }
```

### ✅ Configuração de Ambiente

```
.env.test ✅ CONFIGURADO (não commitado)
├── DB_HOST=database-1.cd2em8e0a6ot.sa-east-1.rds.amazonaws.com
├── DB_PORT=5432
├── DB_USER=polox_dev_user
├── DB_PASSWORD=[do dev-mysql no AWS Secrets Manager]
├── DB_NAME=app_polox_test
└── JWT_SECRET=test_jwt_secret...
```

### ✅ Scripts Utilitários

```
scripts/
├── clean-test-db.js ✅ FUNCIONANDO
│   └── Limpa schema polox e migrations do banco de teste
│
└── grant-test-permissions.js ✅ CRIADO
    └── Concede permissões no schema public (se necessário)
```

---

## 🎯 PRÓXIMA FASE - FASE 2

### Objetivo: 20-30% de Cobertura (1 semana)

**Tarefas:**
1. ✅ Criar `src/services/LeadService.js`
2. ✅ Criar `src/services/AuthService.js`
3. ✅ Refatorar controllers (extrair lógica de negócio)
4. ✅ Criar testes unitários de utils (validators, formatters)
5. ✅ Criar testes unitários de services

**Guia:** [QUICK_START_FASE_2.md](./QUICK_START_FASE_2.md)

---

## 📊 REQUISITOS CRÍTICOS

### ✅ Multi-Tenancy Isolation
**Requisito:** Usuário A não pode acessar dados do Usuário B

**Status:** Infraestrutura pronta
- DatabaseHelper cria múltiplas empresas isoladas
- Cleanup automático após cada teste
- Tests validarão 404/403 em acessos cross-tenant

### ✅ i18n Validation
**Requisito:** Mensagens traduzidas conforme Accept-Language header

**Status:** Infraestrutura pronta
- server-test.js inclui i18nMiddleware
- Accept-Language header configurado
- Tests validarão traduções (pt, en, es)

### ✅ Service Layer Refactoring
**Requisito:** Extrair lógica de negócio dos controllers

**Status:** Planejado para Fase 2
- LeadService.convertToClient() planejado
- AuthService.register() e login() planejados
- Tests unitários com mocking (Jest)

---

## 🔧 COMANDOS ÚTEIS

### Executar Testes

```bash
# Executar todos os testes
npm test

# Executar teste de validação da infraestrutura (22 testes)
npm test -- tests/validacao-infraestrutura.test.js

# Executar com coverage
npm run test:coverage

# Executar em modo watch (desenvolvimento)
npm run test:watch

# Executar apenas testes unitários (Fase 2 - quando implementados)
npm test -- tests/unit
npm run test:integration

# Executar apenas testes E2E (Fase 4)
npm run test:e2e

# Executar com cobertura
npm run test:coverage

# Executar em modo watch (desenvolvimento)
npm run test:watch

# Executar teste específico
npm test -- tests/unit/services/AuthService.test.js
```

### Validar Cobertura

```bash
# Ver cobertura no terminal
npm run test:coverage

# Abrir relatório HTML
open coverage/lcov-report/index.html
```

---

## 📚 REFERÊNCIAS RÁPIDAS

### Arquivos de Código

- **Setup Global:** `/tests/setup.js`
- **Test Helpers:** `/tests/helpers/database.js`
- **Test Server:** `/src/server-test.js`
- **Jest Config:** `/jest.config.json`

### Controllers para Refatorar (Fase 2)

- **LeadController:** `/src/controllers/LeadController.js`
- **AuthController:** `/src/controllers/authController.js`

### Services a Criar (Fase 2)

- **LeadService:** `/src/services/LeadService.js` (a criar)
- **AuthService:** `/src/services/AuthService.js` (a criar)

---

## 🎓 PADRÕES E BOAS PRÁTICAS

### AAA Pattern (Arrange-Act-Assert)

```javascript
it('deve fazer algo', async () => {
  // Arrange (preparar)
  const mockData = { ... };
  Model.findById = jest.fn().mockResolvedValue(mockData);
  
  // Act (executar)
  const result = await Service.method();
  
  // Assert (validar)
  expect(result).toBeDefined();
  expect(Model.findById).toHaveBeenCalled();
});
```

### Mocking com Jest

```javascript
// Mock de módulo completo
jest.mock('../../../src/models/UserModel');

// Mock de método específico
UserModel.findByEmail = jest.fn().mockResolvedValue({ id: 1 });

// Limpar mocks após cada teste
afterEach(() => {
  jest.clearAllMocks();
});
```

### Factory Methods (DatabaseHelper)

```javascript
const helper = new DatabaseHelper(pool);

// Criar empresa
const company = await helper.createTestCompany({ name: 'Test' });

// Criar usuário
const user = await helper.createTestUser(company.id, {
  email: 'test@example.com',
  password: '123456'
});

// Gerar token JWT
const token = helper.generateTestToken(user);

// Criar lead
const lead = await helper.createTestLead(company.id, {
  name: 'Lead Test',
  email: 'lead@test.com'
});
```

---

## 🎯 MÉTRICAS DE SUCESSO

### Fase 1 (Atual - Concluída)
- ✅ Estrutura completa criada
- ✅ Setup global: 389 linhas
- ✅ Helpers: 339 linhas
- ✅ Server de teste: 90 linhas
- ✅ Documentação: 900+ linhas

### Fase 2 (Meta)
- 🎯 2 Services criados
- 🎯 2 Controllers refatorados
- 🎯 6+ arquivos de teste
- 🎯 30+ test cases
- 🎯 20-30% cobertura

### Fase 3 (Meta)
- 🎯 3+ arquivos de integração
- 🎯 20+ test cases
- 🎯 Multi-tenancy validado
- 🎯 i18n validado
- 🎯 50-60% cobertura

### Fase 4 (Meta)
- 🎯 1 teste E2E completo
- 🎯 10+ steps no fluxo
- 🎯 70% cobertura final

---

## 📞 SUPORTE

### Documentação Adicional

- **Índice Geral:** `/docs/INDICE.md`
- **README Principal:** `/README.md`
- **Auditoria de Segurança:** `/docs/AUDITORIA_SEGURANCA_23-10-2025.md`

### Problemas Comuns

**Problema:** Testes falhando com erro de conexão DB
- **Solução:** Verificar se `app_polox_test` existe
- **Comando:** `npm test` (cria DB automaticamente no beforeAll)

**Problema:** Cobertura não está sendo gerada
- **Solução:** Executar `npm run test:coverage`
- **Verificar:** `jest.config.json` tem `collectCoverage: false` por padrão

**Problema:** Testes muito lentos
- **Solução:** Verificar timeout (30s padrão)
- **Otimizar:** Reduzir queries no beforeAll/afterEach

---

## 🎉 CONCLUSÃO

A **Fase 1 está 100% concluída** e a infraestrutura de testes está pronta para:

✅ Testes unitários com mocking  
✅ Testes de integração com banco real  
✅ Testes E2E com Supertest  
✅ Multi-tenancy isolation  
✅ i18n validation  
✅ Service layer refactoring  

**Próximo passo:** Seguir o guia [QUICK_START_FASE_2.md](./QUICK_START_FASE_2.md)

---

**Documentação organizada em 26/10/2025**
