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

/**
 * ==========================================
 * 💼 DEAL CONTROLLER - SALES PIPELINE
 * ==========================================
 *
 * Gestão de negociações/oportunidades de venda
 * Arquitetura: "Identidade vs. Intenção"
 * - Identidade (Contact): QUEM a pessoa é
 * - Intenção (Deal): O QUE a pessoa quer comprar (esta controller)
 * 
 * Features:
 * - Pipeline/funil de vendas
 * - Movimentação entre etapas
 * - Fechamento: Won (ganha) ou Lost (perdida)
 * - markAsWon: Conversão automática Lead → Cliente
 * - Estatísticas e taxa de conversão
 */

const Deal = require('../models/Deal');
const Contact = require('../models/Contact');
const { ApiError, asyncHandler, ValidationError, NotFoundError } = require('../utils/errors');
const { successResponse, paginatedResponse } = require('../utils/response');
const { tc } = require('../config/i18n');
const { auditLogger } = require('../utils/logger');
const Joi = require('joi');

class DealController {
  /**
   * 📝 VALIDAÇÕES JOI
   */
  static createDealSchema = Joi.object({
    contato_id: Joi.number().integer().required(),
    titulo: Joi.string().min(3).max(255).required(),
    descricao: Joi.string().allow(null, ''),
    etapa_funil: Joi.string().max(50).default('novo'),
    valor_total_cents: Joi.number().integer().min(0).default(0),
    probabilidade: Joi.number().integer().min(0).max(100).default(0),
    origem: Joi.string().max(100).allow(null),
    expected_close_date: Joi.date().iso().allow(null),
    owner_id: Joi.number().integer().allow(null),
    metadata: Joi.object().default({})
  });

  static updateDealSchema = Joi.object({
    titulo: Joi.string().min(3).max(255),
    descricao: Joi.string().allow(null, ''),
    etapa_funil: Joi.string().max(50),
    valor_total_cents: Joi.number().integer().min(0),
    probabilidade: Joi.number().integer().min(0).max(100),
    origem: Joi.string().max(100).allow(null),
    expected_close_date: Joi.date().iso().allow(null),
    owner_id: Joi.number().integer().allow(null),
    metadata: Joi.object()
  });

  /**
   * 📋 Listar negociações com filtros
   * GET /api/deals
   */
  static list = asyncHandler(async (req, res) => {
    const companyId = req.user.companyId;
    const {
      contato_id,
      owner_id,
      etapa_funil,
      origem,
      status, // 'open' | 'won' | 'lost'
      search,
      sort_by,
      sort_order,
      limit = 50,
      offset = 0
    } = req.query;

    const filters = {
      contato_id: contato_id ? parseInt(contato_id) : undefined,
      owner_id: owner_id ? parseInt(owner_id) : undefined,
      etapa_funil,
      origem,
      status,
      search,
      sort_by,
      sort_order,
      limit: parseInt(limit),
      offset: parseInt(offset)
    };

    const deals = await Deal.list(companyId, filters);
    const total = await Deal.count(companyId, {
      contato_id: filters.contato_id,
      owner_id: filters.owner_id,
      etapa_funil,
      origem,
      status
    });

    res.json(
      paginatedResponse(
        deals,
        total,
        parseInt(limit),
        parseInt(offset),
        tc(req, 'dealController', 'list.success')
      )
    );
  });

  /**
   * 🔍 Buscar negociação por ID
   * GET /api/deals/:id
   */
  static show = asyncHandler(async (req, res) => {
    const companyId = req.user.companyId;
    const { id } = req.params;

    const deal = await Deal.findById(id, companyId);

    if (!deal) {
      throw new NotFoundError(tc(req, 'dealController', 'show.not_found'));
    }

    res.json(successResponse(deal, tc(req, 'dealController', 'show.success')));
  });

  /**
   * 📋 Listar negociações de um contato
   * GET /api/contacts/:contactId/deals
   */
  static listByContact = asyncHandler(async (req, res) => {
    const companyId = req.user.companyId;
    const { contactId } = req.params;

    const deals = await Deal.listByContact(contactId, companyId);

    res.json(successResponse(deals, tc(req, 'dealController', 'list.success')));
  });

  /**
   * ➕ Criar nova negociação
   * POST /api/deals
   */
  static create = asyncHandler(async (req, res) => {
    const companyId = req.user.companyId;
    const userId = req.user.id;

    // Validação
    const { error, value } = DealController.createDealSchema.validate(req.body, {
      abortEarly: false
    });

    if (error) {
      const messages = error.details.map(d => d.message).join(', ');
      throw new ValidationError(messages);
    }

    // Verificar se contato existe
    const contact = await Contact.findById(value.contato_id, companyId);
    if (!contact) {
      throw new NotFoundError(tc(req, 'dealController', 'validation.contact_not_found'));
    }

    // Criar negociação
    const deal = await Deal.create(companyId, value);

    // Audit log
    auditLogger.log({
      action: tc(req, 'dealController', 'audit.deal_created'),
      userId,
      companyId,
      resourceType: 'deal',
      resourceId: deal.id,
      changes: value
    });

    res.status(201).json(
      successResponse(deal, tc(req, 'dealController', 'create.success'))
    );
  });

  /**
   * ✏️ Atualizar negociação
   * PUT /api/deals/:id
   */
  static update = asyncHandler(async (req, res) => {
    const companyId = req.user.companyId;
    const userId = req.user.id;
    const { id } = req.params;

    // Validação
    const { error, value } = DealController.updateDealSchema.validate(req.body, {
      abortEarly: false
    });

    if (error) {
      const messages = error.details.map(d => d.message).join(', ');
      throw new ValidationError(messages);
    }

    const deal = await Deal.update(id, companyId, value);

    // Audit log
    auditLogger.log({
      action: tc(req, 'dealController', 'audit.deal_updated'),
      userId,
      companyId,
      resourceType: 'deal',
      resourceId: id,
      changes: value
    });

    res.json(successResponse(deal, tc(req, 'dealController', 'update.success')));
  });

  /**
   * 🔄 Mover etapa do funil
   * PUT /api/deals/:id/stage
   */
  static updateStage = asyncHandler(async (req, res) => {
    const companyId = req.user.companyId;
    const userId = req.user.id;
    const { id } = req.params;
    const { etapa_funil } = req.body;

    if (!etapa_funil) {
      throw new ValidationError(tc(req, 'dealController', 'validation.etapa_required'));
    }

    const deal = await Deal.updateStage(id, companyId, etapa_funil);

    // Audit log
    auditLogger.log({
      action: tc(req, 'dealController', 'audit.deal_stage_updated'),
      userId,
      companyId,
      resourceType: 'deal',
      resourceId: id,
      changes: { etapa_funil }
    });

    res.json(successResponse(deal, tc(req, 'dealController', 'stage.update_success')));
  });

  /**
   * ✅ Marcar negociação como GANHA
   * PUT /api/deals/:id/win
   * 
   * IMPORTANTE: Converte automaticamente Lead → Cliente
   * - UPDATE deals: closed_at=NOW(), closed_reason='won'
   * - UPDATE contacts: tipo='cliente', lifetime_value_cents+=valor
   */
  static markAsWon = asyncHandler(async (req, res) => {
    const companyId = req.user.companyId;
    const userId = req.user.id;
    const { id } = req.params;

    const deal = await Deal.markAsWon(id, companyId);

    // Audit log
    auditLogger.log({
      action: tc(req, 'dealController', 'audit.deal_won'),
      userId,
      companyId,
      resourceType: 'deal',
      resourceId: id,
      metadata: {
        valor_total_cents: deal.valor_total_cents,
        contato_id: deal.contato_id
      }
    });

    res.json(successResponse(deal, tc(req, 'dealController', 'win.success')));
  });

  /**
   * ❌ Marcar negociação como PERDIDA
   * PUT /api/deals/:id/lose
   */
  static markAsLost = asyncHandler(async (req, res) => {
    const companyId = req.user.companyId;
    const userId = req.user.id;
    const { id } = req.params;
    const { reason } = req.body;

    const deal = await Deal.markAsLost(id, companyId, reason);

    // Audit log
    auditLogger.log({
      action: tc(req, 'dealController', 'audit.deal_lost'),
      userId,
      companyId,
      resourceType: 'deal',
      resourceId: id,
      metadata: { reason: reason || 'Not specified' }
    });

    res.json(successResponse(deal, tc(req, 'dealController', 'lose.success')));
  });

  /**
   * 🔓 Reabrir negociação fechada
   * PUT /api/deals/:id/reopen
   */
  static reopen = asyncHandler(async (req, res) => {
    const companyId = req.user.companyId;
    const userId = req.user.id;
    const { id } = req.params;

    const deal = await Deal.reopen(id, companyId);

    // Audit log
    auditLogger.log({
      action: tc(req, 'dealController', 'audit.deal_reopened'),
      userId,
      companyId,
      resourceType: 'deal',
      resourceId: id
    });

    res.json(successResponse(deal, tc(req, 'dealController', 'reopen.success')));
  });

  /**
   * 🗑️ Excluir negociação (soft delete)
   * DELETE /api/deals/:id
   */
  static delete = asyncHandler(async (req, res) => {
    const companyId = req.user.companyId;
    const userId = req.user.id;
    const { id } = req.params;

    await Deal.softDelete(id, companyId);

    // Audit log
    auditLogger.log({
      action: tc(req, 'dealController', 'audit.deal_deleted'),
      userId,
      companyId,
      resourceType: 'deal',
      resourceId: id
    });

    res.json(successResponse(null, tc(req, 'dealController', 'delete.success')));
  });

  /**
   * 📊 Estatísticas do funil de vendas
   * GET /api/deals/stats
   */
  static getStats = asyncHandler(async (req, res) => {
    const companyId = req.user.companyId;
    const { owner_id, etapa_funil, origem } = req.query;

    const stats = await Deal.getStats(companyId, {
      owner_id: owner_id ? parseInt(owner_id) : undefined,
      etapa_funil,
      origem
    });

    res.json(successResponse(stats, tc(req, 'dealController', 'stats.success')));
  });
}

module.exports = DealController;
