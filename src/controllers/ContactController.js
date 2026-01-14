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
const User = require("../models/User");

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
    status: Joi.string()
      .valid("novo", "em_contato", "qualificado", "perdido", "descartado")
      .default("novo"),
    loss_reason: Joi.string()
      .allow(null, "")
      .when("status", {
        is: Joi.string().valid("perdido", "descartado"),
        then: Joi.string().required().min(3).messages({
          "string.empty": "Motivo de perda/descarte é obrigatório",
          "any.required": "Motivo de perda/descarte é obrigatório",
          "string.min": "Motivo deve ter no mínimo 3 caracteres",
        }),
        otherwise: Joi.string().allow(null, ""),
      }),
    origem: Joi.string().max(100).allow(null),
    tags: Joi.array().items(Joi.string()).default([]),
    interests: Joi.array().items(Joi.number().integer().positive()).default([]),
    metadata: Joi.object().default({}),
    address: Joi.string().allow(null),
    city: Joi.string().allow(null),
    state: Joi.string().allow(null),
    zip_code: Joi.string().allow(null),
    owner_id: Joi.number().integer().allow(null),
    temperature: Joi.string().valid("frio", "morno", "quente").allow(null),
  }).or("email", "phone", "document");

  static updateContactSchema = Joi.object({
    nome: Joi.string().min(2).max(255),
    email: Joi.string().email().allow(null, ""),
    phone: Joi.string().max(20).allow(null, ""),
    document: Joi.string().max(20).allow(null, ""),
    tipo: Joi.string().valid("lead", "cliente"),
    status: Joi.string().valid(
      "novo",
      "em_contato",
      "qualificado",
      "perdido",
      "descartado"
    ),
    loss_reason: Joi.string()
      .allow(null, "")
      .when("status", {
        is: Joi.string().valid("perdido", "descartado"),
        then: Joi.string().required().min(3).messages({
          "string.empty": "Motivo de perda/descarte é obrigatório",
          "any.required": "Motivo de perda/descarte é obrigatório",
          "string.min": "Motivo deve ter no mínimo 3 caracteres",
        }),
        otherwise: Joi.string().allow(null, ""),
      }),
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
    temperature: Joi.string().valid("frio", "morno", "quente").allow(null),
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
      numerotelefone,
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
      numerotelefone,
      tags: tags ? (Array.isArray(tags) ? tags : [tags]) : undefined,
      sort_by,
      sort_order,
      limit: parseInt(limit),
      offset: parseInt(offset),
    };

    const contacts = await Contact.list(companyId, filters);
    const total = await Contact.count(companyId, {
      tipo,
      owner_id,
      numerotelefone,
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
   * 📋 Listar contatos simplificados (apenas campos essenciais)
   * GET /api/contacts/simplified
   */
  static getSimplifiedList = asyncHandler(async (req, res) => {
    // Usa company_id do token JWT automaticamente
    const companyId = req.user.companyId;
    const { tipo, owner_id, search, limit = 50, offset = 0 } = req.query;

    const filters = {
      tipo,
      owner_id: owner_id ? parseInt(owner_id) : undefined,
      search,
      sort_by: "created_at",
      sort_order: "DESC",
      limit: parseInt(limit),
      offset: parseInt(offset),
    };

    const contacts = await Contact.list(companyId, filters);
    const total = await Contact.count(companyId, {
      tipo,
      owner_id,
    });

    // Mapear para formato simplificado
    const simplifiedContacts = contacts.map((contact) => ({
      id: String(contact.id),
      company_id: String(contact.company_id),
      tipo: contact.tipo,
      nome: contact.nome,
    }));

    return paginatedResponse(
      res,
      simplifiedContacts,
      {
        page: Math.floor(parseInt(offset) / parseInt(limit)) + 1,
        totalPages: Math.ceil(total / parseInt(limit)),
        totalItems: total,
        limit: parseInt(limit),
        hasNextPage: parseInt(offset) + parseInt(limit) < total,
        hasPreviousPage: parseInt(offset) > 0,
      },
      tc(req, "contactController", "list.simplified_success")
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

    // Validação - stripUnknown: true remove campos não permitidos (ex: company_id)
    const { error, value } = ContactController.createContactSchema.validate(
      req.body,
      {
        abortEarly: false,
        stripUnknown: true,
      }
    );

    if (error) {
      const messages = error.details.map((d) => d.message).join(", ");
      throw new ValidationError(messages);
    }

    // Auto-preencher owner_id com o usuário autenticado se não fornecido
    if (!value.owner_id) {
      value.owner_id = userId;
    }

    // Mapear 'origem' para 'lead_source' (compatibilidade com banco de dados)
    if (value.origem !== undefined) {
      value.lead_source = value.origem;
      delete value.origem;
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

    // Validação - stripUnknown: true remove campos não permitidos (ex: company_id)
    const { error, value } = ContactController.updateContactSchema.validate(
      req.body,
      {
        abortEarly: false,
        stripUnknown: true,
      }
    );

    if (error) {
      const messages = error.details.map((d) => d.message).join(", ");
      throw new ValidationError(messages);
    }

    // Mapear 'origem' para 'lead_source' (compatibilidade com banco de dados)
    if (value.origem !== undefined) {
      value.lead_source = value.origem;
      delete value.origem;
    }

    const contact = await Contact.update(id, companyId, value);

    // Audit log
    auditLogger(tc(req, "contactController", "audit.contact_updated"), {
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
   * � Atualizar apenas o status do contato
   * PATCH /api/contacts/:id/status
   */
  static updateStatus = asyncHandler(async (req, res) => {
    const companyId = req.user.companyId;
    const userId = req.user.id;
    const { id } = req.params;
    const { status, loss_reason } = req.body;

    // Validação do status
    const validStatuses = [
      "novo",
      "em_contato",
      "qualificado",
      "perdido",
      "descartado",
    ];

    if (!status) {
      throw new ValidationError(
        tc(req, "contactController", "update_status.status_required")
      );
    }

    if (!validStatuses.includes(status)) {
      throw new ValidationError(
        tc(req, "contactController", "update_status.invalid_status", {
          valid: validStatuses.join(", "),
        })
      );
    }

    // Validar loss_reason quando status é perdido ou descartado
    if (
      ["perdido", "descartado"].includes(status) &&
      (!loss_reason || loss_reason.trim().length === 0)
    ) {
      throw new ValidationError(
        "Motivo de perda/descarte é obrigatório quando status = perdido ou descartado"
      );
    }

    // Verificar se contato existe
    const existingContact = await Contact.findById(id, companyId);
    if (!existingContact) {
      throw new NotFoundError(
        tc(req, "contactController", "update_status.not_found")
      );
    }

    // Atualizar status e loss_reason
    const updatedContact = await Contact.update(id, companyId, {
      status: status,
      loss_reason: loss_reason || null,
    });

    // Audit log
    auditLogger({
      action: tc(req, "contactController", "audit.status_updated"),
      userId,
      companyId,
      resourceType: "contact",
      resourceId: id,
      changes: {
        old_status: existingContact.status,
        new_status: status,
        loss_reason: loss_reason || null,
      },
    });

    return successResponse(
      res,
      updatedContact,
      tc(req, "contactController", "update_status.success")
    );
  });

  /**
   * �🗑️ Excluir contato (soft delete)
   * DELETE /api/contacts/:id
   */
  static delete = asyncHandler(async (req, res) => {
    const companyId = req.user.companyId;
    const userId = req.user.id;
    const { id } = req.params;

    await Contact.softDelete(id, companyId);

    // Audit log
    auditLogger(tc(req, "contactController", "audit.contact_deleted"), {
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
    auditLogger(tc(req, "contactController", "audit.lead_converted"), {
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
      auditLogger(tc(req, "contactController", "audit.contact_created"), {
        userId,
        companyId,
        resourceType: "contact",
        resourceId: result.contact.id,
      });
    } else if (result.restored) {
      auditLogger(tc(req, "contactController", "audit.contact_restored"), {
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
      lead_source: origem_lp || "api",
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
      contato_id: contact.id,
      owner_id: userId, // Quem criou a oportunidade
      titulo: deal_title || `Negociação de ${nome} (${origem_lp || "Novo"})`,
      origem: origem_lp || "api",
      valor_total_cents: valor_estimado ? parseInt(valor_estimado) : 0,
      etapa_funil: deal_stage || "novo",
      probabilidade: 25, // 25% para novos leads
    };

    const deal = await Deal.create(companyId, dealData);

    // ====================================================================
    // PASSO 3: AUDIT LOG
    // ====================================================================
    if (contactResult.created) {
      auditLogger(tc(req, "contactController", "audit.contact_created"), {
        userId,
        companyId,
        resourceType: "contact",
        resourceId: contact.id,
        metadata: { source: "get-or-create-with-negotiation" },
      });
    } else if (contactResult.restored) {
      auditLogger(tc(req, "contactController", "audit.contact_restored"), {
        userId,
        companyId,
        resourceType: "contact",
        resourceId: contact.id,
        metadata: { source: "get-or-create-with-negotiation" },
      });
    }

    auditLogger(tc(req, "dealController", "audit.deal_created"), {
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

    // Buscar contato por qualquer dos identificadores (prioridade: phone com variantes -> email -> document)
    let contact = null;
    if (phone) {
      contact = await Contact.findByPhoneVariants(companyId, phone);
    }

    if (!contact && email) {
      contact = await Contact.findMinimalByEmail(companyId, email);
    }

    if (!contact && document) {
      contact = await Contact.findMinimalByDocument(companyId, document);
    }

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
   * 🔍 AUTOCOMPLETE: Busca rápida de contatos (com paginação)
   * GET /api/contacts/autocomplete?q=nome&tipo=lead&limit=10&offset=0
   *
   * Busca otimizada para campos de autocomplete no frontend.
   * Pesquisa por nome, email ou telefone simultaneamente.
   *
   * Retorna: id, nome, email, phone, status, temperature com paginação
   */
  static autocomplete = asyncHandler(async (req, res) => {
    const companyId = req.user.companyId;
    const { q, tipo, limit = 10, offset = 0 } = req.query;

    // Validar parâmetro de busca
    if (!q || q.trim().length < 2) {
      throw new ValidationError(
        tc(req, "contactController", "autocomplete.query_too_short")
      );
    }

    const searchTerm = q.trim();
    const searchLimit = Math.min(parseInt(limit), 50); // Máximo 50 resultados
    const searchOffset = Math.max(parseInt(offset), 0); // Mínimo 0

    // Construir query otimizada - company_id já vem do token JWT
    const conditions = ["company_id = $1", "deleted_at IS NULL"];
    const params = [companyId];
    let paramIndex = 2;

    // Filtro por tipo (lead/cliente) se fornecido
    if (tipo && ["lead", "cliente"].includes(tipo)) {
      conditions.push(`tipo = $${paramIndex}`);
      params.push(tipo);
      paramIndex++;
    }

    // Busca em nome, email OU telefone
    // Remove caracteres especiais do telefone para busca
    const phoneDigits = searchTerm.replace(/\D/g, "");

    if (phoneDigits.length >= 8) {
      // Se parece com telefone (8+ dígitos), busca em todos os campos
      conditions.push(`(
        nome ILIKE $${paramIndex} OR
        email ILIKE $${paramIndex} OR
        phone LIKE $${paramIndex + 1}
      )`);
      params.push(`%${searchTerm}%`, `%${phoneDigits}%`);
      paramIndex += 2;
    } else {
      // Busca normal em nome e email
      conditions.push(`(
        nome ILIKE $${paramIndex} OR
        email ILIKE $${paramIndex}
      )`);
      params.push(`%${searchTerm}%`);
      paramIndex++;
    }

    // Query COUNT para paginação
    const countSql = `
      SELECT COUNT(*) as total
      FROM polox.contacts
      WHERE ${conditions.join(" AND ")}
    `;

    const countResult = await Contact.query(countSql, params);
    const total = parseInt(countResult.rows[0].total);

    // Query otimizada - apenas campos necessários
    const sql = `
      SELECT 
        id,
        nome,
        email,
        phone,
        status,
        temperature,
        tipo
      FROM polox.contacts
      WHERE ${conditions.join(" AND ")}
      ORDER BY 
        CASE 
          WHEN nome ILIKE $${paramIndex} THEN 1  -- Começa com o termo
          WHEN email ILIKE $${paramIndex} THEN 2
          ELSE 3
        END,
        nome ASC
      LIMIT $${paramIndex + 1}
      OFFSET $${paramIndex + 2}
    `;

    params.push(`${searchTerm}%`, searchLimit, searchOffset);

    const result = await Contact.query(sql, params);

    return paginatedResponse(
      res,
      result.rows,
      {
        page: Math.floor(searchOffset / searchLimit) + 1,
        totalPages: Math.ceil(total / searchLimit),
        totalItems: total,
        limit: searchLimit,
        hasNextPage: searchOffset + searchLimit < total,
        hasPreviousPage: searchOffset > 0,
      },
      tc(req, "contactController", "autocomplete.success")
    );
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

  /**
   * 📊 KANBAN: Resumo inicial (todas as raias)
   * GET /api/contacts/kanban/summary
   *
   * Retorna:
   * - Contagem total de cada raia
   * - Primeiros 10 leads de cada raia
   * - Perfeito para renderização inicial do Kanban
   */
  static getKanbanSummary = asyncHandler(async (req, res) => {
    const companyId = req.user.companyId;
    const { limit = 10, owner_id } = req.query;

    const ownerId = owner_id ? parseInt(owner_id) : null;
    const leadsPerLane = parseInt(limit);

    // Validar limite
    if (leadsPerLane < 1 || leadsPerLane > 50) {
      throw new ValidationError(
        tc(req, "contactController", "kanban.invalid_limit")
      );
    }

    const summary = await Contact.getKanbanSummary(
      companyId,
      leadsPerLane,
      ownerId
    );

    return successResponse(
      res,
      summary,
      tc(req, "contactController", "kanban.summary_success")
    );
  });

  /**
   * 📊 KANBAN: Atualizar posição do lead (drag & drop)
   * PATCH /api/contacts/:id/kanban-position
   *
   * Body: {
   *   status: "em_contato",
   *   targetContactId: 123,
   *   position: "after"  // ou "before"
   * }
   */
  static updateKanbanPosition = asyncHandler(async (req, res) => {
    const companyId = req.user.companyId;
    const userId = req.user.id;
    const { id } = req.params;
    const { status, targetContactId, position = "after" } = req.body;

    // Validações
    const validStatuses = [
      "novo",
      "em_contato",
      "qualificado",
      "proposta_enviada",
      "em_negociacao",
      "fechado",
      "perdido",
      "descartado",
    ];

    if (!status || !validStatuses.includes(status)) {
      throw new ValidationError(
        tc(req, "contactController", "kanban.invalid_status", {
          valid: validStatuses.join(", "),
        })
      );
    }

    if (position && !["before", "after"].includes(position)) {
      throw new ValidationError(
        tc(req, "contactController", "kanban.invalid_drop_position")
      );
    }

    // Atualizar posição (performance O(1) na maioria dos casos!)
    const updatedContact = await Contact.updateKanbanPosition(
      parseInt(id),
      companyId,
      status,
      targetContactId ? parseInt(targetContactId) : null,
      position || "after"
    );

    // Audit log
    auditLogger(tc(req, "contactController", "audit.kanban_updated"), {
      userId,
      companyId,
      resourceType: "contact",
      resourceId: id,
      changes: {
        new_status: status,
        target_contact_id: targetContactId,
        drop_position: position,
        new_kanban_position: updatedContact.kanban_position,
      },
    });

    return successResponse(
      res,
      updatedContact,
      tc(req, "contactController", "kanban.position_updated")
    );
  });

  /**
   * 📊 KANBAN: Carregar mais leads de uma raia específica
   * GET /api/contacts/kanban/status/:status
   *
   * Para o botão "Carregar mais" no final de cada raia
   * Exemplo: GET /contacts/kanban/status/novo?limit=10&offset=10
   */
  static getKanbanLaneLeads = asyncHandler(async (req, res) => {
    const companyId = req.user.companyId;
    const { status } = req.params;
    const { limit = 10, offset = 0, owner_id } = req.query;

    // Validar status
    const validStatuses = [
      "novo",
      "em_contato",
      "qualificado",
      "proposta_enviada",
      "em_negociacao",
      "fechado",
      "perdido",
      "descartado",
    ];

    if (!validStatuses.includes(status)) {
      throw new ValidationError(
        tc(req, "contactController", "kanban.invalid_status", {
          valid: validStatuses.join(", "),
        })
      );
    }

    // Validar limites
    const limitNum = parseInt(limit);
    const offsetNum = parseInt(offset);

    if (limitNum < 1 || limitNum > 50) {
      throw new ValidationError(
        tc(req, "contactController", "kanban.invalid_limit")
      );
    }

    if (offsetNum < 0) {
      throw new ValidationError(
        tc(req, "contactController", "kanban.invalid_offset")
      );
    }

    const ownerId = owner_id ? parseInt(owner_id) : null;

    const result = await Contact.getKanbanLaneLeads(
      companyId,
      status,
      limitNum,
      offsetNum,
      ownerId
    );

    return successResponse(
      res,
      result,
      tc(req, "contactController", "kanban.lane_success")
    );
  });

  /**
   * 🔍 Verificar duplicidade de contato (email/phone/document)
   * GET /api/contacts/check-duplicity?type=phone&value=5511999999999
   *
   * Resposta:
   * {
   *   "exists": true,
   *   "contact": {
   *      "id": 150,
   *      "name": "Danielle",
   *      "type": "cliente", // lead|cliente
   *      "status": "fechado",
   *      "owner_id": 5,
   *      "owner_name": "Leonardo Polo"
   *   }
   * }
   */
  static checkDuplicity = asyncHandler(async (req, res) => {
    const companyId = req.user.companyId; // Sempre do token (multi-tenant seguro)
    const { type, value } = req.query;

    // Validação simples
    const allowedTypes = ["phone", "email", "document"];
    if (!type || !allowedTypes.includes(type)) {
      throw new ValidationError(
        tc(req, "contactController", "duplicity.invalid_type", {
          valid: allowedTypes.join(", "),
        })
      );
    }
    if (!value || String(value).trim().length === 0) {
      throw new ValidationError(
        tc(req, "contactController", "duplicity.value_required")
      );
    }

    let contact = null;
    if (type === "phone") {
      contact = await Contact.findByPhoneVariants(companyId, value);
    } else if (type === "email") {
      contact = await Contact.findMinimalByEmail(companyId, value);
    } else if (type === "document") {
      contact = await Contact.findMinimalByDocument(companyId, value);
    }

    if (!contact) {
      return res.json({ exists: false, contact: null });
    }

    // Buscar nome do owner se disponível
    let ownerName = null;
    if (contact.owner_id) {
      try {
        const owner = await User.findById(contact.owner_id, companyId);
        if (owner) {
          ownerName = owner.name || owner.nome || owner.full_name || null;
        }
      } catch (e) {
        ownerName = null; // Silencia falha de owner
      }
    }

    return res.json({
      exists: true,
      contact: {
        id: contact.id,
        name: contact.name || contact.nome,
        type: contact.tipo,
        status: contact.status,
        owner_id: contact.owner_id || null,
        owner_name: ownerName,
      },
    });
  });
}

module.exports = ContactController;
