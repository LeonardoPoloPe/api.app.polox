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

// AWS SDK
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

async function checkIndexes() {
  const secretsConfig = await loadSecretsFromAWS("dev-mysql");
  
  const pool = new Pool({
    host: secretsConfig?.DB_HOST,
    port: secretsConfig?.DB_PORT || 5432,
    database: secretsConfig?.DB_NAME,
    user: secretsConfig?.DB_USER,
    password: secretsConfig?.DB_PASSWORD,
    ssl: { rejectUnauthorized: false }
  });

  try {
    const result = await pool.query(`
      SELECT 
        tablename,
        indexname
      FROM pg_indexes
      WHERE schemaname = 'polox'
        AND tablename IN ('contacts', 'contatos')
      ORDER BY tablename, indexname;
    `);
    
    console.log('📊 Indexes da tabela contacts/contatos:');
    console.log('='.repeat(70));
    result.rows.forEach(r => {
      console.log(`${r.tablename}.${r.indexname}`);
    });
    
  } catch (err) {
    console.error('❌ Erro:', err.message);
  } finally {
    await pool.end();
  }
}

checkIndexes();
