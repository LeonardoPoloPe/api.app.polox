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
 * 🎫 TICKETS ROUTES - COPILOT_PROMPT_6
 * ==========================================
 * Rotas completas para sistema de tickets
 * ==========================================
 */

const express = require('express');
const router = express.Router();
const TicketController = require('../controllers/TicketController');
const { authenticateToken, authorize } = require('../utils/auth');

/**
 * @swagger
 * components:
 *   schemas:
 *     Ticket:
 *       type: object
 *       required:
 *         - title
 *         - description
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           description: ID único do ticket
 *         ticket_number:
 *           type: string
 *           description: Número do ticket
 *           example: "TK-2025-000001"
 *         title:
 *           type: string
 *           description: Título do ticket
 *           example: "Problema com login do sistema"
 *         description:
 *           type: string
 *           description: Descrição detalhada do problema
 *           example: "Usuário não consegue fazer login após alteração de senha"
 *         priority:
 *           type: string
 *           enum: [low, medium, high, urgent]
 *           description: Prioridade do ticket
 *         department:
 *           type: string
 *           description: Departamento responsável
 *           example: "support"
 *         status:
 *           type: string
 *           enum: [open, in_progress, pending, resolved, closed]
 *           description: Status atual do ticket
 *         customer_id:
 *           type: string
 *           format: uuid
 *           description: ID do cliente relacionado
 *         assigned_to:
 *           type: string
 *           format: uuid
 *           description: ID do usuário responsável
 *         tags:
 *           type: array
 *           items:
 *             type: string
 *           description: Tags do ticket
 *         source:
 *           type: string
 *           enum: [email, phone, chat, internal, web]
 *           description: Origem do ticket
 *         custom_fields:
 *           type: object
 *           description: Campos personalizados
 *         created_at:
 *           type: string
 *           format: date-time
 *         updated_at:
 *           type: string
 *           format: date-time
 *         resolved_at:
 *           type: string
 *           format: date-time
 * 
 *     TicketReply:
 *       type: object
 *       required:
 *         - message
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         message:
 *           type: string
 *           description: Conteúdo da resposta
 *           example: "Verificamos o problema e já foi solucionado"
 *         is_internal:
 *           type: boolean
 *           description: Se é uma resposta interna
 *           default: false
 *         user_id:
 *           type: string
 *           format: uuid
 *         created_at:
 *           type: string
 *           format: date-time
 * 
 *     TicketEscalation:
 *       type: object
 *       required:
 *         - reason
 *       properties:
 *         reason:
 *           type: string
 *           description: Motivo da escalação
 *           example: "Cliente VIP necessita atenção imediata"
 *         escalate_to:
 *           type: string
 *           format: uuid
 *           description: ID do usuário para escalar
 * 
 *     TicketStatusChange:
 *       type: object
 *       required:
 *         - status
 *       properties:
 *         status:
 *           type: string
 *           enum: [open, in_progress, pending, resolved, closed]
 *           description: Novo status do ticket
 *         reason:
 *           type: string
 *           description: Motivo da mudança de status
 * 
 *     TicketAssignment:
 *       type: object
 *       properties:
 *         assigned_to:
 *           type: string
 *           format: uuid
 *           description: ID do usuário para designar (null para remover)
 *         reason:
 *           type: string
 *           description: Motivo da designação
 * 
 *   parameters:
 *     TicketFilters:
 *       - name: page
 *         in: query
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Número da página
 *       - name: limit
 *         in: query
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *         description: Itens por página
 *       - name: search
 *         in: query
 *         schema:
 *           type: string
 *         description: Termo de busca
 *       - name: status
 *         in: query
 *         schema:
 *           type: string
 *           enum: [open, in_progress, pending, resolved, closed]
 *         description: Filtrar por status
 *       - name: priority
 *         in: query
 *         schema:
 *           type: string
 *           enum: [low, medium, high, urgent]
 *         description: Filtrar por prioridade
 *       - name: department
 *         in: query
 *         schema:
 *           type: string
 *         description: Filtrar por departamento
 *       - name: assigned_to
 *         in: query
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filtrar por responsável
 *       - name: created_by_me
 *         in: query
 *         schema:
 *           type: boolean
 *         description: Apenas tickets criados por mim
 *       - name: assigned_to_me
 *         in: query
 *         schema:
 *           type: boolean
 *         description: Apenas tickets designados para mim
 */

/**
 * @swagger
 * /api/tickets:
 *   get:
 *     summary: Listar tickets
 *     description: Retorna lista paginada de tickets com filtros avançados e estatísticas
 *     tags: [Tickets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/AcceptLanguage'
 *       - $ref: '#/components/parameters/TicketFilters'
 *     responses:
 *       200:
 *         description: Lista de tickets retornada com sucesso
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
 *                     allOf:
 *                       - $ref: '#/components/schemas/Ticket'
 *                       - type: object
 *                         properties:
 *                           reply_count:
 *                             type: integer
 *                           last_reply_at:
 *                             type: string
 *                             format: date-time
 *                           is_overdue:
 *                             type: boolean
 *                           created_by_name:
 *                             type: string
 *                           assigned_to_name:
 *                             type: string
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 *                 stats:
 *                   type: object
 *                   properties:
 *                     total_tickets:
 *                       type: integer
 *                     open_tickets:
 *                       type: integer
 *                     urgent_open:
 *                       type: integer
 *                     avg_resolution_hours:
 *                       type: number
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/', authenticateToken, TicketController.index);

/**
 * @swagger
 * /api/tickets:
 *   post:
 *     summary: Criar ticket
 *     description: Cria um novo ticket no sistema
 *     tags: [Tickets]
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
 *               - title
 *               - description
 *             properties:
 *               title:
 *                 type: string
 *                 example: "Problema com login do sistema"
 *               description:
 *                 type: string
 *                 example: "Usuário não consegue fazer login após alteração de senha"
 *               priority:
 *                 type: string
 *                 enum: [low, medium, high, urgent]
 *                 default: medium
 *               department:
 *                 type: string
 *                 example: "support"
 *                 default: support
 *               customer_id:
 *                 type: string
 *                 format: uuid
 *                 description: ID do cliente relacionado
 *               assigned_to:
 *                 type: string
 *                 format: uuid
 *                 description: ID do usuário responsável
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["login", "password", "urgent"]
 *               source:
 *                 type: string
 *                 enum: [email, phone, chat, internal, web]
 *                 default: internal
 *               custom_fields:
 *                 type: object
 *                 description: Campos personalizados
 *     responses:
 *       201:
 *         description: Ticket criado com sucesso
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
 *                   $ref: '#/components/schemas/Ticket'
 *                 gamification:
 *                   $ref: '#/components/schemas/GamificationReward'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         description: Cliente ou usuário designado não encontrado
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post('/', authenticateToken, authorize(['admin', 'manager', 'user']), TicketController.create);

/**
 * @swagger
 * /api/tickets/{id}:
 *   get:
 *     summary: Obter ticket
 *     description: Retorna detalhes completos de um ticket específico
 *     tags: [Tickets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/AcceptLanguage'
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID do ticket
 *     responses:
 *       200:
 *         description: Detalhes do ticket retornados com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   allOf:
 *                     - $ref: '#/components/schemas/Ticket'
 *                     - type: object
 *                       properties:
 *                         replies:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/TicketReply'
 *                         history:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               action_type:
 *                                 type: string
 *                               action_description:
 *                                 type: string
 *                               user_name:
 *                                 type: string
 *                               created_at:
 *                                 type: string
 *                                 format: date-time
 *                         created_by_name:
 *                           type: string
 *                         assigned_to_name:
 *                           type: string
 *                         customer_name:
 *                           type: string
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/:id', authenticateToken, TicketController.show);

/**
 * @swagger
 * /api/tickets/{id}:
 *   put:
 *     summary: Atualizar ticket
 *     description: Atualiza dados de um ticket existente
 *     tags: [Tickets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/AcceptLanguage'
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID do ticket
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               priority:
 *                 type: string
 *                 enum: [low, medium, high, urgent]
 *               department:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum: [open, in_progress, pending, resolved, closed]
 *               assigned_to:
 *                 type: string
 *                 format: uuid
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *               custom_fields:
 *                 type: object
 *     responses:
 *       200:
 *         description: Ticket atualizado com sucesso
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
 *                   $ref: '#/components/schemas/Ticket'
 *                 gamification:
 *                   $ref: '#/components/schemas/GamificationReward'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       403:
 *         description: Sem permissão para editar este ticket
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.put('/:id', authenticateToken, authorize(['admin', 'manager', 'user']), TicketController.update);

/**
 * @swagger
 * /api/tickets/{id}:
 *   delete:
 *     summary: Deletar ticket
 *     description: Remove um ticket do sistema (soft delete)
 *     tags: [Tickets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/AcceptLanguage'
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID do ticket
 *     responses:
 *       200:
 *         description: Ticket removido com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       400:
 *         description: Não é possível deletar tickets resolvidos/fechados
 *       403:
 *         description: Sem permissão para deletar este ticket
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.delete('/:id', authenticateToken, authorize(['admin', 'manager', 'user']), TicketController.destroy);

/**
 * @swagger
 * /api/tickets/{id}/replies:
 *   post:
 *     summary: Adicionar resposta
 *     description: Adiciona uma nova resposta ou comentário ao ticket
 *     tags: [Tickets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID do ticket
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - message
 *             properties:
 *               message:
 *                 type: string
 *                 example: "Verificamos o problema e já foi solucionado"
 *               is_internal:
 *                 type: boolean
 *                 description: Se é uma resposta interna (não visível ao cliente)
 *                 default: false
 *     responses:
 *       201:
 *         description: Resposta adicionada com sucesso
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
 *                   $ref: '#/components/schemas/TicketReply'
 *                 status_updated:
 *                   type: string
 *                   description: Novo status se foi alterado automaticamente
 *                 gamification:
 *                   $ref: '#/components/schemas/GamificationReward'
 *       400:
 *         description: Não é possível responder ticket fechado
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post('/:id/replies', authenticateToken, authorize(['admin', 'manager', 'user']), TicketController.addReply);

/**
 * @swagger
 * /api/tickets/{id}/escalate:
 *   put:
 *     summary: Escalar ticket
 *     description: Escala um ticket aumentando sua prioridade e reatribuindo
 *     tags: [Tickets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID do ticket
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TicketEscalation'
 *     responses:
 *       200:
 *         description: Ticket escalado com sucesso
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
 *                   allOf:
 *                     - $ref: '#/components/schemas/Ticket'
 *                     - type: object
 *                       properties:
 *                         escalation_reason:
 *                           type: string
 *                         old_priority:
 *                           type: string
 *                         new_priority:
 *                           type: string
 *       400:
 *         description: Não é possível escalar ticket resolvido/fechado
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.put('/:id/escalate', authenticateToken, authorize(['admin', 'manager', 'user']), TicketController.escalateTicket);

/**
 * @swagger
 * /api/tickets/{id}/status:
 *   put:
 *     summary: Alterar status
 *     description: Altera o status de um ticket
 *     tags: [Tickets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID do ticket
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TicketStatusChange'
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
 *                 message:
 *                   type: string
 *                 data:
 *                   $ref: '#/components/schemas/Ticket'
 *                 gamification:
 *                   $ref: '#/components/schemas/GamificationReward'
 *       400:
 *         description: Status inválido ou ticket já está neste status
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.put('/:id/status', authenticateToken, authorize(['admin', 'manager', 'user']), TicketController.changeStatus);

/**
 * @swagger
 * /api/tickets/{id}/assign:
 *   put:
 *     summary: Designar ticket
 *     description: Designa ou remove a designação de um ticket
 *     tags: [Tickets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID do ticket
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/TicketAssignment'
 *     responses:
 *       200:
 *         description: Designação alterada com sucesso
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
 *                     ticket_id:
 *                       type: string
 *                     assigned_to:
 *                       type: string
 *                     reason:
 *                       type: string
 *       404:
 *         description: Ticket ou usuário não encontrado
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.put('/:id/assign', authenticateToken, authorize(['admin', 'manager']), TicketController.assignTicket);

/**
 * @swagger
 * /api/tickets/reports:
 *   get:
 *     summary: Relatórios de tickets
 *     description: Gera relatórios detalhados sobre tickets
 *     tags: [Tickets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: report_type
 *         in: query
 *         required: true
 *         schema:
 *           type: string
 *           enum: [overview, performance]
 *         description: Tipo de relatório
 *       - name: period
 *         in: query
 *         schema:
 *           type: string
 *           enum: [week, month, quarter, year]
 *           default: month
 *         description: Período do relatório
 *     responses:
 *       200:
 *         description: Relatório gerado com sucesso
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
 *                     report_type:
 *                       type: string
 *                     period:
 *                       type: string
 *                     overview:
 *                       type: object
 *                       properties:
 *                         total_tickets:
 *                           type: integer
 *                         open_tickets:
 *                           type: integer
 *                         resolved_tickets:
 *                           type: integer
 *                         avg_resolution_hours:
 *                           type: number
 *                     by_department:
 *                       type: array
 *                       items:
 *                         type: object
 *                     user_performance:
 *                       type: array
 *                       items:
 *                         type: object
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/reports', authenticateToken, authorize(['admin', 'manager']), TicketController.getReports);

module.exports = router;