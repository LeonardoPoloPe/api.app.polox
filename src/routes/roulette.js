// src/routes/roulette.js
const express = require("express");
const router = express.Router();
const RouletteController = require("../controllers/RouletteController");
const {
  authenticateToken,
  requireCompanyAdmin,
} = require("../middleware/auth");

// =========================================================================
// Rota de Admin (Requer autenticação e permissão de escrita)
// =========================================================================
/**
 * @swagger
 * tags:
 *   - name: Roulette
 *     description: Sistema de Roleta e Gamificação (Criação, Sorteio e Resgate de Prêmios)
 */

/**
 * @swagger
 * /roulette:
 *   post:
 *     tags:
 *       - Roulette
 *     summary: Cria uma nova roleta
 *     description: Cria uma nova roleta com prêmios, personalização e probabilidades.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               rouletteData:
 *                 type: object
 *                 description: Dados da roleta
 *               prizes:
 *                 type: array
 *                 items:
 *                   type: object
 *                   description: Dados de cada prêmio
 *           example:
 *             rouletteData:
 *               name: "Roleta Black Friday"
 *               description: "Roleta especial para promoções de Black Friday."
 *               maxSpins: 1
 *               isSingleUse: false
 *               customTitle: "Gire e Ganhe!"
 *               buttonText: "Rodar agora!"
 *               generalColors:
 *                 primary: "#8A2BE2"
 *                 secondary: "#4B0082"
 *                 background: "#FFFFFF"
 *               backgroundImageUrl: "https://example.com/imagem-roleta.png"
 *               startDate: "2025-11-28T00:00:00Z"
 *               endDate: "2025-12-01T23:59:59Z"
 *               isActive: true
 *             prizes:
 *               - prizeDescription: "10% de desconto"
 *                 prizeType: "discount_percent"
 *                 prizeValue: 10
 *                 colorCode: "#3498DB"
 *                 probabilityWeight: 30
 *                 quantityAvailable: 100
 *                 resendLinkUrl: "https://example.com/resgate/10"
 *                 redirectionType: "url"
 *               - prizeDescription: "Frete grátis"
 *                 prizeType: "free_shipping"
 *                 prizeValue: 0
 *                 colorCode: "#2ECC71"
 *                 probabilityWeight: 20
 *                 quantityAvailable: 50
 *                 resendLinkUrl: "https://example.com/resgate/frete"
 *                 redirectionType: "url"
 *               - prizeDescription: "Produto surpresa"
 *                 prizeType: "gift"
 *                 prizeValue: 0
 *                 colorCode: "#E74C3C"
 *                 probabilityWeight: 10
 *                 quantityAvailable: 10
 *                 resendLinkUrl: "https://example.com/resgate/surpresa"
 *                 redirectionType: "url"
 *     responses:
 *       201:
 *         description: Roleta criada com sucesso
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: "Roleta e prêmios criados com sucesso!"
 *               data:
 *                 id: 1
 *                 name: "Roleta Black Friday"
 *       400:
 *         description: Erro de validação
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               error: "Validation Error"
 *               message: "rouletteData.name is required"
 *       500:
 *         description: Erro interno do servidor
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               error: "Internal Server Error"
 *               message: "Mensagem de erro detalhada"
 */
// Listar roletas (GET /api/v1/roulette) e Criar roleta (POST /api/v1/roulette)
router
  .route("/")
  .get(authenticateToken, RouletteController.listRoulettes)
  .post(
    authenticateToken,
    requireCompanyAdmin,
    RouletteController.createRoulette
  );

// Detalhes da roleta (GET /api/v1/roulette/:id)
router
  .route("/:id")
  .get(authenticateToken, RouletteController.getRoulette)
  .put(
    authenticateToken,
    requireCompanyAdmin,
    RouletteController.updateRoulette
  );

// =========================================================================
// Rota de Vendedor (Geração de Link)
// =========================================================================
/**
 * @swagger
 * /roulette/generate-link/{rouletteId}:
 *   get:
 *     tags:
 *       - Roulette
 *     summary: "[VENDEDOR] Gera link único de roleta"
 *     description: "Gera um token único que pode ser enviado ao Lead via WhatsApp/Email."
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: rouletteId
 *         schema:
 *           type: integer
 *         required: true
 *         description: "ID da Roleta."
 *       - in: query
 *         name: contactId
 *         schema:
 *           type: integer
 *         required: false
 *         description: "Opcional. ID do contato (Lead) a ser pré-vinculado."
 *     responses:
 *       200:
 *         description: "Link gerado com sucesso."
 */
router
  .route("/generate-link/:rouletteId")
  .get(authenticateToken, RouletteController.generateRouletteLink); // Vendedor gera o link

// =========================================================================
// Rotas Públicas (Uso do Cliente Final)
// =========================================================================
/**
 * @swagger
 * /roulette/public/{token}/spin:
 *   post:
 *     tags:
 *       - Roulette
 *     summary: "[PÚBLICO] Roda a roleta (endpoint público)"
 *     description: "Executa o sorteio, verifica limites e registra o resultado no histórico."
 *     parameters:
 *       - in: path
 *         name: token
 *         schema:
 *           type: string
 *         required: true
 *         description: "Token de acesso único da roleta."
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               contactData:
 *                 type: object
 *                 description: "Dados do Lead (nome, email, phone) se o token for avulso."
 *                 example:
 *                   nome: "Novo Lead"
 *                   email: "novo@lead.com.br"
 *     responses:
 *       200:
 *         description: "Roleta rodada, prêmio sorteado e código de resgate retornado."
 */
router.route("/public/:token/spin").post(RouletteController.publicSpinRoulette); // O cliente roda a roleta

/**
 * @swagger
 * /roulette/public/claim/{redeemCode}:
 *   get:
 *     tags:
 *       - Roulette
 *     summary: "[PÚBLICO] Resgata o prêmio e redireciona (Conversão BI)"
 *     description: "Marca o prêmio como resgatado no banco de dados e redireciona para a URL configurada."
 *     parameters:
 *       - in: path
 *         name: redeemCode
 *         schema:
 *           type: string
 *         required: true
 *         description: "Código único do prêmio ganho."
 *     responses:
 *       302:
 *         description: "Redirecionamento para a URL de resgate."
 *       400:
 *         description: "Código já resgatado ou inválido."
 */
router
  .route("/public/claim/:redeemCode")
  .get(RouletteController.publicClaimPrize); // O cliente resgata e é redirecionado

module.exports = router;
