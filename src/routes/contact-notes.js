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
 * 📝 ROTAS DE ANOTAÇÕES - HISTÓRICO UNIFICADO
 * ==========================================
 * 
 * Sistema unificado de histórico de interações
 * Substitui: lead_notes + client_notes → contact_notes
 * Tabela: polox.contact_notes
 */

const express = require('express');
const ContactNoteController = require('../controllers/ContactNoteController');
const { authenticateToken } = require('../middleware/auth');
const { rateLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// 🔐 Middleware obrigatório: autenticação
router.use(authenticateToken);

/**
 * @swagger
 * /notes:
 *   get:
 *     summary: Listar todas as anotações
 *     description: Lista anotações de todos os contatos com filtros
 *     tags: [Contact Notes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/AcceptLanguage'
 *       - in: query
 *         name: contato_id
 *         schema:
 *           type: integer
 *         description: Filtrar por contato
 *       - in: query
 *         name: tipo
 *         schema:
 *           type: string
 *           enum: [nota, ligacao, email, reuniao, whatsapp]
 *         description: Filtrar por tipo de interação
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Buscar no conteúdo das anotações
 *       - in: query
 *         name: sort_by
 *         schema:
 *           type: string
 *           enum: [created_at, updated_at]
 *           default: created_at
 *       - in: query
 *         name: sort_order
 *         schema:
 *           type: string
 *           enum: [ASC, DESC]
 *           default: DESC
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *     responses:
 *       200:
 *         description: Lista de anotações
 */
router.get('/', ContactNoteController.list);

/**
 * @swagger
 * /notes/stats:
 *   get:
 *     summary: Estatísticas gerais de interações
 *     description: Estatísticas de todas as interações da empresa
 *     tags: [Contact Notes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/AcceptLanguage'
 *     responses:
 *       200:
 *         description: Estatísticas de interações
 */
router.get('/stats', ContactNoteController.getCompanyStats);

/**
 * @swagger
 * /notes/{id}:
 *   get:
 *     summary: Buscar anotação por ID
 *     description: Retorna detalhes completos de uma anotação
 *     tags: [Contact Notes]
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
 *         description: Detalhes da anotação
 *       404:
 *         description: Anotação não encontrada
 */
router.get('/:id', ContactNoteController.show);

/**
 * @swagger
 * /notes/{id}:
 *   put:
 *     summary: Atualizar anotação
 *     description: Atualiza conteúdo ou tipo de uma anotação
 *     tags: [Contact Notes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/AcceptLanguage'
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               content:
 *                 type: string
 *                 minLength: 3
 *               tipo:
 *                 type: string
 *                 enum: [nota, ligacao, email, reuniao, whatsapp]
 *               metadata:
 *                 type: object
 *     responses:
 *       200:
 *         description: Anotação atualizada
 *       404:
 *         description: Anotação não encontrada
 */
router.put('/:id', ContactNoteController.update);

/**
 * @swagger
 * /notes/{id}:
 *   delete:
 *     summary: Excluir anotação (soft delete)
 *     description: Exclusão lógica da anotação
 *     tags: [Contact Notes]
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
 *         description: Anotação excluída
 *       404:
 *         description: Anotação não encontrada
 */
router.delete('/:id', ContactNoteController.delete);

/**
 * @swagger
 * components:
 *   schemas:
 *     ContactNote:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         company_id:
 *           type: integer
 *         contato_id:
 *           type: integer
 *         user_id:
 *           type: integer
 *         content:
 *           type: string
 *         tipo:
 *           type: string
 *           enum: [nota, ligacao, email, reuniao, whatsapp]
 *           default: nota
 *         metadata:
 *           type: object
 *         contact_name:
 *           type: string
 *           description: Nome do contato (JOIN)
 *         user_name:
 *           type: string
 *           description: Nome do usuário que criou (JOIN)
 *         created_at:
 *           type: string
 *           format: date-time
 *         updated_at:
 *           type: string
 *           format: date-time
 */

module.exports = router;
