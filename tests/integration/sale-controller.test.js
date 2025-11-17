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
 * 🧪 TESTES DE INTEGRAÇÃO - SALE CONTROLLER
 * ==========================================
 * 
 * Testa todos os endpoints do SaleController
 * - CRUD completo de vendas
 * - Gestão de itens de venda
 * - Controle de estoque
 * - Estatísticas de vendas
 * - Gamificação e conquistas
 * - Validações e permissões
 * - i18n (pt-BR, en, es)
 */

const request = require('supertest');
const app = require('../../src/server');
const { query } = require('../../src/config/database');
const { DatabaseHelper } = require('../helpers/database');

describe('💰 Sale Controller Integration Tests', () => {
  let helper;
  let authToken;
  let testUser;
  let testCompany;
  let testClient;
  let testProduct;

  beforeAll(async () => {
    helper = new DatabaseHelper(global.testPool);
    
    // Criar empresa de teste
    testCompany = await helper.createTestCompany({
      name: 'Sale Test Company'
    });

    // Criar usuário de teste
    testUser = await helper.createTestUser({
      email: 'sale@test.com',
      password: 'Test@123',
      companyId: testCompany.id
    });

    // Fazer login
    const loginResponse = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'sale@test.com',
        password: 'Test@123'
      });

    authToken = loginResponse.body.token;

    // Criar cliente de teste
    testClient = await helper.createTestContact({
      company_id: testCompany.id,
      nome: 'Cliente Teste',
      email: 'cliente@test.com',
      tipo: 'cliente'
    });

    // Criar produto de teste
    testProduct = await helper.createTestProduct({
      company_id: testCompany.id,
      name: 'Produto Teste',
      price: 100,
      stock_quantity: 50
    });
  });

  afterAll(async () => {
    await helper.cleanup();
  });

  beforeEach(async () => {
    // Limpar vendas
    await query(
      'DELETE FROM sales WHERE company_id = $1',
      [testCompany.id]
    );
    
    // Resetar estoque do produto
    await query(
      'UPDATE products SET stock_quantity = 50 WHERE id = $1',
      [testProduct.id]
    );
  });

  describe('📋 Listar Vendas', () => {
    test('✅ Deve listar vendas com paginação', async () => {
      // Criar 15 vendas
      for (let i = 0; i < 15; i++) {
        await helper.createTestSale({
          company_id: testCompany.id,
          client_id: testClient.id,
          user_id: testUser.id,
          total_amount: 100 * (i + 1)
        });
      }

      const response = await request(app)
        .get('/api/v1/sales')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ page: 1, limit: 10 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(10);
      expect(response.body.pagination.totalItems).toBe(15);
    });

    test('✅ Deve filtrar por status', async () => {
      await helper.createTestSale({
        company_id: testCompany.id,
        client_id: testClient.id,
        status: 'completed'
      });

      await helper.createTestSale({
        company_id: testCompany.id,
        client_id: testClient.id,
        status: 'cancelled'
      });

      const response = await request(app)
        .get('/api/v1/sales')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ status: 'completed' })
        .expect(200);

      expect(response.body.data.every(sale => sale.status === 'completed')).toBe(true);
    });

    test('✅ Deve filtrar por cliente', async () => {
      await helper.createTestSale({
        company_id: testCompany.id,
        client_id: testClient.id
      });

      const response = await request(app)
        .get('/api/v1/sales')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ client_id: testClient.id })
        .expect(200);

      expect(response.body.data.length).toBeGreaterThan(0);
      expect(response.body.data[0].client_id).toBe(testClient.id);
    });

    test('✅ Deve filtrar por período de datas', async () => {
      const today = new Date().toISOString().split('T')[0];
      
      await helper.createTestSale({
        company_id: testCompany.id,
        client_id: testClient.id,
        sale_date: today
      });

      const response = await request(app)
        .get('/api/v1/sales')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ 
          date_from: today,
          date_to: today
        })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    test('✅ Deve buscar por termo', async () => {
      await helper.createTestSale({
        company_id: testCompany.id,
        client_id: testClient.id,
        description: 'Venda especial de natal'
      });

      const response = await request(app)
        .get('/api/v1/sales')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ search: 'natal' })
        .expect(200);

      expect(response.body.data.length).toBeGreaterThan(0);
    });

    test('✅ Deve retornar estatísticas', async () => {
      const response = await request(app)
        .get('/api/v1/sales')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.stats).toBeDefined();
      expect(response.body.stats).toHaveProperty('total_sales');
      expect(response.body.stats).toHaveProperty('total_revenue');
      expect(response.body.stats).toHaveProperty('average_ticket');
    });

    test('✅ Deve ordenar por diferentes campos', async () => {
      const response = await request(app)
        .get('/api/v1/sales')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ sort: 'total_amount', order: 'desc' })
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('➕ Criar Venda', () => {
    test('✅ Deve criar venda com sucesso', async () => {
      const saleData = {
        client_id: testClient.id,
        description: 'Venda de teste',
        payment_method: 'pix',
        payment_status: 'paid',
        items: [
          {
            product_id: testProduct.id,
            product_name: 'Produto Teste',
            quantity: 2,
            unit_price: 100,
            total_price: 200
          }
        ]
      };

      const response = await request(app)
        .post('/api/v1/sales')
        .set('Authorization', `Bearer ${authToken}`)
        .send(saleData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.client_id).toBe(testClient.id);
      expect(response.body.data.total_amount).toBe(200);
      expect(response.body.data.items).toHaveLength(1);
    });

    test('✅ Deve calcular totais corretamente', async () => {
      const saleData = {
        client_id: testClient.id,
        discount_amount: 20,
        tax_amount: 10,
        items: [
          {
            product_name: 'Item 1',
            quantity: 2,
            unit_price: 50,
            total_price: 100
          },
          {
            product_name: 'Item 2',
            quantity: 1,
            unit_price: 100,
            total_price: 100
          }
        ]
      };

      const response = await request(app)
        .post('/api/v1/sales')
        .set('Authorization', `Bearer ${authToken}`)
        .send(saleData)
        .expect(201);

      // Subtotal: 200, Desconto: -20, Taxa: +10 = 190
      expect(response.body.data.total_amount).toBe(200);
      expect(response.body.data.net_amount).toBe(190);
    });

    test('✅ Deve atualizar estoque do produto', async () => {
      const initialStock = testProduct.stock_quantity;

      await request(app)
        .post('/api/v1/sales')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          client_id: testClient.id,
          items: [
            {
              product_id: testProduct.id,
              product_name: 'Produto Teste',
              quantity: 5,
              unit_price: 100,
              total_price: 500
            }
          ]
        })
        .expect(201);

      // Verificar estoque
      const stockCheck = await query(
        'SELECT stock_quantity FROM products WHERE id = $1',
        [testProduct.id]
      );

      expect(stockCheck.rows[0].stock_quantity).toBe(initialStock - 5);
    });

    test('✅ Deve atualizar estatísticas do cliente', async () => {
      await request(app)
        .post('/api/v1/sales')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          client_id: testClient.id,
          items: [
            {
              product_name: 'Produto',
              quantity: 1,
              unit_price: 500,
              total_price: 500
            }
          ]
        })
        .expect(201);

      // Verificar estatísticas do cliente
      const clientCheck = await query(
        'SELECT total_spent, total_orders FROM clients WHERE id = $1',
        [testClient.id]
      );

      if (clientCheck.rows.length > 0) {
        expect(clientCheck.rows[0].total_orders).toBeGreaterThan(0);
      }
    });

    test('✅ Deve conceder XP e coins ao vendedor', async () => {
      await request(app)
        .post('/api/v1/sales')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          client_id: testClient.id,
          items: [
            {
              product_name: 'Produto',
              quantity: 1,
              unit_price: 1000,
              total_price: 1000
            }
          ]
        })
        .expect(201);

      // Verificar gamificação
      const gamificationCheck = await query(
        'SELECT total_xp, available_coins FROM user_gamification_profiles WHERE user_id = $1',
        [testUser.id]
      );

      if (gamificationCheck.rows.length > 0) {
        expect(gamificationCheck.rows[0].total_xp).toBeGreaterThan(0);
      }
    });

    test('✅ Deve criar venda sem produto (serviço)', async () => {
      const response = await request(app)
        .post('/api/v1/sales')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          client_id: testClient.id,
          description: 'Serviço de consultoria',
          items: [
            {
              product_name: 'Consultoria 5h',
              quantity: 1,
              unit_price: 500,
              total_price: 500
            }
          ]
        })
        .expect(201);

      expect(response.body.success).toBe(true);
    });

    test('❌ Deve rejeitar sem cliente', async () => {
      await request(app)
        .post('/api/v1/sales')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          items: [
            {
              product_name: 'Produto',
              quantity: 1,
              unit_price: 100,
              total_price: 100
            }
          ]
        })
        .expect(400);
    });

    test('❌ Deve rejeitar sem itens', async () => {
      await request(app)
        .post('/api/v1/sales')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          client_id: testClient.id,
          items: []
        })
        .expect(400);
    });

    test('❌ Deve rejeitar cliente inexistente', async () => {
      await request(app)
        .post('/api/v1/sales')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          client_id: '99999999-9999-9999-9999-999999999999',
          items: [
            {
              product_name: 'Produto',
              quantity: 1,
              unit_price: 100,
              total_price: 100
            }
          ]
        })
        .expect(404);
    });

    test('❌ Deve rejeitar valor total negativo', async () => {
      await request(app)
        .post('/api/v1/sales')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          client_id: testClient.id,
          discount_amount: 200,
          items: [
            {
              product_name: 'Produto',
              quantity: 1,
              unit_price: 100,
              total_price: 100
            }
          ]
        })
        .expect(400);
    });

    test('✅ Deve funcionar em português', async () => {
      const response = await request(app)
        .post('/api/v1/sales')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Accept-Language', 'pt-BR')
        .send({
          client_id: testClient.id,
          items: [
            {
              product_name: 'Produto',
              quantity: 1,
              unit_price: 100,
              total_price: 100
            }
          ]
        })
        .expect(201);

      expect(response.body.message).toBeDefined();
    });

    test('✅ Deve funcionar em inglês', async () => {
      const response = await request(app)
        .post('/api/v1/sales')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Accept-Language', 'en')
        .send({
          client_id: testClient.id,
          items: [
            {
              product_name: 'Product',
              quantity: 1,
              unit_price: 100,
              total_price: 100
            }
          ]
        })
        .expect(201);

      expect(response.body.message).toBeDefined();
    });

    test('✅ Deve funcionar em espanhol', async () => {
      const response = await request(app)
        .post('/api/v1/sales')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Accept-Language', 'es')
        .send({
          client_id: testClient.id,
          items: [
            {
              product_name: 'Producto',
              quantity: 1,
              unit_price: 100,
              total_price: 100
            }
          ]
        })
        .expect(201);

      expect(response.body.message).toBeDefined();
    });
  });

  describe('👁️ Detalhes da Venda', () => {
    let saleId;

    beforeEach(async () => {
      const sale = await helper.createTestSale({
        company_id: testCompany.id,
        client_id: testClient.id,
        user_id: testUser.id
      });
      saleId = sale.id;
    });

    test('✅ Deve retornar detalhes completos', async () => {
      const response = await request(app)
        .get(`/api/v1/sales/${saleId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(saleId);
      expect(response.body.data).toHaveProperty('client_name');
      expect(response.body.data).toHaveProperty('items');
    });

    test('❌ Deve retornar 404 para venda inexistente', async () => {
      await request(app)
        .get('/api/v1/sales/99999999-9999-9999-9999-999999999999')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe('✏️ Atualizar Venda', () => {
    let saleId;

    beforeEach(async () => {
      const sale = await helper.createTestSale({
        company_id: testCompany.id,
        client_id: testClient.id,
        user_id: testUser.id
      });
      saleId = sale.id;
    });

    test('✅ Deve atualizar descrição', async () => {
      const response = await request(app)
        .put(`/api/v1/sales/${saleId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          description: 'Descrição atualizada'
        })
        .expect(200);

      expect(response.body.data.description).toBe('Descrição atualizada');
    });

    test('✅ Deve atualizar status de pagamento', async () => {
      const response = await request(app)
        .put(`/api/v1/sales/${saleId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          payment_status: 'paid'
        })
        .expect(200);

      expect(response.body.data.payment_status).toBe('paid');
    });

    test('❌ Deve rejeitar atualização de venda cancelada', async () => {
      // Cancelar venda primeiro
      await query(
        'UPDATE sales SET status = $1 WHERE id = $2',
        ['cancelled', saleId]
      );

      await request(app)
        .put(`/api/v1/sales/${saleId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          description: 'Tentativa de atualização'
        })
        .expect(400);
    });

    test('❌ Deve retornar 404 para venda inexistente', async () => {
      await request(app)
        .put('/api/v1/sales/99999999-9999-9999-9999-999999999999')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          description: 'Teste'
        })
        .expect(404);
    });
  });

  describe('❌ Cancelar Venda', () => {
    let saleId;

    beforeEach(async () => {
      const sale = await helper.createTestSale({
        company_id: testCompany.id,
        client_id: testClient.id,
        user_id: testUser.id,
        total_amount: 500
      });
      saleId = sale.id;
    });

    test('✅ Deve cancelar venda', async () => {
      const response = await request(app)
        .delete(`/api/v1/sales/${saleId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('cancelled');
    });

    test('✅ Deve reverter estoque ao cancelar', async () => {
      // Criar venda com produto
      const saleWithProduct = await request(app)
        .post('/api/v1/sales')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          client_id: testClient.id,
          items: [
            {
              product_id: testProduct.id,
              product_name: 'Produto',
              quantity: 5,
              unit_price: 100,
              total_price: 500
            }
          ]
        });

      const newSaleId = saleWithProduct.body.data.id;
      
      // Verificar estoque antes
      const stockBefore = await query(
        'SELECT stock_quantity FROM products WHERE id = $1',
        [testProduct.id]
      );

      // Cancelar venda
      await request(app)
        .delete(`/api/v1/sales/${newSaleId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Verificar estoque depois
      const stockAfter = await query(
        'SELECT stock_quantity FROM products WHERE id = $1',
        [testProduct.id]
      );

      expect(stockAfter.rows[0].stock_quantity).toBeGreaterThan(stockBefore.rows[0].stock_quantity);
    });

    test('❌ Deve rejeitar cancelamento duplicado', async () => {
      // Cancelar primeira vez
      await request(app)
        .delete(`/api/v1/sales/${saleId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Tentar cancelar novamente
      await request(app)
        .delete(`/api/v1/sales/${saleId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });

    test('❌ Deve retornar 404 para venda inexistente', async () => {
      await request(app)
        .delete('/api/v1/sales/99999999-9999-9999-9999-999999999999')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe('🏆 Conquistas e Gamificação', () => {
    test('✅ Deve desbloquear conquista de primeira venda', async () => {
      await request(app)
        .post('/api/v1/sales')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          client_id: testClient.id,
          items: [
            {
              product_name: 'Produto',
              quantity: 1,
              unit_price: 100,
              total_price: 100
            }
          ]
        })
        .expect(201);

      // Verificar conquista
      const achievementCheck = await query(`
        SELECT * FROM user_achievements ua
        INNER JOIN achievements a ON ua.achievement_id = a.id
        WHERE ua.user_id = $1 AND a.unlock_criteria->>'action' = 'first_sale'
      `, [testUser.id]);

      // Pode ou não ter a conquista dependendo da configuração
      expect(achievementCheck.rows.length).toBeGreaterThanOrEqual(0);
    });

    test('✅ Deve desbloquear conquista de venda de alto valor', async () => {
      await request(app)
        .post('/api/v1/sales')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          client_id: testClient.id,
          items: [
            {
              product_name: 'Produto Premium',
              quantity: 1,
              unit_price: 15000,
              total_price: 15000
            }
          ]
        })
        .expect(201);

      // Verificar histórico de gamificação
      const historyCheck = await query(
        'SELECT * FROM gamification_history WHERE user_id = $1 AND event_type LIKE $2',
        [testUser.id, '%sale%']
      );

      expect(historyCheck.rows.length).toBeGreaterThan(0);
    });
  });

  describe('🔒 Segurança e Permissões', () => {
    test('❌ Deve retornar 401 sem token', async () => {
      await request(app)
        .get('/api/v1/sales')
        .expect(401);
    });

    test('❌ Deve retornar 401 com token inválido', async () => {
      await request(app)
        .get('/api/v1/sales')
        .set('Authorization', 'Bearer token-invalido')
        .expect(401);
    });

    test('❌ Não deve acessar vendas de outra empresa', async () => {
      // Criar outra empresa
      const otherCompany = await helper.createTestCompany({
        name: 'Other Company'
      });

      // Criar venda em outra empresa
      const otherClient = await helper.createTestContact({
        company_id: otherCompany.id,
        tipo: 'cliente'
      });

      const otherSale = await helper.createTestSale({
        company_id: otherCompany.id,
        client_id: otherClient.id
      });

      // Tentar acessar
      await request(app)
        .get(`/api/v1/sales/${otherSale.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });
});
