const { Client } = require('pg');
const AWS = require('aws-sdk');

async function checkLeadNotesTable() {
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
        AND table_name = 'lead_notes'
      );
    `);

    if (!tableCheck.rows[0].exists) {
      console.log('❌ Tabela polox.lead_notes NÃO EXISTE\n');
      await client.end();
      return;
    }

    console.log('✅ Tabela polox.lead_notes EXISTE\n');

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
        AND table_name = 'lead_notes'
      ORDER BY ordinal_position;
    `);

    console.log('📋 Estrutura da tabela polox.lead_notes:\n');
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

    // Verificar foreign keys
    const fkeys = await client.query(`
      SELECT
        tc.constraint_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name,
        rc.update_rule,
        rc.delete_rule
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      JOIN information_schema.referential_constraints AS rc
        ON tc.constraint_name = rc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'polox'
        AND tc.table_name = 'lead_notes';
    `);

    console.log('\n🔗 Foreign Keys:\n');
    fkeys.rows.forEach(fk => {
      console.log(`  ${fk.constraint_name}`);
      console.log(`    ${fk.column_name} → ${fk.foreign_table_name}(${fk.foreign_column_name})`);
      console.log(`    ON UPDATE: ${fk.update_rule}`);
      console.log(`    ON DELETE: ${fk.delete_rule}\n`);
    });

    // Verificar índices
    const indexes = await client.query(`
      SELECT
        indexname,
        indexdef
      FROM pg_indexes
      WHERE schemaname = 'polox'
        AND tablename = 'lead_notes'
      ORDER BY indexname;
    `);

    console.log('📊 Índices:\n');
    indexes.rows.forEach(idx => {
      console.log(`  ${idx.indexname}`);
      console.log(`    ${idx.indexdef}\n`);
    });

    // Verificar triggers
    const triggers = await client.query(`
      SELECT
        trigger_name,
        event_manipulation,
        action_timing,
        action_statement
      FROM information_schema.triggers
      WHERE event_object_schema = 'polox'
        AND event_object_table = 'lead_notes';
    `);

    console.log('⚡ Triggers:\n');
    if (triggers.rows.length === 0) {
      console.log('  ⚠️  Nenhum trigger encontrado\n');
    } else {
      triggers.rows.forEach(trg => {
        console.log(`  ${trg.trigger_name}`);
        console.log(`    ${trg.action_timing} ${trg.event_manipulation}`);
        console.log(`    ${trg.action_statement}\n`);
      });
    }

    // Verificar constraints
    const constraints = await client.query(`
      SELECT
        conname,
        pg_get_constraintdef(oid) as definition
      FROM pg_constraint
      WHERE connamespace = 'polox'::regnamespace
        AND conrelid = 'polox.lead_notes'::regclass
      ORDER BY conname;
    `);

    console.log('🔒 Constraints:\n');
    constraints.rows.forEach(con => {
      console.log(`  ${con.conname}`);
      console.log(`    ${con.definition}\n`);
    });

    await client.end();
  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  }
}

checkLeadNotesTable();
