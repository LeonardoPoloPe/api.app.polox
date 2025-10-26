/**
 * ==========================================
 * 🔔 NOTIFICATIONS ROUTES - COPILOT_PROMPT_6
 * ==========================================
 * Rotas completas para sistema de notificações
 * ==========================================
 */

const express = require('express');
const router = express.Router();
const NotificationController = require('../controllers/NotificationController');
const { authenticateToken, authorize } = require('../utils/auth');

/**
 * @swagger
 * components:
 *   schemas:
 *     Notification:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         user_id:
 *           type: string
 *           format: uuid
 *         title:
 *           type: string
 *           maxLength: 200
 *         message:
 *           type: string
 *         type:
 *           type: string
 *           enum: [info, success, warning, error, system, promotion]
 *         priority:
 *           type: string
 *           enum: [low, medium, high, urgent]
 *           default: medium
 *         is_read:
 *           type: boolean
 *           default: false
 *         metadata:
 *           type: object
 *           description: Dados adicionais específicos da notificação
 *         created_at:
 *           type: string
 *           format: date-time
 *         read_at:
 *           type: string
 *           format: date-time
 * 
 *     CreateNotificationRequest:
 *       type: object
 *       required:
 *         - user_id
 *         - title
 *         - message
 *       properties:
 *         user_id:
 *           type: string
 *           format: uuid
 *           description: ID do usuário que receberá a notificação
 *         title:
 *           type: string
 *           maxLength: 200
 *           description: Título da notificação
 *         message:
 *           type: string
 *           description: Conteúdo da notificação
 *         type:
 *           type: string
 *           enum: [info, success, warning, error, system, promotion]
 *           default: info
 *           description: Tipo da notificação
 *         priority:
 *           type: string
 *           enum: [low, medium, high, urgent]
 *           default: medium
 *           description: Prioridade da notificação
 *         metadata:
 *           type: object
 *           description: Dados adicionais específicos da notificação
 *       example:
 *         user_id: "12345678-1234-1234-1234-123456789012"
 *         title: "Pedido processado"
 *         message: "Seu pedido #123 foi processado com sucesso"
 *         type: "success"
 *         priority: "medium"
 *         metadata:
 *           order_id: "123"
 *           amount: 199.99
 * 
 *     BulkNotificationRequest:
 *       type: object
 *       required:
 *         - user_ids
 *         - title
 *         - message
 *       properties:
 *         user_ids:
 *           type: array
 *           items:
 *             type: string
 *             format: uuid
 *           description: Lista de IDs de usuários que receberão a notificação
 *         title:
 *           type: string
 *           maxLength: 200
 *           description: Título da notificação
 *         message:
 *           type: string
 *           description: Conteúdo da notificação
 *         type:
 *           type: string
 *           enum: [info, success, warning, error, system, promotion]
 *           default: info
 *           description: Tipo da notificação
 *         priority:
 *           type: string
 *           enum: [low, medium, high, urgent]
 *           default: medium
 *           description: Prioridade da notificação
 *         metadata:
 *           type: object
 *           description: Dados adicionais específicos da notificação
 *       example:
 *         user_ids: ["12345678-1234-1234-1234-123456789012", "87654321-4321-4321-4321-210987654321"]
 *         title: "Promoção especial"
 *         message: "Aproveite 20% de desconto em todos os produtos até amanhã!"
 *         type: "promotion"
 *         priority: "medium"
 * 
 *     NotificationStats:
 *       type: object
 *       properties:
 *         total_notifications:
 *           type: integer
 *         unread_notifications:
 *           type: integer
 *         read_notifications:
 *           type: integer
 *         by_type:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               type:
 *                 type: string
 *               count:
 *                 type: integer
 *         by_priority:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               priority:
 *                 type: string
 *               count:
 *                 type: integer
 *         recent_activity:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               date:
 *                 type: string
 *                 format: date
 *               notifications_sent:
 *                 type: integer
 *               notifications_read:
 *                 type: integer
 */

/**
 * @swagger
 * /api/notifications:
 *   get:
 *     summary: Listar notificações
 *     description: Lista notificações do usuário com paginação e filtros
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/AcceptLanguage'
 *       - name: page
 *         in: query
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Página da listagem
 *       - name: limit
 *         in: query
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Limite de itens por página
 *       - name: is_read
 *         in: query
 *         schema:
 *           type: boolean
 *         description: Filtrar por status de leitura
 *       - name: type
 *         in: query
 *         schema:
 *           type: string
 *           enum: [info, success, warning, error, system, promotion]
 *         description: Filtrar por tipo de notificação
 *       - name: priority
 *         in: query
 *         schema:
 *           type: string
 *           enum: [low, medium, high, urgent]
 *         description: Filtrar por prioridade
 *     responses:
 *       200:
 *         description: Lista de notificações recuperada com sucesso
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
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Notification'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     total:
 *                       type: integer
 *                     total_pages:
 *                       type: integer
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/', authenticateToken, NotificationController.index);

/**
 * @swagger
 * /api/notifications:
 *   post:
 *     summary: Criar notificação
 *     description: Cria uma nova notificação para um usuário específico
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateNotificationRequest'
 *     responses:
 *       201:
 *         description: Notificação criada com sucesso
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
 *                   $ref: '#/components/schemas/Notification'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post('/', authenticateToken, authorize(['admin', 'manager']), NotificationController.create);

/**
 * @swagger
 * /api/notifications/bulk:
 *   post:
 *     summary: Criar notificações em massa
 *     description: Cria notificações para múltiplos usuários de uma vez
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/BulkNotificationRequest'
 *     responses:
 *       201:
 *         description: Notificações criadas com sucesso
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
 *                     created_count:
 *                       type: integer
 *                     notifications:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Notification'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
// router.post('/bulk', authenticateToken, authorize(['admin', 'manager']), NotificationController.createBulkNotifications);

/**
 * @swagger
 * /api/notifications/{id}/read:
 *   put:
 *     summary: Marcar como lida
 *     description: Marca uma notificação específica como lida
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID da notificação
 *     responses:
 *       200:
 *         description: Notificação marcada como lida com sucesso
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
 *                   $ref: '#/components/schemas/Notification'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         description: Notificação não encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.put('/:id/read', authenticateToken, NotificationController.markAsRead);

/**
 * @swagger
 * /api/notifications/bulk-read:
 *   put:
 *     summary: Marcar várias como lidas
 *     description: Marca múltiplas notificações como lidas de uma vez
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - notification_ids
 *             properties:
 *               notification_ids:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: uuid
 *                 description: Lista de IDs das notificações a serem marcadas como lidas
 *             example:
 *               notification_ids: ["12345678-1234-1234-1234-123456789012", "87654321-4321-4321-4321-210987654321"]
 *     responses:
 *       200:
 *         description: Notificações marcadas como lidas com sucesso
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
 *                     updated_count:
 *                       type: integer
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
// router.put('/bulk-read', authenticateToken, NotificationController.markMultipleAsRead);

/**
 * @swagger
 * /api/notifications/all-read:
 *   put:
 *     summary: Marcar todas como lidas
 *     description: Marca todas as notificações não lidas do usuário como lidas
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Todas as notificações marcadas como lidas com sucesso
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
 *                     updated_count:
 *                       type: integer
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.put('/all-read', authenticateToken, NotificationController.markAllAsRead);

/**
 * @swagger
 * /api/notifications/stats:
 *   get:
 *     summary: Estatísticas de notificações
 *     description: Retorna estatísticas detalhadas das notificações do usuário
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: period
 *         in: query
 *         schema:
 *           type: string
 *           enum: [week, month, quarter, year]
 *           default: month
 *         description: Período para análise das estatísticas
 *     responses:
 *       200:
 *         description: Estatísticas recuperadas com sucesso
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
 *                   $ref: '#/components/schemas/NotificationStats'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/stats', authenticateToken, NotificationController.getStats);

/**
 * @swagger
 * /api/notifications/cleanup:
 *   delete:
 *     summary: Limpeza de notificações
 *     description: Remove notificações antigas lidas (apenas admins)
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: days
 *         in: query
 *         schema:
 *           type: integer
 *           minimum: 7
 *           default: 30
 *         description: Remover notificações lidas com mais de X dias
 *     responses:
 *       200:
 *         description: Limpeza realizada com sucesso
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
 *                     deleted_count:
 *                       type: integer
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.delete('/cleanup', authenticateToken, authorize(['admin']), NotificationController.cleanupExpired);

/**
 * @swagger
 * /api/notifications/{id}:
 *   delete:
 *     summary: Remover notificação
 *     description: Remove uma notificação específica
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID da notificação a ser removida
 *     responses:
 *       200:
 *         description: Notificação removida com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         description: Notificação não encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.delete('/:id', authenticateToken, NotificationController.deleteNotification);

module.exports = router;