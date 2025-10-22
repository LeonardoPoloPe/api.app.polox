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
    this.client = new SecretsManagerClient({ region: "sa-east-1" });
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

      const secrets = await this.getSecret(secretName);

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
