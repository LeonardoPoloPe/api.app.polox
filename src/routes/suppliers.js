/**
 * ==========================================
 * 🏢 SUPPLIERS ROUTES - COPILOT_PROMPT_6
 * ==========================================
 * Rotas completas para gestão de fornecedores
 * ==========================================
 */

const express = require('express');
const router = express.Router();
const SupplierController = require('../controllers/SupplierController');
const { authenticateToken, authorize } = require('../utils/auth');

/**
 * @swagger
 * components:
 *   schemas:
 *     Supplier:
 *       type: object
 *       required:
 *         - name
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           description: ID único do fornecedor
 *         name:
 *           type: string
 *           description: Nome do fornecedor
 *           example: "Fornecedor ABC Ltda"
 *         company_name:
 *           type: string
 *           description: Nome da empresa
 *           example: "ABC Suprimentos Ltda"
 *         email:
 *           type: string
 *           format: email
 *           description: Email de contato
 *           example: "contato@abcsuprimentos.com"
 *         phone:
 *           type: string
 *           description: Telefone de contato
 *           example: "(11) 99999-9999"
 *         website:
 *           type: string
 *           format: uri
 *           description: Website do fornecedor
 *           example: "https://www.abcsuprimentos.com"
 *         cnpj:
 *           type: string
 *           description: CNPJ do fornecedor
 *           example: "12.345.678/0001-00"
 *         category:
 *           type: string
 *           description: Categoria do fornecedor
 *           example: "materials"
 *         status:
 *           type: string
 *           enum: [active, inactive, pending, blocked]
 *           description: Status do fornecedor
 *         payment_terms:
 *           type: string
 *           description: Condições de pagamento
 *           example: "30 dias"
 *         credit_limit:
 *           type: number
 *           format: float
 *           description: Limite de crédito
 *           example: 50000.00
 *         delivery_time:
 *           type: integer
 *           description: Tempo de entrega em dias
 *           example: 7
 *         rating:
 *           type: number
 *           format: float
 *           minimum: 1
 *           maximum: 5
 *           description: Avaliação do fornecedor
 *         address:
 *           type: object
 *           properties:
 *             street:
 *               type: string
 *             city:
 *               type: string
 *             state:
 *               type: string
 *             zip_code:
 *               type: string
 *             country:
 *               type: string
 *         contacts:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *               phone:
 *                 type: string
 *               role:
 *                 type: string
 *         tags:
 *           type: array
 *           items:
 *             type: string
 *         notes:
 *           type: string
 *           description: Observações sobre o fornecedor
 *         custom_fields:
 *           type: object
 *           description: Campos personalizados
 *         created_at:
 *           type: string
 *           format: date-time
 *         updated_at:
 *           type: string
 *           format: date-time
 * 
 *     PurchaseOrder:
 *       type: object
 *       required:
 *         - items
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         order_number:
 *           type: string
 *           description: Número do pedido
 *         description:
 *           type: string
 *           description: Descrição do pedido
 *         expected_delivery:
 *           type: string
 *           format: date-time
 *           description: Data esperada de entrega
 *         priority:
 *           type: string
 *           enum: [low, medium, high, urgent]
 *         total_amount:
 *           type: number
 *           format: float
 *         status:
 *           type: string
 *           enum: [pending, approved, in_progress, delivered, cancelled]
 *         notes:
 *           type: string
 *         items:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               product_id:
 *                 type: string
 *                 format: uuid
 *               product_name:
 *                 type: string
 *               quantity:
 *                 type: number
 *               unit_price:
 *                 type: number
 *                 format: float
 * 
 *     SupplierRating:
 *       type: object
 *       required:
 *         - rating
 *       properties:
 *         rating:
 *           type: number
 *           minimum: 1
 *           maximum: 5
 *           description: Avaliação de 1 a 5 estrelas
 *         comment:
 *           type: string
 *           description: Comentário sobre a avaliação
 * 
 *   parameters:
 *     SupplierFilters:
 *       - name: page
 *         in: query
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Número da página
 *       - name: limit
 *         in: query
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *         description: Itens por página
 *       - name: search
 *         in: query
 *         schema:
 *           type: string
 *         description: Termo de busca
 *       - name: status
 *         in: query
 *         schema:
 *           type: string
 *           enum: [active, inactive, pending, blocked]
 *         description: Filtrar por status
 *       - name: category
 *         in: query
 *         schema:
 *           type: string
 *         description: Filtrar por categoria
 *       - name: rating_min
 *         in: query
 *         schema:
 *           type: number
 *           minimum: 1
 *           maximum: 5
 *         description: Avaliação mínima
 */

/**
 * @swagger
 * /api/suppliers:
 *   get:
 *     summary: Listar fornecedores
 *     description: Retorna lista paginada de fornecedores com filtros avançados
 *     tags: [Suppliers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/AcceptLanguage'
 *       - $ref: '#/components/parameters/SupplierFilters'
 *     responses:
 *       200:
 *         description: Lista de fornecedores retornada com sucesso
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
 *                     $ref: '#/components/schemas/Supplier'
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 *                 stats:
 *                   type: object
 *                   properties:
 *                     total_suppliers:
 *                       type: integer
 *                     active_suppliers:
 *                       type: integer
 *                     average_rating:
 *                       type: number
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/', authenticateToken, SupplierController.index);

/**
 * @swagger
 * /api/suppliers:
 *   post:
 *     summary: Criar fornecedor
 *     description: Cria um novo fornecedor no sistema
 *     tags: [Suppliers]
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
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Fornecedor ABC Ltda"
 *               company_name:
 *                 type: string
 *                 example: "ABC Suprimentos Ltda"
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "contato@abcsuprimentos.com"
 *               phone:
 *                 type: string
 *                 example: "(11) 99999-9999"
 *               website:
 *                 type: string
 *                 example: "https://www.abcsuprimentos.com"
 *               cnpj:
 *                 type: string
 *                 example: "12.345.678/0001-00"
 *               category:
 *                 type: string
 *                 example: "materials"
 *               status:
 *                 type: string
 *                 enum: [active, inactive, pending]
 *                 default: active
 *               payment_terms:
 *                 type: string
 *                 example: "30 dias"
 *               credit_limit:
 *                 type: number
 *                 example: 50000.00
 *               delivery_time:
 *                 type: integer
 *                 example: 7
 *               address:
 *                 type: object
 *                 properties:
 *                   street:
 *                     type: string
 *                   city:
 *                     type: string
 *                   state:
 *                     type: string
 *                   zip_code:
 *                     type: string
 *                   country:
 *                     type: string
 *               contacts:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     name:
 *                       type: string
 *                     email:
 *                       type: string
 *                     phone:
 *                       type: string
 *                     role:
 *                       type: string
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *               notes:
 *                 type: string
 *               custom_fields:
 *                 type: object
 *     responses:
 *       201:
 *         description: Fornecedor criado com sucesso
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
 *                   $ref: '#/components/schemas/Supplier'
 *                 gamification:
 *                   $ref: '#/components/schemas/GamificationReward'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       409:
 *         description: Fornecedor já existe
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post('/', authenticateToken, authorize(['admin', 'manager', 'user']), SupplierController.create);

/**
 * @swagger
 * /api/suppliers/{id}:
 *   get:
 *     summary: Obter fornecedor
 *     description: Retorna detalhes completos de um fornecedor específico
 *     tags: [Suppliers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/AcceptLanguage'
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID do fornecedor
 *     responses:
 *       200:
 *         description: Detalhes do fornecedor retornados com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   allOf:
 *                     - $ref: '#/components/schemas/Supplier'
 *                     - type: object
 *                       properties:
 *                         total_orders:
 *                           type: integer
 *                         total_spent:
 *                           type: number
 *                         related_products:
 *                           type: array
 *                           items:
 *                             type: object
 *                         recent_orders:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/PurchaseOrder'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/:id', authenticateToken, SupplierController.show);

/**
 * @swagger
 * /api/suppliers/{id}:
 *   put:
 *     summary: Atualizar fornecedor
 *     description: Atualiza dados de um fornecedor existente
 *     tags: [Suppliers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID do fornecedor
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               company_name:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               phone:
 *                 type: string
 *               website:
 *                 type: string
 *               cnpj:
 *                 type: string
 *               category:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum: [active, inactive, pending, blocked]
 *               payment_terms:
 *                 type: string
 *               credit_limit:
 *                 type: number
 *               delivery_time:
 *                 type: integer
 *               address:
 *                 type: object
 *               contacts:
 *                 type: array
 *               tags:
 *                 type: array
 *               notes:
 *                 type: string
 *               custom_fields:
 *                 type: object
 *     responses:
 *       200:
 *         description: Fornecedor atualizado com sucesso
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
 *                   $ref: '#/components/schemas/Supplier'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       409:
 *         description: Conflito - Email ou CNPJ já existe
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.put('/:id', authenticateToken, authorize(['admin', 'manager', 'user']), SupplierController.update);

/**
 * @swagger
 * /api/suppliers/{id}:
 *   delete:
 *     summary: Deletar fornecedor
 *     description: Remove um fornecedor do sistema (soft delete)
 *     tags: [Suppliers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID do fornecedor
 *     responses:
 *       200:
 *         description: Fornecedor removido com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       400:
 *         description: Não é possível deletar - há pedidos ativos
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.delete('/:id', authenticateToken, authorize(['admin', 'manager']), SupplierController.destroy);

/**
 * @swagger
 * /api/suppliers/{id}/products:
 *   get:
 *     summary: Produtos do fornecedor
 *     description: Lista todos os produtos relacionados a um fornecedor
 *     tags: [Suppliers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID do fornecedor
 *     responses:
 *       200:
 *         description: Lista de produtos do fornecedor
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
 *                     supplier:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         name:
 *                           type: string
 *                     products:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           name:
 *                             type: string
 *                           sku:
 *                             type: string
 *                           cost_price:
 *                             type: number
 *                           lead_time:
 *                             type: integer
 *                           minimum_order_quantity:
 *                             type: integer
 *                           is_preferred:
 *                             type: boolean
 *                     total:
 *                       type: integer
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/:id/products', authenticateToken, SupplierController.getProducts);

/**
 * @swagger
 * /api/suppliers/{id}/orders:
 *   post:
 *     summary: Criar pedido de compra
 *     description: Cria um novo pedido de compra para o fornecedor
 *     tags: [Suppliers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID do fornecedor
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - items
 *             properties:
 *               description:
 *                 type: string
 *                 example: "Pedido de materiais de escritório"
 *               expected_delivery:
 *                 type: string
 *                 format: date-time
 *                 example: "2025-10-30T10:00:00Z"
 *               priority:
 *                 type: string
 *                 enum: [low, medium, high, urgent]
 *                 default: medium
 *               notes:
 *                 type: string
 *                 example: "Entrega urgente necessária"
 *               items:
 *                 type: array
 *                 minItems: 1
 *                 items:
 *                   type: object
 *                   required:
 *                     - product_name
 *                     - quantity
 *                     - unit_price
 *                   properties:
 *                     product_id:
 *                       type: string
 *                       format: uuid
 *                       description: ID do produto (opcional)
 *                     product_name:
 *                       type: string
 *                       example: "Papel A4"
 *                     quantity:
 *                       type: number
 *                       minimum: 1
 *                       example: 100
 *                     unit_price:
 *                       type: number
 *                       format: float
 *                       minimum: 0
 *                       example: 0.50
 *     responses:
 *       201:
 *         description: Pedido de compra criado com sucesso
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
 *                   $ref: '#/components/schemas/PurchaseOrder'
 *                 gamification:
 *                   $ref: '#/components/schemas/GamificationReward'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post('/:id/orders', authenticateToken, authorize(['admin', 'manager', 'user']), SupplierController.createOrder);

/**
 * @swagger
 * /api/suppliers/{id}/orders:
 *   get:
 *     summary: Histórico de pedidos
 *     description: Lista o histórico de pedidos de compra de um fornecedor
 *     tags: [Suppliers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID do fornecedor
 *       - name: page
 *         in: query
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Número da página
 *       - name: limit
 *         in: query
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *         description: Itens por página
 *       - name: status
 *         in: query
 *         schema:
 *           type: string
 *           enum: [pending, approved, in_progress, delivered, cancelled]
 *         description: Filtrar por status
 *     responses:
 *       200:
 *         description: Histórico de pedidos retornado com sucesso
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
 *                     supplier:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         name:
 *                           type: string
 *                     orders:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/PurchaseOrder'
 *                     pagination:
 *                       $ref: '#/components/schemas/Pagination'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/:id/orders', authenticateToken, SupplierController.getOrders);

/**
 * @swagger
 * /api/suppliers/{id}/rating:
 *   put:
 *     summary: Avaliar fornecedor
 *     description: Adiciona ou atualiza a avaliação de um fornecedor
 *     tags: [Suppliers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID do fornecedor
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SupplierRating'
 *     responses:
 *       200:
 *         description: Avaliação registrada com sucesso
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
 *                     rating:
 *                       type: number
 *                     comment:
 *                       type: string
 *                     new_average_rating:
 *                       type: number
 *                 gamification:
 *                   $ref: '#/components/schemas/GamificationReward'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.put('/:id/rating', authenticateToken, authorize(['admin', 'manager', 'user']), SupplierController.rateSupplier);

/**
 * @swagger
 * /api/suppliers/reports:
 *   get:
 *     summary: Relatórios de fornecedores
 *     description: Gera relatórios detalhados sobre fornecedores
 *     tags: [Suppliers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: report_type
 *         in: query
 *         required: true
 *         schema:
 *           type: string
 *           enum: [performance, categories]
 *         description: Tipo de relatório
 *       - name: period
 *         in: query
 *         schema:
 *           type: string
 *           enum: [week, month, quarter, year]
 *           default: month
 *         description: Período do relatório
 *     responses:
 *       200:
 *         description: Relatório gerado com sucesso
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
 *                     report_type:
 *                       type: string
 *                     period:
 *                       type: string
 *                     suppliers:
 *                       type: array
 *                       items:
 *                         type: object
 *                     categories:
 *                       type: array
 *                       items:
 *                         type: object
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/reports', authenticateToken, authorize(['admin', 'manager']), SupplierController.getReports);

/**
 * @swagger
 * /api/suppliers/import:
 *   post:
 *     summary: Importar fornecedores
 *     description: Importa múltiplos fornecedores em lote
 *     tags: [Suppliers]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - suppliers
 *             properties:
 *               suppliers:
 *                 type: array
 *                 minItems: 1
 *                 items:
 *                   type: object
 *                   required:
 *                     - name
 *                   properties:
 *                     name:
 *                       type: string
 *                       example: "Fornecedor ABC"
 *                     company_name:
 *                       type: string
 *                       example: "ABC Ltda"
 *                     email:
 *                       type: string
 *                       format: email
 *                       example: "contato@abc.com"
 *                     phone:
 *                       type: string
 *                       example: "(11) 99999-9999"
 *                     category:
 *                       type: string
 *                       example: "materials"
 *                     status:
 *                       type: string
 *                       enum: [active, inactive, pending]
 *                       default: active
 *     responses:
 *       200:
 *         description: Importação concluída
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
 *                     imported:
 *                       type: integer
 *                     skipped:
 *                       type: integer
 *                     errors:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           line:
 *                             type: integer
 *                           error:
 *                             type: string
 *                 gamification:
 *                   $ref: '#/components/schemas/GamificationReward'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post('/import', authenticateToken, authorize(['admin', 'manager']), SupplierController.importSuppliers);

module.exports = router;