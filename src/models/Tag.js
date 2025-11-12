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
 * Model para tags/etiquetas
 * Baseado no schema polox.tags
 */
class TagModel {
  /**
   * Cria uma nova tag
   * @param {Object} tagData - Dados da tag
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object>} Tag criada
   */
  static async create(tagData, companyId) {
    const {
      name,
      color = '#3498db',
      description = null,
      category = 'general',
      is_system = false,
      is_active = true,
      metadata = null
    } = tagData;

    // Validar dados obrigatórios
    if (!name) {
      throw new ValidationError('Nome da tag é obrigatório');
    }

    // Validar formato de cor hexadecimal
    const colorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
    if (!colorRegex.test(color)) {
      throw new ValidationError('Cor deve estar no formato hexadecimal válido (ex: #3498db)');
    }

    return await transaction(async (client) => {
      // Verificar se já existe tag com mesmo nome
      const existingTag = await client.query(
        'SELECT id FROM polox.tags WHERE company_id = $1 AND LOWER(tag_name) = LOWER($2) AND deleted_at IS NULL',
        [companyId, name]
      );

      if (existingTag.rows.length > 0) {
        throw new ValidationError('Já existe uma tag com este nome');
      }

      // Gerar slug único
      const slug = name.toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove acentos
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');

      // Verificar se slug já existe
      let finalSlug = slug;
      let counter = 1;
      while (true) {
        const slugCheck = await client.query(
          'SELECT id FROM polox.tags WHERE company_id = $1 AND slug = $2 AND deleted_at IS NULL',
          [companyId, finalSlug]
        );

        if (slugCheck.rows.length === 0) break;

        finalSlug = `${slug}-${counter}`;
        counter++;
      }

      const insertQuery = `
        INSERT INTO polox.tags (
          company_id, tag_name, slug, color, is_active, created_at, updated_at
        )
        VALUES (
          $1, $2, $3, $4, $5, NOW(), NOW()
        )
        RETURNING 
          id, tag_name as name, slug, color, is_active, created_at, updated_at
      `;

      const result = await client.query(insertQuery, [
        companyId, name, finalSlug, color, is_active
      ]);

      return result.rows[0];
    }, { companyId });
  }

  /**
   * Busca tag por ID
   * @param {number} id - ID da tag
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object|null>} Tag encontrada ou null
   */
  static async findById(id, companyId) {
    const selectQuery = `
      SELECT 
        t.id, t.tag_name as name, t.slug, t.color, t.is_active, t.created_at, t.updated_at,
        (
          (SELECT COUNT(*) FROM polox.contact_tags ct WHERE ct.tag_id = t.id) +
          (SELECT COUNT(*) FROM polox.supplier_tags st WHERE st.tag_id = t.id) +
          (SELECT COUNT(*) FROM polox.product_tags pt WHERE pt.tag_id = t.id) +
          (SELECT COUNT(*) FROM polox.sale_tags slt WHERE slt.tag_id = t.id) +
          (SELECT COUNT(*) FROM polox.ticket_tags tt WHERE tt.tag_id = t.id) +
          (SELECT COUNT(*) FROM polox.event_tags et WHERE et.tag_id = t.id) +
          (SELECT COUNT(*) FROM polox.financial_transaction_tags ftt WHERE ftt.tag_id = t.id)
        ) as usage_count,
        (
          (CASE WHEN EXISTS(SELECT 1 FROM polox.contact_tags ct WHERE ct.tag_id = t.id) THEN 1 ELSE 0 END) +
          (CASE WHEN EXISTS(SELECT 1 FROM polox.supplier_tags st WHERE st.tag_id = t.id) THEN 1 ELSE 0 END) +
          (CASE WHEN EXISTS(SELECT 1 FROM polox.product_tags pt WHERE pt.tag_id = t.id) THEN 1 ELSE 0 END) +
          (CASE WHEN EXISTS(SELECT 1 FROM polox.sale_tags slt WHERE slt.tag_id = t.id) THEN 1 ELSE 0 END) +
          (CASE WHEN EXISTS(SELECT 1 FROM polox.ticket_tags tt WHERE tt.tag_id = t.id) THEN 1 ELSE 0 END) +
          (CASE WHEN EXISTS(SELECT 1 FROM polox.event_tags et WHERE et.tag_id = t.id) THEN 1 ELSE 0 END) +
          (CASE WHEN EXISTS(SELECT 1 FROM polox.financial_transaction_tags ftt WHERE ftt.tag_id = t.id) THEN 1 ELSE 0 END)
        ) as entity_types_count
      FROM polox.tags t
      WHERE t.id = $1 AND t.company_id = $2 AND t.deleted_at IS NULL
    `;

    try {
      const result = await query(selectQuery, [id, companyId], { companyId });
      return result.rows[0] || null;
    } catch (error) {
      throw new ApiError(500, `Erro ao buscar tag: ${error.message}`);
    }
  }

  /**
   * Busca tag por slug
   * @param {string} slug - Slug da tag
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object|null>} Tag encontrada ou null
   */
  static async findBySlug(slug, companyId) {
    const selectQuery = `
      SELECT id, tag_name as name, slug, color, is_active, created_at, updated_at 
      FROM polox.tags
      WHERE slug = $1 AND company_id = $2 AND deleted_at IS NULL
    `;

    try {
      const result = await query(selectQuery, [slug, companyId], { companyId });
      return result.rows[0] || null;
    } catch (error) {
      throw new ApiError(500, `Erro ao buscar tag por slug: ${error.message}`);
    }
  }

  /**
   * Lista tags com filtros e paginação
   * @param {Object} options - Opções de busca
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object>} Lista de tags e metadados
   */
  static async list(options = {}, companyId) {
    const {
      page = 1,
      limit = 20,
      category = null,
      is_active = null,
      is_system = null,
      search = null,
      sortBy = 'name',
      sortOrder = 'ASC'
    } = options;

    const offset = (page - 1) * limit;
    const conditions = ['company_id = $1', 'deleted_at IS NULL'];
    const values = [companyId];
    let paramCount = 2;

    // Adicionar filtros
    if (category) {
      conditions.push(`category = $${paramCount}`);
      values.push(category);
      paramCount++;
    }

    if (is_active !== null) {
      conditions.push(`is_active = $${paramCount}`);
      values.push(is_active);
      paramCount++;
    }

    if (is_system !== null) {
      conditions.push(`is_system = $${paramCount}`);
      values.push(is_system);
      paramCount++;
    }

    if (search) {
      conditions.push(`tag_name ILIKE $${paramCount}`);
      values.push(`%${search}%`);
      paramCount++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Query para contar total
    const countQuery = `
      SELECT COUNT(*) 
      FROM polox.tags 
      ${whereClause}
    `;

    // Query para buscar dados
    const selectQuery = `
      SELECT 
        t.id, t.tag_name as name, t.slug, t.color, t.is_active, t.created_at, t.updated_at,
        (
          (SELECT COUNT(*) FROM polox.contact_tags ct WHERE ct.tag_id = t.id) +
          (SELECT COUNT(*) FROM polox.supplier_tags st WHERE st.tag_id = t.id) +
          (SELECT COUNT(*) FROM polox.product_tags pt WHERE pt.tag_id = t.id) +
          (SELECT COUNT(*) FROM polox.sale_tags slt WHERE slt.tag_id = t.id) +
          (SELECT COUNT(*) FROM polox.ticket_tags tt WHERE tt.tag_id = t.id) +
          (SELECT COUNT(*) FROM polox.event_tags et WHERE et.tag_id = t.id) +
          (SELECT COUNT(*) FROM polox.financial_transaction_tags ftt WHERE ftt.tag_id = t.id)
        ) as usage_count,
        (
          (CASE WHEN EXISTS(SELECT 1 FROM polox.contact_tags ct WHERE ct.tag_id = t.id) THEN 1 ELSE 0 END) +
          (CASE WHEN EXISTS(SELECT 1 FROM polox.supplier_tags st WHERE st.tag_id = t.id) THEN 1 ELSE 0 END) +
          (CASE WHEN EXISTS(SELECT 1 FROM polox.product_tags pt WHERE pt.tag_id = t.id) THEN 1 ELSE 0 END) +
          (CASE WHEN EXISTS(SELECT 1 FROM polox.sale_tags slt WHERE slt.tag_id = t.id) THEN 1 ELSE 0 END) +
          (CASE WHEN EXISTS(SELECT 1 FROM polox.ticket_tags tt WHERE tt.tag_id = t.id) THEN 1 ELSE 0 END) +
          (CASE WHEN EXISTS(SELECT 1 FROM polox.event_tags et WHERE et.tag_id = t.id) THEN 1 ELSE 0 END) +
          (CASE WHEN EXISTS(SELECT 1 FROM polox.financial_transaction_tags ftt WHERE ftt.tag_id = t.id) THEN 1 ELSE 0 END)
        ) as entity_types_count
      FROM polox.tags t
      ${whereClause}
      ORDER BY ${sortBy === 'name' ? 'tag_name' : sortBy} ${sortOrder}
      LIMIT $${paramCount} OFFSET $${paramCount + 1}
    `;

    try {
      const [countResult, dataResult] = await Promise.all([
        query(countQuery, values, { companyId }),
        query(selectQuery, [...values, limit, offset], { companyId })
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
      throw new ApiError(500, `Erro ao listar tags: ${error.message}`);
    }
  }

  /**
   * Atualiza dados da tag
   * @param {number} id - ID da tag
   * @param {Object} updateData - Dados para atualizar
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object|null>} Tag atualizada ou null
   */
  static async update(id, updateData, companyId) {
    const allowedFields = ['name', 'color', 'is_active'];

    return await transaction(async (client) => {
      // Verificar se tag existe
      const existingTag = await client.query(
        'SELECT * FROM polox.tags WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL',
        [id, companyId]
      );

      if (existingTag.rows.length === 0) {
        throw new NotFoundError('Tag não encontrada');
      }

      const currentTag = existingTag.rows[0];

      // Verificar se é tag do sistema e não pode ser alterada
      if (currentTag.is_system && !updateData.allowSystemUpdate) {
        throw new ValidationError('Tags do sistema não podem ser alteradas');
      }

      // Verificar se nome não está duplicado (se sendo alterado)
      if (updateData.name && updateData.name !== currentTag.name) {
        const nameCheck = await client.query(
          'SELECT id FROM polox.tags WHERE company_id = $1 AND LOWER(tag_name) = LOWER($2) AND id != $3 AND deleted_at IS NULL',
          [companyId, updateData.name, id]
        );

        if (nameCheck.rows.length > 0) {
          throw new ValidationError('Já existe uma tag com este nome');
        }
      }

      // Validar cor se fornecida
      if (updateData.color) {
        const colorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
        if (!colorRegex.test(updateData.color)) {
          throw new ValidationError('Cor deve estar no formato hexadecimal válido');
        }
      }

      const updates = [];
      const values = [];
      let paramCount = 1;

      // Construir query dinamicamente
      for (const [key, value] of Object.entries(updateData)) {
        if (allowedFields.includes(key)) {
          const columnName = key === 'name' ? 'tag_name' : key;
          updates.push(`${columnName} = $${paramCount}`);
          values.push(value);
          paramCount++;
        }
      }

      if (updates.length === 0) {
        throw new ValidationError('Nenhum campo válido para atualizar');
      }

      // Atualizar slug se nome foi alterado
      if (updateData.name) {
        const newSlug = updateData.name.toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-|-$/g, '');

        // Verificar se slug já existe
        let finalSlug = newSlug;
        let counter = 1;
        while (true) {
          const slugCheck = await client.query(
            'SELECT id FROM polox.tags WHERE company_id = $1 AND slug = $2 AND id != $3 AND deleted_at IS NULL',
            [companyId, finalSlug, id]
          );

          if (slugCheck.rows.length === 0) break;

          finalSlug = `${newSlug}-${counter}`;
          counter++;
        }

        updates.push(`slug = $${paramCount}`);
        values.push(finalSlug);
        paramCount++;
      }

      updates.push('updated_at = NOW()');
      values.push(id, companyId);

      const updateQuery = `
        UPDATE polox.tags 
        SET ${updates.join(', ')}
        WHERE id = $${paramCount} AND company_id = $${paramCount + 1} AND deleted_at IS NULL
        RETURNING 
          id, tag_name as name, slug, color, is_active, created_at, updated_at
      `;

      const result = await client.query(updateQuery, values);
      return result.rows[0] || null;
    }, { companyId });
  }

  /**
   * Adiciona tag a uma entidade
   * @param {number} tagId - ID da tag
   * @param {string} entityType - Tipo da entidade (contacts, suppliers, products, etc.)
   * @param {number} entityId - ID da entidade
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object>} Associação criada
   */
  static async addToEntity(tagId, entityType, entityId, companyId) {
    if (!entityType || !entityId) {
      throw new ValidationError('Tipo e ID da entidade são obrigatórios');
    }

    const validEntityTypes = [
      'contacts', 'suppliers', 'products', 'sales', 'tickets',
      'events', 'financial_transactions'
    ];

    if (!validEntityTypes.includes(entityType)) {
      throw new ValidationError(`Tipo de entidade inválido. Deve ser um de: ${validEntityTypes.join(', ')}`);
    }

    return await transaction(async (client) => {
      // Verificar se tag existe e está ativa
      const tag = await client.query(
        'SELECT id, tag_name as name FROM polox.tags WHERE id = $1 AND company_id = $2 AND is_active = TRUE AND deleted_at IS NULL',
        [tagId, companyId]
      );

      if (tag.rows.length === 0) {
        throw new NotFoundError('Tag não encontrada ou inativa');
      }

      // Mapear tipo de entidade para tabela e colunas correspondentes
      const entityMappings = {
        'contacts': { table: 'contact_tags', entityColumn: 'contato_id' },
        'suppliers': { table: 'supplier_tags', entityColumn: 'supplier_id' },
        'products': { table: 'product_tags', entityColumn: 'product_id' },
        'sales': { table: 'sale_tags', entityColumn: 'sale_id' },
        'tickets': { table: 'ticket_tags', entityColumn: 'ticket_id' },
        'events': { table: 'event_tags', entityColumn: 'event_id' },
        'financial_transactions': { table: 'financial_transaction_tags', entityColumn: 'financial_transaction_id' }
      };

      const mapping = entityMappings[entityType];
      
      // Verificar se associação já existe
      const existing = await client.query(
        `SELECT 1 FROM polox.${mapping.table} WHERE tag_id = $1 AND ${mapping.entityColumn} = $2`,
        [tagId, entityId]
      );

      if (existing.rows.length > 0) {
        throw new ValidationError('Tag já está associada a esta entidade');
      }

      const insertQuery = `
        INSERT INTO polox.${mapping.table} (
          tag_id, ${mapping.entityColumn}, created_at
        )
        VALUES ($1, $2, NOW())
        RETURNING tag_id, ${mapping.entityColumn} as entity_id, created_at
      `;

      const result = await client.query(insertQuery, [tagId, entityId]);

      return {
        id: `${tagId}_${entityId}`,
        tag_id: tagId,
        entity_type: entityType,
        entity_id: entityId,
        tagged_at: result.rows[0].created_at,
        tag_name: tag.rows[0].name
      };
    }, { companyId });
  }

  /**
   * Remove tag de uma entidade
   * @param {number} tagId - ID da tag
   * @param {string} entityType - Tipo da entidade
   * @param {number} entityId - ID da entidade
   * @param {number} companyId - ID da empresa
   * @returns {Promise<boolean>} True se removido com sucesso
   */
  static async removeFromEntity(tagId, entityType, entityId, companyId) {
    try {
      // Mapear tipo de entidade para tabela e colunas correspondentes
      const entityMappings = {
        'contacts': { table: 'contact_tags', entityColumn: 'contato_id' },
        'suppliers': { table: 'supplier_tags', entityColumn: 'supplier_id' },
        'products': { table: 'product_tags', entityColumn: 'product_id' },
        'sales': { table: 'sale_tags', entityColumn: 'sale_id' },
        'tickets': { table: 'ticket_tags', entityColumn: 'ticket_id' },
        'events': { table: 'event_tags', entityColumn: 'event_id' },
        'financial_transactions': { table: 'financial_transaction_tags', entityColumn: 'financial_transaction_id' }
      };

      const mapping = entityMappings[entityType];
      
      const deleteQuery = `
        DELETE FROM polox.${mapping.table} 
        WHERE tag_id = $1 AND ${mapping.entityColumn} = $2
      `;

      const result = await query(deleteQuery, [tagId, entityId], { companyId });
      return result.rowCount > 0;
    } catch (error) {
      throw new ApiError(500, `Erro ao remover tag da entidade: ${error.message}`);
    }
  }

  /**
   * Busca tags de uma entidade
   * @param {string} entityType - Tipo da entidade
   * @param {number} entityId - ID da entidade
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Array>} Lista de tags da entidade
   */
  static async getEntityTags(entityType, entityId, companyId) {
    try {
      // Mapear tipo de entidade para tabela e colunas correspondentes
      const entityMappings = {
        'contacts': { table: 'contact_tags', entityColumn: 'contato_id' },
        'suppliers': { table: 'supplier_tags', entityColumn: 'supplier_id' },
        'products': { table: 'product_tags', entityColumn: 'product_id' },
        'sales': { table: 'sale_tags', entityColumn: 'sale_id' },
        'tickets': { table: 'ticket_tags', entityColumn: 'ticket_id' },
        'events': { table: 'event_tags', entityColumn: 'event_id' },
        'financial_transactions': { table: 'financial_transaction_tags', entityColumn: 'financial_transaction_id' }
      };

      const mapping = entityMappings[entityType];
      
      const selectQuery = `
        SELECT 
          t.id, t.tag_name as name, t.slug, t.color,
          et.created_at as tagged_at
        FROM polox.tags t
        JOIN polox.${mapping.table} et ON t.id = et.tag_id
        WHERE et.${mapping.entityColumn} = $1 AND t.company_id = $2
          AND t.is_active = TRUE AND t.deleted_at IS NULL
        ORDER BY t.tag_name ASC
      `;

      const result = await query(selectQuery, [entityId, companyId], { companyId });
      return result.rows;
    } catch (error) {
      throw new ApiError(500, `Erro ao buscar tags da entidade: ${error.message}`);
    }
  }

  /**
   * Busca entidades por tag
   * @param {number} tagId - ID da tag
   * @param {string} entityType - Tipo da entidade (opcional)
   * @param {number} companyId - ID da empresa
   * @param {Object} options - Opções de paginação
   * @returns {Promise<Object>} Lista de entidades com a tag
   */
  static async getTaggedEntities(tagId, entityType, companyId, options = {}) {
    const { page = 1, limit = 20 } = options;
    const offset = (page - 1) * limit;

    const conditions = ['ti.tag_id = $1', 'ti.company_id = $2'];
    const values = [tagId, companyId];
    let paramCount = 3;

    if (entityType) {
      conditions.push(`ti.taggable_type = $${paramCount}`);
      values.push(entityType);
      paramCount++;
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    // Query para contar total
    const countQuery = `
      SELECT COUNT(*) 
      FROM polox.taggable_items ti
      ${whereClause}
    `;

    // Query para buscar dados
    const selectQuery = `
      SELECT 
        ti.taggable_type, ti.taggable_id, ti.tagged_at,
        t.name as tag_name
      FROM polox.taggable_items ti
      JOIN polox.tags t ON ti.tag_id = t.id
      ${whereClause}
      ORDER BY ti.tagged_at DESC
      LIMIT $${paramCount} OFFSET $${paramCount + 1}
    `;

    try {
      const [countResult, dataResult] = await Promise.all([
        query(countQuery, values, { companyId }),
        query(selectQuery, [...values, limit, offset], { companyId })
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
      throw new ApiError(500, `Erro ao buscar entidades marcadas: ${error.message}`);
    }
  }

  /**
   * Obtém tags mais utilizadas
   * @param {number} companyId - ID da empresa
   * @param {number} limit - Limite de resultados
   * @param {string} entityType - Tipo de entidade (opcional)
   * @returns {Promise<Array>} Tags mais utilizadas
   */
  static async getMostUsed(companyId, limit = 10, entityType = null) {
    const conditions = ['t.company_id = $1', 't.is_active = TRUE', 't.deleted_at IS NULL'];
    const values = [companyId];
    let paramCount = 2;

    if (entityType) {
      conditions.push(`ti.taggable_type = $${paramCount}`);
      values.push(entityType);
      paramCount++;
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const selectQuery = `
      SELECT 
        t.id, t.name, t.slug, t.color, t.category,
        COUNT(ti.id) as usage_count,
        COUNT(DISTINCT ti.taggable_type) as entity_types_count
      FROM polox.tags t
      LEFT JOIN polox.taggable_items ti ON t.id = ti.tag_id ${entityType ? 'AND ti.taggable_type = $2' : ''}
      ${whereClause}
      GROUP BY t.id, t.name, t.slug, t.color, t.category
      ORDER BY usage_count DESC, t.name ASC
      LIMIT $${paramCount}
    `;

    try {
      const result = await query(selectQuery, [...values, limit], { companyId });
      return result.rows;
    } catch (error) {
      throw new ApiError(500, `Erro ao buscar tags mais utilizadas: ${error.message}`);
    }
  }

  /**
   * Obtém estatísticas das tags
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object>} Estatísticas das tags
   */
  static async getStats(companyId) {
    const statsQuery = `
      SELECT 
        COUNT(*) as total_tags,
        COUNT(CASE WHEN is_active = TRUE THEN 1 END) as active_tags,
        COUNT(CASE WHEN is_system = TRUE THEN 1 END) as system_tags,
        COUNT(CASE WHEN category = 'general' THEN 1 END) as general_tags,
        COUNT(CASE WHEN category = 'priority' THEN 1 END) as priority_tags,
        COUNT(CASE WHEN category = 'status' THEN 1 END) as status_tags,
        COUNT(CASE WHEN category = 'type' THEN 1 END) as type_tags,
        (SELECT COUNT(*) FROM polox.taggable_items ti WHERE ti.company_id = $1) as total_taggings,
        (SELECT COUNT(DISTINCT tag_id) FROM polox.taggable_items ti WHERE ti.company_id = $1) as used_tags,
        (SELECT COUNT(DISTINCT taggable_type) FROM polox.taggable_items ti WHERE ti.company_id = $1) as tagged_entity_types
      FROM polox.tags 
      WHERE company_id = $1 AND deleted_at IS NULL
    `;

    try {
      const result = await query(statsQuery, [companyId], { companyId });
      const stats = result.rows[0];

      // Calcular percentuais
      stats.usage_percentage = stats.total_tags > 0 
        ? ((stats.used_tags / stats.total_tags) * 100).toFixed(2)
        : 0;

      return stats;
    } catch (error) {
      throw new ApiError(500, `Erro ao obter estatísticas: ${error.message}`);
    }
  }

  /**
   * Obtém estatísticas por categoria
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Array>} Estatísticas por categoria
   */
  static async getStatsByCategory(companyId) {
    const categoryStatsQuery = `
      SELECT 
        t.category,
        COUNT(t.id) as tag_count,
        COUNT(CASE WHEN t.is_active = TRUE THEN 1 END) as active_count,
        COUNT(ti.id) as usage_count,
        COUNT(DISTINCT ti.taggable_type) as entity_types_count
      FROM polox.tags t
      LEFT JOIN polox.taggable_items ti ON t.id = ti.tag_id
      WHERE t.company_id = $1 AND t.deleted_at IS NULL
      GROUP BY t.category
      ORDER BY tag_count DESC
    `;

    try {
      const result = await query(categoryStatsQuery, [companyId], { companyId });
      return result.rows;
    } catch (error) {
      throw new ApiError(500, `Erro ao obter estatísticas por categoria: ${error.message}`);
    }
  }

  /**
   * Sincroniza tags em lote para uma entidade
   * @param {string} entityType - Tipo da entidade
   * @param {number} entityId - ID da entidade
   * @param {Array} tagIds - IDs das tags para associar
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object>} Resultado da sincronização
   */
  static async syncEntityTags(entityType, entityId, tagIds = [], companyId) {
    if (!Array.isArray(tagIds)) {
      throw new ValidationError('IDs das tags devem ser fornecidos como array');
    }

    return await transaction(async (client) => {
      // Mapear tipo de entidade para tabela e colunas correspondentes
      const entityMappings = {
        'contacts': { table: 'contact_tags', entityColumn: 'contato_id' },
        'suppliers': { table: 'supplier_tags', entityColumn: 'supplier_id' },
        'products': { table: 'product_tags', entityColumn: 'product_id' },
        'sales': { table: 'sale_tags', entityColumn: 'sale_id' },
        'tickets': { table: 'ticket_tags', entityColumn: 'ticket_id' },
        'events': { table: 'event_tags', entityColumn: 'event_id' },
        'financial_transactions': { table: 'financial_transaction_tags', entityColumn: 'financial_transaction_id' }
      };

      const mapping = entityMappings[entityType];
      
      // Remover todas as tags atuais da entidade
      await client.query(
        `DELETE FROM polox.${mapping.table} WHERE ${mapping.entityColumn} = $1`,
        [entityId]
      );

      const results = {
        removed: 1,
        added: 0,
        errors: []
      };

      // Adicionar novas tags
      if (tagIds.length > 0) {
        // Verificar se todas as tags existem e estão ativas
        const validTags = await client.query(
          'SELECT id FROM polox.tags WHERE id = ANY($1) AND company_id = $2 AND is_active = TRUE AND deleted_at IS NULL',
          [tagIds, companyId]
        );

        const validTagIds = validTags.rows.map(row => row.id);
        const invalidTagIds = tagIds.filter(id => !validTagIds.includes(id));

        if (invalidTagIds.length > 0) {
          results.errors.push(`Tags inválidas ou inativas: ${invalidTagIds.join(', ')}`);
        }

        // Inserir tags válidas
        if (validTagIds.length > 0) {
          const insertPromises = validTagIds.map(tagId => 
            client.query(
              `INSERT INTO polox.${mapping.table} (tag_id, ${mapping.entityColumn}, created_at) VALUES ($1, $2, NOW())`,
              [tagId, entityId]
            )
          );

          await Promise.all(insertPromises);
          results.added = validTagIds.length;
        }
      }

      return results;
    }, { companyId });
  }

  /**
   * Busca tags por nomes
   * @param {Array} names - Nomes das tags
   * @param {number} companyId - ID da empresa
   * @param {boolean} createMissing - Se deve criar tags que não existem
   * @returns {Promise<Array>} Lista de tags encontradas/criadas
   */
  static async findOrCreateByNames(names, companyId, createMissing = false) {
    if (!Array.isArray(names) || names.length === 0) {
      return [];
    }

    return await transaction(async (client) => {
      // Buscar tags existentes
      const existingTags = await client.query(
        'SELECT id, tag_name as name, slug, color, is_active, created_at, updated_at FROM polox.tags WHERE company_id = $1 AND tag_name = ANY($2) AND deleted_at IS NULL',
        [companyId, names]
      );

      const found = existingTags.rows;
      const foundNames = found.map(tag => tag.name);
      const missingNames = names.filter(name => !foundNames.includes(name));

      // Criar tags que não existem (se solicitado)
      if (createMissing && missingNames.length > 0) {
        const createPromises = missingNames.map(async (name) => {
          try {
            const newTag = await this.create({ name }, companyId);
            return newTag;
          } catch (error) {
            console.error(`Erro ao criar tag '${name}':`, error.message);
            return null;
          }
        });

        const newTags = await Promise.all(createPromises);
        const validNewTags = newTags.filter(tag => tag !== null);

        return [...found, ...validNewTags];
      }

      return found;
    }, { companyId });
  }

  /**
   * Busca sugestões de tags baseadas em texto
   * @param {string} text - Texto para análise
   * @param {number} companyId - ID da empresa
   * @param {number} limit - Limite de sugestões
   * @returns {Promise<Array>} Sugestões de tags
   */
  static async suggestTags(text, companyId, limit = 5) {
    if (!text || text.length < 2) {
      return [];
    }

    const searchQuery = `
      SELECT id, name, color, category, usage_count
      FROM (
        SELECT 
          t.id, t.name, t.color, t.category,
          COUNT(ti.id) as usage_count,
          CASE 
            WHEN LOWER(t.name) = LOWER($2) THEN 1
            WHEN LOWER(t.name) LIKE LOWER($3) THEN 2
            WHEN LOWER(t.description) LIKE LOWER($3) THEN 3
            ELSE 4
          END as relevance
        FROM polox.tags t
        LEFT JOIN polox.taggable_items ti ON t.id = ti.tag_id
        WHERE t.company_id = $1 
          AND t.is_active = TRUE 
          AND t.deleted_at IS NULL
          AND (
            LOWER(t.name) LIKE LOWER($3)
            OR LOWER(t.description) LIKE LOWER($3)
          )
        GROUP BY t.id, t.name, t.color, t.category
      ) ranked
      ORDER BY relevance ASC, usage_count DESC, name ASC
      LIMIT $4
    `;

    try {
      const result = await query(searchQuery, [
        companyId, 
        text, 
        `%${text}%`, 
        limit
      ], { companyId });
      
      return result.rows;
    } catch (error) {
      throw new ApiError(500, `Erro ao buscar sugestões de tags: ${error.message}`);
    }
  }

  /**
   * Ativa/desativa tag
   * @param {number} id - ID da tag
   * @param {boolean} isActive - Novo status
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object|null>} Tag atualizada
   */
  static async toggleActive(id, isActive, companyId) {
    return await transaction(async (client) => {
      // Verificar se é tag do sistema
      const tag = await client.query(
        'SELECT is_system FROM polox.tags WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL',
        [id, companyId]
      );

      if (tag.rows.length === 0) {
        throw new NotFoundError('Tag não encontrada');
      }

      if (tag.rows[0].is_system) {
        throw new ValidationError('Tags do sistema não podem ser desativadas');
      }

      const updateQuery = `
        UPDATE polox.tags 
        SET is_active = $3, updated_at = NOW()
        WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL
        RETURNING id, name, is_active, updated_at
      `;

      const result = await client.query(updateQuery, [id, companyId, isActive]);
      return result.rows[0] || null;
    }, { companyId });
  }

  /**
   * Soft delete da tag
   * @param {number} id - ID da tag
   * @param {number} companyId - ID da empresa
   * @returns {Promise<boolean>} True se deletado com sucesso
   */
  static async softDelete(id, companyId) {
    return await transaction(async (client) => {
      // Verificar se é tag do sistema
      const tag = await client.query(
        'SELECT is_system, name FROM polox.tags WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL',
        [id, companyId]
      );

      if (tag.rows.length === 0) {
        throw new NotFoundError('Tag não encontrada');
      }

      if (tag.rows[0].is_system) {
        throw new ValidationError('Tags do sistema não podem ser deletadas');
      }

      // Remover todas as associações da tag
      await Promise.all([
        client.query('DELETE FROM polox.contact_tags WHERE tag_id = $1', [id]),
        client.query('DELETE FROM polox.supplier_tags WHERE tag_id = $1', [id]),
        client.query('DELETE FROM polox.product_tags WHERE tag_id = $1', [id]),
        client.query('DELETE FROM polox.sale_tags WHERE tag_id = $1', [id]),
        client.query('DELETE FROM polox.ticket_tags WHERE tag_id = $1', [id]),
        client.query('DELETE FROM polox.event_tags WHERE tag_id = $1', [id]),
        client.query('DELETE FROM polox.financial_transaction_tags WHERE tag_id = $1', [id])
      ]);

      // Fazer soft delete da tag
      const updateQuery = `
        UPDATE polox.tags 
        SET 
          is_active = FALSE,
          deleted_at = NOW(),
          updated_at = NOW()
        WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL
      `;

      const result = await client.query(updateQuery, [id, companyId]);
      return result.rowCount > 0;
    }, { companyId });
  }

  // Método removido: getByCategory - campo category não existe no banco real

  /**
   * Cria tags padrão do sistema
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Array>} Tags criadas
   */
  static async createSystemTags(companyId) {
    const systemTags = [
      { name: 'Importante', color: '#e74c3c' },
      { name: 'Urgente', color: '#c0392b' },
      { name: 'Baixa Prioridade', color: '#95a5a6' },
      { name: 'Em Andamento', color: '#f39c12' },
      { name: 'Concluído', color: '#27ae60' },
      { name: 'Cancelado', color: '#7f8c8d' },
      { name: 'VIP', color: '#9b59b6' },
      { name: 'Lead Quente', color: '#e67e22' },
      { name: 'Requer Atenção', color: '#e74c3c' }
    ];

    const createdTags = [];

    for (const tagData of systemTags) {
      try {
        const existingTag = await this.findBySlug(
          tagData.name.toLowerCase().replace(/\s+/g, '-'), 
          companyId
        );

        if (!existingTag) {
          const newTag = await this.create({
            ...tagData,
            is_active: true
          }, companyId);
          createdTags.push(newTag);
        }
      } catch (error) {
        console.error(`Erro ao criar tag do sistema '${tagData.name}':`, error.message);
      }
    }

    return createdTags;
  }
}

module.exports = TagModel;