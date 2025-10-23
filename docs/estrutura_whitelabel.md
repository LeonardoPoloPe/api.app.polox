# Estrutura White Label – API Polox

Este documento descreve as mudanças no modelo de dados (schema `polox`) para suportar a funcionalidade White Label. O objetivo é permitir que Parceiros (por exemplo, agências) utilizem e revendam o CRM Polo X sob sua própria marca para seus Clientes Finais (Tenants).

## Objetivo e visão geral

- Parceiro: é uma empresa no `polox.companies` com `company_type = 'partner'`. Esse registro mantém configurações de branding (logo, cores, domínio, etc.) que serão aplicadas aos seus Tenants.
- Tenant (Cliente Final): é uma empresa no `polox.companies` com `company_type = 'tenant'` e referência a um Parceiro por meio de `partner_id` (opcional). Quando vinculado a um Parceiro, herda as configurações de branding desse Parceiro.

A tabela `polox.companies` foi estendida para suportar essa relação e armazenar os metadados de White Label.

## Modificações na tabela `polox.companies`

Foram adicionados os seguintes campos, constraints e índices (ver script em `docs/sql/whitelabel_companies.sql`):

### 1) company_type (VARCHAR(10), NOT NULL, default 'tenant')
- Descreve o tipo de empresa: `tenant` (cliente final) ou `partner` (parceiro/agência).
- Constraint: `CHECK (company_type IN ('tenant','partner'))`.
- Índice: `idx_companies_company_type` para filtros e relatórios.

### 2) partner_id (BIGINT, NULL, FK para `polox.companies(id)`)
- Auto-referência que vincula um Tenant ao seu Parceiro.
- `ON DELETE SET NULL`: se o Parceiro for removido (soft delete não dispara), o vínculo do Tenant é desfeito sem excluir o Tenant.
- Índice: `idx_companies_partner_id` para facilitar listagens por parceiro.

### 3) Campos de Branding (todas as colunas NULL por padrão)
- `logo_url` (VARCHAR(500))
- `favicon_url` (VARCHAR(500))
- `primary_color` (VARCHAR(7)) – Ex.: `#0A84FF`
- `secondary_color` (VARCHAR(7))
- `custom_domain` (VARCHAR(100)) – Constraint: `UNIQUE (custom_domain)`
- `support_email` (VARCHAR(255))
- `support_phone` (VARCHAR(20))
- `terms_url` (VARCHAR(500))
- `privacy_url` (VARCHAR(500))

Observações:
- Tipicamente, esses campos serão preenchidos nos registros de `partner`. Tenants vinculados herdam tais configurações do respectivo Parceiro.
- `custom_domain` é único (múltiplos NULLs são permitidos pelo PostgreSQL).

### 4) tenant_plan (VARCHAR(50), NULL, opcional)
- Uso opcional para o plano comercial que um Parceiro vende a um Tenant (ex.: "Starter-Agência", "Pro-Agência").
- Constraint: somente Tenants podem possuir valor nesse campo.
  - `CHECK ((company_type = 'partner' AND tenant_plan IS NULL) OR (company_type = 'tenant'))`

## Como funciona na prática (exemplos)

1. Registro de Parceiro – Agência XYZ
   - `company_type = 'partner'`
   - `partner_id = NULL`
   - Branding preenchido (ex.: `logo_url`, `primary_color = '#123456'`, `custom_domain = 'crm.agenciaxyz.com'`, `support_email = 'suporte@agenciaxyz.com'`)
   - `tenant_plan = NULL`

2. Registro de Tenant – Loja ABC (cliente da Agência XYZ)
   - `company_type = 'tenant'`
   - `partner_id = <ID_da_Agencia_XYZ>`
   - Campos de branding do próprio Tenant normalmente `NULL` (herdará do parceiro)
   - `tenant_plan` opcionalmente preenchido conforme o plano comercial vendido pela Agência XYZ

3. Registro de Cliente Direto da Polo X (sem parceiro)
   - `company_type = 'tenant'`
   - `partner_id = NULL`
   - Campos de branding `NULL` (UI usa o branding padrão da Polo X)

## Impacto na lógica da aplicação (API)

### Carregamento de Branding
Ao iniciar a aplicação para um usuário:
1. Buscar a empresa do usuário via `users.company_id`.
2. Verificar `companies.partner_id`:
   - Se houver parceiro: carregar o registro do parceiro (`company_type = 'partner'`) e utilizar os campos de branding dele (`logo_url`, `primary_color`, `secondary_color`, `custom_domain`, `terms_url`, `privacy_url`, etc.).
   - Se não houver parceiro (`partner_id IS NULL`):
     - Se a empresa do usuário for um parceiro, usar o branding da própria empresa;
     - Caso contrário, usar o branding padrão da Polo X.

Sugestão de cache: como as configurações de branding mudam pouco, considerar cache leve por `partner_id` para reduzir consultas repetitivas.

### Permissões de Parceiro
Usuários pertencentes a uma empresa com `company_type = 'partner'` devem poder:
- Listar, visualizar e gerenciar empresas onde `partner_id = <ID_da_empresa_do_parceiro>`.
- Assegurar controles de acesso para impedir que um parceiro veja Tenants de outro parceiro.

### Criação de Tenants por Parceiros
Quando um usuário de um Parceiro cria uma nova empresa (Tenant):
- A API deve definir automaticamente:
  - `company_type = 'tenant'`
  - `partner_id = <ID_da_empresa_do_parceiro>`
- Opcionalmente, permitir definir `tenant_plan` no momento da criação.

## Diagrama simplificado

```
[Partner Company (company_type='partner')] 1 <-- * [Tenant Company (company_type='tenant', partner_id=X)]
         ^                                              ^
         |                                              |
 [User (Admin Partner)]                         [User (End Client)]
```

## Considerações de migração e índices

- O script em `docs/sql/whitelabel_companies.sql` executa todas as alterações dentro de uma transação e utiliza `IF NOT EXISTS`/guardas para segurança em reexecuções.
- Índices:
  - `idx_companies_company_type` otimiza filtros por tipo (relatórios, painéis).
  - `idx_companies_partner_id` otimiza listagens de Tenants por Parceiro.
  - `custom_domain` possui `UNIQUE` (case-sensitive por padrão). Se necessário, futuramente pode-se trocar por um índice único em `LOWER(custom_domain)` para unicidade case-insensitive.

## Próximos passos na API (resumo)

- Model `Company` (opcional evoluir): aceitar/retornar `company_type`, `partner_id` e campos de branding; validar a regra de `tenant_plan`.
- Middlewares/Services:
  - Resolver branding por `partner_id` na inicialização da sessão/tenant.
  - Enforçar autorização para empresas `partner` sobre seus Tenants (`partner_id = partner.id`).
- Endpoints de criação:
  - Ao criar Tenant por um Parceiro: setar `company_type = 'tenant'` e `partner_id = partner.id` automaticamente.

Com isso, a base de dados fica preparada para o modelo White Label, e a API pode aplicar as regras de branding e permissões conforme descrito acima.
