/**
 * Model para gerenciamento de Valores de Campos Customizados
 * Tabela: polox.custom_field_values
 * 
 * Sistema EAV (Entity-Attribute-Value):
 * Esta classe gerencia os VALORES preenchidos pelos usuários (o "Valor").
 * 
 * Responsabilidades:
 * - CRUD de valores de campos customizados
 * - UPSERT (INSERT ou UPDATE) de valores
 * - Limpeza de valores órfãos
 * - Manutenção da integridade referencial da aplicação
 * 
 * ✅ INTEGRIDADE REFERENCIAL (Migration 031):
 * A partir de 24/10/2025, a limpeza de valores órfãos é AUTOMÁTICA via Database Triggers!
 * 
 * Quando uma entidade é deletada (client, lead, product, etc.), o trigger 
 * polox.cleanup_custom_field_values() deleta automaticamente os valores relacionados.
 * 
 * Triggers criados:
 * - trg_clients_cleanup_custom_values
 * - trg_leads_cleanup_custom_values
 * - trg_products_cleanup_custom_values
 * - trg_sales_cleanup_custom_values
 * - trg_tickets_cleanup_custom_values
 * - trg_events_cleanup_custom_values
 * - trg_suppliers_cleanup_custom_values
 * - trg_financial_transactions_cleanup_custom_values
 * 
 * ⚠️ RESPONSABILIDADE DA APLICAÇÃO (Ainda Recomendado):
 * Embora os triggers garantam a limpeza, é recomendado AINDA chamar
 * deleteAllByEntity(entityId) nos serviços para:
 * 1. Manter compatibilidade com código existente
 * 2. Ter controle explícito sobre a limpeza
 * 3. Permitir logging/auditoria da operação
 * 
 * Exemplo:
 * ```javascript
 * // Em leadService.deleteLead(id):
 * await CustomFieldValue.deleteAllByEntity(id); // Explícito (recomendado)
 * await Lead.delete(id); // Trigger também fará a limpeza (fallback)
 * ```
 * 
 * Colunas de Valor:
 * - text_value: Para 'text', 'textarea', 'url', 'options'
 * - numeric_value: Para 'numeric'
 * - date_value: Para 'date'
 * - boolean_value: Para 'checkbox'
 */

const { query, transaction } = require('../config/database');
const { ApiError, ValidationError, NotFoundError } = require('../utils/errors');
const CustomField = require('./CustomField');

class CustomFieldValue {
  /**
   * Busca todos os valores para uma entidade específica
   * Usado ao carregar um Lead, Client, etc.
   * 
   * Retorna apenas os valores brutos. Para obter valores + definições,
   * use getEntityCustomFields()
   * 
   * @param {number} entityId - ID da entidade (lead_id, client_id, etc.)
   * @returns {Promise<Array>} Array de valores
   */
  static async findAllByEntity(entityId) {
    try {
      const sql = 'SELECT * FROM polox.custom_field_values WHERE entity_id = $1';
      const result = await query(sql, [entityId]);
      return result.rows;
    } catch (error) {
      throw new ApiError(`Erro ao buscar valores customizados: ${error.message}`, 500);
    }
  }

  /**
   * Busca um valor específico por custom_field_id e entity_id
   * 
   * @param {number} customFieldId - ID da definição do campo
   * @param {number} entityId - ID da entidade
   * @returns {Promise<Object|null>} Valor ou null
   */
  static async findOne(customFieldId, entityId) {
    try {
      const sql = `
        SELECT * FROM polox.custom_field_values
        WHERE custom_field_id = $1 AND entity_id = $2
      `;
      const result = await query(sql, [customFieldId, entityId]);
      return result.rows[0] || null;
    } catch (error) {
      throw new ApiError(`Erro ao buscar valor customizado: ${error.message}`, 500);
    }
  }

  /**
   * Busca valores + definições para uma entidade
   * Faz JOIN com custom_fields para retornar dados completos
   * 
   * Usado no GET /api/leads/:id, GET /api/clients/:id, etc.
   * 
   * @param {number} entityId - ID da entidade
   * @param {number} companyId - ID da empresa
   * @param {string} entityType - Tipo da entidade ('lead', 'client', etc.)
   * @returns {Promise<Array>} Array de { field definition + value }
   */
  static async getEntityCustomFields(entityId, companyId, entityType) {
    try {
      // Buscar todas as definições de campos para esta entidade
      const fields = await CustomField.findByCompanyAndEntity(companyId, entityType);

      // Buscar todos os valores preenchidos para esta entidade
      const values = await this.findAllByEntity(entityId);

      // Criar mapa de valores para acesso rápido
      const valueMap = new Map();
      values.forEach(v => {
        valueMap.set(v.custom_field_id, v);
      });

      // Merge: definições + valores
      return fields.map(field => {
        const value = valueMap.get(field.id);
        
        // Determinar qual coluna de valor usar baseado no field_type
        let extractedValue = null;
        if (value) {
          switch (field.field_type) {
            case 'text':
            case 'textarea':
            case 'url':
            case 'options':
              extractedValue = value.text_value;
              break;
            case 'numeric':
              extractedValue = value.numeric_value;
              break;
            case 'date':
              extractedValue = value.date_value;
              break;
            case 'checkbox':
              extractedValue = value.boolean_value;
              break;
          }
        }

        return {
          id: field.id,
          name: field.field_name,
          field_type: field.field_type,
          options: field.field_options,
          is_required: field.is_required,
          sort_order: field.sort_order,
          value: extractedValue,
          value_id: value ? value.id : null // ID do valor (para UPDATE)
        };
      });
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(`Erro ao buscar campos customizados da entidade: ${error.message}`, 500);
    }
  }

  /**
   * Salva/Atualiza um valor (UPSERT)
   * Esta é a função principal de salvamento
   * 
   * IMPORTANTE: valueData deve conter apenas UMA coluna preenchida:
   * - { text_value: 'valor', numeric_value: null, date_value: null, boolean_value: null }
   * 
   * @param {number} customFieldId - ID da definição do campo
   * @param {number} entityId - ID da entidade
   * @param {Object} valueData - Dados do valor
   * @param {string|null} valueData.text_value - Valor de texto
   * @param {number|null} valueData.numeric_value - Valor numérico
   * @param {Date|null} valueData.date_value - Valor de data
   * @param {boolean|null} valueData.boolean_value - Valor booleano
   * @returns {Promise<Object>} Valor salvo
   */
  static async upsert(customFieldId, entityId, valueData) {
    try {
      // Validar que o campo customizado existe
      const field = await CustomField.findById(customFieldId);
      if (!field) {
        throw new ValidationError('Campo customizado não encontrado');
      }

      const sql = `
        INSERT INTO polox.custom_field_values (
          custom_field_id,
          entity_id,
          text_value,
          numeric_value,
          date_value,
          boolean_value,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
        ON CONFLICT (custom_field_id, entity_id)
        DO UPDATE SET
          text_value = EXCLUDED.text_value,
          numeric_value = EXCLUDED.numeric_value,
          date_value = EXCLUDED.date_value,
          boolean_value = EXCLUDED.boolean_value,
          updated_at = NOW()
        RETURNING *
      `;

      const values = [
        customFieldId,
        entityId,
        valueData.text_value || null,
        valueData.numeric_value || null,
        valueData.date_value || null,
        valueData.boolean_value || null
      ];

      const result = await query(sql, values);
      return result.rows[0];
    } catch (error) {
      if (error instanceof ValidationError) throw error;

      // Violação de FK (custom_field_id não existe)
      if (error.code === '23503') {
        throw new ValidationError('Campo customizado inválido');
      }

      throw new ApiError(`Erro ao salvar valor customizado: ${error.message}`, 500);
    }
  }

  /**
   * Salva múltiplos valores de uma vez (usado no create/update de entidade)
   * 
   * @param {number} entityId - ID da entidade
   * @param {Array} customFields - Array de { id (field_id), value }
   * @param {string} entityType - Tipo da entidade (para validação)
   * @returns {Promise<Array>} Array de valores salvos
   */
  static async upsertMany(entityId, customFields, entityType) {
    if (!Array.isArray(customFields) || customFields.length === 0) {
      return [];
    }

    const results = [];

    try {
      for (const { id, value } of customFields) {
        // Buscar a definição do campo para saber o tipo
        const field = await CustomField.findById(id);
        
        if (!field) {
          console.warn(`Campo customizado ${id} não encontrado, pulando...`);
          continue;
        }

        // Validar que o campo é da entidade correta
        if (field.entity_type !== entityType) {
          console.warn(`Campo ${id} não é do tipo ${entityType}, pulando...`);
          continue;
        }

        // Se value é null ou undefined, deletar o valor existente
        if (value === null || value === undefined || value === '') {
          await this.deleteOne(id, entityId);
          continue;
        }

        // Determinar qual coluna preencher baseado no field_type
        const valueData = {
          text_value: null,
          numeric_value: null,
          date_value: null,
          boolean_value: null
        };

        switch (field.field_type) {
          case 'text':
          case 'textarea':
          case 'url':
          case 'options':
            valueData.text_value = String(value);
            break;
          case 'numeric':
            valueData.numeric_value = parseFloat(value);
            if (isNaN(valueData.numeric_value)) {
              throw new ValidationError(`Valor numérico inválido para campo "${field.field_name}"`);
            }
            break;
          case 'date':
            valueData.date_value = new Date(value);
            if (isNaN(valueData.date_value.getTime())) {
              throw new ValidationError(`Data inválida para campo "${field.field_name}"`);
            }
            break;
          case 'checkbox':
            valueData.boolean_value = Boolean(value);
            break;
        }

        const result = await this.upsert(id, entityId, valueData);
        results.push(result);
      }

      return results;
    } catch (error) {
      if (error instanceof ValidationError) throw error;
      throw new ApiError(`Erro ao salvar valores customizados: ${error.message}`, 500);
    }
  }

  /**
   * Deleta um valor específico
   * 
   * @param {number} customFieldId - ID da definição do campo
   * @param {number} entityId - ID da entidade
   * @returns {Promise<boolean>} true se deletado com sucesso
   */
  static async deleteOne(customFieldId, entityId) {
    try {
      const sql = `
        DELETE FROM polox.custom_field_values
        WHERE custom_field_id = $1 AND entity_id = $2
      `;
      
      await query(sql, [customFieldId, entityId]);
      return true;
    } catch (error) {
      throw new ApiError(`Erro ao deletar valor customizado: ${error.message}`, 500);
    }
  }

  /**
   * Deleta todos os valores de uma entidade
   * 
   * ✅ NOTA (Migration 031): Esta função ainda é útil para:
   * 1. Limpeza explícita antes de delete (defensiva)
   * 2. Logging/auditoria da operação
   * 3. Garantir compatibilidade com código existente
   * 
   * PORÉM: A partir de 24/10/2025, se você esquecer de chamar esta função,
   * o trigger polox.cleanup_custom_field_values() fará a limpeza automaticamente!
   * 
   * Uso recomendado:
   * ```javascript
   * // Em leadService.deleteLead(id):
   * await CustomFieldValue.deleteAllByEntity(id); // Explícito (recomendado)
   * await Lead.delete(id); // Trigger também fará limpeza (fallback)
   * ```
   * 
   * @param {number} entityId - ID da entidade
   * @returns {Promise<number>} Número de valores deletados
   */
  static async deleteAllByEntity(entityId) {
    try {
      const sql = 'DELETE FROM polox.custom_field_values WHERE entity_id = $1';
      const result = await query(sql, [entityId]);
      
      console.log(`🗑️ Deletados ${result.rowCount} valores customizados da entidade ${entityId}`);
      
      return result.rowCount;
    } catch (error) {
      throw new ApiError(`Erro ao deletar valores customizados da entidade: ${error.message}`, 500);
    }
  }

  /**
   * Deleta todos os valores de múltiplas entidades
   * Usado para limpeza em massa (ex: deletar todos os leads de uma empresa)
   * 
   * @param {Array<number>} entityIds - Array de IDs das entidades
   * @returns {Promise<number>} Número de valores deletados
   */
  static async deleteAllByEntities(entityIds) {
    if (!Array.isArray(entityIds) || entityIds.length === 0) {
      return 0;
    }

    try {
      const placeholders = entityIds.map((_, i) => `$${i + 1}`).join(', ');
      const sql = `DELETE FROM polox.custom_field_values WHERE entity_id IN (${placeholders})`;
      
      const result = await query(sql, entityIds);
      
      console.log(`🗑️ Deletados ${result.rowCount} valores customizados de ${entityIds.length} entidades`);
      
      return result.rowCount;
    } catch (error) {
      throw new ApiError(`Erro ao deletar valores customizados em massa: ${error.message}`, 500);
    }
  }
}

module.exports = CustomFieldValue;
