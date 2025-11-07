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

const { query } = require("../config/database");
const { ApiError, ValidationError, NotFoundError } = require("../utils/errors");

/**
 * Model para gerenciamento de notas de contatos (histórico unificado)
 * Tabela: polox.contact_notes
 *
 * Substitui: lead_notes + client_notes (tabelas antigas deletadas)
 *
 * Características:
 * - Histórico UNIFICADO: leads e clientes compartilham mesma tabela
 * - Quando lead vira cliente: notas permanecem intactas (visão 360°)
 * - Soft delete: deleted_at
 * - Tipos: general, call, meeting, email, whatsapp, other
 */
class ContactNote {
  /**
   * Cria uma nova nota para um contato
   * @param {Object} data - Dados da nota
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object>} Nota criada
   */
  static async create(data, companyId) {
    const { contato_id, created_by_id, content, type = "general" } = data;

    // Validar dados obrigatórios
    if (!contato_id) {
      throw new ValidationError("Contact ID is required");
    }

    if (!content || content.trim().length === 0) {
      throw new ValidationError("Content is required");
    }

    if (!created_by_id) {
      throw new ValidationError("Creator user ID is required");
    }

    const insertQuery = `
      INSERT INTO polox.contact_notes (
        contato_id, created_by_id, note_content, note_type, company_id, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
      RETURNING 
        id, contato_id, created_by_id, note_content, note_type, company_id,
        created_at, updated_at, deleted_at
    `;

    try {
      const result = await query(insertQuery, [
        contato_id,
        created_by_id,
        content,
        type,
        companyId,
      ]);

      return result.rows[0];
    } catch (error) {
      if (error.code === "23503") {
        throw new ValidationError("Contact or user not found");
      }
      throw new ApiError(500, `Error creating note: ${error.message}`);
    }
  }

  /**
   * Busca nota por ID
   * @param {number} id - ID da nota
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object|null>} Nota encontrada ou null
   */
  static async findById(id, companyId) {
    const selectQuery = `
      SELECT 
        cn.*,
        c.nome as contact_name,
        c.email as contact_email,
        c.tipo as contact_type,
        u.full_name as created_by_name,
        u.email as created_by_email
      FROM polox.contact_notes cn
      INNER JOIN polox.contacts c ON cn.contato_id = c.id
      INNER JOIN polox.users u ON cn.created_by_id = u.id
      WHERE cn.id = $1 
        AND cn.company_id = $2 
        AND cn.deleted_at IS NULL
        AND c.deleted_at IS NULL
    `;

    try {
      const result = await query(selectQuery, [id, companyId]);
      return result.rows[0] || null;
    } catch (error) {
      throw new ApiError(500, `Error fetching note: ${error.message}`);
    }
  }

  /**
   * Lista notas de um contato específico
   * @param {number} contactId - ID do contato
   * @param {Object} options - Opções de busca
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object>} Lista de notas e metadados
   */
  static async listByContact(contactId, options = {}, companyId) {
    const {
      page = 1,
      limit = 10,
      type = null,
      sort_by = "created_at",
      sort_order = "DESC",
    } = options;

    const offset = (page - 1) * limit;
    const conditions = [
      "cn.contato_id = $1",
      "cn.company_id = $2",
      "cn.deleted_at IS NULL",
      "c.deleted_at IS NULL",
    ];
    const values = [contactId, companyId];
    let paramCount = 3;

    // Adicionar filtro por tipo
    if (type) {
      conditions.push(`cn.note_type = $${paramCount}`);
      values.push(type);
      paramCount++;
    }

    const whereClause = conditions.join(" AND ");

    // Validar sort_by para prevenir SQL injection
    const allowedSortFields = ["created_at", "updated_at", "note_type"];
    const sortField = allowedSortFields.includes(sort_by)
      ? sort_by
      : "created_at";
    const sortDirection = sort_order.toUpperCase() === "ASC" ? "ASC" : "DESC";

    // Query para contar total
    const countQuery = `
      SELECT COUNT(*) 
      FROM polox.contact_notes cn
      INNER JOIN polox.contacts c ON cn.contato_id = c.id
      WHERE ${whereClause}
    `;

    // Query para buscar dados
    const selectQuery = `
      SELECT 
        cn.id, cn.contato_id, cn.created_by_id, cn.note_content, cn.note_type,
        cn.created_at, cn.updated_at,
        u.full_name as created_by_name,
        u.email as created_by_email
      FROM polox.contact_notes cn
      INNER JOIN polox.contacts c ON cn.contato_id = c.id
      LEFT JOIN polox.users u ON cn.created_by_id = u.id
      WHERE ${whereClause}
      ORDER BY cn.${sortField} ${sortDirection}
      LIMIT $${paramCount} OFFSET $${paramCount + 1}
    `;

    try {
      const [countResult, dataResult] = await Promise.all([
        query(countQuery, values),
        query(selectQuery, [...values, limit, offset]),
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
          hasPrev: page > 1,
        },
      };
    } catch (error) {
      throw new ApiError(500, `Error listing notes: ${error.message}`);
    }
  }

  /**
   * Lista todas as notas da empresa
   * @param {Object} options - Opções de busca
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object>} Lista de notas e metadados
   */
  static async list(options = {}, companyId) {
    const {
      page = 1,
      limit = 10,
      type = null,
      contato_id = null,
      created_by_id = null,
      search = null,
      sort_by = "created_at",
      sort_order = "DESC",
    } = options;

    const offset = (page - 1) * limit;
    const conditions = [
      "c.company_id = $1",
      "cn.deleted_at IS NULL",
      "c.deleted_at IS NULL",
    ];
    const values = [companyId];
    let paramCount = 2;

    // Adicionar filtros
    if (type) {
      conditions.push(`cn.type = $${paramCount}`);
      values.push(type);
      paramCount++;
    }

    if (contato_id) {
      conditions.push(`cn.contato_id = $${paramCount}`);
      values.push(contato_id);
      paramCount++;
    }

    if (created_by_id) {
      conditions.push(`cn.created_by_id = $${paramCount}`);
      values.push(created_by_id);
      paramCount++;
    }

    if (search) {
      conditions.push(
        `(cn.content ILIKE $${paramCount} OR c.nome ILIKE $${paramCount})`
      );
      values.push(`%${search}%`);
      paramCount++;
    }

    const whereClause = conditions.join(" AND ");

    // Validar sort_by
    const allowedSortFields = ["created_at", "updated_at", "type"];
    const sortField = allowedSortFields.includes(sort_by)
      ? sort_by
      : "created_at";
    const sortDirection = sort_order.toUpperCase() === "ASC" ? "ASC" : "DESC";

    // Query para contar total
    const countQuery = `
      SELECT COUNT(*) 
      FROM polox.contact_notes cn
      INNER JOIN polox.contacts c ON cn.contato_id = c.id
      WHERE ${whereClause}
    `;

    // Query para buscar dados
    const selectQuery = `
      SELECT 
        cn.id, cn.contato_id, cn.created_by_id, cn.content, cn.type,
        cn.created_at, cn.updated_at,
        c.nome as contact_name,
        c.email as contact_email,
        c.tipo as contact_type,
        u.full_name as created_by_name,
        u.email as created_by_email
      FROM polox.contact_notes cn
      INNER JOIN polox.contacts c ON cn.contato_id = c.id
      LEFT JOIN polox.users u ON cn.created_by_id = u.id
      WHERE ${whereClause}
      ORDER BY cn.${sortField} ${sortDirection}
      LIMIT $${paramCount} OFFSET $${paramCount + 1}
    `;

    try {
      const [countResult, dataResult] = await Promise.all([
        query(countQuery, values),
        query(selectQuery, [...values, limit, offset]),
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
          hasPrev: page > 1,
        },
      };
    } catch (error) {
      throw new ApiError(500, `Error listing notes: ${error.message}`);
    }
  }

  /**
   * Atualiza dados da nota
   * @param {number} id - ID da nota
   * @param {Object} updateData - Dados para atualizar
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object|null>} Nota atualizada ou null
   */
  static async update(id, updateData, companyId) {
    const allowedFields = ["content", "type"];

    const updates = [];
    const values = [];
    let paramCount = 1;

    // Construir query dinamicamente
    for (const [key, value] of Object.entries(updateData)) {
      if (allowedFields.includes(key)) {
        if (key === "content" && (!value || value.trim().length === 0)) {
          throw new ValidationError("Content cannot be empty");
        }
        updates.push(`${key} = $${paramCount}`);
        values.push(value);
        paramCount++;
      }
    }

    if (updates.length === 0) {
      throw new ValidationError("No valid fields to update");
    }

    updates.push("updated_at = NOW()");
    values.push(id, companyId);

    const updateQuery = `
      UPDATE polox.contact_notes 
      SET ${updates.join(", ")}
      WHERE id = $${paramCount} 
        AND company_id = $${paramCount + 1} 
        AND deleted_at IS NULL
      RETURNING 
        id, contato_id, created_by_id, content, type, company_id,
        created_at, updated_at
    `;

    try {
      const result = await query(updateQuery, values);
      return result.rows[0] || null;
    } catch (error) {
      throw new ApiError(500, `Error updating note: ${error.message}`);
    }
  }

  /**
   * Soft delete da nota
   * @param {number} id - ID da nota
   * @param {number} companyId - ID da empresa
   * @returns {Promise<boolean>} True se deletado com sucesso
   */
  static async softDelete(id, companyId) {
    const updateQuery = `
      UPDATE polox.contact_notes
      SET 
        deleted_at = NOW(),
        updated_at = NOW()
      WHERE id = $1 
        AND company_id = $2 
        AND deleted_at IS NULL
    `;

    try {
      const result = await query(updateQuery, [id, companyId]);
      return result.rowCount > 0;
    } catch (error) {
      throw new ApiError(500, `Error deleting note: ${error.message}`);
    }
  }

  /**
   * Obtém estatísticas de notas de um contato
   * @param {number} contactId - ID do contato
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object>} Estatísticas das notas
   */
  static async getContactStats(contactId, companyId) {
    const statsQuery = `
      SELECT 
        COUNT(*) as total_notes,
        COUNT(CASE WHEN type = 'general' THEN 1 END) as general_notes,
        COUNT(CASE WHEN type = 'call' THEN 1 END) as call_notes,
        COUNT(CASE WHEN type = 'meeting' THEN 1 END) as meeting_notes,
        COUNT(CASE WHEN type = 'email' THEN 1 END) as email_notes,
        COUNT(CASE WHEN type = 'whatsapp' THEN 1 END) as whatsapp_notes,
        COUNT(CASE WHEN type = 'other' THEN 1 END) as other_notes,
        MAX(cn.created_at) as last_note_date,
        MIN(cn.created_at) as first_note_date
      FROM polox.contact_notes cn
      WHERE cn.contato_id = $1 
        AND cn.company_id = $2 
        AND cn.deleted_at IS NULL
    `;

    try {
      const result = await query(statsQuery, [contactId, companyId]);
      return result.rows[0];
    } catch (error) {
      throw new ApiError(500, `Error fetching stats: ${error.message}`);
    }
  }

  /**
   * Obtém estatísticas gerais de notas da empresa
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object>} Estatísticas das notas
   */
  static async getCompanyStats(companyId) {
    const statsQuery = `
      SELECT 
        COUNT(*) as total_notes,
        COUNT(DISTINCT cn.contato_id) as contacts_with_notes,
        COUNT(DISTINCT cn.created_by_id) as users_created_notes,
        COUNT(CASE WHEN type = 'general' THEN 1 END) as general_notes,
        COUNT(CASE WHEN type = 'call' THEN 1 END) as call_notes,
        COUNT(CASE WHEN type = 'meeting' THEN 1 END) as meeting_notes,
        COUNT(CASE WHEN type = 'email' THEN 1 END) as email_notes,
        COUNT(CASE WHEN type = 'whatsapp' THEN 1 END) as whatsapp_notes,
        COUNT(CASE WHEN type = 'other' THEN 1 END) as other_notes,
        COUNT(CASE WHEN cn.created_at >= CURRENT_DATE - INTERVAL '7 days' THEN 1 END) as notes_last_7_days,
        COUNT(CASE WHEN cn.created_at >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as notes_last_30_days
      FROM polox.contact_notes cn
      INNER JOIN polox.contacts c ON cn.contato_id = c.id
      WHERE c.company_id = $1 
        AND cn.deleted_at IS NULL
        AND c.deleted_at IS NULL
    `;

    try {
      const result = await query(statsQuery, [companyId]);
      return result.rows[0];
    } catch (error) {
      throw new ApiError(500, `Error fetching company stats: ${error.message}`);
    }
  }

  /**
   * Busca as últimas notas de um contato
   * @param {number} contactId - ID do contato
   * @param {number} limit - Quantidade de notas
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Array>} Lista de notas recentes
   */
  static async getRecentByContact(contactId, limit = 5, companyId) {
    const selectQuery = `
      SELECT 
        cn.id, cn.contato_id, cn.created_by_id, cn.content, cn.type,
        cn.created_at, cn.updated_at,
        u.full_name as created_by_name
      FROM polox.contact_notes cn
      INNER JOIN polox.contacts c ON cn.contato_id = c.id
      LEFT JOIN polox.users u ON cn.created_by_id = u.id
      WHERE cn.contato_id = $1 
        AND c.company_id = $2 
        AND cn.deleted_at IS NULL
        AND c.deleted_at IS NULL
      ORDER BY cn.created_at DESC
      LIMIT $3
    `;

    try {
      const result = await query(selectQuery, [contactId, companyId, limit]);
      return result.rows;
    } catch (error) {
      throw new ApiError(500, `Error fetching recent notes: ${error.message}`);
    }
  }
}

module.exports = ContactNote;
