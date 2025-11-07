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
 * Model para categorias de FAQ
 * Baseado no schema polox.faq_categories
 */
class FaqCategoryModel {
  /**
   * Cria uma nova categoria de FAQ
   * @param {Object} categoryData - Dados da categoria
   * @returns {Promise<Object>} Categoria criada
   */
  static async create(categoryData) {
    const {
      company_id,
      name,
      description = null,
      slug = null,
      icon = null,
      color = null,
      parent_id = null,
      sort_order = 0,
      is_active = true,
      is_public = true
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
      INSERT INTO polox.faq_categories (
        company_id, name, description, slug, icon, color,
        parent_id, sort_order, is_active, is_public,
        created_at, updated_at
      )
      VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10,
        NOW(), NOW()
      )
      RETURNING 
        id, company_id, name, description, slug, icon, color,
        parent_id, sort_order, is_active, is_public,
        created_at, updated_at
    `;

    try {
      const result = await query(insertQuery, [
        company_id, name, description, finalSlug, icon, color,
        parent_id, sort_order, is_active, is_public
      ]);

      return result.rows[0];
    } catch (error) {
      if (error.code === '23503') {
        if (error.constraint?.includes('company')) {
          throw new ValidationError('Empresa informada não existe');
        }
        if (error.constraint?.includes('parent')) {
          throw new ValidationError('Categoria pai informada não existe');
        }
      }
      if (error.code === '23505' && error.constraint?.includes('slug')) {
        throw new ValidationError('Já existe uma categoria com este slug');
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
        fc.id, fc.company_id, fc.name, fc.description, fc.slug, fc.icon, fc.color,
        fc.parent_id, fc.sort_order, fc.is_active, fc.is_public,
        fc.created_at, fc.updated_at,
        pc.name as parent_name,
        (
          SELECT COUNT(*) 
          FROM polox.faq_articles fa 
          WHERE fa.category_id = fc.id AND fa.deleted_at IS NULL
        ) as articles_count,
        (
          SELECT COUNT(*) 
          FROM polox.faq_categories child 
          WHERE child.parent_id = fc.id AND child.deleted_at IS NULL
        ) as children_count
      FROM polox.faq_categories fc
      LEFT JOIN polox.faq_categories pc ON fc.parent_id = pc.id
      WHERE fc.id = $1 AND fc.company_id = $2 AND fc.deleted_at IS NULL
    `;

    try {
      const result = await query(selectQuery, [id, companyId], { companyId });
      const category = result.rows[0];
      
      if (category) {
        category.articles_count = parseInt(category.articles_count) || 0;
        category.children_count = parseInt(category.children_count) || 0;
      }

      return category || null;
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
        fc.id, fc.company_id, fc.name, fc.description, fc.slug, fc.icon, fc.color,
        fc.parent_id, fc.sort_order, fc.is_active, fc.is_public,
        fc.created_at, fc.updated_at,
        pc.name as parent_name,
        (
          SELECT COUNT(*) 
          FROM polox.faq_articles fa 
          WHERE fa.category_id = fc.id AND fa.deleted_at IS NULL
        ) as articles_count
      FROM polox.faq_categories fc
      LEFT JOIN polox.faq_categories pc ON fc.parent_id = pc.id
      WHERE fc.slug = $1 AND fc.company_id = $2 AND fc.deleted_at IS NULL
    `;

    try {
      const result = await query(selectQuery, [slug, companyId], { companyId });
      const category = result.rows[0];
      
      if (category) {
        category.articles_count = parseInt(category.articles_count) || 0;
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
      is_public = null,
      parent_id = null,
      include_hidden = false,
      page = 1, 
      limit = 50
    } = options;
    
    const offset = (page - 1) * limit;
    
    let whereClause = `
      WHERE fc.company_id = $1 AND fc.deleted_at IS NULL
    `;
    const params = [companyId];
    
    if (is_active !== null) {
      whereClause += ` AND fc.is_active = $${params.length + 1}`;
      params.push(is_active);
    }

    if (is_public !== null) {
      whereClause += ` AND fc.is_public = $${params.length + 1}`;
      params.push(is_public);
    }

    if (parent_id !== null) {
      whereClause += ` AND fc.parent_id = $${params.length + 1}`;
      params.push(parent_id);
    } else if (!include_hidden) {
      whereClause += ` AND fc.parent_id IS NULL`;
    }

    const selectQuery = `
      SELECT 
        fc.id, fc.company_id, fc.name, fc.description, fc.slug, fc.icon, fc.color,
        fc.parent_id, fc.sort_order, fc.is_active, fc.is_public,
        fc.created_at, fc.updated_at,
        pc.name as parent_name,
        (
          SELECT COUNT(*) 
          FROM polox.faq_articles fa 
          WHERE fa.category_id = fc.id AND fa.deleted_at IS NULL
        ) as articles_count,
        (
          SELECT COUNT(*) 
          FROM polox.faq_categories child 
          WHERE child.parent_id = fc.id AND child.deleted_at IS NULL
        ) as children_count
      FROM polox.faq_categories fc
      LEFT JOIN polox.faq_categories pc ON fc.parent_id = pc.id
      ${whereClause}
      ORDER BY fc.sort_order ASC, fc.name ASC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    params.push(limit, offset);

    try {
      const result = await query(selectQuery, params, { companyId });
      
      return result.rows.map(category => ({
        ...category,
        articles_count: parseInt(category.articles_count) || 0,
        children_count: parseInt(category.children_count) || 0
      }));
    } catch (error) {
      throw new ApiError(500, `Erro ao buscar categorias: ${error.message}`);
    }
  }

  /**
   * Lista subcategorias de uma categoria pai
   * @param {number} parentId - ID da categoria pai
   * @param {number} companyId - ID da empresa
   * @param {Object} options - Opções de filtro
   * @returns {Promise<Array>} Lista de subcategorias
   */
  static async findChildren(parentId, companyId, options = {}) {
    const { 
      is_active = null,
      is_public = null
    } = options;
    
    let whereClause = `
      WHERE fc.parent_id = $1 AND fc.company_id = $2 AND fc.deleted_at IS NULL
    `;
    const params = [parentId, companyId];
    
    if (is_active !== null) {
      whereClause += ` AND fc.is_active = $${params.length + 1}`;
      params.push(is_active);
    }

    if (is_public !== null) {
      whereClause += ` AND fc.is_public = $${params.length + 1}`;
      params.push(is_public);
    }

    const selectQuery = `
      SELECT 
        fc.id, fc.company_id, fc.name, fc.description, fc.slug, fc.icon, fc.color,
        fc.parent_id, fc.sort_order, fc.is_active, fc.is_public,
        fc.created_at, fc.updated_at,
        (
          SELECT COUNT(*) 
          FROM polox.faq_articles fa 
          WHERE fa.category_id = fc.id AND fa.deleted_at IS NULL
        ) as articles_count
      FROM polox.faq_categories fc
      ${whereClause}
      ORDER BY fc.sort_order ASC, fc.name ASC
    `;

    try {
      const result = await query(selectQuery, params, { companyId });
      
      return result.rows.map(category => ({
        ...category,
        articles_count: parseInt(category.articles_count) || 0
      }));
    } catch (error) {
      throw new ApiError(500, `Erro ao buscar subcategorias: ${error.message}`);
    }
  }

  /**
   * Constrói árvore hierárquica de categorias
   * @param {number} companyId - ID da empresa
   * @param {Object} options - Opções de filtro
   * @returns {Promise<Array>} Árvore de categorias
   */
  static async getTree(companyId, options = {}) {
    const { 
      is_active = true,
      is_public = null
    } = options;
    
    // Buscar todas as categorias
    const categories = await this.findByCompany(companyId, { 
      is_active, 
      is_public, 
      include_hidden: true,
      limit: 1000 
    });

    // Construir árvore
    const categoryMap = new Map();
    const rootCategories = [];

    // Primeira passada: criar mapa de categorias
    categories.forEach(category => {
      categoryMap.set(category.id, { ...category, children: [] });
    });

    // Segunda passada: construir hierarquia
    categories.forEach(category => {
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

    const {
      name,
      description,
      slug,
      icon,
      color,
      parent_id,
      sort_order,
      is_active,
      is_public
    } = updateData;

    // Validar se não está tentando se definir como pai de si mesma
    if (parent_id === id) {
      throw new ValidationError('Categoria não pode ser pai de si mesma');
    }

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

    if (icon !== undefined) {
      updateFields.push(`icon = $${paramCount++}`);
      params.push(icon);
    }

    if (color !== undefined) {
      updateFields.push(`color = $${paramCount++}`);
      params.push(color);
    }

    if (parent_id !== undefined) {
      updateFields.push(`parent_id = $${paramCount++}`);
      params.push(parent_id);
    }

    if (sort_order !== undefined) {
      updateFields.push(`sort_order = $${paramCount++}`);
      params.push(sort_order);
    }

    if (is_active !== undefined) {
      updateFields.push(`is_active = $${paramCount++}`);
      params.push(is_active);
    }

    if (is_public !== undefined) {
      updateFields.push(`is_public = $${paramCount++}`);
      params.push(is_public);
    }

    if (updateFields.length === 0) {
      throw new ValidationError('Nenhum campo para atualizar');
    }

    updateFields.push(`updated_at = NOW()`);
    params.push(id, companyId);

    const updateQuery = `
      UPDATE polox.faq_categories 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramCount++} AND company_id = $${paramCount++} AND deleted_at IS NULL
      RETURNING 
        id, company_id, name, description, slug, icon, color,
        parent_id, sort_order, is_active, is_public,
        created_at, updated_at
    `;

    try {
      const result = await query(updateQuery, params);
      
      if (result.rows.length === 0) {
        throw new NotFoundError('Categoria não encontrada');
      }

      return result.rows[0];
    } catch (error) {
      if (error.code === '23505' && error.constraint?.includes('slug')) {
        throw new ValidationError('Já existe uma categoria com este slug');
      }
      throw new ApiError(500, `Erro ao atualizar categoria: ${error.message}`);
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
            `UPDATE polox.faq_categories 
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
      throw new NotFoundError('Categoria não encontrada');
    }

    // Verificar se tem subcategorias
    if (existing.children_count > 0) {
      throw new ValidationError('Não é possível excluir categoria que possui subcategorias');
    }

    // Verificar se tem artigos
    if (existing.articles_count > 0) {
      throw new ValidationError('Não é possível excluir categoria que possui artigos');
    }

    const deleteQuery = `
      UPDATE polox.faq_categories 
      SET deleted_at = NOW()
      WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL
    `;

    try {
      const result = await query(deleteQuery, [id, companyId]);
      return result.rowCount > 0;
    } catch (error) {
      throw new ApiError(500, `Erro ao remover categoria: ${error.message}`);
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
      WHERE fc.company_id = $1 AND fc.deleted_at IS NULL
    `;
    const params = [companyId];

    if (filters.is_active !== undefined) {
      whereClause += ` AND fc.is_active = $${params.length + 1}`;
      params.push(filters.is_active);
    }

    if (filters.is_public !== undefined) {
      whereClause += ` AND fc.is_public = $${params.length + 1}`;
      params.push(filters.is_public);
    }

    if (filters.parent_id !== undefined) {
      if (filters.parent_id === null) {
        whereClause += ` AND fc.parent_id IS NULL`;
      } else {
        whereClause += ` AND fc.parent_id = $${params.length + 1}`;
        params.push(filters.parent_id);
      }
    }

    const countQuery = `
      SELECT COUNT(*) as total
      FROM polox.faq_categories fc
      ${whereClause}
    `;

    try {
      const result = await query(countQuery, params, { companyId });
      return parseInt(result.rows[0].total);
    } catch (error) {
      throw new ApiError(500, `Erro ao contar categorias: ${error.message}`);
    }
  }
}

module.exports = FaqCategoryModel;