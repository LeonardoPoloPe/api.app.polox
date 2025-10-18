const express = require("express");
const authController = require("./controllers/authController");
const userController = require("./controllers/userController");
const { authenticateToken } = require("./utils/auth");
const { validateRequest } = require("./utils/validation");
const { userValidationSchemas } = require("./utils/validation");

const router = express.Router();

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
            url: '/dev/api/api-docs.json',
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
 *     description: Operações de autenticação e autorização
 *   - name: Users
 *     description: Operações relacionadas aos usuários
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

// ========== ROTAS DE AUTENTICAÇÃO ==========

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Registrar novo usuário
 *     description: Cria uma nova conta de usuário no sistema
 *     tags: [Authentication]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UserRegistration'
 *     responses:
 *       201:
 *         description: Usuário criado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       400:
 *         description: Dados inválidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       409:
 *         description: Email já cadastrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post(
  "/auth/register",
  validateRequest(userValidationSchemas.register),
  authController.register
);

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Fazer login
 *     description: Autentica o usuário e retorna um token JWT
 *     tags: [Authentication]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UserLogin'
 *     responses:
 *       200:
 *         description: Login realizado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       401:
 *         description: Credenciais inválidas
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       400:
 *         description: Dados inválidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post(
  "/auth/login",
  validateRequest(userValidationSchemas.login),
  authController.login
);

/**
 * @swagger
 * /auth/refresh:
 *   post:
 *     summary: Renovar token
 *     description: Renova o token JWT usando o refresh token
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
 *                 description: Token de renovação
 *                 example: refresh_token_example_123456
 *     responses:
 *       200:
 *         description: Token renovado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       401:
 *         description: Refresh token inválido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post(
  "/auth/refresh",
  validateRequest(userValidationSchemas.refresh),
  authController.refreshToken
);

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     summary: Fazer logout
 *     description: Invalida o token atual do usuário
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logout realizado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Logout realizado com sucesso
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       401:
 *         description: Token inválido ou expirado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post("/auth/logout", authenticateToken, authController.logout);

// ========== ROTAS DE USUÁRIOS ==========

/**
 * @swagger
 * /users/profile:
 *   get:
 *     summary: Obter perfil do usuário
 *     description: Retorna os dados do perfil do usuário autenticado
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Perfil obtido com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       401:
 *         description: Token inválido ou expirado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// Rotas protegidas que requerem autenticação
router.get("/users/profile", authenticateToken, userController.getProfile);

/**
 * @swagger
 * /users/profile:
 *   put:
 *     summary: Atualizar perfil do usuário
 *     description: Atualiza os dados do perfil do usuário autenticado
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: Nome do usuário
 *                 example: João Silva Atualizado
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Email do usuário
 *                 example: novo.email@polox.com
 *     responses:
 *       200:
 *         description: Perfil atualizado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       400:
 *         description: Dados inválidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Token inválido ou expirado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.put(
  "/users/profile",
  authenticateToken,
  validateRequest(userValidationSchemas.updateProfile),
  userController.updateProfile
);

/**
 * @swagger
 * /users/profile:
 *   delete:
 *     summary: Deletar perfil do usuário
 *     description: Remove permanentemente a conta do usuário autenticado
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Perfil deletado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Perfil deletado com sucesso
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       401:
 *         description: Token inválido ou expirado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.delete(
  "/users/profile",
  authenticateToken,
  userController.deleteProfile
);

/**
 * @swagger
 * /users:
 *   get:
 *     summary: Listar todos os usuários (Admin)
 *     description: Retorna lista de todos os usuários - requer permissões administrativas
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de usuários obtida com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 users:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/User'
 *                 total:
 *                   type: integer
 *                   example: 50
 *                 page:
 *                   type: integer
 *                   example: 1
 *       401:
 *         description: Token inválido ou expirado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Acesso negado - requer permissões de admin
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// Rotas administrativas (podem precisar de roles específicos)
router.get(
  "/users",
  authenticateToken,
  // TODO: Adicionar middleware de autorização para admin
  userController.listUsers
);

/**
 * @swagger
 * /users/{id}:
 *   get:
 *     summary: Obter usuário por ID (Admin)
 *     description: Retorna dados de um usuário específico - requer permissões administrativas
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID do usuário
 *         example: 1
 *     responses:
 *       200:
 *         description: Usuário encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       401:
 *         description: Token inválido ou expirado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Acesso negado - requer permissões de admin
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Usuário não encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get(
  "/users/:id",
  authenticateToken,
  validateRequest(userValidationSchemas.getUserById),
  userController.getUserById
);

// ========== ROTAS DE EXEMPLO/DEMO ==========

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

// ========== ROTA DE TESTE DE BANCO ==========

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

// ========== MIDDLEWARE DE ERRO PARA ROTAS DA API ==========
router.use((error, req, res, next) => {
  console.error("Erro na API:", error);

  // Erros de validação do Joi
  if (error.name === "ValidationError") {
    return res.status(400).json({
      error: "Dados inválidos",
      details: error.details || error.message,
      timestamp: new Date().toISOString(),
    });
  }

  // Erros de autenticação/autorização
  if (error.name === "UnauthorizedError" || error.statusCode === 401) {
    return res.status(401).json({
      error: "Não autorizado",
      message: "Token inválido ou expirado",
      timestamp: new Date().toISOString(),
    });
  }

  // Erros de permissão
  if (error.statusCode === 403) {
    return res.status(403).json({
      error: "Acesso negado",
      message: "Você não tem permissão para acessar este recurso",
      timestamp: new Date().toISOString(),
    });
  }

  // Outros erros HTTP conhecidos
  if (error.statusCode) {
    return res.status(error.statusCode).json({
      error: error.message || "Erro na requisição",
      timestamp: new Date().toISOString(),
    });
  }

  // Erro genérico
  next(error);
});

module.exports = router;
