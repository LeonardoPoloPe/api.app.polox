# 🌐 Configuração CORS - API Polox

## 📋 Índice
- [O que é CORS](#o-que-é-cors)
- [Configuração Atual](#configuração-atual)
- [Origens Permitidas](#origens-permitidas)
- [Como Adicionar Nova Origem](#como-adicionar-nova-origem)
- [Troubleshooting](#troubleshooting)
- [Deploy](#deploy)

---

## 🔍 O que é CORS?

**CORS** (Cross-Origin Resource Sharing) é um mecanismo de segurança que permite ou bloqueia requisições HTTP de diferentes origens (domínios).

### Por que é necessário?

Quando um frontend hospedado em `https://app-sandbox.polox.com.br` tenta fazer uma requisição para a API em `https://api.execute-api.amazonaws.com`, o navegador bloqueia por padrão por questões de segurança. O CORS permite que especifiquemos quais origens são confiáveis.

---

## ⚙️ Configuração Atual

A configuração de CORS está implementada em **2 camadas**:

### 1. **Express (Aplicação)**
Arquivo: `src/handler.js`

```javascript
// Configuração CORS
const getAllowedOrigins = () => {
  const env = process.env.NODE_ENV || 'dev';
  
  const origins = {
    prod: [
      'https://app.polox.com',
      'https://app.polox.com.br',
      'https://polox.com',
      'https://polox.com.br',
      'https://bomelo.com.br'
    ],
    sandbox: [
      'https://app-sandbox.polox.com',
      'https://app-sandbox.polox.com.br',
      'https://sandbox.polox.com',
      'https://sandbox.polox.com.br',
      'http://localhost:3000',
      'http://localhost:3001'
    ],
    dev: [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:5173',
      'http://localhost:5174'
    ]
  };
  
  return origins[env] || origins.dev;
};

app.use(
  cors({
    origin: (origin, callback) => {
      const allowedOrigins = getAllowedOrigins();
      
      // Permitir requisições sem origin (mobile apps, Postman, etc)
      if (!origin) return callback(null, true);
      
      if (allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        logger.warn(`CORS bloqueou origem: ${origin}`);
        callback(new Error(`Origem ${origin} não permitida por CORS`));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: [
      "Content-Type", 
      "Authorization", 
      "X-Requested-With",
      "Accept",
      "Accept-Language",
      "Origin"
    ],
    exposedHeaders: ["Content-Language"],
    maxAge: 86400 // 24 horas
  })
);
```

### 2. **API Gateway (AWS)**
Arquivo: `serverless.yml`

```yaml
functions:
  api:
    handler: src/handler.handler
    events:
      - http:
          path: /{proxy+}
          method: ANY
          cors:
            origin: '*'
            headers:
              - Content-Type
              - Authorization
              - Accept
              - Accept-Language
              - Origin
              - X-Requested-With
            allowCredentials: true
            maxAge: 86400
```

---

## 🌍 Origens Permitidas por Ambiente

### **🔴 PROD** (Produção)
```javascript
'https://app.polox.com'         // App principal
'https://app.polox.com.br'      // App principal (.br)
'https://polox.com'             // Site institucional
'https://polox.com.br'          // Site institucional (.br)
'https://bomelo.com.br'         // White-label parceiro
```

**Quando usar:** Quando `NODE_ENV=prod` ou `NODE_ENV=production`

---

### **🟡 SANDBOX** (Homologação)
```javascript
'https://app-sandbox.polox.com'     // App de testes
'https://app-sandbox.polox.com.br'  // App de testes (.br)
'https://sandbox.polox.com'         // Sandbox alternativo
'https://sandbox.polox.com.br'      // Sandbox alternativo (.br)
'http://localhost:3000'             // Dev local (React)
'http://localhost:3001'             // Dev local (alternativo)
```

**Quando usar:** Quando `NODE_ENV=sandbox`

---

### **🟢 DEV** (Desenvolvimento)
```javascript
'http://localhost:3000'   // React/Next padrão
'http://localhost:3001'   // Porta alternativa
'http://localhost:5173'   // Vite padrão
'http://localhost:5174'   // Vite alternativa
```

**Quando usar:** Quando `NODE_ENV=dev` ou `NODE_ENV=development`

---

## ➕ Como Adicionar Nova Origem

### **Passo 1: Editar handler.js**

1. Abra o arquivo `src/handler.js`
2. Localize a função `getAllowedOrigins()`
3. Adicione a nova URL no array do ambiente apropriado:

```javascript
const origins = {
  prod: [
    'https://app.polox.com',
    'https://novo-dominio.com',  // ← ADICIONE AQUI
    // ...
  ],
  // ...
};
```

### **Passo 2: Fazer Deploy**

```bash
# Para sandbox
npm run deploy:sandbox
# ou
serverless deploy --stage sandbox

# Para produção
npm run deploy:prod
# ou
serverless deploy --stage prod
```

### **Passo 3: Testar**

```bash
# Testar do navegador ou com curl
curl -H "Origin: https://novo-dominio.com" \
     -H "Access-Control-Request-Method: POST" \
     -H "Access-Control-Request-Headers: Content-Type" \
     -X OPTIONS \
     https://el0qui6eqj.execute-api.sa-east-1.amazonaws.com/sandbox/api/v1/auth/login -v
```

---

## 🔧 Configurações Avançadas

### **Credentials (Cookies e Autenticação)**
```javascript
credentials: true  // Permite envio de cookies e headers de autenticação
```

⚠️ **Importante:** Quando `credentials: true`, não pode usar `origin: '*'`. Deve especificar origens exatas.

---

### **Headers Permitidos**
```javascript
allowedHeaders: [
  "Content-Type",      // Tipo de conteúdo (JSON, etc)
  "Authorization",     // Token JWT
  "X-Requested-With",  // Identificação de AJAX
  "Accept",            // Formato de resposta aceito
  "Accept-Language",   // Idioma preferido
  "Origin"             // Origem da requisição
]
```

---

### **Methods Permitidos**
```javascript
methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"]
```

**OPTIONS** é obrigatório para preflight requests.

---

### **Headers Expostos**
```javascript
exposedHeaders: ["Content-Language"]
```

Headers customizados que o cliente pode acessar na resposta.

---

### **Cache (MaxAge)**
```javascript
maxAge: 86400  // 24 horas em segundos
```

Tempo que o navegador pode cachear a resposta de preflight.

---

## 🚨 Troubleshooting

### **Erro: "No 'Access-Control-Allow-Origin' header"**

**Causa:** A origem não está na lista de permitidas ou a configuração do CORS está incorreta.

**Solução:**
1. Verifique se a origem está em `getAllowedOrigins()`
2. Verifique se o `NODE_ENV` está correto
3. Verifique os logs: `logger.warn(\`CORS bloqueou origem: ${origin}\`)`
4. Faça novo deploy após adicionar a origem

---

### **Erro: "CORS policy: credentials mode"**

**Causa:** Tentando usar `credentials: true` com `origin: '*'`

**Solução:**
- No Express: A origem é validada dinamicamente ✅
- No API Gateway: Usar `origin: '*'` é OK pois o Express valida ✅

---

### **Erro: "Method not allowed"**

**Causa:** O método HTTP não está na lista `methods`.

**Solução:**
Adicione o método necessário:
```javascript
methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"]
```

---

### **Request OPTIONS falhando (Preflight)**

**Causa:** Navegador envia request OPTIONS antes do request real para verificar CORS.

**Solução:**
- Garantir que `OPTIONS` está em `methods` ✅
- Garantir que API Gateway tem configuração CORS ✅
- Headers corretos devem ser retornados automaticamente ✅

---

## 📝 Logs e Monitoramento

### **Verificar Logs de CORS Bloqueado**

```javascript
logger.warn(`CORS bloqueou origem: ${origin}`);
```

**No CloudWatch:**
1. Acesse AWS Lambda → Functions → `api-app-polox-[stage]-api`
2. Monitor → Logs → View logs in CloudWatch
3. Busque por: `CORS bloqueou origem`

---

### **Verificar Origem da Requisição**

```javascript
// No código
console.log('Origin:', req.get('Origin'));
console.log('Referer:', req.get('Referer'));
```

---

## 🚀 Deploy

### **Ambientes Configurados**

```bash
# Desenvolvimento
npm run deploy:dev
NODE_ENV=dev serverless deploy --stage dev

# Sandbox (Homologação)
npm run deploy:sandbox
NODE_ENV=sandbox serverless deploy --stage sandbox

# Produção
npm run deploy:prod
NODE_ENV=prod serverless deploy --stage prod
```

---

### **Verificar Deploy**

```bash
# Após deploy, testar CORS
curl -H "Origin: https://app-sandbox.polox.com.br" \
     -X GET \
     https://el0qui6eqj.execute-api.sa-east-1.amazonaws.com/sandbox/api/v1/health -v

# Deve retornar:
# < access-control-allow-origin: https://app-sandbox.polox.com.br
# < access-control-allow-credentials: true
```

---

## 📋 Checklist de Configuração CORS

Ao adicionar nova origem:

- [ ] Adicionar URL em `getAllowedOrigins()` no ambiente correto
- [ ] Verificar se a URL está exatamente como o navegador envia (http/https, com/sem www)
- [ ] Fazer commit das alterações
- [ ] Fazer deploy no ambiente correto
- [ ] Testar com curl ou navegador
- [ ] Verificar logs no CloudWatch
- [ ] Documentar a nova origem (se white-label ou parceiro)

---

## 🔐 Segurança

### **Boas Práticas**

✅ **Fazer:**
- Listar apenas origens necessárias
- Usar HTTPS em produção
- Separar configurações por ambiente
- Validar origem dinamicamente
- Logar tentativas bloqueadas

❌ **Não fazer:**
- Usar `origin: '*'` com `credentials: true` no Express
- Permitir todas as origens em produção
- Ignorar logs de CORS bloqueado
- Usar HTTP em produção

---

## 📚 Referências

- [MDN - CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)
- [Express CORS Middleware](https://expressjs.com/en/resources/middleware/cors.html)
- [AWS API Gateway CORS](https://docs.aws.amazon.com/apigateway/latest/developerguide/how-to-cors.html)
- [Serverless Framework - HTTP CORS](https://www.serverless.com/framework/docs/providers/aws/events/apigateway#enabling-cors)

---

## 🆘 Suporte

Se encontrar problemas com CORS:

1. **Verifique os logs** no CloudWatch
2. **Teste com curl** para isolar o problema
3. **Valide a origem** exata que o navegador está enviando
4. **Verifique o NODE_ENV** do ambiente
5. **Confirme o deploy** foi concluído com sucesso

---

**Última atualização:** 27 de outubro de 2025  
**Autor:** Equipe Polox CRM  
**Versão:** 1.0
