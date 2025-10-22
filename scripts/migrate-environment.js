#!/usr/bin/env node

/**
 * Script para executar migrações em diferentes ambientes
 * Uso: node scripts/migrate-environment.js [ambiente] [comando]
 * 
 * Ambientes: dev, sandbox, prod
 * Comandos: status, migrate, rollback
 * 
 * Exemplos:
 *   node scripts/migrate-environment.js sandbox status
 *   node scripts/migrate-environment.js sandbox migrate
 *   node scripts/migrate-environment.js prod status
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Configurações dos ambientes
const environments = {
  dev: {
    DB_HOST: 'database-1.cd2em8e0a6ot.sa-east-1.rds.amazonaws.com',
    DB_PORT: 5432,
    DB_NAME: 'app_polox_dev',
    DB_USER: 'polox_dev_user',
    DB_PASSWORD: 'SenhaSeguraDev123!',
    description: '🧪 Desenvolvimento'
  },
  sandbox: {
    DB_HOST: 'database-1.cd2em8e0a6ot.sa-east-1.rds.amazonaws.com',
    DB_PORT: 5432,
    DB_NAME: 'app_polox_sandbox',
    DB_USER: 'polox_sandbox_user', 
    DB_PASSWORD: 'PoloxHjdfhrhcvfBCSsgdo2x12',
    description: '🏗️ Sandbox/Homologação'
  },
  prod: {
    DB_HOST: 'database-1.cd2em8e0a6ot.sa-east-1.rds.amazonaws.com',
    DB_PORT: 5432,
    DB_NAME: 'app_polox_prod',
    DB_USER: 'polox_prod_user',
    DB_PASSWORD: 'Hsagasdbghnsafdnjsgvdlknfg',
    description: '🚀 Produção'
  }
};

class EnvironmentMigrationRunner {
  constructor(envConfig) {
    this.config = envConfig;
    this.pool = new Pool({
      host: envConfig.DB_HOST,
      port: envConfig.DB_PORT,
      database: envConfig.DB_NAME,
      user: envConfig.DB_USER,
      password: envConfig.DB_PASSWORD,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 30000,
      idleTimeoutMillis: 30000,
      max: 5
    });
    this.migrationsDir = path.join(__dirname, '..', 'migrations');
  }

  async createMigrationsTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_migrations_name ON migrations(name);
    `;
    await this.pool.query(query);
    console.log("✅ Tabela de migrations criada/verificada");
  }

  async getExecutedMigrations() {
    const result = await this.pool.query(
      "SELECT name FROM migrations ORDER BY executed_at ASC"
    );
    return result.rows.map(row => row.name);
  }

  getMigrationFiles() {
    return fs.readdirSync(this.migrationsDir)
      .filter(file => file.endsWith('.js') && file !== 'migration-runner.js')
      .sort();
  }

  async executeMigration(migrationFile) {
    const migrationPath = path.join(this.migrationsDir, migrationFile);
    const migrationName = path.basename(migrationFile, '.js');
    
    delete require.cache[require.resolve(migrationPath)];
    const migration = require(migrationPath);

    console.log(`� Executando: ${migrationName}`);
    
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await migration.up(client);
      await client.query('INSERT INTO migrations (name) VALUES ($1)', [migrationName]);
      await client.query('COMMIT');
      console.log(`✅ ${migrationName} executada com sucesso`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async rollbackMigration(migrationFile) {
    const migrationPath = path.join(this.migrationsDir, migrationFile);
    const migrationName = path.basename(migrationFile, '.js');
    
    delete require.cache[require.resolve(migrationPath)];
    const migration = require(migrationPath);

    if (!migration.down) {
      throw new Error(`Migration ${migrationName} não possui método down()`);
    }

    console.log(`🔄 Revertendo: ${migrationName}`);
    
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await migration.down(client);
      await client.query('DELETE FROM migrations WHERE name = $1', [migrationName]);
      await client.query('COMMIT');
      console.log(`✅ ${migrationName} revertida com sucesso`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async showStatus() {
    await this.createMigrationsTable();
    const executedMigrations = await this.getExecutedMigrations();
    const migrationFiles = this.getMigrationFiles();

    console.log('\n📊 STATUS DAS MIGRATIONS');
    console.log('========================\n');

    migrationFiles.forEach(file => {
      const migrationName = path.basename(file, '.js');
      const isExecuted = executedMigrations.includes(migrationName);
      const status = isExecuted ? '✅ EXECUTADA' : '⏳ PENDENTE';
      console.log(`${status} - ${migrationName}`);
    });

    console.log(`\nTotal: ${migrationFiles.length} migrations`);
    console.log(`Executadas: ${executedMigrations.length}`);
    console.log(`Pendentes: ${migrationFiles.length - executedMigrations.length}\n`);
  }

  async runPendingMigrations() {
    await this.createMigrationsTable();
    const executedMigrations = await this.getExecutedMigrations();
    const migrationFiles = this.getMigrationFiles();
    const pendingMigrations = migrationFiles.filter(
      file => !executedMigrations.includes(path.basename(file, '.js'))
    );

    if (pendingMigrations.length === 0) {
      console.log('✅ Nenhuma migration pendente');
      return;
    }

    console.log(`🚀 Executando ${pendingMigrations.length} migration(s) pendente(s)\n`);
    
    for (const migrationFile of pendingMigrations) {
      await this.executeMigration(migrationFile);
    }

    console.log('\n🎉 Todas as migrations foram executadas com sucesso!');
  }

  async rollbackLastMigration() {
    await this.createMigrationsTable();
    const executedMigrations = await this.getExecutedMigrations();

    if (executedMigrations.length === 0) {
      console.log('ℹ️ Nenhuma migration para reverter');
      return;
    }

    const lastMigration = executedMigrations[executedMigrations.length - 1];
    const migrationFile = `${lastMigration}.js`;
    await this.rollbackMigration(migrationFile);
  }

  async close() {
    await this.pool.end();
  }
}

async function main() {
  const environment = process.argv[2] || 'dev';
  const command = process.argv[3] || 'status';
  
  const config = environments[environment];
  
  if (!config) {
    console.error(`❌ Ambiente '${environment}' não encontrado.`);
    console.log(`\nAmbientes disponíveis: ${Object.keys(environments).join(', ')}`);
    console.log(`\nUso: node scripts/migrate-environment.js [ambiente] [comando]`);
    console.log(`Comandos: status, migrate, rollback\n`);
    process.exit(1);
  }

  console.log(`\n${config.description}`);
  console.log(`📍 Database: ${config.DB_NAME}`);
  console.log(`🌐 Host: ${config.DB_HOST}\n`);

  // Confirmação de segurança para produção
  if (environment === 'prod' && command === 'migrate') {
    console.log('⚠️  ATENÇÃO: MIGRAÇÕES EM PRODUÇÃO!\n');
    console.log('🔐 Certifique-se:');
    console.log('  ✓ Backup recente do banco');
    console.log('  ✓ Migrações testadas em sandbox');
    console.log('  ✓ Autorização para alterar produção\n');
    console.log('⏱️  Aguardando 5 segundos...\n');
    
    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  const runner = new EnvironmentMigrationRunner(config);

  try {
    switch (command) {
      case 'status':
        await runner.showStatus();
        break;
      
      case 'migrate':
        await runner.runPendingMigrations();
        break;
      
      case 'rollback':
        if (environment === 'prod') {
          console.error('❌ Rollback em produção não é permitido!');
          console.log('💡 Crie uma migration corretiva ao invés de fazer rollback.\n');
          process.exit(1);
        }
        await runner.rollbackLastMigration();
        break;
      
      default:
        console.error(`❌ Comando '${command}' não reconhecido`);
        console.log('Comandos disponíveis: status, migrate, rollback\n');
        process.exit(1);
    }
  } catch (error) {
    console.error('\n❌ Erro:', error.message);
    process.exit(1);
  } finally {
    await runner.close();
  }
}

main();