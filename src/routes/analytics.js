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
 * 📊 ANALYTICS ROUTES - COPILOT_PROMPT_6
 * ==========================================
 * Rotas completas para dashboard de analytics
 * ==========================================
 */

const express = require('express');
const router = express.Router();
const AnalyticsController = require('../controllers/AnalyticsController');
const { authenticateToken, authorize } = require('../utils/auth');

/**
 * @swagger
 * components:
 *   schemas:
 *     DashboardData:
 *       type: object
 *       properties:
 *         period:
 *           type: string
 *           enum: [week, month, quarter, year]
 *         overview:
 *           type: object
 *           properties:
 *             sales:
 *               type: object
 *               properties:
 *                 total_sales:
 *                   type: integer
 *                 total_revenue:
 *                   type: number
 *                 avg_order_value:
 *                   type: number
 *                 unique_customers:
 *                   type: integer
 *                 growth:
 *                   type: object
 *                   properties:
 *                     sales:
 *                       type: number
 *                       description: Crescimento percentual de vendas
 *                     revenue:
 *                       type: number
 *                       description: Crescimento percentual de receita
 *             customers:
 *               type: object
 *               properties:
 *                 total_customers:
 *                   type: integer
 *                 active_customers:
 *                   type: integer
 *                 new_customers:
 *                   type: integer
 *             products:
 *               type: object
 *               properties:
 *                 total_products:
 *                   type: integer
 *                 low_stock_products:
 *                   type: integer
 *                 inventory_value:
 *                   type: number
 *         charts:
 *           type: object
 *           properties:
 *             daily_sales:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   date:
 *                     type: string
 *                     format: date
 *                   sales_count:
 *                     type: integer
 *                   revenue:
 *                     type: number
 *             top_products:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   name:
 *                     type: string
 *                   total_revenue:
 *                     type: number
 * 
 *     AnalyticsReport:
 *       type: object
 *       properties:
 *         report_type:
 *           type: string
 *         period:
 *           type: string
 *         data:
 *           type: object
 *           description: Dados específicos do relatório
 * 
 *     ExportRequest:
 *       type: object
 *       required:
 *         - report_type
 *       properties:
 *         report_type:
 *           type: string
 *           enum: [dashboard, sales, customers, products, financial, performance]
 *           description: Tipo de relatório para exportar
 *         period:
 *           type: string
 *           enum: [week, month, quarter, year]
 *           default: month
 *           description: Período do relatório
 *         format:
 *           type: string
 *           enum: [json, csv, pdf]
 *           default: json
 *           description: Formato de exportação
 * 
 *   parameters:
 *     AnalyticsPeriod:
 *       name: period
 *       in: query
 *       schema:
 *         type: string
 *         enum: [week, month, quarter, year]
 *         default: month
 *       description: Período para análise
 * 
 *     AnalyticsGroupBy:
 *       name: group_by
 *       in: query
 *       schema:
 *         type: string
 *         enum: [hour, day, week, month]
 *         default: day
 *       description: Agrupamento dos dados
 * 
 *     DateRange:
 *       - name: start_date
 *         in: query
 *         schema:
 *           type: string
 *           format: date
 *         description: Data de início (formato YYYY-MM-DD)
 *       - name: end_date
 *         in: query
 *         schema:
 *           type: string
 *           format: date
 *         description: Data de fim (formato YYYY-MM-DD)
 */

/**
 * @swagger
 * /api/analytics/dashboard:
 *   get:
 *     summary: Dashboard principal
 *     description: Retorna dados completos do dashboard com KPIs e gráficos
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/AnalyticsPeriod'
 *     responses:
 *       200:
 *         description: Dashboard gerado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/DashboardData'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/dashboard', authenticateToken, authorize(['admin', 'manager']), AnalyticsController.getDashboard);

/**
 * @swagger
 * /api/analytics/sales:
 *   get:
 *     summary: Analytics de vendas
 *     description: Análises detalhadas de vendas com múltiplas dimensões
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/AnalyticsPeriod'
 *       - $ref: '#/components/parameters/AnalyticsGroupBy'
 *       - $ref: '#/components/parameters/DateRange'
 *     responses:
 *       200:
 *         description: Analytics de vendas geradas com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     period:
 *                       type: string
 *                     group_by:
 *                       type: string
 *                     sales_by_period:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           period:
 *                             type: string
 *                           sales_count:
 *                             type: integer
 *                           total_revenue:
 *                             type: number
 *                           avg_order_value:
 *                             type: number
 *                           unique_customers:
 *                             type: integer
 *                     by_payment_method:
 *                       type: array
 *                       items:
 *                         type: object
 *                     top_sellers:
 *                       type: array
 *                       items:
 *                         type: object
 *                     peak_hours:
 *                       type: array
 *                       items:
 *                         type: object
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/sales', authenticateToken, authorize(['admin', 'manager']), AnalyticsController.getSalesAnalytics);

/**
 * @swagger
 * /api/analytics/customers:
 *   get:
 *     summary: Analytics de clientes
 *     description: Análises detalhadas de clientes com segmentação e retenção
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/AnalyticsPeriod'
 *     responses:
 *       200:
 *         description: Analytics de clientes geradas com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     period:
 *                       type: string
 *                     new_customers_trend:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           period:
 *                             type: string
 *                           new_customers:
 *                             type: integer
 *                     by_status:
 *                       type: array
 *                       items:
 *                         type: object
 *                     by_location:
 *                       type: array
 *                       items:
 *                         type: object
 *                     top_customers:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           name:
 *                             type: string
 *                           total_spent:
 *                             type: number
 *                           total_purchases:
 *                             type: integer
 *                     segmentation:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           segment:
 *                             type: string
 *                           customer_count:
 *                             type: integer
 *                           avg_spent_per_customer:
 *                             type: number
 *                     retention:
 *                       type: object
 *                       properties:
 *                         retention_rate:
 *                           type: number
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/customers', authenticateToken, authorize(['admin', 'manager']), AnalyticsController.getCustomerAnalytics);

/**
 * @swagger
 * /api/analytics/products:
 *   get:
 *     summary: Analytics de produtos
 *     description: Análises detalhadas de produtos com performance e categorias
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/AnalyticsPeriod'
 *     responses:
 *       200:
 *         description: Analytics de produtos geradas com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     period:
 *                       type: string
 *                     top_selling_products:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           name:
 *                             type: string
 *                           total_revenue:
 *                             type: number
 *                           total_quantity_sold:
 *                             type: integer
 *                           total_profit:
 *                             type: number
 *                     by_category:
 *                       type: array
 *                       items:
 *                         type: object
 *                     low_stock_products:
 *                       type: array
 *                       items:
 *                         type: object
 *                     profit_analysis:
 *                       type: array
 *                       items:
 *                         type: object
 *                     products_without_sales:
 *                       type: array
 *                       items:
 *                         type: object
 *                     stock_movements:
 *                       type: array
 *                       items:
 *                         type: object
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/products', authenticateToken, authorize(['admin', 'manager']), AnalyticsController.getProductAnalytics);

/**
 * @swagger
 * /api/analytics/financial:
 *   get:
 *     summary: Analytics financeiros
 *     description: Análises financeiras com receitas, despesas e fluxo de caixa
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/AnalyticsPeriod'
 *       - name: type
 *         in: query
 *         schema:
 *           type: string
 *           enum: [overview, detailed]
 *           default: overview
 *         description: Tipo de análise financeira
 *     responses:
 *       200:
 *         description: Analytics financeiros gerados com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     period:
 *                       type: string
 *                     overview:
 *                       type: object
 *                       properties:
 *                         total_income:
 *                           type: number
 *                         total_expenses:
 *                           type: number
 *                         net_profit:
 *                           type: number
 *                         income_transactions:
 *                           type: integer
 *                         expense_transactions:
 *                           type: integer
 *                     cash_flow:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           date:
 *                             type: string
 *                           income:
 *                             type: number
 *                           expenses:
 *                             type: number
 *                           net:
 *                             type: number
 *                     income_by_category:
 *                       type: array
 *                       items:
 *                         type: object
 *                     expenses_by_category:
 *                       type: array
 *                       items:
 *                         type: object
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/financial', authenticateToken, authorize(['admin', 'manager']), AnalyticsController.getFinancialAnalytics);

/**
 * @swagger
 * /api/analytics/performance:
 *   get:
 *     summary: Analytics de performance
 *     description: Análises de performance de usuários e sistema
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/AnalyticsPeriod'
 *     responses:
 *       200:
 *         description: Analytics de performance gerados com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     period:
 *                       type: string
 *                     sellers_performance:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           name:
 *                             type: string
 *                           total_sales:
 *                             type: integer
 *                           total_revenue:
 *                             type: number
 *                           avg_order_value:
 *                             type: number
 *                           sales_per_day:
 *                             type: number
 *                     ticket_performance:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           name:
 *                             type: string
 *                           assigned_tickets:
 *                             type: integer
 *                           resolved_tickets:
 *                             type: integer
 *                           resolution_rate:
 *                             type: number
 *                           avg_resolution_hours:
 *                             type: number
 *                     gamification_performance:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           name:
 *                             type: string
 *                           total_xp:
 *                             type: integer
 *                           current_coins:
 *                             type: integer
 *                           level:
 *                             type: integer
 *                     system_metrics:
 *                       type: object
 *                       properties:
 *                         active_users:
 *                           type: integer
 *                         total_customers:
 *                           type: integer
 *                         total_products:
 *                           type: integer
 *                         total_sales:
 *                           type: integer
 *                         open_tickets:
 *                           type: integer
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/performance', authenticateToken, authorize(['admin', 'manager']), AnalyticsController.getPerformanceAnalytics);

/**
 * @swagger
 * /api/analytics/comparisons:
 *   get:
 *     summary: Comparações entre períodos
 *     description: Compara métricas entre diferentes períodos de tempo
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: current_period
 *         in: query
 *         schema:
 *           type: string
 *           enum: [week, month, quarter, year]
 *           default: month
 *         description: Período atual para comparação
 *       - name: compare_with
 *         in: query
 *         schema:
 *           type: string
 *           enum: [previous, same_period_last_year]
 *           default: previous
 *         description: Com que comparar
 *     responses:
 *       200:
 *         description: Comparações geradas com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     current_period:
 *                       type: string
 *                     compare_with:
 *                       type: string
 *                     current:
 *                       type: object
 *                       properties:
 *                         total_sales:
 *                           type: integer
 *                         total_revenue:
 *                           type: number
 *                         avg_order_value:
 *                           type: number
 *                         unique_customers:
 *                           type: integer
 *                         new_customers:
 *                           type: integer
 *                         total_tickets:
 *                           type: integer
 *                         resolved_tickets:
 *                           type: integer
 *                     compare_to:
 *                       type: object
 *                       properties:
 *                         total_sales:
 *                           type: integer
 *                         total_revenue:
 *                           type: number
 *                         avg_order_value:
 *                           type: number
 *                         unique_customers:
 *                           type: integer
 *                         new_customers:
 *                           type: integer
 *                         total_tickets:
 *                           type: integer
 *                         resolved_tickets:
 *                           type: integer
 *                     growth:
 *                       type: object
 *                       properties:
 *                         sales:
 *                           type: number
 *                           description: Crescimento percentual em vendas
 *                         revenue:
 *                           type: number
 *                           description: Crescimento percentual em receita
 *                         avg_order_value:
 *                           type: number
 *                         unique_customers:
 *                           type: number
 *                         new_customers:
 *                           type: number
 *                         tickets:
 *                           type: number
 *                         resolved_tickets:
 *                           type: number
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/comparisons', authenticateToken, authorize(['admin', 'manager']), AnalyticsController.getComparisons);

/**
 * @swagger
 * /api/analytics/export:
 *   post:
 *     summary: Exportar relatório
 *     description: Exporta relatórios analytics em diferentes formatos
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ExportRequest'
 *     responses:
 *       200:
 *         description: Relatório exportado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     export_id:
 *                       type: string
 *                       format: uuid
 *                     report_type:
 *                       type: string
 *                     period:
 *                       type: string
 *                     format:
 *                       type: string
 *                     exported_at:
 *                       type: string
 *                       format: date-time
 *                     data:
 *                       type: object
 *                       description: Dados do relatório exportado
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post('/export', authenticateToken, authorize(['admin', 'manager']), AnalyticsController.exportReport);

module.exports = router;