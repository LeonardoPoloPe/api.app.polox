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
const TagController = require("../controllers/TagController");
const { authenticateToken } = require("../middleware/auth");
const { rateLimiter } = require("../middleware/rateLimiter");

const router = express.Router();

// Aplicar autenticação em todas as rotas
router.use(authenticateToken);

/**
 * ========================================
 * 🏷️ ROTAS DE TAGS - Sistema de Etiquetas
 * ========================================
 */

// ==========================================
// ROTAS ESPECIAIS (antes das rotas com :id)
// ==========================================

/**
 * @swagger
 * /tags/most-used:
 *   get:
 *     summary: Tags mais utilizadas
 *     description: Retorna as tags mais utilizadas da empresa, opcionalmente filtradas por tipo de entidade
 *     tags: [Tags]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *           minimum: 1
 *           maximum: 50
 *         description: Número máximo de tags para retornar
 *       - in: query
 *         name: entity_type
 *         schema:
 *           type: string
 *           enum: [contacts, suppliers, products, sales, tickets, events, financial_transactions]
 *         description: Filtrar por tipo de entidade específica
 *     responses:
 *       200:
 *         description: Lista de tags mais utilizadas
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
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       name:
 *                         type: string
 *                       slug:
 *                         type: string
 *                       color:
 *                         type: string
 *                       category:
 *                         type: string
 *                       usage_count:
 *                         type: integer
 *                       entity_types_count:
 *                         type: integer
 */
router.get("/most-used", TagController.getMostUsed);

/**
 * @swagger
 * /tags/stats:
 *   get:
 *     summary: Estatísticas gerais das tags
 *     description: Retorna estatísticas completas sobre o uso de tags na empresa
 *     tags: [Tags]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Estatísticas das tags
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
 *                 data:
 *                   type: object
 *                   properties:
 *                     total_tags:
 *                       type: integer
 *                     active_tags:
 *                       type: integer
 *                     system_tags:
 *                       type: integer
 *                     general_tags:
 *                       type: integer
 *                     priority_tags:
 *                       type: integer
 *                     status_tags:
 *                       type: integer
 *                     type_tags:
 *                       type: integer
 *                     total_taggings:
 *                       type: integer
 *                     used_tags:
 *                       type: integer
 *                     tagged_entity_types:
 *                       type: integer
 *                     usage_percentage:
 *                       type: string
 */
router.get("/stats", TagController.getStats);

/**
 * @swagger
 * /tags/stats/categories:
 *   get:
 *     summary: Estatísticas por categoria
 *     description: Retorna estatísticas agrupadas por categoria de tags
 *     tags: [Tags]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Estatísticas por categoria
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
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       category:
 *                         type: string
 *                       tag_count:
 *                         type: integer
 *                       active_count:
 *                         type: integer
 *                       usage_count:
 *                         type: integer
 *                       entity_types_count:
 *                         type: integer
 */
router.get("/stats/categories", TagController.getStatsByCategory);

/**
 * @swagger
 * /tags/suggestions:
 *   get:
 *     summary: Sugestões de tags
 *     description: Busca sugestões de tags baseadas em um texto de entrada
 *     tags: [Tags]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: text
 *         required: true
 *         schema:
 *           type: string
 *           minLength: 2
 *         description: Texto para buscar sugestões
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 5
 *           minimum: 1
 *           maximum: 20
 *         description: Número máximo de sugestões
 *     responses:
 *       200:
 *         description: Lista de sugestões de tags
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
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       name:
 *                         type: string
 *                       color:
 *                         type: string
 *                       category:
 *                         type: string
 *                       usage_count:
 *                         type: integer
 */
router.get("/suggestions", TagController.getSuggestions);

/**
 * @swagger
 * /tags/sync-entity:
 *   put:
 *     summary: Sincronizar tags de uma entidade
 *     description: Remove todas as tags atuais de uma entidade e associa as novas tags fornecidas
 *     tags: [Tags]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - entity_type
 *               - entity_id
 *             properties:
 *               entity_type:
 *                 type: string
 *                 enum: [contacts, suppliers, products, sales, tickets, events, financial_transactions]
 *                 description: Tipo da entidade
 *               entity_id:
 *                 type: integer
 *                 description: ID da entidade
 *               tag_ids:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 description: Array de IDs das tags para associar (vazio remove todas)
 *     responses:
 *       200:
 *         description: Sincronização realizada com sucesso
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
 *                 data:
 *                   type: object
 *                   properties:
 *                     removed:
 *                       type: integer
 *                     added:
 *                       type: integer
 *                     errors:
 *                       type: array
 *                       items:
 *                         type: string
 */
router.put("/sync-entity", TagController.syncEntityTags);

/**
 * @swagger
 * /tags/create-system-tags:
 *   post:
 *     summary: Criar tags do sistema
 *     description: Cria as tags padrão do sistema para a empresa (apenas se não existirem)
 *     tags: [Tags]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Tags do sistema criadas com sucesso
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
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Tag'
 */
router.post("/create-system-tags", TagController.createSystemTags);

/**
 * @swagger
 * /tags/find-or-create:
 *   post:
 *     summary: Buscar ou criar tags por nomes
 *     description: Busca tags existentes pelos nomes fornecidos e opcionalmente cria as que não existem
 *     tags: [Tags]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - names
 *             properties:
 *               names:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array de nomes das tags para buscar/criar
 *               create_missing:
 *                 type: boolean
 *                 default: false
 *                 description: Se deve criar tags que não existem
 *     responses:
 *       200:
 *         description: Tags encontradas/criadas
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
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Tag'
 */
router.post("/find-or-create", TagController.findOrCreateByNames);

// ==========================================
// ROTAS CRUD PRINCIPAIS
// ==========================================

/**
 * @swagger
 * /tags:
 *   get:
 *     summary: Listar tags
 *     description: Lista todas as tags da empresa com filtros e paginação
 *     tags: [Tags]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *           minimum: 1
 *         description: Página da listagem
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           minimum: 1
 *           maximum: 100
 *         description: Items por página
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *           enum: [general, priority, status, type]
 *         description: Filtrar por categoria
 *       - in: query
 *         name: is_active
 *         schema:
 *           type: boolean
 *         description: Filtrar por status ativo/inativo
 *       - in: query
 *         name: is_system
 *         schema:
 *           type: boolean
 *         description: Filtrar por tags do sistema
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Buscar por nome ou descrição
 *       - in: query
 *         name: sort_by
 *         schema:
 *           type: string
 *           default: name
 *           enum: [name, created_at, updated_at, category]
 *         description: Campo para ordenação
 *       - in: query
 *         name: sort_order
 *         schema:
 *           type: string
 *           default: ASC
 *           enum: [ASC, DESC]
 *         description: Direção da ordenação
 *     responses:
 *       200:
 *         description: Lista de tags com paginação
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
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Tag'
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 *   post:
 *     summary: Criar tag
 *     description: Cria uma nova tag para a empresa
 *     tags: [Tags]
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
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 255
 *                 description: Nome da tag
 *               color:
 *                 type: string
 *                 pattern: '^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$'
 *                 default: '#3498db'
 *                 description: Cor da tag em formato hexadecimal
 *               description:
 *                 type: string
 *                 maxLength: 500
 *                 description: Descrição da tag
 *               category:
 *                 type: string
 *                 enum: [general, priority, status, type]
 *                 default: general
 *                 description: Categoria da tag
 *               is_active:
 *                 type: boolean
 *                 default: true
 *                 description: Se a tag está ativa
 *               metadata:
 *                 type: object
 *                 description: Metadados adicionais da tag
 *     responses:
 *       201:
 *         description: Tag criada com sucesso
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
 *                 data:
 *                   $ref: '#/components/schemas/Tag'
 */
router.get("/", TagController.list);
router.post("/", rateLimiter.general, TagController.create);

/**
 * @swagger
 * /tags/{id}:
 *   get:
 *     summary: Buscar tag por ID
 *     description: Retorna uma tag específica pelo seu ID
 *     tags: [Tags]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID da tag
 *     responses:
 *       200:
 *         description: Tag encontrada
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
 *                 data:
 *                   $ref: '#/components/schemas/TagWithStats'
 *       404:
 *         description: Tag não encontrada
 *   put:
 *     summary: Atualizar tag
 *     description: Atualiza os dados de uma tag existente
 *     tags: [Tags]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID da tag
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 255
 *               color:
 *                 type: string
 *                 pattern: '^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$'
 *               description:
 *                 type: string
 *                 maxLength: 500
 *               category:
 *                 type: string
 *                 enum: [general, priority, status, type]
 *               is_active:
 *                 type: boolean
 *               metadata:
 *                 type: object
 *     responses:
 *       200:
 *         description: Tag atualizada com sucesso
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
 *                 data:
 *                   $ref: '#/components/schemas/Tag'
 *       404:
 *         description: Tag não encontrada
 *   delete:
 *     summary: Excluir tag
 *     description: Exclui uma tag (soft delete) e remove todas as suas associações
 *     tags: [Tags]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID da tag
 *     responses:
 *       200:
 *         description: Tag excluída com sucesso
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
 *                 data:
 *                   type: null
 *       404:
 *         description: Tag não encontrada
 */
router.get("/:id", TagController.show);
router.put("/:id", TagController.update);
router.delete("/:id", TagController.delete);

/**
 * @swagger
 * /tags/{id}/toggle:
 *   patch:
 *     summary: Ativar/Desativar tag
 *     description: Altera o status ativo/inativo de uma tag
 *     tags: [Tags]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID da tag
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - is_active
 *             properties:
 *               is_active:
 *                 type: boolean
 *                 description: Novo status da tag
 *     responses:
 *       200:
 *         description: Status da tag alterado com sucesso
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
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     name:
 *                       type: string
 *                     is_active:
 *                       type: boolean
 *                     updated_at:
 *                       type: string
 *                       format: date-time
 */
router.patch("/:id/toggle", TagController.toggleActive);

// ==========================================
// ROTAS DE ASSOCIAÇÃO COM ENTIDADES
// ==========================================

/**
 * @swagger
 * /tags/{id}/entities:
 *   post:
 *     summary: Associar tag a entidade
 *     description: Associa uma tag a uma entidade específica (contato, produto, etc.)
 *     tags: [Tags]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID da tag
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - entity_type
 *               - entity_id
 *             properties:
 *               entity_type:
 *                 type: string
 *                 enum: [contacts, suppliers, products, sales, tickets, events, financial_transactions]
 *                 description: Tipo da entidade
 *               entity_id:
 *                 type: integer
 *                 description: ID da entidade
 *     responses:
 *       201:
 *         description: Tag associada com sucesso
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
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     tag_id:
 *                       type: integer
 *                     taggable_type:
 *                       type: string
 *                     taggable_id:
 *                       type: integer
 *                     tagged_at:
 *                       type: string
 *                       format: date-time
 *                     tag_name:
 *                       type: string
 *   delete:
 *     summary: Remover tag de entidade
 *     description: Remove a associação de uma tag com uma entidade
 *     tags: [Tags]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID da tag
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - entity_type
 *               - entity_id
 *             properties:
 *               entity_type:
 *                 type: string
 *                 enum: [contacts, suppliers, products, sales, tickets, events, financial_transactions]
 *                 description: Tipo da entidade
 *               entity_id:
 *                 type: integer
 *                 description: ID da entidade
 *     responses:
 *       200:
 *         description: Associação removida com sucesso
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
 *                 data:
 *                   type: null
 *   get:
 *     summary: Listar entidades com a tag
 *     description: Lista todas as entidades que possuem uma tag específica
 *     tags: [Tags]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID da tag
 *       - in: query
 *         name: entity_type
 *         schema:
 *           type: string
 *           enum: [contacts, suppliers, products, sales, tickets, events, financial_transactions]
 *         description: Filtrar por tipo de entidade
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Página da listagem
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Items por página
 *     responses:
 *       200:
 *         description: Lista de entidades com a tag
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
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       taggable_type:
 *                         type: string
 *                       taggable_id:
 *                         type: integer
 *                       tagged_at:
 *                         type: string
 *                         format: date-time
 *                       tag_name:
 *                         type: string
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 */
router.post("/:id/entities", TagController.addToEntity);
router.delete("/:id/entities", TagController.removeFromEntity);
router.get("/:id/entities", TagController.getTaggedEntities);

// ==========================================
// ROTAS DE BUSCA POR ENTIDADE E CATEGORIA
// ==========================================

/**
 * @swagger
 * /tags/entity/{entity_type}/{entity_id}:
 *   get:
 *     summary: Buscar tags de uma entidade
 *     description: Retorna todas as tags associadas a uma entidade específica
 *     tags: [Tags]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: entity_type
 *         required: true
 *         schema:
 *           type: string
 *           enum: [contacts, suppliers, products, sales, tickets, events, financial_transactions]
 *         description: Tipo da entidade
 *       - in: path
 *         name: entity_id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID da entidade
 *     responses:
 *       200:
 *         description: Lista de tags da entidade
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
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       name:
 *                         type: string
 *                       slug:
 *                         type: string
 *                       color:
 *                         type: string
 *                       category:
 *                         type: string
 *                       tagged_at:
 *                         type: string
 *                         format: date-time
 */
router.get("/entity/:entity_type/:entity_id", TagController.getEntityTags);

/**
 * @swagger
 * /tags/entity/{entity_type}/{entity_id}:
 *   post:
 *     summary: Adicionar tag a uma entidade
 *     description: Associa uma ou mais tags a uma entidade específica (ex. lead "quente", "urgente")
 *     tags: [Tags]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: entity_type
 *         required: true
 *         schema:
 *           type: string
 *           enum: [contacts, suppliers, products, sales, tickets, events, financial_transactions]
 *         description: Tipo da entidade
 *       - in: path
 *         name: entity_id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID da entidade
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - tag_ids
 *             properties:
 *               tag_ids:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 description: IDs das tags para associar
 *                 example: [1, 2, 3]
 *           examples:
 *             lead_quente:
 *               summary: Lead quente e urgente
 *               value:
 *                 tag_ids: [5, 8]
 *     responses:
 *       201:
 *         description: Tags associadas com sucesso
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
 *                 data:
 *                   type: object
 *                   properties:
 *                     added:
 *                       type: integer
 *                     errors:
 *                       type: array
 *                       items:
 *                         type: string
 */
router.post("/entity/:entity_type/:entity_id", TagController.addTagsToEntity);

/**
 * @swagger
 * /tags/entity/{entity_type}/{entity_id}:
 *   put:
 *     summary: Substituir tags de uma entidade
 *     description: Substitui todas as tags atuais por novas tags (ex. atualizar lead de "frio" para "quente, urgente")
 *     tags: [Tags]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: entity_type
 *         required: true
 *         schema:
 *           type: string
 *           enum: [contacts, suppliers, products, sales, tickets, events, financial_transactions]
 *         description: Tipo da entidade
 *       - in: path
 *         name: entity_id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID da entidade
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - tag_ids
 *             properties:
 *               tag_ids:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 description: IDs das tags para substituir (vazio remove todas)
 *                 example: [5, 8]
 *           examples:
 *             atualizar_lead:
 *               summary: Atualizar status do lead
 *               value:
 *                 tag_ids: [5, 8, 12]
 *             remover_todas:
 *               summary: Remover todas as tags
 *               value:
 *                 tag_ids: []
 *     responses:
 *       200:
 *         description: Tags atualizadas com sucesso
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
 *                 data:
 *                   type: object
 *                   properties:
 *                     removed:
 *                       type: integer
 *                     added:
 *                       type: integer
 *                     errors:
 *                       type: array
 *                       items:
 *                         type: string
 */
router.put("/entity/:entity_type/:entity_id", TagController.syncEntityTags);

// Rota removida: /category/:category - campo category não existe no banco real

module.exports = router;