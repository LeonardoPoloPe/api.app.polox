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
 * 💰 ROTAS DE VENDAS - CRM CORE
 * ==========================================
 */

const express = require('express');
const SaleController = require('../controllers/SaleController');
const { authenticateToken } = require('../middleware/auth');
const { rateLimiter } = require('../middleware/rateLimiter');
const { validateRequest } = require('../utils/validation');
const Joi = require('joi');

const router = express.Router();

// 🔐 Middleware obrigatório: autenticação
router.use(authenticateToken);

// 📝 Validações específicas
const createSaleValidation = Joi.object({
  client_id: Joi.string().required(),
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
});

const updateSaleValidation = Joi.object({
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

/**
 * @swagger
 * /sales:
 *   get:
 *     summary: Listar todas as vendas
 *     description: Lista vendas com filtros avançados, estatísticas e paginação
 *     tags: [Sales]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/AcceptLanguage'
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Página da consulta
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 100
 *         description: Itens por página
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [completed, cancelled, processing]
 *         description: Filtrar por status (pode usar vírgula para múltiplos)
 *       - in: query
 *         name: payment_status
 *         schema:
 *           type: string
 *           enum: [pending, paid, partially_paid, overdue, cancelled]
 *         description: Filtrar por status de pagamento (pode usar vírgula para múltiplos)
 *       - in: query
 *         name: user_id
 *         schema:
 *           type: string
 *         description: Filtrar por vendedor (ID do usuário)
 *       - in: query
 *         name: client_id
 *         schema:
 *           type: string
 *         description: Filtrar por cliente (ID do cliente)
 *       - in: query
 *         name: date_from
 *         schema:
 *           type: string
 *           format: date
 *         description: Data inicial das vendas
 *       - in: query
 *         name: date_to
 *         schema:
 *           type: string
 *           format: date
 *         description: Data final das vendas
 *       - in: query
 *         name: amount_min
 *         schema:
 *           type: number
 *         description: Valor mínimo da venda
 *       - in: query
 *         name: amount_max
 *         schema:
 *           type: number
 *         description: Valor máximo da venda
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Busca por nome do cliente, email ou descrição
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [sale_date, total_amount, client_name, status, payment_status]
 *           default: sale_date
 *         description: Campo para ordenação
 *       - in: query
 *         name: order
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Direção da ordenação
 *     responses:
 *       200:
 *         description: Lista de vendas com estatísticas
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Sale'
 *                 pagination:
 *                   $ref: '#/components/schemas/PaginationInfo'
 *                 stats:
 *                   type: object
 *                   properties:
 *                     total_sales:
 *                       type: integer
 *                     total_revenue:
 *                       type: number
 *                     average_ticket:
 *                       type: number
 *                     paid_sales:
 *                       type: integer
 *                     pending_sales:
 *                       type: integer
 *                     completed_sales:
 *                       type: integer
 *                     cancelled_sales:
 *                       type: integer
 *                     highest_sale:
 *                       type: number
 */
router.get('/', rateLimiter.general, SaleController.index);

/**
 * @swagger
 * /sales:
 *   post:
 *     summary: Registrar nova venda
 *     description: Cria uma venda com itens, atualiza estoque e concede XP/Coins
 *     tags: [Sales]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/AcceptLanguage'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - client_id
 *               - items
 *             properties:
 *               client_id:
 *                 type: string
 *                 example: "client-uuid-123"
 *                 description: ID do cliente
 *               description:
 *                 type: string
 *                 maxLength: 1000
 *                 example: "Venda de produtos premium"
 *               sale_date:
 *                 type: string
 *                 format: date
 *                 example: "2024-01-15"
 *               payment_method:
 *                 type: string
 *                 enum: [cash, credit_card, debit_card, pix, bank_transfer, check, other]
 *                 default: cash
 *               payment_status:
 *                 type: string
 *                 enum: [pending, paid, partially_paid, overdue, cancelled]
 *                 default: pending
 *               discount_amount:
 *                 type: number
 *                 minimum: 0
 *                 default: 0
 *                 example: 100.00
 *               tax_amount:
 *                 type: number
 *                 minimum: 0
 *                 default: 0
 *                 example: 50.00
 *               items:
 *                 type: array
 *                 minItems: 1
 *                 items:
 *                   type: object
 *                   required:
 *                     - product_name
 *                     - quantity
 *                     - unit_price
 *                     - total_price
 *                   properties:
 *                     product_id:
 *                       type: string
 *                       example: "product-uuid-456"
 *                       description: ID do produto (opcional)
 *                     product_name:
 *                       type: string
 *                       example: "Produto A"
 *                     quantity:
 *                       type: number
 *                       minimum: 1
 *                       example: 2
 *                     unit_price:
 *                       type: number
 *                       minimum: 0
 *                       example: 250.00
 *                     total_price:
 *                       type: number
 *                       minimum: 0
 *                       example: 500.00
 *     responses:
 *       201:
 *         description: Venda criada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   allOf:
 *                     - $ref: '#/components/schemas/Sale'
 *                     - type: object
 *                       properties:
 *                         items:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/SaleItem'
 *       400:
 *         description: Dados inválidos ou total negativo
 *       404:
 *         description: Cliente não encontrado
 */
router.post('/', rateLimiter.general, validateRequest(createSaleValidation), SaleController.create);

/**
 * @swagger
 * /sales/{id}:
 *   get:
 *     summary: Detalhes da venda
 *     description: Busca informações completas de uma venda com todos os itens
 *     tags: [Sales]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/AcceptLanguage'
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID da venda
 *     responses:
 *       200:
 *         description: Detalhes da venda
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   allOf:
 *                     - $ref: '#/components/schemas/Sale'
 *                     - type: object
 *                       properties:
 *                         client_name:
 *                           type: string
 *                         client_email:
 *                           type: string
 *                         client_phone:
 *                           type: string
 *                         client_company:
 *                           type: string
 *                         seller_name:
 *                           type: string
 *                         seller_email:
 *                           type: string
 *                         items:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/SaleItem'
 *       404:
 *         description: Venda não encontrada
 */
router.get('/:id', rateLimiter.general, SaleController.show);

/**
 * @swagger
 * /sales/{id}:
 *   put:
 *     summary: Atualizar venda
 *     description: Atualiza informações de uma venda existente (não permite alterar itens)
 *     tags: [Sales]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/AcceptLanguage'
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID da venda
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               description:
 *                 type: string
 *                 maxLength: 1000
 *               payment_method:
 *                 type: string
 *                 enum: [cash, credit_card, debit_card, pix, bank_transfer, check, other]
 *               payment_status:
 *                 type: string
 *                 enum: [pending, paid, partially_paid, overdue, cancelled]
 *               discount_amount:
 *                 type: number
 *                 minimum: 0
 *               tax_amount:
 *                 type: number
 *                 minimum: 0
 *     responses:
 *       200:
 *         description: Venda atualizada com sucesso
 *       400:
 *         description: Não é possível atualizar venda cancelada
 *       404:
 *         description: Venda não encontrada
 */
router.put('/:id', rateLimiter.general, validateRequest(updateSaleValidation), SaleController.update);

/**
 * @swagger
 * /sales/{id}:
 *   delete:
 *     summary: Cancelar venda
 *     description: Cancela uma venda, reverte estoque e atualiza estatísticas do cliente
 *     tags: [Sales]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/AcceptLanguage'
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID da venda
 *     responses:
 *       200:
 *         description: Venda cancelada com sucesso
 *       400:
 *         description: Venda já cancelada
 *       404:
 *         description: Venda não encontrada
 */
router.delete('/:id', rateLimiter.general, SaleController.destroy);

module.exports = router;