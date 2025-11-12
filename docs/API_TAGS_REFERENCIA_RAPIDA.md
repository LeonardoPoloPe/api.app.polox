# 🏷️ API Tags - Referência Rápida

## 🚀 **Endpoints Principais**

```bash
# CRUD Básico
GET    /api/tags                    # Listar tags
POST   /api/tags                    # Criar tag
GET    /api/tags/:id                # Buscar tag
PUT    /api/tags/:id                # Atualizar tag
DELETE /api/tags/:id                # Excluir tag

# Associações
POST   /api/tags/:id/entities       # Associar tag
DELETE /api/tags/:id/entities       # Remover tag
GET    /api/tags/entity/:type/:id   # Tags de entidade

# Operações em Lote
PUT    /api/tags/sync-entity        # Sincronizar tags
POST   /api/tags/find-or-create     # Buscar ou criar

# Estatísticas
GET    /api/tags/most-used          # Mais usadas
GET    /api/tags/stats              # Estatísticas
```

## 📋 **Exemplos Rápidos**

### Criar Tag
```json
POST /api/tags
{
  "name": "Cliente VIP",
  "color": "#9b59b6"
}
```

### Associar Tag
```json
POST /api/tags/5/entities
{
  "entity_type": "contacts",
  "entity_id": 123
}
```

### Sincronizar Tags
```json
PUT /api/tags/sync-entity
{
  "entity_type": "products", 
  "entity_id": 456,
  "tag_ids": [1, 2, 3]
}
```

## 🗄️ **Entidades Suportadas**

- `contacts` - Contatos/Leads/Clientes
- `suppliers` - Fornecedores  
- `products` - Produtos
- `sales` - Vendas
- `tickets` - Tickets
- `events` - Eventos
- `financial_transactions` - Transações

## 🎨 **Cores Recomendadas**

```javascript
{
  priority: '#e74c3c',    // Vermelho
  status: '#f39c12',      // Laranja
  type: '#9b59b6',        // Roxo
  general: '#3498db'      // Azul
}
```

## ⚠️ **Códigos de Status**

- `200` - Sucesso
- `201` - Criado
- `400` - Dados inválidos
- `404` - Não encontrado
- `409` - Já existe
- `422` - Erro de validação
- `500` - Erro interno

## 🔗 **Links Úteis**

- **📖 Documentação Completa:** [API_TAGS_GUIA_COMPLETO.md](./API_TAGS_GUIA_COMPLETO.md)
- **📊 Swagger:** `http://localhost:3000/api-docs`
- **🔍 Estrutura do Banco:** Tabela `polox.tags` + pivot tables