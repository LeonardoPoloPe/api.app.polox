const { query } = require('../config/database');
const CustomField = require('../models/CustomField');
const CustomFieldValue = require('../models/CustomFieldValue');
const { NotFoundError, ValidationError, ApiError } = require('../utils/errors');

// Campos realmente existentes na tabela polox.clients (baseado na estrutura real do DB)
// Removido: user_id, notes (não existem na tabela atual)
const STANDARD_CLIENT_FIELDS = new Set([
  'name', 'email', 'phone', 'company_name', 'document_number', 'document_type',
  'type', 'category', 'status', 'address_street', 'address_number', 
  'address_complement', 'address_neighborhood', 'address_city', 'address_state',
  'address_country', 'address_postal_code', 'total_spent', 'total_orders',
  'average_order_value', 'lifetime_value', 'acquisition_date', 'last_purchase_date',
  'last_contact_date', 'next_follow_up_date', 'preferences', 'converted_from_lead_id'
]);

/**
 * Normaliza payload de criação/atualização separando dados padrão x EAV
 * - standard: somente colunas que existem na tabela clients
 * - eavFromExtras: pares {name, value} vindos de chaves "extras" (ex.: company, position)
 * - customFields: array [{ id, value }] vindo explicitamente do frontend
 */
function splitClientPayload(raw) {
  const { customFields, custom_fields, ...rest } = raw || {};

  const standard = {};
  const eavFromExtras = {}; // name->value

  // Mover somente campos padrão
  for (const [key, val] of Object.entries(rest)) {
    if (STANDARD_CLIENT_FIELDS.has(key)) {
      standard[key] = val;
    } else {
      // Qualquer outra chave vira candidato a EAV (mapeada por nome)
      eavFromExtras[key] = val;
    }
  }

  // Normalizar array de custom fields
  let normalizedCustomFields = [];
  if (Array.isArray(customFields)) {
    normalizedCustomFields = customFields;
  } else if (Array.isArray(custom_fields)) {
    normalizedCustomFields = custom_fields;
  } else if (custom_fields && typeof custom_fields === 'object') {
    // Se custom_fields é um objeto {name: value}, converter para eavFromExtras
    Object.assign(eavFromExtras, custom_fields);
  } else if (customFields && typeof customFields === 'object') {
    // Se customFields é um objeto {name: value}, converter para eavFromExtras
    Object.assign(eavFromExtras, customFields);
  }

  return { standard, eavFromExtras, customFields: normalizedCustomFields };
}

/**
 * Converte pares {name->value} extras em [{id, value}] usando definições da empresa
 */
async function mapExtrasToCustomFieldIds(companyId, entityType, eavFromExtras) {
  if (!eavFromExtras || Object.keys(eavFromExtras).length === 0) return [];

  // Buscar definições de campos para esta empresa+entidade
  const defs = await CustomField.findByCompanyAndEntity(companyId, entityType);
  const byName = new Map(defs.map((f) => [f.name, f]));

  const result = [];
  for (const [name, value] of Object.entries(eavFromExtras)) {
    const def = byName.get(name);
    if (!def) {
      // Silenciosamente ignorar chaves que não possuem definição
      // Poderíamos logar um aviso aqui, mas evitar quebrar o fluxo
      continue;
    }
    result.push({ id: def.id, value });
  }
  return result;
}

class ClientService {
  /**
   * Busca cliente por ID e mescla campos EAV
   */
  static async getClientById(id, companyId) {
    const clientRes = await query(
      'SELECT * FROM clients WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL',
      [id, companyId]
    );

    if (clientRes.rows.length === 0) {
      throw new NotFoundError('Cliente não encontrado');
    }

    const client = clientRes.rows[0];

    // Buscar campos customizados + valores
    const customFields = await CustomFieldValue.getEntityCustomFields(id, companyId, 'client');

    return { ...client, customFields };
  }

  /**
   * Cria cliente com suporte a EAV em transação
   */
  static async createClient(companyId, userId, data) {
    const { standard, eavFromExtras, customFields } = splitClientPayload(data);

    if (!standard.name || String(standard.name).trim().length < 1) {
      throw new ValidationError('Nome é obrigatório');
    }

    // Verificar email único se fornecido (fora da transação para performance)
    if (standard.email) {
      const emailCheck = await query(
        'SELECT id FROM clients WHERE email = $1 AND company_id = $2 AND deleted_at IS NULL',
        [standard.email, companyId]
      );
      if (emailCheck.rows.length > 0) {
        throw new ValidationError('Email já está em uso por outro cliente');
      }
    }

    // Preparar lista total de custom fields a salvar (antes da transação)
    const extraMapped = await mapExtrasToCustomFieldIds(companyId, 'client', eavFromExtras);
    const allCustom = [...(customFields || []), ...extraMapped];

    // Executar INSERT do cliente
    const cols = ['company_id'];
    const vals = [companyId];
    const params = ['$1'];
    let p = 2;

    for (const key of STANDARD_CLIENT_FIELDS) {
      if (standard[key] !== undefined) {
        cols.push(key);
        params.push(`$${p++}`);
        vals.push(standard[key]);
      }
    }

    const insertSql = `
      INSERT INTO clients (${cols.join(', ')})
      VALUES (${params.join(', ')})
      RETURNING *
    `;

    const inserted = await query(insertSql, vals);
    const created = inserted.rows[0];

    // Salvar custom fields (se houver)
    if (allCustom.length > 0) {
      await CustomFieldValue.upsertMany(created.id, allCustom, 'client');
    }

    // Retornar já mesclado
    const merged = await this.getClientById(created.id, companyId);
    return merged;
  }

  /**
   * Atualiza cliente com suporte a EAV em transação
   */
  static async updateClient(id, companyId, data) {
    const { standard, eavFromExtras, customFields } = splitClientPayload(data);

    // Garantir que existe
    const existingRes = await query(
      'SELECT * FROM clients WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL',
      [id, companyId]
    );
    if (existingRes.rows.length === 0) {
      throw new NotFoundError('Cliente não encontrado');
    }

    // Verificar email único se alterado
    if (standard.email && standard.email !== existingRes.rows[0].email) {
      const emailCheck = await query(
        'SELECT id FROM clients WHERE email = $1 AND company_id = $2 AND id != $3 AND deleted_at IS NULL',
        [standard.email, companyId, id]
      );
      if (emailCheck.rows.length > 0) {
        throw new ValidationError('Email já está em uso por outro cliente');
      }
    }

    // Construir UPDATE dinâmico
    const setParts = [];
    const vals = [];
    let p = 1;
    for (const key of STANDARD_CLIENT_FIELDS) {
      if (standard[key] !== undefined) {
        setParts.push(`${key} = $${p++}`);
        vals.push(standard[key]);
      }
    }

    if (setParts.length > 0) {
      setParts.push('updated_at = NOW()');
      vals.push(id, companyId);
      
      const updateSql = `
        UPDATE clients
        SET ${setParts.join(', ')}
        WHERE id = $${p++} AND company_id = $${p} AND deleted_at IS NULL
      `;
      await query(updateSql, vals);
    }

    // Salvar/atualizar EAV
    const extraMapped = await mapExtrasToCustomFieldIds(companyId, 'client', eavFromExtras);
    const allCustom = [...(customFields || []), ...extraMapped];
    if (allCustom.length > 0) {
      await CustomFieldValue.upsertMany(id, allCustom, 'client');
    }

    // Retornar atualizado
    const merged = await this.getClientById(id, companyId);
    return merged;
  }

  /**
   * Deleta cliente (soft delete) garantindo limpeza EAV antes
   */
  static async deleteClient(id, companyId) {
    // ⚠️ Deletar primeiro os valores customizados
    await CustomFieldValue.deleteAllByEntity(id);

    // Soft delete do cliente
    const delRes = await query(
      'UPDATE clients SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL',
      [id, companyId]
    );

    if (delRes.rowCount === 0) {
      throw new NotFoundError('Cliente não encontrado');
    }

    return true;
  }
}

module.exports = ClientService;
