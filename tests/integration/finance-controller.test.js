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
 * 🧪 TESTES DE INTEGRAÇÃO - FINANCE CONTROLLER
 * ==========================================
 * 
 * Testa todos os endpoints do FinanceController
 * - CRUD completo de transações financeiras
 * - Categorias financeiras
 * - Dashboard e estatísticas
 * - Fluxo de caixa
 * - DRE (Demonstração de Resultado)
 * - Validações e permissões
 * - i18n (pt-BR, en, es)
 */

const request = require('supertest');
const app = require('../../src/server');
const { query } = require('../../src/config/database');
const { DatabaseHelper } = require('../helpers/database');

describe('💰 Finance Controller Integration Tests', () => {
  let helper;
  let authToken;
  let testUser;
  let testCompany;
  let testCategory;

  beforeAll(async () => {
    helper = new DatabaseHelper(global.testPool);
    
    // Criar empresa de teste
    testCompany = await helper.createTestCompany({
      name: 'Finance Test Company'
    });

    // Criar usuário de teste
    testUser = await helper.createTestUser({
      email: 'finance@test.com',
      password: 'Test@123',
      companyId: testCompany.id
    });

    // Fazer login
    const loginResponse = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'finance@test.com',
        password: 'Test@123'
      });

    authToken = loginResponse.body.token;
  });

  afterAll(async () => {
    await helper.cleanup();
  });

  beforeEach(async () => {
    // Limpar transações financeiras
    await query(
      'DELETE FROM financial_transactions WHERE company_id = $1',
      [testCompany.id]
    );
    
    // Limpar categorias financeiras
    await query(
      'DELETE FROM financial_categories WHERE company_id = $1',
      [testCompany.id]
    );
  });

  describe('📊 Dashboard Financeiro', () => {
    test('✅ Deve retornar dashboard com período mensal', async () => {
      const response = await request(app)
        .get('/api/v1/finance/dashboard')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ period: 'month' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('summary');
      expect(response.body.data).toHaveProperty('evolution');
      expect(response.body.data).toHaveProperty('top_expense_categories');
      expect(response.body.data).toHaveProperty('upcoming_transactions');
      expect(response.body.data).toHaveProperty('cash_flow_forecast');
    });

    test('✅ Deve aceitar diferentes períodos', async () => {
      const periods = ['week', 'month', 'quarter', 'year'];

      for (const period of periods) {
        const response = await request(app)
          .get('/api/v1/finance/dashboard')
          .set('Authorization', `Bearer ${authToken}`)
          .query({ period })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.period).toBe(period);
      }
    });

    test('✅ Deve calcular totais corretamente', async () => {
      // Criar transações de teste
      await helper.createTransaction({
        company_id: testCompany.id,
        type: 'income',
        amount: 1000,
        status: 'paid',
        description: 'Receita teste'
      });

      await helper.createTransaction({
        company_id: testCompany.id,
        type: 'expense',
        amount: 600,
        status: 'paid',
        description: 'Despesa teste'
      });

      const response = await request(app)
        .get('/api/v1/finance/dashboard')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.summary.total_income).toBe(1000);
      expect(response.body.data.summary.total_expenses).toBe(600);
      expect(response.body.data.summary.net_income).toBe(400);
      expect(response.body.data.summary.profit_margin).toBeGreaterThan(0);
    });

    test('❌ Deve retornar 401 sem autenticação', async () => {
      await request(app)
        .get('/api/v1/finance/dashboard')
        .expect(401);
    });
  });

  describe('📋 Listar Transações', () => {
    test('✅ Deve listar transações com paginação', async () => {
      // Criar 25 transações
      for (let i = 0; i < 25; i++) {
        await helper.createTransaction({
          company_id: testCompany.id,
          type: i % 2 === 0 ? 'income' : 'expense',
          amount: 100 * (i + 1),
          description: `Transação ${i + 1}`
        });
      }

      const response = await request(app)
        .get('/api/v1/finance/transactions')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ page: 1, limit: 10 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(10);
      expect(response.body.pagination.total).toBe(25);
      expect(response.body.pagination.pages).toBe(3);
    });

    test('✅ Deve filtrar por tipo de transação', async () => {
      await helper.createTransaction({
        company_id: testCompany.id,
        type: 'income',
        amount: 1000
      });

      await helper.createTransaction({
        company_id: testCompany.id,
        type: 'expense',
        amount: 500
      });

      const response = await request(app)
        .get('/api/v1/finance/transactions')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ type: 'income' })
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].type).toBe('income');
    });

    test('✅ Deve filtrar por status', async () => {
      await helper.createTransaction({
        company_id: testCompany.id,
        type: 'income',
        amount: 1000,
        status: 'paid'
      });

      await helper.createTransaction({
        company_id: testCompany.id,
        type: 'income',
        amount: 500,
        status: 'pending'
      });

      const response = await request(app)
        .get('/api/v1/finance/transactions')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ status: 'pending' })
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].status).toBe('pending');
    });

    test('✅ Deve buscar por termo', async () => {
      await helper.createTransaction({
        company_id: testCompany.id,
        description: 'Pagamento de fornecedor XYZ'
      });

      await helper.createTransaction({
        company_id: testCompany.id,
        description: 'Venda de produto ABC'
      });

      const response = await request(app)
        .get('/api/v1/finance/transactions')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ search: 'fornecedor' })
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].description).toContain('fornecedor');
    });

    test('✅ Deve ordenar por diferentes campos', async () => {
      const response = await request(app)
        .get('/api/v1/finance/transactions')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ sort: 'amount', order: 'desc' })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    test('✅ Deve retornar totais dos filtros aplicados', async () => {
      await helper.createTransaction({
        company_id: testCompany.id,
        type: 'income',
        amount: 1000
      });

      const response = await request(app)
        .get('/api/v1/finance/transactions')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.totals).toBeDefined();
      expect(response.body.totals).toHaveProperty('income');
      expect(response.body.totals).toHaveProperty('expenses');
      expect(response.body.totals).toHaveProperty('net');
    });
  });

  describe('➕ Criar Transação', () => {
    test('✅ Deve criar transação de receita', async () => {
      const transactionData = {
        type: 'income',
        amount: 1500.50,
        description: 'Pagamento de cliente',
        payment_method: 'pix',
        status: 'paid'
      };

      const response = await request(app)
        .post('/api/v1/finance/transactions')
        .set('Authorization', `Bearer ${authToken}`)
        .send(transactionData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.type).toBe('income');
      expect(response.body.data.amount).toBe(1500.50);
      expect(response.body.data.description).toBe('Pagamento de cliente');
    });

    test('✅ Deve criar transação de despesa', async () => {
      const transactionData = {
        type: 'expense',
        amount: 500,
        description: 'Compra de material',
        payment_method: 'credit_card'
      };

      const response = await request(app)
        .post('/api/v1/finance/transactions')
        .set('Authorization', `Bearer ${authToken}`)
        .send(transactionData)
        .expect(201);

      expect(response.body.data.type).toBe('expense');
    });

    test('✅ Deve criar categoria automaticamente se fornecido nome', async () => {
      const transactionData = {
        type: 'expense',
        amount: 300,
        description: 'Despesa de marketing',
        category_name: 'Marketing Digital'
      };

      const response = await request(app)
        .post('/api/v1/finance/transactions')
        .set('Authorization', `Bearer ${authToken}`)
        .send(transactionData)
        .expect(201);

      expect(response.body.data.category_id).toBeDefined();

      // Verificar se categoria foi criada
      const categoryCheck = await query(
        'SELECT * FROM financial_categories WHERE name = $1 AND company_id = $2',
        ['Marketing Digital', testCompany.id]
      );

      expect(categoryCheck.rows.length).toBe(1);
    });

    test('✅ Deve conceder XP e coins por transação', async () => {
      const transactionData = {
        type: 'income',
        amount: 1000,
        description: 'Venda de produto'
      };

      await request(app)
        .post('/api/v1/finance/transactions')
        .set('Authorization', `Bearer ${authToken}`)
        .send(transactionData)
        .expect(201);

      // Verificar gamificação
      const gamificationCheck = await query(
        'SELECT * FROM user_gamification_profiles WHERE user_id = $1',
        [testUser.id]
      );

      expect(gamificationCheck.rows.length).toBeGreaterThan(0);
    });

    test('❌ Deve rejeitar tipo inválido', async () => {
      const transactionData = {
        type: 'invalid',
        amount: 100,
        description: 'Teste'
      };

      const response = await request(app)
        .post('/api/v1/finance/transactions')
        .set('Authorization', `Bearer ${authToken}`)
        .send(transactionData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    test('❌ Deve rejeitar valor negativo', async () => {
      const transactionData = {
        type: 'income',
        amount: -100,
        description: 'Teste'
      };

      await request(app)
        .post('/api/v1/finance/transactions')
        .set('Authorization', `Bearer ${authToken}`)
        .send(transactionData)
        .expect(400);
    });

    test('❌ Deve rejeitar sem descrição', async () => {
      const transactionData = {
        type: 'income',
        amount: 100
      };

      await request(app)
        .post('/api/v1/finance/transactions')
        .set('Authorization', `Bearer ${authToken}`)
        .send(transactionData)
        .expect(400);
    });

    test('✅ Deve funcionar em português', async () => {
      const response = await request(app)
        .post('/api/v1/finance/transactions')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Accept-Language', 'pt-BR')
        .send({
          type: 'income',
          amount: 100,
          description: 'Teste PT'
        })
        .expect(201);

      expect(response.body.message).toBeDefined();
    });

    test('✅ Deve funcionar em inglês', async () => {
      const response = await request(app)
        .post('/api/v1/finance/transactions')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Accept-Language', 'en')
        .send({
          type: 'income',
          amount: 100,
          description: 'Test EN'
        })
        .expect(201);

      expect(response.body.message).toBeDefined();
    });

    test('✅ Deve funcionar em espanhol', async () => {
      const response = await request(app)
        .post('/api/v1/finance/transactions')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Accept-Language', 'es')
        .send({
          type: 'income',
          amount: 100,
          description: 'Prueba ES'
        })
        .expect(201);

      expect(response.body.message).toBeDefined();
    });
  });

  describe('✏️ Atualizar Transação', () => {
    let transactionId;

    beforeEach(async () => {
      const transaction = await helper.createTransaction({
        company_id: testCompany.id,
        type: 'income',
        amount: 500,
        description: 'Transação original'
      });
      transactionId = transaction.id;
    });

    test('✅ Deve atualizar descrição', async () => {
      const response = await request(app)
        .put(`/api/v1/finance/transactions/${transactionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          description: 'Descrição atualizada'
        })
        .expect(200);

      expect(response.body.data.description).toBe('Descrição atualizada');
    });

    test('✅ Deve atualizar valor', async () => {
      const response = await request(app)
        .put(`/api/v1/finance/transactions/${transactionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          amount: 750
        })
        .expect(200);

      expect(response.body.data.amount).toBe(750);
    });

    test('✅ Deve atualizar status', async () => {
      const response = await request(app)
        .put(`/api/v1/finance/transactions/${transactionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'paid'
        })
        .expect(200);

      expect(response.body.data.status).toBe('paid');
    });

    test('❌ Deve retornar 404 para transação inexistente', async () => {
      await request(app)
        .put('/api/v1/finance/transactions/99999999-9999-9999-9999-999999999999')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          description: 'Teste'
        })
        .expect(404);
    });

    test('❌ Deve rejeitar valor negativo', async () => {
      await request(app)
        .put(`/api/v1/finance/transactions/${transactionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          amount: -100
        })
        .expect(400);
    });
  });

  describe('🗑️ Deletar Transação', () => {
    let transactionId;

    beforeEach(async () => {
      const transaction = await helper.createTransaction({
        company_id: testCompany.id,
        type: 'income',
        amount: 500,
        description: 'Transação para deletar'
      });
      transactionId = transaction.id;
    });

    test('✅ Deve fazer soft delete', async () => {
      const response = await request(app)
        .delete(`/api/v1/finance/transactions/${transactionId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verificar soft delete
      const deletedCheck = await query(
        'SELECT deleted_at FROM financial_transactions WHERE id = $1',
        [transactionId]
      );

      expect(deletedCheck.rows[0].deleted_at).not.toBeNull();
    });

    test('❌ Deve retornar 404 para transação inexistente', async () => {
      await request(app)
        .delete('/api/v1/finance/transactions/99999999-9999-9999-9999-999999999999')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe('💸 Fluxo de Caixa', () => {
    test('✅ Deve retornar fluxo de caixa', async () => {
      const response = await request(app)
        .get('/api/v1/finance/cash-flow')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ period: 30 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('cash_flow');
      expect(response.body.data).toHaveProperty('summary');
    });

    test('✅ Deve incluir transações pendentes se solicitado', async () => {
      const response = await request(app)
        .get('/api/v1/finance/cash-flow')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ period: 30, include_pending: 'true' })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    test('✅ Deve calcular saldo acumulado', async () => {
      await helper.createTransaction({
        company_id: testCompany.id,
        type: 'income',
        amount: 1000,
        status: 'paid'
      });

      const response = await request(app)
        .get('/api/v1/finance/cash-flow')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.summary).toHaveProperty('final_balance');
    });
  });

  describe('📂 Categorias Financeiras', () => {
    test('✅ Deve listar categorias', async () => {
      const response = await request(app)
        .get('/api/v1/finance/categories')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    test('✅ Deve criar categoria', async () => {
      const categoryData = {
        name: 'Vendas Online',
        description: 'Receitas de vendas online',
        type: 'income'
      };

      const response = await request(app)
        .post('/api/v1/finance/categories')
        .set('Authorization', `Bearer ${authToken}`)
        .send(categoryData)
        .expect(201);

      expect(response.body.data.name).toBe('Vendas Online');
    });

    test('❌ Deve rejeitar categoria duplicada', async () => {
      const categoryData = {
        name: 'Marketing',
        type: 'expense'
      };

      await request(app)
        .post('/api/v1/finance/categories')
        .set('Authorization', `Bearer ${authToken}`)
        .send(categoryData)
        .expect(201);

      await request(app)
        .post('/api/v1/finance/categories')
        .set('Authorization', `Bearer ${authToken}`)
        .send(categoryData)
        .expect(400);
    });

    test('✅ Deve atualizar categoria', async () => {
      const createResponse = await request(app)
        .post('/api/v1/finance/categories')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Categoria Original',
          type: 'expense'
        });

      const categoryId = createResponse.body.data.id;

      const response = await request(app)
        .put(`/api/v1/finance/categories/${categoryId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Categoria Atualizada'
        })
        .expect(200);

      expect(response.body.data.name).toBe('Categoria Atualizada');
    });

    test('✅ Deve deletar categoria sem uso', async () => {
      const createResponse = await request(app)
        .post('/api/v1/finance/categories')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Categoria Para Deletar',
          type: 'expense'
        });

      const categoryId = createResponse.body.data.id;

      await request(app)
        .delete(`/api/v1/finance/categories/${categoryId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
    });

    test('❌ Deve impedir deletar categoria em uso', async () => {
      // Criar categoria
      const createResponse = await request(app)
        .post('/api/v1/finance/categories')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Categoria Em Uso',
          type: 'income'
        });

      const categoryId = createResponse.body.data.id;

      // Usar categoria em transação
      await request(app)
        .post('/api/v1/finance/transactions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          type: 'income',
          amount: 100,
          description: 'Teste',
          category_id: categoryId
        });

      // Tentar deletar
      await request(app)
        .delete(`/api/v1/finance/categories/${categoryId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });

    test('✅ Deve filtrar categorias por tipo', async () => {
      await request(app)
        .post('/api/v1/finance/categories')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Receita XYZ',
          type: 'income'
        });

      const response = await request(app)
        .get('/api/v1/finance/categories')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ type: 'income' })
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('📊 DRE (Demonstração de Resultado)', () => {
    test('✅ Deve retornar DRE do período', async () => {
      const response = await request(app)
        .get('/api/v1/finance/profit-loss')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ period: 'month' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('revenues');
      expect(response.body.data).toHaveProperty('expenses');
      expect(response.body.data).toHaveProperty('summary');
    });

    test('✅ Deve aceitar ano e mês específicos', async () => {
      const response = await request(app)
        .get('/api/v1/finance/profit-loss')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ year: 2025, month: 1 })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    test('✅ Deve calcular margem de lucro', async () => {
      // Criar receitas e despesas
      await helper.createTransaction({
        company_id: testCompany.id,
        type: 'income',
        amount: 10000,
        status: 'paid'
      });

      await helper.createTransaction({
        company_id: testCompany.id,
        type: 'expense',
        amount: 6000,
        status: 'paid'
      });

      const response = await request(app)
        .get('/api/v1/finance/profit-loss')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.summary.gross_profit).toBe(4000);
      expect(response.body.data.summary.profit_margin_percent).toBeGreaterThan(0);
    });
  });

  describe('🔒 Segurança e Permissões', () => {
    test('❌ Deve retornar 401 sem token', async () => {
      await request(app)
        .get('/api/v1/finance/transactions')
        .expect(401);
    });

    test('❌ Deve retornar 401 com token inválido', async () => {
      await request(app)
        .get('/api/v1/finance/transactions')
        .set('Authorization', 'Bearer token-invalido')
        .expect(401);
    });

    test('❌ Não deve acessar transações de outra empresa', async () => {
      // Criar outra empresa
      const otherCompany = await helper.createTestCompany({
        name: 'Other Company'
      });

      // Criar transação em outra empresa
      const otherTransaction = await helper.createTransaction({
        company_id: otherCompany.id,
        type: 'income',
        amount: 1000
      });

      // Tentar acessar
      await request(app)
        .put(`/api/v1/finance/transactions/${otherTransaction.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ description: 'Hack attempt' })
        .expect(404);
    });
  });
});
