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

const { query, transaction } = require('../config/database');
const { ApiError, ValidationError, NotFoundError } = require('../utils/errors');

/**
 * Model para categorias de produtos
 * Baseado no schema polox.product_categories
 */
class ProductCategoryModel {
  /**
   * Cria uma nova categoria de produto
   * @param {Object} categoryData - Dados da categoria
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object>} Categoria criada
   */
  static async create(categoryData, companyId) {
    const {
      name,
      description,
      parent_id = null,
      slug,
      meta_title,
      meta_description,
      is_active = true,
      sort_order = 0
    } = categoryData;

    // Validar dados obrigatórios
    if (!name) {
      throw new ValidationError('Nome da categoria é obrigatório');
    }

    // Gerar slug se não fornecido
    const finalSlug = slug || name.toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .trim();

    const insertQuery = `
      INSERT INTO polox.product_categories (
        company_id, name, description, parent_id, slug,
        meta_title, meta_description, is_active, sort_order,
        created_at, updated_at
      )
      VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9,
        NOW(), NOW()
      )
      RETURNING 
        id, company_id, name, description, parent_id, slug,
        meta_title, meta_description, is_active, sort_order,
        created_at, updated_at
    `;

    try {
      const result = await query(insertQuery, [
        companyId, name, description, parent_id, finalSlug,
        meta_title, meta_description, is_active, sort_order
      ], { companyId });

      return result.rows[0];
    } catch (error) {
      if (error.code === '23505') {
        if (error.constraint?.includes('slug')) {
          throw new ValidationError('Já existe uma categoria com este slug');
        }
      }
      if (error.code === '23503' && error.constraint?.includes('parent')) {
        throw new ValidationError('Categoria pai informada não existe');
      }
      throw new ApiError(500, `Erro ao criar categoria: ${error.message}`);
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
        c.id, c.company_id, c.name, c.description, c.parent_id, c.slug,
        c.meta_title, c.meta_description, c.is_active, c.sort_order,
        c.created_at, c.updated_at,
        p.category_name as parent_name,
        (SELECT COUNT(*) FROM polox.product_categories WHERE parent_id = c.id AND deleted_at IS NULL) as children_count,
        (SELECT COUNT(*) FROM polox.products WHERE category_id = c.id AND deleted_at IS NULL) as products_count
      FROM polox.product_categories c
      LEFT JOIN polox.product_categories p ON c.parent_id = p.id
      WHERE c.id = $1 AND c.company_id = $2 AND c.deleted_at IS NULL
    `;

    try {
      const result = await query(selectQuery, [id, companyId], { companyId });
      return result.rows[0] || null;
    } catch (error) {
      throw new ApiError(500, `Erro ao buscar categoria: ${error.message}`);
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
        c.id, c.company_id, c.name, c.description, c.parent_id, c.slug,
        c.meta_title, c.meta_description, c.is_active, c.sort_order,
        c.created_at, c.updated_at,
        p.category_name as parent_name
      FROM polox.product_categories c
      LEFT JOIN polox.product_categories p ON c.parent_id = p.id
      WHERE c.slug = $1 AND c.company_id = $2 AND c.deleted_at IS NULL
    `;

    try {
      const result = await query(selectQuery, [slug, companyId], { companyId });
      return result.rows[0] || null;
    } catch (error) {
      throw new ApiError(500, `Erro ao buscar categoria: ${error.message}`);
    }
  }

  /**
   * Lista categorias com filtros
   * @param {number} companyId - ID da empresa
   * @param {Object} options - Opções de filtro
   * @returns {Promise<Array>} Lista de categorias
   */
  static async findByCompany(companyId, options = {}) {
    const { 
      page = 1, 
      limit = 10,
      parent_id = null,
      is_active = null,
      search = null,
      include_children = false
    } = options;
    
    const offset = (page - 1) * limit;
    
    let whereClause = 'WHERE c.company_id = $1 AND c.deleted_at IS NULL';
    const params = [companyId];
    
    // Filtro por categoria pai
    if (parent_id === 'root') {
      whereClause += ' AND c.parent_id IS NULL';
    } else if (parent_id) {
      whereClause += ` AND c.parent_id = $${params.length + 1}`;
      params.push(parent_id);
    }

    if (is_active !== null) {
      whereClause += ` AND c.is_active = $${params.length + 1}`;
      params.push(is_active);
    }

    if (search) {
      whereClause += ` AND (c.name ILIKE $${params.length + 1} OR c.description ILIKE $${params.length + 1})`;
      params.push(`%${search}%`);
    }

    const selectFields = `
      c.id, c.company_id, c.name, c.description, c.parent_id, c.slug,
      c.meta_title, c.meta_description, c.is_active, c.sort_order,
      c.created_at, c.updated_at,
      p.category_name as parent_name,
      (SELECT COUNT(*) FROM polox.product_categories WHERE parent_id = c.id AND deleted_at IS NULL) as children_count,
      (SELECT COUNT(*) FROM polox.products WHERE category_id = c.id AND deleted_at IS NULL) as products_count
    `;

    const selectQuery = `
      SELECT ${selectFields}
      FROM polox.product_categories c
      LEFT JOIN polox.product_categories p ON c.parent_id = p.id
      ${whereClause}
      ORDER BY c.sort_order ASC, c.name ASC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    params.push(limit, offset);

    try {
      const result = await query(selectQuery, params, { companyId });
      
      if (include_children && result.rows.length > 0) {
        // Buscar subcategorias para cada categoria
        for (const category of result.rows) {
          const children = await this.findByCompany(companyId, {
            parent_id: category.id,
            is_active: is_active,
            limit: 100 // Limite maior para subcategorias
          });
          category.children = children;
        }
      }

      return result.rows;
    } catch (error) {
      throw new ApiError(500, `Erro ao buscar categorias: ${error.message}`);
    }
  }

  /**
   * Busca categorias raiz (sem pai)
   * @param {number} companyId - ID da empresa
   * @param {boolean} includeChildren - Se deve incluir subcategorias
   * @returns {Promise<Array>} Lista de categorias raiz
   */
  static async findRootCategories(companyId, includeChildren = false) {
    return await this.findByCompany(companyId, {
      parent_id: 'root',
      is_active: true,
      include_children: includeChildren,
      limit: 100
    });
  }

  /**
   * Busca subcategorias de uma categoria
   * @param {number} parentId - ID da categoria pai
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Array>} Lista de subcategorias
   */
  static async findChildren(parentId, companyId) {
    return await this.findByCompany(companyId, {
      parent_id: parentId,
      limit: 100
    });
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
      throw new NotFoundError('Categoria não encontrada');
    }

    // Verificar se não está tentando definir ela mesma como pai
    if (updateData.parent_id === id) {
      throw new ValidationError('Categoria não pode ser pai de si mesma');
    }

    const {
      name,
      description,
      parent_id,
      slug,
      meta_title,
      meta_description,
      is_active,
      sort_order
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

    if (parent_id !== undefined) {
      updateFields.push(`parent_id = $${paramCount++}`);
      params.push(parent_id);
    }

    if (slug !== undefined) {
      updateFields.push(`slug = $${paramCount++}`);
      params.push(slug);
    }

    if (meta_title !== undefined) {
      updateFields.push(`meta_title = $${paramCount++}`);
      params.push(meta_title);
    }

    if (meta_description !== undefined) {
      updateFields.push(`meta_description = $${paramCount++}`);
      params.push(meta_description);
    }

    if (is_active !== undefined) {
      updateFields.push(`is_active = $${paramCount++}`);
      params.push(is_active);
    }

    if (sort_order !== undefined) {
      updateFields.push(`sort_order = $${paramCount++}`);
      params.push(sort_order);
    }

    if (updateFields.length === 0) {
      throw new ValidationError('Nenhum campo para atualizar');
    }

    updateFields.push(`updated_at = NOW()`);
    params.push(id, companyId);

    const updateQuery = `
      UPDATE polox.product_categories 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramCount++} AND company_id = $${paramCount++} AND deleted_at IS NULL
      RETURNING 
        id, company_id, name, description, parent_id, slug,
        meta_title, meta_description, is_active, sort_order,
        created_at, updated_at
    `;

    try {
      const result = await query(updateQuery, params, { companyId });
      
      if (result.rows.length === 0) {
        throw new NotFoundError('Categoria não encontrada');
      }

      return result.rows[0];
    } catch (error) {
      if (error.code === '23505') {
        throw new ValidationError('Já existe uma categoria com este slug');
      }
      if (error.code === '23503') {
        throw new ValidationError('Categoria pai informada não existe');
      }
      throw new ApiError(500, `Erro ao atualizar categoria: ${error.message}`);
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
      throw new NotFoundError('Categoria não encontrada');
    }

    // Verificar se tem subcategorias ou produtos
    if (existing.children_count > 0) {
      throw new ValidationError('Não é possível remover categoria que possui subcategorias');
    }

    if (existing.products_count > 0) {
      throw new ValidationError('Não é possível remover categoria que possui produtos');
    }

    const deleteQuery = `
      UPDATE polox.product_categories 
      SET deleted_at = NOW()
      WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL
    `;

    try {
      const result = await query(deleteQuery, [id, companyId], { companyId });
      return result.rowCount > 0;
    } catch (error) {
      throw new ApiError(500, `Erro ao remover categoria: ${error.message}`);
    }
  }

  /**
   * Reordena categorias
   * @param {Array} categoriesOrder - Array com { id, sort_order }
   * @param {number} companyId - ID da empresa
   * @returns {Promise<boolean>} True se reordenado com sucesso
   */
  static async reorder(categoriesOrder, companyId) {
    return await transaction(async (client) => {
      for (const item of categoriesOrder) {
        await client.query(
          'UPDATE polox.product_categories SET sort_order = $1, updated_at = NOW() WHERE id = $2 AND company_id = $3',
          [item.sort_order, item.id, companyId]
        );
      }
      return true;
    }, { companyId });
  }

  /**
   * Conta o total de categorias de uma empresa
   * @param {number} companyId - ID da empresa
   * @param {Object} filters - Filtros opcionais
   * @returns {Promise<number>} Total de categorias
   */
  static async count(companyId, filters = {}) {
    let whereClause = 'WHERE company_id = $1 AND deleted_at IS NULL';
    const params = [companyId];

    if (filters.parent_id === 'root') {
      whereClause += ' AND parent_id IS NULL';
    } else if (filters.parent_id) {
      whereClause += ` AND parent_id = $${params.length + 1}`;
      params.push(filters.parent_id);
    }

    if (filters.is_active !== undefined) {
      whereClause += ` AND is_active = $${params.length + 1}`;
      params.push(filters.is_active);
    }

    const countQuery = `
      SELECT COUNT(*) as total
      FROM polox.product_categories 
      ${whereClause}
    `;

    try {
      const result = await query(countQuery, params, { companyId });
      return parseInt(result.rows[0].total);
    } catch (error) {
      throw new ApiError(500, `Erro ao contar categorias: ${error.message}`);
    }
  }

  /**
   * Busca árvore completa de categorias
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Array>} Árvore de categorias
   */
  static async getTree(companyId) {
    // Buscar todas as categorias
    const allCategories = await this.findByCompany(companyId, {
      is_active: true,
      limit: 1000
    });

    // Organizar em árvore
    const categoryMap = new Map();
    const rootCategories = [];

    // Primeiro, criar um mapa de todas as categorias
    allCategories.forEach(category => {
      categoryMap.set(category.id, { ...category, children: [] });
    });

    // Depois, organizar a hierarquia
    allCategories.forEach(category => {
      if (category.parent_id) {
        const parent = categoryMap.get(category.parent_id);
        if (parent) {
          parent.children.push(categoryMap.get(category.id));
        }
      } else {
        rootCategories.push(categoryMap.get(category.id));
      }
    });

    return rootCategories;
  }
}

module.exports = ProductCategoryModel;