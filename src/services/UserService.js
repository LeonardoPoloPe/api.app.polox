const { UserModel } = require("../models");
const { logger } = require("../models");
const { formatUser } = require("../utils/validation");

/**
 * Service para gerenciamento de usuários
 */
class UserService {
  /**
   * Busca o perfil de um usuário por ID
   * @param {number} userId - ID do usuário
   * @returns {Promise<Object>} Dados do usuário
   */
  static async getProfile(userId) {
    try {
      logger.info("Buscando perfil do usuário:", { userId });

      const user = await UserModel.findById(userId);
      if (!user) {
        throw new Error("Usuário não encontrado");
      }

      return formatUser(user);
    } catch (error) {
      logger.error("Erro ao buscar perfil:", {
        userId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Atualiza dados do perfil de um usuário
   * @param {number} userId - ID do usuário
   * @param {Object} updateData - Dados para atualizar
   * @returns {Promise<Object>} Usuário atualizado
   */
  static async updateProfile(userId, updateData) {
    try {
      logger.info("Atualizando perfil do usuário:", {
        userId,
        fields: Object.keys(updateData),
      });

      // Verifica se o usuário existe
      const existingUser = await UserModel.findById(userId);
      if (!existingUser) {
        throw new Error("Usuário não encontrado");
      }

      // Se está alterando email, verifica se já não está em uso
      if (updateData.email && updateData.email !== existingUser.email) {
        const emailInUse = await UserModel.findByEmail(updateData.email);
        if (emailInUse) {
          throw new Error("Este email já está sendo usado por outro usuário");
        }
      }

      // Atualiza os dados
      const updatedUser = await UserModel.update(userId, updateData);
      if (!updatedUser) {
        throw new Error("Erro ao atualizar usuário");
      }

      logger.info("Perfil atualizado com sucesso:", {
        userId: updatedUser.id,
        email: updatedUser.email,
      });

      return formatUser(updatedUser);
    } catch (error) {
      logger.error("Erro ao atualizar perfil:", {
        userId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Desativa a conta de um usuário
   * @param {number} userId - ID do usuário
   * @returns {Promise<boolean>} Sucesso da operação
   */
  static async deleteProfile(userId) {
    try {
      logger.info("Desativando conta do usuário:", { userId });

      const success = await UserModel.deactivate(userId);
      if (!success) {
        throw new Error("Usuário não encontrado ou já desativado");
      }

      logger.info("Conta desativada com sucesso:", { userId });
      return true;
    } catch (error) {
      logger.error("Erro ao desativar conta:", {
        userId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Lista usuários com paginação
   * @param {Object} options - Opções de listagem
   * @param {number} options.page - Página
   * @param {number} options.limit - Limite por página
   * @param {string} options.status - Status dos usuários
   * @returns {Promise<Object>} Lista paginada de usuários
   */
  static async listUsers({ page = 1, limit = 10, status = "active" } = {}) {
    try {
      logger.info("Listando usuários:", { page, limit, status });

      const result = await UserModel.list({ page, limit, status });

      // Remove informações sensíveis de todos os usuários
      const sanitizedUsers = result.data.map((user) => formatUser(user));

      return {
        data: sanitizedUsers,
        pagination: result.pagination,
      };
    } catch (error) {
      logger.error("Erro ao listar usuários:", {
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Busca um usuário específico por ID
   * @param {number} userId - ID do usuário
   * @returns {Promise<Object>} Dados do usuário
   */
  static async getUserById(userId) {
    try {
      logger.info("Buscando usuário por ID:", { userId });

      const user = await UserModel.findById(userId);
      if (!user) {
        throw new Error("Usuário não encontrado");
      }

      return formatUser(user);
    } catch (error) {
      logger.error("Erro ao buscar usuário:", {
        userId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Busca usuários por email (para administradores)
   * @param {string} email - Email para buscar
   * @returns {Promise<Object|null>} Usuário encontrado ou null
   */
  static async getUserByEmail(email) {
    try {
      logger.info("Buscando usuário por email:", { email });

      const user = await UserModel.findByEmail(email);
      return user ? formatUser(user) : null;
    } catch (error) {
      logger.error("Erro ao buscar usuário por email:", {
        email,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Verifica se um usuário existe
   * @param {number} userId - ID do usuário
   * @returns {Promise<boolean>} True se o usuário existir
   */
  static async userExists(userId) {
    try {
      const user = await UserModel.findById(userId);
      return !!user;
    } catch (error) {
      logger.error("Erro ao verificar existência do usuário:", {
        userId,
        error: error.message,
      });
      return false;
    }
  }

  /**
   * Atualiza o último acesso do usuário (para implementação futura)
   * @param {number} userId - ID do usuário
   * @returns {Promise<boolean>} Sucesso da operação
   */
  static async updateLastAccess(userId) {
    try {
      // TODO: Implementar campo last_access na tabela users
      // TODO: Atualizar timestamp do último acesso

      logger.info("Último acesso atualizado:", { userId });
      return true;
    } catch (error) {
      logger.error("Erro ao atualizar último acesso:", {
        userId,
        error: error.message,
      });
      return false;
    }
  }

  /**
   * Gera estatísticas de usuários (para admin)
   * @returns {Promise<Object>} Estatísticas dos usuários
   */
  static async getUserStats() {
    try {
      logger.info("Gerando estatísticas de usuários");

      // TODO: Implementar queries para estatísticas
      // - Total de usuários ativos
      // - Total de usuários inativos
      // - Usuários criados hoje/semana/mês
      // - etc.

      return {
        total_active: 0,
        total_inactive: 0,
        created_today: 0,
        created_this_week: 0,
        created_this_month: 0,
      };
    } catch (error) {
      logger.error("Erro ao gerar estatísticas:", {
        error: error.message,
      });
      throw error;
    }
  }
}

module.exports = UserService;
