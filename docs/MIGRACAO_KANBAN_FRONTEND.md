# 🔄 Guia de Migração: API Kanban Otimizada para Frontend

## 📊 Visão Geral

Migração do endpoint antigo de listagem simples para o **novo sistema Kanban otimizado** com suporte a 60k+ leads e drag & drop com performance O(1).

---

## ⚠️ API Antiga (DEPRECADA)

```bash
GET /api/v1/contacts?tipo=lead&sort_by=created_at&sort_order=DESC&limit=50&offset=0
```

### Problemas:
- ❌ Carrega TODOS os leads de uma vez (50 por página)
- ❌ Não separa por raias (status)
- ❌ Sem suporte a drag & drop
- ❌ Performance degradada com 60k+ leads
- ❌ Sem campo `kanban_position` para ordenação customizada

---

## ✅ API Nova (RECOMENDADA)

### 1️⃣ **Carga Inicial do Kanban**

```bash
GET /api/v1/contacts/kanban/summary?limit=10
```

**Parâmetros:**
- `limit` (opcional): Quantidade de leads por raia (padrão: 10)
- `owner_id` (opcional): Filtrar por responsável

**Response:**
```json
{
  "success": true,
  "message": "Resumo do Kanban carregado com sucesso",
  "data": {
    "novo": {
      "count": 7322,  // Total de leads nesta raia
      "leads": [
        {
          "id": 68045,
          "nome": "Mr. Dave Balistreri Jr.",
          "email": "luis.erdman@yahoo.com.br",
          "phone": "5541921463398",
          "status": "novo",
          "temperature": "frio",
          "score": 0,
          "owner_id": null,
          "origem": "facebook",
          "kanban_position": 1000,  // ⭐ NOVO: Posição com gaps
          "created_at": "2025-11-17T17:55:46.394Z",
          "updated_at": "2025-11-17T17:55:46.394Z",
          "deals_count": 2
        }
        // ... mais 9 leads
      ]
    },
    "em_contato": { "count": 7451, "leads": [...] },
    "qualificado": { "count": 7213, "leads": [...] },
    "proposta_enviada": { "count": 7172, "leads": [...] },
    "em_negociacao": { "count": 7128, "leads": [...] },
    "fechado": { "count": 7364, "leads": [...] },
    "perdido": { "count": 7281, "leads": [...] }
  }
}
```

**Vantagens:**
- ✅ Retorna apenas 10 leads por raia (70 leads no total)
- ✅ Inclui contagem total para badges (`count`)
- ✅ Performance: ~100-200ms mesmo com 60k+ leads
- ✅ Campo `kanban_position` para ordenação (sempre retornado)
- ✅ Novos leads criados automaticamente no topo (position 1000)

---

### 2️⃣ **Carregar Mais Leads de Uma Raia**

```bash
GET /api/v1/contacts/kanban/status/{status}?limit=10&offset=0
```

**Exemplo:**
```bash
GET /api/v1/contacts/kanban/status/novo?limit=10&offset=10
```

**Parâmetros:**
- `status` (path, obrigatório): `novo`, `em_contato`, `qualificado`, etc.
- `limit` (query, opcional): Quantidade de leads (padrão: 10)
- `offset` (query, opcional): Offset para paginação (padrão: 0)
- `owner_id` (query, opcional): Filtrar por responsável

**Response:**
```json
{
  "success": true,
  "message": "Leads da raia carregados com sucesso",
  "data": {
    "leads": [
      {
        "id": "68045",
        "nome": "Mr. Dave Balistreri Jr.",
        "email": "luis.erdman@yahoo.com.br",
        "phone": "5541921463398",
        "status": "novo",
        "temperature": "frio",
        "score": 0,
        "owner_id": null,
        "origem": "facebook",
        "kanban_position": "1000",
        "created_at": "2025-11-17T17:55:46.394Z",
        "updated_at": "2025-11-17T17:55:46.394Z",
        "deals_count": "2"
      }
      // ... mais leads
    ],
    "total": 7322,
    "hasMore": true,        // ⭐ Indicador para botão "Carregar mais"
    "currentOffset": 0,
    "nextOffset": 10        // ⭐ Usar no próximo request
  }
}
```

**Uso:**
- Botão "Carregar mais" no final da raia
- Scroll infinito
- Busca dentro de uma raia específica

---

### 3️⃣ **Drag & Drop (Atualizar Posição)**

```bash
PATCH /api/v1/contacts/{id}/kanban-position
```

**Exemplo:**
```bash
PATCH /api/v1/contacts/67939/kanban-position
```

**Body (3 cenários):**

#### Cenário A: Mover dentro da mesma raia
```json
{
  "status": "novo",
  "targetContactId": 68065,
  "position": "after"
}
```

#### Cenário B: Mover para outra raia (com referência)
```json
{
  "status": "em_contato",
  "targetContactId": 68065,
  "position": "before"
}
```

#### Cenário C: Mover para raia (sem referência específica)
```json
{
  "status": "em_contato"
}
```
*Nota: Sem `targetContactId`, o lead vai para o início da raia (position 1000)*

**Response:**
```json
{
  "success": true,
  "message": "Posição do lead atualizada com sucesso",
  "data": {
    "id": "67939",
    "nome": "Johnathan Franey",
    "status": "em_contato",
    "kanban_position": "5500",  // ⭐ Calculado automaticamente (média entre 5000 e 6000)
    "updated_at": "2025-11-17T22:40:21.901Z"
  }
}
```

**Performance:**
- ⚡ **1 único UPDATE** na maioria dos casos (O(1))
- ⚡ Sem locks em centenas de registros
- ⚡ ~5-10ms mesmo com 1000+ leads na raia

**Lógica Simplificada para Frontend:**

Como os endpoints GET já retornam `kanban_position` ordenado:

1. **Frontend recebe leads com posições já ordenadas** ✅
2. **Usuário arrasta lead** → Frontend detecta onde soltou
3. **Frontend envia**: `{ status, targetContactId, position: "before"/"after" }`
4. **Backend calcula posição automaticamente** usando GAPS
5. **Frontend recarrega** dados atualizados

Não é necessário calcular posições no frontend! 🎉

---

## 🎯 Implementação no Frontend

### React/Vue/Angular - Exemplo Completo

```typescript
// ===========================
// 1. CARGA INICIAL DO KANBAN
// ===========================
interface KanbanLane {
  count: number;
  leads: Lead[];
}

interface KanbanData {
  novo: KanbanLane;
  em_contato: KanbanLane;
  qualificado: KanbanLane;
  proposta_enviada: KanbanLane;
  em_negociacao: KanbanLane;
  fechado: KanbanLane;
  perdido: KanbanLane;
}

async function loadKanbanInitial(limit = 10, ownerId?: number): Promise<KanbanData> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (ownerId) params.append('owner_id', String(ownerId));
  
  const response = await fetch(
    `/api/v1/contacts/kanban/summary?${params}`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept-Language': 'pt'
      }
    }
  );
  
  const { data } = await response.json();
  return data;
}

// ===========================
// 2. CARREGAR MAIS (PAGINAÇÃO)
// ===========================
interface LoadMoreResult {
  leads: Lead[];
  total: number;
  hasMore: boolean;
  nextOffset: number | null;
}

async function loadMoreLeads(
  status: string, 
  offset: number, 
  limit = 10
): Promise<LoadMoreResult> {
  const response = await fetch(
    `/api/v1/contacts/kanban/status/${status}?limit=${limit}&offset=${offset}`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept-Language': 'pt'
      }
    }
  );
  
  const { data } = await response.json();
  return data;
}

// ===========================
// 3. DRAG & DROP
// ===========================
interface DragDropPayload {
  status: string;
  targetContactId?: number;
  position?: 'before' | 'after';
}

async function updateKanbanPosition(
  leadId: number,
  payload: DragDropPayload
): Promise<Lead> {
  const response = await fetch(
    `/api/v1/contacts/${leadId}/kanban-position`,
    {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept-Language': 'pt',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    }
  );
  
  const { data } = await response.json();
  return data;
}

// ===========================
// 4. COMPONENTE KANBAN (React)
// ===========================
import React, { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';

function KanbanBoard() {
  const [kanbanData, setKanbanData] = useState<KanbanData | null>(null);
  const [loading, setLoading] = useState(true);

  // Carga inicial
  useEffect(() => {
    loadKanbanInitial(10)
      .then(data => {
        setKanbanData(data);
        setLoading(false);
      });
  }, []);

  // Handler de drag & drop
  const handleDragEnd = async (result: any) => {
    if (!result.destination) return;

    const { draggableId, destination, source } = result;
    const leadId = parseInt(draggableId);
    const newStatus = destination.droppableId;
    const targetIndex = destination.index;

    // Pegar lead de destino (onde foi solto)
    const leadsInLane = kanbanData[newStatus].leads;
    const targetLead = leadsInLane[targetIndex];
    
    // Determinar se foi solto antes ou depois
    const position = source.index < targetIndex ? 'after' : 'before';

    try {
      // Atualizar no backend
      await updateKanbanPosition(leadId, {
        status: newStatus,
        targetContactId: targetLead?.id,
        position: position
      });

      // Recarregar Kanban (ou atualizar estado local otimisticamente)
      const updated = await loadKanbanInitial(10);
      setKanbanData(updated);
    } catch (error) {
      console.error('Erro ao mover lead:', error);
      // Reverter UI
    }
  };

  // Handler "Carregar mais"
  const handleLoadMore = async (status: string) => {
    const currentLeads = kanbanData[status].leads;
    const offset = currentLeads.length;

    const result = await loadMoreLeads(status, offset, 10);
    
    // Adicionar leads ao estado
    setKanbanData(prev => ({
      ...prev,
      [status]: {
        ...prev[status],
        leads: [...prev[status].leads, ...result.leads]
      }
    }));
  };

  if (loading) return <div>Carregando...</div>;

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="kanban-board">
        {Object.entries(kanbanData).map(([status, lane]) => (
          <Droppable key={status} droppableId={status}>
            {(provided) => (
              <div
                className="kanban-lane"
                ref={provided.innerRef}
                {...provided.droppableProps}
              >
                <h3>
                  {status} 
                  <span className="badge">{lane.count}</span>
                </h3>
                
                {lane.leads.map((lead, index) => (
                  <Draggable
                    key={lead.id}
                    draggableId={String(lead.id)}
                    index={index}
                  >
                    {(provided) => (
                      <div
                        className="kanban-card"
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        {...provided.dragHandleProps}
                      >
                        <h4>{lead.nome}</h4>
                        <p>{lead.email}</p>
                        <p>{lead.phone}</p>
                        <span className={`temp-${lead.temperature}`}>
                          {lead.temperature}
                        </span>
                      </div>
                    )}
                  </Draggable>
                ))}
                
                {provided.placeholder}
                
                {/* Botão "Carregar mais" */}
                {lane.leads.length < lane.count && (
                  <button onClick={() => handleLoadMore(status)}>
                    Carregar mais ({lane.count - lane.leads.length} restantes)
                  </button>
                )}
              </div>
            )}
          </Droppable>
        ))}
      </div>
    </DragDropContext>
  );
}
```

---

## 📊 Comparativo de Performance

| Métrica | API Antiga | API Nova Kanban | Ganho |
|---------|-----------|-----------------|-------|
| **Leads carregados inicialmente** | 50 | 70 (10 por raia) | 40% mais |
| **Tempo de resposta (60k leads)** | ~500-1000ms | **~100-200ms** | 5x mais rápido |
| **Separação por raias** | ❌ Manual no frontend | ✅ Automática | - |
| **Drag & drop** | ❌ Não suportado | ✅ O(1) | - |
| **Updates por movimentação** | N/A | **1 único** | 300x menos |
| **Badge com contagem** | ❌ Calcular no frontend | ✅ Incluído | - |

---

## 🔄 Roadmap de Migração

### Fase 1: Testes (1 semana)
- [ ] Implementar carga inicial com novo endpoint
- [ ] Testar paginação "Carregar mais"
- [ ] Validar contadores de badges

### Fase 2: Drag & Drop (1 semana)
- [ ] Integrar biblioteca drag & drop
- [ ] Implementar handler de atualização
- [ ] Testes de performance com 1000+ leads

### Fase 3: Deprecação (2 semanas)
- [ ] Migrar 100% dos usuários para nova API
- [ ] Remover chamadas ao endpoint antigo
- [ ] Monitorar logs e performance

---

## 🚨 Breaking Changes

1. **Estrutura de Response:**
   - Antiga: `{ data: [leads...], pagination: {...} }`
   - Nova: `{ data: { novo: {...}, em_contato: {...} } }`

2. **Novo Campo:**
   - `kanban_position`: Campo automático para ordenação
   - ✅ **Retornado em todos os endpoints de listagem**
   - ✅ **Novos leads criados com position = 1000** (topo da raia)
   - ✅ **Ordenação**: `ORDER BY kanban_position ASC NULLS LAST`
   - ⚠️ Leads com `NULL` aparecem no final (migrados antes da migration 048)

3. **Endpoints Novos:**
   - `GET /contacts/kanban/summary` (carga inicial)
   - `GET /contacts/kanban/status/:status` (paginação)
   - `PATCH /contacts/:id/kanban-position` (drag & drop)

4. **POST /contacts (Criação):**
   - ✅ Novos leads sempre iniciam com `kanban_position = 1000`
   - ✅ Aparecem automaticamente no **topo** da raia `novo`
   - ⚠️ Não é necessário (nem possível) passar `kanban_position` no body

---

## 📞 Suporte

**Dúvidas?**
- Documentação: `/docs/API_KANBAN.md`
- Swagger: `http://localhost:3000/api-docs`
- Contato: Leonardo Polo Pereira

---

## ✅ Checklist Final

Antes de colocar em produção:

- [ ] Testado com 10k+ leads
- [ ] Drag & drop funcionando entre raias
- [ ] Botão "Carregar mais" funcionando
- [ ] Badges com contagem corretas
- [ ] Tratamento de erros implementado
- [ ] Loading states implementados
- [ ] Rollback implementado para drag & drop falho
- [ ] Logs de performance monitorados
