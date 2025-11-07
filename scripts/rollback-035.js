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

#!/usr/bin/env node
/**
 * Script para fazer rollback manual da migration 035 que falhou parcialmente
 * Remove o registro da tabela migrations e reverte as tabelas renomeadas
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
      console.log(`🔐 Credenciais carregadas do Secrets Manager: ${secretName}`);
      return {
        DB_HOST: secrets.host,
        DB_PORT: secrets.port,
        DB_NAME: secrets.dbname || secrets.database,
        DB_USER: secrets.username,
        DB_PASSWORD: secrets.password,
      };
    }
  } catch (error) {
    console.log(`⚠️  Erro ao carregar secret ${secretName}: ${error.message}`);
  }

  return null;
}

const environments = {
  dev: { secretName: 'dev-mysql', database: 'app_polox_dev' },
  sandbox: { secretName: 'sandbox-mysql', database: 'app_polox_sandbox' },
  test: { secretName: 'dev-mysql', database: 'app_polox_test' },
  prod: { secretName: 'prd-mysql', database: 'app_polox_prod' }
};

async function rollbackPartialMigration(envName) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`🔄 ROLLBACK PARCIAL - Ambiente: ${envName.toUpperCase()}`);
  console.log('='.repeat(70));
  
  const envConfig = environments[envName];
  const secretsConfig = await loadSecretsFromAWS(envConfig.secretName);
  
  if (!secretsConfig) {
    console.log(`❌ Não foi possível carregar credenciais para ${envName}`);
    return false;
  }
  
  const pool = new Pool({
    host: secretsConfig.DB_HOST,
    port: secretsConfig.DB_PORT,
    database: secretsConfig.DB_NAME,
    user: secretsConfig.DB_USER,
    password: secretsConfig.DB_PASSWORD,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    // 1. Verificar se migration 035 está registrada
    const migCheck = await pool.query(
      "SELECT * FROM migrations WHERE migration_name = '035_rename_tables_to_english'"
    );
    
    if (migCheck.rows.length > 0) {
      console.log('⚠️  Migration 035 registrada, mas falhou parcialmente');
      console.log('🗑️  Removendo registro...');
      await pool.query(
        "DELETE FROM migrations WHERE migration_name = '035_rename_tables_to_english'"
      );
      console.log('   ✅ Registro removido');
    } else {
      console.log('ℹ️  Migration 035 não está registrada');
    }
    
    // 2. Verificar estado das tabelas
    const tablesCheck = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'polox' 
      AND table_name IN ('contacts', 'contatos', 'deals', 'negociacoes')
      ORDER BY table_name
    `);
    
    console.log('\n📋 Tabelas encontradas:');
    tablesCheck.rows.forEach(r => console.log(`   - ${r.table_name}`));
    
    const hasContacts = tablesCheck.rows.some(r => r.table_name === 'contacts');
    const hasContatos = tablesCheck.rows.some(r => r.table_name === 'contatos');
    
    // 3. Reverter renomeação se necessário
    if (hasContacts && !hasContatos) {
      console.log('\n🔄 Revertendo renomeação de tabelas...');
      await pool.query('ALTER TABLE polox.contacts RENAME TO contatos;');
      console.log('   ✅ contacts → contatos');
      
      await pool.query('ALTER TABLE polox.deals RENAME TO negociacoes;');
      console.log('   ✅ deals → negociacoes');
      
      await pool.query('ALTER TABLE polox.contact_notes RENAME TO contato_notas;');
      console.log('   ✅ contact_notes → contato_notas');
      
      await pool.query('ALTER TABLE polox.contact_tags RENAME TO contato_tags;');
      console.log('   ✅ contact_tags → contato_tags');
      
      await pool.query('ALTER TABLE polox.contact_interests RENAME TO contato_interesses;');
      console.log('   ✅ contact_interests → contato_interesses');
    } else if (hasContatos) {
      console.log('\n✅ Tabelas já estão com nomes em português');
    } else if (hasContacts) {
      console.log('\n⚠️  Tabelas já estão renomeadas para inglês (ok para re-executar migration)');
    }
    
    console.log(`\n✅ Rollback de ${envName} concluído!`);
    return true;
    
  } catch (error) {
    console.error(`\n❌ Erro no rollback de ${envName}:`, error.message);
    return false;
  } finally {
    await pool.end();
  }
}

async function main() {
  const env = process.argv[2];
  
  if (env && environments[env]) {
    // Rollback de ambiente específico
    await rollbackPartialMigration(env);
  } else if (env === 'all') {
    // Rollback de todos os ambientes
    console.log('\n🚀 Executando rollback em todos os ambientes...\n');
    for (const envName of ['dev', 'sandbox', 'test']) {
      await rollbackPartialMigration(envName);
    }
  } else {
    console.log('\n❌ Uso: node scripts/rollback-035.js [ambiente]');
    console.log('\nAmbientes: dev, sandbox, test, prod, all');
    console.log('\nExemplos:');
    console.log('  node scripts/rollback-035.js dev');
    console.log('  node scripts/rollback-035.js all\n');
    process.exit(1);
  }
}

main();
