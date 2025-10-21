const { query, beginTransaction, commit, rollback } = require('../models/database');
const { ApiError, asyncHandler } = require('../utils/errors');
const { successResponse, paginatedResponse } = require('../utils/formatters');
const Joi = require('joi');
const { v4: uuidv4 } = require('uuid');

class FinanceController {

  // Schemas de validação
  static createTransactionSchema = Joi.object({
    type: Joi.string().valid('income', 'expense').required()
      .messages({
        'any.required': 'Tipo da transação é obrigatório',
        'any.only': 'Tipo deve ser "income" (receita) ou "expense" (despesa)'
      }),
    amount: Joi.number().positive().required()
      .messages({
        'any.required': 'Valor é obrigatório',
        'number.positive': 'Valor deve ser maior que zero'
      }),
    description: Joi.string().max(255).required()
      .messages({
        'any.required': 'Descrição é obrigatória',
        'string.max': 'Descrição não pode exceder 255 caracteres'
      }),
    category_id: Joi.number().integer().positive(),
    category_name: Joi.string().max(100),
    payment_method: Joi.string().max(100).allow(''),
    reference_id: Joi.string(),
    reference_type: Joi.string().valid('sale', 'purchase', 'invoice', 'manual').default('manual'),
    due_date: Joi.date(),
    paid_date: Joi.date(),
    status: Joi.string().valid('pending', 'paid', 'overdue', 'cancelled').default('pending'),
    recurring: Joi.boolean().default(false),
    recurring_frequency: Joi.string().valid('monthly', 'yearly'),
    tags: Joi.array().items(Joi.string()).default([]),
    notes: Joi.string().max(1000).allow('')
  });

  static updateTransactionSchema = Joi.object({
    type: Joi.string().valid('income', 'expense'),
    amount: Joi.number().positive(),
    description: Joi.string().max(255),
    category_id: Joi.number().integer().positive(),
    category_name: Joi.string().max(100),
    payment_method: Joi.string().max(100).allow(''),
    reference_id: Joi.string(),
    reference_type: Joi.string().valid('sale', 'purchase', 'invoice', 'manual'),
    due_date: Joi.date(),
    paid_date: Joi.date(),
    status: Joi.string().valid('pending', 'paid', 'overdue', 'cancelled'),
    recurring: Joi.boolean(),
    recurring_frequency: Joi.string().valid('monthly', 'yearly'),
    tags: Joi.array().items(Joi.string()),
    notes: Joi.string().max(1000).allow('')
  });

  static createCategorySchema = Joi.object({
    name: Joi.string().min(2).max(100).required()
      .messages({
        'any.required': 'Nome da categoria é obrigatório'
      }),
    description: Joi.string().max(255).allow('').default(''),
    type: Joi.string().valid('income', 'expense', 'both').default('both'),
    parent_id: Joi.number().integer().positive(),
    is_active: Joi.boolean().default(true)
  });

  // Dashboard financeiro
  static getDashboard = asyncHandler(async (req, res) => {
    const { period = 'month' } = req.query;
    
    let dateFilter;
    switch (period) {
      case 'week':
        dateFilter = "AND ft.created_at >= DATE_TRUNC('week', CURRENT_DATE)";
        break;
      case 'month':
        dateFilter = "AND ft.created_at >= DATE_TRUNC('month', CURRENT_DATE)";
        break;
      case 'quarter':
        dateFilter = "AND ft.created_at >= DATE_TRUNC('quarter', CURRENT_DATE)";
        break;
      case 'year':
        dateFilter = "AND ft.created_at >= DATE_TRUNC('year', CURRENT_DATE)";
        break;
      default:
        dateFilter = "AND ft.created_at >= DATE_TRUNC('month', CURRENT_DATE)";
    }

    // Receitas e despesas do período
    const summaryQuery = `
      SELECT 
        SUM(CASE WHEN type = 'income' AND status = 'paid' THEN amount ELSE 0 END) as total_income,
        SUM(CASE WHEN type = 'expense' AND status = 'paid' THEN amount ELSE 0 END) as total_expenses,
        SUM(CASE WHEN type = 'income' AND status = 'pending' THEN amount ELSE 0 END) as pending_income,
        SUM(CASE WHEN type = 'expense' AND status = 'pending' THEN amount ELSE 0 END) as pending_expenses,
        SUM(CASE WHEN type = 'income' AND status = 'overdue' THEN amount ELSE 0 END) as overdue_income,
        SUM(CASE WHEN type = 'expense' AND status = 'overdue' THEN amount ELSE 0 END) as overdue_expenses,
        COUNT(CASE WHEN type = 'income' THEN 1 END) as income_count,
        COUNT(CASE WHEN type = 'expense' THEN 1 END) as expense_count
      FROM financial_transactions ft
      WHERE ft.company_id = $1 AND ft.deleted_at IS NULL ${dateFilter}
    `;

    // Evolução mensal (últimos 12 meses)
    const evolutionQuery = `
      SELECT 
        DATE_TRUNC('month', ft.created_at) as month,
        SUM(CASE WHEN type = 'income' AND status = 'paid' THEN amount ELSE 0 END) as income,
        SUM(CASE WHEN type = 'expense' AND status = 'paid' THEN amount ELSE 0 END) as expenses
      FROM financial_transactions ft
      WHERE ft.company_id = $1 AND ft.deleted_at IS NULL 
      AND ft.created_at >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '11 months')
      GROUP BY DATE_TRUNC('month', ft.created_at)
      ORDER BY month ASC
    `;

    // Top categorias de despesas
    const topExpensesQuery = `
      SELECT 
        COALESCE(fc.name, 'Sem categoria') as category_name,
        SUM(ft.amount) as total_amount,
        COUNT(*) as transaction_count,
        AVG(ft.amount) as avg_amount
      FROM financial_transactions ft
      LEFT JOIN financial_categories fc ON ft.category_id = fc.id AND fc.company_id = ft.company_id
      WHERE ft.company_id = $1 AND ft.type = 'expense' 
      AND ft.status = 'paid' AND ft.deleted_at IS NULL ${dateFilter}
      GROUP BY fc.name
      ORDER BY total_amount DESC
      LIMIT 10
    `;

    // Contas a receber/pagar próximas
    const upcomingQuery = `
      SELECT 
        ft.id,
        ft.type,
        ft.amount,
        ft.description,
        ft.due_date,
        fc.name as category_name,
        CASE 
          WHEN ft.due_date < CURRENT_DATE THEN 'overdue'
          WHEN ft.due_date <= CURRENT_DATE + INTERVAL '7 days' THEN 'due_soon'
          WHEN ft.due_date <= CURRENT_DATE + INTERVAL '30 days' THEN 'due_month'
          ELSE 'scheduled'
        END as urgency
      FROM financial_transactions ft
      LEFT JOIN financial_categories fc ON ft.category_id = fc.id
      WHERE ft.company_id = $1 AND ft.status = 'pending' 
      AND ft.deleted_at IS NULL AND ft.due_date IS NOT NULL
      ORDER BY ft.due_date ASC
      LIMIT 20
    `;

    // Fluxo de caixa dos próximos 30 dias
    const cashFlowQuery = `
      SELECT 
        DATE(ft.due_date) as date,
        SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as expected_income,
        SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as expected_expenses
      FROM financial_transactions ft
      WHERE ft.company_id = $1 AND ft.status = 'pending' 
      AND ft.deleted_at IS NULL AND ft.due_date IS NOT NULL
      AND ft.due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'
      GROUP BY DATE(ft.due_date)
      ORDER BY date ASC
    `;

    const [summaryResult, evolutionResult, topExpensesResult, upcomingResult, cashFlowResult] = await Promise.all([
      query(summaryQuery, [req.user.company.id]),
      query(evolutionQuery, [req.user.company.id]),
      query(topExpensesQuery, [req.user.company.id]),
      query(upcomingQuery, [req.user.company.id]),
      query(cashFlowQuery, [req.user.company.id])
    ]);

    const summary = summaryResult.rows[0];
    const totalIncome = parseFloat(summary.total_income || 0);
    const totalExpenses = parseFloat(summary.total_expenses || 0);
    const netIncome = totalIncome - totalExpenses;
    const profitMargin = totalIncome > 0 
      ? ((netIncome / totalIncome) * 100).toFixed(2)
      : 0;

    return res.status(200).json({
      success: true,
      data: {
        period,
        summary: {
          total_income: totalIncome,
          total_expenses: totalExpenses,
          net_income: netIncome,
          profit_margin: parseFloat(profitMargin),
          pending_income: parseFloat(summary.pending_income || 0),
          pending_expenses: parseFloat(summary.pending_expenses || 0),
          overdue_income: parseFloat(summary.overdue_income || 0),
          overdue_expenses: parseFloat(summary.overdue_expenses || 0),
          income_count: parseInt(summary.income_count || 0),
          expense_count: parseInt(summary.expense_count || 0)
        },
        evolution: evolutionResult.rows.map(row => ({
          month: row.month,
          income: parseFloat(row.income || 0),
          expenses: parseFloat(row.expenses || 0),
          net: parseFloat(row.income || 0) - parseFloat(row.expenses || 0)
        })),
        top_expense_categories: topExpensesResult.rows.map(row => ({
          ...row,
          total_amount: parseFloat(row.total_amount),
          avg_amount: parseFloat(row.avg_amount)
        })),
        upcoming_transactions: upcomingResult.rows.map(row => ({
          ...row,
          amount: parseFloat(row.amount)
        })),
        cash_flow_forecast: cashFlowResult.rows.map(row => ({
          date: row.date,
          expected_income: parseFloat(row.expected_income || 0),
          expected_expenses: parseFloat(row.expected_expenses || 0),
          net_flow: parseFloat(row.expected_income || 0) - parseFloat(row.expected_expenses || 0)
        }))
      }
    });
  });

  // Listar transações
  static getTransactions = asyncHandler(async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = (page - 1) * limit;
    
    let whereClause = 'WHERE ft.company_id = $1 AND ft.deleted_at IS NULL';
    let queryParams = [req.user.company.id];
    let paramCount = 1;

    // Filtros
    if (req.query.type) {
      whereClause += ` AND ft.type = $${++paramCount}`;
      queryParams.push(req.query.type);
    }

    if (req.query.status) {
      whereClause += ` AND ft.status = $${++paramCount}`;
      queryParams.push(req.query.status);
    }

    if (req.query.category_id) {
      whereClause += ` AND ft.category_id = $${++paramCount}`;
      queryParams.push(parseInt(req.query.category_id));
    }

    if (req.query.date_from) {
      whereClause += ` AND ft.created_at >= $${++paramCount}`;
      queryParams.push(req.query.date_from);
    }

    if (req.query.date_to) {
      whereClause += ` AND ft.created_at <= $${++paramCount}`;
      queryParams.push(req.query.date_to);
    }

    if (req.query.search) {
      whereClause += ` AND (ft.description ILIKE $${++paramCount} OR ft.notes ILIKE $${++paramCount})`;
      const searchTerm = `%${req.query.search}%`;
      queryParams.push(searchTerm, searchTerm);
      paramCount++;
    }

    // Ordenação
    const validSortFields = ['created_at', 'amount', 'due_date', 'description'];
    const sortField = validSortFields.includes(req.query.sort) ? req.query.sort : 'created_at';
    const sortOrder = req.query.order === 'asc' ? 'ASC' : 'DESC';

    // Query principal
    const transactionsQuery = `
      SELECT 
        ft.*,
        fc.name as category_name,
        u.name as created_by_name
      FROM financial_transactions ft
      LEFT JOIN financial_categories fc ON ft.category_id = fc.id AND fc.company_id = ft.company_id
      LEFT JOIN users u ON ft.created_by = u.id
      ${whereClause}
      ORDER BY ft.${sortField} ${sortOrder}
      LIMIT $${++paramCount} OFFSET $${++paramCount}
    `;
    
    queryParams.push(limit, offset);

    // Query de contagem
    const countQuery = `SELECT COUNT(*) as total FROM financial_transactions ft ${whereClause}`;

    // Query de totais dos filtros aplicados
    const totalsQuery = `
      SELECT 
        SUM(CASE WHEN ft.type = 'income' THEN ft.amount ELSE 0 END) as total_income,
        SUM(CASE WHEN ft.type = 'expense' THEN ft.amount ELSE 0 END) as total_expenses
      FROM financial_transactions ft ${whereClause}
    `;

    const [transactionsResult, countResult, totalsResult] = await Promise.all([
      query(transactionsQuery, queryParams),
      query(countQuery, queryParams.slice(0, -2)),
      query(totalsQuery, queryParams.slice(0, -2))
    ]);

    const totals = totalsResult.rows[0];

    return res.status(200).json({
      success: true,
      data: transactionsResult.rows.map(transaction => ({
        ...transaction,
        amount: parseFloat(transaction.amount)
      })),
      pagination: {
        page,
        limit,
        total: parseInt(countResult.rows[0].total),
        pages: Math.ceil(parseInt(countResult.rows[0].total) / limit)
      },
      totals: {
        income: parseFloat(totals.total_income || 0),
        expenses: parseFloat(totals.total_expenses || 0),
        net: parseFloat(totals.total_income || 0) - parseFloat(totals.total_expenses || 0)
      }
    });
  });

  // Criar transação
  static createTransaction = asyncHandler(async (req, res) => {
    const { error, value } = FinanceController.createTransactionSchema.validate(req.body);
    if (error) throw new ApiError(400, error.details[0].message);

    const transactionData = value;
    const transactionId = uuidv4();

    const client = await beginTransaction();
    
    try {
      // Verificar/criar categoria se fornecida
      let categoryId = transactionData.category_id;
      
      if (transactionData.category_name && !categoryId) {
        const existingCategory = await client.query(
          'SELECT id FROM financial_categories WHERE name = $1 AND company_id = $2 AND deleted_at IS NULL',
          [transactionData.category_name, req.user.company.id]
        );

        if (existingCategory.rows.length > 0) {
          categoryId = existingCategory.rows[0].id;
        } else {
          // Criar nova categoria
          const newCategoryResult = await client.query(
            'INSERT INTO financial_categories (id, company_id, name, type, created_by) VALUES ($1, $2, $3, $4, $5) RETURNING id',
            [uuidv4(), req.user.company.id, transactionData.category_name, transactionData.type, req.user.id]
          );
          categoryId = newCategoryResult.rows[0].id;
        }
      }

      // Criar transação
      const createTransactionQuery = `
        INSERT INTO financial_transactions (
          id, company_id, type, amount, description, category_id,
          payment_method, reference_id, reference_type, due_date,
          paid_date, status, recurring, recurring_frequency,
          tags, notes, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        RETURNING *
      `;

      const newTransactionResult = await client.query(createTransactionQuery, [
        transactionId,
        req.user.company.id,
        transactionData.type,
        transactionData.amount,
        transactionData.description,
        categoryId,
        transactionData.payment_method,
        transactionData.reference_id,
        transactionData.reference_type,
        transactionData.due_date,
        transactionData.paid_date,
        transactionData.status,
        transactionData.recurring,
        transactionData.recurring_frequency,
        JSON.stringify(transactionData.tags),
        transactionData.notes,
        req.user.id
      ]);

      const newTransaction = newTransactionResult.rows[0];

      // Conceder XP/Coins por gestão financeira
      const xpReward = transactionData.type === 'income' ? 20 : 15;
      const coinReward = transactionData.type === 'income' ? 10 : 8;

      await client.query(`
        UPDATE user_gamification_profiles 
        SET total_xp = total_xp + $1, current_coins = current_coins + $2
        WHERE user_id = $3 AND company_id = $4
      `, [xpReward, coinReward, req.user.id, req.user.company.id]);

      // Registrar no histórico de gamificação
      await client.query(`
        INSERT INTO gamification_history (id, user_id, company_id, type, amount, reason, action_type)
        VALUES 
          ($1, $2, $3, 'xp', $4, $5, 'finance_transaction'),
          ($6, $2, $3, 'coins', $7, $5, 'finance_transaction')
      `, [
        uuidv4(),
        req.user.id, 
        req.user.company.id, 
        xpReward, 
        `Transação financeira: ${transactionData.type} R$ ${transactionData.amount}`,
        uuidv4(),
        coinReward
      ]);

      // Log de auditoria
      await client.query(`
        INSERT INTO audit_logs (id, user_id, company_id, action, entity_type, entity_id, description, ip_address)
        VALUES ($1, $2, $3, 'create', 'financial_transaction', $4, $5, $6)
      `, [
        uuidv4(),
        req.user.id,
        req.user.company.id,
        newTransaction.id,
        `Transação criada: ${transactionData.type} R$ ${transactionData.amount} - ${transactionData.description}`,
        req.ip
      ]);

      await commit(client);

      return res.status(201).json({
        success: true,
        data: {
          ...newTransaction,
          amount: parseFloat(newTransaction.amount)
        },
        message: 'Transação criada com sucesso'
      });

    } catch (error) {
      await rollback(client);
      throw error;
    }
  });

  // Atualizar transação
  static updateTransaction = asyncHandler(async (req, res) => {
    const transactionId = req.params.id;
    const { error, value } = FinanceController.updateTransactionSchema.validate(req.body);
    if (error) throw new ApiError(400, error.details[0].message);

    const updateData = value;

    // Verificar se transação existe
    const existingTransaction = await query(
      'SELECT * FROM financial_transactions WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL',
      [transactionId, req.user.company.id]
    );

    if (existingTransaction.rows.length === 0) {
      throw new ApiError(404, 'Transação não encontrada');
    }

    const transaction = existingTransaction.rows[0];

    const client = await beginTransaction();
    
    try {
      // Verificar/criar categoria se fornecida
      let categoryId = updateData.category_id || transaction.category_id;
      
      if (updateData.category_name && !updateData.category_id) {
        const existingCategory = await client.query(
          'SELECT id FROM financial_categories WHERE name = $1 AND company_id = $2 AND deleted_at IS NULL',
          [updateData.category_name, req.user.company.id]
        );

        if (existingCategory.rows.length > 0) {
          categoryId = existingCategory.rows[0].id;
        } else {
          // Criar nova categoria
          const newCategoryResult = await client.query(
            'INSERT INTO financial_categories (id, company_id, name, type, created_by) VALUES ($1, $2, $3, $4, $5) RETURNING id',
            [uuidv4(), req.user.company.id, updateData.category_name, updateData.type || transaction.type, req.user.id]
          );
          categoryId = newCategoryResult.rows[0].id;
        }
      }

      // Preparar dados para atualização
      const fieldsToUpdate = [];
      const values = [];
      let paramCount = 0;

      const updateableFields = {
        type: updateData.type,
        amount: updateData.amount,
        description: updateData.description,
        category_id: categoryId,
        payment_method: updateData.payment_method,
        reference_id: updateData.reference_id,
        reference_type: updateData.reference_type,
        due_date: updateData.due_date,
        paid_date: updateData.paid_date,
        status: updateData.status,
        recurring: updateData.recurring,
        recurring_frequency: updateData.recurring_frequency,
        tags: updateData.tags ? JSON.stringify(updateData.tags) : undefined,
        notes: updateData.notes
      };

      Object.entries(updateableFields).forEach(([field, value]) => {
        if (value !== undefined) {
          fieldsToUpdate.push(`${field} = $${++paramCount}`);
          values.push(value);
        }
      });

      if (fieldsToUpdate.length === 0) {
        throw new ApiError(400, 'Nenhum campo para atualizar');
      }

      // Adicionar campos de controle
      fieldsToUpdate.push(`updated_at = NOW()`);

      values.push(transactionId, req.user.company.id);

      const updateQuery = `
        UPDATE financial_transactions 
        SET ${fieldsToUpdate.join(', ')}
        WHERE id = $${++paramCount} AND company_id = $${++paramCount} AND deleted_at IS NULL
        RETURNING *
      `;

      const updatedTransactionResult = await client.query(updateQuery, values);
      const updatedTransaction = updatedTransactionResult.rows[0];

      // Log de auditoria
      await client.query(`
        INSERT INTO audit_logs (id, user_id, company_id, action, entity_type, entity_id, description, ip_address)
        VALUES ($1, $2, $3, 'update', 'financial_transaction', $4, $5, $6)
      `, [
        uuidv4(),
        req.user.id,
        req.user.company.id,
        updatedTransaction.id,
        `Transação atualizada: ${updatedTransaction.description}`,
        req.ip
      ]);

      await commit(client);

      return res.status(200).json({
        success: true,
        data: {
          ...updatedTransaction,
          amount: parseFloat(updatedTransaction.amount)
        },
        message: 'Transação atualizada com sucesso'
      });

    } catch (error) {
      await rollback(client);
      throw error;
    }
  });

  // Deletar transação
  static deleteTransaction = asyncHandler(async (req, res) => {
    const transactionId = req.params.id;

    // Verificar se transação existe
    const existingTransaction = await query(
      'SELECT * FROM financial_transactions WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL',
      [transactionId, req.user.company.id]
    );

    if (existingTransaction.rows.length === 0) {
      throw new ApiError(404, 'Transação não encontrada');
    }

    const transaction = existingTransaction.rows[0];

    const client = await beginTransaction();
    
    try {
      // Soft delete da transação
      await client.query(
        'UPDATE financial_transactions SET deleted_at = NOW() WHERE id = $1 AND company_id = $2',
        [transactionId, req.user.company.id]
      );

      // Log de auditoria
      await client.query(`
        INSERT INTO audit_logs (id, user_id, company_id, action, entity_type, entity_id, description, ip_address)
        VALUES ($1, $2, $3, 'delete', 'financial_transaction', $4, $5, $6)
      `, [
        uuidv4(),
        req.user.id,
        req.user.company.id,
        transactionId,
        `Transação deletada: ${transaction.description} - R$ ${transaction.amount}`,
        req.ip
      ]);

      await commit(client);

      return res.status(200).json({
        success: true,
        message: 'Transação deletada com sucesso'
      });

    } catch (error) {
      await rollback(client);
      throw error;
    }
  });

  // Fluxo de caixa
  static getCashFlow = asyncHandler(async (req, res) => {
    const { period = 30, include_pending = 'true' } = req.query;
    const days = Math.min(parseInt(period), 365);

    let cashFlowQuery = `
      SELECT 
        DATE(COALESCE(ft.paid_date, ft.due_date, ft.created_at)) as date,
        SUM(CASE WHEN ft.type = 'income' AND ft.status = 'paid' THEN ft.amount ELSE 0 END) as income,
        SUM(CASE WHEN ft.type = 'expense' AND ft.status = 'paid' THEN ft.amount ELSE 0 END) as expenses,
        SUM(CASE WHEN ft.type = 'income' AND ft.status = 'paid' THEN ft.amount ELSE 0 END) - 
        SUM(CASE WHEN ft.type = 'expense' AND ft.status = 'paid' THEN ft.amount ELSE 0 END) as net_flow
    `;

    if (include_pending === 'true') {
      cashFlowQuery += `,
        SUM(CASE WHEN ft.type = 'income' AND ft.status IN ('pending', 'overdue') THEN ft.amount ELSE 0 END) as pending_income,
        SUM(CASE WHEN ft.type = 'expense' AND ft.status IN ('pending', 'overdue') THEN ft.amount ELSE 0 END) as pending_expenses
      `;
    }

    cashFlowQuery += `
      FROM financial_transactions ft
      WHERE ft.company_id = $1 AND ft.deleted_at IS NULL
      AND COALESCE(ft.paid_date, ft.due_date, ft.created_at) >= CURRENT_DATE - INTERVAL '${days} days'
      AND COALESCE(ft.paid_date, ft.due_date, ft.created_at) <= CURRENT_DATE + INTERVAL '${days} days'
      GROUP BY DATE(COALESCE(ft.paid_date, ft.due_date, ft.created_at))
      ORDER BY date ASC
    `;

    const cashFlowResult = await query(cashFlowQuery, [req.user.company.id]);

    // Calcular saldo acumulado
    let accumulatedBalance = 0;
    const cashFlowData = cashFlowResult.rows.map(row => {
      const dayNetFlow = parseFloat(row.net_flow || 0);
      accumulatedBalance += dayNetFlow;
      
      const result = {
        date: row.date,
        income: parseFloat(row.income || 0),
        expenses: parseFloat(row.expenses || 0),
        net_flow: dayNetFlow,
        accumulated_balance: accumulatedBalance
      };

      if (include_pending === 'true') {
        result.pending_income = parseFloat(row.pending_income || 0);
        result.pending_expenses = parseFloat(row.pending_expenses || 0);
      }

      return result;
    });

    // Estatísticas do período
    const totalIncome = cashFlowData.reduce((sum, day) => sum + day.income, 0);
    const totalExpenses = cashFlowData.reduce((sum, day) => sum + day.expenses, 0);
    const totalNetFlow = totalIncome - totalExpenses;

    return res.status(200).json({
      success: true,
      data: {
        period: `${days} dias`,
        cash_flow: cashFlowData,
        summary: {
          total_income: totalIncome,
          total_expenses: totalExpenses,
          net_flow: totalNetFlow,
          final_balance: accumulatedBalance,
          avg_daily_income: cashFlowData.length > 0 ? totalIncome / cashFlowData.length : 0,
          avg_daily_expenses: cashFlowData.length > 0 ? totalExpenses / cashFlowData.length : 0
        }
      }
    });
  });

  // Listar categorias financeiras
  static getCategories = asyncHandler(async (req, res) => {
    const { type } = req.query;
    
    let whereClause = 'WHERE fc.company_id = $1 AND fc.deleted_at IS NULL';
    let queryParams = [req.user.company.id];
    
    if (type && ['income', 'expense'].includes(type)) {
      whereClause += ` AND (fc.type = $2 OR fc.type = 'both')`;
      queryParams.push(type);
    }

    const categoriesQuery = `
      SELECT 
        fc.*,
        COUNT(ft.id) as transaction_count,
        SUM(CASE WHEN ft.deleted_at IS NULL THEN ft.amount ELSE 0 END) as total_amount,
        u.name as created_by_name
      FROM financial_categories fc
      LEFT JOIN financial_transactions ft ON fc.id = ft.category_id AND ft.company_id = fc.company_id
      LEFT JOIN users u ON fc.created_by = u.id
      ${whereClause}
      GROUP BY fc.id, u.name
      ORDER BY fc.name ASC
    `;

    const categoriesResult = await query(categoriesQuery, queryParams);

    return res.status(200).json({
      success: true,
      data: categoriesResult.rows.map(category => ({
        ...category,
        total_amount: parseFloat(category.total_amount || 0)
      }))
    });
  });

  // Criar categoria financeira
  static createCategory = asyncHandler(async (req, res) => {
    const { error, value } = FinanceController.createCategorySchema.validate(req.body);
    if (error) throw new ApiError(400, error.details[0].message);

    const categoryData = value;

    // Verificar se categoria já existe
    const existingCategory = await query(
      'SELECT id FROM financial_categories WHERE name = $1 AND company_id = $2 AND deleted_at IS NULL',
      [categoryData.name, req.user.company.id]
    );

    if (existingCategory.rows.length > 0) {
      throw new ApiError(400, 'Categoria com este nome já existe');
    }

    const createCategoryQuery = `
      INSERT INTO financial_categories (
        id, company_id, name, description, type, parent_id, is_active, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;

    const newCategoryResult = await query(createCategoryQuery, [
      uuidv4(),
      req.user.company.id,
      categoryData.name,
      categoryData.description,
      categoryData.type,
      categoryData.parent_id,
      categoryData.is_active,
      req.user.id
    ]);

    const newCategory = newCategoryResult.rows[0];

    return res.status(201).json({
      success: true,
      data: newCategory,
      message: 'Categoria criada com sucesso'
    });
  });

  // DRE Simplificada (Demonstração de Resultado)
  static getProfitLoss = asyncHandler(async (req, res) => {
    const { period = 'month', year, month } = req.query;
    
    let dateFilter;
    let params = [req.user.company.id];
    
    if (year && month) {
      dateFilter = "AND EXTRACT(YEAR FROM ft.created_at) = $2 AND EXTRACT(MONTH FROM ft.created_at) = $3";
      params.push(parseInt(year), parseInt(month));
    } else {
      switch (period) {
        case 'week':
          dateFilter = "AND ft.created_at >= DATE_TRUNC('week', CURRENT_DATE)";
          break;
        case 'month':
          dateFilter = "AND ft.created_at >= DATE_TRUNC('month', CURRENT_DATE)";
          break;
        case 'quarter':
          dateFilter = "AND ft.created_at >= DATE_TRUNC('quarter', CURRENT_DATE)";
          break;
        case 'year':
          dateFilter = "AND ft.created_at >= DATE_TRUNC('year', CURRENT_DATE)";
          break;
        default:
          dateFilter = "AND ft.created_at >= DATE_TRUNC('month', CURRENT_DATE)";
      }
    }

    const dreQuery = `
      SELECT 
        fc.name as category_name,
        ft.type,
        SUM(CASE WHEN ft.status = 'paid' THEN ft.amount ELSE 0 END) as total_amount,
        COUNT(CASE WHEN ft.status = 'paid' THEN 1 END) as transaction_count
      FROM financial_transactions ft
      LEFT JOIN financial_categories fc ON ft.category_id = fc.id AND fc.company_id = ft.company_id
      WHERE ft.company_id = $1 AND ft.deleted_at IS NULL ${dateFilter}
      GROUP BY fc.name, ft.type
      ORDER BY ft.type, total_amount DESC
    `;

    const dreResult = await query(dreQuery, params);

    // Organizar dados por tipo
    const revenues = dreResult.rows
      .filter(row => row.type === 'income')
      .map(row => ({
        category: row.category_name || 'Sem categoria',
        amount: parseFloat(row.total_amount),
        transactions: parseInt(row.transaction_count)
      }));

    const expenses = dreResult.rows
      .filter(row => row.type === 'expense')
      .map(row => ({
        category: row.category_name || 'Sem categoria',
        amount: parseFloat(row.total_amount),
        transactions: parseInt(row.transaction_count)
      }));

    const totalRevenue = revenues.reduce((sum, item) => sum + item.amount, 0);
    const totalExpenses = expenses.reduce((sum, item) => sum + item.amount, 0);
    const grossProfit = totalRevenue - totalExpenses;
    const profitMargin = totalRevenue > 0 ? ((grossProfit / totalRevenue) * 100).toFixed(2) : 0;

    return res.status(200).json({
      success: true,
      data: {
        period: year && month ? `${month}/${year}` : period,
        revenues: {
          items: revenues,
          total: totalRevenue
        },
        expenses: {
          items: expenses,
          total: totalExpenses
        },
        summary: {
          gross_revenue: totalRevenue,
          total_expenses: totalExpenses,
          gross_profit: grossProfit,
          profit_margin_percent: parseFloat(profitMargin)
        }
      }
    });
  });
}

module.exports = FinanceController;