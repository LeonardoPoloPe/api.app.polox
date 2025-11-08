# Backend - Sistema de Perfis e Menus

Documentação e scripts para implementação do sistema de perfis de usuário e menus dinâmicos.

---

## 📁 Arquivos desta Pasta

### 📄 `RESUMO_PERFIS_MENUS.md` ⭐ **COMEÇAR POR AQUI**

Resumo executivo com checklist de implementação. Ideal para ter uma visão geral rápida do que precisa ser feito.

**Contém:**

- O que já existe no banco (NÃO CRIAR)
- O que precisa ser criado (3 novas tabelas)
- Checklist completo de implementação
- Dados iniciais (seed)
- Lógica de permissões

---

### 📘 `PERFIS_MENUS_API_SPEC.md`

Documentação COMPLETA da API com todos os detalhes técnicos.

**Contém:**

- Estrutura detalhada de todas as tabelas
- Especificação completa de TODOS os endpoints
- Request/Response de cada endpoint
- Middleware de autorização (pseudocódigo)
- Regras de negócio
- Recursos futuros
- Testes sugeridos

**Ideal para:** Desenvolvedores implementando a API

---

### 💾 `CREATE_PROFILES_MENUS_TABLES.sql`

Script SQL pronto para executar no PostgreSQL.

**O que faz:**

1. Adiciona coluna `profile_id` na tabela `polox.users`
2. Cria tabela `polox.profiles`
3. Cria tabela `polox.menu_items`
4. Cria tabela `polox.menu_company_permissions`
5. Insere dados iniciais (perfis e menus padrão)
6. Cria índices e triggers
7. Valida criação

**Como usar:**

```bash
# Conectar ao PostgreSQL
psql -U postgres -d seu_banco

# Executar o script
\i CREATE_PROFILES_MENUS_TABLES.sql

# Ou via linha de comando
psql -U postgres -d seu_banco -f CREATE_PROFILES_MENUS_TABLES.sql
```

---

### 📋 `ddl.md` (Referência)

DDL completo do banco de dados atual. Serve como referência para entender a estrutura existente.

**Contém:**

- Todas as tabelas existentes no schema `polox`
- Estrutura de `polox.companies`
- Estrutura de `polox.users`
- Outras tabelas do sistema

**Uso:** Consulta para entender relacionamentos e estrutura existente

---

## 🚀 Ordem de Implementação Recomendada

### 1️⃣ Planejamento (1 hora)

- [ ] Ler `RESUMO_PERFIS_MENUS.md`
- [ ] Revisar `PERFIS_MENUS_API_SPEC.md` (seção de tabelas e endpoints)
- [ ] Entender a estrutura atual consultando `ddl.md`

### 2️⃣ Banco de Dados (30 min)

- [ ] Fazer backup do banco antes de qualquer alteração
- [ ] Executar `CREATE_PROFILES_MENUS_TABLES.sql`
- [ ] Validar criação das tabelas
- [ ] Verificar dados seed inseridos

### 3️⃣ API - Profiles (2 horas)

- [ ] Criar modelo/entidade `Profile`
- [ ] Implementar endpoints CRUD
- [ ] Adicionar validações
- [ ] Testar com Postman/Insomnia

### 4️⃣ API - Menu Items (2 horas)

- [ ] Criar modelo/entidade `MenuItem`
- [ ] Implementar endpoints CRUD
- [ ] Implementar endpoint de reordenação
- [ ] Testar com Postman/Insomnia

### 5️⃣ Middleware de Autorização (3 horas)

- [ ] Implementar authentication middleware (JWT)
- [ ] Implementar authorization middleware (role + perfil)
- [ ] Implementar company scope middleware
- [ ] Testar fluxos de acesso

### 6️⃣ Testes (2 horas)

- [ ] Testes unitários dos endpoints
- [ ] Testes de integração (fluxo completo)
- [ ] Testes de autorização (acesso negado)
- [ ] Validar regras de negócio

### 7️⃣ Documentação (1 hora)

- [ ] Documentar API com Swagger/OpenAPI
- [ ] Atualizar README do backend
- [ ] Criar guia de deploy

---

## 📊 Estrutura Simplificada

```
┌─────────────────────┐
│  polox.companies    │ ✅ JÁ EXISTE
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│  polox.users        │ ✅ JÁ EXISTE (adicionar profile_id)
│  + profile_id ────►│ polox.profiles │ 🆕 NOVA
└─────────────────────┘ └────────────────┘

┌─────────────────────┐
│ polox.menu_items    │ 🆕 NOVA
└──────┬──────────────┘
       │
       ▼
┌──────────────────────────────┐
│ menu_company_permissions     │ 🆕 NOVA
└──────────────────────────────┘
```

---

## 🔐 Controle de Acesso

### Hierarquia de Permissões

```
super_admin
    └─► Acesso total ao sistema
    └─► Gerencia empresas
    └─► Configura perfis e menus
    └─► Não precisa de company_id

admin
    └─► Administrador de UMA empresa
    └─► Limitado ao escopo da empresa
    └─► Permissões definidas pelo perfil
    └─► Deve ter company_id
```

### Fluxo de Autorização

```
Requisição → Autenticação (JWT) → Usuário válido?
                                          │
                                         Sim
                                          │
                                          ▼
                        Verificar role (super_admin ou admin)
                                          │
                                          ▼
                        Verificar perfil (screen_ids)
                                          │
                                          ▼
                        Tem permissão para a tela?
                                          │
                        ┌─────────────────┴──────────────────┐
                       Sim                                   Não
                        │                                     │
                        ▼                                     ▼
                  200 OK                               403 Forbidden
```

---

## 🆘 Troubleshooting

### Erro: Tabela já existe

```sql
-- Verificar se tabelas já foram criadas
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'polox'
  AND table_name IN ('profiles', 'menu_items', 'menu_company_permissions');
```

### Erro: Coluna profile_id já existe

```sql
-- Verificar se coluna já foi adicionada
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'polox'
  AND table_name = 'users'
  AND column_name = 'profile_id';
```

### Rollback (se necessário)

```sql
-- CUIDADO: Isso remove TODAS as alterações
DROP TABLE IF EXISTS polox.menu_company_permissions CASCADE;
DROP TABLE IF EXISTS polox.menu_items CASCADE;
DROP TABLE IF EXISTS polox.profiles CASCADE;
ALTER TABLE polox.users DROP COLUMN IF EXISTS profile_id;
```

---

## 📚 Recursos Adicionais

### Tecnologias Recomendadas

- **Backend:** Node.js (NestJS) ou Python (FastAPI)
- **ORM:** Prisma, TypeORM ou SQLAlchemy
- **Auth:** JWT (jsonwebtoken / PyJWT)
- **Validation:** Zod, Joi ou Pydantic

### Bibliotecas Úteis

```json
{
  "auth": "jsonwebtoken",
  "validation": "zod",
  "orm": "@prisma/client",
  "password": "bcrypt",
  "tests": "jest"
}
```

---

## 📞 Suporte

**Dúvidas sobre:**

- **Estrutura de tabelas:** Consultar `PERFIS_MENUS_API_SPEC.md` seção "Estrutura de Tabelas"
- **Endpoints da API:** Consultar `PERFIS_MENUS_API_SPEC.md` seção "Endpoints da API"
- **Lógica de negócio:** Consultar `PERFIS_MENUS_API_SPEC.md` seção "Regras de Negócio"
- **Implementação rápida:** Consultar `RESUMO_PERFIS_MENUS.md`

---

**Desenvolvedor:** Leonardo Polo Pereira  
**Empresa:** POLO X Manutencao de Equipamentos de Informatica LTDA  
**Contato:** contato@polox.com.br

---

**© 2025 POLO X - Todos os direitos reservados**
