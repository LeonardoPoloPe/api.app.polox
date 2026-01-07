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
 * 🔐 Database Configuration Manager
 * Carrega credenciais de banco de dados das variáveis de ambiente (.env)
 */

class SecretsManager {
  constructor() {
    // Não é mais necessário cliente AWS
  }

  /**
   * Carrega configuração do banco de dados
   * Lê diretamente das variáveis de ambiente (.env)
   * @returns {Promise<Object>} Configuração do banco
   */
  async getDatabaseConfig() {
    // Validar variáveis obrigatórias
    const requiredVars = ["DB_HOST", "DB_USER", "DB_PASSWORD", "DB_NAME"];
    const missing = requiredVars.filter((v) => !process.env[v]);

    if (missing.length > 0) {
      throw new Error(
        `❌ Variáveis de ambiente obrigatórias não configuradas: ${missing.join(
          ", "
        )}\n` + `Configure estas variáveis no arquivo .env`
      );
    }

    console.log(`✅ Configuração carregada do arquivo .env`);
    console.log(`📍 Database: ${process.env.DB_NAME}`);
    console.log(`🌐 Host: ${process.env.DB_HOST}`);

    return {
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT) || 5434,
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      source: "ENVIRONMENT_VARIABLES",
    };
  }
}

module.exports = new SecretsManager();
