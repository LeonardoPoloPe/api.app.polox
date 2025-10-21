const express = require('express');
const ProductController = require('../controllers/ProductController');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Middleware de autenticação para todas as rotas
router.use(authMiddleware);

/**
 * @swagger
 * components:
 *   schemas:
 *     Product:
 *       type: object
 *       required:
 *         - name
 *         - price
 *       properties:
 *         id:
 *           type: string
 *           description: ID único do produto
 *         name:
 *           type: string
 *           description: Nome do produto
 *         description:
 *           type: string
 *           description: Descrição do produto
 *         sku:
 *           type: string
 *           description: Código SKU do produto
 *         type:
 *           type: string
 *           enum: [product, service]
 *           description: Tipo do item
 *         price:
 *           type: number
 *           description: Preço de venda
 *         cost_price:
 *           type: number
 *           description: Preço de custo
 *         current_stock:
 *           type: integer
 *           description: Estoque atual
 *         min_stock:
 *           type: integer
 *           description: Estoque mínimo
 *         is_active:
 *           type: boolean
 *           description: Produto ativo
 *     ProductCategory:
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
 *     StockAdjustment:
 *       type: object
 *       required:
 *         - type
 *         - quantity
 *         - reason
 *       properties:
 *         type:
 *           type: string
 *           enum: [in, out, set]
 *         quantity:
 *           type: integer
 *         reason:
 *           type: string
 *         notes:
 *           type: string
 *   tags:
 *     - name: Products
 *       description: Gestão de produtos e serviços
 */

/**
 * @swagger
 * /api/products:
 *   get:
 *     summary: Listar produtos
 *     tags: [Products]
 *     parameters:
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
 *         name: category_id
 *         schema:
 *           type: integer
 *         description: Filtrar por categoria
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [product, service]
 *         description: Filtrar por tipo
 *       - in: query
 *         name: is_active
 *         schema:
 *           type: boolean
 *         description: Filtrar por status ativo
 *       - in: query
 *         name: low_stock
 *         schema:
 *           type: boolean
 *         description: Mostrar apenas produtos com estoque baixo
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Buscar por nome, SKU ou descrição
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [name, price, current_stock, created_at]
 *         description: Campo para ordenação
 *       - in: query
 *         name: order
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *         description: Direção da ordenação
 *     responses:
 *       200:
 *         description: Lista de produtos
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
 *                     $ref: '#/components/schemas/Product'
 *                 pagination:
 *                   type: object
 *                 stats:
 *                   type: object
 */
router.get('/', ProductController.index);

/**
 * @swagger
 * /api/products:
 *   post:
 *     summary: Criar produto
 *     tags: [Products]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Product'
 *     responses:
 *       201:
 *         description: Produto criado com sucesso
 *       400:
 *         description: Dados inválidos
 */
router.post('/', ProductController.create);

/**
 * @swagger
 * /api/products/categories:
 *   get:
 *     summary: Listar categorias de produtos
 *     tags: [Products]
 *     responses:
 *       200:
 *         description: Lista de categorias
 */
router.get('/categories', ProductController.getCategories);

/**
 * @swagger
 * /api/products/categories:
 *   post:
 *     summary: Criar categoria de produto
 *     tags: [Products]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ProductCategory'
 *     responses:
 *       201:
 *         description: Categoria criada com sucesso
 */
router.post('/categories', ProductController.createCategory);

/**
 * @swagger
 * /api/products/reports:
 *   get:
 *     summary: Relatórios de produtos
 *     tags: [Products]
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [week, month, quarter, year]
 *         description: Período do relatório
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [sales, inventory]
 *         description: Tipo de relatório
 *     responses:
 *       200:
 *         description: Dados do relatório
 */
router.get('/reports', ProductController.getReports);

/**
 * @swagger
 * /api/products/low-stock:
 *   get:
 *     summary: Produtos com estoque baixo
 *     tags: [Products]
 *     responses:
 *       200:
 *         description: Lista de produtos com estoque baixo
 */
router.get('/low-stock', ProductController.getLowStock);

/**
 * @swagger
 * /api/products/{id}:
 *   get:
 *     summary: Obter produto por ID
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do produto
 *     responses:
 *       200:
 *         description: Dados do produto
 *       404:
 *         description: Produto não encontrado
 */
router.get('/:id', ProductController.show);

/**
 * @swagger
 * /api/products/{id}:
 *   put:
 *     summary: Atualizar produto
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do produto
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Product'
 *     responses:
 *       200:
 *         description: Produto atualizado com sucesso
 *       404:
 *         description: Produto não encontrado
 */
router.put('/:id', ProductController.update);

/**
 * @swagger
 * /api/products/{id}:
 *   delete:
 *     summary: Deletar produto
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do produto
 *     responses:
 *       200:
 *         description: Produto deletado com sucesso
 *       404:
 *         description: Produto não encontrado
 */
router.delete('/:id', ProductController.destroy);

/**
 * @swagger
 * /api/products/{id}/stock:
 *   post:
 *     summary: Ajustar estoque do produto
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do produto
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/StockAdjustment'
 *     responses:
 *       200:
 *         description: Estoque ajustado com sucesso
 *       404:
 *         description: Produto não encontrado
 */
router.post('/:id/stock', ProductController.adjustStock);

module.exports = router;