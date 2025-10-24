const { query } = require("../src/config/database");

async function checkInterestsSchema() {
  console.log("Checking interests table schema...");

  try {
    // Get table schema
    const schemaResult = await query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'polox' AND table_name = 'interests'
      ORDER BY ordinal_position;
    `);

    console.log("Interests table columns:");
    schemaResult.rows.forEach((row) => {
      console.log(`- ${row.column_name}: ${row.data_type}`);
    });

    // Also check tags table
    const tagsResult = await query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'polox' AND table_name = 'tags'
      ORDER BY ordinal_position;
    `);

    console.log("\nTags table columns:");
    tagsResult.rows.forEach((row) => {
      console.log(`- ${row.column_name}: ${row.data_type}`);
    });
  } catch (error) {
    console.error("Error checking schema:", error.message);
  }

  process.exit(0);
}

checkInterestsSchema();
