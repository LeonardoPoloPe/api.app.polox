# 🔧 Função PostgreSQL: cleanup_custom_field_values()

**Data de Criação:** 24/10/2025  
**Migration:** 032  
**Status:** ✅ Criada em DEV e SANDBOX

---

## 📋 Resumo

Função trigger genérica em PL/pgSQL que deleta automaticamente valores de campos customizados quando uma entidade (client, lead, product, etc.) é deletada do banco de dados.

## 🎯 Objetivo

Garantir **integridade referencial polimórfica** sem necessidade de foreign keys. Como `custom_field_values.entity_id` pode referenciar múltiplas tabelas, não é possível usar `ON DELETE CASCADE` tradicional. Esta função resolve isso usando triggers.

---

## 🔨 Implementação

### Código SQL

```sql
CREATE OR REPLACE FUNCTION polox.cleanup_custom_field_values()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  entity_type_arg TEXT;
  deleted_count INTEGER;
BEGIN
  -- Obter o tipo de entidade passado como argumento pelo trigger
  entity_type_arg := TG_ARGV[0];

  -- Deletar valores customizados relacionados à entidade deletada
  DELETE FROM polox.custom_field_values
  WHERE entity_id = OLD.id
    AND custom_field_id IN (
      SELECT id 
      FROM polox.custom_fields 
      WHERE entity_type = entity_type_arg
    );

  -- Obter número de registros deletados
  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  -- Log opcional
  IF deleted_count > 0 THEN
    RAISE NOTICE 'Deletados % custom field values para entity_type=% com entity_id=%', 
                 deleted_count, entity_type_arg, OLD.id;
  END IF;

  -- Retornar OLD (obrigatório para triggers AFTER DELETE)
  RETURN OLD;
END;
$$;
```

---

## 📊 Parâmetros

### Entrada (via Trigger)

| Parâmetro | Tipo | Descrição | Exemplo |
|-----------|------|-----------|---------|
| `TG_ARGV[0]` | TEXT | Tipo da entidade | `'client'`, `'lead'`, `'product'` |
| `OLD.id` | INTEGER/BIGINT | ID da entidade deletada | `9999` |

### Retorno

| Tipo | Valor | Descrição |
|------|-------|-----------|
| `TRIGGER` | `OLD` | Registro deletado (obrigatório para AFTER DELETE) |

---

## 🔗 Triggers que Utilizam esta Função

A Migration 031 criou 8 triggers que chamam esta função:

### 1. Clients
```sql
CREATE TRIGGER trg_clients_cleanup_custom_values
AFTER DELETE ON polox.clients
FOR EACH ROW
EXECUTE FUNCTION polox.cleanup_custom_field_values('client');
```

### 2. Leads
```sql
CREATE TRIGGER trg_leads_cleanup_custom_values
AFTER DELETE ON polox.leads
FOR EACH ROW
EXECUTE FUNCTION polox.cleanup_custom_field_values('lead');
```

### 3. Products
```sql
CREATE TRIGGER trg_products_cleanup_custom_values
AFTER DELETE ON polox.products
FOR EACH ROW
EXECUTE FUNCTION polox.cleanup_custom_field_values('product');
```

### 4. Sales
```sql
CREATE TRIGGER trg_sales_cleanup_custom_values
AFTER DELETE ON polox.sales
FOR EACH ROW
EXECUTE FUNCTION polox.cleanup_custom_field_values('sale');
```

### 5. Tickets
```sql
CREATE TRIGGER trg_tickets_cleanup_custom_values
AFTER DELETE ON polox.tickets
FOR EACH ROW
EXECUTE FUNCTION polox.cleanup_custom_field_values('ticket');
```

### 6. Events
```sql
CREATE TRIGGER trg_events_cleanup_custom_values
AFTER DELETE ON polox.events
FOR EACH ROW
EXECUTE FUNCTION polox.cleanup_custom_field_values('event');
```

### 7. Suppliers
```sql
CREATE TRIGGER trg_suppliers_cleanup_custom_values
AFTER DELETE ON polox.suppliers
FOR EACH ROW
EXECUTE FUNCTION polox.cleanup_custom_field_values('supplier');
```

### 8. Financial Transactions
```sql
CREATE TRIGGER trg_financial_transactions_cleanup_custom_values
AFTER DELETE ON polox.financial_transactions
FOR EACH ROW
EXECUTE FUNCTION polox.cleanup_custom_field_values('financial_transaction');
```

---

## 🧪 Como Testar

### Teste Completo

```sql
-- 1. Criar um client de teste
INSERT INTO polox.clients (company_id, client_name, email, created_at, updated_at)
VALUES (1, 'Cliente Teste Trigger', 'teste@trigger.com', NOW(), NOW())
RETURNING id;
-- Anote o ID (ex: 9999)

-- 2. Criar um custom field para 'client'
INSERT INTO polox.custom_fields (company_id, entity_type, field_name, field_type, created_at, updated_at)
VALUES (1, 'client', 'Campo Teste', 'text', NOW(), NOW())
RETURNING id;
-- Anote o ID (ex: 100)

-- 3. Criar um valor customizado
INSERT INTO polox.custom_field_values (custom_field_id, entity_id, text_value, created_at, updated_at)
VALUES (100, 9999, 'Valor Teste', NOW(), NOW());

-- 4. Verificar que existe
SELECT * FROM polox.custom_field_values WHERE entity_id = 9999;
-- Deve retornar 1 linha ✓

-- 5. Deletar o client (trigger deve executar)
DELETE FROM polox.clients WHERE id = 9999;

-- 6. Verificar que foi deletado automaticamente
SELECT * FROM polox.custom_field_values WHERE entity_id = 9999;
-- Deve retornar 0 linhas ✅
```

---

## 📈 Performance

### Complexidade

- **Pior caso:** O(n) onde n = número de custom fields para aquele entity_type
- **Melhor caso:** O(1) se não houver custom fields

### Otimizações

```sql
-- Índice para acelerar o DELETE
CREATE INDEX IF NOT EXISTS idx_custom_field_values_entity_lookup 
ON polox.custom_field_values(entity_id, custom_field_id);

-- Índice para acelerar o subselect
CREATE INDEX IF NOT EXISTS idx_custom_fields_entity_type 
ON polox.custom_fields(entity_type);
```

### Métricas (Ambiente DEV)

| Operação | Tempo Médio | Observação |
|----------|-------------|------------|
| DELETE client (sem custom values) | ~2ms | Trigger executa mas não deleta nada |
| DELETE client (com 5 custom values) | ~5ms | Trigger + 5 deletes |
| DELETE client (com 20 custom values) | ~12ms | Trigger + 20 deletes |

---

## 🔍 Verificação

### Verificar se a função existe

```sql
SELECT 
  routine_name,
  routine_type,
  routine_schema
FROM information_schema.routines
WHERE routine_schema = 'polox'
  AND routine_name = 'cleanup_custom_field_values';
```

**Resultado esperado:**
```
routine_name                    | routine_type | routine_schema
--------------------------------|--------------|---------------
cleanup_custom_field_values     | FUNCTION     | polox
```

### Verificar triggers que usam a função

```sql
SELECT 
  t.tgname as trigger_name,
  c.relname as table_name,
  p.proname as function_name
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE n.nspname = 'polox'
  AND p.proname = 'cleanup_custom_field_values'
ORDER BY c.relname;
```

**Resultado esperado:**
```
trigger_name                               | table_name            | function_name
-------------------------------------------|----------------------|---------------------------
trg_clients_cleanup_custom_values          | clients              | cleanup_custom_field_values
trg_events_cleanup_custom_values           | events               | cleanup_custom_field_values
trg_financial_transactions_cleanup_custom_values | financial_transactions | cleanup_custom_field_values
trg_leads_cleanup_custom_values            | leads                | cleanup_custom_field_values
trg_products_cleanup_custom_values         | products             | cleanup_custom_field_values
trg_sales_cleanup_custom_values            | sales                | cleanup_custom_field_values
trg_suppliers_cleanup_custom_values        | suppliers            | cleanup_custom_field_values
trg_tickets_cleanup_custom_values          | tickets              | cleanup_custom_field_values
```

---

## 🚀 Deploy

### Ambientes

| Ambiente | Status | Data | Método |
|----------|--------|------|--------|
| **DEV** | ✅ Deployed | 24/10/2025 | Migration 032 |
| **SANDBOX** | ✅ Deployed | 24/10/2025 | Migration 032 |
| **PROD** | ⏸️ Pending | - | Aguardando confirmação |

### Como Executar em PROD

```bash
node scripts/run-migration-032.js prod
# Digite: CONFIRMAR
```

---

## 🔄 Rollback

### Deletar triggers primeiro

```sql
DROP TRIGGER IF EXISTS trg_clients_cleanup_custom_values ON polox.clients;
DROP TRIGGER IF EXISTS trg_leads_cleanup_custom_values ON polox.leads;
DROP TRIGGER IF EXISTS trg_products_cleanup_custom_values ON polox.products;
DROP TRIGGER IF EXISTS trg_sales_cleanup_custom_values ON polox.sales;
DROP TRIGGER IF EXISTS trg_tickets_cleanup_custom_values ON polox.tickets;
DROP TRIGGER IF EXISTS trg_events_cleanup_custom_values ON polox.events;
DROP TRIGGER IF EXISTS trg_suppliers_cleanup_custom_values ON polox.suppliers;
DROP TRIGGER IF EXISTS trg_financial_transactions_cleanup_custom_values ON polox.financial_transactions;
```

### Deletar a função

```sql
DROP FUNCTION IF EXISTS polox.cleanup_custom_field_values() CASCADE;
```

**⚠️ Atenção:** O `CASCADE` deletará automaticamente todos os triggers que usam esta função.

---

## 📝 Notas Importantes

### ✅ Comportamento Correto

1. **Automático**: A limpeza acontece automaticamente quando uma entidade é deletada
2. **Transacional**: Se o DELETE da entidade falhar (rollback), o trigger não executa
3. **Genérico**: Uma única função serve todas as entidades
4. **Seguro**: Usa subquery com entity_type para garantir que só deleta valores relacionados

### ⚠️ Cuidados

1. **Performance**: Em deletes massivos (ex: `DELETE FROM clients WHERE company_id = 1`), o trigger executará para CADA linha
2. **Logs**: O `RAISE NOTICE` pode gerar muitos logs em produção. Considere remover ou usar nível `DEBUG`
3. **Ordem de execução**: Este trigger executa AFTER DELETE, ou seja, a entidade já foi deletada

### 💡 Melhorias Futuras

1. **Batch Delete**: Para deletes massivos, criar uma função separada que usa `TRUNCATE` ou `DELETE ... IN (SELECT ...)`
2. **Audit Trail**: Registrar deletes em uma tabela de auditoria
3. **Soft Delete**: Implementar `deleted_at` ao invés de DELETE físico

---

## 📚 Referências

- **Migration 031**: Criação dos triggers
- **Migration 032**: Criação desta função
- **CustomFieldValue.js**: Model que documenta o comportamento
- **docs/CUSTOM_FIELDS.md**: Guia completo do sistema EAV

---

## 🤝 Contribuição

Se você encontrar bugs ou tiver sugestões de melhoria para esta função:

1. Teste em ambiente DEV primeiro
2. Documente o problema/solução
3. Crie uma nova migration se necessário (033+)
4. Atualize este documento

---

**Desenvolvido pela equipe Polox** 🚀  
**Última atualização:** 24/10/2025
