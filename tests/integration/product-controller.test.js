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
 * 🧪 TESTES DE INTEGRAÇÃO - PRODUCT CONTROLLER
 * ==========================================
 * 
 * Testa todos os endpoints do ProductController
 * - CRUD completo de produtos
 * - Gestão de estoque
 * - Categorias de produtos
 * - Relatórios e estatísticas
 * - Validações e permissões
 */

const request = require('supertest');
const app = require('../../src/server');
const { query } = require('../../src/config/database');
const { DatabaseHelper } = require('../helpers/database');

describe('📦 Product Controller Integration Tests', () => {
  let helper;
  let authToken;
  let testUser;
  let testCompany;
  let testCategory;

  beforeAll(async () => {
    helper = new DatabaseHelper(global.testPool);
    
    testCompany = await helper.createTestCompany({ name: 'Product Test Company' });
    testUser = await helper.createTestUser({
      email: 'product@test.com',
      password: 'Test@123',
      companyId: testCompany.id
    });

    const loginResponse = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'product@test.com', password: 'Test@123' });

    authToken = loginResponse.body.token;
  });

  afterAll(async () => {
    await helper.cleanup();
  });

  beforeEach(async () => {
    await query('DELETE FROM polox.products WHERE company_id = $1', [testCompany.id]);
    await query('DELETE FROM polox.product_categories WHERE company_id = $1', [testCompany.id]);
  });

  describe('📋 Listar Produtos', () => {
    test('✅ Deve listar produtos com paginação', async () => {
      for (let i = 0; i < 25; i++) {
        await helper.createTestProduct({
          company_id: testCompany.id,
          name: `Produto ${i + 1}`,
          price: 100 * (i + 1)
        });
      }

      const response = await request(app)
        .get('/api/v1/products')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ page: 1, limit: 10 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(10);
      expect(response.body.pagination.total).toBe(25);
    });

    test('✅ Deve filtrar por categoria', async () => {
      testCategory = await helper.createTestProductCategory({
        company_id: testCompany.id,
        name: 'Eletrônicos'
      });

      await helper.createTestProduct({
        company_id: testCompany.id,
        name: 'Produto com categoria',
        category_id: testCategory.id
      });

      const response = await request(app)
        .get('/api/v1/products')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ category_id: testCategory.id })
        .expect(200);

      expect(response.body.data.every(p => p.category_id === testCategory.id)).toBe(true);
    });

    test('✅ Deve buscar por termo', async () => {
      await helper.createTestProduct({
        company_id: testCompany.id,
        name: 'Notebook Dell XPS'
      });

      const response = await request(app)
        .get('/api/v1/products')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ search: 'notebook' })
        .expect(200);

      expect(response.body.data.length).toBeGreaterThan(0);
    });

    test('✅ Deve filtrar produtos com estoque baixo', async () => {
      await helper.createTestProduct({
        company_id: testCompany.id,
        name: 'Produto Estoque Baixo',
        stock_quantity: 5,
        min_stock_level: 10
      });

      const response = await request(app)
        .get('/api/v1/products')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ low_stock: 'true' })
        .expect(200);

      expect(response.body.data.length).toBeGreaterThan(0);
    });
  });

  describe('➕ Criar Produto', () => {
    test('✅ Deve criar produto com dados mínimos', async () => {
      const productData = {
        name: 'Produto Teste',
        price: 99.90
      };

      const response = await request(app)
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${authToken}`)
        .send(productData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe('Produto Teste');
      expect(response.body.data.price).toBe(99.90);
    });

    test('✅ Deve criar produto completo', async () => {
      const productData = {
        name: 'Produto Completo',
        description: 'Descrição detalhada',
        sku: 'SKU-001',
        type: 'product',
        price: 299.90,
        cost_price: 150.00,
        current_stock: 100,
        min_stock: 10,
        unit: 'un',
        weight: 1.5,
        dimensions: {
          length: 30,
          width: 20,
          height: 10
        }
      };

      const response = await request(app)
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${authToken}`)
        .send(productData)
        .expect(201);

      expect(response.body.data.sku).toBe('SKU-001');
      expect(response.body.data.current_stock).toBe(100);
    });

    test('❌ Deve rejeitar sem nome', async () => {
      await request(app)
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ price: 100 })
        .expect(400);
    });

    test('❌ Deve rejeitar sem preço', async () => {
      await request(app)
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Produto' })
        .expect(400);
    });

    test('❌ Deve rejeitar preço negativo', async () => {
      await request(app)
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Produto', price: -10 })
        .expect(400);
    });
  });

  describe('✏️ Atualizar Produto', () => {
    let productId;

    beforeEach(async () => {
      const product = await helper.createTestProduct({
        company_id: testCompany.id,
        name: 'Produto Original'
      });
      productId = product.id;
    });

    test('✅ Deve atualizar nome', async () => {
      const response = await request(app)
        .put(`/api/v1/products/${productId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Nome Atualizado' })
        .expect(200);

      expect(response.body.data.name).toBe('Nome Atualizado');
    });

    test('✅ Deve atualizar preço', async () => {
      const response = await request(app)
        .put(`/api/v1/products/${productId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ price: 199.90 })
        .expect(200);

      expect(response.body.data.price).toBe(199.90);
    });

    test('❌ Deve retornar 404 para produto inexistente', async () => {
      await request(app)
        .put('/api/v1/products/99999999-9999-9999-9999-999999999999')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Teste' })
        .expect(404);
    });
  });

  describe('📦 Gestão de Estoque', () => {
    let productId;

    beforeEach(async () => {
      const product = await helper.createTestProduct({
        company_id: testCompany.id,
        name: 'Produto Estoque',
        stock_quantity: 100
      });
      productId = product.id;
    });

    test('✅ Deve adicionar estoque (entrada)', async () => {
      const response = await request(app)
        .post(`/api/v1/products/${productId}/stock`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          type: 'in',
          quantity: 50,
          reason: 'Compra de fornecedor'
        })
        .expect(200);

      expect(response.body.data.stock_quantity).toBe(150);
    });

    test('✅ Deve remover estoque (saída)', async () => {
      const response = await request(app)
        .post(`/api/v1/products/${productId}/stock`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          type: 'out',
          quantity: 30,
          reason: 'Venda'
        })
        .expect(200);

      expect(response.body.data.stock_quantity).toBe(70);
    });

    test('✅ Deve definir estoque absoluto', async () => {
      const response = await request(app)
        .post(`/api/v1/products/${productId}/stock`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          type: 'set',
          quantity: 200,
          reason: 'Inventário'
        })
        .expect(200);

      expect(response.body.data.stock_quantity).toBe(200);
    });

    test('❌ Deve rejeitar ajuste sem motivo', async () => {
      await request(app)
        .post(`/api/v1/products/${productId}/stock`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          type: 'in',
          quantity: 10
        })
        .expect(400);
    });
  });

  describe('🗑️ Deletar Produto', () => {
    let productId;

    beforeEach(async () => {
      const product = await helper.createTestProduct({
        company_id: testCompany.id,
        name: 'Produto para Deletar'
      });
      productId = product.id;
    });

    test('✅ Deve fazer soft delete', async () => {
      await request(app)
        .delete(`/api/v1/products/${productId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const deletedCheck = await query(
        'SELECT deleted_at FROM polox.products WHERE id = $1',
        [productId]
      );

      expect(deletedCheck.rows[0].deleted_at).not.toBeNull();
    });
  });

  describe('📂 Categorias de Produtos', () => {
    test('✅ Deve listar categorias', async () => {
      const response = await request(app)
        .get('/api/v1/products/categories')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    test('✅ Deve criar categoria', async () => {
      const response = await request(app)
        .post('/api/v1/products/categories')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Nova Categoria',
          description: 'Descrição da categoria'
        })
        .expect(201);

      expect(response.body.data.name).toBe('Nova Categoria');
    });

    test('❌ Deve rejeitar categoria duplicada', async () => {
      await request(app)
        .post('/api/v1/products/categories')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Categoria Teste' })
        .expect(201);

      await request(app)
        .post('/api/v1/products/categories')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Categoria Teste' })
        .expect(400);
    });
  });

  describe('🔒 Segurança e Permissões', () => {
    test('❌ Deve retornar 401 sem token', async () => {
      await request(app)
        .get('/api/v1/products')
        .expect(401);
    });

    test('❌ Não deve acessar produtos de outra empresa', async () => {
      const otherCompany = await helper.createTestCompany({ name: 'Other Company' });
      const otherProduct = await helper.createTestProduct({
        company_id: otherCompany.id,
        name: 'Produto Outra Empresa'
      });

      await request(app)
        .get(`/api/v1/products/${otherProduct.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe('🌍 Internacionalização', () => {
    test('✅ Deve funcionar em português', async () => {
      const response = await request(app)
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Accept-Language', 'pt-BR')
        .send({ name: 'Produto PT', price: 100 })
        .expect(201);

      expect(response.body.message).toBeDefined();
    });

    test('✅ Deve funcionar em inglês', async () => {
      const response = await request(app)
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Accept-Language', 'en')
        .send({ name: 'Product EN', price: 100 })
        .expect(201);

      expect(response.body.message).toBeDefined();
    });
  });
});
