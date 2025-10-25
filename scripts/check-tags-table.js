const { Client } = require('pg');
const AWS = require('aws-sdk');

async function checkTagsTable() {
  try {
    // Carregar credenciais do Secrets Manager
    const secretsManager = new AWS.SecretsManager({ region: 'sa-east-1' });
    const secretData = await secretsManager.getSecretValue({ 
      SecretId: 'sandbox-mysql' 
    }).promise();
    
    const credentials = JSON.parse(secretData.SecretString);

    const client = new Client({
      host: 'database-1.cd2em8e0a6ot.sa-east-1.rds.amazonaws.com',
      port: 5432,
      database: 'app_polox_sandbox',
      user: credentials.username,
      password: credentials.password,
      ssl: { rejectUnauthorized: false }
    });

    await client.connect();
    console.log('✅ Conectado ao banco SANDBOX\n');

    // Verificar se a tabela existe
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'polox' 
        AND table_name = 'tags'
      );
    `);

    if (!tableCheck.rows[0].exists) {
      console.log('❌ Tabela polox.tags NÃO EXISTE\n');
      await client.end();
      return;
    }

    console.log('✅ Tabela polox.tags EXISTE\n');

    // Verificar estrutura da tabela
    const structure = await client.query(`
      SELECT 
        column_name, 
        data_type, 
        is_nullable,
        column_default,
        character_maximum_length
      FROM information_schema.columns 
      WHERE table_schema = 'polox' 
        AND table_name = 'tags'
      ORDER BY ordinal_position;
    `);

    console.log('📋 Estrutura da tabela polox.tags:\n');
    console.log('Coluna'.padEnd(20), 'Tipo'.padEnd(25), 'Nullable', 'Default');
    console.log('-'.repeat(80));
    
    structure.rows.forEach(row => {
      const type = row.character_maximum_length 
        ? `${row.data_type}(${row.character_maximum_length})`
        : row.data_type;
      console.log(
        row.column_name.padEnd(20),
        type.padEnd(25),
        row.is_nullable.padEnd(8),
        (row.column_default || '').substring(0, 30)
      );
    });

    // Verificar constraints
    const constraints = await client.query(`
      SELECT
        conname,
        pg_get_constraintdef(oid) as definition
      FROM pg_constraint
      WHERE connamespace = 'polox'::regnamespace
        AND conrelid = 'polox.tags'::regclass
      ORDER BY conname;
    `);

    console.log('\n🔒 Constraints:\n');
    constraints.rows.forEach(con => {
      console.log(`  ${con.conname}`);
      console.log(`    ${con.definition}\n`);
    });

    // Verificar índices
    const indexes = await client.query(`
      SELECT
        indexname,
        indexdef
      FROM pg_indexes
      WHERE schemaname = 'polox'
        AND tablename = 'tags'
      ORDER BY indexname;
    `);

    console.log('📊 Índices:\n');
    indexes.rows.forEach(idx => {
      console.log(`  ${idx.indexname}`);
      console.log(`    ${idx.indexdef}\n`);
    });

    await client.end();
  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  }
}

checkTagsTable();
