/**
 * ==========================================
 * 📊 ANALYTICS CONTROLLER - COPILOT_PROMPT_6
 * ==========================================
 * Dashboard de analytics e relatórios avançados
 * ==========================================
 */

const { query, beginTransaction, commitTransaction, rollbackTransaction } = require('../models/database');
const { asyncHandler, ApiError } = require('../utils/errors');
const { logger, auditLogger } = require('../utils/logger');
const { tc } = require('../config/i18n');
const { cache } = require('../config/cache');
const { trackUser } = require('../config/monitoring');
const { v4: uuidv4 } = require('uuid');

class AnalyticsController {

  /**
   * 📊 DASHBOARD PRINCIPAL
   * GET /api/analytics/dashboard
   */
  static getDashboard = asyncHandler(async (req, res) => {
    const { period = 'month' } = req.query;

    // Determinar filtro de data
    let dateFilter = '';
    let previousDateFilter = '';
    
    switch (period) {
      case 'week':
        dateFilter = "AND created_at >= DATE_TRUNC('week', CURRENT_DATE)";
        previousDateFilter = "AND created_at >= DATE_TRUNC('week', CURRENT_DATE) - INTERVAL '1 week' AND created_at < DATE_TRUNC('week', CURRENT_DATE)";
        break;
      case 'month':
        dateFilter = "AND created_at >= DATE_TRUNC('month', CURRENT_DATE)";
        previousDateFilter = "AND created_at >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month' AND created_at < DATE_TRUNC('month', CURRENT_DATE)";
        break;
      case 'quarter':
        dateFilter = "AND created_at >= DATE_TRUNC('quarter', CURRENT_DATE)";
        previousDateFilter = "AND created_at >= DATE_TRUNC('quarter', CURRENT_DATE) - INTERVAL '3 months' AND created_at < DATE_TRUNC('quarter', CURRENT_DATE)";
        break;
      case 'year':
        dateFilter = "AND created_at >= DATE_TRUNC('year', CURRENT_DATE)";
        previousDateFilter = "AND created_at >= DATE_TRUNC('year', CURRENT_DATE) - INTERVAL '1 year' AND created_at < DATE_TRUNC('year', CURRENT_DATE)";
        break;
    }

    // Vendas e receita
    const salesQuery = `
      SELECT 
        COUNT(*) as total_sales,
        SUM(total_amount) as total_revenue,
        AVG(total_amount) as avg_order_value,
        COUNT(DISTINCT customer_id) as unique_customers
      FROM sales 
      WHERE company_id = $1 AND deleted_at IS NULL ${dateFilter}
    `;

    const previousSalesQuery = `
      SELECT 
        COUNT(*) as total_sales,
        SUM(total_amount) as total_revenue,
        AVG(total_amount) as avg_order_value,
        COUNT(DISTINCT customer_id) as unique_customers
      FROM sales 
      WHERE company_id = $1 AND deleted_at IS NULL ${previousDateFilter}
    `;

    // Clientes
    const customersQuery = `
      SELECT 
        COUNT(*) as total_customers,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_customers,
        COUNT(CASE WHEN created_at >= DATE_TRUNC('${period}', CURRENT_DATE) THEN 1 END) as new_customers
      FROM customers 
      WHERE company_id = $1 AND deleted_at IS NULL
    `;

    // Produtos
    const productsQuery = `
      SELECT 
        COUNT(*) as total_products,
        COUNT(CASE WHEN stock_quantity <= alert_level THEN 1 END) as low_stock_products,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_products,
        SUM(stock_quantity * cost_price) as inventory_value
      FROM products 
      WHERE company_id = $1 AND deleted_at IS NULL
    `;

    // Tickets
    const ticketsQuery = `
      SELECT 
        COUNT(*) as total_tickets,
        COUNT(CASE WHEN status = 'open' THEN 1 END) as open_tickets,
        COUNT(CASE WHEN status IN ('resolved', 'closed') THEN 1 END) as resolved_tickets,
        ROUND(AVG(CASE 
          WHEN status IN ('resolved', 'closed') AND resolved_at IS NOT NULL 
          THEN EXTRACT(EPOCH FROM (resolved_at - created_at))/3600 
        END), 2) as avg_resolution_hours
      FROM tickets 
      WHERE company_id = $1 AND deleted_at IS NULL ${dateFilter}
    `;

    // Fornecedores
    const suppliersQuery = `
      SELECT 
        COUNT(*) as total_suppliers,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_suppliers,
        AVG(rating) as avg_supplier_rating
      FROM suppliers 
      WHERE company_id = $1 AND deleted_at IS NULL
    `;

    // Gamificação
    const gamificationQuery = `
      SELECT 
        COUNT(DISTINCT user_id) as active_users,
        SUM(total_xp) as total_xp_earned,
        SUM(current_coins) as total_coins_available,
        AVG(total_xp) as avg_user_xp
      FROM user_gamification_profiles 
      WHERE company_id = $1
    `;

    // Vendas por dia (últimos 30 dias)
    const dailySalesQuery = `
      SELECT 
        DATE(created_at) as sale_date,
        COUNT(*) as sales_count,
        SUM(total_amount) as daily_revenue
      FROM sales 
      WHERE company_id = $1 AND deleted_at IS NULL 
      AND created_at >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY DATE(created_at)
      ORDER BY sale_date ASC
    `;

    // Top produtos
    const topProductsQuery = `
      SELECT 
        p.id, p.name, p.sku,
        COUNT(si.id) as times_sold,
        SUM(si.quantity) as total_quantity_sold,
        SUM(si.subtotal) as total_revenue
      FROM products p
      JOIN sale_items si ON p.id = si.product_id
      JOIN sales s ON si.sale_id = s.id
      WHERE p.company_id = $1 AND p.deleted_at IS NULL 
      AND s.deleted_at IS NULL ${dateFilter}
      GROUP BY p.id, p.name, p.sku
      ORDER BY total_revenue DESC
      LIMIT 10
    `;

    try {
      const [
        salesResult,
        previousSalesResult,
        customersResult,
        productsResult,
        ticketsResult,
        suppliersResult,
        gamificationResult,
        dailySalesResult,
        topProductsResult
      ] = await Promise.all([
        query(salesQuery, [req.user.companyId]),
        query(previousSalesQuery, [req.user.companyId]),
        query(customersQuery, [req.user.companyId]),
        query(productsQuery, [req.user.companyId]),
        query(ticketsQuery, [req.user.companyId]),
        query(suppliersQuery, [req.user.companyId]),
        query(gamificationQuery, [req.user.companyId]),
        query(dailySalesQuery, [req.user.companyId]),
        query(topProductsQuery, [req.user.companyId])
      ]);

      const currentSales = salesResult.rows[0];
      const previousSales = previousSalesResult.rows[0];

      // Calcular comparações percentuais
      const calculateGrowth = (current, previous) => {
        if (!previous || previous === '0' || previous === 0) return 0;
        return Math.round(((parseFloat(current) - parseFloat(previous)) / parseFloat(previous)) * 100);
      };

      const dashboard = {
        period: period,
        overview: {
          sales: {
            total_sales: parseInt(currentSales.total_sales),
            total_revenue: parseFloat(currentSales.total_revenue) || 0,
            avg_order_value: parseFloat(currentSales.avg_order_value) || 0,
            unique_customers: parseInt(currentSales.unique_customers),
            growth: {
              sales: calculateGrowth(currentSales.total_sales, previousSales.total_sales),
              revenue: calculateGrowth(currentSales.total_revenue, previousSales.total_revenue),
              avg_order: calculateGrowth(currentSales.avg_order_value, previousSales.avg_order_value),
              customers: calculateGrowth(currentSales.unique_customers, previousSales.unique_customers)
            }
          },
          customers: customersResult.rows[0],
          products: {
            ...productsResult.rows[0],
            inventory_value: parseFloat(productsResult.rows[0].inventory_value) || 0
          },
          tickets: ticketsResult.rows[0],
          suppliers: {
            ...suppliersResult.rows[0],
            avg_supplier_rating: parseFloat(suppliersResult.rows[0].avg_supplier_rating) || 0
          },
          gamification: {
            ...gamificationResult.rows[0],
            total_xp_earned: parseInt(gamificationResult.rows[0].total_xp_earned) || 0,
            total_coins_available: parseInt(gamificationResult.rows[0].total_coins_available) || 0,
            avg_user_xp: parseFloat(gamificationResult.rows[0].avg_user_xp) || 0
          }
        },
        charts: {
          daily_sales: dailySalesResult.rows.map(row => ({
            date: row.sale_date,
            sales_count: parseInt(row.sales_count),
            revenue: parseFloat(row.daily_revenue)
          })),
          top_products: topProductsResult.rows.map(row => ({
            ...row,
            times_sold: parseInt(row.times_sold),
            total_quantity_sold: parseInt(row.total_quantity_sold),
            total_revenue: parseFloat(row.total_revenue)
          }))
        }
      };

      // Cache por 30 minutos
      await cache.set(`dashboard:${req.user.companyId}:${period}`, dashboard, 1800);

      res.json({
        success: true,
        data: dashboard
      });

    } catch (error) {
      logger.error('Dashboard analytics error:', error);
      throw new ApiError(500, tc(req, 'analyticsController', 'validation.dashboard_error'));
    }
  });

  /**
   * 🛒 ANALYTICS DE VENDAS
   * GET /api/analytics/sales
   */
  static getSalesAnalytics = asyncHandler(async (req, res) => {
    const { 
      period = 'month', 
      group_by = 'day',
      start_date,
      end_date 
    } = req.query;

    let dateFilter = '';
    let groupByClause = '';
    
    // Filtro de data customizado ou período predefinido
    if (start_date && end_date) {
      dateFilter = `AND s.created_at >= '${start_date}' AND s.created_at <= '${end_date} 23:59:59'`;
    } else {
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
      }
    }

    // Agrupamento
    switch (group_by) {
      case 'hour':
        groupByClause = "DATE_TRUNC('hour', s.created_at)";
        break;
      case 'day':
        groupByClause = "DATE_TRUNC('day', s.created_at)";
        break;
      case 'week':
        groupByClause = "DATE_TRUNC('week', s.created_at)";
        break;
      case 'month':
        groupByClause = "DATE_TRUNC('month', s.created_at)";
        break;
    }

    // Vendas por período
    const salesByPeriodQuery = `
      SELECT 
        ${groupByClause} as period,
        COUNT(*) as sales_count,
        SUM(s.total_amount) as total_revenue,
        AVG(s.total_amount) as avg_order_value,
        COUNT(DISTINCT s.customer_id) as unique_customers,
        SUM(s.profit_amount) as total_profit
      FROM sales s
      WHERE s.company_id = $1 AND s.deleted_at IS NULL ${dateFilter}
      GROUP BY ${groupByClause}
      ORDER BY period ASC
    `;

    // Vendas por método de pagamento
    const paymentMethodQuery = `
      SELECT 
        payment_method,
        COUNT(*) as sales_count,
        SUM(total_amount) as total_revenue,
        ROUND(AVG(total_amount), 2) as avg_order_value
      FROM sales s
      WHERE s.company_id = $1 AND s.deleted_at IS NULL ${dateFilter}
      GROUP BY payment_method
      ORDER BY total_revenue DESC
    `;

    // Vendas por status
    const statusQuery = `
      SELECT 
        status,
        COUNT(*) as sales_count,
        SUM(total_amount) as total_revenue
      FROM sales s
      WHERE s.company_id = $1 AND s.deleted_at IS NULL ${dateFilter}
      GROUP BY status
      ORDER BY total_revenue DESC
    `;

    // Top vendedores
    const topSellersQuery = `
      SELECT 
        u.id, u.full_name,
        COUNT(*) as sales_count,
        SUM(s.total_amount) as total_revenue,
        AVG(s.total_amount) as avg_order_value,
        SUM(s.profit_amount) as total_profit
      FROM sales s
      JOIN users u ON s.user_id = u.id
      WHERE s.company_id = $1 AND s.deleted_at IS NULL ${dateFilter}
      GROUP BY u.id, u.full_name
      ORDER BY total_revenue DESC
      LIMIT 10
    `;

    // Análise de horários de pico
    const peakHoursQuery = `
      SELECT 
        EXTRACT(HOUR FROM s.created_at) as hour,
        COUNT(*) as sales_count,
        SUM(s.total_amount) as total_revenue
      FROM sales s
      WHERE s.company_id = $1 AND s.deleted_at IS NULL ${dateFilter}
      GROUP BY EXTRACT(HOUR FROM s.created_at)
      ORDER BY hour
    `;

    try {
      const [
        salesByPeriodResult,
        paymentMethodResult,
        statusResult,
        topSellersResult,
        peakHoursResult
      ] = await Promise.all([
        query(salesByPeriodQuery, [req.user.companyId]),
        query(paymentMethodQuery, [req.user.companyId]),
        query(statusQuery, [req.user.companyId]),
        query(topSellersQuery, [req.user.companyId]),
        query(peakHoursQuery, [req.user.companyId])
      ]);

      const analytics = {
        period: period,
        group_by: group_by,
        sales_by_period: salesByPeriodResult.rows.map(row => ({
          period: row.period,
          sales_count: parseInt(row.sales_count),
          total_revenue: parseFloat(row.total_revenue),
          avg_order_value: parseFloat(row.avg_order_value),
          unique_customers: parseInt(row.unique_customers),
          total_profit: parseFloat(row.total_profit) || 0
        })),
        by_payment_method: paymentMethodResult.rows.map(row => ({
          payment_method: row.payment_method,
          sales_count: parseInt(row.sales_count),
          total_revenue: parseFloat(row.total_revenue),
          avg_order_value: parseFloat(row.avg_order_value)
        })),
        by_status: statusResult.rows.map(row => ({
          status: row.status,
          sales_count: parseInt(row.sales_count),
          total_revenue: parseFloat(row.total_revenue)
        })),
        top_sellers: topSellersResult.rows.map(row => ({
          ...row,
          sales_count: parseInt(row.sales_count),
          total_revenue: parseFloat(row.total_revenue),
          avg_order_value: parseFloat(row.avg_order_value),
          total_profit: parseFloat(row.total_profit) || 0
        })),
        peak_hours: peakHoursResult.rows.map(row => ({
          hour: parseInt(row.hour),
          sales_count: parseInt(row.sales_count),
          total_revenue: parseFloat(row.total_revenue)
        }))
      };

      res.json({
        success: true,
        data: analytics
      });

    } catch (error) {
      logger.error('Sales analytics error:', error);
      throw new ApiError(500, tc(req, 'analyticsController', 'validation.sales_error'));
    }
  });

  /**
   * 👥 ANALYTICS DE CLIENTES
   * GET /api/analytics/customers
   */
  static getCustomerAnalytics = asyncHandler(async (req, res) => {
    const { period = 'month' } = req.query;

    let dateFilter = '';
    switch (period) {
      case 'week':
        dateFilter = "AND c.created_at >= DATE_TRUNC('week', CURRENT_DATE)";
        break;
      case 'month':
        dateFilter = "AND c.created_at >= DATE_TRUNC('month', CURRENT_DATE)";
        break;
      case 'quarter':
        dateFilter = "AND c.created_at >= DATE_TRUNC('quarter', CURRENT_DATE)";
        break;
      case 'year':
        dateFilter = "AND c.created_at >= DATE_TRUNC('year', CURRENT_DATE)";
        break;
    }

    // Novos clientes por período
    const newCustomersQuery = `
      SELECT 
        DATE_TRUNC('day', c.created_at) as period,
        COUNT(*) as new_customers
      FROM customers c
      WHERE c.company_id = $1 AND c.deleted_at IS NULL ${dateFilter}
      GROUP BY DATE_TRUNC('day', c.created_at)
      ORDER BY period ASC
    `;

    // Clientes por status
    const customerStatusQuery = `
      SELECT 
        status,
        COUNT(*) as customer_count
      FROM customers c
      WHERE c.company_id = $1 AND c.deleted_at IS NULL
      GROUP BY status
      ORDER BY customer_count DESC
    `;

    // Clientes por cidade/região
    const customerLocationQuery = `
      SELECT 
        COALESCE(city, 'Não informado') as city,
        COUNT(*) as customer_count
      FROM customers c
      WHERE c.company_id = $1 AND c.deleted_at IS NULL
      GROUP BY COALESCE(city, 'Não informado')
      ORDER BY customer_count DESC
      LIMIT 10
    `;

    // Top clientes por valor
    const topCustomersQuery = `
      SELECT 
        c.id, c.name, c.email, c.phone,
        COUNT(s.id) as total_purchases,
        SUM(s.total_amount) as total_spent,
        AVG(s.total_amount) as avg_order_value,
        MAX(s.created_at) as last_purchase
      FROM customers c
      LEFT JOIN sales s ON c.id = s.customer_id AND s.deleted_at IS NULL
      WHERE c.company_id = $1 AND c.deleted_at IS NULL
      GROUP BY c.id, c.name, c.email, c.phone
      HAVING COUNT(s.id) > 0
      ORDER BY total_spent DESC
      LIMIT 20
    `;

    // Análise de segmentação de clientes
    const segmentationQuery = `
      SELECT 
        CASE 
          WHEN total_spent >= 10000 THEN 'VIP'
          WHEN total_spent >= 5000 THEN 'Premium'
          WHEN total_spent >= 1000 THEN 'Regular'
          WHEN total_spent > 0 THEN 'Básico'
          ELSE 'Sem compras'
        END as segment,
        COUNT(*) as customer_count,
        AVG(total_spent) as avg_spent_per_customer,
        SUM(total_spent) as segment_revenue
      FROM (
        SELECT 
          c.id,
          COALESCE(SUM(s.total_amount), 0) as total_spent
        FROM customers c
        LEFT JOIN sales s ON c.id = s.customer_id AND s.deleted_at IS NULL
        WHERE c.company_id = $1 AND c.deleted_at IS NULL
        GROUP BY c.id
      ) customer_totals
      GROUP BY segment
      ORDER BY avg_spent_per_customer DESC
    `;

    // Análise de retenção (clientes que compraram novamente)
    const retentionQuery = `
      SELECT 
        COUNT(DISTINCT first_purchase.customer_id) as customers_with_first_purchase,
        COUNT(DISTINCT repeat_purchase.customer_id) as customers_with_repeat_purchase,
        ROUND(
          (COUNT(DISTINCT repeat_purchase.customer_id)::decimal / 
           NULLIF(COUNT(DISTINCT first_purchase.customer_id), 0)) * 100, 2
        ) as retention_rate
      FROM (
        SELECT 
          customer_id,
          MIN(created_at) as first_purchase_date
        FROM sales 
        WHERE company_id = $1 AND deleted_at IS NULL
        GROUP BY customer_id
        HAVING MIN(created_at) >= DATE_TRUNC('${period}', CURRENT_DATE) - INTERVAL '1 ${period}'
      ) first_purchase
      LEFT JOIN (
        SELECT DISTINCT customer_id
        FROM sales s1
        WHERE company_id = $1 AND deleted_at IS NULL
        AND EXISTS (
          SELECT 1 FROM sales s2 
          WHERE s2.customer_id = s1.customer_id 
          AND s2.created_at > s1.created_at
          AND s2.deleted_at IS NULL
        )
      ) repeat_purchase ON first_purchase.customer_id = repeat_purchase.customer_id
    `;

    try {
      const [
        newCustomersResult,
        customerStatusResult,
        customerLocationResult,
        topCustomersResult,
        segmentationResult,
        retentionResult
      ] = await Promise.all([
        query(newCustomersQuery, [req.user.companyId]),
        query(customerStatusQuery, [req.user.companyId]),
        query(customerLocationQuery, [req.user.companyId]),
        query(topCustomersQuery, [req.user.companyId]),
        query(segmentationQuery, [req.user.companyId]),
        query(retentionQuery, [req.user.companyId])
      ]);

      const analytics = {
        period: period,
        new_customers_trend: newCustomersResult.rows.map(row => ({
          period: row.period,
          new_customers: parseInt(row.new_customers)
        })),
        by_status: customerStatusResult.rows.map(row => ({
          status: row.status,
          customer_count: parseInt(row.customer_count)
        })),
        by_location: customerLocationResult.rows.map(row => ({
          city: row.city,
          customer_count: parseInt(row.customer_count)
        })),
        top_customers: topCustomersResult.rows.map(row => ({
          ...row,
          total_purchases: parseInt(row.total_purchases),
          total_spent: parseFloat(row.total_spent),
          avg_order_value: parseFloat(row.avg_order_value),
          last_purchase: row.last_purchase
        })),
        segmentation: segmentationResult.rows.map(row => ({
          segment: row.segment,
          customer_count: parseInt(row.customer_count),
          avg_spent_per_customer: parseFloat(row.avg_spent_per_customer),
          segment_revenue: parseFloat(row.segment_revenue)
        })),
        retention: retentionResult.rows[0] ? {
          customers_with_first_purchase: parseInt(retentionResult.rows[0].customers_with_first_purchase),
          customers_with_repeat_purchase: parseInt(retentionResult.rows[0].customers_with_repeat_purchase),
          retention_rate: parseFloat(retentionResult.rows[0].retention_rate) || 0
        } : { customers_with_first_purchase: 0, customers_with_repeat_purchase: 0, retention_rate: 0 }
      };

      res.json({
        success: true,
        data: analytics
      });

    } catch (error) {
      logger.error('Customer analytics error:', error);
      throw new ApiError(500, tc(req, 'analyticsController', 'validation.customers_error'));
    }
  });

  /**
   * 📦 ANALYTICS DE PRODUTOS
   * GET /api/analytics/products
   */
  static getProductAnalytics = asyncHandler(async (req, res) => {
    const { period = 'month' } = req.query;

    let dateFilter = '';
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
    }

    // Produtos mais vendidos
    const topSellingQuery = `
      SELECT 
        p.id, p.name, p.sku, p.category,
        COUNT(si.id) as times_sold,
        SUM(si.quantity) as total_quantity_sold,
        SUM(si.subtotal) as total_revenue,
        AVG(si.unit_price) as avg_selling_price,
        SUM(si.quantity * p.cost_price) as total_cost,
        SUM(si.subtotal) - SUM(si.quantity * p.cost_price) as total_profit
      FROM products p
      JOIN sale_items si ON p.id = si.product_id
      JOIN sales s ON si.sale_id = s.id
      WHERE p.company_id = $1 AND p.deleted_at IS NULL AND s.deleted_at IS NULL ${dateFilter}
      GROUP BY p.id, p.name, p.sku, p.category, p.cost_price
      ORDER BY total_revenue DESC
      LIMIT 20
    `;

    // Produtos por categoria
    const categoryAnalysisQuery = `
      SELECT 
        COALESCE(p.category, 'Sem categoria') as category,
        COUNT(DISTINCT p.id) as product_count,
        COUNT(si.id) as total_sales,
        SUM(si.quantity) as total_quantity_sold,
        SUM(si.subtotal) as total_revenue,
        AVG(si.unit_price) as avg_selling_price
      FROM products p
      LEFT JOIN sale_items si ON p.id = si.product_id
      LEFT JOIN sales s ON si.sale_id = s.id AND s.deleted_at IS NULL ${dateFilter}
      WHERE p.company_id = $1 AND p.deleted_at IS NULL
      GROUP BY COALESCE(p.category, 'Sem categoria')
      ORDER BY total_revenue DESC NULLS LAST
    `;

    // Produtos com baixo estoque
    const lowStockQuery = `
      SELECT 
        p.id, p.name, p.sku, p.category,
        p.stock_quantity, p.alert_level,
        p.stock_quantity - p.alert_level as stock_difference
      FROM products p
      WHERE p.company_id = $1 AND p.deleted_at IS NULL
      AND p.stock_quantity <= p.alert_level
      ORDER BY stock_difference ASC, p.stock_quantity ASC
    `;

    // Análise de margem de lucro
    const profitAnalysisQuery = `
      SELECT 
        p.id, p.name, p.sku,
        p.selling_price, p.cost_price,
        (p.selling_price - p.cost_price) as profit_per_unit,
        ROUND(((p.selling_price - p.cost_price) / NULLIF(p.selling_price, 0)) * 100, 2) as profit_margin_percent,
        COALESCE(SUM(si.quantity), 0) as total_sold,
        COALESCE(SUM(si.subtotal), 0) as total_revenue,
        COALESCE(SUM(si.quantity * p.cost_price), 0) as total_cost,
        COALESCE(SUM(si.subtotal) - SUM(si.quantity * p.cost_price), 0) as total_profit
      FROM products p
      LEFT JOIN sale_items si ON p.id = si.product_id
      LEFT JOIN sales s ON si.sale_id = s.id AND s.deleted_at IS NULL ${dateFilter}
      WHERE p.company_id = $1 AND p.deleted_at IS NULL
      GROUP BY p.id, p.name, p.sku, p.selling_price, p.cost_price
      ORDER BY total_profit DESC
      LIMIT 20
    `;

    // Produtos sem vendas
    const noSalesQuery = `
      SELECT 
        p.id, p.name, p.sku, p.category, p.status,
        p.stock_quantity, p.selling_price, p.created_at
      FROM products p
      LEFT JOIN sale_items si ON p.id = si.product_id
      LEFT JOIN sales s ON si.sale_id = s.id AND s.deleted_at IS NULL ${dateFilter}
      WHERE p.company_id = $1 AND p.deleted_at IS NULL
      AND si.id IS NULL
      ORDER BY p.created_at DESC
      LIMIT 20
    `;

    // Movimento de estoque
    const stockMovementQuery = `
      SELECT 
        DATE_TRUNC('day', sm.created_at) as movement_date,
        sm.movement_type,
        COUNT(*) as movement_count,
        SUM(ABS(sm.quantity)) as total_quantity
      FROM stock_movements sm
      JOIN products p ON sm.product_id = p.id
      WHERE p.company_id = $1 AND sm.created_at >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY DATE_TRUNC('day', sm.created_at), sm.movement_type
      ORDER BY movement_date DESC
    `;

    try {
      const [
        topSellingResult,
        categoryAnalysisResult,
        lowStockResult,
        profitAnalysisResult,
        noSalesResult,
        stockMovementResult
      ] = await Promise.all([
        query(topSellingQuery, [req.user.companyId]),
        query(categoryAnalysisQuery, [req.user.companyId]),
        query(lowStockQuery, [req.user.companyId]),
        query(profitAnalysisQuery, [req.user.companyId]),
        query(noSalesQuery, [req.user.companyId]),
        query(stockMovementQuery, [req.user.companyId])
      ]);

      const analytics = {
        period: period,
        top_selling_products: topSellingResult.rows.map(row => ({
          ...row,
          times_sold: parseInt(row.times_sold),
          total_quantity_sold: parseInt(row.total_quantity_sold),
          total_revenue: parseFloat(row.total_revenue),
          avg_selling_price: parseFloat(row.avg_selling_price),
          total_cost: parseFloat(row.total_cost),
          total_profit: parseFloat(row.total_profit)
        })),
        by_category: categoryAnalysisResult.rows.map(row => ({
          category: row.category,
          product_count: parseInt(row.product_count),
          total_sales: parseInt(row.total_sales) || 0,
          total_quantity_sold: parseInt(row.total_quantity_sold) || 0,
          total_revenue: parseFloat(row.total_revenue) || 0,
          avg_selling_price: parseFloat(row.avg_selling_price) || 0
        })),
        low_stock_products: lowStockResult.rows.map(row => ({
          ...row,
          stock_quantity: parseInt(row.stock_quantity),
          alert_level: parseInt(row.alert_level),
          stock_difference: parseInt(row.stock_difference)
        })),
        profit_analysis: profitAnalysisResult.rows.map(row => ({
          ...row,
          selling_price: parseFloat(row.selling_price),
          cost_price: parseFloat(row.cost_price),
          profit_per_unit: parseFloat(row.profit_per_unit),
          profit_margin_percent: parseFloat(row.profit_margin_percent),
          total_sold: parseInt(row.total_sold),
          total_revenue: parseFloat(row.total_revenue),
          total_cost: parseFloat(row.total_cost),
          total_profit: parseFloat(row.total_profit)
        })),
        products_without_sales: noSalesResult.rows.map(row => ({
          ...row,
          stock_quantity: parseInt(row.stock_quantity),
          selling_price: parseFloat(row.selling_price)
        })),
        stock_movements: stockMovementResult.rows.map(row => ({
          movement_date: row.movement_date,
          movement_type: row.movement_type,
          movement_count: parseInt(row.movement_count),
          total_quantity: parseInt(row.total_quantity)
        }))
      };

      res.json({
        success: true,
        data: analytics
      });

    } catch (error) {
      logger.error('Product analytics error:', error);
      throw new ApiError(500, tc(req, 'analyticsController', 'validation.products_error'));
    }
  });

  /**
   * 💰 ANALYTICS FINANCEIROS
   * GET /api/analytics/financial
   */
  static getFinancialAnalytics = asyncHandler(async (req, res) => {
    const { period = 'month', type = 'overview' } = req.query;

    let dateFilter = '';
    switch (period) {
      case 'week':
        dateFilter = "AND created_at >= DATE_TRUNC('week', CURRENT_DATE)";
        break;
      case 'month':
        dateFilter = "AND created_at >= DATE_TRUNC('month', CURRENT_DATE)";
        break;
      case 'quarter':
        dateFilter = "AND created_at >= DATE_TRUNC('quarter', CURRENT_DATE)";
        break;
      case 'year':
        dateFilter = "AND created_at >= DATE_TRUNC('year', CURRENT_DATE)";
        break;
    }

    if (type === 'overview') {
      // Receitas e despesas
      const revenueExpensesQuery = `
        SELECT 
          SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as total_income,
          SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as total_expenses,
          SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END) as net_profit,
          COUNT(CASE WHEN type = 'income' THEN 1 END) as income_transactions,
          COUNT(CASE WHEN type = 'expense' THEN 1 END) as expense_transactions
        FROM financial_transactions ft
        WHERE ft.company_id = $1 AND ft.deleted_at IS NULL ${dateFilter}
      `;

      // Fluxo de caixa por dia
      const cashFlowQuery = `
        SELECT 
          DATE_TRUNC('day', ft.created_at) as transaction_date,
          SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as daily_income,
          SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as daily_expenses,
          SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END) as daily_net
        FROM financial_transactions ft
        WHERE ft.company_id = $1 AND ft.deleted_at IS NULL ${dateFilter}
        GROUP BY DATE_TRUNC('day', ft.created_at)
        ORDER BY transaction_date ASC
      `;

      // Receitas por categoria
      const incomeByCategory = `
        SELECT 
          COALESCE(category, 'Sem categoria') as category,
          SUM(amount) as total_amount,
          COUNT(*) as transaction_count
        FROM financial_transactions ft
        WHERE ft.company_id = $1 AND ft.type = 'income' AND ft.deleted_at IS NULL ${dateFilter}
        GROUP BY COALESCE(category, 'Sem categoria')
        ORDER BY total_amount DESC
      `;

      // Despesas por categoria
      const expensesByCategory = `
        SELECT 
          COALESCE(category, 'Sem categoria') as category,
          SUM(amount) as total_amount,
          COUNT(*) as transaction_count
        FROM financial_transactions ft
        WHERE ft.company_id = $1 AND ft.type = 'expense' AND ft.deleted_at IS NULL ${dateFilter}
        GROUP BY COALESCE(category, 'Sem categoria')
        ORDER BY total_amount DESC
      `;

      try {
        const [
          revenueExpensesResult,
          cashFlowResult,
          incomeByCategoryResult,
          expensesByCategoryResult
        ] = await Promise.all([
          query(revenueExpensesQuery, [req.user.companyId]),
          query(cashFlowQuery, [req.user.companyId]),
          query(incomeByCategory, [req.user.companyId]),
          query(expensesByCategory, [req.user.companyId])
        ]);

        const analytics = {
          period: period,
          overview: {
            ...revenueExpensesResult.rows[0],
            total_income: parseFloat(revenueExpensesResult.rows[0].total_income) || 0,
            total_expenses: parseFloat(revenueExpensesResult.rows[0].total_expenses) || 0,
            net_profit: parseFloat(revenueExpensesResult.rows[0].net_profit) || 0,
            income_transactions: parseInt(revenueExpensesResult.rows[0].income_transactions),
            expense_transactions: parseInt(revenueExpensesResult.rows[0].expense_transactions)
          },
          cash_flow: cashFlowResult.rows.map(row => ({
            date: row.transaction_date,
            income: parseFloat(row.daily_income),
            expenses: parseFloat(row.daily_expenses),
            net: parseFloat(row.daily_net)
          })),
          income_by_category: incomeByCategoryResult.rows.map(row => ({
            category: row.category,
            total_amount: parseFloat(row.total_amount),
            transaction_count: parseInt(row.transaction_count)
          })),
          expenses_by_category: expensesByCategoryResult.rows.map(row => ({
            category: row.category,
            total_amount: parseFloat(row.total_amount),
            transaction_count: parseInt(row.transaction_count)
          }))
        };

        res.json({
          success: true,
          data: analytics
        });

      } catch (error) {
        logger.error('Financial analytics error:', error);
        throw new ApiError(500, tc(req, 'analyticsController', 'validation.financial_error'));
      }

    } else {
      throw new ApiError(400, tc(req, 'analyticsController', 'validation.invalid_analysis_type'));
    }
  });

  /**
   * 📈 ANALYTICS DE PERFORMANCE
   * GET /api/analytics/performance
   */
  static getPerformanceAnalytics = asyncHandler(async (req, res) => {
    const { period = 'month' } = req.query;

    let dateFilter = '';
    switch (period) {
      case 'week':
        dateFilter = "AND created_at >= DATE_TRUNC('week', CURRENT_DATE)";
        break;
      case 'month':
        dateFilter = "AND created_at >= DATE_TRUNC('month', CURRENT_DATE)";
        break;
      case 'quarter':
        dateFilter = "AND created_at >= DATE_TRUNC('quarter', CURRENT_DATE)";
        break;
      case 'year':
        dateFilter = "AND created_at >= DATE_TRUNC('year', CURRENT_DATE)";
        break;
    }

    // Performance de vendedores
    const sellersPerformanceQuery = `
      SELECT 
        u.id, u.full_name,
        COUNT(DISTINCT s.id) as total_sales,
        SUM(s.total_amount) as total_revenue,
        AVG(s.total_amount) as avg_order_value,
        COUNT(DISTINCT s.customer_id) as unique_customers,
        ROUND(COUNT(DISTINCT s.id)::decimal / 
          NULLIF(EXTRACT(DAYS FROM (CURRENT_DATE - DATE_TRUNC('${period}', CURRENT_DATE)))::decimal, 0), 2
        ) as sales_per_day
      FROM users u
      LEFT JOIN sales s ON u.id = s.user_id AND s.deleted_at IS NULL ${dateFilter}
      WHERE u.company_id = $1 AND u.active = true
      GROUP BY u.id, u.full_name
      ORDER BY total_revenue DESC NULLS LAST
    `;

    // Performance de tickets por usuário
    const ticketPerformanceQuery = `
      SELECT 
        u.id, u.full_name,
        COUNT(CASE WHEN t.assigned_to = u.id THEN 1 END) as assigned_tickets,
        COUNT(CASE WHEN t.assigned_to = u.id AND t.status IN ('resolved', 'closed') THEN 1 END) as resolved_tickets,
        ROUND(
          (COUNT(CASE WHEN t.assigned_to = u.id AND t.status IN ('resolved', 'closed') THEN 1 END)::decimal /
           NULLIF(COUNT(CASE WHEN t.assigned_to = u.id THEN 1 END), 0)) * 100, 2
        ) as resolution_rate,
        ROUND(AVG(CASE 
          WHEN t.assigned_to = u.id AND t.status IN ('resolved', 'closed') AND t.resolved_at IS NOT NULL 
          THEN EXTRACT(EPOCH FROM (t.resolved_at - t.created_at))/3600 
        END), 2) as avg_resolution_hours
      FROM users u
      LEFT JOIN tickets t ON (u.id = t.assigned_to OR u.id = t.created_by) AND t.deleted_at IS NULL ${dateFilter}
      WHERE u.company_id = $1 AND u.active = true
      GROUP BY u.id, u.full_name
      HAVING COUNT(CASE WHEN t.assigned_to = u.id THEN 1 END) > 0
      ORDER BY resolution_rate DESC, avg_resolution_hours ASC
    `;

    // Gamificação por usuário
    const gamificationPerformanceQuery = `
      SELECT 
        u.id, u.full_name,
        ugp.total_xp, ugp.current_coins, ugp.level,
        COUNT(gh.id) as total_actions,
        SUM(CASE WHEN gh.type = 'xp' THEN gh.amount ELSE 0 END) as xp_earned_period,
        SUM(CASE WHEN gh.type = 'coins' THEN gh.amount ELSE 0 END) as coins_earned_period
      FROM users u
      LEFT JOIN user_gamification_profiles ugp ON u.id = ugp.user_id
      LEFT JOIN gamification_history gh ON u.id = gh.user_id AND gh.deleted_at IS NULL ${dateFilter}
      WHERE u.company_id = $1 AND u.active = true
      GROUP BY u.id, u.full_name, ugp.total_xp, ugp.current_coins, ugp.level
      ORDER BY ugp.total_xp DESC NULLS LAST
    `;

    // Métricas gerais de sistema
    const systemMetricsQuery = `
      SELECT 
        (SELECT COUNT(*) FROM users WHERE company_id = $1 AND active = true) as active_users,
        (SELECT COUNT(*) FROM customers WHERE company_id = $1 AND deleted_at IS NULL) as total_customers,
        (SELECT COUNT(*) FROM products WHERE company_id = $1 AND deleted_at IS NULL) as total_products,
        (SELECT COUNT(*) FROM sales WHERE company_id = $1 AND deleted_at IS NULL ${dateFilter}) as total_sales,
        (SELECT COUNT(*) FROM tickets WHERE company_id = $1 AND deleted_at IS NULL AND status = 'open') as open_tickets,
        (SELECT AVG(rating) FROM suppliers WHERE company_id = $1 AND deleted_at IS NULL) as avg_supplier_rating
    `;

    try {
      const [
        sellersPerformanceResult,
        ticketPerformanceResult,
        gamificationPerformanceResult,
        systemMetricsResult
      ] = await Promise.all([
        query(sellersPerformanceQuery, [req.user.companyId]),
        query(ticketPerformanceQuery, [req.user.companyId]),
        query(gamificationPerformanceQuery, [req.user.companyId]),
        query(systemMetricsQuery, [req.user.companyId])
      ]);

      const analytics = {
        period: period,
        sellers_performance: sellersPerformanceResult.rows.map(row => ({
          ...row,
          total_sales: parseInt(row.total_sales) || 0,
          total_revenue: parseFloat(row.total_revenue) || 0,
          avg_order_value: parseFloat(row.avg_order_value) || 0,
          unique_customers: parseInt(row.unique_customers) || 0,
          sales_per_day: parseFloat(row.sales_per_day) || 0
        })),
        ticket_performance: ticketPerformanceResult.rows.map(row => ({
          ...row,
          assigned_tickets: parseInt(row.assigned_tickets),
          resolved_tickets: parseInt(row.resolved_tickets),
          resolution_rate: parseFloat(row.resolution_rate) || 0,
          avg_resolution_hours: parseFloat(row.avg_resolution_hours) || 0
        })),
        gamification_performance: gamificationPerformanceResult.rows.map(row => ({
          ...row,
          total_xp: parseInt(row.total_xp) || 0,
          current_coins: parseInt(row.current_coins) || 0,
          level: parseInt(row.level) || 1,
          total_actions: parseInt(row.total_actions) || 0,
          xp_earned_period: parseInt(row.xp_earned_period) || 0,
          coins_earned_period: parseInt(row.coins_earned_period) || 0
        })),
        system_metrics: {
          ...systemMetricsResult.rows[0],
          active_users: parseInt(systemMetricsResult.rows[0].active_users),
          total_customers: parseInt(systemMetricsResult.rows[0].total_customers),
          total_products: parseInt(systemMetricsResult.rows[0].total_products),
          total_sales: parseInt(systemMetricsResult.rows[0].total_sales),
          open_tickets: parseInt(systemMetricsResult.rows[0].open_tickets),
          avg_supplier_rating: parseFloat(systemMetricsResult.rows[0].avg_supplier_rating) || 0
        }
      };

      res.json({
        success: true,
        data: analytics
      });

    } catch (error) {
      logger.error('Performance analytics error:', error);
      throw new ApiError(500, tc(req, 'analyticsController', 'validation.performance_error'));
    }
  });

  /**
   * 📊 COMPARAÇÕES
   * GET /api/analytics/comparisons
   */
  static getComparisons = asyncHandler(async (req, res) => {
    const { 
      current_period = 'month',
      compare_with = 'previous' 
    } = req.query;

    // Definir períodos de comparação
    let currentDateFilter = '';
    let compareToDateFilter = '';

    switch (current_period) {
      case 'week':
        currentDateFilter = "AND created_at >= DATE_TRUNC('week', CURRENT_DATE)";
        compareToDateFilter = compare_with === 'previous' 
          ? "AND created_at >= DATE_TRUNC('week', CURRENT_DATE) - INTERVAL '1 week' AND created_at < DATE_TRUNC('week', CURRENT_DATE)"
          : "AND created_at >= DATE_TRUNC('week', CURRENT_DATE - INTERVAL '1 year') AND created_at < DATE_TRUNC('week', CURRENT_DATE - INTERVAL '1 year') + INTERVAL '1 week'";
        break;
      case 'month':
        currentDateFilter = "AND created_at >= DATE_TRUNC('month', CURRENT_DATE)";
        compareToDateFilter = compare_with === 'previous'
          ? "AND created_at >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month' AND created_at < DATE_TRUNC('month', CURRENT_DATE)"
          : "AND created_at >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 year') AND created_at < DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 year') + INTERVAL '1 month'";
        break;
      case 'quarter':
        currentDateFilter = "AND created_at >= DATE_TRUNC('quarter', CURRENT_DATE)";
        compareToDateFilter = compare_with === 'previous'
          ? "AND created_at >= DATE_TRUNC('quarter', CURRENT_DATE) - INTERVAL '3 months' AND created_at < DATE_TRUNC('quarter', CURRENT_DATE)"
          : "AND created_at >= DATE_TRUNC('quarter', CURRENT_DATE - INTERVAL '1 year') AND created_at < DATE_TRUNC('quarter', CURRENT_DATE - INTERVAL '1 year') + INTERVAL '3 months'";
        break;
      case 'year':
        currentDateFilter = "AND created_at >= DATE_TRUNC('year', CURRENT_DATE)";
        compareToDateFilter = compare_with === 'previous'
          ? "AND created_at >= DATE_TRUNC('year', CURRENT_DATE) - INTERVAL '1 year' AND created_at < DATE_TRUNC('year', CURRENT_DATE)"
          : "AND created_at >= DATE_TRUNC('year', CURRENT_DATE - INTERVAL '1 year') AND created_at < DATE_TRUNC('year', CURRENT_DATE - INTERVAL '1 year') + INTERVAL '1 year'";
        break;
    }

    // Query para período atual
    const currentPeriodQuery = `
      SELECT 
        COUNT(DISTINCT s.id) as total_sales,
        SUM(s.total_amount) as total_revenue,
        AVG(s.total_amount) as avg_order_value,
        COUNT(DISTINCT s.customer_id) as unique_customers,
        COUNT(DISTINCT c.id) as new_customers,
        COUNT(DISTINCT t.id) as total_tickets,
        COUNT(CASE WHEN t.status IN ('resolved', 'closed') THEN 1 END) as resolved_tickets
      FROM sales s
      LEFT JOIN customers c ON s.customer_id = c.id ${currentDateFilter.replace('s.created_at', 'c.created_at')}
      LEFT JOIN tickets t ON t.company_id = s.company_id ${currentDateFilter.replace('s.created_at', 't.created_at')}
      WHERE s.company_id = $1 AND s.deleted_at IS NULL ${currentDateFilter}
    `;

    // Query para período de comparação
    const comparePeriodQuery = `
      SELECT 
        COUNT(DISTINCT s.id) as total_sales,
        SUM(s.total_amount) as total_revenue,
        AVG(s.total_amount) as avg_order_value,
        COUNT(DISTINCT s.customer_id) as unique_customers,
        COUNT(DISTINCT c.id) as new_customers,
        COUNT(DISTINCT t.id) as total_tickets,
        COUNT(CASE WHEN t.status IN ('resolved', 'closed') THEN 1 END) as resolved_tickets
      FROM sales s
      LEFT JOIN customers c ON s.customer_id = c.id ${compareToDateFilter.replace('s.created_at', 'c.created_at')}
      LEFT JOIN tickets t ON t.company_id = s.company_id ${compareToDateFilter.replace('s.created_at', 't.created_at')}
      WHERE s.company_id = $1 AND s.deleted_at IS NULL ${compareToDateFilter}
    `;

    try {
      const [currentResult, compareResult] = await Promise.all([
        query(currentPeriodQuery, [req.user.companyId]),
        query(comparePeriodQuery, [req.user.companyId])
      ]);

      const current = currentResult.rows[0];
      const compare = compareResult.rows[0];

      // Função para calcular crescimento percentual
      const calculateGrowth = (current, previous) => {
        if (!previous || previous === '0' || previous === 0) return current > 0 ? 100 : 0;
        return Math.round(((parseFloat(current) - parseFloat(previous)) / parseFloat(previous)) * 100);
      };

      const comparisons = {
        current_period: current_period,
        compare_with: compare_with,
        current: {
          total_sales: parseInt(current.total_sales) || 0,
          total_revenue: parseFloat(current.total_revenue) || 0,
          avg_order_value: parseFloat(current.avg_order_value) || 0,
          unique_customers: parseInt(current.unique_customers) || 0,
          new_customers: parseInt(current.new_customers) || 0,
          total_tickets: parseInt(current.total_tickets) || 0,
          resolved_tickets: parseInt(current.resolved_tickets) || 0
        },
        compare_to: {
          total_sales: parseInt(compare.total_sales) || 0,
          total_revenue: parseFloat(compare.total_revenue) || 0,
          avg_order_value: parseFloat(compare.avg_order_value) || 0,
          unique_customers: parseInt(compare.unique_customers) || 0,
          new_customers: parseInt(compare.new_customers) || 0,
          total_tickets: parseInt(compare.total_tickets) || 0,
          resolved_tickets: parseInt(compare.resolved_tickets) || 0
        },
        growth: {
          sales: calculateGrowth(current.total_sales, compare.total_sales),
          revenue: calculateGrowth(current.total_revenue, compare.total_revenue),
          avg_order_value: calculateGrowth(current.avg_order_value, compare.avg_order_value),
          unique_customers: calculateGrowth(current.unique_customers, compare.unique_customers),
          new_customers: calculateGrowth(current.new_customers, compare.new_customers),
          tickets: calculateGrowth(current.total_tickets, compare.total_tickets),
          resolved_tickets: calculateGrowth(current.resolved_tickets, compare.resolved_tickets)
        }
      };

      res.json({
        success: true,
        data: comparisons
      });

    } catch (error) {
      logger.error('Comparisons analytics error:', error);
      throw new ApiError(500, tc(req, 'analyticsController', 'validation.comparisons_error'));
    }
  });

  /**
   * 📥 EXPORTAR RELATÓRIO
   * POST /api/analytics/export
   */
  static exportReport = asyncHandler(async (req, res) => {
    const { 
      report_type, 
      period = 'month', 
      format = 'json' 
    } = req.body;

    if (!report_type) {
      throw new ApiError(400, tc(req, 'analyticsController', 'validation.report_type_required'));
    }

    const validReportTypes = ['dashboard', 'sales', 'customers', 'products', 'financial', 'performance'];
    
    if (!validReportTypes.includes(report_type)) {
      throw new ApiError(400, tc(req, 'analyticsController', 'validation.invalid_report_type'));
    }

    try {
      let reportData;

      // Gerar dados do relatório baseado no tipo
      switch (report_type) {
        case 'dashboard':
          reportData = await this.getDashboard({ user: req.user, query: { period } }, { json: (data) => data });
          break;
        case 'sales':
          reportData = await this.getSalesAnalytics({ user: req.user, query: { period } }, { json: (data) => data });
          break;
        case 'customers':
          reportData = await this.getCustomerAnalytics({ user: req.user, query: { period } }, { json: (data) => data });
          break;
        case 'products':
          reportData = await this.getProductAnalytics({ user: req.user, query: { period } }, { json: (data) => data });
          break;
        case 'financial':
          reportData = await this.getFinancialAnalytics({ user: req.user, query: { period } }, { json: (data) => data });
          break;
        case 'performance':
          reportData = await this.getPerformanceAnalytics({ user: req.user, query: { period } }, { json: (data) => data });
          break;
      }

      // Criar registro de exportação
      const exportId = uuidv4();
      await query(`
        INSERT INTO report_exports (id, company_id, user_id, report_type, period, format, data, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      `, [
        exportId,
        req.user.companyId,
        req.user.id,
        report_type,
        period,
        format,
        JSON.stringify(reportData)
      ]);

      // Log de auditoria
      auditLogger(tc(req, 'analyticsController', 'audit.report_exported', {
        type: report_type,
        format: format
      }), {
        userId: req.user.id,
        exportId: exportId,
        reportType: report_type,
        period: period,
        format: format,
        companyId: req.user.companyId,
        ip: req.ip
      });

      res.json({
        success: true,
        message: tc(req, 'analyticsController', 'exportReport.success'),
        data: {
          export_id: exportId,
          report_type: report_type,
          period: period,
          format: format,
          exported_at: new Date().toISOString(),
          data: reportData
        }
      });

    } catch (error) {
      logger.error('Export report error:', error);
      throw new ApiError(500, tc(req, 'analyticsController', 'validation.export_error'));
    }
  });
}

module.exports = AnalyticsController;