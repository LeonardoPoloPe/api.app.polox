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

const router = express.Router();

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
