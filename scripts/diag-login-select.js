#!/usr/bin/env node

(async () => {
  try {
    const db = require("../src/config/database");
    await db.initializePool();
    const email = process.argv[2] || "polo@polox.com.br";
    const res = await db.query(
      `
      SELECT id, email, password_hash, full_name, user_role, company_id, created_at
      FROM polox.users
      WHERE email = $1 AND deleted_at IS NULL
    `,
      [email.toLowerCase()]
    );
    console.log("Rows:", res.rows.length);
    if (res.rows[0]) {
      const { id, email, full_name, user_role, company_id } = res.rows[0];
      console.log({ id, email, full_name, user_role, company_id });
    }
    await db.closePool();
  } catch (e) {
    console.error("Query error:", e.message);
    process.exit(1);
  }
})();
