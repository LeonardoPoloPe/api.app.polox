# 🌐 Testando Multi-Idiomas no Swagger UI

**Data:** 26 de outubro de 2025  
**Status:** ✅ Clients + Companies com suporte multi-idiomas no Swagger  
**Última Atualização:** CompanyController (9 endpoints)

## 🎯 **Como Testar Multi-Idiomas no Swagger**

### **1. Acessar o Swagger UI**

```
http://localhost:3000/api/docs
```

### **2. Encontrar o Parâmetro Accept-Language**

Em **todos os endpoints** da API, você verá agora o parâmetro:

- **Nome**: `Accept-Language`
- **Tipo**: Header
- **Valores**: `pt`, `en`, `es`
- **Padrão**: `pt`
- **Obrigatório**: Não

### **3. Como Testar Cada Idioma**

#### **🇧🇷 Português (Padrão)**

1. Abra qualquer endpoint (ex: `/health`)
2. Clique em **"Try it out"**
3. **Deixe o campo Accept-Language vazio** ou coloque `pt`
4. Clique em **"Execute"**
5. **Resultado esperado**: Mensagens em português

#### **🇺🇸 English**

1. Abra qualquer endpoint (ex: `/health`)
2. Clique em **"Try it out"**
3. **No campo Accept-Language, digite**: `en`
4. Clique em **"Execute"**
5. **Resultado esperado**: Mensagens em inglês

#### **🇪🇸 Español**

1. Abra qualquer endpoint (ex: `/health`)
2. Clique em **"Try it out"**
3. **No campo Accept-Language, digite**: `es`
4. Clique em **"Execute"**
5. **Resultado esperado**: Mensagens em espanhol

## 🧪 **Endpoints Recomendados para Teste**

### **1. Health Check (`/health`)**

```
Português: "Status da API", "Saudável"
English:   "API Status", "Healthy"
Español:   "Estado de la API", "Saludable"
```

### **2. Informações da API (`/`)**

```
Português: "Bem-vindo à API Polox"
English:   "Welcome to Polox API"
Español:   "Bienvenido a la API Polox"
```

### **3. Idiomas Suportados (`/languages`)**

```
Português: "Operação realizada com sucesso"
English:   "Operation completed successfully"
Español:   "Operación completada con éxito"
```

### **4. Demonstração Pública (`/demo/public`)**

- Endpoint público para testar sem autenticação
- Responde no idioma selecionado

## 📊 **Comparação Visual de Respostas**

### **Exemplo: Endpoint `/health`**

#### **🇧🇷 Português (`Accept-Language: pt`)**

```json
{
  "success": true,
  "message": "Status da API",
  "data": {
    "status": "Saudável",
    "database": "Banco de dados conectado",
    "environment": "Ambiente: development",
    "language": {
      "current": "pt",
      "supported": ["pt", "en", "es"]
    }
  }
}
```

#### **🇺🇸 English (`Accept-Language: en`)**

```json
{
  "success": true,
  "message": "API Status",
  "data": {
    "status": "Healthy",
    "database": "Database connected",
    "environment": "Environment: development",
    "language": {
      "current": "en",
      "supported": ["pt", "en", "es"]
    }
  }
}
```

#### **🇪🇸 Español (`Accept-Language: es`)**

```json
{
  "success": true,
  "message": "Estado de la API",
  "data": {
    "status": "Saludable",
    "database": "Base de datos conectada",
    "environment": "Ambiente: development",
    "language": {
      "current": "es",
      "supported": ["pt", "en", "es"]
    }
  }
}
```

## 🔐 **Testando Endpoints com Autenticação**

### **1. Primeiro, registre um usuário:**

- Endpoint: `POST /auth/register`
- Adicione `Accept-Language: en` para resposta em inglês
- Preencha: name, email, password

### **2. Depois, faça login:**

- Endpoint: `POST /auth/login`
- Adicione `Accept-Language: en`
- Use email/password do registro
- **Copie o token JWT** da resposta

### **3. Autorize no Swagger:**

- Clique no botão **"Authorize"** 🔒 no topo da página
- Cole o token JWT no campo "bearerAuth"
- Clique em **"Authorize"** e **"Close"**

### **4. Teste endpoints protegidos:**

- Endpoint: `GET /demo/protected`
- Adicione `Accept-Language: es`
- Execute - agora você está autenticado!

## 🚀 **Dicas Avançadas**

### **Dropdown de Idiomas no Swagger**

O parâmetro Accept-Language aparece como dropdown com opções:

- `pt` (Português)
- `en` (English)
- `es` (Español)

### **Valor Padrão**

Se você não definir Accept-Language, o sistema usa `pt` (português) automaticamente.

### **Múltiplos Testes Rápidos**

1. Abra várias abas do Swagger
2. Configure idiomas diferentes em cada aba
3. Compare as respostas lado a lado

## ⚠️ **Resolução de Problemas**

### **Se as traduções não aparecerem:**

1. **Verifique se o servidor foi reiniciado** após as mudanças i18n
2. **Confirme o valor do Accept-Language** (pt, en, es)
3. **Limpe o cache do navegador** (Ctrl+F5)

### **Se o Swagger não abrir:**

1. Verifique se o servidor está rodando: `npm run dev:local`
2. Acesse: `http://localhost:3000/api/docs`
3. Verifique logs do servidor para erros

## 🎉 **Resultado Esperado**

Quando funcionando corretamente, você deve ver:

- ✅ **Campos Accept-Language** em todos os endpoints
- ✅ **Dropdown com 3 idiomas** (pt, en, es)
- ✅ **Respostas traduzidas** conforme o idioma selecionado
- ✅ **Mensagens diferentes** para cada idioma testado

**🚀 Agora você pode testar completamente o sistema multi-idiomas diretamente no Swagger UI!**
