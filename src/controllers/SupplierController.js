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

/**
 * ==========================================
 * 🏢 SUPPLIER CONTROLLER - COPILOT_PROMPT_6
 * ==========================================
 * Gestão completa de fornecedores e pedidos de compra
 * ==========================================
 */

const { query, beginTransaction, commitTransaction, rollbackTransaction } = require('../models/database');
const { asyncHandler, ApiError } = require('../utils/errors');
const { logger, auditLogger } = require('../utils/logger');
const { tc } = require('../config/i18n');
const { cache } = require('../config/cache');
const { trackUser } = require('../config/monitoring');
const { 
  validateSupplierData, 
  validateUpdateData,
  sanitizeSupplierOutput,
  formatPaginatedResponse 
} = require('../utils/validation');
const { v4: uuidv4 } = require('uuid');

class SupplierController {

  /**
   * 📋 LISTAR FORNECEDORES
   * GET /api/suppliers
   */
  static index = asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = (page - 1) * limit;
    
    let whereClause = 'WHERE s.company_id = $1 AND s.deleted_at IS NULL';
    let queryParams = [req.user.companyId];
    let paramCount = 1;

    // Filtros avançados
    if (req.query.status) {
      whereClause += ` AND s.status = $${++paramCount}`;
      queryParams.push(req.query.status);
    }

    if (req.query.category) {
      whereClause += ` AND s.category = $${++paramCount}`;
      queryParams.push(req.query.category);
    }

    if (req.query.search) {
      whereClause += ` AND (s.name ILIKE $${++paramCount} OR s.company_name ILIKE $${++paramCount} OR s.email ILIKE $${++paramCount})`;
      const searchTerm = `%${req.query.search}%`;
      queryParams.push(searchTerm, searchTerm, searchTerm);
      paramCount += 2;
    }

    if (req.query.rating_min) {
      whereClause += ` AND s.rating >= $${++paramCount}`;
      queryParams.push(parseFloat(req.query.rating_min));
    }

    // Query principal
    const suppliersQuery = `
      SELECT 
        s.*,
        COUNT(DISTINCT po.id) as total_orders,
        SUM(CASE WHEN po.status = 'completed' THEN po.total_amount ELSE 0 END) as total_spent,
        AVG(s.rating) as average_rating,
        MAX(po.created_at) as last_order_date,
        COUNT(CASE WHEN po.status = 'pending' THEN 1 END) as pending_orders
      FROM suppliers s
      LEFT JOIN purchase_orders po ON s.id = po.supplier_id AND po.deleted_at IS NULL
      ${whereClause}
      GROUP BY s.id
      ORDER BY 
        CASE 
          WHEN s.status = 'active' THEN 1
          WHEN s.status = 'pending' THEN 2  
          WHEN s.status = 'inactive' THEN 3
          ELSE 4
        END,
        s.rating DESC NULLS LAST,
        s.name ASC
      LIMIT $${++paramCount} OFFSET $${++paramCount}
    `;
    
    queryParams.push(limit, offset);

    // Query de contagem
    const countQuery = `SELECT COUNT(*) as total FROM suppliers s ${whereClause}`;

    // Query de estatísticas
    const statsQuery = `
      SELECT 
        COUNT(*) as total_suppliers,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_suppliers,
        COUNT(CASE WHEN status = 'inactive' THEN 1 END) as inactive_suppliers,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_suppliers,
        COUNT(CASE WHEN status = 'blocked' THEN 1 END) as blocked_suppliers,
        ROUND(AVG(rating), 2) as average_rating,
        ROUND(AVG(delivery_time), 1) as average_delivery_time,
        SUM(credit_limit) as total_credit_available
      FROM suppliers s
      WHERE s.company_id = $1 AND s.deleted_at IS NULL
    `;

    const [suppliersResult, countResult, statsResult] = await Promise.all([
      query(suppliersQuery, queryParams),
      query(countQuery, queryParams.slice(0, -2)),
      query(statsQuery, [req.user.companyId])
    ]);

    // Processar dados dos fornecedores
    const suppliers = suppliersResult.rows.map(supplier => ({
      ...sanitizeSupplierOutput(supplier),
      total_orders: parseInt(supplier.total_orders),
      total_spent: parseFloat(supplier.total_spent) || 0,
      average_rating: parseFloat(supplier.average_rating) || 0,
      last_order_date: supplier.last_order_date,
      pending_orders: parseInt(supplier.pending_orders)
    }));

    res.json({
      success: true,
      data: suppliers,
      pagination: {
        page,
        limit,
        total: parseInt(countResult.rows[0].total),
        pages: Math.ceil(countResult.rows[0].total / limit)
      },
      stats: statsResult.rows[0]
    });
  });

  /**
   * ➕ CRIAR FORNECEDOR
   * POST /api/suppliers
   */
  static create = asyncHandler(async (req, res) => {
    const supplierData = req.body;

    // Validar dados
    const validation = validateSupplierData(supplierData);
    if (!validation.isValid) {
      throw new ApiError(400, tc(req, 'supplierController', 'validation.invalid_data'), validation.errors);
    }

    const transaction = await beginTransaction();

    try {
      // Verificar se email já existe (se fornecido)
      if (supplierData.email) {
        const emailCheck = await query(
          'SELECT id FROM suppliers WHERE email = $1 AND company_id = $2 AND deleted_at IS NULL',
          [supplierData.email, req.user.companyId]
        );

        if (emailCheck.rows.length > 0) {
          throw new ApiError(409, tc(req, 'supplierController', 'validation.email_exists'));
        }
      }

      // Verificar se CNPJ já existe (se fornecido)
      if (supplierData.cnpj) {
        const cnpjCheck = await query(
          'SELECT id FROM suppliers WHERE cnpj = $1 AND company_id = $2 AND deleted_at IS NULL',
          [supplierData.cnpj, req.user.companyId]
        );

        if (cnpjCheck.rows.length > 0) {
          throw new ApiError(409, tc(req, 'supplierController', 'validation.cnpj_exists'));
        }
      }

      // Criar fornecedor
      const supplierId = uuidv4();
      const createSupplierQuery = `
        INSERT INTO suppliers (
          id, company_id, name, company_name, email, phone, website,
          cnpj, category, status, payment_terms, credit_limit,
          delivery_time, address, contacts, tags, notes, custom_fields,
          rating, created_by, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, NOW())
        RETURNING *
      `;

      const newSupplierResult = await query(createSupplierQuery, [
        supplierId,
        req.user.companyId,
        supplierData.name,
        supplierData.company_name || null,
        supplierData.email || null,
        supplierData.phone || null,
        supplierData.website || null,
        supplierData.cnpj || null,
        supplierData.category || 'general',
        supplierData.status || 'active',
        supplierData.payment_terms || null,
        supplierData.credit_limit || 0,
        supplierData.delivery_time || null,
        JSON.stringify(supplierData.address || {}),
        JSON.stringify(supplierData.contacts || []),
        JSON.stringify(supplierData.tags || []),
        supplierData.notes || null,
        JSON.stringify(supplierData.custom_fields || {}),
        5.0, // Rating inicial
        req.user.id
      ]);

      const newSupplier = newSupplierResult.rows[0];

      // Auto-criar categoria se não existir
      if (supplierData.category && supplierData.category !== 'general') {
        await query(`
          INSERT INTO supplier_categories (id, company_id, name, created_by)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (company_id, name) DO NOTHING
        `, [uuidv4(), req.user.companyId, supplierData.category, req.user.id]);
      }

      await commitTransaction(transaction);

      // Conceder XP/Coins por cadastrar fornecedor
      await query(`
        UPDATE user_gamification_profiles 
        SET total_xp = total_xp + 15, current_coins = current_coins + 8
        WHERE user_id = $1 AND company_id = $2
      `, [req.user.id, req.user.companyId]);

      // Registrar no histórico de gamificação
      await query(`
        INSERT INTO gamification_history (id, user_id, company_id, event_type, amount, reason, action_type, reference_id)
        VALUES 
          ($1, $2, $3, 'xp', 15, 'Supplier registered', 'supplier_created', $4),
          ($5, $2, $3, 'coins', 8, 'Supplier registered', 'supplier_created', $4)
      `, [uuidv4(), req.user.id, req.user.companyId, supplierId, uuidv4()]);

      // Limpar cache
      await cache.del(`suppliers:${req.user.companyId}`, `supplier_stats:${req.user.companyId}`);

      // Log de auditoria
      auditLogger(tc(req, 'supplierController', 'audit.supplier_created', {
        name: supplierData.name
      }), {
        userId: req.user.id,
        supplierId: supplierId,
        supplierName: supplierData.name,
        companyId: req.user.companyId,
        ip: req.ip
      });

      // Métricas
      trackUser.operation(req.user.companyId, 'supplier_created', 'success');

      res.status(201).json({
        success: true,
        message: tc(req, 'supplierController', 'create.success'),
        data: sanitizeSupplierOutput(newSupplier),
        gamification: {
          xp: 15,
          coins: 8,
          action: 'supplier_created'
        }
      });

    } catch (error) {
      await rollbackTransaction(transaction);
      trackUser.operation(req.user.companyId, 'supplier_created', 'failure');
      throw error;
    }
  });

  /**
   * 👁️ OBTER FORNECEDOR
   * GET /api/suppliers/:id
   */
  static show = asyncHandler(async (req, res) => {
    const supplierId = req.params.id;

    const supplierQuery = `
      SELECT 
        s.*,
        COUNT(DISTINCT po.id) as total_orders,
        SUM(CASE WHEN po.status = 'completed' THEN po.total_amount ELSE 0 END) as total_spent,
        AVG(sr.rating) as calculated_rating,
        COUNT(DISTINCT sr.id) as rating_count,
        MAX(po.created_at) as last_order_date,
        u.full_name as created_by_name
      FROM suppliers s
      LEFT JOIN purchase_orders po ON s.id = po.supplier_id AND po.deleted_at IS NULL
      LEFT JOIN supplier_ratings sr ON s.id = sr.supplier_id AND sr.deleted_at IS NULL
      LEFT JOIN users u ON s.created_by = u.id
      WHERE s.id = $1 AND s.company_id = $2 AND s.deleted_at IS NULL
      GROUP BY s.id, u.full_name
    `;

    const supplierResult = await query(supplierQuery, [supplierId, req.user.companyId]);

    if (supplierResult.rows.length === 0) {
      throw new ApiError(404, tc(req, 'supplierController', 'validation.not_found'));
    }

    const supplier = supplierResult.rows[0];

    // Buscar produtos relacionados
    const productsQuery = `
      SELECT DISTINCT 
        p.id, p.name, p.sku, sp.cost_price, sp.lead_time
      FROM products p
      JOIN supplier_products sp ON p.id = sp.product_id
      WHERE sp.supplier_id = $1 AND p.deleted_at IS NULL
      ORDER BY p.name
      LIMIT 10
    `;

    const productsResult = await query(productsQuery, [supplierId]);

    // Buscar pedidos recentes
    const recentOrdersQuery = `
      SELECT 
        po.id, po.description, po.total_amount, po.status, 
        po.created_at, po.expected_delivery
      FROM purchase_orders po
      WHERE po.supplier_id = $1 AND po.deleted_at IS NULL
      ORDER BY po.created_at DESC
      LIMIT 5
    `;

    const recentOrdersResult = await query(recentOrdersQuery, [supplierId]);

    res.json({
      success: true,
      data: {
        ...sanitizeSupplierOutput(supplier),
        total_orders: parseInt(supplier.total_orders),
        total_spent: parseFloat(supplier.total_spent) || 0,
        calculated_rating: parseFloat(supplier.calculated_rating) || supplier.rating,
        rating_count: parseInt(supplier.rating_count),
        last_order_date: supplier.last_order_date,
        created_by_name: supplier.created_by_name,
        related_products: productsResult.rows,
        recent_orders: recentOrdersResult.rows
      }
    });
  });

  /**
   * ✏️ ATUALIZAR FORNECEDOR
   * PUT /api/suppliers/:id
   */
  static update = asyncHandler(async (req, res) => {
    const supplierId = req.params.id;
    const updateData = req.body;

    // Validar dados de atualização
    const validation = validateUpdateData(updateData, 'supplier');
    if (!validation.isValid) {
      throw new ApiError(400, tc(req, 'supplierController', 'validation.invalid_data'), validation.errors);
    }

    const transaction = await beginTransaction();

    try {
      // Verificar se fornecedor existe
      const supplierCheck = await query(
        'SELECT id, name, email, cnpj FROM suppliers WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL',
        [supplierId, req.user.companyId]
      );

      if (supplierCheck.rows.length === 0) {
        throw new ApiError(404, tc(req, 'supplierController', 'validation.not_found'));
      }

      const currentSupplier = supplierCheck.rows[0];

      // Verificar email único (se mudou)
      if (updateData.email && updateData.email !== currentSupplier.email) {
        const emailCheck = await query(
          'SELECT id FROM suppliers WHERE email = $1 AND company_id = $2 AND id != $3 AND deleted_at IS NULL',
          [updateData.email, req.user.companyId, supplierId]
        );

        if (emailCheck.rows.length > 0) {
          throw new ApiError(409, tc(req, 'supplierController', 'validation.email_in_use'));
        }
      }

      // Verificar CNPJ único (se mudou)
      if (updateData.cnpj && updateData.cnpj !== currentSupplier.cnpj) {
        const cnpjCheck = await query(
          'SELECT id FROM suppliers WHERE cnpj = $1 AND company_id = $2 AND id != $3 AND deleted_at IS NULL',
          [updateData.cnpj, req.user.companyId, supplierId]
        );

        if (cnpjCheck.rows.length > 0) {
          throw new ApiError(409, tc(req, 'supplierController', 'validation.cnpj_in_use'));
        }
      }

      // Construir query de atualização dinâmica
      const updateFields = [];
      const updateValues = [];
      let paramCount = 0;

      const allowedFields = [
        'name', 'company_name', 'email', 'phone', 'website', 'cnpj',
        'category', 'status', 'payment_terms', 'credit_limit', 'delivery_time',
        'address', 'contacts', 'tags', 'notes', 'custom_fields'
      ];

      allowedFields.forEach(field => {
        if (updateData.hasOwnProperty(field)) {
          updateFields.push(`${field} = $${++paramCount}`);
          
          if (['address', 'contacts', 'tags', 'custom_fields'].includes(field)) {
            updateValues.push(JSON.stringify(updateData[field]));
          } else {
            updateValues.push(updateData[field]);
          }
        }
      });

      if (updateFields.length === 0) {
        throw new ApiError(400, tc(req, 'supplierController', 'validation.no_fields_to_update'));
      }

      updateFields.push(`updated_at = NOW()`);
      updateValues.push(supplierId, req.user.companyId);

      const updateQuery = `
        UPDATE suppliers 
        SET ${updateFields.join(', ')}
        WHERE id = $${++paramCount} AND company_id = $${++paramCount}
        RETURNING *
      `;

      const updatedSupplierResult = await query(updateQuery, updateValues);
      const updatedSupplier = updatedSupplierResult.rows[0];

      await commitTransaction(transaction);

      // Limpar cache
      await cache.del(`supplier:${supplierId}`, `suppliers:${req.user.companyId}`);

      // Log de auditoria
      auditLogger(tc(req, 'supplierController', 'audit.supplier_updated', {
        name: currentSupplier.name
      }), {
        userId: req.user.id,
        supplierId: supplierId,
        supplierName: currentSupplier.name,
        updatedFields: Object.keys(updateData),
        companyId: req.user.companyId,
        ip: req.ip
      });

      // Métricas
      trackUser.operation(req.user.companyId, 'supplier_updated', 'success');

      res.json({
        success: true,
        message: tc(req, 'supplierController', 'update.success'),
        data: sanitizeSupplierOutput(updatedSupplier)
      });

    } catch (error) {
      await rollbackTransaction(transaction);
      trackUser.operation(req.user.companyId, 'supplier_updated', 'failure');
      throw error;
    }
  });

  /**
   * 🗑️ DELETAR FORNECEDOR
   * DELETE /api/suppliers/:id
   */
  static destroy = asyncHandler(async (req, res) => {
    const supplierId = req.params.id;

    const transaction = await beginTransaction();

    try {
      // Verificar se fornecedor existe
      const supplierResult = await query(
        'SELECT id, name FROM suppliers WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL',
        [supplierId, req.user.companyId]
      );

      if (supplierResult.rows.length === 0) {
        throw new ApiError(404, tc(req, 'supplierController', 'validation.not_found'));
      }

      const supplier = supplierResult.rows[0];

      // Verificar se há pedidos ativos
      const activePurchaseOrders = await query(
        'SELECT COUNT(*) as count FROM purchase_orders WHERE supplier_id = $1 AND status IN ($2, $3) AND deleted_at IS NULL',
        [supplierId, 'pending', 'in_progress']
      );

      if (parseInt(activePurchaseOrders.rows[0].count) > 0) {
        throw new ApiError(400, tc(req, 'supplierController', 'validation.has_active_orders'));
      }

      // Soft delete do fornecedor
      await query(
        'UPDATE suppliers SET deleted_at = NOW() WHERE id = $1 AND company_id = $2',
        [supplierId, req.user.companyId]
      );

      await commitTransaction(transaction);

      // Limpar cache
      await cache.del(`supplier:${supplierId}`, `suppliers:${req.user.companyId}`);

      // Log de auditoria
      auditLogger(tc(req, 'supplierController', 'audit.supplier_deleted', {
        name: supplier.name
      }), {
        userId: req.user.id,
        supplierId: supplierId,
        supplierName: supplier.name,
        companyId: req.user.companyId,
        ip: req.ip
      });

      // Métricas
      trackUser.operation(req.user.companyId, 'supplier_deleted', 'success');

      res.json({
        success: true,
        message: tc(req, 'supplierController', 'delete.success')
      });

    } catch (error) {
      await rollbackTransaction(transaction);
      trackUser.operation(req.user.companyId, 'supplier_deleted', 'failure');
      throw error;
    }
  });

  /**
   * 📦 PRODUTOS DO FORNECEDOR
   * GET /api/suppliers/:id/products
   */
  static getProducts = asyncHandler(async (req, res) => {
    const supplierId = req.params.id;

    // Verificar se fornecedor existe
    const supplierCheck = await query(
      'SELECT id, name FROM suppliers WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL',
      [supplierId, req.user.companyId]
    );

    if (supplierCheck.rows.length === 0) {
      throw new ApiError(404, tc(req, 'supplierController', 'validation.not_found'));
    }

    const productsQuery = `
      SELECT 
        p.id, p.product_name, p.sku, p.product_type, p.category, p.status,
        sp.cost_price, sp.lead_time, sp.minimum_order_quantity,
        sp.is_preferred, sp.created_at as relationship_created
      FROM products p
      JOIN supplier_products sp ON p.id = sp.product_id
      WHERE sp.supplier_id = $1 AND p.company_id = $2 AND p.deleted_at IS NULL
      ORDER BY sp.is_preferred DESC, p.product_name ASC
    `;

    const productsResult = await query(productsQuery, [supplierId, req.user.companyId]);

    res.json({
      success: true,
      data: {
        supplier: supplierCheck.rows[0],
        products: productsResult.rows,
        total: productsResult.rows.length
      }
    });
  });

  /**
   * 🛒 CRIAR PEDIDO DE COMPRA
   * POST /api/suppliers/:id/orders
   */
  static createOrder = asyncHandler(async (req, res) => {
    const supplierId = req.params.id;
    const orderData = req.body;

    // Validação básica
    if (!orderData.items || !Array.isArray(orderData.items) || orderData.items.length === 0) {
      throw new ApiError(400, tc(req, 'supplierController', 'validation.items_required'));
    }

    const transaction = await beginTransaction();

    try {
      // Verificar se fornecedor existe e está ativo
      const supplierCheck = await query(
        'SELECT id, name, status, credit_limit FROM suppliers WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL',
        [supplierId, req.user.companyId]
      );

      if (supplierCheck.rows.length === 0) {
        throw new ApiError(404, tc(req, 'supplierController', 'validation.not_found'));
      }

      const supplier = supplierCheck.rows[0];

      if (supplier.status !== 'active') {
        throw new ApiError(400, tc(req, 'supplierController', 'validation.supplier_inactive'));
      }

      // Calcular total do pedido
      const totalAmount = orderData.items.reduce((sum, item) => {
        if (!item.quantity || !item.unit_price) {
          throw new ApiError(400, tc(req, 'supplierController', 'validation.item_fields_required'));
        }
        return sum + (item.quantity * item.unit_price);
      }, 0);

      // Verificar limite de crédito se aplicável
      if (supplier.credit_limit > 0 && totalAmount > supplier.credit_limit) {
        throw new ApiError(400, tc(req, 'supplierController', 'validation.credit_limit_exceeded', {
          orderAmount: totalAmount,
          creditLimit: supplier.credit_limit
        }));
      }

      // Gerar número do pedido
      const orderNumber = await this.generateOrderNumber(req.user.companyId);

      // Criar pedido de compra
      const orderId = uuidv4();
      const createOrderQuery = `
        INSERT INTO purchase_orders (
          id, company_id, supplier_id, order_number, description, 
          expected_delivery, priority, total_amount, status, 
          notes, created_by, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', $9, $10, NOW())
        RETURNING *
      `;

      const newOrderResult = await query(createOrderQuery, [
        orderId,
        req.user.companyId,
        supplierId,
        orderNumber,
        orderData.description || null,
        orderData.expected_delivery || null,
        orderData.priority || 'medium',
        totalAmount,
        orderData.notes || null,
        req.user.id
      ]);

      const newOrder = newOrderResult.rows[0];

      // Adicionar itens do pedido
      for (const item of orderData.items) {
        const itemId = uuidv4();
        await query(`
          INSERT INTO purchase_order_items (
            id, order_id, product_id, product_name, quantity, 
            unit_price, total_price
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [
          itemId,
          orderId,
          item.product_id || null,
          item.product_name || item.name,
          item.quantity,
          item.unit_price,
          item.quantity * item.unit_price
        ]);
      }

      await commitTransaction(transaction);

      // Conceder XP/Coins por criar pedido
      const xpReward = Math.floor(totalAmount / 1000) + 25; // 1 XP por R$ 1000 + bonus
      const coinReward = Math.floor(totalAmount / 2000) + 12; // 1 coin por R$ 2000 + bonus

      await query(`
        UPDATE user_gamification_profiles 
        SET total_xp = total_xp + $1, current_coins = current_coins + $2
        WHERE user_id = $3 AND company_id = $4
      `, [xpReward, coinReward, req.user.id, req.user.companyId]);

      // Registrar no histórico
      await query(`
        INSERT INTO gamification_history (id, user_id, company_id, event_type, amount, reason, action_type, reference_id)
        VALUES 
          ($1, $2, $3, 'xp', $4, 'Purchase order created', 'purchase_order_created', $5),
          ($6, $2, $3, 'coins', $7, 'Purchase order created', 'purchase_order_created', $5)
      `, [uuidv4(), req.user.id, req.user.companyId, xpReward, orderId, uuidv4(), coinReward]);

      // Log de auditoria
      auditLogger(tc(req, 'supplierController', 'audit.purchase_order_created', {
        orderNumber: orderNumber,
        supplier: supplier.name
      }), {
        userId: req.user.id,
        orderId: orderId,
        orderNumber: orderNumber,
        supplierId: supplierId,
        supplierName: supplier.name,
        totalAmount: totalAmount,
        itemCount: orderData.items.length,
        companyId: req.user.companyId,
        ip: req.ip
      });

      // Métricas
      trackUser.operation(req.user.companyId, 'purchase_order_created', 'success');

      res.status(201).json({
        success: true,
        message: tc(req, 'supplierController', 'createOrder.success'),
        data: {
          ...newOrder,
          items: orderData.items.map((item, index) => ({
            ...item,
            total_price: item.quantity * item.unit_price
          }))
        },
        gamification: {
          xp: xpReward,
          coins: coinReward,
          action: 'purchase_order_created'
        }
      });

    } catch (error) {
      await rollbackTransaction(transaction);
      trackUser.operation(req.user.companyId, 'purchase_order_created', 'failure');
      throw error;
    }
  });

  /**
   * 📋 HISTÓRICO DE PEDIDOS
   * GET /api/suppliers/:id/orders
   */
  static getOrders = asyncHandler(async (req, res) => {
    const supplierId = req.params.id;
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 10, 50);
    const offset = (page - 1) * limit;

    // Verificar se fornecedor existe
    const supplierCheck = await query(
      'SELECT id, name FROM suppliers WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL',
      [supplierId, req.user.companyId]
    );

    if (supplierCheck.rows.length === 0) {
      throw new ApiError(404, tc(req, 'supplierController', 'validation.not_found'));
    }

    let whereClause = 'WHERE po.supplier_id = $1 AND po.company_id = $2 AND po.deleted_at IS NULL';
    let queryParams = [supplierId, req.user.companyId];
    let paramCount = 2;

    if (req.query.status) {
      whereClause += ` AND po.status = $${++paramCount}`;
      queryParams.push(req.query.status);
    }

    const ordersQuery = `
      SELECT 
        po.*,
        u.full_name as created_by_name,
        COUNT(DISTINCT poi.id) as item_count
      FROM purchase_orders po
      LEFT JOIN users u ON po.created_by = u.id
      LEFT JOIN purchase_order_items poi ON po.id = poi.order_id
      ${whereClause}
      GROUP BY po.id, u.full_name
      ORDER BY po.created_at DESC
      LIMIT $${++paramCount} OFFSET $${++paramCount}
    `;

    queryParams.push(limit, offset);

    const countQuery = `SELECT COUNT(*) as total FROM purchase_orders po ${whereClause}`;

    const [ordersResult, countResult] = await Promise.all([
      query(ordersQuery, queryParams),
      query(countQuery, queryParams.slice(0, -2))
    ]);

    res.json({
      success: true,
      data: {
        supplier: supplierCheck.rows[0],
        orders: ordersResult.rows,
        pagination: {
          page,
          limit,
          total: parseInt(countResult.rows[0].total),
          pages: Math.ceil(countResult.rows[0].total / limit)
        }
      }
    });
  });

  /**
   * ⭐ AVALIAR FORNECEDOR
   * PUT /api/suppliers/:id/rating
   */
  static rateSupplier = asyncHandler(async (req, res) => {
    const supplierId = req.params.id;
    const { rating, comment } = req.body;

    // Validações
    if (!rating || rating < 1 || rating > 5) {
      throw new ApiError(400, tc(req, 'supplierController', 'validation.invalid_rating'));
    }

    const transaction = await beginTransaction();

    try {
      // Verificar se fornecedor existe
      const supplierCheck = await query(
        'SELECT id, name FROM suppliers WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL',
        [supplierId, req.user.companyId]
      );

      if (supplierCheck.rows.length === 0) {
        throw new ApiError(404, tc(req, 'supplierController', 'validation.not_found'));
      }

      const supplier = supplierCheck.rows[0];

      // Verificar se usuário já avaliou este fornecedor
      const existingRating = await query(
        'SELECT id FROM supplier_ratings WHERE supplier_id = $1 AND user_id = $2 AND deleted_at IS NULL',
        [supplierId, req.user.id]
      );

      if (existingRating.rows.length > 0) {
        // Atualizar avaliação existente
        await query(`
          UPDATE supplier_ratings 
          SET rating = $1, comment = $2, updated_at = NOW()
          WHERE supplier_id = $3 AND user_id = $4
        `, [rating, comment || null, supplierId, req.user.id]);
      } else {
        // Criar nova avaliação
        await query(`
          INSERT INTO supplier_ratings (id, supplier_id, user_id, rating, comment, created_at)
          VALUES ($1, $2, $3, $4, $5, NOW())
        `, [uuidv4(), supplierId, req.user.id, rating, comment || null]);
      }

      // Recalcular média do fornecedor
      const avgRatingResult = await query(
        'SELECT AVG(rating) as avg_rating FROM supplier_ratings WHERE supplier_id = $1 AND deleted_at IS NULL',
        [supplierId]
      );

      const avgRating = parseFloat(avgRatingResult.rows[0].avg_rating) || 5.0;

      // Atualizar rating do fornecedor
      await query(
        'UPDATE suppliers SET rating = $1 WHERE id = $2',
        [avgRating, supplierId]
      );

      await commitTransaction(transaction);

      // Conceder XP/Coins por avaliar
      await query(`
        UPDATE user_gamification_profiles 
        SET total_xp = total_xp + 10, current_coins = current_coins + 5
        WHERE user_id = $1 AND company_id = $2
      `, [req.user.id, req.user.companyId]);

      // Log de auditoria
      auditLogger(tc(req, 'supplierController', 'audit.supplier_rated', {
        name: supplier.name,
        rating: rating
      }), {
        userId: req.user.id,
        supplierId: supplierId,
        supplierName: supplier.name,
        rating: rating,
        hasComment: !!comment,
        newAvgRating: avgRating,
        companyId: req.user.companyId,
        ip: req.ip
      });

      res.json({
        success: true,
        message: tc(req, 'supplierController', 'rateSupplier.success'),
        data: {
          rating: rating,
          comment: comment,
          new_average_rating: avgRating
        },
        gamification: {
          xp: 10,
          coins: 5,
          action: 'supplier_rated'
        }
      });

    } catch (error) {
      await rollbackTransaction(transaction);
      throw error;
    }
  });

  /**
   * 📊 RELATÓRIOS DE FORNECEDORES
   * GET /api/suppliers/reports
   */
  static getReports = asyncHandler(async (req, res) => {
    const { report_type = 'performance', period = 'month' } = req.query;

    let dateFilter = '';
    switch (period) {
      case 'week':
        dateFilter = "AND po.created_at >= DATE_TRUNC('week', CURRENT_DATE)";
        break;
      case 'month':
        dateFilter = "AND po.created_at >= DATE_TRUNC('month', CURRENT_DATE)";
        break;
      case 'quarter':
        dateFilter = "AND po.created_at >= DATE_TRUNC('quarter', CURRENT_DATE)";
        break;
      case 'year':
        dateFilter = "AND po.created_at >= DATE_TRUNC('year', CURRENT_DATE)";
        break;
    }

    if (report_type === 'performance') {
      // Relatório de performance dos fornecedores
      const performanceQuery = `
        SELECT 
          s.id, s.name, s.category, s.status, s.rating,
          COUNT(DISTINCT po.id) as total_orders,
          SUM(CASE WHEN po.status = 'completed' THEN po.total_amount ELSE 0 END) as total_spent,
          AVG(CASE WHEN po.status = 'completed' THEN po.total_amount END) as avg_order_value,
          COUNT(CASE WHEN po.status = 'completed' AND po.delivery_date <= po.expected_delivery THEN 1 END) as on_time_deliveries,
          COUNT(CASE WHEN po.status = 'completed' THEN 1 END) as completed_orders,
          s.delivery_time
        FROM suppliers s
        LEFT JOIN purchase_orders po ON s.id = po.supplier_id AND po.deleted_at IS NULL ${dateFilter}
        WHERE s.company_id = $1 AND s.deleted_at IS NULL
        GROUP BY s.id, s.name, s.category, s.status, s.rating, s.delivery_time
        ORDER BY total_spent DESC, s.rating DESC
      `;

      const performanceResult = await query(performanceQuery, [req.user.companyId]);

      res.json({
        success: true,
        data: {
          report_type: 'performance',
          period,
          suppliers: performanceResult.rows.map(supplier => ({
            ...supplier,
            total_spent: parseFloat(supplier.total_spent) || 0,
            avg_order_value: parseFloat(supplier.avg_order_value) || 0,
            on_time_rate: supplier.completed_orders > 0 
              ? Math.round((supplier.on_time_deliveries / supplier.completed_orders) * 100)
              : 0
          }))
        }
      });

    } else if (report_type === 'categories') {
      // Relatório por categorias
      const categoriesQuery = `
        SELECT 
          COALESCE(s.category, 'Sem categoria') as category,
          COUNT(DISTINCT s.id) as supplier_count,
          COUNT(DISTINCT po.id) as total_orders,
          SUM(CASE WHEN po.status = 'completed' THEN po.total_amount ELSE 0 END) as total_spent,
          AVG(s.rating) as avg_rating
        FROM suppliers s
        LEFT JOIN purchase_orders po ON s.id = po.supplier_id AND po.deleted_at IS NULL ${dateFilter}
        WHERE s.company_id = $1 AND s.deleted_at IS NULL
        GROUP BY COALESCE(s.category, 'Sem categoria')
        ORDER BY total_spent DESC
      `;

      const categoriesResult = await query(categoriesQuery, [req.user.companyId]);

      res.json({
        success: true,
        data: {
          report_type: 'categories',
          period,
          categories: categoriesResult.rows.map(cat => ({
            ...cat,
            total_spent: parseFloat(cat.total_spent) || 0,
            avg_rating: parseFloat(cat.avg_rating) || 0
          }))
        }
      });

    } else {
      throw new ApiError(400, tc(req, 'supplierController', 'validation.invalid_report_type'));
    }
  });

  /**
   * 📥 IMPORTAR FORNECEDORES
   * POST /api/suppliers/import
   */
  static importSuppliers = asyncHandler(async (req, res) => {
    const { suppliers } = req.body;

    if (!suppliers || !Array.isArray(suppliers) || suppliers.length === 0) {
      throw new ApiError(400, tc(req, 'supplierController', 'validation.suppliers_list_required'));
    }

    const transaction = await beginTransaction();
    const results = {
      imported: 0,
      skipped: 0,
      errors: []
    };

    try {
      for (const [index, supplierData] of suppliers.entries()) {
        try {
          // Validação básica
          if (!supplierData.name) {
            results.errors.push({ line: index + 1, error: 'Nome é obrigatório' });
            results.skipped++;
            continue;
          }

          // Verificar duplicatas por email ou nome
          const duplicateCheck = await query(`
            SELECT id FROM suppliers 
            WHERE company_id = $1 AND deleted_at IS NULL AND (
              (email IS NOT NULL AND email = $2) OR 
              (name = $3)
            )
          `, [req.user.companyId, supplierData.email || null, supplierData.name]);

          if (duplicateCheck.rows.length > 0) {
            results.errors.push({ line: index + 1, error: 'Fornecedor já existe' });
            results.skipped++;
            continue;
          }

          // Criar fornecedor
          const supplierId = uuidv4();
          await query(`
            INSERT INTO suppliers (
              id, company_id, name, company_name, email, phone, 
              category, status, created_by, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
          `, [
            supplierId,
            req.user.companyId,
            supplierData.name,
            supplierData.company_name || null,
            supplierData.email || null,
            supplierData.phone || null,
            supplierData.category || 'general',
            supplierData.status || 'active',
            req.user.id
          ]);

          results.imported++;

        } catch (error) {
          results.errors.push({ line: index + 1, error: error.message });
          results.skipped++;
        }
      }

      await commitTransaction(transaction);

      // Conceder XP/Coins por importação
      if (results.imported > 0) {
        const xpReward = results.imported * 5;
        const coinReward = Math.floor(results.imported / 2);

        await query(`
          UPDATE user_gamification_profiles 
          SET total_xp = total_xp + $1, current_coins = current_coins + $2
          WHERE user_id = $3 AND company_id = $4
        `, [xpReward, coinReward, req.user.id, req.user.companyId]);
      }

      // Log de auditoria
      auditLogger(tc(req, 'supplierController', 'audit.suppliers_imported', {
        success: successCount,
        total: suppliers.length
      }), {
        userId: req.user.id,
        totalAttempted: suppliers.length,
        imported: results.imported,
        skipped: results.skipped,
        companyId: req.user.companyId,
        ip: req.ip
      });

      res.json({
        success: true,
        message: tc(req, 'supplierController', 'importSuppliers.success', {
          imported: results.imported,
          skipped: results.skipped
        }),
        data: results,
        gamification: results.imported > 0 ? {
          xp: results.imported * 5,
          coins: Math.floor(results.imported / 2),
          action: 'suppliers_imported'
        } : null
      });

    } catch (error) {
      await rollbackTransaction(transaction);
      throw error;
    }
  });

  /**
   * 🔢 GERAR NÚMERO DO PEDIDO
   */
  static async generateOrderNumber(companyId) {
    const currentYear = new Date().getFullYear();
    const currentMonth = (new Date().getMonth() + 1).toString().padStart(2, '0');
    
    // Buscar último número do mês
    const prefix = `PO-${currentYear}${currentMonth}`;
    
    const lastOrderQuery = `
      SELECT order_number FROM purchase_orders 
      WHERE company_id = $1 
      AND order_number LIKE '${prefix}%'
      ORDER BY id DESC 
      LIMIT 1
    `;
    
    const lastOrderResult = await query(lastOrderQuery, [companyId]);
    
    let nextNumber = 1;
    if (lastOrderResult.rows.length > 0) {
      const lastNumber = lastOrderResult.rows[0].order_number;
      const lastSequence = parseInt(lastNumber.split('-')[1].slice(6)); // Remove YYYYMM
      nextNumber = lastSequence + 1;
    }
    
    return `${prefix}-${nextNumber.toString().padStart(4, '0')}`;
  }
}

module.exports = SupplierController;