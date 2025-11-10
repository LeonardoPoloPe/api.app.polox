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
 * 👥 CONTROLLER DE USUÁRIOS SIMPLIFICADO
 * ==========================================
 */

// Importar módulos internos
const { query } = require("../config/database");
const { logger, auditLogger } = require("../utils/logger");
const { ApiError, asyncHandler } = require("../utils/errors");
const { tc } = require("../config/i18n");

/**
 * Controller de usuários simplificado
 */
class UserController {
  /**
   * 📋 GET ALL USERS - Listar usuários (versão simplificada)
   */
  static getUsers = asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, search = "", companyId } = req.query;

    try {
      // Log para debug
      logger.info("🔍 GET /users - Parâmetros:", { page, limit, search, companyId });

      let whereClause = "WHERE u.deleted_at IS NULL";
      let queryParams = [];
      let paramIndex = 1;

      // Filtro de busca por nome ou email
      if (search) {
        whereClause += ` AND (u.full_name ILIKE $${paramIndex} OR u.email ILIKE $${paramIndex})`;
        queryParams.push(`%${search}%`);
        paramIndex++;
      }

      // Filtro por companyId
      if (companyId) {
        whereClause += ` AND u.company_id = $${paramIndex}`;
        queryParams.push(companyId);
        paramIndex++;
      }

      // Query para contar total de usuários
      const countResult = await query(
        `
        SELECT COUNT(*) as total 
        FROM users u
        ${whereClause}
      `,
        queryParams
      );

      const totalUsers = parseInt(countResult.rows[0].total);

      // Query para buscar usuários com paginação
      const offset = (page - 1) * limit;
      const usersResult = await query(
        `
        SELECT 
          u.id, u.full_name, u.email, u.user_role, u.company_id, u.profile_id, u.created_at,
          p.name as profile_name
        FROM users u
        LEFT JOIN profiles p ON u.profile_id = p.id AND p.deleted_at IS NULL
        ${whereClause}
        ORDER BY u.created_at DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `,
        [...queryParams, limit, offset]
      );

      // Formatar resposta
      const users = usersResult.rows.map((user) => ({
        id: user.id,
        name: user.full_name,
        email: user.email,
        role: user.user_role,
        companyId: user.company_id,
        profileId: user.profile_id,
        profileName: user.profile_name,
        createdAt: user.created_at,
      }));

      // Log de auditoria
      auditLogger(tc(req, "userController", "audit.users_listed"), {
        userId: req.user?.id,
        companyId: req.user?.companyId,
        count: users.length,
        ip: req.ip,
      });

      // Log de sucesso
      logger.info("✅ GET /users - Usuários encontrados:", {
        total: totalUsers,
        returned: users.length,
        withProfile: users.filter(u => u.profileId).length,
      });

      res.json({
        success: true,
        message: tc(req, "userController", "list.success"),
        data: {
          users,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: totalUsers,
            pages: Math.ceil(totalUsers / limit),
          },
        },
      });
    } catch (error) {
      logger.error("❌ GET /users - Erro:", {
        message: error.message,
        stack: error.stack,
        params: { page, limit, search, companyId }
      });
      throw error;
    }
  });

  /**
   * 👤 GET USER BY ID - Obter usuário específico
   */
  static getUserById = asyncHandler(async (req, res) => {
    const { id } = req.params;

    try {
      const userResult = await query(
        `
        SELECT 
          u.id, u.full_name, u.email, u.user_role, u.company_id, u.profile_id, u.created_at,
          p.name as profile_name
        FROM users u
        LEFT JOIN profiles p ON u.profile_id = p.id AND p.deleted_at IS NULL
        WHERE u.id = $1 AND u.deleted_at IS NULL
      `,
        [id]
      );

      if (userResult.rows.length === 0) {
        throw new ApiError(
          404,
          tc(req, "userController", "validation.user_not_found")
        );
      }

      const user = userResult.rows[0];

      // Log de auditoria
      auditLogger(tc(req, "userController", "audit.user_viewed"), {
        userId: req.user?.id,
        viewedUserId: id,
        ip: req.ip,
      });

      res.json({
        success: true,
        message: tc(req, "userController", "show.success"),
        data: {
          user: {
            id: user.id,
            name: user.full_name,
            email: user.email,
            role: user.user_role,
            companyId: user.company_id,
            profileId: user.profile_id,
            profileName: user.profile_name,
            createdAt: user.created_at,
          },
        },
      });
    } catch (error) {
      throw error;
    }
  });

  /**
   * 📊 GET USER PROFILE - Obter perfil do usuário autenticado
   */
  static getProfile = asyncHandler(async (req, res) => {
    try {
      const userResult = await query(
        `
        SELECT 
          u.id, u.full_name, u.email, u.user_role, u.company_id, u.profile_id, u.created_at,
          p.name as profile_name
        FROM users u
        LEFT JOIN profiles p ON u.profile_id = p.id AND p.deleted_at IS NULL
        WHERE u.id = $1 AND u.deleted_at IS NULL
      `,
        [req.user.id]
      );

      if (userResult.rows.length === 0) {
        throw new ApiError(404, tc(req, "userController", "profile.not_found"));
      }

      const user = userResult.rows[0];

      // Log de auditoria
      auditLogger(tc(req, "userController", "audit.profile_viewed"), {
        userId: req.user.id,
        ip: req.ip,
      });

      res.json({
        success: true,
        message: tc(req, "userController", "profile.get_success"),
        data: {
          user: {
            id: user.id,
            name: user.full_name,
            email: user.email,
            role: user.user_role,
            companyId: user.company_id,
            profileId: user.profile_id,
            profileName: user.profile_name,
            createdAt: user.created_at,
          },
        },
      });
    } catch (error) {
      throw error;
    }
  });

  /**
   * ✏️ UPDATE USER - Atualizar usuário por ID (Admin)
   */
  static updateUser = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { name, email, role, company_id, status, profile_id } = req.body;

    try {
      // Verificar se usuário existe
      const existingUser = await query(
        `
        SELECT id, email, user_role 
        FROM users 
        WHERE id = $1 AND deleted_at IS NULL
      `,
        [id]
      );

      if (existingUser.rows.length === 0) {
        throw new ApiError(
          404,
          tc(req, "userController", "validation.user_not_found")
        );
      }

      const currentUser = existingUser.rows[0];

      // Verificar se email já está em uso por outro usuário
      if (email && email !== currentUser.email) {
        const emailCheck = await query(
          `
          SELECT id FROM users 
          WHERE email = $1 AND id != $2 AND deleted_at IS NULL
        `,
          [email.toLowerCase(), id]
        );

        if (emailCheck.rows.length > 0) {
          throw new ApiError(
            409,
            tc(req, "userController", "validation.email_in_use")
          );
        }
      }

      // Construir query de atualização dinamicamente
      const updates = [];
      const values = [];
      let paramIndex = 1;

      if (name !== undefined) {
        updates.push(`full_name = $${paramIndex}`);
        values.push(name.trim());
        paramIndex++;
      }

      if (email !== undefined) {
        updates.push(`email = $${paramIndex}`);
        values.push(email.toLowerCase());
        paramIndex++;
      }

      if (role !== undefined) {
        updates.push(`user_role = $${paramIndex}`);
        values.push(role);
        paramIndex++;
      }

      if (company_id !== undefined) {
        updates.push(`company_id = $${paramIndex}`);
        values.push(company_id);
        paramIndex++;
      }

      if (status !== undefined) {
        updates.push(`status = $${paramIndex}`);
        values.push(status);
        paramIndex++;
      }

      if (profile_id !== undefined) {
        updates.push(`profile_id = $${paramIndex}`);
        values.push(profile_id);
        paramIndex++;
      }

      if (updates.length === 0) {
        throw new ApiError(
          400,
          tc(req, "userController", "validation.no_fields_to_update")
        );
      }

      updates.push("updated_at = NOW()");
      values.push(id);

      // Atualizar usuário
      const userResult = await query(
        `
        UPDATE users 
        SET ${updates.join(", ")}
        WHERE id = $${paramIndex} AND deleted_at IS NULL
        RETURNING id, full_name, email, user_role, company_id, profile_id, created_at, updated_at
      `,
        values
      );

      const user = userResult.rows[0];

      // Buscar nome do profile
      const profileResult = await query(
        `
        SELECT name as profile_name
        FROM profiles
        WHERE id = $1 AND deleted_at IS NULL
      `,
        [user.profile_id]
      );

      const profileName = profileResult.rows.length > 0 ? profileResult.rows[0].profile_name : null;

      // Log de auditoria
      auditLogger(tc(req, "userController", "audit.user_updated"), {
        adminId: req.user.id,
        updatedUserId: id,
        changes: { name, email, role, company_id, status, profile_id },
        ip: req.ip,
      });

      res.json({
        success: true,
        message: tc(req, "userController", "update.success"),
        data: {
          user: {
            id: user.id,
            name: user.full_name,
            email: user.email,
            role: user.user_role,
            companyId: user.company_id,
            profileId: user.profile_id,
            profileName: profileName,
            createdAt: user.created_at,
            updatedAt: user.updated_at,
          },
        },
      });
    } catch (error) {
      throw error;
    }
  });

  /**
   * ✏️ UPDATE USER PROFILE - Atualizar perfil do usuário
   */
  static updateProfile = asyncHandler(async (req, res) => {
    const { name, email, profile_id } = req.body;

    try {
      // Validações básicas
      if (!name || !email) {
        throw new ApiError(
          400,
          tc(req, "userController", "validation.name_and_email_required")
        );
      }

      // Verificar se email já existe para outro usuário
      if (email !== req.user.email) {
        const existingUser = await query(
          `
          SELECT id FROM users 
          WHERE email = $1 AND id != $2 AND deleted_at IS NULL
        `,
          [email.toLowerCase(), req.user.id]
        );

        if (existingUser.rows.length > 0) {
          throw new ApiError(
            409,
            tc(req, "userController", "validation.email_in_use")
          );
        }
      }

      // Construir query de atualização
      const updates = ['full_name = $1', 'email = $2', 'updated_at = NOW()'];
      const values = [name.trim(), email.toLowerCase()];
      let paramIndex = 3;

      if (profile_id !== undefined) {
        updates.push(`profile_id = $${paramIndex}`);
        values.push(profile_id);
        paramIndex++;
      }

      values.push(req.user.id);

      // Atualizar usuário
      const userResult = await query(
        `
        UPDATE users 
        SET ${updates.join(", ")}
        WHERE id = $${paramIndex} AND deleted_at IS NULL
        RETURNING id, full_name, email, user_role, company_id, profile_id, created_at, updated_at
      `,
        values
      );

      if (userResult.rows.length === 0) {
        throw new ApiError(404, tc(req, "userController", "profile.not_found"));
      }

      const user = userResult.rows[0];

      // Buscar nome do profile
      const profileResult = await query(
        `
        SELECT name as profile_name
        FROM profiles
        WHERE id = $1 AND deleted_at IS NULL
      `,
        [user.profile_id]
      );

      const profileName = profileResult.rows.length > 0 ? profileResult.rows[0].profile_name : null;

      // Log de auditoria
      auditLogger(tc(req, "userController", "audit.profile_updated"), {
        userId: req.user.id,
        changes: { name, email, profile_id },
        ip: req.ip,
      });

      res.json({
        success: true,
        message: tc(req, "userController", "profile.update_success"),
        data: {
          user: {
            id: user.id,
            name: user.full_name,
            email: user.email,
            role: user.user_role,
            companyId: user.company_id,
            profileId: user.profile_id,
            profileName: profileName,
            createdAt: user.created_at,
            updatedAt: user.updated_at,
          },
        },
      });
    } catch (error) {
      throw error;
    }
  });

  /**
   * ✨ CREATE USER - Criar novo usuário (admin)
   */
  static createUser = asyncHandler(async (req, res) => {
    const { name, email, password, role = "user", company_id, profile_id } = req.body;

    try {
      // Validações básicas
      if (!name || !email || !password) {
        throw new ApiError(
          400,
          tc(req, "userController", "validation.name_email_password_required")
        );
      }

      if (password.length < 6) {
        throw new ApiError(
          400,
          tc(req, "userController", "validation.password_min_length")
        );
      }

      // Determinar company_id: usar o do body se fornecido, senão usar do usuário autenticado
      const targetCompanyId =
        company_id || req.user.company_id || req.user.companyId;

      if (!targetCompanyId) {
        throw new ApiError(
          400,
          tc(req, "userController", "validation.company_id_required")
        );
      }

      // Verificar se email já existe
      const existingUser = await query(
        `
        SELECT id FROM users 
        WHERE email = $1 AND deleted_at IS NULL
      `,
        [email.toLowerCase()]
      );

      if (existingUser.rows.length > 0) {
        throw new ApiError(
          409,
          tc(req, "userController", "validation.email_in_use")
        );
      }

      // Criptografar senha
      const bcrypt = require("bcryptjs");
      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      // Criar usuário
      const userResult = await query(
        `
        INSERT INTO users (
          full_name, email, password_hash, user_role, company_id, profile_id
        ) VALUES (
          $1, $2, $3, $4, $5, $6
        ) RETURNING id, full_name, email, user_role, company_id, profile_id, created_at
      `,
        [
          name.trim(),
          email.toLowerCase(),
          hashedPassword,
          role,
          parseInt(targetCompanyId),
          profile_id || null,
        ]
      );

      const newUser = userResult.rows[0];

      // Buscar nome do profile se existir
      let profileName = null;
      if (newUser.profile_id) {
        const profileResult = await query(
          `
          SELECT name as profile_name
          FROM profiles
          WHERE id = $1 AND deleted_at IS NULL
        `,
          [newUser.profile_id]
        );
        profileName = profileResult.rows.length > 0 ? profileResult.rows[0].profile_name : null;
      }

      // Log de auditoria
      auditLogger(tc(req, "userController", "audit.user_created"), {
        userId: req.user.id,
        createdUserId: newUser.id,
        createdUserEmail: newUser.email,
        ip: req.ip,
      });

      res.status(201).json({
        success: true,
        message: tc(req, "userController", "create.success"),
        data: {
          user: {
            id: newUser.id,
            name: newUser.full_name,
            email: newUser.email,
            role: newUser.user_role,
            companyId: newUser.company_id,
            profileId: newUser.profile_id,
            profileName: profileName,
            createdAt: newUser.created_at,
          },
        },
      });
    } catch (error) {
      throw error;
    }
  });

  /**
   * 🔑 RESET PASSWORD - Resetar senha do usuário
   */
  static resetPassword = asyncHandler(async (req, res) => {
    const { userId } = req.params;
    const { newPassword } = req.body;

    try {
      // Validações básicas
      if (!newPassword) {
        throw new ApiError(
          400,
          tc(req, "userController", "validation.new_password_required")
        );
      }

      if (newPassword.length < 6) {
        throw new ApiError(
          400,
          tc(req, "userController", "validation.password_min_length")
        );
      }

      // Verificar se usuário existe
      const userResult = await query(
        `
        SELECT id, email, full_name FROM users 
        WHERE id = $1 AND deleted_at IS NULL
      `,
        [userId]
      );

      if (userResult.rows.length === 0) {
        throw new ApiError(
          404,
          tc(req, "userController", "validation.user_not_found")
        );
      }

      const user = userResult.rows[0];

      // Criptografar nova senha
      const bcrypt = require("bcryptjs");
      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

      // Atualizar senha
      await query(
        `
        UPDATE users 
        SET password_hash = $1, updated_at = NOW()
        WHERE id = $2
      `,
        [hashedPassword, userId]
      );

      // Log de auditoria
      auditLogger(tc(req, "userController", "audit.password_reset"), {
        userId: req.user.id,
        targetUserId: userId,
        targetUserEmail: user.email,
        ip: req.ip,
      });

      res.json({
        success: true,
        message: tc(req, "userController", "reset_password.success"),
        data: {
          userId: parseInt(userId),
          email: user.email,
        },
      });
    } catch (error) {
      throw error;
    }
  });

  /**
   * 🔑 CHANGE PASSWORD - Alterar própria senha
   */
  static changePassword = asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    try {
      // Validações básicas
      if (!currentPassword || !newPassword) {
        throw new ApiError(
          400,
          tc(
            req,
            "userController",
            "validation.current_and_new_password_required"
          )
        );
      }

      if (newPassword.length < 6) {
        throw new ApiError(
          400,
          tc(req, "userController", "validation.password_min_length")
        );
      }

      // Buscar usuário atual
      const userResult = await query(
        `
        SELECT id, email, password_hash, full_name FROM users 
        WHERE id = $1 AND deleted_at IS NULL
      `,
        [req.user.id]
      );

      if (userResult.rows.length === 0) {
        throw new ApiError(
          404,
          tc(req, "userController", "validation.user_not_found")
        );
      }

      const user = userResult.rows[0];

      // Verificar senha atual
      const bcrypt = require("bcryptjs");
      const isValidPassword = await bcrypt.compare(
        currentPassword,
        user.password_hash
      );

      if (!isValidPassword) {
        throw new ApiError(
          401,
          tc(req, "userController", "validation.invalid_current_password")
        );
      }

      // Criptografar nova senha
      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

      // Atualizar senha
      await query(
        `
        UPDATE users 
        SET password_hash = $1, updated_at = NOW()
        WHERE id = $2
      `,
        [hashedPassword, req.user.id]
      );

      // Log de auditoria
      auditLogger(tc(req, "userController", "audit.password_changed"), {
        userId: req.user.id,
        email: user.email,
        ip: req.ip,
      });

      res.json({
        success: true,
        message: tc(req, "userController", "change_password.success"),
      });
    } catch (error) {
      throw error;
    }
  });

  /**
   * 🎯 Busca perfil do usuário com menus vinculados
   * Usado no login para carregar menu dinâmico do usuário
   * Usa o ID do usuário autenticado (req.user.id) do token JWT
   */
  static getUserProfileWithMenus = asyncHandler(async (req, res) => {
    try {
      const userId = req.user.id; // Pega ID do usuário autenticado
      const lang = req.headers["accept-language"] || "pt-BR";

      logger.info("getUserProfileWithMenus: Iniciando busca", {
        userId,
        userEmail: req.user.email,
        lang,
      });

      // 1. Buscar usuário com profile
      const userQuery = `
        SELECT 
          u.id, u.full_name, u.email, u.user_role, u.company_id, u.profile_id,
          p.id as profile_id, p.name as profile_name, p.screen_ids,
          p.translations as profile_translations
        FROM users u
        LEFT JOIN profiles p ON u.profile_id = p.id AND p.deleted_at IS NULL
        WHERE u.id = $1 AND u.deleted_at IS NULL
      `;

      const userResult = await query(userQuery, [userId]);

      if (userResult.rows.length === 0) {
        throw new ApiError(
          404,
          tc(req, "userController", "get_profile_menu.user_not_found")
        );
      }

      const user = userResult.rows[0];

      // Se não tem perfil, retorna só os dados do usuário
      if (!user.profile_id) {
        logger.info("getUserProfileWithMenus: Usuário sem perfil", { userId });
        return res.json({
          success: true,
          message: tc(req, "userController", "get_profile_menu.no_profile"),
          data: {
            user: {
              id: user.id,
              fullName: user.full_name,
              email: user.email,
              role: user.user_role,
              companyId: user.company_id,
              profileId: null,
              profileName: null,
            },
            profile: null,
            menus: [],
          },
        });
      }

      // 2. Buscar menus permitidos pelo perfil
      const screenIds = user.screen_ids || [];

      if (screenIds.length === 0) {
        logger.info(
          "getUserProfileWithMenus: Perfil sem screen_ids definidos",
          { userId, profileId: user.profile_id }
        );
        return res.json({
          success: true,
          message: tc(
            req,
            "userController",
            "get_profile_menu.no_permissions"
          ),
          data: {
            user: {
              id: user.id,
              fullName: user.full_name,
              email: user.email,
              role: user.user_role,
              companyId: user.company_id,
              profileId: user.profile_id,
              profileName: user.profile_name,
            },
            profile: {
              id: user.profile_id,
              name: user.profile_name,
              translations: user.profile_translations,
            },
            menus: [],
          },
        });
      }

      // 3. Buscar menu_items baseado nos screen_ids do perfil
      // Converter screen_ids (TEXT[]) para BIGINT[] para comparação
      const menuQuery = `
        SELECT 
          m.id, m.label, m.icon, m.route, m.translations,
          m.order_position, m.parent_id, m.is_active,
          m.visible_to_all, m.root_only_access,
          m.svg_color, m.background_color, m.text_color
        FROM polox.menu_items m
        WHERE m.id = ANY(
          SELECT CAST(unnest($1::text[]) AS BIGINT)
        )
          AND m.deleted_at IS NULL
          AND m.is_active = true
        ORDER BY m.order_position ASC, m.id ASC
      `;

      const menuResult = await query(menuQuery, [screenIds]);
      const allMenus = menuResult.rows;

      // 4. Filtrar por root_only_access se usuário não for super_admin
      let finalMenus = allMenus;
      if (user.user_role !== "super_admin") {
        finalMenus = allMenus.filter((menu) => !menu.root_only_access);
      }

      // 6. Construir hierarquia de menus (parent_id)
      const buildMenuTree = (menus) => {
        const menuMap = {};
        const rootMenus = [];

        // Criar mapa de menus por ID
        menus.forEach((menu) => {
          // Traduzir label se disponível
          const translatedLabel =
            menu.translations && menu.translations[lang]
              ? menu.translations[lang]
              : menu.label;

          menuMap[menu.id] = {
            id: menu.id,
            label: translatedLabel,
            icon: menu.icon,
            route: menu.route,
            orderPosition: menu.order_position,
            parentId: menu.parent_id,
            isActive: menu.is_active,
            visibleToAll: menu.visible_to_all,
            rootOnlyAccess: menu.root_only_access,
            svgColor: menu.svg_color,
            backgroundColor: menu.background_color,
            textColor: menu.text_color,
            children: [],
          };
        });

        // Construir árvore
        menus.forEach((menu) => {
          const menuNode = menuMap[menu.id];
          if (menu.parent_id && menuMap[menu.parent_id]) {
            menuMap[menu.parent_id].children.push(menuNode);
          } else {
            rootMenus.push(menuNode);
          }
        });

        return rootMenus;
      };

      const menuTree = buildMenuTree(finalMenus);

      logger.info("getUserProfileWithMenus: Menus carregados com sucesso", {
        userId,
        profileId: user.profile_id,
        totalMenus: finalMenus.length,
        rootMenus: menuTree.length,
      });

      // 7. Retornar resposta com usuário, perfil e menus
      res.json({
        success: true,
        message: tc(req, "userController", "get_profile_menu.success"),
        data: {
          user: {
            id: user.id,
            fullName: user.full_name,
            email: user.email,
            role: user.user_role,
            companyId: user.company_id,
            profileId: user.profile_id,
            profileName: user.profile_name,
          },
          profile: {
            id: user.profile_id,
            name: user.profile_name,
            translations: user.profile_translations,
            screenIds: user.screen_ids,
          },
          menus: menuTree,
        },
      });
    } catch (error) {
      logger.error("getUserProfileWithMenus: Erro ao buscar perfil e menus", {
        error: error.message,
        stack: error.stack,
        userId: req.params.id,
      });
      throw error;
    }
  });
}

module.exports = UserController;
