# 🎉 STATUS DA REFATORAÇÃO - CONTATOS & NEGOCIAÇÕES

**Data de Implementação**: 03/11/2025  
**Migration**: 034_refactor_to_contatos_negociacoes  
**Status**: ✅ **CONCLUÍDA COM SUCESSO**

---

## ✅ **O QUE FOI IMPLEMENTADO**

### **Banco de Dados (Migration 034)**

#### **✅ FASE 1: Remoção da Estrutura Antiga**
- ✅ Tabelas deletadas: `leads`, `clients`
- ✅ Tabelas satélite deletadas: `lead_notes`, `client_notes`, `lead_tags`, `client_tags`, `lead_interests`, `client_interests`
- ✅ Foreign Keys removidas de `sales`, `tickets`, `events`, `financial_transactions`

#### **✅ FASE 2: Nova Estrutura Criada**

**Tabela: `polox.contatos`** (Fonte Única da Verdade)
- ✅ Campos de identidade: `nome`, `email`, `phone`, `document_number`, `company_name`
- ✅ Coluna `tipo` com CHECK constraint ('lead' ou 'cliente')
- ✅ Campos de lead: `lead_source`, `first_contact_at`, `score`, `temperature`
- ✅ Campos de cliente: `last_purchase_date`, `lifetime_value_cents`
- ✅ Endereço completo (movido de clients)
- ✅ `owner_id` (responsável pelo contato)
- ✅ Soft delete (`deleted_at`)

**Tabela: `polox.negociacoes`** (Pipeline/Funil de Vendas)
- ✅ `titulo`, `etapa_funil`, `valor_total_cents`, `origem`
- ✅ CHECK constraint para `etapa_funil`
- ✅ `owner_id` (vendedor responsável)
- ✅ `closed_at`, `motivo_perda` (para análise)

#### **✅ FASE 3: Tabelas Satélite Unificadas**
- ✅ `contato_notas` (substitui lead_notes + client_notes)
- ✅ `contato_tags` (substitui lead_tags + client_tags)
- ✅ `contato_interesses` (substitui lead_interests + client_interests)

#### **✅ FASE 4: 4 Constraints de Integridade Implementadas**

**1. PARTIAL INDEX: company_id + phone**
```sql
CREATE UNIQUE INDEX uk_contatos_company_phone 
ON polox.contatos (company_id, phone) 
WHERE phone IS NOT NULL AND deleted_at IS NULL;
```
- ✅ Previne duplicação por telefone
- ✅ Respeita NULL (permite múltiplos NULL)
- ✅ Respeita soft delete

**2. PARTIAL INDEX: company_id + email**
```sql
CREATE UNIQUE INDEX uk_contatos_company_email 
ON polox.contatos (company_id, email) 
WHERE email IS NOT NULL AND deleted_at IS NULL;
```
- ✅ Previne duplicação por email
- ✅ Respeita NULL
- ✅ Respeita soft delete

**3. PARTIAL INDEX: company_id + document_number**
```sql
CREATE UNIQUE INDEX uk_contatos_company_document 
ON polox.contatos (company_id, document_number) 
WHERE document_number IS NOT NULL AND deleted_at IS NULL;
```
- ✅ Previne duplicação por CPF/CNPJ
- ✅ Respeita NULL
- ✅ Respeita soft delete

**4. CHECK CONSTRAINT: Anti-Fantasma**
```sql
CONSTRAINT chk_contato_tem_identificador CHECK (
  deleted_at IS NOT NULL OR  -- Se deletado, não valida
  phone IS NOT NULL OR 
  email IS NOT NULL OR 
  document_number IS NOT NULL
)
```
- ✅ Garante pelo menos 1 identificador
- ✅ Permite anonimização (LGPD) se `deleted_at IS NOT NULL`

#### **✅ FASE 5: Foreign Keys Atualizadas**
- ✅ `sales.contato_id` (antes `client_id`)
- ✅ `tickets.contato_id` (antes `client_id`)
- ✅ `events.contato_id` (antes `client_id`)
- ✅ `financial_transactions.contato_id` (antes `client_id`)

---

## 📊 **ESTATÍSTICAS DA REFATORAÇÃO**

### **Tabelas Criadas**: 5
- `contatos`
- `negociacoes`
- `contato_notas`
- `contato_tags`
- `contato_interesses`

### **Indexes Criados**: 19
- 3 UNIQUE PARTIAL INDEXES (anti-duplicidade)
- 16 Performance indexes

### **Constraints Implementadas**: 4
- 3 UNIQUE (via PARTIAL INDEX)
- 1 CHECK (anti-fantasma)

### **Tabelas Deletadas**: 8
- `leads`, `clients`
- `lead_notes`, `client_notes`
- `lead_tags`, `client_tags`
- `lead_interests`, `client_interests`

---

## 🚀 **PRÓXIMOS PASSOS (TODO)**

### **1. Backend - Models** ⏳ **PENDENTE**

Criar novos Models:

**Arquivo**: `src/models/Contato.js`
- [ ] Método `create()` - criar contato
- [ ] Método `findById()` - buscar por ID
- [ ] Método `findByPhone()` - buscar por telefone
- [ ] Método `findByEmail()` - buscar por email
- [ ] Método `list()` - listar com filtros (tipo, owner, etc.)
- [ ] Método `update()` - atualizar contato
- [ ] Método `convertToCliente()` - mudar tipo de 'lead' → 'cliente'
- [ ] Método `softDelete()` - deletar com soft delete

**Arquivo**: `src/models/Negociacao.js`
- [ ] Método `create()` - criar negociação
- [ ] Método `findById()` - buscar por ID
- [ ] Método `list()` - listar com filtros (etapa_funil, owner)
- [ ] Método `update()` - atualizar negociação
- [ ] Método `moveToStage()` - mover para próxima etapa do funil
- [ ] Método `win()` - marcar como ganha (+ atualizar contato)
- [ ] Método `lose()` - marcar como perdida
- [ ] Método `findByContato()` - buscar todas negociações de um contato

**Arquivo**: `src/models/ContatoNota.js`
- [ ] Método `create()` - adicionar nota
- [ ] Método `findByContato()` - listar notas de um contato
- [ ] Método `update()` - editar nota
- [ ] Método `softDelete()` - deletar nota

---

### **2. Backend - Controllers** ⏳ **PENDENTE**

**Arquivo**: `src/controllers/ContatoController.js`
```javascript
// Endpoints a implementar:
// POST   /api/contatos                           - Criar contato
// GET    /api/contatos                           - Listar contatos (com filtros)
// GET    /api/contatos/:id                       - Buscar contato por ID
// PUT    /api/contatos/:id                       - Atualizar contato
// DELETE /api/contatos/:id                       - Soft delete
// POST   /api/contatos/get-or-create             - Get-or-Create (extensão WhatsApp)
// POST   /api/contatos/:id/convert-to-cliente    - Converter lead → cliente
// GET    /api/contatos/:id/notas                 - Listar notas do contato
// POST   /api/contatos/:id/notas                 - Adicionar nota
// GET    /api/contatos/:id/negociacoes           - Listar negociações do contato
```

**Arquivo**: `src/controllers/NegociacaoController.js`
```javascript
// Endpoints a implementar:
// POST   /api/negociacoes                        - Criar negociação
// GET    /api/negociacoes                        - Listar negociações (funil/pipeline)
// GET    /api/negociacoes/:id                    - Buscar negociação por ID
// PUT    /api/negociacoes/:id                    - Atualizar negociação
// PUT    /api/negociacoes/:id/move               - Mover para próxima etapa
// PUT    /api/negociacoes/:id/win                - Marcar como ganha
// PUT    /api/negociacoes/:id/lose               - Marcar como perdida
// DELETE /api/negociacoes/:id                    - Soft delete
```

---

### **3. Backend - Routes** ⏳ **PENDENTE**

**Arquivo**: `src/routes/contatos.js` (novo)
- [ ] Registrar todas as rotas do ContatoController
- [ ] Adicionar middlewares de autenticação
- [ ] Adicionar validações de input

**Arquivo**: `src/routes/negociacoes.js` (novo)
- [ ] Registrar todas as rotas do NegociacaoController
- [ ] Adicionar middlewares de autenticação
- [ ] Adicionar validações de input

**Arquivo**: `src/routes/index.js` (atualizar)
- [ ] Importar e registrar rotas de contatos
- [ ] Importar e registrar rotas de negociacoes

---

### **4. Backend - Deprecação Gradual das Rotas Antigas** ⏳ **PENDENTE**

**Opção A: Manter rotas antigas com WARNING (3-6 meses)**
```javascript
// src/routes/leads.js (modificar)
router.get('/', (req, res) => {
  console.warn('⚠️  DEPRECATED: /api/leads - Use /api/contatos?tipo=lead');
  // Proxy para nova rota
  return ContatoController.list(req, res, { tipo: 'lead' });
});
```

**Opção B: Deletar rotas antigas imediatamente**
- [ ] Deletar `src/routes/leads.js`
- [ ] Deletar `src/routes/clients.js`
- [ ] Deletar `src/controllers/LeadController.js`
- [ ] Deletar `src/controllers/ClientController.js`
- [ ] Deletar `src/models/Lead.js`
- [ ] Deletar `src/models/Client.js`

---

### **5. Frontend - Componentes** ⏳ **PENDENTE**

**Criar**: `ContatoProfile.js` (unifica LeadProfile + ClientProfile)
- [ ] Exibir dados do contato
- [ ] Mostrar badge "Lead" ou "Cliente" baseado em `tipo`
- [ ] Abas: Dados, Notas, Negociações, Tags, Interesses
- [ ] Botão "Converter para Cliente" (se tipo='lead')
- [ ] Histórico completo (notas antigas preservadas)

**Atualizar**: Tela de Lista de Leads
- [ ] Mudar endpoint de `/api/leads` → `/api/negociacoes?etapa_funil=novo`
- [ ] Exibir negociações em vez de leads
- [ ] View Kanban por etapa do funil

**Atualizar**: Tela de Lista de Clientes
- [ ] Mudar endpoint de `/api/clients` → `/api/contatos?tipo=cliente`

---

### **6. Extensão do WhatsApp** ⏳ **PENDENTE**

**Simplificação da Lógica**:

**Antes** (complexo):
```javascript
// 1. Buscar em leads
let pessoa = await api.get(`/leads/search?phone=${phone}`);
if (!pessoa) {
  // 2. Buscar em clients
  pessoa = await api.get(`/clients/search?phone=${phone}`);
}
// Escolher qual criar... ambiguidade
```

**Depois** (simples):
```javascript
// 1 única chamada, graças ao UNIQUE constraint
const response = await api.post('/contatos/get-or-create', {
  phone: phone,
  nome: nome,
  company_id: company_id
});

const contato = response.data.contact; // Sempre retorna 1 contato
const badge = contato.tipo; // 'lead' ou 'cliente'
```

**Tarefas**:
- [ ] Atualizar lógica de busca
- [ ] Implementar endpoint `POST /api/contatos/get-or-create`
- [ ] Adicionar badge visual (Lead/Cliente)
- [ ] Remover lógica de escolha entre lead/client

---

## 🎯 **CRONOGRAMA SUGERIDO**

### **Semana 1** (3-5 dias)
- [ ] Dia 1-2: Criar Models (Contato.js, Negociacao.js, ContatoNota.js)
- [ ] Dia 3-4: Criar Controllers (ContatoController.js, NegociacaoController.js)
- [ ] Dia 5: Criar Routes e integrar

### **Semana 2** (3-5 dias)
- [ ] Dia 1-2: Testes manuais das APIs (Postman/Insomnia)
- [ ] Dia 3-4: Atualizar frontend (ContatoProfile, listas)
- [ ] Dia 5: Atualizar extensão WhatsApp

### **Semana 3** (2-3 dias)
- [ ] Dia 1: Testes end-to-end
- [ ] Dia 2: Ajustes e correções
- [ ] Dia 3: Deploy em sandbox → prod

---

## 📝 **NOTAS IMPORTANTES**

### **✅ Vantagens da Nova Arquitetura**

1. **Zero Duplicidade**
   - Telefone único por empresa (PARTIAL INDEX)
   - Email único por empresa (PARTIAL INDEX)
   - CPF/CNPJ único por empresa (PARTIAL INDEX)

2. **Histórico Preservado**
   - Lead vira cliente = simples UPDATE no campo `tipo`
   - Todas as notas, tags e interesses permanecem
   - Visão 360° do contato

3. **Cliente pode virar Lead**
   - Cliente pode ter múltiplas negociações
   - Nova oportunidade = nova entrada em `negociacoes`
   - Contato permanece o mesmo

4. **Performance**
   - 19 indexes estratégicos
   - Queries otimizadas
   - Soft delete sem perda de referência

5. **LGPD Compliant**
   - CHECK constraint permite anonimização
   - Soft delete mantém integridade referencial
   - Possível limpar dados pessoais quando deletado

---

## 🚨 **ATENÇÃO - BREAKING CHANGES**

### **APIs que NÃO EXISTEM MAIS** (após deletar rotas antigas)
- ❌ `GET /api/leads`
- ❌ `POST /api/leads`
- ❌ `GET /api/clients`
- ❌ `POST /api/clients`
- ❌ `POST /api/leads/:id/convert`

### **NOVAS APIs**
- ✅ `GET /api/contatos?tipo=lead`
- ✅ `GET /api/contatos?tipo=cliente`
- ✅ `POST /api/contatos`
- ✅ `POST /api/contatos/:id/convert-to-cliente`
- ✅ `GET /api/negociacoes?etapa_funil=novo`

---

## 📊 **CHECKLIST DE VALIDAÇÃO**

Antes de considerar completo, validar:

### **Banco de Dados**
- [x] Tabela `contatos` existe
- [x] Tabela `negociacoes` existe
- [x] 3 PARTIAL INDEXES criados (phone, email, document)
- [x] CHECK constraint anti-fantasma ativa
- [x] Foreign Keys em sales/tickets/events atualizadas
- [x] Tabelas antigas (leads/clients) deletadas

### **Backend**
- [ ] Model `Contato.js` criado e testado
- [ ] Model `Negociacao.js` criado e testado
- [ ] Controller `ContatoController.js` criado
- [ ] Controller `NegociacaoController.js` criado
- [ ] Routes `/api/contatos` registradas
- [ ] Routes `/api/negociacoes` registradas
- [ ] Endpoint `POST /api/contatos/get-or-create` funcionando

### **Testes**
- [ ] Criar contato com telefone duplicado (deve falhar)
- [ ] Criar contato com email duplicado (deve falhar)
- [ ] Criar contato sem identificadores (deve falhar)
- [ ] Criar lead → converter para cliente (deve preservar histórico)
- [ ] Cliente com múltiplas negociações (deve funcionar)
- [ ] Soft delete + anonimização (deve funcionar)

### **Frontend**
- [ ] Tela de lista de contatos funcionando
- [ ] Tela de perfil unificado (ContatoProfile)
- [ ] Badge Lead/Cliente visível
- [ ] Conversão lead → cliente funcional
- [ ] Extensão WhatsApp atualizada

---

**Documentação mantida por**: Leonardo Polo  
**Última atualização**: 03/11/2025 - 23:30  
**Próxima revisão**: Após implementação dos Models e Controllers
