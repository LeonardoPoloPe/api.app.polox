const { query, transaction } = require('../config/database');
const { ApiError, ValidationError, NotFoundError } = require('../utils/errors');

/**
 * Model para artigos de FAQ
 * Baseado no schema polox.faq_articles
 */
class FaqArticleModel {
  /**
   * Cria um novo artigo de FAQ
   * @param {Object} articleData - Dados do artigo
   * @returns {Promise<Object>} Artigo criado
   */
  static async create(articleData) {
    const {
      category_id,
      title,
      content,
      slug = null,
      author_id,
      summary = null,
      keywords = [],
      attachments = [],
      sort_order = 0,
      is_published = true,
      is_featured = false,
      view_count = 0,
      helpful_count = 0,
      not_helpful_count = 0
    } = articleData;

    // Validar dados obrigatórios
    if (!category_id || !title || !content || !author_id) {
      throw new ValidationError('Category ID, título, conteúdo e autor são obrigatórios');
    }

    // Gerar slug se não fornecido
    const finalSlug = slug || title.toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .trim();

    const insertQuery = `
      INSERT INTO polox.faq_articles (
        category_id, title, content, slug, author_id, summary,
        keywords, attachments, sort_order, is_published, is_featured,
        view_count, helpful_count, not_helpful_count,
        created_at, updated_at
      )
      VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10, $11,
        $12, $13, $14,
        NOW(), NOW()
      )
      RETURNING 
        id, category_id, title, content, slug, author_id, summary,
        keywords, attachments, sort_order, is_published, is_featured,
        view_count, helpful_count, not_helpful_count,
        created_at, updated_at
    `;

    try {
      const result = await query(insertQuery, [
        category_id, title, content, finalSlug, author_id, summary,
        JSON.stringify(keywords), JSON.stringify(attachments), sort_order, 
        is_published, is_featured, view_count, helpful_count, not_helpful_count
      ]);

      const article = result.rows[0];
      
      // Parse JSON fields
      article.keywords = typeof article.keywords === 'string' 
        ? JSON.parse(article.keywords) 
        : article.keywords;
      article.attachments = typeof article.attachments === 'string' 
        ? JSON.parse(article.attachments) 
        : article.attachments;

      return article;
    } catch (error) {
      if (error.code === '23503') {
        if (error.constraint?.includes('category')) {
          throw new ValidationError('Categoria informada não existe');
        }
        if (error.constraint?.includes('author')) {
          throw new ValidationError('Autor informado não existe');
        }
      }
      if (error.code === '23505' && error.constraint?.includes('slug')) {
        throw new ValidationError('Já existe um artigo com este slug');
      }
      throw new ApiError(500, `Erro ao criar artigo: ${error.message}`);
    }
  }

  /**
   * Busca artigo por ID
   * @param {number} id - ID do artigo
   * @param {number} companyId - ID da empresa (multi-tenant)
   * @returns {Promise<Object|null>} Artigo encontrado ou null
   */
  static async findById(id, companyId) {
    const selectQuery = `
      SELECT 
        fa.id, fa.category_id, fa.title, fa.content, fa.slug, fa.author_id,
        fa.summary, fa.keywords, fa.attachments, fa.sort_order,
        fa.is_published, fa.is_featured, fa.view_count, fa.helpful_count,
        fa.not_helpful_count, fa.created_at, fa.updated_at,
        fc.name as category_name,
        fc.slug as category_slug,
        u.full_name as author_name,
        u.email as author_email
      FROM polox.faq_articles fa
      INNER JOIN polox.faq_categories fc ON fa.category_id = fc.id
      INNER JOIN polox.users u ON fa.author_id = u.id
      WHERE fa.id = $1 AND fc.company_id = $2 AND fa.deleted_at IS NULL
    `;

    try {
      const result = await query(selectQuery, [id, companyId], { companyId });
      const article = result.rows[0];
      
      if (article) {
        // Parse JSON fields
        article.keywords = typeof article.keywords === 'string' 
          ? JSON.parse(article.keywords) 
          : article.keywords;
        article.attachments = typeof article.attachments === 'string' 
          ? JSON.parse(article.attachments) 
          : article.attachments;
      }

      return article || null;
    } catch (error) {
      throw new ApiError(500, `Erro ao buscar artigo: ${error.message}`);
    }
  }

  /**
   * Busca artigo por slug
   * @param {string} slug - Slug do artigo
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object|null>} Artigo encontrado ou null
   */
  static async findBySlug(slug, companyId) {
    const selectQuery = `
      SELECT 
        fa.id, fa.category_id, fa.title, fa.content, fa.slug, fa.author_id,
        fa.summary, fa.keywords, fa.attachments, fa.sort_order,
        fa.is_published, fa.is_featured, fa.view_count, fa.helpful_count,
        fa.not_helpful_count, fa.created_at, fa.updated_at,
        fc.name as category_name,
        fc.slug as category_slug,
        u.full_name as author_name,
        u.email as author_email
      FROM polox.faq_articles fa
      INNER JOIN polox.faq_categories fc ON fa.category_id = fc.id
      INNER JOIN polox.users u ON fa.author_id = u.id
      WHERE fa.slug = $1 AND fc.company_id = $2 AND fa.deleted_at IS NULL
    `;

    try {
      const result = await query(selectQuery, [slug, companyId], { companyId });
      const article = result.rows[0];
      
      if (article) {
        // Parse JSON fields
        article.keywords = typeof article.keywords === 'string' 
          ? JSON.parse(article.keywords) 
          : article.keywords;
        article.attachments = typeof article.attachments === 'string' 
          ? JSON.parse(article.attachments) 
          : article.attachments;
      }

      return article || null;
    } catch (error) {
      throw new ApiError(500, `Erro ao buscar artigo por slug: ${error.message}`);
    }
  }

  /**
   * Lista artigos de uma categoria
   * @param {number} categoryId - ID da categoria
   * @param {number} companyId - ID da empresa
   * @param {Object} options - Opções de filtro
   * @returns {Promise<Array>} Lista de artigos
   */
  static async findByCategory(categoryId, companyId, options = {}) {
    const { 
      is_published = null,
      is_featured = null,
      page = 1, 
      limit = 50
    } = options;
    
    const offset = (page - 1) * limit;
    
    let whereClause = `
      WHERE fa.category_id = $1 AND fc.company_id = $2 AND fa.deleted_at IS NULL
    `;
    const params = [categoryId, companyId];
    
    if (is_published !== null) {
      whereClause += ` AND fa.is_published = $${params.length + 1}`;
      params.push(is_published);
    }

    if (is_featured !== null) {
      whereClause += ` AND fa.is_featured = $${params.length + 1}`;
      params.push(is_featured);
    }

    const selectQuery = `
      SELECT 
        fa.id, fa.category_id, fa.title, fa.content, fa.slug, fa.author_id,
        fa.summary, fa.keywords, fa.attachments, fa.sort_order,
        fa.is_published, fa.is_featured, fa.view_count, fa.helpful_count,
        fa.not_helpful_count, fa.created_at, fa.updated_at,
        fc.name as category_name,
        u.full_name as author_name
      FROM polox.faq_articles fa
      INNER JOIN polox.faq_categories fc ON fa.category_id = fc.id
      INNER JOIN polox.users u ON fa.author_id = u.id
      ${whereClause}
      ORDER BY fa.is_featured DESC, fa.sort_order ASC, fa.created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    params.push(limit, offset);

    try {
      const result = await query(selectQuery, params, { companyId });
      
      return result.rows.map(article => {
        // Parse JSON fields
        article.keywords = typeof article.keywords === 'string' 
          ? JSON.parse(article.keywords) 
          : article.keywords;
        article.attachments = typeof article.attachments === 'string' 
          ? JSON.parse(article.attachments) 
          : article.attachments;
        
        return article;
      });
    } catch (error) {
      throw new ApiError(500, `Erro ao buscar artigos da categoria: ${error.message}`);
    }
  }

  /**
   * Lista todos os artigos de uma empresa
   * @param {number} companyId - ID da empresa
   * @param {Object} options - Opções de filtro
   * @returns {Promise<Array>} Lista de artigos
   */
  static async findByCompany(companyId, options = {}) {
    const { 
      is_published = null,
      is_featured = null,
      author_id = null,
      search = null,
      page = 1, 
      limit = 50
    } = options;
    
    const offset = (page - 1) * limit;
    
    let whereClause = `
      WHERE fc.company_id = $1 AND fa.deleted_at IS NULL
    `;
    const params = [companyId];
    
    if (is_published !== null) {
      whereClause += ` AND fa.is_published = $${params.length + 1}`;
      params.push(is_published);
    }

    if (is_featured !== null) {
      whereClause += ` AND fa.is_featured = $${params.length + 1}`;
      params.push(is_featured);
    }

    if (author_id) {
      whereClause += ` AND fa.author_id = $${params.length + 1}`;
      params.push(author_id);
    }

    if (search) {
      whereClause += ` AND (
        fa.title ILIKE $${params.length + 1} OR 
        fa.content ILIKE $${params.length + 1} OR
        fa.summary ILIKE $${params.length + 1}
      )`;
      params.push(`%${search}%`);
    }

    const selectQuery = `
      SELECT 
        fa.id, fa.category_id, fa.title, fa.slug, fa.author_id,
        fa.summary, fa.keywords, fa.sort_order,
        fa.is_published, fa.is_featured, fa.view_count, fa.helpful_count,
        fa.not_helpful_count, fa.created_at, fa.updated_at,
        fc.name as category_name,
        fc.slug as category_slug,
        u.full_name as author_name,
        LENGTH(fa.content) as content_length
      FROM polox.faq_articles fa
      INNER JOIN polox.faq_categories fc ON fa.category_id = fc.id
      INNER JOIN polox.users u ON fa.author_id = u.id
      ${whereClause}
      ORDER BY fa.is_featured DESC, fa.view_count DESC, fa.created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    params.push(limit, offset);

    try {
      const result = await query(selectQuery, params, { companyId });
      
      return result.rows.map(article => {
        // Parse JSON fields
        article.keywords = typeof article.keywords === 'string' 
          ? JSON.parse(article.keywords) 
          : article.keywords;
        
        return article;
      });
    } catch (error) {
      throw new ApiError(500, `Erro ao buscar artigos: ${error.message}`);
    }
  }

  /**
   * Busca artigos em destaque
   * @param {number} companyId - ID da empresa
   * @param {number} limit - Limite de resultados
   * @returns {Promise<Array>} Lista de artigos em destaque
   */
  static async findFeatured(companyId, limit = 10) {
    const selectQuery = `
      SELECT 
        fa.id, fa.category_id, fa.title, fa.slug, fa.summary,
        fa.view_count, fa.helpful_count, fa.created_at,
        fc.name as category_name,
        fc.slug as category_slug,
        u.full_name as author_name
      FROM polox.faq_articles fa
      INNER JOIN polox.faq_categories fc ON fa.category_id = fc.id
      INNER JOIN polox.users u ON fa.author_id = u.id
      WHERE fc.company_id = $1 
        AND fa.is_published = true 
        AND fa.is_featured = true 
        AND fa.deleted_at IS NULL
      ORDER BY fa.sort_order ASC, fa.view_count DESC
      LIMIT $2
    `;

    try {
      const result = await query(selectQuery, [companyId, limit], { companyId });
      return result.rows;
    } catch (error) {
      throw new ApiError(500, `Erro ao buscar artigos em destaque: ${error.message}`);
    }
  }

  /**
   * Busca artigos mais populares
   * @param {number} companyId - ID da empresa
   * @param {number} limit - Limite de resultados
   * @returns {Promise<Array>} Lista de artigos populares
   */
  static async findPopular(companyId, limit = 10) {
    const selectQuery = `
      SELECT 
        fa.id, fa.category_id, fa.title, fa.slug, fa.summary,
        fa.view_count, fa.helpful_count, fa.created_at,
        fc.name as category_name,
        fc.slug as category_slug,
        u.full_name as author_name,
        (fa.helpful_count::float / NULLIF(fa.helpful_count + fa.not_helpful_count, 0)) as helpfulness_ratio
      FROM polox.faq_articles fa
      INNER JOIN polox.faq_categories fc ON fa.category_id = fc.id
      INNER JOIN polox.users u ON fa.author_id = u.id
      WHERE fc.company_id = $1 
        AND fa.is_published = true 
        AND fa.deleted_at IS NULL
        AND fa.view_count > 0
      ORDER BY fa.view_count DESC, helpfulness_ratio DESC NULLS LAST
      LIMIT $2
    `;

    try {
      const result = await query(selectQuery, [companyId, limit], { companyId });
      return result.rows.map(article => ({
        ...article,
        helpfulness_ratio: parseFloat(article.helpfulness_ratio) || 0
      }));
    } catch (error) {
      throw new ApiError(500, `Erro ao buscar artigos populares: ${error.message}`);
    }
  }

  /**
   * Incrementa visualização de um artigo
   * @param {number} id - ID do artigo
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object>} Artigo atualizado
   */
  static async incrementView(id, companyId) {
    const updateQuery = `
      UPDATE polox.faq_articles 
      SET view_count = view_count + 1, updated_at = NOW()
      FROM polox.faq_categories fc
      WHERE faq_articles.id = $1 
        AND faq_articles.category_id = fc.id 
        AND fc.company_id = $2 
        AND faq_articles.deleted_at IS NULL
      RETURNING view_count
    `;

    try {
      const result = await query(updateQuery, [id, companyId]);
      
      if (result.rows.length === 0) {
        throw new NotFoundError('Artigo não encontrado');
      }

      return result.rows[0];
    } catch (error) {
      throw new ApiError(500, `Erro ao incrementar visualização: ${error.message}`);
    }
  }

  /**
   * Registra feedback (útil/não útil) de um artigo
   * @param {number} id - ID do artigo
   * @param {boolean} isHelpful - Se foi útil ou não
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object>} Contadores atualizados
   */
  static async recordFeedback(id, isHelpful, companyId) {
    const field = isHelpful ? 'helpful_count' : 'not_helpful_count';
    
    const updateQuery = `
      UPDATE polox.faq_articles 
      SET ${field} = ${field} + 1, updated_at = NOW()
      FROM polox.faq_categories fc
      WHERE faq_articles.id = $1 
        AND faq_articles.category_id = fc.id 
        AND fc.company_id = $2 
        AND faq_articles.deleted_at IS NULL
      RETURNING helpful_count, not_helpful_count
    `;

    try {
      const result = await query(updateQuery, [id, companyId]);
      
      if (result.rows.length === 0) {
        throw new NotFoundError('Artigo não encontrado');
      }

      const counts = result.rows[0];
      const total = counts.helpful_count + counts.not_helpful_count;
      const helpfulness_ratio = total > 0 ? (counts.helpful_count / total) : 0;

      return {
        helpful_count: parseInt(counts.helpful_count),
        not_helpful_count: parseInt(counts.not_helpful_count),
        total_feedback: total,
        helpfulness_ratio: parseFloat(helpfulness_ratio.toFixed(2))
      };
    } catch (error) {
      throw new ApiError(500, `Erro ao registrar feedback: ${error.message}`);
    }
  }

  /**
   * Atualiza um artigo
   * @param {number} id - ID do artigo
   * @param {Object} updateData - Dados para atualização
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object>} Artigo atualizado
   */
  static async update(id, updateData, companyId) {
    // Verificar se artigo existe
    const existing = await this.findById(id, companyId);
    if (!existing) {
      throw new NotFoundError('Artigo não encontrado');
    }

    const {
      category_id,
      title,
      content,
      slug,
      summary,
      keywords,
      attachments,
      sort_order,
      is_published,
      is_featured
    } = updateData;

    const updateFields = [];
    const params = [];
    let paramCount = 1;

    if (category_id !== undefined) {
      updateFields.push(`category_id = $${paramCount++}`);
      params.push(category_id);
    }

    if (title !== undefined) {
      updateFields.push(`title = $${paramCount++}`);
      params.push(title);
    }

    if (content !== undefined) {
      updateFields.push(`content = $${paramCount++}`);
      params.push(content);
    }

    if (slug !== undefined) {
      updateFields.push(`slug = $${paramCount++}`);
      params.push(slug);
    }

    if (summary !== undefined) {
      updateFields.push(`summary = $${paramCount++}`);
      params.push(summary);
    }

    if (keywords !== undefined) {
      updateFields.push(`keywords = $${paramCount++}`);
      params.push(JSON.stringify(keywords));
    }

    if (attachments !== undefined) {
      updateFields.push(`attachments = $${paramCount++}`);
      params.push(JSON.stringify(attachments));
    }

    if (sort_order !== undefined) {
      updateFields.push(`sort_order = $${paramCount++}`);
      params.push(sort_order);
    }

    if (is_published !== undefined) {
      updateFields.push(`is_published = $${paramCount++}`);
      params.push(is_published);
    }

    if (is_featured !== undefined) {
      updateFields.push(`is_featured = $${paramCount++}`);
      params.push(is_featured);
    }

    if (updateFields.length === 0) {
      throw new ValidationError('Nenhum campo para atualizar');
    }

    updateFields.push(`updated_at = NOW()`);
    params.push(id);

    const updateQuery = `
      UPDATE polox.faq_articles 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramCount++} AND deleted_at IS NULL
      RETURNING 
        id, category_id, title, content, slug, author_id, summary,
        keywords, attachments, sort_order, is_published, is_featured,
        view_count, helpful_count, not_helpful_count,
        created_at, updated_at
    `;

    try {
      const result = await query(updateQuery, params);
      
      if (result.rows.length === 0) {
        throw new NotFoundError('Artigo não encontrado');
      }

      const article = result.rows[0];
      
      // Parse JSON fields
      article.keywords = typeof article.keywords === 'string' 
        ? JSON.parse(article.keywords) 
        : article.keywords;
      article.attachments = typeof article.attachments === 'string' 
        ? JSON.parse(article.attachments) 
        : article.attachments;

      return article;
    } catch (error) {
      if (error.code === '23505' && error.constraint?.includes('slug')) {
        throw new ValidationError('Já existe um artigo com este slug');
      }
      throw new ApiError(500, `Erro ao atualizar artigo: ${error.message}`);
    }
  }

  /**
   * Remove um artigo (soft delete)
   * @param {number} id - ID do artigo
   * @param {number} companyId - ID da empresa
   * @returns {Promise<boolean>} True se removido com sucesso
   */
  static async delete(id, companyId) {
    // Verificar se artigo existe
    const existing = await this.findById(id, companyId);
    if (!existing) {
      throw new NotFoundError('Artigo não encontrado');
    }

    const deleteQuery = `
      UPDATE polox.faq_articles 
      SET deleted_at = NOW()
      WHERE id = $1 AND deleted_at IS NULL
    `;

    try {
      const result = await query(deleteQuery, [id]);
      return result.rowCount > 0;
    } catch (error) {
      throw new ApiError(500, `Erro ao remover artigo: ${error.message}`);
    }
  }

  /**
   * Estatísticas de artigos por empresa
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object>} Estatísticas
   */
  static async getStats(companyId) {
    const statsQuery = `
      SELECT 
        COUNT(*) as total_articles,
        COUNT(CASE WHEN fa.is_published THEN 1 END) as published_articles,
        COUNT(CASE WHEN fa.is_featured THEN 1 END) as featured_articles,
        COALESCE(SUM(fa.view_count), 0) as total_views,
        COALESCE(SUM(fa.helpful_count), 0) as total_helpful,
        COALESCE(SUM(fa.not_helpful_count), 0) as total_not_helpful,
        COALESCE(AVG(fa.view_count), 0) as avg_views_per_article,
        COUNT(DISTINCT fa.author_id) as unique_authors,
        COUNT(DISTINCT fa.category_id) as categories_with_articles
      FROM polox.faq_articles fa
      INNER JOIN polox.faq_categories fc ON fa.category_id = fc.id
      WHERE fc.company_id = $1 AND fa.deleted_at IS NULL
    `;

    try {
      const result = await query(statsQuery, [companyId], { companyId });
      const stats = result.rows[0];

      const totalFeedback = (parseInt(stats.total_helpful) || 0) + (parseInt(stats.total_not_helpful) || 0);

      return {
        total_articles: parseInt(stats.total_articles) || 0,
        published_articles: parseInt(stats.published_articles) || 0,
        featured_articles: parseInt(stats.featured_articles) || 0,
        total_views: parseInt(stats.total_views) || 0,
        total_helpful: parseInt(stats.total_helpful) || 0,
        total_not_helpful: parseInt(stats.total_not_helpful) || 0,
        total_feedback: totalFeedback,
        helpfulness_ratio: totalFeedback > 0 
          ? ((stats.total_helpful / totalFeedback) * 100).toFixed(2)
          : 0,
        avg_views_per_article: parseFloat(stats.avg_views_per_article) || 0,
        unique_authors: parseInt(stats.unique_authors) || 0,
        categories_with_articles: parseInt(stats.categories_with_articles) || 0
      };
    } catch (error) {
      throw new ApiError(500, `Erro ao buscar estatísticas: ${error.message}`);
    }
  }

  /**
   * Conta o total de artigos
   * @param {number} companyId - ID da empresa
   * @param {Object} filters - Filtros opcionais
   * @returns {Promise<number>} Total de artigos
   */
  static async count(companyId, filters = {}) {
    let whereClause = `
      WHERE fc.company_id = $1 AND fa.deleted_at IS NULL
    `;
    const params = [companyId];

    if (filters.category_id) {
      whereClause += ` AND fa.category_id = $${params.length + 1}`;
      params.push(filters.category_id);
    }

    if (filters.is_published !== undefined) {
      whereClause += ` AND fa.is_published = $${params.length + 1}`;
      params.push(filters.is_published);
    }

    if (filters.is_featured !== undefined) {
      whereClause += ` AND fa.is_featured = $${params.length + 1}`;
      params.push(filters.is_featured);
    }

    if (filters.author_id) {
      whereClause += ` AND fa.author_id = $${params.length + 1}`;
      params.push(filters.author_id);
    }

    const countQuery = `
      SELECT COUNT(*) as total
      FROM polox.faq_articles fa
      INNER JOIN polox.faq_categories fc ON fa.category_id = fc.id
      ${whereClause}
    `;

    try {
      const result = await query(countQuery, params, { companyId });
      return parseInt(result.rows[0].total);
    } catch (error) {
      throw new ApiError(500, `Erro ao contar artigos: ${error.message}`);
    }
  }
}

module.exports = FaqArticleModel;