const { query, transaction } = require('../config/database');
const { ApiError, ValidationError, NotFoundError } = require('../utils/errors');

/**
 * Model para categorias de tags
 * Baseado no schema polox.tag_categories
 */
class TagCategoryModel {
  /**
   * Cria uma nova categoria de tag
   * @param {Object} categoryData - Dados da categoria
   * @returns {Promise<Object>} Categoria criada
   */
  static async create(categoryData) {
    const {
      company_id,
      name,
      description = null,
      slug = null,
      color = null,
      icon = null,
      sort_order = 0,
      is_active = true
    } = categoryData;

    // Validar dados obrigatórios
    if (!company_id || !name) {
      throw new ValidationError('Company ID e nome são obrigatórios');
    }

    // Gerar slug se não fornecido
    const finalSlug = slug || name.toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .trim();

    const insertQuery = `
      INSERT INTO polox.tag_categories (
        company_id, name, description, slug, color, icon,
        sort_order, is_active, created_at, updated_at
      )
      VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, NOW(), NOW()
      )
      RETURNING 
        id, company_id, name, description, slug, color, icon,
        sort_order, is_active, created_at, updated_at
    `;

    try {
      const result = await query(insertQuery, [
        company_id, name, description, finalSlug, color, icon,
        sort_order, is_active
      ]);

      return result.rows[0];
    } catch (error) {
      if (error.code === '23503' && error.constraint?.includes('company')) {
        throw new ValidationError('Empresa informada não existe');
      }
      if (error.code === '23505' && error.constraint?.includes('slug')) {
        throw new ValidationError('Já existe uma categoria com este slug');
      }
      throw new ApiError(500, `Erro ao criar categoria de tag: ${error.message}`);
    }
  }

  /**
   * Busca categoria por ID
   * @param {number} id - ID da categoria
   * @param {number} companyId - ID da empresa (multi-tenant)
   * @returns {Promise<Object|null>} Categoria encontrada ou null
   */
  static async findById(id, companyId) {
    const selectQuery = `
      SELECT 
        tc.id, tc.company_id, tc.name, tc.description, tc.slug, tc.color, tc.icon,
        tc.sort_order, tc.is_active, tc.created_at, tc.updated_at,
        (
          SELECT COUNT(*) 
          FROM polox.tags t 
          WHERE t.category_id = tc.id AND t.deleted_at IS NULL
        ) as tags_count
      FROM polox.tag_categories tc
      WHERE tc.id = $1 AND tc.company_id = $2 AND tc.deleted_at IS NULL
    `;

    try {
      const result = await query(selectQuery, [id, companyId], { companyId });
      const category = result.rows[0];
      
      if (category) {
        category.tags_count = parseInt(category.tags_count) || 0;
      }

      return category || null;
    } catch (error) {
      throw new ApiError(500, `Erro ao buscar categoria de tag: ${error.message}`);
    }
  }

  /**
   * Busca categoria por slug
   * @param {string} slug - Slug da categoria
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object|null>} Categoria encontrada ou null
   */
  static async findBySlug(slug, companyId) {
    const selectQuery = `
      SELECT 
        tc.id, tc.company_id, tc.name, tc.description, tc.slug, tc.color, tc.icon,
        tc.sort_order, tc.is_active, tc.created_at, tc.updated_at,
        (
          SELECT COUNT(*) 
          FROM polox.tags t 
          WHERE t.category_id = tc.id AND t.deleted_at IS NULL
        ) as tags_count
      FROM polox.tag_categories tc
      WHERE tc.slug = $1 AND tc.company_id = $2 AND tc.deleted_at IS NULL
    `;

    try {
      const result = await query(selectQuery, [slug, companyId], { companyId });
      const category = result.rows[0];
      
      if (category) {
        category.tags_count = parseInt(category.tags_count) || 0;
      }

      return category || null;
    } catch (error) {
      throw new ApiError(500, `Erro ao buscar categoria por slug: ${error.message}`);
    }
  }

  /**
   * Lista todas as categorias de uma empresa
   * @param {number} companyId - ID da empresa
   * @param {Object} options - Opções de filtro
   * @returns {Promise<Array>} Lista de categorias
   */
  static async findByCompany(companyId, options = {}) {
    const { 
      is_active = null,
      page = 1, 
      limit = 50
    } = options;
    
    const offset = (page - 1) * limit;
    
    let whereClause = `
      WHERE tc.company_id = $1 AND tc.deleted_at IS NULL
    `;
    const params = [companyId];
    
    if (is_active !== null) {
      whereClause += ` AND tc.is_active = $${params.length + 1}`;
      params.push(is_active);
    }

    const selectQuery = `
      SELECT 
        tc.id, tc.company_id, tc.name, tc.description, tc.slug, tc.color, tc.icon,
        tc.sort_order, tc.is_active, tc.created_at, tc.updated_at,
        (
          SELECT COUNT(*) 
          FROM polox.tags t 
          WHERE t.category_id = tc.id AND t.deleted_at IS NULL
        ) as tags_count
      FROM polox.tag_categories tc
      ${whereClause}
      ORDER BY tc.sort_order ASC, tc.name ASC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    params.push(limit, offset);

    try {
      const result = await query(selectQuery, params, { companyId });
      
      return result.rows.map(category => ({
        ...category,
        tags_count: parseInt(category.tags_count) || 0
      }));
    } catch (error) {
      throw new ApiError(500, `Erro ao buscar categorias de tags: ${error.message}`);
    }
  }

  /**
   * Atualiza uma categoria
   * @param {number} id - ID da categoria
   * @param {Object} updateData - Dados para atualização
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object>} Categoria atualizada
   */
  static async update(id, updateData, companyId) {
    // Verificar se categoria existe
    const existing = await this.findById(id, companyId);
    if (!existing) {
      throw new NotFoundError('Categoria de tag não encontrada');
    }

    const {
      name,
      description,
      slug,
      color,
      icon,
      sort_order,
      is_active
    } = updateData;

    const updateFields = [];
    const params = [];
    let paramCount = 1;

    if (name !== undefined) {
      updateFields.push(`name = $${paramCount++}`);
      params.push(name);
    }

    if (description !== undefined) {
      updateFields.push(`description = $${paramCount++}`);
      params.push(description);
    }

    if (slug !== undefined) {
      updateFields.push(`slug = $${paramCount++}`);
      params.push(slug);
    }

    if (color !== undefined) {
      updateFields.push(`color = $${paramCount++}`);
      params.push(color);
    }

    if (icon !== undefined) {
      updateFields.push(`icon = $${paramCount++}`);
      params.push(icon);
    }

    if (sort_order !== undefined) {
      updateFields.push(`sort_order = $${paramCount++}`);
      params.push(sort_order);
    }

    if (is_active !== undefined) {
      updateFields.push(`is_active = $${paramCount++}`);
      params.push(is_active);
    }

    if (updateFields.length === 0) {
      throw new ValidationError('Nenhum campo para atualizar');
    }

    updateFields.push(`updated_at = NOW()`);
    params.push(id, companyId);

    const updateQuery = `
      UPDATE polox.tag_categories 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramCount++} AND company_id = $${paramCount++} AND deleted_at IS NULL
      RETURNING 
        id, company_id, name, description, slug, color, icon,
        sort_order, is_active, created_at, updated_at
    `;

    try {
      const result = await query(updateQuery, params);
      
      if (result.rows.length === 0) {
        throw new NotFoundError('Categoria de tag não encontrada');
      }

      return result.rows[0];
    } catch (error) {
      if (error.code === '23505' && error.constraint?.includes('slug')) {
        throw new ValidationError('Já existe uma categoria com este slug');
      }
      throw new ApiError(500, `Erro ao atualizar categoria de tag: ${error.message}`);
    }
  }

  /**
   * Reordena categorias
   * @param {Array} categoriesOrder - Array com {id, sort_order}
   * @param {number} companyId - ID da empresa
   * @returns {Promise<boolean>} True se reordenado com sucesso
   */
  static async reorder(categoriesOrder, companyId) {
    if (!Array.isArray(categoriesOrder) || categoriesOrder.length === 0) {
      throw new ValidationError('Lista de categorias inválida');
    }

    try {
      return await transaction(async (client) => {
        for (const item of categoriesOrder) {
          const { id, sort_order } = item;
          
          if (!id || sort_order === undefined) {
            throw new ValidationError('ID e sort_order são obrigatórios');
          }

          await client.query(
            `UPDATE polox.tag_categories 
             SET sort_order = $1, updated_at = NOW() 
             WHERE id = $2 AND company_id = $3 AND deleted_at IS NULL`,
            [sort_order, id, companyId]
          );
        }

        return true;
      });
    } catch (error) {
      throw new ApiError(500, `Erro ao reordenar categorias: ${error.message}`);
    }
  }

  /**
   * Remove uma categoria (soft delete)
   * @param {number} id - ID da categoria
   * @param {number} companyId - ID da empresa
   * @returns {Promise<boolean>} True se removido com sucesso
   */
  static async delete(id, companyId) {
    // Verificar se categoria existe
    const existing = await this.findById(id, companyId);
    if (!existing) {
      throw new NotFoundError('Categoria de tag não encontrada');
    }

    // Verificar se tem tags
    if (existing.tags_count > 0) {
      throw new ValidationError('Não é possível excluir categoria que possui tags');
    }

    const deleteQuery = `
      UPDATE polox.tag_categories 
      SET deleted_at = NOW()
      WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL
    `;

    try {
      const result = await query(deleteQuery, [id, companyId]);
      return result.rowCount > 0;
    } catch (error) {
      throw new ApiError(500, `Erro ao remover categoria de tag: ${error.message}`);
    }
  }

  /**
   * Estatísticas de categorias por empresa
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object>} Estatísticas
   */
  static async getStats(companyId) {
    const statsQuery = `
      SELECT 
        COUNT(*) as total_categories,
        COUNT(CASE WHEN tc.is_active THEN 1 END) as active_categories,
        COALESCE(SUM((
          SELECT COUNT(*) 
          FROM polox.tags t 
          WHERE t.category_id = tc.id AND t.deleted_at IS NULL
        )), 0) as total_tags
      FROM polox.tag_categories tc
      WHERE tc.company_id = $1 AND tc.deleted_at IS NULL
    `;

    try {
      const result = await query(statsQuery, [companyId], { companyId });
      const stats = result.rows[0];

      return {
        total_categories: parseInt(stats.total_categories) || 0,
        active_categories: parseInt(stats.active_categories) || 0,
        inactive_categories: (parseInt(stats.total_categories) || 0) - (parseInt(stats.active_categories) || 0),
        total_tags: parseInt(stats.total_tags) || 0
      };
    } catch (error) {
      throw new ApiError(500, `Erro ao buscar estatísticas: ${error.message}`);
    }
  }

  /**
   * Conta o total de categorias por empresa
   * @param {number} companyId - ID da empresa
   * @param {Object} filters - Filtros opcionais
   * @returns {Promise<number>} Total de categorias
   */
  static async count(companyId, filters = {}) {
    let whereClause = `
      WHERE tc.company_id = $1 AND tc.deleted_at IS NULL
    `;
    const params = [companyId];

    if (filters.is_active !== undefined) {
      whereClause += ` AND tc.is_active = $${params.length + 1}`;
      params.push(filters.is_active);
    }

    const countQuery = `
      SELECT COUNT(*) as total
      FROM polox.tag_categories tc
      ${whereClause}
    `;

    try {
      const result = await query(countQuery, params, { companyId });
      return parseInt(result.rows[0].total);
    } catch (error) {
      throw new ApiError(500, `Erro ao contar categorias de tags: ${error.message}`);
    }
  }
}

module.exports = TagCategoryModel;