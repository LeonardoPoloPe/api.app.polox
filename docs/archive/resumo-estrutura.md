# 📋 Resumo da Estrutura - API Polox

> **Documentação técnica completa para referência futura**  
> **Última atualização**: 18/10/2025

---

## 🎯 Visão Geral

**API Polox** é uma aplicação serverless Node.js construída para rodar em AWS Lambda com PostgreSQL RDS. Utiliza arquitetura limpa, sistema robusto de migrations e boas práticas de segurança.

### 🏷️ Tecnologias Principais

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: PostgreSQL 13+ (AWS RDS)
- **Cloud**: AWS Lambda + Serverless Framework
- **Autenticação**: JWT + bcrypt
- **Migrations**: Sistema customizado

---

## 📦 Stack Tecnológica Completa

### 🚀 Core Dependencies

| Pacote            | Versão  | Função                  |
| ----------------- | ------- | ----------------------- |
| `express`         | ^4.18.2 | Framework web principal |
| `pg`              | ^8.11.3 | Driver PostgreSQL       |
| `serverless-http` | ^3.2.0  | Adapter Express→Lambda  |
| `winston`         | ^3.11.0 | Logging estruturado     |
| `dotenv`          | ^16.3.1 | Variáveis de ambiente   |

### 🔐 Segurança & Auth

| Pacote         | Versão   | Função                |
| -------------- | -------- | --------------------- |
| `jsonwebtoken` | ^9.0.2   | Geração/validação JWT |
| `bcryptjs`     | ^2.4.3   | Hash de senhas        |
| `helmet`       | ^7.1.0   | Headers de segurança  |
| `cors`         | ^2.8.5   | Controle de CORS      |
| `joi`          | ^17.11.0 | Validação de dados    |

### 📡 AWS & Deploy

| Pacote                     | Versão    | Função               |
| -------------------------- | --------- | -------------------- |
| `aws-lambda`               | ^1.0.7    | Utilities AWS Lambda |
| `aws-sdk`                  | ^2.1496.0 | SDK AWS              |
| `serverless`               | ^3.38.0   | Framework deployment |
| `serverless-offline`       | ^13.2.0   | Dev local            |
| `serverless-dotenv-plugin` | ^6.0.0    | Env vars no deploy   |

### 📚 Documentação & Utils

| Pacote               | Versão | Função               |
| -------------------- | ------ | -------------------- |
| `swagger-jsdoc`      | ^6.2.8 | Geração Swagger      |
| `swagger-ui-express` | ^5.0.1 | Interface Swagger    |
| `date-fns`           | ^4.1.0 | Manipulação de datas |

### 🧪 Desenvolvimento

| Pacote    | Versão  | Função           |
| --------- | ------- | ---------------- |
| `jest`    | ^29.7.0 | Testes unitários |
| `nodemon` | ^3.0.2  | Hot reload local |

---

## 🏗️ Arquitetura de Código

### 📁 Estrutura de Diretórios

```
api.app.polox/
├── 📂 src/                          # Código fonte principal
│   ├── 📂 controllers/              # Controladores HTTP
│   │   ├── authController.js        # Login, registro, tokens
│   │   ├── userController.js        # CRUD usuários
│   │   └── index.js                 # Exports centralizados
│   │
│   ├── 📂 services/                 # Lógica de negócio
│   │   ├── AuthService.js           # Regras autenticação
│   │   ├── UserService.js           # Regras usuários
│   │   └── index.js                 # Exports centralizados
│   │
│   ├── 📂 models/                   # Camada de dados
│   │   ├── database.js              # Pool conexões PostgreSQL
│   │   ├── User.js                  # Model usuários
│   │   └── index.js                 # Exports centralizados
│   │
│   ├── 📂 utils/                    # Utilitários
│   │   ├── auth.js                  # Middleware JWT
│   │   ├── validation.js            # Schemas Joi
│   │   ├── crypto.js                # Criptografia
│   │   ├── formatters.js            # Formatação dados BR
│   │   └── index.js                 # Exports centralizados
│   │
│   ├── 📂 config/                   # Configurações
│   │   └── swagger.js               # Config documentação
│   │
│   ├── routes.js                    # Definição de rotas
│   └── handler.js                   # Entry point Lambda
│
├── 📂 migrations/                   # Sistema de migrations
│   ├── migration-runner.js          # Engine migrations
│   ├── 001_create_users_table.js    # Migration inicial
│   └── [numbered migrations...]     # Migrations versionadas
│
├── 📂 scripts/                      # Scripts auxiliares
│   └── create-migration.js          # Gerador migrations
│
├── 📂 sql/                          # Scripts SQL legacy
│   └── setup_databases.sql          # Setup inicial bancos
│
├── 📂 docs/                         # Documentação
│   ├── tutorial-migrations.md       # Tutorial migrations
│   ├── resumo-estrutura.md          # Este arquivo
│   ├── AWS_SETUP_INSTRUCTIONS.md    # Setup AWS
│   ├── SWAGGER.md                   # Doc API
│   ├── TESTES_INTERNOS.md           # Documentação de testes
│   ├── CONSULTA_PARAMETROS_AWS.md   # Consulta parâmetros AWS SSM
│   ├── RELATORIO_SEGURANCA.md       # Relatório de correções de segurança
│   └── naocompartilhar/             # Credenciais sensíveis (não versionado)
│       └── .naocompartilhar         # Arquivo com credenciais reais
│
├── 📂 testes-internos/              # Testes desenvolvimento (não versionado)
│   ├── test-db-connection.js        # Teste conexão DEV
│   ├── test-db-sandbox.js           # Teste conexão SANDBOX
│   ├── test-db-prod.js              # Teste conexão PROD
│   ├── test-all-environments.js     # Teste todos ambientes
│   ├── test-permissions-simple.js   # Teste permissões básicas
│   ├── check-permissions.js         # Verificação permissões detalhadas
│   ├── fix-permissions.sql          # Script correção permissões
│   └── README.md                    # Instruções de uso dos testes
│
├── .env.example                     # Template env vars
├── .env                            # Variáveis ambiente (local)
├── package.json                    # Dependências npm
├── serverless.yml                  # Config Serverless
└── README.md                       # Documentação principal
```

---

## 🔄 Fluxo de Dados

### 📈 Request Flow

```
1. Client Request
   ↓
2. AWS API Gateway
   ↓
3. AWS Lambda (handler.js)
   ↓
4. Express App (routes.js)
   ↓
5. Controller (validation + business logic call)
   ↓
6. Service (business rules)
   ↓
7. Model (database interaction)
   ↓
8. PostgreSQL RDS
```

### 🔄 Migration Flow

```
1. Application Start
   ↓
2. initializeDatabase()
   ↓
3. MigrationRunner.runPendingMigrations()
   ↓
4. Check migrations table
   ↓
5. Execute pending migrations
   ↓
6. Application ready
```

---

## 🗄️ Sistema de Migrations

### 🎯 Características

- **Versionamento sequencial** (001, 002, 003...)
- **Execução automática** na inicialização
- **Transações seguras** com rollback automático
- **Controle de estado** via tabela `migrations`
- **CLI amigável** com comandos npm

### 📋 Scripts NPM

```bash
npm run migrate              # Aplica migrations pendentes
npm run migrate:rollback     # Reverte última migration
npm run migrate:status       # Mostra status
npm run migrate:create nome  # Cria nova migration
```

### 🏗️ Estrutura Migration

```javascript
// migrations/XXX_nome.js
const up = async (client) => {
  // SQL para aplicar mudança
};

const down = async (client) => {
  // SQL para reverter mudança
};

module.exports = { up, down };
```

---

## 🔐 Sistema de Autenticação

### 🎯 Implementação

- **JWT Tokens** para autenticação stateless
- **bcrypt** para hash de senhas (salt rounds: 12)
- **Middleware customizado** para proteção rotas
- **Headers seguros** via Helmet.js

### 📋 Fluxo Auth

```
1. POST /api/auth/login
   ↓
2. Validação credenciais
   ↓
3. bcrypt.compare(password, hash)
   ↓
4. jwt.sign(payload, secret)
   ↓
5. Return { token, user }
```

---

## 🌍 Ambientes

### 🗂️ Configuração Multi-ambiente

| Ambiente    | Banco               | Usuário              | Deploy                   |
| ----------- | ------------------- | -------------------- | ------------------------ |
| **dev**     | `app_polox_dev`     | `polox_dev_user`     | `npm run deploy:dev`     |
| **sandbox** | `app_polox_sandbox` | `polox_sandbox_user` | `npm run deploy:sandbox` |
| **prod**    | `app_polox_prod`    | `polox_prod_user`    | `npm run deploy:prod`    |

### 🔧 Variáveis de Ambiente

```bash
# Database
DB_HOST=database-1.cd2em8e0a6ot.sa-east-1.rds.amazonaws.com
DB_PORT=5432
DB_NAME=app_polox_dev
DB_USER=polox_dev_user
DB_PASSWORD=[CONFIGURADO VIA AWS SSM]

# Auth
JWT_SECRET=[CONFIGURADO VIA AWS SSM]

# AWS
AWS_REGION=sa-east-1

# ⚠️ IMPORTANTE: Credenciais configuradas via AWS SSM Parameter Store
# Consulte docs/.naocompartilhar para as credenciais corretas
```

---

## 📊 Database Schema

### 👥 Tabela Users

```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Índices
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_status ON users(status);
```

### 🔄 Tabela Migrations

```sql
CREATE TABLE migrations (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) UNIQUE NOT NULL,
  executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

---

## 🚀 Scripts de Deploy

### 🛠️ Comandos Principais

```bash
# Desenvolvimento local
npm run dev                  # Serverless offline

# Deploy environments
npm run deploy:dev          # Deploy desenvolvimento
npm run deploy:sandbox      # Deploy sandbox/staging
npm run deploy:prod         # Deploy produção

# Logs
npm run logs:dev            # Logs desenvolvimento
npm run logs:prod           # Logs produção

# Cleanup
npm run remove:dev          # Remove stack dev
npm run remove:prod         # Remove stack prod
```

---

## 🔍 Logging & Monitoring

### 📊 Sistema Winston

```javascript
// Configuração logging
const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [new winston.transports.Console()],
});
```

### 📈 Métricas

- **Request/Response logging** automático
- **Database query performance** tracking
- **Error tracking** com stack traces
- **Migration execution** logging

---

## 🧪 Testes

### 🎯 Framework Jest

```bash
npm test                    # Executa testes
```

### 📁 Estrutura Testes

- **Unit tests**: Controllers, Services, Utils
- **Integration tests**: Database, API endpoints
- **Migration tests**: Via testes-internos/

---

## 📚 Documentação API

### 📖 Swagger/OpenAPI

- **Geração automática** via swagger-jsdoc
- **Interface web** em `/api-docs`
- **Schemas** definidos inline nos controllers

### 🔗 Endpoints Principais

```
POST   /api/auth/login      # Login usuário
POST   /api/auth/register   # Registro usuário
GET    /api/users           # Listar usuários
GET    /api/users/:id       # Buscar usuário
PUT    /api/users/:id       # Atualizar usuário
DELETE /api/users/:id       # Desativar usuário
```

---

## 🛡️ Segurança

### 🔒 Implementações

- **CORS** configurado por ambiente
- **Helmet.js** para headers seguros
- **JWT** com expiração configurável
- **Rate limiting** (via API Gateway)
- **Input validation** com Joi
- **SQL injection prevention** via parametrized queries

---

## 🚨 Troubleshooting

### ❌ Problemas Comuns

1. **ECONNREFUSED**: Verificar `.env` e credenciais DB
2. **Migration failed**: SQL syntax, rollback automático
3. **JWT invalid**: Verificar secret e expiração
4. **CORS errors**: Verificar configuração origins

### 🔧 Debug

```bash
# Logs locais
npm run dev

# Logs AWS
npm run logs:dev --tail

# Status banco
npm run migrate:status

# Teste conexão
node -e "require('./src/models/database').healthCheck().then(console.log)"
```

---

## 🎯 Roadmap & TODOs

### ✅ Implementado

- [x] Sistema migrations robusto
- [x] Autenticação JWT
- [x] CRUD usuários
- [x] Deploy multi-ambiente
- [x] Logging estruturado
- [x] Documentação Swagger

### 🚧 Próximas Features

- [ ] Rate limiting customizado
- [ ] Cache Redis
- [ ] Upload de arquivos S3
- [ ] Notificações email (SES)
- [ ] Testes automatizados (CI/CD)
- [ ] Monitoring CloudWatch
- [ ] API versioning

---

## 📞 Referências Úteis

### 🔗 Links Importantes

- **AWS RDS**: `database-1.cd2em8e0a6ot.sa-east-1.rds.amazonaws.com`
- **Serverless Framework**: `serverless.yml`
- **Migrations**: `migrations/migration-runner.js`
- **Docs**: `docs/tutorial-migrations.md`

### 👤 Contatos

- **Repositório**: github.com/LeonardoPoloPe/api.app.polox
- **Ambiente AWS**: devleonardopolo

---

**🎉 Esta documentação serve como referência completa para desenvolvimento, deploy e manutenção da API Polox!**
