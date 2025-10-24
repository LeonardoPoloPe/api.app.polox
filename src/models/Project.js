const { query, transaction } = require('../config/database');
const { ApiError, ValidationError, NotFoundError } = require('../utils/errors');

/**
 * Model para projetos
 * Baseado no schema polox.projects
 */
class ProjectModel {
  /**
   * Cria um novo projeto
   * @param {Object} projectData - Dados do projeto
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object>} Projeto criado
   */
  static async create(projectData, companyId) {
    const {
      name,
      description,
      client_id = null,
      owner_user_id,
      start_date = null,
      end_date = null,
      budget = null,
      priority = 'medium',
      tags = [],
      custom_fields = {}
    } = projectData;

    // Validar dados obrigatórios
    if (!name || !owner_user_id) {
      throw new ValidationError('Nome e usuário responsável são obrigatórios');
    }

    // Validar datas
    if (start_date && end_date && new Date(start_date) > new Date(end_date)) {
      throw new ValidationError('Data de início não pode ser posterior à data de fim');
    }

    if (budget !== null && budget < 0) {
      throw new ValidationError('Orçamento não pode ser negativo');
    }

    const insertQuery = `
      INSERT INTO polox.projects (
        company_id, name, description, client_id, owner_user_id,
        start_date, end_date, budget, priority, status, progress,
        tags, custom_fields, created_at, updated_at
      )
      VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, 'planning', 0,
        $10, $11, NOW(), NOW()
      )
      RETURNING 
        id, company_id, name, description, client_id, owner_user_id,
        start_date, end_date, budget, priority, status, progress,
        tags, custom_fields, created_at, updated_at
    `;

    try {
      const result = await query(insertQuery, [
        companyId, name, description, client_id, owner_user_id,
        start_date, end_date, budget, priority,
        JSON.stringify(tags), JSON.stringify(custom_fields)
      ], { companyId });

      return result.rows[0];
    } catch (error) {
      if (error.code === '23503') {
        if (error.constraint?.includes('client')) {
          throw new ValidationError('Cliente informado não existe');
        }
        if (error.constraint?.includes('owner')) {
          throw new ValidationError('Usuário responsável informado não existe');
        }
      }
      throw new ApiError(500, `Erro ao criar projeto: ${error.message}`);
    }
  }

  /**
   * Busca projeto por ID
   * @param {number} id - ID do projeto
   * @param {number} companyId - ID da empresa (multi-tenant)
   * @returns {Promise<Object|null>} Projeto encontrado ou null
   */
  static async findById(id, companyId) {
    const selectQuery = `
      SELECT 
        p.id, p.company_id, p.name, p.description, p.client_id, p.owner_user_id,
        p.start_date, p.end_date, p.budget, p.priority, p.status, p.progress,
        p.tags, p.custom_fields, p.created_at, p.updated_at,
        c.name as client_name,
        u.full_name as owner_name,
        u.email as owner_email,
        (SELECT COUNT(*) FROM polox.project_tasks WHERE project_id = p.id AND deleted_at IS NULL) as tasks_count,
        (SELECT COUNT(*) FROM polox.project_tasks WHERE project_id = p.id AND status = 'completed' AND deleted_at IS NULL) as completed_tasks,
        (SELECT SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) * 100.0 / COUNT(*) FROM polox.project_tasks WHERE project_id = p.id AND deleted_at IS NULL) as calculated_progress
      FROM polox.projects p
      LEFT JOIN polox.clients c ON p.client_id = c.id
      INNER JOIN polox.users u ON p.owner_user_id = u.id
      WHERE p.id = $1 AND p.company_id = $2 AND p.deleted_at IS NULL
    `;

    try {
      const result = await query(selectQuery, [id, companyId], { companyId });
      const project = result.rows[0];
      
      if (project) {
        // Parse JSON fields
        project.tags = typeof project.tags === 'string' ? JSON.parse(project.tags) : project.tags;
        project.custom_fields = typeof project.custom_fields === 'string' ? JSON.parse(project.custom_fields) : project.custom_fields;
        
        // Convert counts to integers
        project.tasks_count = parseInt(project.tasks_count) || 0;
        project.completed_tasks = parseInt(project.completed_tasks) || 0;
        project.calculated_progress = parseFloat(project.calculated_progress) || 0;
      }

      return project || null;
    } catch (error) {
      throw new ApiError(500, `Erro ao buscar projeto: ${error.message}`);
    }
  }

  /**
   * Lista projetos com filtros
   * @param {number} companyId - ID da empresa
   * @param {Object} options - Opções de filtro
   * @returns {Promise<Array>} Lista de projetos
   */
  static async findByCompany(companyId, options = {}) {
    const { 
      page = 1, 
      limit = 10,
      status = null,
      priority = null,
      owner_user_id = null,
      client_id = null,
      search = null,
      start_date_from = null,
      start_date_to = null
    } = options;
    
    const offset = (page - 1) * limit;
    
    let whereClause = 'WHERE p.company_id = $1 AND p.deleted_at IS NULL';
    const params = [companyId];
    
    if (status) {
      whereClause += ` AND p.status = $${params.length + 1}`;
      params.push(status);
    }

    if (priority) {
      whereClause += ` AND p.priority = $${params.length + 1}`;
      params.push(priority);
    }

    if (owner_user_id) {
      whereClause += ` AND p.owner_user_id = $${params.length + 1}`;
      params.push(owner_user_id);
    }

    if (client_id) {
      whereClause += ` AND p.client_id = $${params.length + 1}`;
      params.push(client_id);
    }

    if (search) {
      whereClause += ` AND (p.name ILIKE $${params.length + 1} OR p.description ILIKE $${params.length + 1})`;
      params.push(`%${search}%`);
    }

    if (start_date_from) {
      whereClause += ` AND p.start_date >= $${params.length + 1}`;
      params.push(start_date_from);
    }

    if (start_date_to) {
      whereClause += ` AND p.start_date <= $${params.length + 1}`;
      params.push(start_date_to);
    }

    const selectQuery = `
      SELECT 
        p.id, p.company_id, p.name, p.description, p.client_id, p.owner_user_id,
        p.start_date, p.end_date, p.budget, p.priority, p.status, p.progress,
        p.tags, p.custom_fields, p.created_at, p.updated_at,
        c.name as client_name,
        u.full_name as owner_name,
        (SELECT COUNT(*) FROM polox.project_tasks WHERE project_id = p.id AND deleted_at IS NULL) as tasks_count,
        (SELECT COUNT(*) FROM polox.project_tasks WHERE project_id = p.id AND status = 'completed' AND deleted_at IS NULL) as completed_tasks
      FROM polox.projects p
      LEFT JOIN polox.clients c ON p.client_id = c.id
      INNER JOIN polox.users u ON p.owner_user_id = u.id
      ${whereClause}
      ORDER BY p.created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    params.push(limit, offset);

    try {
      const result = await query(selectQuery, params, { companyId });
      
      return result.rows.map(project => {
        // Parse JSON fields
        project.tags = typeof project.tags === 'string' ? JSON.parse(project.tags) : project.tags;
        project.custom_fields = typeof project.custom_fields === 'string' ? JSON.parse(project.custom_fields) : project.custom_fields;
        
        // Convert counts
        project.tasks_count = parseInt(project.tasks_count) || 0;
        project.completed_tasks = parseInt(project.completed_tasks) || 0;
        
        return project;
      });
    } catch (error) {
      throw new ApiError(500, `Erro ao buscar projetos: ${error.message}`);
    }
  }

  /**
   * Lista projetos de um usuário
   * @param {number} userId - ID do usuário
   * @param {number} companyId - ID da empresa
   * @param {Object} options - Opções de filtro
   * @returns {Promise<Array>} Lista de projetos
   */
  static async findByUser(userId, companyId, options = {}) {
    return await this.findByCompany(companyId, {
      ...options,
      owner_user_id: userId
    });
  }

  /**
   * Lista projetos de um cliente
   * @param {number} clientId - ID do cliente
   * @param {number} companyId - ID da empresa
   * @param {Object} options - Opções de filtro
   * @returns {Promise<Array>} Lista de projetos
   */
  static async findByClient(clientId, companyId, options = {}) {
    return await this.findByCompany(companyId, {
      ...options,
      client_id: clientId
    });
  }

  /**
   * Atualiza um projeto
   * @param {number} id - ID do projeto
   * @param {Object} updateData - Dados para atualização
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object>} Projeto atualizado
   */
  static async update(id, updateData, companyId) {
    // Verificar se projeto existe
    const existing = await this.findById(id, companyId);
    if (!existing) {
      throw new NotFoundError('Projeto não encontrado');
    }

    const {
      name,
      description,
      client_id,
      owner_user_id,
      start_date,
      end_date,
      budget,
      priority,
      status,
      progress,
      tags,
      custom_fields
    } = updateData;

    // Validações
    if (start_date && end_date && new Date(start_date) > new Date(end_date)) {
      throw new ValidationError('Data de início não pode ser posterior à data de fim');
    }

    if (budget !== undefined && budget < 0) {
      throw new ValidationError('Orçamento não pode ser negativo');
    }

    if (progress !== undefined && (progress < 0 || progress > 100)) {
      throw new ValidationError('Progresso deve estar entre 0 e 100');
    }

    const updateFields = [];
    const params = [];
    let paramCount = 1;

    if (name !== undefined) {
      updateFields.push(`name = $${paramCount++}`);
      params.push(name);
    }

    if (description !== undefined) {
      updateFields.push(`description = $${paramCount++}`);
      params.push(description);
    }

    if (client_id !== undefined) {
      updateFields.push(`client_id = $${paramCount++}`);
      params.push(client_id);
    }

    if (owner_user_id !== undefined) {
      updateFields.push(`owner_user_id = $${paramCount++}`);
      params.push(owner_user_id);
    }

    if (start_date !== undefined) {
      updateFields.push(`start_date = $${paramCount++}`);
      params.push(start_date);
    }

    if (end_date !== undefined) {
      updateFields.push(`end_date = $${paramCount++}`);
      params.push(end_date);
    }

    if (budget !== undefined) {
      updateFields.push(`budget = $${paramCount++}`);
      params.push(budget);
    }

    if (priority !== undefined) {
      updateFields.push(`priority = $${paramCount++}`);
      params.push(priority);
    }

    if (status !== undefined) {
      updateFields.push(`status = $${paramCount++}`);
      params.push(status);
    }

    if (progress !== undefined) {
      updateFields.push(`progress = $${paramCount++}`);
      params.push(progress);
    }

    if (tags !== undefined) {
      updateFields.push(`tags = $${paramCount++}`);
      params.push(JSON.stringify(tags));
    }

    if (custom_fields !== undefined) {
      updateFields.push(`custom_fields = $${paramCount++}`);
      params.push(JSON.stringify(custom_fields));
    }

    if (updateFields.length === 0) {
      throw new ValidationError('Nenhum campo para atualizar');
    }

    updateFields.push(`updated_at = NOW()`);
    params.push(id, companyId);

    const updateQuery = `
      UPDATE polox.projects 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramCount++} AND company_id = $${paramCount++} AND deleted_at IS NULL
      RETURNING 
        id, company_id, name, description, client_id, owner_user_id,
        start_date, end_date, budget, priority, status, progress,
        tags, custom_fields, created_at, updated_at
    `;

    try {
      const result = await query(updateQuery, params, { companyId });
      
      if (result.rows.length === 0) {
        throw new NotFoundError('Projeto não encontrado');
      }

      return result.rows[0];
    } catch (error) {
      if (error.code === '23503') {
        throw new ValidationError('Cliente ou usuário informado não existe');
      }
      throw new ApiError(500, `Erro ao atualizar projeto: ${error.message}`);
    }
  }

  /**
   * Atualiza progresso do projeto baseado nas tarefas
   * @param {number} id - ID do projeto
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object>} Projeto atualizado
   */
  static async updateProgressFromTasks(id, companyId) {
    const progressQuery = `
      SELECT 
        COALESCE(
          ROUND(
            (COUNT(CASE WHEN status = 'completed' THEN 1 END) * 100.0) / 
            NULLIF(COUNT(*), 0)
          ), 0
        ) as calculated_progress
      FROM polox.project_tasks 
      WHERE project_id = $1 AND deleted_at IS NULL
    `;

    try {
      const progressResult = await query(progressQuery, [id]);
      const newProgress = parseFloat(progressResult.rows[0]?.calculated_progress) || 0;

      return await this.update(id, { progress: newProgress }, companyId);
    } catch (error) {
      throw new ApiError(500, `Erro ao atualizar progresso: ${error.message}`);
    }
  }

  /**
   * Remove um projeto (soft delete)
   * @param {number} id - ID do projeto
   * @param {number} companyId - ID da empresa
   * @returns {Promise<boolean>} True se removido com sucesso
   */
  static async delete(id, companyId) {
    // Verificar se projeto existe
    const existing = await this.findById(id, companyId);
    if (!existing) {
      throw new NotFoundError('Projeto não encontrado');
    }

    // Verificar se tem tarefas ativas
    const tasksQuery = `
      SELECT COUNT(*) as count
      FROM polox.project_tasks 
      WHERE project_id = $1 AND status IN ('in_progress', 'pending') AND deleted_at IS NULL
    `;

    const tasksResult = await query(tasksQuery, [id]);
    const activeTasks = parseInt(tasksResult.rows[0].count);

    if (activeTasks > 0) {
      throw new ValidationError('Não é possível remover projeto com tarefas ativas');
    }

    const deleteQuery = `
      UPDATE polox.projects 
      SET deleted_at = NOW()
      WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL
    `;

    try {
      const result = await query(deleteQuery, [id, companyId], { companyId });
      return result.rowCount > 0;
    } catch (error) {
      throw new ApiError(500, `Erro ao remover projeto: ${error.message}`);
    }
  }

  /**
   * Estatísticas dos projetos por status
   * @param {number} companyId - ID da empresa
   * @param {Object} filters - Filtros opcionais
   * @returns {Promise<Object>} Estatísticas
   */
  static async getStatsByStatus(companyId, filters = {}) {
    const { 
      owner_user_id = null,
      client_id = null,
      start_date = null,
      end_date = null 
    } = filters;

    let whereClause = 'WHERE company_id = $1 AND deleted_at IS NULL';
    const params = [companyId];

    if (owner_user_id) {
      whereClause += ` AND owner_user_id = $${params.length + 1}`;
      params.push(owner_user_id);
    }

    if (client_id) {
      whereClause += ` AND client_id = $${params.length + 1}`;
      params.push(client_id);
    }

    if (start_date) {
      whereClause += ` AND created_at >= $${params.length + 1}`;
      params.push(start_date);
    }

    if (end_date) {
      whereClause += ` AND created_at <= $${params.length + 1}`;
      params.push(end_date);
    }

    const statsQuery = `
      SELECT 
        COUNT(*) as total_projects,
        COUNT(CASE WHEN status = 'planning' THEN 1 END) as planning_projects,
        COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as active_projects,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_projects,
        COUNT(CASE WHEN status = 'on_hold' THEN 1 END) as on_hold_projects,
        COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_projects,
        SUM(budget) as total_budget,
        AVG(progress) as average_progress,
        COUNT(CASE WHEN end_date < NOW() AND status != 'completed' THEN 1 END) as overdue_projects
      FROM polox.projects 
      ${whereClause}
    `;

    try {
      const result = await query(statsQuery, params, { companyId });
      const stats = result.rows[0];

      return {
        total_projects: parseInt(stats.total_projects) || 0,
        planning_projects: parseInt(stats.planning_projects) || 0,
        active_projects: parseInt(stats.active_projects) || 0,
        completed_projects: parseInt(stats.completed_projects) || 0,
        on_hold_projects: parseInt(stats.on_hold_projects) || 0,
        cancelled_projects: parseInt(stats.cancelled_projects) || 0,
        total_budget: parseFloat(stats.total_budget) || 0,
        average_progress: parseFloat(stats.average_progress) || 0,
        overdue_projects: parseInt(stats.overdue_projects) || 0
      };
    } catch (error) {
      throw new ApiError(500, `Erro ao buscar estatísticas: ${error.message}`);
    }
  }

  /**
   * Lista projetos com prazo próximo
   * @param {number} companyId - ID da empresa
   * @param {number} days - Dias para vencimento (padrão: 7)
   * @returns {Promise<Array>} Lista de projetos com prazo próximo
   */
  static async findUpcoming(companyId, days = 7) {
    const selectQuery = `
      SELECT 
        p.id, p.name, p.description, p.end_date, p.progress, p.status,
        p.priority, p.owner_user_id,
        u.full_name as owner_name,
        c.name as client_name,
        (p.end_date - NOW()::date) as days_remaining
      FROM polox.projects p
      LEFT JOIN polox.clients c ON p.client_id = c.id
      INNER JOIN polox.users u ON p.owner_user_id = u.id
      WHERE p.company_id = $1 
        AND p.deleted_at IS NULL
        AND p.status IN ('planning', 'in_progress')
        AND p.end_date IS NOT NULL
        AND p.end_date BETWEEN NOW()::date AND (NOW() + INTERVAL '${days} days')::date
      ORDER BY p.end_date ASC
    `;

    try {
      const result = await query(selectQuery, [companyId], { companyId });
      return result.rows.map(project => ({
        ...project,
        days_remaining: parseInt(project.days_remaining)
      }));
    } catch (error) {
      throw new ApiError(500, `Erro ao buscar projetos próximos: ${error.message}`);
    }
  }

  /**
   * Conta o total de projetos de uma empresa
   * @param {number} companyId - ID da empresa
   * @param {Object} filters - Filtros opcionais
   * @returns {Promise<number>} Total de projetos
   */
  static async count(companyId, filters = {}) {
    let whereClause = 'WHERE company_id = $1 AND deleted_at IS NULL';
    const params = [companyId];

    if (filters.status) {
      whereClause += ` AND status = $${params.length + 1}`;
      params.push(filters.status);
    }

    if (filters.owner_user_id) {
      whereClause += ` AND owner_user_id = $${params.length + 1}`;
      params.push(filters.owner_user_id);
    }

    const countQuery = `
      SELECT COUNT(*) as total
      FROM polox.projects 
      ${whereClause}
    `;

    try {
      const result = await query(countQuery, params, { companyId });
      return parseInt(result.rows[0].total);
    } catch (error) {
      throw new ApiError(500, `Erro ao contar projetos: ${error.message}`);
    }
  }
}

module.exports = ProjectModel;