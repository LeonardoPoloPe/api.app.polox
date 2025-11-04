const { Pool } = require('pg');
require('dotenv').config();

let SecretsManagerClient, GetSecretValueCommand;
try {
  const awsSdk = require("@aws-sdk/client-secrets-manager");
  SecretsManagerClient = awsSdk.SecretsManagerClient;
  GetSecretValueCommand = awsSdk.GetSecretValueCommand;
} catch (error) {
  console.log("ℹ️  AWS SDK não disponível.");
}

async function loadSecretsFromAWS(secretName) {
  if (!SecretsManagerClient) return null;

  try {
    const client = new SecretsManagerClient({ region: "sa-east-1" });
    const command = new GetSecretValueCommand({ SecretId: secretName });
    const response = await client.send(command);

    if (response.SecretString) {
      const secrets = JSON.parse(response.SecretString);
      console.log(`🔐 Credenciais carregadas: ${secretName}\n`);
      return {
        DB_HOST: secrets.host,
        DB_PORT: secrets.port,
        DB_NAME: secrets.dbname || secrets.database,
        DB_USER: secrets.username,
        DB_PASSWORD: secrets.password,
      };
    }
  } catch (error) {
    console.log(`⚠️  Erro: ${error.message}\n`);
  }

  return null;
}

async function fixProd() {
  const secretsConfig = await loadSecretsFromAWS("prd-mysql");
  
  const pool = new Pool({
    host: secretsConfig?.DB_HOST,
    port: secretsConfig?.DB_PORT || 5432,
    database: secretsConfig?.DB_NAME,
    user: secretsConfig?.DB_USER,
    password: secretsConfig?.DB_PASSWORD,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('🔧 Corrigindo estado do PROD...\n');
    
    // 1. Dropar tabela deals antiga (da estrutura pré-migration 034)
    console.log('🗑️  Dropando tabela deals antiga (pré-migration 034)...');
    await pool.query('DROP TABLE IF EXISTS polox.deals CASCADE;');
    console.log('   ✅ deals antiga removida\n');
    
    // 2. Verificar se contacts existe
    const contactsCheck = await pool.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'polox' AND table_name = 'contacts'
      );
    `);
    
    if (contactsCheck.rows[0].exists) {
      console.log('🔄 Revertendo contacts → contatos...');
      await pool.query('ALTER TABLE polox.contacts RENAME TO contatos;');
      console.log('   ✅ Revertido\n');
    }
    
    console.log('✅ PROD está pronto para re-executar migration 035!');
    
  } catch (err) {
    console.error('❌ Erro:', err.message);
  } finally {
    await pool.end();
  }
}

fixProd();
