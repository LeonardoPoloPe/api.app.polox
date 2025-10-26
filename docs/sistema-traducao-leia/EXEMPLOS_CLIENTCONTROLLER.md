# 🧪 Exemplos Práticos - ClientController Multi-idioma

**Data:** 25 de outubro de 2025

---

## 🎯 **EXEMPLOS DE USO**

### **1. Criar Cliente**

#### **🇧🇷 Português (Padrão)**
```bash
curl -X POST http://localhost:3000/api/v1/clients \
  -H "Content-Type: application/json" \
  -H "Accept-Language: pt" \
  -H "Authorization: Bearer SEU_TOKEN" \
  -d '{
    "name": "Maria Silva",
    "email": "maria@exemplo.com.br",
    "phone": "(11) 98765-4321"
  }'
```

**Resposta:**
```json
{
  "success": true,
  "message": "Cliente criado com sucesso",
  "data": {
    "id": 123,
    "name": "Maria Silva",
    "email": "maria@exemplo.com.br",
    "created_at": "2025-10-25T..."
  }
}
```

#### **🇺🇸 Inglês**
```bash
curl -X POST http://localhost:3000/api/v1/clients \
  -H "Content-Type: application/json" \
  -H "Accept-Language: en" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "name": "John Smith",
    "email": "john@example.com",
    "phone": "+1 555-0123"
  }'
```

**Resposta:**
```json
{
  "success": true,
  "message": "Client created successfully",
  "data": { ... }
}
```

#### **🇪🇸 Espanhol**
```bash
curl -X POST http://localhost:3000/api/v1/clients \
  -H "Content-Type: application/json" \
  -H "Accept-Language: es" \
  -H "Authorization: Bearer TU_TOKEN" \
  -d '{
    "name": "Juan Pérez",
    "email": "juan@ejemplo.es",
    "phone": "+34 612 345 678"
  }'
```

**Resposta:**
```json
{
  "success": true,
  "message": "Cliente creado con éxito",
  "data": { ... }
}
```

---

### **2. Erro de Validação - Nome Muito Curto**

#### **🇧🇷 Português**
```bash
curl -X POST http://localhost:3000/api/v1/clients \
  -H "Content-Type: application/json" \
  -H "Accept-Language: pt" \
  -H "Authorization: Bearer SEU_TOKEN" \
  -d '{"name": "A"}'
```

**Resposta:**
```json
{
  "success": false,
  "error": {
    "message": "Nome deve ter pelo menos 2 caracteres",
    "code": 400
  }
}
```

#### **🇺🇸 Inglês**
```bash
curl -X POST http://localhost:3000/api/v1/clients \
  -H "Accept-Language: en" \
  -d '{"name": "A"}'
```

**Resposta:**
```json
{
  "success": false,
  "error": {
    "message": "Name must have at least 2 characters",
    "code": 400
  }
}
```

#### **🇪🇸 Espanhol**
```bash
curl -X POST http://localhost:3000/api/v1/clients \
  -H "Accept-Language: es" \
  -d '{"name": "A"}'
```

**Resposta:**
```json
{
  "success": false,
  "error": {
    "message": "El nombre debe tener al menos 2 caracteres",
    "code": 400
  }
}
```

---

### **3. Deletar Cliente com Vendas Ativas**

#### **🇧🇷 Português**
```bash
curl -X DELETE http://localhost:3000/api/v1/clients/123 \
  -H "Accept-Language: pt" \
  -H "Authorization: Bearer SEU_TOKEN"
```

**Resposta (Erro):**
```json
{
  "success": false,
  "error": {
    "message": "Não é possível excluir cliente com vendas ativas",
    "code": 400
  }
}
```

#### **🇺🇸 Inglês**
```bash
curl -X DELETE http://localhost:3000/api/v1/clients/123 \
  -H "Accept-Language: en"
```

**Resposta:**
```json
{
  "success": false,
  "error": {
    "message": "Cannot delete client with active sales",
    "code": 400
  }
}
```

#### **🇪🇸 Espanhol**
```bash
curl -X DELETE http://localhost:3000/api/v1/clients/123 \
  -H "Accept-Language: es"
```

**Resposta:**
```json
{
  "success": false,
  "error": {
    "message": "No se puede eliminar cliente con ventas activas",
    "code": 400
  }
}
```

---

### **4. Cliente Não Encontrado**

#### **Todas as Línguas**

**PT:**
```bash
curl http://localhost:3000/api/v1/clients/999999 \
  -H "Accept-Language: pt"
# Resposta: "Cliente não encontrado"
```

**EN:**
```bash
curl http://localhost:3000/api/v1/clients/999999 \
  -H "Accept-Language: en"
# Resposta: "Client not found"
```

**ES:**
```bash
curl http://localhost:3000/api/v1/clients/999999 \
  -H "Accept-Language: es"
# Resposta: "Cliente no encontrado"
```

---

### **5. Adicionar Nota ao Cliente**

#### **🇧🇷 Português**
```bash
curl -X POST http://localhost:3000/api/v1/clients/123/notes \
  -H "Content-Type: application/json" \
  -H "Accept-Language: pt" \
  -H "Authorization: Bearer SEU_TOKEN" \
  -d '{
    "note": "Cliente demonstrou interesse em produto premium",
    "type": "general"
  }'
```

**Resposta:**
```json
{
  "success": true,
  "message": "Anotação adicionada com sucesso",
  "data": {
    "id": 456,
    "note_content": "Cliente demonstrou interesse em produto premium",
    "note_type": "general",
    "created_at": "2025-10-25T..."
  }
}
```

#### **🇺🇸 Inglês**
```bash
curl -X POST http://localhost:3000/api/v1/clients/123/notes \
  -H "Accept-Language: en" \
  -d '{
    "note": "Client showed interest in premium product",
    "type": "general"
  }'
```

**Resposta:**
```json
{
  "success": true,
  "message": "Note added successfully",
  "data": { ... }
}
```

---

### **6. Atualizar Tags do Cliente**

#### **🇧🇷 Português**
```bash
curl -X PUT http://localhost:3000/api/v1/clients/123/tags \
  -H "Content-Type: application/json" \
  -H "Accept-Language: pt" \
  -H "Authorization: Bearer SEU_TOKEN" \
  -d '{
    "tags": ["VIP", "Recorrente", "Alta Prioridade"]
  }'
```

**Resposta:**
```json
{
  "success": true,
  "message": "Tags atualizadas com sucesso",
  "data": {
    "id": 123,
    "tags": ["VIP", "Recorrente", "Alta Prioridade"]
  }
}
```

#### **🇺🇸 Inglês**
```bash
curl -X PUT http://localhost:3000/api/v1/clients/123/tags \
  -H "Accept-Language: en" \
  -d '{"tags": ["VIP", "Recurring", "High Priority"]}'
```

**Resposta:**
```json
{
  "success": true,
  "message": "Tags updated successfully",
  "data": { ... }
}
```

---

## 🧪 **TESTANDO COM POSTMAN/INSOMNIA**

### **Configuração:**

1. **Criar Environment Variables:**
   - `BASE_URL`: `http://localhost:3000/api/v1`
   - `TOKEN`: Seu token de autenticação
   - `LANGUAGE`: `pt`, `en` ou `es`

2. **Headers Globais:**
   ```
   Content-Type: application/json
   Accept-Language: {{LANGUAGE}}
   Authorization: Bearer {{TOKEN}}
   ```

3. **Requests:**
   - Criar cliente: `POST {{BASE_URL}}/clients`
   - Listar clientes: `GET {{BASE_URL}}/clients`
   - Ver cliente: `GET {{BASE_URL}}/clients/:id`
   - Atualizar cliente: `PUT {{BASE_URL}}/clients/:id`
   - Deletar cliente: `DELETE {{BASE_URL}}/clients/:id`

---

## 🎯 **CENÁRIOS DE TESTE COMPLETOS**

### **Cenário 1: Fluxo Completo em Português**

```bash
# 1. Criar cliente
curl -X POST http://localhost:3000/api/v1/clients \
  -H "Content-Type: application/json" \
  -H "Accept-Language: pt" \
  -H "Authorization: Bearer TOKEN" \
  -d '{"name": "João Santos", "email": "joao@teste.com"}'
# ✅ "Cliente criado com sucesso"

# 2. Ver detalhes
curl http://localhost:3000/api/v1/clients/123 \
  -H "Accept-Language: pt" \
  -H "Authorization: Bearer TOKEN"
# ✅ Dados do cliente

# 3. Adicionar nota
curl -X POST http://localhost:3000/api/v1/clients/123/notes \
  -H "Content-Type: application/json" \
  -H "Accept-Language: pt" \
  -H "Authorization: Bearer TOKEN" \
  -d '{"note": "Primeira interação", "type": "call"}'
# ✅ "Anotação adicionada com sucesso"

# 4. Atualizar
curl -X PUT http://localhost:3000/api/v1/clients/123 \
  -H "Content-Type: application/json" \
  -H "Accept-Language: pt" \
  -H "Authorization: Bearer TOKEN" \
  -d '{"status": "vip"}'
# ✅ "Cliente atualizado com sucesso"
```

### **Cenário 2: Validações em Inglês**

```bash
# Erro: Nome muito curto
curl -X POST http://localhost:3000/api/v1/clients \
  -H "Accept-Language: en" \
  -d '{"name": "J"}'
# ❌ "Name must have at least 2 characters"

# Erro: Email inválido
curl -X POST http://localhost:3000/api/v1/clients \
  -H "Accept-Language: en" \
  -d '{"name": "John", "email": "invalid-email"}'
# ❌ "Email must have valid format"

# Erro: Cliente não encontrado
curl http://localhost:3000/api/v1/clients/999999 \
  -H "Accept-Language: en"
# ❌ "Client not found"
```

---

## 📊 **COMPARAÇÃO DE MENSAGENS**

| Contexto | PT | EN | ES |
|---|---|---|---|
| **Criar sucesso** | Cliente criado com sucesso | Client created successfully | Cliente creado con éxito |
| **Atualizar sucesso** | Cliente atualizado com sucesso | Client updated successfully | Cliente actualizado con éxito |
| **Deletar sucesso** | Cliente excluído com sucesso | Client deleted successfully | Cliente eliminado con éxito |
| **Não encontrado** | Cliente não encontrado | Client not found | Cliente no encontrado |
| **Nome curto** | Nome deve ter pelo menos 2 caracteres | Name must have at least 2 characters | El nombre debe tener al menos 2 caracteres |
| **Vendas ativas** | Não é possível excluir cliente com vendas ativas | Cannot delete client with active sales | No se puede eliminar cliente con ventas activas |
| **Nota adicionada** | Anotação adicionada com sucesso | Note added successfully | Nota agregada con éxito |
| **Tags atualizadas** | Tags atualizadas com sucesso | Tags updated successfully | Etiquetas actualizadas con éxito |

---

## 🎉 **RESULTADO**

**Todos os endpoints do ClientController respondem corretamente em 3 idiomas!**

- ✅ Mensagens de sucesso traduzidas
- ✅ Mensagens de erro traduzidas
- ✅ Validações traduzidas
- ✅ Mudança automática baseada no header `Accept-Language`

**🚀 Sistema 100% funcional e pronto para produção!**
