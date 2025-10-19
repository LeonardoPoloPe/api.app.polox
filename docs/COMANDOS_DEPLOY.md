# 🔧 Comandos de Deploy - API Polox
**Referência rápida para deploy e troubleshooting**

---

## 🚀 **COMANDOS DE DEPLOY**

### **AWS SAM (Método Atual)**
```bash
# Build da aplicação
sam build

# Deploy desenvolvimento
sam deploy --stack-name api-polox-dev --region sa-east-1 --parameter-overrides Stage=dev

# Deploy sandbox  
sam deploy --stack-name api-polox-sandbox --region sa-east-1 --parameter-overrides Stage=sandbox

# Deploy produção
sam deploy --stack-name api-polox-prod --region sa-east-1 --parameter-overrides Stage=prod

# Deploy guiado (primeira vez)
sam deploy --guided --stack-name api-polox-dev --region sa-east-1
```

### **Serverless Framework (Alternativo)**
```bash
# Deploy desenvolvimento
npm run deploy:dev

# Deploy sandbox
npm run deploy:sandbox  

# Deploy produção
npm run deploy:prod
```

---

## 🧪 **TESTES E VALIDAÇÃO**

### **Local**
```bash
# Rodar aplicação local
npm run dev

# URLs locais
http://localhost:3000/dev/health
http://localhost:3000/dev/api/demo/public
http://localhost:3000/dev/api/docs
```

### **AWS Lambda**
```bash
# URL atual DEV
https://9fcbczof2d.execute-api.sa-east-1.amazonaws.com/Prod/

# Testar endpoints
curl https://9fcbczof2d.execute-api.sa-east-1.amazonaws.com/Prod/health
curl https://9fcbczof2d.execute-api.sa-east-1.amazonaws.com/Prod/api/demo/public
```

---

## 📊 **LOGS E DEBUGGING**

### **Logs Lambda**
```bash
# Logs em tempo real
aws logs tail /aws/lambda/api-polox-dev-ApiFunction-qVinOFeMoq2e --follow --region sa-east-1

# Listar log groups
aws logs describe-log-groups --log-group-name-prefix "/aws/lambda/api-polox" --region sa-east-1

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

## 🔧 **TROUBLESHOOTING**

### **Timeout Lambda**
```bash
# Verificar timeout atual
aws lambda get-function-configuration --function-name FUNCTION_NAME --region sa-east-1

# Atualizar timeout
aws lambda update-function-configuration --function-name FUNCTION_NAME --timeout 300 --region sa-east-1
```

### **Problemas de Permissão**
```bash
# Verificar usuário atual
aws sts get-caller-identity

# Testar permissões SSM
aws ssm get-parameters-by-path --path "/polox" --recursive --region sa-east-1
```

### **Limpar e Recriar Stack**
```bash
# Remover stack
aws cloudformation delete-stack --stack-name api-polox-dev --region sa-east-1

# Aguardar remoção
aws cloudformation wait stack-delete-complete --stack-name api-polox-dev --region sa-east-1

# Redeploy
sam deploy --stack-name api-polox-dev --region sa-east-1
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