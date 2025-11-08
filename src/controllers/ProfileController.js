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

const ProfileModel = require("../models/Profile");
const { ApiError, asyncHandler } = require("../utils/errors");
const { successResponse, paginatedResponse } = require("../utils/response");
const { tc } = require("../config/i18n");
const Joi = require("joi");

/**
 * Controller para gerenciamento de Perfis de Usuário
 */
class ProfileController {
  /**
   * Schema de validação para criação de perfil
   */
  static createSchema = Joi.object({
    name: Joi.string().min(3).max(100).required().messages({
      "string.min": "Nome deve ter no mínimo 3 caracteres",
      "string.max": "Nome deve ter no máximo 100 caracteres",
      "any.required": "Nome é obrigatório",
    }),
    company_id: Joi.number()
      .integer()
      .positive()
      .allow(null)
      .optional()
      .messages({
        "number.base": "company_id deve ser um número",
        "number.integer": "company_id deve ser um inteiro",
        "number.positive": "company_id deve ser positivo",
      }),
    translations: Joi.object({
      "pt-BR": Joi.string().required(),
      "en-US": Joi.string().required(),
      "es-ES": Joi.string().required(),
    })
      .required()
      .messages({
        "any.required": "Traduções são obrigatórias (pt-BR, en-US, es-ES)",
      }),
    screen_ids: Joi.array().items(Joi.string()).min(1).required().messages({
      "array.min": "Perfil deve ter ao menos uma permissão",
      "any.required": "screen_ids é obrigatório",
    }),
    is_active: Joi.boolean().optional(),
  });

  /**
   * Schema de validação para atualização de perfil
   */
  static updateSchema = Joi.object({
    name: Joi.string().min(3).max(100).optional(),
    company_id: Joi.number().integer().positive().allow(null).optional(),
    translations: Joi.object({
      "pt-BR": Joi.string(),
      "en-US": Joi.string(),
      "es-ES": Joi.string(),
    }).optional(),
    screen_ids: Joi.array().items(Joi.string()).min(1).optional(),
    is_active: Joi.boolean().optional(),
  }).min(1);

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
   * Lista perfis
   * GET /api/profiles
   */
  static list = asyncHandler(async (req, res) => {
    const { search, is_active, page = 1, limit = 50 } = req.query;
    const userRole = req.user.role; // 'super_admin' ou 'admin'
    const userCompanyId = req.user.companyId;

    const filters = {
      search,
      isActive: is_active !== undefined ? is_active === "true" : undefined,
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit),
    };

    // Regra: super_admin vê todos, admin vê perfis do sistema + perfis da empresa
    if (userRole !== "super_admin") {
      // Admin: buscar perfis do sistema + perfis da sua empresa
      const systemProfiles = await ProfileModel.findAll({
        ...filters,
        companyId: null, // perfis do sistema
      });

      const companyProfiles = await ProfileModel.findAll({
        ...filters,
        companyId: userCompanyId,
      });

      // Combinar e remover duplicados
      const allProfiles = [...systemProfiles, ...companyProfiles];
      const uniqueProfiles = Array.from(
        new Map(allProfiles.map((p) => [p.id, p])).values()
      );

      const total = uniqueProfiles.length;

      return paginatedResponse(
        res,
        {
          data: uniqueProfiles,
          page: parseInt(page),
          limit: parseInt(limit),
          total,
        },
        tc(req, "profileController", "list.success")
      );
    }

    // Super admin: vê todos
    const profiles = await ProfileModel.findAll(filters);
    const total = await ProfileModel.count(filters);

    return paginatedResponse(
      res,
      {
        data: profiles,
        page: parseInt(page),
        limit: parseInt(limit),
        total,
      },
      tc(req, "profileController", "list.success")
    );
  });

  /**
   * Busca perfil por ID
   * GET /api/profiles/:id
   */
  static getById = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userRole = req.user.role;
    const userCompanyId = req.user.companyId;

    const profile = await ProfileModel.findById(id);

    if (!profile) {
      throw new ApiError(404, tc(req, "profileController", "notFound"));
    }

    // Verificar permissão de acesso
    if (userRole !== "super_admin") {
      // Admin só pode ver perfis do sistema ou da sua empresa
      if (profile.company_id !== null && profile.company_id !== userCompanyId) {
        throw new ApiError(
          403,
          tc(req, "profileController", "update.unauthorized_company_access")
        );
      }
    }

    return successResponse(
      res,
      profile,
      tc(req, "profileController", "getById.success")
    );
  });

  /**
   * Cria novo perfil
   * POST /api/profiles
   */
  static create = asyncHandler(async (req, res) => {
    const userRole = req.user.role;
    const userCompanyId = req.user.companyId;

    // Validar dados
    const validatedData = this.validateWithTranslation(
      req,
      this.createSchema,
      req.body
    );

    // Validar screen_ids
    const validation = await ProfileModel.validateScreenIds(
      validatedData.screen_ids
    );
    if (!validation.valid) {
      throw new ApiError(400, validation.message);
    }

    // Regra de negócio: company_id baseado no role
    let company_id;
    if (userRole === "super_admin") {
      // Super admin pode criar perfil do sistema (company_id=null) ou de empresa
      company_id =
        req.body.company_id !== undefined ? req.body.company_id : null;
    } else {
      // Admin só pode criar para sua empresa
      company_id = userCompanyId;
    }

    const profileData = {
      ...validatedData,
      company_id,
      is_system_default: false, // Apenas seed cria perfis do sistema
    };

    const profile = await ProfileModel.create(profileData);

    return successResponse(
      res,
      profile,
      tc(req, "profileController", "create.success"),
      201
    );
  });

  /**
   * Atualiza perfil
   * PUT /api/profiles/:id
   */
  static update = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userRole = req.user.role;
    const userCompanyId = req.user.companyId;

    console.log("🔍 DEBUG UPDATE:", {
      userRole,
      type: typeof userRole,
      comparison: userRole !== "super_admin",
      isSuper: userRole === "super_admin",
    });

    // Validar dados
    const validatedData = this.validateWithTranslation(
      req,
      this.updateSchema,
      req.body
    );

    // Buscar perfil atual
    const currentProfile = await ProfileModel.findById(id);
    if (!currentProfile) {
      throw new ApiError(404, tc(req, "profileController", "notFound"));
    }

    console.log("🔍 DEBUG PROFILE:", {
      is_system_default: currentProfile.is_system_default,
      company_id: currentProfile.company_id,
    });

    // Verificar permissão
    if (userRole !== "super_admin") {
      // Admin não pode editar perfis do sistema
      if (currentProfile.is_system_default) {
        throw new ApiError(
          403,
          tc(req, "profileController", "update.cannot_edit_system_profile")
        );
      }

      // Admin só pode editar perfis da sua empresa
      if (currentProfile.company_id !== userCompanyId) {
        throw new ApiError(
          403,
          tc(req, "profileController", "update.unauthorized_company_access")
        );
      }
    }

    // Validar screen_ids se estiver atualizando
    if (validatedData.screen_ids) {
      const validation = await ProfileModel.validateScreenIds(
        validatedData.screen_ids
      );
      if (!validation.valid) {
        throw new ApiError(400, validation.message);
      }
    }

    const updatedProfile = await ProfileModel.update(id, validatedData);

    return successResponse(
      res,
      updatedProfile,
      tc(req, "profileController", "update.success")
    );
  });

  /**
   * Deleta perfil (soft delete)
   * DELETE /api/profiles/:id
   */
  static delete = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userRole = req.user.role;
    const userCompanyId = req.user.companyId;

    console.log("🔍 DEBUG DELETE:", {
      userRole,
      type: typeof userRole,
      length: userRole?.length,
      charCodes: userRole?.split("").map((c) => c.charCodeAt(0)),
      comparison: userRole !== "super_admin",
      isSuper: userRole === "super_admin",
      trimmed: userRole?.trim(),
      req_user: req.user,
    });

    // Buscar perfil atual
    const profile = await ProfileModel.findById(id);
    if (!profile) {
      throw new ApiError(404, tc(req, "profileController", "notFound"));
    }

    console.log("🔍 DEBUG PROFILE DELETE:", {
      is_system_default: profile.is_system_default,
      company_id: profile.company_id,
    });

    // Verificar permissão
    if (userRole !== "super_admin") {
      // Admin não pode deletar perfis do sistema
      if (profile.is_system_default) {
        throw new ApiError(
          403,
          tc(req, "profileController", "delete.cannot_delete_system_profile")
        );
      }

      // Admin só pode deletar perfis da sua empresa
      if (profile.company_id !== userCompanyId) {
        throw new ApiError(
          403,
          tc(req, "profileController", "update.unauthorized_company_access")
        );
      }
    }
    // Super admin pode deletar qualquer perfil (incluindo perfis do sistema)

    await ProfileModel.delete(id);

    return successResponse(
      res,
      null,
      tc(req, "profileController", "delete.success")
    );
  });

  /**
   * Alterna status ativo/inativo
   * PATCH /api/profiles/:id/toggle-status
   */
  static toggleStatus = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const userRole = req.user.role;
    const userCompanyId = req.user.companyId;

    // Buscar perfil atual
    const profile = await ProfileModel.findById(id);
    if (!profile) {
      throw new ApiError(404, tc(req, "profileController", "notFound"));
    }

    // Verificar permissão
    if (userRole !== "super_admin") {
      if (profile.is_system_default) {
        throw new ApiError(
          403,
          tc(req, "profileController", "update.cannot_edit_system_profile")
        );
      }

      if (profile.company_id !== userCompanyId) {
        throw new ApiError(
          403,
          tc(req, "profileController", "update.unauthorized_company_access")
        );
      }
    }

    const updatedProfile = await ProfileModel.toggleStatus(id);

    return successResponse(
      res,
      updatedProfile,
      tc(req, "profileController", "toggleStatus.success")
    );
  });

  /**
   * Reassign usuários de um perfil para outro
   * POST /api/profiles/:id/reassign
   */
  static reassignUsers = asyncHandler(async (req, res) => {
    const { id: fromProfileId } = req.params;
    const { target_profile_id } = req.body;
    const userRole = req.user.role;
    const userCompanyId = req.user.companyId;

    if (!target_profile_id) {
      throw new ApiError(
        400,
        tc(req, "profileController", "reassign.target_profile_required")
      );
    }

    // Buscar perfis
    const fromProfile = await ProfileModel.findById(fromProfileId);
    const toProfile = await ProfileModel.findById(target_profile_id);

    if (!fromProfile) {
      throw new ApiError(404, tc(req, "profileController", "sourceNotFound"));
    }

    if (!toProfile) {
      throw new ApiError(404, tc(req, "profileController", "targetNotFound"));
    }

    // Verificar permissões
    if (userRole !== "super_admin") {
      // Admin só pode reassign dentro da sua empresa
      if (
        fromProfile.company_id !== userCompanyId ||
        toProfile.company_id !== userCompanyId
      ) {
        throw new ApiError(
          403,
          tc(req, "profileController", "update.unauthorized_company_access")
        );
      }
    }

    const count = await ProfileModel.reassignUsers(
      fromProfileId,
      target_profile_id
    );

    return successResponse(
      res,
      { reassigned_users: count },
      tc(req, "profileController", "reassign.success", { count })
    );
  });

  /**
   * Lista perfis do sistema (company_id = NULL)
   * GET /api/profiles/system-defaults
   */
  static getSystemDefaults = asyncHandler(async (req, res) => {
    const profiles = await ProfileModel.getSystemProfiles();

    return successResponse(
      res,
      profiles,
      tc(req, "profileController", "systemDefaults.success")
    );
  });
}

module.exports = ProfileController;
