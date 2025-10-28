# 🚀 CORS - Guia Rápido

## ➕ Adicionar Nova Origem

### 1. Editar código
```javascript
// src/handler.js - linha ~40
const origins = {
  sandbox: [
    'https://app-sandbox.polox.com.br',
    'https://nova-origem.com',  // ← ADICIONE AQUI
  ],
  // ...
};
```

### 2. Deploy
```bash
npm run deploy:sandbox
```

### 3. Testar
```bash
curl -H "Origin: https://nova-origem.com" \
     https://[api-gateway-url]/sandbox/api/v1/health -v
```

---

## 🔍 Verificar CORS Bloqueado

### Logs no CloudWatch
```
AWS Lambda → api-app-polox-sandbox-api → Monitor → Logs
Buscar: "CORS bloqueou origem"
```

### Teste Manual
```bash
# Request OPTIONS (preflight)
curl -X OPTIONS \
     -H "Origin: https://teste.com" \
     -H "Access-Control-Request-Method: POST" \
     https://[url]/api/v1/auth/login -v

# Deve retornar:
# access-control-allow-origin: https://teste.com
```

---

## 📋 Origens Atuais

### PROD
- `https://app.polox.com`
- `https://app.polox.com.br`
- `https://bomelo.com.br`

### SANDBOX
- `https://app-sandbox.polox.com.br` ✅
- `http://localhost:3000`

### DEV
- `http://localhost:3000`
- `http://localhost:5173` (Vite)

---

## 🆘 Erro Comum

**Erro:** "No 'Access-Control-Allow-Origin' header"

**Solução:**
1. Adicionar origem em `getAllowedOrigins()`
2. Fazer deploy
3. Limpar cache do navegador
4. Testar

---

**Docs completas:** `docs/CONFIGURACAO_CORS.md`
