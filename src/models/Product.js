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
 * Model para gerenciamento de produtos
 * Baseado no schema polox.products
 */
class ProductModel {
  /**
   * Cria um novo produto
   * @param {Object} productData - Dados do produto
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object>} Produto criado
   */
  static async create(productData, companyId) {
    const {
      category_id,
      supplier_id,
      name,
      description,
      code,
      barcode,
      type = 'product',
      status = 'active',
      cost_price = 0,
      sale_price,
      markup_percentage = 0,
      stock_quantity = 0,
      min_stock_level = 0,
      max_stock_level,
      stock_unit = 'unit',
      weight,
      length,
      width,
      height,
      slug,
      meta_title,
      meta_description,
      tags = [], // Array de nomes de tags para criar associações
      featured_image_url,
      gallery_images = [],
      is_featured = false,
      is_digital = false,
      requires_shipping = true
    } = productData;

    // Validar dados obrigatórios
    if (!name) {
      throw new ValidationError('Nome é obrigatório');
    }

    if (!sale_price || sale_price <= 0) {
      throw new ValidationError('Preço de venda deve ser maior que zero');
    }

    return await transaction(async (client) => {
      // Inserir produto
      const insertQuery = `
        INSERT INTO polox.products (
          company_id, category_id, supplier_id, product_name, description, code, barcode,
          product_type, status, cost_price, sale_price, markup_percentage,
          stock_quantity, min_stock_level, max_stock_level, stock_unit,
          weight, length, width, height, slug, meta_title, meta_description,
          featured_image_url, gallery_images,
          is_featured, is_digital, requires_shipping,
          created_at, updated_at
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          $8, $9, $10, $11, $12,
          $13, $14, $15, $16,
          $17, $18, $19, $20, $21, $22, $23,
          $24, $25,
          $26, $27, $28,
          NOW(), NOW()
        )
        RETURNING id
      `;

      const result = await client.query(insertQuery, [
        companyId, category_id, supplier_id, name, description, code, barcode,
        type, status, cost_price, sale_price, markup_percentage,
        stock_quantity, min_stock_level, max_stock_level, stock_unit,
        weight, length, width, height, slug, meta_title, meta_description,
        featured_image_url, JSON.stringify(gallery_images),
        is_featured, is_digital, requires_shipping
      ]);

      const productId = result.rows[0].id;

      // Processar tags se fornecidas
      if (tags && tags.length > 0) {
        for (const tagName of tags) {
          if (tagName && tagName.trim() !== '') {
            // Inserir tag se não existir (específica da empresa)
            const tagResult = await client.query(`
              INSERT INTO polox.tags (tag_name, slug, company_id, created_at, updated_at)
              VALUES ($1, $2, $3, NOW(), NOW())
              ON CONFLICT (company_id, tag_name, slug) 
              WHERE company_id IS NOT NULL 
              DO UPDATE SET tag_name = EXCLUDED.tag_name
              RETURNING id
            `, [
              tagName.trim(),
              tagName.trim().toLowerCase().replace(/\s+/g, '-'),
              companyId
            ]);

            const tagId = tagResult.rows[0].id;

            // Associar tag ao produto
            await client.query(`
              INSERT INTO polox.product_tags (product_id, tag_id, created_at)
              VALUES ($1, $2, NOW())
              ON CONFLICT (product_id, tag_id) DO NOTHING
            `, [productId, tagId]);
          }
        }
      }

      // Retornar produto completo com tags
      return await this.findById(productId, companyId);
    }, { companyId });
  }

  /**
   * Busca produto por ID
   * @param {number} id - ID do produto
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object|null>} Produto encontrado ou null
   */
  static async findById(id, companyId) {
    const selectQuery = `
      SELECT 
        p.*,
        pc.category_name as category_name,
        s.supplier_name as supplier_name,
        s.company_name as supplier_company_name,
        (
          SELECT json_agg(json_build_object('id', t.id, 'tag_name', t.tag_name, 'slug', t.slug, 'color', t.color))
          FROM polox.tags t
          INNER JOIN polox.product_tags pt ON t.id = pt.tag_id
          WHERE pt.product_id = p.id
        ) as tags
      FROM polox.products p
      LEFT JOIN polox.product_categories pc ON p.category_id = pc.id
      LEFT JOIN polox.suppliers s ON p.supplier_id = s.id
      WHERE p.id = $1 AND p.company_id = $2 AND p.deleted_at IS NULL
    `;

    try {
      const result = await query(selectQuery, [id, companyId], { companyId });
      const product = result.rows[0] || null;
      
      if (product && !product.tags) {
        product.tags = [];
      }
      
      return product;
    } catch (error) {
      throw new ApiError(500, `Erro ao buscar produto: ${error.message}`);
    }
  }

  /**
   * Busca produto por código
   * @param {string} code - Código do produto
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object|null>} Produto encontrado ou null
   */
  static async findByCode(code, companyId) {
    const selectQuery = `
      SELECT * FROM polox.products 
      WHERE code = $1 AND company_id = $2 AND deleted_at IS NULL
    `;

    try {
      const result = await query(selectQuery, [code, companyId], { companyId });
      return result.rows[0] || null;
    } catch (error) {
      throw new ApiError(500, `Erro ao buscar produto por código: ${error.message}`);
    }
  }

  /**
   * Lista produtos com filtros e paginação
   * @param {Object} options - Opções de busca
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object>} Lista de produtos e metadados
   */
  static async list(options = {}, companyId) {
    const {
      page = 1,
      limit = 10,
      category_id = null,
      supplier_id = null,
      status = null,
      type = null,
      is_featured = null,
      low_stock = false,
      search = null,
      sortBy = 'created_at',
      sortOrder = 'DESC'
    } = options;

    const offset = (page - 1) * limit;
    const conditions = ['p.company_id = $1', 'p.deleted_at IS NULL'];
    const values = [companyId];
    let paramCount = 2;

    // Adicionar filtros
    if (category_id) {
      conditions.push(`p.category_id = $${paramCount}`);
      values.push(category_id);
      paramCount++;
    }

    if (supplier_id) {
      conditions.push(`p.supplier_id = $${paramCount}`);
      values.push(supplier_id);
      paramCount++;
    }

    if (status) {
      conditions.push(`p.status = $${paramCount}`);
      values.push(status);
      paramCount++;
    }

    if (type) {
      conditions.push(`p.product_type = $${paramCount}`);
      values.push(type);
      paramCount++;
    }

    if (is_featured !== null) {
      conditions.push(`p.is_featured = $${paramCount}`);
      values.push(is_featured);
      paramCount++;
    }

    if (low_stock) {
      conditions.push(`p.stock_quantity <= p.min_stock_level`);
    }

    if (search) {
      conditions.push(`(p.product_name ILIKE $${paramCount} OR p.description ILIKE $${paramCount} OR p.code ILIKE $${paramCount} OR p.barcode ILIKE $${paramCount})`);
      values.push(`%${search}%`);
      paramCount++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Query para contar total
    const countQuery = `
      SELECT COUNT(*) 
      FROM polox.products p 
      ${whereClause}
    `;

    // Query para buscar dados
    const selectQuery = `
      SELECT 
        p.id, p.product_name, p.description, p.code, p.barcode, p.product_type, p.status,
        p.cost_price, p.sale_price, p.markup_percentage, p.stock_quantity,
        p.min_stock_level, p.max_stock_level, p.stock_unit, p.featured_image_url,
        p.is_featured, p.is_digital, p.requires_shipping, p.created_at, p.updated_at,
        pc.category_name,
        s.supplier_name,
        (
          SELECT json_agg(t.tag_name)
          FROM polox.tags t
          INNER JOIN polox.product_tags pt ON t.id = pt.tag_id
          WHERE pt.product_id = p.id
        ) as tags,
        CASE 
          WHEN p.stock_quantity <= p.min_stock_level THEN true 
          ELSE false 
        END as is_low_stock
      FROM polox.products p
      LEFT JOIN polox.product_categories pc ON p.category_id = pc.id
      LEFT JOIN polox.suppliers s ON p.supplier_id = s.id
      ${whereClause}
      ORDER BY p.${sortBy} ${sortOrder}
      LIMIT $${paramCount} OFFSET $${paramCount + 1}
    `;

    try {
      const [countResult, dataResult] = await Promise.all([
        query(countQuery, values, { companyId }),
        query(selectQuery, [...values, limit, offset], { companyId })
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
          hasPrev: page > 1
        }
      };
    } catch (error) {
      throw new ApiError(500, `Erro ao listar produtos: ${error.message}`);
    }
  }

  /**
   * Atualiza dados do produto
   * @param {number} id - ID do produto
   * @param {Object} updateData - Dados para atualizar
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object|null>} Produto atualizado ou null
   */
  static async update(id, updateData, companyId) {
    const allowedFields = [
      'category_id', 'supplier_id', 'product_name', 'description', 'code', 'barcode',
      'product_type', 'status', 'cost_price', 'sale_price', 'markup_percentage',
      'min_stock_level', 'max_stock_level', 'stock_unit', 'weight', 'length',
      'width', 'height', 'slug', 'meta_title', 'meta_description',
      'featured_image_url', 'gallery_images', 'is_featured', 'is_digital',
      'requires_shipping'
    ];

    const updates = [];
    const values = [];
    let paramCount = 1;

    // Map input field names to database column names
    const fieldMapping = {
      'name': 'product_name',
      'type': 'product_type'
    };

    // Construir query dinamicamente
    for (const [key, value] of Object.entries(updateData)) {
      const dbField = fieldMapping[key] || key;
      
      if (allowedFields.includes(dbField)) {
        if (dbField === 'gallery_images') {
          updates.push(`${dbField} = $${paramCount}`);
          values.push(JSON.stringify(value));
        } else {
          updates.push(`${dbField} = $${paramCount}`);
          values.push(value);
        }
        paramCount++;
      }
    }

    if (updates.length === 0) {
      throw new ValidationError('Nenhum campo válido para atualizar');
    }

    updates.push('updated_at = NOW()');
    values.push(id, companyId);

    const updateQuery = `
      UPDATE polox.products 
      SET ${updates.join(', ')}
      WHERE id = $${paramCount} AND company_id = $${paramCount + 1} AND deleted_at IS NULL
      RETURNING 
        id, product_name, description, code, sale_price, stock_quantity, status,
        created_at, updated_at
    `;

    try {
      const result = await query(updateQuery, values, { companyId });
      return result.rows[0] || null;
    } catch (error) {
      if (error.code === '23505') {
        if (error.constraint?.includes('code')) {
          throw new ValidationError('Código do produto já existe');
        }
      }
      throw new ApiError(500, `Erro ao atualizar produto: ${error.message}`);
    }
  }

  /**
   * Atualiza estoque do produto
   * @param {number} id - ID do produto
   * @param {number} quantity - Nova quantidade
   * @param {string} operation - Operação: 'set', 'add', 'subtract'
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object|null>} Produto atualizado
   */
  static async updateStock(id, quantity, operation = 'set', companyId) {
    let updateExpression;
    
    switch (operation) {
      case 'add':
        updateExpression = 'stock_quantity = stock_quantity + $1';
        break;
      case 'subtract':
        updateExpression = 'stock_quantity = GREATEST(0, stock_quantity - $1)';
        break;
      case 'set':
      default:
        updateExpression = 'stock_quantity = $1';
        break;
    }

    const updateQuery = `
      UPDATE polox.products 
      SET ${updateExpression}, updated_at = NOW()
      WHERE id = $2 AND company_id = $3 AND deleted_at IS NULL
      RETURNING id, product_name, stock_quantity, min_stock_level, max_stock_level
    `;

    try {
      const result = await query(updateQuery, [quantity, id, companyId], { companyId });
      return result.rows[0] || null;
    } catch (error) {
      throw new ApiError(500, `Erro ao atualizar estoque: ${error.message}`);
    }
  }

  /**
   * Obtém produtos com estoque baixo
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Array>} Lista de produtos com estoque baixo
   */
  static async getLowStockProducts(companyId) {
    const selectQuery = `
      SELECT 
        id, product_name, code, stock_quantity, min_stock_level, 
        sale_price, featured_image_url
      FROM polox.products 
      WHERE company_id = $1 
        AND deleted_at IS NULL 
        AND status = 'active'
        AND stock_quantity <= min_stock_level
        AND min_stock_level > 0
      ORDER BY (stock_quantity::float / NULLIF(min_stock_level, 0)) ASC
    `;

    try {
      const result = await query(selectQuery, [companyId], { companyId });
      return result.rows;
    } catch (error) {
      throw new ApiError(500, `Erro ao buscar produtos com estoque baixo: ${error.message}`);
    }
  }

  /**
   * Obtém produtos mais vendidos
   * @param {number} companyId - ID da empresa
   * @param {Object} filters - Filtros de período
   * @param {number} limit - Quantidade de produtos
   * @returns {Promise<Array>} Lista de produtos mais vendidos
   */
  static async getTopSellingProducts(companyId, filters = {}, limit = 10) {
    const { date_from, date_to } = filters;
    const conditions = ['s.company_id = $1', 's.deleted_at IS NULL', 's.status = \'confirmed\''];
    const values = [companyId];
    let paramCount = 2;

    if (date_from) {
      conditions.push(`s.sale_date >= $${paramCount}`);
      values.push(date_from);
      paramCount++;
    }

    if (date_to) {
      conditions.push(`s.sale_date <= $${paramCount}`);
      values.push(date_to);
      paramCount++;
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const selectQuery = `
      SELECT 
        p.id, p.product_name, p.code, p.sale_price, p.featured_image_url,
        SUM(si.quantity) as total_quantity_sold,
        COUNT(si.id) as total_sales,
        SUM(si.total_price) as total_revenue
      FROM polox.products p
      INNER JOIN polox.sale_items si ON p.id = si.product_id
      INNER JOIN polox.sales s ON si.sale_id = s.id
      ${whereClause}
      GROUP BY p.id, p.product_name, p.code, p.sale_price, p.featured_image_url
      ORDER BY total_quantity_sold DESC
      LIMIT $${paramCount}
    `;

    try {
      const result = await query(selectQuery, [...values, limit], { companyId });
      return result.rows;
    } catch (error) {
      throw new ApiError(500, `Erro ao buscar produtos mais vendidos: ${error.message}`);
    }
  }

  /**
   * Soft delete do produto
   * @param {number} id - ID do produto
   * @param {number} companyId - ID da empresa
   * @returns {Promise<boolean>} True se deletado com sucesso
   */
  static async softDelete(id, companyId) {
    const updateQuery = `
      UPDATE polox.products 
      SET 
        status = 'inactive',
        deleted_at = NOW(),
        updated_at = NOW()
      WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL
    `;

    try {
      const result = await query(updateQuery, [id, companyId], { companyId });
      return result.rowCount > 0;
    } catch (error) {
      throw new ApiError(500, `Erro ao deletar produto: ${error.message}`);
    }
  }

  /**
   * Obtém estatísticas de produtos da empresa
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object>} Estatísticas dos produtos
   */
  static async getStats(companyId) {
    const statsQuery = `
      SELECT 
        COUNT(*) as total_products,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_products,
        COUNT(CASE WHEN status = 'inactive' THEN 1 END) as inactive_products,
        COUNT(CASE WHEN product_type = 'product' THEN 1 END) as physical_products,
        COUNT(CASE WHEN product_type = 'service' THEN 1 END) as services,
        COUNT(CASE WHEN is_featured = true THEN 1 END) as featured_products,
        COUNT(CASE WHEN stock_quantity <= min_stock_level AND min_stock_level > 0 THEN 1 END) as low_stock_products,
        COUNT(CASE WHEN stock_quantity = 0 THEN 1 END) as out_of_stock_products,
        COALESCE(SUM(stock_quantity * cost_price), 0) as total_inventory_value,
        COALESCE(AVG(sale_price), 0) as average_sale_price,
        COALESCE(AVG(markup_percentage), 0) as average_markup
      FROM polox.products 
      WHERE company_id = $1 AND deleted_at IS NULL
    `;

    try {
      const result = await query(statsQuery, [companyId], { companyId });
      return result.rows[0];
    } catch (error) {
      throw new ApiError(500, `Erro ao obter estatísticas: ${error.message}`);
    }
  }

  /**
   * Busca produtos por categoria
   * @param {number} categoryId - ID da categoria
   * @param {number} companyId - ID da empresa
   * @param {Object} options - Opções de paginação
   * @returns {Promise<Object>} Lista de produtos da categoria
   */
  static async findByCategory(categoryId, companyId, options = {}) {
    const { page = 1, limit = 10 } = options;
    const offset = (page - 1) * limit;

    const selectQuery = `
      SELECT 
        id, product_name, description, code, sale_price, stock_quantity,
        featured_image_url, is_featured, status, created_at
      FROM polox.products 
      WHERE category_id = $1 AND company_id = $2 AND deleted_at IS NULL AND status = 'active'
      ORDER BY is_featured DESC, product_name ASC
      LIMIT $3 OFFSET $4
    `;

    const countQuery = `
      SELECT COUNT(*) 
      FROM polox.products 
      WHERE category_id = $1 AND company_id = $2 AND deleted_at IS NULL AND status = 'active'
    `;

    try {
      const [dataResult, countResult] = await Promise.all([
        query(selectQuery, [categoryId, companyId, limit, offset], { companyId }),
        query(countQuery, [categoryId, companyId], { companyId })
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
          hasPrev: page > 1
        }
      };
    } catch (error) {
      throw new ApiError(500, `Erro ao buscar produtos por categoria: ${error.message}`);
    }
  }

  /**
   * Adiciona uma tag ao produto
   * @param {number} productId - ID do produto
   * @param {string} tagName - Nome da tag
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object>} Tag associada
   */
  static async addTag(productId, tagName, companyId) {
    if (!tagName || tagName.trim() === '') {
      throw new ValidationError('Nome da tag é obrigatório');
    }

    return await transaction(async (client) => {
      // Verificar se produto existe
      const productCheck = await client.query(
        'SELECT id FROM polox.products WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL',
        [productId, companyId]
      );

      if (productCheck.rows.length === 0) {
        throw new NotFoundError('Produto não encontrado');
      }

      // Inserir tag se não existir (específica da empresa)
      const tagResult = await client.query(`
        INSERT INTO polox.tags (tag_name, slug, company_id)
        VALUES ($1, $2, $3)
        ON CONFLICT (company_id, tag_name, slug) 
        WHERE company_id IS NOT NULL 
        DO UPDATE SET tag_name = EXCLUDED.tag_name
        RETURNING id, tag_name, slug, color
      `, [tagName.trim(), tagName.trim().toLowerCase().replace(/\s+/g, '-'), companyId]);

      const tag = tagResult.rows[0];

      // Associar tag ao produto
      await client.query(`
        INSERT INTO polox.product_tags (product_id, tag_id)
        VALUES ($1, $2)
        ON CONFLICT DO NOTHING
      `, [productId, tag.id]);

      return tag;
    }, { companyId });
  }

  /**
   * Busca todas as tags de um produto
   * @param {number} productId - ID do produto
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Array>} Lista de tags
   */
  static async getTags(productId, companyId) {
    const selectQuery = `
      SELECT t.id, t.tag_name, t.slug, t.color, t.description
      FROM polox.tags t
      INNER JOIN polox.product_tags pt ON t.id = pt.tag_id
      WHERE pt.product_id = $1
      ORDER BY t.tag_name
    `;

    try {
      const result = await query(selectQuery, [productId], { companyId });
      return result.rows;
    } catch (error) {
      throw new ApiError(500, `Erro ao buscar tags: ${error.message}`);
    }
  }

  /**
   * Remove uma tag do produto
   * @param {number} productId - ID do produto
   * @param {number} tagId - ID da tag
   * @param {number} companyId - ID da empresa
   * @returns {Promise<boolean>} True se removido com sucesso
   */
  static async removeTag(productId, tagId, companyId) {
    const deleteQuery = `
      DELETE FROM polox.product_tags
      WHERE product_id = $1 AND tag_id = $2
    `;

    try {
      const result = await query(deleteQuery, [productId, tagId], { companyId });
      return result.rowCount > 0;
    } catch (error) {
      throw new ApiError(500, `Erro ao remover tag: ${error.message}`);
    }
  }

  /**
   * Atualiza todas as tags de um produto
   * @param {number} productId - ID do produto
   * @param {Array<string>} tagNames - Array com nomes das tags
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Array>} Lista de tags atualizadas
   */
  static async updateTags(productId, tagNames, companyId) {
    return await transaction(async (client) => {
      // Verificar se produto existe
      const productCheck = await client.query(
        'SELECT id FROM polox.products WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL',
        [productId, companyId]
      );

      if (productCheck.rows.length === 0) {
        throw new NotFoundError('Produto não encontrado');
      }

      // Remover todas as tags antigas
      await client.query(`
        DELETE FROM polox.product_tags WHERE product_id = $1
      `, [productId]);

      // Adicionar novas tags
      if (tagNames && tagNames.length > 0) {
        for (const tagName of tagNames) {
          if (tagName && tagName.trim() !== '') {
            // Inserir tag se não existir
            const tagResult = await client.query(`
              INSERT INTO polox.tags (tag_name, slug, company_id)
              VALUES ($1, $2, $3)
              ON CONFLICT (company_id, tag_name, slug) 
              WHERE company_id IS NOT NULL 
              DO UPDATE SET tag_name = EXCLUDED.tag_name
              RETURNING id
            `, [tagName.trim(), tagName.trim().toLowerCase().replace(/\s+/g, '-'), companyId]);

            const tagId = tagResult.rows[0].id;

            // Associar tag ao produto
            await client.query(`
              INSERT INTO polox.product_tags (product_id, tag_id)
              VALUES ($1, $2)
              ON CONFLICT DO NOTHING
            `, [productId, tagId]);
          }
        }
      }

      // Retornar tags atualizadas
      const result = await client.query(`
        SELECT t.id, t.tag_name, t.slug, t.color
        FROM polox.tags t
        INNER JOIN polox.product_tags pt ON t.id = pt.tag_id
        WHERE pt.product_id = $1
        ORDER BY t.tag_name
      `, [productId]);

      return result.rows;
    }, { companyId });
  }
}

module.exports = ProductModel;