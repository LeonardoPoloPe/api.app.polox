# 🏷️ API de Tags - Guia Completo de Uso

**Data:** 12 de novembro de 2025  
**Versão:** 1.0  
**Status:** ✅ Implementado e Funcional

## 📋 **Índice**

1. [Visão Geral](#visão-geral)
2. [Estrutura do Banco](#estrutura-do-banco)
3. [Endpoints Disponíveis](#endpoints-disponíveis)
4. [Exemplos Práticos](#exemplos-práticos)
5. [Casos de Uso Comuns](#casos-de-uso-comuns)
6. [Tratamento de Erros](#tratamento-de-erros)
7. [Boas Práticas](#boas-práticas)

---

## 🎯 **Visão Geral**

A API de Tags permite categorizar e organizar diferentes entidades do sistema através de etiquetas personalizáveis. É um sistema flexível que suporta:

- ✅ **CRUD completo** de tags
- ✅ **Associação** com múltiplas entidades
- ✅ **Sincronização em lote**
- ✅ **Estatísticas** e analytics
- ✅ **Tags do sistema** pré-definidas
- ✅ **Multi-tenant** (isolado por empresa)

### **🔗 Entidades Suportadas:**
```
contacts              - Contatos/Leads/Clientes
suppliers             - Fornecedores
products              - Produtos
sales                 - Vendas
tickets               - Tickets de Suporte
events                - Eventos/Agendamentos
financial_transactions - Transações Financeiras
```

---

## 🗄️ **Estrutura do Banco**

### **Tabela Principal:**
```sql
polox.tags (
  id              bigserial PRIMARY KEY,
  company_id      int8 NOT NULL,           -- Isolamento por empresa
  tag_name        varchar(255) NOT NULL,   -- Nome da tag
  slug            varchar(255) NOT NULL,   -- Slug único (auto-gerado)
  color           varchar(7) DEFAULT '#3498db',
  is_active       bool DEFAULT true,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now(),
  deleted_at      timestamptz NULL         -- Soft delete
)
```

### **Tabelas de Associação:**
```sql
contact_tags                    (contato_id, tag_id)
supplier_tags                   (supplier_id, tag_id)
product_tags                    (product_id, tag_id)
sale_tags                       (sale_id, tag_id)
ticket_tags                     (ticket_id, tag_id)
event_tags                      (event_id, tag_id)
financial_transaction_tags      (financial_transaction_id, tag_id)
```

---

## 🛣️ **Endpoints Disponíveis**

### **📋 CRUD Básico**

```http
GET    /api/tags              # Listar tags com filtros e paginação
POST   /api/tags              # Criar nova tag
GET    /api/tags/:id          # Buscar tag específica
PUT    /api/tags/:id          # Atualizar tag
DELETE /api/tags/:id          # Excluir tag (soft delete)
PATCH  /api/tags/:id/toggle   # Ativar/desativar tag
```

### **🔗 Associação com Entidades**

```http
POST   /api/tags/:id/entities       # Associar tag a uma entidade
DELETE /api/tags/:id/entities       # Remover tag de uma entidade
GET    /api/tags/:id/entities       # Listar entidades que têm a tag
GET    /api/tags/entity/:type/:id   # Buscar tags de uma entidade específica
```

### **⚡ Operações em Lote**

```http
PUT    /api/tags/sync-entity        # Sincronizar todas as tags de uma entidade
POST   /api/tags/find-or-create     # Buscar ou criar tags por nomes
```

### **📊 Analytics e Utilidades**

```http
GET    /api/tags/most-used          # Tags mais utilizadas
GET    /api/tags/stats              # Estatísticas gerais
GET    /api/tags/stats/categories   # Estatísticas por categoria
GET    /api/tags/suggestions        # Sugestões baseadas em texto
POST   /api/tags/create-system-tags # Criar tags padrão do sistema
```

---

## 🚀 **Exemplos Práticos**

### **1. 📋 Listar Tags**

```bash
# Listar todas as tags
curl -X GET "http://localhost:3000/api/tags" \
  -H "Authorization: Bearer SEU_TOKEN"

# Com filtros e paginação
curl -X GET "http://localhost:3000/api/tags?search=importante&limit=10&page=1&is_active=true" \
  -H "Authorization: Bearer SEU_TOKEN"
```

**Resposta:**
```json
{
  "success": true,
  "message": "Tags listadas com sucesso",
  "data": [
    {
      "id": 1,
      "name": "Importante",
      "slug": "importante", 
      "color": "#e74c3c",
      "is_active": true,
      "usage_count": 15,
      "entity_types_count": 3,
      "created_at": "2025-11-12T10:00:00Z",
      "updated_at": "2025-11-12T10:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "totalPages": 1,
    "hasNext": false,
    "hasPrev": false
  }
}
```

### **2. ➕ Criar Tag**

```bash
curl -X POST "http://localhost:3000/api/tags" \
  -H "Authorization: Bearer SEU_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Cliente VIP",
    "color": "#9b59b6",
    "is_active": true
  }'
```

**Resposta:**
```json
{
  "success": true,
  "message": "Tag criada com sucesso",
  "data": {
    "id": 5,
    "name": "Cliente VIP",
    "slug": "cliente-vip",
    "color": "#9b59b6",
    "is_active": true,
    "created_at": "2025-11-12T15:30:00Z",
    "updated_at": "2025-11-12T15:30:00Z"
  }
}
```

### **3. 🔗 Associar Tag a um Contato**

```bash
curl -X POST "http://localhost:3000/api/tags/5/entities" \
  -H "Authorization: Bearer SEU_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "entity_type": "contacts",
    "entity_id": 123
  }'
```

**Resposta:**
```json
{
  "success": true,
  "message": "Tag associada com sucesso",
  "data": {
    "id": "5_123",
    "tag_id": 5,
    "entity_type": "contacts", 
    "entity_id": 123,
    "tagged_at": "2025-11-12T15:35:00Z",
    "tag_name": "Cliente VIP"
  }
}
```

### **4. 📊 Buscar Tags de um Contato**

```bash
curl -X GET "http://localhost:3000/api/tags/entity/contacts/123" \
  -H "Authorization: Bearer SEU_TOKEN"
```

**Resposta:**
```json
{
  "success": true,
  "message": "Tags da entidade listadas com sucesso",
  "data": [
    {
      "id": 5,
      "name": "Cliente VIP",
      "slug": "cliente-vip",
      "color": "#9b59b6",
      "tagged_at": "2025-11-12T15:35:00Z"
    },
    {
      "id": 1,
      "name": "Importante", 
      "slug": "importante",
      "color": "#e74c3c",
      "tagged_at": "2025-11-10T10:00:00Z"
    }
  ]
}
```

### **5. ⚡ Sincronizar Tags de uma Entidade**

```bash
# Substitui TODAS as tags do produto 456 pelas tags 1, 2, 3
curl -X PUT "http://localhost:3000/api/tags/sync-entity" \
  -H "Authorization: Bearer SEU_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "entity_type": "products",
    "entity_id": 456,
    "tag_ids": [1, 2, 3]
  }'
```

**Resposta:**
```json
{
  "success": true,
  "message": "Tags sincronizadas com sucesso",
  "data": {
    "removed": 1,
    "added": 3,
    "errors": []
  }
}
```

### **6. 🏭 Criar Tags do Sistema**

```bash
curl -X POST "http://localhost:3000/api/tags/create-system-tags" \
  -H "Authorization: Bearer SEU_TOKEN"
```

**Resposta:**
```json
{
  "success": true,
  "message": "Tags do sistema criadas com sucesso", 
  "data": [
    {
      "id": 10,
      "name": "Importante",
      "slug": "importante",
      "color": "#e74c3c",
      "is_active": true
    },
    {
      "id": 11,
      "name": "Urgente",
      "slug": "urgente", 
      "color": "#c0392b",
      "is_active": true
    }
    // ... mais tags padrão
  ]
}
```

### **7. 📈 Estatísticas das Tags**

```bash
curl -X GET "http://localhost:3000/api/tags/stats" \
  -H "Authorization: Bearer SEU_TOKEN"
```

**Resposta:**
```json
{
  "success": true,
  "message": "Estatísticas obtidas com sucesso",
  "data": {
    "total_tags": 25,
    "active_tags": 23,
    "system_tags": 9,
    "total_taggings": 156,
    "used_tags": 18,
    "tagged_entity_types": 5,
    "usage_percentage": "72.00"
  }
}
```

---

## 🎯 **Casos de Uso Comuns**

### **1. 🏷️ Sistema de Categorização de Produtos**

```javascript
// Criar tags para categorizar produtos
const tags = [
  { name: 'Eletrônicos', color: '#3498db' },
  { name: 'Promoção', color: '#e67e22' },
  { name: 'Novidade', color: '#27ae60' },
  { name: 'Destaque', color: '#9b59b6' }
];

// Associar múltiplas tags ao produto
await fetch('/api/tags/sync-entity', {
  method: 'PUT',
  headers: { 'Authorization': `Bearer ${token}` },
  body: JSON.stringify({
    entity_type: 'products',
    entity_id: 123,
    tag_ids: [1, 2, 3] // Eletrônicos, Promoção, Novidade
  })
});
```

### **2. 📞 Segmentação de Contatos**

```javascript
// Marcar contato como VIP e Lead Quente
await fetch('/api/tags/5/entities', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` },
  body: JSON.stringify({
    entity_type: 'contacts',
    entity_id: 789
  })
});
```

### **3. 🎫 Priorização de Tickets**

```javascript
// Buscar tickets urgentes
const urgentTags = await fetch('/api/tags/entity/tickets/456')
  .then(res => res.json());

if (urgentTags.data.some(tag => tag.name === 'Urgente')) {
  // Processar ticket com prioridade
}
```

### **4. 📊 Dashboard com Tags**

```javascript
// Buscar tags mais utilizadas para dashboard
const mostUsed = await fetch('/api/tags/most-used?limit=5')
  .then(res => res.json());

// Estatísticas para gráficos
const stats = await fetch('/api/tags/stats')
  .then(res => res.json());
```

### **5. 🔍 Sistema de Busca por Tags**

```javascript
// Buscar todos os produtos com tag "Promoção"
const productsInPromo = await fetch('/api/tags/2/entities?entity_type=products')
  .then(res => res.json());
```

---

## ⚠️ **Tratamento de Erros**

### **Códigos de Status HTTP:**

| Código | Significado | Exemplo |
|--------|-------------|---------|
| `200` | Sucesso | Operação realizada com sucesso |
| `201` | Criado | Tag criada com sucesso |
| `400` | Erro de Validação | Dados inválidos no request |
| `401` | Não Autorizado | Token inválido ou expirado |
| `404` | Não Encontrado | Tag ou entidade não existe |
| `409` | Conflito | Tag já associada à entidade |
| `422` | Entidade Não Processável | Validation error |
| `500` | Erro Interno | Erro no servidor |

### **Formato de Erro:**

```json
{
  "success": false,
  "error": "ValidationError",
  "message": "Nome da tag é obrigatório",
  "timestamp": "2025-11-12T15:30:00Z"
}
```

### **Exemplos de Erros Comuns:**

```javascript
// Tag duplicada
{
  "success": false,
  "error": "ValidationError", 
  "message": "Já existe uma tag com este nome"
}

// Entidade inválida
{
  "success": false,
  "error": "ValidationError",
  "message": "Tipo de entidade inválido. Deve ser um de: contacts, suppliers, products, sales, tickets, events, financial_transactions"
}

// Tag não encontrada
{
  "success": false,
  "error": "NotFoundError",
  "message": "Tag não encontrada"
}
```

---

## ✨ **Boas Práticas**

### **1. 🎨 Cores das Tags**

Use cores consistentes por tipo de tag:
```javascript
const tagColors = {
  priority: '#e74c3c',    // Vermelho - Prioridade
  status: '#f39c12',      // Laranja - Status  
  type: '#9b59b6',        // Roxo - Tipo/Categoria
  general: '#3498db'      // Azul - Geral
};
```

### **2. 📛 Nomenclatura**

```javascript
// ✅ Bom
const tagNames = [
  'Cliente VIP',
  'Lead Quente', 
  'Urgente',
  'Em Andamento'
];

// ❌ Evite
const badNames = [
  'tag123',
  'AAAA',
  'temp'
];
```

### **3. 🔄 Sincronização Eficiente**

```javascript
// ✅ Use sync-entity para substituir todas as tags de uma vez
await syncEntityTags(entityType, entityId, newTagIds);

// ❌ Evite múltiplas operações individuais
// await removeTag(1); await removeTag(2); await addTag(3);
```

### **4. 📊 Monitoramento de Uso**

```javascript
// Verifique periodicamente tags não utilizadas
const stats = await getTagStats();
if (stats.usage_percentage < 50) {
  console.log('Muitas tags não utilizadas - considere limpeza');
}
```

### **5. 🏷️ Limite Razoável**

```javascript
// Evite excesso de tags por entidade (máximo recomendado: 5-8)
const entityTags = await getEntityTags('contacts', 123);
if (entityTags.length > 8) {
  console.warn('Muitas tags nesta entidade');
}
```

### **6. 🔍 Busca Otimizada**

```javascript
// ✅ Use filtros específicos
const tags = await getTags({
  search: 'vip',
  is_active: true,
  limit: 10
});

// ❌ Evite buscar todas as tags sem filtros
const allTags = await getTags(); // Pode ser lento
```

---

## 🚀 **Próximos Passos**

1. **🧪 Teste a API** usando os exemplos acima
2. **📱 Integre no Frontend** para interface visual
3. **📊 Implemente Dashboard** com estatísticas
4. **🔍 Adicione Filtros** avançados por tags
5. **📧 Configure Notificações** baseadas em tags

---

## 📞 **Suporte**

- **📖 Swagger:** `http://localhost:3000/api-docs`
- **🔍 Logs:** Verifique os logs de auditoria
- **🐛 Issues:** Reporte problemas no repository

---

**✅ API de Tags totalmente funcional e documentada!**