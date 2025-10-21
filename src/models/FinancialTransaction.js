const { query, transaction } = require('../config/database');
const { ApiError, ValidationError, NotFoundError } = require('../utils/errors');

/**
 * Model para gerenciamento de transações financeiras
 * Baseado no schema polox.financial_transactions
 */
class FinancialTransactionModel {
  /**
   * Cria uma nova transação financeira
   * @param {Object} transactionData - Dados da transação
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object>} Transação criada
   */
  static async create(transactionData, companyId) {
    const {
      account_id,
      type,
      category,
      amount,
      description,
      transaction_date = new Date(),
      status = 'completed',
      payment_method,
      client_id = null,
      sale_id = null,
      reference_document = null,
      tags = null,
      attachment_url = null,
      recurring_rule = null,
      parent_transaction_id = null
    } = transactionData;

    // Validar dados obrigatórios
    if (!account_id) {
      throw new ValidationError('ID da conta é obrigatório');
    }

    if (!type || !['income', 'expense', 'transfer'].includes(type)) {
      throw new ValidationError('Tipo da transação é obrigatório e deve ser: income, expense ou transfer');
    }

    if (!category) {
      throw new ValidationError('Categoria é obrigatória');
    }

    if (!amount || amount <= 0) {
      throw new ValidationError('Valor deve ser maior que zero');
    }

    return await transaction(async (client) => {
      // Verificar se a conta existe e pertence à empresa
      const accountCheck = await client.query(
        'SELECT id, current_balance FROM polox.financial_accounts WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL',
        [account_id, companyId]
      );

      if (accountCheck.rows.length === 0) {
        throw new NotFoundError('Conta financeira não encontrada');
      }

      // Criar a transação
      const insertQuery = `
        INSERT INTO polox.financial_transactions (
          company_id, account_id, type, category, amount, description,
          transaction_date, status, payment_method, client_id, sale_id,
          reference_document, tags, attachment_url, recurring_rule,
          parent_transaction_id, created_at, updated_at
        )
        VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10, $11,
          $12, $13, $14, $15,
          $16, NOW(), NOW()
        )
        RETURNING 
          id, company_id, account_id, type, category, amount, description,
          transaction_date, status, payment_method, client_id, sale_id,
          reference_document, tags, created_at, updated_at
      `;

      const transactionResult = await client.query(insertQuery, [
        companyId, account_id, type, category, amount, description,
        transaction_date, status, payment_method, client_id, sale_id,
        reference_document, tags, attachment_url, recurring_rule,
        parent_transaction_id
      ]);

      const newTransaction = transactionResult.rows[0];

      // Atualizar saldo da conta se a transação estiver confirmada
      if (status === 'completed') {
        const balanceChange = type === 'income' ? amount : -amount;
        await client.query(
          'UPDATE polox.financial_accounts SET current_balance = current_balance + $1, updated_at = NOW() WHERE id = $2',
          [balanceChange, account_id]
        );
      }

      return newTransaction;
    }, { companyId });
  }

  /**
   * Busca transação por ID
   * @param {number} id - ID da transação
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object|null>} Transação encontrada ou null
   */
  static async findById(id, companyId) {
    const selectQuery = `
      SELECT 
        ft.*,
        fa.name as account_name,
        fa.type as account_type,
        c.name as client_name,
        c.email as client_email,
        s.sale_number,
        s.total_amount as sale_total
      FROM polox.financial_transactions ft
      LEFT JOIN polox.financial_accounts fa ON ft.account_id = fa.id
      LEFT JOIN polox.clients c ON ft.client_id = c.id
      LEFT JOIN polox.sales s ON ft.sale_id = s.id
      WHERE ft.id = $1 AND ft.company_id = $2 AND ft.deleted_at IS NULL
    `;

    try {
      const result = await query(selectQuery, [id, companyId], { companyId });
      return result.rows[0] || null;
    } catch (error) {
      throw new ApiError(500, `Erro ao buscar transação: ${error.message}`);
    }
  }

  /**
   * Lista transações com filtros e paginação
   * @param {Object} options - Opções de busca
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object>} Lista de transações e metadados
   */
  static async list(options = {}, companyId) {
    const {
      page = 1,
      limit = 10,
      account_id = null,
      type = null,
      category = null,
      status = null,
      client_id = null,
      date_from = null,
      date_to = null,
      search = null,
      sortBy = 'transaction_date',
      sortOrder = 'DESC'
    } = options;

    const offset = (page - 1) * limit;
    const conditions = ['ft.company_id = $1', 'ft.deleted_at IS NULL'];
    const values = [companyId];
    let paramCount = 2;

    // Adicionar filtros
    if (account_id) {
      conditions.push(`ft.account_id = $${paramCount}`);
      values.push(account_id);
      paramCount++;
    }

    if (type) {
      conditions.push(`ft.type = $${paramCount}`);
      values.push(type);
      paramCount++;
    }

    if (category) {
      conditions.push(`ft.category = $${paramCount}`);
      values.push(category);
      paramCount++;
    }

    if (status) {
      conditions.push(`ft.status = $${paramCount}`);
      values.push(status);
      paramCount++;
    }

    if (client_id) {
      conditions.push(`ft.client_id = $${paramCount}`);
      values.push(client_id);
      paramCount++;
    }

    if (date_from) {
      conditions.push(`ft.transaction_date >= $${paramCount}`);
      values.push(date_from);
      paramCount++;
    }

    if (date_to) {
      conditions.push(`ft.transaction_date <= $${paramCount}`);
      values.push(date_to);
      paramCount++;
    }

    if (search) {
      conditions.push(`(ft.description ILIKE $${paramCount} OR ft.reference_document ILIKE $${paramCount} OR c.name ILIKE $${paramCount})`);
      values.push(`%${search}%`);
      paramCount++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Query para contar total
    const countQuery = `
      SELECT COUNT(*) 
      FROM polox.financial_transactions ft
      LEFT JOIN polox.clients c ON ft.client_id = c.id
      ${whereClause}
    `;

    // Query para buscar dados
    const selectQuery = `
      SELECT 
        ft.id, ft.type, ft.category, ft.amount, ft.description,
        ft.transaction_date, ft.status, ft.payment_method,
        ft.reference_document, ft.tags, ft.created_at,
        fa.name as account_name,
        c.name as client_name,
        s.sale_number
      FROM polox.financial_transactions ft
      LEFT JOIN polox.financial_accounts fa ON ft.account_id = fa.id
      LEFT JOIN polox.clients c ON ft.client_id = c.id
      LEFT JOIN polox.sales s ON ft.sale_id = s.id
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
      throw new ApiError(500, `Erro ao listar transações: ${error.message}`);
    }
  }

  /**
   * Atualiza dados da transação
   * @param {number} id - ID da transação
   * @param {Object} updateData - Dados para atualizar
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object|null>} Transação atualizada ou null
   */
  static async update(id, updateData, companyId) {
    const allowedFields = [
      'category', 'description', 'transaction_date', 'payment_method',
      'reference_document', 'tags', 'attachment_url'
    ];

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
      UPDATE polox.financial_transactions 
      SET ${updates.join(', ')}
      WHERE id = $${paramCount} AND company_id = $${paramCount + 1} AND deleted_at IS NULL
      RETURNING 
        id, type, category, amount, description, transaction_date,
        status, payment_method, created_at, updated_at
    `;

    try {
      const result = await query(updateQuery, values, { companyId });
      return result.rows[0] || null;
    } catch (error) {
      throw new ApiError(500, `Erro ao atualizar transação: ${error.message}`);
    }
  }

  /**
   * Confirma/cancela uma transação pendente
   * @param {number} id - ID da transação
   * @param {string} newStatus - Novo status ('completed', 'cancelled')
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object|null>} Transação atualizada
   */
  static async updateStatus(id, newStatus, companyId) {
    if (!['completed', 'cancelled', 'pending'].includes(newStatus)) {
      throw new ValidationError('Status deve ser: completed, cancelled ou pending');
    }

    return await transaction(async (client) => {
      // Buscar transação atual
      const currentTransaction = await client.query(
        'SELECT * FROM polox.financial_transactions WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL',
        [id, companyId]
      );

      if (currentTransaction.rows.length === 0) {
        throw new NotFoundError('Transação não encontrada');
      }

      const transaction_data = currentTransaction.rows[0];
      const oldStatus = transaction_data.status;

      // Atualizar status da transação
      const updateResult = await client.query(
        'UPDATE polox.financial_transactions SET status = $1, updated_at = NOW() WHERE id = $2 AND company_id = $3 RETURNING *',
        [newStatus, id, companyId]
      );

      // Atualizar saldo da conta baseado na mudança de status
      let balanceChange = 0;
      
      if (oldStatus === 'pending' && newStatus === 'completed') {
        // Transação foi confirmada - aplicar ao saldo
        balanceChange = transaction_data.type === 'income' ? transaction_data.amount : -transaction_data.amount;
      } else if (oldStatus === 'completed' && (newStatus === 'cancelled' || newStatus === 'pending')) {
        // Transação foi cancelada ou voltou para pendente - reverter do saldo
        balanceChange = transaction_data.type === 'income' ? -transaction_data.amount : transaction_data.amount;
      }

      if (balanceChange !== 0) {
        await client.query(
          'UPDATE polox.financial_accounts SET current_balance = current_balance + $1, updated_at = NOW() WHERE id = $2',
          [balanceChange, transaction_data.account_id]
        );
      }

      return updateResult.rows[0];
    }, { companyId });
  }

  /**
   * Cria transação recorrente
   * @param {number} parentTransactionId - ID da transação pai
   * @param {Object} recurringData - Dados da recorrência
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object>} Transação recorrente criada
   */
  static async createRecurring(parentTransactionId, recurringData, companyId) {
    const { next_date, occurrences = 1 } = recurringData;

    if (!next_date) {
      throw new ValidationError('Data da próxima ocorrência é obrigatória');
    }

    // Buscar transação pai
    const parentTransaction = await this.findById(parentTransactionId, companyId);
    if (!parentTransaction) {
      throw new NotFoundError('Transação pai não encontrada');
    }

    // Criar nova transação baseada na pai
    const newTransactionData = {
      account_id: parentTransaction.account_id,
      type: parentTransaction.type,
      category: parentTransaction.category,
      amount: parentTransaction.amount,
      description: `${parentTransaction.description} (Recorrente)`,
      transaction_date: next_date,
      status: 'pending',
      payment_method: parentTransaction.payment_method,
      client_id: parentTransaction.client_id,
      parent_transaction_id: parentTransactionId,
      recurring_rule: parentTransaction.recurring_rule
    };

    return await this.create(newTransactionData, companyId);
  }

  /**
   * Obtém resumo financeiro por período
   * @param {Object} options - Opções de período e filtros
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object>} Resumo financeiro
   */
  static async getFinancialSummary(options = {}, companyId) {
    const {
      date_from = null,
      date_to = null,
      account_id = null,
      category = null
    } = options;

    const conditions = ['company_id = $1', 'deleted_at IS NULL', 'status = \'completed\''];
    const values = [companyId];
    let paramCount = 2;

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

    if (account_id) {
      conditions.push(`account_id = $${paramCount}`);
      values.push(account_id);
      paramCount++;
    }

    if (category) {
      conditions.push(`category = $${paramCount}`);
      values.push(category);
      paramCount++;
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const summaryQuery = `
      SELECT 
        COUNT(*) as total_transactions,
        COUNT(CASE WHEN type = 'income' THEN 1 END) as income_count,
        COUNT(CASE WHEN type = 'expense' THEN 1 END) as expense_count,
        COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as total_income,
        COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as total_expense,
        COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END), 0) as net_result,
        COALESCE(AVG(CASE WHEN type = 'income' THEN amount END), 0) as avg_income,
        COALESCE(AVG(CASE WHEN type = 'expense' THEN amount END), 0) as avg_expense
      FROM polox.financial_transactions 
      ${whereClause}
    `;

    try {
      const result = await query(summaryQuery, values, { companyId });
      return result.rows[0];
    } catch (error) {
      throw new ApiError(500, `Erro ao gerar resumo financeiro: ${error.message}`);
    }
  }

  /**
   * Obtém transações por categoria
   * @param {Object} options - Opções de período e filtros
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Array>} Transações agrupadas por categoria
   */
  static async getByCategory(options = {}, companyId) {
    const {
      date_from = null,
      date_to = null,
      type = null
    } = options;

    const conditions = ['company_id = $1', 'deleted_at IS NULL', 'status = \'completed\''];
    const values = [companyId];
    let paramCount = 2;

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

    if (type) {
      conditions.push(`type = $${paramCount}`);
      values.push(type);
      paramCount++;
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const categoryQuery = `
      SELECT 
        category,
        type,
        COUNT(*) as transaction_count,
        COALESCE(SUM(amount), 0) as total_amount,
        COALESCE(AVG(amount), 0) as average_amount,
        MIN(amount) as min_amount,
        MAX(amount) as max_amount
      FROM polox.financial_transactions 
      ${whereClause}
      GROUP BY category, type
      ORDER BY total_amount DESC
    `;

    try {
      const result = await query(categoryQuery, values, { companyId });
      return result.rows;
    } catch (error) {
      throw new ApiError(500, `Erro ao obter transações por categoria: ${error.message}`);
    }
  }

  /**
   * Obtém fluxo de caixa por período
   * @param {Object} options - Opções de período
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Array>} Fluxo de caixa agrupado por data
   */
  static async getCashFlow(options = {}, companyId) {
    const {
      date_from = null,
      date_to = null,
      interval = 'day' // day, week, month, year
    } = options;

    const conditions = ['company_id = $1', 'deleted_at IS NULL', 'status = \'completed\''];
    const values = [companyId];
    let paramCount = 2;

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

    let dateGrouping;
    switch (interval) {
      case 'week':
        dateGrouping = "DATE_TRUNC('week', transaction_date)";
        break;
      case 'month':
        dateGrouping = "DATE_TRUNC('month', transaction_date)";
        break;
      case 'year':
        dateGrouping = "DATE_TRUNC('year', transaction_date)";
        break;
      case 'day':
      default:
        dateGrouping = "DATE_TRUNC('day', transaction_date)";
        break;
    }

    const cashFlowQuery = `
      SELECT 
        ${dateGrouping} as period,
        COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as income,
        COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as expense,
        COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END), 0) as net_flow,
        COUNT(*) as transaction_count
      FROM polox.financial_transactions 
      ${whereClause}
      GROUP BY ${dateGrouping}
      ORDER BY period ASC
    `;

    try {
      const result = await query(cashFlowQuery, values, { companyId });
      return result.rows;
    } catch (error) {
      throw new ApiError(500, `Erro ao obter fluxo de caixa: ${error.message}`);
    }
  }

  /**
   * Soft delete da transação
   * @param {number} id - ID da transação
   * @param {number} companyId - ID da empresa
   * @returns {Promise<boolean>} True se deletada com sucesso
   */
  static async softDelete(id, companyId) {
    return await transaction(async (client) => {
      // Buscar transação atual
      const currentTransaction = await client.query(
        'SELECT * FROM polox.financial_transactions WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL',
        [id, companyId]
      );

      if (currentTransaction.rows.length === 0) {
        return false;
      }

      const transaction_data = currentTransaction.rows[0];

      // Se a transação estava confirmada, reverter do saldo
      if (transaction_data.status === 'completed') {
        const balanceChange = transaction_data.type === 'income' ? -transaction_data.amount : transaction_data.amount;
        await client.query(
          'UPDATE polox.financial_accounts SET current_balance = current_balance + $1, updated_at = NOW() WHERE id = $2',
          [balanceChange, transaction_data.account_id]
        );
      }

      // Soft delete da transação
      const deleteResult = await client.query(
        'UPDATE polox.financial_transactions SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1 AND company_id = $2',
        [id, companyId]
      );

      return deleteResult.rowCount > 0;
    }, { companyId });
  }

  /**
   * Obtém estatísticas das transações da empresa
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object>} Estatísticas das transações
   */
  static async getStats(companyId) {
    const statsQuery = `
      SELECT 
        COUNT(*) as total_transactions,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_transactions,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_transactions,
        COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_transactions,
        COUNT(CASE WHEN type = 'income' THEN 1 END) as income_transactions,
        COUNT(CASE WHEN type = 'expense' THEN 1 END) as expense_transactions,
        COUNT(CASE WHEN type = 'transfer' THEN 1 END) as transfer_transactions,
        COALESCE(SUM(CASE WHEN type = 'income' AND status = 'completed' THEN amount ELSE 0 END), 0) as total_income,
        COALESCE(SUM(CASE WHEN type = 'expense' AND status = 'completed' THEN amount ELSE 0 END), 0) as total_expense,
        COALESCE(AVG(CASE WHEN type = 'income' AND status = 'completed' THEN amount END), 0) as avg_income,
        COALESCE(AVG(CASE WHEN type = 'expense' AND status = 'completed' THEN amount END), 0) as avg_expense,
        COUNT(DISTINCT account_id) as accounts_with_transactions,
        COUNT(DISTINCT client_id) as clients_with_transactions
      FROM polox.financial_transactions 
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
   * Busca transações recorrentes pendentes
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Array>} Transações recorrentes que devem ser criadas
   */
  static async findPendingRecurring(companyId) {
    const recurringQuery = `
      SELECT * FROM polox.financial_transactions 
      WHERE company_id = $1 
        AND deleted_at IS NULL 
        AND recurring_rule IS NOT NULL 
        AND parent_transaction_id IS NULL
        AND status = 'completed'
    `;

    try {
      const result = await query(recurringQuery, [companyId], { companyId });
      return result.rows;
    } catch (error) {
      throw new ApiError(500, `Erro ao buscar transações recorrentes: ${error.message}`);
    }
  }
}

module.exports = FinancialTransactionModel;