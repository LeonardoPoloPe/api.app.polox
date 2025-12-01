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

const Joi = require("joi");
const { v4: uuidv4 } = require("uuid");
const RouletteModel = require("../models/RouletteModel");
const ContactModel = require("../models/Contact");
const AuditLog = require("../models/AuditLog");
const { ValidationError, NotFoundError, ApiError } = require("../utils/errors");

// Base URL para links públicos da roleta
const BASE_URL =
  process.env.PUBLIC_BASE_URL ||
  process.env.BASE_URL ||
  "http://localhost:3000/public/roulette/";

/**
 * Gera um código único de resgate (8 caracteres alfanuméricos)
 */
function generateRedeemCode() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

class RouletteController {
  // =========================================================================
  // Admin/Company Endpoints (CRUD)
  // =========================================================================

  /**
   * @route GET /api/v1/roulette
   * @description Lista roletas da empresa
   * @access Private (qualquer usuário autenticado)
   */
  /**
   * @swagger
   * /roulette:
   *   get:
   *     tags:
   *       - Roulette
   *     summary: Lista roletas da empresa
   *     description: Retorna todas as roletas ativas da empresa logada, com contagem de prêmios.
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Lista de roletas
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
   *                         type: integer
   *                       roulette_name:
   *                         type: string
   *                       is_active:
   *                         type: boolean
   *                       prizes_count:
   *                         type: integer
   */
  static async listRoulettes(req, res, next) {
    try {
      const companyId = req.user.companyId;
      const roulettes = await RouletteModel.listRoulettes(companyId);
      res.status(200).json({ success: true, data: roulettes });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route GET /api/v1/roulette/:id
   * @description Detalhes da roleta + prêmios
   * @access Private (qualquer usuário autenticado)
   */
  /**
   * @swagger
   * /roulette/{id}:
   *   get:
   *     tags:
   *       - Roulette
   *     summary: Detalhes da roleta
   *     description: Retorna os dados completos da roleta e seus prêmios.
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *         description: ID da roleta
   *     responses:
   *       200:
   *         description: Detalhes da roleta
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
   *                     id:
   *                       type: integer
   *                     roulette_name:
   *                       type: string
   *                     prizes:
   *                       type: array
   *                       items:
   *                         type: object
   *       404:
   *         description: Roleta não encontrada
   */
  static async getRoulette(req, res, next) {
    try {
      const companyId = req.user.companyId;
      const id = parseInt(req.params.id);
      const roulette = await RouletteModel.getRouletteDetails(id, companyId);
      if (!roulette) {
        return res
          .status(404)
          .json({ success: false, message: "Roleta não encontrada." });
      }
      res.status(200).json({ success: true, data: roulette });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route PUT /api/v1/roulette/:id
   * @description Atualiza roleta e prêmios
   * @access Private (Admin)
   */
  /**
   * @swagger
   * /roulette/{id}:
   *   put:
   *     tags:
   *       - Roulette
   *     summary: Atualiza roleta e prêmios
   *     description: Atualiza os dados da roleta e substitui todos os prêmios.
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *         description: ID da roleta
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               rouletteData:
   *                 type: object
   *               prizes:
   *                 type: array
   *                 items:
   *                   type: object
   *     responses:
   *       200:
   *         description: Roleta atualizada
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
   *       400:
   *         description: Dados inválidos
   *       404:
   *         description: Roleta não encontrada
   */
  static async updateRoulette(req, res, next) {
    try {
      const companyId = req.user.companyId;
      const userId = req.user.id;
      const id = parseInt(req.params.id);

      // Validação Joi igual à criação
      const prizeSchema = Joi.object({
        prizeDescription: Joi.string().required().max(255),
        probabilityWeight: Joi.number().integer().min(1).required(),
        colorCode: Joi.string()
          .regex(/^#[0-9A-F]{6}$/i)
          .required(),
        prizeValue: Joi.number().min(0).default(0),
        prizeType: Joi.string()
          .valid(
            "discount_percent",
            "discount_fixed",
            "cashback_value",
            "free_shipping",
            "physical_item",
            "gift",
            "xp",
            "coin"
          )
          .default("discount_percent"),
        resendLinkUrl: Joi.string().uri().allow(null, "").optional(),
        redirectionType: Joi.string()
          .valid("url", "whatsapp", "in_app")
          .default("url"),
        quantityAvailable: Joi.number().integer().min(0).allow(null).optional(),
      });
      const schema = Joi.object({
        rouletteData: Joi.object({
          rouletteName: Joi.string().required().max(255),
          description: Joi.string().allow(null, "").optional(),
          maxSpins: Joi.number().integer().min(1).default(1),
          isSingleUse: Joi.boolean().default(false),
          customTitle: Joi.string().max(255).allow(null, "").optional(),
          buttonText: Joi.string().max(100).default("Rodar agora!"),
          generalColors: Joi.object().optional(),
          backgroundImageUrl: Joi.string().uri().allow(null, "").optional(),
          startDate: Joi.date().optional(),
          endDate: Joi.date().optional(),
          isActive: Joi.boolean().default(true),
        }).required(),
        prizes: Joi.array().min(2).items(prizeSchema).required(),
      });

      const { rouletteData, prizes } = await schema.validateAsync(req.body);

      // Atualiza roleta e prêmios
      const updatedRoulette = await RouletteModel.updateRoulette(
        id,
        companyId,
        rouletteData,
        prizes
      );

      // Log de auditoria
      await AuditLogModel.logUpdate(
        "roulette",
        id,
        rouletteData.rouletteName,
        updatedRoulette,
        userId,
        companyId
      );

      res.status(200).json({
        success: true,
        message: "Roleta atualizada com sucesso!",
        data: updatedRoulette,
      });
    } catch (error) {
      if (error.name === "ValidationError") {
        return res.status(400).json({ success: false, message: error.message });
      }
      next(error);
    }
  }
  // ...existing code...

  // =========================================================================
  // Admin/Company Endpoints (CRUD)
  // =========================================================================

  /**
   * @route POST /api/roulette
   * @description Cria uma nova roleta com seus prêmios, incluindo personalização e probabilidades.
   * @access Private (Admin/write permission)
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
   *                 ...
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
  static async createRoulette(req, res, next) {
    try {
      const companyId = req.user.companyId;
      const userId = req.user.id;

      console.log("📥 Recebendo requisição POST /api/v1/roulette", {
        body: req.body,
      });

      // 1. Validação de Schema Joi
      const prizeSchema = Joi.object({
        prizeDescription: Joi.string().required().max(255),
        probabilityWeight: Joi.number().integer().min(1).required(),
        colorCode: Joi.string()
          .regex(/^#[0-9A-F]{6}$/i)
          .required(),
        prizeValue: Joi.number().min(0).default(0),
        prizeType: Joi.string()
          .valid(
            "discount_percent",
            "discount_fixed",
            "cashback_value",
            "free_shipping",
            "physical_item",
            "gift",
            "xp",
            "coin"
          )
          .default("discount_percent"),
        resendLinkUrl: Joi.string().uri().allow(null, "").optional(),
        redirectionType: Joi.string()
          .valid("url", "whatsapp", "in_app")
          .default("url"),
        quantityAvailable: Joi.number().integer().min(0).allow(null).optional(),
      });
      const schema = Joi.object({
        rouletteData: Joi.object({
          // companyId REMOVIDO: sempre vem do token
          name: Joi.string().required().max(255),
          description: Joi.string().allow(null, "").optional(),
          maxSpins: Joi.number().integer().min(1).default(1),
          isSingleUse: Joi.boolean().default(false),
          customTitle: Joi.string().max(255).allow(null, "").optional(),
          buttonText: Joi.string().max(100).default("Rodar agora!"),
          generalColors: Joi.object().optional(),
          backgroundImageUrl: Joi.string().uri().allow(null, "").optional(),
          startDate: Joi.date().optional(),
          endDate: Joi.date().optional(),
          isActive: Joi.boolean().default(true),
        }).required(),
        prizes: Joi.array().min(2).items(prizeSchema).required(),
      });

      console.log("🔍 Validando schema Joi...");
      const { rouletteData, prizes } = await schema.validateAsync(req.body, {
        stripUnknown: true, // Remove campos não permitidos (ex: companyId)
      });
      console.log("✅ Schema validado:", {
        rouletteData,
        prizesCount: prizes.length,
      });

      // 2. Lógica de Criação (Chamada direta ao Model com transação atômica)
      const normalizedData = {
        companyId: companyId, // do token
        name: rouletteData.name,
        description: rouletteData.description,
        maxSpins: rouletteData.maxSpins,
        isSingleUse: rouletteData.isSingleUse,
        customTitle: rouletteData.customTitle,
        buttonText: rouletteData.buttonText,
        generalColors: rouletteData.generalColors,
        backgroundImageUrl: rouletteData.backgroundImageUrl,
        startDate: rouletteData.startDate,
        endDate: rouletteData.endDate,
        isActive: rouletteData.isActive,
      };

      console.log("💾 Criando roleta no banco de dados...", normalizedData);
      const newRoulette = await RouletteModel.createRoulette(
        normalizedData,
        prizes
      );
      console.log("✅ Roleta criada:", newRoulette);

      // 3. Log de Auditoria
      console.log("📝 Criando log de auditoria...");
      await AuditLog.create(
        {
          user_id: userId,
          action: "create",
          entity_type: "roulette",
          entity_id: newRoulette.id.toString(),
          description: `Roleta "${newRoulette.roulette_name}" criada com ${prizes.length} prêmios`,
        },
        companyId
      );

      console.log("✅ Retornando resposta 201");
      return res.status(201).json({
        success: true,
        message: "Roleta e prêmios criados com sucesso!",
        data: newRoulette,
      });
    } catch (error) {
      console.error("❌ Erro em createRoulette:", error);
      if (error.isJoi || error.name === "ValidationError") {
        return res.status(400).json({
          success: false,
          error: "Validation Error",
          message: error.details ? error.details[0].message : error.message,
        });
      }
      return res.status(500).json({
        success: false,
        error: "Internal Server Error",
        message: error.message,
      });
    }
  }

  /**
   * @route GET /api/roulette/generate-link/:rouletteId
   * @description Gera um link único (token) para envio da roleta por um vendedor.
   * @access Private (Vendedor)
   */
  static async generateRouletteLink(req, res, next) {
    try {
      const companyId = req.user.companyId;
      const vendorUserId = req.user.id;
      const rouletteId = req.params.rouletteId;
      const contactId = req.query.contactId
        ? parseInt(req.query.contactId)
        : null;

      const roulette = await RouletteModel.findRouletteById(
        rouletteId,
        companyId
      );
      if (!roulette || !roulette.is_active) {
        throw new NotFoundError("Roleta não encontrada ou inativa");
      }

      // Geração de token (UUID)
      const uniqueToken = uuidv4();

      // Log de Auditoria
      await AuditLog.create(
        {
          user_id: vendorUserId,
          action: "send",
          entity_type: "roulette_link",
          entity_id: rouletteId.toString(),
          description: `Link da roleta "${roulette.roulette_name}" enviado${
            contactId ? " para o contato ID " + contactId : " avulso"
          }`,
        },
        companyId
      );

      res.status(200).json({
        success: true,
        message: "Link de roleta gerado e pronto para envio.",
        data: {
          token: uniqueToken,
          full_link: `${BASE_URL}${uniqueToken}`,
          contact_id: contactId,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  // =========================================================================
  // PUBLIC ENDPOINTS (LÓGICA PÚBLICA)
  // =========================================================================

  /**
   * @description Resolve um token (Mock) para extrair IDs.
   */
  static async _resolveToken(token) {
    if (!token) throw new ApiError(400, "Token de roleta inválido.");

    // **MOCK DE RESOLUÇÃO DE TOKEN** // Em um sistema real, você faria a decodificação ou busca no DB/Redis aqui.
    return {
      rouletteId: 1,
      companyId: 1,
      vendorUserId: 10,
      contactId: null, // Mock para simular envio avulso
    };
  }

  /**
   * @description Algoritmo de Sorteio Ponderado.
   */
  static _performWeightedDraw(prizes) {
    const totalWeight = prizes.reduce(
      (sum, prize) => sum + prize.probability_weight,
      0
    );
    if (totalWeight <= 0) return null;
    let randomValue = Math.random() * totalWeight;

    for (const prize of prizes) {
      randomValue -= prize.probability_weight;
      if (randomValue <= 0) {
        return prize;
      }
    }
    return null;
  }

  /**
   * @route POST /public/roulette/:token/spin
   * @description Roda a roleta e registra a vitória.
   * @access Public
   */
  static async publicSpinRoulette(req, res, next) {
    try {
      const { token } = req.params;
      const contactDataSchema = Joi.object({
        nome: Joi.string().max(255).required(),
        email: Joi.string().email().allow(null, "").optional(),
        phone: Joi.string().allow(null, "").optional(),
      }).xor("email", "phone");

      const { contactData } = req.body;

      // 1. Resolve o Token (Controller faz isso agora)
      const { rouletteId, contactId, companyId, vendorUserId } =
        await RouletteController._resolveToken(token);
      let finalContactId = contactId;

      // 2. Tratamento de Leads Avulsos (Chamada direta ao Model)
      if (!finalContactId) {
        if (!contactData) {
          throw new ValidationError(
            "Dados de contato (nome e email/telefone) são obrigatórios para leads avulsos."
          );
        }
        const validatedContactData = await contactDataSchema.validateAsync(
          contactData
        );

        // Chamada direta ao Model para find/create
        const lead = await ContactModel.getOrCreate(
          companyId,
          validatedContactData
        );
        finalContactId = lead.id;
      }

      // 3. Validações de Uso (Limite de Spin)
      const roulette = await RouletteModel.findRouletteById(
        rouletteId,
        companyId
      );
      if (!roulette || !roulette.is_active) {
        throw new NotFoundError("Roleta não encontrada ou inativa");
      }
      const spinsCount = await RouletteModel.countSpinsByContact(
        rouletteId,
        finalContactId
      );
      if (spinsCount >= roulette.max_spins) {
        throw new ApiError(403, "Limite máximo de rodadas atingido.");
      }
      if (roulette.is_single_use && spinsCount > 0) {
        throw new ApiError(403, "Esta roleta permite apenas um uso.");
      }

      // 4. Sorteio (Lógica no Controller)
      const prizes = await RouletteModel.getPrizesByRouletteId(rouletteId);
      const prizeWon = RouletteController._performWeightedDraw(prizes);

      let redeemCode = null;
      if (prizeWon) {
        redeemCode = generateRedeemCode();
      }

      // 5. Registro da Rodada (History)
      const newSpin = await RouletteModel.createSpin({
        rouletteId: rouletteId,
        contactId: finalContactId,
        vendorUserId: vendorUserId,
        prizeId: prizeWon ? prizeWon.id : null,
        spinCount: spinsCount + 1,
        redeemCode: redeemCode,
      });
      // Não há Log de Auditoria aqui, pois a rota é pública.

      res.status(200).json({
        success: true,
        message: "Roleta rodada com sucesso! Código de resgate gerado.",
        data: {
          prize: prizeWon,
          redeem_code: redeemCode,
          spin_info: newSpin,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @route GET /public/roulette/claim/:redeemCode
   * @description Endpoint de resgate (conversão) que redireciona.
   * @access Public
   */
  static async publicClaimPrize(req, res, next) {
    try {
      const { redeemCode } = req.params;
      const claimedMethod = req.query.method || "url_redirect";

      if (!redeemCode) {
        throw new ApiError(400, "Código de resgate inválido.");
      }

      // 1. Busca e valida o histórico
      const spinHistory = await RouletteModel.findSpinByRedeemCode(redeemCode);
      if (!spinHistory) {
        throw new NotFoundError("Código de resgate inválido ou expirado.");
      }
      if (spinHistory.is_claimed) {
        return res.status(400).send("Este prêmio já foi resgatado.");
      }

      // 2. Atualiza o status para CLAIMED
      await RouletteModel.updateSpinToClaimed(spinHistory.id, claimedMethod);

      // 3. Busca o prêmio e a URL de redirecionamento
      const prizeArray = await RouletteModel.getPrizesByRouletteId(
        spinHistory.roulette_id
      );
      const prize = prizeArray.find((p) => p.id === spinHistory.prize_id);

      if (!prize) {
        // Mesmo se o prêmio não for encontrado, o resgate já foi marcado.
        throw new NotFoundError("Detalhes do prêmio não encontrados.");
      }

      const redirectionUrl =
        prize.resend_link_url || `${BASE_URL}resgate-sucesso`;

      // 4. Log de Auditoria (Ação de Conversão)
      await AuditLog.create(
        {
          user_id: spinHistory.vendor_user_id,
          action: "claim",
          entity_type: "roulette_prize",
          entity_id: spinHistory.prize_id.toString(),
          description: `Prêmio "${prize.prize_description}" resgatado (Código: ${redeemCode}, Contato ID: ${spinHistory.contact_id})`,
        },
        spinHistory.company_id
      );

      // 5. Redireciona o cliente (Conversão)
      return res.redirect(redirectionUrl);
    } catch (error) {
      if (error instanceof ApiError || error instanceof NotFoundError) {
        return res
          .status(error.statusCode)
          .send(`Erro ao resgatar: ${error.message}`);
      }
      next(error);
    }
  }
}

module.exports = RouletteController;
