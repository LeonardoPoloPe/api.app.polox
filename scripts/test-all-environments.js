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
 * 🧪 TESTE DE LOGIN EM TODOS OS AMBIENTES
 * 
 * Testa o endpoint de login nos ambientes DEV, SANDBOX e PROD
 */

const https = require('https');

const ENVIRONMENTS = {
  dev: 'https://z8ixwvp0qe.execute-api.sa-east-1.amazonaws.com/dev/api/v1',
  sandbox: 'https://el0qui6eqj.execute-api.sa-east-1.amazonaws.com/sandbox/api/v1',
  prod: 'https://18yioqws85.execute-api.sa-east-1.amazonaws.com/prod/api/v1'
};

const CREDENTIALS = {
  email: 'admin@polox.com',
  password: 'Admin@2024',
  rememberMe: false
};

// Cores no terminal
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function makeRequest(url, data) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const postData = JSON.stringify(data);
    
    const options = {
      hostname: urlObj.hostname,
      port: 443,
      path: urlObj.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': '*/*',
        'Accept-Language': 'pt',
        'Content-Length': Buffer.byteLength(postData)
      }
    };
    
    const req = https.request(options, (res) => {
      let body = '';
      
      res.on('data', (chunk) => {
        body += chunk;
      });
      
      res.on('end', () => {
        try {
          const jsonBody = JSON.parse(body);
          resolve({
            statusCode: res.statusCode,
            body: jsonBody
          });
        } catch (e) {
          resolve({
            statusCode: res.statusCode,
            body: body,
            parseError: true
          });
        }
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    req.write(postData);
    req.end();
  });
}

async function testEnvironment(envName, baseUrl) {
  const endpoint = `${baseUrl}/auth/login`;
  
  console.log('━'.repeat(60));
  console.log(`${colors.blue}🌍 Ambiente: ${envName.toUpperCase()}${colors.reset}`);
  console.log(`📍 URL: ${endpoint}`);
  console.log('');
  
  try {
    const response = await makeRequest(endpoint, CREDENTIALS);
    
    console.log(`📊 Status Code: ${response.statusCode}`);
    
    if (response.statusCode === 200 && response.body.success) {
      console.log(`${colors.green}✅ LOGIN BEM-SUCEDIDO${colors.reset}`);
      
      const user = response.body.data?.user || {};
      const token = response.body.data?.token || '';
      
      console.log(`👤 Usuário: ${user.name || 'N/A'}`);
      console.log(`📧 Email: ${user.email || 'N/A'}`);
      console.log(`🔐 Role: ${user.role || 'N/A'}`);
      console.log(`🏢 Company ID: ${user.companyId || 'N/A'}`);
      console.log(`🎫 Token: ${token.substring(0, 30)}...`);
      console.log('');
      
      return true;
    } else {
      console.log(`${colors.red}❌ FALHA NO LOGIN${colors.reset}`);
      console.log(`📄 Mensagem: ${response.body.message || 'N/A'}`);
      
      if (response.body.error) {
        console.log(`🔍 Erro: ${response.body.error.message || response.body.error.code}`);
      }
      
      console.log('');
      return false;
    }
  } catch (error) {
    console.log(`${colors.red}❌ ERRO DE CONEXÃO${colors.reset}`);
    console.log(`💥 ${error.message}`);
    console.log('');
    return false;
  }
}

async function main() {
  console.log('');
  console.log('═'.repeat(60));
  console.log('  🧪 TESTANDO LOGIN EM TODOS OS AMBIENTES');
  console.log('═'.repeat(60));
  console.log('');
  console.log(`📧 Email: ${CREDENTIALS.email}`);
  console.log(`🔑 Senha: ${CREDENTIALS.password}`);
  console.log('');
  
  const results = {};
  
  for (const [envName, baseUrl] of Object.entries(ENVIRONMENTS)) {
    results[envName] = await testEnvironment(envName, baseUrl);
  }
  
  // Resumo
  console.log('═'.repeat(60));
  console.log('  📊 RESUMO DOS TESTES');
  console.log('═'.repeat(60));
  console.log('');
  
  const successCount = Object.values(results).filter(r => r).length;
  const failCount = Object.values(results).filter(r => !r).length;
  
  for (const [envName, success] of Object.entries(results)) {
    const icon = success ? '✅' : '❌';
    const color = success ? colors.green : colors.red;
    const status = success ? 'OK' : 'FALHOU';
    console.log(`   ${icon} ${color}${envName.toUpperCase()}: ${status}${colors.reset}`);
  }
  
  console.log('');
  console.log(`✅ Sucessos: ${colors.green}${successCount}${colors.reset}`);
  console.log(`❌ Falhas: ${colors.red}${failCount}${colors.reset}`);
  console.log(`📦 Total: ${successCount + failCount}`);
  console.log('');
  
  if (failCount === 0) {
    console.log(`${colors.green}✨ Todos os ambientes estão funcionando!${colors.reset}`);
    console.log('');
    process.exit(0);
  } else {
    console.log(`${colors.yellow}⚠️  Alguns ambientes precisam de atenção.${colors.reset}`);
    console.log('');
    process.exit(1);
  }
}

main().catch(error => {
  console.error(`\n${colors.red}💥 Erro fatal:${colors.reset}`, error);
  process.exit(1);
});
