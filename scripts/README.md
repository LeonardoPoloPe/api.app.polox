# 📚 Scripts Utilitários - API Polox CRM

Este diretório contém scripts úteis para gerenciamento do projeto.

---

## 🎯 **Scripts Principais**

### **🌱 Seeds e Usuários**

#### `seed-admin-all-environments.js`
Cria usuário admin em **todos** os ambientes (DEV, SANDBOX, PROD).

```bash
node scripts/seed-admin-all-environments.js
```

**Credenciais criadas:**
- Email: `admin@polox.com`
- Senha: `Admin@2024`
- Role: `super_admin`

#### `seed-admin-sandbox.js`
Cria usuário admin apenas no ambiente **SANDBOX**.

```bash
node scripts/seed-admin-sandbox.js
```

---

### **🧪 Testes**

#### `test-all-environments.js` ⭐
Testa o endpoint de login em **todos** os ambientes (DEV, SANDBOX, PROD).

```bash
node scripts/test-all-environments.js
```

**Saída:**
- ✅ Status de cada ambiente
- 👤 Dados do usuário autenticado
- 🎫 Token JWT gerado

#### `test-db-connections.js` ⭐
Testa a conectividade com os bancos de dados.

```bash
node scripts/test-db-connections.js
```

**Verifica:**
- 🔌 Conexão com o banco
- 📊 Quantidade de usuários
- 🏢 Quantidade de empresas

---

### **🗄️ Migrations**

#### `create-migration.js`
Cria uma nova migration no formato correto.

```bash
node scripts/create-migration.js nome-da-migration
```

#### `migrate-environment.js`
Executa migrations em um ambiente específico.

```bash
node scripts/migrate-environment.js [ambiente]
# ambiente: dev, sandbox ou prod
```

#### `run-migrations-dev.js`
Executa migrations no ambiente de desenvolvimento.

```bash
node scripts/run-migrations-dev.js
```

---

### **☁️ AWS**

#### `setup-aws.sh`
Configuração inicial do ambiente AWS.

```bash
bash scripts/setup-aws.sh
```

#### `migrate-secrets-to-aws.sh`
Migra secrets locais para AWS Secrets Manager.

```bash
bash scripts/migrate-secrets-to-aws.sh
```

#### `load-secrets-from-ssm.js`
Carrega secrets do AWS Systems Manager.

```bash
node scripts/load-secrets-from-ssm.js
```

#### `test-ssm-migrations.js`
Testa execução de migrations via AWS SSM.

```bash
node scripts/test-ssm-migrations.js
```

---

### **🔧 Utilidades**

#### `check-database-status.js`
Verifica o status e estrutura dos bancos de dados.

```bash
node scripts/check-database-status.js
```

#### `clean-test-db.js`
Limpa dados de teste do banco de dados.

```bash
node scripts/clean-test-db.js
```

#### `grant-test-permissions.js`
Concede permissões necessárias para testes.

```bash
node scripts/grant-test-permissions.js
```

#### `add-language-param-swagger.js`
Adiciona parâmetros de idioma no Swagger.

```bash
node scripts/add-language-param-swagger.js
```

---

## 🚀 **Fluxo de Trabalho Comum**

### **1. Setup Inicial**
```bash
# Configurar AWS
bash scripts/setup-aws.sh

# Criar usuários admin
node scripts/seed-admin-all-environments.js
```

### **2. Testes**
```bash
# Testar conexões
node scripts/test-db-connections.js

# Testar APIs
node scripts/test-all-environments.js
```

### **3. Migrations**
```bash
# Criar nova migration
node scripts/create-migration.js add-nova-coluna

# Executar no DEV
node scripts/run-migrations-dev.js

# Executar em outros ambientes
node scripts/migrate-environment.js sandbox
node scripts/migrate-environment.js prod
```

---

## 📊 **Status dos Ambientes**

| Ambiente | API Gateway | Banco | Status |
|----------|-------------|-------|--------|
| **DEV** | `z8ixwvp0qe.execute-api.sa-east-1.amazonaws.com` | `app_polox_dev` | ✅ |
| **SANDBOX** | `el0qui6eqj.execute-api.sa-east-1.amazonaws.com` | `app_polox_sandbox` | ✅ |
| **PROD** | `18yioqws85.execute-api.sa-east-1.amazonaws.com` | `app_polox_dev` | ✅ |

---

## 🔐 **Credenciais Padrão**

**Usuário Admin (todos os ambientes):**
```
Email: admin@polox.com
Senha: Admin@2024
Role: super_admin
```

**⚠️ IMPORTANTE:** Altere estas credenciais em produção!

---

## 🧹 **Manutenção**

### Scripts Removidos
27 scripts obsoletos foram removidos em 27/10/2025:
- Scripts de debug pontuais
- Migrations específicas já executadas
- Checks temporários
- Duplicados e arquivos desnecessários

### Backup
Antes de deletar scripts, sempre faça commit das alterações.

---

## 📝 **Notas**

- Todos os scripts Node.js requerem as dependências instaladas (`npm install`)
- Scripts bash requerem permissão de execução (`chmod +x script.sh`)
- Configure suas credenciais AWS antes de usar scripts AWS
- Use `.env` para configurações locais

---

## 🆘 **Ajuda**

Para mais informações sobre cada script, leia os comentários no início do arquivo ou execute:

```bash
node scripts/[nome-do-script].js --help
```

---

**Última atualização:** 27 de outubro de 2025
