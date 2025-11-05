const express = require("express");
const ScheduleController = require("../controllers/ScheduleController");
const { authenticateToken } = require("../middleware/auth");

const router = express.Router();

// Middleware de autenticação para todas as rotas
router.use(authenticateToken);

/**
 * @swagger
 * components:
 *   schemas:
 *     ScheduleEvent:
 *       type: object
 *       required:
 *         - title
 *         - start_datetime
 *         - end_datetime
 *       properties:
 *         id:
 *           type: string
 *           description: ID único do evento
 *         title:
 *           type: string
 *           description: Título do evento
 *         description:
 *           type: string
 *           description: Descrição do evento
 *         start_datetime:
 *           type: string
 *           format: date-time
 *           description: Data e hora de início
 *         end_datetime:
 *           type: string
 *           format: date-time
 *           description: Data e hora de fim
 *         all_day:
 *           type: boolean
 *           description: Evento de dia inteiro
 *         event_type:
 *           type: string
 *           enum: [meeting, call, task, reminder, event, appointment]
 *           description: Tipo do evento
 *         priority:
 *           type: string
 *           enum: [low, medium, high, urgent]
 *           description: Prioridade do evento
 *         status:
 *           type: string
 *           enum: [scheduled, confirmed, in_progress, completed, cancelled, no_show]
 *           description: Status do evento
 *         location:
 *           type: string
 *           description: Local do evento
 *         virtual_meeting_url:
 *           type: string
 *           format: uri
 *           description: URL da reunião virtual
 *         contato_id:
 *           type: integer
 *           description: ID do contato relacionado (unificado)
 *         attendees:
 *           type: array
 *           items:
 *             type: string
 *           description: IDs dos participantes
 *         recurring:
 *           type: boolean
 *           description: Evento recorrente
 *         recurring_frequency:
 *           type: string
 *           enum: [daily, weekly, monthly, yearly]
 *         recurring_until:
 *           type: string
 *           format: date
 *         visibility:
 *           type: string
 *           enum: [public, private]
 *           description: Visibilidade do evento
 *         timezone:
 *           type: string
 *           description: Fuso horário do evento
 *           default: America/Sao_Paulo
 *         reminder_minutes:
 *           type: integer
 *           description: Minutos antes do evento para lembrete
 *         metadata:
 *           type: object
 *           description: Metadados adicionais
 *   tags:
 *     - name: Schedule
 *       description: Gestão de agenda e eventos
 */

/**
 * @swagger
 * /schedule/events:
 *   get:
 *     summary: Listar eventos da agenda
 *     tags: [Schedule]
 *     parameters:
 *       - $ref: '#/components/parameters/AcceptLanguage'
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Número da página
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Itens por página
 *       - in: query
 *         name: user_id
 *         schema:
 *           type: string
 *         description: Filtrar por usuário
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [meeting, call, task, reminder, event, appointment]
 *         description: Filtrar por tipo
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [scheduled, confirmed, in_progress, completed, cancelled, no_show]
 *         description: Filtrar por status
 *       - in: query
 *         name: priority
 *         schema:
 *           type: string
 *           enum: [low, medium, high, urgent]
 *         description: Filtrar por prioridade
 *       - in: query
 *         name: date_from
 *         schema:
 *           type: string
 *           format: date
 *         description: Data inicial
 *       - in: query
 *         name: date_to
 *         schema:
 *           type: string
 *           format: date
 *         description: Data final
 *       - in: query
 *         name: contato_id
 *         schema:
 *           type: integer
 *         description: Filtrar por contato (unificado)
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Buscar no título e descrição
 *     responses:
 *       200:
 *         description: Lista de eventos
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
 *                     $ref: '#/components/schemas/ScheduleEvent'
 *                 pagination:
 *                   type: object
 *                 stats:
 *                   type: object
 */
router.get("/events", ScheduleController.getEvents);

/**
 * @swagger
 * /schedule/events:
 *   post:
 *     summary: Criar evento na agenda
 *     tags: [Schedule]
 *     parameters:
 *       - $ref: '#/components/parameters/AcceptLanguage'
 *       - in: query
 *         name: check_conflicts
 *         schema:
 *           type: boolean
 *         description: Verificar conflitos de horário
 *       - in: query
 *         name: ignore_conflicts
 *         schema:
 *           type: boolean
 *         description: Ignorar conflitos detectados
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ScheduleEvent'
 *     responses:
 *       201:
 *         description: Evento criado com sucesso
 *       400:
 *         description: Dados inválidos
 *       409:
 *         description: Conflitos de horário detectados
 */
router.post("/events", ScheduleController.createEvent);

/**
 * @swagger
 * /schedule/calendar:
 *   get:
 *     summary: Visualização de calendário
 *     tags: [Schedule]
 *     parameters:
 *       - $ref: '#/components/parameters/AcceptLanguage'
 *       - in: query
 *         name: start_date
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *         description: Data de início do período
 *       - in: query
 *         name: end_date
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *         description: Data de fim do período
 *       - in: query
 *         name: view
 *         schema:
 *           type: string
 *           enum: [day, week, month, year]
 *         description: Tipo de visualização
 *     responses:
 *       200:
 *         description: Dados do calendário
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
 *                     view:
 *                       type: string
 *                     period:
 *                       type: object
 *                     events:
 *                       type: array
 *                     events_by_date:
 *                       type: object
 *                     events_by_week:
 *                       type: object
 *                     stats:
 *                       type: object
 */
// Rota de calendar view foi removida - use /events com filtros de data

/**
 * @swagger
 * /schedule/events/{id}:
 *   get:
 *     summary: Obter evento por ID
 *     tags: [Schedule]
 *     parameters:
 *       - $ref: '#/components/parameters/AcceptLanguage'
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do evento
 *     responses:
 *       200:
 *         description: Dados do evento
 *       404:
 *         description: Evento não encontrado
 *       403:
 *         description: Sem permissão para visualizar evento privado
 */
router.get("/events/:id", ScheduleController.show);

/**
 * @swagger
 * /schedule/events/{id}:
 *   put:
 *     summary: Atualizar evento
 *     tags: [Schedule]
 *     parameters:
 *       - $ref: '#/components/parameters/AcceptLanguage'
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do evento
 *       - in: query
 *         name: check_conflicts
 *         schema:
 *           type: boolean
 *         description: Verificar conflitos de horário
 *       - in: query
 *         name: ignore_conflicts
 *         schema:
 *           type: boolean
 *         description: Ignorar conflitos detectados
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ScheduleEvent'
 *     responses:
 *       200:
 *         description: Evento atualizado com sucesso
 *       404:
 *         description: Evento não encontrado
 *       403:
 *         description: Sem permissão para editar evento
 *       409:
 *         description: Conflitos de horário detectados
 */
router.put("/events/:id", ScheduleController.update);

/**
 * @swagger
 * /schedule/events/{id}:
 *   delete:
 *     summary: Deletar evento
 *     tags: [Schedule]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do evento
 *     responses:
 *       200:
 *         description: Evento deletado com sucesso
 *       404:
 *         description: Evento não encontrado
 *       403:
 *         description: Sem permissão para deletar evento
 */
router.delete("/events/:id", ScheduleController.delete);

/**
 * @swagger
 * /schedule/events/{id}/status:
 *   put:
 *     summary: Alterar status do evento
 *     tags: [Schedule]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do evento
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [scheduled, confirmed, in_progress, completed, cancelled, no_show]
 *                 description: Novo status do evento
 *               notes:
 *                 type: string
 *                 description: Observações sobre a mudança de status
 *     responses:
 *       200:
 *         description: Status atualizado com sucesso
 *       400:
 *         description: Status inválido
 *       404:
 *         description: Evento não encontrado
 */
router.put("/events/:id/status", ScheduleController.updateStatus);

/**
 * @swagger
 * /schedule/stats:
 *   get:
 *     summary: Estatísticas de eventos
 *     tags: [Schedule]
 *     parameters:
 *       - $ref: '#/components/parameters/AcceptLanguage'
 *       - in: query
 *         name: date_from
 *         schema:
 *           type: string
 *           format: date
 *         description: Data inicial para filtro
 *       - in: query
 *         name: date_to
 *         schema:
 *           type: string
 *           format: date
 *         description: Data final para filtro
 *     responses:
 *       200:
 *         description: Estatísticas dos eventos
 */
router.get("/stats", ScheduleController.getStats);

module.exports = router;
