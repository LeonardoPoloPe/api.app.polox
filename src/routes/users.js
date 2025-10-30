/**
 * ==========================================
 * 👥 ROTAS DE USUÁRIOS
 * ==========================================
 */

const express = require("express");
const UserController = require("../controllers/userController");
const {
  authenticateToken,
  requireCompanyAdmin,
  requireSuperAdmin,
} = require("../middleware/auth");
const { rateLimiter } = require("../middleware/rateLimiter");
const { validateRequest } = require("../utils/validation");
const Joi = require("joi");

const router = express.Router();

// 🔐 Middleware obrigatório: autenticação
router.use(authenticateToken);

// 📝 Validações específicas
const updateProfileValidation = Joi.object({
  name: Joi.string().min(2).max(255),
  email: Joi.string().email(),
});

/**
 * @swagger
 * /users:
 *   get:
 *     summary: Listar usuários
 *     description: Lista todos os usuários com paginação e busca
 *     tags: [Usuários]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/AcceptLanguage'
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Página da consulta
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
 *     responses:
 *       200:
 *         description: Lista de usuários
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
 *                     users:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/User'
 *                     pagination:
 *                       $ref: '#/components/schemas/PaginationInfo'
 */
router.get("/", rateLimiter.general, UserController.getUsers);

/**
 * @swagger
 * /users/profile:
 *   get:
 *     summary: Obter perfil do usuário autenticado
 *     description: Retorna informações do usuário logado
 *     tags: [Usuários]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/AcceptLanguage'
 *     responses:
 *       200:
 *         description: Perfil do usuário
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
 *                     user:
 *                       $ref: '#/components/schemas/User'
 */
router.get("/profile", rateLimiter.general, UserController.getProfile);
// Alias para compatibilidade com testes: /users/me
router.get("/me", rateLimiter.general, UserController.getProfile);

/**
 * @swagger
 * /users/profile:
 *   put:
 *     summary: Atualizar perfil do usuário
 *     description: Atualiza informações do perfil do usuário autenticado
 *     tags: [Usuários]
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
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 255
 *                 example: "João Silva"
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "joao@exemplo.com"
 *     responses:
 *       200:
 *         description: Perfil atualizado com sucesso
 *       400:
 *         description: Dados inválidos
 *       409:
 *         description: Email já está em uso
 */
router.put(
  "/profile",
  rateLimiter.general,
  validateRequest(updateProfileValidation),
  UserController.updateProfile
);

/**
 * @swagger
 * /users/{id}:
 *   get:
 *     summary: Obter usuário por ID
 *     description: Retorna informações de um usuário específico
 *     tags: [Usuários]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/AcceptLanguage'
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID do usuário
 *     responses:
 *       200:
 *         description: Dados do usuário
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
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *       404:
 *         description: Usuário não encontrado
 */
router.get("/:id", rateLimiter.general, UserController.getUserById);

module.exports = router;
