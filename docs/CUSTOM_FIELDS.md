# 📋 Sistema de Campos Customizados (EAV)

**Data:** 23 de outubro de 2025  
**Status:** ✅ Implementado  
**Versão:** 1.0

---

## 📚 Índice

1. [Visão Geral](#1-visão-geral)
2. [Arquitetura EAV](#2-arquitetura-eav)
3. [Estrutura do Banco de Dados](#3-estrutura-do-banco-de-dados)
4. [Models da Aplicação](#4-models-da-aplicação)
5. [Guia Prático de Implementação](#5-guia-prático-de-implementação)
6. [Fluxos de Dados (CRUD)](#6-fluxos-de-dados-crud)
7. [Segurança e Validações](#7-segurança-e-validações)
8. [Exemplos de Código](#8-exemplos-de-código)
9. [Troubleshooting](#9-troubleshooting)

---

## 1. Visão Geral

### 🎯 O que são Campos Customizados?

O Sistema de Campos Customizados permite que **usuários administradores** de uma empresa adicionem campos de dados personalizados a entidades do sistema (como `Leads`, `Clients`, `Products`, etc.) **sem a necessidade de alterar o esquema do banco de dados**.

### 💡 Casos de Uso Reais

| Entidade | Campo Customizado | Tipo | Exemplo de Valor |
|----------|-------------------|------|------------------|
| **Leads** | Orçamento Disponível | `numeric` | `50000.00` |
| **Leads** | Nível de Interesse | `options` | `["Alto", "Médio", "Baixo"]` |
| **Clients** | Data da Próxima Visita | `date` | `2025-11-15 14:30:00` |
| **Tickets** | Prioridade | `options` | `["Urgente", "Alta", "Normal", "Baixa"]` |
| **Products** | Link da Documentação | `url` | `https://docs.produto.com` |
| **Events** | Aceita Certificado? | `checkbox` | `true` |

### ✨ Benefícios

- ✅ **Flexibilidade Total**: Empresas adaptam o sistema às suas necessidades
- ✅ **Sem Deploy**: Não requer alteração de código ou migrations
- ✅ **Multi-tenant**: Cada empresa tem seus próprios campos
- ✅ **Polimórfico**: Um único sistema serve todas as entidades
- ✅ **Tipagem Forte**: 7 tipos de campos suportados
- ✅ **Performance**: Colunas tipadas (não JSONB genérico)

---

## 2. Arquitetura EAV

### 🏗️ O que é EAV?

**EAV (Entity-Attribute-Value)** é um padrão de design de banco de dados que permite armazenar dados com estrutura dinâmica.

```
┌─────────────────┐
│  Entity (E)     │  ← A "coisa" que está sendo estendida
│  (Lead ID 123)  │     Exemplo: Um Lead específico
└─────────────────┘
         │
         ▼
┌─────────────────┐
│ Attribute (A)   │  ← A definição do campo
│ "Orçamento"     │     Exemplo: Nome, Tipo, Obrigatório?
│ Type: numeric   │
└─────────────────┘
         │
         ▼
┌─────────────────┐
│   Value (V)     │  ← O dado real preenchido
│    50000.00     │     Exemplo: O valor numérico
└─────────────────┘
```

### 📊 Componentes do Sistema

| Componente | Tabela | Model | Descrição |
|------------|--------|-------|-----------|
| **Attribute** | `polox.custom_fields` | `CustomField.js` | Definição do campo |
| **Value** | `polox.custom_field_values` | `CustomFieldValue.js` | Valor preenchido |
| **Entity** | `polox.leads`, `polox.clients`, etc. | `Lead.js`, `Client.js`, etc. | A entidade estendida |

---

## 3. Estrutura do Banco de Dados

### 🗄️ Tabela 1: `polox.custom_fields` (O "Atributo")

**Propósito**: Armazena a **definição** dos campos customizados.

#### Estrutura

```sql
CREATE TABLE polox.custom_fields (
  id bigserial PRIMARY KEY,
  
  -- Multi-tenant
  company_id int8 NULL,  -- NULL = Campo Global
  
  -- Polimorfismo
  entity_type varchar(50) NOT NULL,  -- 'lead', 'client', 'product', etc.
  
  -- Metadados do Campo
  name varchar(100) NOT NULL,  -- "Orçamento", "Prioridade"
  field_type varchar(50) NOT NULL,  -- Ver tipos abaixo
  options jsonb NULL,  -- Apenas para type='options'
  is_required bool DEFAULT false,
  sort_order int4 DEFAULT 0,
  
  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Constraints
  CONSTRAINT fk_custom_fields_company 
    FOREIGN KEY (company_id) REFERENCES polox.companies(id) ON DELETE CASCADE,
  CONSTRAINT custom_fields_company_entity_name_key 
    UNIQUE (company_id, entity_type, name)
);
```

#### Tipos de Campos (`field_type`)

| Tipo | Descrição | Exemplo | Coluna de Valor |
|------|-----------|---------|-----------------|
| `text` | Linha única | `"João Silva"` | `text_value` |
| `textarea` | Múltiplas linhas | `"Observações longas..."` | `text_value` |
| `numeric` | Números (15,2) | `50000.00` | `numeric_value` |
| `url` | URLs | `"https://site.com"` | `text_value` |
| `options` | Dropdown | `"Alto"` (de `["Alto", "Médio", "Baixo"]`) | `text_value` |
| `date` | Data/Hora | `2025-11-15 14:30:00` | `date_value` |
| `checkbox` | Booleano | `true` | `boolean_value` |

#### Entidades Suportadas (`entity_type`)

```javascript
['lead', 'client', 'product', 'sale', 'ticket', 'event', 'supplier', 'financial_transaction']
```

#### Índices

```sql
CREATE INDEX idx_custom_fields_company_entity ON polox.custom_fields(company_id, entity_type);
CREATE INDEX idx_custom_fields_entity_type ON polox.custom_fields(entity_type);
```

---

### 🗄️ Tabela 2: `polox.custom_field_values` (O "Valor")

**Propósito**: Armazena os **valores** preenchidos pelos usuários.

#### Estrutura

```sql
CREATE TABLE polox.custom_field_values (
  id bigserial PRIMARY KEY,
  
  -- Relações
  custom_field_id int8 NOT NULL,  -- FK para custom_fields
  entity_id int8 NOT NULL,  -- ID polimórfico (lead_id, client_id, etc.)
  
  -- Colunas de Valor Tipadas (apenas UMA será preenchida)
  text_value text NULL,
  numeric_value numeric(15, 2) NULL,
  date_value timestamptz NULL,
  boolean_value bool NULL,
  
  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Constraints
  CONSTRAINT fk_custom_field_values_field 
    FOREIGN KEY (custom_field_id) REFERENCES polox.custom_fields(id) ON DELETE CASCADE,
  CONSTRAINT custom_field_values_entity_field_key 
    UNIQUE (custom_field_id, entity_id)  -- Permite UPSERT
);
```

#### ⚠️ AVISO CRÍTICO: Integridade Referencial

**NÃO há Foreign Key em `entity_id`!**

```sql
-- ❌ NÃO PODE EXISTIR:
FOREIGN KEY (entity_id) REFERENCES polox.leads(id)
```

**Por quê?**  
Porque `entity_id` é **polimórfico**: pode apontar para `leads`, `clients`, `products`, etc. O PostgreSQL não sabe qual tabela validar.

**RESPONSABILIDADE DA APLICAÇÃO (API):**

1. ✅ **Antes de CREATE**: Validar que a entidade existe
2. ✅ **Antes de DELETE**: Chamar `CustomFieldValue.deleteAllByEntity(entityId)`
3. ✅ **Usar Transações**: Garantir atomicidade

#### Índices

```sql
CREATE INDEX idx_custom_field_values_entity ON polox.custom_field_values(entity_id);
CREATE INDEX idx_custom_field_values_field ON polox.custom_field_values(custom_field_id);
CREATE INDEX idx_custom_field_values_field_entity ON polox.custom_field_values(custom_field_id, entity_id);
```

---

## 4. Models da Aplicação

### 📦 Model 1: `src/models/CustomField.js`

Gerencia as **definições** dos campos.

#### Métodos Principais

| Método | Descrição | Retorno |
|--------|-----------|---------|
| `findById(id)` | Busca campo por ID | `Object \| null` |
| `findByCompanyAndEntity(companyId, entityType)` | Busca campos de uma empresa + entidade | `Array<Object>` |
| `findByCompany(companyId)` | Busca todos os campos de uma empresa | `Array<Object>` |
| `create(fieldData)` | Cria nova definição | `Object` |
| `update(id, companyId, fieldData)` | Atualiza definição | `Object` |
| `delete(id, companyId)` | Deleta definição (CASCADE valores) | `boolean` |
| `reorder(companyId, entityType, fieldOrders)` | Reordena campos | `boolean` |

#### Exemplo de Uso

```javascript
const CustomField = require('../models/CustomField');

// Criar campo "Orçamento" para Leads
const field = await CustomField.create({
  companyId: 10,
  entityType: 'lead',
  name: 'Orçamento Disponível',
  fieldType: 'numeric',
  isRequired: false,
  sortOrder: 1
});

// Buscar todos os campos de Leads da empresa 10
const leadFields = await CustomField.findByCompanyAndEntity(10, 'lead');
```

---

### 📦 Model 2: `src/models/CustomFieldValue.js`

Gerencia os **valores** preenchidos.

#### Métodos Principais

| Método | Descrição | Retorno |
|--------|-----------|---------|
| `findAllByEntity(entityId)` | Busca valores de uma entidade | `Array<Object>` |
| `findOne(customFieldId, entityId)` | Busca valor específico | `Object \| null` |
| `getEntityCustomFields(entityId, companyId, entityType)` | Busca definições + valores (JOIN) | `Array<Object>` |
| `upsert(customFieldId, entityId, valueData)` | Salva/Atualiza valor (UPSERT) | `Object` |
| `upsertMany(entityId, customFields, entityType)` | Salva múltiplos valores | `Array<Object>` |
| `deleteOne(customFieldId, entityId)` | Deleta valor específico | `boolean` |
| `deleteAllByEntity(entityId)` | ⚠️ **CRÍTICO**: Deleta todos os valores de uma entidade | `number` |
| `deleteAllByEntities(entityIds)` | Deleta valores em massa | `number` |

#### Exemplo de Uso

```javascript
const CustomFieldValue = require('../models/CustomFieldValue');

// Salvar valor "50000.00" no campo 1 do lead 123
await CustomFieldValue.upsert(1, 123, {
  text_value: null,
  numeric_value: 50000.00,
  date_value: null,
  boolean_value: null
});

// Buscar todos os campos + valores do lead 123
const fields = await CustomFieldValue.getEntityCustomFields(123, 10, 'lead');
// Retorna: [{ id: 1, name: 'Orçamento', field_type: 'numeric', value: 50000.00 }, ...]

// ⚠️ ANTES de deletar o lead 123
await CustomFieldValue.deleteAllByEntity(123);
await Lead.delete(123);
```

---

## 5. Guia Prático de Implementação

### 🖥️ Frontend (UI/UX)

#### Tela 1: Administração de Campos (`/settings/custom-fields`)

**Público**: Administradores da empresa

**Funcionalidades**:

1. **Seleção de Módulo**: Dropdown para escolher entidade
   ```html
   <select name="entityType">
     <option value="lead">Leads</option>
     <option value="client">Clientes</option>
     <option value="product">Produtos</option>
   </select>
   ```

2. **Lista de Campos**: Tabela com campos existentes
   ```
   | Nome              | Tipo     | Obrigatório | Ações         |
   |-------------------|----------|-------------|---------------|
   | Orçamento         | Numérico | Não         | Editar | Deletar |
   | Nível de Interesse| Opções   | Sim         | Editar | Deletar |
   ```

3. **Formulário "Novo Campo"**:
   - **Label do Campo** (texto): `name`
   - **Tipo do Campo** (dropdown): `field_type`
     - Texto (Linha Única)
     - Texto (Múltiplas Linhas)
     - Numérico
     - URL
     - Data/Hora
     - Checkbox
     - Opções (Dropdown)
   - **Opções** (textarea, visível apenas se tipo='options'):
     ```
     Exemplo: Digite as opções separadas por vírgula
     Alto, Médio, Baixo
     ```
   - **Campo Obrigatório?** (checkbox): `is_required`

#### Tela 2: Formulário da Entidade (`/leads/123`)

**Público**: Usuários que editam a entidade

**Renderização Dinâmica**:

```javascript
// Ao carregar o lead 123
GET /api/leads/123

// Resposta JSON
{
  "id": 123,
  "name": "Cliente Exemplo",
  "email": "exemplo@mail.com",
  "customFields": [
    {
      "id": 1,
      "name": "Orçamento Disponível",
      "field_type": "numeric",
      "is_required": false,
      "value": 50000.00
    },
    {
      "id": 2,
      "name": "Nível de Interesse",
      "field_type": "options",
      "options": ["Alto", "Médio", "Baixo"],
      "is_required": true,
      "value": "Alto"
    }
  ]
}
```

**Renderização no React/Vue/Angular**:

```jsx
{lead.customFields.map(field => (
  <div key={field.id}>
    <label>
      {field.name}
      {field.is_required && <span className="required">*</span>}
    </label>
    
    {field.field_type === 'numeric' && (
      <input type="number" step="0.01" value={field.value} />
    )}
    
    {field.field_type === 'options' && (
      <select value={field.value}>
        {field.options.map(opt => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    )}
    
    {/* ... outros tipos ... */}
  </div>
))}
```

---

### ⚙️ Backend (API)

#### Controller: `src/controllers/customFieldController.js`

```javascript
const CustomField = require('../models/CustomField');
const CustomFieldValue = require('../models/CustomFieldValue');

class CustomFieldController {
  // GET /api/custom-fields?entity_type=lead
  static async list(req, res) {
    const { entity_type } = req.query;
    const { companyId } = req.user;

    const fields = await CustomField.findByCompanyAndEntity(companyId, entity_type);
    res.json(fields);
  }

  // POST /api/custom-fields
  static async create(req, res) {
    const { entityType, name, fieldType, options, isRequired } = req.body;
    const { companyId } = req.user;

    const field = await CustomField.create({
      companyId,
      entityType,
      name,
      fieldType,
      options,
      isRequired
    });

    res.status(201).json(field);
  }

  // PUT /api/custom-fields/:id
  static async update(req, res) {
    const { id } = req.params;
    const { companyId } = req.user;
    const { name, fieldType, options, isRequired } = req.body;

    const field = await CustomField.update(id, companyId, {
      name,
      fieldType,
      options,
      isRequired
    });

    res.json(field);
  }

  // DELETE /api/custom-fields/:id
  static async delete(req, res) {
    const { id } = req.params;
    const { companyId } = req.user;

    await CustomField.delete(id, companyId);
    res.status(204).send();
  }
}

module.exports = CustomFieldController;
```

#### Service: `src/services/leadService.js` (Exemplo)

```javascript
const Lead = require('../models/Lead');
const CustomFieldValue = require('../models/CustomFieldValue');
const { transaction } = require('../config/database');

class LeadService {
  // GET /api/leads/:id
  static async getLeadById(id, companyId) {
    // 1. Buscar o lead
    const lead = await Lead.findById(id, companyId);
    if (!lead) throw new NotFoundError('Lead não encontrado');

    // 2. Buscar campos + valores customizados
    const customFields = await CustomFieldValue.getEntityCustomFields(
      id,
      companyId,
      'lead'
    );

    // 3. Merge
    return {
      ...lead,
      customFields
    };
  }

  // PUT /api/leads/:id
  static async updateLead(id, companyId, data) {
    const { customFields, ...leadData } = data;

    return await transaction(async (client) => {
      // 1. Atualizar lead normal
      const lead = await Lead.update(id, companyId, leadData);

      // 2. Atualizar campos customizados
      if (customFields && Array.isArray(customFields)) {
        await CustomFieldValue.upsertMany(id, customFields, 'lead');
      }

      // 3. Retornar lead atualizado com campos
      return await this.getLeadById(id, companyId);
    });
  }

  // DELETE /api/leads/:id
  static async deleteLead(id, companyId) {
    return await transaction(async (client) => {
      // ⚠️ PASSO CRÍTICO: Deletar valores customizados PRIMEIRO
      await CustomFieldValue.deleteAllByEntity(id);

      // Deletar o lead
      await Lead.delete(id, companyId);

      return true;
    });
  }
}

module.exports = LeadService;
```

---

## 6. Fluxos de Dados (CRUD)

### 📝 Fluxo 1: Admin Cria um Campo

```
┌──────────┐
│ Frontend │  POST /api/custom-fields
└────┬─────┘  {
     │          "entityType": "lead",
     │          "name": "Orçamento",
     │          "fieldType": "numeric",
     │          "isRequired": false
     │        }
     ▼
┌─────────────┐
│ Controller  │  customFieldController.create()
└─────┬───────┘
      ▼
┌─────────────┐
│   Service   │  (Validação, Regras de Negócio)
└─────┬───────┘
      ▼
┌─────────────┐
│    Model    │  CustomField.create()
└─────┬───────┘
      ▼
┌─────────────┐
│  Database   │  INSERT INTO polox.custom_fields
└─────────────┘
```

---

### 📄 Fluxo 2: Usuário Carrega um Lead

```
┌──────────┐
│ Frontend │  GET /api/leads/123
└────┬─────┘
     ▼
┌─────────────┐
│ Controller  │  leadController.getById()
└─────┬───────┘
      ▼
┌─────────────┐
│   Service   │  leadService.getLeadById(123, companyId)
└─────┬───────┘
      │
      │  ┌─────────────────────────────────────┐
      │  │ 1. Lead.findById(123)               │
      │  │    → { id: 123, name: "Cliente" }   │
      │  └─────────────────────────────────────┘
      │
      │  ┌─────────────────────────────────────┐
      │  │ 2. CustomFieldValue                 │
      │  │    .getEntityCustomFields(...)      │
      │  │    → [{ id: 1, name: "Orçamento",  │
      │  │         value: 50000.00 }]          │
      │  └─────────────────────────────────────┘
      │
      ▼
┌─────────────┐
│   Merge     │  { ...lead, customFields: [...] }
└─────┬───────┘
      ▼
┌──────────┐
│ Frontend │  Renderiza lead + campos dinâmicos
└──────────┘
```

---

### ✏️ Fluxo 3: Usuário Atualiza um Lead

```
┌──────────┐
│ Frontend │  PUT /api/leads/123
└────┬─────┘  {
     │          "name": "Cliente Atualizado",
     │          "customFields": [
     │            { "id": 1, "value": 75000.00 }
     │          ]
     │        }
     ▼
┌─────────────┐
│ Controller  │  leadController.update()
└─────┬───────┘
      ▼
┌─────────────┐
│   Service   │  leadService.updateLead(123, data)
└─────┬───────┘
      │
      │  ┌─────────────────────────────────────┐
      │  │ TRANSACTION BEGIN                   │
      │  │                                     │
      │  │ 1. Lead.update(123, { name: ... }) │
      │  │    → UPDATE polox.leads             │
      │  │                                     │
      │  │ 2. CustomFieldValue.upsertMany(...)│
      │  │    → Para cada campo:               │
      │  │      - Busca definição do campo     │
      │  │      - Determina coluna de valor    │
      │  │      - INSERT ... ON CONFLICT ...   │
      │  │        DO UPDATE                    │
      │  │                                     │
      │  │ COMMIT                              │
      │  └─────────────────────────────────────┘
      │
      ▼
┌──────────┐
│ Frontend │  Recebe lead atualizado
└──────────┘
```

---

### 🗑️ Fluxo 4: Usuário Deleta um Lead (CRÍTICO)

```
┌──────────┐
│ Frontend │  DELETE /api/leads/123
└────┬─────┘
     ▼
┌─────────────┐
│ Controller  │  leadController.delete()
└─────┬───────┘
      ▼
┌─────────────┐
│   Service   │  leadService.deleteLead(123, companyId)
└─────┬───────┘
      │
      │  ┌─────────────────────────────────────┐
      │  │ TRANSACTION BEGIN                   │
      │  │                                     │
      │  │ ⚠️ PASSO 1 (CRÍTICO):              │
      │  │ CustomFieldValue                    │
      │  │   .deleteAllByEntity(123)           │
      │  │    → DELETE FROM                    │
      │  │       custom_field_values           │
      │  │       WHERE entity_id = 123         │
      │  │                                     │
      │  │ PASSO 2:                            │
      │  │ Lead.delete(123)                    │
      │  │    → DELETE FROM polox.leads        │
      │  │       WHERE id = 123                │
      │  │                                     │
      │  │ COMMIT                              │
      │  └─────────────────────────────────────┘
      │
      ▼
┌──────────┐
│ Frontend │  Lead deletado com sucesso
└──────────┘
```

**⚠️ IMPORTANTE**: Se você NÃO deletar os valores customizados antes, eles ficarão **órfãos** no banco de dados!

---

## 7. Segurança e Validações

### 🔒 Validações Implementadas

#### No Model `CustomField.js`:

1. ✅ **Tipos de Campo**: Apenas 7 tipos permitidos
2. ✅ **Entidades**: Apenas entidades registradas
3. ✅ **Options Obrigatório**: Para `field_type='options'`
4. ✅ **Ownership**: Empresa só pode editar/deletar seus próprios campos
5. ✅ **Campos Globais**: Não podem ser deletados por empresas
6. ✅ **Constraint UNIQUE**: Evita duplicação de nomes

#### No Model `CustomFieldValue.js`:

1. ✅ **Validação de Tipo**: `numeric` valida número, `date` valida data
2. ✅ **Campo Existe**: Valida que `custom_field_id` existe
3. ✅ **Entity Type**: Valida que campo é da entidade correta
4. ✅ **UPSERT**: Evita duplicação de valores

### 🛡️ Segurança Multi-tenant

```javascript
// ❌ ERRADO: Permitir acesso entre empresas
const field = await CustomField.findById(id);
await CustomField.delete(id);

// ✅ CORRETO: Validar ownership
const field = await CustomField.findById(id);
if (field.company_id !== req.user.companyId) {
  throw new ForbiddenError('Acesso negado');
}
await CustomField.delete(id, req.user.companyId);
```

### ⚡ Performance

**Índices Criados**:

- ✅ `idx_custom_fields_company_entity` → Busca rápida de campos
- ✅ `idx_custom_field_values_entity` → Busca rápida de valores por entidade
- ✅ `idx_custom_field_values_field_entity` → JOIN otimizado

**Colunas Tipadas vs JSONB**:

```sql
-- ❌ Opção Ruim: JSONB genérico
value jsonb  -- { "type": "numeric", "value": 50000 }

-- ✅ Opção Boa: Colunas tipadas
numeric_value numeric(15, 2)  -- 50000.00
date_value timestamptz         -- 2025-11-15 14:30:00
```

**Benefício**: PostgreSQL pode indexar, validar tipo e fazer queries eficientes.

---

## 8. Exemplos de Código

### 🔧 Exemplo Completo: Adicionar Campos a Leads

#### 1. Admin Cria Campo "Orçamento"

```javascript
// POST /api/custom-fields
const response = await fetch('/api/custom-fields', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    entityType: 'lead',
    name: 'Orçamento Disponível',
    fieldType: 'numeric',
    isRequired: false,
    sortOrder: 1
  })
});

const field = await response.json();
// { id: 1, name: 'Orçamento Disponível', field_type: 'numeric', ... }
```

#### 2. Admin Cria Campo "Nível de Interesse"

```javascript
// POST /api/custom-fields
await fetch('/api/custom-fields', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
  body: JSON.stringify({
    entityType: 'lead',
    name: 'Nível de Interesse',
    fieldType: 'options',
    options: ['Alto', 'Médio', 'Baixo'],
    isRequired: true,
    sortOrder: 2
  })
});
```

#### 3. Usuário Cria Lead com Campos Customizados

```javascript
// POST /api/leads
const leadResponse = await fetch('/api/leads', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
  body: JSON.stringify({
    // Dados normais do lead
    name: 'Cliente Novo',
    email: 'cliente@mail.com',
    phone: '11999999999',
    
    // Campos customizados
    customFields: [
      { id: 1, value: 75000.00 },        // Orçamento
      { id: 2, value: 'Alto' }           // Nível de Interesse
    ]
  })
});

const lead = await leadResponse.json();
```

#### 4. Service processa a criação

```javascript
// src/services/leadService.js
static async createLead(companyId, data) {
  const { customFields, ...leadData } = data;

  return await transaction(async (client) => {
    // 1. Criar lead normal
    const lead = await Lead.create(companyId, leadData);

    // 2. Processar campos customizados
    if (customFields && Array.isArray(customFields)) {
      await CustomFieldValue.upsertMany(lead.id, customFields, 'lead');
    }

    // 3. Retornar lead completo (com campos)
    return await this.getLeadById(lead.id, companyId);
  });
}
```

#### 5. Model salva os valores

```javascript
// src/models/CustomFieldValue.js (dentro de upsertMany)
for (const { id, value } of customFields) {
  const field = await CustomField.findById(id);
  
  // Determinar qual coluna usar
  const valueData = { text_value: null, numeric_value: null, date_value: null, boolean_value: null };
  
  if (field.field_type === 'numeric') {
    valueData.numeric_value = parseFloat(value);
  } else if (field.field_type === 'options') {
    valueData.text_value = String(value);
  }
  
  // UPSERT
  await this.upsert(id, entityId, valueData);
}
```

---

### 🔍 Exemplo: Buscar Lead com Campos

```javascript
// GET /api/leads/123
const leadResponse = await fetch('/api/leads/123', {
  headers: { 'Authorization': `Bearer ${token}` }
});

const lead = await leadResponse.json();

console.log(lead);
/*
{
  "id": 123,
  "name": "Cliente Novo",
  "email": "cliente@mail.com",
  "phone": "11999999999",
  "customFields": [
    {
      "id": 1,
      "name": "Orçamento Disponível",
      "field_type": "numeric",
      "is_required": false,
      "sort_order": 1,
      "value": 75000.00,
      "value_id": 456
    },
    {
      "id": 2,
      "name": "Nível de Interesse",
      "field_type": "options",
      "options": ["Alto", "Médio", "Baixo"],
      "is_required": true,
      "sort_order": 2,
      "value": "Alto",
      "value_id": 457
    }
  ]
}
*/
```

---

### 🗑️ Exemplo: Deletar Lead (Crítico)

```javascript
// DELETE /api/leads/123
const deleteResponse = await fetch('/api/leads/123', {
  method: 'DELETE',
  headers: { 'Authorization': `Bearer ${token}` }
});

// Internamente no leadService.js:
static async deleteLead(id, companyId) {
  return await transaction(async (client) => {
    // ⚠️ PASSO CRÍTICO: Deletar valores customizados PRIMEIRO
    const deletedCount = await CustomFieldValue.deleteAllByEntity(id);
    console.log(`Deletados ${deletedCount} valores customizados`);

    // Deletar o lead
    await Lead.delete(id, companyId);

    return true;
  });
}
```

---

## 9. Troubleshooting

### ❓ Problema: Valores customizados não aparecem no GET

**Sintoma**: `customFields: []` vazio ao buscar lead.

**Causas Possíveis**:

1. ❌ Service não está chamando `CustomFieldValue.getEntityCustomFields()`
2. ❌ Frontend não está renderizando o array `customFields`
3. ❌ Campos foram criados para outra entidade (`entity_type` diferente)

**Solução**:

```javascript
// ✅ CORRETO
static async getLeadById(id, companyId) {
  const lead = await Lead.findById(id, companyId);
  const customFields = await CustomFieldValue.getEntityCustomFields(id, companyId, 'lead');
  return { ...lead, customFields };
}
```

---

### ❓ Problema: Erro ao deletar lead

**Sintoma**: Valores órfãos em `custom_field_values` após deletar lead.

**Causa**: Service não está deletando valores antes do lead.

**Solução**:

```javascript
// ❌ ERRADO
static async deleteLead(id, companyId) {
  await Lead.delete(id, companyId);  // Valores ficam órfãos!
}

// ✅ CORRETO
static async deleteLead(id, companyId) {
  return await transaction(async (client) => {
    await CustomFieldValue.deleteAllByEntity(id);  // Primeiro os valores
    await Lead.delete(id, companyId);              // Depois o lead
  });
}
```

---

### ❓ Problema: Erro "Campo customizado não encontrado"

**Sintoma**: Erro ao salvar valor customizado.

**Causas Possíveis**:

1. ❌ Campo foi deletado mas frontend ainda tenta salvar
2. ❌ Campo pertence a outra empresa
3. ❌ Campo é de outra entidade

**Solução**:

```javascript
// Validar no frontend antes de enviar
const validFields = customFields.filter(f => 
  availableFields.some(af => af.id === f.id)
);
```

---

### ❓ Problema: Performance ruim ao listar leads

**Sintoma**: Query lenta ao listar 1000+ leads com campos customizados.

**Causa**: Fazer 1000 queries `getEntityCustomFields()` dentro de um loop.

**Solução**:

```javascript
// ❌ ERRADO: N+1 queries
const leads = await Lead.list(companyId);
for (const lead of leads) {
  lead.customFields = await CustomFieldValue.getEntityCustomFields(lead.id, companyId, 'lead');
}

// ✅ CORRETO: 2 queries apenas
const leads = await Lead.list(companyId);
const leadIds = leads.map(l => l.id);

// Query otimizada com WHERE IN
const allValues = await query(`
  SELECT cfv.*, cf.name, cf.field_type
  FROM polox.custom_field_values cfv
  JOIN polox.custom_fields cf ON cf.id = cfv.custom_field_id
  WHERE cfv.entity_id = ANY($1)
`, [leadIds]);

// Agrupar por entity_id
const valuesByEntity = groupBy(allValues, 'entity_id');

// Anexar aos leads
leads.forEach(lead => {
  lead.customFields = valuesByEntity[lead.id] || [];
});
```

---

## 📚 Referências

- **Migrations**: `migrations/024_create_custom_fields_table.js`, `migrations/025_create_custom_field_values_table.js`
- **Models**: `src/models/CustomField.js`, `src/models/CustomFieldValue.js`
- **Padrão EAV**: [Wikipedia - Entity-Attribute-Value](https://en.wikipedia.org/wiki/Entity%E2%80%93attribute%E2%80%93value_model)
- **PostgreSQL JSONB**: [PostgreSQL JSON Functions](https://www.postgresql.org/docs/current/functions-json.html)

---

## 🎯 Checklist de Implementação

Ao integrar campos customizados em uma nova entidade:

- [ ] Adicionar `entity_type` em `CustomField.ENTITY_TYPES`
- [ ] Atualizar service de CREATE para chamar `CustomFieldValue.upsertMany()`
- [ ] Atualizar service de GET para chamar `CustomFieldValue.getEntityCustomFields()`
- [ ] Atualizar service de UPDATE para processar `customFields` array
- [ ] ⚠️ **CRÍTICO**: Atualizar service de DELETE para chamar `CustomFieldValue.deleteAllByEntity()` **ANTES**
- [ ] Atualizar controller para aceitar `customFields` no payload
- [ ] Atualizar validações (Joi/Yup) para permitir `customFields` opcional
- [ ] Criar rotas `/api/custom-fields` se ainda não existirem
- [ ] Atualizar testes unitários
- [ ] Atualizar documentação da API (Swagger)

---

**Desenvolvido pela equipe Polox** 🚀  
**Data:** 23 de outubro de 2025
