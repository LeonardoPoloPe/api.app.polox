const { query, transaction } = require('../config/database');
const { ApiError, ValidationError, NotFoundError } = require('../utils/errors');

/**
 * Model para gerenciamento de vendas
 * Baseado no schema polox.sales
 */
class SaleModel {
  /**
   * Cria uma nova venda
   * @param {Object} saleData - Dados da venda
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object>} Venda criada
   */
  static async create(saleData, companyId) {
    const {
      client_id,
      user_id,
      sale_number,
      total_amount,
      discount_amount = 0,
      tax_amount = 0,
      status = 'pending',
      sale_date,
      delivery_date,
      payment_method,
      payment_status = 'pending',
      payment_due_date,
      description,
      notes,
      tags = [],
      commission_percentage = 0,
      items = [] // Array de itens da venda
    } = saleData;

    // Validar dados obrigatórios
    if (!total_amount || total_amount <= 0) {
      throw new ValidationError('Valor total deve ser maior que zero');
    }

    if (!sale_date) {
      throw new ValidationError('Data da venda é obrigatória');
    }

    const net_amount = total_amount - discount_amount + tax_amount;
    const commission_amount = (net_amount * commission_percentage) / 100;

    return await transaction(async (client) => {
      // Inserir venda
      const insertSaleQuery = `
        INSERT INTO polox.sales (
          company_id, client_id, user_id, sale_number, total_amount,
          discount_amount, tax_amount, net_amount, status, sale_date,
          delivery_date, payment_method, payment_status, payment_due_date,
          description, notes, tags, commission_percentage, commission_amount,
          created_at, updated_at
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
          $11, $12, $13, $14, $15, $16, $17, $18, $19,
          NOW(), NOW()
        )
        RETURNING 
          id, company_id, client_id, user_id, sale_number, total_amount,
          discount_amount, tax_amount, net_amount, status, sale_date,
          delivery_date, payment_method, payment_status, payment_due_date,
          description, notes, tags, commission_percentage, commission_amount,
          created_at, updated_at
      `;

      const saleResult = await client.query(insertSaleQuery, [
        companyId, client_id, user_id, sale_number, total_amount,
        discount_amount, tax_amount, net_amount, status, sale_date,
        delivery_date, payment_method, payment_status, payment_due_date,
        description, notes, JSON.stringify(tags), commission_percentage, commission_amount
      ]);

      const sale = saleResult.rows[0];

      // Inserir itens da venda se fornecidos
      if (items && items.length > 0) {
        for (const item of items) {
          const insertItemQuery = `
            INSERT INTO polox.sale_items (
              sale_id, product_id, product_name, quantity, unit_price,
              total_price, discount_percentage, discount_amount
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          `;

          await client.query(insertItemQuery, [
            sale.id,
            item.product_id,
            item.product_name,
            item.quantity,
            item.unit_price,
            item.total_price,
            item.discount_percentage || 0,
            item.discount_amount || 0
          ]);
        }
      }

      return sale;
    }, { companyId });
  }

  /**
   * Busca venda por ID
   * @param {number} id - ID da venda
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object|null>} Venda encontrada ou null
   */
  static async findById(id, companyId) {
    const selectQuery = `
      SELECT 
        s.*,
        c.name as client_name,
        c.email as client_email,
        c.phone as client_phone,
        u.name as seller_name,
        u.email as seller_email
      FROM polox.sales s
      LEFT JOIN polox.clients c ON s.client_id = c.id
      LEFT JOIN polox.users u ON s.user_id = u.id
      WHERE s.id = $1 AND s.company_id = $2 AND s.deleted_at IS NULL
    `;

    try {
      const result = await query(selectQuery, [id, companyId], { companyId });
      
      if (result.rows.length === 0) {
        return null;
      }

      const sale = result.rows[0];

      // Buscar itens da venda
      const itemsQuery = `
        SELECT 
          si.*,
          p.name as product_full_name,
          p.code as product_code
        FROM polox.sale_items si
        LEFT JOIN polox.products p ON si.product_id = p.id
        WHERE si.sale_id = $1
        ORDER BY si.id
      `;

      const itemsResult = await query(itemsQuery, [id], { companyId });
      sale.items = itemsResult.rows;

      return sale;
    } catch (error) {
      throw new ApiError(500, `Erro ao buscar venda: ${error.message}`);
    }
  }

  /**
   * Lista vendas com filtros e paginação
   * @param {Object} options - Opções de busca
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object>} Lista de vendas e metadados
   */
  static async list(options = {}, companyId) {
    const {
      page = 1,
      limit = 10,
      status = null,
      payment_status = null,
      client_id = null,
      user_id = null,
      date_from = null,
      date_to = null,
      search = null,
      sortBy = 'created_at',
      sortOrder = 'DESC'
    } = options;

    const offset = (page - 1) * limit;
    const conditions = ['s.company_id = $1', 's.deleted_at IS NULL'];
    const values = [companyId];
    let paramCount = 2;

    // Adicionar filtros
    if (status) {
      conditions.push(`s.status = $${paramCount}`);
      values.push(status);
      paramCount++;
    }

    if (payment_status) {
      conditions.push(`s.payment_status = $${paramCount}`);
      values.push(payment_status);
      paramCount++;
    }

    if (client_id) {
      conditions.push(`s.client_id = $${paramCount}`);
      values.push(client_id);
      paramCount++;
    }

    if (user_id) {
      conditions.push(`s.user_id = $${paramCount}`);
      values.push(user_id);
      paramCount++;
    }

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

    if (search) {
      conditions.push(`(s.sale_number ILIKE $${paramCount} OR s.description ILIKE $${paramCount} OR c.name ILIKE $${paramCount})`);
      values.push(`%${search}%`);
      paramCount++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Query para contar total
    const countQuery = `
      SELECT COUNT(*) 
      FROM polox.sales s 
      LEFT JOIN polox.clients c ON s.client_id = c.id
      ${whereClause}
    `;

    // Query para buscar dados
    const selectQuery = `
      SELECT 
        s.id, s.sale_number, s.total_amount, s.discount_amount, s.net_amount,
        s.status, s.payment_status, s.sale_date, s.payment_date, s.payment_due_date,
        s.commission_amount, s.description, s.created_at, s.updated_at,
        c.name as client_name,
        c.email as client_email,
        u.name as seller_name,
        (SELECT COUNT(*) FROM polox.sale_items WHERE sale_id = s.id) as items_count
      FROM polox.sales s
      LEFT JOIN polox.clients c ON s.client_id = c.id
      LEFT JOIN polox.users u ON s.user_id = u.id
      ${whereClause}
      ORDER BY s.${sortBy} ${sortOrder}
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
      throw new ApiError(500, `Erro ao listar vendas: ${error.message}`);
    }
  }

  /**
   * Atualiza dados da venda
   * @param {number} id - ID da venda
   * @param {Object} updateData - Dados para atualizar
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object|null>} Venda atualizada ou null
   */
  static async update(id, updateData, companyId) {
    const allowedFields = [
      'status', 'payment_status', 'delivery_date', 'payment_date',
      'payment_method', 'description', 'notes', 'tags'
    ];

    const updates = [];
    const values = [];
    let paramCount = 1;

    // Construir query dinamicamente
    for (const [key, value] of Object.entries(updateData)) {
      if (allowedFields.includes(key)) {
        if (key === 'tags') {
          updates.push(`${key} = $${paramCount}`);
          values.push(JSON.stringify(value));
        } else {
          updates.push(`${key} = $${paramCount}`);
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
      UPDATE polox.sales 
      SET ${updates.join(', ')}
      WHERE id = $${paramCount} AND company_id = $${paramCount + 1} AND deleted_at IS NULL
      RETURNING 
        id, sale_number, total_amount, net_amount, status, payment_status,
        sale_date, payment_date, created_at, updated_at
    `;

    try {
      const result = await query(updateQuery, values, { companyId });
      return result.rows[0] || null;
    } catch (error) {
      throw new ApiError(500, `Erro ao atualizar venda: ${error.message}`);
    }
  }

  /**
   * Confirma venda e atualiza estatísticas do cliente
   * @param {number} id - ID da venda
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object>} Venda confirmada
   */
  static async confirm(id, companyId) {
    return await transaction(async (client) => {
      // Atualizar status da venda
      const updateSaleQuery = `
        UPDATE polox.sales 
        SET status = 'confirmed', updated_at = NOW()
        WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL
        RETURNING *
      `;

      const saleResult = await client.query(updateSaleQuery, [id, companyId]);
      
      if (saleResult.rows.length === 0) {
        throw new NotFoundError('Venda');
      }

      const sale = saleResult.rows[0];

      // Atualizar estatísticas do cliente se existir
      if (sale.client_id) {
        const updateClientQuery = `
          UPDATE polox.clients 
          SET 
            total_spent = COALESCE(total_spent, 0) + $1,
            total_orders = COALESCE(total_orders, 0) + 1,
            last_purchase_date = $2,
            updated_at = NOW()
          WHERE id = $3 AND company_id = $4
        `;

        await client.query(updateClientQuery, [
          sale.net_amount,
          sale.sale_date,
          sale.client_id,
          companyId
        ]);

        // Recalcular ticket médio
        const updateAvgQuery = `
          UPDATE polox.clients 
          SET average_order_value = total_spent / NULLIF(total_orders, 0)
          WHERE id = $1 AND company_id = $2
        `;

        await client.query(updateAvgQuery, [sale.client_id, companyId]);
      }

      return sale;
    }, { companyId });
  }

  /**
   * Cancela venda
   * @param {number} id - ID da venda
   * @param {string} reason - Motivo do cancelamento
   * @param {number} companyId - ID da empresa
   * @returns {Promise<boolean>} True se cancelada com sucesso
   */
  static async cancel(id, reason, companyId) {
    const updateQuery = `
      UPDATE polox.sales 
      SET 
        status = 'cancelled',
        notes = COALESCE(notes, '') || '\nCancelamento: ' || $1,
        updated_at = NOW()
      WHERE id = $2 AND company_id = $3 AND deleted_at IS NULL AND status != 'confirmed'
    `;

    try {
      const result = await query(updateQuery, [reason, id, companyId], { companyId });
      return result.rowCount > 0;
    } catch (error) {
      throw new ApiError(500, `Erro ao cancelar venda: ${error.message}`);
    }
  }

  /**
   * Registra pagamento da venda
   * @param {number} id - ID da venda
   * @param {Object} paymentData - Dados do pagamento
   * @param {number} companyId - ID da empresa
   * @returns {Promise<boolean>} True se registrado com sucesso
   */
  static async recordPayment(id, paymentData, companyId) {
    const { payment_date, payment_method, notes } = paymentData;

    const updateQuery = `
      UPDATE polox.sales 
      SET 
        payment_status = 'paid',
        payment_date = $1,
        payment_method = COALESCE($2, payment_method),
        notes = COALESCE(notes, '') || '\nPagamento registrado: ' || $3,
        updated_at = NOW()
      WHERE id = $4 AND company_id = $5 AND deleted_at IS NULL
    `;

    try {
      const result = await query(updateQuery, [
        payment_date, payment_method, notes || '', id, companyId
      ], { companyId });
      return result.rowCount > 0;
    } catch (error) {
      throw new ApiError(500, `Erro ao registrar pagamento: ${error.message}`);
    }
  }

  /**
   * Soft delete da venda
   * @param {number} id - ID da venda
   * @param {number} companyId - ID da empresa
   * @returns {Promise<boolean>} True se deletada com sucesso
   */
  static async softDelete(id, companyId) {
    const updateQuery = `
      UPDATE polox.sales 
      SET deleted_at = NOW(), updated_at = NOW()
      WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL AND status = 'pending'
    `;

    try {
      const result = await query(updateQuery, [id, companyId], { companyId });
      return result.rowCount > 0;
    } catch (error) {
      throw new ApiError(500, `Erro ao deletar venda: ${error.message}`);
    }
  }

  /**
   * Obtém estatísticas de vendas da empresa
   * @param {number} companyId - ID da empresa
   * @param {Object} filters - Filtros de período
   * @returns {Promise<Object>} Estatísticas das vendas
   */
  static async getStats(companyId, filters = {}) {
    const { date_from, date_to } = filters;
    const conditions = ['company_id = $1', 'deleted_at IS NULL'];
    const values = [companyId];
    let paramCount = 2;

    if (date_from) {
      conditions.push(`sale_date >= $${paramCount}`);
      values.push(date_from);
      paramCount++;
    }

    if (date_to) {
      conditions.push(`sale_date <= $${paramCount}`);
      values.push(date_to);
      paramCount++;
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const statsQuery = `
      SELECT 
        COUNT(*) as total_sales,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
        COUNT(CASE WHEN status = 'confirmed' THEN 1 END) as confirmed,
        COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled,
        COUNT(CASE WHEN payment_status = 'paid' THEN 1 END) as paid,
        COUNT(CASE WHEN payment_status = 'pending' THEN 1 END) as unpaid,
        COUNT(CASE WHEN payment_status = 'overdue' THEN 1 END) as overdue,
        COALESCE(SUM(total_amount), 0) as gross_revenue,
        COALESCE(SUM(net_amount), 0) as net_revenue,
        COALESCE(SUM(discount_amount), 0) as total_discounts,
        COALESCE(SUM(commission_amount), 0) as total_commissions,
        COALESCE(AVG(net_amount), 0) as average_sale_value,
        COUNT(DISTINCT client_id) as unique_clients,
        COUNT(DISTINCT user_id) as unique_sellers
      FROM polox.sales 
      ${whereClause}
    `;

    try {
      const result = await query(statsQuery, values, { companyId });
      return result.rows[0];
    } catch (error) {
      throw new ApiError(500, `Erro ao obter estatísticas: ${error.message}`);
    }
  }

  /**
   * Obtém ranking de vendedores
   * @param {number} companyId - ID da empresa
   * @param {Object} filters - Filtros de período
   * @param {number} limit - Quantidade de vendedores
   * @returns {Promise<Array>} Ranking de vendedores
   */
  static async getSellersRanking(companyId, filters = {}, limit = 10) {
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

    const rankingQuery = `
      SELECT 
        u.id, u.name, u.email,
        COUNT(s.id) as total_sales,
        COALESCE(SUM(s.net_amount), 0) as total_revenue,
        COALESCE(SUM(s.commission_amount), 0) as total_commission,
        COALESCE(AVG(s.net_amount), 0) as average_sale_value
      FROM polox.users u
      INNER JOIN polox.sales s ON u.id = s.user_id
      ${whereClause}
      GROUP BY u.id, u.name, u.email
      ORDER BY total_revenue DESC
      LIMIT $${paramCount}
    `;

    try {
      const result = await query(rankingQuery, [...values, limit], { companyId });
      return result.rows;
    } catch (error) {
      throw new ApiError(500, `Erro ao obter ranking de vendedores: ${error.message}`);
    }
  }
}

module.exports = SaleModel;