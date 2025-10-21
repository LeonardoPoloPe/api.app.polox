# 🔧 Comandos de Deploy - API Polox

**Referência rápida para deploy e troubleshooting**
_Última atualização: 21/10/2025_

---

## 🚀 **COMANDOS DE DEPLOY**

### **Serverless Framework (Método Atual)**

```bash
# Verificar credenciais AWS
aws sts get-caller-identity

# Deploy desenvolvimento
serverless deploy --stage dev --region sa-east-1

# Deploy sandbox
serverless deploy --stage sandbox --region sa-east-1

# Deploy produção
serverless deploy --stage prod --region sa-east-1

# Deploy com logs verbosos (para debug)
serverless deploy --stage dev --region sa-east-1 --verbose
```

### **NPM Scripts (Shortcuts)**

```bash
# Deploy desenvolvimento
npm run deploy:dev

# Deploy sandbox
npm run deploy:sandbox

# Deploy produção
npm run deploy:prod

# Logs em tempo real
npm run logs:dev
npm run logs:sandbox
npm run logs:prod
```

### **AWS SAM (Método Alternativo - Descontinuado)**

```bash
# NOTA: Migrado para Serverless Framework
# Build da aplicação
sam build

# Deploy desenvolvimento
sam deploy --stack-name api-polox-dev --region sa-east-1 --parameter-overrides Stage=dev
```

---

## 🧪 **TESTES E VALIDAÇÃO**

### **Local**

```bash
# Rodar aplicação local
npm run dev:local

# URLs locais
http://localhost:3000/health
http://localhost:3000/api/docs
http://localhost:3000/api/demo/public
```

### **Ambientes AWS Lambda (Atualizados em 21/10/2025)**

#### **🔧 Desenvolvimento**

```bash
# URL Base
https://z8ixwvp0qe.execute-api.sa-east-1.amazonaws.com/dev/

# Endpoints principais
curl https://z8ixwvp0qe.execute-api.sa-east-1.amazonaws.com/dev/health
curl https://z8ixwvp0qe.execute-api.sa-east-1.amazonaws.com/dev/api/docs
curl https://z8ixwvp0qe.execute-api.sa-east-1.amazonaws.com/dev/
```

#### **🧪 Sandbox**

```bash
# URL Base
https://el0qui6eqj.execute-api.sa-east-1.amazonaws.com/sandbox/

# Endpoints principais
curl https://el0qui6eqj.execute-api.sa-east-1.amazonaws.com/sandbox/health
curl https://el0qui6eqj.execute-api.sa-east-1.amazonaws.com/sandbox/api/docs
```

#### **🚀 Produção**

```bash
# URL Base
https://18yioqws85.execute-api.sa-east-1.amazonaws.com/prod/

# Endpoints principais
curl https://18yioqws85.execute-api.sa-east-1.amazonaws.com/prod/health
curl https://18yioqws85.execute-api.sa-east-1.amazonaws.com/prod/api/docs
```

### **Configurações atuais:**

- **Runtime**: Node.js 18.x
- **Região**: sa-east-1 (São Paulo)
- **Timeout**: 15 segundos
- **Memória**: 512 MB
- **Tamanho do package**: ~43 MB

---

## 📊 **LOGS E DEBUGGING**

### **Serverless Framework Logs**

```bash
# Logs em tempo real por ambiente
serverless logs -f api --stage dev --region sa-east-1 --tail
serverless logs -f api --stage sandbox --region sa-east-1 --tail
serverless logs -f api --stage prod --region sa-east-1 --tail

# Logs específicos (últimos X minutos)
serverless logs -f api --stage dev --region sa-east-1 --startTime 5m
serverless logs -f api --stage dev --region sa-east-1 --startTime 1h

# NPM Scripts para logs
npm run logs:dev
npm run logs:sandbox
npm run logs:prod
```

### **AWS CLI Logs (Alternativo)**

```bash
# Logs em tempo real
aws logs tail /aws/lambda/api-app-polox-dev-api --follow --region sa-east-1
aws logs tail /aws/lambda/api-app-polox-sandbox-api --follow --region sa-east-1
aws logs tail /aws/lambda/api-app-polox-prod-api --follow --region sa-east-1

# Listar log groups
aws logs describe-log-groups --log-group-name-prefix "/aws/lambda/api-app-polox" --region sa-east-1

# Logs específicos
aws logs get-log-events --log-group-name "/aws/lambda/FUNCTION_NAME" --log-stream-name "STREAM_NAME" --region sa-east-1
```

### **Status CloudFormation**

```bash
# Ver status do stack
aws cloudformation describe-stacks --stack-name api-polox-dev --region sa-east-1

# Ver eventos do stack
aws cloudformation describe-stack-events --stack-name api-polox-dev --region sa-east-1
```

---

## 🗄️ **BANCO DE DADOS**

### **Migrations**

```bash
# Status das migrations
npm run migrate:status

# Executar migrations
npm run migrate

# Reverter migration
npm run migrate:rollback

# Criar nova migration
npm run migrate:create nome_da_migration
```

### **Testar Conexão RDS**

```bash
# Via Node.js
node -e "const {healthCheck} = require('./src/models'); healthCheck().then(r => console.log('DB OK:', r)).catch(e => console.error('DB Error:', e))"

# Via psql (se instalado)
psql -h database-1.cd2em8e0a6ot.sa-east-1.rds.amazonaws.com -p 5432 -U polox_dev_user -d app_polox_dev
```

---

## 🔧 **TROUBLESHOOTING COMUM**

### **❌ Problema: Stack em DELETE_FAILED**

```bash
# 1. Verificar o que está impedindo a deleção
aws cloudformation describe-stack-events --stack-name api-app-polox-dev --region sa-east-1

# 2. Limpar bucket do Serverless manualmente
aws s3 rm s3://BUCKET_NAME --recursive --region sa-east-1

# 3. Forçar deleção do stack
aws cloudformation delete-stack --stack-name api-app-polox-dev --region sa-east-1
```

### **❌ Problema: "Cannot find module '@redis/client'"**

```bash
# Causa: Exclusão incorreta de dependências no serverless.yml
# Solução: Remover exclusão do @redis do package.patterns
# Verificar se não há "!node_modules/@redis/**" no serverless.yml
```

### **❌ Problema: "AWS_REGION is reserved"**

```bash
# Causa: Definição de AWS_REGION como variável de ambiente no Lambda
# Solução: Remover AWS_REGION do arquivo .env e serverless.yml environment
```

### **❌ Problema: "EMFILE: too many open files"**

```bash
# Causa: Muitos arquivos sendo empacotados
# Solução: Otimizar patterns de exclusão no serverless.yml
# Excluir: node_modules/@types/**, jest/**, supertest/**, nodemon/**
```

### **❌ Problema: "Cannot find module '../migrations/migration-runner'"**

```bash
# Causa: Migrations excluídas do package, mas código tenta executá-las
# Solução: Adicionar SKIP_MIGRATIONS=true nas variáveis de ambiente
```

### **❌ Problema: Timeout Lambda**

```bash
# Verificar timeout atual
aws lambda get-function-configuration --function-name api-app-polox-dev-api --region sa-east-1

# Aumentar timeout (se necessário)
# Editar serverless.yml: timeout: 30
```

### **❌ Problema: Permissões AWS**

```bash
# Verificar usuário atual
aws sts get-caller-identity

# Verificar credenciais
aws configure list

# Testar permissões básicas
aws cloudformation list-stacks --region sa-east-1
```

### **🔄 Limpar e Recriar Stack Completo**

```bash
# 1. Remover stack
serverless remove --stage dev --region sa-east-1

# 2. Limpar buckets restantes (se necessário)
aws s3 ls | grep serverless

# 3. Aguardar limpeza completa
aws cloudformation describe-stacks --stack-name api-app-polox-dev --region sa-east-1

# 4. Redeploy limpo
serverless deploy --stage dev --region sa-east-1
```

---

## 🔑 **VARIÁVEIS DE AMBIENTE**

### **DEV**

```env
NODE_ENV=dev
DB_HOST=database-1.cd2em8e0a6ot.sa-east-1.rds.amazonaws.com
DB_NAME=app_polox_dev
DB_USER=polox_dev_user
DB_PASSWORD=[CONFIGURADO VIA AWS SSM]
JWT_SECRET=[CONFIGURADO VIA AWS SSM]
```

### **SANDBOX**

```env
NODE_ENV=sandbox
DB_HOST=database-1.cd2em8e0a6ot.sa-east-1.rds.amazonaws.com
DB_NAME=app_polox_sandbox
DB_USER=polox_sandbox_user
DB_PASSWORD=[CONFIGURADO VIA AWS SSM]
JWT_SECRET=[CONFIGURADO VIA AWS SSM]
```

### **PRODUÇÃO**

```env
NODE_ENV=prod
DB_HOST=polox-app-proxy.proxy-cd2em8e0a6ot.sa-east-1.rds.amazonaws.com
DB_NAME=app_polox_prod
DB_USER=polox_prod_user
DB_PASSWORD=[CONFIGURADO VIA AWS SSM]
JWT_SECRET=[CONFIGURADO VIA AWS SSM]
```

---

## 📱 **URLs POR AMBIENTE**

### **Desenvolvimento (Local)**

- Base: `http://localhost:3000/dev`
- Health: `http://localhost:3000/dev/health`
- Docs: `http://localhost:3000/dev/api/docs`

### **Desenvolvimento (AWS)**

- Base: `https://9fcbczof2d.execute-api.sa-east-1.amazonaws.com/Prod/`
- Health: `https://9fcbczof2d.execute-api.sa-east-1.amazonaws.com/Prod/health`

### **Sandbox (Quando deployado)**

- Base: `https://APIID.execute-api.sa-east-1.amazonaws.com/Prod/`

### **Produção (Quando deployado)**

- Base: `https://APIID.execute-api.sa-east-1.amazonaws.com/Prod/`

---

## 🔐 **PARÂMETROS AWS SSM**

### **Consultar Parâmetros**

```bash
# Listar todos
aws ssm get-parameters-by-path --path "/polox" --recursive --region sa-east-1

# Ver valor específico (descriptografado)
aws ssm get-parameter --name "/polox/dev/db/password" --with-decryption --region sa-east-1

# Atualizar parâmetro
aws ssm put-parameter --name "/polox/dev/db/password" --value "NOVA_SENHA" --type "SecureString" --region sa-east-1 --overwrite
```

---

## 🛠️ **MANUTENÇÃO**

### **Atualizar Dependências**

```bash
npm update
npm audit fix
```

### **Limpar Build**

```bash
rm -rf .aws-sam/
rm -rf node_modules/
npm install
sam build
```

### **Backup Configurações**

```bash
# Backup SAM config
cp samconfig.toml samconfig.toml.backup

# Backup template
cp template.yaml template.yaml.backup
```
