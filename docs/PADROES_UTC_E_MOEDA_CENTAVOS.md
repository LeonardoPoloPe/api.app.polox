# Padrões de Tempo (UTC) e Moeda em Centavos

Este documento define as regras de ouro e a implementação prática para:

- Tempo: sempre trabalhar e armazenar em UTC no backend e banco de dados.
- Moeda: armazenar valores monetários como inteiros em centavos (nunca `float`/`decimal`).

Última atualização: 2025-10-30

---

## 1) Tempo: sempre UTC no backend e no banco

Regras de Ouro:

- Todos os timestamps salvos no PostgreSQL devem ser UTC.
- O backend (Lambda/Node.js) só lida com UTC. Conversões para horário local acontecem no frontend.
- Use colunas `TIMESTAMPTZ` com `DEFAULT now()` e garanta que a sessão está em UTC.

Implementação no projeto:

- Lambda (Serverless Framework): `provider.environment.TZ: UTC` em `serverless.yml` e `serverless-simple.yml`.
- Lambda (SAM): `Globals -> Function -> Environment -> Variables -> TZ: UTC` em `template.yaml`.
- Banco de Dados: `sql/setup_databases.sql` executa `ALTER DATABASE <db> SET timezone TO 'UTC'` para `dev`, `sandbox`, `prod`.
- Sessão do PostgreSQL: em `src/config/database.js`, no evento `pool.on('connect')`, executamos `SET TIME ZONE 'UTC'` antes do `SET search_path`.

Boas práticas no código:

- Evite `Date` sem timezone. Considere usar `new Date().toISOString()` quando precisar serializar.
- Para parsing/formatting no backend, mantenha UTC; no frontend, converta para o timezone do usuário.
- Nunca armazene datas como strings locais. Prefira `TIMESTAMPTZ` (UTC) no Postgres.

Checklist de verificação rápida:

- [ ] `TZ: UTC` presente nos descriptors de deploy (Serverless/SAM).
- [ ] `ALTER DATABASE ... SET timezone TO 'UTC'` aplicado (ou parameter group equivalente no RDS).
- [ ] `SET TIME ZONE 'UTC'` na inicialização de cada conexão.
- [ ] Colunas de data como `TIMESTAMPTZ`.

## 2) Moeda: armazenar como inteiros (centavos)

Regras de Ouro:

- Nunca armazene valores monetários como `FLOAT`/`DECIMAL(15,2)`.
- Armazene sempre como inteiro representando centavos. Ex.: R$ 19,99 -> `1999`.
- Valide entradas e padronize conversões nas bordas (entrada/saída da API).

Motivação:

- Evita erros de arredondamento e comparações inconsistentes.
- Facilita somas e agregações com precisão exata.

### 2.1 Escopo dos campos monetários

Principais áreas com valores monetários (exemplos):

- Vendas: `sales.total_amount`, `discount_amount`, `tax_amount`, `net_amount`, `commission_amount`.
- Itens de venda: `sale_items.unit_price`, `total_price`, `discount_amount`.
- Produtos: `products.cost_price`, `sale_price`.
- Financeiro: `financial_transactions.amount`; `financial_accounts.current_balance`, `initial_balance`; `suppliers.credit_limit`.
- Leads: `leads.conversion_value`.
- Métricas de cliente: `total_spent`, `average_order_value`, `lifetime_value`.
- Custom fields numéricos usados como moeda.

Obs.: Se algum total puder ultrapassar 2,1 bilhões de centavos (~ R$ 21 milhões), considere `BIGINT` em vez de `INTEGER`.

### 2.2 Estratégia de migração segura (2 etapas)

Etapa A – Adição e backfill (migração 034):

1. Adicionar colunas inteiras com sufixo `_cents` (ex.: `total_amount_cents INTEGER NOT NULL DEFAULT 0`).
2. Backfill: `UPDATE ... SET <col>_cents = ROUND(<col> * 100)`.
3. (Opcional) `CHECK (<col>_cents >= 0)` onde negativo não faz sentido.
4. Manter colunas DECIMAL antigas até a troca no código.

Etapa B – Troca no código + limpeza (migração 035):

1. Atualizar DAOs/Models/Repos para ler/gravar apenas nas colunas `_cents`.
2. Ajustar validações (Joi) para aceitar inteiros em centavos; se necessário, suportar temporariamente floats na API e converter imediatamente para centavos.
3. Ajustar serializers/respostas: retornar centavos ou converter para decimal apenas na fronteira (se compatibilidade exigir).
4. Atualizar testes e documentação (Swagger/i18n) para refletir o novo contrato.
5. Remover as colunas DECIMAL antigas após validação em produção (ou manter por 1 release como fallback antes de dropar).

Rollback:

- Mantenha as colunas antigas até estabilizar. Em fallback, volte a ler/gravar nelas, e reprocesse caso necessário.

### 2.3 Exemplo de migração (esqueleto)

Arquivo sugerido: `migrations/034_add_money_cents_columns.js`

- Up: `ALTER TABLE` para adicionar colunas `_cents` + backfill via `ROUND(DECIMAL * 100)`.
- Down: `ALTER TABLE` para remover as colunas `_cents` (apenas se seguro).

Arquivo sugerido: `migrations/035_drop_decimal_money_columns.js`

- Up: `ALTER TABLE` para dropar colunas DECIMAL antigas (após o switch no código).
- Down: Recriar as colunas DECIMAL (apenas se realmente necessário; prepare com cautela).

## 3) Integração com a aplicação

Entrada (Requests):

- Preferível: receba centavos como inteiros (`amount_cents: 1999`).
- Compatibilidade: se receber `amount: 19.99`, converta para centavos assim que possível (ex.: `reaisToCents`).

Saída (Responses):

- Preferível: retorne o inteiro em centavos (`amount_cents`).
- Compatibilidade: se necessário retornar decimal, converta a partir de centavos (ex.: `centsToReais`).

Helpers existentes:

- `src/utils/formatters*.js` contêm `reaisToCents()` e `centsToReais()`.

Validação (Joi):

- Atualize os esquemas para aceitar/normalizar centavos conforme o contrato definido.

## 4) Testes e observabilidade

Testes:

- Adicione testes para: arredondamento (0,005 -> 1 centavo), grandes somas, valores negativos (onde aplicável), e idempotência de backfills.
- Atualize fixtures e mocks para usar centavos.

Observabilidade:

- Logs e métricas devem indicar se os valores estão em centavos (ex.: campos com sufixo `_cents`).

## 5) Verificações operacionais

Antes do deploy da migração:

- Backup lógico das tabelas afetadas.
- Estimar tempo de backfill (rodar em janelas com menor tráfego, se necessário).

Pós-deploy:

- Consultas de sanity check (ex.: somatório em centavos vs. decimal histórico).
- Monitorar erros de validação/serialização nas bordas da API.

## 6) Referências no repositório

- `serverless.yml` e `serverless-simple.yml`: `TZ: UTC` na environment do provider.
- `template.yaml` (SAM): `Globals -> Function -> Environment -> Variables -> TZ: UTC`.
- `sql/setup_databases.sql`: timezone do banco alterado para `UTC`.
- `src/config/database.js`: `SET TIME ZONE 'UTC'` no `pool.on('connect')`.
- `src/utils/formatters*.js`: conversores centavos ↔ reais.

## 7) FAQ

- Por que UTC em todo lugar?

  - Consistência, ausência de ambiguidades em horário de verão e fusos, e interoperabilidade entre serviços.

- Por que inteiros em centavos e não DECIMAL(15,2)?

  - Precisão exata, simplicidade em comparações e agregações, e evitar armadilhas de arredondamento cruzando camadas diferentes.

- Posso usar BIGINT?
  - Sim, se seus volumes financeiros puderem ultrapassar o limite de `INTEGER` para centavos.
