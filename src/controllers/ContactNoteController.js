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

const ContactNote = require("../models/ContactNote");
const Contact = require("../models/Contact");
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

class ContactNoteController {
  /**
   * 📝 VALIDAÇÕES JOI
   */
  static createNoteSchema = Joi.object({
    contato_id: Joi.number().integer().required(),
    content: Joi.string().min(3).required(),
    tipo: Joi.string()
      .valid("nota", "ligacao", "email", "reuniao", "whatsapp")
      .default("nota"),
    metadata: Joi.object().default({}),
  });

  static updateNoteSchema = Joi.object({
    content: Joi.string().min(3),
    tipo: Joi.string().valid("nota", "ligacao", "email", "reuniao", "whatsapp"),
    metadata: Joi.object(),
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
      offset = 0,
    } = req.query;

    const filters = {
      contato_id: contato_id ? parseInt(contato_id) : undefined,
      tipo,
      search,
      sort_by,
      sort_order,
      limit: parseInt(limit),
      offset: parseInt(offset),
    };

    const notes = await ContactNote.list(companyId, filters);

    return successResponse(
      res,
      notes,
      tc(req, "contactNoteController", "list.success")
    );
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
      throw new NotFoundError(
        tc(req, "contactNoteController", "validation.contact_not_found")
      );
    }

    const filters = {
      tipo,
      limit: parseInt(limit),
      offset: parseInt(offset),
    };

    const notes = await ContactNote.listByContact(
      contactId,
      filters,
      companyId
    );

    return successResponse(
      res,
      notes,
      tc(req, "contactNoteController", "list_by_contact.success")
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
      throw new NotFoundError(
        tc(req, "contactNoteController", "show.not_found")
      );
    }

    return successResponse(
      res,
      note,
      tc(req, "contactNoteController", "show.success")
    );
  });

  /**
   * ➕ Criar nova anotação
   * POST /api/contacts/:contactId/notes
   */
  static create = asyncHandler(async (req, res) => {
    console.log("=== ContactNoteController.create called ===");
    console.log("URL:", req.url);
    console.log("Method:", req.method);

    const companyId = req.user.companyId;
    const userId = req.user.id;
    const { contactId } = req.params;

    // Debug logging
    console.log("req.params:", req.params);
    console.log("contactId extracted:", contactId);

    // Validar se contactId está presente
    if (!contactId) {
      throw new ValidationError("Contact ID is required");
    }

    const contactIdInt = parseInt(contactId);
    if (isNaN(contactIdInt)) {
      throw new ValidationError("Contact ID must be a valid integer");
    }

    // Adicionar contato_id ao body se veio por params
    const data = { ...req.body, contato_id: contactIdInt };

    console.log("Data before validation:", JSON.stringify(data, null, 2));

    // Validação
    const { error, value } = ContactNoteController.createNoteSchema.validate(
      data,
      {
        abortEarly: false,
      }
    );

    console.log("Validation error:", error);
    console.log("Validation value:", value);

    if (error) {
      const messages = error.details.map((d) => d.message).join(", ");
      console.log("Validation messages:", messages);
      throw new ValidationError(messages);
    }

    // Verificar se contato existe
    const contact = await Contact.findById(value.contato_id, companyId);
    if (!contact) {
      throw new NotFoundError(
        tc(req, "contactNoteController", "validation.contact_not_found")
      );
    }

    // Criar anotação
    const noteData = {
      contato_id: value.contato_id,
      created_by_id: userId,
      content: value.content,
      type: value.tipo, // Convert 'tipo' to 'type'
    };

    console.log(
      "Calling ContactNote.create with:",
      JSON.stringify(noteData, null, 2)
    );
    const note = await ContactNote.create(noteData, companyId);

    // Audit log
    auditLogger({
      action: tc(req, "contactNoteController", "audit.note_created"),
      userId,
      companyId,
      resourceType: "contact_note",
      resourceId: note.id,
      changes: value,
    });

    return successResponse(
      res,
      note,
      tc(req, "contactNoteController", "create.success"),
      201
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
    const { error, value } = ContactNoteController.updateNoteSchema.validate(
      req.body,
      {
        abortEarly: false,
      }
    );

    if (error) {
      const messages = error.details.map((d) => d.message).join(", ");
      throw new ValidationError(messages);
    }

    // Mapear 'tipo' para 'type' para compatibilidade com o model
    const updateData = { ...value };
    if (updateData.tipo) {
      updateData.type = updateData.tipo;
      delete updateData.tipo;
    }

    const note = await ContactNote.update(id, updateData, companyId);

    // Audit log
    auditLogger({
      action: tc(req, "contactNoteController", "audit.note_updated"),
      userId,
      companyId,
      resourceType: "contact_note",
      resourceId: id,
      changes: value,
    });

    return successResponse(
      res,
      note,
      tc(req, "contactNoteController", "update.success")
    );
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
    auditLogger({
      action: tc(req, "contactNoteController", "audit.note_deleted"),
      userId,
      companyId,
      resourceType: "contact_note",
      resourceId: id,
    });

    return successResponse(
      res,
      null,
      tc(req, "contactNoteController", "delete.success")
    );
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
      throw new NotFoundError(
        tc(req, "contactNoteController", "validation.contact_not_found")
      );
    }

    const stats = await ContactNote.getContactStats(contactId, companyId);

    return successResponse(
      res,
      stats,
      tc(req, "contactNoteController", "stats.success")
    );
  });

  /**
   * 📊 Estatísticas gerais de interações da empresa
   * GET /api/notes/stats
   */
  static getCompanyStats = asyncHandler(async (req, res) => {
    const companyId = req.user.companyId;

    const stats = await ContactNote.getCompanyStats(companyId);

    return successResponse(
      res,
      stats,
      tc(req, "contactNoteController", "stats.success")
    );
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
      throw new NotFoundError(
        tc(req, "contactNoteController", "validation.contact_not_found")
      );
    }

    const notes = await ContactNote.getRecentByContact(
      contactId,
      companyId,
      parseInt(limit)
    );

    return successResponse(
      res,
      notes,
      tc(req, "contactNoteController", "list_by_contact.success")
    );
  });
}

module.exports = ContactNoteController;
