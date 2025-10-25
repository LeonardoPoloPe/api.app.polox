/**
 * ==========================================
 * 👥 CLIENT CONTROLLER - CRM CORE
 * ==========================================
 *
 * Gestão completa de clientes para sistema CRM
 * - CRUD completo de clientes
 * - Histórico de vendas e interações
 * - Sistema de tags e anotações
 * - Estatísticas e relatórios
 * - Integração com gamificação
 */

const { query } = require("../config/database");
const { logger, auditLogger } = require("../utils/logger");
const { ApiError, asyncHandler } = require("../utils/errors");
const { successResponse, paginatedResponse } = require("../utils/response");
const { tc } = require("../config/i18n");
const Joi = require("joi");
const ClientService = require("../services/ClientService");
const GamificationHistory = require("../models/GamificationHistory");

class ClientController {
  /**
   * 📝 VALIDAÇÕES JOI
   */
  static createClientSchema = Joi.object({
    name: Joi.string().min(2).max(255).required(),
    email: Joi.string().email().allow(null),
    phone: Joi.string().max(20).allow(null),
    status: Joi.string().max(50).default("active"),
    customFields: Joi.alternatives()
      .try(
        Joi.array().items(
          Joi.object({
            id: Joi.number().required(),
            value: Joi.alternatives().try(
              Joi.string(),
              Joi.number(),
              Joi.boolean(),
              Joi.date(),
              Joi.allow(null)
            ),
          })
        ),
        Joi.object() // Permitir objeto {name: value}
      )
      .default([]),
    custom_fields: Joi.alternatives()
      .try(
        Joi.array().items(
          Joi.object({
            id: Joi.number().required(),
            value: Joi.alternatives().try(
              Joi.string(),
              Joi.number(),
              Joi.boolean(),
              Joi.date(),
              Joi.allow(null)
            ),
          })
        ),
        Joi.object() // Permitir objeto {name: value}
      )
      .default([]),
  }).unknown(true);

  static updateClientSchema = Joi.object({
    name: Joi.string().min(2).max(255),
    email: Joi.string().email().allow(null),
    phone: Joi.string().max(20).allow(null),
    status: Joi.string().max(50),
    customFields: Joi.alternatives().try(
      Joi.array().items(
        Joi.object({
          id: Joi.number().required(),
          value: Joi.alternatives().try(
            Joi.string(),
            Joi.number(),
            Joi.boolean(),
            Joi.date(),
            Joi.allow(null)
          ),
        })
      ),
      Joi.object() // Permitir objeto {name: value}
    ),
    custom_fields: Joi.alternatives().try(
      Joi.array().items(
        Joi.object({
          id: Joi.number().required(),
          value: Joi.alternatives().try(
            Joi.string(),
            Joi.number(),
            Joi.boolean(),
            Joi.date(),
            Joi.allow(null)
          ),
        })
      ),
      Joi.object() // Permitir objeto {name: value}
    ),
  }).unknown(true);

  static addNoteSchema = Joi.object({
    note: Joi.string().min(1).max(1000).required(),
    type: Joi.string()
      .valid("general", "call", "meeting", "email", "other")
      .default("general"),
  });

  /**
   * 🌐 Valida dados com mensagens traduzidas
   * @param {Object} req - Request object
   * @param {Object} schema - Joi schema
   * @param {Object} data - Data to validate
   * @returns {Object} Validated data
   */
  static validateWithTranslation(req, schema, data) {
    const { error, value } = schema.validate(data);
    if (error) {
      const field = error.details[0].path[0];
      const type = error.details[0].type;

      let messageKey = "validation.invalid";
      if (type === "any.required") messageKey = "validation.name_required";
      else if (type === "string.min") messageKey = "validation.name_min_length";
      else if (type === "string.email") messageKey = "validation.email_invalid";

      throw new ApiError(400, tc(req, "clientController", messageKey));
    }
    return value;
  }

  /**
   * ⚙️ Normaliza payloads que podem vir com customFields/custom_fields em formatos inesperados
   * - Se vier como string vazia: []
   * - Se vier como string JSON válida de array: parseia
   * - Se vier como objeto/qualquer outro tipo: []
   */
  static normalizePayload(raw) {
    const body = { ...(raw || {}) };
    for (const key of ["customFields", "custom_fields"]) {
      if (body[key] !== undefined && !Array.isArray(body[key])) {
        if (typeof body[key] === "string") {
          const s = body[key].trim();
          if (!s) {
            body[key] = [];
          } else {
            try {
              const parsed = JSON.parse(s);
              body[key] = Array.isArray(parsed) ? parsed : [];
            } catch (e) {
              body[key] = [];
            }
          }
        } else {
          body[key] = [];
        }
      }
    }
    return body;
  }

  /**
   * �📋 LISTAR CLIENTES
   * GET /api/clients
   */
  static index = asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = (page - 1) * limit;

    let whereClause = "WHERE c.company_id = $1 AND c.deleted_at IS NULL";
    let queryParams = [req.user.companyId];
    let paramCount = 1;

    // 🔍 FILTROS AVANÇADOS
    if (req.query.status) {
      const statuses = req.query.status.split(",");
      whereClause += ` AND c.status = ANY($${++paramCount})`;
      queryParams.push(statuses);
    }

    if (req.query.category) {
      whereClause += ` AND c.category = $${++paramCount}`;
      queryParams.push(req.query.category);
    }

    if (req.query.tag) {
      whereClause += ` AND $${++paramCount} = ANY(c.tags)`;
      queryParams.push(req.query.tag);
    }

    if (req.query.search) {
      whereClause += ` AND (
        c.client_name ILIKE $${++paramCount} OR 
        c.email ILIKE $${++paramCount} OR 
        c.company_name ILIKE $${++paramCount}
      )`;
      const searchTerm = `%${req.query.search}%`;
      queryParams.push(searchTerm, searchTerm, searchTerm);
      paramCount += 2;
    }

    if (req.query.created_from) {
      whereClause += ` AND c.created_at >= $${++paramCount}`;
      queryParams.push(req.query.created_from);
    }

    if (req.query.created_to) {
      whereClause += ` AND c.created_at <= $${++paramCount}`;
      queryParams.push(req.query.created_to);
    }

    // 📊 ORDENAÇÃO
    const validSortFields = [
      "client_name",
      "total_spent",
      "last_purchase_at",
      "created_at",
    ];
    const sortField = validSortFields.includes(req.query.sort)
      ? req.query.sort
      : "client_name";
    const sortOrder = req.query.order === "desc" ? "DESC" : "ASC";

    // 🔍 QUERY PRINCIPAL com estatísticas de vendas
    const clientsQuery = `
      SELECT 
        c.*,
        COUNT(DISTINCT s.id) as total_sales,
        COALESCE(SUM(s.total_amount), 0) as total_spent,
        MAX(s.sale_date) as last_purchase_date,
        COALESCE(AVG(s.total_amount), 0) as average_ticket,
        COUNT(DISTINCT cn.id) as notes_count
      FROM polox.clients c
      LEFT JOIN polox.sales s ON c.id = s.client_id AND s.deleted_at IS NULL AND s.status != 'cancelled'
      LEFT JOIN polox.client_notes cn ON c.id = cn.client_id
      ${whereClause}
      GROUP BY c.id
      ORDER BY c.${sortField} ${sortOrder}
      LIMIT $${++paramCount} OFFSET $${++paramCount}
    `;

    queryParams.push(limit, offset);

    // 📊 QUERY DE CONTAGEM
    const countQuery = `
      SELECT COUNT(*) as total FROM polox.clients c ${whereClause}
    `;

    // 📈 QUERY DE ESTATÍSTICAS
    const statsQuery = `
      SELECT 
        COUNT(*) as total_clients,
        COUNT(CASE WHEN c.status = 'active' THEN 1 END) as active_clients,
        COUNT(CASE WHEN c.status = 'vip' THEN 1 END) as vip_clients,
        COUNT(CASE WHEN c.status = 'inactive' THEN 1 END) as inactive_clients,
        COALESCE(AVG(
          CASE WHEN s.total_amount > 0 
          THEN s.total_amount 
          END
        ), 0) as average_lifetime_value,
        COALESCE(SUM(s.total_amount), 0) as total_revenue
      FROM polox.clients c
      LEFT JOIN polox.sales s ON c.id = s.client_id AND s.deleted_at IS NULL AND s.status != 'cancelled'
      WHERE c.company_id = $1 AND c.deleted_at IS NULL
    `;

    const [clientsResult, countResult, statsResult] = await Promise.all([
      query(clientsQuery, queryParams),
      query(countQuery, queryParams.slice(0, -2)),
      query(statsQuery, [req.user.companyId]),
    ]);

    return paginatedResponse(res, clientsResult.rows, {
      page,
      limit,
      total: parseInt(countResult.rows[0].total),
      stats: statsResult.rows[0],
    });
  });

  /**
   * ➕ CRIAR CLIENTE
   * POST /api/clients
   */
  static create = asyncHandler(async (req, res) => {
    const normalized = ClientController.normalizePayload(req.body);
    const value = ClientController.validateWithTranslation(
      req,
      ClientController.createClientSchema,
      normalized
    );

    const created = await ClientService.createClient(
      req.user.companyId,
      req.user.id,
      value
    );

    // 🎮 GAMIFICAÇÃO: Conceder XP/Coins por criar cliente
    try {
      await query(
        `
        UPDATE polox.user_gamification_profiles 
        SET total_xp = total_xp + 20, 
            total_coins = total_coins + 10,
            available_coins = available_coins + 10
        WHERE user_id = $1 AND company_id = $2
      `,
        [req.user.id, req.user.companyId]
      );

      // 📈 Registrar no histórico usando o modelo
      await GamificationHistory.logEvent({
        user_id: req.user.id,
        event_type: "client_created",
        points_awarded: 20,
        description: tc(
          req,
          "clientController",
          "gamification.client_created",
          { clientName: value.name }
        ),
        metadata: {
          client_id: created.id,
          client_name: value.name,
          xp_awarded: 20,
          coins_awarded: 10,
        },
        related_entity_type: "client",
        related_entity_id: created.id,
        triggered_by_user_id: req.user.id,
      });

      await GamificationHistory.logEvent({
        user_id: req.user.id,
        event_type: "coins_awarded",
        points_awarded: 10,
        description: tc(req, "clientController", "gamification.coins_awarded", {
          clientName: value.name,
        }),
        metadata: {
          client_id: created.id,
          client_name: value.name,
          coins_awarded: 10,
        },
        related_entity_type: "client",
        related_entity_id: created.id,
        triggered_by_user_id: req.user.id,
      });
    } catch (gamificationError) {
      // Gamificação é opcional - não deve impedir a criação do cliente
      console.warn(
        tc(req, "clientController", "gamification.gamification_error"),
        gamificationError.message
      );
    }

    // 📋 Log de auditoria
    auditLogger(tc(req, "clientController", "audit.client_created"), {
      userId: req.user.id,
      companyId: req.user.companyId,
      entityType: "client",
      entityId: created.id,
      action: "create",
      changes: value,
      ip: req.ip,
    });

    return successResponse(
      res,
      created,
      tc(req, "clientController", "create.success"),
      201
    );
  });

  /**
   * 👁️ DETALHES DO CLIENTE
   * GET /api/clients/:id
   */
  static show = asyncHandler(async (req, res) => {
    const clientId = req.params.id;

    const client = await ClientService.getClientById(
      clientId,
      req.user.companyId
    );

    // Estatísticas de vendas e notas recentes
    const statsQuery = `
      SELECT 
        COUNT(DISTINCT s.id) as total_sales,
        COALESCE(SUM(s.total_amount), 0) as total_spent,
        MAX(s.sale_date) as last_purchase_date,
        MIN(s.sale_date) as first_purchase_date,
        COALESCE(AVG(s.total_amount), 0) as average_ticket
      FROM polox.sales s
      WHERE s.client_id = $1 AND s.deleted_at IS NULL AND s.status != 'cancelled'
    `;
    const statsRes = await query(statsQuery, [clientId]);

    const notesRes = await query(
      `
      SELECT cn.*, u.full_name as created_by_name
      FROM polox.client_notes cn
      LEFT JOIN polox.users u ON cn.created_by_id = u.id
      WHERE cn.client_id = $1
      ORDER BY cn.created_at DESC
      LIMIT 10
    `,
      [clientId]
    );

    return successResponse(res, {
      ...client,
      total_sales: Number(statsRes.rows?.[0]?.total_sales || 0),
      total_spent: Number(statsRes.rows?.[0]?.total_spent || 0),
      last_purchase_date: statsRes.rows?.[0]?.last_purchase_date || null,
      first_purchase_date: statsRes.rows?.[0]?.first_purchase_date || null,
      average_ticket: Number(statsRes.rows?.[0]?.average_ticket || 0),
      recent_notes: notesRes.rows || [],
    });
  });

  /**
   * ✏️ ATUALIZAR CLIENTE
   * PUT /api/clients/:id
   */
  static update = asyncHandler(async (req, res) => {
    const clientId = req.params.id;
    const normalized = ClientController.normalizePayload(req.body);
    const value = ClientController.validateWithTranslation(
      req,
      ClientController.updateClientSchema,
      normalized
    );

    const updated = await ClientService.updateClient(
      clientId,
      req.user.companyId,
      value
    );

    // 📋 Log de auditoria
    auditLogger(tc(req, "clientController", "audit.client_updated"), {
      userId: req.user.id,
      companyId: req.user.companyId,
      entityType: "client",
      entityId: clientId,
      action: "update",
      changes: value,
      ip: req.ip,
    });

    return successResponse(
      res,
      updated,
      tc(req, "clientController", "update.success")
    );
  });

  /**
   * 🗑️ DELETAR CLIENTE (SOFT DELETE)
   * DELETE /api/clients/:id
   */
  static destroy = asyncHandler(async (req, res) => {
    const clientId = req.params.id;

    // Verificar se tem vendas ativas
    const salesCheck = await query(
      "SELECT COUNT(*) as count FROM polox.sales WHERE client_id = $1 AND deleted_at IS NULL AND status != $2",
      [clientId, "cancelled"]
    );

    if (parseInt(salesCheck.rows[0].count) > 0) {
      throw new ApiError(
        400,
        tc(req, "clientController", "delete.has_active_sales")
      );
    }

    await ClientService.deleteClient(clientId, req.user.companyId);

    // 📋 Log de auditoria
    auditLogger(tc(req, "clientController", "audit.client_deleted"), {
      userId: req.user.id,
      companyId: req.user.companyId,
      entityType: "client",
      entityId: clientId,
      action: "delete",
      changes: {},
      ip: req.ip,
    });

    return successResponse(
      res,
      { id: clientId },
      tc(req, "clientController", "delete.success")
    );
  });

  /**
   * 📊 HISTÓRICO DE VENDAS DO CLIENTE
   * GET /api/clients/:id/history
   */
  static getSalesHistory = asyncHandler(async (req, res) => {
    const clientId = req.params.id;

    // Verificar se cliente existe e pertence à empresa
    const clientCheck = await query(
      "SELECT id, client_name as name FROM polox.clients WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL",
      [clientId, req.user.companyId]
    );

    if (clientCheck.rows.length === 0) {
      throw new ApiError(404, tc(req, "clientController", "show.not_found"));
    }

    // 📊 Buscar histórico de vendas completo
    const salesQuery = `
      SELECT 
        s.*,
        u.full_name as seller_name,
        u.email as seller_email,
        COUNT(si.id) as items_count,
        json_agg(
          json_build_object(
            'id', si.id,
            'product_name', si.product_name,
            'quantity', si.quantity,
            'unit_price', si.unit_price,
            'total_price', si.total_price
          ) ORDER BY si.id
        ) FILTER (WHERE si.id IS NOT NULL) as items
      FROM polox.sales s
      LEFT JOIN polox.users u ON s.user_id = u.id
      LEFT JOIN polox.sale_items si ON s.id = si.sale_id
      WHERE s.client_id = $1 AND s.company_id = $2 AND s.deleted_at IS NULL
      GROUP BY s.id, u.full_name, u.email
      ORDER BY s.sale_date DESC
    `;

    const salesResult = await query(salesQuery, [clientId, req.user.companyId]);

    // 📈 Estatísticas do cliente
    const statsQuery = `
      SELECT 
        COUNT(*) as total_purchases,
        COALESCE(SUM(total_amount), 0) as total_spent,
        COALESCE(AVG(total_amount), 0) as average_ticket,
        MAX(sale_date) as last_purchase,
        MIN(sale_date) as first_purchase,
        COUNT(CASE WHEN payment_status = 'paid' THEN 1 END) as paid_purchases,
        COUNT(CASE WHEN payment_status = 'pending' THEN 1 END) as pending_payments
      FROM polox.sales
      WHERE client_id = $1 AND company_id = $2 AND deleted_at IS NULL AND status != 'cancelled'
    `;

    const statsResult = await query(statsQuery, [clientId, req.user.companyId]);

    return successResponse(res, {
      client: clientCheck.rows[0],
      sales: salesResult.rows,
      stats: statsResult.rows[0],
    });
  });

  /**
   * 📝 ADICIONAR ANOTAÇÃO AO CLIENTE
   * POST /api/clients/:id/notes
   */
  static addNote = asyncHandler(async (req, res) => {
    const clientId = req.params.id;
    const { error, value } = ClientController.addNoteSchema.validate(req.body);
    if (error) throw new ApiError(400, error.details[0].message);

    const { note, type } = value;

    // Verificar se cliente existe
    const clientCheck = await query(
      "SELECT id, client_name as name FROM polox.clients WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL",
      [clientId, req.user.companyId]
    );

    if (clientCheck.rows.length === 0) {
      throw new ApiError(404, tc(req, "clientController", "show.not_found"));
    }

    // 📝 Criar anotação
    const createNoteQuery = `
      INSERT INTO polox.client_notes (
        client_id, created_by_id, note_content, note_type
      ) VALUES ($1, $2, $3, $4)
      RETURNING *
    `;

    const noteResult = await query(createNoteQuery, [
      clientId,
      req.user.id,
      note,
      type,
    ]);

    // 🎮 GAMIFICAÇÃO: Pequeno XP por anotação (incentiva documentação)
    await query(
      `
      UPDATE polox.user_gamification_profiles 
      SET total_xp = total_xp + 2, 
          total_coins = total_coins + 1,
          available_coins = available_coins + 1
      WHERE user_id = $1 AND company_id = $2
    `,
      [req.user.id, req.user.companyId]
    );

    // 📋 Log de auditoria
    auditLogger(tc(req, "clientController", "audit.client_note_added"), {
      userId: req.user.id,
      companyId: req.user.companyId,
      entityType: "client_note",
      entityId: noteResult.rows[0].id,
      relatedEntityType: "client",
      relatedEntityId: clientId,
      action: "create",
      changes: { note, type },
      ip: req.ip,
    });

    return successResponse(
      res,
      noteResult.rows[0],
      tc(req, "clientController", "notes.add_success"),
      201
    );
  });

  /**
   * 📊 ESTATÍSTICAS DE CLIENTES
   * GET /api/clients/stats
   */
  static getStats = asyncHandler(async (req, res) => {
    // 📈 Estatísticas gerais
    const generalStatsQuery = `
      SELECT 
        COUNT(*) as total_clients,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_clients,
        COUNT(CASE WHEN status = 'vip' THEN 1 END) as vip_clients,
        COUNT(CASE WHEN status = 'inactive' THEN 1 END) as inactive_clients,
        COUNT(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as new_clients_month
      FROM polox.clients
      WHERE company_id = $1 AND deleted_at IS NULL
    `;

    // 💰 Estatísticas financeiras
    const financialStatsQuery = `
      SELECT 
        COUNT(DISTINCT c.id) as clients_with_purchases,
        COALESCE(SUM(s.total_amount), 0) as total_revenue,
        COALESCE(AVG(s.total_amount), 0) as average_ticket,
        MAX(s.total_amount) as highest_sale,
        COUNT(s.id) as total_sales
      FROM polox.clients c
      LEFT JOIN polox.sales s ON c.id = s.client_id AND s.deleted_at IS NULL AND s.status != 'cancelled'
      WHERE c.company_id = $1 AND c.deleted_at IS NULL
    `;

    // 🏆 Top clientes por valor
    const topClientsQuery = `
      SELECT 
        c.id,
        c.client_name as name,
        c.email,
        c.status,
        COALESCE(SUM(s.total_amount), 0) as total_spent,
        COUNT(s.id) as total_purchases
      FROM polox.clients c
      LEFT JOIN polox.sales s ON c.id = s.client_id AND s.deleted_at IS NULL AND s.status != 'cancelled'
      WHERE c.company_id = $1 AND c.deleted_at IS NULL
      GROUP BY c.id, c.client_name, c.email, c.status
      HAVING SUM(s.total_amount) > 0
      ORDER BY total_spent DESC
      LIMIT 10
    `;

    const [generalResult, financialResult, topClientsResult] =
      await Promise.all([
        query(generalStatsQuery, [req.user.companyId]),
        query(financialStatsQuery, [req.user.companyId]),
        query(topClientsQuery, [req.user.companyId]),
      ]);

    return successResponse(res, {
      general: generalResult.rows[0],
      financial: financialResult.rows[0],
      top_clients: topClientsResult.rows,
    });
  });

  /**
   * 🏷️ GERENCIAR TAGS DO CLIENTE
   * PUT /api/clients/:id/tags
   */
  static manageTags = asyncHandler(async (req, res) => {
    const clientId = req.params.id;
    const { tags } = req.body;

    if (!Array.isArray(tags)) {
      throw new ApiError(
        400,
        tc(req, "clientController", "validation.tags_must_be_array")
      );
    }

    // Verificar se cliente existe
    const clientCheck = await query(
      "SELECT id, client_name as name FROM polox.clients WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL",
      [clientId, req.user.companyId]
    );

    if (clientCheck.rows.length === 0) {
      throw new ApiError(404, tc(req, "clientController", "show.not_found"));
    }

    // 🏷️ Get current tags
    const currentTagsResult = await query(
      `
      SELECT t.name 
      FROM polox.client_tags ct
      INNER JOIN polox.tags t ON ct.tag_id = t.id
      WHERE ct.client_id = $1
    `,
      [clientId]
    );

    const currentTags = currentTagsResult.rows.map((row) => row.name);

    // 🗑️ Remove all current tag associations
    await query(
      `
      DELETE FROM polox.client_tags WHERE client_id = $1
    `,
      [clientId]
    );

    // ➕ Add new tag associations
    for (const tagName of tags) {
      if (tagName && typeof tagName === "string") {
        // Create or get tag
        const tagResult = await query(
          `
          INSERT INTO polox.tags (company_id, name, slug, color, created_at, updated_at)
          VALUES ($1, $2, $3, $4, NOW(), NOW())
          ON CONFLICT (company_id, slug) 
          DO UPDATE SET updated_at = NOW()
          RETURNING id
        `,
          [
            req.user.companyId,
            tagName.trim(),
            tagName.toLowerCase().trim().replace(/\s+/g, "-"),
            "#808080", // default gray color
          ]
        );

        const tagId = tagResult.rows[0].id;

        // Associate tag with client
        await query(
          `
          INSERT INTO polox.client_tags (client_id, tag_id, created_at)
          VALUES ($1, $2, NOW())
          ON CONFLICT (client_id, tag_id) DO NOTHING
        `,
          [clientId, tagId]
        );
      }
    }

    // 📋 Log de auditoria
    auditLogger(tc(req, "clientController", "audit.client_tags_updated"), {
      userId: req.user.id,
      companyId: req.user.companyId,
      entityType: "client",
      entityId: clientId,
      action: "update_tags",
      changes: {
        from: currentTags,
        to: tags,
      },
      ip: req.ip,
    });

    return successResponse(
      res,
      { id: clientId, tags },
      tc(req, "clientController", "tags.update_success")
    );
  });
}

module.exports = ClientController;
