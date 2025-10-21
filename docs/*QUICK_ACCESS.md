# 🚀 Acesso Rápido - Links Essenciais

## 📋 **DOCUMENTAÇÃO CRÍTICA:**
- [`MIGRATION_PLAYBOOK.md`](MIGRATION_PLAYBOOK.md) - ⭐⭐⭐⭐⭐ Migrações
- [`COMANDOS_RAPIDOS.md`](COMANDOS_RAPIDOS.md) - ⭐⭐⭐⭐⭐ Deploy & URLs
- [`naocompartilhar/.naocompartilhar`](naocompartilhar/.naocompartilhar) - ⭐⭐⭐⭐⭐ Credenciais

## 🌐 **URLs DOS AMBIENTES:**
- **DEV**: https://tzy8wvl5i2.execute-api.sa-east-1.amazonaws.com/dev/
- **SANDBOX**: https://6tyjc51bgl.execute-api.sa-east-1.rds.amazonaws.com/sandbox/
- **PROD**: https://te1b2dv2jd.execute-api.sa-east-1.amazonaws.com/prod/

## 🔑 **COMANDOS MAIS USADOS:**

### Deploy:
```bash
sam build && sam deploy --stack-name api-polox-dev --parameter-overrides Stage=dev
```

### Migration Status:
```bash
npm run migrate:status
```

### Migration Production:
```bash
NODE_ENV=prod DB_HOST="database-1.cd2em8e0a6ot.sa-east-1.rds.amazonaws.com" DB_NAME="app_polox_prod" DB_USER="polox_prod_user" DB_PASSWORD="[VER_CREDENCIAIS]" node migrations/migration-runner.js status
```

## 🆘 **EM CASO DE EMERGÊNCIA:**
1. Problemas de deploy → `COMANDOS_RAPIDOS.md`
2. Problemas de DB → `MIGRATION_PLAYBOOK.md`  
3. Credenciais → `naocompartilhar/.naocompartilhar`
4. Problemas gerais → `ISSUES_SOLUCOES.md`