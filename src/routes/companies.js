/**
 * ==========================================
 * 🏢 ROTAS DE EMPRESAS - SUPER ADMIN ONLY
 * ==========================================
 */

const express = require('express');
const CompanyController = require('../controllers/CompanyController');
const { authenticateToken } = require('../middleware/auth');
const { rateLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// 🔐 Middleware obrigatório: autenticação
router.use(authenticateToken);

// 🔒 Middleware obrigatório: Super Admin
router.use(CompanyController.requireSuperAdmin);

/**
 * @swagger
 * /companies:
 *   get:
 *     summary: Listar todas as empresas
 *     description: Lista empresas com filtros e paginação (Super Admin only)
 *     tags: [Companies]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Página
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Items por página
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, inactive, trial]
 *         description: Filtrar por status
 *       - in: query
 *         name: plan
 *         schema:
 *           type: string
 *           enum: [starter, professional, enterprise]
 *         description: Filtrar por plano
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Buscar por nome ou domínio
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [name, created_at, users_count]
 *         description: Ordenar por campo
 *     responses:
 *       200:
 *         description: Lista de empresas
 *       403:
 *         description: Super Admin required
 */
router.get('/', rateLimiter.admin, CompanyController.index);

/**
 * @swagger
 * /companies:
 *   post:
 *     summary: Criar nova empresa
 *     description: Cria empresa com admin automático (Super Admin only)
 *     tags: [Companies]
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
 *               - domain
 *               - admin_name
 *               - admin_email
 *             properties:
 *               name:
 *                 type: string
 *                 example: TechCorp Solutions
 *               domain:
 *                 type: string
 *                 example: techcorp
 *               plan:
 *                 type: string
 *                 enum: [starter, professional, enterprise]
 *                 default: starter
 *               industry:
 *                 type: string
 *                 example: Tecnologia
 *               company_size:
 *                 type: string
 *                 example: 21-50 funcionários
 *               admin_name:
 *                 type: string
 *                 example: João Silva
 *               admin_email:
 *                 type: string
 *                 example: joao@techcorp.com
 *               admin_phone:
 *                 type: string
 *                 example: +55 11 99999-1234
 *               enabled_modules:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["dashboard", "users", "leads"]
 *               settings:
 *                 type: object
 *                 example: {"maxUploadSize": "5MB"}
 *     responses:
 *       201:
 *         description: Empresa criada com sucesso
 *       400:
 *         description: Dados inválidos
 *       409:
 *         description: Domínio já existe
 */
router.post('/', rateLimiter.admin, CompanyController.create);

/**
 * @swagger
 * /companies/stats:
 *   get:
 *     summary: Estatísticas globais
 *     description: Estatísticas de todas as empresas (Super Admin only)
 *     tags: [Companies]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Estatísticas globais
 */
router.get('/stats', rateLimiter.admin, CompanyController.getGlobalStats);

/**
 * @swagger
 * /companies/{id}:
 *   get:
 *     summary: Detalhes da empresa
 *     description: Obter detalhes completos de uma empresa (Super Admin only)
 *     tags: [Companies]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Detalhes da empresa
 *       404:
 *         description: Empresa não encontrada
 */
router.get('/:id', rateLimiter.admin, CompanyController.show);

/**
 * @swagger
 * /companies/{id}:
 *   put:
 *     summary: Atualizar empresa
 *     description: Atualizar dados da empresa (Super Admin only)
 *     tags: [Companies]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               plan:
 *                 type: string
 *                 enum: [starter, professional, enterprise]
 *               industry:
 *                 type: string
 *               company_size:
 *                 type: string
 *               admin_name:
 *                 type: string
 *               admin_email:
 *                 type: string
 *               admin_phone:
 *                 type: string
 *               enabled_modules:
 *                 type: array
 *                 items:
 *                   type: string
 *               settings:
 *                 type: object
 *     responses:
 *       200:
 *         description: Empresa atualizada
 *       404:
 *         description: Empresa não encontrada
 */
router.put('/:id', rateLimiter.admin, CompanyController.update);

/**
 * @swagger
 * /companies/{id}:
 *   delete:
 *     summary: Deletar empresa
 *     description: Soft delete da empresa e usuários (Super Admin only)
 *     tags: [Companies]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Empresa deletada
 *       404:
 *         description: Empresa não encontrada
 */
router.delete('/:id', rateLimiter.admin, CompanyController.destroy);

/**
 * @swagger
 * /companies/{id}/modules:
 *   put:
 *     summary: Gerenciar módulos da empresa
 *     description: Atualizar módulos habilitados (Super Admin only)
 *     tags: [Companies]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - enabled_modules
 *             properties:
 *               enabled_modules:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: [dashboard, users, leads, clients, sales, reports, gamification]
 *                 example: ["dashboard", "users", "leads", "gamification"]
 *     responses:
 *       200:
 *         description: Módulos atualizados
 *       400:
 *         description: Módulos inválidos
 */
router.put('/:id/modules', rateLimiter.admin, CompanyController.updateModules);

/**
 * @swagger
 * /companies/{id}/status:
 *   put:
 *     summary: Alterar status da empresa
 *     description: Ativar/desativar empresa (Super Admin only)
 *     tags: [Companies]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [active, inactive, trial]
 *                 example: active
 *     responses:
 *       200:
 *         description: Status atualizado
 *       400:
 *         description: Status inválido
 */
router.put('/:id/status', rateLimiter.admin, CompanyController.updateStatus);

/**
 * @swagger
 * /companies/{id}/analytics:
 *   get:
 *     summary: Analytics da empresa
 *     description: Relatórios e estatísticas detalhadas (Super Admin only)
 *     tags: [Companies]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Analytics da empresa
 *       404:
 *         description: Empresa não encontrada
 */
router.get('/:id/analytics', rateLimiter.admin, CompanyController.getAnalytics);

module.exports = router;