const { UserModel } = require("../models");
const { generateTokens, verifyToken } = require("../utils/auth");
const { logger } = require("../models");

/**
 * Service para gerenciamento de autenticação
 */
class AuthService {
  /**
   * Registra um novo usuário
   * @param {Object} userData - Dados do usuário
   * @param {string} userData.name - Nome do usuário
   * @param {string} userData.email - Email do usuário
   * @param {string} userData.password - Senha do usuário
   * @returns {Promise<Object>} Usuário criado e tokens
   */
  static async register({ name, email, password }) {
    try {
      logger.info("Tentativa de registro:", { email, name });

      // Verifica se o email já existe
      const existingUser = await UserModel.findByEmail(email);
      if (existingUser) {
        throw new Error("Email já está sendo usado por outro usuário");
      }

      // Cria o usuário
      const user = await UserModel.create({ name, email, password });

      // Gera tokens de autenticação
      const tokens = generateTokens(user);

      logger.info("Usuário registrado com sucesso:", {
        userId: user.id,
        email: user.email,
      });

      return {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          status: user.status,
          created_at: user.created_at,
        },
        ...tokens,
      };
    } catch (error) {
      logger.error("Erro no registro:", {
        email,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Autentica um usuário
   * @param {Object} credentials - Credenciais do usuário
   * @param {string} credentials.email - Email do usuário
   * @param {string} credentials.password - Senha do usuário
   * @returns {Promise<Object>} Usuário autenticado e tokens
   */
  static async login({ email, password }) {
    try {
      logger.info("Tentativa de login:", { email });

      // Busca o usuário pelo email
      const user = await UserModel.findByEmail(email);
      if (!user) {
        throw new Error("Email ou senha incorretos");
      }

      // Verifica a senha
      const isPasswordValid = await UserModel.verifyPassword(
        password,
        user.password_hash
      );
      if (!isPasswordValid) {
        logger.warn("Tentativa de login com senha incorreta:", {
          email,
          userId: user.id,
        });
        throw new Error("Email ou senha incorretos");
      }

      // Gera tokens de autenticação
      const tokens = generateTokens(user);

      logger.info("Login realizado com sucesso:", {
        userId: user.id,
        email: user.email,
      });

      return {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          status: user.status,
          created_at: user.created_at,
        },
        ...tokens,
      };
    } catch (error) {
      logger.error("Erro no login:", {
        email,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Renova um token de acesso usando refresh token
   * @param {string} refreshToken - Refresh token
   * @returns {Promise<Object>} Novos tokens
   */
  static async refreshToken(refreshToken) {
    try {
      logger.info("Tentativa de renovação de token");

      // Verifica se o refresh token é válido
      const decoded = verifyToken(refreshToken);

      // Busca o usuário
      const user = await UserModel.findById(decoded.id);
      if (!user) {
        throw new Error("Usuário não encontrado");
      }

      // Gera novos tokens
      const tokens = generateTokens(user);

      logger.info("Token renovado com sucesso:", {
        userId: user.id,
      });

      return {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          status: user.status,
        },
        ...tokens,
      };
    } catch (error) {
      logger.error("Erro na renovação de token:", {
        error: error.message,
      });
      throw new Error("Refresh token inválido ou expirado");
    }
  }

  /**
   * Realiza logout (para implementação futura com blacklist de tokens)
   * @param {string} token - Token para invalidar
   * @returns {Promise<boolean>} Sucesso do logout
   */
  static async logout(token) {
    try {
      // TODO: Implementar blacklist de tokens no Redis ou banco
      // Por enquanto, o logout é apenas client-side

      logger.info("Logout realizado");
      return true;
    } catch (error) {
      logger.error("Erro no logout:", {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Valida se um token está ativo e retorna dados do usuário
   * @param {string} token - Token para validar
   * @returns {Promise<Object>} Dados do usuário
   */
  static async validateToken(token) {
    try {
      const decoded = verifyToken(token);

      // Busca dados atualizados do usuário
      const user = await UserModel.findById(decoded.id);
      if (!user) {
        throw new Error("Usuário não encontrado");
      }

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        status: user.status,
      };
    } catch (error) {
      logger.warn("Token inválido:", {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Solicita reset de senha (para implementação futura)
   * @param {string} email - Email do usuário
   * @returns {Promise<boolean>} Sucesso da solicitação
   */
  static async requestPasswordReset(email) {
    try {
      const user = await UserModel.findByEmail(email);
      if (!user) {
        // Não revela se o email existe por segurança
        logger.warn("Tentativa de reset para email inexistente:", { email });
        return true;
      }

      // TODO: Implementar envio de email com token de reset
      // TODO: Salvar token de reset no banco com expiração

      logger.info("Reset de senha solicitado:", {
        userId: user.id,
        email,
      });

      return true;
    } catch (error) {
      logger.error("Erro na solicitação de reset:", {
        email,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Confirma reset de senha (para implementação futura)
   * @param {string} token - Token de reset
   * @param {string} newPassword - Nova senha
   * @returns {Promise<boolean>} Sucesso do reset
   */
  static async confirmPasswordReset(token, newPassword) {
    try {
      // TODO: Implementar validação do token de reset
      // TODO: Atualizar senha do usuário
      // TODO: Invalidar token de reset

      logger.info("Senha resetada com sucesso");
      return true;
    } catch (error) {
      logger.error("Erro no reset de senha:", {
        error: error.message,
      });
      throw error;
    }
  }
}

module.exports = AuthService;
