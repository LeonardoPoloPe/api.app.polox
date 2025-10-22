const { query, transaction } = require('../config/database');
const { ApiError, ValidationError, NotFoundError } = require('../utils/errors');

/**
 * Model para tarefas de projetos
 * Baseado no schema polox.project_tasks
 */
class ProjectTaskModel {
  /**
   * Cria uma nova tarefa
   * @param {Object} taskData - Dados da tarefa
   * @returns {Promise<Object>} Tarefa criada
   */
  static async create(taskData) {
    const {
      project_id,
      assigned_to_user_id = null,
      title,
      description,
      priority = 'medium',
      estimated_hours = null,
      due_date = null,
      dependencies = [],
      tags = [],
      custom_fields = {}
    } = taskData;

    // Validar dados obrigatórios
    if (!project_id || !title) {
      throw new ValidationError('Project ID e título são obrigatórios');
    }

    if (estimated_hours !== null && estimated_hours < 0) {
      throw new ValidationError('Horas estimadas não podem ser negativas');
    }

    const insertQuery = `
      INSERT INTO polox.project_tasks (
        project_id, assigned_to_user_id, title, description, priority,
        status, progress, estimated_hours, actual_hours, due_date,
        dependencies, tags, custom_fields, created_at, updated_at
      )
      VALUES (
        $1, $2, $3, $4, $5,
        'pending', 0, $6, 0, $7,
        $8, $9, $10, NOW(), NOW()
      )
      RETURNING 
        id, project_id, assigned_to_user_id, title, description, priority,
        status, progress, estimated_hours, actual_hours, due_date,
        dependencies, tags, custom_fields, created_at, updated_at
    `;

    try {
      const result = await query(insertQuery, [
        project_id, assigned_to_user_id, title, description, priority,
        estimated_hours, due_date,
        JSON.stringify(dependencies), JSON.stringify(tags), JSON.stringify(custom_fields)
      ]);

      return result.rows[0];
    } catch (error) {
      if (error.code === '23503') {
        if (error.constraint?.includes('project')) {
          throw new ValidationError('Projeto informado não existe');
        }
        if (error.constraint?.includes('user')) {
          throw new ValidationError('Usuário informado não existe');
        }
      }
      throw new ApiError(500, `Erro ao criar tarefa: ${error.message}`);
    }
  }

  /**
   * Busca tarefa por ID
   * @param {number} id - ID da tarefa
   * @param {number} companyId - ID da empresa (multi-tenant)
   * @returns {Promise<Object|null>} Tarefa encontrada ou null
   */
  static async findById(id, companyId) {
    const selectQuery = `
      SELECT 
        pt.id, pt.project_id, pt.assigned_to_user_id, pt.title, pt.description,
        pt.priority, pt.status, pt.progress, pt.estimated_hours, pt.actual_hours,
        pt.due_date, pt.dependencies, pt.tags, pt.custom_fields,
        pt.completed_at, pt.created_at, pt.updated_at,
        p.name as project_name,
        u.name as assigned_user_name,
        u.email as assigned_user_email,
        p.company_id
      FROM polox.project_tasks pt
      INNER JOIN polox.projects p ON pt.project_id = p.id
      LEFT JOIN polox.users u ON pt.assigned_to_user_id = u.id
      WHERE pt.id = $1 AND p.company_id = $2 AND pt.deleted_at IS NULL
    `;

    try {
      const result = await query(selectQuery, [id, companyId], { companyId });
      const task = result.rows[0];
      
      if (task) {
        // Parse JSON fields
        task.dependencies = typeof task.dependencies === 'string' ? JSON.parse(task.dependencies) : task.dependencies;
        task.tags = typeof task.tags === 'string' ? JSON.parse(task.tags) : task.tags;
        task.custom_fields = typeof task.custom_fields === 'string' ? JSON.parse(task.custom_fields) : task.custom_fields;
      }

      return task || null;
    } catch (error) {
      throw new ApiError(500, `Erro ao buscar tarefa: ${error.message}`);
    }
  }

  /**
   * Lista tarefas de um projeto
   * @param {number} projectId - ID do projeto
   * @param {number} companyId - ID da empresa
   * @param {Object} options - Opções de filtro
   * @returns {Promise<Array>} Lista de tarefas
   */
  static async findByProject(projectId, companyId, options = {}) {
    const { 
      status = null,
      assigned_to_user_id = null,
      priority = null,
      page = 1, 
      limit = 50
    } = options;
    
    const offset = (page - 1) * limit;
    
    let whereClause = `
      WHERE pt.project_id = $1 AND p.company_id = $2 AND pt.deleted_at IS NULL
    `;
    const params = [projectId, companyId];
    
    if (status) {
      whereClause += ` AND pt.status = $${params.length + 1}`;
      params.push(status);
    }

    if (assigned_to_user_id) {
      whereClause += ` AND pt.assigned_to_user_id = $${params.length + 1}`;
      params.push(assigned_to_user_id);
    }

    if (priority) {
      whereClause += ` AND pt.priority = $${params.length + 1}`;
      params.push(priority);
    }

    const selectQuery = `
      SELECT 
        pt.id, pt.project_id, pt.assigned_to_user_id, pt.title, pt.description,
        pt.priority, pt.status, pt.progress, pt.estimated_hours, pt.actual_hours,
        pt.due_date, pt.dependencies, pt.tags, pt.custom_fields,
        pt.completed_at, pt.created_at, pt.updated_at,
        u.name as assigned_user_name,
        u.avatar_url as assigned_user_avatar
      FROM polox.project_tasks pt
      INNER JOIN polox.projects p ON pt.project_id = p.id
      LEFT JOIN polox.users u ON pt.assigned_to_user_id = u.id
      ${whereClause}
      ORDER BY 
        CASE pt.priority 
          WHEN 'urgent' THEN 1
          WHEN 'high' THEN 2
          WHEN 'medium' THEN 3
          WHEN 'low' THEN 4
          ELSE 5
        END,
        pt.due_date NULLS LAST,
        pt.created_at ASC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    params.push(limit, offset);

    try {
      const result = await query(selectQuery, params, { companyId });
      
      return result.rows.map(task => {
        // Parse JSON fields
        task.dependencies = typeof task.dependencies === 'string' ? JSON.parse(task.dependencies) : task.dependencies;
        task.tags = typeof task.tags === 'string' ? JSON.parse(task.tags) : task.tags;
        task.custom_fields = typeof task.custom_fields === 'string' ? JSON.parse(task.custom_fields) : task.custom_fields;
        
        return task;
      });
    } catch (error) {
      throw new ApiError(500, `Erro ao buscar tarefas: ${error.message}`);
    }
  }

  /**
   * Lista tarefas atribuídas a um usuário
   * @param {number} userId - ID do usuário
   * @param {number} companyId - ID da empresa
   * @param {Object} options - Opções de filtro
   * @returns {Promise<Array>} Lista de tarefas
   */
  static async findByUser(userId, companyId, options = {}) {
    const { 
      status = null,
      project_id = null,
      overdue_only = false,
      page = 1, 
      limit = 20
    } = options;
    
    const offset = (page - 1) * limit;
    
    let whereClause = `
      WHERE pt.assigned_to_user_id = $1 AND p.company_id = $2 AND pt.deleted_at IS NULL
    `;
    const params = [userId, companyId];
    
    if (status) {
      whereClause += ` AND pt.status = $${params.length + 1}`;
      params.push(status);
    }

    if (project_id) {
      whereClause += ` AND pt.project_id = $${params.length + 1}`;
      params.push(project_id);
    }

    if (overdue_only) {
      whereClause += ` AND pt.due_date < NOW()::date AND pt.status != 'completed'`;
    }

    const selectQuery = `
      SELECT 
        pt.id, pt.project_id, pt.assigned_to_user_id, pt.title, pt.description,
        pt.priority, pt.status, pt.progress, pt.estimated_hours, pt.actual_hours,
        pt.due_date, pt.dependencies, pt.tags, pt.custom_fields,
        pt.completed_at, pt.created_at, pt.updated_at,
        p.name as project_name,
        (pt.due_date - NOW()::date) as days_remaining
      FROM polox.project_tasks pt
      INNER JOIN polox.projects p ON pt.project_id = p.id
      ${whereClause}
      ORDER BY 
        CASE pt.priority 
          WHEN 'urgent' THEN 1
          WHEN 'high' THEN 2
          WHEN 'medium' THEN 3
          WHEN 'low' THEN 4
          ELSE 5
        END,
        pt.due_date NULLS LAST,
        pt.created_at ASC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    params.push(limit, offset);

    try {
      const result = await query(selectQuery, params, { companyId });
      
      return result.rows.map(task => {
        // Parse JSON fields e calcular campos
        task.dependencies = typeof task.dependencies === 'string' ? JSON.parse(task.dependencies) : task.dependencies;
        task.tags = typeof task.tags === 'string' ? JSON.parse(task.tags) : task.tags;
        task.custom_fields = typeof task.custom_fields === 'string' ? JSON.parse(task.custom_fields) : task.custom_fields;
        task.days_remaining = task.days_remaining ? parseInt(task.days_remaining) : null;
        
        return task;
      });
    } catch (error) {
      throw new ApiError(500, `Erro ao buscar tarefas: ${error.message}`);
    }
  }

  /**
   * Atualiza uma tarefa
   * @param {number} id - ID da tarefa
   * @param {Object} updateData - Dados para atualização
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object>} Tarefa atualizada
   */
  static async update(id, updateData, companyId) {
    // Verificar se tarefa existe
    const existing = await this.findById(id, companyId);
    if (!existing) {
      throw new NotFoundError('Tarefa não encontrada');
    }

    const {
      assigned_to_user_id,
      title,
      description,
      priority,
      status,
      progress,
      estimated_hours,
      actual_hours,
      due_date,
      dependencies,
      tags,
      custom_fields
    } = updateData;

    // Validações
    if (estimated_hours !== undefined && estimated_hours < 0) {
      throw new ValidationError('Horas estimadas não podem ser negativas');
    }

    if (actual_hours !== undefined && actual_hours < 0) {
      throw new ValidationError('Horas trabalhadas não podem ser negativas');
    }

    if (progress !== undefined && (progress < 0 || progress > 100)) {
      throw new ValidationError('Progresso deve estar entre 0 e 100');
    }

    const updateFields = [];
    const params = [];
    let paramCount = 1;

    if (assigned_to_user_id !== undefined) {
      updateFields.push(`assigned_to_user_id = $${paramCount++}`);
      params.push(assigned_to_user_id);
    }

    if (title !== undefined) {
      updateFields.push(`title = $${paramCount++}`);
      params.push(title);
    }

    if (description !== undefined) {
      updateFields.push(`description = $${paramCount++}`);
      params.push(description);
    }

    if (priority !== undefined) {
      updateFields.push(`priority = $${paramCount++}`);
      params.push(priority);
    }

    if (status !== undefined) {
      updateFields.push(`status = $${paramCount++}`);
      params.push(status);
      
      // Se marcando como completada, definir data e progresso
      if (status === 'completed') {
        updateFields.push(`completed_at = NOW()`);
        updateFields.push(`progress = 100`);
      } else if (status !== 'completed' && existing.status === 'completed') {
        updateFields.push(`completed_at = NULL`);
      }
    }

    if (progress !== undefined) {
      updateFields.push(`progress = $${paramCount++}`);
      params.push(progress);
      
      // Se progresso = 100, marcar como completada
      if (progress === 100 && status !== 'completed') {
        updateFields.push(`status = 'completed'`);
        updateFields.push(`completed_at = NOW()`);
      }
    }

    if (estimated_hours !== undefined) {
      updateFields.push(`estimated_hours = $${paramCount++}`);
      params.push(estimated_hours);
    }

    if (actual_hours !== undefined) {
      updateFields.push(`actual_hours = $${paramCount++}`);
      params.push(actual_hours);
    }

    if (due_date !== undefined) {
      updateFields.push(`due_date = $${paramCount++}`);
      params.push(due_date);
    }

    if (dependencies !== undefined) {
      updateFields.push(`dependencies = $${paramCount++}`);
      params.push(JSON.stringify(dependencies));
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
    params.push(id);

    const updateQuery = `
      UPDATE polox.project_tasks 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramCount++} AND deleted_at IS NULL
      RETURNING 
        id, project_id, assigned_to_user_id, title, description, priority,
        status, progress, estimated_hours, actual_hours, due_date,
        dependencies, tags, custom_fields, completed_at,
        created_at, updated_at
    `;

    try {
      const result = await query(updateQuery, params);
      
      if (result.rows.length === 0) {
        throw new NotFoundError('Tarefa não encontrada');
      }

      return result.rows[0];
    } catch (error) {
      throw new ApiError(500, `Erro ao atualizar tarefa: ${error.message}`);
    }
  }

  /**
   * Marca tarefa como concluída
   * @param {number} id - ID da tarefa
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object>} Tarefa atualizada
   */
  static async markAsCompleted(id, companyId) {
    return await this.update(id, { 
      status: 'completed',
      progress: 100 
    }, companyId);
  }

  /**
   * Remove uma tarefa (soft delete)
   * @param {number} id - ID da tarefa
   * @param {number} companyId - ID da empresa
   * @returns {Promise<boolean>} True se removido com sucesso
   */
  static async delete(id, companyId) {
    // Verificar se tarefa existe
    const existing = await this.findById(id, companyId);
    if (!existing) {
      throw new NotFoundError('Tarefa não encontrada');
    }

    const deleteQuery = `
      UPDATE polox.project_tasks 
      SET deleted_at = NOW()
      WHERE id = $1 AND deleted_at IS NULL
    `;

    try {
      const result = await query(deleteQuery, [id]);
      return result.rowCount > 0;
    } catch (error) {
      throw new ApiError(500, `Erro ao remover tarefa: ${error.message}`);
    }
  }

  /**
   * Estatísticas das tarefas por projeto
   * @param {number} projectId - ID do projeto
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object>} Estatísticas
   */
  static async getStatsByProject(projectId, companyId) {
    const statsQuery = `
      SELECT 
        COUNT(*) as total_tasks,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_tasks,
        COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress_tasks,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_tasks,
        COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_tasks,
        COUNT(CASE WHEN due_date < NOW()::date AND status != 'completed' THEN 1 END) as overdue_tasks,
        COALESCE(AVG(progress), 0) as average_progress,
        COALESCE(SUM(estimated_hours), 0) as total_estimated_hours,
        COALESCE(SUM(actual_hours), 0) as total_actual_hours
      FROM polox.project_tasks pt
      INNER JOIN polox.projects p ON pt.project_id = p.id
      WHERE pt.project_id = $1 AND p.company_id = $2 AND pt.deleted_at IS NULL
    `;

    try {
      const result = await query(statsQuery, [projectId, companyId], { companyId });
      const stats = result.rows[0];

      return {
        total_tasks: parseInt(stats.total_tasks) || 0,
        pending_tasks: parseInt(stats.pending_tasks) || 0,
        in_progress_tasks: parseInt(stats.in_progress_tasks) || 0,
        completed_tasks: parseInt(stats.completed_tasks) || 0,
        cancelled_tasks: parseInt(stats.cancelled_tasks) || 0,
        overdue_tasks: parseInt(stats.overdue_tasks) || 0,
        average_progress: parseFloat(stats.average_progress) || 0,
        total_estimated_hours: parseFloat(stats.total_estimated_hours) || 0,
        total_actual_hours: parseFloat(stats.total_actual_hours) || 0
      };
    } catch (error) {
      throw new ApiError(500, `Erro ao buscar estatísticas: ${error.message}`);
    }
  }

  /**
   * Lista tarefas com prazo próximo
   * @param {number} companyId - ID da empresa
   * @param {number} days - Dias para vencimento (padrão: 7)
   * @returns {Promise<Array>} Lista de tarefas com prazo próximo
   */
  static async findUpcoming(companyId, days = 7) {
    const selectQuery = `
      SELECT 
        pt.id, pt.title, pt.priority, pt.due_date, pt.progress,
        pt.assigned_to_user_id, pt.project_id,
        p.name as project_name,
        u.name as assigned_user_name,
        (pt.due_date - NOW()::date) as days_remaining
      FROM polox.project_tasks pt
      INNER JOIN polox.projects p ON pt.project_id = p.id
      LEFT JOIN polox.users u ON pt.assigned_to_user_id = u.id
      WHERE p.company_id = $1 
        AND pt.deleted_at IS NULL
        AND pt.status NOT IN ('completed', 'cancelled')
        AND pt.due_date IS NOT NULL
        AND pt.due_date BETWEEN NOW()::date AND (NOW() + INTERVAL '${days} days')::date
      ORDER BY pt.due_date ASC, pt.priority ASC
    `;

    try {
      const result = await query(selectQuery, [companyId], { companyId });
      return result.rows.map(task => ({
        ...task,
        days_remaining: parseInt(task.days_remaining)
      }));
    } catch (error) {
      throw new ApiError(500, `Erro ao buscar tarefas próximas: ${error.message}`);
    }
  }

  /**
   * Conta o total de tarefas
   * @param {number} companyId - ID da empresa
   * @param {Object} filters - Filtros opcionais
   * @returns {Promise<number>} Total de tarefas
   */
  static async count(companyId, filters = {}) {
    let whereClause = `
      WHERE p.company_id = $1 AND pt.deleted_at IS NULL
    `;
    const params = [companyId];

    if (filters.project_id) {
      whereClause += ` AND pt.project_id = $${params.length + 1}`;
      params.push(filters.project_id);
    }

    if (filters.status) {
      whereClause += ` AND pt.status = $${params.length + 1}`;
      params.push(filters.status);
    }

    if (filters.assigned_to_user_id) {
      whereClause += ` AND pt.assigned_to_user_id = $${params.length + 1}`;
      params.push(filters.assigned_to_user_id);
    }

    const countQuery = `
      SELECT COUNT(*) as total
      FROM polox.project_tasks pt
      INNER JOIN polox.projects p ON pt.project_id = p.id
      ${whereClause}
    `;

    try {
      const result = await query(countQuery, params, { companyId });
      return parseInt(result.rows[0].total);
    } catch (error) {
      throw new ApiError(500, `Erro ao contar tarefas: ${error.message}`);
    }
  }
}

module.exports = ProjectTaskModel;