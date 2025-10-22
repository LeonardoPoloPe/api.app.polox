#!/usr/bin/env node

/**
 * Script para analisar diferenças de tabelas entre ambientes
 */

const { Pool } = require("pg");

// ⚠️ ARQUIVO LEGADO - CREDENCIAIS REMOVIDAS POR SEGURANÇA
// ❌ Este script está obsoleto - use o novo sistema com AWS Secrets Manager
// ✅ Substituto: node scripts/check-all-environments.js

console.error(`
❌ SCRIPT OBSOLETO!

🔐 Por motivos de segurança, as credenciais foram removidas deste arquivo.

✅ Use o novo script seguro:
   node scripts/check-all-environments.js

📖 Documentação: docs/POLITICAS_SEGURANCA_CREDENCIAIS.md
`);

process.exit(1);

async function getTables(envName, config) {
  const pool = new Pool({
    host: config.DB_HOST,
    port: config.DB_PORT,
    database: config.DB_NAME,
    user: config.DB_USER,
    password: config.DB_PASSWORD,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 5000,
  });

  try {
    const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'polox' 
        AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);

    return result.rows.map((r) => r.table_name);
  } catch (error) {
    console.error(`Erro em ${envName}:`, error.message);
    return [];
  } finally {
    await pool.end();
  }
}

async function main() {
  console.log(
    "\n╔════════════════════════════════════════════════════════════╗"
  );
  console.log("║   📊 ANÁLISE DE TABELAS - SCHEMA POLOX                     ║");
  console.log(
    "╚════════════════════════════════════════════════════════════╝\n"
  );

  const allTables = {};

  for (const [envName, config] of Object.entries(environments)) {
    console.log(`${config.emoji} Buscando tabelas em ${config.description}...`);
    allTables[envName] = await getTables(envName, config);
    console.log(`   ✓ ${allTables[envName].length} tabelas encontradas\n`);
  }

  // Encontrar todas as tabelas únicas
  const allUniqueTables = new Set();
  Object.values(allTables).forEach((tables) => {
    tables.forEach((table) => allUniqueTables.add(table));
  });

  console.log("═".repeat(60));
  console.log("📋 COMPARAÇÃO DE TABELAS\n");
  console.log("Legenda: ✅ Existe | ❌ Faltando\n");
  console.log("─".repeat(60));
  console.log(
    "TABELA".padEnd(35) + "DEV".padEnd(8) + "SANDBOX".padEnd(10) + "PROD"
  );
  console.log("─".repeat(60));

  const sortedTables = Array.from(allUniqueTables).sort();

  sortedTables.forEach((table) => {
    const devHas = allTables.dev.includes(table) ? "✅" : "❌";
    const sandboxHas = allTables.sandbox.includes(table) ? "✅" : "❌";
    const prodHas = allTables.prod.includes(table) ? "✅" : "❌";

    console.log(
      table.padEnd(35) + devHas.padEnd(8) + sandboxHas.padEnd(10) + prodHas
    );
  });

  console.log("─".repeat(60));
  console.log(`\nTotal de tabelas únicas: ${sortedTables.length}`);
  console.log(`DEV: ${allTables.dev.length}`);
  console.log(`SANDBOX: ${allTables.sandbox.length}`);
  console.log(`PROD: ${allTables.prod.length}\n`);

  // Encontrar tabelas faltantes em cada ambiente
  console.log("═".repeat(60));
  console.log("⚠️  TABELAS FALTANTES POR AMBIENTE\n");

  const devMissing = sortedTables.filter((t) => !allTables.dev.includes(t));
  const sandboxMissing = sortedTables.filter(
    (t) => !allTables.sandbox.includes(t)
  );
  const prodMissing = sortedTables.filter((t) => !allTables.prod.includes(t));

  if (devMissing.length > 0) {
    console.log("🧪 DEV está faltando:");
    devMissing.forEach((t) => console.log(`   - ${t}`));
    console.log("");
  } else {
    console.log("🧪 DEV: ✅ Tem todas as tabelas\n");
  }

  if (sandboxMissing.length > 0) {
    console.log("🏗️ SANDBOX está faltando:");
    sandboxMissing.forEach((t) => console.log(`   - ${t}`));
    console.log("");
  } else {
    console.log("🏗️ SANDBOX: ✅ Tem todas as tabelas\n");
  }

  if (prodMissing.length > 0) {
    console.log("🚀 PROD está faltando:");
    prodMissing.forEach((t) => console.log(`   - ${t}`));
    console.log("");
  } else {
    console.log("🚀 PROD: ✅ Tem todas as tabelas\n");
  }

  console.log("═".repeat(60));
  console.log("✅ Análise concluída!\n");
}

main().catch((error) => {
  console.error("❌ Erro:", error.message);
  process.exit(1);
});
