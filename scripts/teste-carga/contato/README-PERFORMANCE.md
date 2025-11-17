# 🚀 Guia de Testes de Performance

Scripts para popular o banco com volume massivo de dados e testar performance da aplicação.

## 📋 Scripts Disponíveis

### 1. `seed-contacts-performance.js`
**Popula o banco com dados de teste em massa**

Cria:
- 5.000 contatos (configurável)
- ~6.000 deals (60% dos contatos têm deals)
- ~15.000 notas (média de 3 por contato)

**Total: ~26.000 registros inseridos**

### 2. `seed-contacts-chatgpt.js`
**Popula o banco com dados realistas usando ChatGPT**

⚠️ **Requer:** Chave da API OpenAI (variável `OPENAI_API_KEY` no `.env`)

Cria dados mais realistas usando IA:
- Nomes brasileiros genuínos
- Emails únicos e variados
- Telefones com DDDs reais
- Endereços de cidades brasileiras
- Descrições de deals profissionais

**Configuração necessária:**
```bash
# No arquivo .env
OPENAI_API_KEY=sk-your-openai-api-key-here
```

Obtenha sua chave em: https://platform.openai.com/api-keys

### 3. `test-performance.js`
**Testa performance de endpoints críticos**

Simula carga real com múltiplas requisições:
- Listagem de contatos (diferentes tamanhos de página)
- Busca por termo
- Busca por ID
- Listagem de deals
- Listagem de notas

## 🎯 Como Usar

### Passo 1: Instalar dependências (se necessário)

```bash
pnpm add @faker-js/faker --save-dev
```

### Passo 2: Popular banco de dados

```bash
# Usar configurações padrão (5.000 contatos)
node scripts/seed-contacts-performance.js

# Ou editar CONFIG no arquivo para ajustar:
# - COMPANY_ID (sua empresa)
# - TOTAL_CONTACTS (quantidade de contatos)
# - BATCH_SIZE (registros por batch)
```

**Tempo estimado:** 30-60 segundos para 5.000 contatos + relacionados

**Saída esperada:**
```
🚀 Iniciando seed de performance...

📊 Configurações:
   - Company ID: 25
   - Total de contatos: 5000
   - Batch size: 100
   - Contatos com deals: 60%
   - Média de deals por contato: 2
   - Média de notas por contato: 3

👥 Criando contatos...
   Progresso: 100.0% (5000/5000 contatos, 6234 deals, 15120 notas)

✅ Seed concluído com sucesso!

📈 Estatísticas:
   - Contatos criados: 5000
   - Deals criados: 6234
   - Notas criadas: 15120
   - Tempo total: 45.23s
   - Taxa: 110 contatos/s
   - Taxa total: 589 registros/s
```

### Passo 3: Obter token JWT

```bash
# Login via API ou copie do frontend
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"seu@email.com","password":"suasenha"}'

# Copie o token retornado
```

### Passo 4: Configurar token no script

**Opção A:** Variável de ambiente
```bash
export TEST_TOKEN="seu_token_jwt_aqui"
```

**Opção B:** Editar arquivo `test-performance.js`
```javascript
const CONFIG = {
  TOKEN: 'seu_token_jwt_aqui',
  // ...
};
```

### Passo 5: Executar testes de performance

```bash
node scripts/test-performance.js
```

**Tempo estimado:** 2-5 minutos (depende das iterações configuradas)

**Saída esperada:**
```
🚀 Iniciando testes de performance...

⚙️  Configurações:
   - API URL: http://localhost:3000/api
   - Company ID: 25
   - Token configurado: ✅

📋 === TESTE: LISTAR CONTATOS ===

🧪 Testando: GET /contacts?limit=10 (50 iterações)
   Progresso: 100% (50/50)

🧪 Testando: GET /contacts?limit=50 (50 iterações)
   Progresso: 100% (50/50)

... (mais testes)

═══════════════════════════════════════════════════════════
📊 RELATÓRIO DE PERFORMANCE
═══════════════════════════════════════════════════════════

┌─────────────────────────────────────────────────────────────────────────┐
│ Endpoint                        │  Avg  │  Min  │  Max  │  P95  │  P99  │
├─────────────────────────────────────────────────────────────────────────┤
│ 🟢 GET /contacts?limit=10       │  45ms │  32ms │ 120ms │  89ms │ 115ms │
│ 🟢 GET /contacts?limit=50       │  78ms │  52ms │ 180ms │ 145ms │ 175ms │
│ 🟡 GET /contacts?limit=100      │ 145ms │  98ms │ 320ms │ 280ms │ 310ms │
│ 🟡 GET /contacts?limit=200      │ 289ms │ 198ms │ 580ms │ 520ms │ 570ms │
│ 🟢 GET /contacts?search=Silva   │  65ms │  45ms │ 150ms │ 120ms │ 145ms │
│ 🟢 GET /contacts/:id            │  23ms │  15ms │  65ms │  52ms │  62ms │
│ 🟢 GET /deals?limit=50          │  82ms │  58ms │ 190ms │ 165ms │ 185ms │
│ 🟢 GET /notes?limit=50          │  71ms │  48ms │ 175ms │ 152ms │ 170ms │
└─────────────────────────────────────────────────────────────────────────┘

📈 Resumo Geral:
   - Total de requisições: 390
   - Requisições bem-sucedidas: 390 (100.0%)
   - Erros: 0
   - Tempo médio geral: 87.45ms

💡 Recomendações:
   ✅ Todos os endpoints estão com boa performance

═══════════════════════════════════════════════════════════
```

## 🎨 Personalizando os Testes

### Ajustar quantidade de dados (seed)

Edite `seed-contacts-performance.js`:

```javascript
const CONFIG = {
  COMPANY_ID: 25,          // Sua empresa
  BATCH_SIZE: 100,         // Registros por batch (não alterar)
  TOTAL_CONTACTS: 10000,   // 🔧 AUMENTAR para mais dados
  CONTACTS_WITH_DEALS_PERCENTAGE: 70, // % com deals
  DEALS_PER_CONTACT_AVG: 3,           // Média de deals
  NOTES_PER_CONTACT_AVG: 5,           // Média de notas
  OWNER_ID: 1,             // Usuário responsável
};
```

### Ajustar testes de performance

Edite `test-performance.js`:

```javascript
const CONFIG = {
  TESTS: {
    LIST_CONTACTS: {
      enabled: true,
      iterations: 100,  // 🔧 Aumentar para mais iterações
      limits: [10, 50, 100, 200, 500], // Adicionar mais tamanhos
    },
    SEARCH_CONTACTS: {
      enabled: true,
      iterations: 50,
      searchTerms: ['Silva', 'João'], // Adicionar mais termos
    },
    // ... demais testes
  },
};
```

## 📊 Interpretando Resultados

### Métricas

- **Avg (Average):** Tempo médio de resposta
- **Min:** Tempo mínimo (melhor caso)
- **Max:** Tempo máximo (pior caso)
- **P95:** 95% das requisições foram mais rápidas que esse tempo
- **P99:** 99% das requisições foram mais rápidas que esse tempo

### Indicadores

- 🟢 **< 100ms:** Excelente
- 🟡 **100-500ms:** Aceitável
- 🔴 **> 500ms:** Requer otimização

### Possíveis Problemas

**Endpoint lento (>500ms)?**
- ✅ Verificar índices no banco
- ✅ Analisar queries N+1
- ✅ Considerar cache
- ✅ Avaliar paginação

**Muitos erros?**
- ✅ Verificar logs da API
- ✅ Confirmar token JWT válido
- ✅ Verificar limites de rate limiting

**P99 muito alto?**
- ✅ Cold start (primeira requisição)
- ✅ Garbage collection (Node.js)
- ✅ Contenção de recursos

## 🧹 Limpeza

Para remover dados de teste:

```sql
-- CUIDADO: Isso remove TODOS os dados da empresa
DELETE FROM polox.contact_notes WHERE company_id = 25;
DELETE FROM polox.deals WHERE company_id = 25;
DELETE FROM polox.contacts WHERE company_id = 25;

-- Ou apenas dados de teste (se houver marcação)
DELETE FROM polox.contacts 
WHERE company_id = 25 
  AND origem = 'teste_performance';
```

## 🎯 Cenários de Teste Recomendados

### Cenário 1: Carga Baixa (Startup)
```javascript
TOTAL_CONTACTS: 1000
iterations: 20-30 por teste
```

### Cenário 2: Carga Média (Pequena empresa)
```javascript
TOTAL_CONTACTS: 5000
iterations: 50-100 por teste
```

### Cenário 3: Carga Alta (Empresa estabelecida)
```javascript
TOTAL_CONTACTS: 20000
iterations: 100-200 por teste
```

### Cenário 4: Stress Test
```javascript
TOTAL_CONTACTS: 50000+
iterations: 500+ por teste
```

## 💡 Dicas

1. **Execute os testes em horário de baixo uso** para não afetar usuários reais
2. **Monitore recursos do servidor** durante os testes (CPU, memória, disco)
3. **Compare resultados antes/depois** de otimizações
4. **Documente os resultados** para referência futura
5. **Crie índices no banco** se detectar queries lentas

## 🔍 Próximos Passos

Após identificar gargalos:

1. ✅ Adicionar índices no PostgreSQL
2. ✅ Implementar cache (Redis)
3. ✅ Otimizar queries (EXPLAIN ANALYZE)
4. ✅ Ajustar paginação
5. ✅ Considerar read replicas
6. ✅ Implementar lazy loading no frontend

---

**Desenvolvido por:** Leonardo Polo Pereira  
**Empresa:** Polo X  
**Data:** Novembro 2025
