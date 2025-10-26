/**
 * ==========================================
 * 📈 ROTAS DE LEADS - CRM CORE
 * ==========================================
 */

const express = require('express');
const LeadController = require('../controllers/LeadController');
const { authenticateToken } = require('../middleware/auth');
const { rateLimiter } = require('../middleware/rateLimiter');
const { validateRequest } = require('../utils/validation');
const Joi = require('joi');

const router = express.Router();

// 🔐 Middleware obrigatório: autenticação
router.use(authenticateToken);

// 📝 Validações específicas
const createLeadValidation = Joi.object({
  name: Joi.string().min(2).max(255).required(),
  email: Joi.string().email().allow(null),
  phone: Joi.string().max(20).allow(null),
  company: Joi.string().max(255).allow(null),
  position: Joi.string().max(100).allow(null),
  source: Joi.string().valid(
    'website', 'social', 'referral', 'cold_call', 'email', 'event', 'advertising', 'other'
  ).default('other'),
  status: Joi.string().valid(
    'new', 'contacted', 'qualified', 'proposal', 'negotiation', 'won', 'lost'
  ).default('new'),
  value: Joi.number().min(0).allow(null),
  description: Joi.string().max(1000).allow(null),
  tags: Joi.array().items(Joi.string()).default([]),
  custom_fields: Joi.object().default({})
});

const updateLeadValidation = Joi.object({
  name: Joi.string().min(2).max(255),
  email: Joi.string().email().allow(null),
  phone: Joi.string().max(20).allow(null),
  company: Joi.string().max(255).allow(null),
  position: Joi.string().max(100).allow(null),
  source: Joi.string().valid(
    'website', 'social', 'referral', 'cold_call', 'email', 'event', 'advertising', 'other'
  ),
  status: Joi.string().valid(
    'new', 'contacted', 'qualified', 'proposal', 'negotiation', 'won', 'lost'
  ),
  value: Joi.number().min(0).allow(null),
  description: Joi.string().max(1000).allow(null),
  tags: Joi.array().items(Joi.string()),
  custom_fields: Joi.object()
});

/**
 * @swagger
 * /leads:
 *   get:
 *     summary: Listar todos os leads
 *     description: Lista leads com filtros avançados, paginação e estatísticas
 *     tags: [Leads]
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
 *         name: status
 *         schema:
 *           type: string
 *           enum: [new, contacted, qualified, proposal, negotiation, won, lost]
 *         description: Filtrar por status (pode usar vírgula para múltiplos)
 *       - in: query
 *         name: source
 *         schema:
 *           type: string
 *           enum: [website, social, referral, cold_call, email, event, advertising, other]
 *         description: Filtrar por origem
 *       - in: query
 *         name: assigned_to
 *         schema:
 *           type: string
 *         description: Filtrar por responsável (ID do usuário)
 *       - in: query
 *         name: value_min
 *         schema:
 *           type: number
 *         description: Valor mínimo estimado
 *       - in: query
 *         name: value_max
 *         schema:
 *           type: number
 *         description: Valor máximo estimado
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Busca por nome, email ou empresa
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [name, estimated_value, created_at, status, source]
 *           default: created_at
 *         description: Campo para ordenação
 *       - in: query
 *         name: order
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Direção da ordenação
 *     responses:
 *       200:
 *         description: Lista de leads com estatísticas
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Lead'
 *                 pagination:
 *                   $ref: '#/components/schemas/PaginationInfo'
 *                 stats:
 *                   type: object
 *                   properties:
 *                     total_leads:
 *                       type: integer
 *                     total_value:
 *                       type: number
 *                     conversion_rate:
 *                       type: number
 *                     new_leads:
 *                       type: integer
 *                     contacted_leads:
 *                       type: integer
 *                     qualified_leads:
 *                       type: integer
 *       401:
 *         description: Token inválido ou ausente
 */
router.get('/', rateLimiter.general, LeadController.index);

/**
 * @swagger
 * /leads:
 *   post:
 *     summary: Criar novo lead
 *     description: Cria um lead e concede XP/Coins ao usuário
 *     tags: [Leads]
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
 *               phone:
 *                 type: string
 *                 maxLength: 20
 *                 example: "(11) 99999-9999"
 *               company:
 *                 type: string
 *                 maxLength: 255
 *                 example: "Empresa ABC"
 *               position:
 *                 type: string
 *                 maxLength: 100
 *                 example: "Gerente de TI"
 *               source:
 *                 type: string
 *                 enum: [website, social, referral, cold_call, email, event, advertising, other]
 *                 default: other
 *               value:
 *                 type: number
 *                 minimum: 0
 *                 example: 5000
 *               description:
 *                 type: string
 *                 maxLength: 1000
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["qualificado", "urgente"]
 *     responses:
 *       201:
 *         description: Lead criado com sucesso
 *       400:
 *         description: Dados inválidos ou email já existe
 */
router.post('/', rateLimiter.general, validateRequest(createLeadValidation), LeadController.create);

/**
 * @swagger
 * /leads/{id}:
 *   get:
 *     summary: Detalhes do lead
 *     description: Busca informações completas de um lead específico
 *     tags: [Leads]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/AcceptLanguage'
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do lead
 *     responses:
 *       200:
 *         description: Detalhes do lead
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Lead'
 *       404:
 *         description: Lead não encontrado
 */
router.get('/:id', rateLimiter.general, LeadController.show);

/**
 * @swagger
 * /leads/{id}:
 *   put:
 *     summary: Atualizar lead
 *     description: Atualiza informações de um lead existente
 *     tags: [Leads]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/AcceptLanguage'
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do lead
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
 *               email:
 *                 type: string
 *                 format: email
 *               phone:
 *                 type: string
 *                 maxLength: 20
 *               company:
 *                 type: string
 *                 maxLength: 255
 *               position:
 *                 type: string
 *                 maxLength: 100
 *               source:
 *                 type: string
 *                 enum: [website, social, referral, cold_call, email, event, advertising, other]
 *               status:
 *                 type: string
 *                 enum: [new, contacted, qualified, proposal, negotiation, won, lost]
 *               value:
 *                 type: number
 *                 minimum: 0
 *               description:
 *                 type: string
 *                 maxLength: 1000
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Lead atualizado com sucesso
 *       400:
 *         description: Dados inválidos
 *       404:
 *         description: Lead não encontrado
 */
router.put('/:id', rateLimiter.general, validateRequest(updateLeadValidation), LeadController.update);

/**
 * @swagger
 * /leads/{id}/convert:
 *   post:
 *     summary: Converter lead para cliente
 *     description: Converte um lead em cliente e concede XP/Coins extras
 *     tags: [Leads]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/AcceptLanguage'
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do lead
 *     responses:
 *       200:
 *         description: Lead convertido com sucesso
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
 *                     lead_id:
 *                       type: string
 *                     client_id:
 *                       type: string
 *                     client:
 *                       $ref: '#/components/schemas/Client'
 *       400:
 *         description: Lead já convertido
 *       404:
 *         description: Lead não encontrado
 */
router.post('/:id/convert', rateLimiter.general, LeadController.convertToClient);

/**
 * @swagger
 * /leads/{id}/assign:
 *   put:
 *     summary: Atribuir lead a usuário
 *     description: Atribui um lead a um usuário específico da empresa
 *     tags: [Leads]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/AcceptLanguage'
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do lead
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - user_id
 *             properties:
 *               user_id:
 *                 type: string
 *                 description: ID do usuário responsável
 *     responses:
 *       200:
 *         description: Lead atribuído com sucesso
 *       404:
 *         description: Lead ou usuário não encontrado
 */
router.put('/:id/assign', rateLimiter.general, LeadController.assignTo);

// ==========================================
// 📝 ROTAS DE NOTAS
// ==========================================

/**
 * @swagger
 * /leads/{id}/notes:
 *   get:
 *     summary: Listar notas do lead
 *     tags: [Leads]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID do lead
 *     responses:
 *       200:
 *         description: Lista de notas do lead
 */
router.get('/:id/notes', rateLimiter.general, LeadController.getNotes);

/**
 * @swagger
 * /leads/{id}/notes:
 *   post:
 *     summary: Adicionar nota ao lead
 *     tags: [Leads]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID do lead
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - content
 *             properties:
 *               content:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 5000
 *               type:
 *                 type: string
 *                 enum: [general, call, meeting, email, whatsapp, other]
 *                 default: general
 *     responses:
 *       201:
 *         description: Nota criada com sucesso
 */
router.post('/:id/notes', rateLimiter.general, LeadController.addNote);

/**
 * @swagger
 * /leads/{leadId}/notes/{noteId}:
 *   put:
 *     summary: Atualizar nota
 *     tags: [Leads]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: leadId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: noteId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - content
 *             properties:
 *               content:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 5000
 *     responses:
 *       200:
 *         description: Nota atualizada com sucesso
 */
router.put('/:leadId/notes/:noteId', rateLimiter.general, LeadController.updateNote);

/**
 * @swagger
 * /leads/{leadId}/notes/{noteId}:
 *   delete:
 *     summary: Deletar nota
 *     tags: [Leads]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: leadId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: noteId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Nota deletada com sucesso
 */
router.delete('/:leadId/notes/:noteId', rateLimiter.general, LeadController.deleteNote);

// ==========================================
// 🏷️ ROTAS DE TAGS
// ==========================================

/**
 * @swagger
 * /leads/{id}/tags:
 *   get:
 *     summary: Listar tags do lead
 *     tags: [Leads]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Lista de tags do lead
 */
router.get('/:id/tags', rateLimiter.general, LeadController.getTags);

/**
 * @swagger
 * /leads/{id}/tags:
 *   post:
 *     summary: Adicionar tags ao lead
 *     tags: [Leads]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - tags
 *             properties:
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *                   minLength: 1
 *                   maxLength: 100
 *                 example: ["qualificado", "urgente", "tecnologia"]
 *     responses:
 *       200:
 *         description: Tags adicionadas com sucesso
 */
router.post('/:id/tags', rateLimiter.general, LeadController.addTags);

/**
 * @swagger
 * /leads/{leadId}/tags/{tagId}:
 *   delete:
 *     summary: Remover tag do lead
 *     tags: [Leads]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: leadId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: tagId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Tag removida com sucesso
 */
router.delete('/:leadId/tags/:tagId', rateLimiter.general, LeadController.removeTag);

// ==========================================
// 💡 ROTAS DE INTERESTS
// ==========================================

/**
 * @swagger
 * /leads/{id}/interests:
 *   get:
 *     summary: Listar interesses do lead
 *     tags: [Leads]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Lista de interesses do lead
 */
router.get('/:id/interests', rateLimiter.general, LeadController.getInterests);

/**
 * @swagger
 * /leads/{id}/interests:
 *   post:
 *     summary: Adicionar interesses ao lead
 *     tags: [Leads]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - interests
 *             properties:
 *               interests:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - name
 *                   properties:
 *                     name:
 *                       type: string
 *                       minLength: 1
 *                       maxLength: 100
 *                     category:
 *                       type: string
 *                       enum: [product, service, industry, technology, other]
 *                       default: other
 *                 example: 
 *                   - name: "Cloud Computing"
 *                     category: "technology"
 *                   - name: "ERP"
 *                     category: "product"
 *     responses:
 *       200:
 *         description: Interesses adicionados com sucesso
 */
router.post('/:id/interests', rateLimiter.general, LeadController.addInterests);

/**
 * @swagger
 * /leads/{leadId}/interests/{interestId}:
 *   delete:
 *     summary: Remover interesse do lead
 *     tags: [Leads]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: leadId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: interestId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Interesse removido com sucesso
 */
router.delete('/:leadId/interests/:interestId', rateLimiter.general, LeadController.removeInterest);

// ==========================================
// 📊 ROTA DE ESTATÍSTICAS
// ==========================================

/**
 * @swagger
 * /leads/stats:
 *   get:
 *     summary: Obter estatísticas de leads
 *     tags: [Leads]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Estatísticas dos leads da empresa
 */
router.get('/stats', rateLimiter.general, LeadController.stats);

// ==========================================
// 🗑️ ROTA DE DELETE
// ==========================================

/**
 * @swagger
 * /leads/{id}:
 *   delete:
 *     summary: Deletar lead (soft delete)
 *     tags: [Leads]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/AcceptLanguage'
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Lead deletado com sucesso
 */
router.delete('/:id', rateLimiter.general, LeadController.destroy);

module.exports = router;