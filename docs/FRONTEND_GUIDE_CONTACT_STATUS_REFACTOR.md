# 🚀 GUIA FRONTEND - REFATORAÇÃO DE STATUS DE CONTATOS

**Data**: 21 de novembro de 2025  
**Migration**: 050  
**Impacto**: Módulo de Contatos (Leads + Clientes)

---

## 📋 RESUMO EXECUTIVO

Esta refatoração separa **TRIAGEM** (Contact) de **NEGOCIAÇÃO** (Deal), seguindo a arquitetura "Identidade vs. Intenção".

### O QUE MUDOU:
- ❌ **REMOVIDOS**: 3 status de negociação (`proposta_enviada`, `em_negociacao`, `fechado`)
- ✅ **MANTIDOS**: 3 status de triagem (`novo`, `em_contato`, `qualificado`)
- 🆕 **ADICIONADOS**: 2 status finais (`perdido`, `descartado`)
- 🆕 **NOVO CAMPO**: `loss_reason` (obrigatório para status perdido/descartado)

---

## 🎯 NOVA ARQUITETURA

```
┌─────────────────────────────────────────────────────────────┐
│                    CONTACT (Identidade)                     │
│                         QUEM é                              │
├─────────────────────────────────────────────────────────────┤
│  Status de TRIAGEM (5 opções):                             │
│  1. novo          → Lead não contatado                     │
│  2. em_contato    → Em processo de qualificação            │
│  3. qualificado   → Pronto para negociação                 │
│  4. perdido       → Oportunidade perdida (+ motivo)        │
│  5. descartado    → Lead descartado (+ motivo)             │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                     DEAL (Intenção)                         │
│                     O QUE quer                              │
├─────────────────────────────────────────────────────────────┤
│  Status de NEGOCIAÇÃO:                                      │
│  • proposta → negociacao → ganho/perdido                   │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔄 STATUS - ANTES vs DEPOIS

### ❌ ANTES (8 status - DELETAR)
```javascript
const OLD_STATUS = [
  "novo",
  "em_contato",
  "qualificado",
  "proposta_enviada",  // ❌ REMOVER
  "em_negociacao",     // ❌ REMOVER
  "fechado",           // ❌ REMOVER
  "perdido",
];
```

### ✅ DEPOIS (5 status - USAR)
```javascript
const NEW_STATUS = [
  "novo",              // ✅ Mantido
  "em_contato",        // ✅ Mantido
  "qualificado",       // ✅ Mantido
  "perdido",           // ✅ Mantido
  "descartado",        // 🆕 Novo
];
```

---

## 🆕 NOVO CAMPO: `loss_reason`

### Especificações:
- **Tipo**: `string` (TEXT no banco)
- **Nullable**: `true`
- **Obrigatório**: SIM, quando `status` = `"perdido"` ou `"descartado"`
- **Opcional**: Para outros status
- **Min Length**: 3 caracteres
- **Descrição**: Motivo pelo qual o lead foi perdido ou descartado

### Exemplos de valores:
```javascript
const LOSS_REASON_EXAMPLES = [
  "Sem budget no momento",
  "Optou por concorrente",
  "Não tem interesse no produto",
  "Não respondeu aos contatos",
  "Fora do perfil ideal",
  "Timing inadequado",
  "Preço acima do esperado",
  "Lead duplicado",
];
```

---

## 📡 ENDPOINTS AFETADOS

### 1. POST `/api/contacts` - Criar Contato

#### TypeScript Interface:
```typescript
interface CreateContactDTO {
  nome: string;                    // Obrigatório
  email?: string;                  // Opcional
  phone?: string;                  // Opcional
  document?: string;               // Opcional
  tipo?: "lead" | "cliente";       // Default: "lead"
  
  // ⚠️ MUDANÇA AQUI
  status?: "novo" | "em_contato" | "qualificado" | "perdido" | "descartado";
  loss_reason?: string;            // 🆕 OBRIGATÓRIO se status = perdido/descartado
  
  origem?: string;
  tags?: string[];
  interests?: number[];
  owner_id?: number;
  temperature?: "frio" | "morno" | "quente";
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  metadata?: object;
}
```

#### Exemplo de Request:
```javascript
// ✅ CORRETO - Lead perdido COM motivo
const response = await fetch('/api/contacts', {
  method: 'POST',
  headers: { 
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    'Accept-Language': 'pt'
  },
  body: JSON.stringify({
    nome: "João Silva",
    email: "joao@example.com",
    phone: "5511999999999",
    status: "perdido",
    loss_reason: "Cliente sem budget no momento" // ✅ Obrigatório
  })
});

// ❌ ERRO - Lead perdido SEM motivo
const response = await fetch('/api/contacts', {
  method: 'POST',
  body: JSON.stringify({
    nome: "João Silva",
    status: "perdido"
    // ❌ Faltou loss_reason = erro 400
  })
});
```

---

### 2. PUT `/api/contacts/:id` - Atualizar Contato

#### TypeScript Interface:
```typescript
interface UpdateContactDTO {
  nome?: string;
  email?: string;
  phone?: string;
  document?: string;
  tipo?: "lead" | "cliente";
  
  // ⚠️ MUDANÇA AQUI
  status?: "novo" | "em_contato" | "qualificado" | "perdido" | "descartado";
  loss_reason?: string;            // 🆕 OBRIGATÓRIO se status = perdido/descartado
  
  origem?: string;
  tags?: string[];
  interests?: number[];
  owner_id?: number;
  lifetime_value_cents?: number;
  temperature?: "frio" | "morno" | "quente";
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  metadata?: object;
}
```

#### Exemplo de Request:
```javascript
const response = await fetch(`/api/contacts/${contactId}`, {
  method: 'PUT',
  headers: { 
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    status: "descartado",
    loss_reason: "Lead duplicado, não tem interesse" // ✅ Obrigatório
  })
});
```

---

### 3. PATCH `/api/contacts/:id/status` - Atualizar Apenas Status

#### TypeScript Interface:
```typescript
interface UpdateStatusDTO {
  status: "novo" | "em_contato" | "qualificado" | "perdido" | "descartado";
  loss_reason?: string;  // 🆕 OBRIGATÓRIO se status = perdido/descartado
}
```

#### Exemplo de Request:
```javascript
// Movendo para "qualificado" (sem loss_reason)
await fetch(`/api/contacts/${id}/status`, {
  method: 'PATCH',
  headers: { 
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    status: "qualificado"
    // loss_reason não é necessário aqui
  })
});

// Movendo para "perdido" (COM loss_reason)
await fetch(`/api/contacts/${id}/status`, {
  method: 'PATCH',
  headers: { 
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    status: "perdido",
    loss_reason: "Cliente optou por concorrente" // ✅ Obrigatório
  })
});
```

---

### 4. GET `/api/contacts/kanban/summary` - Kanban Summary

#### Response TypeScript Interface:
```typescript
interface KanbanSummaryResponse {
  success: boolean;
  data: {
    novo: {
      total: number;
      leads: ContactKanban[];
    };
    em_contato: {
      total: number;
      leads: ContactKanban[];
    };
    qualificado: {
      total: number;
      leads: ContactKanban[];
    };
    perdido: {
      total: number;
      leads: ContactKanban[];
    };
    descartado: {     // 🆕 Nova coluna
      total: number;
      leads: ContactKanban[];
    };
  };
}

interface ContactKanban {
  id: number;
  nome: string;
  email: string;
  phone: string;
  status: "novo" | "em_contato" | "qualificado" | "perdido" | "descartado";
  loss_reason: string | null;  // 🆕 Novo campo
  temperature: "frio" | "morno" | "quente";
  score: number;
  kanban_position: number;
}
```

---

## ⚠️ VALIDAÇÕES E ERROS

### Erro quando falta `loss_reason`:
```json
// Status Code: 400
{
  "success": false,
  "message": "Motivo de perda/descarte é obrigatório",
  "errors": [
    {
      "field": "loss_reason",
      "message": "Motivo de perda/descarte é obrigatório"
    }
  ]
}
```

### Erro quando status inválido:
```json
// Status Code: 400
{
  "success": false,
  "message": "Status inválido",
  "errors": [
    {
      "field": "status",
      "message": "Status deve ser: novo, em_contato, qualificado, perdido ou descartado"
    }
  ]
}
```

---

## 🎨 IMPLEMENTAÇÃO NO REACT

### 1. Atualizar Dropdown de Status

```jsx
// src/components/ContactForm/StatusSelect.jsx

const STATUS_OPTIONS = [
  { 
    value: "novo", 
    label: "🆕 Novo", 
    color: "#6c757d",
    description: "Lead não contatado"
  },
  { 
    value: "em_contato", 
    label: "📞 Em Contato", 
    color: "#0dcaf0",
    description: "Em processo de qualificação"
  },
  { 
    value: "qualificado", 
    label: "✅ Qualificado", 
    color: "#198754",
    description: "Pronto para negociação"
  },
  { 
    value: "perdido", 
    label: "❌ Perdido", 
    color: "#dc3545",
    description: "Oportunidade perdida"
  },
  { 
    value: "descartado", 
    label: "🗑️ Descartado", 
    color: "#6c757d",
    description: "Lead descartado"
  },
];

export const StatusSelect = ({ value, onChange }) => {
  return (
    <select 
      className="form-select" 
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {STATUS_OPTIONS.map(option => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
};
```

---

### 2. Campo Condicional de `loss_reason`

```jsx
// src/components/ContactForm/ContactForm.jsx

import React, { useState, useEffect } from 'react';

export const ContactForm = ({ initialData, onSubmit }) => {
  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    phone: '',
    status: 'novo',
    loss_reason: '',
    ...initialData
  });

  const [showLossReason, setShowLossReason] = useState(false);

  // Controlar visibilidade do campo loss_reason
  useEffect(() => {
    const needsReason = ['perdido', 'descartado'].includes(formData.status);
    setShowLossReason(needsReason);
    
    // Limpar loss_reason se status mudou para algo que não precisa
    if (!needsReason) {
      setFormData(prev => ({ ...prev, loss_reason: '' }));
    }
  }, [formData.status]);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Validação
    if (['perdido', 'descartado'].includes(formData.status)) {
      if (!formData.loss_reason || formData.loss_reason.trim().length < 3) {
        alert('Motivo de perda/descarte é obrigatório (mínimo 3 caracteres)');
        return;
      }
    }
    
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Nome */}
      <div className="form-group mb-3">
        <label htmlFor="nome">Nome *</label>
        <input
          type="text"
          id="nome"
          className="form-control"
          value={formData.nome}
          onChange={(e) => handleChange('nome', e.target.value)}
          required
        />
      </div>

      {/* Email */}
      <div className="form-group mb-3">
        <label htmlFor="email">Email</label>
        <input
          type="email"
          id="email"
          className="form-control"
          value={formData.email}
          onChange={(e) => handleChange('email', e.target.value)}
        />
      </div>

      {/* Phone */}
      <div className="form-group mb-3">
        <label htmlFor="phone">Telefone</label>
        <input
          type="tel"
          id="phone"
          className="form-control"
          value={formData.phone}
          onChange={(e) => handleChange('phone', e.target.value)}
        />
      </div>

      {/* Status */}
      <div className="form-group mb-3">
        <label htmlFor="status">Status *</label>
        <StatusSelect 
          value={formData.status}
          onChange={(value) => handleChange('status', value)}
        />
      </div>

      {/* 🆕 Loss Reason (Condicional) */}
      {showLossReason && (
        <div className="form-group mb-3">
          <label htmlFor="loss_reason">
            Motivo de Perda/Descarte <span className="text-danger">*</span>
          </label>
          <textarea
            id="loss_reason"
            className="form-control"
            rows={3}
            value={formData.loss_reason}
            onChange={(e) => handleChange('loss_reason', e.target.value)}
            placeholder="Ex: Cliente sem budget no momento"
            required
          />
          <small className="form-text text-muted">
            Obrigatório explicar por que o lead foi perdido ou descartado
          </small>
        </div>
      )}

      <button type="submit" className="btn btn-primary">
        Salvar
      </button>
    </form>
  );
};
```

---

### 3. Dropdown com Opções Pré-definidas

```jsx
// src/components/ContactForm/LossReasonSelect.jsx

const LOSS_REASON_PRESETS = [
  "Sem budget no momento",
  "Optou por concorrente",
  "Não tem interesse no produto",
  "Não respondeu aos contatos",
  "Fora do perfil ideal",
  "Timing inadequado",
  "Preço acima do esperado",
  "Lead duplicado",
  "Outro (especificar)"
];

export const LossReasonField = ({ value, onChange }) => {
  const [customReason, setCustomReason] = useState('');
  const [selectedPreset, setSelectedPreset] = useState('');

  const handlePresetChange = (preset) => {
    setSelectedPreset(preset);
    if (preset === "Outro (especificar)") {
      onChange(customReason);
    } else {
      onChange(preset);
    }
  };

  const handleCustomChange = (text) => {
    setCustomReason(text);
    onChange(text);
  };

  return (
    <div>
      {/* Dropdown de opções pré-definidas */}
      <select 
        className="form-select mb-2"
        value={selectedPreset}
        onChange={(e) => handlePresetChange(e.target.value)}
      >
        <option value="">Selecione um motivo...</option>
        {LOSS_REASON_PRESETS.map(preset => (
          <option key={preset} value={preset}>
            {preset}
          </option>
        ))}
      </select>

      {/* Campo de texto customizado */}
      {(selectedPreset === "Outro (especificar)" || !selectedPreset) && (
        <textarea
          className="form-control"
          rows={3}
          value={value}
          onChange={(e) => handleCustomChange(e.target.value)}
          placeholder="Descreva o motivo..."
        />
      )}
    </div>
  );
};
```

---

### 4. Kanban Board - Atualizar Colunas

```jsx
// src/components/Kanban/KanbanBoard.jsx

const KANBAN_COLUMNS = [
  { 
    id: "novo", 
    title: "🆕 Novos", 
    color: "#6c757d",
    bgColor: "#f8f9fa",
    description: "Leads não contatados"
  },
  { 
    id: "em_contato", 
    title: "📞 Em Contato", 
    color: "#0dcaf0",
    bgColor: "#cff4fc",
    description: "Em qualificação"
  },
  { 
    id: "qualificado", 
    title: "✅ Qualificados", 
    color: "#198754",
    bgColor: "#d1e7dd",
    description: "Prontos para negociação"
  },
  { 
    id: "perdido", 
    title: "❌ Perdidos", 
    color: "#dc3545",
    bgColor: "#f8d7da",
    description: "Oportunidades perdidas"
  },
  { 
    id: "descartado", 
    title: "🗑️ Descartados", 
    color: "#6c757d",
    bgColor: "#e2e3e5",
    description: "Leads descartados"
  },
];

export const KanbanBoard = () => {
  const [kanbanData, setKanbanData] = useState({});
  
  useEffect(() => {
    fetchKanbanData();
  }, []);
  
  const fetchKanbanData = async () => {
    const response = await fetch('/api/contacts/kanban/summary', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const result = await response.json();
    setKanbanData(result.data);
  };

  return (
    <div className="kanban-board">
      {KANBAN_COLUMNS.map(column => (
        <KanbanColumn
          key={column.id}
          column={column}
          leads={kanbanData[column.id]?.leads || []}
          total={kanbanData[column.id]?.total || 0}
          onDrop={(leadId, position) => handleDrop(leadId, column.id, position)}
        />
      ))}
    </div>
  );
};
```

---

### 5. Kanban Card - Exibir `loss_reason`

```jsx
// src/components/Kanban/KanbanCard.jsx

export const KanbanCard = ({ contact, onEdit, onDelete }) => {
  const temperatureColors = {
    frio: '#6c757d',
    morno: '#ffc107',
    quente: '#dc3545'
  };

  return (
    <div className="kanban-card" draggable>
      <div className="card-header">
        <h5>{contact.nome}</h5>
        <span 
          className="badge" 
          style={{ backgroundColor: temperatureColors[contact.temperature] }}
        >
          {contact.temperature}
        </span>
      </div>

      <div className="card-body">
        {contact.email && <p>📧 {contact.email}</p>}
        {contact.phone && <p>📱 {contact.phone}</p>}
        
        {/* 🆕 Exibir loss_reason se existir */}
        {contact.loss_reason && (
          <div className="alert alert-warning mt-2" style={{ fontSize: '0.85rem' }}>
            <strong>Motivo:</strong> {contact.loss_reason}
          </div>
        )}
      </div>

      <div className="card-footer">
        <button 
          className="btn btn-sm btn-outline-primary"
          onClick={() => onEdit(contact.id)}
        >
          Editar
        </button>
      </div>
    </div>
  );
};
```

---

### 6. Modal de Confirmação para Drag & Drop

```jsx
// src/components/Kanban/LossReasonModal.jsx

export const LossReasonModal = ({ show, status, onConfirm, onCancel }) => {
  const [reason, setReason] = useState('');
  
  const title = status === 'perdido' ? 'Lead Perdido' : 'Lead Descartado';
  const variant = status === 'perdido' ? 'danger' : 'secondary';

  const handleConfirm = () => {
    if (!reason || reason.trim().length < 3) {
      alert('Motivo deve ter no mínimo 3 caracteres');
      return;
    }
    onConfirm(reason);
  };

  return (
    <Modal show={show} onHide={onCancel} centered>
      <Modal.Header closeButton>
        <Modal.Title>{title}</Modal.Title>
      </Modal.Header>
      
      <Modal.Body>
        <p className="mb-3">
          Por favor, explique o motivo da {status === 'perdido' ? 'perda' : 'descarte'}:
        </p>
        
        <LossReasonField 
          value={reason}
          onChange={setReason}
        />
      </Modal.Body>
      
      <Modal.Footer>
        <Button variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button 
          variant={variant}
          onClick={handleConfirm}
          disabled={!reason || reason.trim().length < 3}
        >
          Confirmar {status === 'perdido' ? 'Perda' : 'Descarte'}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};
```

---

### 7. Hook para Drag & Drop no Kanban

```javascript
// src/hooks/useKanbanDragDrop.js

export const useKanbanDragDrop = () => {
  const [modalOpen, setModalOpen] = useState(false);
  const [pendingMove, setPendingMove] = useState(null);

  const handleDragEnd = async (result) => {
    const { destination, draggableId } = result;
    
    if (!destination) return;
    
    const newStatus = destination.droppableId;
    const contactId = parseInt(draggableId);
    
    // Se moveu para perdido ou descartado, abrir modal
    if (newStatus === "perdido" || newStatus === "descartado") {
      setPendingMove({ contactId, newStatus });
      setModalOpen(true);
      return;
    }
    
    // Caso contrário, atualizar diretamente (sem loss_reason)
    await updateContactStatus(contactId, newStatus, null);
  };

  const handleModalConfirm = async (lossReason) => {
    if (!pendingMove) return;
    
    await updateContactStatus(
      pendingMove.contactId, 
      pendingMove.newStatus, 
      lossReason
    );
    
    setModalOpen(false);
    setPendingMove(null);
  };

  const handleModalCancel = () => {
    setModalOpen(false);
    setPendingMove(null);
  };

  const updateContactStatus = async (contactId, status, lossReason) => {
    try {
      const response = await fetch(`/api/contacts/${contactId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          status,
          loss_reason: lossReason
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message);
      }

      // Recarregar dados do kanban
      window.location.reload(); // ou use seu sistema de state management
      
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      alert(`Erro: ${error.message}`);
    }
  };

  return {
    handleDragEnd,
    modalOpen,
    pendingMove,
    handleModalConfirm,
    handleModalCancel
  };
};
```

---

## 📊 MIGRAÇÃO DE DADOS ANTIGOS

### O Backend já fez automaticamente:

A Migration 050 já converteu os dados antigos:
- `proposta_enviada` → `qualificado`
- `em_negociacao` → `qualificado`
- `fechado` → `qualificado`

### O que fazer no Frontend:

1. **Limpar cache/localStorage** de status antigos:
```javascript
// Executar uma vez após deploy
const cleanupOldStatus = () => {
  const oldStatuses = ['proposta_enviada', 'em_negociacao', 'fechado'];
  
  // Limpar do localStorage se houver
  const cachedData = localStorage.getItem('contacts');
  if (cachedData) {
    try {
      const contacts = JSON.parse(cachedData);
      const cleaned = contacts.map(contact => {
        if (oldStatuses.includes(contact.status)) {
          return { ...contact, status: 'qualificado' };
        }
        return contact;
      });
      localStorage.setItem('contacts', JSON.stringify(cleaned));
    } catch (e) {
      console.error('Erro ao limpar cache:', e);
    }
  }
};

// Executar no useEffect do componente principal
useEffect(() => {
  cleanupOldStatus();
}, []);
```

---

## ✅ CHECKLIST COMPLETO

### 📝 Formulários:
- [ ] Atualizar dropdown de status (remover 3, adicionar 1)
- [ ] Adicionar campo `loss_reason` (condicional)
- [ ] Implementar validação de `loss_reason` obrigatório
- [ ] Adicionar opções pré-definidas de motivos
- [ ] Testar criar lead com status "perdido" sem motivo (deve dar erro)
- [ ] Testar criar lead com status "qualificado" (não precisa motivo)

### 📊 Kanban:
- [ ] Atualizar colunas (remover 3, adicionar 1)
- [ ] Atualizar cores das colunas
- [ ] Exibir `loss_reason` nos cards (se existir)
- [ ] Implementar modal de confirmação ao arrastar para "Perdido"
- [ ] Implementar modal de confirmação ao arrastar para "Descartado"
- [ ] Testar drag & drop para todas as colunas
- [ ] Testar cancelamento do modal

### 🔄 Listagens:
- [ ] Atualizar filtros de status
- [ ] Exibir badge de `loss_reason` nas tabelas
- [ ] Atualizar exports CSV/Excel com novo campo

### 🎨 Estilização:
- [ ] Definir cores para novos status
- [ ] Criar ícones para "Descartado"
- [ ] Ajustar responsividade do modal

### 🧪 Testes:
- [ ] Testar criação com todos os status
- [ ] Testar atualização de status
- [ ] Testar validação de `loss_reason`
- [ ] Testar drag & drop no Kanban
- [ ] Testar compatibilidade com dados antigos

### 🚀 Deploy:
- [ ] Limpar cache/localStorage
- [ ] Atualizar documentação interna
- [ ] Notificar usuários sobre mudanças
- [ ] Monitorar erros de validação

---

## 🐛 TROUBLESHOOTING

### Erro: "Motivo de perda/descarte é obrigatório"
**Causa**: Frontend enviou `status = "perdido"` sem `loss_reason`  
**Solução**: Garantir que o campo `loss_reason` seja preenchido antes de enviar

### Erro: "Status inválido"
**Causa**: Frontend enviou status antigo (`proposta_enviada`, etc)  
**Solução**: Atualizar dropdowns e remover opções antigas

### Lead não aparece no Kanban
**Causa**: Status do lead pode estar com valor antigo  
**Solução**: Recarregar dados da API, não usar cache

---

## 📞 SUPORTE

Para dúvidas ou problemas:
1. Revisar este documento
2. Verificar logs do console (Network tab)
3. Testar endpoints no Postman/Insomnia
4. Contatar o time de backend

---

**Última atualização**: 21/11/2025  
**Versão da API**: Migration 050  
**Autor**: Leonardo Polo Pereira
