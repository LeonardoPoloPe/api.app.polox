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

const express = require("express");
const ProfileController = require("../controllers/ProfileController");
const { authMiddleware } = require("../middleware/auth");

const router = express.Router();

/**
 * Todas as rotas requerem autenticação
 */
router.use(authMiddleware);

/**
 * @swagger
 * /profiles:
 *   get:
 *     summary: Lista perfis de acesso
 *     description: |
 *       Lista todos os perfis de acesso com filtros opcionais.
 *       - **super_admin**: vê todos os perfis (sistema + todas empresas)
 *       - **admin**: vê perfis do sistema + perfis da sua empresa
 *     tags: [Profiles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/AcceptLanguage'
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Número da página
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Itens por página
 *       - in: query
 *         name: company_id
 *         schema:
 *           type: integer
 *         description: Filtrar por empresa (apenas super_admin)
 *       - in: query
 *         name: is_system_default
 *         schema:
 *           type: boolean
 *         description: Filtrar perfis do sistema
 *       - in: query
 *         name: is_active
 *         schema:
 *           type: boolean
 *         description: Filtrar por status ativo/inativo
 *     responses:
 *       200:
 *         description: Lista de perfis retornada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Perfis listados com sucesso"
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Profile'
 *                 pagination:
 *                   $ref: '#/components/schemas/PaginationInfo'
 *       401:
 *         description: Não autenticado
 *       403:
 *         description: Sem permissão
 */
router.get("/", ProfileController.list);

/**
 * @swagger
 * /profiles/system-defaults:
 *   get:
 *     summary: Lista perfis padrão do sistema
 *     description: Retorna apenas os perfis padrão do sistema (company_id = NULL)
 *     tags: [Profiles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/AcceptLanguage'
 *     responses:
 *       200:
 *         description: Perfis do sistema retornados com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Perfis do sistema listados com sucesso"
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Profile'
 *       401:
 *         description: Não autenticado
 */
router.get("/system-defaults", ProfileController.getSystemDefaults);

/**
 * @swagger
 * /profiles/{id}:
 *   get:
 *     summary: Busca perfil por ID
 *     description: |
 *       Retorna um perfil específico.
 *       - **admin**: pode ver apenas perfis da sua empresa ou do sistema
 *       - **super_admin**: pode ver qualquer perfil
 *     tags: [Profiles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/AcceptLanguage'
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID do perfil
 *     responses:
 *       200:
 *         description: Perfil encontrado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Perfil encontrado com sucesso"
 *                 data:
 *                   $ref: '#/components/schemas/Profile'
 *       404:
 *         description: Perfil não encontrado
 *       403:
 *         description: Sem permissão para acessar este perfil
 */
router.get("/:id", ProfileController.getById);

/**
 * @swagger
 * /profiles:
 *   post:
 *     summary: Cria novo perfil de acesso
 *     description: |
 *       Cria um novo perfil.
 *       - **admin**: cria perfil para sua empresa (company_id é automaticamente definido)
 *       - **super_admin**: pode criar perfil do sistema (company_id = null) ou para qualquer empresa
 *     tags: [Profiles]
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
 *               - translations
 *               - screen_ids
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 255
 *                 example: "Gerente Comercial"
 *               company_id:
 *                 type: integer
 *                 nullable: true
 *                 description: "ID da empresa (null = perfil do sistema, apenas super_admin)"
 *                 example: 1
 *               translations:
 *                 type: object
 *                 required:
 *                   - pt-BR
 *                   - en-US
 *                   - es-ES
 *                 properties:
 *                   pt-BR:
 *                     type: string
 *                     example: "Gerente Comercial"
 *                   en-US:
 *                     type: string
 *                     example: "Sales Manager"
 *                   es-ES:
 *                     type: string
 *                     example: "Gerente Comercial"
 *               screen_ids:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array de IDs de telas (menu_items) que o perfil pode acessar
 *                 example: ["2", "3", "4", "5", "7", "8"]
 *               is_active:
 *                 type: boolean
 *                 default: true
 *                 example: true
 *           examples:
 *             perfil_empresa:
 *               summary: Perfil de Empresa
 *               value:
 *                 name: "Gerente Comercial"
 *                 company_id: 1
 *                 translations:
 *                   pt-BR: "Gerente Comercial"
 *                   en-US: "Sales Manager"
 *                   es-ES: "Gerente Comercial"
 *                 screen_ids: ["2", "3", "4", "5", "7", "8"]
 *                 is_active: true
 *             perfil_sistema:
 *               summary: Perfil do Sistema (super_admin apenas)
 *               value:
 *                 name: "Atendente"
 *                 company_id: null
 *                 translations:
 *                   pt-BR: "Atendente"
 *                   en-US: "Support Agent"
 *                   es-ES: "Agente de Soporte"
 *                 screen_ids: ["2", "3", "6"]
 *                 is_active: true
 *     responses:
 *       201:
 *         description: Perfil criado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Perfil criado com sucesso"
 *                 data:
 *                   $ref: '#/components/schemas/Profile'
 *       400:
 *         description: Dados inválidos ou perfil com mesmo nome já existe
 *       403:
 *         description: Sem permissão (apenas super_admin pode criar perfis do sistema)
 */
router.post("/", ProfileController.create);

/**
 * @swagger
 * /profiles/{id}:
 *   put:
 *     summary: Atualiza perfil existente
 *     description: |
 *       Atualiza dados de um perfil.
 *       - **admin**: pode editar apenas perfis da sua empresa (não pode editar perfis do sistema)
 *       - **super_admin**: pode editar qualquer perfil
 *     tags: [Profiles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/AcceptLanguage'
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID do perfil
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
 *                 example: "Gerente Comercial Sênior"
 *               translations:
 *                 type: object
 *                 properties:
 *                   pt-BR:
 *                     type: string
 *                   en-US:
 *                     type: string
 *                   es-ES:
 *                     type: string
 *               screen_ids:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["2", "3", "4", "5", "6", "7", "8", "9"]
 *               is_active:
 *                 type: boolean
 *                 example: true
 *           example:
 *             name: "Gerente Comercial Sênior"
 *             translations:
 *               pt-BR: "Gerente Comercial Sênior"
 *               en-US: "Senior Sales Manager"
 *               es-ES: "Gerente Comercial Senior"
 *             screen_ids: ["2", "3", "4", "5", "6", "7", "8", "9"]
 *     responses:
 *       200:
 *         description: Perfil atualizado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Perfil atualizado com sucesso"
 *                 data:
 *                   $ref: '#/components/schemas/Profile'
 *       400:
 *         description: Dados inválidos
 *       403:
 *         description: Sem permissão para editar este perfil
 *       404:
 *         description: Perfil não encontrado
 */
router.put("/:id", ProfileController.update);

/**
 * @swagger
 * /profiles/{id}:
 *   delete:
 *     summary: Deleta perfil (soft delete)
 *     description: |
 *       Remove um perfil (soft delete - marca deleted_at).
 *       - Não pode deletar perfis com usuários ativos
 *       - **admin**: pode deletar apenas perfis da sua empresa (não pode deletar perfis do sistema)
 *       - **super_admin**: pode deletar qualquer perfil
 *     tags: [Profiles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/AcceptLanguage'
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID do perfil
 *     responses:
 *       200:
 *         description: Perfil deletado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Perfil deletado com sucesso"
 *       400:
 *         description: Perfil possui usuários ativos
 *       403:
 *         description: Sem permissão para deletar este perfil
 *       404:
 *         description: Perfil não encontrado
 */
router.delete("/:id", ProfileController.delete);

/**
 * @swagger
 * /profiles/{id}/toggle-status:
 *   patch:
 *     summary: Ativa/desativa perfil
 *     description: Alterna o status is_active do perfil entre true/false
 *     tags: [Profiles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/AcceptLanguage'
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID do perfil
 *     responses:
 *       200:
 *         description: Status alterado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Status do perfil alterado com sucesso"
 *                 data:
 *                   $ref: '#/components/schemas/Profile'
 *       403:
 *         description: Sem permissão
 *       404:
 *         description: Perfil não encontrado
 */
router.patch("/:id/toggle-status", ProfileController.toggleStatus);

/**
 * @swagger
 * /profiles/{id}/reassign:
 *   post:
 *     summary: Reatribui usuários para outro perfil
 *     description: |
 *       Move todos os usuários de um perfil para outro.
 *       Útil antes de deletar um perfil que possui usuários.
 *     tags: [Profiles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/AcceptLanguage'
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID do perfil de origem (perfil atual dos usuários)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - target_profile_id
 *             properties:
 *               target_profile_id:
 *                 type: integer
 *                 description: ID do perfil de destino (novo perfil dos usuários)
 *                 example: 2
 *           example:
 *             target_profile_id: 2
 *     responses:
 *       200:
 *         description: Usuários reatribuídos com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "5 usuários reatribuídos com sucesso"
 *                 data:
 *                   type: object
 *                   properties:
 *                     users_reassigned:
 *                       type: integer
 *                       example: 5
 *       400:
 *         description: Perfis inválidos ou da mesma empresa
 *       403:
 *         description: Sem permissão
 *       404:
 *         description: Perfil não encontrado
 */
router.post("/:id/reassign", ProfileController.reassignUsers);

module.exports = router;
