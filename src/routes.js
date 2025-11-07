/**
 * ============================================================================
 * POLO X - Proprietary System / Sistema Proprietário
 * ============================================================================
 * 
 * Copyright (c) 2025 Polo X Manutencao de Equipamentos de Informatica LTDA
 * CNPJ: 55.419.946/0001-89
 * 
 * Legal Name / Razão Social: Polo X Manutencao de Equipamentos de Informatica LTDA
 * Trade Name / Nome Fantasia: Polo X
 * 
 * Developer / Desenvolvedor: Leonardo Polo Pereira
 * 
 * LICENSING STATUS / STATUS DE LICENCIAMENTO: Restricted Use / Uso Restrito
 * ALL RIGHTS RESERVED / TODOS OS DIREITOS RESERVADOS
 * 
 * This code is proprietary and confidential. It is strictly prohibited to:
 * Este código é proprietário e confidencial. É estritamente proibido:
 * - Copy, modify or distribute without express authorization
 * - Copiar, modificar ou distribuir sem autorização expressa
 * - Use or integrate in any other project
 * - Usar ou integrar em outros projetos
 * - Share with unauthorized third parties
 * - Compartilhar com terceiros não autorizados
 * 
 * Violations will be prosecuted under Brazilian Law:
 * Violações serão processadas conforme Lei Brasileira:
 * - Law 9.609/98 (Software Law / Lei do Software)
 * - Law 9.610/98 (Copyright Law / Lei de Direitos Autorais)
 * - Brazilian Penal Code Art. 184 (Código Penal Brasileiro Art. 184)
 * 
 * INPI Registration: In progress / Em andamento
 * 
 * For licensing / Para licenciamento: contato@polox.com.br
 * ============================================================================
 */

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
const contactsRoutes = require("./routes/contacts"); // ✨ Identidade Unificada (substitui leads + clients)
const dealsRoutes = require("./routes/deals"); // ✨ Pipeline de Vendas
const contactNotesRoutes = require("./routes/contact-notes"); // ✨ Histórico Unificado
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

    // Rota para o JSON do Swagger (deve vir ANTES da UI)
    router.get("/docs.json", (req, res) => {
      res.setHeader("Content-Type", "application/json");
      res.send(swaggerSpec);
    });

    // Rota para a UI do Swagger - HTML customizado para funcionar com serverless-offline
    router.get("/docs", (req, res) => {
      const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Polox API Docs</title>
  <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui.css">
  <style>
    html { box-sizing: border-box; overflow: -moz-scrollbars-vertical; overflow-y: scroll; }
    *, *:before, *:after { box-sizing: inherit; }
    body { margin:0; padding:0; }
    .swagger-ui .topbar { display: none; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui-bundle.js"></script>
  <script src="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui-standalone-preset.js"></script>
  <script>
    window.onload = function() {
      const ui = SwaggerUIBundle({
        url: window.location.origin + window.location.pathname.replace(/\\/docs.*$/, '') + '/docs.json',
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIStandalonePreset
        ],
        plugins: [
          SwaggerUIBundle.plugins.DownloadUrl
        ],
        layout: "StandaloneLayout"
      });
      window.ui = ui;
    };
  </script>
</body>
</html>`;
      res.send(html);
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
// 🏠 ROTA RAIZ DA API
// ==========================================

/**
 * @swagger
 * /:
 *   get:
 *     summary: Informações da API
 *     description: Retorna informações sobre a API, versão e links úteis
 *     tags: [Informações]
 *     security: []
 *     parameters:
 *       - $ref: '#/components/parameters/AcceptLanguage'
 *     responses:
 *       200:
 *         description: Informações da API
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 api:
 *                   type: object
 *                 endpoints:
 *                   type: object
 */
router.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Polox CRM API - Sistema de Gestão Multi-Tenant",
    api: {
      name: "Polox CRM API",
      version: "1.0.0",
      environment: process.env.NODE_ENV || "dev",
      timestamp: new Date().toISOString(),
    },
    architecture: {
      type: "Identity vs. Intention",
      description:
        "Identidade unificada (Contacts) + Pipeline de vendas (Deals)",
    },
    endpoints: {
      documentation: "/docs",
      swagger_json: "/docs.json",
      authentication: "/auth/login",
      contacts: "/contacts",
      deals: "/deals",
      notes: "/notes",
    },
    features: [
      "🌐 Multi-idiomas (PT/EN/ES)",
      "👥 Identidade unificada (Leads + Clientes)",
      "💼 Pipeline de vendas",
      "📝 Histórico de interações",
      "🔐 Autenticação JWT",
      "🏢 Multi-tenant",
    ],
    status: "✅ Online",
  });
});

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
// ✨ NOVA ARQUITETURA: IDENTIDADE VS. INTENÇÃO
// ==========================================

// 👥 ROTAS DE CONTATOS (Identidade Unificada: Leads + Clientes)
router.use("/contacts", contactsRoutes);

// 💼 ROTAS DE NEGOCIAÇÕES (Pipeline de Vendas)
router.use("/deals", dealsRoutes);

// � ROTAS DE ANOTAÇÕES (Histórico Unificado)
router.use("/notes", contactNotesRoutes);

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
