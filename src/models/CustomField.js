/**
 * Model para gerenciamento de Campos Customizados (Definições)
 * Tabela: polox.custom_fields
 * 
 * Sistema EAV (Entity-Attribute-Value):
 * Esta classe gerencia a DEFINIÇÃO dos campos customizados (o "Atributo").
 * 
 * Responsabilidades:
 * - CRUD de definições de campos
 * - Validação de tipos de campos
 * - Multi-tenant (company_id)
 * - Polimorfismo (entity_type)
 * 
 * Tipos Suportados:
 * - text: Linha única (varchar)
 * - textarea: Múltiplas linhas (text)
 * - numeric: Números (15,2)
 * - url: URLs
 * - options: Dropdown (array JSON)
 * - date: Data/Hora
 * - checkbox: Booleano
 * 
 * Entidades Suportadas:
 * - lead
 * - client
 * - product
 * - sale
 * - ticket
 * - event
 * - supplier
 * - financial_transaction
 * - (qualquer outra entidade futura)
 */

const { query } = require('../config/database');
const { ApiError, ValidationError, NotFoundError, ConflictError } = require('../utils/errors');

class CustomField {
  // Tipos de campos válidos
  static FIELD_TYPES = ['text', 'textarea', 'numeric', 'url', 'options', 'date', 'checkbox'];

  // Entidades válidas (pode expandir conforme necessário)
  static ENTITY_TYPES = [
    'lead',
    'client',
    'product',
    'sale',
    'ticket',
    'event',
    'supplier',
    'financial_transaction'
  ];

  /**
   * Busca uma definição de campo por ID
   * @param {number} id - ID do campo
   * @returns {Promise<Object|null>} Definição do campo ou null
   */
  static async findById(id) {
    try {
      const sql = 'SELECT * FROM polox.custom_fields WHERE id = $1';
      const result = await query(sql, [id]);
      return result.rows[0] || null;
    } catch (error) {
      throw new ApiError(`Erro ao buscar campo customizado: ${error.message}`, 500);
    }
  }

  /**
   * Busca todas as DEFINIÇÕES de campos para uma empresa e entidade
   * Inclui campos globais (company_id = NULL)
   * 
   * Usado em:
   * - Tela de configurações (admin)
   * - Renderização dinâmica do formulário (frontend)
   * 
   * @param {number} companyId - ID da empresa
   * @param {string} entityType - Tipo da entidade ('lead', 'client', etc.)
   * @returns {Promise<Array>} Array de definições de campos
   */
  static async findByCompanyAndEntity(companyId, entityType) {
    try {
      // Validar entity_type
      if (!this.ENTITY_TYPES.includes(entityType)) {
        throw new ValidationError(`Tipo de entidade inválido: ${entityType}`);
      }

      const sql = `
        SELECT * FROM polox.custom_fields
        WHERE (company_id = $1 OR company_id IS NULL)
          AND entity_type = $2
        ORDER BY sort_order ASC, name ASC
      `;
      
      const result = await query(sql, [companyId, entityType]);
      return result.rows;
    } catch (error) {
      if (error instanceof ValidationError) throw error;
      throw new ApiError(`Erro ao buscar campos customizados: ${error.message}`, 500);
    }
  }

  /**
   * Busca todos os campos de uma empresa (todas as entidades)
   * Usado na tela de administração de campos
   * 
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Array>} Array de definições de campos
   */
  static async findByCompany(companyId) {
    try {
      const sql = `
        SELECT * FROM polox.custom_fields
        WHERE company_id = $1
        ORDER BY entity_type ASC, sort_order ASC, name ASC
      `;
      
      const result = await query(sql, [companyId]);
      return result.rows;
    } catch (error) {
      throw new ApiError(`Erro ao buscar campos da empresa: ${error.message}`, 500);
    }
  }

  /**
   * Cria uma nova definição de campo
   * 
   * @param {Object} fieldData - Dados do campo
   * @param {number} fieldData.companyId - ID da empresa (NULL para campo global)
   * @param {string} fieldData.entityType - Tipo da entidade
   * @param {string} fieldData.name - Nome/Label do campo
   * @param {string} fieldData.fieldType - Tipo do campo
   * @param {Array|null} fieldData.options - Array de opções (apenas para type='options')
   * @param {boolean} fieldData.isRequired - Se o campo é obrigatório
   * @param {number} fieldData.sortOrder - Ordem de exibição
   * @returns {Promise<Object>} Definição do campo criado
   */
  static async create(fieldData) {
    const {
      companyId,
      entityType,
      name,
      fieldType,
      options = null,
      isRequired = false,
      sortOrder = 0
    } = fieldData;

    try {
      // Validações
      if (!entityType || !name || !fieldType) {
        throw new ValidationError('entity_type, name e field_type são obrigatórios');
      }

      if (!this.ENTITY_TYPES.includes(entityType)) {
        throw new ValidationError(`Tipo de entidade inválido: ${entityType}`);
      }

      if (!this.FIELD_TYPES.includes(fieldType)) {
        throw new ValidationError(
          `Tipo de campo inválido: ${fieldType}. Tipos válidos: ${this.FIELD_TYPES.join(', ')}`
        );
      }

      // Se o tipo for 'options', options é obrigatório
      if (fieldType === 'options' && (!options || !Array.isArray(options) || options.length === 0)) {
        throw new ValidationError('Campo do tipo "options" requer um array de opções não vazio');
      }

      // Se não for 'options', options deve ser null
      if (fieldType !== 'options' && options !== null) {
        throw new ValidationError(`Campo do tipo "${fieldType}" não aceita opções`);
      }

      const sql = `
        INSERT INTO polox.custom_fields (
          company_id, entity_type, name, field_type, options, is_required, sort_order
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `;

      const values = [
        companyId,
        entityType,
        name,
        fieldType,
        options ? JSON.stringify(options) : null,
        isRequired,
        sortOrder
      ];

      const result = await query(sql, values);
      return result.rows[0];
    } catch (error) {
      if (error instanceof ValidationError) throw error;

      // Violação de constraint UNIQUE (company_id, entity_type, name)
      if (error.code === '23505') {
        throw new ConflictError(
          `Já existe um campo "${name}" para ${entityType} nesta empresa`
        );
      }

      // Violação de FK (company_id não existe)
      if (error.code === '23503') {
        throw new ValidationError('Empresa inválida');
      }

      throw new ApiError(`Erro ao criar campo customizado: ${error.message}`, 500);
    }
  }

  /**
   * Atualiza uma definição de campo
   * 
   * @param {number} id - ID do campo
   * @param {number} companyId - ID da empresa (para validação de ownership)
   * @param {Object} fieldData - Dados a atualizar
   * @returns {Promise<Object>} Definição do campo atualizado
   */
  static async update(id, companyId, fieldData) {
    const { name, fieldType, options, isRequired, sortOrder } = fieldData;

    try {
      // Verificar se o campo existe e pertence à empresa
      const existing = await this.findById(id);
      if (!existing) {
        throw new NotFoundError('Campo customizado não encontrado');
      }

      if (existing.company_id !== companyId) {
        throw new ValidationError('Você não tem permissão para editar este campo');
      }

      // Validações
      if (fieldType && !this.FIELD_TYPES.includes(fieldType)) {
        throw new ValidationError(`Tipo de campo inválido: ${fieldType}`);
      }

      if (fieldType === 'options' && (!options || !Array.isArray(options) || options.length === 0)) {
        throw new ValidationError('Campo do tipo "options" requer um array de opções não vazio');
      }

      const sql = `
        UPDATE polox.custom_fields
        SET 
          name = COALESCE($1, name),
          field_type = COALESCE($2, field_type),
          options = COALESCE($3, options),
          is_required = COALESCE($4, is_required),
          sort_order = COALESCE($5, sort_order),
          updated_at = NOW()
        WHERE id = $6 AND company_id = $7
        RETURNING *
      `;

      const values = [
        name || null,
        fieldType || null,
        options ? JSON.stringify(options) : null,
        isRequired !== undefined ? isRequired : null,
        sortOrder !== undefined ? sortOrder : null,
        id,
        companyId
      ];

      const result = await query(sql, values);
      
      if (result.rowCount === 0) {
        throw new NotFoundError('Campo customizado não encontrado');
      }

      return result.rows[0];
    } catch (error) {
      if (error instanceof ValidationError || error instanceof NotFoundError) throw error;

      // Violação de constraint UNIQUE
      if (error.code === '23505') {
        throw new ConflictError('Já existe um campo com este nome para esta entidade');
      }

      throw new ApiError(`Erro ao atualizar campo customizado: ${error.message}`, 500);
    }
  }

  /**
   * Deleta uma definição de campo
   * ON DELETE CASCADE cuidará dos valores automaticamente
   * 
   * @param {number} id - ID do campo
   * @param {number} companyId - ID da empresa (para validação de ownership)
   * @returns {Promise<boolean>} true se deletado com sucesso
   */
  static async delete(id, companyId) {
    try {
      // Verificar se o campo existe e pertence à empresa
      const existing = await this.findById(id);
      if (!existing) {
        throw new NotFoundError('Campo customizado não encontrado');
      }

      // Campos globais (company_id = NULL) não podem ser deletados por empresas
      if (existing.company_id === null) {
        throw new ValidationError('Campos globais não podem ser deletados');
      }

      if (existing.company_id !== companyId) {
        throw new ValidationError('Você não tem permissão para deletar este campo');
      }

      const sql = `
        DELETE FROM polox.custom_fields
        WHERE id = $1 AND company_id = $2
      `;

      const result = await query(sql, [id, companyId]);
      
      if (result.rowCount === 0) {
        throw new NotFoundError('Campo customizado não encontrado');
      }

      return true;
    } catch (error) {
      if (error instanceof ValidationError || error instanceof NotFoundError) throw error;
      throw new ApiError(`Erro ao deletar campo customizado: ${error.message}`, 500);
    }
  }

  /**
   * Reordena campos de uma entidade
   * Atualiza sort_order de múltiplos campos em uma transação
   * 
   * @param {number} companyId - ID da empresa
   * @param {string} entityType - Tipo da entidade
   * @param {Array} fieldOrders - Array de { id, sortOrder }
   * @returns {Promise<boolean>} true se reordenado com sucesso
   */
  static async reorder(companyId, entityType, fieldOrders) {
    try {
      if (!Array.isArray(fieldOrders) || fieldOrders.length === 0) {
        throw new ValidationError('Array de campos é obrigatório');
      }

      // Atualizar cada campo (poderia usar transaction para atomicidade)
      for (const { id, sortOrder } of fieldOrders) {
        await this.update(id, companyId, { sortOrder });
      }

      return true;
    } catch (error) {
      if (error instanceof ValidationError) throw error;
      throw new ApiError(`Erro ao reordenar campos: ${error.message}`, 500);
    }
  }
}

module.exports = CustomField;
