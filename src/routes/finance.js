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

const express = require('express');
const FinanceController = require('../controllers/FinanceController');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Middleware de autenticação para todas as rotas
router.use(authMiddleware);

/**
 * @swagger
 * components:
 *   schemas:
 *     FinancialTransaction:
 *       type: object
 *       required:
 *         - type
 *         - amount
 *         - description
 *       properties:
 *         id:
 *           type: string
 *           description: ID único da transação
 *         type:
 *           type: string
 *           enum: [income, expense]
 *           description: Tipo da transação
 *         amount:
 *           type: number
 *           description: Valor da transação
 *         description:
 *           type: string
 *           description: Descrição da transação
 *         category_id:
 *           type: string
 *           description: ID da categoria
 *         category_name:
 *           type: string
 *           description: Nome da categoria (criada automaticamente)
 *         payment_method:
 *           type: string
 *           description: Método de pagamento
 *         due_date:
 *           type: string
 *           format: date
 *           description: Data de vencimento
 *         paid_date:
 *           type: string
 *           format: date
 *           description: Data de pagamento
 *         status:
 *           type: string
 *           enum: [pending, paid, overdue, cancelled]
 *           description: Status da transação
 *         recurring:
 *           type: boolean
 *           description: Transação recorrente
 *         tags:
 *           type: array
 *           items:
 *             type: string
 *         notes:
 *           type: string
 *     FinancialCategory:
 *       type: object
 *       required:
 *         - name
 *       properties:
 *         id:
 *           type: string
 *         name:
 *           type: string
 *         description:
 *           type: string
 *         type:
 *           type: string
 *           enum: [income, expense, both]
 *   tags:
 *     - name: Finance
 *       description: Gestão financeira e controle de fluxo de caixa
 */

/**
 * @swagger
 * /api/finance/dashboard:
 *   get:
 *     summary: Dashboard financeiro
 *     tags: [Finance]
 *     parameters:
 *       - $ref: '#/components/parameters/AcceptLanguage'
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [week, month, quarter, year]
 *         description: Período para análise
 *     responses:
 *       200:
 *         description: Dados do dashboard financeiro
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
 *                     summary:
 *                       type: object
 *                       properties:
 *                         total_income:
 *                           type: number
 *                         total_expenses:
 *                           type: number
 *                         net_income:
 *                           type: number
 *                         profit_margin:
 *                           type: number
 *                     evolution:
 *                       type: array
 *                       items:
 *                         type: object
 *                     top_expense_categories:
 *                       type: array
 *                     upcoming_transactions:
 *                       type: array
 */
router.get('/dashboard', FinanceController.getDashboard);

/**
 * @swagger
 * /api/finance/transactions:
 *   get:
 *     summary: Listar transações financeiras
 *     tags: [Finance]
 *     parameters:
 *       - $ref: '#/components/parameters/AcceptLanguage'
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Número da página
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Itens por página
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [income, expense]
 *         description: Filtrar por tipo
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, paid, overdue, cancelled]
 *         description: Filtrar por status
 *       - in: query
 *         name: category_id
 *         schema:
 *           type: string
 *         description: Filtrar por categoria
 *       - in: query
 *         name: date_from
 *         schema:
 *           type: string
 *           format: date
 *         description: Data inicial
 *       - in: query
 *         name: date_to
 *         schema:
 *           type: string
 *           format: date
 *         description: Data final
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Buscar na descrição
 *     responses:
 *       200:
 *         description: Lista de transações
 */
router.get('/transactions', FinanceController.getTransactions);

/**
 * @swagger
 * /api/finance/transactions:
 *   post:
 *     summary: Criar transação financeira
 *     tags: [Finance]
 *     parameters:
 *       - $ref: '#/components/parameters/AcceptLanguage'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/FinancialTransaction'
 *     responses:
 *       201:
 *         description: Transação criada com sucesso
 *       400:
 *         description: Dados inválidos
 */
router.post('/transactions', FinanceController.createTransaction);

/**
 * @swagger
 * /api/finance/transactions/{id}:
 *   put:
 *     summary: Atualizar transação financeira
 *     tags: [Finance]
 *     parameters:
 *       - $ref: '#/components/parameters/AcceptLanguage'
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID da transação
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/FinancialTransaction'
 *     responses:
 *       200:
 *         description: Transação atualizada com sucesso
 *       404:
 *         description: Transação não encontrada
 */
router.put('/transactions/:id', FinanceController.updateTransaction);

/**
 * @swagger
 * /api/finance/transactions/{id}:
 *   delete:
 *     summary: Deletar transação financeira
 *     tags: [Finance]
 *     parameters:
 *       - $ref: '#/components/parameters/AcceptLanguage'
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID da transação
 *     responses:
 *       200:
 *         description: Transação deletada com sucesso
 *       404:
 *         description: Transação não encontrada
 */
router.delete('/transactions/:id', FinanceController.deleteTransaction);

/**
 * @swagger
 * /api/finance/categories:
 *   get:
 *     summary: Listar categorias financeiras
 *     tags: [Finance]
 *     parameters:
 *       - $ref: '#/components/parameters/AcceptLanguage'
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [income, expense]
 *         description: Filtrar por tipo de categoria
 *     responses:
 *       200:
 *         description: Lista de categorias
 */
router.get('/categories', FinanceController.getCategories);

/**
 * @swagger
 * /api/finance/categories:
 *   post:
 *     summary: Criar categoria financeira
 *     tags: [Finance]
 *     parameters:
 *       - $ref: '#/components/parameters/AcceptLanguage'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/FinancialCategory'
 *     responses:
 *       201:
 *         description: Categoria criada com sucesso
 */
router.post('/categories', FinanceController.createCategory);

/**
 * @swagger
 * /api/finance/cash-flow:
 *   get:
 *     summary: Fluxo de caixa
 *     tags: [Finance]
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: integer
 *         description: Número de dias (máximo 365)
 *       - in: query
 *         name: include_pending
 *         schema:
 *           type: boolean
 *         description: Incluir transações pendentes
 *     responses:
 *       200:
 *         description: Dados do fluxo de caixa
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
 *                     cash_flow:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           date:
 *                             type: string
 *                             format: date
 *                           income:
 *                             type: number
 *                           expenses:
 *                             type: number
 *                           net_flow:
 *                             type: number
 *                           accumulated_balance:
 *                             type: number
 *                     summary:
 *                       type: object
 */
router.get('/cash-flow', FinanceController.getCashFlow);

/**
 * @swagger
 * /api/finance/profit-loss:
 *   get:
 *     summary: DRE - Demonstração de Resultado
 *     tags: [Finance]
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [week, month, quarter, year]
 *         description: Período para análise
 *       - in: query
 *         name: year
 *         schema:
 *           type: integer
 *         description: Ano específico
 *       - in: query
 *         name: month
 *         schema:
 *           type: integer
 *         description: Mês específico (1-12)
 *     responses:
 *       200:
 *         description: Demonstração de Resultado
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
 *                     revenues:
 *                       type: object
 *                       properties:
 *                         items:
 *                           type: array
 *                         total:
 *                           type: number
 *                     expenses:
 *                       type: object
 *                       properties:
 *                         items:
 *                           type: array
 *                         total:
 *                           type: number
 *                     summary:
 *                       type: object
 *                       properties:
 *                         gross_revenue:
 *                           type: number
 *                         total_expenses:
 *                           type: number
 *                         gross_profit:
 *                           type: number
 *                         profit_margin_percent:
 *                           type: number
 */
router.get('/profit-loss', FinanceController.getProfitLoss);

module.exports = router;