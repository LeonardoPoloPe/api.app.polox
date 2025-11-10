# 🚨 Troubleshooting Rápido - Profile Selection

## ⚡ Verificações Rápidas (5 minutos)

### 1. Backend está rodando?
```bash
curl http://localhost:3000/health
```
**Esperado:** `{"status": "healthy"}`

### 2. Tabela profiles existe?
```sql
SELECT COUNT(*) FROM profiles;
```

### 3. Coluna profile_id existe?
```sql
SELECT profile_id FROM users LIMIT 1;
```

### 4. Tem dados de teste?
```sql
-- Ver usuários com perfil
SELECT u.id, u.name, u.profile_id, p.name as profile_name
FROM users u
LEFT JOIN profiles p ON u.profile_id = p.id
LIMIT 5;
```

---

## 🐛 Erros Comuns e Soluções

### Erro: "column reference is ambiguous"

**Causa:** Falta especificar alias da tabela no WHERE

**Solução:**
```sql
-- ❌ Errado
WHERE deleted_at IS NULL

-- ✅ Correto
WHERE u.deleted_at IS NULL
```

---

### Erro: "relation 'profiles' does not exist"

**Causa:** Tabela profiles não foi criada

**Solução:**
```bash
# Rodar migration
npm run migrate

# Ou manualmente
psql -d app_polox_dev -f migrations/XXX_create_profiles.sql
```

---

### Erro: "column 'profile_id' does not exist"

**Causa:** Coluna profile_id não existe na tabela users

**Solução:**
```sql
-- Adicionar coluna
ALTER TABLE users 
ADD COLUMN profile_id BIGINT REFERENCES profiles(id);

-- Criar índice
CREATE INDEX idx_users_profile_id ON users(profile_id);
```

---

### Erro: 500 Internal Server Error (genérico)

**Debug:**
```bash
# 1. Ver logs do backend
npm run dev

# 2. Fazer request e ver erro detalhado
curl -v http://localhost:3000/api/v1/users?companyId=29 \
  -H "Authorization: Bearer $TOKEN"

# 3. Verificar logs no CloudWatch (AWS)
aws logs tail /aws/lambda/polox-api-dev --follow
```

---

### Erro: profileId e profileName retornam null

**Possíveis Causas:**

1. **Usuário não tem perfil atribuído**
   ```sql
   -- Verificar
   SELECT id, name, profile_id FROM users WHERE id = 1;
   
   -- Atribuir perfil
   UPDATE users SET profile_id = 1 WHERE id = 1;
   ```

2. **Perfil foi deletado (soft delete)**
   ```sql
   -- Verificar
   SELECT id, name, deleted_at FROM profiles WHERE id = 1;
   
   -- Restaurar se necessário
   UPDATE profiles SET deleted_at = NULL WHERE id = 1;
   ```

3. **LEFT JOIN não está funcionando**
   ```sql
   -- Testar query manualmente
   SELECT 
     u.id, 
     u.full_name, 
     u.profile_id,
     p.name as profile_name
   FROM users u
   LEFT JOIN profiles p ON u.profile_id = p.id AND p.deleted_at IS NULL
   WHERE u.id = 1;
   ```

---

## 🔧 Scripts de Teste

### Teste 1: Query SQL Direta
```sql
-- Copie e cole no psql ou PgAdmin
SELECT 
  u.id,
  u.full_name as user_name,
  u.email,
  u.profile_id,
  p.name as profile_name,
  p.deleted_at as profile_deleted
FROM users u
LEFT JOIN profiles p ON u.profile_id = p.id AND p.deleted_at IS NULL
WHERE u.deleted_at IS NULL
  AND u.company_id = 29
ORDER BY u.created_at DESC
LIMIT 10;
```

### Teste 2: Endpoint Backend
```bash
# Com token
curl -H "Authorization: Bearer $TOKEN" \
     http://localhost:3000/api/v1/users?companyId=29 | jq .

# Verificar campos
curl -H "Authorization: Bearer $TOKEN" \
     http://localhost:3000/api/v1/users?companyId=29 | \
     jq '.data.users[0] | {profileId, profileName}'
```

### Teste 3: Script Automatizado
```bash
# Usar script fornecido
./scripts/test-profile-fix.sh
```

---

## 📊 Logs para Buscar

### Backend (Node.js)
```
# Sucesso
🔍 GET /users - Parâmetros: { companyId: '29' }
✅ GET /users - Usuários encontrados: { total: 15, withProfile: 12 }

# Erro
❌ GET /users - Erro: { message: '...', stack: '...' }
```

### PostgreSQL
```
# Query lenta
LOG: duration: 1234.567 ms statement: SELECT ...

# Erro de sintaxe
ERROR: syntax error at or near "WHERE"

# Coluna ambígua
ERROR: column reference "deleted_at" is ambiguous
```

---

## 🎯 Checklist de Debug

- [ ] Backend rodando (health check OK)
- [ ] Tabela `profiles` existe
- [ ] Coluna `users.profile_id` existe
- [ ] LEFT JOIN funcionando (query manual)
- [ ] Endpoint retorna 200 (não 500)
- [ ] Campos `profileId` e `profileName` na resposta
- [ ] Frontend recebe dados corretamente
- [ ] Console do navegador sem erros

---

## 🚀 Se Tudo Falhar

### Rollback de Emergência
```bash
# Reverter código
git checkout HEAD~1 -- src/controllers/userController.js

# Ou usar versão anterior sem profiles
git checkout sem-profiles-branch
```

### Solução Temporária no Frontend
```typescript
// Em page.tsx, forçar valores default
const users = data?.data?.users?.map(user => ({
  ...user,
  profileId: user.profileId || null,
  profileName: user.profileName || "Sem Perfil"
}));
```

---

## 📞 Contatos de Suporte

- **Backend:** Verificar `userController.js` linha 57-145
- **SQL:** Verificar migrations em `/migrations`
- **Frontend:** Verificar `app/portal/companies/page.tsx`
- **Documentação:** `docs/DEBUG_PROFILE_FIX.md`

---

## ✅ Validação Final

Antes de marcar como resolvido, verificar:

```bash
# 1. Todos os testes passam
./scripts/test-profile-fix.sh

# 2. Frontend carrega sem erro
# Abrir: http://localhost:3001/portal/companies
# Selecionar empresa
# Ver lista de usuários

# 3. Logs sem erros
# Ver console do navegador (F12)
# Ver logs do backend (npm run dev)

# 4. Deploy funciona
npm run deploy:dev
# Testar em DEV
```

---

**Última atualização:** 9 de novembro de 2025  
**Status:** ✅ Correções aplicadas, aguardando testes
