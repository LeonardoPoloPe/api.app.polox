# Refatoração de Nomes de Colunas - Remover Palavras Reservadas SQL

**Data:** 24 de outubro de 2025  
**Status:** ✅ CONCLUÍDO (Migrations 029 + 030)

## Objetivo

Refatorar o esquema do banco de dados PostgreSQL para renomear colunas que usam palavras reservadas do SQL ou nomes genéricos (como `name`, `type`, `role`, etc.). Isso evita a necessidade de usar aspas duplas (`"`) em todas as queries e torna o código mais limpo e menos propenso a erros.

## 📊 Resumo das Migrations

### Migration 029: Renomear Palavras Reservadas Principais
- **Status**: ✅ Executada em DEV, SANDBOX
- **Tabelas**: 21 tabelas afetadas
- **Colunas**: 35+ renomeações

### Migration 030: Polimento Final do Esquema
- **Status**: ✅ Executada em DEV, SANDBOX  
- **Correções Críticas**:
  - `audit_logs.entity_id`: text → int8 (bigint)
  - Foreign Keys adicionadas em `audit_logs`
- **Colunas**: 11 renomeações adicionais
- **Limpeza**: Remoção de tabelas de backup

## Alterações no Banco de Dados (SQL)

### Migration 029 - Palavras Reservadas Principais

```sql
-- Renomear "action" em audit_logs
ALTER TABLE polox.audit_logs RENAME COLUMN "action" TO audit_action;

-- Renomear "name" e "domain" em companies
ALTER TABLE polox.companies RENAME COLUMN "name" TO company_name;
ALTER TABLE polox.companies RENAME COLUMN "domain" TO company_domain;

-- Renomear "name" em custom_fields
ALTER TABLE polox.custom_fields RENAME COLUMN "name" TO field_name;

-- Renomear "name" e "type" em financial_accounts
ALTER TABLE polox.financial_accounts RENAME COLUMN "name" TO account_name;
ALTER TABLE polox.financial_accounts RENAME COLUMN "type" TO account_type;

-- Renomear "name" em interests
ALTER TABLE polox.interests RENAME COLUMN "name" TO interest_name;

-- Renomear "name" e "type" em notification_templates
ALTER TABLE polox.notification_templates RENAME COLUMN "name" TO template_name;
ALTER TABLE polox.notification_templates RENAME COLUMN "type" TO notification_type;

-- Renomear "name" em product_categories
ALTER TABLE polox.product_categories RENAME COLUMN "name" TO category_name;

-- Renomear "name" em suppliers
ALTER TABLE polox.suppliers RENAME COLUMN "name" TO supplier_name;

-- Renomear "name" em tags
ALTER TABLE polox.tags RENAME COLUMN "name" TO tag_name;

-- Renomear "name" e "role" em users
ALTER TABLE polox.users RENAME COLUMN "name" TO full_name;
ALTER TABLE polox.users RENAME COLUMN "role" TO user_role;

-- Renomear "name" em achievements
ALTER TABLE polox.achievements RENAME COLUMN "name" TO achievement_name;

-- Renomear "type" em notifications
ALTER TABLE polox.notifications RENAME COLUMN "type" TO notification_type;

-- Renomear "name" e "type" em products
ALTER TABLE polox.products RENAME COLUMN "name" TO product_name;
ALTER TABLE polox.products RENAME COLUMN "type" TO product_type;

-- Renomear "type" em client_notes
ALTER TABLE polox.client_notes RENAME COLUMN "type" TO note_type;

-- Renomear "name" e "type" em clients
ALTER TABLE polox.clients RENAME COLUMN "name" TO client_name;
ALTER TABLE polox.clients RENAME COLUMN "type" TO client_type;

-- Renomear "type" e "location" em events
ALTER TABLE polox.events RENAME COLUMN "type" TO event_type;
ALTER TABLE polox.events RENAME COLUMN "location" TO event_location;

-- Renomear "type" em financial_transactions
ALTER TABLE polox.financial_transactions RENAME COLUMN "type" TO transaction_type;

-- Renomear "type" em lead_notes
ALTER TABLE polox.lead_notes RENAME COLUMN "type" TO note_type;

-- Renomear "name" em leads
ALTER TABLE polox.leads RENAME COLUMN "name" TO lead_name;

-- Renomear "name" em public.migrations
ALTER TABLE public.migrations RENAME COLUMN "name" TO migration_name;

-- Renomear "name" em public.users
ALTER TABLE public.users RENAME COLUMN "name" TO full_name;
```

### Migration 030 - Polimento Final e Correções Críticas

```sql
-- =================================================================
-- 1. CORREÇÕES CRÍTICAS NA polox.audit_logs
-- =================================================================

-- Alterar entity_id para int8 (bigint) - antes era text!
ALTER TABLE polox.audit_logs 
ALTER COLUMN entity_id TYPE int8 USING entity_id::int8;

-- Adicionar Foreign Keys
ALTER TABLE polox.audit_logs
ADD CONSTRAINT fk_audit_logs_company 
  FOREIGN KEY (company_id) REFERENCES polox.companies(id) ON DELETE CASCADE;

ALTER TABLE polox.audit_logs
ADD CONSTRAINT fk_audit_logs_user 
  FOREIGN KEY (user_id) REFERENCES polox.users(id) ON DELETE SET NULL;

-- =================================================================
-- 2. RENOMEAR COLUNAS RESERVADAS RESTANTES
-- =================================================================

-- polox.file_uploads - "number" é palavra reservada
ALTER TABLE polox.file_uploads 
RENAME COLUMN "number" TO file_number;

-- polox.companies - "plan" e "language" são palavras reservadas
ALTER TABLE polox.companies 
RENAME COLUMN "plan" TO subscription_plan;
ALTER TABLE polox.companies 
RENAME COLUMN "language" TO default_language;

-- polox.custom_fields - "options" é palavra reservada
ALTER TABLE polox.custom_fields 
RENAME COLUMN "options" TO field_options;

-- polox.users - "position" e "language" são palavras reservadas
ALTER TABLE polox.users 
RENAME COLUMN "position" TO user_position;
ALTER TABLE polox.users 
RENAME COLUMN "language" TO user_language;

-- polox.client_notes - "content" é palavra reservada
ALTER TABLE polox.client_notes 
RENAME COLUMN "content" TO note_content;

-- polox.lead_notes - "content" é palavra reservada
ALTER TABLE polox.lead_notes 
RENAME COLUMN "content" TO note_content;

-- polox.leads - "position" e "source" são palavras reservadas
ALTER TABLE polox.leads 
RENAME COLUMN "position" TO lead_position;
ALTER TABLE polox.leads 
RENAME COLUMN "source" TO lead_source;

-- =================================================================
-- 3. LIMPEZA DE TABELAS DE BACKUP/TESTE
-- =================================================================

DROP TABLE IF EXISTS polox.leads_backup_011;
DROP TABLE IF EXISTS public.test_dev;
```

## 📊 Tabela Completa de Mudanças (Migrations 029 + 030)

| Tabela | Coluna Antiga | Coluna Nova | Migration |
|--------|--------------|-------------|-----------|
| **polox.users** | name | full_name | 029 |
| **polox.users** | role | user_role | 029 |
| **polox.users** | position | user_position | 030 |
| **polox.users** | language | user_language | 030 |
| **polox.companies** | name | company_name | 029 |
| **polox.companies** | domain | company_domain | 029 |
| **polox.companies** | plan | subscription_plan | 030 |
| **polox.companies** | language | default_language | 030 |
| **polox.audit_logs** | action | audit_action | 029 |
| **polox.audit_logs** | entity_id | entity_id (text→int8) | 030 |
| **polox.custom_fields** | name | field_name | 029 |
| **polox.custom_fields** | options | field_options | 030 |
| **polox.leads** | name | lead_name | 029 |
| **polox.leads** | position | lead_position | 030 |
| **polox.leads** | source | lead_source | 030 |
| **polox.lead_notes** | type | note_type | 029 |
| **polox.lead_notes** | content | note_content | 030 |
| **polox.clients** | name | client_name | 029 |
| **polox.clients** | type | client_type | 029 |
| **polox.client_notes** | type | note_type | 029 |
| **polox.client_notes** | content | note_content | 030 |
| **polox.products** | name | product_name | 029 |
| **polox.products** | type | product_type | 029 |
| **polox.tags** | name | tag_name | 029 |
| **polox.financial_accounts** | name | account_name | 029 |
| **polox.financial_accounts** | type | account_type | 029 |
| **polox.financial_transactions** | type | transaction_type | 029 |
| **polox.events** | type | event_type | 029 |
| **polox.events** | location | event_location | 029 |
| **polox.notifications** | type | notification_type | 029 |
| **polox.notification_templates** | name | template_name | 029 |
| **polox.notification_templates** | type | notification_type | 029 |
| **polox.product_categories** | name | category_name | 029 |
| **polox.suppliers** | name | supplier_name | 029 |
| **polox.achievements** | name | achievement_name | 029 |
| **polox.interests** | name | interest_name | 029 |
| **polox.file_uploads** | number | file_number | 030 |
| **public.migrations** | name | migration_name | 029 |
| **public.users** | name | full_name | 029 |

**Total**: 38 tabelas/colunas afetadas | Migration 029: 27 mudanças | Migration 030: 11 mudanças + correções críticas

## Status de Atualização dos Models

### ✅ Completos (Migration 029)

1. **User.js** - ✅ Concluído (Migration 029)
   - `name` → `full_name`
   - `role` → `user_role`
   - ⚠️ **PENDENTE Migration 030**:
     - `position` → `user_position`
     - `language` → `user_language`

2. **Company.js** - ✅ Concluído (Migration 029)
   - `name` → `company_name`
   - `domain` → `company_domain`
   - ⚠️ **PENDENTE Migration 030**:
     - `plan` → `subscription_plan`
     - `language` → `default_language`

3. **AuditLog.js** - ⚠️ Parcialmente Concluído
   - ✅ `action` → `audit_action` (principais métodos atualizados - Migration 029)
   - ⚠️ **PENDENTE Migration 030**:
     - Atualizar `entity_id` para usar int8 (bigint) em vez de string
     - Finalizar métodos auxiliares restantes
   - Ainda faltam alguns métodos auxiliares no final do arquivo

### 🔄 Pendentes (Migration 029 + 030)

4. **CustomField.js** - ⚠️ Pendente
   - Migration 029: `name` → `field_name`
   - Migration 030: `options` → `field_options`

5. **Lead.js** - ⚠️ Pendente
   - Migration 029:
     - `name` → `lead_name`
     - `type` → `note_type` (em lead_notes)
   - Migration 030:
     - `position` → `lead_position`
     - `source` → `lead_source`
     - `content` → `note_content` (em lead_notes)

6. **Client.js** - ⚠️ Pendente
   - Migration 029:
     - `name` → `client_name`
     - `type` → `client_type`
     - `type` → `note_type` (em client_notes)
   - Migration 030:
     - `content` → `note_content` (em client_notes)

7. **Product.js** - ⚠️ Pendente
   - Migration 029:
     - `name` → `product_name`
     - `type` → `product_type`

8. **Tag.js** - ⚠️ Pendente
   - Migration 029: `name` → `tag_name`

9. **FinancialAccount.js** - ⚠️ Pendente
   - Migration 029:
     - `name` → `account_name`
     - `type` → `account_type`

10. **FinancialTransaction.js** - ⚠️ Pendente
    - Migration 029: `type` → `transaction_type`

11. **Event.js** - ⚠️ Pendente
    - Migration 029:
      - `type` → `event_type`
      - `location` → `event_location`

12. **Notification.js** - ⚠️ Pendente
    - Migration 029: `type` → `notification_type`

13. **NotificationTemplate.js** - ⚠️ Pendente
    - Migration 029:
      - `name` → `template_name`
      - `type` → `notification_type`

14. **ProductCategory.js** - ⚠️ Pendente
    - Migration 029: `name` → `category_name`

15. **Supplier.js** - ⚠️ Pendente
    - Migration 029: `name` → `supplier_name`

16. **Achievement.js** - ⚠️ Pendente
    - Migration 029: `name` → `achievement_name`

17. **Interest.js** - ⚠️ Pendente
    - Migration 029: `name` → `interest_name`

18. **FileUpload.js** (se existir) - ⚠️ Pendente
    - Migration 030: `number` → `file_number`

## Padrão de Alteração

Para cada model, as alterações seguem este padrão:

### 1. Parâmetros de Funções
```javascript
// ANTES
static async create(userData) {
  const { name, role } = userData;
  
// DEPOIS
static async create(userData) {
  const { full_name, user_role } = userData;
```

### 2. Queries INSERT
```javascript
// ANTES
INSERT INTO polox.users (name, role) VALUES ($1, $2)

// DEPOIS
INSERT INTO polox.users (full_name, user_role) VALUES ($1, $2)
```

### 3. Queries SELECT
```javascript
// ANTES
SELECT name, role FROM polox.users

// DEPOIS
SELECT full_name, user_role FROM polox.users
```

### 4. Queries UPDATE
```javascript
// ANTES
UPDATE polox.users SET name = $1, role = $2

// DEPOIS
UPDATE polox.users SET full_name = $1, user_role = $2
```

### 5. WHERE Clauses
```javascript
// ANTES
WHERE role = 'admin'

// DEPOIS
WHERE user_role = 'admin'
```

### 6. ORDER BY
```javascript
// ANTES
ORDER BY name ASC

// DEPOIS
ORDER BY full_name ASC
```

### 7. Arrays de Campos Permitidos
```javascript
// ANTES
const allowedFields = ['name', 'role', 'email'];

// DEPOIS
const allowedFields = ['full_name', 'user_role', 'email'];
```

## Próximos Passos

1. Executar os comandos ALTER TABLE no banco de dados (desenvolvimento primeiro, depois sandbox, depois produção)
2. Completar a atualização dos models restantes seguindo o padrão acima
3. Atualizar controllers que usam esses campos
4. Atualizar validações e schemas
5. Atualizar testes
6. Atualizar documentação da API
7. Atualizar frontend se aplicável

## Notas Importantes

- **NÃO** executar ALTER TABLE em produção sem antes testar em desenvolvimento e sandbox
- Fazer backup do banco de dados antes de executar as alterações
- Depois de alterar o banco, testar todas as funcionalidades afetadas
- Criar migration script para reverter alterações se necessário
- Considerar período de manutenção para aplicar alterações em produção
- Verificar se há views, stored procedures ou triggers que também precisam ser atualizados

## Scripts de Rollback (Se necessário)

```sql
-- Reverter alterações em users
ALTER TABLE polox.users RENAME COLUMN full_name TO "name";
ALTER TABLE polox.users RENAME COLUMN user_role TO "role";

-- Reverter alterações em companies
ALTER TABLE polox.companies RENAME COLUMN company_name TO "name";
ALTER TABLE polox.companies RENAME COLUMN company_domain TO "domain";

-- (adicionar mais conforme necessário)
```

## Checklist de Validação

Após completar as alterações, validar:

- [ ] Todas as queries executam sem erros
- [ ] CRUD completo funciona para cada entidade
- [ ] Filtros e pesquisas funcionam corretamente
- [ ] Ordenação funciona corretamente
- [ ] Relacionamentos entre tabelas funcionam
- [ ] Estatísticas e dashboards mostram dados corretos
- [ ] Testes automatizados passam
- [ ] Performance não foi degradada
- [ ] Logs e auditoria continuam funcionando
