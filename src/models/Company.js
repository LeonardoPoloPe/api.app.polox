const { query, transaction } = require('../config/database');
const { ApiError, ValidationError, NotFoundError } = require('../utils/errors');

/**
 * Model para gerenciamento de empresas (multi-tenant)
 * Baseado no schema polox.companies
 */
class CompanyModel {
  /**
   * Cria uma nova empresa
   * @param {Object} companyData - Dados da empresa
   * @returns {Promise<Object>} Empresa criada
   */
  static async create(companyData) {
    const {
      name,
      domain,
      slug,
      plan = 'starter',
      industry,
      company_size,
      country = 'BR',
      timezone = 'America/Sao_Paulo',
      language = 'pt-BR',
      enabled_modules = ['dashboard', 'users'],
      admin_name,
      admin_email,
      admin_phone
    } = companyData;

    // Validar dados obrigatórios
    if (!name || !domain || !slug) {
      throw new ValidationError('Nome, domínio e slug são obrigatórios');
    }

    const insertQuery = `
      INSERT INTO polox.companies (
        name, domain, slug, plan, industry, company_size, 
        country, timezone, language, enabled_modules,
        admin_name, admin_email, admin_phone,
        created_at, updated_at
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, 
        $7, $8, $9, $10,
        $11, $12, $13,
        NOW(), NOW()
      )
      RETURNING 
        id, name, domain, slug, plan, status, industry, company_size,
        country, timezone, language, enabled_modules, max_users, max_storage_mb,
        admin_name, admin_email, admin_phone, created_at, updated_at
    `;

    try {
      const result = await query(insertQuery, [
        name, domain, slug, plan, industry, company_size,
        country, timezone, language, JSON.stringify(enabled_modules),
        admin_name, admin_email, admin_phone
      ]);

      return result.rows[0];
    } catch (error) {
      if (error.code === '23505') {
        if (error.constraint === 'companies_domain_key') {
          throw new ValidationError('Domínio já está em uso');
        }
        if (error.constraint === 'companies_slug_key') {
          throw new ValidationError('Slug já está em uso');
        }
      }
      throw new ApiError(500, `Erro ao criar empresa: ${error.message}`);
    }
  }

  /**
   * Busca empresa por ID
   * @param {number} id - ID da empresa
   * @returns {Promise<Object|null>} Empresa encontrada ou null
   */
  static async findById(id) {
    const selectQuery = `
      SELECT 
        id, name, domain, slug, plan, status, industry, company_size,
        country, timezone, language, enabled_modules, max_users, max_storage_mb,
        admin_name, admin_email, admin_phone, 
        created_at, updated_at, last_activity,
        trial_ends_at, subscription_ends_at
      FROM polox.companies 
      WHERE id = $1 AND deleted_at IS NULL
    `;

    try {
      const result = await query(selectQuery, [id]);
      return result.rows[0] || null;
    } catch (error) {
      throw new ApiError(500, `Erro ao buscar empresa: ${error.message}`);
    }
  }

  /**
   * Busca empresa por domínio
   * @param {string} domain - Domínio da empresa
   * @returns {Promise<Object|null>} Empresa encontrada ou null
   */
  static async findByDomain(domain) {
    const selectQuery = `
      SELECT 
        id, name, domain, slug, plan, status, industry, company_size,
        country, timezone, language, enabled_modules, max_users, max_storage_mb,
        admin_name, admin_email, admin_phone, 
        created_at, updated_at, last_activity,
        trial_ends_at, subscription_ends_at
      FROM polox.companies 
      WHERE domain = $1 AND deleted_at IS NULL
    `;

    try {
      const result = await query(selectQuery, [domain]);
      return result.rows[0] || null;
    } catch (error) {
      throw new ApiError(500, `Erro ao buscar empresa por domínio: ${error.message}`);
    }
  }

  /**
   * Atualiza dados da empresa
   * @param {number} id - ID da empresa
   * @param {Object} updateData - Dados para atualizar
   * @returns {Promise<Object|null>} Empresa atualizada ou null
   */
  static async update(id, updateData) {
    const allowedFields = [
      'name', 'industry', 'company_size', 'country', 'timezone', 
      'language', 'enabled_modules', 'admin_name', 'admin_email', 
      'admin_phone', 'settings'
    ];
    
    const updates = [];
    const values = [];
    let paramCount = 1;

    // Construir query dinamicamente
    for (const [key, value] of Object.entries(updateData)) {
      if (allowedFields.includes(key)) {
        if (key === 'enabled_modules' || key === 'settings') {
          updates.push(`${key} = $${paramCount}`);
          values.push(JSON.stringify(value));
        } else {
          updates.push(`${key} = $${paramCount}`);
          values.push(value);
        }
        paramCount++;
      }
    }

    if (updates.length === 0) {
      throw new ValidationError('Nenhum campo válido para atualizar');
    }

    updates.push('updated_at = NOW()');
    values.push(id);

    const updateQuery = `
      UPDATE polox.companies 
      SET ${updates.join(', ')}
      WHERE id = $${paramCount} AND deleted_at IS NULL
      RETURNING 
        id, name, domain, slug, plan, status, industry, company_size,
        country, timezone, language, enabled_modules, max_users, max_storage_mb,
        admin_name, admin_email, admin_phone, 
        created_at, updated_at, last_activity
    `;

    try {
      const result = await query(updateQuery, values);
      return result.rows[0] || null;
    } catch (error) {
      throw new ApiError(500, `Erro ao atualizar empresa: ${error.message}`);
    }
  }

  /**
   * Atualiza plano da empresa
   * @param {number} id - ID da empresa
   * @param {string} plan - Novo plano
   * @returns {Promise<Object|null>} Empresa atualizada
   */
  static async updatePlan(id, plan) {
    const planLimits = {
      starter: { maxUsers: 5, maxStorage: 1000 },
      professional: { maxUsers: 25, maxStorage: 5000 },
      enterprise: { maxUsers: -1, maxStorage: -1 }
    };

    if (!planLimits[plan]) {
      throw new ValidationError('Plano inválido');
    }

    const limits = planLimits[plan];
    
    const updateQuery = `
      UPDATE polox.companies 
      SET 
        plan = $1,
        max_users = $2,
        max_storage_mb = $3,
        updated_at = NOW()
      WHERE id = $4 AND deleted_at IS NULL
      RETURNING 
        id, name, plan, max_users, max_storage_mb, updated_at
    `;

    try {
      const result = await query(updateQuery, [
        plan, 
        limits.maxUsers, 
        limits.maxStorage, 
        id
      ]);
      
      return result.rows[0] || null;
    } catch (error) {
      throw new ApiError(500, `Erro ao atualizar plano: ${error.message}`);
    }
  }

  /**
   * Atualiza última atividade da empresa
   * @param {number} id - ID da empresa
   * @returns {Promise<boolean>} True se atualizado com sucesso
   */
  static async updateLastActivity(id) {
    const updateQuery = `
      UPDATE polox.companies 
      SET last_activity = NOW()
      WHERE id = $1 AND deleted_at IS NULL
    `;

    try {
      const result = await query(updateQuery, [id]);
      return result.rowCount > 0;
    } catch (error) {
      throw new ApiError(500, `Erro ao atualizar última atividade: ${error.message}`);
    }
  }

  /**
   * Suspende empresa
   * @param {number} id - ID da empresa
   * @param {string} reason - Motivo da suspensão
   * @returns {Promise<boolean>} True se suspensa com sucesso
   */
  static async suspend(id, reason = null) {
    const updateQuery = `
      UPDATE polox.companies 
      SET 
        status = 'suspended',
        updated_at = NOW(),
        settings = COALESCE(settings, '{}'::jsonb) || $2::jsonb
      WHERE id = $1 AND deleted_at IS NULL
      RETURNING id
    `;

    try {
      const settings = reason ? { suspensionReason: reason, suspendedAt: new Date().toISOString() } : {};
      const result = await query(updateQuery, [id, JSON.stringify(settings)]);
      return result.rowCount > 0;
    } catch (error) {
      throw new ApiError(500, `Erro ao suspender empresa: ${error.message}`);
    }
  }

  /**
   * Reativa empresa
   * @param {number} id - ID da empresa
   * @returns {Promise<boolean>} True se reativada com sucesso
   */
  static async reactivate(id) {
    const updateQuery = `
      UPDATE polox.companies 
      SET 
        status = 'active',
        updated_at = NOW()
      WHERE id = $1 AND deleted_at IS NULL
      RETURNING id
    `;

    try {
      const result = await query(updateQuery, [id]);
      return result.rowCount > 0;
    } catch (error) {
      throw new ApiError(500, `Erro ao reativar empresa: ${error.message}`);
    }
  }

  /**
   * Soft delete da empresa
   * @param {number} id - ID da empresa
   * @returns {Promise<boolean>} True se deletada com sucesso
   */
  static async softDelete(id) {
    const updateQuery = `
      UPDATE polox.companies 
      SET 
        status = 'inactive',
        deleted_at = NOW(),
        updated_at = NOW()
      WHERE id = $1 AND deleted_at IS NULL
      RETURNING id
    `;

    try {
      const result = await query(updateQuery, [id]);
      return result.rowCount > 0;
    } catch (error) {
      throw new ApiError(500, `Erro ao deletar empresa: ${error.message}`);
    }
  }

  /**
   * Lista empresas com filtros e paginação
   * @param {Object} options - Opções de busca
   * @returns {Promise<Object>} Lista de empresas e metadados
   */
  static async list(options = {}) {
    const {
      page = 1,
      limit = 10,
      status = null,
      plan = null,
      search = null,
      sortBy = 'created_at',
      sortOrder = 'DESC'
    } = options;

    const offset = (page - 1) * limit;
    const conditions = ['deleted_at IS NULL'];
    const values = [];
    let paramCount = 1;

    // Adicionar filtros
    if (status) {
      conditions.push(`status = $${paramCount}`);
      values.push(status);
      paramCount++;
    }

    if (plan) {
      conditions.push(`plan = $${paramCount}`);
      values.push(plan);
      paramCount++;
    }

    if (search) {
      conditions.push(`(name ILIKE $${paramCount} OR domain ILIKE $${paramCount} OR admin_email ILIKE $${paramCount})`);
      values.push(`%${search}%`);
      paramCount++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    
    // Query para contar total
    const countQuery = `SELECT COUNT(*) FROM polox.companies ${whereClause}`;
    
    // Query para buscar dados
    const selectQuery = `
      SELECT 
        id, name, domain, slug, plan, status, industry, company_size,
        country, timezone, language, enabled_modules, max_users, max_storage_mb,
        admin_name, admin_email, admin_phone, 
        created_at, updated_at, last_activity,
        trial_ends_at, subscription_ends_at,
        (SELECT COUNT(*) FROM polox.users WHERE company_id = polox.companies.id AND deleted_at IS NULL) as user_count
      FROM polox.companies 
      ${whereClause}
      ORDER BY ${sortBy} ${sortOrder}
      LIMIT $${paramCount} OFFSET $${paramCount + 1}
    `;

    try {
      const [countResult, dataResult] = await Promise.all([
        query(countQuery, values),
        query(selectQuery, [...values, limit, offset])
      ]);

      const total = parseInt(countResult.rows[0].count);
      const totalPages = Math.ceil(total / limit);

      return {
        data: dataResult.rows,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      };
    } catch (error) {
      throw new ApiError(500, `Erro ao listar empresas: ${error.message}`);
    }
  }

  /**
   * Verifica se empresa atingiu limite de usuários
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object>} Informações sobre limite
   */
  static async checkUserLimit(companyId) {
    const checkQuery = `
      SELECT 
        c.max_users,
        c.plan,
        COUNT(u.id) as current_users
      FROM polox.companies c
      LEFT JOIN polox.users u ON c.id = u.company_id AND u.deleted_at IS NULL
      WHERE c.id = $1 AND c.deleted_at IS NULL
      GROUP BY c.id, c.max_users, c.plan
    `;

    try {
      const result = await query(checkQuery, [companyId]);
      
      if (result.rows.length === 0) {
        throw new NotFoundError('Empresa');
      }

      const { max_users, plan, current_users } = result.rows[0];
      const isLimitReached = max_users > 0 && current_users >= max_users;

      return {
        maxUsers: max_users,
        currentUsers: parseInt(current_users),
        plan,
        isLimitReached,
        remainingSlots: max_users > 0 ? Math.max(0, max_users - current_users) : -1
      };
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      throw new ApiError(500, `Erro ao verificar limite de usuários: ${error.message}`);
    }
  }

  /**
   * Obtém estatísticas da empresa
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object>} Estatísticas da empresa
   */
  static async getStats(companyId) {
    const statsQuery = `
      SELECT 
        c.name,
        c.plan,
        c.created_at,
        c.last_activity,
        COUNT(DISTINCT u.id) as total_users,
        COUNT(DISTINCT CASE WHEN u.status = 'active' THEN u.id END) as active_users,
        COUNT(DISTINCT l.id) as total_leads,
        COUNT(DISTINCT cl.id) as total_clients,
        COUNT(DISTINCT s.id) as total_sales,
        COALESCE(SUM(s.total_amount), 0) as total_revenue
      FROM polox.companies c
      LEFT JOIN polox.users u ON c.id = u.company_id AND u.deleted_at IS NULL
      LEFT JOIN polox.leads l ON c.id = l.company_id AND l.deleted_at IS NULL
      LEFT JOIN polox.clients cl ON c.id = cl.company_id AND cl.deleted_at IS NULL
      LEFT JOIN polox.sales s ON c.id = s.company_id AND s.deleted_at IS NULL AND s.status = 'confirmed'
      WHERE c.id = $1 AND c.deleted_at IS NULL
      GROUP BY c.id, c.name, c.plan, c.created_at, c.last_activity
    `;

    try {
      const result = await query(statsQuery, [companyId]);
      
      if (result.rows.length === 0) {
        throw new NotFoundError('Empresa');
      }

      return result.rows[0];
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      throw new ApiError(500, `Erro ao obter estatísticas: ${error.message}`);
    }
  }
}

module.exports = CompanyModel;