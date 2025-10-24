/**
 * Script para executar Migration 032
 * Cria a função polox.cleanup_custom_field_values()
 * 
 * Uso:
 *   node scripts/run-migration-032.js dev
 *   node scripts/run-migration-032.js sandbox
 *   node scripts/run-migration-032.js prod
 */

const { Pool } = require('pg');
const AWS = require('aws-sdk');

// Configurar AWS SDK
AWS.config.update({ region: 'sa-east-1' });
const secretsManager = new AWS.SecretsManager({ httpOptions: { timeout: 3000 } });

// Mapear ambientes para nomes de secrets
const SECRET_NAMES = {
  dev: 'dev-mysql',
  sandbox: 'sandbox-mysql',
  prod: 'prd-mysql'
};

// Mapear ambientes para nomes de bancos
const DATABASE_NAMES = {
  dev: 'app_polox_dev',
  sandbox: 'app_polox_sandbox',
  prod: 'app_polox_prod'
};

/**
 * Buscar credenciais do AWS Secrets Manager
 */
async function getSecrets(environment) {
  const secretName = SECRET_NAMES[environment];
  
  if (!secretName) {
    throw new Error(`Ambiente inválido: ${environment}. Use: dev, sandbox ou prod`);
  }

  console.log(`🔐 Buscando credenciais do AWS Secrets Manager: ${secretName}...`);

  try {
    const data = await secretsManager.getSecretValue({ SecretId: secretName }).promise();
    
    if ('SecretString' in data) {
      return JSON.parse(data.SecretString);
    } else {
      const buff = Buffer.from(data.SecretBinary, 'base64');
      return JSON.parse(buff.toString('ascii'));
    }
  } catch (error) {
    console.error('❌ Erro ao buscar credenciais:', error.message);
    throw error;
  }
}

/**
 * Executar migration
 */
async function runMigration(environment) {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`🚀 Migration 032 - Ambiente: ${environment.toUpperCase()}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Validação de ambiente
  if (!['dev', 'sandbox', 'prod'].includes(environment)) {
    console.error('❌ Ambiente inválido! Use: dev, sandbox ou prod');
    process.exit(1);
  }

  // Confirmação para produção
  if (environment === 'prod') {
    console.log('⚠️  ATENÇÃO: Você está prestes a executar esta migration em PRODUÇÃO!');
    console.log('');
    console.log('Esta migration irá:');
    console.log('  ✓ Criar função polox.cleanup_custom_field_values()');
    console.log('');
    console.log('Para continuar, digite: CONFIRMAR');
    
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const answer = await new Promise(resolve => {
      readline.question('> ', resolve);
    });
    readline.close();

    if (answer !== 'CONFIRMAR') {
      console.log('❌ Operação cancelada pelo usuário.');
      process.exit(0);
    }
    console.log('');
  }

  let pool;

  try {
    // Buscar credenciais
    const secrets = await getSecrets(environment);
    const dbName = DATABASE_NAMES[environment];

    console.log(`📊 Banco de dados: ${dbName}`);
    console.log(`🔗 Host: ${secrets.host}\n`);

    // Criar pool de conexões
    pool = new Pool({
      host: secrets.host,
      port: secrets.port,
      database: dbName,
      user: secrets.username,
      password: secrets.password,
      max: 5,
      connectionTimeoutMillis: 30000,
      idleTimeoutMillis: 30000,
      ssl: {
        rejectUnauthorized: false
      }
    });

    // Testar conexão
    const client = await pool.connect();
    console.log('✅ Conectado ao banco de dados!\n');

    try {
      // Iniciar transação
      await client.query('BEGIN');
      console.log('🔄 Transação iniciada...\n');

      // Carregar migration
      const migration = require('../migrations/032_create_cleanup_function');

      // Executar UP
      console.log('📝 Executando Migration 032 UP...\n');
      await migration.up(client);

      // Commit
      await client.query('COMMIT');
      console.log('\n✅ Transação commitada com sucesso!');

      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('✅ Migration 032 concluída com sucesso em ' + environment.toUpperCase() + '!');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

      console.log('📋 Resumo:');
      console.log('  ✓ Função polox.cleanup_custom_field_values() criada');
      console.log('  ✓ Função pronta para uso pelos triggers\n');

      console.log('🔍 Verificação:');
      console.log('  SELECT routine_name, routine_type');
      console.log('  FROM information_schema.routines');
      console.log('  WHERE routine_schema = \'polox\'');
      console.log('  AND routine_name = \'cleanup_custom_field_values\';\n');

    } catch (error) {
      // Rollback em caso de erro
      await client.query('ROLLBACK');
      console.error('\n❌ Erro durante migration. Transação revertida (ROLLBACK).');
      throw error;
    } finally {
      client.release();
    }

  } catch (error) {
    console.error('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('❌ ERRO na Migration 032');
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.error('Detalhes:', error.message);
    console.error('\nStack:', error.stack);
    process.exit(1);
  } finally {
    if (pool) {
      await pool.end();
      console.log('🔌 Conexões encerradas.\n');
    }
  }
}

// Executar
const environment = process.argv[2];

if (!environment) {
  console.error('❌ Erro: Ambiente não especificado!');
  console.log('\nUso: node scripts/run-migration-032.js <ambiente>');
  console.log('\nAmbientes disponíveis:');
  console.log('  - dev      (Desenvolvimento)');
  console.log('  - sandbox  (Homologação)');
  console.log('  - prod     (Produção - requer confirmação)\n');
  process.exit(1);
}

runMigration(environment);
