const { AuthService } = require("../services");
const { logger } = require("../models");

/**
 * Controller para autenticação de usuários
 */
class AuthController {
  /**
   * Registra um novo usuário
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  static async register(req, res) {
    try {
      const { name, email, password } = req.body;

      const result = await AuthService.register({ name, email, password });

      res.status(201).json({
        success: true,
        message: "Usuário registrado com sucesso",
        data: result,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Erro no controller de registro:", {
        error: error.message,
        body: req.body,
      });

      res.status(400).json({
        success: false,
        error: "Erro no registro",
        message: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Realiza login do usuário
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  static async login(req, res) {
    try {
      const { email, password } = req.body;

      const result = await AuthService.login({ email, password });

      res.status(200).json({
        success: true,
        message: "Login realizado com sucesso",
        data: result,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Erro no controller de login:", {
        error: error.message,
        email: req.body?.email,
      });

      res.status(401).json({
        success: false,
        error: "Falha na autenticação",
        message: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Renova o token de acesso
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  static async refreshToken(req, res) {
    try {
      const { refresh_token } = req.body;

      const result = await AuthService.refreshToken(refresh_token);

      res.status(200).json({
        success: true,
        message: "Token renovado com sucesso",
        data: result,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Erro no controller de refresh token:", {
        error: error.message,
      });

      res.status(401).json({
        success: false,
        error: "Token inválido",
        message: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Realiza logout do usuário
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  static async logout(req, res) {
    try {
      // O token está disponível via middleware de autenticação
      const token = req.headers.authorization?.replace("Bearer ", "");

      await AuthService.logout(token);

      res.status(200).json({
        success: true,
        message: "Logout realizado com sucesso",
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Erro no controller de logout:", {
        error: error.message,
        userId: req.user?.id,
      });

      res.status(500).json({
        success: false,
        error: "Erro no logout",
        message: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Valida o token atual e retorna dados do usuário
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  static async validateToken(req, res) {
    try {
      // Se chegou até aqui, o token já foi validado pelo middleware
      const user = req.user;

      res.status(200).json({
        success: true,
        message: "Token válido",
        data: {
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
          },
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Erro na validação de token:", {
        error: error.message,
        userId: req.user?.id,
      });

      res.status(401).json({
        success: false,
        error: "Token inválido",
        message: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Solicita reset de senha
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  static async requestPasswordReset(req, res) {
    try {
      const { email } = req.body;

      await AuthService.requestPasswordReset(email);

      // Sempre retorna sucesso por segurança
      res.status(200).json({
        success: true,
        message:
          "Se o email estiver cadastrado, você receberá instruções para redefinir sua senha",
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Erro na solicitação de reset:", {
        error: error.message,
        email: req.body?.email,
      });

      // Não expor erros específicos por segurança
      res.status(200).json({
        success: true,
        message:
          "Se o email estiver cadastrado, você receberá instruções para redefinir sua senha",
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Confirma reset de senha
   * @param {Object} req - Request object
   * @param {Object} res - Response object
   */
  static async confirmPasswordReset(req, res) {
    try {
      const { token, new_password } = req.body;

      await AuthService.confirmPasswordReset(token, new_password);

      res.status(200).json({
        success: true,
        message: "Senha redefinida com sucesso",
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Erro na confirmação de reset:", {
        error: error.message,
      });

      res.status(400).json({
        success: false,
        error: "Erro ao redefinir senha",
        message: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  }
}

module.exports = AuthController;
