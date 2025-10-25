# 🌐 Sistema de Traduções por Controller

**Data:** 25 de outubro de 2025  
**Status:** ✅ **IMPLEMENTADO E FUNCIONAL**

## 📋 **Visão Geral**

Este documento explica como usar o **sistema de traduções por controller** implementado na API Polox. Cada controller tem seus próprios arquivos de tradução organizados por idioma, facilitando a manutenção e organização das mensagens.

---

## 🏗️ **Estrutura dos Arquivos**

```
src/
├── locales/
│   ├── controllers/
│   │   ├── pt/                    # Português
│   │   │   ├── authController.json
│   │   │   ├── userController.json
│   │   │   ├── clientsController.json
│   │   │   └── [outros].json
│   │   ├── en/                    # Inglês
│   │   │   ├── authController.json
│   │   │   ├── userController.json
│   │   │   ├── clientsController.json
│   │   │   └── [outros].json
│   │   └── es/                    # Espanhol
│   │       ├── authController.json
│   │       ├── userController.json
│   │       ├── clientsController.json
│   │       └── [outros].json
│   └── pt|en|es/
│       └── common.json            # Traduções gerais
```

---

## 🎯 **Como Usar em Controllers**

### **1. Importar a Função Helper**

```javascript
// No início do seu controller
const { tc } = require("../config/i18n");
```

### **2. Usar no Código**

**Sintaxe:**

```javascript
tc(req, "nomeDoController", "chave.da.traducao", opções);
```

**Exemplo:**

```javascript
// Mensagem de sucesso
const message = tc(req, "authController", "login.success");

// Mensagem com interpolação
const message = tc(req, "userController", "validation.min_length", {
  count: 6,
});

// Uso em resposta
res.json({
  success: true,
  message: tc(req, "authController", "login.success"),
  data: userData,
});

// Uso em erro
throw new ApiError(400, tc(req, "authController", "login.missing_fields"));
```

---

## 📁 **Estrutura dos Arquivos JSON**

### **Exemplo: `authController.json`**

```json
{
  "login": {
    "success": "Login realizado com sucesso",
    "invalid_credentials": "Credenciais inválidas",
    "missing_fields": "Email e senha são obrigatórios"
  },
  "register": {
    "success": "Usuário registrado com sucesso",
    "missing_fields": "Nome, email e senha são obrigatórios",
    "email_exists": "Email já cadastrado"
  },
  "logout": {
    "success": "Logout realizado com sucesso"
  },
  "errors": {
    "login_error": "Erro no login",
    "register_error": "Erro no registro"
  }
}
```

### **Padrões de Organização:**

- **Ações:** `login`, `register`, `logout`, `update`, `delete`
- **Estados:** `success`, `error`, `loading`, `validation`
- **Tipos:** `missing_fields`, `invalid_format`, `not_found`

---

## 🚀 **Como Criar um Novo Controller**

### **Passo 1: Criar os Arquivos JSON**

Para um novo `productsController`, crie:

```
src/locales/controllers/pt/productsController.json
src/locales/controllers/en/productsController.json
src/locales/controllers/es/productsController.json
```

### **Passo 2: Estruturar as Traduções**

**`pt/productsController.json`:**

```json
{
  "create": {
    "success": "Produto criado com sucesso",
    "missing_name": "Nome do produto é obrigatório",
    "invalid_price": "Preço inválido"
  },
  "update": {
    "success": "Produto atualizado com sucesso",
    "not_found": "Produto não encontrado"
  },
  "delete": {
    "success": "Produto excluído com sucesso",
    "not_found": "Produto não encontrado"
  },
  "list": {
    "empty": "Nenhum produto encontrado",
    "success": "Produtos carregados com sucesso"
  }
}
```

### **Passo 3: Registrar no i18n**

Adicione o novo controller em `src/config/i18n.js`:

```javascript
ns: ["common", "authController", "userController", "productsController"],
```

### **Passo 4: Usar no Controller**

```javascript
const { tc } = require("../config/i18n");

class ProductsController {
  static create = asyncHandler(async (req, res) => {
    const { name, price } = req.body;

    if (!name) {
      throw new ApiError(
        400,
        tc(req, "productsController", "create.missing_name")
      );
    }

    if (!price || price <= 0) {
      throw new ApiError(
        400,
        tc(req, "productsController", "create.invalid_price")
      );
    }

    // ... lógica de criação ...

    res.status(201).json({
      success: true,
      message: tc(req, "productsController", "create.success"),
      data: newProduct,
    });
  });
}
```

---

## 🔧 **Recursos Avançados**

### **Interpolação de Variáveis**

```javascript
// JSON
{
  "validation": {
    "min_length": "Mínimo de {{count}} caracteres",
    "max_size": "Tamanho máximo: {{size}}MB"
  }
}

// Controller
tc(req, "userController", "validation.min_length", { count: 6 });
tc(req, "userController", "validation.max_size", { size: 10 });
```

### **Pluralização**

```javascript
// JSON
{
  "items": {
    "count_zero": "Nenhum item",
    "count_one": "{{count}} item",
    "count_other": "{{count}} itens"
  }
}

// Controller
tc(req, "productsController", "items.count", { count: itemCount });
```

### **Fallbacks**

Se uma tradução não for encontrada:

1. Tenta o idioma padrão (português)
2. Retorna a chave original
3. Registra um warning no console

---

## ✅ **Boas Práticas**

### **1. Naming Convention**

- **Controllers:** `nomeController.json` (ex: `authController.json`)
- **Chaves:** Use snake_case ou dotted notation
- **Idiomas:** Códigos ISO (`pt`, `en`, `es`)

### **2. Organização das Chaves**

```json
{
  "acao": {
    "resultado": "mensagem",
    "erro_especifico": "mensagem de erro"
  },
  "validacao": {
    "campo_obrigatorio": "mensagem",
    "formato_invalido": "mensagem"
  }
}
```

### **3. Mensagens Consistentes**

- **Sucesso:** "Operação realizada com sucesso"
- **Erro:** "Erro ao realizar operação"
- **Validação:** "Campo inválido/obrigatório"

### **4. Testing**

Sempre teste as traduções em todos os idiomas:

```javascript
// Teste português
curl -H "Accept-Language: pt" http://localhost:3000/auth/login

// Teste inglês
curl -H "Accept-Language: en" http://localhost:3000/auth/login

// Teste espanhol
curl -H "Accept-Language: es" http://localhost:3000/auth/login
```

---

## 🐛 **Troubleshooting**

### **"Tradução não encontrada"**

- Verifique se o arquivo JSON existe
- Confirme se a chave está correta
- Verifique se o controller está registrado no i18n

### **"Interpolação não funciona"**

- Confirme a sintaxe: `{{variavel}}`
- Passe as variáveis no terceiro parâmetro do `tc()`

### **"Idioma não muda"**

- Reinicie o servidor após mudanças no i18n
- Verifique o header `Accept-Language`
- Confirme se o idioma está nos `SUPPORTED_LANGUAGES`

---

## 📊 **Exemplo Completo**

### **Arquivo: `userController.json` (PT)**

```json
{
  "profile": {
    "get_success": "Perfil carregado com sucesso",
    "update_success": "Perfil atualizado com sucesso",
    "not_found": "Usuário não encontrado"
  },
  "validation": {
    "email_required": "Email é obrigatório",
    "email_invalid": "Email inválido",
    "name_min_length": "Nome deve ter no mínimo {{count}} caracteres"
  }
}
```

### **Controller Implementation:**

```javascript
const { tc } = require("../config/i18n");

class UserController {
  static getProfile = asyncHandler(async (req, res) => {
    const userId = req.user.id;

    const user = await getUserById(userId);

    if (!user) {
      throw new ApiError(404, tc(req, "userController", "profile.not_found"));
    }

    res.json({
      success: true,
      message: tc(req, "userController", "profile.get_success"),
      data: user,
    });
  });

  static updateProfile = asyncHandler(async (req, res) => {
    const { name, email } = req.body;

    if (!email) {
      throw new ApiError(
        400,
        tc(req, "userController", "validation.email_required")
      );
    }

    if (name && name.length < 3) {
      throw new ApiError(
        400,
        tc(req, "userController", "validation.name_min_length", { count: 3 })
      );
    }

    // ... lógica de atualização ...

    res.json({
      success: true,
      message: tc(req, "userController", "profile.update_success"),
      data: updatedUser,
    });
  });
}
```

---

## 🎉 **Resultado Final**

Com esse sistema, você terá:

- ✅ **Traduções organizadas** por controller
- ✅ **Fácil manutenção** e localização de mensagens
- ✅ **Consistência** entre idiomas
- ✅ **Reutilização** de padrões de mensagens
- ✅ **Escalabilidade** para novos controllers/idiomas

**🚀 Sistema implementado e testado com sucesso no AuthController!**
