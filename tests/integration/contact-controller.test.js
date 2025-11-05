/**
 * ==========================================
 * 🧪 TESTES DE INTEGRAÇÃO - CONTACT CONTROLLER
 * ==========================================
 * 
 * Testa todos os endpoints do ContactController
 * - CRUD completo de contatos
 * - Busca por identificadores
 * - Get-or-Create
 * - Get-or-Create com negociação
 * - Conversão Lead → Cliente
 * - Estatísticas
 */

const request = require('supertest');
const app = require('../../src/app');
const { query } = require('../../src/config/database');

describe('ContactController Integration Tests', () => {
  let authToken;
  let testUserId;
  let testCompanyId;
  let testContactId;

  // Setup: Criar usuário e fazer login
  beforeAll(async () => {
    // Limpar dados de teste
    await query('DELETE FROM polox.contacts WHERE phone = $1', ['5511999999999']);
    await query('DELETE FROM polox.contacts WHERE email = $1', ['teste@contactcontroller.com']);
    
    // Buscar usuário de teste existente
    const userResult = await query(
      'SELECT id, company_id FROM polox.users WHERE email = $1 LIMIT 1',
      ['polo@polox.com.br']
    );

    if (userResult.rows.length > 0) {
      testUserId = userResult.rows[0].id;
      testCompanyId = userResult.rows[0].company_id;

      // Fazer login para obter token
      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'polo@polox.com.br',
          password: 'M@eamor1122',
          rememberMe: false
        });

      authToken = loginResponse.body.data.token;
    }
  });

  // Cleanup após todos os testes
  afterAll(async () => {
    // Limpar contatos de teste criados
    if (testContactId) {
      await query('DELETE FROM polox.contacts WHERE id = $1', [testContactId]);
    }
    await query('DELETE FROM polox.contacts WHERE phone = $1', ['5511999999999']);
    await query('DELETE FROM polox.contacts WHERE email = $1', ['teste@contactcontroller.com']);
  });

  describe('POST /api/v1/contacts - Criar Contato', () => {
    it('deve criar um novo contato com sucesso', async () => {
      const response = await request(app)
        .post('/api/v1/contacts')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Accept-Language', 'pt')
        .send({
          nome: 'João Teste Controller',
          phone: '5511999999999',
          email: 'teste@contactcontroller.com',
          tipo: 'lead',
          origem: 'teste_automatizado'
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.nome).toBe('João Teste Controller');
      expect(response.body.data.phone).toBe('5511999999999');
      expect(response.body.data.tipo).toBe('lead');

      // Salvar ID para próximos testes
      testContactId = response.body.data.id;
    });

    it('deve retornar erro ao tentar criar contato sem nome', async () => {
      const response = await request(app)
        .post('/api/v1/contacts')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Accept-Language', 'pt')
        .send({
          phone: '5511888888888',
          email: 'semNome@teste.com'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('deve retornar erro ao tentar criar contato sem identificador', async () => {
      const response = await request(app)
        .post('/api/v1/contacts')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Accept-Language', 'pt')
        .send({
          nome: 'Teste Sem Identificador'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/contacts - Listar Contatos', () => {
    it('deve listar contatos com paginação', async () => {
      const response = await request(app)
        .get('/api/v1/contacts')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Accept-Language', 'pt')
        .query({
          limit: 10,
          offset: 0
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.pagination).toBeDefined();
      expect(response.body.pagination).toHaveProperty('totalItems');
    });

    it('deve filtrar contatos por tipo', async () => {
      const response = await request(app)
        .get('/api/v1/contacts')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Accept-Language', 'pt')
        .query({
          tipo: 'lead'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      
      // Verificar se todos são leads
      if (response.body.data.length > 0) {
        response.body.data.forEach(contact => {
          expect(contact.tipo).toBe('lead');
        });
      }
    });

    it('deve buscar contatos por texto', async () => {
      const response = await request(app)
        .get('/api/v1/contacts')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Accept-Language', 'pt')
        .query({
          search: 'João'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /api/v1/contacts/:id - Buscar Contato por ID', () => {
    it('deve buscar contato por ID com sucesso', async () => {
      const response = await request(app)
        .get(`/api/v1/contacts/${testContactId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('Accept-Language', 'pt');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(testContactId);
      expect(response.body.data.nome).toBe('João Teste Controller');
    });

    it('deve retornar 404 para contato inexistente', async () => {
      const response = await request(app)
        .get('/api/v1/contacts/999999')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Accept-Language', 'pt');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/contacts/search - Buscar por Identificador', () => {
    it('deve buscar contato por telefone', async () => {
      const response = await request(app)
        .get('/api/v1/contacts/search')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Accept-Language', 'pt')
        .query({
          phone: '5511999999999'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.found).toBe(true);
      expect(response.body.data.phone).toBe('5511999999999');
    });

    it('deve buscar contato por email', async () => {
      const response = await request(app)
        .get('/api/v1/contacts/search')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Accept-Language', 'pt')
        .query({
          email: 'teste@contactcontroller.com'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.found).toBe(true);
      expect(response.body.data.email).toBe('teste@contactcontroller.com');
    });

    it('deve retornar found=false para contato inexistente', async () => {
      const response = await request(app)
        .get('/api/v1/contacts/search')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Accept-Language', 'pt')
        .query({
          phone: '5511000000000'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.found).toBe(false);
      expect(response.body.data).toBeNull();
    });

    it('deve retornar erro sem parâmetros de busca', async () => {
      const response = await request(app)
        .get('/api/v1/contacts/search')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Accept-Language', 'pt');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/v1/contacts/:id - Atualizar Contato', () => {
    it('deve atualizar contato com sucesso', async () => {
      const response = await request(app)
        .put(`/api/v1/contacts/${testContactId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('Accept-Language', 'pt')
        .send({
          nome: 'João Teste Controller Atualizado',
          origem: 'teste_atualizado'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.nome).toBe('João Teste Controller Atualizado');
      expect(response.body.data.origem).toBe('teste_atualizado');
    });

    it('deve retornar 404 ao atualizar contato inexistente', async () => {
      const response = await request(app)
        .put('/api/v1/contacts/999999')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Accept-Language', 'pt')
        .send({
          nome: 'Teste'
        });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/contacts/get-or-create - Get or Create', () => {
    it('deve retornar contato existente', async () => {
      const response = await request(app)
        .post('/api/v1/contacts/get-or-create')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Accept-Language', 'pt')
        .send({
          phone: '5511999999999',
          nome: 'João Teste'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.created).toBe(false);
      expect(response.body.data.phone).toBe('5511999999999');
    });

    it('deve criar novo contato se não existir', async () => {
      const uniquePhone = `5511${Date.now()}`;
      
      const response = await request(app)
        .post('/api/v1/contacts/get-or-create')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Accept-Language', 'pt')
        .send({
          phone: uniquePhone,
          nome: 'Novo Contato Teste',
          email: `novo${Date.now()}@teste.com`
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.created).toBe(true);
      expect(response.body.data.phone).toBe(uniquePhone);

      // Limpar contato criado
      await query('DELETE FROM polox.contacts WHERE phone = $1', [uniquePhone]);
    });
  });

  describe('POST /api/v1/contacts/get-or-create-with-negotiation - Get or Create com Deal', () => {
    it('deve criar contato e negociação com sucesso', async () => {
      const uniquePhone = `5511${Date.now()}`;
      
      const response = await request(app)
        .post('/api/v1/contacts/get-or-create-with-negotiation')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Accept-Language', 'pt')
        .send({
          phone: uniquePhone,
          nome: 'Contato com Deal',
          email: `deal${Date.now()}@teste.com`,
          origem_lp: 'Landing Page Teste',
          valor_estimado: 100000,
          deal_title: 'Negociação Teste',
          deal_stage: 'novo'
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('contact');
      expect(response.body.data).toHaveProperty('deal');
      expect(response.body.data.contact.phone).toBe(uniquePhone);
      expect(response.body.data.deal.titulo).toBe('Negociação Teste');
      expect(response.body.data.deal.valor_total_cents).toBe(100000);

      // Limpar dados criados
      await query('DELETE FROM polox.deals WHERE contato_id = $1', [response.body.data.contact.id]);
      await query('DELETE FROM polox.contacts WHERE phone = $1', [uniquePhone]);
    });

    it('deve criar nova negociação para contato existente', async () => {
      const response = await request(app)
        .post('/api/v1/contacts/get-or-create-with-negotiation')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Accept-Language', 'pt')
        .send({
          phone: '5511999999999',
          nome: 'João Teste Controller',
          origem_lp: 'Segunda Oportunidade',
          valor_estimado: 200000,
          deal_title: 'Segunda Negociação'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.contact.action).toBe('found');
      expect(response.body.data.deal.titulo).toBe('Segunda Negociação');

      // Limpar deal criado
      await query('DELETE FROM polox.deals WHERE id = $1', [response.body.data.deal.id]);
    });

    it('deve retornar erro sem nome', async () => {
      const response = await request(app)
        .post('/api/v1/contacts/get-or-create-with-negotiation')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Accept-Language', 'pt')
        .send({
          phone: '5511777777777'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/contacts/:id/convert - Converter Lead em Cliente', () => {
    it('deve converter lead em cliente', async () => {
      const response = await request(app)
        .post(`/api/v1/contacts/${testContactId}/convert`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('Accept-Language', 'pt');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.tipo).toBe('cliente');
    });

    it('deve retornar erro ao tentar converter cliente novamente', async () => {
      const response = await request(app)
        .post(`/api/v1/contacts/${testContactId}/convert`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('Accept-Language', 'pt');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('deve retornar 404 para contato inexistente', async () => {
      const response = await request(app)
        .post('/api/v1/contacts/999999/convert')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Accept-Language', 'pt');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/v1/contacts/stats - Estatísticas', () => {
    it('deve retornar estatísticas de contatos', async () => {
      const response = await request(app)
        .get('/api/v1/contacts/stats')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Accept-Language', 'pt');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('total');
      expect(response.body.data).toHaveProperty('total_leads');
      expect(response.body.data).toHaveProperty('total_clientes');
    });
  });

  describe('DELETE /api/v1/contacts/:id - Excluir Contato', () => {
    it('deve excluir contato (soft delete)', async () => {
      const response = await request(app)
        .delete(`/api/v1/contacts/${testContactId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('Accept-Language', 'pt');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verificar se foi soft delete
      const checkResult = await query(
        'SELECT deleted_at FROM polox.contacts WHERE id = $1',
        [testContactId]
      );
      expect(checkResult.rows[0].deleted_at).not.toBeNull();
    });

    it('deve retornar 404 ao excluir contato inexistente', async () => {
      const response = await request(app)
        .delete('/api/v1/contacts/999999')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Accept-Language', 'pt');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Testes de Autenticação', () => {
    it('deve retornar 401 sem token de autenticação', async () => {
      const response = await request(app)
        .get('/api/v1/contacts')
        .set('Accept-Language', 'pt');

      expect(response.status).toBe(401);
    });

    it('deve retornar 401 com token inválido', async () => {
      const response = await request(app)
        .get('/api/v1/contacts')
        .set('Authorization', 'Bearer token_invalido')
        .set('Accept-Language', 'pt');

      expect(response.status).toBe(401);
    });
  });
});
