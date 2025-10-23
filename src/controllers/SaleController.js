/**
 * ==========================================
 * 💰 SALE CONTROLLER - CRM CORE
 * ==========================================
 * 
 * Gestão completa de vendas para sistema CRM
 * - CRUD completo de vendas
 * - Sistema de itens e produtos
 * - Controle de estoque integrado
 * - Conquistas automáticas
 * - Relatórios e analytics
 * - Cálculo automático de recompensas
 */

const { query, beginTransaction, commitTransaction, rollbackTransaction } = require('../models/database');
const { logger, auditLogger } = require('../utils/logger');
const { ApiError, asyncHandler } = require('../utils/errors');
const { successResponse, paginatedResponse } = require('../utils/formatters');
const Joi = require('joi');
const { v4: uuidv4 } = require('uuid');

class SaleController {

  /**
   * 📝 VALIDAÇÕES JOI
   */
  static createSaleSchema = Joi.object({
    client_id: Joi.string().required()
      .messages({
        'any.required': 'Cliente é obrigatório'
      }),
    description: Joi.string().max(1000).allow(null),
    sale_date: Joi.date().default(() => new Date()),
    payment_method: Joi.string().valid(
      'cash', 'credit_card', 'debit_card', 'pix', 'bank_transfer', 'check', 'other'
    ).default('cash'),
    payment_status: Joi.string().valid(
      'pending', 'paid', 'partially_paid', 'overdue', 'cancelled'
    ).default('pending'),
    discount_amount: Joi.number().min(0).default(0),
    tax_amount: Joi.number().min(0).default(0),
    items: Joi.array().items(
      Joi.object({
        product_id: Joi.string().allow(null),
        product_name: Joi.string().required(),
        quantity: Joi.number().positive().required(),
        unit_price: Joi.number().min(0).required(),
        total_price: Joi.number().min(0).required()
      })
    ).min(1).required()
      .messages({
        'array.min': 'Pelo menos um item é obrigatório'
      })
  });

  static updateSaleSchema = Joi.object({
    description: Joi.string().max(1000).allow(null),
    payment_method: Joi.string().valid(
      'cash', 'credit_card', 'debit_card', 'pix', 'bank_transfer', 'check', 'other'
    ),
    payment_status: Joi.string().valid(
      'pending', 'paid', 'partially_paid', 'overdue', 'cancelled'
    ),
    discount_amount: Joi.number().min(0),
    tax_amount: Joi.number().min(0)
  });

  static addItemSchema = Joi.object({
    product_id: Joi.string().allow(null),
    product_name: Joi.string().required(),
    quantity: Joi.number().positive().required(),
    unit_price: Joi.number().min(0).required()
  });

  /**
   * 📋 LISTAR VENDAS
   * GET /api/sales
   */
  static index = asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = (page - 1) * limit;
    
    let whereClause = 'WHERE s.company_id = $1 AND s.deleted_at IS NULL';
    let queryParams = [req.user.companyId];
    let paramCount = 1;

    // 🔍 FILTROS AVANÇADOS
    if (req.query.status) {
      const statuses = req.query.status.split(',');
      whereClause += ` AND s.status = ANY($${++paramCount})`;
      queryParams.push(statuses);
    }

    if (req.query.payment_status) {
      const paymentStatuses = req.query.payment_status.split(',');
      whereClause += ` AND s.payment_status = ANY($${++paramCount})`;
      queryParams.push(paymentStatuses);
    }

    if (req.query.user_id) {
      whereClause += ` AND s.user_id = $${++paramCount}`;
      queryParams.push(req.query.user_id);
    }

    if (req.query.client_id) {
      whereClause += ` AND s.client_id = $${++paramCount}`;
      queryParams.push(req.query.client_id);
    }

    if (req.query.date_from) {
      whereClause += ` AND s.sale_date >= $${++paramCount}`;
      queryParams.push(req.query.date_from);
    }

    if (req.query.date_to) {
      whereClause += ` AND s.sale_date <= $${++paramCount}`;
      queryParams.push(req.query.date_to);
    }

    if (req.query.amount_min) {
      whereClause += ` AND s.total_amount >= $${++paramCount}`;
      queryParams.push(parseFloat(req.query.amount_min));
    }

    if (req.query.amount_max) {
      whereClause += ` AND s.total_amount <= $${++paramCount}`;
      queryParams.push(parseFloat(req.query.amount_max));
    }

    if (req.query.search) {
      whereClause += ` AND (
        c.name ILIKE $${++paramCount} OR 
        c.email ILIKE $${++paramCount} OR 
        s.description ILIKE $${++paramCount}
      )`;
      const searchTerm = `%${req.query.search}%`;
      queryParams.push(searchTerm, searchTerm, searchTerm);
      paramCount += 2;
    }

    // 📊 ORDENAÇÃO
    const validSortFields = ['sale_date', 'total_amount', 'client_name', 'status', 'payment_status'];
    const sortField = validSortFields.includes(req.query.sort) ? 
      (req.query.sort === 'client_name' ? 'c.name' : `s.${req.query.sort}`) : 
      's.sale_date';
    const sortOrder = req.query.order === 'asc' ? 'ASC' : 'DESC';

    // 🔍 QUERY PRINCIPAL
    const salesQuery = `
      SELECT 
        s.*,
        c.name as client_name,
        c.email as client_email,
        c.company as client_company,
        u.name as seller_name,
        u.email as seller_email,
        COUNT(si.id) as items_count
      FROM sales s
      LEFT JOIN clients c ON s.client_id = c.id
      LEFT JOIN users u ON s.user_id = u.id
      LEFT JOIN sale_items si ON s.id = si.sale_id
      ${whereClause}
      GROUP BY s.id, c.name, c.email, c.company, u.name, u.email
      ORDER BY ${sortField} ${sortOrder}
      LIMIT $${++paramCount} OFFSET $${++paramCount}
    `;
    
    queryParams.push(limit, offset);

    // 📊 QUERY DE CONTAGEM
    const countQuery = `
      SELECT COUNT(DISTINCT s.id) as total 
      FROM sales s
      LEFT JOIN clients c ON s.client_id = c.id
      ${whereClause}
    `;

    // 📈 QUERY DE ESTATÍSTICAS
    const statsQuery = `
      SELECT 
        COUNT(*) as total_sales,
        COALESCE(SUM(total_amount), 0) as total_revenue,
        COALESCE(AVG(total_amount), 0) as average_ticket,
        COUNT(CASE WHEN payment_status = 'paid' THEN 1 END) as paid_sales,
        COUNT(CASE WHEN payment_status = 'pending' THEN 1 END) as pending_sales,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_sales,
        COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_sales,
        MAX(total_amount) as highest_sale
      FROM sales s
      WHERE s.company_id = $1 AND s.deleted_at IS NULL
    `;

    const [salesResult, countResult, statsResult] = await Promise.all([
      query(salesQuery, queryParams),
      query(countQuery, queryParams.slice(0, -2)),
      query(statsQuery, [req.user.companyId])
    ]);

    return paginatedResponse(res, salesResult.rows, {
      page,
      limit,
      total: parseInt(countResult.rows[0].total),
      stats: statsResult.rows[0]
    });
  });

  /**
   * ➕ CRIAR VENDA
   * POST /api/sales
   */
  static create = asyncHandler(async (req, res) => {
    const { error, value } = SaleController.createSaleSchema.validate(req.body);
    if (error) throw new ApiError(400, error.details[0].message);

    const saleData = value;

    // 🔍 Verificar se cliente existe
    const clientCheck = await query(
      'SELECT id, name, email FROM clients WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL',
      [saleData.client_id, req.user.companyId]
    );

    if (clientCheck.rows.length === 0) {
      throw new ApiError(404, 'Client not found');
    }

    const client = clientCheck.rows[0];

    // 💰 Calcular totais
    const subtotal = saleData.items.reduce((sum, item) => sum + item.total_price, 0);
    const totalAmount = subtotal - saleData.discount_amount + saleData.tax_amount;

    if (totalAmount < 0) {
      throw new ApiError(400, 'Total amount cannot be negative');
    }

    const transaction = await beginTransaction();
    
    try {
      // 1️⃣ CRIAR VENDA
      const createSaleQuery = `
        INSERT INTO sales (
          id, company_id, client_id, user_id, description, sale_date,
          payment_method, payment_status, subtotal, discount_amount,
          tax_amount, total_amount, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'completed')
        RETURNING *
      `;

      const newSaleResult = await query(createSaleQuery, [
        uuidv4(),
        req.user.companyId,
        saleData.client_id,
        req.user.id,
        saleData.description,
        saleData.sale_date,
        saleData.payment_method,
        saleData.payment_status,
        subtotal,
        saleData.discount_amount,
        saleData.tax_amount,
        totalAmount
      ], transaction);

      const newSale = newSaleResult.rows[0];

      // 2️⃣ ADICIONAR ITENS DA VENDA
      for (const item of saleData.items) {
        await query(`
          INSERT INTO sale_items (
            id, sale_id, product_id, product_name, quantity, unit_price, total_price
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [
          uuidv4(),
          newSale.id,
          item.product_id,
          item.product_name,
          item.quantity,
          item.unit_price,
          item.total_price
        ], transaction);

        // 📦 Atualizar estoque do produto (se existe e tem controle de estoque)
        if (item.product_id) {
          const stockUpdate = await query(`
            UPDATE products 
            SET current_stock = current_stock - $1, updated_at = NOW()
            WHERE id = $2 AND company_id = $3 AND track_stock = true
            RETURNING current_stock, min_stock_level
          `, [item.quantity, item.product_id, req.user.companyId], transaction);

          // 🚨 Verificar se estoque ficou abaixo do mínimo
          if (stockUpdate.rows.length > 0) {
            const { current_stock, min_stock_level } = stockUpdate.rows[0];
            if (current_stock <= min_stock_level) {
              // TODO: Criar notificação de estoque baixo
              logger.warn('Low stock alert', {
                productId: item.product_id,
                currentStock: current_stock,
                minLevel: min_stock_level,
                companyId: req.user.companyId
              });
            }
          }
        }
      }

      // 3️⃣ ATUALIZAR ESTATÍSTICAS DO CLIENTE
      await query(`
        UPDATE clients 
        SET 
          total_spent = COALESCE(total_spent, 0) + $1,
          total_purchases = COALESCE(total_purchases, 0) + 1,
          last_purchase_at = NOW(),
          updated_at = NOW()
        WHERE id = $2
      `, [totalAmount, saleData.client_id], transaction);

      // 4️⃣ GAMIFICAÇÃO: Conceder XP/Coins pela venda
      const xpReward = Math.floor(totalAmount / 100) + 30; // 1 XP por R$ 100 + bonus fixo
      const coinReward = Math.floor(totalAmount / 200) + 15; // 1 coin por R$ 200 + bonus fixo

      await query(`
        UPDATE user_gamification_profiles 
        SET 
          total_xp = total_xp + $1, 
          current_coins = current_coins + $2,
          updated_at = NOW()
        WHERE user_id = $3 AND company_id = $4
      `, [xpReward, coinReward, req.user.id, req.user.companyId], transaction);

      // 5️⃣ Registrar no histórico de gamificação
      await query(`
        INSERT INTO gamification_history (user_id, company_id, type, amount, reason, action_type)
        VALUES 
          ($1, $2, 'xp', $3, $4, 'sale_completed'),
          ($1, $2, 'coins', $5, $4, 'sale_completed')
      `, [
        req.user.id, 
        req.user.companyId, 
        xpReward, 
        `Sale completed: ${client.name} - R$ ${totalAmount.toFixed(2)}`,
        coinReward
      ], transaction);

      // 6️⃣ VERIFICAR CONQUISTAS relacionadas a vendas
      await SaleController.checkSaleAchievements(transaction, req.user.id, req.user.companyId, totalAmount);

      await commitTransaction(transaction);

      // 📊 Buscar venda completa com itens para retorno
      const completeSaleQuery = `
        SELECT 
          s.*,
          c.name as client_name,
          c.email as client_email,
          json_agg(
            json_build_object(
              'id', si.id,
              'product_id', si.product_id,
              'product_name', si.product_name,
              'quantity', si.quantity,
              'unit_price', si.unit_price,
              'total_price', si.total_price
            ) ORDER BY si.id
          ) as items
        FROM sales s
        LEFT JOIN clients c ON s.client_id = c.id
        LEFT JOIN sale_items si ON s.id = si.sale_id
        WHERE s.id = $1
        GROUP BY s.id, c.name, c.email
      `;

      const completeSaleResult = await query(completeSaleQuery, [newSale.id]);

      // 📋 Log de auditoria
      auditLogger('Sale created', {
        userId: req.user.id,
        companyId: req.user.companyId,
        entityType: 'sale',
        entityId: newSale.id,
        action: 'create',
        changes: {
          client_id: saleData.client_id,
          client_name: client.name,
          total_amount: totalAmount,
          items_count: saleData.items.length
        },
        ip: req.ip
      });

      return successResponse(res, completeSaleResult.rows[0], 'Sale created successfully', 201);

    } catch (error) {
      await rollbackTransaction(transaction);
      throw error;
    }
  });

  /**
   * 👁️ DETALHES DA VENDA
   * GET /api/sales/:id
   */
  static show = asyncHandler(async (req, res) => {
    const saleId = req.params.id;

    const saleQuery = `
      SELECT 
        s.*,
        c.name as client_name,
        c.email as client_email,
        c.phone as client_phone,
        c.company as client_company,
        u.name as seller_name,
        u.email as seller_email,
        json_agg(
          json_build_object(
            'id', si.id,
            'product_id', si.product_id,
            'product_name', si.product_name,
            'quantity', si.quantity,
            'unit_price', si.unit_price,
            'total_price', si.total_price
          ) ORDER BY si.id
        ) FILTER (WHERE si.id IS NOT NULL) as items
      FROM sales s
      LEFT JOIN clients c ON s.client_id = c.id
      LEFT JOIN users u ON s.user_id = u.id
      LEFT JOIN sale_items si ON s.id = si.sale_id
      WHERE s.id = $1 AND s.company_id = $2 AND s.deleted_at IS NULL
      GROUP BY s.id, c.name, c.email, c.phone, c.company, u.name, u.email
    `;
    
    const saleResult = await query(saleQuery, [saleId, req.user.companyId]);
    
    if (saleResult.rows.length === 0) {
      throw new ApiError(404, 'Sale not found');
    }

    return successResponse(res, saleResult.rows[0]);
  });

  /**
   * ✏️ ATUALIZAR VENDA
   * PUT /api/sales/:id
   */
  static update = asyncHandler(async (req, res) => {
    const saleId = req.params.id;
    const { error, value } = SaleController.updateSaleSchema.validate(req.body);
    if (error) throw new ApiError(400, error.details[0].message);

    const updateData = value;

    // Verificar se venda existe e pode ser editada
    const saleCheck = await query(
      'SELECT * FROM sales WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL',
      [saleId, req.user.companyId]
    );

    if (saleCheck.rows.length === 0) {
      throw new ApiError(404, 'Sale not found');
    }

    const currentSale = saleCheck.rows[0];

    if (currentSale.status === 'cancelled') {
      throw new ApiError(400, 'Cannot update cancelled sale');
    }

    // 🔄 CONSTRUIR QUERY DE UPDATE
    const updateFields = [];
    const updateValues = [];
    let paramCount = 0;

    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== undefined) {
        paramCount++;
        updateFields.push(`${key} = $${paramCount}`);
        updateValues.push(updateData[key]);
      }
    });

    updateFields.push(`updated_at = NOW()`);
    updateValues.push(saleId, req.user.companyId);

    const updateQuery = `
      UPDATE sales 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramCount + 1} AND company_id = $${paramCount + 2}
      RETURNING *
    `;

    const updatedSaleResult = await query(updateQuery, updateValues);

    // 📋 Log de auditoria
    auditLogger('Sale updated', {
      userId: req.user.id,
      companyId: req.user.companyId,
      entityType: 'sale',
      entityId: saleId,
      action: 'update',
      changes: updateData,
      ip: req.ip
    });

    return successResponse(res, updatedSaleResult.rows[0], 'Sale updated successfully');
  });

  /**
   * ❌ CANCELAR VENDA
   * DELETE /api/sales/:id
   */
  static destroy = asyncHandler(async (req, res) => {
    const saleId = req.params.id;

    // 🔍 Verificar se venda existe
    const saleCheck = await query(
      `SELECT s.*, c.name as client_name 
       FROM sales s 
       LEFT JOIN clients c ON s.client_id = c.id
       WHERE s.id = $1 AND s.company_id = $2 AND s.deleted_at IS NULL`,
      [saleId, req.user.companyId]
    );

    if (saleCheck.rows.length === 0) {
      throw new ApiError(404, 'Sale not found');
    }

    const sale = saleCheck.rows[0];

    if (sale.status === 'cancelled') {
      throw new ApiError(400, 'Sale already cancelled');
    }

    const transaction = await beginTransaction();

    try {
      // 1️⃣ CANCELAR VENDA
      await query(`
        UPDATE sales 
        SET status = 'cancelled', updated_at = NOW()
        WHERE id = $1
      `, [saleId], transaction);

      // 2️⃣ REVERTER ESTOQUE dos produtos
      const saleItemsQuery = await query(
        'SELECT product_id, quantity FROM sale_items WHERE sale_id = $1 AND product_id IS NOT NULL',
        [saleId],
        transaction
      );

      for (const item of saleItemsQuery.rows) {
        await query(`
          UPDATE products 
          SET current_stock = current_stock + $1, updated_at = NOW()
          WHERE id = $2 AND company_id = $3 AND track_stock = true
        `, [item.quantity, item.product_id, req.user.companyId], transaction);
      }

      // 3️⃣ REVERTER ESTATÍSTICAS DO CLIENTE
      await query(`
        UPDATE clients 
        SET 
          total_spent = COALESCE(total_spent, 0) - $1,
          total_purchases = COALESCE(total_purchases, 1) - 1,
          updated_at = NOW()
        WHERE id = $2
      `, [sale.total_amount, sale.client_id], transaction);

      await commitTransaction(transaction);

      // 📋 Log de auditoria
      auditLogger('Sale cancelled', {
        userId: req.user.id,
        companyId: req.user.companyId,
        entityType: 'sale',
        entityId: saleId,
        action: 'cancel',
        changes: {
          client_name: sale.client_name,
          total_amount: sale.total_amount,
          reason: 'Manual cancellation'
        },
        ip: req.ip
      });

      return successResponse(res, { id: saleId, status: 'cancelled' }, 'Sale cancelled successfully');

    } catch (error) {
      await rollbackTransaction(transaction);
      throw error;
    }
  });

  /**
   * 🏆 VERIFICAR CONQUISTAS DE VENDAS
   */
  static async checkSaleAchievements(transaction, userId, companyId, saleAmount) {
    // 🥇 Verificar primeira venda
    const salesCount = await query(
      'SELECT COUNT(*) as count FROM sales WHERE user_id = $1 AND company_id = $2 AND status != $3 AND deleted_at IS NULL',
      [userId, companyId, 'cancelled'],
      transaction
    );

    if (parseInt(salesCount.rows[0].count) === 1) {
      await SaleController.unlockAchievement(transaction, userId, companyId, 'first_sale');
    }

    // 💎 Verificar venda de alto valor (R$ 10.000+)
    if (saleAmount >= 10000) {
      await SaleController.unlockAchievement(transaction, userId, companyId, 'high_value_sale');
    }

    // 🎯 Verificar meta mensal de vendas
    const monthlySalesQuery = await query(`
      SELECT COALESCE(SUM(total_amount), 0) as total
      FROM sales 
      WHERE user_id = $1 AND company_id = $2 
      AND sale_date >= DATE_TRUNC('month', CURRENT_DATE)
      AND status != 'cancelled'
      AND deleted_at IS NULL
    `, [userId, companyId], transaction);

    const monthlyTotal = monthlySalesQuery.rows[0]?.total ? parseFloat(monthlySalesQuery.rows[0].total) : 0;
    
    if (monthlyTotal >= 50000) {
      await SaleController.unlockAchievement(transaction, userId, companyId, 'monthly_sales_50k');
    }

    if (monthlyTotal >= 100000) {
      await SaleController.unlockAchievement(transaction, userId, companyId, 'monthly_sales_100k');
    }
  }

  /**
   * 🏆 DESBLOQUEAR CONQUISTA
   */
  static async unlockAchievement(transaction, userId, companyId, achievementCode) {
    const achievementQuery = `
      SELECT id, name, xp_reward, coin_reward FROM achievements 
      WHERE company_id = $1 AND unlock_criteria->>'action' = $2 AND is_active = true
    `;
    
    const achievementResult = await query(achievementQuery, [companyId, achievementCode], transaction);
    
    if (achievementResult.rows.length > 0) {
      const achievement = achievementResult.rows[0];
      
      // Verificar se já foi desbloqueada
      const userAchievementCheck = await query(
        'SELECT id FROM user_achievements WHERE user_id = $1 AND achievement_id = $2',
        [userId, achievement.id],
        transaction
      );

      if (userAchievementCheck.rows.length === 0) {
        // Desbloquear conquista
        await query(
          'INSERT INTO user_achievements (user_id, achievement_id) VALUES ($1, $2)',
          [userId, achievement.id],
          transaction
        );

        // Conceder recompensas da conquista
        if (achievement.xp_reward > 0 || achievement.coin_reward > 0) {
          await query(`
            UPDATE user_gamification_profiles 
            SET total_xp = total_xp + $1, current_coins = current_coins + $2
            WHERE user_id = $3 AND company_id = $4
          `, [achievement.xp_reward, achievement.coin_reward, userId, companyId], transaction);

          // Registrar no histórico
          await query(`
            INSERT INTO gamification_history (user_id, company_id, type, amount, reason, action_type)
            VALUES 
              ($1, $2, 'xp', $3, $4, 'achievement_unlocked'),
              ($1, $2, 'coins', $5, $4, 'achievement_unlocked')
          `, [
            userId, companyId, 
            achievement.xp_reward, 
            `Achievement unlocked: ${achievement.name}`,
            achievement.coin_reward
          ], transaction);
        }

        logger.info('Achievement unlocked', {
          userId,
          companyId,
          achievementCode,
          achievementName: achievement.name,
          xpReward: achievement.xp_reward,
          coinReward: achievement.coin_reward
        });
      }
    }
  }

  // TODO: Implementar métodos restantes:
  // - getReports (relatórios detalhados)
  // - getAnalytics (analytics avançados)  
  // - addItem (adicionar item à venda existente)
  // - removeItem (remover item da venda)
}

module.exports = SaleController;