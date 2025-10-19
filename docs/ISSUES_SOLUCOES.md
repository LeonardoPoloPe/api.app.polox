# 🚨 Issues e Soluções - API Polox

---

## ❌ **PROBLEMA CRÍTICO ATUAL**

### **Lambda Timeout nas Migrations**
**Status**: 🔴 **BLOQUEADOR**  
**Ambiente**: DEV  
**Data**: 19/10/2025

#### **Sintomas:**
- Lambda dá timeout em 15 segundos
- Erro durante execução das migrations
- API retorna "Internal server error"
- Logs mostram: `"Status: timeout"`

#### **Logs do Erro:**
```
info: Executando migrations... {"timestamp":"2025-10-19T03:48:52.472Z"}
REPORT RequestId: a50a66cb-0f77-472f-a7a0-04c5679e35e1
Duration: 15000.00 ms  Status: timeout
```

#### **Causas Possíveis:**
1. **Conectividade**: Lambda não está na mesma VPC do RDS
2. **Latência**: Conexão com RDS está muito lenta
3. **Migrations**: Processo demora mais que 15s
4. **SSL**: Problemas de handshake SSL/TLS

#### **Soluções Tentadas:**
- ✅ Timeout aumentado: 15s → 60s
- ✅ Memória aumentada: 512MB → 1024MB
- ✅ Variável `SKIP_MIGRATIONS=true` adicionada
- ⏳ **Pendente**: Rebuild e redeploy

#### **Próximos Passos:**
```bash
# 1. Rebuild com modificações
sam build

# 2. Redeploy
sam deploy --stack-name api-polox-dev --region sa-east-1

# 3. Testar novamente
curl https://9fcbczof2d.execute-api.sa-east-1.amazonaws.com/Prod/health
```

---

## ⚠️ **PROBLEMAS RESOLVIDOS**

### **1. Permissões IAM Insuficientes**
**Status**: ✅ **RESOLVIDO**  
**Data**: 19/10/2025

#### **Problema:**
```
Error: User devleonardopolo is not authorized to perform: iam:CreateRole
```

#### **Solução:**
- Administrador AWS adicionou política `IAMFullAccess`
- Deploy subsequente funcionou

---

### **2. Conflito CloudFormation Stack**
**Status**: ✅ **RESOLVIDO**  
**Data**: 19/10/2025

#### **Problema:**
```
Error: Stack api-app-polox-dev is in UPDATE_ROLLBACK_COMPLETE state
```

#### **Solução:**
```bash
# Remover stack conflitante
aws cloudformation delete-stack --stack-name api-app-polox-dev --region sa-east-1

# Aguardar e redeploy
sam deploy --stack-name api-polox-dev --region sa-east-1
```

---

### **3. Bucket S3 Não Removido**
**Status**: ✅ **RESOLVIDO**  
**Data**: 19/10/2025

#### **Problema:**
```
Error: DELETE_FAILED: ServerlessDeploymentBucket
```

#### **Solução:**
```bash
# Esvaziar bucket
aws s3 rm s3://BUCKET_NAME --recursive

# Remover bucket
aws s3 rb s3://BUCKET_NAME

# Tentar deletar stack novamente
aws cloudformation delete-stack --stack-name api-app-polox-dev --region sa-east-1
```

---

### **4. SSL/TLS Configuration**
**Status**: ✅ **RESOLVIDO**  
**Data**: 19/10/2025

#### **Problema:**
- `rejectUnauthorized: false` (inseguro)
- Risco de ataques man-in-the-middle

#### **Solução:**
- Certificado AWS baixado: `rds-ca-2019-root.pem`
- SSL config implementado: `src/config/ssl-config.js`
- Configuração por ambiente
- Script automático: `scripts/setup-ssl.sh`

---

## 🔍 **INVESTIGAÇÕES PENDENTES**

### **1. Conectividade VPC**
**Status**: 🟡 **INVESTIGAR**

#### **Verificar:**
- Lambda está na mesma VPC do RDS?
- Security Groups permitem conexão PostgreSQL (porta 5432)?
- NAT Gateway configurado para internet access?

#### **Comandos Debug:**
```bash
# Ver configuração VPC da Lambda
aws lambda get-function-configuration --function-name FUNCTION_NAME --region sa-east-1

# Ver security groups do RDS
aws rds describe-db-instances --db-instance-identifier database-1 --region sa-east-1
```

---

### **2. Performance Migrations**
**Status**: 🟡 **INVESTIGAR**

#### **Verificar:**
- Tamanho das migrations existentes
- Tempo de execução local vs AWS
- Possibilidade de migrations incrementais

#### **Alternativas:**
- Executar migrations via script separado
- Usar RDS Data API
- Migrations sob demanda via endpoint

---

### **3. RDS Proxy em Produção**
**Status**: 🟡 **TESTAR**

#### **Verificar:**
- RDS Proxy configurado corretamente?
- Certificados compatíveis?
- Latência vs conexão direta

#### **Teste:**
```bash
# Deploy produção com proxy
sam deploy --stack-name api-polox-prod --parameter-overrides Stage=prod --region sa-east-1
```

---

## 🛠️ **WORKAROUNDS IMPLEMENTADOS**

### **1. Skip Migrations na Inicialização**
```javascript
// src/handler.js
if (process.env.SKIP_MIGRATIONS !== 'true') {
  logger.info("Executando migrations...");
  // ... código migrations
} else {
  logger.info("Migrations puladas (SKIP_MIGRATIONS=true)");
}
```

### **2. Timeout Estendido**
```yaml
# template.yaml
Globals:
  Function:
    Timeout: 60
    MemorySize: 1024
```

### **3. SSL Flexível por Ambiente**
```javascript
// src/config/ssl-config.js
const getCurrentSSLConfig = () => {
  const environment = process.env.NODE_ENV || 'development';
  const configFunction = SSL_CONFIG[environment] || SSL_CONFIG.development;
  return configFunction();
};
```

---

## 📊 **MONITORAMENTO E ALERTAS**

### **Métricas Importantes:**
- **Duration**: Lambda deve < 30s
- **Memory**: Usar < 80% da alocada
- **Errors**: 0% error rate
- **Cold Starts**: < 5s

### **Logs Críticos:**
```bash
# Monitorar erros
aws logs filter-log-events --log-group-name "/aws/lambda/api-polox-dev-ApiFunction-qVinOFeMoq2e" --filter-pattern "ERROR" --region sa-east-1

# Monitorar timeouts
aws logs filter-log-events --log-group-name "/aws/lambda/api-polox-dev-ApiFunction-qVinOFeMoq2e" --filter-pattern "timeout" --region sa-east-1
```

---

## 🎯 **PRIORIDADES PARA PRÓXIMA SESSÃO**

### **🔴 ALTA PRIORIDADE**
1. **Resolver timeout migrations** (bloqueador)
2. **Validar conectividade Lambda ↔ RDS**
3. **Testar API funcional end-to-end**

### **🟡 MÉDIA PRIORIDADE**
4. Deploy sandbox environment
5. Deploy produção com RDS Proxy
6. Implementar monitoramento

### **🟢 BAIXA PRIORIDADE**
7. Otimizar performance
8. Implementar cache
9. Adicionar testes automatizados

---

## 💡 **LIÇÕES APRENDIDAS**

### **✅ O que funcionou bem:**
- AWS SAM mais estável que Serverless Framework
- SSL configuration modular e flexível
- Ambiente local como baseline de validação
- Logs detalhados facilitam debug

### **❌ O que não funcionou:**
- Migrations síncronas na inicialização Lambda
- Timeout padrão muito baixo para operações DB
- Deploy sem teste de conectividade primeiro

### **🔧 Melhorias futuras:**
- Health check antes de migrations
- Migrations assíncronas ou separadas
- VPC configuration explícita
- Testes de conectividade automatizados