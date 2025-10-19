# 📚 Documentação Swagger - API Polox

## 🎯 **Acesso à Documentação**

### 🌐 **URLs da Documentação:**

- **Desenvolvimento Local**: [http://localhost:3000/dev/api/docs](http://localhost:3000/dev/api/docs)
- **JSON da Especificação**: [http://localhost:3000/dev/api/api-docs.json](http://localhost:3000/dev/api/api-docs.json)

---

## ⚙️ **Configuração do Swagger**

### 🔧 **Controle por Ambiente:**

O Swagger é controlado pela variável de ambiente `ENABLE_SWAGGER`:

```bash
# No arquivo .env
ENABLE_SWAGGER=true   # Habilita Swagger
ENABLE_SWAGGER=false  # Desabilita Swagger
```

### 📋 **Configuração por Ambiente:**

| Ambiente    | Status          | Motivo                   |
| ----------- | --------------- | ------------------------ |
| **DEV**     | ✅ Habilitado   | Desenvolvimento e testes |
| **SANDBOX** | ✅ Habilitado   | Testes e validação       |
| **PROD**    | ❌ Desabilitado | Segurança em produção    |

---

## 🚀 **Como Usar o Swagger UI**

### 1. **Acessar a Documentação:**

- Navegue para `http://localhost:3000/dev/api/docs`
- A interface interativa será carregada

### 2. **Testar Endpoints Públicos:**

- Clique em qualquer endpoint marcado como **público**
- Clique em **"Try it out"**
- Preencha os parâmetros (se necessário)
- Clique em **"Execute"**

### 3. **Testar Endpoints Protegidos:**

#### 3.1. **Fazer Login:**

```bash
POST /api/auth/register  # Primeiro registre um usuário
POST /api/auth/login     # Depois faça login
```

#### 3.2. **Usar o Token JWT:**

1. Copie o `token` da resposta do login
2. No topo da página Swagger, clique em **"Authorize"** 🔒
3. Cole o token no campo **"bearerAuth"**
4. Clique em **"Authorize"**
5. Agora você pode testar endpoints protegidos

---

## 📖 **Endpoints Disponíveis**

### 🔐 **Authentication (Autenticação)**

- `POST /auth/register` - Registrar novo usuário
- `POST /auth/login` - Fazer login
- `POST /auth/refresh` - Renovar token
- `POST /auth/logout` - Fazer logout

### 👤 **Users (Usuários)**

- `GET /users/profile` - Ver perfil do usuário logado
- `PUT /users/profile` - Atualizar perfil
- `DELETE /users/profile` - Deletar conta
- `GET /users` - Listar todos os usuários (Admin)
- `GET /users/{id}` - Ver usuário específico (Admin)

### 🧪 **Demo (Demonstração)**

- `GET /demo/public` - Endpoint público para testes
- `GET /demo/protected` - Endpoint protegido para testes

### 🏥 **Health (Monitoramento)**

- `GET /health` - Health check da aplicação
- `GET /test/database` - Testar conexão com banco

---

## 🛡️ **Segurança do Swagger**

### ⚠️ **Riscos em Produção:**

- **Exposição da API**: Revela toda a estrutura
- **Informações sensíveis**: Schemas e endpoints internos
- **Superfície de ataque**: Endpoint adicional

### ✅ **Proteções Implementadas:**

- **Controle por ambiente**: Variável `ENABLE_SWAGGER`
- **Desabilitado em PROD**: Por padrão seguro
- **Documentação limitada**: Apenas endpoints públicos documentados

---

## 🔧 **Exemplos de Uso**

### 1. **Registro de Usuário:**

```json
POST /api/auth/register
{
  "email": "teste@polox.com",
  "password": "123456",
  "name": "Usuário Teste"
}
```

### 2. **Login:**

```json
POST /api/auth/login
{
  "email": "teste@polox.com",
  "password": "123456"
}
```

### 3. **Usando Token:**

```bash
Authorization: Bearer [SEU_JWT_TOKEN_AQUI]
```

---

## 📱 **Integração com Outras Ferramentas**

### 🔗 **Postman:**

1. Acesse: `http://localhost:3000/dev/api-docs.json`
2. Copie o JSON
3. No Postman: **Import** → **Raw Text** → Cole o JSON

### 🔗 **Insomnia:**

1. Acesse: `http://localhost:3000/dev/api-docs.json`
2. No Insomnia: **Import** → **From URL** → Cole a URL

### 🔗 **VS Code (REST Client):**

```http
### Registro
POST http://localhost:3000/dev/api/auth/register
Content-Type: application/json

{
  "email": "teste@polox.com",
  "password": "123456",
  "name": "Usuário Teste"
}
```

---

## 🎉 **Vantagens do Swagger**

### ✅ **Para Desenvolvimento:**

- **Testes rápidos**: Interface gráfica interativa
- **Documentação viva**: Sempre atualizada com o código
- **Validação automática**: Verifica requests/responses
- **Facilita debugging**: Testa endpoints isoladamente

### ✅ **Para Integração:**

- **Especificação padrão**: OpenAPI 3.0
- **Geração de código**: Clientes automáticos
- **Documentação completa**: Schemas, exemplos, tipos
- **Facilita onboarding**: Novos desenvolvedores

---

## 🚦 **Status da Implementação**

- ✅ **Swagger UI configurado**
- ✅ **Documentação completa de todas as rotas**
- ✅ **Schemas detalhados para requests/responses**
- ✅ **Autenticação JWT integrada**
- ✅ **Controle por ambiente implementado**
- ✅ **Interface customizada e profissional**

**🎊 Swagger 100% funcional e pronto para uso!**
