const { query, transaction } = require("./database");
const bcrypt = require("bcryptjs");

/**
 * Model para gerenciamento de usuários
 */
class UserModel {
  /**
   * Cria um novo usuário
   * @param {Object} userData - Dados do usuário
   * @param {string} userData.email - Email do usuário
   * @param {string} userData.password - Senha do usuário
   * @param {string} userData.name - Nome do usuário
   * @returns {Promise<Object>} Usuário criado (sem senha)
   */
  static async create({ email, password, name }) {
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    const insertQuery = `
      INSERT INTO users (email, password_hash, name)
      VALUES ($1, $2, $3)
      RETURNING id, email, name, status, created_at, updated_at
    `;

    try {
      const result = await query(insertQuery, [email, passwordHash, name]);
      return result.rows[0];
    } catch (error) {
      if (error.code === "23505") {
        // Unique violation
        throw new Error("Email já está em uso");
      }
      throw new Error(`Erro ao criar usuário: ${error.message}`);
    }
  }

  /**
   * Busca usuário por email
   * @param {string} email - Email do usuário
   * @returns {Promise<Object|null>} Usuário encontrado ou null
   */
  static async findByEmail(email) {
    const selectQuery = `
      SELECT id, email, password_hash, name, status, created_at, updated_at
      FROM users 
      WHERE email = $1 AND status = 'active'
    `;

    try {
      const result = await query(selectQuery, [email]);
      return result.rows[0] || null;
    } catch (error) {
      throw new Error(`Erro ao buscar usuário: ${error.message}`);
    }
  }

  /**
   * Busca usuário por ID
   * @param {number} id - ID do usuário
   * @returns {Promise<Object|null>} Usuário encontrado ou null (sem senha)
   */
  static async findById(id) {
    const selectQuery = `
      SELECT id, email, name, status, created_at, updated_at
      FROM users 
      WHERE id = $1 AND status = 'active'
    `;

    try {
      const result = await query(selectQuery, [id]);
      return result.rows[0] || null;
    } catch (error) {
      throw new Error(`Erro ao buscar usuário: ${error.message}`);
    }
  }

  /**
   * Verifica se a senha está correta
   * @param {string} password - Senha fornecida
   * @param {string} hash - Hash armazenado no banco
   * @returns {Promise<boolean>} True se a senha estiver correta
   */
  static async verifyPassword(password, hash) {
    try {
      return await bcrypt.compare(password, hash);
    } catch (error) {
      throw new Error(`Erro ao verificar senha: ${error.message}`);
    }
  }

  /**
   * Atualiza dados do usuário
   * @param {number} id - ID do usuário
   * @param {Object} updateData - Dados para atualizar
   * @returns {Promise<Object|null>} Usuário atualizado ou null
   */
  static async update(id, updateData) {
    const allowedFields = ["name", "email"];
    const updates = [];
    const values = [];
    let paramCount = 1;

    // Constrói query dinamicamente
    for (const [key, value] of Object.entries(updateData)) {
      if (allowedFields.includes(key)) {
        updates.push(`${key} = $${paramCount}`);
        values.push(value);
        paramCount++;
      }
    }

    if (updates.length === 0) {
      throw new Error("Nenhum campo válido para atualizar");
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const updateQuery = `
      UPDATE users 
      SET ${updates.join(", ")}
      WHERE id = $${paramCount} AND status = 'active'
      RETURNING id, email, name, status, created_at, updated_at
    `;

    try {
      const result = await query(updateQuery, values);
      return result.rows[0] || null;
    } catch (error) {
      if (error.code === "23505") {
        // Unique violation
        throw new Error("Email já está em uso");
      }
      throw new Error(`Erro ao atualizar usuário: ${error.message}`);
    }
  }

  /**
   * Desativa um usuário (soft delete)
   * @param {number} id - ID do usuário
   * @returns {Promise<boolean>} True se o usuário foi desativado
   */
  static async deactivate(id) {
    const updateQuery = `
      UPDATE users 
      SET status = 'inactive', updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND status = 'active'
      RETURNING id
    `;

    try {
      const result = await query(updateQuery, [id]);
      return result.rowCount > 0;
    } catch (error) {
      throw new Error(`Erro ao desativar usuário: ${error.message}`);
    }
  }

  /**
   * Lista usuários com paginação
   * @param {Object} options - Opções de busca
   * @param {number} options.page - Página (padrão: 1)
   * @param {number} options.limit - Limite por página (padrão: 10)
   * @param {string} options.status - Status do usuário (padrão: 'active')
   * @returns {Promise<Object>} Lista de usuários e metadados
   */
  static async list({ page = 1, limit = 10, status = "active" } = {}) {
    const offset = (page - 1) * limit;

    const countQuery = `SELECT COUNT(*) FROM users WHERE status = $1`;
    const selectQuery = `
      SELECT id, email, name, status, created_at, updated_at
      FROM users 
      WHERE status = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `;

    try {
      const [countResult, dataResult] = await Promise.all([
        query(countQuery, [status]),
        query(selectQuery, [status, limit, offset]),
      ]);

      const total = parseInt(countResult.rows[0].count);
      const totalPages = Math.ceil(total / limit);

      return {
        data: dataResult.rows,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      };
    } catch (error) {
      throw new Error(`Erro ao listar usuários: ${error.message}`);
    }
  }
}

module.exports = UserModel;
