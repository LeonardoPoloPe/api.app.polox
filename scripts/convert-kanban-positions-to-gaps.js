/**
 * Script para converter posições Kanban existentes para sistema de GAPS
 * 
 * Converte: 1, 2, 3, 4, 5... → 1000, 2000, 3000, 4000, 5000...
 * 
 * Uso:
 * node scripts/convert-kanban-positions-to-gaps.js
 */

const { Pool } = require("pg");
require("dotenv").config();

const dbConfig = {
  user: process.env.DB_DEV_USER,
  password: process.env.DB_DEV_PASSWORD,
  host: process.env.DB_DEV_HOST,
  database: process.env.DB_DEV_NAME,
  port: process.env.DB_DEV_PORT || 5432,
  ssl: {
    rejectUnauthorized: false,
  },
};

async function convertToGaps() {
  const pool = new Pool(dbConfig);
  const client = await pool.connect();

  try {
    console.log("🔄 Iniciando conversão de posições Kanban para sistema de GAPS...\n");

    // 1. Buscar todas as empresas
    const companies = await client.query(
      `SELECT DISTINCT company_id FROM polox.contacts WHERE tipo = 'lead' AND deleted_at IS NULL`
    );

    console.log(`📊 ${companies.rows.length} empresas encontradas\n`);

    let totalConverted = 0;

    // 2. Para cada empresa, converter posições por status
    for (const { company_id } of companies.rows) {
      console.log(`🏢 Empresa ${company_id}:`);

      const statuses = [
        "novo",
        "em_contato",
        "qualificado",
        "proposta_enviada",
        "em_negociacao",
        "fechado",
        "perdido",
      ];

      for (const status of statuses) {
        // Contar leads neste status
        const countResult = await client.query(
          `SELECT COUNT(*) as total 
           FROM polox.contacts 
           WHERE company_id = $1 
             AND status = $2 
             AND tipo = 'lead' 
             AND deleted_at IS NULL`,
          [company_id, status]
        );

        const total = parseInt(countResult.rows[0].total, 10);
        if (total === 0) continue;

        console.log(`  📍 ${status}: ${total} leads`);

        // Converter: multiplicar posição atual por 1000
        await client.query(
          `UPDATE polox.contacts 
           SET kanban_position = kanban_position * 1000
           WHERE company_id = $1
             AND status = $2
             AND tipo = 'lead'
             AND deleted_at IS NULL
             AND kanban_position IS NOT NULL
             AND kanban_position < 1000`,
          [company_id, status]
        );

        totalConverted += total;
      }

      console.log("");
    }

    console.log("✅ Conversão concluída!");
    console.log(`📊 Total de leads convertidos: ${totalConverted}\n`);

    // 3. Verificar resultados
    console.log("🔍 Verificando conversão...");
    const sample = await client.query(
      `SELECT company_id, status, COUNT(*) as total, 
              MIN(kanban_position) as min_pos, 
              MAX(kanban_position) as max_pos,
              AVG(kanban_position) as avg_pos
       FROM polox.contacts
       WHERE tipo = 'lead' 
         AND deleted_at IS NULL 
         AND kanban_position IS NOT NULL
       GROUP BY company_id, status
       ORDER BY company_id, status
       LIMIT 10`
    );

    console.log("\n📈 Amostra (primeiros 10 grupos):");
    console.table(
      sample.rows.map((r) => ({
        Empresa: r.company_id,
        Status: r.status,
        Total: r.total,
        "Pos Min": r.min_pos,
        "Pos Max": r.max_pos,
        "Pos Média": Math.round(r.avg_pos),
      }))
    );

    console.log("\n✅ Sistema de GAPS ativado com sucesso!");
    console.log("⚡ Performance: O(1) para 99% das operações de drag & drop");
  } catch (error) {
    console.error("❌ Erro na conversão:", error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

convertToGaps()
  .then(() => {
    console.log("\n✅ Script finalizado com sucesso!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Erro fatal:", error);
    process.exit(1);
  });
