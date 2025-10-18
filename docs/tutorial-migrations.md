# 🚀 Tutorial: Sistema de Migrations - API Polox

## 📖 Índice

1. [Introdução](#introdução)
2. [Configuração Inicial](#configuração-inicial)
3. [Comandos Básicos](#comandos-básicos)
4. [Criando Sua Primeira Migration](#criando-sua-primeira-migration)
5. [Estrutura de uma Migration](#estrutura-de-uma-migration)
6. [Exemplos Práticos](#exemplos-práticos)
7. [Boas Práticas](#boas-práticas)
8. [Troubleshooting](#troubleshooting)

---

## 🎯 Introdução

O sistema de migrations da API Polox permite versionar e gerenciar mudanças no banco de dados de forma segura e consistente. Cada migration é um arquivo JavaScript que define como aplicar (`up`) e reverter (`down`) uma mudança no banco.

### ✅ Por que usar migrations?

- **Versionamento**: Controle total sobre mudanças no banco
- **Colaboração**: Time sempre com banco na mesma versão
- **Deploy Seguro**: Mudanças aplicadas automaticamente
- **Rollback**: Reversão segura em caso de problemas
- **Ambientes**: Sincronização entre dev/staging/prod

---

## ⚙️ Configuração Inicial

### 1. Configure o arquivo `.env`

```bash
# Copie o arquivo de exemplo
copy .env.example .env
```

Edite o `.env` com suas configurações:

```bash
# Banco de dados PostgreSQL RDS
DB_HOST=database-1.cd2em8e0a6ot.sa-east-1.rds.amazonaws.com
DB_PORT=5432
DB_NAME=app_polox_dev
DB_USER=polox_dev_user
DB_PASSWORD=sua_senha_dev_segura_aqui

# ⚠️ IMPORTANTE: Substitua por uma senha real e segura
# Consulte docs/.naocompartilhar para as credenciais corretas
```

### 2. Instale as dependências

```bash
npm install
```

### 3. Teste a conexão

```bash
npm run migrate:status
```

Se tudo estiver correto, você verá:

```
📊 STATUS DAS MIGRATIONS
========================

✅ EXECUTADA - 001_create_users_table
Total: 1 migrations
Executadas: 1
Pendentes: 0
```

---

## 📋 Comandos Básicos

### Ver Status das Migrations

```bash
npm run migrate:status
```

**Saída:**

- ✅ **EXECUTADA** - Migration já aplicada
- ⏳ **PENDENTE** - Migration ainda não executada

### Executar Migrations Pendentes

```bash
npm run migrate
```

Aplica todas as migrations que ainda não foram executadas.

### Reverter Última Migration

```bash
npm run migrate:rollback
```

⚠️ **Cuidado**: Use apenas em desenvolvimento ou emergências!

### Criar Nova Migration

```bash
npm run migrate:create nome_da_migration
```

**Exemplo:**

```bash
npm run migrate:create add_user_profiles
```

---

## 🔨 Criando Sua Primeira Migration

### Passo 1: Criar o arquivo

```bash
npm run migrate:create add_products_table
```

Isso criará: `migrations/002_add_products_table.js`

### Passo 2: Editar a migration

```javascript
/**
 * Migration: 002_add_products_table
 * Descrição: Adiciona tabela de produtos
 * Data: 2025-10-18
 */

const up = async (client) => {
  const query = `
    CREATE TABLE products (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      price DECIMAL(10,2) NOT NULL,
      user_id INTEGER REFERENCES users(id),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX idx_products_user_id ON products(user_id);
    CREATE INDEX idx_products_price ON products(price);
  `;

  await client.query(query);
  console.log("✅ Tabela products criada com sucesso");
};

const down = async (client) => {
  const query = `
    DROP TABLE IF EXISTS products CASCADE;
  `;

  await client.query(query);
  console.log("✅ Tabela products removida com sucesso");
};

module.exports = { up, down };
```

### Passo 3: Aplicar a migration

```bash
npm run migrate
```

### Passo 4: Verificar se funcionou

```bash
npm run migrate:status
```

---

## 🏗️ Estrutura de uma Migration

### Template Básico

```javascript
/**
 * Migration: XXX_nome_descritivo
 * Descrição: O que esta migration faz
 * Data: YYYY-MM-DD
 */

const up = async (client) => {
  // SQL para aplicar a mudança
  const query = `
    -- Seus comandos SQL aqui
  `;

  await client.query(query);
  console.log("✅ Migration aplicada com sucesso");
};

const down = async (client) => {
  // SQL para reverter a mudança
  const query = `
    -- Comandos para desfazer o que foi feito no 'up'
  `;

  await client.query(query);
  console.log("✅ Migration revertida com sucesso");
};

module.exports = { up, down };
```

### Elementos Importantes

1. **Função `up`**: Define como aplicar a mudança
2. **Função `down`**: Define como reverter a mudança
3. **Client**: Conexão com o banco (já em transação)
4. **Console.log**: Feedback visual durante execução

---

## 💡 Exemplos Práticos

### Adicionar Nova Coluna

```javascript
const up = async (client) => {
  await client.query(`
    ALTER TABLE users 
    ADD COLUMN phone VARCHAR(20);
    
    CREATE INDEX idx_users_phone ON users(phone);
  `);
};

const down = async (client) => {
  await client.query(`
    DROP INDEX IF EXISTS idx_users_phone;
    ALTER TABLE users DROP COLUMN IF EXISTS phone;
  `);
};
```

### Criar Tabela de Relacionamento

```javascript
const up = async (client) => {
  await client.query(`
    CREATE TABLE user_roles (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      role_name VARCHAR(50) NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE UNIQUE INDEX idx_user_roles_unique ON user_roles(user_id, role_name);
  `);
};

const down = async (client) => {
  await client.query("DROP TABLE IF EXISTS user_roles CASCADE");
};
```

### Atualizar Dados Existentes

```javascript
const up = async (client) => {
  await client.query(`
    -- Adicionar nova coluna
    ALTER TABLE users ADD COLUMN full_name VARCHAR(500);
    
    -- Migrar dados existentes
    UPDATE users SET full_name = name WHERE full_name IS NULL;
    
    -- Tornar obrigatória
    ALTER TABLE users ALTER COLUMN full_name SET NOT NULL;
  `);
};

const down = async (client) => {
  await client.query(`
    ALTER TABLE users DROP COLUMN IF EXISTS full_name;
  `);
};
```

---

## ✅ Boas Práticas

### 1. **Sempre inclua rollback**

```javascript
// ✅ BOM
const down = async (client) => {
  await client.query("DROP TABLE IF EXISTS nova_tabela");
};

// ❌ RUIM
const down = async (client) => {
  throw new Error("Rollback não implementado");
};
```

### 2. **Use transações (automático)**

O sistema já executa cada migration em uma transação. Se der erro, rollback automático.

### 3. **Teste em desenvolvimento primeiro**

```bash
# 1. Aplicar
npm run migrate

# 2. Testar a aplicação

# 3. Reverter se necessário
npm run migrate:rollback

# 4. Corrigir e aplicar novamente
npm run migrate
```

### 4. **Nomes descritivos**

```bash
# ✅ BOM
npm run migrate:create add_user_email_verification
npm run migrate:create update_products_add_category

# ❌ RUIM
npm run migrate:create fix_stuff
npm run migrate:create update
```

### 5. **Mudanças pequenas e focadas**

Uma migration = uma mudança lógica

### 6. **Backup antes de mudanças grandes**

Especialmente em produção.

---

## 🔧 Troubleshooting

### Erro: ECONNREFUSED

**Problema**: Não consegue conectar ao banco

```
error: Erro ao criar tabela de migrations: {"code":"ECONNREFUSED"}
```

**Solução**:

1. Verifique se o arquivo `.env` existe
2. Confirme as credenciais do banco
3. Teste a conectividade:

```bash
npm run migrate:status
```

### Migration falhou no meio

**Problema**: Migration parou com erro

```
error: Erro ao executar migration: syntax error at or near "TABL"
```

**Solução**:

1. Corrija o SQL na migration
2. A transação já foi revertida automaticamente
3. Execute novamente: `npm run migrate`

### Quer desfazer migration em produção

**Problema**: Migration aplicada em produção precisa ser revertida

**Solução SEGURA**:

1. **NÃO** use `migrate:rollback` em produção
2. Crie nova migration corretiva:

```bash
npm run migrate:create fix_previous_migration_issue
```

### Esqueceu de criar rollback

**Problema**: Migration sem método `down` não pode ser revertida

**Solução**:

```javascript
const down = async (client) => {
  console.log("⚠️ Rollback não disponível para esta migration");
  console.log("💡 Crie uma migration corretiva se necessário");
};
```

---

## 🚀 Fluxo de Trabalho Completo

### Desenvolvimento Local

```bash
# 1. Criar nova feature
npm run migrate:create add_feature_x

# 2. Editar migration
# (edite o arquivo gerado)

# 3. Aplicar
npm run migrate

# 4. Testar aplicação
npm run dev

# 5. Se precisar ajustar
npm run migrate:rollback
# (edite a migration)
npm run migrate

# 6. Commit quando estiver ok
git add .
git commit -m "feat: add feature X migration"
```

### Deploy para Produção

```bash
# 1. Pull do código
git pull origin main

# 2. Instalar dependências
npm install

# 3. Aplicar migrations (automático no start)
npm start
# ou manualmente:
npm run migrate

# 4. Verificar status
npm run migrate:status
```

---

## 📚 Referência Rápida

| Comando                       | Descrição                    |
| ----------------------------- | ---------------------------- |
| `npm run migrate:status`      | Ver status das migrations    |
| `npm run migrate`             | Aplicar migrations pendentes |
| `npm run migrate:rollback`    | Reverter última migration    |
| `npm run migrate:create nome` | Criar nova migration         |

---

## 🎯 Próximos Passos

1. **Pratique**: Crie algumas migrations de teste
2. **Explore**: Veja as migrations existentes em `migrations/`
3. **Experimente**: Teste rollback em desenvolvimento
4. **Documente**: Sempre descreva o que cada migration faz

**Lembre-se**: O sistema de migrations é sua rede de segurança. Use-o com confiança! 🚀
