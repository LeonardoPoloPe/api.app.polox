/**
 * ==========================================
 * 🛣️ ROTAS ENTERPRISE API POLOX
 * ==========================================
 */

const express = require("express");
const AuthController = require("./controllers/authController");
const UserController = require("./controllers/userController");

// Enterprise Controllers (temporariamente comentados para debug)
/*
const LeadController = require("./controllers/LeadController");
const ClientController = require("./controllers/ClientController");
const SaleController = require("./controllers/SaleController");
const ProductController = require("./controllers/ProductController");
const FinanceController = require("./controllers/FinanceController");
const ScheduleController = require("./controllers/ScheduleController");
const SupplierController = require("./controllers/SupplierController");
const TicketController = require("./controllers/TicketController");
const AnalyticsController = require("./controllers/AnalyticsController");
const NotificationController = require("./controllers/NotificationController");
const CompanyController = require("./controllers/CompanyController");
const GamificationController = require("./controllers/GamificationController");
*/

// Middleware e validações
const { authenticateToken } = require("./middleware/auth");
const { validateRequest } = require("./utils/validation");
const {
  userValidationSchemas,
  authValidationSchemas,
} = require("./utils/validation");
const { rateLimiter } = require("./middleware/rateLimiter");
const { securityHeaders } = require("./middleware/security");

const router = express.Router();

// Aplicar middlewares de segurança
router.use(securityHeaders);

// Swagger/OpenAPI - apenas se habilitado
const enableSwagger = process.env.ENABLE_SWAGGER === "true";
if (enableSwagger) {
  const {
    swaggerSpec,
    swaggerUi,
    swaggerUiOptions,
  } = require("./config/swagger");

  // Rota para obter o JSON da especificação OpenAPI
  router.get("/api-docs.json", (req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.send(swaggerSpec);
  });

  // Rota principal do Swagger UI com HTML customizado
  router.get("/docs", (req, res) => {
    const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Polox API Documentation</title>
      <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@5.9.0/swagger-ui.css" />
      <style>
        html { box-sizing: border-box; overflow: -moz-scrollbars-vertical; overflow-y: scroll; }
        *, *:before, *:after { box-sizing: inherit; }
        body { margin:0; background: #fafafa; }
      </style>
    </head>
    <body>
      <div id="swagger-ui"></div>
      <script src="https://unpkg.com/swagger-ui-dist@5.9.0/swagger-ui-bundle.js"></script>
      <script src="https://unpkg.com/swagger-ui-dist@5.9.0/swagger-ui-standalone-preset.js"></script>
      <script>
        window.onload = function() {
          const ui = SwaggerUIBundle({
            url: '/api/api-docs.json',
            dom_id: '#swagger-ui',
            deepLinking: true,
            presets: [
              SwaggerUIBundle.presets.apis,
              SwaggerUIStandalonePreset
            ],
            plugins: [
              SwaggerUIBundle.plugins.DownloadUrl
            ],
            layout: "StandaloneLayout",
            persistAuthorization: true,
            displayRequestDuration: true,
            docExpansion: 'none',
            filter: true,
            showExtensions: true,
            showCommonExtensions: true,
            tryItOutEnabled: true
          });
        }
      </script>
    </body>
    </html>
    `;

    res.setHeader("Content-Type", "text/html");
    res.send(html);
  });

  console.log("📚 Swagger UI habilitado em /api/docs");
} else {
  console.log("📚 Swagger UI desabilitado via ENABLE_SWAGGER");
}

/**
 * @swagger
 * tags:
 *   - name: Authentication
 *     description: Operações de autenticação e autorização enterprise
 *   - name: Users
 *     description: Operações de gerenciamento de usuários enterprise
 *   - name: Demo
 *     description: Rotas de demonstração e testes
 *   - name: Health
 *     description: Monitoramento e status da aplicação
 */

// Middleware para log de rotas da API
router.use((req, res, next) => {
  console.log(`API Route: ${req.method} ${req.path}`);
  next();
});

// ========== 🔐 ROTAS DE AUTENTICAÇÃO ENTERPRISE ==========

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Registrar novo usuário enterprise
 *     description: Cria uma nova conta de usuário com validações e auditoria enterprise
 *     tags: [Authentication]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *               - password
 *               - companyId
 *             properties:
 *               name:
 *                 type: string
 *                 example: João Silva
 *               email:
 *                 type: string
 *                 format: email
 *                 example: joao@empresa.com
 *               password:
 *                 type: string
 *                 minLength: 8
 *                 example: SenhaSegura123!
 *               companyId:
 *                 type: string
 *                 format: uuid
 *                 example: 123e4567-e89b-12d3-a456-426614174000
 *               role:
 *                 type: string
 *                 enum: [viewer, editor, admin, super_admin]
 *                 default: viewer
 *               department:
 *                 type: string
 *                 example: TI
 *               position:
 *                 type: string
 *                 example: Desenvolvedor
 *               phone:
 *                 type: string
 *                 example: +5511999999999
 *               permissions:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["users:read", "reports:view"]
 *     responses:
 *       201:
 *         description: Usuário criado com sucesso
 *       400:
 *         description: Dados inválidos
 *       409:
 *         description: Email já cadastrado
 *       403:
 *         description: Empresa inativa ou role não permitida
 */
router.post(
  "/auth/register",
  rateLimiter.auth,
  validateRequest(authValidationSchemas.register),
  AuthController.register
);

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Login enterprise com segurança avançada
 *     description: Autentica usuário com controle de tentativas, sessões e auditoria
 *     tags: [Authentication]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: admin@empresa.com
 *               password:
 *                 type: string
 *                 example: MinhaSenh@123
 *               rememberMe:
 *                 type: boolean
 *                 default: false
 *                 description: Manter sessão por mais tempo
 *     responses:
 *       200:
 *         description: Login realizado com sucesso
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
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *                     tokens:
 *                       type: object
 *                       properties:
 *                         accessToken:
 *                           type: string
 *                         refreshToken:
 *                           type: string
 *                         expiresIn:
 *                           type: string
 *                         tokenType:
 *                           type: string
 *                     session:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         expiresAt:
 *                           type: string
 *                           format: date-time
 *                         rememberMe:
 *                           type: boolean
 *       401:
 *         description: Credenciais inválidas ou conta bloqueada
 *       423:
 *         description: Conta temporariamente bloqueada
 */
router.post(
  "/auth/login",
  rateLimiter.auth,
  validateRequest(authValidationSchemas.login),
  AuthController.login
);

/**
 * @swagger
 * /auth/refresh:
 *   post:
 *     summary: Renovar token de acesso
 *     description: Renova access token usando refresh token válido
 *     tags: [Authentication]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *             properties:
 *               refreshToken:
 *                 type: string
 *                 description: Token de renovação válido
 *                 example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *     responses:
 *       200:
 *         description: Token renovado com sucesso
 *       401:
 *         description: Refresh token inválido ou expirado
 */
router.post(
  "/auth/refresh",
  rateLimiter.token,
  validateRequest(authValidationSchemas.refresh),
  AuthController.refreshToken
);

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     summary: Logout com invalidação de sessão
 *     description: Invalida sessão atual ou todas as sessões do usuário
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               logoutAll:
 *                 type: boolean
 *                 default: false
 *                 description: Invalidar todas as sessões do usuário
 *     responses:
 *       200:
 *         description: Logout realizado com sucesso
 *       401:
 *         description: Token inválido ou expirado
 */
router.post("/auth/logout", authenticateToken, AuthController.logout);

/**
 * @swagger
 * /auth/recover-password:
 *   post:
 *     summary: Solicitar recuperação de senha
 *     description: Inicia processo de recuperação de senha por email
 *     tags: [Authentication]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: usuario@empresa.com
 *     responses:
 *       200:
 *         description: Instruções enviadas se email existir
 */
router.post(
  "/auth/recover-password",
  rateLimiter.password,
  validateRequest(authValidationSchemas.recoverPassword),
  AuthController.recoverPassword
);

/**
 * @swagger
 * /auth/reset-password:
 *   post:
 *     summary: Confirmar nova senha
 *     description: Define nova senha usando token de recuperação
 *     tags: [Authentication]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *               - newPassword
 *             properties:
 *               token:
 *                 type: string
 *                 description: Token de recuperação recebido por email
 *               newPassword:
 *                 type: string
 *                 minLength: 8
 *                 description: Nova senha segura
 *                 example: NovaSenha123!
 *     responses:
 *       200:
 *         description: Senha redefinida com sucesso
 *       400:
 *         description: Token inválido ou expirado
 */
router.post(
  "/auth/reset-password",
  rateLimiter.password,
  validateRequest(authValidationSchemas.resetPassword),
  AuthController.resetPassword
);

/**
 * @swagger
 * /auth/profile:
 *   get:
 *     summary: Obter perfil completo do usuário autenticado
 *     description: Retorna dados completos do usuário e empresa
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Perfil obtido com sucesso
 *       401:
 *         description: Token inválido
 *       404:
 *         description: Usuário não encontrado
 */
router.get("/auth/profile", authenticateToken, AuthController.getProfile);

/**
 * @swagger
 * /auth/sessions:
 *   get:
 *     summary: Listar sessões ativas do usuário
 *     description: Mostra todas as sessões ativas e suas informações
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Sessões listadas com sucesso
 */
router.get("/auth/sessions", authenticateToken, AuthController.getSessions);

/**
 * @swagger
 * /auth/sessions/{sessionId}:
 *   delete:
 *     summary: Revogar sessão específica
 *     description: Invalida uma sessão específica do usuário
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID da sessão a ser revogada
 *     responses:
 *       200:
 *         description: Sessão revogada com sucesso
 *       404:
 *         description: Sessão não encontrada
 */
router.delete(
  "/auth/sessions/:sessionId",
  authenticateToken,
  AuthController.revokeSession
);

/**
 * @swagger
 * /auth/validate:
 *   get:
 *     summary: Validar token atual
 *     description: Verifica se o token está válido e retorna dados do usuário
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Token válido
 *       401:
 *         description: Token inválido ou expirado
 */
router.get("/auth/validate", authenticateToken, AuthController.validateToken);

// ========== 👥 ROTAS DE USUÁRIOS ENTERPRISE ==========

/**
 * @swagger
 * /users:
 *   get:
 *     summary: Listar usuários da empresa
 *     description: Lista usuários com filtros, paginação e controle de permissões
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Página atual
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 100
 *         description: Itens por página
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Busca por nome ou email
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [viewer, editor, admin, super_admin]
 *         description: Filtrar por role
 *       - in: query
 *         name: department
 *         schema:
 *           type: string
 *         description: Filtrar por departamento
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *         description: Filtrar por status ativo
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [name, email, role, department, created_at, last_login]
 *           default: created_at
 *         description: Campo para ordenação
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [ASC, DESC]
 *           default: DESC
 *         description: Ordem da classificação
 *     responses:
 *       200:
 *         description: Lista de usuários obtida com sucesso
 *       401:
 *         description: Token inválido
 *       403:
 *         description: Sem permissão para listar usuários
 */
router.get("/users", authenticateToken, UserController.getUsers);

/**
 * @swagger
 * /users:
 *   post:
 *     summary: Criar novo usuário
 *     description: Cria um novo usuário na empresa com validações de permissão
 *     tags: [Users]
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
 *               - email
 *               - password
 *             properties:
 *               name:
 *                 type: string
 *                 example: Maria Santos
 *               email:
 *                 type: string
 *                 format: email
 *                 example: maria@empresa.com
 *               password:
 *                 type: string
 *                 minLength: 8
 *                 example: SenhaSegura123!
 *               role:
 *                 type: string
 *                 enum: [viewer, editor, admin, super_admin]
 *                 default: viewer
 *               department:
 *                 type: string
 *                 example: Vendas
 *               position:
 *                 type: string
 *                 example: Gerente de Vendas
 *               phone:
 *                 type: string
 *                 example: +5511999999999
 *               permissions:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["users:read", "reports:view"]
 *     responses:
 *       201:
 *         description: Usuário criado com sucesso
 *       400:
 *         description: Dados inválidos
 *       403:
 *         description: Sem permissão para criar usuários
 *       409:
 *         description: Email já em uso
 */
router.post(
  "/users",
  authenticateToken,
  validateRequest(userValidationSchemas.createUser),
  UserController.createUser
);

/**
 * @swagger
 * /users/{id}:
 *   get:
 *     summary: Obter usuário por ID
 *     description: Retorna dados detalhados de um usuário específico
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID do usuário
 *     responses:
 *       200:
 *         description: Usuário encontrado
 *       401:
 *         description: Token inválido
 *       403:
 *         description: Sem permissão para visualizar usuário
 *       404:
 *         description: Usuário não encontrado
 */
router.get(
  "/users/:id",
  authenticateToken,
  validateRequest(userValidationSchemas.getUserById),
  UserController.getUserById
);

/**
 * @swagger
 * /users/{id}:
 *   put:
 *     summary: Atualizar usuário
 *     description: Atualiza dados de um usuário com validações de permissão
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID do usuário
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: João Silva Atualizado
 *               email:
 *                 type: string
 *                 format: email
 *                 example: joao.novo@empresa.com
 *               role:
 *                 type: string
 *                 enum: [viewer, editor, admin, super_admin]
 *               department:
 *                 type: string
 *                 example: TI
 *               position:
 *                 type: string
 *                 example: Desenvolvedor Senior
 *               phone:
 *                 type: string
 *                 example: +5511888888888
 *               permissions:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["users:read", "users:update"]
 *               isActive:
 *                 type: boolean
 *                 description: Status ativo (apenas admins)
 *               password:
 *                 type: string
 *                 minLength: 8
 *                 description: Nova senha (opcional)
 *     responses:
 *       200:
 *         description: Usuário atualizado com sucesso
 *       400:
 *         description: Dados inválidos
 *       403:
 *         description: Sem permissão para atualizar usuário
 *       404:
 *         description: Usuário não encontrado
 *       409:
 *         description: Email já em uso
 */
router.put(
  "/users/:id",
  authenticateToken,
  validateRequest(userValidationSchemas.updateUser),
  UserController.updateUser
);

/**
 * @swagger
 * /users/{id}:
 *   delete:
 *     summary: Remover usuário
 *     description: Remove um usuário da empresa (soft delete)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID do usuário
 *     responses:
 *       200:
 *         description: Usuário removido com sucesso
 *       400:
 *         description: Não é possível remover próprio usuário
 *       403:
 *         description: Sem permissão para remover usuários
 *       404:
 *         description: Usuário não encontrado
 */
router.delete("/users/:id", authenticateToken, UserController.deleteUser);

/**
 * @swagger
 * /users/{id}/toggle-status:
 *   patch:
 *     summary: Ativar/Desativar usuário
 *     description: Alterna o status ativo/inativo de um usuário
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID do usuário
 *     responses:
 *       200:
 *         description: Status do usuário alterado com sucesso
 *       400:
 *         description: Não é possível alterar próprio status
 *       403:
 *         description: Sem permissão para ativar/desativar usuários
 *       404:
 *         description: Usuário não encontrado
 */
router.patch(
  "/users/:id/toggle-status",
  authenticateToken,
  UserController.toggleUserStatus
);

/**
 * @swagger
 * /users/stats:
 *   get:
 *     summary: Estatísticas de usuários
 *     description: Retorna estatísticas detalhadas dos usuários da empresa
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Estatísticas obtidas com sucesso
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
 *                     stats:
 *                       type: object
 *                       properties:
 *                         overview:
 *                           type: object
 *                           properties:
 *                             totalUsers:
 *                               type: integer
 *                             activeUsers:
 *                               type: integer
 *                             inactiveUsers:
 *                               type: integer
 *                             newUsers30d:
 *                               type: integer
 *                             activeUsers7d:
 *                               type: integer
 *                         byRole:
 *                           type: object
 *                           properties:
 *                             admin:
 *                               type: integer
 *                             editor:
 *                               type: integer
 *                             viewer:
 *                               type: integer
 *                         byDepartment:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               department:
 *                                 type: string
 *                               total:
 *                                 type: integer
 *                               active:
 *                                 type: integer
 *       403:
 *         description: Sem permissão para visualizar estatísticas
 */
router.get("/users/stats", authenticateToken, UserController.getUserStats);

// ========== 👤 ROTAS DE PERFIL (COMPATIBILIDADE LEGADA) ==========

/**
 * @swagger
 * /users/profile:
 *   get:
 *     summary: Obter perfil do usuário autenticado
 *     description: Retorna dados do perfil do usuário logado (rota de compatibilidade)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Perfil obtido com sucesso
 *       401:
 *         description: Token inválido
 *       404:
 *         description: Usuário não encontrado
 */
router.get("/users/profile", authenticateToken, UserController.getProfile);

/**
 * @swagger
 * /users/profile:
 *   put:
 *     summary: Atualizar perfil do usuário autenticado
 *     description: Atualiza dados do próprio perfil (rota de compatibilidade)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: João Silva Atualizado
 *               email:
 *                 type: string
 *                 format: email
 *                 example: novo.email@empresa.com
 *               phone:
 *                 type: string
 *                 example: +5511999999999
 *               password:
 *                 type: string
 *                 minLength: 8
 *                 description: Nova senha (opcional)
 *     responses:
 *       200:
 *         description: Perfil atualizado com sucesso
 *       400:
 *         description: Dados inválidos
 *       409:
 *         description: Email já em uso
 */
router.put(
  "/users/profile",
  authenticateToken,
  validateRequest(userValidationSchemas.updateProfile),
  UserController.updateProfile
);

/**
 * @swagger
 * /users/profile:
 *   delete:
 *     summary: Desativar conta própria
 *     description: Desativa a própria conta do usuário (rota de compatibilidade)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Conta desativada com sucesso
 */
router.delete(
  "/users/profile",
  authenticateToken,
  UserController.deleteProfile
);

// ========== 🔍 ROTAS DE BUSCA E COMPATIBILIDADE ==========

/**
 * @swagger
 * /users/search:
 *   get:
 *     summary: Buscar usuário por email
 *     description: Busca usuário específico por email (rota de compatibilidade)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: email
 *         required: true
 *         schema:
 *           type: string
 *           format: email
 *         description: Email do usuário
 *     responses:
 *       200:
 *         description: Usuário encontrado
 *       400:
 *         description: Email obrigatório
 *       403:
 *         description: Sem permissão para buscar usuários
 *       404:
 *         description: Usuário não encontrado
 */
router.get("/users/search", authenticateToken, UserController.getUserByEmail);

/**
 * @swagger
 * /users/list:
 *   get:
 *     summary: Listar usuários (compatibilidade legada)
 *     description: Lista usuários com parâmetros simplificados para compatibilidade
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, inactive, all]
 *           default: active
 *     responses:
 *       200:
 *         description: Usuários listados com sucesso
 */
router.get("/users/list", authenticateToken, UserController.listUsers);

// ==========================================
// 🏢 ROTAS DOS CONTROLADORES ENTERPRISE
// ==========================================

// ========== 🎯 LEADS (Gestão de Prospects) ==========
// Temporariamente comentado para debugar
/*
router.get("/leads", authenticateToken, LeadController.index);
router.post("/leads", authenticateToken, LeadController.create);
router.get("/leads/:id", authenticateToken, LeadController.show);
router.put("/leads/:id", authenticateToken, LeadController.update);
router.put(
  "/leads/:id/convert",
  authenticateToken,
  LeadController.convertToClient
);
router.put("/leads/:id/assign", authenticateToken, LeadController.assignTo);
*/

// ========== 👥 CLIENTS (Gestão de Clientes) ==========
// Temporariamente comentado para debugar
/*
router.get("/clients", authenticateToken, ClientController.index);
router.post("/clients", authenticateToken, ClientController.create);
router.get("/clients/:id", authenticateToken, ClientController.show);
router.put("/clients/:id", authenticateToken, ClientController.update);
router.delete("/clients/:id", authenticateToken, ClientController.destroy);
router.get("/clients/stats", authenticateToken, ClientController.getStats);
router.get(
  "/clients/:id/sales",
  authenticateToken,
  ClientController.getSalesHistory
);
router.post("/clients/:id/notes", authenticateToken, ClientController.addNote);
router.put("/clients/:id/tags", authenticateToken, ClientController.manageTags);
*/

// ========== 💰 SALES (Gestão de Vendas) ==========
// Temporariamente comentado para debugar
/*
router.get("/sales", authenticateToken, SaleController.index);
router.post("/sales", authenticateToken, SaleController.create);
router.get("/sales/:id", authenticateToken, SaleController.show);
router.put("/sales/:id", authenticateToken, SaleController.update);
router.delete("/sales/:id", authenticateToken, SaleController.destroy);
*/

/* 
// ========== 📦 PRODUCTS (Gestão de Produtos) ==========
router.get("/products", authenticateToken, ProductController.index);
router.post("/products", authenticateToken, ProductController.create);
router.get("/products/:id", authenticateToken, ProductController.show);
router.put("/products/:id", authenticateToken, ProductController.update);
router.delete("/products/:id", authenticateToken, ProductController.destroy);
router.post(
  "/products/:id/stock",
  authenticateToken,
  ProductController.adjustStock
);
router.get(
  "/products/low-stock",
  authenticateToken,
  ProductController.getLowStock
);
router.get(
  "/products/categories",
  authenticateToken,
  ProductController.getCategories
);
router.post(
  "/products/categories",
  authenticateToken,
  ProductController.createCategory
);
router.get(
  "/products/reports",
  authenticateToken,
  ProductController.getReports
);

// ========== 💳 FINANCE (Gestão Financeira) ==========
router.get(
  "/finance/transactions",
  authenticateToken,
  FinanceController.getTransactions
);
router.post(
  "/finance/transactions",
  authenticateToken,
  FinanceController.createTransaction
);
router.get(
  "/finance/accounts",
  authenticateToken,
  FinanceController.getAccounts
);
router.post(
  "/finance/accounts",
  authenticateToken,
  FinanceController.createAccount
);
router.get("/finance/reports", authenticateToken, FinanceController.getReports);
router.get(
  "/finance/dashboard",
  authenticateToken,
  FinanceController.getDashboard
);

// ========== 📅 SCHEDULE (Agenda e Compromissos) ==========
router.get("/schedule/events", authenticateToken, ScheduleController.getEvents);
router.post(
  "/schedule/events",
  authenticateToken,
  ScheduleController.createEvent
);
router.get(
  "/schedule/events/:id",
  authenticateToken,
  ScheduleController.getEventById
);
router.put(
  "/schedule/events/:id",
  authenticateToken,
  ScheduleController.updateEvent
);
router.delete(
  "/schedule/events/:id",
  authenticateToken,
  ScheduleController.deleteEvent
);
router.get(
  "/schedule/calendar",
  authenticateToken,
  ScheduleController.getCalendar
);

// ========== 🏭 SUPPLIERS (Gestão de Fornecedores) ==========
router.get("/suppliers", authenticateToken, SupplierController.getSuppliers);
router.post("/suppliers", authenticateToken, SupplierController.createSupplier);
router.get(
  "/suppliers/:id",
  authenticateToken,
  SupplierController.getSupplierById
);
router.put(
  "/suppliers/:id",
  authenticateToken,
  SupplierController.updateSupplier
);
router.delete(
  "/suppliers/:id",
  authenticateToken,
  SupplierController.deleteSupplier
);
router.get(
  "/suppliers/stats",
  authenticateToken,
  SupplierController.getSupplierStats
);

// ========== 🎫 TICKETS (Sistema de Suporte) ==========
router.get("/tickets", authenticateToken, TicketController.index);
router.post("/tickets", authenticateToken, TicketController.create);
router.get("/tickets/:id", authenticateToken, TicketController.show);
router.put("/tickets/:id", authenticateToken, TicketController.update);
router.delete("/tickets/:id", authenticateToken, TicketController.destroy);
router.put(
  "/tickets/:id/status",
  authenticateToken,
  TicketController.changeStatus
);
router.post(
  "/tickets/:id/replies",
  authenticateToken,
  TicketController.addReply
);
router.put(
  "/tickets/:id/escalate",
  authenticateToken,
  TicketController.escalateTicket
);
router.put(
  "/tickets/:id/assign",
  authenticateToken,
  TicketController.assignTicket
);
router.get("/tickets/reports", authenticateToken, TicketController.getReports);

// ========== 📊 ANALYTICS (Business Intelligence) ==========
router.get(
  "/analytics/dashboard",
  authenticateToken,
  AnalyticsController.getDashboard
);
router.get(
  "/analytics/sales",
  authenticateToken,
  AnalyticsController.getSalesAnalytics
);
router.get(
  "/analytics/customers",
  authenticateToken,
  AnalyticsController.getCustomerAnalytics
);
router.get(
  "/analytics/products",
  authenticateToken,
  AnalyticsController.getProductAnalytics
);
router.get(
  "/analytics/financial",
  authenticateToken,
  AnalyticsController.getFinancialAnalytics
);
router.get(
  "/analytics/comparisons",
  authenticateToken,
  AnalyticsController.getComparisons
);
router.get(
  "/analytics/performance",
  authenticateToken,
  AnalyticsController.getPerformanceAnalytics
);
router.get(
  "/analytics/export",
  authenticateToken,
  AnalyticsController.exportReport
);

// ========== 🔔 NOTIFICATIONS (Sistema de Notificações) ==========
router.get("/notifications", authenticateToken, NotificationController.index);
router.post("/notifications", authenticateToken, NotificationController.create);
router.put(
  "/notifications/:id/read",
  authenticateToken,
  NotificationController.markAsRead
);
router.put(
  "/notifications/read-all",
  authenticateToken,
  NotificationController.markAllAsRead
);
router.delete(
  "/notifications/:id",
  authenticateToken,
  NotificationController.deleteNotification
);
router.get(
  "/notifications/stats",
  authenticateToken,
  NotificationController.getStats
);
router.get(
  "/notifications/counters",
  authenticateToken,
  NotificationController.getCounters
);
router.delete(
  "/notifications/cleanup",
  authenticateToken,
  NotificationController.cleanupExpired
);

// ========== 🏢 COMPANIES (Multi-tenant) ==========
router.get("/companies", authenticateToken, CompanyController.index);
router.post("/companies", authenticateToken, CompanyController.create);
router.get("/companies/:id", authenticateToken, CompanyController.show);
router.put("/companies/:id", authenticateToken, CompanyController.update);
router.delete("/companies/:id", authenticateToken, CompanyController.destroy);
router.get(
  "/companies/global/stats",
  authenticateToken,
  CompanyController.getGlobalStats
);
router.put(
  "/companies/:id/modules",
  authenticateToken,
  CompanyController.updateModules
);
router.put(
  "/companies/:id/status",
  authenticateToken,
  CompanyController.updateStatus
);
router.get(
  "/companies/:id/analytics",
  authenticateToken,
  CompanyController.getAnalytics
);

// ========== 🎮 GAMIFICATION (Sistema de Gamificação) ==========
router.get(
  "/gamification/achievements",
  authenticateToken,
  GamificationController.getAchievements
);
router.get(
  "/gamification/missions",
  authenticateToken,
  GamificationController.getMissions
);
router.get(
  "/gamification/rewards",
  authenticateToken,
  GamificationController.getRewards
);
router.get(
  "/gamification/leaderboard",
  authenticateToken,
  GamificationController.getLeaderboard
);
router.post(
  "/gamification/rewards/buy",
  authenticateToken,
  GamificationController.buyReward
);
router.get(
  "/gamification/profile",
  authenticateToken,
  GamificationController.getProfile
);
router.post(
  "/gamification/points",
  authenticateToken,
  GamificationController.awardPoints
);
router.post(
  "/gamification/missions/:id/complete",
  authenticateToken,
  GamificationController.completeMission
);
router.get(
  "/gamification/achievements/unlocked",
  authenticateToken,
  GamificationController.getUnlockedAchievements
);
router.get(
  "/gamification/history",
  authenticateToken,
  GamificationController.getHistory
);

*/

// ========== 🎯 ROTAS DE DEMONSTRAÇÃO E TESTES ==========

/**
 * @swagger
 * /demo/public:
 *   get:
 *     summary: Rota pública de demonstração
 *     description: Endpoint público para testar a API sem autenticação
 *     tags: [Demo]
 *     security: []
 *     responses:
 *       200:
 *         description: Resposta de demonstração pública
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Esta é uma rota pública de demonstração
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                   example: 2025-10-18T22:30:00Z
 *                 environment:
 *                   type: string
 *                   example: dev
 */
router.get("/demo/public", (req, res) => {
  res.json({
    message: "Esta é uma rota pública de demonstração",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  });
});

/**
 * @swagger
 * /demo/protected:
 *   get:
 *     summary: Rota protegida de demonstração
 *     description: Endpoint que requer autenticação para testar tokens JWT
 *     tags: [Demo]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Resposta de demonstração protegida
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Esta é uma rota protegida de demonstração
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                   example: 2025-10-18T22:30:00Z
 *                 environment:
 *                   type: string
 *                   example: dev
 *       401:
 *         description: Token inválido ou expirado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get("/demo/protected", authenticateToken, (req, res) => {
  res.json({
    message: "Esta é uma rota protegida de demonstração",
    user: req.user,
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  });
});

// ========== 🏥 ROTAS DE MONITORAMENTO E SAÚDE ==========

/**
 * @swagger
 * /test/database:
 *   get:
 *     summary: Testar conexão com banco de dados
 *     description: Verifica se a aplicação consegue conectar com o PostgreSQL
 *     tags: [Health]
 *     security: []
 *     responses:
 *       200:
 *         description: Banco de dados conectado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 database:
 *                   type: string
 *                   enum: [connected, disconnected]
 *                   example: connected
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                   example: 2025-10-18T22:30:00Z
 *                 environment:
 *                   type: string
 *                   example: dev
 *                 dbConfig:
 *                   type: object
 *                   properties:
 *                     host:
 *                       type: string
 *                       example: database-1.cd2em8e0a6ot.sa-east-1.rds.amazonaws.com
 *                     database:
 *                       type: string
 *                       example: app_polox_dev
 *                     user:
 *                       type: string
 *                       example: polox_dev_user
 *       500:
 *         description: Erro na conexão com banco de dados
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get("/test/database", async (req, res) => {
  try {
    const { healthCheck } = require("./models");
    const isHealthy = await healthCheck();

    res.json({
      database: isHealthy ? "connected" : "disconnected",
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      dbConfig: {
        host: process.env.DB_HOST,
        database: process.env.DB_NAME,
        user: process.env.DB_USER,
      },
    });
  } catch (error) {
    res.status(500).json({
      error: "Erro ao testar banco de dados",
      message: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// ==========================================
// 🏢 ROTAS DE EMPRESAS (SUPER ADMIN)
// ==========================================
const companyRoutes = require("./routes/companies");
router.use("/companies", companyRoutes);

// ==========================================
// 🎮 ROTAS DE GAMIFICAÇÃO
// ==========================================
const gamificationRoutes = require("./routes/gamification");
router.use("/gamification", gamificationRoutes);

// ==========================================
// 📈 ROTAS CRM - LEADS, CLIENTES E VENDAS
// ==========================================

/**
 * @swagger
 * tags:
 *   - name: Leads
 *     description: Gestão de leads/prospects para pipeline de vendas
 *   - name: Clients
 *     description: Gestão de clientes com histórico e anotações
 *   - name: Sales
 *     description: Gestão de vendas com itens e controle de estoque
 */

const leadRoutes = require("./routes/leads");
router.use("/leads", leadRoutes);

const clientRoutes = require("./routes/clients");
router.use("/clients", clientRoutes);

const saleRoutes = require("./routes/sales");
router.use("/sales", saleRoutes);

// ==========================================
// 🏪 ROTAS DE GESTÃO AVANÇADA - COPILOT_PROMPT_5
// ==========================================

/**
 * @swagger
 * tags:
 *   - name: Products
 *     description: Gestão de produtos/serviços com estoque e categorias
 *   - name: Finance
 *     description: Gestão financeira com dashboard e análises
 *   - name: Schedule
 *     description: Gestão de agenda com calendário e eventos
 */

const productRoutes = require("./routes/products");
router.use("/products", productRoutes);

const financeRoutes = require("./routes/finance");
router.use("/finance", financeRoutes);

const scheduleRoutes = require("./routes/schedule");
router.use("/schedule", scheduleRoutes);

// ==========================================
// 🏢 ROTAS ENTERPRISE AVANÇADAS - COPILOT_PROMPT_6
// ==========================================

/**
 * @swagger
 * tags:
 *   - name: Suppliers
 *     description: Gestão de fornecedores com avaliações e contratos
 *   - name: Tickets
 *     description: Sistema de tickets com escalação automática
 *   - name: Analytics
 *     description: Dashboard de analytics com relatórios avançados
 *   - name: Notifications
 *     description: Sistema de notificações em tempo real
 */

const supplierRoutes = require("./routes/suppliers");
router.use("/suppliers", supplierRoutes);

const ticketRoutes = require("./routes/tickets");
router.use("/tickets", ticketRoutes);

const analyticsRoutes = require("./routes/analytics");
router.use("/analytics", analyticsRoutes);

const notificationRoutes = require("./routes/notifications");
router.use("/notifications", notificationRoutes);

// ========== ⚠️ MIDDLEWARE DE TRATAMENTO DE ERROS ==========
router.use((error, req, res, next) => {
  console.error("Erro na API:", error);

  // Erros customizados da aplicação
  if (error.name === "ApiError") {
    return res.status(error.statusCode).json({
      success: false,
      error: error.message,
      details: error.details || null,
      timestamp: new Date().toISOString(),
    });
  }

  // Erros de validação do Joi
  if (error.name === "ValidationError") {
    return res.status(400).json({
      success: false,
      error: "Dados inválidos",
      details: error.details || error.message,
      timestamp: new Date().toISOString(),
    });
  }

  // Erros de autenticação/autorização
  if (error.name === "UnauthorizedError" || error.statusCode === 401) {
    return res.status(401).json({
      success: false,
      error: "Não autorizado",
      message: "Token inválido ou expirado",
      timestamp: new Date().toISOString(),
    });
  }

  // Erros de permissão
  if (error.statusCode === 403) {
    return res.status(403).json({
      success: false,
      error: "Acesso negado",
      message: "Você não tem permissão para acessar este recurso",
      timestamp: new Date().toISOString(),
    });
  }

  // Erros de rate limiting
  if (error.statusCode === 429) {
    return res.status(429).json({
      success: false,
      error: "Muitas tentativas",
      message: "Aguarde antes de tentar novamente",
      retryAfter: error.retryAfter || 60,
      timestamp: new Date().toISOString(),
    });
  }

  // Outros erros HTTP conhecidos
  if (error.statusCode) {
    return res.status(error.statusCode).json({
      success: false,
      error: error.message || "Erro na requisição",
      timestamp: new Date().toISOString(),
    });
  }

  // Erro genérico - passar para próximo middleware
  next(error);
});

module.exports = router;
