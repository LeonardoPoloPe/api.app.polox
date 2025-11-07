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

/**
 * 🔐 Utilitário para carregar secrets do AWS Parameter Store
 * Uso: const secrets = await loadSecrets('prod'); 
 */

const AWS = require('aws-sdk');

// Configurar AWS SDK
AWS.config.update({ region: 'sa-east-1' });
const ssm = new AWS.SSM();

/**
 * Carrega todos os parâmetros de um ambiente específico
 * @param {string} environment - dev, sandbox, prod
 * @returns {Object} Objeto com todas as configurações
 */
async function loadSecrets(environment = 'dev') {
  try {
    console.log(`🔐 Carregando secrets para ambiente: ${environment}`);
    
    // Buscar todos os parâmetros do ambiente
    const params = {
      Path: `/polox/${environment}`,
      Recursive: true,
      WithDecryption: true
    };

    const result = await ssm.getParametersByPath(params).promise();
    
    // Converter para objeto estruturado
    const secrets = {};
    
    result.Parameters.forEach(param => {
      const keyPath = param.Name.replace(`/polox/${environment}/`, '');
      const keys = keyPath.split('/');
      
      // Criar estrutura aninhada
      let current = secrets;
      for (let i = 0; i < keys.length - 1; i++) {
        if (!current[keys[i]]) {
          current[keys[i]] = {};
        }
        current = current[keys[i]];
      }
      
      current[keys[keys.length - 1]] = param.Value;
    });

    console.log(`✅ Carregados ${result.Parameters.length} parâmetros`);
    return secrets;
    
  } catch (error) {
    console.error('❌ Erro ao carregar secrets:', error.message);
    throw error;
  }
}

/**
 * Carrega um parâmetro específico
 * @param {string} paramName - Nome completo do parâmetro (ex: /polox/prod/db/password)
 * @returns {string} Valor do parâmetro
 */
async function getParameter(paramName) {
  try {
    const params = {
      Name: paramName,
      WithDecryption: true
    };

    const result = await ssm.getParameter(params).promise();
    return result.Parameter.Value;
    
  } catch (error) {
    console.error(`❌ Erro ao buscar parâmetro ${paramName}:`, error.message);
    throw error;
  }
}

/**
 * Cria configuração de banco a partir dos secrets carregados
 * @param {string} environment - dev, sandbox, prod 
 * @returns {Object} Configuração pronta para uso com pg.Pool
 */
async function getDatabaseConfig(environment = 'dev') {
  const secrets = await loadSecrets(environment);
  
  // Determinar host baseado no ambiente de execução
  let host = secrets.db.host; // host direto por padrão
  
  if (environment === 'prod') {
    // Se estiver rodando na AWS (Lambda/ECS), usar proxy
    // Se estiver rodando localmente, usar host direto
    const isRunningInAWS = process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.ECS_CONTAINER_METADATA_URI;
    host = isRunningInAWS ? secrets.db['proxy-host'] : secrets.db.host;
  }
  
  return {
    host: host,
    port: 5432,
    database: secrets.db.name,
    user: secrets.db.user,
    password: secrets.db.password,
    ssl: {
      rejectUnauthorized: false
    },
    connectionTimeoutMillis: 30000,
    idleTimeoutMillis: 30000
  };
}

/**
 * Exemplo de uso para migrations
 */
async function exampleUsage() {
  try {
    // Carregar configuração de produção
    const prodConfig = await getDatabaseConfig('prod');
    console.log('📊 Config de produção carregada:', {
      host: prodConfig.host,
      database: prodConfig.database,
      user: prodConfig.user,
      password: '***hidden***'
    });

    // Carregar JWT secret
    const jwtSecret = await getParameter('/polox/prod/jwt/secret');
    console.log('🔑 JWT Secret carregado:', jwtSecret.substring(0, 10) + '...');

    // Carregar todos os secrets de dev
    const devSecrets = await loadSecrets('dev');
    console.log('🔧 Secrets de DEV:', Object.keys(devSecrets));
    
  } catch (error) {
    console.error('❌ Erro no exemplo:', error.message);
  }
}

module.exports = {
  loadSecrets,
  getParameter,
  getDatabaseConfig,
  exampleUsage
};

// Executar exemplo se chamado diretamente
if (require.main === module) {
  exampleUsage();
}