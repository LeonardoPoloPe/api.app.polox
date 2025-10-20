/**
 * ==========================================
 * 🎮 ROTAS DE GAMIFICAÇÃO
 * ==========================================
 */

const express = require('express');
const GamificationController = require('../controllers/GamificationController');
const { authenticateToken } = require('../middleware/auth');
const { rateLimiter } = require('../middleware/rateLimiter');
const { validateRequest } = require('../utils/validation');
const Joi = require('joi');

const router = express.Router();

// 🔐 Middleware obrigatório: autenticação
router.use(authenticateToken);

// 📝 Validações específicas
const awardPointsValidation = Joi.object({
  user_id: Joi.string().uuid().optional(),
  xp_amount: Joi.number().integer().min(0).max(10000).default(0),
  coin_amount: Joi.number().integer().min(0).max(10000).default(0),
  reason: Joi.string().min(1).max(255).required(),
  action_type: Joi.string().valid(
    'login', 'first_login', 'task_completed', 'sale_made', 'client_created',
    'lead_converted', 'level_up', 'achievement_unlocked', 'mission_completed',
    'bonus', 'admin_award', 'other'
  ).default('other')
});

const missionProgressValidation = Joi.object({
  progress_amount: Joi.number().integer().min(1).max(100).default(1)
});

/**
 * @swagger
 * /gamification/profile:
 *   get:
 *     summary: Perfil de gamificação do usuário
 *     description: Retorna XP, coins, nível, conquistas e posição no ranking
 *     tags: [Gamification]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Perfil de gamificação
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
 *                     user_name:
 *                       type: string
 *                     current_level:
 *                       type: integer
 *                     total_xp:
 *                       type: integer
 *                     current_coins:
 *                       type: integer
 *                     achievements_unlocked:
 *                       type: integer
 *                     level_info:
 *                       type: object
 *                       properties:
 *                         current_level:
 *                           type: integer
 *                         level_progress:
 *                           type: integer
 *                         xp_to_next_level:
 *                           type: integer
 *                     ranking:
 *                       type: object
 *                       properties:
 *                         current_rank:
 *                           type: integer
 *                         total_players:
 *                           type: integer
 */
router.get('/profile', rateLimiter.general, GamificationController.getProfile);

/**
 * @swagger
 * /gamification/award:
 *   post:
 *     summary: Conceder XP/Coins
 *     description: Concede pontos para usuário (admins podem conceder para outros)
 *     tags: [Gamification]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - reason
 *             properties:
 *               user_id:
 *                 type: string
 *                 format: uuid
 *                 description: ID do usuário (apenas para admins)
 *               xp_amount:
 *                 type: integer
 *                 minimum: 0
 *                 maximum: 10000
 *                 default: 0
 *               coin_amount:
 *                 type: integer
 *                 minimum: 0
 *                 maximum: 10000
 *                 default: 0
 *               reason:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 255
 *                 example: Tarefa completada com excelência
 *               action_type:
 *                 type: string
 *                 enum: [login, first_login, task_completed, sale_made, client_created, lead_converted, level_up, achievement_unlocked, mission_completed, bonus, admin_award, other]
 *                 default: other
 *     responses:
 *       200:
 *         description: Pontos concedidos com sucesso
 *       400:
 *         description: Dados inválidos
 *       403:
 *         description: Sem permissão para conceder pontos para outros usuários
 */
router.post('/award', rateLimiter.general, validateRequest(awardPointsValidation), GamificationController.awardPoints);

/**
 * @swagger
 * /gamification/missions:
 *   get:
 *     summary: Missões disponíveis
 *     description: Lista missões diárias, semanais, mensais e permanentes
 *     tags: [Gamification]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Missões disponíveis
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
 *                     missions:
 *                       type: object
 *                       properties:
 *                         daily:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/Mission'
 *                         weekly:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/Mission'
 *                         monthly:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/Mission'
 *                         one_time:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/Mission'
 *                     total_missions:
 *                       type: integer
 *                     completed_today:
 *                       type: integer
 */
router.get('/missions', rateLimiter.general, GamificationController.getMissions);

/**
 * @swagger
 * /gamification/missions/{id}/complete:
 *   post:
 *     summary: Completar/progredir missão
 *     description: Adiciona progresso para uma missão específica
 *     tags: [Gamification]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID da missão
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               progress_amount:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 100
 *                 default: 1
 *                 description: Quantidade de progresso a adicionar
 *     responses:
 *       200:
 *         description: Progresso atualizado ou missão completada
 *       400:
 *         description: Missão já completada ou dados inválidos
 *       404:
 *         description: Missão não encontrada
 */
router.post('/missions/:id/complete', rateLimiter.general, validateRequest(missionProgressValidation), GamificationController.completeMission);

/**
 * @swagger
 * /gamification/achievements:
 *   get:
 *     summary: Conquistas disponíveis
 *     description: Lista todas as conquistas da empresa com status de desbloqueio
 *     tags: [Gamification]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Filtrar por categoria
 *     responses:
 *       200:
 *         description: Lista de conquistas
 */
router.get('/achievements', rateLimiter.general, GamificationController.getAchievements);

/**
 * @swagger
 * /gamification/achievements/unlocked:
 *   get:
 *     summary: Conquistas desbloqueadas
 *     description: Lista conquistas que o usuário já desbloqueou
 *     tags: [Gamification]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Conquistas desbloqueadas
 */
router.get('/achievements/unlocked', rateLimiter.general, GamificationController.getUnlockedAchievements);

/**
 * @swagger
 * /gamification/rewards:
 *   get:
 *     summary: Loja de recompensas
 *     description: Lista recompensas disponíveis para compra com coins
 *     tags: [Gamification]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Filtrar por categoria
 *     responses:
 *       200:
 *         description: Recompensas disponíveis
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
 *                     rewards:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Reward'
 *                     user_balance:
 *                       type: integer
 *                       description: Saldo atual em coins
 */
router.get('/rewards', rateLimiter.general, GamificationController.getRewards);

/**
 * @swagger
 * /gamification/rewards/{id}/buy:
 *   post:
 *     summary: Comprar recompensa
 *     description: Compra uma recompensa usando coins
 *     tags: [Gamification]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID da recompensa
 *     responses:
 *       200:
 *         description: Recompensa comprada com sucesso
 *       400:
 *         description: Saldo insuficiente ou limite atingido
 *       404:
 *         description: Recompensa não encontrada
 */
router.post('/rewards/:id/buy', rateLimiter.general, GamificationController.buyReward);

/**
 * @swagger
 * /gamification/leaderboard:
 *   get:
 *     summary: Ranking da empresa
 *     description: Lista ranking de usuários por XP na empresa
 *     tags: [Gamification]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [all_time, monthly, weekly]
 *           default: all_time
 *         description: Período do ranking
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 50
 *         description: Número de usuários no ranking
 *     responses:
 *       200:
 *         description: Ranking da empresa
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
 *                     leaderboard:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           name:
 *                             type: string
 *                           current_level:
 *                             type: integer
 *                           total_xp:
 *                             type: integer
 *                           current_coins:
 *                             type: integer
 *                           achievements_count:
 *                             type: integer
 *                           rank:
 *                             type: integer
 *                     current_user_position:
 *                       type: object
 *                       properties:
 *                         rank:
 *                           type: integer
 *                         total_xp:
 *                           type: integer
 *                         current_level:
 *                           type: integer
 *                     period:
 *                       type: object
 *                       properties:
 *                         type:
 *                           type: string
 *                         name:
 *                           type: string
 *                     stats:
 *                       type: object
 *                       properties:
 *                         total_players:
 *                           type: integer
 *                         avg_xp:
 *                           type: integer
 *                         max_xp:
 *                           type: integer
 *                         avg_level:
 *                           type: integer
 *                         max_level:
 *                           type: integer
 */
router.get('/leaderboard', rateLimiter.general, GamificationController.getLeaderboard);

/**
 * @swagger
 * /gamification/history:
 *   get:
 *     summary: Histórico de pontos
 *     description: Histórico de XP e coins ganhos/gastos pelo usuário
 *     tags: [Gamification]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Página
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 100
 *         description: Items por página
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [xp, coins]
 *         description: Filtrar por tipo de ponto
 *     responses:
 *       200:
 *         description: Histórico de pontos
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
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       type:
 *                         type: string
 *                         enum: [xp, coins]
 *                       amount:
 *                         type: integer
 *                       reason:
 *                         type: string
 *                       action_type:
 *                         type: string
 *                       awarded_by_name:
 *                         type: string
 *                       created_at:
 *                         type: string
 *                         format: date-time
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 */
router.get('/history', rateLimiter.general, GamificationController.getHistory);

module.exports = router;