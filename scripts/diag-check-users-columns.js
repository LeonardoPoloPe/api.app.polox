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
