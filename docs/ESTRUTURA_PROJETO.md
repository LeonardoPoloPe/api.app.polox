# 📋 ESTRUTURA DO PROJETO API POLOX

**Última atualização**: 19 de outubro de 2025

## 🏗️ **ARQUITETURA GERAL**

### **Tecnologias**
- **Runtime**: Node.js 18.x
- **Framework**: Express.js
- **Database**: PostgreSQL com RDS
- **Deploy**: AWS Lambda via SAM CLI
- **SSL**: AWS Root Certificates

### **Ambientes Configurados**

| Ambiente | Stack AWS | URL | Stage | Conexão BD | Status |
|----------|-----------|-----|--------|------------|---------|
| **DEV** | `api-polox-dev` | `https://tzy8wvl5i2.execute-api.sa-east-1.amazonaws.com/dev/` | `/dev/` | Direta RDS | ✅ Funcionando |
| **SANDBOX** | `api-polox-sandbox` | `https://6tyjc51bgl.execute-api.sa-east-1.amazonaws.com/sandbox/` | `/sandbox/` | Direta RDS | ✅ Funcionando |
| **PROD** | `api-polox-prod` | `https://te1b2dv2jd.execute-api.sa-east-1.amazonaws.com/prod/` | `/prod/` | **RDS Proxy** | ✅ Funcionando |

## 🗂️ **ESTRUTURA DE ARQUIVOS**

```
api.app.polox/
├── src/
│   ├── handler.js              # Entry point Lambda
│   ├── routes.js                # Definição das rotas
│   ├── config/
│   │   ├── swagger.js           # Configuração Swagger
│   │   └── ssl-config.js        # Configuração SSL/TLS
│   ├── controllers/             # Controllers da API
│   ├── models/
│   │   ├── database.js          # Conexão BD com RDS Proxy logic
│   │   └── User.js              # Model User
│   ├── services/                # Camada de serviços
│   └── utils/                   # Utilitários
├── migrations/                  # Migrations PostgreSQL
├── template.yaml               # SAM Template (AWS CloudFormation)
├── package.json                # Dependencies
└── docs/                       # Documentação
```

## 🔧 **CONFIGURAÇÃO LAMBDA**

### **Especificações Atuais:**
- **Memory**: 1024 MB
- **Timeout**: 60 segundos
- **Runtime**: nodejs18.x
- **Region**: sa-east-1

### **Variáveis de Ambiente:**
```yaml
NODE_ENV: dev|sandbox|prod
DB_HOST: database-1.cd2em8e0a6ot.sa-east-1.rds.amazonaws.com
DB_PROXY_HOST: polox-app-proxy.proxy-cd2em8e0a6ot.sa-east-1.rds.amazonaws.com
DB_PORT: 5432
DB_NAME: app_polox_{stage}
DB_USER: polox_{stage}_user
DB_PASSWORD: SenhaSeguraDev123!
SKIP_MIGRATIONS: true
```

## 🗄️ **BANCO DE DADOS**

### **RDS Configuration:**
- **Engine**: PostgreSQL
- **Host**: `database-1.cd2em8e0a6ot.sa-east-1.rds.amazonaws.com`
- **Proxy Host**: `polox-app-proxy.proxy-cd2em8e0a6ot.sa-east-1.rds.amazonaws.com`

### **Databases por Ambiente:**
- **DEV**: `app_polox_dev` (conexão direta)
- **SANDBOX**: `app_polox_sandbox` (conexão direta)  
- **PROD**: `app_polox_prod` (via RDS Proxy)

### **Lógica de Conexão (database.js):**
```javascript
function getDbHost() {
  const environment = process.env.NODE_ENV || 'dev';
  
  // Produção usa RDS Proxy, outros ambientes conexão direta
  if (environment === 'prod') {
    return process.env.DB_PROXY_HOST || process.env.DB_HOST;
  }
  
  return process.env.DB_HOST;
}
```

## 🚀 **COMANDOS DE DEPLOY**

### **Build:**
```bash
sam build
```

### **Deploy por Ambiente:**

#### **DEV:**
```bash
sam deploy --stack-name api-polox-dev --parameter-overrides Stage=dev --region sa-east-1
```

#### **SANDBOX:**
```bash
sam deploy --stack-name api-polox-sandbox --parameter-overrides Stage=sandbox --region sa-east-1
```

#### **PROD:**
```bash
sam deploy --stack-name api-polox-prod --parameter-overrides Stage=prod --region sa-east-1
```

## 📊 **LOGS E MONITORAMENTO**

### **CloudWatch Log Groups:**
- **DEV**: `/aws/lambda/api-polox-dev-ApiFunction-qVinOFeMoq2e`
- **SANDBOX**: `/aws/lambda/api-polox-sandbox-ApiFunction-[ID]`
- **PROD**: `/aws/lambda/api-polox-prod-ApiFunction-kgStBQADAQ57`

### **Comando para Ver Logs:**
```bash
# DEV
aws logs tail /aws/lambda/api-polox-dev-ApiFunction-qVinOFeMoq2e --region sa-east-1 --follow

# PROD  
aws logs tail /aws/lambda/api-polox-prod-ApiFunction-kgStBQADAQ57 --region sa-east-1 --follow
```

## 🔒 **SEGURANÇA**

### **SSL/TLS:**
- Configuração via `src/config/ssl-config.js`
- Usa AWS Root Certificates
- Substitui `rejectUnauthorized: false`

### **Migrations:**
- **SKIP_MIGRATIONS=true** na Lambda (evita timeout)
- Executar migrations separadamente quando necessário

## ⚡ **PERFORMANCE**

### **Métricas Atuais:**
- **DEV**: ~5ms response time
- **SANDBOX**: ~25ms response time  
- **PROD**: ~65ms response time (RDS Proxy overhead)

## 📝 **PRÓXIMOS PASSOS**

1. Executar migrations nos bancos de dados
2. Implementar endpoints da API
3. Configurar autenticação JWT
4. Implementar testes automatizados
5. Configurar CI/CD

---

**📞 Contato**: Para dúvidas, consulte os demais arquivos em `/docs/`