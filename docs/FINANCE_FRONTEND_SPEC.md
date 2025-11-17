# 📊 Especificação Frontend - Módulo Financeiro

**Documento técnico para desenvolvimento do frontend React**  
**API Base URL:** `http://localhost:3000/api/v1`  
**Versão da API:** 1.0.0  
**Data:** 17/11/2025

---

## 🎯 Visão Geral

Sistema completo de gestão financeira com dashboard, transações, categorias, fluxo de caixa e DRE. Interface moderna e responsiva usando React com foco em experiência do usuário e visualização de dados.

---

## 🔐 Autenticação

Todas as requisições devem incluir:

```javascript
headers: {
  'Authorization': `Bearer ${token}`,
  'Accept-Language': 'pt', // ou 'en', 'es'
  'Content-Type': 'application/json'
}
```

---

## 📱 Estrutura de Telas

### 1. Dashboard Financeiro (`/finance/dashboard`)

**Rota da API:** `GET /finance/dashboard?period=month`

#### Layout Sugerido:

```
┌─────────────────────────────────────────────────────────────┐
│  📊 Dashboard Financeiro                    [Filtro: Mês ▼] │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ 💰 Receita│  │ 💸 Despesa│  │ 📈 Lucro │  │ 📊 Margem│   │
│  │  R$ 45k   │  │  R$ 28k   │  │  R$ 17k  │  │  37.78%  │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 📈 Evolução Mensal (Últimos 12 Meses)              │   │
│  │                                                       │   │
│  │  [Gráfico de Linha: Receitas vs Despesas]          │   │
│  │                                                       │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                               │
│  ┌──────────────────────┐  ┌──────────────────────────┐   │
│  │ 💵 Top 10 Despesas  │  │ ⏰ Próximos Vencimentos  │   │
│  │                      │  │                          │   │
│  │ 1. Salários: 15k    │  │ • Hoje: R$ 2.500        │   │
│  │ 2. Aluguel: 5k      │  │ • Amanhã: R$ 1.200      │   │
│  │ 3. Marketing: 3k    │  │ • Esta semana: R$ 8k    │   │
│  │ ...                  │  │ ...                      │   │
│  └──────────────────────┘  └──────────────────────────┘   │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 💹 Previsão de Fluxo de Caixa (30 dias)           │   │
│  │                                                       │   │
│  │  [Gráfico de Barras: Entradas e Saídas Previstas] │   │
│  │                                                       │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

#### Componentes React Sugeridos:

```jsx
<FinanceDashboard>
  <DashboardHeader period={period} onPeriodChange={setPeriod} />
  
  <MetricsRow>
    <MetricCard icon="💰" label="Receitas" value={totalIncome} color="green" />
    <MetricCard icon="💸" label="Despesas" value={totalExpenses} color="red" />
    <MetricCard icon="📈" label="Lucro Líquido" value={netIncome} color="blue" />
    <MetricCard icon="📊" label="Margem" value={profitMargin} suffix="%" />
  </MetricsRow>

  <ChartCard title="Evolução Mensal">
    <LineChart data={evolution} xKey="month" lines={['income', 'expenses']} />
  </ChartCard>

  <TwoColumnLayout>
    <TopExpensesCard data={topExpenseCategories} />
    <UpcomingTransactionsCard data={upcomingTransactions} />
  </TwoColumnLayout>

  <ChartCard title="Previsão de Fluxo de Caixa">
    <BarChart data={cashFlowForecast} />
  </ChartCard>
</FinanceDashboard>
```

#### Request/Response:

```javascript
// Request
GET /finance/dashboard?period=month

// Response
{
  "success": true,
  "data": {
    "period": "month",
    "summary": {
      "total_income": 45000.00,
      "total_expenses": 28000.00,
      "net_income": 17000.00,
      "profit_margin": 37.78,
      "pending_income": 12000.00,
      "pending_expenses": 5000.00,
      "overdue_income": 2000.00,
      "overdue_expenses": 1500.00,
      "income_count": 25,
      "expense_count": 18
    },
    "evolution": [
      {
        "month": "2025-10-01T00:00:00Z",
        "income": 42000.00,
        "expenses": 26000.00,
        "net": 16000.00
      }
    ],
    "top_expense_categories": [
      {
        "category_name": "Salários",
        "total_amount": 15000.00,
        "transaction_count": 5,
        "avg_amount": 3000.00
      }
    ],
    "upcoming_transactions": [
      {
        "id": "123",
        "type": "income",
        "amount": 3000.00,
        "description": "Recebimento Cliente XYZ",
        "due_date": "2025-11-20",
        "urgency": "due_soon"
      }
    ],
    "cash_flow_forecast": [
      {
        "date": "2025-11-17",
        "expected_income": 5000.00,
        "expected_expenses": 2000.00,
        "net_flow": 3000.00
      }
    ]
  }
}
```

---

### 2. Listagem de Transações (`/finance/transactions`)

**Rota da API:** `GET /finance/transactions`

#### Layout Sugerido:

```
┌─────────────────────────────────────────────────────────────┐
│  💳 Transações Financeiras              [+ Nova Transação]  │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  🔍 Buscar: [_____________]  Tipo: [Todos ▼]  Status: [▼]  │
│  Categoria: [Todas ▼]  De: [__/__/__]  Até: [__/__/__]     │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Resumo dos Filtros:                                  │   │
│  │ Receitas: R$ 25.000 | Despesas: R$ 18.000 | Saldo: +7k│   │
│  └─────────────────────────────────────────────────────┘   │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Data     │Descrição       │Categoria  │Valor    │[⋮]│  │
│  ├──────────┼────────────────┼───────────┼─────────┼───┤  │
│  │ 16/11/25 │Venda #1234     │Vendas     │+R$ 1.5k │⚙️│  │
│  │ 15/11/25 │Aluguel Nov     │Aluguel    │-R$ 5k   │⚙️│  │
│  │ 14/11/25 │Comissão João   │Comissões  │+R$ 800  │⚙️│  │
│  │ 13/11/25 │Marketing FB    │Marketing  │-R$ 300  │⚙️│  │
│  └──────────────────────────────────────────────────────┘  │
│                                                               │
│  [◄] Página 1 de 3                          [20 por página] │
└─────────────────────────────────────────────────────────────┘
```

#### Componentes React:

```jsx
<TransactionsList>
  <PageHeader 
    title="Transações Financeiras"
    action={<Button onClick={openNewTransactionModal}>+ Nova Transação</Button>}
  />
  
  <FiltersBar>
    <SearchInput value={search} onChange={setSearch} placeholder="Buscar..." />
    <Select label="Tipo" value={typeFilter} options={['Todos', 'Receitas', 'Despesas']} />
    <Select label="Status" value={statusFilter} options={['Todos', 'Pago', 'Pendente', 'Vencido']} />
    <Select label="Categoria" value={categoryFilter} options={categories} />
    <DateRangePicker from={dateFrom} to={dateTo} />
  </FiltersBar>

  <SummaryCard>
    <Metric label="Receitas" value={totals.income} color="green" />
    <Metric label="Despesas" value={totals.expenses} color="red" />
    <Metric label="Saldo" value={totals.net} color={totals.net >= 0 ? 'green' : 'red'} />
  </SummaryCard>

  <DataTable
    columns={columns}
    data={transactions}
    onRowClick={handleRowClick}
    actions={rowActions}
  />

  <Pagination
    currentPage={page}
    totalPages={pagination.pages}
    onPageChange={setPage}
    itemsPerPage={limit}
    onItemsPerPageChange={setLimit}
  />
</TransactionsList>
```

#### Request/Response:

```javascript
// Request
GET /finance/transactions?page=1&limit=20&type=income&status=paid&category_id=uuid&date_from=2025-11-01&date_to=2025-11-30&search=venda

// Response
{
  "success": true,
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "type": "income",
      "amount": 1500.50,
      "description": "Venda produto #1234",
      "category_name": "Vendas",
      "payment_method": "Cartão de Crédito",
      "status": "paid",
      "paid_date": "2025-11-16",
      "created_at": "2025-11-16T10:00:00Z",
      "created_by_name": "João Silva"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 52,
    "pages": 3
  },
  "totals": {
    "income": 25000.00,
    "expenses": 18000.00,
    "net": 7000.00
  }
}
```

---

### 3. Criar/Editar Transação (Modal ou Página)

**Rotas da API:** 
- `POST /finance/transactions` (criar)
- `PUT /finance/transactions/:id` (editar)

#### Layout do Formulário:

```
┌─────────────────────────────────────────────────┐
│  💳 Nova Transação                       [✕]    │
├─────────────────────────────────────────────────┤
│                                                   │
│  Tipo *                                          │
│  ⦿ Receita    ○ Despesa                         │
│                                                   │
│  Valor * (R$)                                    │
│  [________________]                               │
│                                                   │
│  Descrição *                                     │
│  [_________________________________________]    │
│                                                   │
│  Categoria                                       │
│  [Selecione ou digite nova... ▼]                │
│                                                   │
│  Método de Pagamento                            │
│  [Cartão de Crédito ▼]                          │
│                                                   │
│  Status                                          │
│  ⦿ Pago    ○ Pendente    ○ Vencido             │
│                                                   │
│  ┌──────────────┐  ┌──────────────┐            │
│  │ Data Venc.   │  │ Data Pgto    │            │
│  │ [__/__/____] │  │ [__/__/____] │            │
│  └──────────────┘  └──────────────┘            │
│                                                   │
│  ☐ Transação Recorrente                         │
│    Frequência: [Mensal ▼]                       │
│                                                   │
│  Tags (opcional)                                 │
│  [+ Adicionar tag]                               │
│  • vendas  • online  • produto-digital          │
│                                                   │
│  Observações                                     │
│  [_________________________________________]    │
│  [_________________________________________]    │
│                                                   │
│            [Cancelar]  [Salvar Transação]       │
└─────────────────────────────────────────────────┘
```

#### Componentes React:

```jsx
<TransactionForm onSubmit={handleSubmit} initialData={transaction}>
  <RadioGroup
    label="Tipo"
    name="type"
    required
    options={[
      { value: 'income', label: '💰 Receita' },
      { value: 'expense', label: '💸 Despesa' }
    ]}
  />

  <CurrencyInput
    label="Valor"
    name="amount"
    required
    prefix="R$"
  />

  <TextInput
    label="Descrição"
    name="description"
    required
    maxLength={255}
  />

  <CategorySelect
    label="Categoria"
    name="category_id"
    createable
    options={categories}
    filterByType={type}
  />

  <Select
    label="Método de Pagamento"
    name="payment_method"
    options={['Dinheiro', 'Cartão de Crédito', 'Cartão de Débito', 'PIX', 'Transferência', 'Boleto']}
  />

  <RadioGroup
    label="Status"
    name="status"
    options={[
      { value: 'paid', label: '✅ Pago' },
      { value: 'pending', label: '⏳ Pendente' },
      { value: 'cancelled', label: '❌ Cancelado' }
    ]}
  />

  <DatePicker label="Data de Vencimento" name="due_date" />
  <DatePicker label="Data de Pagamento" name="paid_date" />

  <Checkbox
    label="Transação Recorrente"
    name="recurring"
    onChange={(checked) => setShowRecurringOptions(checked)}
  />

  {showRecurringOptions && (
    <Select
      label="Frequência"
      name="recurring_frequency"
      options={['monthly', 'yearly']}
    />
  )}

  <TagInput
    label="Tags"
    name="tags"
    suggestions={popularTags}
  />

  <TextArea
    label="Observações"
    name="notes"
    rows={3}
    maxLength={1000}
  />

  <FormActions>
    <Button variant="secondary" onClick={onCancel}>Cancelar</Button>
    <Button type="submit" variant="primary">Salvar Transação</Button>
  </FormActions>
</TransactionForm>
```

#### Request/Response:

```javascript
// Request - Criar
POST /finance/transactions
{
  "type": "income",
  "amount": 1500.50,
  "description": "Venda de produto #1234",
  "category_name": "Vendas de Produtos",
  "payment_method": "Cartão de Crédito",
  "status": "paid",
  "paid_date": "2025-11-16",
  "reference_type": "sale",
  "reference_id": "SALE-1234",
  "tags": ["vendas", "online", "produto-digital"],
  "notes": "Cliente solicitou nota fiscal"
}

// Response
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "type": "income",
    "amount": 1500.50,
    "description": "Venda de produto #1234",
    "category_id": "60ddbaa2-407d-4c6a-ad6b-a2e57710a559",
    "status": "paid",
    "created_at": "2025-11-16T10:00:00Z"
  },
  "message": "Transação criada com sucesso"
}
```

---

### 4. Categorias Financeiras (`/finance/categories`)

**Rotas da API:** 
- `GET /finance/categories` (listar)
- `POST /finance/categories` (criar)

#### Layout:

```
┌─────────────────────────────────────────────────┐
│  🏷️  Categorias Financeiras    [+ Nova Categoria]│
├─────────────────────────────────────────────────┤
│                                                   │
│  Filtrar: [Todas ▼] [Receitas] [Despesas]       │
│                                                   │
│  ┌───────────────────────────────────────────┐  │
│  │ Categorias de Receita                     │  │
│  ├───────────────────────────────────────────┤  │
│  │ • Vendas de Produtos (25 transações) ⚙️  │  │
│  │ • Prestação de Serviços (12 transações)  │  │
│  │ • Comissões (8 transações)                │  │
│  └───────────────────────────────────────────┘  │
│                                                   │
│  ┌───────────────────────────────────────────┐  │
│  │ Categorias de Despesa                     │  │
│  ├───────────────────────────────────────────┤  │
│  │ • Aluguel (1 transação)                   │  │
│  │ • Salários e Encargos (5 transações)      │  │
│  │ • Marketing e Publicidade (15 transações) │  │
│  │   ├─ Marketing Digital (10 transações)    │  │
│  │   └─ Marketing Offline (5 transações)     │  │
│  └───────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
```

#### Componentes React:

```jsx
<CategoriesList>
  <PageHeader
    title="Categorias Financeiras"
    action={<Button onClick={openNewCategoryModal}>+ Nova Categoria</Button>}
  />

  <FilterTabs
    active={typeFilter}
    onChange={setTypeFilter}
    tabs={[
      { value: 'all', label: 'Todas' },
      { value: 'income', label: 'Receitas' },
      { value: 'expense', label: 'Despesas' }
    ]}
  />

  <CategoriesGrid>
    <CategorySection title="Categorias de Receita">
      {incomeCategories.map(category => (
        <CategoryCard
          key={category.id}
          category={category}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      ))}
    </CategorySection>

    <CategorySection title="Categorias de Despesa">
      {expenseCategories.map(category => (
        <CategoryCard
          key={category.id}
          category={category}
          showChildren={true}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      ))}
    </CategorySection>
  </CategoriesGrid>
</CategoriesList>
```

#### Modal de Criação:

```jsx
<CategoryForm onSubmit={handleSubmit}>
  <TextInput
    label="Nome da Categoria"
    name="name"
    required
    placeholder="Ex: Vendas de Produtos"
  />

  <TextArea
    label="Descrição"
    name="description"
    placeholder="Descrição detalhada da categoria"
  />

  <RadioGroup
    label="Tipo"
    name="type"
    required
    options={[
      { value: 'income', label: '💰 Receitas' },
      { value: 'expense', label: '💸 Despesas' },
      { value: 'both', label: '🔄 Ambos' }
    ]}
  />

  <Select
    label="Categoria Pai (opcional)"
    name="parent_id"
    options={parentCategories}
    placeholder="Selecione para criar subcategoria"
  />

  <Checkbox
    label="Categoria Ativa"
    name="is_active"
    defaultChecked={true}
  />

  <FormActions>
    <Button variant="secondary" onClick={onCancel}>Cancelar</Button>
    <Button type="submit" variant="primary">Criar Categoria</Button>
  </FormActions>
</CategoryForm>
```

#### Request/Response:

```javascript
// Request - Listar
GET /finance/categories?type=income

// Response
{
  "success": true,
  "data": [
    {
      "id": "60ddbaa2-407d-4c6a-ad6b-a2e57710a559",
      "company_id": "25",
      "name": "Vendas de Produtos",
      "description": "Receitas provenientes da venda de produtos",
      "type": "income",
      "parent_id": null,
      "is_active": true,
      "transaction_count": 25,
      "total_amount": 45000.00,
      "created_at": "2025-11-17T02:15:49.214Z"
    }
  ]
}

// Request - Criar
POST /finance/categories
{
  "name": "Marketing Digital",
  "description": "Despesas com marketing online",
  "type": "expense",
  "parent_id": "60ddbaa2-407d-4c6a-ad6b-a2e57710a559",
  "is_active": true
}

// Response
{
  "success": true,
  "data": {
    "id": "new-uuid",
    "name": "Marketing Digital",
    "type": "expense",
    "is_active": true
  },
  "message": "Categoria financeira criada com sucesso"
}
```

---

### 5. Fluxo de Caixa (`/finance/cash-flow`)

**Rota da API:** `GET /finance/cash-flow?period=30&include_pending=true`

#### Layout:

```
┌─────────────────────────────────────────────────┐
│  💹 Fluxo de Caixa                              │
├─────────────────────────────────────────────────┤
│                                                   │
│  Período: [30 dias ▼]  ☑️ Incluir pendentes     │
│                                                   │
│  ┌─────────────────────────────────────────┐   │
│  │ Resumo do Período                        │   │
│  ├──────────────┬───────────────────────────┤   │
│  │ Receitas     │ R$ 45.000,00             │   │
│  │ Despesas     │ R$ 28.000,00             │   │
│  │ Saldo Líq.   │ R$ 17.000,00 ✅          │   │
│  │ Saldo Final  │ R$ 27.000,00             │   │
│  │ Média Diária │ R$ 1.500,00 / R$ 933,33  │   │
│  └──────────────┴───────────────────────────┘   │
│                                                   │
│  ┌─────────────────────────────────────────┐   │
│  │ [Gráfico de Área: Fluxo de Caixa]      │   │
│  │                                          │   │
│  │  Linha Verde: Receitas                  │   │
│  │  Linha Vermelha: Despesas               │   │
│  │  Linha Azul: Saldo Acumulado            │   │
│  │                                          │   │
│  └─────────────────────────────────────────┘   │
│                                                   │
│  ┌─────────────────────────────────────────┐   │
│  │ Detalhamento Diário                      │   │
│  ├────────┬──────────┬──────────┬──────────┤   │
│  │ Data   │ Entradas │ Saídas   │ Saldo    │   │
│  ├────────┼──────────┼──────────┼──────────┤   │
│  │ 17/11  │ 5.000,00 │ 2.000,00 │ 3.000,00│   │
│  │ 18/11  │ 1.500,00 │ 3.500,00 │-2.000,00│   │
│  │ 19/11  │ 8.000,00 │ 1.000,00 │ 7.000,00│   │
│  └────────┴──────────┴──────────┴──────────┘   │
└─────────────────────────────────────────────────┘
```

#### Componentes React:

```jsx
<CashFlowReport>
  <PageHeader title="Fluxo de Caixa" />

  <FiltersBar>
    <Select
      label="Período"
      value={period}
      options={[
        { value: 7, label: '7 dias' },
        { value: 30, label: '30 dias' },
        { value: 60, label: '60 dias' },
        { value: 90, label: '90 dias' }
      ]}
      onChange={setPeriod}
    />
    <Checkbox
      label="Incluir transações pendentes"
      checked={includePending}
      onChange={setIncludePending}
    />
  </FiltersBar>

  <SummaryCard>
    <SummaryItem label="Receitas Totais" value={summary.total_income} color="green" />
    <SummaryItem label="Despesas Totais" value={summary.total_expenses} color="red" />
    <SummaryItem label="Fluxo Líquido" value={summary.net_flow} color={summary.net_flow >= 0 ? 'green' : 'red'} />
    <SummaryItem label="Saldo Final" value={summary.final_balance} />
    <SummaryItem label="Média Diária (Receitas)" value={summary.avg_daily_income} />
    <SummaryItem label="Média Diária (Despesas)" value={summary.avg_daily_expenses} />
  </SummaryCard>

  <ChartCard title="Visualização do Fluxo">
    <AreaChart
      data={cashFlow}
      xKey="date"
      areas={[
        { key: 'income', color: 'green', label: 'Receitas' },
        { key: 'expenses', color: 'red', label: 'Despesas' },
        { key: 'accumulated_balance', color: 'blue', label: 'Saldo Acumulado' }
      ]}
    />
  </ChartCard>

  <DataTable
    title="Detalhamento Diário"
    columns={[
      { key: 'date', label: 'Data', format: 'date' },
      { key: 'income', label: 'Entradas', format: 'currency', color: 'green' },
      { key: 'expenses', label: 'Saídas', format: 'currency', color: 'red' },
      { key: 'net_flow', label: 'Saldo do Dia', format: 'currency', colorByValue: true },
      { key: 'accumulated_balance', label: 'Saldo Acumulado', format: 'currency' }
    ]}
    data={cashFlow}
  />
</CashFlowReport>
```

---

### 6. DRE - Demonstração de Resultado (`/finance/profit-loss`)

**Rota da API:** `GET /finance/profit-loss?period=month&year=2025&month=11`

#### Layout:

```
┌─────────────────────────────────────────────────┐
│  📋 DRE - Demonstração de Resultado             │
├─────────────────────────────────────────────────┤
│                                                   │
│  Período: [Mês ▼]  Ano: [2025]  Mês: [Nov ▼]   │
│                                                   │
│  ┌─────────────────────────────────────────┐   │
│  │ RECEITAS                                 │   │
│  ├─────────────────────────────────────────┤   │
│  │ Vendas de Produtos        R$ 35.000,00  │   │
│  │ Prestação de Serviços     R$ 10.000,00  │   │
│  ├─────────────────────────────────────────┤   │
│  │ RECEITA BRUTA            R$ 45.000,00   │   │
│  └─────────────────────────────────────────┘   │
│                                                   │
│  ┌─────────────────────────────────────────┐   │
│  │ DESPESAS                                 │   │
│  ├─────────────────────────────────────────┤   │
│  │ Salários e Encargos       R$ 15.000,00  │   │
│  │ Aluguel                   R$  5.000,00  │   │
│  │ Marketing                 R$  3.000,00  │   │
│  │ Fornecedores              R$  5.000,00  │   │
│  ├─────────────────────────────────────────┤   │
│  │ DESPESAS TOTAIS          R$ 28.000,00   │   │
│  └─────────────────────────────────────────┘   │
│                                                   │
│  ┌─────────────────────────────────────────┐   │
│  │ RESULTADO                                │   │
│  ├─────────────────────────────────────────┤   │
│  │ Lucro Bruto              R$ 17.000,00   │   │
│  │ Margem de Lucro          37.78%         │   │
│  │ EBITDA                   R$ 18.500,00   │   │
│  └─────────────────────────────────────────┘   │
│                                                   │
│  [Exportar PDF] [Exportar Excel]                │
└─────────────────────────────────────────────────┘
```

#### Componentes React:

```jsx
<ProfitLossReport>
  <PageHeader title="DRE - Demonstração de Resultado" />

  <FiltersBar>
    <Select
      label="Período"
      value={period}
      options={['week', 'month', 'quarter', 'year']}
      onChange={setPeriod}
    />
    {period === 'month' && (
      <>
        <NumberInput label="Ano" value={year} onChange={setYear} />
        <Select label="Mês" value={month} options={monthOptions} onChange={setMonth} />
      </>
    )}
  </FiltersBar>

  <DRECard>
    <Section title="RECEITAS" color="green">
      {revenues.items.map(item => (
        <LineItem
          key={item.category}
          label={item.category}
          value={item.amount}
          percentage={(item.amount / revenues.total) * 100}
          transactions={item.transactions}
        />
      ))}
      <TotalLine label="RECEITA BRUTA" value={revenues.total} />
    </Section>

    <Section title="DESPESAS" color="red">
      {expenses.items.map(item => (
        <LineItem
          key={item.category}
          label={item.category}
          value={item.amount}
          percentage={(item.amount / expenses.total) * 100}
          transactions={item.transactions}
        />
      ))}
      <TotalLine label="DESPESAS TOTAIS" value={expenses.total} />
    </Section>

    <Section title="RESULTADO" color="blue">
      <ResultLine
        label="Lucro Bruto"
        value={summary.gross_profit}
        highlight
      />
      <ResultLine
        label="Margem de Lucro"
        value={summary.profit_margin_percent}
        suffix="%"
      />
      <ResultLine
        label="EBITDA"
        value={summary.operational_expenses}
      />
    </Section>
  </DRECard>

  <ExportActions>
    <Button onClick={exportToPDF}>📄 Exportar PDF</Button>
    <Button onClick={exportToExcel}>📊 Exportar Excel</Button>
  </ExportActions>
</ProfitLossReport>
```

---

## 🎨 Design System Sugerido

### Paleta de Cores:

```javascript
const colors = {
  // Receitas/Positivo
  green: {
    light: '#10B981',
    main: '#059669',
    dark: '#047857'
  },
  // Despesas/Negativo
  red: {
    light: '#EF4444',
    main: '#DC2626',
    dark: '#B91C1C'
  },
  // Neutro/Info
  blue: {
    light: '#3B82F6',
    main: '#2563EB',
    dark: '#1D4ED8'
  },
  // Alertas
  yellow: {
    light: '#FBBF24',
    main: '#F59E0B',
    dark: '#D97706'
  },
  // Backgrounds
  gray: {
    50: '#F9FAFB',
    100: '#F3F4F6',
    200: '#E5E7EB',
    300: '#D1D5DB',
    500: '#6B7280',
    700: '#374151',
    900: '#111827'
  }
}
```

### Ícones Sugeridos:

- 💰 Receitas
- 💸 Despesas
- 📈 Lucro/Crescimento
- 📉 Prejuízo/Queda
- 💳 Transações
- 🏷️ Categorias
- 💹 Fluxo de Caixa
- 📋 Relatórios
- ⏰ Pendentes
- ✅ Pago
- ❌ Cancelado
- ⚠️ Vencido

---

## 📦 Bibliotecas Recomendadas

### Essenciais:

```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-router-dom": "^6.20.0",
    "axios": "^1.6.0",
    "@tanstack/react-query": "^5.0.0",
    "date-fns": "^2.30.0",
    "react-hook-form": "^7.48.0",
    "zod": "^3.22.0"
  }
}
```

### Gráficos:

```json
{
  "dependencies": {
    "recharts": "^2.10.0",
    // ou
    "chart.js": "^4.4.0",
    "react-chartjs-2": "^5.2.0"
  }
}
```

### UI Components:

```json
{
  "dependencies": {
    "@headlessui/react": "^1.7.0",
    "@heroicons/react": "^2.0.0",
    "clsx": "^2.0.0",
    "tailwindcss": "^3.3.0"
    // ou
    "@mui/material": "^5.14.0",
    "@mui/x-data-grid": "^6.18.0",
    "@mui/x-date-pickers": "^6.18.0"
  }
}
```

### Formatação:

```json
{
  "dependencies": {
    "react-number-format": "^5.3.0",
    "react-currency-input-field": "^3.6.0"
  }
}
```

---

## 🔧 Utilitários e Helpers

### API Client:

```javascript
// src/services/api.js
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:3000/api/v1',
  headers: {
    'Content-Type': 'application/json'
  }
});

// Interceptor para adicionar token
api.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  
  const lang = localStorage.getItem('language') || 'pt';
  config.headers['Accept-Language'] = lang;
  
  return config;
});

// Interceptor para tratar erros
api.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      // Redirecionar para login
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
```

### Finance Service:

```javascript
// src/services/financeService.js
import api from './api';

export const financeService = {
  // Dashboard
  getDashboard: (period = 'month') =>
    api.get(`/finance/dashboard?period=${period}`),

  // Transações
  getTransactions: (params) =>
    api.get('/finance/transactions', { params }),
  
  createTransaction: (data) =>
    api.post('/finance/transactions', data),
  
  updateTransaction: (id, data) =>
    api.put(`/finance/transactions/${id}`, data),
  
  deleteTransaction: (id) =>
    api.delete(`/finance/transactions/${id}`),

  // Categorias
  getCategories: (type) =>
    api.get('/finance/categories', { params: { type } }),
  
  createCategory: (data) =>
    api.post('/finance/categories', data),

  // Fluxo de Caixa
  getCashFlow: (period = 30, includePending = true) =>
    api.get(`/finance/cash-flow?period=${period}&include_pending=${includePending}`),

  // DRE
  getProfitLoss: (params) =>
    api.get('/finance/profit-loss', { params })
};
```

### React Query Hooks:

```javascript
// src/hooks/useFinance.js
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { financeService } from '../services/financeService';

// Dashboard
export const useDashboard = (period) => {
  return useQuery({
    queryKey: ['dashboard', period],
    queryFn: () => financeService.getDashboard(period),
    select: (response) => response.data
  });
};

// Transações
export const useTransactions = (filters) => {
  return useQuery({
    queryKey: ['transactions', filters],
    queryFn: () => financeService.getTransactions(filters),
    select: (response) => response.data
  });
};

export const useCreateTransaction = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: financeService.createTransaction,
    onSuccess: () => {
      queryClient.invalidateQueries(['transactions']);
      queryClient.invalidateQueries(['dashboard']);
      queryClient.invalidateQueries(['cash-flow']);
    }
  });
};

export const useUpdateTransaction = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, data }) => financeService.updateTransaction(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['transactions']);
      queryClient.invalidateQueries(['dashboard']);
    }
  });
};

// Categorias
export const useCategories = (type) => {
  return useQuery({
    queryKey: ['categories', type],
    queryFn: () => financeService.getCategories(type),
    select: (response) => response.data.data
  });
};

export const useCreateCategory = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: financeService.createCategory,
    onSuccess: () => {
      queryClient.invalidateQueries(['categories']);
    }
  });
};

// Fluxo de Caixa
export const useCashFlow = (period, includePending) => {
  return useQuery({
    queryKey: ['cash-flow', period, includePending],
    queryFn: () => financeService.getCashFlow(period, includePending),
    select: (response) => response.data.data
  });
};

// DRE
export const useProfitLoss = (params) => {
  return useQuery({
    queryKey: ['profit-loss', params],
    queryFn: () => financeService.getProfitLoss(params),
    select: (response) => response.data.data
  });
};
```

### Formatadores:

```javascript
// src/utils/formatters.js

export const formatCurrency = (value) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
};

export const formatDate = (date) => {
  return new Intl.DateTimeFormat('pt-BR').format(new Date(date));
};

export const formatPercent = (value) => {
  return `${value.toFixed(2)}%`;
};

export const getTransactionColor = (type) => {
  return type === 'income' ? 'green' : 'red';
};

export const getStatusBadgeColor = (status) => {
  const colors = {
    paid: 'green',
    pending: 'yellow',
    overdue: 'red',
    cancelled: 'gray'
  };
  return colors[status] || 'gray';
};

export const getUrgencyColor = (urgency) => {
  const colors = {
    overdue: 'red',
    due_soon: 'orange',
    due_month: 'yellow',
    scheduled: 'gray'
  };
  return colors[urgency] || 'gray';
};
```

---

## 🔒 Validações (usando Zod)

```javascript
// src/schemas/transactionSchema.js
import { z } from 'zod';

export const transactionSchema = z.object({
  type: z.enum(['income', 'expense'], {
    required_error: 'Tipo é obrigatório'
  }),
  amount: z.number({
    required_error: 'Valor é obrigatório'
  }).positive('Valor deve ser maior que zero'),
  description: z.string({
    required_error: 'Descrição é obrigatória'
  }).max(255, 'Descrição muito longa'),
  category_id: z.string().uuid().optional(),
  category_name: z.string().max(100).optional(),
  payment_method: z.string().max(100).optional(),
  status: z.enum(['pending', 'paid', 'overdue', 'cancelled']).default('pending'),
  due_date: z.string().optional(),
  paid_date: z.string().optional(),
  recurring: z.boolean().default(false),
  recurring_frequency: z.enum(['monthly', 'yearly']).optional(),
  tags: z.array(z.string()).default([]),
  notes: z.string().max(1000).optional()
}).refine(
  (data) => data.category_id || data.category_name,
  { message: 'Informe uma categoria existente ou crie uma nova' }
);

export const categorySchema = z.object({
  name: z.string({
    required_error: 'Nome é obrigatório'
  }).min(2).max(100),
  description: z.string().max(255).optional(),
  type: z.enum(['income', 'expense', 'both']).default('both'),
  parent_id: z.string().uuid().optional(),
  is_active: z.boolean().default(true)
});
```

---

## 📱 Responsividade

### Breakpoints Sugeridos:

```javascript
const breakpoints = {
  mobile: '320px',   // até 640px
  tablet: '640px',   // até 1024px
  desktop: '1024px', // até 1280px
  wide: '1280px'     // acima de 1280px
};
```

### Comportamento:

- **Mobile:** 
  - Cards empilhados verticalmente
  - Tabelas com scroll horizontal
  - Menu hambúrguer
  - Modais em tela cheia

- **Tablet:** 
  - Layout em 2 colunas
  - Gráficos redimensionados
  - Sidebar colapsável

- **Desktop:** 
  - Layout completo em 3-4 colunas
  - Sidebar fixa
  - Todos os gráficos visíveis

---

## ⚡ Performance

### Otimizações Recomendadas:

1. **Lazy Loading de Rotas:**
```javascript
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Transactions = lazy(() => import('./pages/Transactions'));
const CashFlow = lazy(() => import('./pages/CashFlow'));
```

2. **Memoização de Componentes:**
```javascript
const TransactionCard = memo(({ transaction }) => {
  // ...
});
```

3. **Virtualização de Listas Grandes:**
```javascript
import { FixedSizeList } from 'react-window';
```

4. **Debounce em Filtros:**
```javascript
const debouncedSearch = useDeferredValue(searchTerm);
```

---

## 🧪 Testes Sugeridos

### Testes Unitários:

```javascript
// formatters.test.js
describe('formatCurrency', () => {
  it('should format positive values', () => {
    expect(formatCurrency(1500.50)).toBe('R$ 1.500,50');
  });
  
  it('should format negative values', () => {
    expect(formatCurrency(-500)).toBe('-R$ 500,00');
  });
});
```

### Testes de Integração:

```javascript
// TransactionForm.test.jsx
describe('TransactionForm', () => {
  it('should submit valid transaction', async () => {
    render(<TransactionForm onSubmit={mockSubmit} />);
    
    await userEvent.type(screen.getByLabelText('Valor'), '1500');
    await userEvent.type(screen.getByLabelText('Descrição'), 'Teste');
    await userEvent.click(screen.getByText('Salvar'));
    
    expect(mockSubmit).toHaveBeenCalledWith({
      type: 'income',
      amount: 1500,
      description: 'Teste'
    });
  });
});
```

---

## 📚 Documentação Adicional

### Swagger UI:
- Acesse: `http://localhost:3000/api-docs`
- Teste os endpoints diretamente
- Veja exemplos de request/response

### Suporte Multi-Idioma:
- Header `Accept-Language`: `pt`, `en`, `es`
- Mensagens de erro traduzidas
- Labels e placeholders localizados

---

## ✅ Status dos Endpoints da API

### Endpoints Disponíveis (100% Implementados):

**Dashboard:**
- ✅ `GET /finance/dashboard?period=month` - Dashboard completo

**Transações:**
- ✅ `GET /finance/transactions` - Listar transações (com filtros)
- ✅ `POST /finance/transactions` - Criar transação
- ✅ `PUT /finance/transactions/:id` - Atualizar transação
- ✅ `DELETE /finance/transactions/:id` - Excluir transação

**Categorias:**
- ✅ `GET /finance/categories?type=income` - Listar categorias
- ✅ `POST /finance/categories` - Criar categoria
- ✅ `PUT /finance/categories/:id` - Atualizar categoria
- ✅ `DELETE /finance/categories/:id` - Excluir categoria

**Relatórios:**
- ✅ `GET /finance/cash-flow?period=30` - Fluxo de caixa
- ✅ `GET /finance/profit-loss?period=month` - DRE

**🎉 Todos os endpoints necessários estão implementados e funcionando!**

---

## 🚀 Checklist de Implementação

### Fase 1 - Básico:
- [ ] Setup do projeto React
- [ ] Configuração de rotas
- [ ] API client e interceptors
- [ ] Dashboard básico
- [ ] Listagem de transações
- [ ] Formulário de transação (criar/editar)
- [ ] Excluir transação

### Fase 2 - Categorias:
- [ ] Listagem de categorias
- [ ] Criação de categorias
- [ ] Edição de categorias
- [ ] Exclusão de categorias
- [ ] Seletor de categorias no formulário
- [ ] Hierarquia de categorias

### Fase 3 - Relatórios:
- [ ] Fluxo de caixa
- [ ] DRE (Demonstração de Resultado)
- [ ] Exportação de relatórios (PDF/Excel)
- [ ] Filtros avançados

### Fase 4 - Otimizações:
- [ ] Gráficos interativos
- [ ] Responsividade completa
- [ ] Loading states
- [ ] Error handling
- [ ] Testes automatizados

---

## 📞 Suporte

Em caso de dúvidas sobre a API ou necessidade de ajustes:
- Consulte a documentação Swagger
- Verifique os exemplos neste documento
- Teste os endpoints via Postman/Insomnia
- A API retorna mensagens de erro detalhadas

---

**Boa sorte com o desenvolvimento! 🚀**
