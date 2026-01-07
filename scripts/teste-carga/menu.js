/**
 * Menu de scripts de teste de carga
 * Execute: node scripts/teste-carga/menu.js
 */

const { execSync } = require("child_process");
const readline = require("readline");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

console.log("\n═══════════════════════════════════════════════════════");
console.log("🚀 MENU DE TESTES DE CARGA - POLOX CRM");
console.log("═══════════════════════════════════════════════════════\n");

console.log("Escolha uma opção:\n");
console.log("1. 🚀 Seed Rápido (1.000 contatos) - ~1 segundo");
console.log("2. 📊 Seed Médio (10.000 contatos) - ~10 segundos");
console.log("3. 🔥 Seed Grande (50.000 contatos) - ~1 minuto");
console.log("4. 💪 Seed Massivo (100.000 contatos) - ~2 minutos");
console.log("5. 🧪 Testar Performance da API");
console.log("6. 📈 Ver estatísticas do banco");
console.log("7. 🗑️  Limpar todos os dados de teste");
console.log("0. ❌ Sair\n");

rl.question("Digite o número da opção: ", (answer) => {
  console.log("");

  try {
    switch (answer) {
      case "1":
        console.log("🚀 Executando seed rápido...\n");
        execSync("node scripts/teste-carga/contato/seed-quick.js", {
          stdio: "inherit",
        });
        break;

      case "2":
        console.log("📊 Executando seed médio (10k contatos)...\n");
        process.env.SEED_TOTAL = "10000";
        execSync(
          "node scripts/teste-carga/contato/seed-contacts-performance.js",
          {
            stdio: "inherit",
            env: { ...process.env, TOTAL_CONTACTS: "10000" },
          }
        );
        break;

      case "3":
        console.log("🔥 Executando seed grande (50k contatos)...\n");
        execSync(
          "node scripts/teste-carga/contato/seed-contacts-performance.js",
          { stdio: "inherit" }
        );
        break;

      case "4":
        console.log("💪 Executando seed massivo (100k contatos)...\n");
        console.log("⚠️  Isso pode levar alguns minutos...\n");
        execSync(
          "node scripts/teste-carga/contato/seed-contacts-performance.js",
          {
            stdio: "inherit",
            env: { ...process.env, TOTAL_CONTACTS: "100000" },
          }
        );
        break;

      case "5":
        console.log("🧪 Testando performance da API...\n");
        console.log("⚠️  Certifique-se de que o servidor está rodando!\n");
        execSync("node scripts/teste-carga/contato/test-performance.js", {
          stdio: "inherit",
        });
        break;

      case "6":
        console.log("📈 Estatísticas do banco...\n");
        const { Pool } = require("pg");
        require("dotenv").config();
        const pool = new Pool({
          host: process.env.DB_HOST,
          port: process.env.DB_PORT,
          database: process.env.DB_NAME,
          user: process.env.DB_USER,
          password: process.env.DB_PASSWORD,
          ssl: false,
        });

        (async () => {
          try {
            const stats = await pool.query(`
              SELECT 
                (SELECT COUNT(*) FROM polox.contacts WHERE company_id = 1) as total_contacts,
                (SELECT COUNT(*) FROM polox.deals WHERE company_id = 1) as total_deals,
                (SELECT COUNT(*) FROM polox.contact_notes WHERE company_id = 1) as total_notes,
                (SELECT COUNT(*) FROM polox.contacts WHERE company_id = 1 AND tipo = 'lead') as total_leads,
                (SELECT COUNT(*) FROM polox.contacts WHERE company_id = 1 AND tipo = 'cliente') as total_clients
            `);

            const data = stats.rows[0];
            console.log("╔═══════════════════════════════════════════╗");
            console.log("║         ESTATÍSTICAS DO BANCO            ║");
            console.log("╠═══════════════════════════════════════════╣");
            console.log(
              `║  📊 Total de Contatos:    ${String(
                data.total_contacts
              ).padStart(12)} ║`
            );
            console.log(
              `║  📈 Leads:                ${String(data.total_leads).padStart(
                12
              )} ║`
            );
            console.log(
              `║  👥 Clientes:             ${String(
                data.total_clients
              ).padStart(12)} ║`
            );
            console.log(
              `║  💼 Deals:                ${String(data.total_deals).padStart(
                12
              )} ║`
            );
            console.log(
              `║  📝 Notas:                ${String(data.total_notes).padStart(
                12
              )} ║`
            );
            console.log("╚═══════════════════════════════════════════╝\n");
          } finally {
            await pool.end();
          }
        })();
        break;

      case "7":
        console.log("🗑️  Limpando dados de teste...\n");
        rl.question(
          "⚠️  Tem certeza? Isso vai deletar TODOS os dados da empresa ID 1! (sim/não): ",
          async (confirm) => {
            if (confirm.toLowerCase() === "sim") {
              const { Pool } = require("pg");
              require("dotenv").config();
              const pool = new Pool({
                host: process.env.DB_HOST,
                port: process.env.DB_PORT,
                database: process.env.DB_NAME,
                user: process.env.DB_USER,
                password: process.env.DB_PASSWORD,
                ssl: false,
              });

              try {
                await pool.query(
                  "DELETE FROM polox.contact_notes WHERE company_id = 1"
                );
                await pool.query(
                  "DELETE FROM polox.deals WHERE company_id = 1"
                );
                await pool.query(
                  "DELETE FROM polox.contacts WHERE company_id = 1"
                );
                console.log("✅ Dados limpos com sucesso!\n");
              } catch (error) {
                console.error("❌ Erro ao limpar dados:", error.message);
              } finally {
                await pool.end();
                rl.close();
              }
            } else {
              console.log("Operação cancelada.\n");
              rl.close();
            }
          }
        );
        return;

      case "0":
        console.log("👋 Até logo!\n");
        rl.close();
        return;

      default:
        console.log("❌ Opção inválida!\n");
    }
  } catch (error) {
    console.error("❌ Erro ao executar:", error.message);
  }

  rl.close();
});
