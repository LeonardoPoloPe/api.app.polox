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

const { query } = require("../config/database");
const { ApiError } = require("../utils/errors");
const { tc } = require("../config/i18n");

/**
 * Middleware para verificar permissões baseadas em perfil
 * Valida se o usuário tem acesso a uma tela/rota específica
 *
 * @param {string} screenId - ID da tela/rota a ser verificada
 * @returns {Function} Middleware function
 *
 * @example
 * router.get('/leads', authMiddleware, checkPermission('leads'), LeadController.list);
 * router.get('/dashboard', authMiddleware, checkPermission('dashboard'), DashboardController.index);
 */
const checkPermission = (screenId) => {
  return async (req, res, next) => {
    try {
      const userId = req.user?.id;
      const userRole = req.user?.userRole;

      // Super admin tem acesso a tudo
      if (userRole === "super_admin") {
        return next();
      }

      // Buscar perfil do usuário
      const userQuery = `
        SELECT profile_id FROM polox.users 
        WHERE id = $1 AND deleted_at IS NULL
      `;
      const userResult = await query(userQuery, [userId]);

      if (userResult.rows.length === 0 || !userResult.rows[0].profile_id) {
        throw new ApiError(
          403,
          tc(req, "permissions.noProfileAssigned") ||
            "Usuário sem perfil atribuído. Entre em contato com o administrador."
        );
      }

      const profileId = userResult.rows[0].profile_id;

      // Buscar permissões do perfil
      const profileQuery = `
        SELECT screen_ids, is_active FROM polox.profiles 
        WHERE id = $1 AND deleted_at IS NULL
      `;
      const profileResult = await query(profileQuery, [profileId]);

      if (profileResult.rows.length === 0) {
        throw new ApiError(
          403,
          tc(req, "permissions.profileNotFound") || "Perfil não encontrado."
        );
      }

      const profile = profileResult.rows[0];

      // Verificar se perfil está ativo
      if (!profile.is_active) {
        throw new ApiError(
          403,
          tc(req, "permissions.profileInactive") ||
            "Perfil inativo. Entre em contato com o administrador."
        );
      }

      // Verificar se screen_id está nas permissões
      const screenIds = profile.screen_ids || [];

      if (!screenIds.includes(screenId)) {
        throw new ApiError(
          403,
          tc(req, "permissions.accessDenied", { screenId }) ||
            `Acesso negado à tela: ${screenId}`
        );
      }

      // Permissão concedida
      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Middleware para verificar se usuário é super_admin
 *
 * @example
 * router.post('/companies', authMiddleware, isSuperAdmin, CompanyController.create);
 */
const isSuperAdmin = (req, res, next) => {
  if (req.user?.userRole !== "super_admin") {
    throw new ApiError(
      403,
      tc(req, "permissions.superAdminOnly") ||
        "Acesso restrito a super administradores"
    );
  }
  next();
};

/**
 * Middleware para verificar se usuário é admin (super_admin OU admin de empresa)
 *
 * @example
 * router.get('/users', authMiddleware, isAdmin, UserController.list);
 */
const isAdmin = (req, res, next) => {
  const userRole = req.user?.userRole;

  if (userRole !== "super_admin" && userRole !== "admin") {
    throw new ApiError(
      403,
      tc(req, "permissions.adminOnly") || "Acesso restrito a administradores"
    );
  }
  next();
};

/**
 * Middleware para verificar permissões múltiplas (OR)
 * Usuário precisa ter ao menos UMA das permissões
 *
 * @param {Array<string>} screenIds - Array de screen IDs
 * @returns {Function} Middleware function
 *
 * @example
 * router.get('/reports', authMiddleware, checkAnyPermission(['reports', 'dashboard']), ReportController.list);
 */
const checkAnyPermission = (screenIds) => {
  return async (req, res, next) => {
    try {
      const userId = req.user?.id;
      const userRole = req.user?.userRole;

      // Super admin tem acesso a tudo
      if (userRole === "super_admin") {
        return next();
      }

      // Buscar perfil do usuário
      const userQuery = `
        SELECT profile_id FROM polox.users 
        WHERE id = $1 AND deleted_at IS NULL
      `;
      const userResult = await query(userQuery, [userId]);

      if (userResult.rows.length === 0 || !userResult.rows[0].profile_id) {
        throw new ApiError(403, tc(req, "permissions.noProfileAssigned"));
      }

      const profileId = userResult.rows[0].profile_id;

      // Buscar permissões do perfil
      const profileQuery = `
        SELECT screen_ids, is_active FROM polox.profiles 
        WHERE id = $1 AND deleted_at IS NULL
      `;
      const profileResult = await query(profileQuery, [profileId]);

      if (profileResult.rows.length === 0) {
        throw new ApiError(403, tc(req, "permissions.profileNotFound"));
      }

      const profile = profileResult.rows[0];

      if (!profile.is_active) {
        throw new ApiError(403, tc(req, "permissions.profileInactive"));
      }

      // Verificar se TEM AO MENOS UM screen_id
      const userScreenIds = profile.screen_ids || [];
      const hasPermission = screenIds.some((id) => userScreenIds.includes(id));

      if (!hasPermission) {
        throw new ApiError(
          403,
          tc(req, "permissions.accessDeniedMultiple") ||
            `Acesso negado. Requer uma das permissões: ${screenIds.join(", ")}`
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};

module.exports = {
  checkPermission,
  isSuperAdmin,
  isAdmin,
  checkAnyPermission,
};
