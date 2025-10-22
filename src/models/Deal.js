const { query, transaction } = require('../config/database');
const { ApiError, ValidationError, NotFoundError } = require('../utils/errors');

/**
 * Model para deals/oportunidades de vendas
 * Baseado no schema polox.deals
 */
class DealModel {
  /**
   * Cria uma nova oportunidade
   * @param {Object} dealData - Dados da oportunidade
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object>} Deal criado
   */
  static async create(dealData, companyId) {
    const {
      pipeline_id,
      client_id,
      lead_id,
      user_id,
      title,
      description,
      amount,
      stage,
      probability = 0,
      expected_close_date,
      source,
      tags = [],
      custom_fields = {}
    } = dealData;

    // Validar dados obrigatórios
    if (!pipeline_id || !title || !amount) {
      throw new ValidationError('Pipeline, título e valor são obrigatórios');
    }

    if (amount < 0) {
      throw new ValidationError('Valor deve ser positivo');
    }

    if (probability < 0 || probability > 100) {
      throw new ValidationError('Probabilidade deve estar entre 0 e 100');
    }

    const insertQuery = `
      INSERT INTO polox.deals (
        company_id, pipeline_id, client_id, lead_id, user_id,
        title, description, amount, stage, probability,
        expected_close_date, source, status, tags, custom_fields,
        created_at, updated_at
      )
      VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10,
        $11, $12, 'open', $13, $14,
        NOW(), NOW()
      )
      RETURNING 
        id, company_id, pipeline_id, client_id, lead_id, user_id,
        title, description, amount, stage, probability,
        expected_close_date, source, status, tags, custom_fields,
        created_at, updated_at
    `;

    try {
      const result = await query(insertQuery, [
        companyId, pipeline_id, client_id, lead_id, user_id,
        title, description, amount, stage, probability,
        expected_close_date, source, JSON.stringify(tags), JSON.stringify(custom_fields)
      ], { companyId });

      return result.rows[0];
    } catch (error) {
      if (error.code === '23503') {
        if (error.constraint?.includes('pipeline')) {
          throw new ValidationError('Pipeline informado não existe');
        }
        if (error.constraint?.includes('client')) {
          throw new ValidationError('Cliente informado não existe');
        }
        if (error.constraint?.includes('user')) {
          throw new ValidationError('Usuário informado não existe');
        }
      }
      throw new ApiError(500, `Erro ao criar deal: ${error.message}`);
    }
  }

  /**
   * Busca deal por ID
   * @param {number} id - ID do deal
   * @param {number} companyId - ID da empresa (multi-tenant)
   * @returns {Promise<Object|null>} Deal encontrado ou null
   */
  static async findById(id, companyId) {
    const selectQuery = `
      SELECT 
        d.id, d.company_id, d.pipeline_id, d.client_id, d.lead_id, d.user_id,
        d.title, d.description, d.amount, d.stage, d.probability,
        d.expected_close_date, d.source, d.status, d.tags, d.custom_fields,
        d.created_at, d.updated_at,
        p.name as pipeline_name,
        c.name as client_name,
        l.name as lead_name,
        u.name as user_name
      FROM polox.deals d
      LEFT JOIN polox.pipelines p ON d.pipeline_id = p.id
      LEFT JOIN polox.clients c ON d.client_id = c.id
      LEFT JOIN polox.leads l ON d.lead_id = l.id
      LEFT JOIN polox.users u ON d.user_id = u.id
      WHERE d.id = $1 AND d.company_id = $2 AND d.deleted_at IS NULL
    `;

    try {
      const result = await query(selectQuery, [id, companyId], { companyId });
      return result.rows[0] || null;
    } catch (error) {
      throw new ApiError(500, `Erro ao buscar deal: ${error.message}`);
    }
  }

  /**
   * Lista deals com filtros
   * @param {number} companyId - ID da empresa
   * @param {Object} options - Opções de filtro
   * @returns {Promise<Array>} Lista de deals
   */
  static async findByCompany(companyId, options = {}) {
    const { 
      page = 1, 
      limit = 10,
      pipeline_id = null,
      user_id = null,
      status = null,
      stage = null,
      min_amount = null,
      max_amount = null,
      search = null
    } = options;
    
    const offset = (page - 1) * limit;
    
    let whereClause = 'WHERE d.company_id = $1 AND d.deleted_at IS NULL';
    const params = [companyId];
    
    if (pipeline_id) {
      whereClause += ` AND d.pipeline_id = $${params.length + 1}`;
      params.push(pipeline_id);
    }

    if (user_id) {
      whereClause += ` AND d.user_id = $${params.length + 1}`;
      params.push(user_id);
    }

    if (status) {
      whereClause += ` AND d.status = $${params.length + 1}`;
      params.push(status);
    }

    if (stage) {
      whereClause += ` AND d.stage = $${params.length + 1}`;
      params.push(stage);
    }

    if (min_amount) {
      whereClause += ` AND d.amount >= $${params.length + 1}`;
      params.push(min_amount);
    }

    if (max_amount) {
      whereClause += ` AND d.amount <= $${params.length + 1}`;
      params.push(max_amount);
    }

    if (search) {
      whereClause += ` AND (d.title ILIKE $${params.length + 1} OR d.description ILIKE $${params.length + 1})`;
      params.push(`%${search}%`);
    }

    const selectQuery = `
      SELECT 
        d.id, d.company_id, d.pipeline_id, d.client_id, d.lead_id, d.user_id,
        d.title, d.description, d.amount, d.stage, d.probability,
        d.expected_close_date, d.source, d.status, d.tags, d.custom_fields,
        d.created_at, d.updated_at,
        p.name as pipeline_name,
        c.name as client_name,
        l.name as lead_name,
        u.name as user_name
      FROM polox.deals d
      LEFT JOIN polox.pipelines p ON d.pipeline_id = p.id
      LEFT JOIN polox.clients c ON d.client_id = c.id
      LEFT JOIN polox.leads l ON d.lead_id = l.id
      LEFT JOIN polox.users u ON d.user_id = u.id
      ${whereClause}
      ORDER BY d.created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    params.push(limit, offset);

    try {
      const result = await query(selectQuery, params, { companyId });
      return result.rows;
    } catch (error) {
      throw new ApiError(500, `Erro ao buscar deals: ${error.message}`);
    }
  }

  /**
   * Atualiza um deal
   * @param {number} id - ID do deal
   * @param {Object} updateData - Dados para atualização
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object>} Deal atualizado
   */
  static async update(id, updateData, companyId) {
    // Verificar se deal existe
    const existing = await this.findById(id, companyId);
    if (!existing) {
      throw new NotFoundError('Deal não encontrado');
    }

    const {
      pipeline_id,
      client_id,
      lead_id,
      user_id,
      title,
      description,
      amount,
      stage,
      probability,
      expected_close_date,
      source,
      status,
      tags,
      custom_fields
    } = updateData;

    // Validações
    if (amount !== undefined && amount < 0) {
      throw new ValidationError('Valor deve ser positivo');
    }

    if (probability !== undefined && (probability < 0 || probability > 100)) {
      throw new ValidationError('Probabilidade deve estar entre 0 e 100');
    }

    const updateFields = [];
    const params = [];
    let paramCount = 1;

    if (pipeline_id !== undefined) {
      updateFields.push(`pipeline_id = $${paramCount++}`);
      params.push(pipeline_id);
    }

    if (client_id !== undefined) {
      updateFields.push(`client_id = $${paramCount++}`);
      params.push(client_id);
    }

    if (lead_id !== undefined) {
      updateFields.push(`lead_id = $${paramCount++}`);
      params.push(lead_id);
    }

    if (user_id !== undefined) {
      updateFields.push(`user_id = $${paramCount++}`);
      params.push(user_id);
    }

    if (title !== undefined) {
      updateFields.push(`title = $${paramCount++}`);
      params.push(title);
    }

    if (description !== undefined) {
      updateFields.push(`description = $${paramCount++}`);
      params.push(description);
    }

    if (amount !== undefined) {
      updateFields.push(`amount = $${paramCount++}`);
      params.push(amount);
    }

    if (stage !== undefined) {
      updateFields.push(`stage = $${paramCount++}`);
      params.push(stage);
    }

    if (probability !== undefined) {
      updateFields.push(`probability = $${paramCount++}`);
      params.push(probability);
    }

    if (expected_close_date !== undefined) {
      updateFields.push(`expected_close_date = $${paramCount++}`);
      params.push(expected_close_date);
    }

    if (source !== undefined) {
      updateFields.push(`source = $${paramCount++}`);
      params.push(source);
    }

    if (status !== undefined) {
      updateFields.push(`status = $${paramCount++}`);
      params.push(status);
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
      UPDATE polox.deals 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramCount++} AND company_id = $${paramCount++} AND deleted_at IS NULL
      RETURNING 
        id, company_id, pipeline_id, client_id, lead_id, user_id,
        title, description, amount, stage, probability,
        expected_close_date, source, status, tags, custom_fields,
        created_at, updated_at
    `;

    try {
      const result = await query(updateQuery, params, { companyId });
      
      if (result.rows.length === 0) {
        throw new NotFoundError('Deal não encontrado');
      }

      return result.rows[0];
    } catch (error) {
      throw new ApiError(500, `Erro ao atualizar deal: ${error.message}`);
    }
  }

  /**
   * Move deal para outro estágio
   * @param {number} id - ID do deal
   * @param {string} newStage - Novo estágio
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object>} Deal atualizado
   */
  static async moveToStage(id, newStage, companyId) {
    return await this.update(id, { stage: newStage }, companyId);
  }

  /**
   * Marca deal como ganho
   * @param {number} id - ID do deal
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object>} Deal atualizado
   */
  static async markAsWon(id, companyId) {
    return await this.update(id, { 
      status: 'won',
      probability: 100 
    }, companyId);
  }

  /**
   * Marca deal como perdido
   * @param {number} id - ID do deal
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object>} Deal atualizado
   */
  static async markAsLost(id, companyId) {
    return await this.update(id, { 
      status: 'lost',
      probability: 0 
    }, companyId);
  }

  /**
   * Remove um deal (soft delete)
   * @param {number} id - ID do deal
   * @param {number} companyId - ID da empresa
   * @returns {Promise<boolean>} True se removido com sucesso
   */
  static async delete(id, companyId) {
    const deleteQuery = `
      UPDATE polox.deals 
      SET deleted_at = NOW()
      WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL
    `;

    try {
      const result = await query(deleteQuery, [id, companyId], { companyId });
      return result.rowCount > 0;
    } catch (error) {
      throw new ApiError(500, `Erro ao remover deal: ${error.message}`);
    }
  }

  /**
   * Estatísticas dos deals por pipeline
   * @param {number} companyId - ID da empresa
   * @param {number} pipelineId - ID do pipeline (opcional)
   * @returns {Promise<Object>} Estatísticas
   */
  static async getStatsByPipeline(companyId, pipelineId = null) {
    let whereClause = 'WHERE company_id = $1 AND deleted_at IS NULL';
    const params = [companyId];

    if (pipelineId) {
      whereClause += ` AND pipeline_id = $${params.length + 1}`;
      params.push(pipelineId);
    }

    const statsQuery = `
      SELECT 
        COUNT(*) as total_deals,
        SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) as open_deals,
        SUM(CASE WHEN status = 'won' THEN 1 ELSE 0 END) as won_deals,
        SUM(CASE WHEN status = 'lost' THEN 1 ELSE 0 END) as lost_deals,
        SUM(amount) as total_value,
        SUM(CASE WHEN status = 'won' THEN amount ELSE 0 END) as won_value,
        AVG(amount) as average_deal_value,
        AVG(CASE WHEN status IN ('won', 'lost') THEN probability ELSE NULL END) as average_probability
      FROM polox.deals 
      ${whereClause}
    `;

    try {
      const result = await query(statsQuery, params, { companyId });
      return result.rows[0];
    } catch (error) {
      throw new ApiError(500, `Erro ao buscar estatísticas: ${error.message}`);
    }
  }

  /**
   * Conta o total de deals de uma empresa
   * @param {number} companyId - ID da empresa
   * @param {Object} filters - Filtros opcionais
   * @returns {Promise<number>} Total de deals
   */
  static async count(companyId, filters = {}) {
    let whereClause = 'WHERE company_id = $1 AND deleted_at IS NULL';
    const params = [companyId];

    if (filters.status) {
      whereClause += ` AND status = $${params.length + 1}`;
      params.push(filters.status);
    }

    if (filters.pipeline_id) {
      whereClause += ` AND pipeline_id = $${params.length + 1}`;
      params.push(filters.pipeline_id);
    }

    const countQuery = `
      SELECT COUNT(*) as total
      FROM polox.deals 
      ${whereClause}
    `;

    try {
      const result = await query(countQuery, params, { companyId });
      return parseInt(result.rows[0].total);
    } catch (error) {
      throw new ApiError(500, `Erro ao contar deals: ${error.message}`);
    }
  }
}

module.exports = DealModel;