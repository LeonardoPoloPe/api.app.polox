/**
 * ==========================================
 * 🔐 ROTAS DE AUTENTICAÇÃO
 * ==========================================
 */

const express = require("express");
const AuthController = require("../controllers/authController");
const { rateLimiter } = require("../middleware/rateLimiter");
const { validateRequest } = require("../utils/validation");
const Joi = require("joi");

const router = express.Router();

// 📝 Validações específicas
const loginValidation = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
  rememberMe: Joi.boolean().optional(),
});

const registerValidation = Joi.object({
  name: Joi.string().min(2).max(255).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  companyId: Joi.number().integer().positive().optional(),
});

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Login do usuário
 *     description: Autentica um usuário e retorna token JWT
 *     tags: [Auth]
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
 *               rememberMe:
 *                 type: boolean
 *                 default: false
 *     responses:
 *       200:
 *         description: Login realizado com sucesso
 *       400:
 *         description: Dados inválidos
 *       401:
 *         description: Credenciais inválidas
 */
router.post(
  "/login",
  rateLimiter.auth,
  validateRequest(loginValidation),
  AuthController.login
);

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Registro de novo usuário
 *     description: Cria uma nova conta de usuário
 *     tags: [Auth]
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
 *               companyId:
 *                 type: integer
 *     responses:
 *       201:
 *         description: Usuário criado com sucesso
 *       400:
 *         description: Dados inválidos
 *       409:
 *         description: Email já existe
 */
router.post(
  "/register",
  rateLimiter.auth,
  validateRequest(registerValidation),
  AuthController.register
);

module.exports = router;
