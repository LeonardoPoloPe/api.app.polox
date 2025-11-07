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
 *           minLength: 2
 *           maxLength: 255
 *           description: Título do evento
 *         description:
 *           type: string
 *           maxLength: 1000
 *           description: Descrição do evento
 *         start_datetime:
 *           type: string
 *           format: date-time
 *           description: Data e hora de início (ISO 8601)
 *         end_datetime:
 *           type: string
 *           format: date-time
 *           description: Data e hora de fim (ISO 8601, deve ser maior que start_datetime)
 *         is_all_day:
 *           type: boolean
 *           default: false
 *           description: Evento de dia inteiro
 *         event_type:
 *           type: string
 *           enum: [meeting, call, task, reminder, event, appointment]
 *           default: meeting
 *           description: Tipo do evento
 *         status:
 *           type: string
 *           enum: [scheduled, confirmed, in_progress, completed, cancelled, no_show]
 *           default: scheduled
 *           description: Status do evento
 *         event_location:
 *           type: string
 *           maxLength: 255
 *           description: Local físico do evento
 *         meeting_link:
 *           type: string
 *           format: uri
 *           description: URL da reunião virtual (Google Meet, Zoom, Teams, etc)
 *         contato_id:
 *           type: integer
 *           description: ID do contato relacionado (unificado - tabela contacts)
 *         timezone:
 *           type: string
 *           default: America/Sao_Paulo
 *           description: Fuso horário do evento
 *         reminder_minutes:
 *           type: integer
 *           minimum: 0
 *           default: 15
 *           description: Minutos antes do evento para lembrete (0 = sem lembrete)
 *         is_recurring:
 *           type: boolean
 *           default: false
 *           description: Indica se o evento é recorrente
 *         recurrence_pattern:
 *           type: object
 *           nullable: true
 *           description: Padrão de recorrência (objeto JSON livre)
 *           properties:
 *             frequency:
 *               type: string
 *               enum: [daily, weekly, monthly, yearly]
 *               description: Frequência da recorrência
 *             until:
 *               type: string
 *               format: date
 *               description: Data limite para recorrência
 *             interval:
 *               type: integer
 *               description: Intervalo (ex - a cada 2 semanas)
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
 *           examples:
 *             reuniao_simples:
 *               summary: Reunião Simples
 *               description: Exemplo básico de reunião com campos obrigatórios
 *               value:
 *                 title: "Reunião com Cliente"
 *                 description: "Discussão sobre o projeto Q4 2025"
 *                 start_datetime: "2025-11-05T14:00:00Z"
 *                 end_datetime: "2025-11-05T15:00:00Z"
 *                 event_type: "meeting"
 *                 contato_id: 16
 *             reuniao_virtual:
 *               summary: Reunião Virtual Completa
 *               description: Reunião online com link e lembretes
 *               value:
 *                 title: "Daily Standup - Time Dev"
 *                 description: "Reunião diária da equipe de desenvolvimento"
 *                 start_datetime: "2025-11-05T09:00:00Z"
 *                 end_datetime: "2025-11-05T09:30:00Z"
 *                 is_all_day: false
 *                 event_type: "meeting"
 *                 status: "scheduled"
 *                 event_location: "Online"
 *                 meeting_link: "https://meet.google.com/abc-defg-hij"
 *                 timezone: "America/Sao_Paulo"
 *                 reminder_minutes: 15
 *             ligacao:
 *               summary: Ligação Telefônica
 *               description: Exemplo de evento tipo ligação
 *               value:
 *                 title: "Ligação - Follow up Proposta"
 *                 description: "Ligar para cliente sobre proposta comercial"
 *                 start_datetime: "2025-11-06T10:00:00Z"
 *                 end_datetime: "2025-11-06T10:30:00Z"
 *                 event_type: "call"
 *                 status: "scheduled"
 *                 contato_id: 16
 *                 reminder_minutes: 30
 *             tarefa:
 *               summary: Tarefa/To-do
 *               description: Exemplo de tarefa a ser realizada
 *               value:
 *                 title: "Revisar contrato"
 *                 description: "Revisar e aprovar contrato do fornecedor XYZ"
 *                 start_datetime: "2025-11-07T08:00:00Z"
 *                 end_datetime: "2025-11-07T12:00:00Z"
 *                 event_type: "task"
 *                 status: "scheduled"
 *                 reminder_minutes: 60
 *             evento_dia_inteiro:
 *               summary: Evento Dia Inteiro
 *               description: Exemplo de evento que dura o dia todo
 *               value:
 *                 title: "Conferência Tech Summit 2025"
 *                 description: "Participação na conferência anual de tecnologia"
 *                 start_datetime: "2025-11-10T00:00:00Z"
 *                 end_datetime: "2025-11-10T23:59:59Z"
 *                 is_all_day: true
 *                 event_type: "event"
 *                 event_location: "Centro de Convenções SP"
 *                 reminder_minutes: 1440
 *             evento_recorrente:
 *               summary: Evento Recorrente
 *               description: Exemplo de evento que se repete (reunião semanal)
 *               value:
 *                 title: "Reunião Semanal - Planejamento"
 *                 description: "Reunião de planejamento toda segunda-feira"
 *                 start_datetime: "2025-11-11T09:00:00Z"
 *                 end_datetime: "2025-11-11T10:00:00Z"
 *                 event_type: "meeting"
 *                 status: "scheduled"
 *                 meeting_link: "https://zoom.us/j/123456789"
 *                 is_recurring: true
 *                 recurrence_pattern:
 *                   frequency: "weekly"
 *                   until: "2025-12-31"
 *                   interval: 1
 *                 reminder_minutes: 15
 *             sem_lembrete:
 *               summary: Evento Sem Lembrete
 *               description: Exemplo de evento sem notificação prévia
 *               value:
 *                 title: "Almoço Executivo"
 *                 start_datetime: "2025-11-08T12:00:00Z"
 *                 end_datetime: "2025-11-08T13:30:00Z"
 *                 event_type: "appointment"
 *                 event_location: "Restaurante Braz - Faria Lima"
 *                 reminder_minutes: 0
 *     responses:
 *       201:
 *         description: Evento criado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/ScheduleEvent'
 *                 message:
 *                   type: string
 *                   example: "Evento criado com sucesso"
 *       400:
 *         description: Dados inválidos
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "errors.validation_error"
 *                 error:
 *                   type: object
 *                   properties:
 *                     code:
 *                       type: string
 *                       example: "VALIDATION_ERROR"
 *                     message:
 *                       type: string
 *                       example: "\"end_datetime\" must be greater than \"ref:start_datetime\""
 *       409:
 *         description: Conflitos de horário detectados
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Conflitos de horário detectados"
 *                 conflicts:
 *                   type: array
 *                   items:
 *                     type: object
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
