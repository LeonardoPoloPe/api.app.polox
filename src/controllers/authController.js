/**
 * ==========================================
 * 🔐 CONTROLLER DE AUTENTICAÇÃO ENTERPRISE
 * ==========================================
 */

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

// Importar módulos internos
const { query, transaction } = require('../config/database');
const { logger, auditLogger, securityLogger } = require('../utils/logger');
const { ApiError, asyncHandler } = require('../utils/errors');
const { cache } = require('../config/cache');
const { trackAuth } = require('../config/monitoring');
const { 
  generateTokens, 
  verifyToken, 
  blacklistToken,
  hashPassword,
  comparePassword,
  generateSecureToken
} = require('../utils/auth');

/**
 * Controller de autenticação enterprise
 * Gerencia login, registro, tokens e sessões com segurança avançada
 */
class AuthController {
  
  /**
   * 🔑 LOGIN - Autenticação de usuário (versão simplificada)
   */
  static login = asyncHandler(async (req, res) => {
    const { email, password, rememberMe = false } = req.body;

    try {
      // 1. Buscar usuário por email (versão simplificada)
      const userResult = await query(`
        SELECT 
          id, email, password_hash, name, role, company_id, created_at
        FROM users 
        WHERE email = $1 AND deleted_at IS NULL
      `, [email.toLowerCase()]);

      if (userResult.rows.length === 0) {
        throw new ApiError(401, 'Credenciais inválidas');
      }

      const user = userResult.rows[0];

      // 2. Verificar senha
      const isValidPassword = await bcrypt.compare(password, user.password_hash);

      if (!isValidPassword) {
        throw new ApiError(401, 'Credenciais inválidas');
      }

      // 3. Gerar token JWT simples
      const token = jwt.sign(
        {
          id: user.id,
          email: user.email,
          role: user.role,
          companyId: user.company_id
        },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
      );

      // 4. Resposta de sucesso
      res.json({
        success: true,
        message: 'Login realizado com sucesso',
        data: {
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            companyId: user.company_id
          },
          token,
          expiresIn: process.env.JWT_EXPIRES_IN || '24h'
        }
      });

    } catch (error) {
      throw error;
    }
  });

  /**
   * 📝 REGISTER - Registro de novo usuário
   */
  static register = asyncHandler(async (req, res) => {
    const { 
      name, email, password, companyId = 1, role = 'viewer',
      department, position, phone, permissions = []
    } = req.body;

    try {
      // Versão simplificada para testes
      
      // 1. Verificar se email já existe (simplificado)
      const existingUser = await query(`
        SELECT id FROM users 
        WHERE email = $1 AND deleted_at IS NULL
      `, [email.toLowerCase()]);

      if (existingUser.rows.length > 0) {
        throw new ApiError(409, 'Email já cadastrado');
      }

      // 2. Criptografar senha
      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      // 3. Criar usuário (versão simplificada)
      const userResult = await query(`
        INSERT INTO users (
          name, email, password_hash, company_id, role
        ) VALUES (
          $1, $2, $3, $4, $5
        ) RETURNING id, name, email, company_id, role, created_at
      `, [
        name.trim(),
        email.toLowerCase(),
        hashedPassword,
        companyId,
        role
      ]);

      const newUser = userResult.rows[0];

      // 8. Resposta de sucesso (sem dados sensíveis)
      res.status(201).json({
        success: true,
        message: 'Usuário registrado com sucesso',
        data: {
          user: {
            id: newUser.id,
            name: newUser.name,
            email: newUser.email,
            role: newUser.role,
            companyId: newUser.company_id,
            createdAt: newUser.created_at
          }
        }
      });

    } catch (error) {
      throw error;
    }
  });

  /**
   * 🔄 REFRESH TOKEN - Renovação de token de acesso
   */
  static refreshToken = asyncHandler(async (req, res) => {
    const { refreshToken } = req.body;

    try {
      if (!refreshToken) {
        throw new ApiError(400, 'Refresh token é obrigatório');
      }

      // 1. Verificar se token está válido
      const decoded = verifyToken(refreshToken, process.env.JWT_REFRESH_SECRET);

      // 2. Buscar sessão no banco
      const sessionResult = await query(`
        SELECT 
          s.id, s.user_id, s.ip_address, s.user_agent, s.expires_at,
          u.id as uid, u.email, u.name, u.role, u.company_id, u.is_active,
          u.permissions, u.department, u.position,
          c.name as company_name, c.plan as company_plan, c.is_active as company_active,
          c.modules as company_modules
        FROM user_sessions s
        INNER JOIN users u ON s.user_id = u.id
        INNER JOIN companies c ON u.company_id = c.id
        WHERE s.id = $1 AND s.refresh_token = $2 AND s.expires_at > NOW()
      `, [decoded.sessionId, refreshToken]);

      if (sessionResult.rows.length === 0) {
        securityLogger('Tentativa de uso de refresh token inválido', {
          sessionId: decoded.sessionId,
          ip: req.ip,
          userAgent: req.get('User-Agent')
        });

        throw new ApiError(401, 'Refresh token inválido ou expirado');
      }

      const session = sessionResult.rows[0];

      // 3. Verificar se usuário e empresa estão ativos
      if (!session.is_active || !session.company_active) {
        await query('DELETE FROM user_sessions WHERE id = $1', [session.id]);
        throw new ApiError(401, 'Usuário ou empresa inativo');
      }

      // 4. Gerar novo access token
      const newAccessToken = generateTokens({
        id: session.user_id,
        email: session.email,
        role: session.role,
        companyId: session.company_id,
        permissions: session.permissions || [],
        sessionId: session.id
      }, false, true); // Só access token

      // 5. Atualizar atividade da sessão
      await query(`
        UPDATE user_sessions 
        SET last_activity = NOW() 
        WHERE id = $1
      `, [session.id]);

      // 6. Log de auditoria
      auditLogger('Token renovado', {
        userId: session.user_id,
        sessionId: session.id,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });

      res.json({
        success: true,
        message: 'Token renovado com sucesso',
        data: {
          accessToken: newAccessToken,
          expiresIn: process.env.JWT_EXPIRES_IN || '15m',
          tokenType: 'Bearer'
        }
      });

    } catch (error) {
      if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
        throw new ApiError(401, 'Refresh token inválido ou expirado');
      }
      throw error;
    }
  });

  /**
   * 🚪 LOGOUT - Encerrar sessão
   */
  static logout = asyncHandler(async (req, res) => {
    const { sessionId } = req.user;
    const { logoutAll = false } = req.body;

    try {
      if (logoutAll) {
        // Logout de todas as sessões do usuário
        await query(`
          DELETE FROM user_sessions 
          WHERE user_id = $1
        `, [req.user.id]);

        auditLogger('Logout realizado em todas as sessões', {
          userId: req.user.id,
          ip: req.ip,
          userAgent: req.get('User-Agent')
        });
      } else {
        // Logout apenas da sessão atual
        await query(`
          DELETE FROM user_sessions 
          WHERE id = $1 AND user_id = $2
        `, [sessionId, req.user.id]);

        auditLogger('Logout realizado', {
          userId: req.user.id,
          sessionId,
          ip: req.ip,
          userAgent: req.get('User-Agent')
        });
      }

      // Remover dados do cache
      await cache.del(`user:${req.user.id}`, req.user.companyId);

      res.json({
        success: true,
        message: logoutAll ? 'Logout realizado em todas as sessões' : 'Logout realizado com sucesso'
      });

    } catch (error) {
      logger.error('Erro no logout', {
        userId: req.user.id,
        sessionId,
        error: error.message
      });
      throw error;
    }
  });

  /**
   * 🔐 RECOVER PASSWORD - Solicitar recuperação de senha
   */
  static recoverPassword = asyncHandler(async (req, res) => {
    const { email } = req.body;

    try {
      // 1. Buscar usuário por email
      const userResult = await query(`
        SELECT id, email, name FROM users 
        WHERE email = $1 AND is_active = true AND deleted_at IS NULL
      `, [email.toLowerCase()]);

      // Sempre retorna sucesso por segurança (não vazar se email existe)
      if (userResult.rows.length === 0) {
        logger.info('Tentativa de recuperação com email inexistente', { email });
        
        return res.json({
          success: true,
          message: 'Se o email estiver cadastrado, você receberá instruções para redefinir sua senha'
        });
      }

      const user = userResult.rows[0];

      // 2. Gerar token de recuperação
      const resetToken = generateSecureToken();
      const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

      // 3. Salvar token no banco
      await query(`
        INSERT INTO password_resets (
          user_id, token, expires_at, created_at
        ) VALUES ($1, $2, $3, NOW())
        ON CONFLICT (user_id) 
        DO UPDATE SET 
          token = $2, 
          expires_at = $3, 
          created_at = NOW()
      `, [user.id, resetToken, resetExpires]);

      // 4. Log de auditoria
      auditLogger('Solicitação de recuperação de senha', {
        userId: user.id,
        email: user.email,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });

      // TODO: Enviar email com link de recuperação
      // await emailService.sendPasswordResetEmail(user.email, user.name, resetToken);

      res.json({
        success: true,
        message: 'Se o email estiver cadastrado, você receberá instruções para redefinir sua senha'
      });

    } catch (error) {
      logger.error('Erro na recuperação de senha', {
        email,
        error: error.message
      });
      
      // Por segurança, sempre retorna sucesso
      res.json({
        success: true,
        message: 'Se o email estiver cadastrado, você receberá instruções para redefinir sua senha'
      });
    }
  });

  /**
   * 🔑 RESET PASSWORD - Confirmar nova senha
   */
  static resetPassword = asyncHandler(async (req, res) => {
    const { token, newPassword } = req.body;

    try {
      // 1. Verificar token de recuperação
      const resetResult = await query(`
        SELECT pr.user_id, pr.expires_at, u.email, u.name
        FROM password_resets pr
        INNER JOIN users u ON pr.user_id = u.id
        WHERE pr.token = $1 AND pr.expires_at > NOW()
      `, [token]);

      if (resetResult.rows.length === 0) {
        throw new ApiError(400, 'Token de recuperação inválido ou expirado');
      }

      const reset = resetResult.rows[0];

      // 2. Criptografar nova senha
      const hashedPassword = await hashPassword(newPassword);

      // 3. Atualizar senha do usuário
      await query(`
        UPDATE users 
        SET password = $1, updated_at = NOW()
        WHERE id = $2
      `, [hashedPassword, reset.user_id]);

      // 4. Remover token de recuperação usado
      await query(`
        DELETE FROM password_resets WHERE user_id = $1
      `, [reset.user_id]);

      // 5. Invalidar todas as sessões do usuário
      await query(`
        DELETE FROM user_sessions WHERE user_id = $1
      `, [reset.user_id]);

      // 6. Log de auditoria
      auditLogger('Senha redefinida via recuperação', {
        userId: reset.user_id,
        email: reset.email,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });

      res.json({
        success: true,
        message: 'Senha redefinida com sucesso. Faça login com sua nova senha.'
      });

    } catch (error) {
      throw error;
    }
  });

  /**
   * 👤 GET USER PROFILE - Obter perfil do usuário autenticado
   */
  static getProfile = asyncHandler(async (req, res) => {
    try {
      // Buscar dados completos do usuário
      const userResult = await query(`
        SELECT 
          u.id, u.name, u.email, u.role, u.department, u.position, u.phone,
          u.permissions, u.created_at, u.last_login,
          c.id as company_id, c.name as company_name, c.plan as company_plan,
          c.modules as company_modules
        FROM users u
        INNER JOIN companies c ON u.company_id = c.id
        WHERE u.id = $1 AND u.deleted_at IS NULL
      `, [req.user.id]);

      if (userResult.rows.length === 0) {
        throw new ApiError(404, 'Usuário não encontrado');
      }

      const user = userResult.rows[0];

      res.json({
        success: true,
        data: {
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            department: user.department,
            position: user.position,
            phone: user.phone,
            permissions: user.permissions || [],
            createdAt: user.created_at,
            lastLogin: user.last_login,
            company: {
              id: user.company_id,
              name: user.company_name,
              plan: user.company_plan,
              modules: user.company_modules || []
            }
          }
        }
      });

    } catch (error) {
      throw error;
    }
  });

  /**
   * 📋 GET USER SESSIONS - Listar sessões ativas do usuário
   */
  static getSessions = asyncHandler(async (req, res) => {
    try {
      const sessionsResult = await query(`
        SELECT 
          id, ip_address, user_agent, created_at, last_activity, expires_at
        FROM user_sessions
        WHERE user_id = $1
        ORDER BY last_activity DESC
      `, [req.user.id]);

      const sessions = sessionsResult.rows.map(session => ({
        id: session.id,
        ipAddress: session.ip_address,
        userAgent: session.user_agent,
        createdAt: session.created_at,
        lastActivity: session.last_activity,
        expiresAt: session.expires_at,
        isCurrent: session.id === req.user.sessionId
      }));

      res.json({
        success: true,
        data: { sessions }
      });

    } catch (error) {
      throw error;
    }
  });

  /**
   * 🗑️ REVOKE SESSION - Revogar sessão específica
   */
  static revokeSession = asyncHandler(async (req, res) => {
    const { sessionId } = req.params;

    try {
      const result = await query(`
        DELETE FROM user_sessions 
        WHERE id = $1 AND user_id = $2
        RETURNING id
      `, [sessionId, req.user.id]);

      if (result.rows.length === 0) {
        throw new ApiError(404, 'Sessão não encontrada');
      }

      auditLogger('Sessão revogada pelo usuário', {
        userId: req.user.id,
        revokedSessionId: sessionId,
        currentSessionId: req.user.sessionId,
        ip: req.ip
      });

      res.json({
        success: true,
        message: 'Sessão revogada com sucesso'
      });

    } catch (error) {
      throw error;
    }
  });

  /**
   * 🔍 VALIDATE TOKEN - Validar token atual
   */
  static validateToken = asyncHandler(async (req, res) => {
    // Se chegou até aqui, o token já foi validado pelo middleware
    res.json({
      success: true,
      message: 'Token válido',
      data: {
        user: {
          id: req.user.id,
          email: req.user.email,
          name: req.user.name,
          role: req.user.role,
          companyId: req.user.companyId,
          permissions: req.user.permissions
        }
      }
    });
  });

  /**
   * 🏢 HELPER - Obter roles permitidas por plano
   */
  static getRolesForPlan(plan) {
    const rolesByPlan = {
      'basic': ['viewer'],
      'professional': ['viewer', 'editor'],
      'enterprise': ['viewer', 'editor', 'admin'],
      'premium': ['viewer', 'editor', 'admin', 'super_admin']
    };

    return rolesByPlan[plan] || ['viewer'];
  }
}

module.exports = AuthController;
