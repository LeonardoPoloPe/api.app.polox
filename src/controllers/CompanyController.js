/**
 * ==========================================
 * 🏢 COMPANY CONTROLLER ENTERPRISE
 * ==========================================
 *
 * Gestão completa de empresas para Super Admin
 * - CRUD de empresas
 * - Gestão de módulos e status
 * - Analytics e estatísticas
 * - Criação automática de admin
 */

const {
  query,
  beginTransaction,
  commitTransaction,
  rollbackTransaction,
} = require("../models/database");
const { logger, auditLogger, securityLogger } = require("../utils/logger");
const { ApiError, asyncHandler } = require("../utils/errors");
const { successResponse, paginatedResponse } = require("../utils/response");
const bcrypt = require("bcryptjs");
const Joi = require("joi");

class CompanyController {
  /**
   * 🔒 MIDDLEWARE - Verificar se é Super Admin
   */
  static requireSuperAdmin = asyncHandler(async (req, res, next) => {
    if (req.user.role !== "super_admin") {
      securityLogger(
        "Tentativa de acesso não autorizado ao CompanyController",
        {
          userId: req.user.id,
          userRole: req.user.role,
          ip: req.ip,
          userAgent: req.get("User-Agent"),
        }
      );

      throw new ApiError(403, "Super Admin access required");
    }
    next();
  });

  /**
   * 📝 VALIDAÇÕES JOI
   */
  static createCompanySchema = Joi.object({
    name: Joi.string().min(2).max(255).required().messages({
      "string.min": "Nome da empresa deve ter pelo menos 2 caracteres",
      "any.required": "Nome da empresa é obrigatório",
    }),
    domain: Joi.string()
      .min(2)
      .max(100)
      .pattern(/^[a-zA-Z0-9-]+$/)
      .required()
      .messages({
        "string.pattern.base":
          "Domínio deve conter apenas letras, números e hífens",
        "any.required": "Domínio é obrigatório",
      }),
    plan: Joi.string()
      .valid("starter", "professional", "enterprise")
      .default("starter"),
    industry: Joi.string().max(100).allow("").default(""),
    company_size: Joi.string().max(50).allow("").default(""),
    admin_name: Joi.string().min(2).max(255).required().messages({
      "any.required": "Nome do administrador é obrigatório",
    }),
    admin_email: Joi.string().email().required().messages({
      "string.email": "Email do administrador deve ser válido",
      "any.required": "Email do administrador é obrigatório",
    }),
    admin_phone: Joi.string().max(20).allow("").default(""),
    enabled_modules: Joi.array()
      .items(Joi.string())
      .default(["dashboard", "users"]),
    settings: Joi.object().default({
      maxUploadSize: "5MB",
      maxTextLength: 40,
      supportEmail: "",
    }),
  });

  static updateCompanySchema = Joi.object({
    name: Joi.string().min(2).max(255),
    plan: Joi.string().valid("starter", "professional", "enterprise"),
    industry: Joi.string().max(100),
    company_size: Joi.string().max(50),
    admin_name: Joi.string().min(2).max(255),
    admin_email: Joi.string().email(),
    admin_phone: Joi.string().max(20),
    enabled_modules: Joi.array().items(Joi.string()),
    settings: Joi.object(),
  });

  /**
   * 📋 LISTAR EMPRESAS
   * GET /api/companies
   */
  static index = asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = (page - 1) * limit;

    let whereClause = "WHERE c.deleted_at IS NULL";
    let queryParams = [];
    let paramCount = 0;

    // 🔍 FILTROS
    if (req.query.status) {
      whereClause += ` AND c.status = $${++paramCount}`;
      queryParams.push(req.query.status);
    }

    if (req.query.plan) {
      whereClause += ` AND c.plan = $${++paramCount}`;
      queryParams.push(req.query.plan);
    }

    if (req.query.search) {
      whereClause += ` AND (c.name ILIKE $${++paramCount} OR c.domain ILIKE $${++paramCount})`;
      queryParams.push(`%${req.query.search}%`, `%${req.query.search}%`);
      paramCount++; // Segundo parâmetro
    }

    // 📊 QUERY PRINCIPAL COM ESTATÍSTICAS
    const companiesQuery = `
      SELECT 
        c.*,
        COUNT(DISTINCT u.id) as users_count,
        COUNT(DISTINCT CASE 
          WHEN u.last_login_at > NOW() - INTERVAL '30 days' 
          THEN u.id 
        END) as active_users,
        COUNT(DISTINCT CASE 
          WHEN u.last_login_at > NOW() - INTERVAL '7 days' 
          THEN u.id 
        END) as weekly_active_users,
        MAX(u.last_login_at) as last_activity,
        (
          SELECT json_agg(json_build_object(
            'level', ugp.current_level,
            'total_xp', ugp.total_xp
          ))
          FROM user_gamification_profiles ugp
          WHERE ugp.company_id = c.id
          LIMIT 5
        ) as top_players
      FROM polox.companies c
      LEFT JOIN polox.users u ON c.id = u.company_id AND u.deleted_at IS NULL
      ${whereClause}
      GROUP BY c.id
      ORDER BY 
        CASE WHEN $${paramCount + 3} = 'name' THEN c.name END ASC,
        CASE WHEN $${paramCount + 3} = 'created_at' THEN c.created_at END DESC,
        CASE WHEN $${
          paramCount + 3
        } = 'users_count' THEN COUNT(DISTINCT u.id) END DESC,
        c.name ASC
      LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
    `;

    queryParams.push(limit, offset, req.query.sort || "name");

    // 📊 QUERY DE CONTAGEM
    const countQuery = `
      SELECT COUNT(DISTINCT c.id) as total 
      FROM polox.companies c 
      ${whereClause}
    `;

    const [companiesResult, countResult] = await Promise.all([
      query(companiesQuery, queryParams),
      query(countQuery, queryParams.slice(0, -3)),
    ]);

    logger.info("Empresas listadas pelo Super Admin", {
      superAdminId: req.user.id,
      companiesFound: companiesResult.rows.length,
      filters: {
        status: req.query.status,
        plan: req.query.plan,
        search: req.query.search,
      },
    });

    return paginatedResponse(res, companiesResult.rows, {
      page,
      limit,
      total: parseInt(countResult.rows[0].total),
    });
  });

  /**
   * ➕ CRIAR EMPRESA
   * POST /api/companies
   */
  static create = asyncHandler(async (req, res) => {
    const { error, value } = CompanyController.createCompanySchema.validate(
      req.body
    );
    if (error) throw new ApiError(400, error.details[0].message);

    const companyData = value;

    // 🔍 VERIFICAR SE DOMÍNIO JÁ EXISTE
    const domainCheck = await query(
      "SELECT id, name FROM polox.companies WHERE domain = $1 AND deleted_at IS NULL",
      [companyData.domain]
    );

    if (domainCheck.rows.length > 0) {
      throw new ApiError(
        400,
        `Domínio '${companyData.domain}' já está em uso pela empresa: ${domainCheck.rows[0].name}`
      );
    }

    // 🔍 VERIFICAR SE EMAIL DO ADMIN JÁ EXISTE
    const emailCheck = await query(
      "SELECT id, name FROM polox.users WHERE email = $1 AND deleted_at IS NULL",
      [companyData.admin_email]
    );

    if (emailCheck.rows.length > 0) {
      throw new ApiError(
        400,
        `Email '${companyData.admin_email}' já está em uso por outro usuário`
      );
    }

    // 🔐 INICIAR TRANSAÇÃO
    const client = await beginTransaction();
    let committed = false;

    try {
      // 1️⃣ CRIAR EMPRESA
      const companySlug = companyData.domain
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, "");

      const createCompanyQuery = `
        INSERT INTO polox.companies (
          name, domain, slug, plan, industry, company_size,
          admin_name, admin_email, admin_phone,
          enabled_modules, settings, status, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'active', NOW(), NOW())
        RETURNING *
      `;

      const companyResult = await client.query(createCompanyQuery, [
        companyData.name,
        companyData.domain,
        companySlug,
        companyData.plan,
        companyData.industry,
        companyData.company_size,
        companyData.admin_name,
        companyData.admin_email,
        companyData.admin_phone,
        JSON.stringify(companyData.enabled_modules),
        JSON.stringify(companyData.settings),
      ]);

      const newCompany = companyResult.rows[0];

      // 2️⃣ CRIAR USUÁRIO ADMIN DA EMPRESA
      const hashedPassword = await bcrypt.hash("admin123", 12); // Senha temporária

      const createAdminQuery = `
        INSERT INTO polox.users (
          company_id, name, email, password_hash, role, 
          phone, status, permissions, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, 'company_admin', $5, 'active', $6, NOW(), NOW())
        RETURNING id, name, email, role, status
      `;

      const adminResult = await client.query(createAdminQuery, [
        newCompany.id,
        companyData.admin_name,
        companyData.admin_email,
        hashedPassword,
        companyData.admin_phone,
        JSON.stringify(["*"]), // Admin tem todas as permissões
      ]);

      const newAdmin = adminResult.rows[0];

      // 3️⃣ CRIAR PERFIL DE GAMIFICAÇÃO PARA O ADMIN
      await client.query(
        `
        INSERT INTO user_gamification_profiles (
          user_id, company_id, current_level, total_xp, total_coins, 
          available_coins, created_at, updated_at
        ) VALUES ($1, $2, 1, 0, 100, 100, NOW(), NOW())
      `,
        [newAdmin.id, newCompany.id]
      );

      // 4️⃣ CRIAR CONQUISTAS PADRÃO DA EMPRESA
      const defaultAchievements = [
        {
          name: "Primeiro Login",
          description: "Fez login pela primeira vez no sistema",
          category: "onboarding",
          unlock_criteria: JSON.stringify({ action: "first_login" }),
          xp_reward: 10,
          coin_reward: 5,
        },
        {
          name: "Primeiro Cliente",
          description: "Cadastrou o primeiro cliente",
          category: "business",
          unlock_criteria: JSON.stringify({ action: "first_client" }),
          xp_reward: 50,
          coin_reward: 25,
        },
        {
          name: "Vendedor Iniciante",
          description: "Realizou sua primeira venda",
          category: "sales",
          unlock_criteria: JSON.stringify({ action: "first_sale" }),
          xp_reward: 75,
          coin_reward: 50,
        },
      ];

      for (const achievement of defaultAchievements) {
        await client.query(
          `
          INSERT INTO achievements (
            company_id, name, description, category,
            criteria, xp_reward, coin_reward, is_active, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, true, NOW())
        `,
          [
            newCompany.id,
            achievement.name,
            achievement.description,
            achievement.category,
            achievement.unlock_criteria,
            achievement.xp_reward,
            achievement.coin_reward,
          ]
        );
      }

      await commitTransaction(client);
      committed = true;

      // 📝 LOG DE AUDITORIA
      auditLogger("Company created", {
        superAdminId: req.user.id,
        companyId: newCompany.id,
        companyName: newCompany.name,
        adminEmail: newAdmin.email,
        plan: newCompany.plan,
        modules: companyData.enabled_modules,
        ip: req.ip,
      });

      logger.info("Nova empresa criada com sucesso", {
        superAdminId: req.user.id,
        companyId: newCompany.id,
        companyName: newCompany.name,
        domain: newCompany.domain,
        adminEmail: newAdmin.email,
      });

      return successResponse(
        res,
        {
          company: {
            ...newCompany,
            enabled_modules:
              typeof newCompany.enabled_modules === "string"
                ? JSON.parse(newCompany.enabled_modules)
                : newCompany.enabled_modules,
            settings:
              typeof newCompany.settings === "string"
                ? JSON.parse(newCompany.settings)
                : newCompany.settings,
          },
          admin: newAdmin,
          temp_password:
            process.env.DEFAULT_ADMIN_PASSWORD ||
            Math.random().toString(36).slice(-8) +
              Math.random().toString(36).slice(-8).toUpperCase() +
              "123!",
          login_url: `https://${newCompany.domain}.crm.ze9.com.br`,
        },
        "Empresa criada com sucesso",
        201
      );
    } catch (error) {
      if (!committed) {
        await rollbackTransaction(client);
      }
      throw error;
    }
  });

  /**
   * 👁️ OBTER EMPRESA
   * GET /api/companies/:id
   */
  static show = asyncHandler(async (req, res) => {
    const companyId = req.params.id;

    const companyQuery = `
      SELECT 
        c.*,
        COUNT(DISTINCT u.id) as users_count,
        COUNT(DISTINCT CASE 
          WHEN u.last_login_at > NOW() - INTERVAL '30 days' 
          THEN u.id 
        END) as active_users,
        COUNT(DISTINCT CASE 
          WHEN u.status = 'active' 
          THEN u.id 
        END) as active_users_total,
        MAX(u.last_login_at) as last_activity,
        MIN(u.created_at) as first_user_created,
        (
          SELECT json_agg(json_build_object(
            'id', u2.id,
            'name', u2.name,
            'email', u2.email,
            'role', u2.role,
            'last_login_at', u2.last_login_at
          ) ORDER BY u2.created_at ASC)
          FROM users u2 
          WHERE u2.company_id = c.id AND u2.deleted_at IS NULL
          LIMIT 10
        ) as recent_users,
        (
          SELECT json_agg(json_build_object(
            'user_name', u3.name,
            'level', ugp.current_level,
            'total_xp', ugp.total_xp
          ) ORDER BY ugp.total_xp DESC)
          FROM user_gamification_profiles ugp
          JOIN users u3 ON ugp.user_id = u3.id
          WHERE ugp.company_id = c.id
          LIMIT 5
        ) as top_players
      FROM polox.companies c
      LEFT JOIN polox.users u ON c.id = u.company_id AND u.deleted_at IS NULL
      WHERE c.id = $1 AND c.deleted_at IS NULL
      GROUP BY c.id
    `;

    const result = await query(companyQuery, [companyId]);

    if (result.rows.length === 0) {
      throw new ApiError(404, "Empresa não encontrada");
    }

    const company = result.rows[0];

    // Parse JSON fields
    company.enabled_modules = JSON.parse(company.enabled_modules || "[]");
    company.settings = JSON.parse(company.settings || "{}");

    logger.info("Detalhes da empresa visualizados", {
      superAdminId: req.user.id,
      companyId: company.id,
      companyName: company.name,
    });

    return successResponse(res, company);
  });

  /**
   * 📊 ESTATÍSTICAS GLOBAIS
   * GET /api/companies/stats
   */
  static getGlobalStats = asyncHandler(async (req, res) => {
    const statsQuery = `
      SELECT 
        COUNT(DISTINCT c.id) as total_companies,
        COUNT(DISTINCT CASE WHEN c.status = 'active' THEN c.id END) as active_companies,
        COUNT(DISTINCT CASE WHEN c.status = 'inactive' THEN c.id END) as inactive_companies,
        COUNT(DISTINCT CASE WHEN c.status = 'trial' THEN c.id END) as trial_companies,
        COUNT(DISTINCT u.id) as total_users,
        COUNT(DISTINCT CASE 
          WHEN u.last_login_at > NOW() - INTERVAL '30 days' 
          THEN u.id 
        END) as active_users_30d,
        COUNT(DISTINCT CASE 
          WHEN u.last_login_at > NOW() - INTERVAL '7 days' 
          THEN u.id 
        END) as active_users_7d,
        AVG(user_counts.user_count) as avg_users_per_company,
        COUNT(DISTINCT CASE WHEN c.plan = 'starter' THEN c.id END) as starter_companies,
        COUNT(DISTINCT CASE WHEN c.plan = 'professional' THEN c.id END) as professional_companies,
        COUNT(DISTINCT CASE WHEN c.plan = 'enterprise' THEN c.id END) as enterprise_companies
      FROM polox.companies c
      LEFT JOIN polox.users u ON c.id = u.company_id AND u.deleted_at IS NULL
      LEFT JOIN (
        SELECT company_id, COUNT(*) as user_count
        FROM polox.users 
        WHERE deleted_at IS NULL
        GROUP BY company_id
      ) user_counts ON c.id = user_counts.company_id
      WHERE c.deleted_at IS NULL
    `;

    const result = await query(statsQuery);
    const stats = result.rows[0];

    // Converter para números
    Object.keys(stats).forEach((key) => {
      if (stats[key] !== null) {
        stats[key] = parseFloat(stats[key]);
      }
    });

    // Estatísticas de crescimento por mês
    const growthQuery = `
      SELECT 
        DATE_TRUNC('month', created_at) as month,
        COUNT(*) as new_companies
      FROM polox.companies 
      WHERE deleted_at IS NULL 
        AND created_at >= NOW() - INTERVAL '12 months'
      GROUP BY DATE_TRUNC('month', created_at)
      ORDER BY month DESC
    `;

    const growthResult = await query(growthQuery);

    logger.info("Estatísticas globais consultadas", {
      superAdminId: req.user.id,
      totalCompanies: stats.total_companies,
    });

    return successResponse(res, {
      ...stats,
      growth_by_month: growthResult.rows,
    });
  });

  /**
   * ✏️ ATUALIZAR EMPRESA
   * PUT /api/companies/:id
   */
  static update = asyncHandler(async (req, res) => {
    const companyId = req.params.id;

    const { error, value } = CompanyController.updateCompanySchema.validate(
      req.body
    );
    if (error) throw new ApiError(400, error.details[0].message);

    const updateData = value;

    // Verificar se empresa existe
    const existingCompany = await query(
      "SELECT * FROM polox.companies WHERE id = $1 AND deleted_at IS NULL",
      [companyId]
    );

    if (existingCompany.rows.length === 0) {
      throw new ApiError(404, "Empresa não encontrada");
    }

    // Construir query de atualização dinamicamente
    const setClause = [];
    const queryParams = [];
    let paramCount = 0;

    Object.entries(updateData).forEach(([key, value]) => {
      if (value !== undefined) {
        if (key === "enabled_modules" || key === "settings") {
          setClause.push(`${key} = $${++paramCount}`);
          queryParams.push(JSON.stringify(value));
        } else {
          setClause.push(`${key} = $${++paramCount}`);
          queryParams.push(value);
        }
      }
    });

    if (setClause.length === 0) {
      throw new ApiError(400, "Nenhum campo para atualizar");
    }

    setClause.push(`updated_at = NOW()`);
    queryParams.push(companyId);

    const updateQuery = `
      UPDATE polox.companies 
      SET ${setClause.join(", ")}
      WHERE id = $${++paramCount} AND deleted_at IS NULL
      RETURNING *
    `;

    const result = await query(updateQuery, queryParams);
    const updatedCompany = result.rows[0];

    // Parse JSON fields
    updatedCompany.enabled_modules = JSON.parse(
      updatedCompany.enabled_modules || "[]"
    );
    updatedCompany.settings = JSON.parse(updatedCompany.settings || "{}");

    // Log de auditoria
    auditLogger("Company updated", {
      superAdminId: req.user.id,
      companyId: updatedCompany.id,
      companyName: updatedCompany.name,
      changedFields: Object.keys(updateData),
      ip: req.ip,
    });

    return successResponse(
      res,
      updatedCompany,
      "Empresa atualizada com sucesso"
    );
  });

  /**
   * 🗑️ DELETAR EMPRESA (Soft Delete)
   * DELETE /api/companies/:id
   */
  static destroy = asyncHandler(async (req, res) => {
    const companyId = req.params.id;

    // Verificar empresa existe
    const existingCompany = await query(
      "SELECT * FROM polox.companies WHERE id = $1 AND deleted_at IS NULL",
      [companyId]
    );

    if (existingCompany.rows.length === 0) {
      throw new ApiError(404, "Empresa não encontrada");
    }

    const company = existingCompany.rows[0];

    // Soft delete da empresa e todos os usuários
    const client = await beginTransaction();

    try {
      // Deletar empresa
      await client.query(
        "UPDATE polox.companies SET deleted_at = NOW() WHERE id = $1",
        [companyId]
      );

      // Deletar todos os usuários da empresa
      await client.query(
        "UPDATE users SET deleted_at = NOW() WHERE company_id = $1 AND deleted_at IS NULL",
        [companyId]
      );

      await commitTransaction(client);

      // Log de auditoria
      auditLogger("Company deleted", {
        superAdminId: req.user.id,
        companyId: company.id,
        companyName: company.name,
        ip: req.ip,
      });

      securityLogger("Empresa deletada pelo Super Admin", {
        superAdminId: req.user.id,
        companyId: company.id,
        companyName: company.name,
        ip: req.ip,
      });

      return successResponse(res, null, "Empresa deletada com sucesso");
    } catch (error) {
      await rollbackTransaction(client);
      throw error;
    }
  });

  /**
   * 🔧 GERENCIAR MÓDULOS
   * PUT /api/companies/:id/modules
   */
  static updateModules = asyncHandler(async (req, res) => {
    const companyId = req.params.id;
    const { enabled_modules } = req.body;

    if (!Array.isArray(enabled_modules)) {
      throw new ApiError(400, "enabled_modules deve ser um array");
    }

    const validModules = [
      "dashboard",
      "users",
      "leads",
      "clients",
      "sales",
      "reports",
      "gamification",
    ];
    const invalidModules = enabled_modules.filter(
      (module) => !validModules.includes(module)
    );

    if (invalidModules.length > 0) {
      throw new ApiError(
        400,
        `Módulos inválidos: ${invalidModules.join(", ")}`
      );
    }

    const result = await query(
      "UPDATE polox.companies SET enabled_modules = $1, updated_at = NOW() WHERE id = $2 AND deleted_at IS NULL RETURNING *",
      [JSON.stringify(enabled_modules), companyId]
    );

    if (result.rows.length === 0) {
      throw new ApiError(404, "Empresa não encontrada");
    }

    const updatedCompany = result.rows[0];
    updatedCompany.enabled_modules = JSON.parse(updatedCompany.enabled_modules);

    auditLogger("Company modules updated", {
      superAdminId: req.user.id,
      companyId: updatedCompany.id,
      companyName: updatedCompany.name,
      newModules: enabled_modules,
      ip: req.ip,
    });

    return successResponse(
      res,
      updatedCompany,
      "Módulos atualizados com sucesso"
    );
  });

  /**
   * 🔄 ALTERAR STATUS
   * PUT /api/companies/:id/status
   */
  static updateStatus = asyncHandler(async (req, res) => {
    const companyId = req.params.id;
    const { status } = req.body;

    if (!["active", "inactive", "trial"].includes(status)) {
      throw new ApiError(400, "Status deve ser: active, inactive ou trial");
    }

    const result = await query(
      "UPDATE polox.companies SET status = $1, updated_at = NOW() WHERE id = $2 AND deleted_at IS NULL RETURNING *",
      [status, companyId]
    );

    if (result.rows.length === 0) {
      throw new ApiError(404, "Empresa não encontrada");
    }

    const updatedCompany = result.rows[0];

    auditLogger("Company status updated", {
      superAdminId: req.user.id,
      companyId: updatedCompany.id,
      companyName: updatedCompany.name,
      newStatus: status,
      ip: req.ip,
    });

    return successResponse(
      res,
      updatedCompany,
      "Status atualizado com sucesso"
    );
  });

  /**
   * 📈 ANALYTICS DA EMPRESA
   * GET /api/companies/:id/analytics
   */
  static getAnalytics = asyncHandler(async (req, res) => {
    const companyId = req.params.id;

    // Verificar se empresa existe
    const companyCheck = await query(
      "SELECT name FROM polox.companies WHERE id = $1 AND deleted_at IS NULL",
      [companyId]
    );

    if (companyCheck.rows.length === 0) {
      throw new ApiError(404, "Empresa não encontrada");
    }

    const analyticsQuery = `
      SELECT 
        -- Usuários
        COUNT(DISTINCT u.id) as total_users,
        COUNT(DISTINCT CASE WHEN u.status = 'active' THEN u.id END) as active_users,
        COUNT(DISTINCT CASE WHEN u.last_login_at > NOW() - INTERVAL '30 days' THEN u.id END) as users_active_30d,
        COUNT(DISTINCT CASE WHEN u.last_login_at > NOW() - INTERVAL '7 days' THEN u.id END) as users_active_7d,
        
        -- Gamificação
        COALESCE(SUM(ugp.total_xp), 0) as total_xp_company,
        COALESCE(AVG(ugp.total_xp), 0) as avg_xp_per_user,
        COALESCE(MAX(ugp.current_level), 0) as highest_level,
        COALESCE(SUM(ugp.current_coins), 0) as total_coins_company,
        
        -- Conquistas
        COUNT(DISTINCT ua.id) as total_achievements_unlocked,
        COUNT(DISTINCT a.id) as total_achievements_available
        
      FROM polox.companies c
      LEFT JOIN polox.users u ON c.id = u.company_id AND u.deleted_at IS NULL
      LEFT JOIN polox.user_gamification_profiles ugp ON u.id = ugp.user_id
      LEFT JOIN polox.user_achievements ua ON u.id = ua.user_id
      LEFT JOIN polox.achievements a ON c.id = a.company_id AND a.is_active = true
      WHERE c.id = $1
      GROUP BY c.id
    `;

    const analyticsResult = await query(analyticsQuery, [companyId]);
    const analytics = analyticsResult.rows[0];

    // Atividade por mês nos últimos 12 meses
    const activityQuery = `
      SELECT 
        DATE_TRUNC('month', u.last_login_at) as month,
        COUNT(DISTINCT u.id) as active_users
      FROM polox.users u
      WHERE u.company_id = $1 
        AND u.deleted_at IS NULL
        AND u.last_login_at >= NOW() - INTERVAL '12 months'
      GROUP BY DATE_TRUNC('month', u.last_login_at)
      ORDER BY month DESC
    `;

    const activityResult = await query(activityQuery, [companyId]);

    // Top 10 usuários por XP
    const topUsersQuery = `
      SELECT 
        u.name,
        u.email,
        ugp.current_level,
        ugp.total_xp,
        ugp.current_coins,
        COUNT(ua.id) as achievements_count
      FROM polox.users u
      JOIN polox.user_gamification_profiles ugp ON u.id = ugp.user_id
      LEFT JOIN polox.user_achievements ua ON u.id = ua.user_id
      WHERE u.company_id = $1 AND u.deleted_at IS NULL
      GROUP BY u.id, u.name, u.email, ugp.current_level, ugp.total_xp, ugp.current_coins
      ORDER BY ugp.total_xp DESC
      LIMIT 10
    `;

    const topUsersResult = await query(topUsersQuery, [companyId]);

    return successResponse(res, {
      ...analytics,
      activity_by_month: activityResult.rows,
      top_users: topUsersResult.rows,
      company_name: companyCheck.rows[0].name,
    });
  });
}

module.exports = CompanyController;
