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

const LeadModel = require('../models/Lead');
const { logger, auditLogger } = require('../utils/logger');
const { ApiError, asyncHandler } = require('../utils/errors');
const { successResponse, paginatedResponse } = require('../utils/formatters');
const Joi = require('joi');

class LeadController {

  /**
   * 📝 VALIDAÇÕES JOI
   */
  static createLeadSchema = Joi.object({
    name: Joi.string().min(2).max(255).required(),
    email: Joi.string().email().allow(null),
    phone: Joi.string().max(20).allow(null),
    company_name: Joi.string().max(255).allow(null),
    position: Joi.string().max(100).allow(null),
    source: Joi.string().max(50).allow(null),
    status: Joi.string().valid(
      'new', 'contacted', 'qualified', 'proposal', 'negotiation', 'won', 'lost'
    ).default('new'),
    score: Joi.number().integer().min(0).max(100).allow(null),
    temperature: Joi.string().valid('cold', 'warm', 'hot').allow(null),
    city: Joi.string().max(100).allow(null),
    state: Joi.string().max(2).allow(null),
    country: Joi.string().max(100).allow(null),
    conversion_value: Joi.number().min(0).allow(null),
    owner_id: Joi.number().integer().positive().allow(null),
    // Campos relacionados
    note: Joi.string().max(5000).allow(null),
    tags: Joi.array().items(Joi.string().min(1).max(100)).default([]),
    interests: Joi.array().items(
      Joi.object({
        name: Joi.string().min(1).max(100).required(),
        category: Joi.string().valid('product', 'service', 'industry', 'technology', 'other')
          .default('other')
      })
    ).default([])
  });

  static updateLeadSchema = Joi.object({
    name: Joi.string().min(2).max(255),
    email: Joi.string().email().allow(null),
    phone: Joi.string().max(20).allow(null),
    company_name: Joi.string().max(255).allow(null),
    position: Joi.string().max(100).allow(null),
    source: Joi.string().max(50).allow(null),
    status: Joi.string().valid(
      'new', 'contacted', 'qualified', 'proposal', 'negotiation', 'won', 'lost'
    ),
    score: Joi.number().integer().min(0).max(100).allow(null),
    temperature: Joi.string().valid('cold', 'warm', 'hot').allow(null),
    city: Joi.string().max(100).allow(null),
    state: Joi.string().max(2).allow(null),
    country: Joi.string().max(100).allow(null),
    conversion_value: Joi.number().min(0).allow(null),
    owner_id: Joi.number().integer().positive().allow(null)
  });

  static assignLeadSchema = Joi.object({
    owner_id: Joi.number().integer().positive().required()
  });

  static addNoteSchema = Joi.object({
    content: Joi.string().min(1).max(5000).required(),
    type: Joi.string().valid('general', 'call', 'meeting', 'email', 'whatsapp', 'other')
      .default('general')
  });

  static updateNoteSchema = Joi.object({
    content: Joi.string().min(1).max(5000).required()
  });

  static addTagsSchema = Joi.object({
    tags: Joi.array().items(Joi.string().min(1).max(100)).min(1).required()
  });

  static addInterestsSchema = Joi.object({
    interests: Joi.array().items(
      Joi.object({
        name: Joi.string().min(1).max(100).required(),
        category: Joi.string().valid('product', 'service', 'industry', 'technology', 'other')
          .default('other')
      })
    ).min(1).required()
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
      ownerId: req.query.owner_id,
      minScore: req.query.score_min,
      maxScore: req.query.score_max,
      temperature: req.query.temperature,
      search: req.query.search,
      sortBy: req.query.sort || 'created_at',
      sortOrder: req.query.order || 'desc'
    };

    const result = await LeadModel.list(options, req.user.companyId);

    auditLogger.info('Leads listados', {
      userId: req.user.id,
      companyId: req.user.companyId,
      filters: options
    });

    return res.json(paginatedResponse(
      result.leads,
      result.pagination,
      { stats: result.stats }
    ));
  });

  /**
   * ➕ CRIAR LEAD
   * POST /api/leads
   */
  static create = asyncHandler(async (req, res) => {
    const { error, value } = LeadController.createLeadSchema.validate(req.body);
    if (error) throw new ApiError(400, error.details[0].message);

    const { note, tags, interests, ...leadData } = value;
    
    // Adicionar created_by_id
    leadData.created_by_id = req.user.id;

    // Criar o lead
    const lead = await LeadModel.create(leadData, req.user.companyId);

    // Adicionar nota inicial se fornecida
    if (note) {
      await LeadModel.addNote(lead.id, req.user.id, note, 'general', req.user.companyId);
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
          interest.category || 'other', 
          req.user.companyId
        );
      }
    }

    // Buscar lead completo com relacionamentos
    const fullLead = await LeadModel.findById(lead.id, req.user.companyId);

    auditLogger.info('Lead criado', {
      userId: req.user.id,
      companyId: req.user.companyId,
      leadId: lead.id
    });

    return res.status(201).json(successResponse(fullLead, 'Lead criado com sucesso'));
  });

  /**
   * 👁️ DETALHES DO LEAD
   * GET /api/leads/:id
   */
  static show = asyncHandler(async (req, res) => {
    const leadId = parseInt(req.params.id);
    
    const lead = await LeadModel.findById(leadId, req.user.companyId);
    
    if (!lead) {
      throw new ApiError(404, 'Lead não encontrado');
    }

    return res.json(successResponse(lead));
  });

  /**
   * ✏️ ATUALIZAR LEAD
   * PUT /api/leads/:id
   */
  static update = asyncHandler(async (req, res) => {
    const leadId = parseInt(req.params.id);
    const { error, value } = LeadController.updateLeadSchema.validate(req.body);
    
    if (error) throw new ApiError(400, error.details[0].message);

    const updatedLead = await LeadModel.update(leadId, value, req.user.companyId);
    
    if (!updatedLead) {
      throw new ApiError(404, 'Lead não encontrado');
    }

    auditLogger.info('Lead atualizado', {
      userId: req.user.id,
      companyId: req.user.companyId,
      leadId,
      changes: value
    });

    return res.json(successResponse(updatedLead, 'Lead atualizado com sucesso'));
  });

  /**
   * 🗑️ DELETAR LEAD (SOFT DELETE)
   * DELETE /api/leads/:id
   */
  static destroy = asyncHandler(async (req, res) => {
    const leadId = parseInt(req.params.id);
    
    const deleted = await LeadModel.softDelete(leadId, req.user.companyId);
    
    if (!deleted) {
      throw new ApiError(404, 'Lead não encontrado');
    }

    auditLogger.info('Lead deletado', {
      userId: req.user.id,
      companyId: req.user.companyId,
      leadId
    });

    return res.json(successResponse(null, 'Lead deletado com sucesso'));
  });

  /**
   * 👤 ATRIBUIR LEAD A USUÁRIO
   * PUT /api/leads/:id/assign
   */
  static assignTo = asyncHandler(async (req, res) => {
    const leadId = parseInt(req.params.id);
    const { error, value } = LeadController.assignLeadSchema.validate(req.body);
    
    if (error) throw new ApiError(400, error.details[0].message);

    const updatedLead = await LeadModel.update(
      leadId, 
      { owner_id: value.owner_id },
      req.user.companyId
    );
    
    if (!updatedLead) {
      throw new ApiError(404, 'Lead não encontrado');
    }

    auditLogger.info('Lead atribuído', {
      userId: req.user.id,
      companyId: req.user.companyId,
      leadId,
      assignedTo: value.owner_id
    });

    return res.json(successResponse(updatedLead, 'Lead atribuído com sucesso'));
  });

  /**
   * 📊 ESTATÍSTICAS DE LEADS
   * GET /api/leads/stats
   */
  static stats = asyncHandler(async (req, res) => {
    const stats = await LeadModel.getStats(req.user.companyId);
    
    return res.json(successResponse(stats));
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
      throw new ApiError(404, 'Lead não encontrado');
    }

    if (lead.converted_to_client_id) {
      throw new ApiError(400, 'Lead já foi convertido em cliente');
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
      ...req.body // Permite override/campos adicionais
    };

    const result = await LeadModel.convertToClient(leadId, clientData, req.user.companyId);

    auditLogger.info('Lead convertido para cliente', {
      userId: req.user.id,
      companyId: req.user.companyId,
      leadId,
      clientId: result.client.id
    });

    return res.json(successResponse(result, 'Lead convertido em cliente com sucesso'));
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
    
    return res.json(successResponse(notes));
  });

  /**
   * POST /api/leads/:id/notes - Adicionar nota ao lead
   */
  static addNote = asyncHandler(async (req, res) => {
    const leadId = parseInt(req.params.id);
    const { error, value } = LeadController.addNoteSchema.validate(req.body);
    
    if (error) throw new ApiError(400, error.details[0].message);

    const note = await LeadModel.addNote(
      leadId,
      req.user.id,
      value.content,
      value.type,
      req.user.companyId
    );

    auditLogger.info('Nota adicionada ao lead', {
      userId: req.user.id,
      companyId: req.user.companyId,
      leadId,
      noteId: note.id
    });

    return res.status(201).json(successResponse(note, 'Nota adicionada com sucesso'));
  });

  /**
   * PUT /api/leads/:leadId/notes/:noteId - Atualizar nota
   */
  static updateNote = asyncHandler(async (req, res) => {
    const noteId = parseInt(req.params.noteId);
    const { error, value } = LeadController.updateNoteSchema.validate(req.body);
    
    if (error) throw new ApiError(400, error.details[0].message);

    const note = await LeadModel.updateNote(noteId, { content: value.content });
    
    if (!note) {
      throw new ApiError(404, 'Nota não encontrada');
    }

    auditLogger.info('Nota atualizada', {
      userId: req.user.id,
      noteId
    });

    return res.json(successResponse(note, 'Nota atualizada com sucesso'));
  });

  /**
   * DELETE /api/leads/:leadId/notes/:noteId - Deletar nota
   */
  static deleteNote = asyncHandler(async (req, res) => {
    const noteId = parseInt(req.params.noteId);
    
    const deleted = await LeadModel.deleteNote(noteId);
    
    if (!deleted) {
      throw new ApiError(404, 'Nota não encontrada');
    }

    auditLogger.info('Nota deletada', {
      userId: req.user.id,
      noteId
    });

    return res.json(successResponse(null, 'Nota deletada com sucesso'));
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
    
    return res.json(successResponse(tags));
  });

  /**
   * POST /api/leads/:id/tags - Adicionar tags ao lead
   */
  static addTags = asyncHandler(async (req, res) => {
    const leadId = parseInt(req.params.id);
    const { error, value } = LeadController.addTagsSchema.validate(req.body);
    
    if (error) throw new ApiError(400, error.details[0].message);

    // Buscar tags atuais
    const currentTags = await LeadModel.getTags(leadId, req.user.companyId);
    const currentTagNames = currentTags.map(t => t.name);
    
    // Combinar com novas tags
    const allTags = [...new Set([...currentTagNames, ...value.tags])];
    
    // Atualizar
    const tags = await LeadModel.updateTags(leadId, allTags, req.user.companyId);

    auditLogger.info('Tags adicionadas ao lead', {
      userId: req.user.id,
      companyId: req.user.companyId,
      leadId,
      tags: value.tags
    });

    return res.json(successResponse(tags, 'Tags adicionadas com sucesso'));
  });

  /**
   * DELETE /api/leads/:leadId/tags/:tagId - Remover tag
   */
  static removeTag = asyncHandler(async (req, res) => {
    const leadId = parseInt(req.params.leadId);
    const tagId = parseInt(req.params.tagId);
    
    const removed = await LeadModel.removeTag(leadId, tagId, req.user.companyId);
    
    if (!removed) {
      throw new ApiError(404, 'Tag não encontrada ou não associada ao lead');
    }

    auditLogger.info('Tag removida do lead', {
      userId: req.user.id,
      companyId: req.user.companyId,
      leadId,
      tagId
    });

    return res.json(successResponse(null, 'Tag removida com sucesso'));
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
    
    return res.json(successResponse(interests));
  });

  /**
   * POST /api/leads/:id/interests - Adicionar interests ao lead
   */
  static addInterests = asyncHandler(async (req, res) => {
    const leadId = parseInt(req.params.id);
    const { error, value } = LeadController.addInterestsSchema.validate(req.body);
    
    if (error) throw new ApiError(400, error.details[0].message);

    const addedInterests = [];
    for (const interest of value.interests) {
      const added = await LeadModel.addInterest(
        leadId,
        interest.name,
        interest.category || 'other',
        req.user.companyId
      );
      addedInterests.push(added);
    }

    auditLogger.info('Interests adicionados ao lead', {
      userId: req.user.id,
      companyId: req.user.companyId,
      leadId,
      interests: value.interests.map(i => i.name)
    });

    return res.json(successResponse(addedInterests, 'Interests adicionados com sucesso'));
  });

  /**
   * DELETE /api/leads/:leadId/interests/:interestId - Remover interest
   */
  static removeInterest = asyncHandler(async (req, res) => {
    const leadId = parseInt(req.params.leadId);
    const interestId = parseInt(req.params.interestId);
    
    const removed = await LeadModel.removeInterest(leadId, interestId, req.user.companyId);
    
    if (!removed) {
      throw new ApiError(404, 'Interest não encontrado ou não associado ao lead');
    }

    auditLogger.info('Interest removido do lead', {
      userId: req.user.id,
      companyId: req.user.companyId,
      leadId,
      interestId
    });

    return res.json(successResponse(null, 'Interest removido com sucesso'));
  });
}

module.exports = LeadController;
