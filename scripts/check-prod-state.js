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

const { Pool } = require("pg");
require("dotenv").config();

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

async function checkProdState() {
  const secretsConfig = await loadSecretsFromAWS("prd-mysql");

  const pool = new Pool({
    host: secretsConfig?.DB_HOST,
    port: secretsConfig?.DB_PORT || 5432,
    database: secretsConfig?.DB_NAME,
    user: secretsConfig?.DB_USER,
    password: secretsConfig?.DB_PASSWORD,
    ssl: { rejectUnauthorized: false },
  });

  try {
    console.log("📋 Verificando estado do PROD...\n");

    const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'polox' 
      AND table_name IN ('contacts', 'contatos', 'deals', 'negociacoes')
      ORDER BY table_name;
    `);

    console.log("Tabelas encontradas:");
    result.rows.forEach((r) => console.log(`  - ${r.table_name}`));

    console.log("\n📝 Migration 035 registrada?");
    const migCheck = await pool.query(
      "SELECT * FROM migrations WHERE migration_name = '035_rename_tables_to_english'"
    );
    console.log(migCheck.rows.length > 0 ? "  ✅ Sim" : "  ❌ Não");
  } catch (err) {
    console.error("❌ Erro:", err.message);
  } finally {
    await pool.end();
  }
}

checkProdState();
