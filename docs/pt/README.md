# API Polox - Serverless Node.js API para AWS Lambda

[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-13+-blue.svg)](https://postgresql.org/)
[![AWS Lambda](https://img.shields.io/badge/AWS-Lambda-orange.svg)](https://aws.amazon.com/lambda/)
[![Serverless](https://img.shields.io/badge/Serverless-Framework-red.svg)](https://serverless.com/)

**✨ Última Atualização: 21/10/2025** - [Ver Log de Mudanças](./ATUALIZACAO_21_10_2025.md)

API REST serverless construída com Node.js, Express, PostgreSQL RDS e AWS Lambda, seguindo padrões de arquitetura limpa e boas práticas de segurança.

## 🌐 **Ambientes Disponíveis (Atualizados)**

| Ambiente       | URL Base                                                          | Status   | Documentação |
| -------------- | ----------------------------------------------------------------- | -------- | ------------ |
| **🔧 DEV**     | `https://z8ixwvp0qe.execute-api.sa-east-1.amazonaws.com/dev/`     | ✅ Ativo | `/api/docs`  |
| **🧪 SANDBOX** | `https://el0qui6eqj.execute-api.sa-east-1.amazonaws.com/sandbox/` | ✅ Ativo | `/api/docs`  |
| **🚀 PROD**    | `https://18yioqws85.execute-api.sa-east-1.amazonaws.com/prod/`    | ✅ Ativo | `/api/docs`  |

### 🎯 **Quick Start - Testar API**

```bash
# Health Check
curl https://z8ixwvp0qe.execute-api.sa-east-1.amazonaws.com/dev/health

# Documentação Swagger
curl https://z8ixwvp0qe.execute-api.sa-east-1.amazonaws.com/dev/api/docs

# Info da API
curl https://z8ixwvp0qe.execute-api.sa-east-1.amazonaws.com/dev/
```

## ⚡ **Deploy Rápido**

### 🚀 **Para Deploy Imediato:**

```bash
# 1. Instalar dependências
npm install

# 2. Configurar credenciais AWS (se necessário)
aws configure

# 3. Deploy para desenvolvimento
npm run deploy:dev

# 4. Testar se funcionou
curl https://z8ixwvp0qe.execute-api.sa-east-1.amazonaws.com/dev/health
```

### 📊 **Para Logs em Tempo Real:**

```bash
# Ver logs do ambiente de desenvolvimento
npm run logs:dev

# Ou usar o Serverless diretamente
serverless logs -f api --stage dev --region sa-east-1 --tail
```

### 🛠️ **Comandos Essenciais:**

```bash
# Deploy para todos os ambientes
npm run deploy:dev      # Desenvolvimento
npm run deploy:sandbox  # Teste
npm run deploy:prod     # Produção

# Remover ambientes (cuidado!)
serverless remove --stage dev --region sa-east-1
```

📋 **[Ver Comandos Completos](./COMANDOS_DEPLOY.md)** | 🐛 **[Troubleshooting](./ATUALIZACAO_21_10_2025.md#-troubleshooting-comum)**

---

## 🚀 Sistema de Migrations

Este projeto utiliza um **sistema robusto de migrations** para gerenciar o versionamento e evolução do banco de dados de forma segura e consistente.

### ⚙️ Configuração Inicial

**IMPORTANTE**: Antes de executar as migrations, configure o arquivo `.env`:

```bash
# 1. Copie o arquivo de exemplo
copy .env.example .env

# 2. Edite o .env e configure as credenciais corretas:
DB_PASSWORD=sua_senha_segura_aqui
```

### 📋 Comandos Disponíveis

```bash
# Executar migrations pendentes
npm run migrate

# Reverter última migration
npm run migrate:rollback

# Ver status das migrations
npm run migrate:status

# Criar nova migration
npm run migrate:create nome_da_migration
```

### 🏗️ Como Funciona

1. **Execução Automática**: Migrations são executadas automaticamente quando a aplicação inicia
2. **Controle de Versão**: Cada migration é versionada sequencialmente (001, 002, 003...)
3. **Transações Seguras**: Cada migration executa dentro de uma transação (rollback automático em caso de erro)
4. **Rollback**: Possibilidade de reverter mudanças com segurança
5. **Status**: Visualização clara de quais migrations foram executadas

### 📝 Criando Nova Migration

```bash
# Exemplo: Adicionar tabela de perfis
npm run migrate:create add_user_profiles
```

Isso criará o arquivo `migrations/002_add_user_profiles.js`:

```javascript
const up = async (client) => {
  const query = `
    CREATE TABLE user_profiles (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      bio TEXT,
      avatar_url VARCHAR(500)
    );
  `;
  await client.query(query);
};

const down = async (client) => {
  await client.query("DROP TABLE IF EXISTS user_profiles");
};

module.exports = { up, down };
```

### 🔧 Estrutura de Migrations

```
migrations/
├── migration-runner.js          # Engine das migrations
├── 001_create_users_table.js    # Migration inicial - tabela users
└── 002_exemplo.js               # Próximas migrations...
```

### ✅ Boas Práticas

- **Sempre teste** migrations em ambiente de desenvolvimento primeiro
- **Inclua rollback** em todas as migrations (método `down`)
- **Use transações** para operações que podem falhar parcialmente
- **Documente** o propósito de cada migration
- **Não edite** migrations já executadas em produção

---

## 🏗️ Estrutura do Projeto

```
api.app.polox/
├── src/
│ ├── controllers/ # Controladores - recebem requisições, validam e chamam services
│ │ ├── authController.js # Autenticação (login, registro, refresh token)
│ │ ├── userController.js # Gerenciamento de usuários
│ │ └── index.js # Exportação centralizada
│ ├── services/ # Lógica de negócio, autenticação, integrações
│ │ ├── AuthService.js # Serviços de autenticação
│ │ ├── UserService.js # Serviços de usuário
│ │ └── index.js # Exportação centralizada
│ ├── models/ # Models e conexão com PostgreSQL
│ │ ├── database.js # Configuração e pool de conexões
│ │ ├── User.js # Model de usuário com métodos CRUD
│ │ └── index.js # Exportação centralizada
│ ├── utils/ # Helpers e utilitários
│ │ ├── auth.js # JWT, middleware de autenticação
│ │ ├── validation.js # Validação com Joi, sanitização
│ │ ├── crypto.js # Criptografia, hashing de senhas
│ │ ├── formatters.js # Formatação de dados brasileiros
│ │ └── index.js # Exportação centralizada
│ ├── routes.js # Definição de rotas e middlewares
│ └── handler.js # Entry point do Lambda, conecta Express ao serverless
├── migrations/ # Sistema de migrations do banco de dados
│ ├── migration-runner.js # Engine das migrations
│ ├── 001_create_users_table.js # Migration inicial - tabela users
│ └── [futuras migrations...] # Próximas migrations versionadas
├── scripts/ # Scripts auxiliares
│ └── create-migration.js # Script para criar novas migrations
├── sql/ # Scripts SQL legacy (para setup inicial)
│ └── setup_databases.sql # Script de criação dos bancos e usuários
├── package.json # Dependências e scripts npm (incluindo migrations)
├── serverless.yml # Configuração do Serverless Framework
├── .env.example # Exemplo de variáveis de ambiente
├── .gitignore # Arquivos ignorados pelo Git
└── README.md # Este arquivo

```

## 🗄️ Bancos de Dados PostgreSQL RDS

### ⚡ Fluxo Automático de Migrations

**🎯 IMPORTANTE**: As migrations são executadas **automaticamente** quando a aplicação inicia! Isso garante que o banco sempre esteja na versão correta.

```javascript
// handler.js - Processo de inicialização
const initializeDatabase = async () => {
  // 1. Conecta ao banco
  await initializePool();

  // 2. Executa migrations pendentes automaticamente
  const migrationRunner = new MigrationRunner();
  await migrationRunner.runPendingMigrations();

  // 3. Aplicação pronta para uso
};
```

### 🔧 Comandos de Migration

```bash
# Ver status atual
npm run migrate:status

# Aplicar migrations pendentes (manual)
npm run migrate

# Reverter última migration
npm run migrate:rollback

# Criar nova migration
npm run migrate:create add_user_profiles
```

### 📊 Configuração dos Bancos

**Host:** `database-1.cd2em8e0a6ot.sa-east-1.rds.amazonaws.com`
**Porta:** `5432`
**Encoding:** `UTF-8`
**Locale:** `pt_BR.UTF-8`

### 🗂️ Bancos por Ambiente

| Ambiente            | Banco de Dados      | Usuário              | Descrição                               |
| ------------------- | ------------------- | -------------------- | --------------------------------------- |
| **Desenvolvimento** | `app_polox_dev`     | `polox_dev_user`     | Para desenvolvimento local e testes     |
| **Sandbox**         | `app_polox_sandbox` | `polox_sandbox_user` | Para testes de integração e homologação |
| **Produção**        | `app_polox_prod`    | `polox_prod_user`    | Ambiente de produção                    |

### 🚀 Setup Inicial dos Bancos

> **Nota**: Execute apenas uma vez para criar bancos e usuários. As tabelas são criadas automaticamente via migrations!

1. Execute o script SQL de setup:

```bash
psql -h database-1.cd2em8e0a6ot.sa-east-1.rds.amazonaws.com -U postgres -f sql/setup_databases.sql
```

2. Configure as senhas no AWS Systems Manager Parameter Store:

```bash
# Para cada ambiente, configure as senhas como SecureString
aws ssm put-parameter --name "/polox/dev/db/password" --value "sua_senha_dev" --type "SecureString"
aws ssm put-parameter --name "/polox/sandbox/db/password" --value "sua_senha_sandbox" --type "SecureString"
aws ssm put-parameter --name "/polox/prod/db/password" --value "sua_senha_prod" --type "SecureString"

# Configure também os JWT secrets
aws ssm put-parameter --name "/polox/dev/jwt/secret" --value "seu_jwt_secret_dev" --type "SecureString"
aws ssm put-parameter --name "/polox/sandbox/jwt/secret" --value "seu_jwt_secret_sandbox" --type "SecureString"
aws ssm put-parameter --name "/polox/prod/jwt/secret" --value "seu_jwt_secret_prod" --type "SecureString"
```

## 🔧 Instalação e Configuração

### Pré-requisitos

- Node.js 18+
- npm ou yarn
- AWS CLI configurado
- PostgreSQL client (para setup dos bancos)

### Instalação

1. **Clone o repositório:**

```bash
git clone https://github.com/LeonardoPoloPe/api.app.polox.git
cd api.app.polox
```

2. **Instale as dependências:**

```bash
npm install
```

3. **Configure as variáveis de ambiente:**

```bash
cp .env.example .env
# Edite o arquivo .env com suas configurações
```

4. **Configure os parâmetros no AWS SSM:**

```bash
# Execute os comandos de configuração mostrados na seção anterior
```

## 🚀 Execução

### Desenvolvimento Local

```bash
# Executar localmente (usando serverless-offline)
npm run dev

# Ou executar diretamente com Node.js
node src/handler.js
```

A API estará disponível em `http://localhost:3000`

### Deploy nos Ambientes

```bash
# Deploy para desenvolvimento
npm run deploy:dev

# Deploy para sandbox
npm run deploy:sandbox

# Deploy para produção
npm run deploy:prod
```

### Scripts Disponíveis

```bash
npm run dev              # Execução local com serverless-offline
npm run deploy:dev       # Deploy para ambiente de desenvolvimento
npm run deploy:sandbox   # Deploy para ambiente de sandbox
npm run deploy:prod      # Deploy para ambiente de produção
npm run logs:dev         # Visualizar logs do ambiente dev
npm run logs:sandbox     # Visualizar logs do ambiente sandbox
npm run logs:prod        # Visualizar logs do ambiente prod
npm run remove:dev       # Remover stack do ambiente dev
npm run remove:sandbox   # Remover stack do ambiente sandbox
npm run remove:prod      # Remover stack do ambiente prod
```

## 📡 API Endpoints

### Endpoints Públicos

| Método | Endpoint             | Descrição                 |
| ------ | -------------------- | ------------------------- |
| `GET`  | `/`                  | Informações da API        |
| `GET`  | `/health`            | Health check da aplicação |
| `POST` | `/api/auth/register` | Registro de usuário       |
| `POST` | `/api/auth/login`    | Login de usuário          |
| `POST` | `/api/auth/refresh`  | Renovação de token        |

### Endpoints Protegidos (Requerem Token)

| Método   | Endpoint             | Descrição                     |
| -------- | -------------------- | ----------------------------- |
| `POST`   | `/api/auth/logout`   | Logout de usuário             |
| `GET`    | `/api/users/profile` | Perfil do usuário autenticado |
| `PUT`    | `/api/users/profile` | Atualizar perfil              |
| `DELETE` | `/api/users/profile` | Desativar conta               |
| `GET`    | `/api/users`         | Listar usuários (admin)       |
| `GET`    | `/api/users/:id`     | Buscar usuário por ID         |

### Endpoints de Demonstração

| Método | Endpoint              | Descrição                  |
| ------ | --------------------- | -------------------------- |
| `GET`  | `/api/demo/public`    | Rota pública de exemplo    |
| `GET`  | `/api/demo/protected` | Rota protegida de exemplo  |
| `GET`  | `/api/test/database`  | Teste de conexão com banco |

## 🔐 Autenticação

A API usa JWT (JSON Web Tokens) para autenticação. O processo funciona da seguinte forma:

1. **Registro/Login:** Retorna `access_token` e `refresh_token`
2. **Requisições:** Incluir `Authorization: Bearer <access_token>` no header
3. **Renovação:** Usar `refresh_token` para obter novo `access_token`

### Exemplo de Uso

```javascript
// Registro
const registerResponse = await fetch("/api/auth/register", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    name: "João Silva",
    email: "joao@example.com",
    password: "MinhaSenh@123",
  }),
});

// Login
const loginResponse = await fetch("/api/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    email: "joao@example.com",
    password: "MinhaSenh@123",
  }),
});

const { access_token } = await loginResponse.json();

// Requisição autenticada
const profileResponse = await fetch("/api/users/profile", {
  headers: {
    Authorization: `Bearer ${access_token}`,
    "Content-Type": "application/json",
  },
});
```

## ⚙️ Variáveis de Ambiente

### Variáveis Obrigatórias

| Variável      | Descrição                   | Exemplo                                               |
| ------------- | --------------------------- | ----------------------------------------------------- |
| `NODE_ENV`    | Ambiente de execução        | `dev`, `sandbox`, `prod`                              |
| `DB_HOST`     | Host do PostgreSQL RDS      | `database-1.cd2em8e0a6ot.sa-east-1.rds.amazonaws.com` |
| `DB_PORT`     | Porta do PostgreSQL         | `5432`                                                |
| `DB_NAME`     | Nome do banco de dados      | `app_polox_dev`                                       |
| `DB_USER`     | Usuário do banco            | `polox_dev_user`                                      |
| `DB_PASSWORD` | Senha do banco (via SSM)    | `${ssm:/polox/dev/db/password~true}`                  |
| `JWT_SECRET`  | Chave secreta JWT (via SSM) | `${ssm:/polox/dev/jwt/secret~true}`                   |

### Variáveis Opcionais

| Variável         | Descrição             | Padrão              |
| ---------------- | --------------------- | ------------------- |
| `TZ`             | Timezone              | `America/Sao_Paulo` |
| `PORT`           | Porta local (dev)     | `3000`              |
| `ENCRYPTION_KEY` | Chave de criptografia | -                   |

## 🛡️ Segurança e Boas Práticas

### Implementadas

✅ **Autenticação JWT** com tokens de acesso e refresh  
✅ **Hashing de senhas** com bcrypt (salt rounds: 12)  
✅ **Validação de entrada** com Joi schemas  
✅ **Rate limiting** via AWS API Gateway  
✅ **CORS** configurado por ambiente  
✅ **Helmet.js** para headers de segurança  
✅ **Sanitização de dados** removendo campos sensíveis  
✅ **Logs estruturados** sem dados sensíveis  
✅ **Secrets no AWS SSM** Parameter Store  
✅ **Conexão SSL** com PostgreSQL RDS  
✅ **Timeout de Lambda** configurado (15s)

### Recomendações Adicionais

- Use AWS RDS Proxy para melhor gestão de conexões
- Implemente rate limiting personalizado se necessário
- Configure VPC Endpoints para serviços AWS
- Use AWS WAF para proteção adicional
- Monitore logs no CloudWatch
- Configure alertas para erros e métricas

## 📊 Monitoramento e Logs

### CloudWatch Logs

Os logs são enviados automaticamente para CloudWatch com as seguintes informações:

- **Requisições HTTP:** método, URL, IP, user-agent, duração
- **Autenticação:** tentativas de login, registro, renovação de token
- **Erros:** stack traces completos em desenvolvimento
- **Database:** queries executadas, duração, erros de conexão

### Health Check

Endpoint de health check disponível em `/health`:

```json
{
  "status": "healthy",
  "timestamp": "2025-10-18T10:30:00.000Z",
  "environment": "dev",
  "database": "connected",
  "version": "1.0.0"
}
```

## 🧪 Testes

### 📁 **REGRA BÁSICA DE TESTES**

> **⚠️ IMPORTANTE**: Todos os arquivos de teste devem ser colocados na pasta `testes-internos/` e nunca devem ir para produção. Esta pasta está no `.gitignore` por motivos de segurança.

### Testes de Conexão de Banco

```bash
# Testar conexão com ambiente DEV
node testes-internos/test-db-connection.js

# Testar conexão com ambiente SANDBOX
node testes-internos/test-db-sandbox.js

# Testar conexão com ambiente PRODUÇÃO
node testes-internos/test-db-prod.js

# Testar TODOS os ambientes em sequência
node testes-internos/test-all-environments.js
```

### Testes Unitários (quando implementados)

```bash
# Executar testes
npm test

# Executar com coverage
npm run test:coverage
```

### Estrutura de Testes

```
testes-internos/           # 🚫 Pasta ignorada pelo Git
├── test-db-connection.js  # Teste de conexão DEV
├── test-db-sandbox.js     # Teste de conexão SANDBOX
├── test-db-prod.js        # Teste de conexão PRODUÇÃO
├── test-all-environments.js # Teste completo de todos os ambientes
└── ... outros testes internos
```

**🔒 Segurança**: A pasta `testes-internos/` contém credenciais e informações sensíveis, por isso é ignorada pelo Git.

## 🔄 Pipeline CI/CD

Para implementar CI/CD, recomenda-se:

1. **GitHub Actions** ou **AWS CodePipeline**
2. **Testes automatizados** em cada push
3. **Deploy automático:**
   - `main` branch → produção
   - `develop` branch → sandbox
   - Feature branches → review apps

## 📝 Contribuição

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo `LICENSE` para mais detalhes.

## 🆘 Suporte

Para dúvidas e suporte:

- **Email:** suporte@polox.com
- **Issues:** [GitHub Issues](https://github.com/LeonardoPoloPe/api.app.polox/issues)
- **Documentação:** Este README e comentários no código

---

**Desenvolvido pela equipe Polox** 🚀

````

---

## Detalhes de cada pasta/arquivo

- **controllers/**
  Recebe requisições, faz validações básicas, chama funções do service correspondente e retorna resposta.
  Exemplo: `authController.js`, `paymentController.js`.

- **services/**
  Toda lógica de negócio fica aqui. Ex: autenticação, regras de pagamento, integração com Stripe, etc.
  Nunca coloque lógica complexa diretamente nos controllers.

- **models/**
  Representa a estrutura do banco. Pode usar Prisma ou outro ORM.
  Ex: `User.js`, `Payment.js`.

- **utils/**
  Funções genéricas ou helpers: JWT, hashing de senha, formatação de data, validação de campos.

- **routes.js**
  Define rotas e vincula controllers. Exemplo:

  ```js
  router.post("/login", authController.login);
  router.post("/signup", authController.signup);
  router.post("/payment", paymentController.processPayment);
````

- **handler.js**  
  Entry point do Lambda, conecta Express ao serverless:
  ```js
  const serverless = require("serverless-http");
  const app = require("./routes");
  module.exports.handler = serverless(app);
  ```

---

## Tecnologias e Pacotes

- Node.js 18+
- AWS Lambda
- AWS RDS (PostgreSQL)
- JWT para autenticação
- bcrypt para hashing de senhas
- Stripe (ou outro) para pagamentos
- Serverless Framework ou SAM para deploy

---

## Configuração Inicial do RDS (PostgreSQL)

**Endpoint da instância:**

```
database-1.cd2em8e0a6ot.sa-east-1.rds.amazonaws.com
```

**Porta:** 5432

### Bancos de dados

```sql
CREATE DATABASE app_polox_prod
  WITH ENCODING='UTF8'
       LC_COLLATE='pt_BR.UTF-8'
       LC_CTYPE='pt_BR.UTF-8'
       TEMPLATE=template0;

CREATE DATABASE app_polox_sandbox
  WITH ENCODING='UTF8'
       LC_COLLATE='pt_BR.UTF-8'
       LC_CTYPE='pt_BR.UTF-8'
       TEMPLATE=template0;

CREATE DATABASE app_polox_dev
  WITH ENCODING='UTF8'
       LC_COLLATE='pt_BR.UTF-8'
       LC_CTYPE='pt_BR.UTF-8'
       TEMPLATE=template0;
```

### Usuários e permissões

```sql
-- Usuário produção
CREATE USER polox_prod_user WITH PASSWORD 'SUA_SENHA_PROD_SEGURA_AQUI';

-- Usuário sandbox
CREATE USER polox_sandbox_user WITH PASSWORD 'SUA_SENHA_SANDBOX_SEGURA_AQUI';

-- Usuário desenvolvimento
CREATE USER polox_dev_user WITH PASSWORD 'SUA_SENHA_DEV_SEGURA_AQUI';

-- Permissões completas
GRANT ALL PRIVILEGES ON DATABASE app_polox_prod TO polox_prod_user;
GRANT ALL PRIVILEGES ON DATABASE app_polox_sandbox TO polox_sandbox_user;
GRANT ALL PRIVILEGES ON DATABASE app_polox_dev TO polox_dev_user;
```

⚠️ **IMPORTANTE:**

- **Substitua** os placeholders pelas senhas reais e seguras
- **Consulte** `docs/.naocompartilhar` para as credenciais corretas (desenvolvedores autorizados)
- **Armazene** as senhas no AWS Systems Manager Parameter Store
- **Nunca** commite senhas reais no código

---

## Boas práticas

- Controllers não devem conter lógica de negócio.
- Lambdas devem ser stateless (use JWT, não sessions em memória).
- Variáveis de ambiente e secrets devem estar no Secrets Manager ou SSM.
- Logs via console.log → CloudWatch. Evite imprimir dados sensíveis.
- Conexão RDS via pooling ou RDS Proxy para Lambda.
- Timeout Lambda: 10-15s máximo.
- Separação de ambientes: use os 3 bancos e usuários distintos (dev, sandbox, prod) para evitar dados cruzados.
- Timezone: configure o Parameter Group do RDS para America/Sao_Paulo se precisar horário local.

---

## Conexão nos modelos / ORM

Exemplo usando pg (node-postgres):

```js
const { Pool } = require("pg");

const pool = new Pool({
  host: process.env.DB_HOST, // database-1.cd2em8e0a6ot.sa-east-1.rds.amazonaws.com
  port: 5432,
  database: process.env.DB_NAME, // app_polox_dev / sandbox / prod
  user: process.env.DB_USER, // polox_dev_user / sandbox / prod
  password: process.env.DB_PASSWORD,
  max: 10,
  idleTimeoutMillis: 30000,
});

module.exports = pool;
```

- Use variáveis de ambiente para DB_HOST, DB_NAME, DB_USER e DB_PASSWORD.
- Para Lambda, configure no Serverless Framework ou Environment Variables no console.

---

Isso já dá para o Copilot configurar o projeto, preparar os models, conectar aos 3 bancos e preparar para deploy em Lambda sem precisar mexer manualmente.
