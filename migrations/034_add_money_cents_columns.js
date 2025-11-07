/**
 * ============================================================================
 * POLO X - Proprietary System / Sistema Proprietário
 * ============================================================================
 * 
 * Copyright (c) 2025 Polo X Manutencao de Equipamentos de Informatica LTDA
 * CNPJ: 55.419.946/0001-89
 * 
 * Legal Name / Razão Social: Polo X Manutencao de Equipamentos de Informatica LTDA
 * Trade Name / Nome Fantasia: Polo X
 * 
 * Developer / Desenvolvedor: Leonardo Polo Pereira
 * 
 * LICENSING STATUS / STATUS DE LICENCIAMENTO: Restricted Use / Uso Restrito
 * ALL RIGHTS RESERVED / TODOS OS DIREITOS RESERVADOS
 * 
 * This code is proprietary and confidential. It is strictly prohibited to:
 * Este código é proprietário e confidencial. É estritamente proibido:
 * - Copy, modify or distribute without express authorization
 * - Copiar, modificar ou distribuir sem autorização expressa
 * - Use or integrate in any other project
 * - Usar ou integrar em outros projetos
 * - Share with unauthorized third parties
 * - Compartilhar com terceiros não autorizados
 * 
 * Violations will be prosecuted under Brazilian Law:
 * Violações serão processadas conforme Lei Brasileira:
 * - Law 9.609/98 (Software Law / Lei do Software)
 * - Law 9.610/98 (Copyright Law / Lei de Direitos Autorais)
 * - Brazilian Penal Code Art. 184 (Código Penal Brasileiro Art. 184)
 * 
 * INPI Registration: In progress / Em andamento
 * 
 * For licensing / Para licenciamento: contato@polox.com.br
 * ============================================================================
 */

/**
 * Migration 034: Adicionar colunas em centavos (BIGINT) para valores monetários e realizar backfill
 * Data: 2025-10-30
 *
 * Estratégia:
 * - Adiciona colunas *_cents BIGINT NOT NULL DEFAULT 0
 * - Backfill: *_cents = ROUND(old_decimal * 100)
 * - Mantém colunas DECIMAL antigas (código fará o switch em release seguinte)
 */

async function up(client) {
  console.log(
    "💵 Iniciando Migration 034: adicionar colunas *_cents e backfill..."
  );

  const statements = [
    // SALES
    `ALTER TABLE polox.sales ADD COLUMN IF NOT EXISTS total_amount_cents BIGINT NOT NULL DEFAULT 0`,
    `ALTER TABLE polox.sales ADD COLUMN IF NOT EXISTS discount_amount_cents BIGINT NOT NULL DEFAULT 0`,
    `ALTER TABLE polox.sales ADD COLUMN IF NOT EXISTS tax_amount_cents BIGINT NOT NULL DEFAULT 0`,
    `ALTER TABLE polox.sales ADD COLUMN IF NOT EXISTS net_amount_cents BIGINT NOT NULL DEFAULT 0`,
    `ALTER TABLE polox.sales ADD COLUMN IF NOT EXISTS commission_amount_cents BIGINT NOT NULL DEFAULT 0`,

    // SALE ITEMS
    `ALTER TABLE polox.sale_items ADD COLUMN IF NOT EXISTS unit_price_cents BIGINT NOT NULL DEFAULT 0`,
    `ALTER TABLE polox.sale_items ADD COLUMN IF NOT EXISTS total_price_cents BIGINT NOT NULL DEFAULT 0`,
    `ALTER TABLE polox.sale_items ADD COLUMN IF NOT EXISTS discount_amount_cents BIGINT NOT NULL DEFAULT 0`,

    // PRODUCTS
    `ALTER TABLE polox.products ADD COLUMN IF NOT EXISTS cost_price_cents BIGINT NOT NULL DEFAULT 0`,
    `ALTER TABLE polox.products ADD COLUMN IF NOT EXISTS sale_price_cents BIGINT NOT NULL DEFAULT 0`,

    // FINANCIAL ACCOUNTS
    `ALTER TABLE polox.financial_accounts ADD COLUMN IF NOT EXISTS current_balance_cents BIGINT NOT NULL DEFAULT 0`,
    `ALTER TABLE polox.financial_accounts ADD COLUMN IF NOT EXISTS initial_balance_cents BIGINT NOT NULL DEFAULT 0`,

    // FINANCIAL TRANSACTIONS
    `ALTER TABLE polox.financial_transactions ADD COLUMN IF NOT EXISTS amount_cents BIGINT NOT NULL DEFAULT 0`,

    // CLIENTS METRICS
    `ALTER TABLE polox.clients ADD COLUMN IF NOT EXISTS total_spent_cents BIGINT NOT NULL DEFAULT 0`,
    `ALTER TABLE polox.clients ADD COLUMN IF NOT EXISTS average_order_value_cents BIGINT NOT NULL DEFAULT 0`,
    `ALTER TABLE polox.clients ADD COLUMN IF NOT EXISTS lifetime_value_cents BIGINT NOT NULL DEFAULT 0`,

    // LEADS (conversion value)
    `ALTER TABLE polox.leads ADD COLUMN IF NOT EXISTS conversion_value_cents BIGINT NOT NULL DEFAULT 0`,
  ];

  for (const sql of statements) {
    await client.query(sql);
  }

  console.log(
    "📦 Colunas *_cents adicionadas. Iniciando backfill com checagem de colunas..."
  );

  // Helper: verifica se coluna existe
  async function hasColumn(schema, table, column) {
    const res = await client.query(
      `SELECT 1 FROM information_schema.columns
       WHERE table_schema = $1 AND table_name = $2 AND column_name = $3`,
      [schema, table, column]
    );
    return res.rows.length > 0;
  }

  // SALES
  if (await hasColumn("polox", "sales", "total_amount")) {
    await client.query(
      `UPDATE polox.sales SET total_amount_cents = COALESCE(ROUND(total_amount * 100), 0)`
    );
  } else {
    console.log(
      "ℹ️  Pular backfill sales.total_amount -> total_amount_cents (coluna inexistente)"
    );
  }
  if (await hasColumn("polox", "sales", "discount_amount")) {
    await client.query(
      `UPDATE polox.sales SET discount_amount_cents = COALESCE(ROUND(discount_amount * 100), 0)`
    );
  } else {
    console.log(
      "ℹ️  Pular backfill sales.discount_amount -> discount_amount_cents (coluna inexistente)"
    );
  }
  if (await hasColumn("polox", "sales", "tax_amount")) {
    await client.query(
      `UPDATE polox.sales SET tax_amount_cents = COALESCE(ROUND(tax_amount * 100), 0)`
    );
  } else {
    console.log(
      "ℹ️  Pular backfill sales.tax_amount -> tax_amount_cents (coluna inexistente)"
    );
  }
  if (await hasColumn("polox", "sales", "net_amount")) {
    await client.query(
      `UPDATE polox.sales SET net_amount_cents = COALESCE(ROUND(net_amount * 100), 0)`
    );
  } else {
    console.log(
      "ℹ️  Pular backfill sales.net_amount -> net_amount_cents (coluna inexistente)"
    );
  }
  if (await hasColumn("polox", "sales", "commission_amount")) {
    await client.query(
      `UPDATE polox.sales SET commission_amount_cents = COALESCE(ROUND(commission_amount * 100), 0)`
    );
  } else {
    console.log(
      "ℹ️  Pular backfill sales.commission_amount -> commission_amount_cents (coluna inexistente)"
    );
  }

  // SALE ITEMS
  if (await hasColumn("polox", "sale_items", "unit_price")) {
    await client.query(
      `UPDATE polox.sale_items SET unit_price_cents = COALESCE(ROUND(unit_price * 100), 0)`
    );
  } else {
    console.log(
      "ℹ️  Pular backfill sale_items.unit_price -> unit_price_cents (coluna inexistente)"
    );
  }
  if (await hasColumn("polox", "sale_items", "total_price")) {
    await client.query(
      `UPDATE polox.sale_items SET total_price_cents = COALESCE(ROUND(total_price * 100), 0)`
    );
  } else {
    console.log(
      "ℹ️  Pular backfill sale_items.total_price -> total_price_cents (coluna inexistente)"
    );
  }
  if (await hasColumn("polox", "sale_items", "discount_amount")) {
    await client.query(
      `UPDATE polox.sale_items SET discount_amount_cents = COALESCE(ROUND(discount_amount * 100), 0)`
    );
  } else {
    console.log(
      "ℹ️  Pular backfill sale_items.discount_amount -> discount_amount_cents (coluna inexistente)"
    );
  }

  // PRODUCTS
  if (await hasColumn("polox", "products", "cost_price")) {
    await client.query(
      `UPDATE polox.products SET cost_price_cents = COALESCE(ROUND(cost_price * 100), 0)`
    );
  } else {
    console.log(
      "ℹ️  Pular backfill products.cost_price -> cost_price_cents (coluna inexistente)"
    );
  }
  if (await hasColumn("polox", "products", "sale_price")) {
    await client.query(
      `UPDATE polox.products SET sale_price_cents = COALESCE(ROUND(sale_price * 100), 0)`
    );
  } else {
    console.log(
      "ℹ️  Pular backfill products.sale_price -> sale_price_cents (coluna inexistente)"
    );
  }

  // FINANCIAL ACCOUNTS
  if (await hasColumn("polox", "financial_accounts", "current_balance")) {
    await client.query(
      `UPDATE polox.financial_accounts SET current_balance_cents = COALESCE(ROUND(current_balance * 100), 0)`
    );
  } else {
    console.log(
      "ℹ️  Pular backfill financial_accounts.current_balance -> current_balance_cents (coluna inexistente)"
    );
  }
  if (await hasColumn("polox", "financial_accounts", "initial_balance")) {
    await client.query(
      `UPDATE polox.financial_accounts SET initial_balance_cents = COALESCE(ROUND(initial_balance * 100), 0)`
    );
  } else {
    console.log(
      "ℹ️  Pular backfill financial_accounts.initial_balance -> initial_balance_cents (coluna inexistente)"
    );
  }

  // FINANCIAL TRANSACTIONS
  if (await hasColumn("polox", "financial_transactions", "amount")) {
    await client.query(
      `UPDATE polox.financial_transactions SET amount_cents = COALESCE(ROUND(amount * 100), 0)`
    );
  } else {
    console.log(
      "ℹ️  Pular backfill financial_transactions.amount -> amount_cents (coluna inexistente)"
    );
  }

  // CLIENTS METRICS
  if (await hasColumn("polox", "clients", "total_spent")) {
    await client.query(
      `UPDATE polox.clients SET total_spent_cents = COALESCE(ROUND(total_spent * 100), 0)`
    );
  } else {
    console.log(
      "ℹ️  Pular backfill clients.total_spent -> total_spent_cents (coluna inexistente)"
    );
  }
  if (await hasColumn("polox", "clients", "average_order_value")) {
    await client.query(
      `UPDATE polox.clients SET average_order_value_cents = COALESCE(ROUND(average_order_value * 100), 0)`
    );
  } else {
    console.log(
      "ℹ️  Pular backfill clients.average_order_value -> average_order_value_cents (coluna inexistente)"
    );
  }
  if (await hasColumn("polox", "clients", "lifetime_value")) {
    await client.query(
      `UPDATE polox.clients SET lifetime_value_cents = COALESCE(ROUND(lifetime_value * 100), 0)`
    );
  } else {
    console.log(
      "ℹ️  Pular backfill clients.lifetime_value -> lifetime_value_cents (coluna inexistente)"
    );
  }

  // LEADS
  if (await hasColumn("polox", "leads", "conversion_value")) {
    await client.query(
      `UPDATE polox.leads SET conversion_value_cents = COALESCE(ROUND(conversion_value * 100), 0)`
    );
  } else {
    console.log(
      "ℹ️  Pular backfill leads.conversion_value -> conversion_value_cents (coluna inexistente)"
    );
  }
  console.log(
    "✅ Migration 034 concluída: colunas *_cents adicionadas e dados backfilled"
  );
}

async function down(client) {
  console.log("🔄 Revertendo Migration 034: remover colunas *_cents...");

  const drops = [
    // SALES
    `ALTER TABLE polox.sales DROP COLUMN IF EXISTS total_amount_cents`,
    `ALTER TABLE polox.sales DROP COLUMN IF EXISTS discount_amount_cents`,
    `ALTER TABLE polox.sales DROP COLUMN IF EXISTS tax_amount_cents`,
    `ALTER TABLE polox.sales DROP COLUMN IF EXISTS net_amount_cents`,
    `ALTER TABLE polox.sales DROP COLUMN IF EXISTS commission_amount_cents`,

    // SALE ITEMS
    `ALTER TABLE polox.sale_items DROP COLUMN IF EXISTS unit_price_cents`,
    `ALTER TABLE polox.sale_items DROP COLUMN IF EXISTS total_price_cents`,
    `ALTER TABLE polox.sale_items DROP COLUMN IF EXISTS discount_amount_cents`,

    // PRODUCTS
    `ALTER TABLE polox.products DROP COLUMN IF EXISTS cost_price_cents`,
    `ALTER TABLE polox.products DROP COLUMN IF EXISTS sale_price_cents`,

    // FINANCIAL ACCOUNTS
    `ALTER TABLE polox.financial_accounts DROP COLUMN IF EXISTS current_balance_cents`,
    `ALTER TABLE polox.financial_accounts DROP COLUMN IF EXISTS initial_balance_cents`,

    // FINANCIAL TRANSACTIONS
    `ALTER TABLE polox.financial_transactions DROP COLUMN IF EXISTS amount_cents`,

    // CLIENTS METRICS
    `ALTER TABLE polox.clients DROP COLUMN IF EXISTS total_spent_cents`,
    `ALTER TABLE polox.clients DROP COLUMN IF EXISTS average_order_value_cents`,
    `ALTER TABLE polox.clients DROP COLUMN IF EXISTS lifetime_value_cents`,

    // LEADS
    `ALTER TABLE polox.leads DROP COLUMN IF EXISTS conversion_value_cents`,
  ];

  for (const sql of drops) {
    await client.query(sql);
  }

  console.log("✅ Migration 034 revertida com sucesso");
}

module.exports = { up, down };
