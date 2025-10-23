const { query, transaction } = require('../config/database');
const { ApiError, ValidationError, NotFoundError } = require('../utils/errors');

/**
 * Model para gerenciamento de leads
 * Baseado no schema polox.leads
 */
class LeadModel {
  /**
   * Cria um novo lead
   * @param {Object} leadData - Dados do lead
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object>} Lead criado
   */
  static async create(leadData, companyId) {
    const {
      name,
      email,
      phone,
      company_name,
      position,
      source,
      score = 0,
      temperature = 'frio',
      city,
      state,
      country = 'BR',
      notes, // Será processado separadamente
      interests = [], // Será processado separadamente
      tags = [], // Será processado separadamente
      created_by_id, // Renomeado de user_id
      owner_id // Renomeado de assigned_to_id
    } = leadData;

    // Validar dados obrigatórios
    if (!name) {
      throw new ValidationError('Nome é obrigatório');
    }

    return await transaction(async (client) => {
      // 1. Criar o lead (sem notes, tags, interests)
      const insertQuery = `
        INSERT INTO polox.leads (
          company_id, created_by_id, owner_id, name, email, phone, company_name, position,
          source, score, temperature, city, state, country, created_at, updated_at
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8,
          $9, $10, $11, $12, $13, $14, NOW(), NOW()
        )
        RETURNING 
          id, company_id, created_by_id, owner_id, name, email, phone, company_name, position,
          status, source, score, temperature, city, state, country,
          first_contact_at, last_contact_at, next_follow_up_at,
          converted_to_client_id, converted_at, conversion_value,
          created_at, updated_at
      `;

      const result = await client.query(insertQuery, [
        companyId, created_by_id, owner_id, name, email, phone, company_name, position,
        source, score, temperature, city, state, country
      ]);

      const lead = result.rows[0];

      // 2. Adicionar nota inicial se fornecida
      if (notes && notes.trim() !== '') {
        await client.query(`
          INSERT INTO polox.lead_notes (lead_id, created_by_id, content, type)
          VALUES ($1, $2, $3, 'general')
        `, [lead.id, created_by_id, notes]);
      }

      // 3. Adicionar tags
      if (tags && tags.length > 0) {
        for (const tagName of tags) {
          if (tagName && tagName.trim() !== '') {
            // Inserir tag se não existir
            const tagResult = await client.query(`
              INSERT INTO polox.tags (name)
              VALUES ($1)
              ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
              RETURNING id
            `, [tagName.trim()]);

            const tagId = tagResult.rows[0].id;

            // Associar tag ao lead
            await client.query(`
              INSERT INTO polox.lead_tags (lead_id, tag_id)
              VALUES ($1, $2)
              ON CONFLICT DO NOTHING
            `, [lead.id, tagId]);
          }
        }
      }

      // 4. Adicionar interests
      if (interests && interests.length > 0) {
        for (const interestName of interests) {
          if (interestName && interestName.trim() !== '') {
            // Inserir interest se não existir (específico da empresa)
            const interestResult = await client.query(`
              INSERT INTO polox.interests (name, category, company_id)
              VALUES ($1, 'other', $2)
              ON CONFLICT (company_id, name) WHERE company_id IS NOT NULL 
              DO UPDATE SET name = EXCLUDED.name
              RETURNING id
            `, [interestName.trim(), companyId]);

            const interestId = interestResult.rows[0].id;

            // Associar interest ao lead
            await client.query(`
              INSERT INTO polox.lead_interests (lead_id, interest_id)
              VALUES ($1, $2)
              ON CONFLICT DO NOTHING
            `, [lead.id, interestId]);
          }
        }
      }

      // 5. Retornar lead completo com relacionamentos
      return await this.findById(lead.id, companyId);
    }, { companyId });
  }

  /**
   * Busca lead por ID
   * @param {number} id - ID do lead
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object|null>} Lead encontrado ou null
   */
  static async findById(id, companyId) {
    const selectQuery = `
      SELECT 
        l.id, l.company_id, l.created_by_id, l.owner_id, l.name, l.email, l.phone, 
        l.company_name, l.position, l.status, l.source, l.score, 
        l.temperature, l.city, l.state, l.country,
        l.first_contact_at, l.last_contact_at, 
        l.next_follow_up_at, l.converted_to_client_id, l.converted_at, 
        l.conversion_value, l.created_at, l.updated_at,
        creator.name as created_by_name,
        owner.name as owner_name,
        c.name as client_name
      FROM polox.leads l
      LEFT JOIN polox.users creator ON l.created_by_id = creator.id
      LEFT JOIN polox.users owner ON l.owner_id = owner.id
      LEFT JOIN polox.clients c ON l.converted_to_client_id = c.id
      WHERE l.id = $1 AND l.company_id = $2 AND l.deleted_at IS NULL
    `;

    try {
      const result = await query(selectQuery, [id, companyId], { companyId });
      const lead = result.rows[0];
      
      if (!lead) {
        return null;
      }

      // Buscar notas do lead
      const notesResult = await query(`
        SELECT 
          ln.id, ln.content, ln.type, ln.created_at, ln.updated_at,
          u.name as created_by_name
        FROM polox.lead_notes ln
        LEFT JOIN polox.users u ON ln.created_by_id = u.id
        WHERE ln.lead_id = $1 AND ln.deleted_at IS NULL
        ORDER BY ln.created_at DESC
      `, [id], { companyId });

      // Buscar tags do lead
      const tagsResult = await query(`
        SELECT t.id, t.name, t.color
        FROM polox.tags t
        INNER JOIN polox.lead_tags lt ON t.id = lt.tag_id
        WHERE lt.lead_id = $1
        ORDER BY t.name
      `, [id], { companyId });

      // Buscar interests do lead
      const interestsResult = await query(`
        SELECT 
          i.id, 
          i.name, 
          i.category,
          i.company_id,
          CASE 
            WHEN i.company_id IS NULL THEN true 
            ELSE false 
          END as is_global
        FROM polox.interests i
        INNER JOIN polox.lead_interests li ON i.id = li.interest_id
        WHERE li.lead_id = $1
          AND (i.company_id = $2 OR i.company_id IS NULL)
        ORDER BY i.name
      `, [id, companyId], { companyId });

      // Montar objeto completo
      return {
        ...lead,
        notes: notesResult.rows,
        tags: tagsResult.rows,
        interests: interestsResult.rows
      };
    } catch (error) {
      throw new ApiError(500, `Erro ao buscar lead: ${error.message}`);
    }
  }

  /**
   * Lista leads com filtros e paginação
   * @param {Object} options - Opções de busca
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object>} Lista de leads e metadados
   */
  static async list(options = {}, companyId) {
    const {
      page = 1,
      limit = 10,
      status = null,
      source = null,
      temperature = null,
      ownerId = null, // Renomeado de userId
      search = null,
      sortBy = 'created_at',
      sortOrder = 'DESC'
    } = options;

    const offset = (page - 1) * limit;
    const conditions = ['l.company_id = $1', 'l.deleted_at IS NULL'];
    const values = [companyId];
    let paramCount = 2;

    // Adicionar filtros
    if (status) {
      conditions.push(`l.status = $${paramCount}`);
      values.push(status);
      paramCount++;
    }

    if (source) {
      conditions.push(`l.source = $${paramCount}`);
      values.push(source);
      paramCount++;
    }

    if (temperature) {
      conditions.push(`l.temperature = $${paramCount}`);
      values.push(temperature);
      paramCount++;
    }

    if (ownerId) {
      conditions.push(`l.owner_id = $${paramCount}`);
      values.push(ownerId);
      paramCount++;
    }

    if (search) {
      conditions.push(`(l.name ILIKE $${paramCount} OR l.email ILIKE $${paramCount} OR l.company_name ILIKE $${paramCount})`);
      values.push(`%${search}%`);
      paramCount++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Query para contar total
    const countQuery = `
      SELECT COUNT(*) 
      FROM polox.leads l 
      ${whereClause}
    `;

    // Query para buscar dados
    const selectQuery = `
      SELECT 
        l.id, l.name, l.email, l.phone, l.company_name, l.position,
        l.status, l.source, l.score, l.temperature, l.city, l.state,
        l.first_contact_at, l.last_contact_at, l.next_follow_up_at,
        l.converted_at, l.conversion_value, l.created_at, l.updated_at,
        owner.name as owner_name,
        (SELECT COUNT(*) FROM polox.lead_notes WHERE lead_id = l.id AND deleted_at IS NULL) as notes_count,
        (SELECT json_agg(t.name) FROM polox.tags t INNER JOIN polox.lead_tags lt ON t.id = lt.tag_id WHERE lt.lead_id = l.id) as tags,
        (SELECT json_agg(i.name) FROM polox.interests i INNER JOIN polox.lead_interests li ON i.id = li.interest_id WHERE li.lead_id = l.id) as interests
      FROM polox.leads l
      LEFT JOIN polox.users owner ON l.owner_id = owner.id
      ${whereClause}
      ORDER BY l.${sortBy} ${sortOrder}
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
      throw new ApiError(500, `Erro ao listar leads: ${error.message}`);
    }
  }

  /**
   * Atualiza dados do lead
   * @param {number} id - ID do lead
   * @param {Object} updateData - Dados para atualizar
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object|null>} Lead atualizado ou null
   */
  static async update(id, updateData, companyId) {
    const allowedFields = [
      'name', 'email', 'phone', 'company_name', 'position', 'status',
      'source', 'score', 'temperature', 'city', 'state', 'country',
      'created_by_id', 'owner_id', 'next_follow_up_at'
    ];

    const updates = [];
    const values = [];
    let paramCount = 1;

    // Construir query dinamicamente
    for (const [key, value] of Object.entries(updateData)) {
      if (allowedFields.includes(key)) {
        updates.push(`${key} = $${paramCount}`);
        values.push(value);
        paramCount++;
      }
    }

    if (updates.length === 0) {
      throw new ValidationError('Nenhum campo válido para atualizar');
    }

    updates.push('updated_at = NOW()');
    values.push(id, companyId);

    const updateQuery = `
      UPDATE polox.leads 
      SET ${updates.join(', ')}
      WHERE id = $${paramCount} AND company_id = $${paramCount + 1} AND deleted_at IS NULL
      RETURNING 
        id, company_id, created_by_id, owner_id, name, email, phone, company_name, position,
        status, source, score, temperature, city, state, country,
        created_at, updated_at
    `;

    try {
      const result = await query(updateQuery, values, { companyId });
      const lead = result.rows[0];
      
      if (!lead) {
        return null;
      }

      // Se foram fornecidas tags, atualizar
      if (updateData.tags !== undefined) {
        await this.updateTags(id, updateData.tags, companyId);
      }

      // Se foram fornecidos interests, atualizar
      if (updateData.interests !== undefined) {
        await this.updateInterests(id, updateData.interests, companyId);
      }

      // Retornar lead completo com relacionamentos
      return await this.findById(id, companyId);
    } catch (error) {
      throw new ApiError(500, `Erro ao atualizar lead: ${error.message}`);
    }
  }

  /**
   * Converte lead em cliente
   * @param {number} leadId - ID do lead
   * @param {Object} clientData - Dados do cliente
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object>} Cliente criado e lead atualizado
   */
  static async convertToClient(leadId, clientData, companyId) {
    return await transaction(async (client) => {
      // Buscar lead
      const leadResult = await client.query(
        'SELECT * FROM polox.leads WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL',
        [leadId, companyId]
      );

      if (leadResult.rows.length === 0) {
        throw new NotFoundError('Lead');
      }

      const lead = leadResult.rows[0];

      // Criar cliente
      const createClientQuery = `
        INSERT INTO polox.clients (
          company_id, converted_from_lead_id, name, email, phone, 
          company_name, type, acquisition_date, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_DATE, NOW(), NOW())
        RETURNING id, name, email, phone, company_name, created_at
      `;

      const clientResult = await client.query(createClientQuery, [
        companyId,
        leadId,
        clientData.name || lead.name,
        clientData.email || lead.email,
        clientData.phone || lead.phone,
        clientData.company_name || lead.company_name,
        clientData.type || 'person'
      ]);

      const newClient = clientResult.rows[0];

      // Atualizar lead
      const updateLeadQuery = `
        UPDATE polox.leads 
        SET 
          status = 'convertido',
          converted_to_client_id = $1,
          converted_at = NOW(),
          conversion_value = $2,
          updated_at = NOW()
        WHERE id = $3 AND company_id = $4
        RETURNING id, status, converted_at, conversion_value
      `;

      const updatedLeadResult = await client.query(updateLeadQuery, [
        newClient.id,
        clientData.conversion_value || 0,
        leadId,
        companyId
      ]);

      return {
        client: newClient,
        lead: updatedLeadResult.rows[0]
      };
    }, { companyId });
  }

  /**
   * Atualiza score do lead
   * @param {number} id - ID do lead
   * @param {number} newScore - Novo score (0-100)
   * @param {number} companyId - ID da empresa
   * @returns {Promise<boolean>} True se atualizado com sucesso
   */
  static async updateScore(id, newScore, companyId) {
    if (newScore < 0 || newScore > 100) {
      throw new ValidationError('Score deve estar entre 0 e 100');
    }

    const updateQuery = `
      UPDATE polox.leads 
      SET score = $1, updated_at = NOW()
      WHERE id = $2 AND company_id = $3 AND deleted_at IS NULL
    `;

    try {
      const result = await query(updateQuery, [newScore, id, companyId], { companyId });
      return result.rowCount > 0;
    } catch (error) {
      throw new ApiError(500, `Erro ao atualizar score: ${error.message}`);
    }
  }

  /**
   * Registra contato com lead
   * @param {number} id - ID do lead
   * @param {number} companyId - ID da empresa
   * @returns {Promise<boolean>} True se atualizado com sucesso
   */
  static async recordContact(id, companyId) {
    const updateQuery = `
      UPDATE polox.leads 
      SET 
        last_contact_at = NOW(),
        first_contact_at = COALESCE(first_contact_at, NOW()),
        updated_at = NOW()
      WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL
    `;

    try {
      const result = await query(updateQuery, [id, companyId], { companyId });
      return result.rowCount > 0;
    } catch (error) {
      throw new ApiError(500, `Erro ao registrar contato: ${error.message}`);
    }
  }

  /**
   * Soft delete do lead
   * @param {number} id - ID do lead
   * @param {number} companyId - ID da empresa
   * @returns {Promise<boolean>} True se deletado com sucesso
   */
  static async softDelete(id, companyId) {
    const updateQuery = `
      UPDATE polox.leads 
      SET deleted_at = NOW(), updated_at = NOW()
      WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL
    `;

    try {
      const result = await query(updateQuery, [id, companyId], { companyId });
      return result.rowCount > 0;
    } catch (error) {
      throw new ApiError(500, `Erro ao deletar lead: ${error.message}`);
    }
  }

  /**
   * Obtém estatísticas de leads da empresa
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object>} Estatísticas dos leads
   */
  static async getStats(companyId) {
    const statsQuery = `
      SELECT 
        COUNT(*) as total_leads,
        COUNT(CASE WHEN status = 'novo' THEN 1 END) as novos,
        COUNT(CASE WHEN status = 'contactado' THEN 1 END) as contactados,
        COUNT(CASE WHEN status = 'qualificado' THEN 1 END) as qualificados,
        COUNT(CASE WHEN status = 'convertido' THEN 1 END) as convertidos,
        COUNT(CASE WHEN status = 'perdido' THEN 1 END) as perdidos,
        COUNT(CASE WHEN temperature = 'quente' THEN 1 END) as quentes,
        COUNT(CASE WHEN temperature = 'morno' THEN 1 END) as mornos,
        COUNT(CASE WHEN temperature = 'frio' THEN 1 END) as frios,
        AVG(score) as score_medio,
        COALESCE(SUM(conversion_value), 0) as valor_total_conversoes
      FROM polox.leads 
      WHERE company_id = $1 AND deleted_at IS NULL
    `;

    try {
      const result = await query(statsQuery, [companyId], { companyId });
      return result.rows[0];
    } catch (error) {
      throw new ApiError(500, `Erro ao obter estatísticas: ${error.message}`);
    }
  }

  /**
   * Adiciona uma nota ao lead
   * @param {number} leadId - ID do lead
   * @param {number} userId - ID do usuário que está criando a nota
   * @param {string} content - Conteúdo da nota
   * @param {string} type - Tipo da nota (general, call, meeting, email, whatsapp, other)
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object>} Nota criada
   */
  static async addNote(leadId, userId, content, type = 'general', companyId) {
    if (!content || content.trim() === '') {
      throw new ValidationError('Conteúdo da nota é obrigatório');
    }

    const validTypes = ['general', 'call', 'meeting', 'email', 'whatsapp', 'other'];
    if (!validTypes.includes(type)) {
      throw new ValidationError(`Tipo de nota inválido. Use: ${validTypes.join(', ')}`);
    }

    const insertQuery = `
      INSERT INTO polox.lead_notes (lead_id, created_by_id, content, type)
      VALUES ($1, $2, $3, $4)
      RETURNING 
        id, lead_id, created_by_id, content, type, 
        created_at, updated_at
    `;

    try {
      const result = await query(insertQuery, [leadId, userId, content, type], { companyId });
      return result.rows[0];
    } catch (error) {
      throw new ApiError(500, `Erro ao adicionar nota: ${error.message}`);
    }
  }

  /**
   * Busca todas as notas de um lead
   * @param {number} leadId - ID do lead
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Array>} Lista de notas
   */
  static async getNotes(leadId, companyId) {
    const selectQuery = `
      SELECT 
        ln.id, ln.content, ln.type, ln.created_at, ln.updated_at,
        u.name as created_by_name, u.email as created_by_email
      FROM polox.lead_notes ln
      LEFT JOIN polox.users u ON ln.created_by_id = u.id
      WHERE ln.lead_id = $1 AND ln.deleted_at IS NULL
      ORDER BY ln.created_at DESC
    `;

    try {
      const result = await query(selectQuery, [leadId], { companyId });
      return result.rows;
    } catch (error) {
      throw new ApiError(500, `Erro ao buscar notas: ${error.message}`);
    }
  }

  /**
   * Adiciona uma tag ao lead (cria a tag se não existir)
   * @param {number} leadId - ID do lead
   * @param {string} tagName - Nome da tag
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object>} Tag associada
   */
  static async addTag(leadId, tagName, companyId) {
    if (!tagName || tagName.trim() === '') {
      throw new ValidationError('Nome da tag é obrigatório');
    }

    return await transaction(async (client) => {
      // Inserir tag se não existir
      const tagResult = await client.query(`
        INSERT INTO polox.tags (name)
        VALUES ($1)
        ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
        RETURNING id, name, color
      `, [tagName.trim()]);

      const tag = tagResult.rows[0];

      // Associar tag ao lead
      await client.query(`
        INSERT INTO polox.lead_tags (lead_id, tag_id)
        VALUES ($1, $2)
        ON CONFLICT DO NOTHING
      `, [leadId, tag.id]);

      return tag;
    }, { companyId });
  }

  /**
   * Busca todas as tags de um lead
   * @param {number} leadId - ID do lead
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Array>} Lista de tags
   */
  static async getTags(leadId, companyId) {
    const selectQuery = `
      SELECT t.id, t.name, t.color, t.description
      FROM polox.tags t
      INNER JOIN polox.lead_tags lt ON t.id = lt.tag_id
      WHERE lt.lead_id = $1
      ORDER BY t.name
    `;

    try {
      const result = await query(selectQuery, [leadId], { companyId });
      return result.rows;
    } catch (error) {
      throw new ApiError(500, `Erro ao buscar tags: ${error.message}`);
    }
  }

  /**
   * Remove uma tag do lead
   * @param {number} leadId - ID do lead
   * @param {number} tagId - ID da tag
   * @param {number} companyId - ID da empresa
   * @returns {Promise<boolean>} True se removido com sucesso
   */
  static async removeTag(leadId, tagId, companyId) {
    const deleteQuery = `
      DELETE FROM polox.lead_tags
      WHERE lead_id = $1 AND tag_id = $2
    `;

    try {
      const result = await query(deleteQuery, [leadId, tagId], { companyId });
      return result.rowCount > 0;
    } catch (error) {
      throw new ApiError(500, `Erro ao remover tag: ${error.message}`);
    }
  }

  /**
   * Atualiza todas as tags de um lead
   * @param {number} leadId - ID do lead
   * @param {Array<string>} tagNames - Array com nomes das tags
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Array>} Lista de tags atualizadas
   */
  static async updateTags(leadId, tagNames, companyId) {
    return await transaction(async (client) => {
      // Remover todas as tags antigas
      await client.query(`
        DELETE FROM polox.lead_tags WHERE lead_id = $1
      `, [leadId]);

      // Adicionar novas tags
      if (tagNames && tagNames.length > 0) {
        for (const tagName of tagNames) {
          if (tagName && tagName.trim() !== '') {
            // Inserir tag se não existir
            const tagResult = await client.query(`
              INSERT INTO polox.tags (name)
              VALUES ($1)
              ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
              RETURNING id
            `, [tagName.trim()]);

            const tagId = tagResult.rows[0].id;

            // Associar tag ao lead
            await client.query(`
              INSERT INTO polox.lead_tags (lead_id, tag_id)
              VALUES ($1, $2)
              ON CONFLICT DO NOTHING
            `, [leadId, tagId]);
          }
        }
      }

      // Retornar tags atualizadas
      const result = await client.query(`
        SELECT t.id, t.name, t.color
        FROM polox.tags t
        INNER JOIN polox.lead_tags lt ON t.id = lt.tag_id
        WHERE lt.lead_id = $1
        ORDER BY t.name
      `, [leadId]);

      return result.rows;
    }, { companyId });
  }

  /**
   * Adiciona um interesse ao lead (cria o interesse se não existir)
   * @param {number} leadId - ID do lead
   * @param {string} interestName - Nome do interesse
   * @param {string} category - Categoria do interesse
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object>} Interesse associado
   */
  static async addInterest(leadId, interestName, category = 'other', companyId) {
    if (!interestName || interestName.trim() === '') {
      throw new ValidationError('Nome do interesse é obrigatório');
    }

    const validCategories = ['product', 'service', 'industry', 'technology', 'other'];
    if (category && !validCategories.includes(category)) {
      throw new ValidationError(`Categoria inválida. Use: ${validCategories.join(', ')}`);
    }

    return await transaction(async (client) => {
      // Inserir interesse se não existir (específico da empresa)
      const interestResult = await client.query(`
        INSERT INTO polox.interests (name, category, company_id)
        VALUES ($1, $2, $3)
        ON CONFLICT (company_id, name) WHERE company_id IS NOT NULL 
        DO UPDATE SET category = EXCLUDED.category
        RETURNING id, name, category, company_id
      `, [interestName.trim(), category, companyId]);

      const interest = interestResult.rows[0];

      // Associar interesse ao lead
      await client.query(`
        INSERT INTO polox.lead_interests (lead_id, interest_id)
        VALUES ($1, $2)
        ON CONFLICT DO NOTHING
      `, [leadId, interest.id]);

      return interest;
    }, { companyId });
  }

  /**
   * Busca todos os interesses de um lead
   * @param {number} leadId - ID do lead
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Array>} Lista de interesses
   */
  static async getInterests(leadId, companyId) {
    const selectQuery = `
      SELECT 
        i.id, 
        i.name, 
        i.category, 
        i.description,
        i.company_id,
        CASE 
          WHEN i.company_id IS NULL THEN true 
          ELSE false 
        END as is_global
      FROM polox.interests i
      INNER JOIN polox.lead_interests li ON i.id = li.interest_id
      WHERE li.lead_id = $1
        AND (i.company_id = $2 OR i.company_id IS NULL)
      ORDER BY i.name
    `;

    try {
      const result = await query(selectQuery, [leadId, companyId], { companyId });
      return result.rows;
    } catch (error) {
      throw new ApiError(500, `Erro ao buscar interesses: ${error.message}`);
    }
  }

  /**
   * Remove um interesse do lead
   * @param {number} leadId - ID do lead
   * @param {number} interestId - ID do interesse
   * @param {number} companyId - ID da empresa
   * @returns {Promise<boolean>} True se removido com sucesso
   */
  static async removeInterest(leadId, interestId, companyId) {
    const deleteQuery = `
      DELETE FROM polox.lead_interests
      WHERE lead_id = $1 AND interest_id = $2
    `;

    try {
      const result = await query(deleteQuery, [leadId, interestId], { companyId });
      return result.rowCount > 0;
    } catch (error) {
      throw new ApiError(500, `Erro ao remover interesse: ${error.message}`);
    }
  }

  /**
   * Atualiza todos os interesses de um lead
   * @param {number} leadId - ID do lead
   * @param {Array<string>} interestNames - Array com nomes dos interesses
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Array>} Lista de interesses atualizados
   */
  static async updateInterests(leadId, interestNames, companyId) {
    return await transaction(async (client) => {
      // Remover todos os interesses antigos (apenas os da empresa, não os globais)
      await client.query(`
        DELETE FROM polox.lead_interests 
        WHERE lead_id = $1 
        AND interest_id IN (
          SELECT id FROM polox.interests 
          WHERE company_id = $2
        )
      `, [leadId, companyId]);

      // Adicionar novos interesses
      if (interestNames && interestNames.length > 0) {
        for (const interestName of interestNames) {
          if (interestName && interestName.trim() !== '') {
            // Inserir interesse se não existir (específico da empresa)
            const interestResult = await client.query(`
              INSERT INTO polox.interests (name, category, company_id)
              VALUES ($1, 'other', $2)
              ON CONFLICT (company_id, name) WHERE company_id IS NOT NULL 
              DO UPDATE SET name = EXCLUDED.name
              RETURNING id
            `, [interestName.trim(), companyId]);

            const interestId = interestResult.rows[0].id;

            // Associar interesse ao lead
            await client.query(`
              INSERT INTO polox.lead_interests (lead_id, interest_id)
              VALUES ($1, $2)
              ON CONFLICT DO NOTHING
            `, [leadId, interestId]);
          }
        }
      }

      // Retornar interesses atualizados (da empresa e globais)
      const result = await client.query(`
        SELECT 
          i.id, 
          i.name, 
          i.category,
          i.company_id,
          CASE 
            WHEN i.company_id IS NULL THEN true 
            ELSE false 
          END as is_global
        FROM polox.interests i
        INNER JOIN polox.lead_interests li ON i.id = li.interest_id
        WHERE li.lead_id = $1
          AND (i.company_id = $2 OR i.company_id IS NULL)
        ORDER BY i.name
      `, [leadId, companyId]);

      return result.rows;
    }, { companyId });
  }
}

module.exports = LeadModel;