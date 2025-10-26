# 🗄️ Setup do Banco de Dados para Testes

**Data:** 26/10/2025  
**Objetivo:** Criar banco `app_polox_test` no RDS para execução de testes automatizados

---

## 📋 Pré-requisitos

- Acesso ao RDS: `database-1.cd2em8e0a6ot.sa-east-1.rds.amazonaws.com`
- Usuário com permissões para criar bancos (postgres ou master user)
- Cliente `psql` instalado

---

## 🔧 Comandos SQL para Executar

### 1. Conectar ao RDS como usuário master

```bash
# Conectar ao banco postgres (banco padrão)
psql -h database-1.cd2em8e0a6ot.sa-east-1.rds.amazonaws.com \
     -U postgres \
     -d postgres
```

### 2. Criar o banco de teste

```sql
-- Criar banco app_polox_test
CREATE DATABASE app_polox_test
    WITH 
    OWNER = postgres
    ENCODING = 'UTF8'
    LC_COLLATE = 'pt_BR.UTF-8'
    LC_CTYPE = 'pt_BR.UTF-8'
    TEMPLATE = template0;

-- Comentário descritivo
COMMENT ON DATABASE app_polox_test IS 'Banco de dados para testes automatizados da API Polox';
```

### 3. Conceder permissões ao usuário de desenvolvimento

```sql
-- Conceder todas as permissões no banco app_polox_test ao polox_dev_user
GRANT ALL PRIVILEGES ON DATABASE app_polox_test TO polox_dev_user;

-- Conectar ao banco app_polox_test
\c app_polox_test

-- Conceder permissões no schema public
GRANT ALL PRIVILEGES ON SCHEMA public TO polox_dev_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO polox_dev_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO polox_dev_user;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO polox_dev_user;

-- Configurar privilégios padrão para objetos futuros
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO polox_dev_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO polox_dev_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO polox_dev_user;
```

### 4. Criar schema polox (usado pela aplicação)

```sql
-- Ainda conectado ao app_polox_test
CREATE SCHEMA IF NOT EXISTS polox;

-- Conceder permissões no schema polox
GRANT ALL PRIVILEGES ON SCHEMA polox TO polox_dev_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA polox TO polox_dev_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA polox TO polox_dev_user;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA polox TO polox_dev_user;

-- Configurar privilégios padrão para schema polox
ALTER DEFAULT PRIVILEGES IN SCHEMA polox GRANT ALL ON TABLES TO polox_dev_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA polox GRANT ALL ON SEQUENCES TO polox_dev_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA polox GRANT ALL ON FUNCTIONS TO polox_dev_user;

-- Configurar search_path padrão
ALTER DATABASE app_polox_test SET search_path TO polox, public;
```

### 5. Verificar se tudo está correto

```sql
-- Listar bancos
\l app_polox_test

-- Verificar permissões
\c app_polox_test
\dn+ polox

-- Verificar se usuário pode criar tabelas
SET ROLE polox_dev_user;
CREATE TABLE polox.test_permissions (id INT);
DROP TABLE polox.test_permissions;
RESET ROLE;

-- Sair
\q
```

---

## 🚀 Comando Rápido (Tudo de uma vez)

```bash
# Salve este script em setup_test_db.sql e execute:
psql -h database-1.cd2em8e0a6ot.sa-east-1.rds.amazonaws.com \
     -U postgres \
     -d postgres \
     -f setup_test_db.sql
```

**Conteúdo do arquivo `setup_test_db.sql`:**

```sql
-- Criar banco
CREATE DATABASE app_polox_test
    WITH 
    OWNER = postgres
    ENCODING = 'UTF8'
    LC_COLLATE = 'pt_BR.UTF-8'
    LC_CTYPE = 'pt_BR.UTF-8'
    TEMPLATE = template0;

COMMENT ON DATABASE app_polox_test IS 'Banco de dados para testes automatizados da API Polox';

-- Conceder permissões
GRANT ALL PRIVILEGES ON DATABASE app_polox_test TO polox_dev_user;

-- Conectar ao banco de teste
\c app_polox_test

-- Configurar schemas
CREATE SCHEMA IF NOT EXISTS polox;
GRANT ALL PRIVILEGES ON SCHEMA public TO polox_dev_user;
GRANT ALL PRIVILEGES ON SCHEMA polox TO polox_dev_user;

-- Permissões em objetos existentes
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO polox_dev_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO polox_dev_user;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO polox_dev_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA polox TO polox_dev_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA polox TO polox_dev_user;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA polox TO polox_dev_user;

-- Permissões padrão para objetos futuros
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO polox_dev_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO polox_dev_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO polox_dev_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA polox GRANT ALL ON TABLES TO polox_dev_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA polox GRANT ALL ON SEQUENCES TO polox_dev_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA polox GRANT ALL ON FUNCTIONS TO polox_dev_user;

-- Configurar search_path
ALTER DATABASE app_polox_test SET search_path TO polox, public;

SELECT 'Banco app_polox_test criado com sucesso!' AS status;
```

---

## ✅ Verificação Final

Após criar o banco, teste a conexão:

```bash
# Testar conexão como polox_dev_user
PGPASSWORD='SenhaSeguraDev123!' psql \
    -h database-1.cd2em8e0a6ot.sa-east-1.rds.amazonaws.com \
    -U polox_dev_user \
    -d app_polox_test \
    -c "SELECT current_database(), current_user;"
```

**Resultado esperado:**
```
 current_database | current_user  
------------------+---------------
 app_polox_test   | polox_dev_user
```

---

## 🧪 Executar Testes

Após configurar o banco, execute:

```bash
# Executar testes de validação
npm test -- tests/validacao-infraestrutura.test.js

# Executar todos os testes
npm test

# Executar testes com coverage
npm run test:coverage
```

---

## 📊 Status do Banco

| Item | Status |
|------|--------|
| Banco `app_polox_test` criado | ⏳ Pendente |
| Permissões para `polox_dev_user` | ⏳ Pendente |
| Schema `polox` criado | ⏳ Pendente |
| Migrations executadas | ⏳ Aguardando banco |
| Testes executando | ⏳ Aguardando banco |

---

## 🔒 Segurança

- ✅ Credenciais armazenadas em `.env.test` (não commitado)
- ✅ Mesmo padrão do `dev-mysql` no AWS Secrets Manager
- ✅ Banco isolado apenas para testes (não afeta dev/sandbox/prod)
- ✅ Dados limpos automaticamente entre testes

---

## 📞 Troubleshooting

### Erro: "permission denied to create database"
- Conecte como usuário `postgres` (master user)
- O usuário `polox_dev_user` não tem permissão para criar bancos

### Erro: "SSL connection required"
- O setup.js já está configurado com SSL
- Certifique-se de usar `rejectUnauthorized: false`

### Erro: "schema polox does not exist"
- Execute o passo 4 (criar schema polox)
- As migrations criarão o schema automaticamente se não existir

---

**Criado por:** GitHub Copilot  
**Última atualização:** 26/10/2025
