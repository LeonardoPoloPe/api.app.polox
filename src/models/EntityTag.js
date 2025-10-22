const { query, transaction } = require('../config/database');
const { ApiError, ValidationError, NotFoundError } = require('../utils/errors');

/**
 * Model para relacionamento entre tags e entidades
 * Baseado no schema polox.entity_tags
 */
class EntityTagModel {
  /**
   * Adiciona uma tag a uma entidade
   * @param {Object} entityTagData - Dados do relacionamento
   * @returns {Promise<Object>} Relacionamento criado
   */
  static async addTag(entityTagData) {
    const {
      entity_type,
      entity_id,
      tag_id,
      added_by_user_id
    } = entityTagData;

    // Validar dados obrigatórios
    if (!entity_type || !entity_id || !tag_id || !added_by_user_id) {
      throw new ValidationError('Tipo de entidade, ID da entidade, ID da tag e usuário são obrigatórios');
    }

    // Verificar se relacionamento já existe
    const existingQuery = `
      SELECT id FROM polox.entity_tags 
      WHERE entity_type = $1 AND entity_id = $2 AND tag_id = $3 AND deleted_at IS NULL
    `;

    try {
      const existing = await query(existingQuery, [entity_type, entity_id, tag_id]);
      if (existing.rows.length > 0) {
        throw new ValidationError('Tag já está associada a esta entidade');
      }

      const insertQuery = `
        INSERT INTO polox.entity_tags (
          entity_type, entity_id, tag_id, added_by_user_id, created_at
        )
        VALUES (
          $1, $2, $3, $4, NOW()
        )
        RETURNING 
          id, entity_type, entity_id, tag_id, added_by_user_id, created_at
      `;

      const result = await query(insertQuery, [
        entity_type, entity_id, tag_id, added_by_user_id
      ]);

      return result.rows[0];
    } catch (error) {
      if (error.code === '23503') {
        if (error.constraint?.includes('tag')) {
          throw new ValidationError('Tag informada não existe');
        }
        if (error.constraint?.includes('user')) {
          throw new ValidationError('Usuário informado não existe');
        }
      }
      throw new ApiError(500, `Erro ao adicionar tag: ${error.message}`);
    }
  }

  /**
   * Remove uma tag de uma entidade
   * @param {string} entityType - Tipo da entidade
   * @param {number} entityId - ID da entidade
   * @param {number} tagId - ID da tag
   * @param {number} companyId - ID da empresa
   * @returns {Promise<boolean>} True se removido com sucesso
   */
  static async removeTag(entityType, entityId, tagId, companyId) {
    // Verificar se relacionamento existe
    const existingQuery = `
      SELECT et.id
      FROM polox.entity_tags et
      INNER JOIN polox.tags t ON et.tag_id = t.id
      WHERE et.entity_type = $1 AND et.entity_id = $2 AND et.tag_id = $3 
        AND t.company_id = $4 AND et.deleted_at IS NULL
    `;

    try {
      const existing = await query(existingQuery, [entityType, entityId, tagId, companyId]);
      
      if (existing.rows.length === 0) {
        throw new NotFoundError('Relacionamento tag-entidade não encontrado');
      }

      const deleteQuery = `
        UPDATE polox.entity_tags 
        SET deleted_at = NOW()
        WHERE entity_type = $1 AND entity_id = $2 AND tag_id = $3 AND deleted_at IS NULL
      `;

      const result = await query(deleteQuery, [entityType, entityId, tagId]);
      return result.rowCount > 0;
    } catch (error) {
      throw new ApiError(500, `Erro ao remover tag: ${error.message}`);
    }
  }

  /**
   * Lista todas as tags de uma entidade
   * @param {string} entityType - Tipo da entidade
   * @param {number} entityId - ID da entidade
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Array>} Lista de tags
   */
  static async findByEntity(entityType, entityId, companyId) {
    const selectQuery = `
      SELECT 
        et.id as entity_tag_id,
        et.entity_type,
        et.entity_id,
        et.tag_id,
        et.added_by_user_id,
        et.created_at,
        t.name as tag_name,
        t.slug as tag_slug,
        t.color as tag_color,
        t.description as tag_description,
        tc.name as category_name,
        tc.slug as category_slug,
        tc.color as category_color,
        u.name as added_by_name
      FROM polox.entity_tags et
      INNER JOIN polox.tags t ON et.tag_id = t.id
      INNER JOIN polox.tag_categories tc ON t.category_id = tc.id
      INNER JOIN polox.users u ON et.added_by_user_id = u.id
      WHERE et.entity_type = $1 AND et.entity_id = $2 AND t.company_id = $3 
        AND et.deleted_at IS NULL AND t.deleted_at IS NULL
      ORDER BY tc.sort_order ASC, t.name ASC
    `;

    try {
      const result = await query(selectQuery, [entityType, entityId, companyId], { companyId });
      return result.rows;
    } catch (error) {
      throw new ApiError(500, `Erro ao buscar tags da entidade: ${error.message}`);
    }
  }

  /**
   * Lista todas as entidades que possuem uma tag específica
   * @param {number} tagId - ID da tag
   * @param {number} companyId - ID da empresa
   * @param {Object} options - Opções de filtro
   * @returns {Promise<Array>} Lista de entidades
   */
  static async findByTag(tagId, companyId, options = {}) {
    const { 
      entity_type = null,
      page = 1, 
      limit = 50
    } = options;
    
    const offset = (page - 1) * limit;
    
    let whereClause = `
      WHERE et.tag_id = $1 AND t.company_id = $2 AND et.deleted_at IS NULL
    `;
    const params = [tagId, companyId];
    
    if (entity_type) {
      whereClause += ` AND et.entity_type = $${params.length + 1}`;
      params.push(entity_type);
    }

    const selectQuery = `
      SELECT 
        et.id as entity_tag_id,
        et.entity_type,
        et.entity_id,
        et.tag_id,
        et.added_by_user_id,
        et.created_at,
        t.name as tag_name,
        u.name as added_by_name
      FROM polox.entity_tags et
      INNER JOIN polox.tags t ON et.tag_id = t.id
      INNER JOIN polox.users u ON et.added_by_user_id = u.id
      ${whereClause}
      ORDER BY et.created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    params.push(limit, offset);

    try {
      const result = await query(selectQuery, params, { companyId });
      return result.rows;
    } catch (error) {
      throw new ApiError(500, `Erro ao buscar entidades da tag: ${error.message}`);
    }
  }

  /**
   * Substitui todas as tags de uma entidade
   * @param {string} entityType - Tipo da entidade
   * @param {number} entityId - ID da entidade
   * @param {Array} tagIds - Array de IDs das tags
   * @param {number} userId - ID do usuário
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Array>} Lista de tags atualizadas
   */
  static async replaceTags(entityType, entityId, tagIds, userId, companyId) {
    if (!Array.isArray(tagIds)) {
      throw new ValidationError('IDs das tags devem ser um array');
    }

    try {
      return await transaction(async (client) => {
        // Remover todas as tags existentes
        await client.query(
          `UPDATE polox.entity_tags 
           SET deleted_at = NOW() 
           WHERE entity_type = $1 AND entity_id = $2 AND deleted_at IS NULL`,
          [entityType, entityId]
        );

        // Adicionar novas tags
        const newTags = [];
        for (const tagId of tagIds) {
          const insertQuery = `
            INSERT INTO polox.entity_tags (
              entity_type, entity_id, tag_id, added_by_user_id, created_at
            )
            VALUES ($1, $2, $3, $4, NOW())
            RETURNING id, entity_type, entity_id, tag_id, added_by_user_id, created_at
          `;

          const result = await client.query(insertQuery, [
            entityType, entityId, tagId, userId
          ]);

          newTags.push(result.rows[0]);
        }

        return newTags;
      });
    } catch (error) {
      throw new ApiError(500, `Erro ao substituir tags: ${error.message}`);
    }
  }

  /**
   * Adiciona múltiplas tags a uma entidade
   * @param {string} entityType - Tipo da entidade
   * @param {number} entityId - ID da entidade
   * @param {Array} tagIds - Array de IDs das tags
   * @param {number} userId - ID do usuário
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Array>} Lista de tags adicionadas
   */
  static async addMultipleTags(entityType, entityId, tagIds, userId, companyId) {
    if (!Array.isArray(tagIds) || tagIds.length === 0) {
      throw new ValidationError('IDs das tags devem ser um array não vazio');
    }

    try {
      return await transaction(async (client) => {
        const addedTags = [];
        
        for (const tagId of tagIds) {
          // Verificar se já existe
          const existingResult = await client.query(
            `SELECT id FROM polox.entity_tags 
             WHERE entity_type = $1 AND entity_id = $2 AND tag_id = $3 AND deleted_at IS NULL`,
            [entityType, entityId, tagId]
          );

          if (existingResult.rows.length === 0) {
            const insertQuery = `
              INSERT INTO polox.entity_tags (
                entity_type, entity_id, tag_id, added_by_user_id, created_at
              )
              VALUES ($1, $2, $3, $4, NOW())
              RETURNING id, entity_type, entity_id, tag_id, added_by_user_id, created_at
            `;

            const result = await client.query(insertQuery, [
              entityType, entityId, tagId, userId
            ]);

            addedTags.push(result.rows[0]);
          }
        }

        return addedTags;
      });
    } catch (error) {
      throw new ApiError(500, `Erro ao adicionar múltiplas tags: ${error.message}`);
    }
  }

  /**
   * Remove múltiplas tags de uma entidade
   * @param {string} entityType - Tipo da entidade
   * @param {number} entityId - ID da entidade
   * @param {Array} tagIds - Array de IDs das tags
   * @param {number} companyId - ID da empresa
   * @returns {Promise<number>} Número de tags removidas
   */
  static async removeMultipleTags(entityType, entityId, tagIds, companyId) {
    if (!Array.isArray(tagIds) || tagIds.length === 0) {
      throw new ValidationError('IDs das tags devem ser um array não vazio');
    }

    const placeholders = tagIds.map((_, index) => `$${index + 4}`).join(',');
    const deleteQuery = `
      UPDATE polox.entity_tags 
      SET deleted_at = NOW()
      WHERE entity_type = $1 AND entity_id = $2 
        AND tag_id IN (${placeholders})
        AND deleted_at IS NULL
        AND tag_id IN (
          SELECT id FROM polox.tags WHERE company_id = $3
        )
    `;

    try {
      const result = await query(deleteQuery, [entityType, entityId, companyId, ...tagIds]);
      return result.rowCount;
    } catch (error) {
      throw new ApiError(500, `Erro ao remover múltiplas tags: ${error.message}`);
    }
  }

  /**
   * Remove todas as tags de uma entidade
   * @param {string} entityType - Tipo da entidade
   * @param {number} entityId - ID da entidade
   * @param {number} companyId - ID da empresa
   * @returns {Promise<number>} Número de tags removidas
   */
  static async removeAllTags(entityType, entityId, companyId) {
    const deleteQuery = `
      UPDATE polox.entity_tags 
      SET deleted_at = NOW()
      WHERE entity_type = $1 AND entity_id = $2 AND deleted_at IS NULL
        AND tag_id IN (
          SELECT id FROM polox.tags WHERE company_id = $3
        )
    `;

    try {
      const result = await query(deleteQuery, [entityType, entityId, companyId]);
      return result.rowCount;
    } catch (error) {
      throw new ApiError(500, `Erro ao remover todas as tags: ${error.message}`);
    }
  }

  /**
   * Lista entidades similares baseadas em tags compartilhadas
   * @param {string} entityType - Tipo da entidade
   * @param {number} entityId - ID da entidade
   * @param {number} companyId - ID da empresa
   * @param {number} limit - Limite de resultados
   * @returns {Promise<Array>} Lista de entidades similares
   */
  static async findSimilarEntities(entityType, entityId, companyId, limit = 10) {
    const selectQuery = `
      WITH entity_tags AS (
        SELECT et.tag_id
        FROM polox.entity_tags et
        INNER JOIN polox.tags t ON et.tag_id = t.id
        WHERE et.entity_type = $1 AND et.entity_id = $2 
          AND t.company_id = $3 AND et.deleted_at IS NULL
      )
      SELECT 
        et.entity_type,
        et.entity_id,
        COUNT(*) as shared_tags_count,
        ARRAY_AGG(DISTINCT t.name) as shared_tag_names
      FROM polox.entity_tags et
      INNER JOIN polox.tags t ON et.tag_id = t.id
      INNER JOIN entity_tags src ON et.tag_id = src.tag_id
      WHERE et.entity_type = $1 
        AND NOT (et.entity_type = $1 AND et.entity_id = $2)
        AND t.company_id = $3 
        AND et.deleted_at IS NULL
      GROUP BY et.entity_type, et.entity_id
      ORDER BY shared_tags_count DESC, et.entity_id ASC
      LIMIT $4
    `;

    try {
      const result = await query(selectQuery, [entityType, entityId, companyId, limit], { companyId });
      
      return result.rows.map(row => ({
        ...row,
        shared_tags_count: parseInt(row.shared_tags_count),
        shared_tag_names: Array.isArray(row.shared_tag_names) ? row.shared_tag_names : []
      }));
    } catch (error) {
      throw new ApiError(500, `Erro ao buscar entidades similares: ${error.message}`);
    }
  }

  /**
   * Estatísticas de uso de tags
   * @param {number} companyId - ID da empresa
   * @param {Object} options - Opções de filtro
   * @returns {Promise<Object>} Estatísticas
   */
  static async getUsageStats(companyId, options = {}) {
    const { 
      entity_type = null,
      start_date = null,
      end_date = null
    } = options;
    
    let whereClause = `
      WHERE t.company_id = $1 AND et.deleted_at IS NULL
    `;
    const params = [companyId];
    
    if (entity_type) {
      whereClause += ` AND et.entity_type = $${params.length + 1}`;
      params.push(entity_type);
    }

    if (start_date) {
      whereClause += ` AND et.created_at >= $${params.length + 1}`;
      params.push(start_date);
    }

    if (end_date) {
      whereClause += ` AND et.created_at <= $${params.length + 1}`;
      params.push(end_date);
    }

    const statsQuery = `
      SELECT 
        COUNT(*) as total_entity_tags,
        COUNT(DISTINCT et.entity_type) as unique_entity_types,
        COUNT(DISTINCT et.entity_id) as unique_entities,
        COUNT(DISTINCT et.tag_id) as unique_tags_used,
        COUNT(DISTINCT et.added_by_user_id) as unique_users
      FROM polox.entity_tags et
      INNER JOIN polox.tags t ON et.tag_id = t.id
      ${whereClause}
    `;

    try {
      const result = await query(statsQuery, params, { companyId });
      const stats = result.rows[0];

      return {
        total_entity_tags: parseInt(stats.total_entity_tags) || 0,
        unique_entity_types: parseInt(stats.unique_entity_types) || 0,
        unique_entities: parseInt(stats.unique_entities) || 0,
        unique_tags_used: parseInt(stats.unique_tags_used) || 0,
        unique_users: parseInt(stats.unique_users) || 0
      };
    } catch (error) {
      throw new ApiError(500, `Erro ao buscar estatísticas de uso: ${error.message}`);
    }
  }

  /**
   * Tags mais populares
   * @param {number} companyId - ID da empresa
   * @param {Object} options - Opções de filtro
   * @returns {Promise<Array>} Lista de tags mais usadas
   */
  static async getPopularTags(companyId, options = {}) {
    const { 
      entity_type = null,
      limit = 20
    } = options;
    
    let whereClause = `
      WHERE t.company_id = $1 AND et.deleted_at IS NULL
    `;
    const params = [companyId];
    
    if (entity_type) {
      whereClause += ` AND et.entity_type = $${params.length + 1}`;
      params.push(entity_type);
    }

    const selectQuery = `
      SELECT 
        t.id as tag_id,
        t.name as tag_name,
        t.slug as tag_slug,
        t.color as tag_color,
        tc.name as category_name,
        COUNT(*) as usage_count,
        COUNT(DISTINCT et.entity_id) as unique_entities
      FROM polox.entity_tags et
      INNER JOIN polox.tags t ON et.tag_id = t.id
      INNER JOIN polox.tag_categories tc ON t.category_id = tc.id
      ${whereClause}
      GROUP BY t.id, t.name, t.slug, t.color, tc.name
      ORDER BY usage_count DESC, t.name ASC
      LIMIT $${params.length + 1}
    `;

    params.push(limit);

    try {
      const result = await query(selectQuery, params, { companyId });
      
      return result.rows.map(tag => ({
        ...tag,
        usage_count: parseInt(tag.usage_count),
        unique_entities: parseInt(tag.unique_entities)
      }));
    } catch (error) {
      throw new ApiError(500, `Erro ao buscar tags populares: ${error.message}`);
    }
  }

  /**
   * Conta o total de relacionamentos tag-entidade
   * @param {number} companyId - ID da empresa
   * @param {Object} filters - Filtros opcionais
   * @returns {Promise<number>} Total de relacionamentos
   */
  static async count(companyId, filters = {}) {
    let whereClause = `
      WHERE t.company_id = $1 AND et.deleted_at IS NULL
    `;
    const params = [companyId];

    if (filters.entity_type) {
      whereClause += ` AND et.entity_type = $${params.length + 1}`;
      params.push(filters.entity_type);
    }

    if (filters.tag_id) {
      whereClause += ` AND et.tag_id = $${params.length + 1}`;
      params.push(filters.tag_id);
    }

    const countQuery = `
      SELECT COUNT(*) as total
      FROM polox.entity_tags et
      INNER JOIN polox.tags t ON et.tag_id = t.id
      ${whereClause}
    `;

    try {
      const result = await query(countQuery, params, { companyId });
      return parseInt(result.rows[0].total);
    } catch (error) {
      throw new ApiError(500, `Erro ao contar relacionamentos: ${error.message}`);
    }
  }
}

module.exports = EntityTagModel;