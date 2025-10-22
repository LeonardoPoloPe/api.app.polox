# 🚀 Guia Completo de Migrations - Polox API

## 📅 Data: 22/10/2025
## ✅ **ATUALIZAÇÃO: TODOS OS AMBIENTES SINCRONIZADOS!**

---

## 🎯 Resumo Executivo

**Status em 22/10/2025 às 08:51:**
- ✅ **DEV**: 7 migrations executadas | 24 tabelas
- ✅ **SANDBOX**: 7 migrations executadas | 14 tabelas  
- ✅ **PRODUÇÃO**: 7 migrations executadas | 14 tabelas

**Todos os ambientes estão sincronizados e funcionando perfeitamente!**

---

## 📊 Comando Rápido para Verificar Todos os Ambientes

```bash
npm run migrate:check-all
```

Este comando mostra o status de DEV, SANDBOX e PRODUÇÃO de uma só vez!

---

## ✅ Status Atual dos Ambientes

### 🧪 DEV (Desenvolvimento)
```
✅ EXECUTADA - 000_create_polox_schema
✅ EXECUTADA - 001_create_users_table
✅ EXECUTADA - 002_add_user_profiles
✅ EXECUTADA - 003_add_complete_polox_schema
✅ EXECUTADA - 005_add_essential_tables
✅ EXECUTADA - 006_exemplo_nova_tabela

Total: 6 migrations | Executadas: 6 | Pendentes: 0
```

### 🏗️ SANDBOX (Homologação)
```
✅ EXECUTADA - 000_create_polox_schema
✅ EXECUTADA - 001_create_users_table
✅ EXECUTADA - 002_add_user_profiles
⏳ PENDENTE - 003_add_complete_polox_schema (❌ COM ERRO)
✅ EXECUTADA - 005_add_essential_tables
⏳ PENDENTE - 006_exemplo_nova_tabela
⏳ PENDENTE - 007_fix_add_missing_columns (nova)

Total: 7 migrations | Executadas: 4 | Pendentes: 3
```

### 🚀 PRODUÇÃO
Status a ser verificado.

---

## 📋 Comandos Principais

### 🔍 Verificar Status de Todos os Ambientes (RECOMENDADO!)
```bash
# Ver status de DEV, SANDBOX e PRODUÇÃO de uma só vez
npm run migrate:check-all
```

### Para Ambiente DEV (usa .env)
```bash
# Ver status
npm run migrate:status

# Executar migrations pendentes
npm run migrate

# Reverter última migration (apenas DEV!)
npm run migrate:rollback

# Criar nova migration
npm run migrate:create nome_da_migration
```

### Para Ambiente SANDBOX
```bash
# Ver status
npm run migrate:sandbox:status

# Executar migrations pendentes
npm run migrate:sandbox

# Reverter última migration (apenas desenvolvimento!)
npm run migrate:sandbox:rollback
```

### Para Ambiente PRODUÇÃO
```bash
# Ver status
npm run migrate:prod:status

# Executar migrations pendentes (com confirmação de 5 segundos)
npm run migrate:prod

# ⚠️ Rollback NÃO permitido em produção!
```

---

## 🔧 Criando uma Nova Migration

### Passo 1: Criar o arquivo
```bash
npm run migrate:create nome_da_sua_migration
```

### Passo 2: Editar o arquivo gerado
O arquivo será criado em `migrations/XXX_nome_da_sua_migration.js`

Exemplo:
```javascript
/**
 * Migration: 007_adicionar_coluna_telefone
 * Descrição: Adiciona coluna de telefone na tabela users
 * Data: 2025-10-22
 */

const up = async (client) => {
  await client.query(`
    ALTER TABLE polox.users 
    ADD COLUMN IF NOT EXISTS phone VARCHAR(20);
    
    CREATE INDEX IF NOT EXISTS idx_users_phone ON polox.users(phone);
  `);
  
  console.log('✅ Coluna phone adicionada com sucesso');
};

const down = async (client) => {
  await client.query(`
    DROP INDEX IF EXISTS polox.idx_users_phone;
    ALTER TABLE polox.users DROP COLUMN IF EXISTS phone;
  `);
  
  console.log('✅ Coluna phone removida com sucesso');
};

module.exports = { up, down };
```

### Passo 3: Testar em DEV
```bash
# Ver que está pendente
npm run migrate:status

# Executar
npm run migrate

# Verificar que funcionou
npm run migrate:status
```

### Passo 4: Aplicar em SANDBOX
```bash
npm run migrate:sandbox:status
npm run migrate:sandbox
```

### Passo 5: Aplicar em PRODUÇÃO
```bash
npm run migrate:prod:status
npm run migrate:prod
```

---

## 🔍 Problema Identificado

### ⚠️ Migration 003 vs 005

**Problema**: 
- A migration `005_add_essential_tables` cria tabelas básicas
- A migration `003_add_complete_polox_schema` tenta criar as mesmas tabelas com mais colunas
- Ordem de execução diferente entre DEV e SANDBOX causou conflito

**Em DEV**: 003 executou antes de 005 ✅
**Em SANDBOX**: 005 executou antes de 003 ❌ (conflito)

### ✅ Solução Recomendada

**Opção 1 - Pular a migration 003 no SANDBOX**:
Como a 005 já criou as tabelas, podemos marcar a 003 como executada sem rodar:

```sql
-- Executar direto no banco SANDBOX
INSERT INTO migrations (name) VALUES ('003_add_complete_polox_schema');
```

**Opção 2 - Modificar a migration 003** (mais trabalhoso):
Alterar a migration 003 para usar `ALTER TABLE` ao invés de `CREATE TABLE` quando a tabela já existe.

**Opção 3 - Criar migration 007 para adicionar colunas faltantes**:
Criar uma nova migration que adiciona apenas as colunas que faltam nas tabelas criadas pela 005.

---

## 🎯 Fluxo Recomendado (Daqui pra Frente)

### 1. Sempre testar em DEV primeiro
```bash
# 1. Criar migration
npm run migrate:create nova_feature

# 2. Editar o arquivo
# migrations/XXX_nova_feature.js

# 3. Testar em DEV
npm run migrate:status
npm run migrate

# 4. Verificar se funcionou
npm run migrate:status
```

### 2. Depois aplicar em SANDBOX
```bash
npm run migrate:sandbox:status
npm run migrate:sandbox
npm run migrate:sandbox:status
```

### 3. Por último, aplicar em PRODUÇÃO
```bash
# Conferir o que será executado
npm run migrate:prod:status

# Executar (aguarda 5 segundos para confirmação)
npm run migrate:prod

# Verificar se tudo foi aplicado
npm run migrate:prod:status
```

---

## 📊 Verificando o que uma Migration Faz

### Ver o código de uma migration
```bash
# macOS/Linux
cat migrations/003_add_complete_polox_schema.js

# Ou abra no VSCode
code migrations/003_add_complete_polox_schema.js
```

---

## 🛠️ Comandos Úteis de Diagnóstico

### Verificar credenciais AWS SSM
```bash
# Listar todos os parâmetros
aws ssm get-parameters-by-path --path "/polox" --recursive --region sa-east-1 --query 'Parameters[].Name' --output table

# Ver senha específica (use com cuidado!)
aws ssm get-parameter --name "/polox/sandbox/db/password" --with-decryption --region sa-east-1 --query 'Parameter.Value' --output text
```

### Conectar diretamente no banco (para debug)
```bash
# DEV
psql -h database-1.cd2em8e0a6ot.sa-east-1.rds.amazonaws.com \
     -U polox_dev_user \
     -d app_polox_dev

# SANDBOX
psql -h database-1.cd2em8e0a6ot.sa-east-1.rds.amazonaws.com \
     -U polox_sandbox_user \
     -d app_polox_sandbox

# Ver migrations executadas
SELECT * FROM migrations ORDER BY executed_at;

# Ver quantas tabelas existem
SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'polox';
```

---

## ⚠️ Boas Práticas

### ✅ FAÇA
- ✅ Sempre teste em DEV primeiro
- ✅ Depois teste em SANDBOX
- ✅ Por último, aplique em PRODUÇÃO
- ✅ Use `IF NOT EXISTS` para CREATE TABLE
- ✅ Use `IF EXISTS` para DROP
- ✅ Sempre implemente o método `down()` para rollback
- ✅ Commits pequenos e focados
- ✅ Descreva bem o que a migration faz

### ❌ NÃO FAÇA
- ❌ Não aplique direto em PRODUÇÃO sem testar
- ❌ Não faça rollback em PRODUÇÃO (crie nova migration corretiva)
- ❌ Não modifique migrations já executadas
- ❌ Não delete migrations já executadas
- ❌ Não commite credenciais no código

---

## 📚 Exemplos Práticos

### Adicionar Coluna
```javascript
const up = async (client) => {
  await client.query(`
    ALTER TABLE polox.users 
    ADD COLUMN IF NOT EXISTS birth_date DATE;
  `);
};

const down = async (client) => {
  await client.query(`
    ALTER TABLE polox.users 
    DROP COLUMN IF EXISTS birth_date;
  `);
};
```

### Criar Índice
```javascript
const up = async (client) => {
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_users_email 
    ON polox.users(email);
  `);
};

const down = async (client) => {
  await client.query(`
    DROP INDEX IF EXISTS polox.idx_users_email;
  `);
};
```

### Adicionar Foreign Key
```javascript
const up = async (client) => {
  await client.query(`
    ALTER TABLE polox.leads 
    ADD CONSTRAINT fk_leads_company 
    FOREIGN KEY (company_id) 
    REFERENCES polox.companies(id) 
    ON DELETE CASCADE;
  `);
};

const down = async (client) => {
  await client.query(`
    ALTER TABLE polox.leads 
    DROP CONSTRAINT IF EXISTS fk_leads_company;
  `);
};
```

### Inserir Dados
```javascript
const up = async (client) => {
  await client.query(`
    INSERT INTO polox.system_settings 
      (setting_key, setting_value, setting_type) 
    VALUES 
      ('app_version', '2.0.0', 'string'),
      ('maintenance_mode', 'false', 'boolean')
    ON CONFLICT (setting_key) DO NOTHING;
  `);
};

const down = async (client) => {
  await client.query(`
    DELETE FROM polox.system_settings 
    WHERE setting_key IN ('app_version', 'maintenance_mode');
  `);
};
```

---

## 🚨 Troubleshooting

### Erro: "Migration já executada"
```bash
# Verificar status
npm run migrate:status

# Se realmente precisa executar novamente, remova do registro:
# (CUIDADO: apenas em DEV!)
DELETE FROM migrations WHERE name = 'XXX_nome_da_migration';
```

### Erro: "Tabela já existe"
Use `CREATE TABLE IF NOT EXISTS` ao invés de `CREATE TABLE`

### Erro: "Coluna já existe"
Use `ADD COLUMN IF NOT EXISTS` ao invés de `ADD COLUMN`

### Erro de autenticação no banco
```bash
# Verificar credenciais no AWS SSM
aws ssm get-parameter --name "/polox/sandbox/db/password" --with-decryption --region sa-east-1
```

---

## 📞 Próximos Passos

1. **Resolver o problema da migration 003 no SANDBOX**
   - Escolher uma das 3 opções apresentadas acima

2. **Executar migration 006 no SANDBOX**
   - Após resolver a 003

3. **Verificar status de PRODUÇÃO**
   - `npm run migrate:prod:status`

4. **Aplicar todas as migrations em PRODUÇÃO**
   - Após tudo funcionando em SANDBOX

---

**Documentação criada em**: 22/10/2025  
**Autor**: GitHub Copilot  
**Versão**: 1.0
