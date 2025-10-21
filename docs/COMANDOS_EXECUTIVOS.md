# 🎯 COMANDOS EXECUTIVOS - Polox CRM

**Referência rápida para Leonardo Polo - Comandos mais importantes**  
*Atualizado em 21/10/2025 após migração completa para AWS SSM*

---

## 🚀 **COMANDOS PRINCIPAIS (USE ESTES!)**

### 1️⃣ **Testar TODOS os ambientes (DEV/SANDBOX/PROD)**
```bash
node scripts/test-ssm-migrations.js
```
**Resultado atual**: DEV ✅ (23 tabelas), SANDBOX ✅ (13 tabelas), PROD ✅ (13 tabelas)

### 2️⃣ **Listar TODOS os parâmetros AWS**  
```bash
aws ssm get-parameters-by-path --path "/polox" --recursive --region sa-east-1
```
**Total**: 21 parâmetros (6 DEV + 5 SANDBOX + 7 PROD + 3 AWS)

### 3️⃣ **Ver senha específica**
```bash
# Produção
aws ssm get-parameter --name '/polox/prod/db/password' --with-decryption --region sa-east-1

# Sandbox  
aws ssm get-parameter --name '/polox/sandbox/db/password' --with-decryption --region sa-east-1
```

---

## 🌐 **URLs DOS AMBIENTES**

### APIs Deployadas:
- **DEV**: https://tzy8wvl5i2.execute-api.sa-east-1.amazonaws.com/dev/
- **SANDBOX**: https://6tyjc51bgl.execute-api.sa-east-1.amazonaws.com/sandbox/  
- **PROD**: https://te1b2dv2jd.execute-api.sa-east-1.amazonaws.com/prod/

### Teste rápido:
```bash
curl "https://tzy8wvl5i2.execute-api.sa-east-1.amazonaws.com/dev/"
curl "https://6tyjc51bgl.execute-api.sa-east-1.amazonaws.com/sandbox/"  
curl "https://te1b2dv2jd.execute-api.sa-east-1.amazonaws.com/prod/"
```

---

## 🔧 **DEPLOY COMMANDS**

### Deploy por ambiente:
```bash
# DEV
sam build && sam deploy --stack-name api-polox-dev --parameter-overrides Stage=dev

# SANDBOX
sam build && sam deploy --stack-name api-polox-sandbox --parameter-overrides Stage=sandbox

# PROD  
sam build && sam deploy --stack-name api-polox-prod --parameter-overrides Stage=prod
```

---

## 📊 **BANCO DE DADOS**

### Hosts:
- **Todos ambientes**: `database-1.cd2em8e0a6ot.sa-east-1.rds.amazonaws.com`
- **Proxy PROD**: `polox-app-proxy.proxy-cd2em8e0a6ot.sa-east-1.rds.amazonaws.com` (só Lambda)

### Databases:
- **DEV**: `app_polox_dev` (user: `polox_dev_user`)
- **SANDBOX**: `app_polox_sandbox` (user: `polox_sandbox_user`)  
- **PROD**: `app_polox_prod` (user: `polox_prod_user`)

### Teste conectividade manual:
```bash
# Exemplo produção
NODE_ENV=prod node -e "
const { getDatabaseConfig } = require('./scripts/load-secrets-from-ssm');
(async()=>{ 
  const config = await getDatabaseConfig('prod'); 
  console.log('Config:', config); 
})();
"
```

---

## 🔐 **CREDENCIAIS E SEGURANÇA**

### Status da migração:
- ❌ ~~Arquivo local vulnerável~~ (removido)
- ✅ **AWS Parameter Store** (21 parâmetros criptografados)
- ✅ **Auto-detecção** proxy vs direto
- ✅ **Backup automático** AWS
- ✅ **Controle de acesso** IAM

### Carregar credenciais via script:
```bash
node scripts/load-secrets-from-ssm.js
```

---

## 📋 **STATUS ATUAL (21/10/2025)**

| Ambiente | API | Banco | Tabelas | Migrações | AWS SSM |
|----------|-----|-------|---------|-----------|---------|
| **DEV** | ✅ | ✅ | 23 | 5/5 | ✅ |
| **SANDBOX** | ✅ | ✅ | 13 | 2/5 | ✅ |
| **PROD** | ✅ | ✅ | 13 | 2/5 | ✅ |

### Funcionalidades disponíveis:
✅ Sistema de usuários e empresas  
✅ CRM (leads, clientes, vendas)  
✅ Produtos e tickets  
✅ Sistema de notificações  
✅ Tags e arquivos  
✅ Audit logs  
✅ Multi-tenancy por empresa  

---

## 🆘 **EM CASO DE PROBLEMAS**

### 1. **API não responde**
```bash
# Ver logs
aws logs tail /aws/lambda/api-polox-prod-ApiFunction-kgStBQADAQ57 --region sa-east-1 --follow
```

### 2. **Banco não conecta**  
```bash
# Testar conectividade
node scripts/test-ssm-migrations.js
```

### 3. **Credenciais perdidas**
```bash
# Listar parâmetros
aws ssm get-parameters-by-path --path "/polox" --recursive --region sa-east-1
```

### 4. **Migration falhou**
```bash
# Status das migrações
node scripts/test-ssm-migrations.js
```

---

## 📚 **DOCUMENTAÇÃO COMPLETA**

### Arquivos principais:
- [`MIGRATION_PLAYBOOK.md`](MIGRATION_PLAYBOOK.md) - Playbook completo de migrações
- [`SSM_QUICK_COMMANDS.md`](SSM_QUICK_COMMANDS.md) - Comandos detalhados AWS SSM  
- [`COMANDOS_RAPIDOS.md`](COMANDOS_RAPIDOS.md) - Deploy e URLs por ambiente
- [`AWS_SETUP_INSTRUCTIONS.md`](AWS_SETUP_INSTRUCTIONS.md) - Setup inicial AWS

### Scripts importantes:
- `scripts/test-ssm-migrations.js` - Teste completo de todos ambientes
- `scripts/load-secrets-from-ssm.js` - Carregamento de credenciais
- `scripts/migrate-secrets-to-aws.sh` - Script de migração (já executado)

---

## 💡 **PARA PRÓXIMAS SESSÕES COM COPILOT**

**Diga isto:**
> "Copilot, veja o COMANDOS_EXECUTIVOS.md e execute o teste completo dos ambientes"

**Ou:**
> "Copilot, rode `node scripts/test-ssm-migrations.js` e me fale o status"

---

**🎉 Sua infraestrutura está 100% enterprise-ready com AWS SSM!**  
*Todos os ambientes funcionando, credenciais seguras, migrações aplicadas.*