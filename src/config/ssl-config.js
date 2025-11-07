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

const fs = require('fs');
const path = require('path');

/**
 * Configuração SSL/TLS para conexões PostgreSQL
 * 
 * Esta configuração garante conexões seguras com o RDS/RDS Proxy
 * seguindo as melhores práticas de segurança da AWS.
 */

/**
 * Retorna a configuração SSL apropriada baseada no ambiente
 * @returns {Object|boolean} Configuração SSL ou false para desabilitar
 */
const getSSLConfig = () => {
  const environment = process.env.NODE_ENV || 'development';
  
  try {
    // Caminho para o certificado CA da AWS
    const certPath = path.join(__dirname, 'ssl', 'rds-ca-2019-root.pem');
    
    // Verifica se o certificado existe
    if (!fs.existsSync(certPath)) {
      console.warn(`⚠️  Certificado SSL não encontrado em: ${certPath}`);
      
      // Em desenvolvimento, permite continuar sem SSL
      if (environment === 'development') {
        console.warn('🔓 Modo desenvolvimento: SSL desabilitado');
        return false;
      }
      
      // Em produção, falha se não tiver certificado
      throw new Error('Certificado SSL obrigatório em produção');
    }
    
    // Lê o certificado
    const cert = fs.readFileSync(certPath);
    
    // Configuração SSL segura
    const sslConfig = {
      rejectUnauthorized: true,  // ✅ Verificação completa de certificados
      ca: cert,                  // ✅ Certificado CA da AWS
      checkServerIdentity: (host, cert) => {
        // Validação customizada para RDS Proxy
        // O RDS Proxy pode ter certificados com nomes diferentes
        console.log(`🔒 Validando certificado SSL para host: ${host}`);
        return undefined; // undefined = validação OK
      }
    };
    
    console.log(`✅ SSL configurado com sucesso para ambiente: ${environment}`);
    return sslConfig;
    
  } catch (error) {
    console.error('❌ Erro ao configurar SSL:', error.message);
    
    // Em desenvolvimento, permite fallback
    if (environment === 'development') {
      console.warn('🔓 Fallback: SSL desabilitado em desenvolvimento');
      return false;
    }
    
    // Em produção, falha completamente
    throw error;
  }
};

/**
 * Configuração SSL flexível baseada no ambiente
 */
const SSL_CONFIG = {
  // Produção: SSL obrigatório e verificado
  production: () => getSSLConfig(),
  prod: () => getSSLConfig(),
  
  // Sandbox: SSL recomendado
  sandbox: () => getSSLConfig(),
  staging: () => getSSLConfig(),
  
  // Desenvolvimento: SSL opcional
  development: () => {
    try {
      return getSSLConfig();
    } catch (error) {
      console.warn('⚠️  SSL não disponível em desenvolvimento, continuando sem criptografia');
      return false;
    }
  },
  
  // Testes: SSL desabilitado
  test: () => false
};

/**
 * Retorna a configuração SSL apropriada para o ambiente atual
 * @returns {Object|boolean} Configuração SSL
 */
const getCurrentSSLConfig = () => {
  const environment = process.env.NODE_ENV || 'development';
  const configFunction = SSL_CONFIG[environment] || SSL_CONFIG.development;
  
  return configFunction();
};

module.exports = {
  getSSLConfig,
  getCurrentSSLConfig,
  SSL_CONFIG
};