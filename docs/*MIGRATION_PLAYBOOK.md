# 🚀 Playbook de Migrações - API Polox

**Documentação criada em 21/10/2025 após aplicação bem-sucedida de migrações em todos os ambientes**

## 📋 Resumo dos Ambientes

| Ambiente | DB Host | DB Name | Usuario | Status |
|----------|---------|---------|---------|---------|
| **Development** | database-1.cd2em8e0a6ot.sa-east-1.rds.amazonaws.com | app_polox_dev | polox_dev_user | ✅ Ativo |
| **Sandbox** | database-1.cd2em8e0a6ot.sa-east-1.rds.amazonaws.com | app_polox_sandbox | polox_sandbox_user | ✅ Ativo |
| **Production** | database-1.cd2em8e0a6ot.sa-east-1.rds.amazonaws.com | app_polox_prod | polox_prod_user | ✅ Ativo |

### ⚠️ Observação Importante sobre Proxy AWS
- **Produção via Lambda**: Usa `DB_PROXY_HOST=polox-app-proxy.proxy-cd2em8e0a6ot.sa-east-1.rds.amazonaws.com`
- **Acesso local/externo**: Deve usar `DB_HOST` (conexão direta) - proxy só funciona dentro da VPC da AWS

## 🛠️ Comandos de Migração

### 1. Verificar Status
```bash
# Development
npm run migrate:status

# Sandbox
NODE_ENV=sandbox DB_HOST="database-1.cd2em8e0a6ot.sa-east-1.rds.amazonaws.com" DB_NAME="app_polox_sandbox" DB_USER="polox_sandbox_user" DB_PASSWORD="[SENHA_SANDBOX]" node migrations/migration-runner.js status

# Production
NODE_ENV=prod DB_HOST="database-1.cd2em8e0a6ot.sa-east-1.rds.amazonaws.com" DB_NAME="app_polox_prod" DB_USER="polox_prod_user" DB_PASSWORD="[SENHA_PROD]" node migrations/migration-runner.js status
```

### 2. Executar Migrações
```bash
# Development
npm run migrate

# Sandbox
NODE_ENV=sandbox DB_HOST="database-1.cd2em8e0a6ot.sa-east-1.rds.amazonaws.com" DB_NAME="app_polox_sandbox" DB_USER="polox_sandbox_user" DB_PASSWORD="[SENHA_SANDBOX]" node migrations/migration-runner.js up

# Production (CUIDADO!)
NODE_ENV=prod DB_HOST="database-1.cd2em8e0a6ot.sa-east-1.rds.amazonaws.com" DB_NAME="app_polox_prod" DB_USER="polox_prod_user" DB_PASSWORD="[SENHA_PROD]" node migrations/migration-runner.js up
```

### 3. Teste de Conectividade
```bash
# Teste rápido de conexão (substitua [AMBIENTE] e [SENHA])
NODE_ENV=[AMBIENTE] DB_PASSWORD="[SENHA]" node -e "
const { Pool } = require('pg');
const pool = new Pool({
  host: 'database-1.cd2em8e0a6ot.sa-east-1.rds.amazonaws.com',
  port: 5432,
  database: 'app_polox_[AMBIENTE]',
  user: 'polox_[AMBIENTE]_user',
  password: '[SENHA]',
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 5000
});
(async()=>{
  try {
    const client = await pool.connect();
    const res = await client.query('SELECT NOW() as now, current_database() as db');
    console.log('✅ SUCCESS:', res.rows[0]);
    client.release();
  } catch(e) {
    console.error('❌ ERROR:', e.message);
  } finally {
    await pool.end();
  }
})();
"
```

## 🔐 Localização das Credenciais

As senhas estão armazenadas em:
- **Arquivo**: `docs/naocompartilhar/.naocompartilhar`
- **AWS Systems Manager**: Parâmetros `/polox/{env}/db/password`

### Recuperar senhas via AWS CLI:
```bash
aws ssm get-parameter --name "/polox/dev/db/password" --with-decryption --region sa-east-1
aws ssm get-parameter --name "/polox/sandbox/db/password" --with-decryption --region sa-east-1
aws ssm get-parameter --name "/polox/prod/db/password" --with-decryption --region sa-east-1
```

## 📊 Validação de Schema

### Listar tabelas do schema polox:
```bash
NODE_ENV=[ENV] DB_PASSWORD="[SENHA]" node -e "
const { Pool } = require('pg');
const pool = new Pool({
  host: 'database-1.cd2em8e0a6ot.sa-east-1.rds.amazonaws.com',
  database: 'app_polox_[ENV]',
  user: 'polox_[ENV]_user',
  password: '[SENHA]',
  ssl: { rejectUnauthorized: false }
});
(async()=>{
  const result = await pool.query(\`
    SELECT table_name, table_type 
    FROM information_schema.tables 
    WHERE table_schema = 'polox' 
    ORDER BY table_name
  \`);
  console.log('📊 TABELAS NO SCHEMA POLOX:');
  result.rows.forEach((row, i) => console.log(\`\${i+1}. \${row.table_name}\`));
  console.log(\`Total: \${result.rows.length} tabelas\`);
  await pool.end();
})();
"
```

## ⚠️ Problemas Comuns e Soluções

### 1. "Migration travou/não roda"
**Causa**: Geralmente é problema de conectividade ou proxy
**Solução**: 
- Verificar se está usando `DB_HOST` em vez de `DB_PROXY_HOST` para acesso local
- Testar conectividade com o script de teste acima

### 2. "password authentication failed"
**Causa**: Credenciais incorretas ou usuário errado
**Solução**:
- Verificar credenciais no arquivo `.naocompartilhar`
- Confirmar que está usando o usuário correto para o ambiente

### 3. "relation already exists" ou "trigger already exists"
**Causa**: Schema parcialmente aplicado de tentativas anteriores
**Solução**:
- Usar migrações com `IF NOT EXISTS`
- Executar apenas a migração `005_add_essential_tables.js` (mais segura)

### 4. "no pg_hba.conf entry for host"
**Causa**: Tentativa de usar proxy fora da VPC AWS
**Solução**: Usar `DB_HOST` em vez de `DB_PROXY_HOST`

## 📝 Checklist Pre-Migration

### Antes de executar migrações em produção:

- [ ] Verificar conectividade com ambiente de destino
- [ ] Confirmar credenciais corretas
- [ ] Testar migração em sandbox primeiro
- [ ] Verificar se não há objetos conflitantes
- [ ] Backup do ambiente (se necessário)
- [ ] Janela de manutenção aprovada (se necessário)

### Pós-migração:

- [ ] Verificar contagem de tabelas criadas
- [ ] Testar funcionalidades básicas
- [ ] Monitorar logs por pelo menos 30 minutos
- [ ] Confirmar que aplicação funciona normalmente

## 🔧 Arquivos Importantes

- **Migration Runner**: `migrations/migration-runner.js`
- **Configuração DB**: `src/config/database.js`
- **Package scripts**: `package.json` (npm run migrate, migrate:status)
- **Credenciais**: `docs/naocompartilhar/.naocompartilhar`
- **Serverless config**: `serverless.yml` (configurações por stage)

## 📈 Status Atual (21/10/2025) - ✅ TODOS OS AMBIENTES FUNCIONANDO

### 🎉 **MIGRAÇÃO COMPLETA PARA AWS SSM**
Todas as credenciais foram migradas para o AWS Systems Manager Parameter Store com segurança enterprise.

### Migrações Aplicadas:
- ✅ **Development**: Completo (23 tabelas, 5 migrações)
- ✅ **Sandbox**: Essenciais (13 tabelas, 2 migrações)
- ✅ **Production**: Essenciais (13 tabelas, 2 migrações)

### Tabelas por Ambiente:

#### **DEV (23 tabelas - Schema Completo):**
1. achievements, 2. audit_logs, 3. clients, 4. companies, 5. events
6. file_uploads, 7. financial_accounts, 8. financial_transactions, 9. leads
10. notification_templates, 11. notifications, 12. product_categories, 13. products
14. sale_items, 15. sales, 16. suppliers, 17. tags, 18. tickets
19. token_blacklist, 20. user_achievements, 21. user_gamification_profiles
22. user_sessions, 23. users

#### **SANDBOX & PROD (13 tabelas - Schema Essencial):**
1. audit_logs, 2. clients, 3. companies, 4. file_uploads, 5. leads
6. notifications, 7. products, 8. sales, 9. tags, 10. tickets
11. token_blacklist, 12. user_sessions, 13. users

### 🔐 **Credenciais AWS SSM (21 parâmetros):**
- **DEV**: 6 parâmetros (host, name, user, password, jwt, encryption)
- **SANDBOX**: 5 parâmetros (host, name, user, password, jwt)  
- **PROD**: 7 parâmetros (host, proxy-host, name, user, password, jwt, encryption)
- **AWS**: 3 parâmetros globais (region, s3-buckets)

### 📊 **Comando de Teste Completo:**
```bash
# Testa TODOS os ambientes com AWS SSM
node scripts/test-ssm-migrations.js

# Resultado atual:
# DEV      ✅ OK (23 tabelas, 5 migrations)
# SANDBOX  ✅ OK (13 tabelas, 2 migrations)  
# PROD     ✅ OK (13 tabelas, 2 migrations)
```

## 🎯 Para Futuras Sessões

Quando precisar de ajuda com migrações:

1. **Mencione este playbook**: "Veja o MIGRATION_PLAYBOOK.md"
2. **Informe o ambiente**: dev, sandbox ou prod
3. **Descreva o objetivo**: nova funcionalidade, correção, rollback, etc.
4. **Inclua logs de erro**: se houver falhas anteriores

**Este documento será atualizado conforme novas migrações forem aplicadas.**

---

*Última atualização: 21 de outubro de 2025*
*Responsável: GitHub Copilot + Leonardo Polo*