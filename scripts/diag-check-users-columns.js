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

#!/usr/bin/env node

(async () => {
  try {
    const db = require("../src/config/database");
    await db.initializePool();
    const res = await db.query(`
      SELECT table_schema, table_name, column_name
      FROM information_schema.columns
      WHERE table_name = 'users'
      ORDER BY table_schema, ordinal_position
    `);
    const bySchema = res.rows.reduce((acc, r) => {
      acc[r.table_schema] = acc[r.table_schema] || [];
      acc[r.table_schema].push(r.column_name);
      return acc;
    }, {});
    console.log("Schemas with a users table and their columns:\n");
    for (const [schema, cols] of Object.entries(bySchema)) {
      console.log(`- ${schema}: ${cols.join(", ")}`);
    }
    await db.closePool();
  } catch (e) {
    console.error("Error running diag:", e.message);
    process.exit(1);
  }
})();
