const { UserService } = require("../services");
const { logger } = require("../models");
const { formatPaginatedResponse } = require("../utils/validation");

/**
 * Controller para gerenciamento de usuários
 */
class UserController {
  /**
   * Retorna o perfil do usuário autenticado
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  static async getProfile(req, res) {
    try {
      const userId = req.user.id;

      const user = await UserService.getProfile(userId);

      res.status(200).json({
        success: true,
        message: "Perfil recuperado com sucesso",
        data: { user },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Erro no controller getProfile:", {
        error: error.message,
        userId: req.user?.id,
      });

      res.status(404).json({
        success: false,
        error: "Erro ao buscar perfil",
        message: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Atualiza o perfil do usuário autenticado
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  static async updateProfile(req, res) {
    try {
      const userId = req.user.id;
      const updateData = req.body;

      const updatedUser = await UserService.updateProfile(userId, updateData);

      res.status(200).json({
        success: true,
        message: "Perfil atualizado com sucesso",
        data: { user: updatedUser },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Erro no controller updateProfile:", {
        error: error.message,
        userId: req.user?.id,
        updateData: req.body,
      });

      const statusCode = error.message.includes("não encontrado") ? 404 : 400;

      res.status(statusCode).json({
        success: false,
        error: "Erro ao atualizar perfil",
        message: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Desativa a conta do usuário autenticado
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  static async deleteProfile(req, res) {
    try {
      const userId = req.user.id;

      await UserService.deleteProfile(userId);

      res.status(200).json({
        success: true,
        message: "Conta desativada com sucesso",
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Erro no controller deleteProfile:", {
        error: error.message,
        userId: req.user?.id,
      });

      const statusCode = error.message.includes("não encontrado") ? 404 : 500;

      res.status(statusCode).json({
        success: false,
        error: "Erro ao desativar conta",
        message: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Lista usuários com paginação (rota administrativa)
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  static async listUsers(req, res) {
    try {
      const { page = 1, limit = 10, status = "active" } = req.query;

      const result = await UserService.listUsers({
        page: parseInt(page),
        limit: parseInt(limit),
        status,
      });

      const response = formatPaginatedResponse(result.data, result.pagination);

      res.status(200).json({
        success: true,
        message: "Usuários listados com sucesso",
        ...response,
      });
    } catch (error) {
      logger.error("Erro no controller listUsers:", {
        error: error.message,
        query: req.query,
      });

      res.status(500).json({
        success: false,
        error: "Erro ao listar usuários",
        message: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Busca um usuário específico por ID
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  static async getUserById(req, res) {
    try {
      const { id } = req.params;
      const userId = parseInt(id);

      if (isNaN(userId)) {
        return res.status(400).json({
          success: false,
          error: "ID inválido",
          message: "O ID deve ser um número válido",
          timestamp: new Date().toISOString(),
        });
      }

      const user = await UserService.getUserById(userId);

      res.status(200).json({
        success: true,
        message: "Usuário encontrado com sucesso",
        data: { user },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Erro no controller getUserById:", {
        error: error.message,
        params: req.params,
      });

      const statusCode = error.message.includes("não encontrado") ? 404 : 500;

      res.status(statusCode).json({
        success: false,
        error: "Erro ao buscar usuário",
        message: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Busca usuário por email (rota administrativa)
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  static async getUserByEmail(req, res) {
    try {
      const { email } = req.query;

      if (!email) {
        return res.status(400).json({
          success: false,
          error: "Email obrigatório",
          message: "Parâmetro email é obrigatório",
          timestamp: new Date().toISOString(),
        });
      }

      const user = await UserService.getUserByEmail(email);

      if (!user) {
        return res.status(404).json({
          success: false,
          error: "Usuário não encontrado",
          message: "Nenhum usuário encontrado com este email",
          timestamp: new Date().toISOString(),
        });
      }

      res.status(200).json({
        success: true,
        message: "Usuário encontrado com sucesso",
        data: { user },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Erro no controller getUserByEmail:", {
        error: error.message,
        query: req.query,
      });

      res.status(500).json({
        success: false,
        error: "Erro ao buscar usuário",
        message: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Retorna estatísticas de usuários (rota administrativa)
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  static async getUserStats(req, res) {
    try {
      const stats = await UserService.getUserStats();

      res.status(200).json({
        success: true,
        message: "Estatísticas recuperadas com sucesso",
        data: { stats },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Erro no controller getUserStats:", {
        error: error.message,
      });

      res.status(500).json({
        success: false,
        error: "Erro ao buscar estatísticas",
        message: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Middleware para verificar se o usuário pode acessar dados de outro usuário
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   * @param {Function} next - Next middleware function
   */
  static async checkUserAccess(req, res, next) {
    try {
      const requestedUserId = parseInt(req.params.id);
      const currentUserId = req.user.id;

      // Se é o próprio usuário ou um admin, permite acesso
      if (requestedUserId === currentUserId || req.user.role === "admin") {
        return next();
      }

      // Senão, nega acesso
      res.status(403).json({
        success: false,
        error: "Acesso negado",
        message: "Você só pode acessar seus próprios dados",
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Erro no middleware checkUserAccess:", {
        error: error.message,
        params: req.params,
        user: req.user,
      });

      res.status(500).json({
        success: false,
        error: "Erro interno",
        timestamp: new Date().toISOString(),
      });
    }
  }
}

module.exports = UserController;
