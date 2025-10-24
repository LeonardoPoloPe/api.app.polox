const { query } = require("./src/config/database");

async function testLeadQuery() {
  console.log("Testing basic lead query...");

  const companyId = 1;

  // Test 1: Without companyId option (no SET LOCAL)
  console.log("\n=== Test 1: Without companyId option ===");
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
    const result = await query(countQuery, values); // NO companyId option
    console.log("Query result:", result.rows[0]);
  } catch (error) {
    console.error("Query error (no companyId option):", error.message);
  }

  // Test 2: With companyId option (has SET LOCAL)
  console.log("\n=== Test 2: With companyId option ===");
  try {
    const result = await query(countQuery, values, { companyId }); // WITH companyId option
    console.log("Query result:", result.rows[0]);
  } catch (error) {
    console.error("Query error (with companyId option):", error.message);
  }

  process.exit(0);
}

testLeadQuery();
