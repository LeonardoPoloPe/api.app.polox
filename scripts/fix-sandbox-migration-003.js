#!/usr/bin/env node

/**
 * Script para resolver o problema da migration 003 no SANDBOX
 * Marca a migration como executada sem rodar o código
 */

const { Pool } = require("pg");

// ⚠️ SCRIPT DESABILITADO - CREDENCIAIS REMOVIDAS POR SEGURANÇA
console.error(`
❌ SCRIPT DESABILITADO!

🔐 Por motivos de segurança, as credenciais foram removidas.
🎯 Este script já foi executado e não é mais necessário.

✅ Use o novo sistema seguro:
   node scripts/migrate-environment.js sandbox status

📖 Documentação: docs/POLITICAS_SEGURANCA_CREDENCIAIS.md
`);

process.exit(1);
async function fixMigration003() {
  try {
    console.log("🔍 Verificando tabelas existentes no SANDBOX...\n");

    // Ver quantas tabelas existem
    const tablesResult = await pool.query(`
      SELECT COUNT(*) as count 
      FROM information_schema.tables 
      WHERE table_schema = 'polox'
    `);

    console.log(
      `📊 Total de tabelas no schema polox: ${tablesResult.rows[0].count}\n`
    );

    // Listar algumas tabelas importantes
    const importantTables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'polox' 
        AND table_name IN ('leads', 'clients', 'sales', 'products', 'companies', 'users')
      ORDER BY table_name
    `);

    console.log("📋 Tabelas importantes encontradas:");
    importantTables.rows.forEach((row) => {
      console.log(`   ✓ ${row.table_name}`);
    });

    console.log("\n🔍 Verificando migrations executadas...\n");

    const migrationsResult = await pool.query(`
      SELECT name, executed_at 
      FROM migrations 
      ORDER BY executed_at
    `);

    console.log("✅ Migrations executadas:");
    migrationsResult.rows.forEach((row) => {
      console.log(`   ${row.name} - ${row.executed_at}`);
    });

    // Verificar se 003 já está registrada
    const migration003 = migrationsResult.rows.find(
      (r) => r.name === "003_add_complete_polox_schema"
    );

    if (migration003) {
      console.log("\n⚠️  Migration 003 já está registrada! Nada a fazer.");
    } else {
      console.log("\n📝 Migration 003 NÃO está registrada.");
      console.log("\n❓ Deseja marcar a migration 003 como executada?");
      console.log(
        "   Isso é seguro porque a migration 005 já criou as tabelas necessárias.\n"
      );

      // Marcar como executada
      await pool.query(`
        INSERT INTO migrations (name, executed_at) 
        VALUES ('003_add_complete_polox_schema', NOW())
      `);

      console.log("✅ Migration 003 marcada como executada!\n");
    }

    console.log("🎉 Processo concluído!\n");
  } catch (error) {
    console.error("❌ Erro:", error.message);
  } finally {
    await pool.end();
  }
}

fixMigration003();
