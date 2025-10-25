/**
 * Script para executar migrations no ambiente DEV
 * Usa as credenciais do template.yaml
 */

/**
 * 🚀 Script de Execução de Migrations
 * 
 * Este script executa as migrations pendentes no banco de dados
 * usando as configurações do arquivo .env
 * 
 * Uso: node scripts/run-migrations-dev.js
 * 
 * ⚠️ IMPORTANTE: 
 * - Configure o arquivo .env antes de executar
 * - Este script é apenas para desenvolvimento/testes
 * - Para produção, use os scripts npm ou migrations automáticas
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Carregar variáveis de ambiente
require('dotenv').config();

// ⚠️ Validação de segurança - só permite DEV e SANDBOX
const allowedEnvironments = ['dev', 'development', 'sandbox'];
const currentEnv = process.env.NODE_ENV || 'dev';

if (!allowedEnvironments.includes(currentEnv.toLowerCase())) {
  console.error('🚫 ERRO: Este script só pode ser executado em ambientes DEV ou SANDBOX!');
  console.error(`   Ambiente atual: ${currentEnv}`);
  console.error(`   Ambientes permitidos: ${allowedEnvironments.join(', ')}`);
  process.exit(1);
}

console.log(`🔧 Executando migrations no ambiente: ${currentEnv.toUpperCase()}`);

// Configuração do banco de dados DEV
const dbConfig = {
  host: process.env.DB_HOST || 'database-1.cd2em8e0a6ot.sa-east-1.rds.amazonaws.com',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'app_polox_dev',
  user: process.env.DB_USER || 'polox_dev_user',
  password: process.env.DB_PASSWORD || 'SUA_SENHA_AQUI',
  ssl: {
    rejectUnauthorized: false
  }
};class MigrationRunner {
  constructor() {
    this.pool = new Pool(dbConfig);
    // Corrigindo o caminho - migrations está na raiz do projeto, não em scripts
    this.migrationsDir = path.join(__dirname, '..', 'migrations');
  }

  /**
   * Cria a tabela de controle de migrations
   */
  async createMigrationsTable() {
    const query = `
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        migration_name VARCHAR(255) UNIQUE NOT NULL,
        executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;
    
    await this.pool.query(query);
    console.log("✅ Tabela de migrations criada/verificada");
  }

  /**
   * Lista migrations executadas
   */
  async getExecutedMigrations() {
    const result = await this.pool.query(
      "SELECT migration_name FROM migrations ORDER BY executed_at"
    );
    return result.rows.map(row => row.migration_name);
  }

  /**
   * Lista arquivos de migration disponíveis
   */
  getMigrationFiles() {
    const files = fs.readdirSync(this.migrationsDir)
      .filter(file => file.endsWith('.js') && file !== 'migration-runner.js')
      .sort();
    
    console.log("📋 Migrations encontradas:", files);
    return files;
  }

  /**
   * Executa migration específica
   */
  async executeMigration(filename) {
    const migrationPath = path.join(this.migrationsDir, filename);
    const migration = require(migrationPath);
    
    if (!migration.up) {
      throw new Error(`Migration ${filename} não possui método 'up'`);
    }

    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      console.log(`🔄 Executando migration: ${filename}`);
      await migration.up(client);
      
      // Registrar migration como executada (sem a extensão .js)
      const migrationName = filename.replace('.js', '');
      await client.query(
        "INSERT INTO migrations (migration_name) VALUES ($1)",
        [migrationName]
      );
      
      await client.query('COMMIT');
      console.log(`✅ Migration ${filename} executada com sucesso`);
      
    } catch (error) {
      await client.query('ROLLBACK');
      console.error(`❌ Erro na migration ${filename}:`, error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Executa todas as migrations pendentes
   */
  async runPendingMigrations() {
    try {
      console.log("🚀 Iniciando execução de migrations...");
      console.log("🔗 Conectando ao banco:", dbConfig.database, "em", dbConfig.host);
      
      // Testar conexão
      const client = await this.pool.connect();
      console.log("✅ Conexão com banco estabelecida");
      client.release();
      
      // Criar tabela de controle
      await this.createMigrationsTable();
      
      // Obter migrations
      const executedMigrations = await this.getExecutedMigrations();
      const availableMigrations = this.getMigrationFiles();
      
      console.log("📝 Migrations já executadas:", executedMigrations);
      
      // Encontrar migrations pendentes
      const pendingMigrations = availableMigrations.filter(migration => {
        // Remover a extensão .js para comparar com os nomes registrados
        const migrationName = migration.replace('.js', '');
        return !executedMigrations.includes(migrationName);
      });
      
      if (pendingMigrations.length === 0) {
        console.log("✅ Todas as migrations já foram executadas!");
        return;
      }
      
      console.log("⏳ Migrations pendentes:", pendingMigrations);
      
      // Executar migrations pendentes
      for (const migration of pendingMigrations) {
        await this.executeMigration(migration);
      }
      
      console.log("🎉 Todas as migrations foram executadas com sucesso!");
      
    } catch (error) {
      console.error("❌ Erro durante execução das migrations:", error);
      throw error;
    } finally {
      await this.pool.end();
    }
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  const runner = new MigrationRunner();
  runner.runPendingMigrations()
    .then(() => {
      console.log("✅ Script de migrations finalizado");
      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ Falha na execução das migrations:", error);
      process.exit(1);
    });
}

module.exports = MigrationRunner;