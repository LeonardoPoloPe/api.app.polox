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

const express = require('express');
const FinanceController = require('../controllers/FinanceController');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Middleware de autenticação para todas as rotas
router.use(authMiddleware);

/**
 * @swagger
 * components:
 *   schemas:
 *     FinancialTransaction:
 *       type: object
 *       required:
 *         - type
 *         - amount
 *         - description
 *       properties:
 *         id:
 *           type: string
 *           description: ID único da transação (gerado automaticamente)
 *           example: "550e8400-e29b-41d4-a716-446655440000"
 *         type:
 *           type: string
 *           enum: [income, expense]
 *           description: |
 *             Tipo da transação:
 *             - **income**: Receita/Entrada de dinheiro
 *             - **expense**: Despesa/Saída de dinheiro
 *           example: "income"
 *         amount:
 *           type: number
 *           minimum: 0.01
 *           description: Valor da transação em reais (R$)
 *           example: 1500.50
 *         description:
 *           type: string
 *           maxLength: 255
 *           description: Descrição detalhada da transação
 *           example: "Venda de produto #1234 para cliente João Silva"
 *         category_id:
 *           type: string
 *           format: uuid
 *           description: ID da categoria existente (opcional se usar category_name)
 *           example: "60ddbaa2-407d-4c6a-ad6b-a2e57710a559"
 *         category_name:
 *           type: string
 *           maxLength: 100
 *           description: Nome da categoria (cria automaticamente se não existir)
 *           example: "Vendas de Produtos"
 *         payment_method:
 *           type: string
 *           maxLength: 100
 *           description: Forma de pagamento utilizada
 *           example: "Cartão de Crédito"
 *         reference_id:
 *           type: string
 *           description: ID de referência externa (ex: ID da venda, nota fiscal)
 *           example: "SALE-1234"
 *         reference_type:
 *           type: string
 *           enum: [sale, purchase, invoice, manual]
 *           default: manual
 *           description: Tipo de referência da transação
 *           example: "sale"
 *         due_date:
 *           type: string
 *           format: date
 *           description: Data de vencimento (para transações pendentes)
 *           example: "2025-12-25"
 *         paid_date:
 *           type: string
 *           format: date
 *           description: Data em que a transação foi paga/recebida
 *           example: "2025-11-16"
 *         status:
 *           type: string
 *           enum: [pending, paid, overdue, cancelled]
 *           default: pending
 *           description: |
 *             Status da transação:
 *             - **pending**: Aguardando pagamento/recebimento
 *             - **paid**: Pago/Recebido
 *             - **overdue**: Vencido (passou da data de vencimento)
 *             - **cancelled**: Cancelado
 *           example: "paid"
 *         recurring:
 *           type: boolean
 *           default: false
 *           description: Indica se é uma transação recorrente
 *           example: false
 *         recurring_frequency:
 *           type: string
 *           enum: [monthly, yearly]
 *           description: Frequência de recorrência (se recurring = true)
 *           example: "monthly"
 *         tags:
 *           type: array
 *           items:
 *             type: string
 *           description: Tags para organização e busca
 *           example: ["vendas", "online", "produto-digital"]
 *         notes:
 *           type: string
 *           maxLength: 1000
 *           description: Observações adicionais sobre a transação
 *           example: "Cliente solicitou parcelamento em 3x"
 *         company_id:
 *           type: integer
 *           description: ID da empresa (preenchido automaticamente)
 *           example: 1
 *         created_by:
 *           type: integer
 *           description: ID do usuário que criou (preenchido automaticamente)
 *           example: 5
 *         created_at:
 *           type: string
 *           format: date-time
 *           description: Data de criação
 *           example: "2025-11-16T10:00:00Z"
 *         updated_at:
 *           type: string
 *           format: date-time
 *           description: Data da última atualização
 *           example: "2025-11-16T10:00:00Z"
 *     FinancialCategory:
 *       type: object
 *       required:
 *         - name
 *       properties:
 *         id:
 *           type: integer
 *           description: ID único da categoria (gerado automaticamente)
 *           example: 1
 *         name:
 *           type: string
 *           minLength: 2
 *           maxLength: 100
 *           description: Nome da categoria
 *           example: "Vendas de Produtos"
 *         description:
 *           type: string
 *           maxLength: 255
 *           description: Descrição detalhada da categoria
 *           example: "Receitas provenientes da venda de produtos físicos e digitais"
 *         type:
 *           type: string
 *           enum: [income, expense, both]
 *           default: both
 *           description: |
 *             Tipo de transações aceitas pela categoria:
 *             - income: Apenas receitas (ex: Vendas, Serviços)
 *             - expense: Apenas despesas (ex: Aluguel, Fornecedores)
 *             - both: Receitas e despesas (ex: Ajustes, Transferências)
 *           example: "income"
 *         parent_id:
 *           type: string
 *           format: uuid
 *           description: ID da categoria pai para criar hierarquia/subcategorias
 *           example: null
 *         is_active:
 *           type: boolean
 *           default: true
 *           description: Indica se a categoria está ativa e disponível para uso
 *           example: true
 *         company_id:
 *           type: integer
 *           description: ID da empresa (preenchido automaticamente)
 *           example: 1
 *         created_at:
 *           type: string
 *           format: date-time
 *           description: Data de criação (gerado automaticamente)
 *           example: "2025-11-16T10:00:00Z"
 *         updated_at:
 *           type: string
 *           format: date-time
 *           description: Data da última atualização
 *           example: "2025-11-16T10:00:00Z"
 *       example:
 *         name: "Vendas de Produtos"
 *         description: "Receitas provenientes da venda de produtos físicos e digitais"
 *         type: "income"
 *         is_active: true
 *   tags:
 *     - name: Finance
 *       description: Gestão financeira e controle de fluxo de caixa
 */

/**
 * @swagger
 * /finance/dashboard:
 *   get:
 *     summary: Dashboard financeiro completo
 *     description: |
 *       Retorna visão geral completa das finanças com resumos, gráficos e indicadores.
 *       
 *       **Informações incluídas:**
 *       - Resumo de receitas e despesas do período
 *       - Lucro líquido e margem de lucro
 *       - Contas pendentes, vencidas e a vencer
 *       - Evolução mensal dos últimos 12 meses
 *       - Top 10 categorias de despesas
 *       - Próximas transações a receber/pagar
 *       - Previsão de fluxo de caixa (30 dias)
 *       
 *       **Exemplos de uso:**
 *       - Dashboard do mês: `GET /finance/dashboard?period=month`
 *       - Dashboard do ano: `GET /finance/dashboard?period=year`
 *     tags: [Finance]
 *     parameters:
 *       - $ref: '#/components/parameters/AcceptLanguage'
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [week, month, quarter, year]
 *           default: month
 *         description: |
 *           Período para análise:
 *           - **week**: Última semana
 *           - **month**: Último mês
 *           - **quarter**: Último trimestre
 *           - **year**: Último ano
 *         example: "month"
 *     responses:
 *       200:
 *         description: Dashboard retornado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     period:
 *                       type: string
 *                     summary:
 *                       type: object
 *                       properties:
 *                         total_income:
 *                           type: number
 *                         total_expenses:
 *                           type: number
 *                         net_income:
 *                           type: number
 *                         profit_margin:
 *                           type: number
 *                         pending_income:
 *                           type: number
 *                         pending_expenses:
 *                           type: number
 *                         overdue_income:
 *                           type: number
 *                         overdue_expenses:
 *                           type: number
 *                         income_count:
 *                           type: integer
 *                         expense_count:
 *                           type: integer
 *                     evolution:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           month:
 *                             type: string
 *                           income:
 *                             type: number
 *                           expenses:
 *                             type: number
 *                           net:
 *                             type: number
 *                     top_expense_categories:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           category_name:
 *                             type: string
 *                           total_amount:
 *                             type: number
 *                           transaction_count:
 *                             type: integer
 *                           avg_amount:
 *                             type: number
 *                     upcoming_transactions:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           type:
 *                             type: string
 *                           amount:
 *                             type: number
 *                           description:
 *                             type: string
 *                           due_date:
 *                             type: string
 *                           urgency:
 *                             type: string
 *                             enum: [overdue, due_soon, due_month, scheduled]
 *                     cash_flow_forecast:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           date:
 *                             type: string
 *                           expected_income:
 *                             type: number
 *                           expected_expenses:
 *                             type: number
 *                           net_flow:
 *                             type: number
 *             example:
 *               success: true
 *               data:
 *                 period: "month"
 *                 summary:
 *                   total_income: 45000.00
 *                   total_expenses: 28000.00
 *                   net_income: 17000.00
 *                   profit_margin: 37.78
 *                   pending_income: 12000.00
 *                   pending_expenses: 5000.00
 *                   overdue_income: 2000.00
 *                   overdue_expenses: 1500.00
 *                   income_count: 25
 *                   expense_count: 18
 *                 evolution:
 *                   - month: "2025-10-01T00:00:00Z"
 *                     income: 42000.00
 *                     expenses: 26000.00
 *                     net: 16000.00
 *                   - month: "2025-11-01T00:00:00Z"
 *                     income: 45000.00
 *                     expenses: 28000.00
 *                     net: 17000.00
 *                 top_expense_categories:
 *                   - category_name: "Salários"
 *                     total_amount: 15000.00
 *                     transaction_count: 5
 *                     avg_amount: 3000.00
 *                   - category_name: "Aluguel"
 *                     total_amount: 5000.00
 *                     transaction_count: 1
 *                     avg_amount: 5000.00
 *                 upcoming_transactions:
 *                   - id: "123"
 *                     type: "income"
 *                     amount: 3000.00
 *                     description: "Recebimento Cliente XYZ"
 *                     due_date: "2025-11-20"
 *                     urgency: "due_soon"
 *                 cash_flow_forecast:
 *                   - date: "2025-11-17"
 *                     expected_income: 5000.00
 *                     expected_expenses: 2000.00
 *                     net_flow: 3000.00
 *       401:
 *         description: Não autenticado
 */
router.get('/dashboard', FinanceController.getDashboard);

/**
 * @swagger
 * /finance/transactions:
 *   get:
 *     summary: Listar transações financeiras
 *     description: |
 *       Lista todas as transações financeiras com paginação e múltiplos filtros.
 *       
 *       **Exemplos de uso:**
 *       - Todas as transações: `GET /finance/transactions`
 *       - Apenas receitas: `GET /finance/transactions?type=income`
 *       - Despesas pagas: `GET /finance/transactions?type=expense&status=paid`
 *       - Buscar por descrição: `GET /finance/transactions?search=aluguel`
 *       - Filtrar por período: `GET /finance/transactions?date_from=2025-11-01&date_to=2025-11-30`
 *       - Combinar filtros: `GET /finance/transactions?type=expense&category_id=3&status=pending`
 *     tags: [Finance]
 *     parameters:
 *       - $ref: '#/components/parameters/AcceptLanguage'
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *           minimum: 1
 *         description: Número da página para paginação
 *         example: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           minimum: 1
 *           maximum: 100
 *         description: Quantidade de itens por página (máximo 100)
 *         example: 20
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [income, expense]
 *         description: Filtrar por tipo de transação
 *         example: "income"
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, paid, overdue, cancelled]
 *         description: Filtrar por status da transação
 *         example: "paid"
 *       - in: query
 *         name: category_id
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filtrar por ID da categoria
 *         example: "60ddbaa2-407d-4c6a-ad6b-a2e57710a559"
 *       - in: query
 *         name: date_from
 *         schema:
 *           type: string
 *           format: date
 *         description: Data inicial do filtro (formato YYYY-MM-DD)
 *         example: "2025-11-01"
 *       - in: query
 *         name: date_to
 *         schema:
 *           type: string
 *           format: date
 *         description: Data final do filtro (formato YYYY-MM-DD)
 *         example: "2025-11-30"
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Buscar texto na descrição das transações
 *         example: "aluguel"
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [created_at, amount, due_date, description]
 *           default: created_at
 *         description: Campo para ordenação
 *         example: "amount"
 *       - in: query
 *         name: order
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Ordem de classificação
 *         example: "desc"
 *     responses:
 *       200:
 *         description: Lista de transações retornada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/FinancialTransaction'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     total:
 *                       type: integer
 *                     total_pages:
 *                       type: integer
 *             example:
 *               success: true
 *               data:
 *                 - id: "123"
 *                   type: "income"
 *                   amount: 1500.50
 *                   description: "Venda produto #1234"
 *                   category_name: "Vendas"
 *                   payment_method: "Cartão de Crédito"
 *                   status: "paid"
 *                   paid_date: "2025-11-16"
 *                   created_at: "2025-11-16T10:00:00Z"
 *                 - id: "124"
 *                   type: "expense"
 *                   amount: 500.00
 *                   description: "Aluguel novembro"
 *                   category_name: "Aluguel"
 *                   payment_method: "Transferência"
 *                   status: "pending"
 *                   due_date: "2025-11-25"
 *                   created_at: "2025-11-15T09:00:00Z"
 *               pagination:
 *                 page: 1
 *                 limit: 20
 *                 total: 52
 *                 total_pages: 3
 *       401:
 *         description: Não autenticado
 */
router.get('/transactions', FinanceController.getTransactions);

/**
 * @swagger
 * /finance/transactions:
 *   post:
 *     summary: Criar transação financeira
 *     description: |
 *       Cria uma nova transação de receita ou despesa.
 *       
 *       **Casos de uso comuns:**
 *       
 *       **Receitas:**
 *       - Registro de vendas
 *       - Recebimento de pagamentos
 *       - Entrada de investimentos
 *       - Prestação de serviços
 *       
 *       **Despesas:**
 *       - Pagamento de fornecedores
 *       - Despesas operacionais
 *       - Salários e encargos
 *       - Impostos e taxas
 *       
 *       **Recursos disponíveis:**
 *       - Criação automática de categorias (usando category_name)
 *       - Suporte a transações recorrentes
 *       - Múltiplos status (pendente, pago, vencido, cancelado)
 *       - Tags para melhor organização
 *       - Referências externas (vendas, notas fiscais, etc)
 *     tags: [Finance]
 *     parameters:
 *       - $ref: '#/components/parameters/AcceptLanguage'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - type
 *               - amount
 *               - description
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [income, expense]
 *               amount:
 *                 type: number
 *                 minimum: 0.01
 *               description:
 *                 type: string
 *                 maxLength: 255
 *               category_id:
 *                 type: string
 *                 format: uuid
 *               category_name:
 *                 type: string
 *                 maxLength: 100
 *               payment_method:
 *                 type: string
 *                 maxLength: 100
 *               reference_id:
 *                 type: string
 *               reference_type:
 *                 type: string
 *                 enum: [sale, purchase, invoice, manual]
 *                 default: manual
 *               due_date:
 *                 type: string
 *                 format: date
 *               paid_date:
 *                 type: string
 *                 format: date
 *               status:
 *                 type: string
 *                 enum: [pending, paid, overdue, cancelled]
 *                 default: pending
 *               recurring:
 *                 type: boolean
 *                 default: false
 *               recurring_frequency:
 *                 type: string
 *                 enum: [monthly, yearly]
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *               notes:
 *                 type: string
 *                 maxLength: 1000
 *           examples:
 *             receita_venda_simples:
 *               summary: Receita de venda simples
 *               value:
 *                 type: "income"
 *                 amount: 1500.50
 *                 description: "Venda de produto #1234 para cliente João Silva"
 *                 category_name: "Vendas de Produtos"
 *                 payment_method: "Cartão de Crédito"
 *                 status: "paid"
 *                 paid_date: "2025-11-16"
 *                 reference_type: "sale"
 *                 reference_id: "SALE-1234"
 *             despesa_aluguel:
 *               summary: Despesa de aluguel mensal
 *               value:
 *                 type: "expense"
 *                 amount: 5000.00
 *                 description: "Aluguel do estabelecimento - Novembro 2025"
 *                 category_id: "60ddbaa2-407d-4c6a-ad6b-a2e57710a559"
 *                 payment_method: "Transferência Bancária"
 *                 status: "pending"
 *                 due_date: "2025-11-25"
 *                 tags: ["mensal", "fixo", "aluguel"]
 *             receita_recorrente:
 *               summary: Receita recorrente (assinatura)
 *               value:
 *                 type: "income"
 *                 amount: 299.90
 *                 description: "Assinatura mensal - Plano Premium"
 *                 category_name: "Assinaturas"
 *                 payment_method: "Cartão de Crédito"
 *                 status: "paid"
 *                 paid_date: "2025-11-16"
 *                 recurring: true
 *                 recurring_frequency: "monthly"
 *             despesa_fornecedor:
 *               summary: Despesa com fornecedor
 *               value:
 *                 type: "expense"
 *                 amount: 3500.00
 *                 description: "Compra de materiais - Fornecedor ABC"
 *                 category_name: "Fornecedores"
 *                 payment_method: "Boleto"
 *                 status: "pending"
 *                 due_date: "2025-12-01"
 *                 reference_type: "purchase"
 *                 reference_id: "PO-5678"
 *                 notes: "Prazo de entrega: 15 dias úteis"
 *             receita_parcelada:
 *               summary: Receita com nota de parcelamento
 *               value:
 *                 type: "income"
 *                 amount: 10000.00
 *                 description: "Prestação de serviços - Projeto Website"
 *                 category_name: "Serviços"
 *                 payment_method: "Transferência"
 *                 status: "pending"
 *                 due_date: "2025-12-15"
 *                 tags: ["projeto", "website", "parcelado"]
 *                 notes: "Parcela 1 de 3 - Restante em Jan e Fev"
 *     responses:
 *       201:
 *         description: Transação criada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   $ref: '#/components/schemas/FinancialTransaction'
 *             example:
 *               success: true
 *               message: "Transação criada com sucesso"
 *               data:
 *                 id: "550e8400-e29b-41d4-a716-446655440000"
 *                 type: "income"
 *                 amount: 1500.50
 *                 description: "Venda de produto #1234"
 *                 category_name: "Vendas de Produtos"
 *                 status: "paid"
 *                 created_at: "2025-11-16T10:00:00Z"
 *       400:
 *         description: Dados inválidos
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *             examples:
 *               tipo_invalido:
 *                 summary: Tipo inválido
 *                 value:
 *                   success: false
 *                   message: "Tipo deve ser 'income' ou 'expense'"
 *               valor_invalido:
 *                 summary: Valor inválido
 *                 value:
 *                   success: false
 *                   message: "Valor deve ser maior que zero"
 *               descricao_obrigatoria:
 *                 summary: Descrição obrigatória
 *                 value:
 *                   success: false
 *                   message: "Descrição é obrigatória"
 *       401:
 *         description: Não autenticado
 */
router.post('/transactions', FinanceController.createTransaction);

/**
 * @swagger
 * /finance/transactions/{id}:
 *   put:
 *     summary: Atualizar transação financeira
 *     description: |
 *       Atualiza os dados de uma transação existente.
 *       
 *       **Observações importantes:**
 *       - Apenas campos fornecidos serão atualizados
 *       - Campos não fornecidos mantêm os valores originais
 *       - Não é possível alterar o valor (amount) de transações já pagas
 *       - Tags podem ser completamente substituídas
 *       
 *       **Casos de uso:**
 *       - Corrigir descrição ou categoria
 *       - Atualizar data de vencimento
 *       - Alterar método de pagamento
 *       - Adicionar notas e observações
 *       - Modificar tags de organização
 *     tags: [Finance]
 *     parameters:
 *       - $ref: '#/components/parameters/AcceptLanguage'
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID da transação a ser atualizada
 *         example: "550e8400-e29b-41d4-a716-446655440000"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [income, expense]
 *               amount:
 *                 type: number
 *               description:
 *                 type: string
 *               category_id:
 *                 type: string
 *                 format: uuid
 *               category_name:
 *                 type: string
 *               payment_method:
 *                 type: string
 *               due_date:
 *                 type: string
 *                 format: date
 *               paid_date:
 *                 type: string
 *                 format: date
 *               status:
 *                 type: string
 *                 enum: [pending, paid, overdue, cancelled]
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *               notes:
 *                 type: string
 *           examples:
 *             atualizar_descricao:
 *               summary: Atualizar apenas descrição
 *               value:
 *                 description: "Venda de produto #1234 - Cliente João Silva (Revisado)"
 *             atualizar_status:
 *               summary: Marcar como pago
 *               value:
 *                 status: "paid"
 *                 paid_date: "2025-11-16"
 *                 payment_method: "PIX"
 *             adicionar_notas:
 *               summary: Adicionar observações
 *               value:
 *                 notes: "Cliente solicitou nota fiscal. Enviar por email até 20/11."
 *                 tags: ["nf-pendente", "urgente"]
 *             alterar_vencimento:
 *               summary: Prorrogar vencimento
 *               value:
 *                 due_date: "2025-12-15"
 *                 notes: "Vencimento prorrogado por 30 dias conforme acordo"
 *     responses:
 *       200:
 *         description: Transação atualizada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   $ref: '#/components/schemas/FinancialTransaction'
 *             example:
 *               success: true
 *               message: "Transação atualizada com sucesso"
 *               data:
 *                 id: "550e8400-e29b-41d4-a716-446655440000"
 *                 status: "paid"
 *                 paid_date: "2025-11-16"
 *                 updated_at: "2025-11-16T14:30:00Z"
 *       400:
 *         description: Dados inválidos
 *       404:
 *         description: Transação não encontrada
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               message: "Transação não encontrada"
 *       401:
 *         description: Não autenticado
 */
router.put('/transactions/:id', FinanceController.updateTransaction);

/**
 * @swagger
 * /finance/transactions/{id}:
 *   delete:
 *     summary: Deletar transação financeira
 *     description: |
 *       Realiza a exclusão lógica (soft delete) de uma transação.
 *       
 *       **Importante:**
 *       - A transação não é removida do banco, apenas marcada como deletada
 *       - Transações deletadas não aparecem em listagens e relatórios
 *       - O histórico é preservado para auditoria
 *       - Não é possível deletar transações vinculadas a vendas/compras
 *       
 *       **Quando usar:**
 *       - Remover transações duplicadas
 *       - Excluir lançamentos incorretos
 *       - Limpar transações de teste
 *       
 *       **Alternativas:**
 *       - Para correções, considere usar PUT para atualizar
 *       - Para cancelamentos, altere o status para "cancelled"
 *     tags: [Finance]
 *     parameters:
 *       - $ref: '#/components/parameters/AcceptLanguage'
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID da transação a ser deletada
 *         example: "550e8400-e29b-41d4-a716-446655440000"
 *     responses:
 *       200:
 *         description: Transação deletada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *             example:
 *               success: true
 *               message: "Transação deletada com sucesso"
 *       400:
 *         description: Não é possível deletar
 *         content:
 *           application/json:
 *             examples:
 *               vinculada_venda:
 *                 summary: Transação vinculada a venda
 *                 value:
 *                   success: false
 *                   message: "Não é possível deletar transação vinculada a uma venda"
 *       404:
 *         description: Transação não encontrada
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               message: "Transação não encontrada"
 *       401:
 *         description: Não autenticado
 */
router.delete('/transactions/:id', FinanceController.deleteTransaction);

/**
 * @swagger
 * /finance/categories:
 *   get:
 *     summary: Listar categorias financeiras
 *     description: |
 *       Lista todas as categorias financeiras da empresa com opção de filtro por tipo.
 *       
 *       **Exemplos de uso:**
 *       - Listar todas as categorias: `GET /finance/categories`
 *       - Listar apenas categorias de receita: `GET /finance/categories?type=income`
 *       - Listar apenas categorias de despesa: `GET /finance/categories?type=expense`
 *     tags: [Finance]
 *     parameters:
 *       - $ref: '#/components/parameters/AcceptLanguage'
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [income, expense, both]
 *         description: |
 *           Filtrar por tipo de categoria:
 *           - **income**: Categorias de receita
 *           - **expense**: Categorias de despesa
 *           - **both**: Categorias que aceitam ambos os tipos
 *         example: "income"
 *     responses:
 *       200:
 *         description: Lista de categorias retornada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/FinancialCategory'
 *             examples:
 *               categorias_receita:
 *                 summary: Exemplo de categorias de receita
 *                 value:
 *                   success: true
 *                   data:
 *                     - id: 1
 *                       name: "Vendas de Produtos"
 *                       description: "Receitas provenientes da venda de produtos"
 *                       type: "income"
 *                       parent_id: null
 *                       is_active: true
 *                       created_at: "2025-11-16T10:00:00Z"
 *                     - id: 2
 *                       name: "Prestação de Serviços"
 *                       description: "Receitas de serviços prestados"
 *                       type: "income"
 *                       parent_id: null
 *                       is_active: true
 *                       created_at: "2025-11-16T10:00:00Z"
 *               categorias_despesa:
 *                 summary: Exemplo de categorias de despesa
 *                 value:
 *                   success: true
 *                   data:
 *                     - id: 3
 *                       name: "Aluguel"
 *                       description: "Despesas com aluguel do estabelecimento"
 *                       type: "expense"
 *                       parent_id: null
 *                       is_active: true
 *                       created_at: "2025-11-16T10:00:00Z"
 *                     - id: 4
 *                       name: "Fornecedores"
 *                       description: "Pagamentos a fornecedores"
 *                       type: "expense"
 *                       parent_id: null
 *                       is_active: true
 *                       created_at: "2025-11-16T10:00:00Z"
 *       401:
 *         description: Não autenticado
 *       403:
 *         description: Sem permissão para acessar
 */
router.get('/categories', FinanceController.getCategories);

/**
 * @swagger
 * /finance/categories:
 *   post:
 *     summary: Criar categoria financeira
 *     description: |
 *       Cria uma nova categoria financeira para organizar transações de receitas e despesas.
 *       
 *       **Casos de uso comuns:**
 *       
 *       **Categorias de Receita (income):**
 *       - Vendas de Produtos
 *       - Prestação de Serviços
 *       - Comissões
 *       - Royalties
 *       - Juros Recebidos
 *       
 *       **Categorias de Despesa (expense):**
 *       - Aluguel
 *       - Salários e Encargos
 *       - Fornecedores
 *       - Marketing e Publicidade
 *       - Água, Luz e Telefone
 *       - Impostos e Taxas
 *       - Manutenção
 *       
 *       **Categorias Mistas (both):**
 *       - Ajustes de Caixa
 *       - Transferências Internas
 *       - Correções
 *       
 *       **Hierarquia de Categorias:**
 *       Você pode criar subcategorias usando o campo `parent_id`. Por exemplo:
 *       - Marketing (pai)
 *         - Marketing Digital (filho - parent_id: id do Marketing)
 *         - Marketing Offline (filho - parent_id: id do Marketing)
 *     tags: [Finance]
 *     parameters:
 *       - $ref: '#/components/parameters/AcceptLanguage'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 100
 *                 description: Nome da categoria (obrigatório)
 *               description:
 *                 type: string
 *                 maxLength: 255
 *                 description: Descrição detalhada da categoria (opcional)
 *               type:
 *                 type: string
 *                 enum: [income, expense, both]
 *                 default: both
 *                 description: Tipo de transações aceitas
 *               parent_id:
 *                 type: string
 *                 format: uuid
 *                 description: ID da categoria pai para criar subcategoria (opcional)
 *               is_active:
 *                 type: boolean
 *                 default: true
 *                 description: Define se a categoria está ativa
 *           examples:
 *             categoria_receita_simples:
 *               summary: Categoria de receita simples
 *               value:
 *                 name: "Vendas de Produtos"
 *                 description: "Receitas provenientes da venda de produtos físicos e digitais"
 *                 type: "income"
 *             categoria_despesa_detalhada:
 *               summary: Categoria de despesa detalhada
 *               value:
 *                 name: "Marketing e Publicidade"
 *                 description: "Despesas com ações de marketing, publicidade online/offline, campanhas e branding"
 *                 type: "expense"
 *                 is_active: true
 *             subcategoria:
 *               summary: Criando uma subcategoria
 *               value:
 *                 name: "Marketing Digital"
 *                 description: "Despesas com marketing em canais digitais (Google Ads, Facebook Ads, etc)"
 *                 type: "expense"
 *                 parent_id: "60ddbaa2-407d-4c6a-ad6b-a2e57710a559"
 *             categoria_ajustes:
 *               summary: Categoria para ajustes (aceita receita e despesa)
 *               value:
 *                 name: "Ajustes de Caixa"
 *                 description: "Ajustes e correções de valores em caixa"
 *                 type: "both"
 *             categoria_minima:
 *               summary: Criação mínima (apenas campos obrigatórios)
 *               value:
 *                 name: "Nova Categoria"
 *     responses:
 *       201:
 *         description: Categoria criada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Categoria criada com sucesso"
 *                 data:
 *                   $ref: '#/components/schemas/FinancialCategory'
 *             example:
 *               success: true
 *               message: "Categoria criada com sucesso"
 *               data:
 *                 id: 5
 *                 name: "Vendas de Produtos"
 *                 description: "Receitas provenientes da venda de produtos físicos e digitais"
 *                 type: "income"
 *                 parent_id: null
 *                 is_active: true
 *                 company_id: 1
 *                 created_at: "2025-11-16T10:00:00Z"
 *                 updated_at: "2025-11-16T10:00:00Z"
 *       400:
 *         description: Dados inválidos
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *             examples:
 *               nome_obrigatorio:
 *                 summary: Nome é obrigatório
 *                 value:
 *                   success: false
 *                   message: "Nome da categoria é obrigatório"
 *               nome_duplicado:
 *                 summary: Nome já existe
 *                 value:
 *                   success: false
 *                   message: "Já existe uma categoria com este nome"
 *               tipo_invalido:
 *                 summary: Tipo inválido
 *                 value:
 *                   success: false
 *                   message: "Tipo deve ser 'income', 'expense' ou 'both'"
 *       401:
 *         description: Não autenticado
 *       403:
 *         description: Sem permissão para criar categorias
 */
router.post('/categories', FinanceController.createCategory);

/**
 * @swagger
 * /finance/cash-flow:
 *   get:
 *     summary: Relatório de fluxo de caixa
 *     description: |
 *       Gera relatório detalhado do fluxo de caixa com entradas, saídas e saldo acumulado.
 *       
 *       **Informações incluídas:**
 *       - Entradas diárias (receitas recebidas)
 *       - Saídas diárias (despesas pagas)
 *       - Fluxo líquido por dia
 *       - Saldo acumulado progressivo
 *       - Resumo consolidado do período
 *       - Opção de incluir transações pendentes (previsão)
 *       
 *       **Casos de uso:**
 *       - Análise de saúde financeira
 *       - Planejamento de pagamentos
 *       - Identificação de períodos críticos
 *       - Previsão de caixa futuro
 *       
 *       **Exemplos de uso:**
 *       - Últimos 30 dias: `GET /finance/cash-flow?period=30`
 *       - Com pendentes: `GET /finance/cash-flow?period=60&include_pending=true`
 *       - Último trimestre: `GET /finance/cash-flow?period=90`
 *     tags: [Finance]
 *     parameters:
 *       - $ref: '#/components/parameters/AcceptLanguage'
 *       - in: query
 *         name: period
 *         schema:
 *           type: integer
 *           default: 30
 *           minimum: 1
 *           maximum: 365
 *         description: Número de dias para análise (máximo 365)
 *         example: 30
 *       - in: query
 *         name: include_pending
 *         schema:
 *           type: boolean
 *           default: false
 *         description: |
 *           Incluir transações pendentes na análise:
 *           - **true**: Inclui previsão de recebimentos/pagamentos futuros
 *           - **false**: Apenas transações efetivadas (pagas)
 *         example: false
 *     responses:
 *       200:
 *         description: Fluxo de caixa retornado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     period:
 *                       type: string
 *                       description: Período analisado
 *                     include_pending:
 *                       type: boolean
 *                       description: Se inclui transações pendentes
 *                     cash_flow:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           date:
 *                             type: string
 *                             format: date
 *                           income:
 *                             type: number
 *                             description: Total de receitas do dia
 *                           expenses:
 *                             type: number
 *                             description: Total de despesas do dia
 *                           net_flow:
 *                             type: number
 *                             description: Fluxo líquido (receitas - despesas)
 *                           accumulated_balance:
 *                             type: number
 *                             description: Saldo acumulado até a data
 *                     summary:
 *                       type: object
 *                       properties:
 *                         total_income:
 *                           type: number
 *                         total_expenses:
 *                           type: number
 *                         net_flow:
 *                           type: number
 *                         initial_balance:
 *                           type: number
 *                         final_balance:
 *                           type: number
 *                         avg_daily_income:
 *                           type: number
 *                         avg_daily_expenses:
 *                           type: number
 *                         positive_days:
 *                           type: integer
 *                           description: Dias com saldo positivo
 *                         negative_days:
 *                           type: integer
 *                           description: Dias com saldo negativo
 *             example:
 *               success: true
 *               data:
 *                 period: "30 dias"
 *                 include_pending: false
 *                 cash_flow:
 *                   - date: "2025-11-01"
 *                     income: 5000.00
 *                     expenses: 2000.00
 *                     net_flow: 3000.00
 *                     accumulated_balance: 3000.00
 *                   - date: "2025-11-02"
 *                     income: 1500.00
 *                     expenses: 3500.00
 *                     net_flow: -2000.00
 *                     accumulated_balance: 1000.00
 *                   - date: "2025-11-03"
 *                     income: 8000.00
 *                     expenses: 1000.00
 *                     net_flow: 7000.00
 *                     accumulated_balance: 8000.00
 *                 summary:
 *                   total_income: 45000.00
 *                   total_expenses: 28000.00
 *                   net_flow: 17000.00
 *                   initial_balance: 10000.00
 *                   final_balance: 27000.00
 *                   avg_daily_income: 1500.00
 *                   avg_daily_expenses: 933.33
 *                   positive_days: 22
 *                   negative_days: 8
 *       401:
 *         description: Não autenticado
 */
router.get('/cash-flow', FinanceController.getCashFlow);

/**
 * @swagger
 * /finance/profit-loss:
 *   get:
 *     summary: DRE - Demonstração de Resultado do Exercício
 *     description: |
 *       Gera relatório completo de DRE (Demonstração de Resultado) com análise detalhada de receitas, despesas e lucratividade.
 *       
 *       **Informações incluídas:**
 *       - Receitas brutas por categoria
 *       - Despesas operacionais detalhadas
 *       - Lucro bruto e líquido
 *       - Margem de lucro percentual
 *       - Comparativo com períodos anteriores
 *       - EBITDA (se aplicável)
 *       
 *       **Casos de uso:**
 *       - Análise de rentabilidade
 *       - Planejamento tributário
 *       - Tomada de decisões estratégicas
 *       - Apresentação a investidores
 *       - Relatórios contábeis
 *       
 *       **Exemplos de uso:**
 *       - DRE do mês atual: `GET /finance/profit-loss?period=month`
 *       - DRE de mês específico: `GET /finance/profit-loss?year=2025&month=10`
 *       - DRE anual: `GET /finance/profit-loss?period=year&year=2025`
 *       - DRE trimestral: `GET /finance/profit-loss?period=quarter`
 *     tags: [Finance]
 *     parameters:
 *       - $ref: '#/components/parameters/AcceptLanguage'
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [week, month, quarter, year]
 *           default: month
 *         description: |
 *           Período para análise:
 *           - **week**: Última semana
 *           - **month**: Mês atual ou especificado
 *           - **quarter**: Trimestre atual
 *           - **year**: Ano atual ou especificado
 *         example: "month"
 *       - in: query
 *         name: year
 *         schema:
 *           type: integer
 *           minimum: 2000
 *           maximum: 2100
 *         description: Ano específico para análise (usado com month)
 *         example: 2025
 *       - in: query
 *         name: month
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 12
 *         description: Mês específico para análise (1-12, requer year)
 *         example: 11
 *     responses:
 *       200:
 *         description: DRE retornada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     period:
 *                       type: string
 *                       description: Descrição do período analisado
 *                     start_date:
 *                       type: string
 *                       format: date
 *                     end_date:
 *                       type: string
 *                       format: date
 *                     revenues:
 *                       type: object
 *                       properties:
 *                         items:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               category:
 *                                 type: string
 *                               amount:
 *                                 type: number
 *                               percentage:
 *                                 type: number
 *                         total:
 *                           type: number
 *                     expenses:
 *                       type: object
 *                       properties:
 *                         items:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               category:
 *                                 type: string
 *                               amount:
 *                                 type: number
 *                               percentage:
 *                                 type: number
 *                         total:
 *                           type: number
 *                     summary:
 *                       type: object
 *                       properties:
 *                         gross_revenue:
 *                           type: number
 *                           description: Receita bruta total
 *                         total_expenses:
 *                           type: number
 *                           description: Despesas totais
 *                         gross_profit:
 *                           type: number
 *                           description: Lucro bruto (receita - despesas)
 *                         profit_margin_percent:
 *                           type: number
 *                           description: Margem de lucro percentual
 *                         operational_expenses:
 *                           type: number
 *                         net_profit:
 *                           type: number
 *                           description: Lucro líquido
 *                         ebitda:
 *                           type: number
 *             example:
 *               success: true
 *               data:
 *                 period: "Novembro 2025"
 *                 start_date: "2025-11-01"
 *                 end_date: "2025-11-30"
 *                 revenues:
 *                   items:
 *                     - category: "Vendas de Produtos"
 *                       amount: 35000.00
 *                       percentage: 77.78
 *                     - category: "Prestação de Serviços"
 *                       amount: 10000.00
 *                       percentage: 22.22
 *                   total: 45000.00
 *                 expenses:
 *                   items:
 *                     - category: "Salários"
 *                       amount: 15000.00
 *                       percentage: 53.57
 *                     - category: "Aluguel"
 *                       amount: 5000.00
 *                       percentage: 17.86
 *                     - category: "Marketing"
 *                       amount: 3000.00
 *                       percentage: 10.71
 *                     - category: "Fornecedores"
 *                       amount: 5000.00
 *                       percentage: 17.86
 *                   total: 28000.00
 *                 summary:
 *                   gross_revenue: 45000.00
 *                   total_expenses: 28000.00
 *                   gross_profit: 17000.00
 *                   profit_margin_percent: 37.78
 *                   operational_expenses: 23000.00
 *                   net_profit: 17000.00
 *                   ebitda: 18500.00
 *       400:
 *         description: Parâmetros inválidos
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               message: "Parâmetro 'month' requer 'year' também"
 *       401:
 *         description: Não autenticado
 */
router.get('/profit-loss', FinanceController.getProfitLoss);

module.exports = router;