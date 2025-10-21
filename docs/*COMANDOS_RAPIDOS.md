# ⚡ Comandos Rápidos - API Polox
**Para deploy e gerenciamento sem confusão**

---

## 🚀 **DEPLOY POR AMBIENTE**

### **Sempre execute ANTES de qualquer deploy:**
```bash
sam build
```

### **DEV Environment**
```bash
# Deploy DEV
sam deploy --stack-name api-polox-dev --parameter-overrides Stage=dev --region sa-east-1

# URL DEV
echo "https://tzy8wvl5i2.execute-api.sa-east-1.amazonaws.com/dev/"

# Testar DEV
curl "https://tzy8wvl5i2.execute-api.sa-east-1.amazonaws.com/dev/"
```

### **SANDBOX Environment** 
```bash
# Deploy SANDBOX
sam deploy --stack-name api-polox-sandbox --parameter-overrides Stage=sandbox --region sa-east-1

# URL SANDBOX
echo "https://6tyjc51bgl.execute-api.sa-east-1.amazonaws.com/sandbox/"

# Testar SANDBOX
curl "https://6tyjc51bgl.execute-api.sa-east-1.amazonaws.com/sandbox/"
```

### **PROD Environment (RDS Proxy)**
```bash
# Deploy PROD 
sam deploy --stack-name api-polox-prod --parameter-overrides Stage=prod --region sa-east-1

# URL PROD
echo "https://te1b2dv2jd.execute-api.sa-east-1.amazonaws.com/prod/"

# Testar PROD
curl "https://te1b2dv2jd.execute-api.sa-east-1.amazonaws.com/prod/"
```

---

## 📊 **LOGS E MONITORAMENTO**

### **Ver Logs por Ambiente:**

#### **DEV:**
```bash
aws logs tail /aws/lambda/api-polox-dev-ApiFunction-qVinOFeMoq2e --region sa-east-1 --follow
```

#### **SANDBOX:**
```bash
# Descobrir ID da função primeiro
aws logs describe-log-groups --region sa-east-1 --log-group-name-prefix "/aws/lambda/api-polox-sandbox"

# Depois usar o ID encontrado
aws logs tail /aws/lambda/api-polox-sandbox-ApiFunction-[ID] --region sa-east-1 --follow
```

#### **PROD:**
```bash
aws logs tail /aws/lambda/api-polox-prod-ApiFunction-kgStBQADAQ57 --region sa-east-1 --follow
```

---

## 🔧 **COMANDOS DE MANUTENÇÃO**

### **Atualizar APENAS um ambiente específico:**

#### **Quando você disser "vamos atualizar o lambda de dev":**
```bash
sam build
sam deploy --stack-name api-polox-dev --parameter-overrides Stage=dev --region sa-east-1
```

#### **Quando você disser "vamos atualizar o lambda de producao":**
```bash
sam build
sam deploy --stack-name api-polox-prod --parameter-overrides Stage=prod --region sa-east-1
```

#### **Quando você disser "vamos atualizar o lambda de sandbox":**
```bash
sam build
sam deploy --stack-name api-polox-sandbox --parameter-overrides Stage=sandbox --region sa-east-1
```

---

## 🗄️ **BANCO DE DADOS**

### **Hosts por Ambiente:**
- **DEV**: `database-1.cd2em8e0a6ot.sa-east-1.rds.amazonaws.com` (direto)
- **SANDBOX**: `database-1.cd2em8e0a6ot.sa-east-1.rds.amazonaws.com` (direto)
- **PROD**: `polox-app-proxy.proxy-cd2em8e0a6ot.sa-east-1.rds.amazonaws.com` (proxy)

### **Executar Migrations Manualmente:**
```bash
# Local (conecta ao ambiente baseado no .env)
npm run migrate

# Específico por ambiente
NODE_ENV=dev npm run migrate
NODE_ENV=sandbox npm run migrate  
NODE_ENV=prod npm run migrate
```

---

## 🧪 **TESTES RÁPIDOS**

### **Health Check de Todos Ambientes:**
```bash
echo "=== TESTANDO TODOS AMBIENTES ==="
echo "DEV:" && curl -s "https://tzy8wvl5i2.execute-api.sa-east-1.amazonaws.com/dev/" | head -c 100
echo ""
echo "SANDBOX:" && curl -s "https://6tyjc51bgl.execute-api.sa-east-1.amazonaws.com/sandbox/" | head -c 100  
echo ""
echo "PROD:" && curl -s "https://te1b2dv2jd.execute-api.sa-east-1.amazonaws.com/prod/" | head -c 100
echo ""
```

### **Testar Endpoint Específico:**
```bash
# DEV
curl "https://tzy8wvl5i2.execute-api.sa-east-1.amazonaws.com/dev/health"

# SANDBOX  
curl "https://6tyjc51bgl.execute-api.sa-east-1.amazonaws.com/sandbox/health"

# PROD
curl "https://te1b2dv2jd.execute-api.sa-east-1.amazonaws.com/prod/health"
```

---

## 🔍 **DEBUGGING**

### **Verificar Status dos Stacks:**
```bash
# Listar todos os stacks
aws cloudformation list-stacks --region sa-east-1 --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE

# Status específico por ambiente
aws cloudformation describe-stacks --stack-name api-polox-dev --region sa-east-1
aws cloudformation describe-stacks --stack-name api-polox-sandbox --region sa-east-1  
aws cloudformation describe-stacks --stack-name api-polox-prod --region sa-east-1
```

### **Verificar Configuração Lambda:**
```bash
# DEV
aws lambda get-function-configuration --function-name api-polox-dev-ApiFunction-qVinOFeMoq2e --region sa-east-1

# PROD
aws lambda get-function-configuration --function-name api-polox-prod-ApiFunction-kgStBQADAQ57 --region sa-east-1
```

---

## 🗑️ **CLEANUP (SE NECESSÁRIO)**

### **Deletar Stack Específico:**
```bash
# CUIDADO! Só usar se precisar recriar
aws cloudformation delete-stack --stack-name api-polox-dev --region sa-east-1
aws cloudformation delete-stack --stack-name api-polox-sandbox --region sa-east-1
aws cloudformation delete-stack --stack-name api-polox-prod --region sa-east-1
```

---

## 📋 **REFERÊNCIA RÁPIDA**

### **Stacks AWS:**
| Ambiente | Stack Name | URL Base |
|----------|------------|----------|
| DEV | `api-polox-dev` | `https://tzy8wvl5i2.execute-api.sa-east-1.amazonaws.com/dev/` |
| SANDBOX | `api-polox-sandbox` | `https://6tyjc51bgl.execute-api.sa-east-1.amazonaws.com/sandbox/` |
| PROD | `api-polox-prod` | `https://te1b2dv2jd.execute-api.sa-east-1.amazonaws.com/prod/` |

### **Funções Lambda:**
| Ambiente | Function Name |
|----------|---------------|
| DEV | `api-polox-dev-ApiFunction-qVinOFeMoq2e` |
| SANDBOX | `api-polox-sandbox-ApiFunction-[ID]` |
| PROD | `api-polox-prod-ApiFunction-kgStBQADAQ57` |

### **Log Groups:**
| Ambiente | Log Group |
|----------|-----------|
| DEV | `/aws/lambda/api-polox-dev-ApiFunction-qVinOFeMoq2e` |
| SANDBOX | `/aws/lambda/api-polox-sandbox-ApiFunction-[ID]` |
| PROD | `/aws/lambda/api-polox-prod-ApiFunction-kgStBQADAQ57` |

---

## 💡 **DICAS IMPORTANTES**

### **✅ SEMPRE FUNCIONA:**
1. **sam build** antes de qualquer deploy
2. Use o **stack-name** correto para cada ambiente
3. **Stage** deve coincidir com o environment (dev, sandbox, prod)
4. **region** sempre `sa-east-1`

### **🚨 CUIDADOS:**
- **PROD** usa RDS Proxy (performance diferente)
- **DEV/SANDBOX** usam conexão direta
- **Migrations** são puladas na Lambda (`SKIP_MIGRATIONS=true`)
- **URLs** são diferentes para cada ambiente

### **🎯 QUANDO VOCÊ PEDIR:**
- **"Atualizar DEV"** → Deploy apenas o stack `api-polox-dev`
- **"Atualizar PROD"** → Deploy apenas o stack `api-polox-prod`  
- **"Ver logs de produção"** → Usar o log group do PROD
- **"Testar SANDBOX"** → Usar a URL do SANDBOX

**💡 Estes comandos eliminam tentativa e erro - cada ambiente tem sua configuração específica!**