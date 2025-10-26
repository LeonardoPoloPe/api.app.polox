#!/usr/bin/env node

/**
 * 🧪 TESTE DE ESTRUTURA - COPILOT_PROMPT_1
 * 
 * Valida se toda a estrutura base foi implementada corretamente
 * sem depender de conexão com banco de dados
 */

require('dotenv').config();

console.log('🧪 INICIANDO TESTE DE ESTRUTURA BASE - COPILOT_PROMPT_1');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

let errors = [];
let warnings = [];
let success = [];

// ==========================================
// 🔍 TESTE 1: IMPORTAÇÕES BÁSICAS
// ==========================================
console.log('\n📦 Testando importações básicas...');

try {
  const { createApp } = require('../src/config/app');
  success.push('✅ src/config/app.js importado com sucesso');
  
  const authConfig = require('../src/config/auth');
  success.push('✅ src/config/auth.js importado com sucesso');
  
  const { ApiError } = require('../src/utils/errors');
  success.push('✅ src/utils/errors.js importado com sucesso');
  
  const { successResponse } = require('../src/utils/response');
  success.push('✅ src/utils/response.js importado com sucesso');
  
  const { logger } = require('../src/utils/logger');
  success.push('✅ src/utils/logger.js importado com sucesso');
  
  const { authMiddleware } = require('../src/middleware/auth');
  success.push('✅ src/middleware/auth.js importado com sucesso');
  
  const { tenantMiddleware } = require('../src/middleware/tenant');
  success.push('✅ src/middleware/tenant.js importado com sucesso');
  
  const { UserModel, CompanyModel } = require('../src/models');
  success.push('✅ Models importados com sucesso');
  
} catch (error) {
  errors.push(`❌ Erro ao importar módulos: ${error.message}`);
}

// ==========================================
// 🔍 TESTE 2: CRIAÇÃO DO APP EXPRESS
// ==========================================
console.log('\n⚙️ Testando criação do app Express...');

try {
  const { createApp } = require('../src/config/app');
  const app = createApp();
  
  if (app && typeof app.listen === 'function') {
    success.push('✅ App Express criado com sucesso');
  } else {
    errors.push('❌ App Express não foi criado corretamente');
  }
} catch (error) {
  errors.push(`❌ Erro ao criar app Express: ${error.message}`);
}

// ==========================================
// 🔍 TESTE 3: CONFIGURAÇÕES DE AUTENTICAÇÃO
// ==========================================
console.log('\n🔐 Testando configurações de autenticação...');

try {
  const authConfig = require('../src/config/auth');
  
  if (authConfig.jwt && authConfig.jwt.accessToken) {
    success.push('✅ Configurações JWT carregadas');
  } else {
    errors.push('❌ Configurações JWT não encontradas');
  }
  
  if (authConfig.bcrypt && authConfig.bcrypt.rounds) {
    success.push('✅ Configurações bcrypt carregadas');
  } else {
    errors.push('❌ Configurações bcrypt não encontradas');
  }
  
  if (authConfig.roles && authConfig.roles.hierarchy) {
    success.push('✅ Configurações de roles carregadas');
  } else {
    errors.push('❌ Configurações de roles não encontradas');
  }
  
} catch (error) {
  errors.push(`❌ Erro ao testar configurações de auth: ${error.message}`);
}

// ==========================================
// 🔍 TESTE 4: ESTRUTURA DE ERROS
// ==========================================
console.log('\n⚠️ Testando estrutura de erros...');

try {
  const { ApiError, ValidationError, AuthenticationError } = require('../src/utils/errors');
  
  const apiError = new ApiError(400, 'Teste');
  if (apiError.statusCode === 400 && apiError.message === 'Teste') {
    success.push('✅ ApiError funcionando corretamente');
  } else {
    errors.push('❌ ApiError não está funcionando');
  }
  
  const validationError = new ValidationError('Teste validação');
  if (validationError.statusCode === 422) {
    success.push('✅ ValidationError funcionando corretamente');
  } else {
    errors.push('❌ ValidationError não está funcionando');
  }
  
} catch (error) {
  errors.push(`❌ Erro ao testar estrutura de erros: ${error.message}`);
}

// ==========================================
// 🔍 TESTE 5: MIDDLEWARE
// ==========================================
console.log('\n🛡️ Testando middleware...');

try {
  const { authMiddleware } = require('../src/middleware/auth');
  const { tenantMiddleware } = require('../src/middleware/tenant');
  
  if (typeof authMiddleware === 'function') {
    success.push('✅ AuthMiddleware é uma função válida');
  } else {
    errors.push('❌ AuthMiddleware não é uma função');
  }
  
  if (typeof tenantMiddleware === 'function') {
    success.push('✅ TenantMiddleware é uma função válida');
  } else {
    errors.push('❌ TenantMiddleware não é uma função');
  }
  
} catch (error) {
  errors.push(`❌ Erro ao testar middleware: ${error.message}`);
}

// ==========================================
// 🔍 TESTE 6: MODELS
// ==========================================
console.log('\n📊 Testando models...');

try {
  const { UserModel, CompanyModel } = require('../src/models');
  
  if (UserModel && typeof UserModel.create === 'function') {
    success.push('✅ UserModel com métodos básicos');
  } else {
    errors.push('❌ UserModel não possui métodos necessários');
  }
  
  if (CompanyModel && typeof CompanyModel.create === 'function') {
    success.push('✅ CompanyModel com métodos básicos');
  } else {
    errors.push('❌ CompanyModel não possui métodos necessários');
  }
  
} catch (error) {
  errors.push(`❌ Erro ao testar models: ${error.message}`);
}

// ==========================================
// 🔍 TESTE 7: VARIÁVEIS DE AMBIENTE
// ==========================================
console.log('\n🌍 Testando variáveis de ambiente...');

const requiredEnvVars = [
  'NODE_ENV',
  'PORT',
  'DB_HOST',
  'DB_NAME',
  'DB_USER',
  'JWT_SECRET'
];

requiredEnvVars.forEach(envVar => {
  if (process.env[envVar]) {
    success.push(`✅ ${envVar} configurada`);
  } else {
    warnings.push(`⚠️ ${envVar} não configurada`);
  }
});

// ==========================================
// 📊 RESULTADOS FINAIS
// ==========================================
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📊 RESULTADOS DOS TESTES');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

if (success.length > 0) {
  console.log('\n✅ SUCESSOS:');
  success.forEach(msg => console.log(`   ${msg}`));
}

if (warnings.length > 0) {
  console.log('\n⚠️ AVISOS:');
  warnings.forEach(msg => console.log(`   ${msg}`));
}

if (errors.length > 0) {
  console.log('\n❌ ERROS:');
  errors.forEach(msg => console.log(`   ${msg}`));
}

// Resumo final
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`📈 RESUMO: ${success.length} sucessos, ${warnings.length} avisos, ${errors.length} erros`);

if (errors.length === 0) {
  console.log('\n🎉 ESTRUTURA BASE DO COPILOT_PROMPT_1 IMPLEMENTADA COM SUCESSO!');
  console.log('   Todas as funcionalidades básicas estão funcionando.');
  console.log('   Pronto para partir para o COPILOT_PROMPT_2.');
} else {
  console.log('\n❌ ESTRUTURA BASE TEM PROBLEMAS');
  console.log('   Corrija os erros antes de continuar.');
  process.exit(1);
}

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');