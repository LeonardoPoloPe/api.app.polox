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
const Tag = require("../models/Tag");
const {
  successResponse,
  paginatedResponse,
} = require("../utils/response");
// Unifica import de asyncHandler e erros (origem correta: utils/errors)
const {
  asyncHandler,
  ValidationError,
  NotFoundError,
  ApiError,
} = require("../utils/errors");
const { auditLogger } = require("../utils/logger");
const { tc } = require("../config/i18n");

/**
 * ========================================
 * 🏷️ TAG CONTROLLER - Gerenciamento de Tags
 * ========================================
 * 
 * Funcionalidades:
 * - CRUD completo de tags
 * - Associação com entidades (contatos, produtos, etc.)
 * - Estatísticas e analytics
 * - Sugestões inteligentes
 * - Sistema de categorias
 * - Tags do sistema vs. personalizadas
 */
class TagController {
  /**
   * 📝 VALIDAÇÕES JOI
   */
  static createTagSchema = Joi.object({
    name: Joi.string().min(1).max(255).required(),
    color: Joi.string().pattern(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/).default('#3498db'),
    is_active: Joi.boolean().default(true),
  });

  static updateTagSchema = Joi.object({
    name: Joi.string().min(1).max(255),
    color: Joi.string().pattern(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/),
    is_active: Joi.boolean(),
  });

  static entityAssociationSchema = Joi.object({
    entity_type: Joi.string().valid(
      'contacts', 'suppliers', 'products', 'sales', 'tickets', 
      'events', 'financial_transactions'
    ).required(),
    entity_id: Joi.number().integer().positive().required(),
  });

  /**
   * 📋 Listar tags com filtros e paginação
   * GET /api/tags
   */
  static list = asyncHandler(async (req, res) => {
    const companyId = req.user.companyId;
    const {
      page = 1,
      limit = 20,
      category,
      is_active,
      is_system,
      search,
      sort_by = 'name',
      sort_order = 'ASC'
    } = req.query;

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      category,
      is_active: is_active !== undefined ? is_active === 'true' : null,
      is_system: is_system !== undefined ? is_system === 'true' : null,
      search,
      sortBy: sort_by,
      sortOrder: sort_order.toUpperCase()
    };

    const result = await Tag.list(options, companyId);

    return paginatedResponse(
      res,
      result.data,
      result.pagination,
      tc(req, "tagController", "list.success")
    );
  });

  /**
   * 🔍 Buscar tag por ID
   * GET /api/tags/:id
   */
  static show = asyncHandler(async (req, res) => {
    const companyId = req.user.companyId;
    const { id } = req.params;

    const tag = await Tag.findById(parseInt(id), companyId);

    if (!tag) {
      throw new NotFoundError(tc(req, "tagController", "show.not_found"));
    }

    return successResponse(
      res,
      tag,
      tc(req, "tagController", "show.success")
    );
  });

  /**
   * ➕ Criar nova tag
   * POST /api/tags
   */
  static create = asyncHandler(async (req, res) => {
    const companyId = req.user.companyId;
    const userId = req.user.id;

    // Validação
    const { error, value } = TagController.createTagSchema.validate(req.body, {
      abortEarly: false,
    });

    if (error) {
      const messages = error.details.map((d) => d.message).join(", ");
      throw new ValidationError(messages);
    }

    // Criar tag
    const tag = await Tag.create(value, companyId);

    // Audit log
    auditLogger("tag_created", {
      userId,
      companyId,
      resourceType: "tag",
      resourceId: tag.id,
      changes: value,
    });

    return successResponse(
      res,
      tag,
      tc(req, "tagController", "create.success"),
      201
    );
  });

  /**
   * ✏️ Atualizar tag
   * PUT /api/tags/:id
   */
  static update = asyncHandler(async (req, res) => {
    const companyId = req.user.companyId;
    const userId = req.user.id;
    const { id } = req.params;

    // Validação
    const { error, value } = TagController.updateTagSchema.validate(req.body, {
      abortEarly: false,
    });

    if (error) {
      const messages = error.details.map((d) => d.message).join(", ");
      throw new ValidationError(messages);
    }

    const tag = await Tag.update(parseInt(id), value, companyId);

    if (!tag) {
      throw new NotFoundError(tc(req, "tagController", "update.not_found"));
    }

    // Audit log
    auditLogger("tag_updated", {
      userId,
      companyId,
      resourceType: "tag",
      resourceId: id,
      changes: value,
    });

    return successResponse(
      res,
      tag,
      tc(req, "tagController", "update.success")
    );
  });

  /**
   * 🗑️ Excluir tag (soft delete)
   * DELETE /api/tags/:id
   */
  static delete = asyncHandler(async (req, res) => {
    const companyId = req.user.companyId;
    const userId = req.user.id;
    const { id } = req.params;

    const deleted = await Tag.softDelete(parseInt(id), companyId);

    if (!deleted) {
      throw new NotFoundError(tc(req, "tagController", "delete.not_found"));
    }

    // Audit log
    auditLogger("tag_deleted", {
      userId,
      companyId,
      resourceType: "tag",
      resourceId: id,
    });

    return successResponse(
      res,
      null,
      tc(req, "tagController", "delete.success")
    );
  });

  /**
   * 🔄 Ativar/Desativar tag
   * PATCH /api/tags/:id/toggle
   */
  static toggleActive = asyncHandler(async (req, res) => {
    const companyId = req.user.companyId;
    const userId = req.user.id;
    const { id } = req.params;
    const { is_active } = req.body;

    if (typeof is_active !== 'boolean') {
      throw new ValidationError(tc(req, "tagController", "toggle.invalid_status"));
    }

    const tag = await Tag.toggleActive(parseInt(id), is_active, companyId);

    if (!tag) {
      throw new NotFoundError(tc(req, "tagController", "toggle.not_found"));
    }

    // Audit log
    auditLogger("tag_toggled", {
      userId,
      companyId,
      resourceType: "tag",
      resourceId: id,
      changes: { is_active },
    });

    return successResponse(
      res,
      tag,
      tc(req, "tagController", "toggle.success")
    );
  });

  /**
   * 🔗 Associar tag a uma entidade
   * POST /api/tags/:id/entities
   */
  static addToEntity = asyncHandler(async (req, res) => {
    const companyId = req.user.companyId;
    const userId = req.user.id;
    const { id } = req.params;

    // Validação
    const { error, value } = TagController.entityAssociationSchema.validate(req.body, {
      abortEarly: false,
    });

    if (error) {
      const messages = error.details.map((d) => d.message).join(", ");
      throw new ValidationError(messages);
    }

    const { entity_type, entity_id } = value;

    const association = await Tag.addToEntity(
      parseInt(id), 
      entity_type, 
      entity_id, 
      companyId
    );

    // Audit log
    auditLogger("tag_entity_associated", {
      userId,
      companyId,
      resourceType: "tag_association",
      resourceId: association.id,
      metadata: { tag_id: id, entity_type, entity_id },
    });

    return successResponse(
      res,
      association,
      tc(req, "tagController", "add_entity.success"),
      201
    );
  });

  /**
   * ❌ Remover tag de uma entidade
   * DELETE /api/tags/:id/entities
   */
  static removeFromEntity = asyncHandler(async (req, res) => {
    const companyId = req.user.companyId;
    const userId = req.user.id;
    const { id } = req.params;

    // Validação
    const { error, value } = TagController.entityAssociationSchema.validate(req.body, {
      abortEarly: false,
    });

    if (error) {
      const messages = error.details.map((d) => d.message).join(", ");
      throw new ValidationError(messages);
    }

    const { entity_type, entity_id } = value;

    const removed = await Tag.removeFromEntity(
      parseInt(id), 
      entity_type, 
      entity_id, 
      companyId
    );

    if (!removed) {
      throw new NotFoundError(tc(req, "tagController", "remove_entity.not_found"));
    }

    // Audit log
    auditLogger("tag_entity_disassociated", {
      userId,
      companyId,
      resourceType: "tag_association",
      metadata: { tag_id: id, entity_type, entity_id },
    });

    return successResponse(
      res,
      null,
      tc(req, "tagController", "remove_entity.success")
    );
  });

  /**
   * 📊 Buscar tags de uma entidade específica
   * GET /api/tags/entity/:entity_type/:entity_id
   */
  static getEntityTags = asyncHandler(async (req, res) => {
    const companyId = req.user.companyId;
    const { entity_type, entity_id } = req.params;

    const tags = await Tag.getEntityTags(entity_type, parseInt(entity_id), companyId);

    return successResponse(
      res,
      tags,
      tc(req, "tagController", "entity_tags.success")
    );
  });

  /**
   * 🔍 Buscar entidades que possuem uma tag específica
   * GET /api/tags/:id/entities
   */
  static getTaggedEntities = asyncHandler(async (req, res) => {
    const companyId = req.user.companyId;
    const { id } = req.params;
    const { 
      entity_type, 
      page = 1, 
      limit = 20 
    } = req.query;

    const options = {
      page: parseInt(page),
      limit: parseInt(limit)
    };

    const result = await Tag.getTaggedEntities(
      parseInt(id), 
      entity_type, 
      companyId, 
      options
    );

    return paginatedResponse(
      res,
      result.data,
      result.pagination,
      tc(req, "tagController", "tagged_entities.success")
    );
  });

  /**
   * 🏆 Tags mais utilizadas
   * GET /api/tags/most-used
   */
  static getMostUsed = asyncHandler(async (req, res) => {
    const companyId = req.user.companyId;
    const { 
      limit = 10, 
      entity_type 
    } = req.query;

    const tags = await Tag.getMostUsed(
      companyId, 
      parseInt(limit), 
      entity_type
    );

    return successResponse(
      res,
      tags,
      tc(req, "tagController", "most_used.success")
    );
  });

  /**
   * 📈 Estatísticas das tags
   * GET /api/tags/stats
   */
  static getStats = asyncHandler(async (req, res) => {
    const companyId = req.user.companyId;

    const stats = await Tag.getStats(companyId);

    return successResponse(
      res,
      stats,
      tc(req, "tagController", "stats.success")
    );
  });

  /**
   * 📊 Estatísticas por categoria
   * GET /api/tags/stats/categories
   */
  static getStatsByCategory = asyncHandler(async (req, res) => {
    const companyId = req.user.companyId;

    const stats = await Tag.getStatsByCategory(companyId);

    return successResponse(
      res,
      stats,
      tc(req, "tagController", "stats_category.success")
    );
  });

  /**
   * 🔍 Sugestões de tags baseadas em texto
   * GET /api/tags/suggestions
   */
  static getSuggestions = asyncHandler(async (req, res) => {
    const companyId = req.user.companyId;
    const { 
      text,
      limit = 5 
    } = req.query;

    if (!text) {
      throw new ValidationError(tc(req, "tagController", "suggestions.text_required"));
    }

    const suggestions = await Tag.suggestTags(
      text, 
      companyId, 
      parseInt(limit)
    );

    return successResponse(
      res,
      suggestions,
      tc(req, "tagController", "suggestions.success")
    );
  });

  // Método removido: getByCategory - coluna category não existe no banco real

  /**
   * ➕ Adicionar tags a uma entidade
   * POST /api/tags/entity/:entity_type/:entity_id
   */
  static addTagsToEntity = asyncHandler(async (req, res) => {
    const companyId = req.user.companyId;
    const userId = req.user.id;
    const { entity_type, entity_id } = req.params;
    const { tag_ids = [] } = req.body;

    // Validação
    const validEntityTypes = [
      'contacts', 'suppliers', 'products', 'sales', 'tickets', 
      'events', 'financial_transactions'
    ];

    if (!validEntityTypes.includes(entity_type)) {
      throw new ValidationError(
        tc(req, "tagController", "add_tags.invalid_entity_type", {
          valid: validEntityTypes.join(', ')
        })
      );
    }

    if (!Array.isArray(tag_ids) || tag_ids.length === 0) {
      throw new ValidationError(tc(req, "tagController", "add_tags.empty_tag_ids"));
    }

    let added = 0;
    const errors = [];

    // Adicionar cada tag
    for (const tagId of tag_ids) {
      try {
        await Tag.addToEntity(parseInt(tagId), entity_type, parseInt(entity_id), companyId);
        added++;
      } catch (error) {
        errors.push(`Tag ${tagId}: ${error.message}`);
      }
    }

    // Audit log
    auditLogger("tags_added_to_entity", {
      userId,
      companyId,
      resourceType: "tag_association",
      metadata: { entity_type, entity_id, tag_ids, added, errors_count: errors.length },
    });

    return successResponse(
      res,
      { added, errors },
      tc(req, "tagController", "add_tags.success"),
      201
    );
  });

  /**
   * 🔧 Sincronizar tags de uma entidade
   * PUT /api/tags/entity/:entity_type/:entity_id
   * (também usado em PUT /api/tags/sync-entity para compatibilidade)
   */
  static syncEntityTags = asyncHandler(async (req, res) => {
    const companyId = req.user.companyId;
    const userId = req.user.id;
    
    // Aceita parâmetros via body (sync-entity) ou params (entity/:type/:id)
    const entity_type = req.params.entity_type || req.body.entity_type;
    const entity_id = req.params.entity_id || req.body.entity_id;
    const { tag_ids = [] } = req.body;

    // Validação básica
    if (!entity_type || !entity_id) {
      throw new ValidationError(tc(req, "tagController", "sync.missing_params"));
    }

    const validEntityTypes = [
      'contacts', 'suppliers', 'products', 'sales', 'tickets', 
      'events', 'financial_transactions'
    ];

    if (!validEntityTypes.includes(entity_type)) {
      throw new ValidationError(
        tc(req, "tagController", "sync.invalid_entity_type", {
          valid: validEntityTypes.join(', ')
        })
      );
    }

    if (!Array.isArray(tag_ids)) {
      throw new ValidationError(tc(req, "tagController", "sync.invalid_tag_ids"));
    }

    const result = await Tag.syncEntityTags(
      entity_type, 
      parseInt(entity_id), 
      tag_ids, 
      companyId
    );

    // Audit log
    auditLogger("tags_synchronized", {
      userId,
      companyId,
      resourceType: "tag_sync",
      metadata: { 
        entity_type, 
        entity_id, 
        tag_ids, 
        result 
      },
    });

    return successResponse(
      res,
      result,
      tc(req, "tagController", "sync.success")
    );
  });

  /**
   * 🏭 Criar tags do sistema (setup inicial)
   * POST /api/tags/create-system-tags
   */
  static createSystemTags = asyncHandler(async (req, res) => {
    const companyId = req.user.companyId;
    const userId = req.user.id;

    const systemTags = await Tag.createSystemTags(companyId);

    // Audit log
    auditLogger("system_tags_created", {
      userId,
      companyId,
      resourceType: "tag_system",
      metadata: { 
        created_count: systemTags.length,
        tag_names: systemTags.map(t => t.name)
      },
    });

    return successResponse(
      res,
      systemTags,
      tc(req, "tagController", "system_tags.success"),
      201
    );
  });

  /**
   * 🔍 Buscar ou criar tags por nomes
   * POST /api/tags/find-or-create
   */
  static findOrCreateByNames = asyncHandler(async (req, res) => {
    const companyId = req.user.companyId;
    const userId = req.user.id;
    const { names, create_missing = false } = req.body;

    if (!Array.isArray(names) || names.length === 0) {
      throw new ValidationError(tc(req, "tagController", "find_create.invalid_names"));
    }

    const tags = await Tag.findOrCreateByNames(names, companyId, create_missing);

    // Audit log apenas se criou tags
    const existingCount = tags.filter(t => t.created_at).length;
    if (create_missing && existingCount > 0) {
      auditLogger("tags_bulk_created", {
        userId,
        companyId,
        resourceType: "tag_bulk",
        metadata: { 
          requested_names: names,
          created_count: existingCount,
          found_count: tags.length - existingCount
        },
      });
    }

    return successResponse(
      res,
      tags,
      tc(req, "tagController", "find_create.success")
    );
  });
}

module.exports = TagController;