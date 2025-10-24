# Refatoração de Nomes de Colunas - Remover Palavras Reservadas SQL

**Data:** 24 de outubro de 2025  
**Status:** Em Andamento

## Objetivo

Refatorar o esquema do banco de dados PostgreSQL para renomear colunas que usam palavras reservadas do SQL ou nomes genéricos (como `name`, `type`, `role`, etc.). Isso evita a necessidade de usar aspas duplas (`"`) em todas as queries e torna o código mais limpo e menos propenso a erros.

## Alterações no Banco de Dados (SQL)

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

## Status de Atualização dos Models

### ✅ Completos

1. **User.js** - ✅ Concluído
   - `name` → `full_name`
   - `role` → `user_role`

2. **Company.js** - ✅ Concluído
   - `name` → `company_name`
   - `domain` → `company_domain`

3. **AuditLog.js** - ⚠️ Parcialmente Concluído
   - `action` → `audit_action` (principais métodos atualizados)
   - Ainda faltam alguns métodos auxiliares no final do arquivo

### 🔄 Pendentes

4. **CustomField.js**
   - `name` → `field_name`

5. **Lead.js**
   - `name` → `lead_name`
   - `type` → `note_type` (em lead_notes)

6. **Client.js**
   - `name` → `client_name`
   - `type` → `client_type`
   - `type` → `note_type` (em client_notes)

7. **Product.js**
   - `name` → `product_name`
   - `type` → `product_type`

8. **Tag.js**
   - `name` → `tag_name`

9. **FinancialAccount.js**
   - `name` → `account_name`
   - `type` → `account_type`

10. **FinancialTransaction.js**
    - `type` → `transaction_type`

11. **Event.js**
    - `type` → `event_type`
    - `location` → `event_location`

12. **Notification.js**
    - `type` → `notification_type`

13. **NotificationTemplate.js**
    - `name` → `template_name`
    - `type` → `notification_type`

14. **ProductCategory.js**
    - `name` → `category_name`

15. **Supplier.js**
    - `name` → `supplier_name`

16. **Achievement.js**
    - `name` → `achievement_name`

17. **Interest.js** (se existir como model separado)
    - `name` → `interest_name`

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
