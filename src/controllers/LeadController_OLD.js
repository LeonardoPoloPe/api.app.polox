/**
 * ==========================================
 * 📈 LEAD CONTROLLER - CRM CORE
 * ==========================================
 * 
 * Gestão completa de leads/prospects para pipeline de vendas
 * - CRUD completo de leads
 * - Conversão automática para clientes
 * - Sistema de gamificação integrado
 * - Filtros avançados e relatórios
 * - Importação e exportação em lote
 */

const LeadModel = require('../models/Lead');
const { logger, auditLogger } = require('../utils/logger');
const { ApiError, asyncHandler } = require('../utils/errors');
const { successResponse, paginatedResponse } = require('../utils/formatters');
const Joi = require('joi');

class LeadController {

  /**
   * 📝 VALIDAÇÕES JOI
   */
  static createLeadSchema = Joi.object({
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
    source: Joi.string().valid(
      'website', 'social', 'referral', 'cold_call', 'email', 'event', 'advertising', 'other'
    ).default('other'),
    status: Joi.string().valid(
      'new', 'contacted', 'qualified', 'proposal', 'negotiation', 'won', 'lost'
    ).default('new'),
    value: Joi.number().min(0).allow(null),
    description: Joi.string().max(1000).allow(null),
    tags: Joi.array().items(Joi.string()).default([]),
    custom_fields: Joi.object().default({})
  });

  static updateLeadSchema = Joi.object({
    name: Joi.string().min(2).max(255),
    email: Joi.string().email().allow(null),
    phone: Joi.string().max(20).allow(null),
    company: Joi.string().max(255).allow(null),
    position: Joi.string().max(100).allow(null),
    source: Joi.string().valid(
      'website', 'social', 'referral', 'cold_call', 'email', 'event', 'advertising', 'other'
    ),
    status: Joi.string().valid(
      'new', 'contacted', 'qualified', 'proposal', 'negotiation', 'won', 'lost'
    ),
    value: Joi.number().min(0).allow(null),
    description: Joi.string().max(1000).allow(null),
    tags: Joi.array().items(Joi.string()),
    custom_fields: Joi.object()
  });

  static assignLeadSchema = Joi.object({
    owner_id: Joi.number().integer().positive().required()
      .messages({
        'any.required': 'ID do responsável é obrigatório'
      })
  });

  static updateStatusSchema = Joi.object({
    status: Joi.string().valid(
      'new', 'contacted', 'qualified', 'proposal', 'negotiation', 'won', 'lost'
    ).required(),
    note: Joi.string().max(1000).allow(null)
  });

  static addNoteSchema = Joi.object({
    content: Joi.string().min(1).max(5000).required()
      .messages({
        'string.min': 'Nota não pode estar vazia',
        'any.required': 'Conteúdo da nota é obrigatório'
      }),
    type: Joi.string().valid('general', 'call', 'meeting', 'email', 'whatsapp', 'other')
      .default('general')
  });

  static updateNoteSchema = Joi.object({
    content: Joi.string().min(1).max(5000).required()
  });

  static addTagsSchema = Joi.object({
    tags: Joi.array().items(Joi.string().min(1).max(100)).min(1).required()
      .messages({
        'array.min': 'Pelo menos uma tag é obrigatória'
      })
  });

  static addInterestsSchema = Joi.object({
    interests: Joi.array().items(
      Joi.object({
        name: Joi.string().min(1).max(100).required(),
        category: Joi.string().valid('product', 'service', 'industry', 'technology', 'other')
          .default('other')
      })
    ).min(1).required()
      .messages({
        'array.min': 'Pelo menos um interesse é obrigatório'
      })
  });

  /**
   * 📋 LISTAR LEADS
   * GET /api/leads
   */
  static index = asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = (page - 1) * limit;
    
    let whereClause = 'WHERE l.company_id = $1 AND l.deleted_at IS NULL';
    let queryParams = [req.user.companyId];
    let paramCount = 1;

    // 🔍 FILTROS AVANÇADOS
    if (req.query.status) {
      const statuses = req.query.status.split(',');
      whereClause += ` AND l.status = ANY($${++paramCount})`;
      queryParams.push(statuses);
    }

    if (req.query.source) {
      whereClause += ` AND l.source = $${++paramCount}`;
      queryParams.push(req.query.source);
    }

    if (req.query.assigned_to) {
      whereClause += ` AND l.assigned_to_id = $${++paramCount}`;
      queryParams.push(parseInt(req.query.assigned_to));
    }

    if (req.query.value_min) {
      whereClause += ` AND l.estimated_value >= $${++paramCount}`;
      queryParams.push(parseFloat(req.query.value_min));
    }

    if (req.query.value_max) {
      whereClause += ` AND l.estimated_value <= $${++paramCount}`;
      queryParams.push(parseFloat(req.query.value_max));
    }

    if (req.query.created_from) {
      whereClause += ` AND l.created_at >= $${++paramCount}`;
      queryParams.push(req.query.created_from);
    }

    if (req.query.created_to) {
      whereClause += ` AND l.created_at <= $${++paramCount}`;
      queryParams.push(req.query.created_to);
    }

    if (req.query.search) {
      whereClause += ` AND (
        l.name ILIKE $${++paramCount} OR 
        l.email ILIKE $${++paramCount} OR 
        l.company ILIKE $${++paramCount}
      )`;
      const searchTerm = `%${req.query.search}%`;
      queryParams.push(searchTerm, searchTerm, searchTerm);
      paramCount += 2;
    }

    // 📊 ORDENAÇÃO
    const validSortFields = ['name', 'estimated_value', 'created_at', 'status', 'source'];
    const sortField = validSortFields.includes(req.query.sort) ? req.query.sort : 'created_at';
    const sortOrder = req.query.order === 'asc' ? 'ASC' : 'DESC';

    // 🔍 QUERY PRINCIPAL
    const leadsQuery = `
      SELECT 
        l.*,
        u.full_name as assigned_to_name,
        u.email as assigned_to_email,
        c.name as converted_client_name,
        CASE WHEN l.converted_to_client_id IS NOT NULL THEN true ELSE false END as is_converted
      FROM leads l
      LEFT JOIN users u ON l.assigned_to_id = u.id
      LEFT JOIN clients c ON l.converted_to_client_id = c.id
      ${whereClause}
      ORDER BY l.${sortField} ${sortOrder}
      LIMIT $${++paramCount} OFFSET $${++paramCount}
    `;
    
    queryParams.push(limit, offset);

    // 📊 QUERY DE CONTAGEM
    const countQuery = `
      SELECT COUNT(*) as total
      FROM leads l
      ${whereClause}
    `;

    // 📈 QUERY DE ESTATÍSTICAS
    const statsQuery = `
      SELECT 
        COUNT(*) as total_leads,
        COALESCE(SUM(estimated_value), 0) as total_value,
        COUNT(CASE WHEN status = 'new' THEN 1 END) as new_leads,
        COUNT(CASE WHEN status = 'contacted' THEN 1 END) as contacted_leads,
        COUNT(CASE WHEN status = 'qualified' THEN 1 END) as qualified_leads,
        COUNT(CASE WHEN status = 'proposal' THEN 1 END) as proposal_leads,
        COUNT(CASE WHEN status = 'negotiation' THEN 1 END) as negotiation_leads,
        COUNT(CASE WHEN status = 'won' THEN 1 END) as won_leads,
        COUNT(CASE WHEN status = 'lost' THEN 1 END) as lost_leads,
        COUNT(CASE WHEN converted_to_client_id IS NOT NULL THEN 1 END) as converted_leads,
        COALESCE(AVG(estimated_value), 0) as average_value
      FROM leads l
      WHERE l.company_id = $1 AND l.deleted_at IS NULL
    `;

    const [leadsResult, countResult, statsResult] = await Promise.all([
      query(leadsQuery, queryParams),
      query(countQuery, queryParams.slice(0, -2)),
      query(statsQuery, [req.user.companyId])
    ]);

    const stats = statsResult.rows[0];
    
    // 📊 Calcular taxa de conversão
    const conversionRate = stats.total_leads > 0 
      ? ((stats.converted_leads / stats.total_leads) * 100).toFixed(2)
      : 0;

    return paginatedResponse(res, leadsResult.rows, {
      page,
      limit,
      total: parseInt(countResult.rows[0].total),
      stats: {
        ...stats,
        conversion_rate: parseFloat(conversionRate)
      }
    });
  });

  /**
   * ➕ CRIAR LEAD
   * POST /api/leads
   */
  static create = asyncHandler(async (req, res) => {
    const { error, value } = LeadController.createLeadSchema.validate(req.body);
    if (error) throw new ApiError(400, error.details[0].message);

    const leadData = value;

    // Verificar se email já existe (se fornecido)
    if (leadData.email) {
      const emailCheck = await query(
        'SELECT id FROM leads WHERE email = $1 AND company_id = $2 AND deleted_at IS NULL',
        [leadData.email, req.user.companyId]
      );

      if (emailCheck.rows.length > 0) {
        throw new ApiError(400, 'Lead with this email already exists');
      }
    }

    // 🆕 CRIAR LEAD
    const createLeadQuery = `
      INSERT INTO leads (
        company_id, user_id, assigned_to_id, name, email, phone, 
        company_name, position, source, status, notes, tags
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `;

    const newLeadResult = await query(createLeadQuery, [
      req.user.companyId,
      req.user.id,
      req.user.id, // Por padrão, quem cria fica responsável
      leadData.name,
      leadData.email,
      leadData.phone,
      leadData.company,
      leadData.position,
      leadData.source,
      leadData.status,
      leadData.description,
      JSON.stringify(leadData.tags)
    ]);

    const newLead = newLeadResult.rows[0];

    // 🎮 GAMIFICAÇÃO: Conceder XP/Coins por criar lead
    await query(`
      UPDATE user_gamification_profiles 
      SET total_xp = total_xp + 10, current_coins = current_coins + 5
      WHERE user_id = $1 AND company_id = $2
    `, [req.user.id, req.user.companyId]);

    // 📈 Registrar no histórico de gamificação
    await query(`
      INSERT INTO gamification_history (user_id, company_id, event_type, amount, reason, action_type)
      VALUES 
        ($1, $2, 'xp', 10, $3, 'lead_created'),
        ($1, $2, 'coins', 5, $3, 'lead_created')
    `, [req.user.id, req.user.companyId, `Lead created: ${leadData.name}`]);

    // 🏆 Verificar conquista "Primeiro Lead"
    const leadCountQuery = await query(
      'SELECT COUNT(*) as count FROM leads WHERE user_id = $1 AND company_id = $2 AND deleted_at IS NULL',
      [req.user.id, req.user.companyId]
    );

    if (parseInt(leadCountQuery.rows[0].count) === 1) {
      await LeadController.unlockAchievement(req.user.id, req.user.companyId, 'first_lead');
    }

    // 📋 Log de auditoria
    auditLogger('Lead created', {
      userId: req.user.id,
      companyId: req.user.companyId,
      entityType: 'lead',
      entityId: newLead.id,
      action: 'create',
      changes: leadData,
      ip: req.ip
    });

    return successResponse(res, newLead, 'Lead created successfully', 201);
  });

  /**
   * 👁️ DETALHES DO LEAD
   * GET /api/leads/:id
   */
  static show = asyncHandler(async (req, res) => {
    const leadId = req.params.id;

    const leadQuery = `
      SELECT 
        l.*,
        u.full_name as assigned_to_name,
        u.email as assigned_to_email,
        creator.full_name as created_by_name,
        c.name as converted_client_name,
        c.id as converted_client_id
      FROM leads l
      LEFT JOIN users u ON l.assigned_to_id = u.id
      LEFT JOIN users creator ON l.created_by_id = creator.id
      LEFT JOIN clients c ON l.converted_to_client_id = c.id
      WHERE l.id = $1 AND l.company_id = $2 AND l.deleted_at IS NULL
    `;
    
    const leadResult = await query(leadQuery, [leadId, req.user.companyId]);
    
    if (leadResult.rows.length === 0) {
      throw new ApiError(404, 'Lead not found');
    }

    return successResponse(res, leadResult.rows[0]);
  });

  /**
   * ✏️ ATUALIZAR LEAD
   * PUT /api/leads/:id
   */
  static update = asyncHandler(async (req, res) => {
    const leadId = req.params.id;
    const { error, value } = LeadController.updateLeadSchema.validate(req.body);
    if (error) throw new ApiError(400, error.details[0].message);

    const updateData = value;

    // Verificar se lead existe
    const leadCheck = await query(
      'SELECT * FROM leads WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL',
      [leadId, req.user.companyId]
    );

    if (leadCheck.rows.length === 0) {
      throw new ApiError(404, 'Lead not found');
    }

    const currentLead = leadCheck.rows[0];

    // Verificar email único (se mudou)
    if (updateData.email && updateData.email !== currentLead.email) {
      const emailCheck = await query(
        'SELECT id FROM leads WHERE email = $1 AND company_id = $2 AND id != $3 AND deleted_at IS NULL',
        [updateData.email, req.user.companyId, leadId]
      );

      if (emailCheck.rows.length > 0) {
        throw new ApiError(400, 'Lead with this email already exists');
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
    updateValues.push(leadId, req.user.companyId);

    const updateQuery = `
      UPDATE leads 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramCount + 1} AND company_id = $${paramCount + 2}
      RETURNING *
    `;

    const updatedLeadResult = await query(updateQuery, updateValues);

    // 📋 Log de auditoria
    auditLogger('Lead updated', {
      userId: req.user.id,
      companyId: req.user.companyId,
      entityType: 'lead',
      entityId: leadId,
      action: 'update',
      changes: updateData,
      ip: req.ip
    });

    return successResponse(res, updatedLeadResult.rows[0], 'Lead updated successfully');
  });

  /**
   * 🔄 CONVERTER LEAD PARA CLIENTE
   * POST /api/leads/:id/convert
   */
  static convertToClient = asyncHandler(async (req, res) => {
    const leadId = req.params.id;

    // 🔍 Buscar lead
    const leadQuery = `
      SELECT * FROM leads 
      WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL
    `;
    
    const leadResult = await query(leadQuery, [leadId, req.user.companyId]);
    
    if (leadResult.rows.length === 0) {
      throw new ApiError(404, 'Lead not found');
    }

    const lead = leadResult.rows[0];

    // ✅ Verificar se já foi convertido
    if (lead.converted_to_client_id) {
      throw new ApiError(400, 'Lead already converted to client');
    }

    const transaction = await beginTransaction();
    
    try {
      // 1️⃣ CRIAR CLIENTE baseado no lead
      const createClientQuery = `
        INSERT INTO clients (
          company_id, name, email, phone, company_name, position,
          source, status, notes, tags
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'ativo', $8, $9)
        RETURNING *
      `;

      const newClientResult = await query(createClientQuery, [
        req.user.companyId,
        lead.name,
        lead.email,
        lead.phone,
        lead.company_name,
        lead.position,
        lead.source,
        lead.notes,
        lead.tags
      ], transaction);

      const newClient = newClientResult.rows[0];

      // 2️⃣ ATUALIZAR LEAD como convertido
      await query(`
        UPDATE leads 
        SET 
          converted_to_client_id = $1,
          converted_at = NOW(),
          status = 'won'
        WHERE id = $2
      `, [newClient.id, leadId], transaction);

      // 3️⃣ GAMIFICAÇÃO: Conceder XP/Coins pela conversão
      await query(`
        UPDATE user_gamification_profiles 
        SET total_xp = total_xp + 50, current_coins = current_coins + 25
        WHERE user_id = $1 AND company_id = $2
      `, [lead.assigned_to_id || req.user.id, req.user.companyId], transaction);

      // 4️⃣ Registrar no histórico
      await query(`
        INSERT INTO gamification_history (user_id, company_id, event_type, amount, reason, action_type)
        VALUES 
          ($1, $2, 'xp', 50, $3, 'lead_converted'),
          ($1, $2, 'coins', 25, $3, 'lead_converted')
      `, [
        lead.assigned_to_id || req.user.id, 
        req.user.companyId,
        `Lead converted to client: ${lead.name}`
      ], transaction);

      // 5️⃣ Verificar conquista "Primeiro Cliente"
      const clientCountQuery = await query(
        'SELECT COUNT(*) as count FROM clients WHERE company_id = $1 AND deleted_at IS NULL',
        [req.user.companyId],
        transaction
      );

      if (parseInt(clientCountQuery.rows[0].count) === 1) {
        await LeadController.unlockAchievement(
          lead.assigned_to_id || req.user.id, 
          req.user.companyId, 
          'first_client',
          transaction
        );
      }

      await commitTransaction(transaction);

      // 📋 Log de auditoria
      auditLogger('Lead converted to client', {
        userId: req.user.id,
        companyId: req.user.companyId,
        entityType: 'lead',
        entityId: leadId,
        action: 'convert',
        relatedEntityType: 'client',
        relatedEntityId: newClient.id,
        ip: req.ip
      });

      return successResponse(res, {
        lead_id: leadId,
        client_id: newClient.id,
        client: newClient
      }, 'Lead converted to client successfully');

    } catch (error) {
      await rollbackTransaction(transaction);
      throw error;
    }
  });

  /**
   * 👤 ATRIBUIR LEAD A USUÁRIO
   * PUT /api/leads/:id/assign
   */
  static assignTo = asyncHandler(async (req, res) => {
    const leadId = req.params.id;
    const { error, value } = LeadController.assignLeadSchema.validate(req.body);
    if (error) throw new ApiError(400, error.details[0].message);

    const { user_id } = value;

    // Verificar se usuário existe na empresa
    const userCheck = await query(
      'SELECT id, full_name FROM users WHERE id = $1 AND company_id = $2 AND status = $3',
      [user_id, req.user.companyId, 'active']
    );

    if (userCheck.rows.length === 0) {
      throw new ApiError(404, 'User not found in company');
    }

    // Verificar se lead existe
    const leadCheck = await query(
      'SELECT id, name, assigned_to_id FROM leads WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL',
      [leadId, req.user.companyId]
    );

    if (leadCheck.rows.length === 0) {
      throw new ApiError(404, 'Lead not found');
    }

    const lead = leadCheck.rows[0];

    // Atualizar responsável
    await query(`
      UPDATE leads 
      SET assigned_to_id = $1, updated_at = NOW()
      WHERE id = $2
    `, [user_id, leadId]);

    // 📋 Log de auditoria
    auditLogger('Lead assigned', {
      userId: req.user.id,
      companyId: req.user.companyId,
      entityType: 'lead',
      entityId: leadId,
      action: 'assign',
      changes: { 
        from_user_id: lead.assigned_to_id,
        to_user_id: user_id,
        to_user_name: userCheck.rows[0].name
      },
      ip: req.ip
    });

    return successResponse(res, {
      lead_id: leadId,
      assigned_to: userCheck.rows[0]
    }, 'Lead assigned successfully');
  });

  /**
   * 🏆 DESBLOQUEAR CONQUISTA
   */
  static async unlockAchievement(userId, companyId, achievementCode, transaction = null) {
    const achievementQuery = `
      SELECT id, name, xp_reward, coin_reward FROM achievements 
      WHERE company_id = $1 AND unlock_criteria->>'action' = $2 AND is_active = true
    `;
    
    const achievementResult = await query(achievementQuery, [companyId, achievementCode], transaction);
    
    if (achievementResult.rows.length > 0) {
      const achievement = achievementResult.rows[0];
      
      // Verificar se já foi desbloqueada
      const userAchievementCheck = await query(
        'SELECT id FROM user_achievements WHERE user_id = $1 AND achievement_id = $2',
        [userId, achievement.id],
        transaction
      );

      if (userAchievementCheck.rows.length === 0) {
        // Desbloquear conquista
        await query(
          'INSERT INTO user_achievements (user_id, achievement_id) VALUES ($1, $2)',
          [userId, achievement.id],
          transaction
        );

        // Conceder recompensas da conquista
        if (achievement.xp_reward > 0 || achievement.coin_reward > 0) {
          await query(`
            UPDATE user_gamification_profiles 
            SET total_xp = total_xp + $1, current_coins = current_coins + $2
            WHERE user_id = $3 AND company_id = $4
          `, [achievement.xp_reward, achievement.coin_reward, userId, companyId], transaction);

          // Registrar no histórico
          await query(`
            INSERT INTO gamification_history (user_id, company_id, event_type, amount, reason, action_type)
            VALUES 
              ($1, $2, 'xp', $3, $4, 'achievement_unlocked'),
              ($1, $2, 'coins', $5, $4, 'achievement_unlocked')
          `, [
            userId, companyId, 
            achievement.xp_reward, 
            `Achievement unlocked: ${achievement.name}`,
            achievement.coin_reward
          ], transaction);
        }
      }
    }
  }

  // TODO: Implementar métodos restantes:
  // - destroy (soft delete)
  // - updateStatus 
  // - getStats
  // - importLeads
  // - exportLeads
}

module.exports = LeadController;