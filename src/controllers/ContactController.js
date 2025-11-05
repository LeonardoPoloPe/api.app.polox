/**
 * ==========================================
 * 👥 CONTACT CONTROLLER - UNIFIED IDENTITY
 * ==========================================
 *
 * Gestão unificada de contatos (Leads + Clientes)
 * Arquitetura: "Identidade vs. Intenção"
 * - Identidade (Contact): QUEM a pessoa é
 * - Intenção (Deal): O QUE a pessoa quer comprar
 *
 * Features:
 * - CRUD completo de contatos
 * - Find-or-Restore: busca por phone/email/document
 * - Conversão de Lead → Cliente (manual ou automática via Deal.markAsWon)
 * - Sistema de tags e interesses
 * - Soft delete (exclusão lógica)
 */

const Contact = require("../models/Contact");
const Deal = require("../models/Deal");
const {
  ApiError,
  asyncHandler,
  ValidationError,
  NotFoundError,
} = require("../utils/errors");
const { successResponse, paginatedResponse } = require("../utils/response");
const { tc } = require("../config/i18n");
const { auditLogger } = require("../utils/logger");
const Joi = require("joi");

class ContactController {
  /**
   * 📝 VALIDAÇÕES JOI
   */
  static createContactSchema = Joi.object({
    nome: Joi.string().min(2).max(255).required(),
    email: Joi.string().email().allow(null, ""),
    phone: Joi.string().max(20).allow(null, ""),
    document: Joi.string().max(20).allow(null, ""),
    tipo: Joi.string().valid("lead", "cliente").default("lead"),
    origem: Joi.string().max(100).allow(null),
    tags: Joi.array().items(Joi.string()).default([]),
    interests: Joi.array().items(Joi.number().integer().positive()).default([]),
    metadata: Joi.object().default({}),
    address: Joi.string().allow(null),
    city: Joi.string().allow(null),
    state: Joi.string().allow(null),
    zip_code: Joi.string().allow(null),
    owner_id: Joi.number().integer().allow(null),
  }).or("email", "phone", "document");

  static updateContactSchema = Joi.object({
    nome: Joi.string().min(2).max(255),
    email: Joi.string().email().allow(null, ""),
    phone: Joi.string().max(20).allow(null, ""),
    document: Joi.string().max(20).allow(null, ""),
    tipo: Joi.string().valid("lead", "cliente"),
    origem: Joi.string().max(100).allow(null),
    tags: Joi.array().items(Joi.string()),
    interests: Joi.array().items(Joi.number().integer().positive()),
    metadata: Joi.object(),
    address: Joi.string().allow(null),
    city: Joi.string().allow(null),
    state: Joi.string().allow(null),
    zip_code: Joi.string().allow(null),
    owner_id: Joi.number().integer().allow(null),
    lifetime_value_cents: Joi.number().integer().min(0),
  });

  /**
   * 📋 Listar contatos com filtros
   * GET /api/contacts
   */
  static list = asyncHandler(async (req, res) => {
    const companyId = req.user.companyId;
    const {
      tipo,
      origem,
      owner_id,
      search,
      tags,
      sort_by,
      sort_order,
      limit = 50,
      offset = 0,
    } = req.query;

    const filters = {
      tipo,
      origem,
      owner_id: owner_id ? parseInt(owner_id) : undefined,
      search,
      tags: tags ? (Array.isArray(tags) ? tags : [tags]) : undefined,
      sort_by,
      sort_order,
      limit: parseInt(limit),
      offset: parseInt(offset),
    };

    const contacts = await Contact.list(companyId, filters);
    const total = await Contact.count(companyId, {
      tipo,
      origem,
      owner_id,
      search,
      tags,
    });

    return paginatedResponse(
      res,
      contacts,
      {
        page: Math.floor(parseInt(offset) / parseInt(limit)) + 1,
        totalPages: Math.ceil(total / parseInt(limit)),
        totalItems: total,
        limit: parseInt(limit),
        hasNextPage: parseInt(offset) + parseInt(limit) < total,
        hasPreviousPage: parseInt(offset) > 0,
      },
      tc(req, "contactController", "list.success")
    );
  });

  /**
   * 🔍 Buscar contato por ID
   * GET /api/contacts/:id
   */
  static show = asyncHandler(async (req, res) => {
    const companyId = req.user.companyId;
    const { id } = req.params;

    const contact = await Contact.findById(id, companyId);

    if (!contact) {
      throw new NotFoundError(tc(req, "contactController", "show.not_found"));
    }

    return successResponse(
      res,
      contact,
      tc(req, "contactController", "show.success")
    );
  });

  /**
   * ➕ Criar novo contato
   * POST /api/contacts
   */
  static create = asyncHandler(async (req, res) => {
    const companyId = req.user.companyId;
    const userId = req.user.id;

    // Validação
    const { error, value } = ContactController.createContactSchema.va;
    lidate(req.body, {
      abortEarly: false,
    });

    if (error) {
      const messages = error.details.map((d) => d.message).join(", ");
      throw new ValidationError(messages);
    }

    // Auto-preencher owner_id com o usuário autenticado se não fornecido
    if (!value.owner_id) {
      value.owner_id = userId;
    }

    // Criar contato
    const contact = await Contact.create(companyId, value);

    // Audit log
    auditLogger("contact_created", {
      userId,
      companyId,
      resourceType: "contact",
      resourceId: contact.id,
      changes: value,
    });

    return successResponse(
      res,
      contact,
      tc(req, "contactController", "create.success"),
      201
    );
  });

  /**
   * ✏️ Atualizar contato
   * PUT /api/contacts/:id
   */
  static update = asyncHandler(async (req, res) => {
    const companyId = req.user.companyId;
    const userId = req.user.id;
    const { id } = req.params;

    // Validação
    const { error, value } = ContactController.updateContactSchema.validate(
      req.body,
      {
        abortEarly: false,
      }
    );

    if (error) {
      const messages = error.details.map((d) => d.message).join(", ");
      throw new ValidationError(messages);
    }

    const contact = await Contact.update(id, companyId, value);

    // Audit log
    auditLogger.log({
      action: tc(req, "contactController", "audit.contact_updated"),
      userId,
      companyId,
      resourceType: "contact",
      resourceId: id,
      changes: value,
    });

    return successResponse(
      res,
      contact,
      tc(req, "contactController", "update.success")
    );
  });

  /**
   * 🗑️ Excluir contato (soft delete)
   * DELETE /api/contacts/:id
   */
  static delete = asyncHandler(async (req, res) => {
    const companyId = req.user.companyId;
    const userId = req.user.id;
    const { id } = req.params;

    await Contact.softDelete(id, companyId);

    // Audit log
    auditLogger.log({
      action: tc(req, "contactController", "audit.contact_deleted"),
      userId,
      companyId,
      resourceType: "contact",
      resourceId: id,
    });

    return successResponse(
      res,
      null,
      tc(req, "contactController", "delete.success")
    );
  });

  /**
   * 🔄 Converter Lead → Cliente (manual)
   * POST /api/contacts/:id/convert
   */
  static convertToClient = asyncHandler(async (req, res) => {
    const companyId = req.user.companyId;
    const userId = req.user.id;
    const { id } = req.params;

    // Buscar contato
    const contact = await Contact.findById(id, companyId);

    if (!contact) {
      throw new NotFoundError(
        tc(req, "contactController", "convert.not_found")
      );
    }

    if (contact.tipo === "cliente") {
      throw new ValidationError(
        tc(req, "contactController", "convert.already_client")
      );
    }

    // Converter
    const updated = await Contact.convertToClient(id, companyId);

    // Audit log
    auditLogger.log({
      action: tc(req, "contactController", "audit.lead_converted"),
      userId,
      companyId,
      resourceType: "contact",
      resourceId: id,
    });

    return successResponse(
      res,
      updated,
      tc(req, "contactController", "convert.success")
    );
  });

  /**
   * 🔎 Get-or-Create (WhatsApp Extension)
   * POST /api/contacts/get-or-create
   *
   * Find-or-Restore: busca por phone/email/document
   * - Se encontrar ativo: retorna
   * - Se encontrar deletado: restaura e retorna
   * - Se não encontrar: cria novo
   */
  static getOrCreate = asyncHandler(async (req, res) => {
    const companyId = req.user.companyId;
    const userId = req.user.id;
    const { phone, email, document, nome } = req.body;

    if (!phone && !email && !document) {
      throw new ValidationError(
        tc(req, "contactController", "validation.email_or_phone_required")
      );
    }

    const result = await Contact.getOrCreate(companyId, {
      phone,
      email,
      document,
      nome,
    });

    // Audit log apenas se criou novo
    if (result.created) {
      auditLogger.log({
        action: tc(req, "contactController", "audit.contact_created"),
        userId,
        companyId,
        resourceType: "contact",
        resourceId: result.contact.id,
      });
    } else if (result.restored) {
      auditLogger.log({
        action: tc(req, "contactController", "audit.contact_restored"),
        userId,
        companyId,
        resourceType: "contact",
        resourceId: result.contact.id,
      });
    }

    const messageKey = result.created
      ? "get_or_create.created"
      : result.restored
      ? "get_or_create.restored"
      : "get_or_create.found_existing";

    res.json({
      success: true,
      message: tc(req, "contactController", messageKey),
      data: result.contact,
      created: result.created,
      restored: result.restored,
    });
  });

  /**
   * � ENDPOINT CRÍTICO: Get-or-Create WITH NEGOTIATION
   * POST /api/contacts/get-or-create-with-negotiation
   *
   * ⭐ Este é o CORAÇÃO da solução para a Extensão WhatsApp + Landing Pages
   *
   * COMPORTAMENTO:
   * 1. Busca contato existente por phone/email/document (prioridade: phone)
   * 2. Se NÃO encontrar: Cria novo contato como 'lead'
   * 3. Se encontrar deletado: Restaura o contato (soft delete)
   * 4. SEMPRE cria uma NOVA negociação para esse contato
   *
   * RESOLVE O PROBLEMA:
   * - Cliente que virou lead de novo? ✅ Cria nova negociação
   * - Múltiplos deals por contato? ✅ Suportado nativamente
   * - Duplicidade? ✅ Constraints do banco impedem (Migration 036)
   * - Extensão WhatsApp? ✅ 1 telefone = 1 contato sempre
   *
   * REFERÊNCIA: docs/atividade/alteracao.md (Passo 2.3)
   */
  static getOrCreateWithNegotiation = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const companyId = req.user.companyId;

    // Validação: phone OU email obrigatório
    const {
      phone,
      email,
      document,
      nome,
      origem_lp,
      valor_estimado,
      deal_title,
      deal_stage,
    } = req.body;

    if (!phone && !email && !document) {
      throw new ValidationError(
        tc(
          req,
          "contactController",
          "get_or_create_with_deal.phone_or_email_required"
        )
      );
    }

    // Se for criar contato novo, nome é obrigatório
    if (!nome) {
      throw new ValidationError(
        tc(req, "contactController", "get_or_create_with_deal.name_required")
      );
    }

    // ====================================================================
    // PASSO 1: BUSCAR OU CRIAR CONTATO (Find-or-Restore)
    // ====================================================================
    const contactResult = await Contact.getOrCreate(companyId, {
      phone,
      email,
      document,
      nome,
      tipo: "lead", // Sempre nasce como lead
      origem: origem_lp || "api",
      owner_id: userId, // O vendedor que criou/processou
    });

    const contact = contactResult.contact;
    const contactAction = contactResult.created
      ? "created"
      : contactResult.restored
      ? "restored"
      : "found";

    // ====================================================================
    // PASSO 2: CRIAR NOVA NEGOCIAÇÃO (SEMPRE)
    // ====================================================================
    // Este é o "pulo do gato": mesmo se o contato já existir,
    // criamos uma NOVA negociação. Isso permite:
    // - Cliente comprar novamente
    // - Lead entrar em contato várias vezes
    // - Múltiplas oportunidades simultâneas
    const dealData = {
      company_id: companyId,
      contato_id: contact.id,
      owner_id: userId, // Quem criou a oportunidade
      titulo: deal_title || `Negociação de ${nome} (${origem_lp || "Novo"})`,
      origem: origem_lp || "api",
      valor_total_cents: valor_estimado ? parseInt(valor_estimado) : 0,
      etapa_funil: deal_stage || "novo",
      probabilidade: 25, // 25% para novos leads
    };

    const deal = await Deal.create(dealData);

    // ====================================================================
    // PASSO 3: AUDIT LOG
    // ====================================================================
    if (contactResult.created) {
      auditLogger.log({
        action: tc(req, "contactController", "audit.contact_created"),
        userId,
        companyId,
        resourceType: "contact",
        resourceId: contact.id,
        metadata: { source: "get-or-create-with-negotiation" },
      });
    } else if (contactResult.restored) {
      auditLogger.log({
        action: tc(req, "contactController", "audit.contact_restored"),
        userId,
        companyId,
        resourceType: "contact",
        resourceId: contact.id,
        metadata: { source: "get-or-create-with-negotiation" },
      });
    }

    auditLogger.log({
      action: tc(req, "dealController", "audit.deal_created"),
      userId,
      companyId,
      resourceType: "deal",
      resourceId: deal.id,
      metadata: {
        contato_id: contact.id,
        source: "get-or-create-with-negotiation",
      },
    });

    // ====================================================================
    // PASSO 4: RESPOSTA
    // ====================================================================
    res.status(contactResult.created ? 201 : 200).json({
      success: true,
      message: tc(req, "contactController", "get_or_create_with_deal.success"),
      data: {
        contact: {
          id: contact.id,
          name: contact.name,
          phone: contact.phone,
          email: contact.email,
          tipo: contact.tipo,
          action: contactAction, // 'created', 'found', 'restored'
        },
        deal: {
          id: deal.id,
          titulo: deal.titulo,
          etapa_funil: deal.etapa_funil,
          valor_total_cents: deal.valor_total_cents,
          origem: deal.origem,
        },
      },
      meta: {
        contact_action: contactAction,
        contact_message: tc(
          req,
          "contactController",
          `get_or_create_with_deal.contact_${contactAction}`
        ),
        deal_message: tc(
          req,
          "contactController",
          "get_or_create_with_deal.deal_created"
        ),
      },
    });
  });

  /**
   * � Buscar contato por phone/email/document
   * GET /api/contacts/search
   *
   * Para a Extensão WhatsApp buscar rapidamente um contato
   */
  static searchContact = asyncHandler(async (req, res) => {
    const companyId = req.user.companyId;
    const { phone, email, document } = req.query;

    if (!phone && !email && !document) {
      throw new ValidationError(
        tc(
          req,
          "contactController",
          "get_or_create_with_deal.phone_or_email_required"
        )
      );
    }

    // Buscar contato por qualquer dos identificadores
    const contact = await Contact.findByIdentifier(companyId, {
      phone,
      email,
      document,
    });

    if (!contact) {
      return res.json({
        success: true,
        found: false,
        message: tc(req, "contactController", "show.not_found"),
        data: null,
      });
    }

    res.json({
      success: true,
      found: true,
      message: tc(req, "contactController", "get_or_create.found_existing"),
      data: contact,
    });
  });

  /**
   * �📊 Estatísticas de contatos
   * GET /api/contacts/stats
   */
  static getStats = asyncHandler(async (req, res) => {
    const companyId = req.user.companyId;
    const { owner_id, origem } = req.query;

    const stats = await Contact.getStats(companyId, {
      owner_id: owner_id ? parseInt(owner_id) : undefined,
      origem,
    });

    return successResponse(
      res,
      stats,
      tc(req, "contactController", "stats.success")
    );
  });
}

module.exports = ContactController;
