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

const { query, beginTransaction, commitTransaction, rollbackTransaction } = require('../models/database');
const { logger, auditLogger } = require('../utils/logger');
const { ApiError, asyncHandler } = require('../utils/errors');
const { successResponse, paginatedResponse } = require('../utils/formatters');
const Joi = require('joi');
const { v4: uuidv4 } = require('uuid');

class ClientController {

  /**
   * 📝 VALIDAÇÕES JOI
   */
  static createClientSchema = Joi.object({
    name: Joi.string().min(2).max(255).required()
      .messages({
        'string.min': 'Nome deve ter pelo menos 2 caracteres',
        'any.required': 'Nome é obrigatório'
      }),
    email: Joi.string().email().allow(null)
      .messages({
        'string.email': 'Email deve ter formato válido'
      }),
    phone: Joi.string().max(20).allow(null),
    company: Joi.string().max(255).allow(null),
    position: Joi.string().max(100).allow(null),
    source: Joi.string().max(100).allow(null),
    status: Joi.string().valid('active', 'inactive', 'vip', 'blacklist').default('active'),
    category: Joi.string().max(100).allow(null),
    description: Joi.string().max(1000).allow(null),
    tags: Joi.array().items(Joi.string()).default([]),
    custom_fields: Joi.object().default({})
  });

  static updateClientSchema = Joi.object({
    name: Joi.string().min(2).max(255),
    email: Joi.string().email().allow(null),
    phone: Joi.string().max(20).allow(null),
    company: Joi.string().max(255).allow(null),
    position: Joi.string().max(100).allow(null),
    source: Joi.string().max(100).allow(null),
    status: Joi.string().valid('active', 'inactive', 'vip', 'blacklist'),
    category: Joi.string().max(100).allow(null),
    description: Joi.string().max(1000).allow(null),
    tags: Joi.array().items(Joi.string()),
    custom_fields: Joi.object()
  });

  static addNoteSchema = Joi.object({
    note: Joi.string().min(1).max(1000).required(),
    type: Joi.string().valid('general', 'call', 'meeting', 'email', 'other').default('general')
  });

  /**
   * 📋 LISTAR CLIENTES
   * GET /api/clients
   */
  static index = asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = (page - 1) * limit;
    
    let whereClause = 'WHERE c.company_id = $1 AND c.deleted_at IS NULL';
    let queryParams = [req.user.company.id];
    let paramCount = 1;

    // 🔍 FILTROS AVANÇADOS
    if (req.query.status) {
      const statuses = req.query.status.split(',');
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
        c.name ILIKE $${++paramCount} OR 
        c.email ILIKE $${++paramCount} OR 
        c.company ILIKE $${++paramCount}
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
    const validSortFields = ['name', 'total_spent', 'last_purchase_at', 'created_at'];
    const sortField = validSortFields.includes(req.query.sort) ? req.query.sort : 'name';
    const sortOrder = req.query.order === 'desc' ? 'DESC' : 'ASC';

    // 🔍 QUERY PRINCIPAL com estatísticas de vendas
    const clientsQuery = `
      SELECT 
        c.*,
        COUNT(DISTINCT s.id) as total_sales,
        COALESCE(SUM(s.total_amount), 0) as total_spent,
        MAX(s.sale_date) as last_purchase_date,
        COALESCE(AVG(s.total_amount), 0) as average_ticket,
        COUNT(DISTINCT cn.id) as notes_count
      FROM clients c
      LEFT JOIN sales s ON c.id = s.client_id AND s.deleted_at IS NULL AND s.status != 'cancelled'
      LEFT JOIN client_notes cn ON c.id = cn.client_id
      ${whereClause}
      GROUP BY c.id
      ORDER BY c.${sortField} ${sortOrder}
      LIMIT $${++paramCount} OFFSET $${++paramCount}
    `;
    
    queryParams.push(limit, offset);

    // 📊 QUERY DE CONTAGEM
    const countQuery = `
      SELECT COUNT(*) as total FROM clients c ${whereClause}
    `;

    // 📈 QUERY DE ESTATÍSTICAS
    const statsQuery = `
      SELECT 
        COUNT(*) as total_clients,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_clients,
        COUNT(CASE WHEN status = 'vip' THEN 1 END) as vip_clients,
        COUNT(CASE WHEN status = 'inactive' THEN 1 END) as inactive_clients,
        COALESCE(AVG(
          CASE WHEN s.total_amount > 0 
          THEN s.total_amount 
          END
        ), 0) as average_lifetime_value,
        COALESCE(SUM(s.total_amount), 0) as total_revenue
      FROM clients c
      LEFT JOIN sales s ON c.id = s.client_id AND s.deleted_at IS NULL AND s.status != 'cancelled'
      WHERE c.company_id = $1 AND c.deleted_at IS NULL
    `;

    const [clientsResult, countResult, statsResult] = await Promise.all([
      query(clientsQuery, queryParams),
      query(countQuery, queryParams.slice(0, -2)),
      query(statsQuery, [req.user.company.id])
    ]);

    return paginatedResponse(res, clientsResult.rows, {
      page,
      limit,
      total: parseInt(countResult.rows[0].total),
      stats: statsResult.rows[0]
    });
  });

  /**
   * ➕ CRIAR CLIENTE
   * POST /api/clients
   */
  static create = asyncHandler(async (req, res) => {
    const { error, value } = ClientController.createClientSchema.validate(req.body);
    if (error) throw new ApiError(400, error.details[0].message);

    const clientData = value;

    // Verificar se email já existe (se fornecido)
    if (clientData.email) {
      const emailCheck = await query(
        'SELECT id FROM clients WHERE email = $1 AND company_id = $2 AND deleted_at IS NULL',
        [clientData.email, req.user.company.id]
      );

      if (emailCheck.rows.length > 0) {
        throw new ApiError(400, 'Client with this email already exists');
      }
    }

    // 🆕 CRIAR CLIENTE
    const createClientQuery = `
      INSERT INTO clients (
        id, company_id, name, email, phone, company, position,
        source, status, category, description, tags, custom_fields
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `;

    const newClientResult = await query(createClientQuery, [
      uuidv4(),
      req.user.company.id,
      clientData.name,
      clientData.email,
      clientData.phone,
      clientData.company,
      clientData.position,
      clientData.source,
      clientData.status,
      clientData.category,
      clientData.description,
      JSON.stringify(clientData.tags),
      JSON.stringify(clientData.custom_fields)
    ]);

    const newClient = newClientResult.rows[0];

    // 🎮 GAMIFICAÇÃO: Conceder XP/Coins por criar cliente
    await query(`
      UPDATE user_gamification_profiles 
      SET total_xp = total_xp + 20, current_coins = current_coins + 10
      WHERE user_id = $1 AND company_id = $2
    `, [req.user.id, req.user.company.id]);

    // 📈 Registrar no histórico
    await query(`
      INSERT INTO gamification_history (user_id, company_id, type, amount, reason, action_type)
      VALUES 
        ($1, $2, 'xp', 20, $3, 'client_created'),
        ($1, $2, 'coins', 10, $3, 'client_created')
    `, [req.user.id, req.user.company.id, `Client created: ${clientData.name}`]);

    // 📋 Log de auditoria
    auditLogger('Client created', {
      userId: req.user.id,
      companyId: req.user.company.id,
      entityType: 'client',
      entityId: newClient.id,
      action: 'create',
      changes: clientData,
      ip: req.ip
    });

    return successResponse(res, newClient, 'Client created successfully', 201);
  });

  /**
   * 👁️ DETALHES DO CLIENTE
   * GET /api/clients/:id
   */
  static show = asyncHandler(async (req, res) => {
    const clientId = req.params.id;

    // 🔍 Buscar cliente com estatísticas
    const clientQuery = `
      SELECT 
        c.*,
        COUNT(DISTINCT s.id) as total_sales,
        COALESCE(SUM(s.total_amount), 0) as total_spent,
        MAX(s.sale_date) as last_purchase_date,
        MIN(s.sale_date) as first_purchase_date,
        COALESCE(AVG(s.total_amount), 0) as average_ticket
      FROM clients c
      LEFT JOIN sales s ON c.id = s.client_id AND s.deleted_at IS NULL AND s.status != 'cancelled'
      WHERE c.id = $1 AND c.company_id = $2 AND c.deleted_at IS NULL
      GROUP BY c.id
    `;
    
    const clientResult = await query(clientQuery, [clientId, req.user.company.id]);
    
    if (clientResult.rows.length === 0) {
      throw new ApiError(404, 'Client not found');
    }

    // 📝 Buscar notas recentes
    const notesQuery = `
      SELECT 
        cn.*,
        u.name as created_by_name
      FROM client_notes cn
      LEFT JOIN users u ON cn.created_by_id = u.id
      WHERE cn.client_id = $1
      ORDER BY cn.created_at DESC
      LIMIT 10
    `;

    const notesResult = await query(notesQuery, [clientId]);

    const client = clientResult.rows[0];
    client.recent_notes = notesResult.rows;

    return successResponse(res, client);
  });

  /**
   * ✏️ ATUALIZAR CLIENTE
   * PUT /api/clients/:id
   */
  static update = asyncHandler(async (req, res) => {
    const clientId = req.params.id;
    const { error, value } = ClientController.updateClientSchema.validate(req.body);
    if (error) throw new ApiError(400, error.details[0].message);

    const updateData = value;

    // Verificar se cliente existe
    const clientCheck = await query(
      'SELECT * FROM clients WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL',
      [clientId, req.user.company.id]
    );

    if (clientCheck.rows.length === 0) {
      throw new ApiError(404, 'Client not found');
    }

    const currentClient = clientCheck.rows[0];

    // Verificar email único (se mudou)
    if (updateData.email && updateData.email !== currentClient.email) {
      const emailCheck = await query(
        'SELECT id FROM clients WHERE email = $1 AND company_id = $2 AND id != $3 AND deleted_at IS NULL',
        [updateData.email, req.user.company.id, clientId]
      );

      if (emailCheck.rows.length > 0) {
        throw new ApiError(400, 'Client with this email already exists');
      }
    }

    // 🔄 CONSTRUIR QUERY DE UPDATE
    const updateFields = [];
    const updateValues = [];
    let paramCount = 0;

    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== undefined) {
        paramCount++;
        updateFields.push(`${key} = $${paramCount}`);
        
        if (key === 'tags' || key === 'custom_fields') {
          updateValues.push(JSON.stringify(updateData[key]));
        } else {
          updateValues.push(updateData[key]);
        }
      }
    });

    updateFields.push(`updated_at = NOW()`);
    updateValues.push(clientId, req.user.company.id);

    const updateQuery = `
      UPDATE clients 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramCount + 1} AND company_id = $${paramCount + 2}
      RETURNING *
    `;

    const updatedClientResult = await query(updateQuery, updateValues);

    // 📋 Log de auditoria
    auditLogger('Client updated', {
      userId: req.user.id,
      companyId: req.user.company.id,
      entityType: 'client',
      entityId: clientId,
      action: 'update',
      changes: updateData,
      ip: req.ip
    });

    return successResponse(res, updatedClientResult.rows[0], 'Client updated successfully');
  });

  /**
   * 🗑️ DELETAR CLIENTE (SOFT DELETE)
   * DELETE /api/clients/:id
   */
  static destroy = asyncHandler(async (req, res) => {
    const clientId = req.params.id;

    // Verificar se cliente existe
    const clientCheck = await query(
      'SELECT id, name FROM clients WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL',
      [clientId, req.user.company.id]
    );

    if (clientCheck.rows.length === 0) {
      throw new ApiError(404, 'Client not found');
    }

    const client = clientCheck.rows[0];

    // Verificar se tem vendas ativas
    const salesCheck = await query(
      'SELECT COUNT(*) as count FROM sales WHERE client_id = $1 AND deleted_at IS NULL AND status != $2',
      [clientId, 'cancelled']
    );

    if (parseInt(salesCheck.rows[0].count) > 0) {
      throw new ApiError(400, 'Cannot delete client with active sales. Please cancel sales first.');
    }

    // Soft delete
    await query(`
      UPDATE clients 
      SET deleted_at = NOW(), updated_at = NOW()
      WHERE id = $1
    `, [clientId]);

    // 📋 Log de auditoria
    auditLogger('Client deleted', {
      userId: req.user.id,
      companyId: req.user.company.id,
      entityType: 'client',
      entityId: clientId,
      action: 'delete',
      changes: { name: client.name },
      ip: req.ip
    });

    return successResponse(res, { id: clientId }, 'Client deleted successfully');
  });

  /**
   * 📊 HISTÓRICO DE VENDAS DO CLIENTE
   * GET /api/clients/:id/history
   */
  static getSalesHistory = asyncHandler(async (req, res) => {
    const clientId = req.params.id;

    // Verificar se cliente existe e pertence à empresa
    const clientCheck = await query(
      'SELECT id, name FROM clients WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL',
      [clientId, req.user.company.id]
    );

    if (clientCheck.rows.length === 0) {
      throw new ApiError(404, 'Client not found');
    }

    // 📊 Buscar histórico de vendas completo
    const salesQuery = `
      SELECT 
        s.*,
        u.name as seller_name,
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
      FROM sales s
      LEFT JOIN users u ON s.user_id = u.id
      LEFT JOIN sale_items si ON s.id = si.sale_id
      WHERE s.client_id = $1 AND s.company_id = $2 AND s.deleted_at IS NULL
      GROUP BY s.id, u.name, u.email
      ORDER BY s.sale_date DESC
    `;

    const salesResult = await query(salesQuery, [clientId, req.user.company.id]);

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
      FROM sales
      WHERE client_id = $1 AND company_id = $2 AND deleted_at IS NULL AND status != 'cancelled'
    `;

    const statsResult = await query(statsQuery, [clientId, req.user.company.id]);

    return successResponse(res, {
      client: clientCheck.rows[0],
      sales: salesResult.rows,
      stats: statsResult.rows[0]
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
      'SELECT id, name FROM clients WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL',
      [clientId, req.user.company.id]
    );

    if (clientCheck.rows.length === 0) {
      throw new ApiError(404, 'Client not found');
    }

    // 📝 Criar anotação
    const createNoteQuery = `
      INSERT INTO client_notes (
        id, client_id, created_by_id, note, type
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;

    const noteResult = await query(createNoteQuery, [
      uuidv4(),
      clientId,
      req.user.id,
      note,
      type
    ]);

    // 🎮 GAMIFICAÇÃO: Pequeno XP por anotação (incentiva documentação)
    await query(`
      UPDATE user_gamification_profiles 
      SET total_xp = total_xp + 2, current_coins = current_coins + 1
      WHERE user_id = $1 AND company_id = $2
    `, [req.user.id, req.user.company.id]);

    // 📋 Log de auditoria
    auditLogger('Client note added', {
      userId: req.user.id,
      companyId: req.user.company.id,
      entityType: 'client_note',
      entityId: noteResult.rows[0].id,
      relatedEntityType: 'client',
      relatedEntityId: clientId,
      action: 'create',
      changes: { note, type },
      ip: req.ip
    });

    return successResponse(res, noteResult.rows[0], 'Note added successfully', 201);
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
      FROM clients
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
      FROM clients c
      LEFT JOIN sales s ON c.id = s.client_id AND s.deleted_at IS NULL AND s.status != 'cancelled'
      WHERE c.company_id = $1 AND c.deleted_at IS NULL
    `;

    // 🏆 Top clientes por valor
    const topClientsQuery = `
      SELECT 
        c.id,
        c.name,
        c.email,
        c.status,
        COALESCE(SUM(s.total_amount), 0) as total_spent,
        COUNT(s.id) as total_purchases
      FROM clients c
      LEFT JOIN sales s ON c.id = s.client_id AND s.deleted_at IS NULL AND s.status != 'cancelled'
      WHERE c.company_id = $1 AND c.deleted_at IS NULL
      GROUP BY c.id, c.name, c.email, c.status
      HAVING SUM(s.total_amount) > 0
      ORDER BY total_spent DESC
      LIMIT 10
    `;

    const [generalResult, financialResult, topClientsResult] = await Promise.all([
      query(generalStatsQuery, [req.user.company.id]),
      query(financialStatsQuery, [req.user.company.id]),
      query(topClientsQuery, [req.user.company.id])
    ]);

    return successResponse(res, {
      general: generalResult.rows[0],
      financial: financialResult.rows[0],
      top_clients: topClientsResult.rows
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
      throw new ApiError(400, 'Tags must be an array');
    }

    // Verificar se cliente existe
    const clientCheck = await query(
      'SELECT id, name, tags as current_tags FROM clients WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL',
      [clientId, req.user.company.id]
    );

    if (clientCheck.rows.length === 0) {
      throw new ApiError(404, 'Client not found');
    }

    // 🏷️ Atualizar tags
    await query(`
      UPDATE clients 
      SET tags = $1, updated_at = NOW()
      WHERE id = $2
    `, [JSON.stringify(tags), clientId]);

    // 📋 Log de auditoria
    auditLogger('Client tags updated', {
      userId: req.user.id,
      companyId: req.user.company.id,
      entityType: 'client',
      entityId: clientId,
      action: 'update_tags',
      changes: { 
        from: clientCheck.rows[0].current_tags,
        to: tags 
      },
      ip: req.ip
    });

    return successResponse(res, { id: clientId, tags }, 'Tags updated successfully');
  });
}

module.exports = ClientController;