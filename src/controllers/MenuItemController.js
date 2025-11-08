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

const MenuItemModel = require("../models/MenuItem");
const { ApiError, asyncHandler } = require("../utils/errors");
const { successResponse } = require("../utils/response");
const { tc } = require("../config/i18n");
const Joi = require("joi");

/**
 * Controller para gerenciamento de Menus do Sistema
 * IMPORTANTE: Apenas super_admin pode criar/editar/deletar menus
 */
class MenuItemController {
  /**
   * Schema de validação para criação de menu
   */
  static createSchema = Joi.object({
    label: Joi.string().min(2).max(100).required().messages({
      "string.min": "Label deve ter no mínimo 2 caracteres",
      "string.max": "Label deve ter no máximo 100 caracteres",
      "any.required": "Label é obrigatório",
    }),
    icon: Joi.string().min(2).max(50).required().messages({
      "any.required": "Ícone é obrigatório",
    }),
    route: Joi.string().min(1).max(255).required().messages({
      "any.required": "Rota é obrigatória",
    }),
    description: Joi.string().max(500).allow("").optional(),
    translations: Joi.object({
      "pt-BR": Joi.string().required(),
      "en-US": Joi.string().required(),
      "es-ES": Joi.string().required(),
    })
      .required()
      .messages({
        "any.required": "Traduções são obrigatórias (pt-BR, en-US, es-ES)",
      }),
    order_position: Joi.number().integer().min(0).required(),
    parent_id: Joi.number().integer().allow(null).optional(),
    is_active: Joi.boolean().optional(),
    is_special: Joi.boolean().optional(),
    admin_only: Joi.boolean().optional(),
    visible_to_all: Joi.boolean().optional(),
    link_type: Joi.string().valid("internal", "external").optional(),
    svg_color: Joi.string()
      .pattern(/^#[0-9A-F]{6}$/i)
      .allow(null)
      .optional()
      .messages({
        "string.pattern.base":
          "svg_color deve estar no formato #RRGGBB (ex: #3B82F6)",
      }),
    background_color: Joi.string()
      .pattern(/^#[0-9A-F]{6}$/i)
      .allow(null)
      .optional()
      .messages({
        "string.pattern.base":
          "background_color deve estar no formato #RRGGBB (ex: #EFF6FF)",
      }),
    text_color: Joi.string()
      .pattern(/^#[0-9A-F]{6}$/i)
      .allow(null)
      .optional()
      .messages({
        "string.pattern.base":
          "text_color deve estar no formato #RRGGBB (ex: #1E40AF)",
      }),
    root_only_access: Joi.boolean().optional(),
  });

  /**
   * Schema de validação para atualização de menu
   */
  static updateSchema = Joi.object({
    label: Joi.string().min(2).max(100).optional(),
    icon: Joi.string().min(2).max(50).optional(),
    route: Joi.string().min(1).max(255).optional(),
    description: Joi.string().max(500).allow("").optional(),
    translations: Joi.object({
      "pt-BR": Joi.string(),
      "en-US": Joi.string(),
      "es-ES": Joi.string(),
    }).optional(),
    order_position: Joi.number().integer().min(0).optional(),
    parent_id: Joi.number().integer().allow(null).optional(),
    is_active: Joi.boolean().optional(),
    is_special: Joi.boolean().optional(),
    admin_only: Joi.boolean().optional(),
    svg_color: Joi.string()
      .pattern(/^#[0-9A-F]{6}$/i)
      .allow(null)
      .optional()
      .messages({
        "string.pattern.base":
          "svg_color deve estar no formato #RRGGBB (ex: #3B82F6)",
      }),
    background_color: Joi.string()
      .pattern(/^#[0-9A-F]{6}$/i)
      .allow(null)
      .optional()
      .messages({
        "string.pattern.base":
          "background_color deve estar no formato #RRGGBB (ex: #EFF6FF)",
      }),
    text_color: Joi.string()
      .pattern(/^#[0-9A-F]{6}$/i)
      .allow(null)
      .optional()
      .messages({
        "string.pattern.base":
          "text_color deve estar no formato #RRGGBB (ex: #1E40AF)",
      }),
    visible_to_all: Joi.boolean().optional(),
    root_only_access: Joi.boolean().optional(),
    link_type: Joi.string().valid("internal", "external").optional(),
  }).min(1);

  /**
   * Schema de validação para reordenação
   */
  static reorderSchema = Joi.object({
    menus: Joi.array()
      .items(
        Joi.object({
          id: Joi.number().integer().required(),
          order_position: Joi.number().integer().min(0).required(),
        })
      )
      .min(1)
      .required(),
    parent_id: Joi.number().integer().allow(null).optional(),
  });

  /**
   * Schema de validação para batch reorder (múltiplos grupos)
   */
  static batchReorderSchema = Joi.object({
    updates: Joi.array()
      .items(
        Joi.object({
          parent_id: Joi.number().integer().allow(null).optional(),
          menus: Joi.array()
            .items(
              Joi.object({
                id: Joi.number().integer().required(),
                order_position: Joi.number().integer().min(0).required(),
              })
            )
            .min(1)
            .required(),
        })
      )
      .min(1)
      .required()
      .messages({
        "array.min": "Deve conter pelo menos um grupo de menus para reordenar",
        "any.required": "Campo updates é obrigatório",
      }),
  });

  /**
   * Validação com suporte a internacionalização
   */
  static validateWithTranslation(req, schema, data) {
    const { error, value } = schema.validate(data, { abortEarly: false });

    if (error) {
      const messages = error.details.map((detail) => detail.message);
      throw new ApiError(400, messages.join(", "));
    }

    return value;
  }

  /**
   * Verifica se usuário é super_admin
   */
  static checkSuperAdmin(req) {
    if (req.user.role !== "super_admin") {
      throw new ApiError(
        403,
        tc(req, "menuItemController", "security.super_admin_required")
      );
    }
  }

  /**
   * Lista menus
   * GET /api/menu-items
   */
  static list = asyncHandler(async (req, res) => {
    const { is_active, admin_only, is_special, parent_id, search } = req.query;

    const filters = {
      isActive: is_active !== undefined ? is_active === "true" : undefined,
      adminOnly: admin_only !== undefined ? admin_only === "true" : undefined,
      isSpecial: is_special !== undefined ? is_special === "true" : undefined,
      parentId:
        parent_id !== undefined
          ? parent_id === "null"
            ? null
            : parseInt(parent_id)
          : undefined,
      search,
    };

    const menus = await MenuItemModel.findAll(filters);

    return successResponse(
      res,
      menus,
      tc(req, "menuItemController", "list.success")
    );
  });

  /**
   * Busca menu por ID
   * GET /api/menu-items/:id
   */
  static getById = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const menu = await MenuItemModel.findById(id);

    if (!menu) {
      throw new ApiError(404, tc(req, "menuItemController", "notFound"));
    }

    return successResponse(
      res,
      menu,
      tc(req, "menuItemController", "getById.success")
    );
  });

  /**
   * Cria novo menu
   * POST /api/menu-items
   * APENAS SUPER_ADMIN
   */
  static create = asyncHandler(async (req, res) => {
    // Verificar se é super_admin
    this.checkSuperAdmin(req);

    // Validar dados
    const validatedData = this.validateWithTranslation(
      req,
      this.createSchema,
      req.body
    );

    const menu = await MenuItemModel.create(validatedData);

    return successResponse(
      res,
      menu,
      tc(req, "menuItemController", "create.success"),
      201
    );
  });

  /**
   * Atualiza menu
   * PUT /api/menu-items/:id
   * APENAS SUPER_ADMIN
   */
  static update = asyncHandler(async (req, res) => {
    // Verificar se é super_admin
    this.checkSuperAdmin(req);

    const { id } = req.params;

    // Validar dados
    const validatedData = this.validateWithTranslation(
      req,
      this.updateSchema,
      req.body
    );

    const updatedMenu = await MenuItemModel.update(id, validatedData);

    return successResponse(
      res,
      updatedMenu,
      tc(req, "menuItemController", "update.success")
    );
  });

  /**
   * Deleta menu (soft delete)
   * DELETE /api/menu-items/:id
   * APENAS SUPER_ADMIN
   */
  static delete = asyncHandler(async (req, res) => {
    // Verificar se é super_admin
    this.checkSuperAdmin(req);

    const { id } = req.params;

    await MenuItemModel.delete(id);

    return successResponse(
      res,
      null,
      tc(req, "menuItemController", "delete.success")
    );
  });

  /**
   * Alterna status ativo/inativo
   * PATCH /api/menu-items/:id/toggle-status
   * APENAS SUPER_ADMIN
   */
  static toggleStatus = asyncHandler(async (req, res) => {
    // Verificar se é super_admin
    this.checkSuperAdmin(req);

    const { id } = req.params;
    const { force } = req.body; // Forçar desativação mesmo com perfis dependentes

    const result = await MenuItemModel.toggleStatus(id);

    // Se há warning sobre perfis afetados
    if (result._warning && !force) {
      return res.status(409).json({
        success: false,
        error: tc(req, "menuItemController", "toggleStatus.warning"),
        data: {
          menu: result,
          affected_profiles: result._warning.affected_profiles,
          profiles: result._warning.profiles,
        },
        suggestion: "Use force=true para confirmar a desativação",
      });
    }

    return successResponse(
      res,
      result,
      tc(req, "menuItemController", "toggleStatus.success")
    );
  });

  /**
   * Reordena múltiplos menus
   * POST /api/menu-items/reorder
   * APENAS SUPER_ADMIN
   */
  static reorder = asyncHandler(async (req, res) => {
    // Verificar se é super_admin
    this.checkSuperAdmin(req);

    // Validar dados
    const validatedData = this.validateWithTranslation(
      req,
      this.reorderSchema,
      req.body
    );

    const reorderedMenus = await MenuItemModel.reorder(
      validatedData.menus,
      validatedData.parent_id || null
    );

    return successResponse(
      res,
      reorderedMenus,
      tc(req, "menuItemController", "reorder.success")
    );
  });

  /**
   * Reordena múltiplos grupos de menus em lote (batch)
   * POST /api/menu-items/batch-reorder
   * APENAS SUPER_ADMIN
   *
   * Esta é a forma recomendada para reordenar menus, pois:
   * - Executa tudo em uma transação atômica
   * - Evita conflitos de constraint unique
   * - Permite reordenar múltiplos níveis de hierarquia de uma vez
   */
  static batchReorder = asyncHandler(async (req, res) => {
    // Verificar se é super_admin
    this.checkSuperAdmin(req);

    // Normalizar dados: converter strings para números (compatibilidade com frontend)
    const normalizedBody = {
      ...req.body,
      updates: req.body.updates?.map((group) => ({
        ...group,
        parent_id:
          group.parent_id === null || group.parent_id === "null"
            ? null
            : parseInt(group.parent_id, 10),
        menus: group.menus?.map((menu) => ({
          id: parseInt(menu.id, 10),
          order_position: parseInt(menu.order_position, 10),
        })),
      })),
    };

    // Validar dados
    const validatedData = this.validateWithTranslation(
      req,
      this.batchReorderSchema,
      normalizedBody
    );

    const result = await MenuItemModel.batchReorder(validatedData.updates);

    return successResponse(
      res,
      result,
      tc(req, "menuItemController", "batchReorder.success")
    );
  });

  /**
   * Busca menus hierárquicos (com submenus)
   * GET /api/menu-items/hierarchy
   */
  static getHierarchy = asyncHandler(async (req, res) => {
    const hierarchy = await MenuItemModel.getHierarchy();

    return successResponse(
      res,
      hierarchy,
      tc(req, "menuItemController", "hierarchy.success")
    );
  });

  /**
   * Busca menus disponíveis para a empresa do usuário
   * GET /api/menu-items/for-company
   */
  static getForCompany = asyncHandler(async (req, res) => {
    const userCompanyId = req.user.companyId;
    const userRole = req.user.userRole;
    const isAdmin = userRole === "super_admin" || userRole === "admin";

    const menus = await MenuItemModel.getMenusForCompany(
      userCompanyId,
      isAdmin
    );

    return successResponse(
      res,
      menus,
      tc(req, "menuItemController", "forCompany.success")
    );
  });
}

module.exports = MenuItemController;
