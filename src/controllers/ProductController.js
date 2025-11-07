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

const { query, beginTransaction, commitTransaction, rollbackTransaction } = require('../config/database');
const { ApiError, asyncHandler } = require('../utils/errors');
const { successResponse, paginatedResponse } = require('../utils/formatters');
const { tc } = require('../config/i18n');
const Joi = require('joi');
const { v4: uuidv4 } = require('uuid');

class ProductController {

  // Schemas de validação
  static createProductSchema = Joi.object({
    id: Joi.any().strip(), // Ignora o campo id se enviado (será gerado pelo banco)
    name: Joi.string().min(2).max(255).required()
      .messages({
        'any.required': 'Nome do produto é obrigatório',
        'string.min': 'Nome deve ter pelo menos 2 caracteres',
        'string.max': 'Nome não pode exceder 255 caracteres'
      }),
    description: Joi.string().max(1000).allow('').default(''),
    sku: Joi.string().max(100).allow(''),
    category_id: Joi.number().integer().positive(),
    category_name: Joi.string().max(100),
    type: Joi.string().valid('product', 'service').default('product')
      .messages({
        'any.only': 'Tipo deve ser "product" ou "service"'
      }),
    price: Joi.number().min(0).required()
      .messages({
        'any.required': 'Preço é obrigatório',
        'number.min': 'Preço deve ser maior ou igual a zero'
      }),
    cost_price: Joi.number().min(0).default(0),
    track_stock: Joi.boolean().default(true),
    current_stock: Joi.number().integer().min(0).default(0),
    min_stock: Joi.number().integer().min(0).default(0),
    max_stock: Joi.number().integer().min(0).default(null),
    unit: Joi.string().max(50).default('un'),
    weight: Joi.number().min(0).default(null),
    dimensions: Joi.object({
      length: Joi.number().min(0),
      width: Joi.number().min(0),
      height: Joi.number().min(0)
    }).default({}),
    is_active: Joi.boolean().default(true),
    tags: Joi.array().items(Joi.string()).default([]),
    custom_fields: Joi.object().default({})
  });

  static updateProductSchema = Joi.object({
    name: Joi.string().min(2).max(255),
    description: Joi.string().max(1000).allow(''),
    sku: Joi.string().max(100).allow(''),
    category_id: Joi.number().integer().positive(),
    category_name: Joi.string().max(100),
    type: Joi.string().valid('product', 'service'),
    price: Joi.number().min(0),
    cost_price: Joi.number().min(0),
    track_stock: Joi.boolean(),
    current_stock: Joi.number().integer().min(0),
    min_stock: Joi.number().integer().min(0),
    max_stock: Joi.number().integer().min(0),
    unit: Joi.string().max(50),
    weight: Joi.number().min(0),
    dimensions: Joi.object({
      length: Joi.number().min(0),
      width: Joi.number().min(0),
      height: Joi.number().min(0)
    }),
    is_active: Joi.boolean(),
    tags: Joi.array().items(Joi.string()),
    custom_fields: Joi.object()
  });

  static stockAdjustmentSchema = Joi.object({
    type: Joi.string().valid('in', 'out', 'set').required()
      .messages({
        'any.required': 'Tipo de ajuste é obrigatório',
        'any.only': 'Tipo deve ser "in", "out" ou "set"'
      }),
    quantity: Joi.number().integer().required()
      .messages({
        'any.required': 'Quantidade é obrigatória'
      }),
    reason: Joi.string().max(255).required()
      .messages({
        'any.required': 'Motivo é obrigatório'
      }),
    cost_price: Joi.number().min(0),
    notes: Joi.string().max(500).allow('')
  });

  static createCategorySchema = Joi.object({
    name: Joi.string().min(2).max(100).required()
      .messages({
        'any.required': 'Nome da categoria é obrigatório'
      }),
    description: Joi.string().max(255).allow('').default(''),
    parent_id: Joi.number().integer().positive(),
    is_active: Joi.boolean().default(true)
  });

  // Listar produtos
  static index = asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = (page - 1) * limit;
    
    let whereClause = 'WHERE p.company_id = $1 AND p.deleted_at IS NULL';
    let queryParams = [req.user.companyId];
    let paramCount = 1;

    // Filtros
    if (req.query.category_id) {
      whereClause += ` AND p.category_id = $${++paramCount}`;
      queryParams.push(parseInt(req.query.category_id));
    }

    if (req.query.type) {
      whereClause += ` AND p.product_type = $${++paramCount}`;
      queryParams.push(req.query.type);
    }

    if (req.query.is_active !== undefined) {
      const statusValue = req.query.is_active === 'true' ? 'active' : 'inactive';
      whereClause += ` AND p.status = $${++paramCount}`;
      queryParams.push(statusValue);
    }

    if (req.query.low_stock === 'true') {
      whereClause += ` AND p.stock_quantity <= p.min_stock_level AND p.min_stock_level > 0`;
    }

    if (req.query.search) {
      whereClause += ` AND (p.product_name ILIKE $${++paramCount} OR p.sku ILIKE $${++paramCount} OR p.description ILIKE $${++paramCount})`;
      const searchTerm = `%${req.query.search}%`;
      queryParams.push(searchTerm, searchTerm, searchTerm);
      paramCount += 2;
    }

    // Ordenação
    const validSortFields = ['product_name', 'sale_price', 'stock_quantity', 'created_at'];
    const sortField = validSortFields.includes(req.query.sort) ? req.query.sort : 'product_name';
    const sortOrder = req.query.order === 'desc' ? 'DESC' : 'ASC';

    // Query principal
    const productsQuery = `
      SELECT 
        p.*,
        pc.category_name as category_name,
        COALESCE(sales_stats.total_sales, 0) as total_sales,
        COALESCE(sales_stats.total_sold, 0) as total_sold,
        COALESCE(sales_stats.total_revenue, 0) as total_revenue
      FROM polox.products p
      LEFT JOIN polox.product_categories pc ON p.category_id = pc.id AND pc.company_id = p.company_id
      LEFT JOIN (
        SELECT 
          si.product_id,
          COUNT(DISTINCT s.id) as total_sales,
          SUM(si.quantity) as total_sold,
          SUM(si.total_price) as total_revenue
        FROM polox.sale_items si
        INNER JOIN polox.sales s ON si.sale_id = s.id
        WHERE s.company_id = $1 AND s.deleted_at IS NULL AND s.status != 'cancelled'
        GROUP BY si.product_id
      ) sales_stats ON p.id = sales_stats.product_id
      ${whereClause}
      ORDER BY p.${sortField} ${sortOrder}
      LIMIT $${++paramCount} OFFSET $${++paramCount}
    `;
    
    queryParams.push(limit, offset);

    // Query de contagem
    const countQuery = `SELECT COUNT(*) as total FROM polox.products p ${whereClause}`;

    // Query de estatísticas
    const statsQuery = `
      SELECT 
        COUNT(*) as total_products,
        COUNT(CASE WHEN product_type = 'product' THEN 1 END) as physical_products,
        COUNT(CASE WHEN product_type = 'service' THEN 1 END) as services,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_products,
        COUNT(CASE WHEN stock_quantity <= min_stock_level AND min_stock_level > 0 THEN 1 END) as low_stock_products,
        COALESCE(AVG(sale_price), 0) as average_price,
        COALESCE(SUM(stock_quantity * cost_price), 0) as inventory_value
      FROM polox.products p
      WHERE p.company_id = $1 AND p.deleted_at IS NULL
    `;

    const [productsResult, countResult, statsResult] = await Promise.all([
      query(productsQuery, queryParams),
      query(countQuery, queryParams.slice(0, -2)),
      query(statsQuery, [req.user.companyId])
    ]);

    return res.status(200).json({
      success: true,
      data: productsResult.rows,
      pagination: {
        page,
        limit,
        total: parseInt(countResult.rows[0].total),
        pages: Math.ceil(parseInt(countResult.rows[0].total) / limit)
      },
      stats: {
        ...statsResult.rows[0],
        average_price: parseFloat(statsResult.rows[0].average_price),
        inventory_value: parseFloat(statsResult.rows[0].inventory_value)
      }
    });
  });

  // Criar produto
  static create = asyncHandler(async (req, res) => {
    const { error, value } = ProductController.createProductSchema.validate(req.body);
    if (error) throw new ApiError(400, tc(req, 'productController', 'validation.invalid_data'));

    const productData = value;

    // Verificar se SKU já existe (se fornecido)
    if (productData.sku) {
      const skuCheck = await query(
        'SELECT id FROM polox.products WHERE code = $1 AND company_id = $2 AND deleted_at IS NULL',
        [productData.sku, req.user.companyId]
      );

      if (skuCheck.rows.length > 0) {
        throw new ApiError(400, tc(req, 'productController', 'validation.sku_exists'));
      }
    }

    const client = await beginTransaction();
    
    try {
      // Verificar/criar categoria se fornecida
      let categoryId = productData.category_id;
      
      if (productData.category_name && !categoryId) {
        // Tentar encontrar categoria existente
        const existingCategory = await client.query(
          'SELECT id FROM polox.product_categories WHERE category_name = $1 AND company_id = $2 AND deleted_at IS NULL',
          [productData.category_name, req.user.companyId]
        );

        if (existingCategory.rows.length > 0) {
          categoryId = existingCategory.rows[0].id;
        } else {
          // Criar nova categoria
          const newCategoryResult = await client.query(
            'INSERT INTO polox.product_categories (company_id, category_name, created_at, updated_at) VALUES ($1, $2, NOW(), NOW()) RETURNING id',
            [req.user.companyId, productData.category_name]
          );
          categoryId = newCategoryResult.rows[0].id;
        }
      }

      // Criar produto
      const createProductQuery = `
        INSERT INTO polox.products (
          company_id, product_name, description, code, category_id, product_type,
          sale_price, cost_price, stock_quantity, min_stock_level,
          max_stock_level, stock_unit, weight, slug,
          status, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW(), NOW())
        RETURNING *
      `;

      const statusValue = productData.is_active !== false ? 'active' : 'inactive';

      const newProductResult = await client.query(createProductQuery, [
        req.user.companyId,
        productData.name,
        productData.description,
        productData.sku || null,
        categoryId,
        productData.type,
        productData.price,
        productData.cost_price,
        productData.current_stock,
        productData.min_stock,
        productData.max_stock,
        productData.unit,
        productData.weight,
        productData.name.toLowerCase().replace(/\s+/g, '-'),
        statusValue
      ]);

      const newProduct = newProductResult.rows[0];

      // TODO: Registrar movimento de estoque inicial (tabela stock_movements não existe ainda)
      /*
      if (productData.current_stock > 0) {
        await client.query(`...`);
      }
      */

      // TODO: Gamificação (tabelas não existem ainda)
      /*
      await client.query(`UPDATE polox.user_gamification_profiles...`);
      await client.query(`INSERT INTO polox.gamification_history...`);
      */

      // TODO: Log de auditoria (tabela audit_logs não existe ainda)
      /*
      await client.query(`INSERT INTO polox.audit_logs...`);
      */

      await commitTransaction(client);

      return res.status(201).json({
        success: true,
        data: newProduct,
        message: tc(req, 'productController', 'create.success')
      });

    } catch (error) {
      await rollbackTransaction(client);
      throw error;
    }
  });

  // Visualizar produto específico
  static show = asyncHandler(async (req, res) => {
    const productId = req.params.id;

    const productQuery = `
      SELECT 
        p.*,
        pc.category_name as category_name,
        u.full_name as created_by_name,
        sales_stats.total_sales,
        sales_stats.total_sold,
        sales_stats.total_revenue,
        sales_stats.avg_sale_price,
        recent_movements.movements
      FROM polox.products p
      LEFT JOIN polox.product_categories pc ON p.category_id = pc.id AND pc.company_id = p.company_id
      LEFT JOIN polox.users u ON p.created_by = u.id
      LEFT JOIN (
        SELECT 
          si.product_id,
          COUNT(DISTINCT s.id) as total_sales,
          SUM(si.quantity) as total_sold,
          SUM(si.total_price) as total_revenue,
          AVG(si.unit_price) as avg_sale_price
        FROM polox.sale_items si
        INNER JOIN polox.sales s ON si.sale_id = s.id
        WHERE s.company_id = $2 AND s.deleted_at IS NULL AND s.status != 'cancelled'
        GROUP BY si.product_id
      ) sales_stats ON p.id = sales_stats.product_id
      LEFT JOIN (
        SELECT 
          sm.product_id,
          json_agg(
            json_build_object(
              'id', sm.id,
              'type', sm.type,
              'quantity', sm.quantity,
              'reason', sm.reason,
              'stock_after', sm.stock_after,
              'created_at', sm.created_at,
              'user_name', u_mov.name
            ) ORDER BY sm.created_at DESC
          ) as movements
        FROM polox.stock_movements sm
        LEFT JOIN polox.users u_mov ON sm.user_id = u_mov.id
        WHERE sm.company_id = $2
        GROUP BY sm.product_id
      ) recent_movements ON p.id = recent_movements.product_id
      WHERE p.id = $1 AND p.company_id = $2 AND p.deleted_at IS NULL
    `;

    const productResult = await query(productQuery, [productId, req.user.companyId]);

    if (productResult.rows.length === 0) {
      throw new ApiError(404, tc(req, 'productController', 'validation.not_found'));
    }

    const product = productResult.rows[0];

    // Limitar movimentações às 10 mais recentes
    if (product.movements) {
      product.movements = product.movements.slice(0, 10);
    }

    return res.status(200).json({
      success: true,
      data: product
    });
  });

  // Atualizar produto
  static update = asyncHandler(async (req, res) => {
    const productId = req.params.id;
    const { error, value } = ProductController.updateProductSchema.validate(req.body);
    if (error) throw new ApiError(400, tc(req, 'productController', 'validation.invalid_data'));

    const updateData = value;

    // Verificar se produto existe
    const existingProduct = await query(
      'SELECT * FROM polox.products WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL',
      [productId, req.user.companyId]
    );

    if (existingProduct.rows.length === 0) {
      throw new ApiError(404, tc(req, 'productController', 'validation.not_found'));
    }

    const product = existingProduct.rows[0];

    // Verificar SKU duplicado (se alterado)
    if (updateData.sku && updateData.sku !== product.code) {
      const skuCheck = await query(
        'SELECT id FROM polox.products WHERE code = $1 AND company_id = $2 AND id != $3 AND deleted_at IS NULL',
        [updateData.sku, req.user.companyId, productId]
      );

      if (skuCheck.rows.length > 0) {
        throw new ApiError(400, tc(req, 'productController', 'validation.sku_exists'));
      }
    }

    const client = await beginTransaction();
    
    try {
      // Verificar/criar categoria se fornecida
      let categoryId = updateData.category_id || product.category_id;
      
      if (updateData.category_name && !updateData.category_id) {
        const existingCategory = await client.query(
          'SELECT id FROM polox.product_categories WHERE category_name = $1 AND company_id = $2 AND deleted_at IS NULL',
          [updateData.category_name, req.user.companyId]
        );

        if (existingCategory.rows.length > 0) {
          categoryId = existingCategory.rows[0].id;
        } else {
          // Criar nova categoria
          const newCategoryResult = await client.query(
            'INSERT INTO polox.product_categories (company_id, category_name, created_at, updated_at) VALUES ($1, $2, NOW(), NOW()) RETURNING id',
            [req.user.companyId, updateData.category_name]
          );
          categoryId = newCategoryResult.rows[0].id;
        }
      }

      // Preparar dados para atualização
      const fieldsToUpdate = [];
      const values = [];
      let paramCount = 0;

      const updateableFields = {
        product_name: updateData.name,
        description: updateData.description,
        code: updateData.sku,
        category_id: categoryId,
        product_type: updateData.type,
        sale_price: updateData.price,
        cost_price: updateData.cost_price,
        min_stock_level: updateData.min_stock,
        max_stock_level: updateData.max_stock,
        stock_unit: updateData.unit,
        weight: updateData.weight,
        status: updateData.is_active !== undefined ? (updateData.is_active ? 'active' : 'inactive') : undefined
      };

      Object.entries(updateableFields).forEach(([field, value]) => {
        if (value !== undefined) {
          fieldsToUpdate.push(`${field} = $${++paramCount}`);
          values.push(value);
        }
      });

      if (fieldsToUpdate.length === 0) {
        throw new ApiError(400, tc(req, 'productController', 'validation.no_fields_to_update'));
      }

      // Adicionar campos de controle
      fieldsToUpdate.push(`updated_at = NOW()`);

      values.push(productId, req.user.companyId);

      const updateQuery = `
        UPDATE polox.products 
        SET ${fieldsToUpdate.join(', ')}
        WHERE id = $${++paramCount} AND company_id = $${++paramCount} AND deleted_at IS NULL
        RETURNING *
      `;

      const updatedProductResult = await client.query(updateQuery, values);
      const updatedProduct = updatedProductResult.rows[0];

        await client.query(`
        INSERT INTO polox.audit_logs (id, user_id, company_id, action, entity_type, entity_id, description, ip_address)
        VALUES ($1, $2, $3, 'update', 'product', $4, $5, $6)
      `, [
        uuidv4(),
        req.user.id,
        req.user.companyId,
        updatedProduct.id,
        `Produto atualizado: ${updatedProduct.product_name}`,
        req.ip
      ]);

      await commitTransaction(client);

      return res.status(200).json({
        success: true,
        data: updatedProduct,
        message: tc(req, 'productController', 'update.success')
      });

    } catch (error) {
      await rollbackTransaction(client);
      throw error;
    }
  });

  // Deletar produto (soft delete)
  static destroy = asyncHandler(async (req, res) => {
    const productId = req.params.id;

    // Verificar se produto existe
    const existingProduct = await query(
      'SELECT * FROM polox.products WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL',
      [productId, req.user.companyId]
    );

    if (existingProduct.rows.length === 0) {
      throw new ApiError(404, tc(req, 'productController', 'validation.not_found'));
    }

    const product = existingProduct.rows[0];

    // Verificar se produto tem vendas associadas
    const salesCheck = await query(
      'SELECT COUNT(*) as count FROM polox.sale_items si INNER JOIN polox.sales s ON si.sale_id = s.id WHERE si.product_id = $1 AND s.company_id = $2 AND s.deleted_at IS NULL',
      [productId, req.user.companyId]
    );

    if (parseInt(salesCheck.rows[0].count) > 0) {
      throw new ApiError(400, tc(req, 'productController', 'validation.has_sales'));
    }

    const client = await beginTransaction();
    
    try {
      // Soft delete do produto
      await client.query(
        'UPDATE polox.products SET deleted_at = NOW() WHERE id = $1 AND company_id = $2',
        [productId, req.user.companyId]
      );

      // Log de auditoria
      await client.query(`
        INSERT INTO polox.audit_logs (user_id, company_id, action, entity_type, entity_id, description, ip_address)
        VALUES ($1, $2, 'delete', 'product', $3, $4, $5)
      `, [
        req.user.id,
        req.user.companyId,
        productId,
        `Produto deletado: ${product.product_name}`,
        req.ip
      ]);

      await commitTransaction(client);

      return res.status(200).json({
        success: true,
        message: tc(req, 'productController', 'delete.success')
      });

    } catch (error) {
      await rollbackTransaction(client);
      throw error;
    }
  });

  // Ajustar estoque
  static adjustStock = asyncHandler(async (req, res) => {
    const productId = req.params.id;
    const { error, value } = ProductController.stockAdjustmentSchema.validate(req.body);
    if (error) throw new ApiError(400, tc(req, 'productController', 'validation.invalid_data'));

    const adjustmentData = value;

    // Buscar produto
    const productQuery = `
      SELECT * FROM polox.products 
      WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL
    `;
    
    const productResult = await query(productQuery, [productId, req.user.companyId]);
    
    if (productResult.rows.length === 0) {
      throw new ApiError(404, tc(req, 'productController', 'validation.not_found'));
    }

    const product = productResult.rows[0];
    let newStock;
    
    // Calcular novo estoque
    switch (adjustmentData.type) {
      case 'in':
        newStock = product.stock_quantity + adjustmentData.quantity;
        break;
      case 'out':
        newStock = product.stock_quantity - adjustmentData.quantity;
        if (newStock < 0) {
          throw new ApiError(400, tc(req, 'productController', 'validation.insufficient_stock'));
        }
        break;
      case 'set':
        newStock = adjustmentData.quantity;
        break;
      default:
        throw new ApiError(400, tc(req, 'productController', 'validation.invalid_adjustment_type'));
    }

    const client = await beginTransaction();
    
    try {
      // Atualizar estoque do produto
      await client.query(
        'UPDATE polox.products SET stock_quantity = $1, updated_at = NOW() WHERE id = $2',
        [newStock, productId]
      );

      // Registrar movimento de estoque
      await client.query(`
        INSERT INTO polox.stock_movements (
          company_id, product_id, type, quantity, reason, notes,
          stock_before, stock_after, cost_price, user_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [
        req.user.companyId,
        productId,
        adjustmentData.type,
        adjustmentData.quantity,
        adjustmentData.reason,
        adjustmentData.notes || null,
        product.stock_quantity,
        newStock,
        adjustmentData.cost_price || product.cost_price,
        req.user.id
      ]);

      await commitTransaction(client);

      // Verificar alerta de estoque baixo
      let alert = null;
      if (newStock <= product.min_stock_level && product.min_stock_level > 0) {
        alert = {
          type: 'low_stock',
          message: tc(req, 'productController', 'adjustStock.low_stock_alert', {
            productName: product.product_name,
            stock: newStock
          })
        };

        // Criar notificação de estoque baixo
        await query(`
          INSERT INTO polox.notifications (
            company_id, user_id, type, title, message, data
          ) VALUES ($1, $2, 'low_stock', 'Alerta de Estoque Baixo', $3, $4)
        `, [
          req.user.companyId,
          req.user.id,
          alert.message,
          JSON.stringify({ 
            product_id: productId, 
            product_name: product.product_name,
            current_stock: newStock, 
            min_stock: product.min_stock_level 
          })
        ]);
      }

      return res.status(200).json({
        success: true,
        data: {
          product_id: productId,
          product_name: product.product_name,
          stock_before: product.stock_quantity,
          stock_after: newStock,
          adjustment: adjustmentData,
          alert
        },
        message: tc(req, 'productController', 'adjustStock.success')
      });

    } catch (error) {
      await rollbackTransaction(client);
      throw error;
    }
  });

  // Listar produtos com estoque baixo
  static getLowStock = asyncHandler(async (req, res) => {
    const lowStockQuery = `
      SELECT 
        p.*,
        pc.category_name as category_name,
        (p.min_stock_level - p.stock_quantity) as units_needed,
        CASE 
          WHEN p.stock_quantity = 0 THEN 'out_of_stock'
          WHEN p.stock_quantity <= p.min_stock_level * 0.5 THEN 'critical'
          ELSE 'low'
        END as urgency_level
      FROM polox.products p
      LEFT JOIN polox.product_categories pc ON p.category_id = pc.id AND pc.company_id = p.company_id
      WHERE p.company_id = $1 
      AND p.deleted_at IS NULL 
      AND p.status = 'active'
      AND p.stock_quantity <= p.min_stock_level
      AND p.min_stock_level > 0
      ORDER BY 
        CASE 
          WHEN p.stock_quantity = 0 THEN 1
          WHEN p.stock_quantity <= p.min_stock_level * 0.5 THEN 2
          ELSE 3
        END ASC,
        (p.stock_quantity / NULLIF(p.min_stock_level, 0)) ASC
    `;

    const lowStockResult = await query(lowStockQuery, [req.user.companyId]);

    return res.status(200).json({
      success: true,
      data: lowStockResult.rows,
      stats: {
        total_low_stock: lowStockResult.rows.length,
        out_of_stock: lowStockResult.rows.filter(p => p.stock_quantity === 0).length,
        critical_stock: lowStockResult.rows.filter(p => p.urgency_level === 'critical').length
      }
    });
  });

  // Listar categorias
  static getCategories = asyncHandler(async (req, res) => {
    const categoriesQuery = `
      SELECT 
        pc.*,
        COUNT(p.id) as products_count,
        u.full_name as created_by_name
      FROM polox.product_categories pc
      LEFT JOIN polox.products p ON pc.id = p.category_id AND p.company_id = pc.company_id AND p.deleted_at IS NULL
      LEFT JOIN polox.users u ON pc.created_by = u.id
      WHERE pc.company_id = $1 AND pc.deleted_at IS NULL
      GROUP BY pc.id, u.full_name
      ORDER BY pc.category_name ASC
    `;

    const categoriesResult = await query(categoriesQuery, [req.user.companyId]);

    return res.status(200).json({
      success: true,
      data: categoriesResult.rows
    });
  });

  // Criar categoria
  static createCategory = asyncHandler(async (req, res) => {
    const { error, value } = ProductController.createCategorySchema.validate(req.body);
    if (error) throw new ApiError(400, tc(req, 'productController', 'validation.invalid_data'));

    const categoryData = value;

    // Verificar se categoria já existe
    const existingCategory = await query(
      'SELECT id FROM polox.product_categories WHERE category_name = $1 AND company_id = $2 AND deleted_at IS NULL',
      [categoryData.name, req.user.companyId]
    );

    if (existingCategory.rows.length > 0) {
      throw new ApiError(400, tc(req, 'productController', 'validation.category_exists'));
    }

    const createCategoryQuery = `
      INSERT INTO polox.product_categories (
        company_id, category_name, description, parent_id, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, NOW(), NOW())
      RETURNING *
    `;

    const newCategoryResult = await query(createCategoryQuery, [
      req.user.companyId,
      categoryData.name,
      categoryData.description,
      categoryData.parent_id
    ]);

    const newCategory = newCategoryResult.rows[0];

    return res.status(201).json({
      success: true,
      data: newCategory,
      message: tc(req, 'productController', 'createCategory.success')
    });
  });

  // Relatórios de produtos
  static getReports = asyncHandler(async (req, res) => {
    const { period = 'month', type = 'sales' } = req.query;
    
    let dateFilter;
    switch (period) {
      case 'week':
        dateFilter = "AND s.created_at >= DATE_TRUNC('week', CURRENT_DATE)";
        break;
      case 'month':
        dateFilter = "AND s.created_at >= DATE_TRUNC('month', CURRENT_DATE)";
        break;
      case 'quarter':
        dateFilter = "AND s.created_at >= DATE_TRUNC('quarter', CURRENT_DATE)";
        break;
      case 'year':
        dateFilter = "AND s.created_at >= DATE_TRUNC('year', CURRENT_DATE)";
        break;
      default:
        dateFilter = "AND s.created_at >= DATE_TRUNC('month', CURRENT_DATE)";
    }

    let reportQuery;
    
    if (type === 'sales') {
      // Relatório de vendas por produto
      reportQuery = `
        SELECT 
          p.id,
          p.product_name,
          p.sku,
          pc.category_name as category_name,
          COUNT(DISTINCT s.id) as sales_count,
          SUM(si.quantity) as total_quantity_sold,
          SUM(si.total_price) as total_revenue,
          AVG(si.unit_price) as avg_selling_price,
          p.cost_price,
          SUM(si.total_price) - SUM(si.quantity * p.cost_price) as profit,
          CASE 
            WHEN SUM(si.quantity * p.cost_price) > 0 
            THEN ROUND(((SUM(si.total_price) - SUM(si.quantity * p.cost_price)) / SUM(si.quantity * p.cost_price)) * 100, 2)
            ELSE 0
          END as profit_margin_percent
        FROM polox.products p
        LEFT JOIN polox.product_categories pc ON p.category_id = pc.id
        LEFT JOIN polox.sale_items si ON p.id = si.product_id
        LEFT JOIN polox.sales s ON si.sale_id = s.id
        WHERE p.company_id = $1 AND p.deleted_at IS NULL
        AND s.company_id = $1 AND s.deleted_at IS NULL AND s.status != 'cancelled' ${dateFilter}
        GROUP BY p.id, p.product_name, p.sku, pc.category_name, p.cost_price
        HAVING SUM(si.quantity) > 0
        ORDER BY total_revenue DESC
        LIMIT 50
      `;
    } else if (type === 'inventory') {
      // Relatório de inventário
      reportQuery = `
        SELECT 
          p.id,
          p.product_name,
          p.sku,
          pc.category_name as category_name,
          p.current_stock,
          p.min_stock,
          p.cost_price,
          (p.current_stock * p.cost_price) as inventory_value,
          CASE 
            WHEN p.current_stock = 0 THEN 'Sem estoque'
            WHEN p.current_stock <= p.min_stock THEN 'Estoque baixo'
            WHEN p.current_stock <= p.min_stock * 2 THEN 'Estoque médio'
            ELSE 'Estoque adequado'
          END as stock_status,
          last_movement.last_movement_date,
          last_movement.last_movement_type
        FROM polox.products p
        LEFT JOIN polox.product_categories pc ON p.category_id = pc.id
        LEFT JOIN (
          SELECT 
            product_id,
            MAX(created_at) as last_movement_date,
            (SELECT type FROM polox.stock_movements sm2 WHERE sm2.product_id = sm1.product_id ORDER BY created_at DESC LIMIT 1) as last_movement_type
          FROM polox.stock_movements sm1
          WHERE company_id = $1
          GROUP BY product_id
        ) last_movement ON p.id = last_movement.product_id
        WHERE p.company_id = $1 AND p.deleted_at IS NULL AND p.track_stock = true
        ORDER BY inventory_value DESC
      `;
    }

    const reportResult = await query(reportQuery, [req.user.companyId]);

    // Estatísticas gerais
    const statsQuery = `
      SELECT 
        COUNT(DISTINCT p.id) as total_products,
        COUNT(DISTINCT s.id) as total_sales,
        SUM(si.total_price) as total_revenue,
        SUM(si.quantity) as total_quantity_sold,
        SUM(p.current_stock * p.cost_price) as total_inventory_value
      FROM polox.products p
      LEFT JOIN polox.sale_items si ON p.id = si.product_id
      LEFT JOIN polox.sales s ON si.sale_id = s.id AND s.company_id = $1 AND s.deleted_at IS NULL AND s.status != 'cancelled' ${dateFilter}
      WHERE p.company_id = $1 AND p.deleted_at IS NULL
    `;

    const statsResult = await query(statsQuery, [req.user.companyId]);

    return res.status(200).json({
      success: true,
      data: {
        type,
        period,
        products: reportResult.rows,
        stats: {
          ...statsResult.rows[0],
          total_revenue: parseFloat(statsResult.rows[0].total_revenue || 0),
          total_inventory_value: parseFloat(statsResult.rows[0].total_inventory_value || 0)
        }
      }
    });
  });
}

module.exports = ProductController;