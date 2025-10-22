/**
 * ==========================================
 * 🛣️ ROTAS BÁSICAS API POLOX
 * ==========================================
 */

const express = require("express");
const AuthController = require("./controllers/authController");
const UserController = require("./controllers/userController");

// Middleware e validações
const { authenticateToken } = require("./middleware/auth");

const router = express.Router();

// ==========================================
// 📖 SWAGGER/OPENAPI DOCUMENTATION
// ==========================================

// Configurar Swagger apenas em desenvolvimento
if (process.env.NODE_ENV !== "production") {
  try {
    const swaggerUi = require("swagger-ui-express");
    const swaggerJsdoc = require("swagger-jsdoc");

    const swaggerOptions = {
      definition: {
        openapi: "3.0.0",
        info: {
          title: "Polox CRM API",
          version: "1.0.0",
          description: "API Enterprise Multi-Tenant para CRM completo",
          contact: {
            name: "Polox Team",
            email: "contato@polox.com",
          },
        },
        servers: [
          {
            url: "http://localhost:3000/api",
            description: "Servidor de Desenvolvimento",
          },
        ],
        components: {
          securitySchemes: {
            bearerAuth: {
              type: "http",
              scheme: "bearer",
              bearerFormat: "JWT",
            },
          },
        },
        security: [
          {
            bearerAuth: [],
          },
        ],
      },
      apis: ["./src/routes.js", "./src/controllers/*.js"],
    };

    const swaggerSpec = swaggerJsdoc(swaggerOptions);

    // Configurar rota do Swagger UI
    router.use("/docs", swaggerUi.serve);
    router.get(
      "/docs",
      swaggerUi.setup(swaggerSpec, {
        customCss: `
        .swagger-ui .topbar { display: none }
        .swagger-ui .info { margin: 20px 0 }
        .swagger-ui .scheme-container { background: #fafafa; padding: 10px; border-radius: 5px; }
      `,
        customSiteTitle: "Polox CRM API Documentation",
        swaggerOptions: {
          persistAuthorization: true,
          displayRequestDuration: true,
          filter: true,
          showExtensions: true,
          showCommonExtensions: true,
        },
      })
    );

    console.log("📚 Swagger UI habilitado em /api/docs");
  } catch (error) {
    console.warn("Swagger não pôde ser carregado:", error.message);
  }
}

// ==========================================
// 🔐 ROTAS DE AUTENTICAÇÃO
// ==========================================

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Login de usuário
 *     tags: [Autenticação]
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
 *               password:
 *                 type: string
 *                 minLength: 6
 *               rememberMe:
 *                 type: boolean
 *                 default: false
 *     responses:
 *       200:
 *         description: Login realizado com sucesso
 *       401:
 *         description: Credenciais inválidas
 */
router.post("/auth/login", AuthController.login);

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Registrar novo usuário
 *     tags: [Autenticação]
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
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 minLength: 6
 *     responses:
 *       201:
 *         description: Usuário criado com sucesso
 */
router.post("/auth/register", AuthController.register);

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     summary: Logout do usuário
 *     tags: [Autenticação]
 *     responses:
 *       200:
 *         description: Logout realizado com sucesso
 */
router.post("/auth/logout", authenticateToken, AuthController.logout);

/**
 * @swagger
 * /auth/refresh:
 *   post:
 *     summary: Renovar token de acesso
 *     tags: [Autenticação]
 *     security: []
 *     responses:
 *       200:
 *         description: Token renovado com sucesso
 */
router.post("/auth/refresh", AuthController.refreshToken);

// ==========================================
// 👤 ROTAS DE USUÁRIO
// ==========================================

/**
 * @swagger
 * /users:
 *   get:
 *     summary: Listar usuários
 *     tags: [Usuários]
 *     responses:
 *       200:
 *         description: Lista de usuários
 */
router.get("/users", authenticateToken, UserController.getUsers);

/**
 * @swagger
 * /users/profile:
 *   get:
 *     summary: Obter perfil do usuário logado
 *     tags: [Usuários]
 *     responses:
 *       200:
 *         description: Perfil do usuário
 */
router.get("/users/profile", authenticateToken, UserController.getProfile);

/**
 * @swagger
 * /users/profile:
 *   put:
 *     summary: Atualizar perfil do usuário logado
 *     tags: [Usuários]
 *     responses:
 *       200:
 *         description: Perfil atualizado com sucesso
 */
router.put("/users/profile", authenticateToken, UserController.updateProfile);

// ==========================================
// 🎯 ROTAS DE DEMONSTRAÇÃO E TESTES
// ==========================================

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
    environment: process.env.NODE_ENV || "dev",
    version: "1.0.0",
    api: "Polox CRM API",
    status: "✅ Funcionando perfeitamente!",
  });
});

/**
 * @swagger
 * /demo/protected:
 *   get:
 *     summary: Rota protegida de demonstração
 *     description: Endpoint que requer autenticação para testar o middleware
 *     tags: [Demo]
 *     responses:
 *       200:
 *         description: Resposta de demonstração protegida
 *       401:
 *         description: Token não fornecido ou inválido
 */
router.get("/demo/protected", authenticateToken, (req, res) => {
  res.json({
    message: "Esta é uma rota protegida de demonstração",
    timestamp: new Date().toISOString(),
    user: {
      id: req.user.id,
      email: req.user.email,
      company_id: req.user.company_id,
    },
    environment: process.env.NODE_ENV || "dev",
    version: "1.0.0",
    status: "🔐 Acesso autorizado!",
  });
});

module.exports = router;
