#!/usr/bin/env node

/**
 * Script para executar migrações em diferentes ambientes
 * Uso: node scripts/migrate-environment.js [ambiente]
 * Ambientes: dev, sandbox, prod
 */

require('dotenv').config();
const path = require('path');

// Configurações dos ambientes
const environments = {
  dev: {
    DB_HOST: 'database-1.cd2em8e0a6ot.sa-east-1.rds.amazonaws.com',
    DB_NAME: 'app_polox_dev',
    DB_USER: 'polox_dev_user',
    DB_PASSWORD: 'SenhaSeguraDev123!',
    description: '🧪 Desenvolvimento'
  },
  sandbox: {
    DB_HOST: 'database-1.cd2em8e0a6ot.sa-east-1.rds.amazonaws.com',
    DB_NAME: 'app_polox_sandbox',
    DB_USER: 'polox_sandbox_user', 
    DB_PASSWORD: 'SenhaSeguraSandbox123!',
    description: '🏗️ Sandbox/Homologação'
  },
  prod: {
    DB_HOST: 'database-1.cd2em8e0a6ot.sa-east-1.rds.amazonaws.com',
    DB_NAME: 'app_polox_prod',
    DB_USER: 'polox_prod_user',
    DB_PASSWORD: 'SenhaSeguraProd123!',
    description: '🚀 Produção'
  }
};

async function runMigration(environment) {
  const config = environments[environment];
  
  if (!config) {
    console.error(`❌ Ambiente '${environment}' não encontrado.`);
    console.log(`Ambientes disponíveis: ${Object.keys(environments).join(', ')}`);
    process.exit(1);
  }

  console.log(`🚀 Executando migrações no ambiente: ${config.description}`);
  console.log(`📍 Database: ${config.DB_NAME}`);
  console.log('');

  // Sobrescrever variáveis de ambiente temporariamente
  const originalEnv = {
    DB_HOST: process.env.DB_HOST,
    DB_NAME: process.env.DB_NAME,
    DB_USER: process.env.DB_USER,
    DB_PASSWORD: process.env.DB_PASSWORD
  };

  process.env.DB_HOST = config.DB_HOST;
  process.env.DB_NAME = config.DB_NAME;
  process.env.DB_USER = config.DB_USER;
  process.env.DB_PASSWORD = config.DB_PASSWORD;

  try {
    // Executar o migration runner
    const MigrationRunner = require('../migrations/migration-runner.js');
    
    // Simular execução já que não podemos importar diretamente
    console.log('⚠️ Para executar as migrações neste ambiente, execute:');
    console.log('');
    console.log(`DB_HOST="${config.DB_HOST}" \\`);
    console.log(`DB_NAME="${config.DB_NAME}" \\`);
    console.log(`DB_USER="${config.DB_USER}" \\`);
    console.log(`DB_PASSWORD="${config.DB_PASSWORD}" \\`);
    console.log(`npm run migrate`);
    console.log('');
    
  } catch (error) {
    console.error('❌ Erro ao executar migrações:', error.message);
  } finally {
    // Restaurar variáveis originais
    Object.assign(process.env, originalEnv);
  }
}

// Obter ambiente da linha de comando
const environment = process.argv[2] || 'dev';

// Confirmação de segurança para produção
if (environment === 'prod') {
  console.log('⚠️  ATENÇÃO: Você está prestes a executar migrações em PRODUÇÃO!');
  console.log('');
  console.log('🔐 Certifique-se de que:');
  console.log('  1. Você tem backup recente do banco');
  console.log('  2. As migrações foram testadas em sandbox');
  console.log('  3. Você tem autorização para alterar produção');
  console.log('');
  console.log('⏱️ Aguardando 5 segundos para confirmação...');
  
  setTimeout(() => {
    runMigration(environment);
  }, 5000);
} else {
  runMigration(environment);
}