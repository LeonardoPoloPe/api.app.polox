/**
 * ==========================================
 * 👥 ROTAS DE CLIENTES - CRM CORE
 * ==========================================
 */

const express = require('express');
const ClientController = require('../controllers/ClientController');
const { authenticateToken } = require('../middleware/auth');
const { rateLimiter } = require('../middleware/rateLimiter');
const { validateRequest } = require('../utils/validation');
const Joi = require('joi');

const router = express.Router();

// 🔐 Middleware obrigatório: autenticação
router.use(authenticateToken);

// 📝 Validações específicas
const createClientValidation = Joi.object({
  name: Joi.string().min(2).max(255).required(),
  email: Joi.string().email().allow(null),
  phone: Joi.string().max(20).allow(null),
  company: Joi.string().max(255).allow(null),
  position: Joi.string().max(100).allow(null),
  source: Joi.string().max(100).allow(null),
  status: Joi.string().valid('active', 'inactive', 'vip', 'blacklist').default('active'),
  category: Joi.string().max(100).allow(null),
  description: Joi.string().max(1000).allow(null),
  tags: Joi.array().items(Joi.string()).default([]),
  custom_fields: Joi.object().default({})
});

const updateClientValidation = Joi.object({
  name: Joi.string().min(2).max(255),
  email: Joi.string().email().allow(null),
  phone: Joi.string().max(20).allow(null),
  company: Joi.string().max(255).allow(null),
  position: Joi.string().max(100).allow(null),
  source: Joi.string().max(100).allow(null),
  status: Joi.string().valid('active', 'inactive', 'vip', 'blacklist'),
  category: Joi.string().max(100).allow(null),
  description: Joi.string().max(1000).allow(null),
  tags: Joi.array().items(Joi.string()),
  custom_fields: Joi.object()
});

/**
 * @swagger
 * /clients:
 *   get:
 *     summary: Listar todos os clientes
 *     description: Lista clientes com filtros, estatísticas de vendas e paginação
 *     tags: [Clients]
 *     security:
 *       - bearerAuth: []
 *     parameters:
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
 *           enum: [active, inactive, vip, blacklist]
 *         description: Filtrar por status (pode usar vírgula para múltiplos)
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Filtrar por categoria
 *       - in: query
 *         name: tag
 *         schema:
 *           type: string
 *         description: Filtrar por tag específica
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Busca por nome, email ou empresa
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [name, total_spent, last_purchase_at, created_at]
 *           default: name
 *         description: Campo para ordenação
 *       - in: query
 *         name: order
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: asc
 *         description: Direção da ordenação
 *     responses:
 *       200:
 *         description: Lista de clientes com estatísticas
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
 *                     $ref: '#/components/schemas/Client'
 *                 pagination:
 *                   $ref: '#/components/schemas/PaginationInfo'
 *                 stats:
 *                   type: object
 *                   properties:
 *                     total_clients:
 *                       type: integer
 *                     active_clients:
 *                       type: integer
 *                     vip_clients:
 *                       type: integer
 *                     average_lifetime_value:
 *                       type: number
 *                     total_revenue:
 *                       type: number
 */
router.get('/', rateLimiter.general, ClientController.index);

/**
 * @swagger
 * /clients:
 *   post:
 *     summary: Criar novo cliente
 *     description: Cria um cliente e concede XP/Coins ao usuário
 *     tags: [Clients]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 255
 *                 example: "Maria Santos"
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "maria@exemplo.com"
 *               phone:
 *                 type: string
 *                 maxLength: 20
 *                 example: "(11) 88888-8888"
 *               company:
 *                 type: string
 *                 maxLength: 255
 *                 example: "Empresa XYZ"
 *               position:
 *                 type: string
 *                 maxLength: 100
 *                 example: "CEO"
 *               source:
 *                 type: string
 *                 maxLength: 100
 *                 example: "referral"
 *               status:
 *                 type: string
 *                 enum: [active, inactive, vip, blacklist]
 *                 default: active
 *               category:
 *                 type: string
 *                 maxLength: 100
 *                 example: "premium"
 *               description:
 *                 type: string
 *                 maxLength: 1000
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["vip", "fidelizado"]
 *               custom_fields:
 *                 type: object
 *                 example: {"preferencia": "email", "desconto": "10%"}
 *     responses:
 *       201:
 *         description: Cliente criado com sucesso
 *       400:
 *         description: Dados inválidos ou email já existe
 */
router.post('/', rateLimiter.general, validateRequest(createClientValidation), ClientController.create);

/**
 * @swagger
 * /clients/stats:
 *   get:
 *     summary: Estatísticas gerais dos clientes
 *     description: Retorna estatísticas completas sobre os clientes da empresa
 *     tags: [Clients]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Estatísticas dos clientes
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
 *                     general:
 *                       type: object
 *                       properties:
 *                         total_clients:
 *                           type: integer
 *                         active_clients:
 *                           type: integer
 *                         vip_clients:
 *                           type: integer
 *                         inactive_clients:
 *                           type: integer
 *                         new_clients_month:
 *                           type: integer
 *                     financial:
 *                       type: object
 *                       properties:
 *                         clients_with_purchases:
 *                           type: integer
 *                         total_revenue:
 *                           type: number
 *                         average_ticket:
 *                           type: number
 *                         highest_sale:
 *                           type: number
 *                         total_sales:
 *                           type: integer
 *                     top_clients:
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
 */
router.get('/stats', rateLimiter.general, ClientController.getStats);

/**
 * @swagger
 * /clients/{id}:
 *   get:
 *     summary: Detalhes do cliente
 *     description: Busca informações completas de um cliente com estatísticas e notas recentes
 *     tags: [Clients]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do cliente
 *     responses:
 *       200:
 *         description: Detalhes do cliente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   allOf:
 *                     - $ref: '#/components/schemas/Client'
 *                     - type: object
 *                       properties:
 *                         recent_notes:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/ClientNote'
 *       404:
 *         description: Cliente não encontrado
 */
router.get('/:id', rateLimiter.general, ClientController.show);

/**
 * @swagger
 * /clients/{id}:
 *   put:
 *     summary: Atualizar cliente
 *     description: Atualiza informações de um cliente existente
 *     tags: [Clients]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do cliente
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 255
 *               email:
 *                 type: string
 *                 format: email
 *               phone:
 *                 type: string
 *                 maxLength: 20
 *               company:
 *                 type: string
 *                 maxLength: 255
 *               position:
 *                 type: string
 *                 maxLength: 100
 *               source:
 *                 type: string
 *                 maxLength: 100
 *               status:
 *                 type: string
 *                 enum: [active, inactive, vip, blacklist]
 *               category:
 *                 type: string
 *                 maxLength: 100
 *               description:
 *                 type: string
 *                 maxLength: 1000
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *               custom_fields:
 *                 type: object
 *     responses:
 *       200:
 *         description: Cliente atualizado com sucesso
 *       400:
 *         description: Dados inválidos
 *       404:
 *         description: Cliente não encontrado
 */
router.put('/:id', rateLimiter.general, validateRequest(updateClientValidation), ClientController.update);

/**
 * @swagger
 * /clients/{id}:
 *   delete:
 *     summary: Deletar cliente
 *     description: Remove um cliente (soft delete) - não permite se houver vendas ativas
 *     tags: [Clients]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do cliente
 *     responses:
 *       200:
 *         description: Cliente deletado com sucesso
 *       400:
 *         description: Não é possível deletar cliente com vendas ativas
 *       404:
 *         description: Cliente não encontrado
 */
router.delete('/:id', rateLimiter.general, ClientController.destroy);

/**
 * @swagger
 * /clients/{id}/history:
 *   get:
 *     summary: Histórico completo de vendas do cliente
 *     description: Retorna todas as vendas do cliente com itens e estatísticas
 *     tags: [Clients]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do cliente
 *     responses:
 *       200:
 *         description: Histórico de vendas do cliente
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
 *                     client:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         name:
 *                           type: string
 *                     sales:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Sale'
 *                     stats:
 *                       type: object
 *                       properties:
 *                         total_purchases:
 *                           type: integer
 *                         total_spent:
 *                           type: number
 *                         average_ticket:
 *                           type: number
 *                         last_purchase:
 *                           type: string
 *                           format: date
 *                         first_purchase:
 *                           type: string
 *                           format: date
 *       404:
 *         description: Cliente não encontrado
 */
router.get('/:id/history', rateLimiter.general, ClientController.getSalesHistory);

/**
 * @swagger
 * /clients/{id}/notes:
 *   post:
 *     summary: Adicionar anotação ao cliente
 *     description: Adiciona uma nova anotação ao cliente e concede XP/Coins
 *     tags: [Clients]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do cliente
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - note
 *             properties:
 *               note:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 1000
 *                 example: "Cliente interessado em novos produtos"
 *               type:
 *                 type: string
 *                 enum: [general, call, meeting, email, other]
 *                 default: general
 *                 example: "call"
 *     responses:
 *       201:
 *         description: Anotação criada com sucesso
 *       400:
 *         description: Dados inválidos
 *       404:
 *         description: Cliente não encontrado
 */
router.post('/:id/notes', rateLimiter.general, validateRequest(Joi.object({
  note: Joi.string().min(1).max(1000).required(),
  type: Joi.string().valid('general', 'call', 'meeting', 'email', 'other').default('general')
})), ClientController.addNote);

/**
 * @swagger
 * /clients/{id}/tags:
 *   put:
 *     summary: Gerenciar tags do cliente
 *     description: Atualiza as tags associadas ao cliente
 *     tags: [Clients]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do cliente
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - tags
 *             properties:
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["vip", "fidelizado", "premium"]
 *     responses:
 *       200:
 *         description: Tags atualizadas com sucesso
 *       400:
 *         description: Dados inválidos
 *       404:
 *         description: Cliente não encontrado
 */
router.put('/:id/tags', rateLimiter.general, validateRequest(Joi.object({
  tags: Joi.array().items(Joi.string()).required()
})), ClientController.manageTags);

module.exports = router;