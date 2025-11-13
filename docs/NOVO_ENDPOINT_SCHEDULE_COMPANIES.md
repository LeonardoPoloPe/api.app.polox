# 📅 Novo Endpoint Schedule por Empresa

## Resumo das Melhorias

Foi implementado um novo endpoint **GET /api/schedule/companies/{company_id}/events** que resolve os problemas identificados no endpoint original:

### 🔧 Problemas Resolvidos

1. **Company ID Obrigatório**: Agora é parâmetro de rota obrigatório
2. **Filtros de Data Obrigatórios**: `start_date` e `end_date` são obrigatórios para evitar consultas sem filtro
3. **IDs como Integers**: Todos os IDs agora retornam como números inteiros em vez de strings
4. **Contato ID Opcional**: Filtro `contato_id` disponível como query parameter opcional
5. **Estatísticas do Período**: Inclui estatísticas dos eventos no período consultado
6. **Performance Melhorada**: Consultas mais eficientes com filtros obrigatórios

## 📊 Estrutura da Resposta

```json
{
  "success": true,
  "message": "Eventos da empresa listados com sucesso",
  "data": {
    "events": [
      {
        "id": 6,
        "company_id": 25,
        "user_id": 58,
        "contato_id": 16,
        "title": "Reunião com Cliente",
        "description": "Discussão sobre o projeto Q4 2025",
        "start_datetime": "2025-11-05T14:00:00.000Z",
        "end_datetime": "2025-11-05T15:00:00.000Z",
        "timezone": "America/Sao_Paulo",
        "event_type": "meeting",
        "status": "scheduled",
        "event_location": null,
        "meeting_link": null,
        "is_all_day": false,
        "is_recurring": false,
        "recurrence_pattern": null,
        "reminder_minutes": 15,
        "created_at": "2025-11-13T15:22:49.688Z",
        "updated_at": "2025-11-13T15:22:49.688Z",
        "contact_name": "João Silva",
        "contact_type": "cliente",
        "contact_email": "joao@empresa.com",
        "contact_phone": "(11) 9999-8888",
        "organizer_name": "Leonardo Polo Pereira",
        "organizer_email": "polo@polox.com.br"
      }
    ],
    "period": {
      "start_date": "2025-11-01",
      "end_date": "2025-11-30",
      "days": 29
    },
    "stats": {
      "total_events": 1,
      "scheduled": 1,
      "confirmed": 0,
      "completed": 0,
      "cancelled": 0,
      "meetings": 1,
      "calls": 0,
      "tasks": 0
    }
  },
  "pagination": {
    "currentPage": 1,
    "totalPages": 1,
    "totalItems": 1,
    "itemsPerPage": 50,
    "hasNextPage": false,
    "hasPreviousPage": false
  },
  "timestamp": "2025-11-13T15:22:58.645Z"
}
```

## 🔧 Parâmetros

### Obrigatórios
- **company_id** (path): ID da empresa
- **start_date** (query): Data inicial (YYYY-MM-DD)
- **end_date** (query): Data final (YYYY-MM-DD)

### Opcionais
- **contato_id** (query): Filtrar por contato específico
- **event_type** (query): Filtrar por tipo (meeting, call, task, etc.)
- **status** (query): Filtrar por status (scheduled, confirmed, etc.)
- **search** (query): Buscar no título e descrição
- **sort_by** (query): Campo para ordenação
- **sort_order** (query): Direção da ordenação (ASC/DESC)
- **limit** (query): Itens por página (padrão: 50, máximo: 200)
- **offset** (query): Offset para paginação

## 🚀 Exemplos de Uso

### 1. Buscar eventos do mês atual
```bash
GET /api/v1/schedule/companies/25/events?start_date=2025-11-01&end_date=2025-11-30
```

### 2. Filtrar por contato específico
```bash
GET /api/v1/schedule/companies/25/events?start_date=2025-11-01&end_date=2025-11-30&contato_id=16
```

### 3. Buscar apenas reuniões confirmadas
```bash
GET /api/v1/schedule/companies/25/events?start_date=2025-11-01&end_date=2025-11-30&event_type=meeting&status=confirmed
```

### 4. Busca com paginação e ordenação
```bash
GET /api/v1/schedule/companies/25/events?start_date=2025-11-01&end_date=2025-11-30&limit=20&offset=0&sort_by=start_datetime&sort_order=DESC
```

## 🛡️ Validações Implementadas

1. **Acesso à Empresa**: Usuário só pode consultar eventos da própria empresa
2. **Formato de Datas**: Validação de formato ISO (YYYY-MM-DD)
3. **Intervalo de Datas**: `end_date` deve ser maior que `start_date`
4. **Limites de Paginação**: Máximo 200 itens por página
5. **Campos de Ordenação**: Apenas campos permitidos podem ser usados

## 📈 Vantagens vs Endpoint Original

| Aspecto | Endpoint Original | Novo Endpoint |
|---------|-------------------|---------------|
| Company ID | Via token (implícito) | Parâmetro obrigatório |
| Filtros de Data | Opcionais | Obrigatórios |
| Tipo de IDs | String | Integer |
| Performance | Pode ser lenta sem filtros | Otimizada |
| Estatísticas | Não incluídas | Incluídas no período |
| Contato ID | Filtro disponível | Filtro disponível |

## ⚠️ Endpoint Original

O endpoint original `/api/schedule/events` foi mantido para compatibilidade, mas:
- Incluído aviso de descontinuação na resposta
- IDs convertidos para integers
- Recomenda-se migrar para o novo endpoint

## 🔄 Migração Recomendada

Para migrar do endpoint original:

**Antes:**
```bash
GET /api/v1/schedule/events?limit=50&offset=0
```

**Depois:**
```bash
GET /api/v1/schedule/companies/25/events?start_date=2025-11-01&end_date=2025-11-30&limit=50&offset=0
```

## 📋 Próximos Passos

1. Atualizar frontend para usar novo endpoint
2. Implementar cache das estatísticas
3. Adicionar endpoint para eventos recorrentes
4. Implementar webhooks para notificações de eventos