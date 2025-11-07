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
 * Model para gerenciamento de contas financeiras
 * Baseado no schema polox.financial_accounts
 */
class FinancialAccountModel {
  /**
   * Cria uma nova conta financeira
   * @param {Object} accountData - Dados da conta
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object>} Conta criada
   */
  static async create(accountData, companyId) {
    const {
      name,
      type,
      bank_name,
      account_number,
      agency,
      current_balance = 0,
      initial_balance = 0,
      is_active = true,
      is_default = false,
      description
    } = accountData;

    // Validar dados obrigatórios
    if (!name) {
      throw new ValidationError('Nome da conta é obrigatório');
    }

    if (!type) {
      throw new ValidationError('Tipo da conta é obrigatório');
    }

    return await transaction(async (client) => {
      // Se esta conta for padrão, remover flag de outras contas
      if (is_default) {
        await client.query(
          'UPDATE polox.financial_accounts SET is_default = FALSE WHERE company_id = $1',
          [companyId]
        );
      }

      const insertQuery = `
        INSERT INTO polox.financial_accounts (
          company_id, name, type, bank_name, account_number, agency,
          current_balance, initial_balance, is_active, is_default, description,
          created_at, updated_at
        )
        VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10, $11,
          NOW(), NOW()
        )
        RETURNING 
          id, company_id, name, type, bank_name, account_number, agency,
          current_balance, initial_balance, is_active, is_default, description,
          created_at, updated_at
      `;

      const result = await client.query(insertQuery, [
        companyId, name, type, bank_name, account_number, agency,
        current_balance, initial_balance, is_active, is_default, description
      ]);

      return result.rows[0];
    }, { companyId });
  }

  /**
   * Busca conta por ID
   * @param {number} id - ID da conta
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object|null>} Conta encontrada ou null
   */
  static async findById(id, companyId) {
    const selectQuery = `
      SELECT 
        fa.*,
        (SELECT COUNT(*) FROM polox.financial_transactions WHERE account_id = fa.id) as transaction_count,
        (SELECT SUM(amount) FROM polox.financial_transactions WHERE account_id = fa.id AND type = 'income') as total_income,
        (SELECT SUM(amount) FROM polox.financial_transactions WHERE account_id = fa.id AND type = 'expense') as total_expense
      FROM polox.financial_accounts fa
      WHERE fa.id = $1 AND fa.company_id = $2 AND fa.deleted_at IS NULL
    `;

    try {
      const result = await query(selectQuery, [id, companyId], { companyId });
      return result.rows[0] || null;
    } catch (error) {
      throw new ApiError(500, `Erro ao buscar conta: ${error.message}`);
    }
  }

  /**
   * Lista contas com filtros e paginação
   * @param {Object} options - Opções de busca
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object>} Lista de contas e metadados
   */
  static async list(options = {}, companyId) {
    const {
      page = 1,
      limit = 10,
      type = null,
      is_active = null,
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

    if (is_active !== null) {
      conditions.push(`is_active = $${paramCount}`);
      values.push(is_active);
      paramCount++;
    }

    if (search) {
      conditions.push(`(name ILIKE $${paramCount} OR bank_name ILIKE $${paramCount} OR account_number ILIKE $${paramCount})`);
      values.push(`%${search}%`);
      paramCount++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Query para contar total
    const countQuery = `
      SELECT COUNT(*) 
      FROM polox.financial_accounts 
      ${whereClause}
    `;

    // Query para buscar dados
    const selectQuery = `
      SELECT 
        id, name, type, bank_name, account_number, agency,
        current_balance, initial_balance, is_active, is_default,
        description, created_at, updated_at,
        (SELECT COUNT(*) FROM polox.financial_transactions WHERE account_id = polox.financial_accounts.id) as transaction_count
      FROM polox.financial_accounts
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
      throw new ApiError(500, `Erro ao listar contas: ${error.message}`);
    }
  }

  /**
   * Atualiza dados da conta
   * @param {number} id - ID da conta
   * @param {Object} updateData - Dados para atualizar
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object|null>} Conta atualizada ou null
   */
  static async update(id, updateData, companyId) {
    const allowedFields = [
      'name', 'type', 'bank_name', 'account_number', 'agency',
      'is_active', 'is_default', 'description'
    ];

    return await transaction(async (client) => {
      // Se esta conta for padrão, remover flag de outras contas
      if (updateData.is_default === true) {
        await client.query(
          'UPDATE polox.financial_accounts SET is_default = FALSE WHERE company_id = $1 AND id != $2',
          [companyId, id]
        );
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
        UPDATE polox.financial_accounts 
        SET ${updates.join(', ')}
        WHERE id = $${paramCount} AND company_id = $${paramCount + 1} AND deleted_at IS NULL
        RETURNING 
          id, name, type, bank_name, current_balance, is_active, is_default,
          created_at, updated_at
      `;

      const result = await client.query(updateQuery, values);
      return result.rows[0] || null;
    }, { companyId });
  }

  /**
   * Atualiza saldo da conta
   * @param {number} id - ID da conta
   * @param {number} amount - Valor a ser alterado (positivo ou negativo)
   * @param {string} operation - Operação: 'add', 'subtract', 'set'
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object|null>} Conta atualizada
   */
  static async updateBalance(id, amount, operation = 'add', companyId) {
    let updateExpression;
    
    switch (operation) {
      case 'add':
        updateExpression = 'current_balance = current_balance + $1';
        break;
      case 'subtract':
        updateExpression = 'current_balance = current_balance - $1';
        break;
      case 'set':
      default:
        updateExpression = 'current_balance = $1';
        break;
    }

    const updateQuery = `
      UPDATE polox.financial_accounts 
      SET ${updateExpression}, updated_at = NOW()
      WHERE id = $2 AND company_id = $3 AND deleted_at IS NULL
      RETURNING id, name, current_balance, updated_at
    `;

    try {
      const result = await query(updateQuery, [amount, id, companyId], { companyId });
      return result.rows[0] || null;
    } catch (error) {
      throw new ApiError(500, `Erro ao atualizar saldo: ${error.message}`);
    }
  }

  /**
   * Obtém conta padrão da empresa
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object|null>} Conta padrão ou null
   */
  static async getDefaultAccount(companyId) {
    const selectQuery = `
      SELECT * FROM polox.financial_accounts 
      WHERE company_id = $1 AND is_default = TRUE AND deleted_at IS NULL
    `;

    try {
      const result = await query(selectQuery, [companyId], { companyId });
      return result.rows[0] || null;
    } catch (error) {
      throw new ApiError(500, `Erro ao buscar conta padrão: ${error.message}`);
    }
  }

  /**
   * Define conta como padrão
   * @param {number} id - ID da conta
   * @param {number} companyId - ID da empresa
   * @returns {Promise<boolean>} True se definida como padrão
   */
  static async setAsDefault(id, companyId) {
    return await transaction(async (client) => {
      // Remover flag padrão de todas as contas
      await client.query(
        'UPDATE polox.financial_accounts SET is_default = FALSE WHERE company_id = $1',
        [companyId]
      );

      // Definir conta atual como padrão
      const result = await client.query(
        'UPDATE polox.financial_accounts SET is_default = TRUE, updated_at = NOW() WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL',
        [id, companyId]
      );

      return result.rowCount > 0;
    }, { companyId });
  }

  /**
   * Obtém relatório de saldos
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object>} Relatório de saldos
   */
  static async getBalanceReport(companyId) {
    const reportQuery = `
      SELECT 
        type,
        COUNT(*) as account_count,
        COALESCE(SUM(current_balance), 0) as total_balance,
        COALESCE(AVG(current_balance), 0) as average_balance
      FROM polox.financial_accounts 
      WHERE company_id = $1 AND deleted_at IS NULL AND is_active = TRUE
      GROUP BY type
      
      UNION ALL
      
      SELECT 
        'TOTAL' as type,
        COUNT(*) as account_count,
        COALESCE(SUM(current_balance), 0) as total_balance,
        COALESCE(AVG(current_balance), 0) as average_balance
      FROM polox.financial_accounts 
      WHERE company_id = $1 AND deleted_at IS NULL AND is_active = TRUE
    `;

    try {
      const result = await query(reportQuery, [companyId], { companyId });
      return result.rows;
    } catch (error) {
      throw new ApiError(500, `Erro ao gerar relatório de saldos: ${error.message}`);
    }
  }

  /**
   * Soft delete da conta
   * @param {number} id - ID da conta
   * @param {number} companyId - ID da empresa
   * @returns {Promise<boolean>} True se deletada com sucesso
   */
  static async softDelete(id, companyId) {
    // Verificar se há transações associadas
    const transactionCountQuery = `
      SELECT COUNT(*) FROM polox.financial_transactions 
      WHERE account_id = $1 AND deleted_at IS NULL
    `;

    try {
      const countResult = await query(transactionCountQuery, [id], { companyId });
      const transactionCount = parseInt(countResult.rows[0].count);

      if (transactionCount > 0) {
        throw new ValidationError('Não é possível deletar conta com transações associadas');
      }

      const updateQuery = `
        UPDATE polox.financial_accounts 
        SET 
          is_active = FALSE,
          deleted_at = NOW(),
          updated_at = NOW()
        WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL
      `;

      const result = await query(updateQuery, [id, companyId], { companyId });
      return result.rowCount > 0;
    } catch (error) {
      if (error instanceof ValidationError) throw error;
      throw new ApiError(500, `Erro ao deletar conta: ${error.message}`);
    }
  }

  /**
   * Obtém estatísticas das contas da empresa
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object>} Estatísticas das contas
   */
  static async getStats(companyId) {
    const statsQuery = `
      SELECT 
        COUNT(*) as total_accounts,
        COUNT(CASE WHEN is_active = TRUE THEN 1 END) as active_accounts,
        COUNT(CASE WHEN is_active = FALSE THEN 1 END) as inactive_accounts,
        COUNT(CASE WHEN type = 'checking' THEN 1 END) as checking_accounts,
        COUNT(CASE WHEN type = 'savings' THEN 1 END) as savings_accounts,
        COUNT(CASE WHEN type = 'credit' THEN 1 END) as credit_accounts,
        COUNT(CASE WHEN type = 'cash' THEN 1 END) as cash_accounts,
        COALESCE(SUM(CASE WHEN is_active = TRUE THEN current_balance ELSE 0 END), 0) as total_active_balance,
        COALESCE(SUM(current_balance), 0) as total_balance,
        COALESCE(AVG(current_balance), 0) as average_balance,
        COUNT(CASE WHEN current_balance > 0 THEN 1 END) as positive_balance_accounts,
        COUNT(CASE WHEN current_balance < 0 THEN 1 END) as negative_balance_accounts
      FROM polox.financial_accounts 
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
   * Obtém histórico de movimentação da conta
   * @param {number} accountId - ID da conta
   * @param {number} companyId - ID da empresa
   * @param {Object} options - Opções de paginação e filtros
   * @returns {Promise<Object>} Histórico de transações
   */
  static async getTransactionHistory(accountId, companyId, options = {}) {
    const { page = 1, limit = 10, date_from, date_to } = options;
    const offset = (page - 1) * limit;

    const conditions = ['account_id = $1', 'ft.company_id = $2', 'ft.deleted_at IS NULL'];
    const values = [accountId, companyId];
    let paramCount = 3;

    if (date_from) {
      conditions.push(`transaction_date >= $${paramCount}`);
      values.push(date_from);
      paramCount++;
    }

    if (date_to) {
      conditions.push(`transaction_date <= $${paramCount}`);
      values.push(date_to);
      paramCount++;
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const transactionsQuery = `
      SELECT 
        ft.id, ft.type, ft.category, ft.amount, ft.description,
        ft.transaction_date, ft.status, ft.payment_method,
        ft.reference_document, ft.created_at,
        c.name as client_name,
        s.sale_number
      FROM polox.financial_transactions ft
      LEFT JOIN polox.clients c ON ft.client_id = c.id
      LEFT JOIN polox.sales s ON ft.sale_id = s.id
      ${whereClause}
      ORDER BY ft.transaction_date DESC, ft.created_at DESC
      LIMIT $${paramCount} OFFSET $${paramCount + 1}
    `;

    const countQuery = `
      SELECT COUNT(*) 
      FROM polox.financial_transactions ft
      ${whereClause}
    `;

    try {
      const [transactionsResult, countResult] = await Promise.all([
        query(transactionsQuery, [...values, limit, offset], { companyId }),
        query(countQuery, values, { companyId })
      ]);

      const total = parseInt(countResult.rows[0].count);
      const totalPages = Math.ceil(total / limit);

      return {
        data: transactionsResult.rows,
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
      throw new ApiError(500, `Erro ao buscar histórico de transações: ${error.message}`);
    }
  }
}

module.exports = FinancialAccountModel;