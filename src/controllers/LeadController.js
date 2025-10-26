/**
 * ==========================================
 * 📈 LEAD CONTROLLER - CRM CORE (ATUALIZADO)
 * ==========================================
 *
 * Gestão completa de leads/prospects para pipeline de vendas
 * - CRUD completo de leads
 * - Gerenciamento de notas, tags e interests
 * - Conversão automática para clientes
 * - Sistema de gamificação integrado
 * - Filtros avançados e relatórios
 */

const LeadModel = require("../models/Lead");
const { logger, auditLogger } = require("../utils/logger");
const { ApiError, asyncHandler } = require("../utils/errors");
const { successResponse, paginatedResponse } = require("../utils/response");
const { tc } = require("../config/i18n");
const Joi = require("joi");

class LeadController {
  /**
   * 🌐 Valida dados com mensagens traduzidas
   */
  static validateWithTranslation(req, schema, data) {
    const { error, value } = schema.validate(data);
    if (error) {
      const field = error.details[0].path[0];
      const type = error.details[0].type;
      
      const errorKeyMap = {
        'string.min': 'validation.name_min_length',
        'any.required': field === 'name' ? 'validation.name_required' :
                       field === 'content' ? 'validation.content_required' :
                       field === 'tags' ? 'validation.tags_required' :
                       field === 'interests' ? 'validation.interests_required' :
                       field === 'owner_id' ? 'validation.owner_id_required' :
                       'validation.field_required',
        'string.email': 'validation.email_valid',
      };

      const messageKey = errorKeyMap[type] || 'validation.invalid_field';
      throw new ApiError(400, tc(req, "leadController", messageKey));
    }
    return value;
  }

  /**
   * 📝 VALIDAÇÕES JOI
   */
  static createLeadSchema = Joi.object({
    name: Joi.string().min(2).max(255).required(),
    email: Joi.string().email().allow(null),
    phone: Joi.string().max(20).allow(null),
    // Aceitar tanto company quanto company_name
    company_name: Joi.string().max(255).allow(null),
    company: Joi.string().max(255).allow(null),
    position: Joi.string().max(100).allow(null),
    source: Joi.string().max(50).allow(null),
    status: Joi.string()
      .valid(
        "new",
        "contacted",
        "qualified",
        "proposal",
        "negotiation",
        "won",
        "lost"
      )
      .default("new"),
    score: Joi.number().integer().min(0).max(100).allow(null),
    // Aceitar tanto value quanto conversion_value
    conversion_value: Joi.number().min(0).allow(null),
    value: Joi.number().min(0).allow(null),
    temperature: Joi.string().valid("cold", "warm", "hot").allow(null),
    city: Joi.string().max(100).allow(null),
    state: Joi.string().max(2).allow(null),
    country: Joi.string().max(100).allow(null),
    owner_id: Joi.number().integer().positive().allow(null),
    // Campos relacionados
    note: Joi.string().max(5000).allow(null),
    description: Joi.string().max(5000).allow(null), // Aceitar description como note
    tags: Joi.array().items(Joi.string().min(1).max(100)).default([]),
    interests: Joi.array()
      .items(
        Joi.object({
          name: Joi.string().min(1).max(100).required(),
          category: Joi.string()
            .valid("product", "service", "industry", "technology", "other")
            .default("other"),
        })
      )
      .default([]),
  }).unknown(true); // Permite campos não definidos no schema, incluindo custom_fields

  static updateLeadSchema = Joi.object({
    name: Joi.string().min(2).max(255),
    email: Joi.string().email().allow(null),
    phone: Joi.string().max(20).allow(null),
    company_name: Joi.string().max(255).allow(null),
    position: Joi.string().max(100).allow(null),
    source: Joi.string().max(50).allow(null),
    status: Joi.string().valid(
      "new",
      "contacted",
      "qualified",
      "proposal",
      "negotiation",
      "won",
      "lost"
    ),
    score: Joi.number().integer().min(0).max(100).allow(null),
    temperature: Joi.string().valid("cold", "warm", "hot").allow(null),
    city: Joi.string().max(100).allow(null),
    state: Joi.string().max(2).allow(null),
    country: Joi.string().max(100).allow(null),
    conversion_value: Joi.number().min(0).allow(null),
    owner_id: Joi.number().integer().positive().allow(null),
  });

  static assignLeadSchema = Joi.object({
    owner_id: Joi.number().integer().positive().required(),
  });

  static addNoteSchema = Joi.object({
    content: Joi.string().min(1).max(5000).required(),
    type: Joi.string()
      .valid("general", "call", "meeting", "email", "whatsapp", "other")
      .default("general"),
  });

  static updateNoteSchema = Joi.object({
    content: Joi.string().min(1).max(5000).required(),
  });

  static addTagsSchema = Joi.object({
    tags: Joi.array().items(Joi.string().min(1).max(100)).min(1).required(),
  });

  static addInterestsSchema = Joi.object({
    interests: Joi.array()
      .items(
        Joi.object({
          name: Joi.string().min(1).max(100).required(),
          category: Joi.string()
            .valid("product", "service", "industry", "technology", "other")
            .default("other"),
        })
      )
      .min(1)
      .required(),
  });

  /**
   * 📋 LISTAR LEADS
   * GET /api/leads
   */
  static index = asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);

    const options = {
      page,
      limit,
      status: req.query.status,
      source: req.query.source,
      ownerId: req.query.assigned_to || req.query.owner_id, // Support both parameter names
      minScore: req.query.value_min || req.query.score_min, // Support both parameter names
      maxScore: req.query.value_max || req.query.score_max, // Support both parameter names
      temperature: req.query.temperature,
      search: req.query.search,
      sortBy: req.query.sort || "created_at",
      sortOrder: req.query.order || "desc",
    };

    const result = await LeadModel.list(options, req.user.companyId);

    auditLogger(tc(req, "leadController", "audit.leads_listed"), {
      userId: req.user.id,
      companyId: req.user.companyId,
      filters: options,
    });

    return paginatedResponse(
      res,
      result.leads,
      result.pagination,
      tc(req, "leadController", "list.success"),
      {
        stats: result.stats,
      }
    );
  });

  /**
   * ➕ CRIAR LEAD
   * POST /api/leads
   */
  static create = asyncHandler(async (req, res) => {
    const value = LeadController.validateWithTranslation(
      req,
      LeadController.createLeadSchema,
      req.body
    );

    const { note, description, tags, interests, ...leadData } = value;

    // Mapear campos alternativos para os nomes corretos do banco
    if (leadData.company && !leadData.company_name) {
      leadData.company_name = leadData.company;
      delete leadData.company;
    }

    if (leadData.value && !leadData.conversion_value) {
      leadData.conversion_value = leadData.value;
      delete leadData.value;
    }

    // Usar description como note se note não foi fornecida
    const noteContent = note || description;

    // Adicionar created_by_id
    leadData.created_by_id = req.user.id;

    // Criar o lead
    const lead = await LeadModel.create(leadData, req.user.companyId);

    // Adicionar nota inicial se fornecida
    if (noteContent) {
      await LeadModel.addNote(
        lead.id,
        req.user.id,
        noteContent,
        "general",
        req.user.companyId
      );
    }

    // Adicionar tags se fornecidas
    if (tags && tags.length > 0) {
      await LeadModel.updateTags(lead.id, tags, req.user.companyId);
    }

    // Adicionar interests se fornecidos
    if (interests && interests.length > 0) {
      for (const interest of interests) {
        await LeadModel.addInterest(
          lead.id,
          interest.name,
          interest.category || "other",
          req.user.companyId
        );
      }
    }

    // Buscar lead completo com relacionamentos
    const fullLead = await LeadModel.findById(lead.id, req.user.companyId);

    auditLogger(tc(req, "leadController", "audit.lead_created"), {
      userId: req.user.id,
      companyId: req.user.companyId,
      leadId: lead.id,
    });

    return successResponse(res, fullLead, tc(req, "leadController", "create.success"), 201);
  });

  /**
   * 👁️ DETALHES DO LEAD
   * GET /api/leads/:id
   */
  static show = asyncHandler(async (req, res) => {
    const leadId = parseInt(req.params.id);

    const lead = await LeadModel.findById(leadId, req.user.companyId);

    if (!lead) {
      throw new ApiError(404, tc(req, "leadController", "show.not_found"));
    }

    return successResponse(res, lead);
  });

  /**
   * ✏️ ATUALIZAR LEAD
   * PUT /api/leads/:id
   */
  static update = asyncHandler(async (req, res) => {
    const leadId = parseInt(req.params.id);
    const value = LeadController.validateWithTranslation(
      req,
      LeadController.updateLeadSchema,
      req.body
    );

    const updatedLead = await LeadModel.update(
      leadId,
      value,
      req.user.companyId
    );

    if (!updatedLead) {
      throw new ApiError(404, tc(req, "leadController", "update.not_found"));
    }

    auditLogger(tc(req, "leadController", "audit.lead_updated"), {
      userId: req.user.id,
      companyId: req.user.companyId,
      leadId,
      changes: value,
    });

    return successResponse(res, updatedLead, tc(req, "leadController", "update.success"));
  });

  /**
   * 🗑️ DELETAR LEAD (SOFT DELETE)
   * DELETE /api/leads/:id
   */
  static destroy = asyncHandler(async (req, res) => {
    const leadId = parseInt(req.params.id);

    const deleted = await LeadModel.softDelete(leadId, req.user.companyId);

    if (!deleted) {
      throw new ApiError(404, tc(req, "leadController", "delete.not_found"));
    }

    auditLogger(tc(req, "leadController", "audit.lead_deleted"), {
      userId: req.user.id,
      companyId: req.user.companyId,
      leadId,
    });

    return successResponse(res, null, tc(req, "leadController", "delete.success"));
  });

  /**
   * 👤 ATRIBUIR LEAD A USUÁRIO
   * PUT /api/leads/:id/assign
   */
  static assignTo = asyncHandler(async (req, res) => {
    const leadId = parseInt(req.params.id);
    const value = LeadController.validateWithTranslation(
      req,
      LeadController.assignLeadSchema,
      req.body
    );

    const updatedLead = await LeadModel.update(
      leadId,
      { owner_id: value.owner_id },
      req.user.companyId
    );

    if (!updatedLead) {
      throw new ApiError(404, tc(req, "leadController", "assign.not_found"));
    }

    auditLogger(tc(req, "leadController", "audit.lead_assigned"), {
      userId: req.user.id,
      companyId: req.user.companyId,
      leadId,
      assignedTo: value.owner_id,
    });

    return successResponse(res, updatedLead, tc(req, "leadController", "assign.success"));
  });

  /**
   * 📊 ESTATÍSTICAS DE LEADS
   * GET /api/leads/stats
   */
  static stats = asyncHandler(async (req, res) => {
    const stats = await LeadModel.getStats(req.user.companyId);

    return successResponse(res, stats);
  });

  /**
   * 🔄 CONVERTER LEAD PARA CLIENTE
   * POST /api/leads/:id/convert
   */
  static convertToClient = asyncHandler(async (req, res) => {
    const leadId = parseInt(req.params.id);

    // Buscar lead
    const lead = await LeadModel.findById(leadId, req.user.companyId);

    if (!lead) {
      throw new ApiError(404, tc(req, "leadController", "convert.not_found"));
    }

    if (lead.converted_to_client_id) {
      throw new ApiError(400, tc(req, "leadController", "convert.already_converted"));
    }

    // Preparar dados do cliente
    const clientData = {
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
      company_name: lead.company_name,
      position: lead.position,
      city: lead.city,
      state: lead.state,
      country: lead.country,
      ...req.body, // Permite override/campos adicionais
    };

    const result = await LeadModel.convertToClient(
      leadId,
      clientData,
      req.user.companyId
    );

    auditLogger(tc(req, "leadController", "audit.lead_converted"), {
      userId: req.user.id,
      companyId: req.user.companyId,
      leadId,
      clientId: result.client.id,
    });

    return successResponse(
      res,
      result,
      tc(req, "leadController", "convert.success")
    );
  });

  // ==========================================
  // 📝 ENDPOINTS DE NOTAS
  // ==========================================

  /**
   * GET /api/leads/:id/notes - Listar notas do lead
   */
  static getNotes = asyncHandler(async (req, res) => {
    const leadId = parseInt(req.params.id);

    const notes = await LeadModel.getNotes(leadId, req.user.companyId);

    return successResponse(res, notes);
  });

  /**
   * POST /api/leads/:id/notes - Adicionar nota ao lead
   */
  static addNote = asyncHandler(async (req, res) => {
    const leadId = parseInt(req.params.id);
    const value = LeadController.validateWithTranslation(
      req,
      LeadController.addNoteSchema,
      req.body
    );

    const note = await LeadModel.addNote(
      leadId,
      req.user.id,
      value.content,
      value.type,
      req.user.companyId
    );

    auditLogger(tc(req, "leadController", "audit.note_added"), {
      userId: req.user.id,
      companyId: req.user.companyId,
      leadId,
      noteId: note.id,
    });

    return successResponse(res, note, tc(req, "leadController", "notes.add_success"), 201);
  });

  /**
   * PUT /api/leads/:leadId/notes/:noteId - Atualizar nota
   */
  static updateNote = asyncHandler(async (req, res) => {
    const noteId = parseInt(req.params.noteId);
    const value = LeadController.validateWithTranslation(
      req,
      LeadController.updateNoteSchema,
      req.body
    );

    const note = await LeadModel.updateNote(noteId, { content: value.content });

    if (!note) {
      throw new ApiError(404, tc(req, "leadController", "notes.not_found"));
    }

    auditLogger(tc(req, "leadController", "audit.note_updated"), {
      userId: req.user.id,
      noteId,
    });

    return successResponse(res, note, tc(req, "leadController", "notes.update_success"));
  });

  /**
   * DELETE /api/leads/:leadId/notes/:noteId - Deletar nota
   */
  static deleteNote = asyncHandler(async (req, res) => {
    const noteId = parseInt(req.params.noteId);

    const deleted = await LeadModel.deleteNote(noteId);

    if (!deleted) {
      throw new ApiError(404, tc(req, "leadController", "notes.not_found"));
    }

    auditLogger(tc(req, "leadController", "audit.note_deleted"), {
      userId: req.user.id,
      noteId,
    });

    return successResponse(res, null, tc(req, "leadController", "notes.delete_success"));
  });

  // ==========================================
  // 🏷️ ENDPOINTS DE TAGS
  // ==========================================

  /**
   * GET /api/leads/:id/tags - Listar tags do lead
   */
  static getTags = asyncHandler(async (req, res) => {
    const leadId = parseInt(req.params.id);

    const tags = await LeadModel.getTags(leadId, req.user.companyId);

    return successResponse(res, tags);
  });

  /**
   * POST /api/leads/:id/tags - Adicionar tags ao lead
   */
  static addTags = asyncHandler(async (req, res) => {
    const leadId = parseInt(req.params.id);
    const value = LeadController.validateWithTranslation(
      req,
      LeadController.addTagsSchema,
      req.body
    );

    // Buscar tags atuais
    const currentTags = await LeadModel.getTags(leadId, req.user.companyId);
    const currentTagNames = currentTags.map((t) => t.name);

    // Combinar com novas tags
    const allTags = [...new Set([...currentTagNames, ...value.tags])];

    // Atualizar
    const tags = await LeadModel.updateTags(
      leadId,
      allTags,
      req.user.companyId
    );

    auditLogger(tc(req, "leadController", "audit.tags_added"), {
      userId: req.user.id,
      companyId: req.user.companyId,
      leadId,
      tags: value.tags,
    });

    return successResponse(res, tags, tc(req, "leadController", "tags.add_success"));
  });

  /**
   * DELETE /api/leads/:leadId/tags/:tagId - Remover tag
   */
  static removeTag = asyncHandler(async (req, res) => {
    const leadId = parseInt(req.params.leadId);
    const tagId = parseInt(req.params.tagId);

    const removed = await LeadModel.removeTag(
      leadId,
      tagId,
      req.user.companyId
    );

    if (!removed) {
      throw new ApiError(404, tc(req, "leadController", "tags.not_found"));
    }

    auditLogger(tc(req, "leadController", "audit.tag_removed"), {
      userId: req.user.id,
      companyId: req.user.companyId,
      leadId,
      tagId,
    });

    return successResponse(res, null, tc(req, "leadController", "tags.remove_success"));
  });

  // ==========================================
  // 💡 ENDPOINTS DE INTERESTS
  // ==========================================

  /**
   * GET /api/leads/:id/interests - Listar interests do lead
   */
  static getInterests = asyncHandler(async (req, res) => {
    const leadId = parseInt(req.params.id);

    const interests = await LeadModel.getInterests(leadId, req.user.companyId);

    return successResponse(res, interests);
  });

  /**
   * POST /api/leads/:id/interests - Adicionar interests ao lead
   */
  static addInterests = asyncHandler(async (req, res) => {
    const leadId = parseInt(req.params.id);
    const value = LeadController.validateWithTranslation(
      req,
      LeadController.addInterestsSchema,
      req.body
    );

    const addedInterests = [];
    for (const interest of value.interests) {
      const added = await LeadModel.addInterest(
        leadId,
        interest.name,
        interest.category || "other",
        req.user.companyId
      );
      addedInterests.push(added);
    }

    auditLogger(tc(req, "leadController", "audit.interests_added"), {
      userId: req.user.id,
      companyId: req.user.companyId,
      leadId,
      interests: value.interests.map((i) => i.name),
    });

    return successResponse(
      res,
      addedInterests,
      tc(req, "leadController", "interests.add_success")
    );
  });

  /**
   * DELETE /api/leads/:leadId/interests/:interestId - Remover interest
   */
  static removeInterest = asyncHandler(async (req, res) => {
    const leadId = parseInt(req.params.leadId);
    const interestId = parseInt(req.params.interestId);

    const removed = await LeadModel.removeInterest(
      leadId,
      interestId,
      req.user.companyId
    );

    if (!removed) {
      throw new ApiError(404, tc(req, "leadController", "interests.not_found"));
    }

    auditLogger(tc(req, "leadController", "audit.interest_removed"), {
      userId: req.user.id,
      companyId: req.user.companyId,
      leadId,
      interestId,
    });

    return successResponse(res, null, tc(req, "leadController", "interests.remove_success"));
  });
}

module.exports = LeadController;
