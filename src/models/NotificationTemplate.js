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
 * Model para templates de notificação
 * Baseado no schema polox.notification_templates
 */
class NotificationTemplateModel {
  /**
   * Cria um novo template de notificação
   * @param {Object} templateData - Dados do template
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object>} Template criado
   */
  static async create(templateData, companyId) {
    const {
      name,
      type,
      category = 'general',
      title,
      content,
      variables = null,
      channel = 'email',
      is_active = true,
      language = 'pt-BR',
      subject = null,
      from_name = null,
      from_email = null,
      reply_to = null,
      cc = null,
      bcc = null,
      html_content = null,
      sms_content = null,
      push_content = null,
      webhook_payload = null,
      scheduling_rules = null,
      personalization_rules = null
    } = templateData;

    // Validar dados obrigatórios
    if (!name) {
      throw new ValidationError('Nome do template é obrigatório');
    }

    if (!type) {
      throw new ValidationError('Tipo do template é obrigatório');
    }

    if (!title) {
      throw new ValidationError('Título do template é obrigatório');
    }

    if (!content) {
      throw new ValidationError('Conteúdo do template é obrigatório');
    }

    if (!['email', 'sms', 'push', 'webhook', 'in_app'].includes(channel)) {
      throw new ValidationError('Canal deve ser: email, sms, push, webhook ou in_app');
    }

    return await transaction(async (client) => {
      // Verificar se já existe template com mesmo nome
      const existingTemplate = await client.query(
        'SELECT id FROM polox.notification_templates WHERE company_id = $1 AND name = $2 AND deleted_at IS NULL',
        [companyId, name]
      );

      if (existingTemplate.rows.length > 0) {
        throw new ValidationError('Já existe um template com este nome');
      }

      const insertQuery = `
        INSERT INTO polox.notification_templates (
          company_id, name, type, category, title, content, variables,
          channel, is_active, language, subject, from_name, from_email,
          reply_to, cc, bcc, html_content, sms_content, push_content,
          webhook_payload, scheduling_rules, personalization_rules,
          created_at, updated_at
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          $8, $9, $10, $11, $12, $13,
          $14, $15, $16, $17, $18, $19,
          $20, $21, $22,
          NOW(), NOW()
        )
        RETURNING 
          id, name, type, category, title, content, variables,
          channel, is_active, language, created_at, updated_at
      `;

      const result = await client.query(insertQuery, [
        companyId, name, type, category, title, content, variables,
        channel, is_active, language, subject, from_name, from_email,
        reply_to, cc, bcc, html_content, sms_content, push_content,
        webhook_payload, scheduling_rules, personalization_rules
      ]);

      return result.rows[0];
    }, { companyId });
  }

  /**
   * Busca template por ID
   * @param {number} id - ID do template
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object|null>} Template encontrado ou null
   */
  static async findById(id, companyId) {
    const selectQuery = `
      SELECT 
        nt.*,
        (SELECT COUNT(*) FROM polox.notifications WHERE template_id = nt.id) as usage_count,
        (SELECT MAX(sent_at) FROM polox.notifications WHERE template_id = nt.id AND status = 'sent') as last_used_at
      FROM polox.notification_templates nt
      WHERE nt.id = $1 AND nt.company_id = $2 AND nt.deleted_at IS NULL
    `;

    try {
      const result = await query(selectQuery, [id, companyId], { companyId });
      return result.rows[0] || null;
    } catch (error) {
      throw new ApiError(500, `Erro ao buscar template: ${error.message}`);
    }
  }

  /**
   * Busca template por nome
   * @param {string} name - Nome do template
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object|null>} Template encontrado ou null
   */
  static async findByName(name, companyId) {
    const selectQuery = `
      SELECT * FROM polox.notification_templates
      WHERE name = $1 AND company_id = $2 AND deleted_at IS NULL
    `;

    try {
      const result = await query(selectQuery, [name, companyId], { companyId });
      return result.rows[0] || null;
    } catch (error) {
      throw new ApiError(500, `Erro ao buscar template por nome: ${error.message}`);
    }
  }

  /**
   * Busca template por tipo
   * @param {string} type - Tipo do template
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object|null>} Template encontrado ou null
   */
  static async findByType(type, companyId) {
    const selectQuery = `
      SELECT * FROM polox.notification_templates
      WHERE type = $1 AND company_id = $2 AND is_active = TRUE AND deleted_at IS NULL
      ORDER BY created_at DESC
      LIMIT 1
    `;

    try {
      const result = await query(selectQuery, [type, companyId], { companyId });
      return result.rows[0] || null;
    } catch (error) {
      throw new ApiError(500, `Erro ao buscar template por tipo: ${error.message}`);
    }
  }

  /**
   * Lista templates com filtros e paginação
   * @param {Object} options - Opções de busca
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object>} Lista de templates e metadados
   */
  static async list(options = {}, companyId) {
    const {
      page = 1,
      limit = 10,
      type = null,
      category = null,
      channel = null,
      is_active = null,
      language = null,
      search = null,
      sortBy = 'created_at',
      sortOrder = 'DESC'
    } = options;

    const offset = (page - 1) * limit;
    const conditions = ['company_id = $1', 'deleted_at IS NULL'];
    const values = [companyId];
    let paramCount = 2;

    // Adicionar filtros
    if (type) {
      conditions.push(`type = $${paramCount}`);
      values.push(type);
      paramCount++;
    }

    if (category) {
      conditions.push(`category = $${paramCount}`);
      values.push(category);
      paramCount++;
    }

    if (channel) {
      conditions.push(`channel = $${paramCount}`);
      values.push(channel);
      paramCount++;
    }

    if (is_active !== null) {
      conditions.push(`is_active = $${paramCount}`);
      values.push(is_active);
      paramCount++;
    }

    if (language) {
      conditions.push(`language = $${paramCount}`);
      values.push(language);
      paramCount++;
    }

    if (search) {
      conditions.push(`(name ILIKE $${paramCount} OR title ILIKE $${paramCount} OR content ILIKE $${paramCount})`);
      values.push(`%${search}%`);
      paramCount++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Query para contar total
    const countQuery = `
      SELECT COUNT(*) 
      FROM polox.notification_templates 
      ${whereClause}
    `;

    // Query para buscar dados
    const selectQuery = `
      SELECT 
        id, name, type, category, title, channel, is_active,
        language, variables, created_at, updated_at,
        (SELECT COUNT(*) FROM polox.notifications WHERE template_id = polox.notification_templates.id) as usage_count,
        (SELECT MAX(sent_at) FROM polox.notifications WHERE template_id = polox.notification_templates.id AND status = 'sent') as last_used_at
      FROM polox.notification_templates
      ${whereClause}
      ORDER BY ${sortBy} ${sortOrder}
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
      throw new ApiError(500, `Erro ao listar templates: ${error.message}`);
    }
  }

  /**
   * Atualiza dados do template
   * @param {number} id - ID do template
   * @param {Object} updateData - Dados para atualizar
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object|null>} Template atualizado ou null
   */
  static async update(id, updateData, companyId) {
    const allowedFields = [
      'name', 'type', 'category', 'title', 'content', 'variables',
      'channel', 'is_active', 'language', 'subject', 'from_name',
      'from_email', 'reply_to', 'cc', 'bcc', 'html_content',
      'sms_content', 'push_content', 'webhook_payload',
      'scheduling_rules', 'personalization_rules'
    ];

    return await transaction(async (client) => {
      // Verificar se nome não está duplicado (se sendo alterado)
      if (updateData.name) {
        const existingTemplate = await client.query(
          'SELECT id FROM polox.notification_templates WHERE company_id = $1 AND name = $2 AND id != $3 AND deleted_at IS NULL',
          [companyId, updateData.name, id]
        );

        if (existingTemplate.rows.length > 0) {
          throw new ValidationError('Já existe um template com este nome');
        }
      }

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
        UPDATE polox.notification_templates 
        SET ${updates.join(', ')}
        WHERE id = $${paramCount} AND company_id = $${paramCount + 1} AND deleted_at IS NULL
        RETURNING 
          id, name, type, category, title, content, channel,
          is_active, language, variables, created_at, updated_at
      `;

      const result = await client.query(updateQuery, values);
      return result.rows[0] || null;
    }, { companyId });
  }

  /**
   * Processa template com variáveis
   * @param {Object} template - Template a ser processado
   * @param {Object} variables - Variáveis para substituição
   * @returns {Object} Template processado
   */
  static processTemplate(template, variables = {}) {
    if (!template) {
      throw new ValidationError('Template não fornecido');
    }

    const processString = (text) => {
      if (!text) return text;
      
      let processedText = text;
      
      // Substituir variáveis do formato {{variable}}
      for (const [key, value] of Object.entries(variables)) {
        const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
        processedText = processedText.replace(regex, value || '');
      }

      // Substituir variáveis do formato {variable}
      for (const [key, value] of Object.entries(variables)) {
        const regex = new RegExp(`{\\s*${key}\\s*}`, 'g');
        processedText = processedText.replace(regex, value || '');
      }

      return processedText;
    };

    const processed = {
      ...template,
      title: processString(template.title),
      content: processString(template.content),
      subject: processString(template.subject),
      html_content: processString(template.html_content),
      sms_content: processString(template.sms_content),
      push_content: processString(template.push_content)
    };

    // Processar regras de personalização se existirem
    if (template.personalization_rules) {
      try {
        const rules = typeof template.personalization_rules === 'string' 
          ? JSON.parse(template.personalization_rules) 
          : template.personalization_rules;

        for (const rule of rules) {
          if (rule.condition && rule.replacement && this.evaluateCondition(rule.condition, variables)) {
            if (rule.field === 'title') {
              processed.title = processString(rule.replacement);
            } else if (rule.field === 'content') {
              processed.content = processString(rule.replacement);
            }
          }
        }
      } catch (error) {
        console.error('Erro ao processar regras de personalização:', error);
      }
    }

    return processed;
  }

  /**
   * Avalia condição para regras de personalização
   * @param {Object} condition - Condição a ser avaliada
   * @param {Object} variables - Variáveis disponíveis
   * @returns {boolean} Resultado da avaliação
   */
  static evaluateCondition(condition, variables) {
    try {
      const { field, operator, value } = condition;
      const fieldValue = variables[field];

      switch (operator) {
        case 'equals':
          return fieldValue == value;
        case 'not_equals':
          return fieldValue != value;
        case 'contains':
          return fieldValue && fieldValue.toString().includes(value);
        case 'greater_than':
          return parseFloat(fieldValue) > parseFloat(value);
        case 'less_than':
          return parseFloat(fieldValue) < parseFloat(value);
        case 'in':
          return Array.isArray(value) && value.includes(fieldValue);
        case 'not_in':
          return Array.isArray(value) && !value.includes(fieldValue);
        default:
          return false;
      }
    } catch (error) {
      return false;
    }
  }

  /**
   * Valida variáveis do template
   * @param {Object} template - Template a ser validado
   * @param {Object} variables - Variáveis fornecidas
   * @returns {Object} Resultado da validação
   */
  static validateVariables(template, variables = {}) {
    const requiredVars = [];
    const optionalVars = [];
    const missingVars = [];

    // Extrair variáveis do template
    if (template.variables) {
      try {
        const templateVars = typeof template.variables === 'string' 
          ? JSON.parse(template.variables) 
          : template.variables;

        for (const varDef of templateVars) {
          if (varDef.required) {
            requiredVars.push(varDef.name);
            if (!variables[varDef.name]) {
              missingVars.push(varDef.name);
            }
          } else {
            optionalVars.push(varDef.name);
          }
        }
      } catch (error) {
        console.error('Erro ao processar variáveis do template:', error);
      }
    }

    return {
      isValid: missingVars.length === 0,
      requiredVars,
      optionalVars,
      missingVars,
      providedVars: Object.keys(variables)
    };
  }

  /**
   * Clona template
   * @param {number} id - ID do template a ser clonado
   * @param {string} newName - Nome do novo template
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object>} Template clonado
   */
  static async clone(id, newName, companyId) {
    const originalTemplate = await this.findById(id, companyId);
    
    if (!originalTemplate) {
      throw new NotFoundError('Template não encontrado');
    }

    const cloneData = {
      name: newName,
      type: originalTemplate.type,
      category: originalTemplate.category,
      title: `${originalTemplate.title} (Cópia)`,
      content: originalTemplate.content,
      variables: originalTemplate.variables,
      channel: originalTemplate.channel,
      language: originalTemplate.language,
      subject: originalTemplate.subject,
      from_name: originalTemplate.from_name,
      from_email: originalTemplate.from_email,
      reply_to: originalTemplate.reply_to,
      cc: originalTemplate.cc,
      bcc: originalTemplate.bcc,
      html_content: originalTemplate.html_content,
      sms_content: originalTemplate.sms_content,
      push_content: originalTemplate.push_content,
      webhook_payload: originalTemplate.webhook_payload,
      scheduling_rules: originalTemplate.scheduling_rules,
      personalization_rules: originalTemplate.personalization_rules
    };

    return await this.create(cloneData, companyId);
  }

  /**
   * Obtém estatísticas de templates
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object>} Estatísticas de templates
   */
  static async getStats(companyId) {
    const statsQuery = `
      SELECT 
        COUNT(*) as total_templates,
        COUNT(CASE WHEN is_active = TRUE THEN 1 END) as active_templates,
        COUNT(CASE WHEN channel = 'email' THEN 1 END) as email_templates,
        COUNT(CASE WHEN channel = 'sms' THEN 1 END) as sms_templates,
        COUNT(CASE WHEN channel = 'push' THEN 1 END) as push_templates,
        COUNT(CASE WHEN channel = 'webhook' THEN 1 END) as webhook_templates,
        COUNT(CASE WHEN channel = 'in_app' THEN 1 END) as in_app_templates,
        COUNT(CASE WHEN language = 'pt-BR' THEN 1 END) as portuguese_templates,
        COUNT(CASE WHEN language = 'en' THEN 1 END) as english_templates,
        COUNT(CASE WHEN language = 'es' THEN 1 END) as spanish_templates,
        (SELECT COUNT(*) FROM polox.notifications n JOIN polox.notification_templates nt ON n.template_id = nt.id WHERE nt.company_id = $1) as total_notifications_sent,
        (SELECT COUNT(DISTINCT nt.id) FROM polox.notifications n JOIN polox.notification_templates nt ON n.template_id = nt.id WHERE nt.company_id = $1) as templates_used
      FROM polox.notification_templates 
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
   * Obtém templates mais utilizados
   * @param {number} companyId - ID da empresa
   * @param {number} limit - Limite de resultados
   * @returns {Promise<Array>} Templates mais utilizados
   */
  static async getMostUsed(companyId, limit = 10) {
    const mostUsedQuery = `
      SELECT 
        nt.*,
        COUNT(n.id) as usage_count,
        MAX(n.sent_at) as last_used_at,
        COUNT(CASE WHEN n.status = 'sent' THEN 1 END) as successful_sends,
        COUNT(CASE WHEN n.status = 'failed' THEN 1 END) as failed_sends
      FROM polox.notification_templates nt
      LEFT JOIN polox.notifications n ON nt.id = n.template_id
      WHERE nt.company_id = $1 AND nt.deleted_at IS NULL
      GROUP BY nt.id
      ORDER BY usage_count DESC, successful_sends DESC
      LIMIT $2
    `;

    try {
      const result = await query(mostUsedQuery, [companyId, limit], { companyId });
      return result.rows;
    } catch (error) {
      throw new ApiError(500, `Erro ao buscar templates mais utilizados: ${error.message}`);
    }
  }

  /**
   * Obtém templates por categoria
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Array>} Templates agrupados por categoria
   */
  static async getByCategory(companyId) {
    const categoryQuery = `
      SELECT 
        category,
        COUNT(*) as template_count,
        COUNT(CASE WHEN is_active = TRUE THEN 1 END) as active_count,
        COUNT(CASE WHEN channel = 'email' THEN 1 END) as email_count,
        COUNT(CASE WHEN channel = 'sms' THEN 1 END) as sms_count,
        COUNT(CASE WHEN channel = 'push' THEN 1 END) as push_count,
        (SELECT COUNT(*) FROM polox.notifications n JOIN polox.notification_templates nt2 ON n.template_id = nt2.id 
         WHERE nt2.category = nt.category AND nt2.company_id = $1) as total_usage
      FROM polox.notification_templates nt
      WHERE nt.company_id = $1 AND nt.deleted_at IS NULL
      GROUP BY category
      ORDER BY template_count DESC
    `;

    try {
      const result = await query(categoryQuery, [companyId], { companyId });
      return result.rows;
    } catch (error) {
      throw new ApiError(500, `Erro ao obter templates por categoria: ${error.message}`);
    }
  }

  /**
   * Ativa/desativa template
   * @param {number} id - ID do template
   * @param {boolean} isActive - Novo status
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object|null>} Template atualizado
   */
  static async toggleActive(id, isActive, companyId) {
    const updateQuery = `
      UPDATE polox.notification_templates 
      SET is_active = $3, updated_at = NOW()
      WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL
      RETURNING id, name, is_active, updated_at
    `;

    try {
      const result = await query(updateQuery, [id, companyId, isActive], { companyId });
      return result.rows[0] || null;
    } catch (error) {
      throw new ApiError(500, `Erro ao alterar status do template: ${error.message}`);
    }
  }

  /**
   * Soft delete do template
   * @param {number} id - ID do template
   * @param {number} companyId - ID da empresa
   * @returns {Promise<boolean>} True se deletado com sucesso
   */
  static async softDelete(id, companyId) {
    const updateQuery = `
      UPDATE polox.notification_templates 
      SET 
        is_active = FALSE,
        deleted_at = NOW(),
        updated_at = NOW()
      WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL
    `;

    try {
      const result = await query(updateQuery, [id, companyId], { companyId });
      return result.rowCount > 0;
    } catch (error) {
      throw new ApiError(500, `Erro ao deletar template: ${error.message}`);
    }
  }

  /**
   * Busca templates por canal
   * @param {string} channel - Canal de notificação
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Array>} Templates do canal
   */
  static async getByChannel(channel, companyId) {
    const selectQuery = `
      SELECT * FROM polox.notification_templates
      WHERE channel = $1 AND company_id = $2 AND is_active = TRUE AND deleted_at IS NULL
      ORDER BY name ASC
    `;

    try {
      const result = await query(selectQuery, [channel, companyId], { companyId });
      return result.rows;
    } catch (error) {
      throw new ApiError(500, `Erro ao buscar templates por canal: ${error.message}`);
    }
  }

  /**
   * Testa template com dados de exemplo
   * @param {number} id - ID do template
   * @param {Object} testData - Dados de teste
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object>} Template processado para teste
   */
  static async testTemplate(id, testData, companyId) {
    const template = await this.findById(id, companyId);
    
    if (!template) {
      throw new NotFoundError('Template não encontrado');
    }

    const validation = this.validateVariables(template, testData);
    const processed = this.processTemplate(template, testData);

    return {
      template: processed,
      validation,
      preview: {
        title: processed.title,
        content: processed.content,
        subject: processed.subject
      }
    };
  }
}

module.exports = NotificationTemplateModel;