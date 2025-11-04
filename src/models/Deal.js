const { query, transaction } = require('../config/database');
const { ApiError, ValidationError, NotFoundError } = require('../utils/errors');

/**
 * Model para gerenciamento de negociações/deals (pipeline de vendas)
 * Tabela: polox.deals
 * 
 * Arquitetura: "Identidade vs. Intenção"
 * - Identidade (Contact): Quem a pessoa é
 * - Intenção (Deal): O que a pessoa quer comprar (esta tabela)
 * - Pipeline/Funil de vendas (etapa_funil)
 * - Fechamento: won (ganha) ou lost (perdida)
 */
class Deal {
  /**
   * Busca negociação por ID
   * @param {number} id - ID da negociação
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object>} Negociação
   */
  static async findById(id, companyId) {
    const sql = `
      SELECT 
        n.id, n.company_id, n.contato_id, n.owner_id,
        n.titulo, n.descricao, n.etapa_funil, n.valor_total_cents,
        n.probabilidade, n.origem, n.expected_close_date, n.closed_at,
        n.closed_reason, n.metadata, n.created_at, n.updated_at, n.deleted_at,
        c.nome as contact_name,
        c.email as contact_email,
        c.phone as contact_phone,
        c.tipo as contact_type,
        u.full_name as owner_name
      FROM polox.deals n
      INNER JOIN polox.contacts c ON n.contato_id = c.id
      LEFT JOIN polox.users u ON n.owner_id = u.id
      WHERE n.id = $1 AND n.company_id = $2 AND n.deleted_at IS NULL
    `;

    const result = await query(sql, [id, companyId]);

    if (result.rows.length === 0) {
      throw new NotFoundError('Deal not found');
    }

    return result.rows[0];
  }

  /**
   * Lista negociações com filtros
   * @param {number} companyId - ID da empresa
   * @param {Object} filters - Filtros opcionais
   * @returns {Promise<Array>} Lista de negociações
   */
  static async list(companyId, filters = {}) {
    const {
      contato_id,
      owner_id,
      etapa_funil,
      origem,
      status, // 'open' | 'won' | 'lost'
      search,
      sort_by = 'created_at',
      sort_order = 'DESC',
      limit = 50,
      offset = 0
    } = filters;

    const conditions = ['n.company_id = $1', 'n.deleted_at IS NULL'];
    const params = [companyId];
    let paramIndex = 2;

    if (contato_id) {
      conditions.push(`n.contato_id = $${paramIndex}`);
      params.push(contato_id);
      paramIndex++;
    }

    if (owner_id) {
      conditions.push(`n.owner_id = $${paramIndex}`);
      params.push(owner_id);
      paramIndex++;
    }

    if (etapa_funil) {
      conditions.push(`n.etapa_funil = $${paramIndex}`);
      params.push(etapa_funil);
      paramIndex++;
    }

    if (origem) {
      conditions.push(`n.origem = $${paramIndex}`);
      params.push(origem);
      paramIndex++;
    }

    if (status === 'open') {
      conditions.push('n.closed_at IS NULL');
    } else if (status === 'won') {
      conditions.push('n.closed_at IS NOT NULL');
      conditions.push(`n.closed_reason = 'won'`);
    } else if (status === 'lost') {
      conditions.push('n.closed_at IS NOT NULL');
      conditions.push(`n.closed_reason = 'lost'`);
    }

    if (search) {
      conditions.push(`(
        n.titulo ILIKE $${paramIndex} OR 
        n.descricao ILIKE $${paramIndex} OR 
        c.nome ILIKE $${paramIndex}
      )`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    const allowedSortFields = ['created_at', 'updated_at', 'valor_total_cents', 'etapa_funil'];
    const sortField = allowedSortFields.includes(sort_by) ? sort_by : 'created_at';
    const sortDirection = sort_order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const sql = `
      SELECT 
        n.id, n.company_id, n.contato_id, n.owner_id,
        n.titulo, n.descricao, n.etapa_funil, n.valor_total_cents,
        n.probabilidade, n.origem, n.expected_close_date, n.closed_at,
        n.closed_reason, n.created_at, n.updated_at,
        c.nome as contact_name,
        c.email as contact_email,
        c.phone as contact_phone,
        c.tipo as contact_type,
        u.full_name as owner_name
      FROM polox.deals n
      INNER JOIN polox.contacts c ON n.contato_id = c.id
      LEFT JOIN polox.users u ON n.owner_id = u.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY n.${sortField} ${sortDirection}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    params.push(limit, offset);

    const result = await query(sql, params);
    return result.rows;
  }

  static async listByContact(contactId, companyId) {
    return await this.list(companyId, { contato_id: contactId });
  }

  static async create(companyId, data) {
    const {
      contato_id,
      owner_id = null,
      titulo,
      descricao = null,
      etapa_funil = 'novo',
      valor_total_cents = 0,
      probabilidade = 0,
      origem = null,
      expected_close_date = null,
      metadata = {}
    } = data;

    if (!contato_id) {
      throw new ValidationError('Contact ID is required');
    }

    if (!titulo || titulo.trim().length === 0) {
      throw new ValidationError('Title is required');
    }

    if (typeof valor_total_cents !== 'number' || valor_total_cents < 0) {
      throw new ValidationError('Total value must be a number >= 0');
    }

    if (typeof probabilidade !== 'number' || probabilidade < 0 || probabilidade > 100) {
      throw new ValidationError('Probability must be between 0 and 100');
    }

    return await transaction(async (client) => {
      const contactCheck = await client.query(
        'SELECT id, tipo FROM polox.contacts WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL',
        [contato_id, companyId]
      );

      if (contactCheck.rows.length === 0) {
        throw new NotFoundError('Contact not found or does not belong to this company');
      }

      const insertQuery = `
        INSERT INTO polox.deals (
          company_id, contato_id, owner_id, titulo, descricao,
          etapa_funil, valor_total_cents, probabilidade, origem,
          expected_close_date, metadata, created_at, updated_at
        )
        VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8, $9,
          $10, $11, NOW(), NOW()
        )
        RETURNING 
          id, company_id, contato_id, owner_id, titulo, descricao,
          etapa_funil, valor_total_cents, probabilidade, origem,
          expected_close_date, closed_at, closed_reason, metadata,
          created_at, updated_at, deleted_at
      `;

      const result = await client.query(insertQuery, [
        companyId,
        contato_id,
        owner_id,
        titulo,
        descricao,
        etapa_funil,
        valor_total_cents,
        probabilidade,
        origem,
        expected_close_date,
        JSON.stringify(metadata)
      ]);

      return result.rows[0];
    });
  }

  static async update(id, companyId, data) {
    const {
      titulo,
      descricao,
      etapa_funil,
      valor_total_cents,
      probabilidade,
      origem,
      owner_id,
      expected_close_date,
      metadata
    } = data;

    const updates = [];
    const params = [id, companyId];
    let paramIndex = 3;

    if (titulo !== undefined) {
      if (!titulo || titulo.trim().length === 0) {
        throw new ValidationError('Title cannot be empty');
      }
      updates.push(`titulo = $${paramIndex}`);
      params.push(titulo);
      paramIndex++;
    }

    if (descricao !== undefined) {
      updates.push(`descricao = $${paramIndex}`);
      params.push(descricao);
      paramIndex++;
    }

    if (etapa_funil !== undefined) {
      updates.push(`etapa_funil = $${paramIndex}`);
      params.push(etapa_funil);
      paramIndex++;
    }

    if (valor_total_cents !== undefined) {
      if (typeof valor_total_cents !== 'number' || valor_total_cents < 0) {
        throw new ValidationError('Total value must be a number >= 0');
      }
      updates.push(`valor_total_cents = $${paramIndex}`);
      params.push(valor_total_cents);
      paramIndex++;
    }

    if (probabilidade !== undefined) {
      if (typeof probabilidade !== 'number' || probabilidade < 0 || probabilidade > 100) {
        throw new ValidationError('Probability must be between 0 and 100');
      }
      updates.push(`probabilidade = $${paramIndex}`);
      params.push(probabilidade);
      paramIndex++;
    }

    if (origem !== undefined) {
      updates.push(`origem = $${paramIndex}`);
      params.push(origem);
      paramIndex++;
    }

    if (owner_id !== undefined) {
      updates.push(`owner_id = $${paramIndex}`);
      params.push(owner_id);
      paramIndex++;
    }

    if (expected_close_date !== undefined) {
      updates.push(`expected_close_date = $${paramIndex}`);
      params.push(expected_close_date);
      paramIndex++;
    }

    if (metadata !== undefined) {
      updates.push(`metadata = $${paramIndex}`);
      params.push(JSON.stringify(metadata));
      paramIndex++;
    }

    if (updates.length === 0) {
      throw new ValidationError('No fields to update');
    }

    updates.push('updated_at = NOW()');

    const sql = `
      UPDATE polox.deals
      SET ${updates.join(', ')}
      WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL
      RETURNING *
    `;

    const result = await query(sql, params);

    if (result.rows.length === 0) {
      throw new NotFoundError('Deal not found');
    }

    return result.rows[0];
  }

  static async updateStage(id, companyId, stage) {
    return await this.update(id, companyId, { etapa_funil: stage });
  }

  static async markAsWon(id, companyId) {
    return await transaction(async (client) => {
      const dealUpdateQuery = `
        UPDATE polox.deals
        SET 
          closed_at = NOW(),
          closed_reason = 'won',
          updated_at = NOW()
        WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL
        RETURNING *
      `;

      const dealResult = await client.query(dealUpdateQuery, [id, companyId]);

      if (dealResult.rows.length === 0) {
        throw new NotFoundError('Deal not found');
      }

      const deal = dealResult.rows[0];

      const contactUpdateQuery = `
        UPDATE polox.contacts
        SET 
          tipo = 'cliente',
          last_purchase_date = NOW(),
          lifetime_value_cents = COALESCE(lifetime_value_cents, 0) + $1,
          updated_at = NOW()
        WHERE id = $2 AND company_id = $3 AND deleted_at IS NULL
      `;

      await client.query(contactUpdateQuery, [
        deal.valor_total_cents,
        deal.contato_id,
        companyId
      ]);

      return deal;
    });
  }

  static async markAsLost(id, companyId, reason = null) {
    const sql = `
      UPDATE polox.deals
      SET 
        closed_at = NOW(),
        closed_reason = 'lost',
        metadata = jsonb_set(
          COALESCE(metadata, '{}'::jsonb),
          '{lost_reason}',
          to_jsonb($3::text)
        ),
        updated_at = NOW()
      WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL
      RETURNING *
    `;

    const result = await query(sql, [id, companyId, reason || 'Not specified']);

    if (result.rows.length === 0) {
      throw new NotFoundError('Deal not found');
    }

    return result.rows[0];
  }

  static async reopen(id, companyId) {
    const sql = `
      UPDATE polox.deals
      SET 
        closed_at = NULL,
        closed_reason = NULL,
        updated_at = NOW()
      WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL
      RETURNING *
    `;

    const result = await query(sql, [id, companyId]);

    if (result.rows.length === 0) {
      throw new NotFoundError('Deal not found');
    }

    return result.rows[0];
  }

  static async softDelete(id, companyId) {
    const sql = `
      UPDATE polox.deals
      SET deleted_at = NOW(), updated_at = NOW()
      WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL
      RETURNING *
    `;

    const result = await query(sql, [id, companyId]);

    if (result.rows.length === 0) {
      throw new NotFoundError('Deal not found');
    }

    return result.rows[0];
  }

  static async count(companyId, filters = {}) {
    const { contato_id, owner_id, etapa_funil, origem, status } = filters;

    const conditions = ['company_id = $1', 'deleted_at IS NULL'];
    const params = [companyId];
    let paramIndex = 2;

    if (contato_id) {
      conditions.push(`contato_id = $${paramIndex}`);
      params.push(contato_id);
      paramIndex++;
    }

    if (owner_id) {
      conditions.push(`owner_id = $${paramIndex}`);
      params.push(owner_id);
      paramIndex++;
    }

    if (etapa_funil) {
      conditions.push(`etapa_funil = $${paramIndex}`);
      params.push(etapa_funil);
      paramIndex++;
    }

    if (origem) {
      conditions.push(`origem = $${paramIndex}`);
      params.push(origem);
      paramIndex++;
    }

    if (status === 'open') {
      conditions.push('closed_at IS NULL');
    } else if (status === 'won') {
      conditions.push('closed_at IS NOT NULL');
      conditions.push(`closed_reason = 'won'`);
    } else if (status === 'lost') {
      conditions.push('closed_at IS NOT NULL');
      conditions.push(`closed_reason = 'lost'`);
    }

    const sql = `
      SELECT COUNT(*) as total
      FROM polox.deals
      WHERE ${conditions.join(' AND ')}
    `;

    const result = await query(sql, params);
    return parseInt(result.rows[0].total);
  }

  static async getStats(companyId, filters = {}) {
    const { owner_id, etapa_funil, origem } = filters;

    const conditions = ['company_id = $1', 'deleted_at IS NULL'];
    const params = [companyId];
    let paramIndex = 2;

    if (owner_id) {
      conditions.push(`owner_id = $${paramIndex}`);
      params.push(owner_id);
      paramIndex++;
    }

    if (etapa_funil) {
      conditions.push(`etapa_funil = $${paramIndex}`);
      params.push(etapa_funil);
      paramIndex++;
    }

    if (origem) {
      conditions.push(`origem = $${paramIndex}`);
      params.push(origem);
      paramIndex++;
    }

    const sql = `
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE closed_at IS NULL) as open,
        COUNT(*) FILTER (WHERE closed_reason = 'won') as won,
        COUNT(*) FILTER (WHERE closed_reason = 'lost') as lost,
        COALESCE(SUM(valor_total_cents) FILTER (WHERE closed_at IS NULL), 0) as open_value_cents,
        COALESCE(SUM(valor_total_cents) FILTER (WHERE closed_reason = 'won'), 0) as won_value_cents,
        COALESCE(AVG(valor_total_cents), 0) as avg_value_cents,
        COALESCE(AVG(EXTRACT(EPOCH FROM (closed_at - created_at)) / 86400) FILTER (WHERE closed_at IS NOT NULL), 0) as avg_days_to_close,
        ROUND(
          CASE 
            WHEN COUNT(*) FILTER (WHERE closed_at IS NOT NULL) > 0 
            THEN (COUNT(*) FILTER (WHERE closed_reason = 'won')::numeric / COUNT(*) FILTER (WHERE closed_at IS NOT NULL)::numeric) * 100
            ELSE 0
          END,
          2
        ) as conversion_rate
      FROM polox.deals
      WHERE ${conditions.join(' AND ')}
    `;

    const result = await query(sql, params);
    return result.rows[0];
  }
}

module.exports = Deal;
