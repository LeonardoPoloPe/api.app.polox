# 🔄 Endpoint PUT /users/{id}

## 📋 Descrição

Endpoint para atualizar usuários completamente por administradores (Company Admin ou Super Admin).

## 🎯 Rota

```
PUT /api/v1/users/{id}
```

## 🔐 Autenticação

- **Obrigatória**: Sim (Bearer Token)
- **Permissão necessária**: Company Admin ou Super Admin

## 📥 Request Body (Todos os campos são opcionais)

```json
{
  "name": "Maria Silva",
  "email": "maria.silva@exemplo.com",
  "role": "manager",
  "company_id": 1,
  "status": "active"
}
```

### Campos Disponíveis:

- **name** (string): Nome completo do usuário (2-255 caracteres)
- **email** (string): Email válido do usuário
- **role** (string): Papel do usuário
  - Valores: `super_admin`, `company_admin`, `manager`, `user`
- **company_id** (integer): ID da empresa do usuário
- **status** (string): Status do usuário
  - Valores: `active`, `inactive`, `suspended`

## 📤 Response (200 OK)

```json
{
  "success": true,
  "message": "Usuário atualizado com sucesso",
  "data": {
    "user": {
      "id": 5,
      "name": "Maria Silva",
      "email": "maria.silva@exemplo.com",
      "role": "manager",
      "companyId": 1,
      "createdAt": "2025-01-15T10:00:00.000Z",
      "updatedAt": "2025-11-05T20:30:00.000Z"
    }
  }
}
```

## 🚨 Possíveis Erros

### 400 - Bad Request

```json
{
  "success": false,
  "message": "Nenhum campo para atualizar",
  "code": "BAD_REQUEST"
}
```

### 404 - Not Found

```json
{
  "success": false,
  "message": "Usuário não encontrado",
  "code": "NOT_FOUND"
}
```

### 409 - Conflict

```json
{
  "success": false,
  "message": "Email já está em uso",
  "code": "CONFLICT"
}
```

## 💻 Exemplos de Curl

### 1. Atualizar nome e email

```bash
curl -X PUT \
  'http://localhost:3000/api/v1/users/5' \
  -H 'Authorization: Bearer SEU_TOKEN' \
  -H 'Accept-Language: pt' \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Maria Silva Santos",
    "email": "maria.santos@exemplo.com"
  }'
```

### 2. Promover usuário a manager

```bash
curl -X PUT \
  'http://localhost:3000/api/v1/users/5' \
  -H 'Authorization: Bearer SEU_TOKEN' \
  -H 'Accept-Language: pt' \
  -H 'Content-Type: application/json' \
  -d '{
    "role": "manager"
  }'
```

### 3. Atualizar múltiplos campos

```bash
curl -X PUT \
  'http://localhost:3000/api/v1/users/5' \
  -H 'Authorization: Bearer SEU_TOKEN' \
  -H 'Accept-Language: pt' \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Maria Silva Santos",
    "email": "maria.santos@exemplo.com",
    "role": "manager",
    "company_id": 2,
    "status": "active"
  }'
```

### 4. Suspender usuário

```bash
curl -X PUT \
  'http://localhost:3000/api/v1/users/5' \
  -H 'Authorization: Bearer SEU_TOKEN' \
  -H 'Accept-Language: pt' \
  -H 'Content-Type: application/json' \
  -d '{
    "status": "suspended"
  }'
```

### 5. Transferir usuário para outra empresa

```bash
curl -X PUT \
  'http://localhost:3000/api/v1/users/5' \
  -H 'Authorization: Bearer SEU_TOKEN' \
  -H 'Accept-Language: pt' \
  -H 'Content-Type: application/json' \
  -d '{
    "company_id": 3
  }'
```

## 🔍 Diferenças entre endpoints

### PUT /users/{id} (Novo - Admin)

- **Quem pode usar**: Company Admin ou Super Admin
- **O que pode editar**: Qualquer usuário da empresa (ou todas as empresas se Super Admin)
- **Campos editáveis**: name, email, role, company_id, status
- **Auditoria**: Registra que foi alterado por administrador

### PUT /users/profile (Existente - Próprio usuário)

- **Quem pode usar**: Qualquer usuário autenticado
- **O que pode editar**: Apenas seu próprio perfil
- **Campos editáveis**: name, email
- **Auditoria**: Registra que foi alterado pelo próprio usuário

## 📊 Log de Auditoria

Todas as alterações são registradas no log de auditoria com:

- ID do administrador que fez a alteração
- ID do usuário alterado
- Campos alterados
- IP da requisição
- Timestamp

## ✅ Resumo de Endpoints de Usuário

| Método  | Endpoint                     | Descrição                     | Permissão   |
| ------- | ---------------------------- | ----------------------------- | ----------- |
| GET     | `/users`                     | Listar usuários               | Autenticado |
| POST    | `/users`                     | Criar novo usuário            | Admin       |
| GET     | `/users/profile`             | Obter perfil próprio          | Autenticado |
| PUT     | `/users/profile`             | Atualizar perfil próprio      | Autenticado |
| GET     | `/users/{id}`                | Obter usuário por ID          | Autenticado |
| **PUT** | **/users/{id}**              | **Atualizar usuário (Novo!)** | **Admin**   |
| PUT     | `/users/{id}/reset-password` | Resetar senha                 | Admin       |
| PUT     | `/users/change-password`     | Alterar própria senha         | Autenticado |
