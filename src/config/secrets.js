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
 * 🔐 AWS Secrets Manager Integration
 * Carrega credenciais de banco de dados do AWS Secrets Manager
 */

const {
  SecretsManagerClient,
  GetSecretValueCommand,
} = require("@aws-sdk/client-secrets-manager");

class SecretsManager {
  constructor() {
    this.client = new SecretsManagerClient({ 
      region: "sa-east-1",
      requestHandler: {
        requestTimeout: 2000, // 2 segundos de timeout
      }
    });
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutos
  }

  /**
   * Carrega secrets do AWS Secrets Manager
   * @param {string} secretName - Nome do secret (ex: dev-mysql)
   * @returns {Promise<Object>} Credenciais decodificadas
   */
  async getSecret(secretName) {
    // Verificar cache primeiro
    const cached = this.cache.get(secretName);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }

    try {
      const command = new GetSecretValueCommand({ SecretId: secretName });
      const response = await this.client.send(command);

      if (!response.SecretString) {
        throw new Error(`Secret ${secretName} não contém SecretString`);
      }

      const secretData = JSON.parse(response.SecretString);

      // Cache do resultado
      this.cache.set(secretName, {
        data: secretData,
        timestamp: Date.now(),
      });

      console.log(
        `🔐 Credenciais carregadas do Secrets Manager: ${secretName}`
      );
      return secretData;
    } catch (error) {
      console.error(`❌ Erro ao carregar secret ${secretName}:`, error.message);
      throw error;
    }
  }

  /**
   * Determina qual secret usar baseado no ambiente
   * @returns {string} Nome do secret
   */
  getSecretName() {
    const env = process.env.NODE_ENV;

    switch (env) {
      case "production":
      case "prod":
        return "prd-mysql";
      case "sandbox":
      case "staging":
        return "sandbox-mysql";
      case "development":
      case "dev":
      default:
        return "dev-mysql";
    }
  }

  /**
   * Carrega configuração do banco de dados
   * Prioridade: AWS Secrets Manager → Environment Variables → Defaults
   * @returns {Promise<Object>} Configuração do banco
   */
  async getDatabaseConfig() {
    try {
      const secretName = this.getSecretName();
      console.log(
        `⏳ Tentando carregar credenciais do Secrets Manager: ${secretName}`
      );

      // Adicionar timeout de 3 segundos para não travar o Lambda
      const secrets = await Promise.race([
        this.getSecret(secretName),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Timeout loading secret")), 3000)
        ),
      ]);

      return {
        host:
          secrets.host ||
          process.env.DB_HOST ||
          "database-1.cd2em8e0a6ot.sa-east-1.rds.amazonaws.com",
        port: parseInt(secrets.port || process.env.DB_PORT) || 5432,
        database: secrets.database || process.env.DB_NAME || "app_polox_dev",
        user: secrets.username || process.env.DB_USER || "polox_dev_user",
        password: secrets.password || process.env.DB_PASSWORD,
        source: "AWS_SECRETS_MANAGER",
      };
    } catch (error) {
      console.warn(
        `⚠️  Fallback para variáveis de ambiente. Erro no Secrets Manager:`,
        error.message
      );

      return {
        host:
          process.env.DB_HOST ||
          "database-1.cd2em8e0a6ot.sa-east-1.rds.amazonaws.com",
        port: parseInt(process.env.DB_PORT) || 5432,
        database: process.env.DB_NAME || "app_polox_dev",
        user: process.env.DB_USER || "polox_dev_user",
        password: process.env.DB_PASSWORD,
        source: "ENVIRONMENT_VARIABLES",
      };
    }
  }
}

module.exports = new SecretsManager();
