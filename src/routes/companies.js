const express = require("express");
const CompanyController = require("../controllers/CompanyController");
const { authenticateToken } = require("../middleware/auth");
const { rateLimiter } = require("../middleware/rateLimiter");

const router = express.Router();

// 🔐 Middleware obrigatório: autenticação
router.use(authenticateToken);

// 🔒 Middleware obrigatório: Super Admin
router.use(CompanyController.requireSuperAdmin);

/**
 * @swagger
 * /companies/my-tree:
 *   get:
 *     summary: Árvore das empresas vinculadas ao Super Admin
 *     description: Retorna apenas empresas e usuários vinculados ao Super Admin logado (via partner_id)
 *     tags: [Companies]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Árvore das empresas vinculadas
 *       403:
 *         description: Super Admin required
 */
router.get("/my-tree", rateLimiter.admin, CompanyController.getMyCompanyTree);

/**
 * @swagger
 * /companies/full-tree:
 *   get:
 *     summary: Árvore completa de empresas e usuários
 *     description: Retorna a hierarquia multi-nível de empresas e seus usuários (apenas Super Admin)
 *     tags: [Companies]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Árvore de empresas e usuários
 *       403:
 *         description: Super Admin required
 */
router.get(
  "/full-tree",
  rateLimiter.admin,
  CompanyController.getFullCompanyTree
);

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
 *       - $ref: '#/components/parameters/AcceptLanguage'
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
 *         name: subscription_plan
 *         schema:
 *           type: string
 *           enum: [starter, professional, enterprise, partner_pro]
 *         description: Filtrar por plano de assinatura
 *       - in: query
 *         name: company_type
 *         schema:
 *           type: string
 *           enum: [tenant, partner, license]
 *         description: Filtrar por tipo de empresa
 *       - in: query
 *         name: partner_id
 *         schema:
 *           type: integer
 *         description: Filtrar por ID do parceiro
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Buscar por nome ou domínio da empresa
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [name, created_at, users_count]
 *           default: name
 *         description: Ordenar resultados
 *     responses:
 *       200:
 *         description: Lista de empresas
 */
router.get("/", rateLimiter.admin, CompanyController.index);

/**
 * @swagger
 * /companies:
 *   post:
 *     summary: Criar empresa
 *     description: Criar nova empresa (Super Admin only)
 *     tags: [Companies]
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
 *               - domain
 *             properties:
 *               name:
 *                 type: string
 *                 example: Agência Parceira XYZ
 *               domain:
 *                 type: string
 *                 example: agenciaxyz.com
 *               plan:
 *                 type: string
 *                 example: partner_pro
 *               industry:
 *                 type: string
 *                 example: Publicidade
 *               company_size:
 *                 type: string
 *                 example: 1-10 funcionários
 *               admin_name:
 *                 type: string
 *                 example: Admin da Agência
 *               admin_email:
 *                 type: string
 *                 example: admin@agenciaxyz.com
 *               admin_phone:
 *                 type: string
 *                 example: +55 11 98888-8888
 *               company_type:
 *                 type: string
 *                 enum: [tenant, partner, license]
 *                 example: partner
 *               partner_id:
 *                 type: integer
 *                 nullable: true
 *                 example: null
 *               custom_domain:
 *                 type: string
 *                 example: crm.agenciaxyz.com
 *               logo_url:
 *                 type: string
 *                 example: https://cdn.agenciaxyz.com/logo.png
 *               favicon_url:
 *                 type: string
 *                 example: https://cdn.agenciaxyz.com/favicon.ico
 *               primary_color:
 *                 type: string
 *                 example: "#0A84FF"
 *               secondary_color:
 *                 type: string
 *                 example: "#FFFFFF"
 *               support_email:
 *                 type: string
 *                 example: suporte@agenciaxyz.com
 *               support_phone:
 *                 type: string
 *                 example: +55 11 4004-1234
 *               terms_url:
 *                 type: string
 *                 example: https://agenciaxyz.com/termos
 *               privacy_url:
 *                 type: string
 *                 example: https://agenciaxyz.com/privacidade
 *               tenant_plan:
 *                 type: string
 *                 nullable: true
 *                 example: null
 *               status:
 *                 type: string
 *                 enum: [active, inactive, trial]
 *                 example: active
 *               max_users:
 *                 type: integer
 *                 example: 50
 *               max_storage_mb:
 *                 type: integer
 *                 example: 10000
 *               trial_ends_at:
 *                 type: string
 *                 format: date-time
 *                 nullable: true
 *                 example: null
 *               subscription_ends_at:
 *                 type: string
 *                 format: date-time
 *                 nullable: true
 *                 example: "2026-10-25T00:00:00Z"
 *               enabled_modules:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["dashboard", "users", "leads", "sales"]
 *               settings:
 *                 type: object
 *                 example: {"maxUploadSize": "25MB"}
 *     responses:
 *       201:
 *         description: Empresa criada com sucesso
 *       400:
 *         description: Dados inválidos
 *       409:
 *         description: Domínio já existe
 */
router.post("/", rateLimiter.admin, CompanyController.create);

/**
 * @swagger
 * /companies/stats:
 *   get:
 *     summary: Estatísticas globais
 *     description: Estatísticas de todas as empresas (Super Admin only)
 *     tags: [Companies]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/AcceptLanguage'
 *     responses:
 *       200:
 *         description: Estatísticas globais
 */
router.get("/stats", rateLimiter.admin, CompanyController.getGlobalStats);

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
 *       - $ref: '#/components/parameters/AcceptLanguage'
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *           example: 1
 *     responses:
 *       200:
 *         description: Detalhes da empresa
 *       404:
 *         description: Empresa não encontrada
 */
router.get("/:id", rateLimiter.admin, CompanyController.show);

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
 *       - $ref: '#/components/parameters/AcceptLanguage'
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *           example: 1
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
 *               company_type:
 *                 type: string
 *                 enum: [tenant, partner, license]
 *               partner_id:
 *                 type: integer
 *                 nullable: true
 *               logo_url:
 *                 type: string
 *               favicon_url:
 *                 type: string
 *               primary_color:
 *                 type: string
 *               secondary_color:
 *                 type: string
 *               custom_domain:
 *                 type: string
 *               support_email:
 *                 type: string
 *               support_phone:
 *                 type: string
 *               terms_url:
 *                 type: string
 *               privacy_url:
 *                 type: string
 *               tenant_plan:
 *                 type: string
 *                 nullable: true
 *               status:
 *                 type: string
 *                 enum: [active, inactive, trial]
 *               max_users:
 *                 type: integer
 *               max_storage_mb:
 *                 type: integer
 *               trial_ends_at:
 *                 type: string
 *                 format: date-time
 *                 nullable: true
 *               subscription_ends_at:
 *                 type: string
 *                 format: date-time
 *                 nullable: true
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
router.put("/:id", rateLimiter.admin, CompanyController.update);

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
 *       - $ref: '#/components/parameters/AcceptLanguage'
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *           example: 1
 *     responses:
 *       200:
 *         description: Empresa deletada
 *       404:
 *         description: Empresa não encontrada
 */
router.delete("/:id", rateLimiter.admin, CompanyController.destroy);

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
 *       - $ref: '#/components/parameters/AcceptLanguage'
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *           example: 1
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
router.put("/:id/modules", rateLimiter.admin, CompanyController.updateModules);

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
 *       - $ref: '#/components/parameters/AcceptLanguage'
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *           example: 1
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
router.put("/:id/status", rateLimiter.admin, CompanyController.updateStatus);

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
 *       - $ref: '#/components/parameters/AcceptLanguage'
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *           example: 1
 *     responses:
 *       200:
 *         description: Analytics da empresa
 *       404:
 *         description: Empresa não encontrada
 */
router.get("/:id/analytics", rateLimiter.admin, CompanyController.getAnalytics);

module.exports = router;
