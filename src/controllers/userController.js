/**
 * ==========================================
 * 👥 CONTROLLER DE USUÁRIOS SIMPLIFICADO
 * ==========================================
 */

// Importar módulos internos
const { query } = require('../config/database');
const { logger } = require('../utils/logger');
const { ApiError, asyncHandler } = require('../utils/errors');

/**
 * Controller de usuários simplificado
 */
class UserController {

  /**
   * 📋 GET ALL USERS - Listar usuários (versão simplificada)
   */
  static getUsers = asyncHandler(async (req, res) => {
    const { 
      page = 1, 
      limit = 20, 
      search = ''
    } = req.query;

    try {
      // Versão simplificada - buscar todos os usuários
      let whereClause = 'WHERE deleted_at IS NULL';
      let queryParams = [];
      
      // Filtro de busca por nome ou email
      if (search) {
        whereClause += ' AND (full_name ILIKE $1 OR email ILIKE $1)';
        queryParams.push(`%${search}%`);
      }

      // Query para contar total de usuários
      const countResult = await query(`
        SELECT COUNT(*) as total 
        FROM users 
        ${whereClause}
      `, queryParams);

      const totalUsers = parseInt(countResult.rows[0].total);

      // Query para buscar usuários com paginação
      const offset = (page - 1) * limit;
      const usersResult = await query(`
        SELECT 
          id, full_name, email, user_role, company_id, created_at
        FROM users 
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}
      `, [...queryParams, limit, offset]);

      // Formatar resposta
      const users = usersResult.rows.map(user => ({
        id: user.id,
        name: user.full_name,
        email: user.email,
        role: user.user_role,
        companyId: user.company_id,
        createdAt: user.created_at
      }));

      res.json({
        success: true,
        data: {
          users,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: totalUsers,
            pages: Math.ceil(totalUsers / limit)
          }
        }
      });

    } catch (error) {
      throw error;
    }
  });

  /**
   * 👤 GET USER BY ID - Obter usuário específico
   */
  static getUserById = asyncHandler(async (req, res) => {
    const { id } = req.params;

    try {
      const userResult = await query(`
        SELECT 
          id, full_name, email, user_role, company_id, created_at
        FROM users 
        WHERE id = $1 AND deleted_at IS NULL
      `, [id]);

      if (userResult.rows.length === 0) {
        throw new ApiError(404, 'Usuário não encontrado');
      }

      const user = userResult.rows[0];

      res.json({
        success: true,
        data: {
          user: {
            id: user.id,
            name: user.full_name,
            email: user.email,
            role: user.user_role,
            companyId: user.company_id,
            createdAt: user.created_at
          }
        }
      });

    } catch (error) {
      throw error;
    }
  });

  /**
   * 📊 GET USER PROFILE - Obter perfil do usuário autenticado
   */
  static getProfile = asyncHandler(async (req, res) => {
    try {
      const userResult = await query(`
        SELECT 
          id, full_name, email, user_role, company_id, created_at
        FROM users 
        WHERE id = $1 AND deleted_at IS NULL
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
            name: user.full_name,
            email: user.email,
            role: user.user_role,
            companyId: user.company_id,
            createdAt: user.created_at
          }
        }
      });

    } catch (error) {
      throw error;
    }
  });

  /**
   * ✏️ UPDATE USER PROFILE - Atualizar perfil do usuário
   */
  static updateProfile = asyncHandler(async (req, res) => {
    const { name, email } = req.body;

    try {
      // Validações básicas
      if (!name || !email) {
        throw new ApiError(400, 'Nome e email são obrigatórios');
      }

      // Verificar se email já existe para outro usuário
      if (email !== req.user.email) {
        const existingUser = await query(`
          SELECT id FROM users 
          WHERE email = $1 AND id != $2 AND deleted_at IS NULL
        `, [email.toLowerCase(), req.user.id]);

        if (existingUser.rows.length > 0) {
          throw new ApiError(409, 'Email já está em uso');
        }
      }

      // Atualizar usuário
      const userResult = await query(`
        UPDATE users 
        SET full_name = $1, email = $2, updated_at = NOW()
        WHERE id = $3 AND deleted_at IS NULL
        RETURNING id, full_name, email, user_role, company_id, created_at, updated_at
      `, [name.trim(), email.toLowerCase(), req.user.id]);

      if (userResult.rows.length === 0) {
        throw new ApiError(404, 'Usuário não encontrado');
      }

      const user = userResult.rows[0];

      res.json({
        success: true,
        message: 'Perfil atualizado com sucesso',
        data: {
          user: {
            id: user.id,
            name: user.full_name,
            email: user.email,
            role: user.user_role,
            companyId: user.company_id,
            createdAt: user.created_at,
            updatedAt: user.updated_at
          }
        }
      });

    } catch (error) {
      throw error;
    }
  });

}

module.exports = UserController;