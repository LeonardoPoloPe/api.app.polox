/**
 * ==========================================
 * 💼 ROTAS DE NEGOCIAÇÕES - PIPELINE DE VENDAS
 * ==========================================
 * 
 * Arquitetura: "Identidade vs. Intenção"
 * - Intenção (Deal): O QUE a pessoa quer comprar
 * - Tabela: polox.deals
 */

const express = require('express');
const DealController = require('../controllers/DealController');
const { authenticateToken } = require('../middleware/auth');
const { rateLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// 🔐 Middleware obrigatório: autenticação
router.use(authenticateToken);

/**
 * @swagger
 * /deals:
 *   get:
 *     summary: Listar negociações (pipeline)
 *     description: Lista todas as negociações com filtros e paginação
 *     tags: [Deals]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/AcceptLanguage'
 *       - in: query
 *         name: contato_id
 *         schema:
 *           type: integer
 *         description: Filtrar por contato
 *       - in: query
 *         name: owner_id
 *         schema:
 *           type: integer
 *         description: Filtrar por responsável
 *       - in: query
 *         name: etapa_funil
 *         schema:
 *           type: string
 *         description: Filtrar por etapa do funil (ex novo, qualificado, proposta, negociacao, fechamento)
 *       - in: query
 *         name: origem
 *         schema:
 *           type: string
 *         description: Filtrar por origem
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [open, won, lost]
 *         description: Filtrar por status (aberta, ganha, perdida)
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Buscar por título, descrição ou nome do contato
 *       - in: query
 *         name: sort_by
 *         schema:
 *           type: string
 *           enum: [created_at, updated_at, valor_total_cents, etapa_funil]
 *           default: created_at
 *       - in: query
 *         name: sort_order
 *         schema:
 *           type: string
 *           enum: [ASC, DESC]
 *           default: DESC
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *     responses:
 *       200:
 *         description: Lista de negociações
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
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Deal'
 */
router.get('/', DealController.list);

/**
 * @swagger
 * /deals/stats:
 *   get:
 *     summary: Estatísticas do funil de vendas
 *     description: |
 *       Retorna estatísticas completas do pipeline:
 *       - Total de deals (abertas, ganhas, perdidas)
 *       - Valores (aberto, ganho, média)
 *       - Taxa de conversão
 *       - Tempo médio de fechamento
 *     tags: [Deals]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/AcceptLanguage'
 *       - in: query
 *         name: owner_id
 *         schema:
 *           type: integer
 *       - in: query
 *         name: etapa_funil
 *         schema:
 *           type: string
 *       - in: query
 *         name: origem
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Estatísticas do funil
 */
router.get('/stats', DealController.getStats);

/**
 * @swagger
 * /contacts/{contactId}/deals:
 *   get:
 *     summary: Listar negociações de um contato
 *     description: Retorna todas as negociações vinculadas a um contato específico
 *     tags: [Deals]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/AcceptLanguage'
 *       - in: path
 *         name: contactId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID do contato
 *     responses:
 *       200:
 *         description: Lista de negociações do contato
 */
// Esta rota será registrada em contacts.js com router.use('/:contactId/deals', dealsRouter)

/**
 * @swagger
 * /deals/{id}:
 *   get:
 *     summary: Buscar negociação por ID
 *     description: Retorna detalhes completos de uma negociação (com JOIN contact + user)
 *     tags: [Deals]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/AcceptLanguage'
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Detalhes da negociação
 *       404:
 *         description: Negociação não encontrada
 */
router.get('/:id', DealController.show);

/**
 * @swagger
 * /deals:
 *   post:
 *     summary: Criar nova negociação
 *     description: Cria uma nova oportunidade de venda no pipeline
 *     tags: [Deals]
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
 *               - contato_id
 *               - titulo
 *             properties:
 *               contato_id:
 *                 type: integer
 *                 description: ID do contato vinculado
 *                 example: 123
 *               titulo:
 *                 type: string
 *                 minLength: 3
 *                 example: "Venda de Produto X"
 *               descricao:
 *                 type: string
 *                 example: "Cliente interessado em 100 unidades"
 *               etapa_funil:
 *                 type: string
 *                 default: "novo"
 *                 example: "qualificado"
 *               valor_total_cents:
 *                 type: integer
 *                 minimum: 0
 *                 description: Valor em centavos
 *                 example: 500000
 *               probabilidade:
 *                 type: integer
 *                 minimum: 0
 *                 maximum: 100
 *                 default: 0
 *                 example: 75
 *               origem:
 *                 type: string
 *                 example: "site"
 *               expected_close_date:
 *                 type: string
 *                 format: date
 *                 example: "2025-12-31"
 *               owner_id:
 *                 type: integer
 *               metadata:
 *                 type: object
 *     responses:
 *       201:
 *         description: Negociação criada
 *       400:
 *         description: Dados inválidos
 *       404:
 *         description: Contato não encontrado
 */
router.post('/', rateLimiter({ maxRequests: 100, windowMs: 60000 }), DealController.create);

/**
 * @swagger
 * /deals/{id}:
 *   put:
 *     summary: Atualizar negociação
 *     description: Atualiza dados de uma negociação existente
 *     tags: [Deals]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/AcceptLanguage'
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               titulo:
 *                 type: string
 *               descricao:
 *                 type: string
 *               etapa_funil:
 *                 type: string
 *               valor_total_cents:
 *                 type: integer
 *               probabilidade:
 *                 type: integer
 *               origem:
 *                 type: string
 *               expected_close_date:
 *                 type: string
 *                 format: date
 *               owner_id:
 *                 type: integer
 *               metadata:
 *                 type: object
 *     responses:
 *       200:
 *         description: Negociação atualizada
 *       404:
 *         description: Negociação não encontrada
 */
router.put('/:id', DealController.update);

/**
 * @swagger
 * /deals/{id}/stage:
 *   put:
 *     summary: Mover etapa do funil
 *     description: Atualiza apenas a etapa do funil (ex novo → qualificado → proposta)
 *     tags: [Deals]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/AcceptLanguage'
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - etapa_funil
 *             properties:
 *               etapa_funil:
 *                 type: string
 *                 example: "proposta"
 *     responses:
 *       200:
 *         description: Etapa atualizada
 */
router.put('/:id/stage', DealController.updateStage);

/**
 * @swagger
 * /deals/{id}/win:
 *   put:
 *     summary: Marcar negociação como GANHA ✅
 *     description: |
 *       IMPORTANTE: Conversão automática Lead → Cliente
 *       
 *       Executa transação atômica:
 *       1. UPDATE deals: closed_at=NOW(), closed_reason='won'
 *       2. UPDATE contacts: tipo='cliente', lifetime_value_cents+=valor
 *       
 *       Se o contato era lead, será automaticamente convertido para cliente!
 *     tags: [Deals]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/AcceptLanguage'
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Negociação marcada como ganha + lead convertido automaticamente
 *       404:
 *         description: Negociação não encontrada
 */
router.put('/:id/win', DealController.markAsWon);

/**
 * @swagger
 * /deals/{id}/lose:
 *   put:
 *     summary: Marcar negociação como PERDIDA ❌
 *     description: Fecha a negociação com motivo de perda
 *     tags: [Deals]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/AcceptLanguage'
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *                 example: "Preço muito alto"
 *     responses:
 *       200:
 *         description: Negociação marcada como perdida
 */
router.put('/:id/lose', DealController.markAsLost);

/**
 * @swagger
 * /deals/{id}/reopen:
 *   put:
 *     summary: Reabrir negociação fechada 🔓
 *     description: Remove closed_at e closed_reason, reabrindo a negociação
 *     tags: [Deals]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/AcceptLanguage'
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Negociação reaberta
 */
router.put('/:id/reopen', DealController.reopen);

/**
 * @swagger
 * /deals/{id}:
 *   delete:
 *     summary: Excluir negociação (soft delete)
 *     description: Exclusão lógica da negociação
 *     tags: [Deals]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/AcceptLanguage'
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Negociação excluída
 */
router.delete('/:id', DealController.delete);

/**
 * @swagger
 * components:
 *   schemas:
 *     Deal:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         company_id:
 *           type: integer
 *         contato_id:
 *           type: integer
 *         owner_id:
 *           type: integer
 *         titulo:
 *           type: string
 *         descricao:
 *           type: string
 *         etapa_funil:
 *           type: string
 *         valor_total_cents:
 *           type: integer
 *         probabilidade:
 *           type: integer
 *         origem:
 *           type: string
 *         expected_close_date:
 *           type: string
 *           format: date
 *         closed_at:
 *           type: string
 *           format: date-time
 *         closed_reason:
 *           type: string
 *           enum: [won, lost]
 *         metadata:
 *           type: object
 *         contact_name:
 *           type: string
 *           description: Nome do contato (JOIN)
 *         contact_email:
 *           type: string
 *         contact_phone:
 *           type: string
 *         contact_type:
 *           type: string
 *         owner_name:
 *           type: string
 *           description: Nome do responsável (JOIN)
 *         created_at:
 *           type: string
 *           format: date-time
 *         updated_at:
 *           type: string
 *           format: date-time
 */

module.exports = router;
