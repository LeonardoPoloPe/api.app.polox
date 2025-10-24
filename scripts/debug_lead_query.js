const { query } = require("./src/config/database");

async function testLeadQuery() {
  console.log("Testing basic lead query...");

  const companyId = 1;
  const conditions = ["l.company_id = $1", "l.deleted_at IS NULL"];
  const values = [companyId];

  const whereClause = `WHERE ${conditions.join(" AND ")}`;
  console.log("Where clause:", whereClause);
  console.log("Values:", values);

  const countQuery = `
    SELECT COUNT(*) 
    FROM polox.leads l 
    ${whereClause}
  `;

  console.log("Count query:", countQuery);

  try {
    const result = await query(countQuery, values, { companyId });
    console.log("Query result:", result.rows[0]);
  } catch (error) {
    console.error("Query error:", error.message);
  }

  process.exit(0);
}

testLeadQuery();
