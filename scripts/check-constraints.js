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

const { Pool } = require('pg');
require('dotenv').config();

// AWS SDK para carregar secrets
let SecretsManagerClient, GetSecretValueCommand;
try {
  const awsSdk = require("@aws-sdk/client-secrets-manager");
  SecretsManagerClient = awsSdk.SecretsManagerClient;
  GetSecretValueCommand = awsSdk.GetSecretValueCommand;
} catch (error) {
  console.log("ℹ️  AWS SDK não disponível. Usando credenciais locais.");
}

/**
 * Carrega credenciais do AWS Secrets Manager
 */
async function loadSecretsFromAWS(secretName) {
  if (!SecretsManagerClient) {
    return null;
  }

  try {
    const client = new SecretsManagerClient({ region: "sa-east-1" });
    const command = new GetSecretValueCommand({ SecretId: secretName });
    const response = await client.send(command);

    if (response.SecretString) {
      const secrets = JSON.parse(response.SecretString);
      console.log(`🔐 Credenciais carregadas do Secrets Manager: ${secretName}\n`);
      return {
        DB_HOST: secrets.host,
        DB_PORT: secrets.port,
        DB_NAME: secrets.dbname || secrets.database,
        DB_USER: secrets.username,
        DB_PASSWORD: secrets.password,
      };
    }
  } catch (error) {
    console.log(`⚠️  Não foi possível carregar secret ${secretName}: ${error.message}`);
    console.log("🔄 Usando credenciais de ambiente...\n");
  }

  return null;
}

async function checkConstraints() {
  // Carregar credenciais do AWS Secrets Manager
  const secretsConfig = await loadSecretsFromAWS("dev-mysql");
  
  const pool = new Pool({
    host: process.env.DB_HOST || secretsConfig?.DB_HOST,
    port: process.env.DB_PORT || secretsConfig?.DB_PORT || 5432,
    database: process.env.DB_NAME || secretsConfig?.DB_NAME || 'app_polox_dev',
    user: process.env.DB_USER || secretsConfig?.DB_USER || 'polox_dev_user',
    password: process.env.DB_PASSWORD || secretsConfig?.DB_PASSWORD,
    ssl: { rejectUnauthorized: false }
  });
  try {
    console.log('🔍 Verificando CHECK Constraints da tabela polox.contacts...\n');
    
    const result = await pool.query(`
      SELECT 
        con.conname AS constraint_name,
        pg_get_constraintdef(con.oid) AS constraint_def
      FROM pg_catalog.pg_constraint con
      INNER JOIN pg_catalog.pg_class rel ON rel.oid = con.conrelid
      INNER JOIN pg_catalog.pg_namespace nsp ON nsp.oid = connamespace
      WHERE nsp.nspname = 'polox'
        AND rel.relname = 'contacts'
        AND con.contype = 'c'
      ORDER BY con.conname;
    `);
    
    console.log('✅ CHECK Constraints encontradas:');
    console.log('='.repeat(70));
    result.rows.forEach(r => {
      console.log(`\n📌 Constraint: ${r.constraint_name}`);
      console.log(`   Definição: ${r.constraint_def}`);
    });
    
    if (result.rows.length === 0) {
      console.log('\n⚠️  Nenhuma CHECK constraint encontrada na tabela contacts!');
    }
    
    console.log('\n\n🔍 Verificando CHECK Constraints da tabela polox.deals...\n');
    
    const dealsResult = await pool.query(`
      SELECT 
        con.conname AS constraint_name,
        pg_get_constraintdef(con.oid) AS constraint_def
      FROM pg_catalog.pg_constraint con
      INNER JOIN pg_catalog.pg_class rel ON rel.oid = con.conrelid
      INNER JOIN pg_catalog.pg_namespace nsp ON nsp.oid = connamespace
      WHERE nsp.nspname = 'polox'
        AND rel.relname = 'deals'
        AND con.contype = 'c'
      ORDER BY con.conname;
    `);
    
    console.log('✅ CHECK Constraints de deals:');
    console.log('='.repeat(70));
    dealsResult.rows.forEach(r => {
      console.log(`\n📌 Constraint: ${r.constraint_name}`);
      console.log(`   Definição: ${r.constraint_def}`);
    });
    
    console.log('\n\n🔍 Verificando CHECK Constraints da tabela polox.contact_notes...\n');
    
    const notesResult = await pool.query(`
      SELECT 
        con.conname AS constraint_name,
        pg_get_constraintdef(con.oid) AS constraint_def
      FROM pg_catalog.pg_constraint con
      INNER JOIN pg_catalog.pg_class rel ON rel.oid = con.conrelid
      INNER JOIN pg_catalog.pg_namespace nsp ON nsp.oid = connamespace
      WHERE nsp.nspname = 'polox'
        AND rel.relname = 'contact_notes'
        AND con.contype = 'c'
      ORDER BY con.conname;
    `);
    
    console.log('✅ CHECK Constraints de contact_notes:');
    console.log('='.repeat(70));
    notesResult.rows.forEach(r => {
      console.log(`\n📌 Constraint: ${r.constraint_name}`);
      console.log(`   Definição: ${r.constraint_def}`);
    });
    
  } catch (err) {
    console.error('❌ Erro:', err.message);
  } finally {
    await pool.end();
  }
}

checkConstraints();
