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

// Importar rotas específicas
const companiesRoutes = require("./routes/companies");
const gamificationRoutes = require("./routes/gamification");
const leadsRoutes = require("./routes/leads");
const clientsRoutes = require("./routes/clients");
const salesRoutes = require("./routes/sales");
const productsRoutes = require("./routes/products");
const financeRoutes = require("./routes/finance");
const ticketsRoutes = require("./routes/tickets");
const notificationsRoutes = require("./routes/notifications");
const scheduleRoutes = require("./routes/schedule");
const suppliersRoutes = require("./routes/suppliers");
const analyticsRoutes = require("./routes/analytics");
const usersRoutes = require("./routes/users");

const router = express.Router();

// ==========================================
// 📚 CONFIGURAÇÃO DO SWAGGER
// ==========================================
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
          description: "API Enterprise Multi-Tenant para CRM com Gamificação",
          contact: {
            name: "Polox Team",
            email: "suporte@polox.com.br",
          },
        },
        servers: [
          {
            url: "http://localhost:3000/api/v1",
            description: "Servidor Local (Node.js)",
          },
          {
            url: "https://z8ixwvp0qe.execute-api.sa-east-1.amazonaws.com/dev/api/v1",
            description: "Desenvolvimento AWS Lambda",
          },
          {
            url: "https://el0qui6eqj.execute-api.sa-east-1.amazonaws.com/sandbox/api/v1",
            description: "Sandbox AWS Lambda",
          },
          {
            url: "https://18yioqws85.execute-api.sa-east-1.amazonaws.com/prod/api/v1",
            description: "Produção AWS Lambda",
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
          parameters: {
            AcceptLanguage: {
              in: "header",
              name: "Accept-Language",
              schema: {
                type: "string",
                enum: ["pt", "en", "es"],
                default: "pt",
              },
              description: "Define o idioma da resposta (pt, en, es).",
              required: false,
            },
          },
        },
        security: [
          {
            bearerAuth: [],
          },
        ],
      },
      apis: ["./src/routes.js", "./src/routes/*.js", "./src/controllers/*.js"],
    };

    const swaggerSpec = swaggerJsdoc(swaggerOptions);

    // Rota para a UI do Swagger
    router.use("/docs", swaggerUi.serve);
    router.get(
      "/docs",
      swaggerUi.setup(swaggerSpec, {
        customCss: ".swagger-ui .topbar { display: none }",
        customSiteTitle: "Polox API Docs",
      })
    );

    // Rota para o JSON do Swagger
    router.get("/docs.json", (req, res) => {
      res.setHeader("Content-Type", "application/json");
      res.send(swaggerSpec);
    });

  console.log("📚 Swagger configurado em /api/v1/docs");
  } catch (error) {
    console.warn("⚠️  Swagger não pôde ser carregado:", error.message);
  }
}

// ==========================================
// � CONFIGURAÇÃO DO SWAGGER MOVIDA PARA /config/swagger.js
// ==========================================

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
 *     parameters:
 *       - $ref: '#/components/parameters/AcceptLanguage'
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
 *     parameters:
 *       - $ref: '#/components/parameters/AcceptLanguage'
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
 *     parameters:
 *       - $ref: '#/components/parameters/AcceptLanguage'
 *     responses:
 *       200:
 *         description: Token renovado com sucesso
 */
router.post("/auth/refresh", AuthController.refreshToken);

// ==========================================
// 👤 ROTAS DE USUÁRIO
// ==========================================
router.use("/users", usersRoutes);

// ==========================================
// 🏢 ROTAS DE EMPRESAS (SUPER ADMIN)
// ==========================================
router.use("/companies", companiesRoutes);

// ==========================================
// 🎮 ROTAS DE GAMIFICAÇÃO
// ==========================================
router.use("/gamification", gamificationRoutes);

// ==========================================
// 📈 ROTAS DE LEADS (CRM)
// ==========================================
router.use("/leads", leadsRoutes);

// ==========================================
// 👥 ROTAS DE CLIENTES
// ==========================================
router.use("/clients", clientsRoutes);

// ==========================================
// 💰 ROTAS DE VENDAS
// ==========================================
router.use("/sales", salesRoutes);

// ==========================================
// 📦 ROTAS DE PRODUTOS
// ==========================================
router.use("/products", productsRoutes);

// ==========================================
// 💳 ROTAS DE FINANÇAS
// ==========================================
router.use("/finance", financeRoutes);

// ==========================================
// 🎫 ROTAS DE TICKETS/SUPORTE
// ==========================================
router.use("/tickets", ticketsRoutes);

// ==========================================
// 🔔 ROTAS DE NOTIFICAÇÕES
// ==========================================
router.use("/notifications", notificationsRoutes);

// ==========================================
// 📅 ROTAS DE AGENDAMENTOS
// ==========================================
router.use("/schedule", scheduleRoutes);

// ==========================================
// 🏭 ROTAS DE FORNECEDORES
// ==========================================
router.use("/suppliers", suppliersRoutes);

// ==========================================
// 📊 ROTAS DE ANALYTICS/RELATÓRIOS
// ==========================================
router.use("/analytics", analyticsRoutes);

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
 *     parameters:
 *       - in: header
 *         name: Accept-Language
 *         schema:
 *           type: string
 *           enum: [pt, en, es]
 *           default: pt
 *         description: "Define o idioma da resposta (pt, en, es)."
 *         required: false
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
 *     parameters:
 *       - in: header
 *         name: Accept-Language
 *         schema:
 *           type: string
 *           enum: [pt, en, es]
 *           default: pt
 *         description: "Define o idioma da resposta (pt, en, es)."
 *         required: false
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
