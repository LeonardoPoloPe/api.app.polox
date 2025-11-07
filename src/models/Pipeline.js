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

const { query, transaction } = require('../config/database');
const { ApiError, ValidationError, NotFoundError } = require('../utils/errors');

/**
 * Model para pipelines de vendas
 * Baseado no schema polox.pipelines
 */
class PipelineModel {
  /**
   * Cria um novo pipeline
   * @param {Object} pipelineData - Dados do pipeline
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object>} Pipeline criado
   */
  static async create(pipelineData, companyId) {
    const {
      name,
      description,
      is_default = false,
      stages = []
    } = pipelineData;

    // Validar dados obrigatórios
    if (!name) {
      throw new ValidationError('Nome do pipeline é obrigatório');
    }

    if (!Array.isArray(stages) || stages.length === 0) {
      throw new ValidationError('Pipeline deve ter pelo menos um estágio');
    }

    // Validar estrutura dos estágios
    for (const stage of stages) {
      if (!stage.name || typeof stage.order !== 'number') {
        throw new ValidationError('Cada estágio deve ter nome e ordem');
      }
    }

    const insertQuery = `
      INSERT INTO polox.pipelines (
        company_id, name, description, is_default, stages,
        created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
      RETURNING 
        id, company_id, name, description, is_default, stages,
        created_at, updated_at
    `;

    try {
      const result = await query(insertQuery, [
        companyId, name, description, is_default, JSON.stringify(stages)
      ], { companyId });

      return result.rows[0];
    } catch (error) {
      if (error.code === '23505') {
        throw new ValidationError('Já existe um pipeline com este nome');
      }
      throw new ApiError(500, `Erro ao criar pipeline: ${error.message}`);
    }
  }

  /**
   * Busca pipeline por ID
   * @param {number} id - ID do pipeline
   * @param {number} companyId - ID da empresa (multi-tenant)
   * @returns {Promise<Object|null>} Pipeline encontrado ou null
   */
  static async findById(id, companyId) {
    const selectQuery = `
      SELECT 
        id, company_id, name, description, is_default, stages,
        created_at, updated_at
      FROM polox.pipelines 
      WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL
    `;

    try {
      const result = await query(selectQuery, [id, companyId], { companyId });
      return result.rows[0] || null;
    } catch (error) {
      throw new ApiError(500, `Erro ao buscar pipeline: ${error.message}`);
    }
  }

  /**
   * Lista todos os pipelines de uma empresa
   * @param {number} companyId - ID da empresa
   * @param {Object} options - Opções de filtro
   * @returns {Promise<Array>} Lista de pipelines
   */
  static async findByCompany(companyId, options = {}) {
    const { 
      page = 1, 
      limit = 10,
      is_default = null 
    } = options;
    
    const offset = (page - 1) * limit;
    
    let whereClause = 'WHERE company_id = $1 AND deleted_at IS NULL';
    const params = [companyId];
    
    if (is_default !== null) {
      whereClause += ` AND is_default = $${params.length + 1}`;
      params.push(is_default);
    }

    const selectQuery = `
      SELECT 
        id, company_id, name, description, is_default, stages,
        created_at, updated_at
      FROM polox.pipelines 
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    params.push(limit, offset);

    try {
      const result = await query(selectQuery, params, { companyId });
      return result.rows;
    } catch (error) {
      throw new ApiError(500, `Erro ao buscar pipelines: ${error.message}`);
    }
  }

  /**
   * Busca o pipeline padrão da empresa
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object|null>} Pipeline padrão ou null
   */
  static async findDefault(companyId) {
    const selectQuery = `
      SELECT 
        id, company_id, name, description, is_default, stages,
        created_at, updated_at
      FROM polox.pipelines 
      WHERE company_id = $1 AND is_default = true AND deleted_at IS NULL
      LIMIT 1
    `;

    try {
      const result = await query(selectQuery, [companyId], { companyId });
      return result.rows[0] || null;
    } catch (error) {
      throw new ApiError(500, `Erro ao buscar pipeline padrão: ${error.message}`);
    }
  }

  /**
   * Atualiza um pipeline
   * @param {number} id - ID do pipeline
   * @param {Object} updateData - Dados para atualização
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object>} Pipeline atualizado
   */
  static async update(id, updateData, companyId) {
    // Verificar se pipeline existe
    const existing = await this.findById(id, companyId);
    if (!existing) {
      throw new NotFoundError('Pipeline não encontrado');
    }

    const {
      name,
      description,
      is_default,
      stages
    } = updateData;

    // Validar estágios se fornecidos
    if (stages && (!Array.isArray(stages) || stages.length === 0)) {
      throw new ValidationError('Pipeline deve ter pelo menos um estágio');
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

    if (is_default !== undefined) {
      updateFields.push(`is_default = $${paramCount++}`);
      params.push(is_default);
    }

    if (stages !== undefined) {
      updateFields.push(`stages = $${paramCount++}`);
      params.push(JSON.stringify(stages));
    }

    if (updateFields.length === 0) {
      throw new ValidationError('Nenhum campo para atualizar');
    }

    updateFields.push(`updated_at = NOW()`);
    params.push(id, companyId);

    const updateQuery = `
      UPDATE polox.pipelines 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramCount++} AND company_id = $${paramCount++} AND deleted_at IS NULL
      RETURNING 
        id, company_id, name, description, is_default, stages,
        created_at, updated_at
    `;

    try {
      const result = await query(updateQuery, params, { companyId });
      
      if (result.rows.length === 0) {
        throw new NotFoundError('Pipeline não encontrado');
      }

      return result.rows[0];
    } catch (error) {
      if (error.code === '23505') {
        throw new ValidationError('Já existe um pipeline com este nome');
      }
      throw new ApiError(500, `Erro ao atualizar pipeline: ${error.message}`);
    }
  }

  /**
   * Remove um pipeline (soft delete)
   * @param {number} id - ID do pipeline
   * @param {number} companyId - ID da empresa
   * @returns {Promise<boolean>} True se removido com sucesso
   */
  static async delete(id, companyId) {
    // Verificar se pipeline existe
    const existing = await this.findById(id, companyId);
    if (!existing) {
      throw new NotFoundError('Pipeline não encontrado');
    }

    // Verificar se não é o pipeline padrão
    if (existing.is_default) {
      throw new ValidationError('Não é possível remover o pipeline padrão');
    }

    const deleteQuery = `
      UPDATE polox.pipelines 
      SET deleted_at = NOW()
      WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL
    `;

    try {
      const result = await query(deleteQuery, [id, companyId], { companyId });
      return result.rowCount > 0;
    } catch (error) {
      throw new ApiError(500, `Erro ao remover pipeline: ${error.message}`);
    }
  }

  /**
   * Define um pipeline como padrão
   * @param {number} id - ID do pipeline
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object>} Pipeline atualizado
   */
  static async setAsDefault(id, companyId) {
    return await transaction(async (client) => {
      // Remover default de todos os outros pipelines
      await client.query(
        'UPDATE polox.pipelines SET is_default = false WHERE company_id = $1 AND deleted_at IS NULL',
        [companyId]
      );

      // Definir como padrão
      const result = await client.query(
        `UPDATE polox.pipelines 
         SET is_default = true, updated_at = NOW()
         WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL
         RETURNING id, company_id, name, description, is_default, stages, created_at, updated_at`,
        [id, companyId]
      );

      if (result.rows.length === 0) {
        throw new NotFoundError('Pipeline não encontrado');
      }

      return result.rows[0];
    }, { companyId });
  }

  /**
   * Conta o total de pipelines de uma empresa
   * @param {number} companyId - ID da empresa
   * @returns {Promise<number>} Total de pipelines
   */
  static async count(companyId) {
    const countQuery = `
      SELECT COUNT(*) as total
      FROM polox.pipelines 
      WHERE company_id = $1 AND deleted_at IS NULL
    `;

    try {
      const result = await query(countQuery, [companyId], { companyId });
      return parseInt(result.rows[0].total);
    } catch (error) {
      throw new ApiError(500, `Erro ao contar pipelines: ${error.message}`);
    }
  }
}

module.exports = PipelineModel;