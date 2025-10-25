# 🎯 Resumo Executivo - Migrations 029 e 030

**Data**: 24 de outubro de 2025  
**Status**: ✅ DEV e SANDBOX concluídos | ⏸️ PROD aguardando confirmação

---

## 📊 Status dos Ambientes

| Ambiente | Migration 029 | Migration 030 | Observações |
|----------|--------------|--------------|-------------|
| **DEV** | ✅ CONCLUÍDO | ✅ CONCLUÍDO | Testado e validado |
| **SANDBOX** | ✅ CONCLUÍDO | ✅ CONCLUÍDO | Testado e validado |
| **PROD** | ⏸️ AGUARDANDO | ⏸️ AGUARDANDO | Pronto para executar |

---

## 🔧 Migration 029: Renomear Palavras Reservadas SQL

### Objetivo
Eliminar o uso de palavras reservadas SQL (name, type, role, action, domain, location) nas colunas do banco.

### Impacto
- **21 tabelas** afetadas
- **27 colunas** renomeadas
- **Idempotente**: Pode ser executada múltiplas vezes com segurança

### Mudanças Principais

| Tabela | Mudanças |
|--------|----------|
| `polox.users` | name→full_name, role→user_role |
| `polox.companies` | name→company_name, domain→company_domain |
| `polox.audit_logs` | action→audit_action |
| `polox.leads` | name→lead_name |
| `polox.clients` | name→client_name, type→client_type |
| `polox.products` | name→product_name, type→product_type |
| `polox.tags` | name→tag_name |
| `polox.custom_fields` | name→field_name |
| +13 outras tabelas | Ver documentação completa |

---

## 🎨 Migration 030: Polimento Final do Esquema

### Objetivo
Corrigir tipos de dados críticos, adicionar constraints de integridade e renomear colunas reservadas restantes.

### Impacto
- **11 colunas** renomeadas
- **1 tipo** corrigido (entity_id: text→int8)
- **2 Foreign Keys** adicionadas
- **2 tabelas de backup** removidas

### Correções Críticas

#### 1. audit_logs.entity_id: text → int8 (bigint)
```sql
ALTER TABLE polox.audit_logs 
ALTER COLUMN entity_id TYPE int8 USING entity_id::int8;
```
**Motivo**: entity_id deve ser numérico para referenciar IDs de outras tabelas

#### 2. Foreign Keys em audit_logs
```sql
-- FK para companies (cascade delete)
ALTER TABLE polox.audit_logs
ADD CONSTRAINT fk_audit_logs_company 
  FOREIGN KEY (company_id) REFERENCES polox.companies(id) 
  ON DELETE CASCADE;

-- FK para users (set null on delete)
ALTER TABLE polox.audit_logs
ADD CONSTRAINT fk_audit_logs_user 
  FOREIGN KEY (user_id) REFERENCES polox.users(id) 
  ON DELETE SET NULL;
```
**Motivo**: Garantir integridade referencial e evitar orphan records

### Mudanças Adicionais

| Tabela | Mudança | Motivo |
|--------|---------|--------|
| `polox.file_uploads` | number→file_number | "number" é reservada |
| `polox.companies` | plan→subscription_plan | "plan" é reservada |
| `polox.companies` | language→default_language | "language" é reservada |
| `polox.custom_fields` | options→field_options | "options" é reservada |
| `polox.users` | position→user_position | "position" é reservada |
| `polox.users` | language→user_language | "language" é reservada |
| `polox.client_notes` | content→note_content | "content" é reservada |
| `polox.lead_notes` | content→note_content | "content" é reservada |
| `polox.leads` | position→lead_position | "position" é reservada |
| `polox.leads` | source→lead_source | "source" é reservada |

---

## ⚠️ Checklist de Execução em PRODUÇÃO

### Antes de Executar

- [ ] **Backup completo do banco de dados**
  ```bash
  pg_dump -h database-1.cd2em8e0a6ot.sa-east-1.rds.amazonaws.com \
          -U polox_prod_user \
          -d app_polox_prod \
          > backup_prod_pre_migrations_$(date +%Y%m%d_%H%M%S).sql
  ```

- [ ] **Validar migrations em DEV e SANDBOX** ✅ (JÁ VALIDADO)

- [ ] **Comunicar equipe sobre manutenção**
  - Tempo estimado: 2-5 minutos
  - Possível downtime: Sim (breve)
  - Horário recomendado: Fora do horário de pico

- [ ] **Preparar rollback** (scripts disponíveis)
  - `rollback-migration-029.js`
  - `rollback-migration-030.js`

### Executar Migrations

```bash
# Migration 029
node scripts/run-migration-029.js prod
# Digite: CONFIRMAR

# Migration 030
node scripts/run-migration-030.js prod  
# Digite: CONFIRMAR
```

### Após Executar

- [ ] **Validar execução**
  ```bash
  # Verificar se migrations foram registradas
  psql -h [host] -U polox_prod_user -d app_polox_prod \
       -c "SELECT * FROM public.migrations ORDER BY executed_at DESC LIMIT 5;"
  ```

- [ ] **Testar API em PROD**
  ```bash
  curl https://18yioqws85.execute-api.sa-east-1.amazonaws.com/prod/health
  ```

- [ ] **Monitorar logs por 15-30 minutos**
  ```bash
  npm run logs:prod
  ```

- [ ] **Atualizar código da aplicação**
  - Deploy do código atualizado com novos nomes de colunas
  - Ver seção "Próximos Passos"

---

## 📋 Próximos Passos: Atualizar Models

### Models que Precisam de Atualização

#### Prioridade ALTA (Usados frequentemente)
1. **User.js** - Adicionar mudanças da Migration 030
   - `position` → `user_position`
   - `language` → `user_language`

2. **Company.js** - Adicionar mudanças da Migration 030
   - `plan` → `subscription_plan`
   - `language` → `default_language`

3. **AuditLog.js** - Finalizar
   - Atualizar `entity_id` para bigint
   - Completar métodos auxiliares restantes (5%)

4. **CustomField.js** - Migration 029 + 030
   - `name` → `field_name`
   - `options` → `field_options`

5. **Lead.js** - Migration 029 + 030
   - `name` → `lead_name`
   - `position` → `lead_position`
   - `source` → `lead_source`
   - `content` → `note_content` (lead_notes)

6. **Client.js** - Migration 029 + 030
   - `name` → `client_name`
   - `type` → `client_type`
   - `content` → `note_content` (client_notes)

#### Prioridade MÉDIA
7. **Product.js**
8. **Tag.js**
9. **Event.js**
10. **FinancialAccount.js**
11. **FinancialTransaction.js**

#### Prioridade BAIXA
12. **Notification.js**
13. **NotificationTemplate.js**
14. **ProductCategory.js**
15. **Supplier.js**
16. **Achievement.js**
17. **Interest.js**
18. **FileUpload.js** (se existir)

---

## 🔄 Rollback (Se Necessário)

### Em caso de problemas

```bash
# Reverter Migration 030
node scripts/rollback-migration-030.js prod
# Digite: REVERTER

# Reverter Migration 029 (se necessário)
node scripts/rollback-migration-029.js prod
# Digite: REVERTER
```

**⚠️ IMPORTANTE**: 
- Rollback deve ser feito na ordem inversa (030 primeiro, depois 029)
- Rollback restaura nomes antigos, mas dados permanecem intactos
- Código precisa ser revertido também se fizer rollback

---

## 📊 Métricas

### Migration 029
- **Tempo de execução**: ~5 segundos
- **Linhas afetadas**: 0 (apenas renomeações de colunas)
- **Downtime**: Nenhum (DDL instantâneo)

### Migration 030
- **Tempo de execução**: ~8 segundos
- **Linhas afetadas**: Depende de audit_logs (conversão de entity_id)
- **Downtime**: Mínimo (~2-3 segundos durante conversão)

---

## ✅ Validação de Sucesso

### Comandos de Verificação

```sql
-- Verificar se colunas foram renomeadas
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'polox' 
  AND table_name = 'users' 
  AND column_name IN ('full_name', 'user_role', 'user_position', 'user_language');

-- Verificar FKs em audit_logs
SELECT constraint_name, constraint_type 
FROM information_schema.table_constraints 
WHERE table_name = 'audit_logs' 
  AND constraint_type = 'FOREIGN KEY';

-- Verificar tipo de entity_id
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'polox' 
  AND table_name = 'audit_logs' 
  AND column_name = 'entity_id';
-- Deve retornar: bigint (int8)
```

---

## 🎯 Decisão Final

**Para executar em PRODUÇÃO:**

1. Execute `node scripts/run-migration-029.js prod`
2. Digite `CONFIRMAR` quando solicitado
3. Execute `node scripts/run-migration-030.js prod`
4. Digite `CONFIRMAR` quando solicitado
5. Monitore os logs e valide
6. Continue com atualização dos models

**Recomendação**: ✅ **SEGURO PARA EXECUTAR**
- Migrations testadas e validadas em DEV e SANDBOX
- Scripts idempotentes (seguro executar múltiplas vezes)
- Rollback disponível se necessário
- Impacto mínimo (DDL rápido)

---

**Preparado por**: Sistema Automático de Migrations  
**Revisado em**: 24/10/2025  
**Próxima revisão**: Após execução em PROD
