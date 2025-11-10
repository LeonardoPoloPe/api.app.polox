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
  profile_id: Joi.number().integer().allow(null).optional(),
});

const createUserValidation = Joi.object({
  name: Joi.string().min(2).max(255).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  company_id: Joi.number().integer().optional(),
  profile_id: Joi.number().integer().allow(null).optional(),
  role: Joi.string()
    .valid("super_admin", "company_admin", "manager", "user")
    .default("user"),
});

const resetPasswordValidation = Joi.object({
  newPassword: Joi.string().min(6).required(),
});

const changePasswordValidation = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: Joi.string().min(6).required(),
});

const updateUserValidation = Joi.object({
  name: Joi.string().min(2).max(255),
  email: Joi.string().email(),
  role: Joi.string().valid("super_admin", "company_admin", "manager", "user"),
  company_id: Joi.number().integer(),
  profile_id: Joi.number().integer().allow(null).optional(),
  status: Joi.string().valid("active", "inactive", "suspended"),
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
 *       - in: query
 *         name: companyId
 *         schema:
 *           type: integer
 *         description: Filtrar por ID da empresa
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
 *               profile_id:
 *                 type: integer
 *                 nullable: true
 *                 description: "ID do perfil de acesso do usuário"
 *                 example: 5
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
 * /users/profile-menu:
 *   get:
 *     summary: Busca perfil do usuário autenticado com menus vinculados
 *     description: |
 *       Retorna o perfil do usuário autenticado (via token JWT) e os menus que ele tem permissão de acessar.
 *       Usado no login para carregar o menu dinâmico baseado no perfil.
 *       
 *       **SEGURANÇA:** Usa automaticamente o ID do usuário do token JWT (req.user.id),
 *       não permitindo que um usuário acesse dados de outro.
 *       
 *       Lógica de permissões:
 *       1. Identifica usuário pelo token JWT
 *       2. Busca o perfil do usuário (profiles.id via users.profile_id)
 *       3. Obtém os menus permitidos (profiles.screen_ids)
 *       4. Filtra por permissões da empresa (menu_company_permissions)
 *       5. Filtra por root_only_access (apenas super_admin)
 *       6. Constrói hierarquia de menus (parent_id)
 *       7. Traduz labels baseado no Accept-Language
 *     tags: [Usuários]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/AcceptLanguage'
 *     responses:
 *       200:
 *         description: Perfil e menus retornados com sucesso
 *       401:
 *         description: Não autenticado ou token inválido
 *       404:
 *         description: Usuário não encontrado ou perfil não configurado
 *       500:
 *         description: Erro no servidor
 */
router.get("/profile-menu", rateLimiter.general, UserController.getUserProfileWithMenus);

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

/**
 * @swagger
 * /users/{id}:
 *   put:
 *     summary: Atualizar usuário
 *     description: Atualiza os dados de um usuário específico (requer permissões de admin)
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
 *                 example: "Maria Silva"
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "maria.silva@exemplo.com"
 *               role:
 *                 type: string
 *                 enum: ["super_admin", "company_admin", "manager", "user"]
 *                 example: "user"
 *               company_id:
 *                 type: integer
 *                 example: 1
 *               profile_id:
 *                 type: integer
 *                 nullable: true
 *                 description: "ID do perfil de acesso do usuário"
 *                 example: 5
 *               status:
 *                 type: string
 *                 enum: ["active", "inactive", "suspended"]
 *                 example: "active"
 *     responses:
 *       200:
 *         description: Usuário atualizado com sucesso
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
 *       400:
 *         description: Dados inválidos
 *       404:
 *         description: Usuário não encontrado
 *       409:
 *         description: Email já está em uso
 */
router.put(
  "/:id",
  requireCompanyAdmin,
  rateLimiter.general,
  validateRequest(updateUserValidation),
  UserController.updateUser
);

/**
 * @swagger
 * /users:
 *   post:
 *     summary: Criar novo usuário
 *     description: Cria um novo usuário no sistema (requer permissões de admin)
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
 *             required:
 *               - name
 *               - email
 *               - password
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 255
 *                 example: "Maria Silva"
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "maria@exemplo.com"
 *               password:
 *                 type: string
 *                 minLength: 6
 *                 example: "senha123"
 *               role:
 *                 type: string
 *                 enum: ["super_admin", "company_admin", "manager", "user"]
 *                 default: "user"
 *                 example: "user"
 *               profile_id:
 *                 type: integer
 *                 nullable: true
 *                 description: "ID do perfil de acesso a ser atribuído ao usuário"
 *                 example: 5
 *     responses:
 *       201:
 *         description: Usuário criado com sucesso
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
 *       400:
 *         description: Dados inválidos
 *       409:
 *         description: Email já está em uso
 */
router.post(
  "/",
  requireCompanyAdmin,
  rateLimiter.general,
  validateRequest(createUserValidation),
  UserController.createUser
);

/**
 * @swagger
 * /users/{id}/reset-password:
 *   put:
 *     summary: Resetar senha do usuário
 *     description: Reseta a senha de um usuário específico (requer permissões de admin)
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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - newPassword
 *             properties:
 *               newPassword:
 *                 type: string
 *                 minLength: 6
 *                 example: "novaSenha123"
 *     responses:
 *       200:
 *         description: Senha resetada com sucesso
 *       400:
 *         description: Dados inválidos
 *       404:
 *         description: Usuário não encontrado
 */
router.put(
  "/:userId/reset-password",
  requireCompanyAdmin,
  rateLimiter.general,
  validateRequest(resetPasswordValidation),
  UserController.resetPassword
);

/**
 * @swagger
 * /users/change-password:
 *   put:
 *     summary: Alterar própria senha
 *     description: Permite ao usuário autenticado alterar sua própria senha
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
 *             required:
 *               - currentPassword
 *               - newPassword
 *             properties:
 *               currentPassword:
 *                 type: string
 *                 example: "senhaAtual123"
 *               newPassword:
 *                 type: string
 *                 minLength: 6
 *                 example: "novaSenha123"
 *     responses:
 *       200:
 *         description: Senha alterada com sucesso
 *       400:
 *         description: Dados inválidos
 *       401:
 *         description: Senha atual incorreta
 */
router.put(
  "/change-password",
  rateLimiter.general,
  validateRequest(changePasswordValidation),
  UserController.changePassword
);

module.exports = router;
