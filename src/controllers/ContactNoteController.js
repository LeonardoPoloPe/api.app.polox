/**
 * ==========================================
 * 📝 CONTACT NOTE CONTROLLER - UNIFIED HISTORY
 * ==========================================
 *
 * Sistema unificado de histórico de interações
 * Substitui: lead_notes + client_notes → contact_notes
 * 
 * Features:
 * - Histórico completo de interações
 * - Tipos: nota, ligacao, email, reuniao, whatsapp
 * - Timeline do relacionamento
 * - Estatísticas de interações
 */

const ContactNote = require('../models/ContactNote');
const Contact = require('../models/Contact');
const { ApiError, asyncHandler, ValidationError, NotFoundError } = require('../utils/errors');
const { successResponse, paginatedResponse } = require('../utils/response');
const { tc } = require('../config/i18n');
const { auditLogger } = require('../utils/logger');
const Joi = require('joi');

class ContactNoteController {
  /**
   * 📝 VALIDAÇÕES JOI
   */
  static createNoteSchema = Joi.object({
    contato_id: Joi.number().integer().required(),
    content: Joi.string().min(3).required(),
    tipo: Joi.string()
      .valid('nota', 'ligacao', 'email', 'reuniao', 'whatsapp')
      .default('nota'),
    metadata: Joi.object().default({})
  });

  static updateNoteSchema = Joi.object({
    content: Joi.string().min(3),
    tipo: Joi.string().valid('nota', 'ligacao', 'email', 'reuniao', 'whatsapp'),
    metadata: Joi.object()
  });

  /**
   * 📋 Listar todas as anotações (com filtros)
   * GET /api/notes
   */
  static list = asyncHandler(async (req, res) => {
    const companyId = req.user.companyId;
    const {
      contato_id,
      tipo,
      search,
      sort_by,
      sort_order,
      limit = 50,
      offset = 0
    } = req.query;

    const filters = {
      contato_id: contato_id ? parseInt(contato_id) : undefined,
      tipo,
      search,
      sort_by,
      sort_order,
      limit: parseInt(limit),
      offset: parseInt(offset)
    };

    const notes = await ContactNote.list(companyId, filters);

    res.json(successResponse(notes, tc(req, 'contactNoteController', 'list.success')));
  });

  /**
   * 📋 Listar anotações de um contato específico
   * GET /api/contacts/:contactId/notes
   */
  static listByContact = asyncHandler(async (req, res) => {
    const companyId = req.user.companyId;
    const { contactId } = req.params;
    const { tipo, limit = 100, offset = 0 } = req.query;

    // Verificar se contato existe
    const contact = await Contact.findById(contactId, companyId);
    if (!contact) {
      throw new NotFoundError(tc(req, 'contactNoteController', 'validation.contact_not_found'));
    }

    const filters = {
      tipo,
      limit: parseInt(limit),
      offset: parseInt(offset)
    };

    const notes = await ContactNote.listByContact(contactId, companyId, filters);

    res.json(
      successResponse(notes, tc(req, 'contactNoteController', 'list_by_contact.success'))
    );
  });

  /**
   * 🔍 Buscar anotação por ID
   * GET /api/notes/:id
   */
  static show = asyncHandler(async (req, res) => {
    const companyId = req.user.companyId;
    const { id } = req.params;

    const note = await ContactNote.findById(id, companyId);

    if (!note) {
      throw new NotFoundError(tc(req, 'contactNoteController', 'show.not_found'));
    }

    res.json(successResponse(note, tc(req, 'contactNoteController', 'show.success')));
  });

  /**
   * ➕ Criar nova anotação
   * POST /api/contacts/:contactId/notes
   */
  static create = asyncHandler(async (req, res) => {
    const companyId = req.user.companyId;
    const userId = req.user.id;
    const { contactId } = req.params;

    // Adicionar contato_id ao body se veio por params
    const data = { ...req.body, contato_id: parseInt(contactId) };

    // Validação
    const { error, value } = ContactNoteController.createNoteSchema.validate(data, {
      abortEarly: false
    });

    if (error) {
      const messages = error.details.map(d => d.message).join(', ');
      throw new ValidationError(messages);
    }

    // Verificar se contato existe
    const contact = await Contact.findById(value.contato_id, companyId);
    if (!contact) {
      throw new NotFoundError(tc(req, 'contactNoteController', 'validation.contact_not_found'));
    }

    // Criar anotação
    const note = await ContactNote.create(companyId, userId, value);

    // Audit log
    auditLogger.log({
      action: tc(req, 'contactNoteController', 'audit.note_created'),
      userId,
      companyId,
      resourceType: 'contact_note',
      resourceId: note.id,
      changes: value
    });

    res.status(201).json(
      successResponse(note, tc(req, 'contactNoteController', 'create.success'))
    );
  });

  /**
   * ✏️ Atualizar anotação
   * PUT /api/notes/:id
   */
  static update = asyncHandler(async (req, res) => {
    const companyId = req.user.companyId;
    const userId = req.user.id;
    const { id } = req.params;

    // Validação
    const { error, value } = ContactNoteController.updateNoteSchema.validate(req.body, {
      abortEarly: false
    });

    if (error) {
      const messages = error.details.map(d => d.message).join(', ');
      throw new ValidationError(messages);
    }

    const note = await ContactNote.update(id, companyId, value);

    // Audit log
    auditLogger.log({
      action: tc(req, 'contactNoteController', 'audit.note_updated'),
      userId,
      companyId,
      resourceType: 'contact_note',
      resourceId: id,
      changes: value
    });

    res.json(successResponse(note, tc(req, 'contactNoteController', 'update.success')));
  });

  /**
   * 🗑️ Excluir anotação (soft delete)
   * DELETE /api/notes/:id
   */
  static delete = asyncHandler(async (req, res) => {
    const companyId = req.user.companyId;
    const userId = req.user.id;
    const { id } = req.params;

    await ContactNote.softDelete(id, companyId);

    // Audit log
    auditLogger.log({
      action: tc(req, 'contactNoteController', 'audit.note_deleted'),
      userId,
      companyId,
      resourceType: 'contact_note',
      resourceId: id
    });

    res.json(successResponse(null, tc(req, 'contactNoteController', 'delete.success')));
  });

  /**
   * 📊 Estatísticas de interações de um contato
   * GET /api/contacts/:contactId/notes/stats
   */
  static getContactStats = asyncHandler(async (req, res) => {
    const companyId = req.user.companyId;
    const { contactId } = req.params;

    // Verificar se contato existe
    const contact = await Contact.findById(contactId, companyId);
    if (!contact) {
      throw new NotFoundError(tc(req, 'contactNoteController', 'validation.contact_not_found'));
    }

    const stats = await ContactNote.getContactStats(contactId, companyId);

    res.json(successResponse(stats, tc(req, 'contactNoteController', 'stats.success')));
  });

  /**
   * 📊 Estatísticas gerais de interações da empresa
   * GET /api/notes/stats
   */
  static getCompanyStats = asyncHandler(async (req, res) => {
    const companyId = req.user.companyId;

    const stats = await ContactNote.getCompanyStats(companyId);

    res.json(successResponse(stats, tc(req, 'contactNoteController', 'stats.success')));
  });

  /**
   * 🕐 Anotações recentes de um contato
   * GET /api/contacts/:contactId/notes/recent
   */
  static getRecentByContact = asyncHandler(async (req, res) => {
    const companyId = req.user.companyId;
    const { contactId } = req.params;
    const { limit = 5 } = req.query;

    // Verificar se contato existe
    const contact = await Contact.findById(contactId, companyId);
    if (!contact) {
      throw new NotFoundError(tc(req, 'contactNoteController', 'validation.contact_not_found'));
    }

    const notes = await ContactNote.getRecentByContact(contactId, companyId, parseInt(limit));

    res.json(successResponse(notes, tc(req, 'contactNoteController', 'list_by_contact.success')));
  });
}

module.exports = ContactNoteController;
