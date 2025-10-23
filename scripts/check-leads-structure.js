const { Client } = require('pg');
const AWS = require('aws-sdk');

async function checkLeadsStructure() {
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

    // Verificar estrutura da tabela leads
    const result = await client.query(`
      SELECT 
        column_name, 
        data_type, 
        is_nullable,
        column_default
      FROM information_schema.columns 
      WHERE table_schema = 'polox' 
        AND table_name = 'leads'
      ORDER BY ordinal_position;
    `);

    console.log('📋 Estrutura da tabela polox.leads:\n');
    console.log('Coluna'.padEnd(30), 'Tipo'.padEnd(20), 'Nullable', 'Default');
    console.log('-'.repeat(80));
    
    result.rows.forEach(row => {
      console.log(
        row.column_name.padEnd(30),
        row.data_type.padEnd(20),
        row.is_nullable.padEnd(8),
        (row.column_default || '').substring(0, 20)
      );
    });

    // Verificar se colunas específicas existem
    const columnsToCheck = ['notes', 'interests', 'tags', 'user_id', 'assigned_to_id'];
    console.log('\n🔍 Verificando colunas específicas:\n');
    
    columnsToCheck.forEach(col => {
      const exists = result.rows.some(row => row.column_name === col);
      console.log(`${exists ? '✅' : '❌'} ${col}`);
    });

    await client.end();
  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  }
}

checkLeadsStructure();
