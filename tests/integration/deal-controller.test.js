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
 * 🧪 TESTES DE INTEGRAÇÃO - DEAL CONTROLLER
 * ==========================================
 * 
 * Testa todos os endpoints do DealController
 * - CRUD completo de negociações
 * - Pipeline/funil de vendas
 * - Conversão Lead → Cliente (markAsWon)
 * - Estatísticas e métricas
 * - Validações e permissões
 * - i18n (pt-BR, en, es)
 */

const request = require('supertest');
const app = require('../../src/server');
const { query } = require('../../src/config/database');
const { DatabaseHelper } = require('../helpers/database');

describe('💼 Deal Controller Integration Tests', () => {
  let helper;
  let authToken;
  let testUser;
  let testCompany;
  let testContact;
  let testLead;

  beforeAll(async () => {
    helper = new DatabaseHelper(global.testPool);
    
    // Criar empresa de teste
    testCompany = await helper.createTestCompany({
      name: 'Deal Test Company'
    });

    // Criar usuário de teste
    testUser = await helper.createTestUser({
      email: 'deal@test.com',
      password: 'Test@123',
      companyId: testCompany.id
    });

    // Fazer login
    const loginResponse = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'deal@test.com',
        password: 'Test@123'
      });

    authToken = loginResponse.body.token;

    // Criar contato de teste (lead)
    testLead = await helper.createTestContact({
      company_id: testCompany.id,
      nome: 'Lead Teste',
      email: 'lead@test.com',
      tipo: 'lead'
    });

    // Criar contato cliente
    testContact = await helper.createTestContact({
      company_id: testCompany.id,
      nome: 'Cliente Teste',
      email: 'cliente@test.com',
      tipo: 'cliente'
    });
  });

  afterAll(async () => {
    await helper.cleanup();
  });

  beforeEach(async () => {
    // Limpar negociações
    await query(
      'DELETE FROM deals WHERE company_id = $1',
      [testCompany.id]
    );
  });

  describe('📋 Listar Negociações', () => {
    test('✅ Deve listar negociações com paginação', async () => {
      // Criar 15 deals
      for (let i = 0; i < 15; i++) {
        await helper.createTestDeal({
          company_id: testCompany.id,
          contato_id: testLead.id,
          titulo: `Deal ${i + 1}`,
          valor_total_cents: 100000 * (i + 1)
        });
      }

      const response = await request(app)
        .get('/api/v1/deals')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ limit: 10, offset: 0 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(10);
      expect(response.body.pagination.totalItems).toBe(15);
    });

    test('✅ Deve filtrar por contato', async () => {
      await helper.createTestDeal({
        company_id: testCompany.id,
        contato_id: testLead.id,
        titulo: 'Deal do Lead'
      });

      const response = await request(app)
        .get('/api/v1/deals')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ contato_id: testLead.id })
        .expect(200);

      expect(response.body.data.length).toBeGreaterThan(0);
      expect(response.body.data[0].contato_id).toBe(testLead.id);
    });

    test('✅ Deve filtrar por etapa do funil', async () => {
      await helper.createTestDeal({
        company_id: testCompany.id,
        contato_id: testLead.id,
        etapa_funil: 'negociacao'
      });

      const response = await request(app)
        .get('/api/v1/deals')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ etapa_funil: 'negociacao' })
        .expect(200);

      expect(response.body.data.every(d => d.etapa_funil === 'negociacao')).toBe(true);
    });

    test('✅ Deve filtrar por status (open/won/lost)', async () => {
      // Criar deal aberto
      await helper.createTestDeal({
        company_id: testCompany.id,
        contato_id: testLead.id,
        closed_at: null
      });

      // Criar deal ganho
      await helper.createTestDeal({
        company_id: testCompany.id,
        contato_id: testLead.id,
        closed_at: new Date(),
        closed_reason: 'won'
      });

      const response = await request(app)
        .get('/api/v1/deals')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ status: 'open' })
        .expect(200);

      expect(response.body.data.every(d => !d.closed_at)).toBe(true);
    });

    test('✅ Deve buscar por termo', async () => {
      await helper.createTestDeal({
        company_id: testCompany.id,
        contato_id: testLead.id,
        titulo: 'Venda especial de software'
      });

      const response = await request(app)
        .get('/api/v1/deals')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ search: 'software' })
        .expect(200);

      expect(response.body.data.length).toBeGreaterThan(0);
    });

    test('✅ Deve ordenar por diferentes campos', async () => {
      const response = await request(app)
        .get('/api/v1/deals')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ sort_by: 'valor_total_cents', sort_order: 'desc' })
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('➕ Criar Negociação', () => {
    test('✅ Deve criar negociação com dados mínimos', async () => {
      const dealData = {
        contato_id: testLead.id,
        titulo: 'Nova oportunidade',
        valor_total_cents: 50000
      };

      const response = await request(app)
        .post('/api/v1/deals')
        .set('Authorization', `Bearer ${authToken}`)
        .send(dealData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.titulo).toBe('Nova oportunidade');
      expect(response.body.data.valor_total_cents).toBe(50000);
    });

    test('✅ Deve criar negociação com todos os campos', async () => {
      const dealData = {
        contato_id: testLead.id,
        titulo: 'Oportunidade Completa',
        descricao: 'Descrição detalhada',
        etapa_funil: 'proposta',
        valor_total_cents: 100000,
        probabilidade: 75,
        origem: 'website',
        expected_close_date: '2025-12-31',
        owner_id: testUser.id,
        metadata: {
          produto: 'Software XYZ',
          plano: 'Enterprise'
        }
      };

      const response = await request(app)
        .post('/api/v1/deals')
        .set('Authorization', `Bearer ${authToken}`)
        .send(dealData)
        .expect(201);

      expect(response.body.data.titulo).toBe('Oportunidade Completa');
      expect(response.body.data.probabilidade).toBe(75);
      expect(response.body.data.metadata).toBeDefined();
    });

    test('✅ Deve aceitar valor em string e converter', async () => {
      const dealData = {
        contato_id: testLead.id,
        titulo: 'Deal com string',
        valor_total_cents: '75000'
      };

      const response = await request(app)
        .post('/api/v1/deals')
        .set('Authorization', `Bearer ${authToken}`)
        .send(dealData)
        .expect(201);

      expect(response.body.data.valor_total_cents).toBe(75000);
    });

    test('❌ Deve rejeitar sem contato', async () => {
      await request(app)
        .post('/api/v1/deals')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          titulo: 'Deal sem contato'
        })
        .expect(400);
    });

    test('❌ Deve rejeitar sem título', async () => {
      await request(app)
        .post('/api/v1/deals')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          contato_id: testLead.id
        })
        .expect(400);
    });

    test('❌ Deve rejeitar contato inexistente', async () => {
      await request(app)
        .post('/api/v1/deals')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          contato_id: 999999,
          titulo: 'Deal inválido'
        })
        .expect(404);
    });

    test('❌ Deve rejeitar probabilidade fora do range 0-100', async () => {
      await request(app)
        .post('/api/v1/deals')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          contato_id: testLead.id,
          titulo: 'Deal',
          probabilidade: 150
        })
        .expect(400);
    });

    test('❌ Deve rejeitar valor negativo', async () => {
      await request(app)
        .post('/api/v1/deals')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          contato_id: testLead.id,
          titulo: 'Deal',
          valor_total_cents: -1000
        })
        .expect(400);
    });

    test('✅ Deve funcionar em português', async () => {
      const response = await request(app)
        .post('/api/v1/deals')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Accept-Language', 'pt-BR')
        .send({
          contato_id: testLead.id,
          titulo: 'Negociação PT'
        })
        .expect(201);

      expect(response.body.message).toBeDefined();
    });

    test('✅ Deve funcionar em inglês', async () => {
      const response = await request(app)
        .post('/api/v1/deals')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Accept-Language', 'en')
        .send({
          contato_id: testLead.id,
          titulo: 'Deal EN'
        })
        .expect(201);

      expect(response.body.message).toBeDefined();
    });

    test('✅ Deve funcionar em espanhol', async () => {
      const response = await request(app)
        .post('/api/v1/deals')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Accept-Language', 'es')
        .send({
          contato_id: testLead.id,
          titulo: 'Negocio ES'
        })
        .expect(201);

      expect(response.body.message).toBeDefined();
    });
  });

  describe('👁️ Detalhes da Negociação', () => {
    let dealId;

    beforeEach(async () => {
      const deal = await helper.createTestDeal({
        company_id: testCompany.id,
        contato_id: testLead.id,
        titulo: 'Deal Teste'
      });
      dealId = deal.id;
    });

    test('✅ Deve retornar detalhes completos', async () => {
      const response = await request(app)
        .get(`/api/v1/deals/${dealId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(dealId);
      expect(response.body.data).toHaveProperty('titulo');
    });

    test('❌ Deve retornar 404 para deal inexistente', async () => {
      await request(app)
        .get('/api/v1/deals/999999')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe('📋 Listar Deals de um Contato', () => {
    test('✅ Deve listar todos os deals de um contato', async () => {
      // Criar múltiplos deals para o mesmo contato
      for (let i = 0; i < 3; i++) {
        await helper.createTestDeal({
          company_id: testCompany.id,
          contato_id: testLead.id,
          titulo: `Deal ${i + 1}`
        });
      }

      const response = await request(app)
        .get(`/api/v1/contacts/${testLead.id}/deals`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data).toHaveLength(3);
      expect(response.body.data.every(d => d.contato_id === testLead.id)).toBe(true);
    });
  });

  describe('✏️ Atualizar Negociação', () => {
    let dealId;

    beforeEach(async () => {
      const deal = await helper.createTestDeal({
        company_id: testCompany.id,
        contato_id: testLead.id,
        titulo: 'Deal Original'
      });
      dealId = deal.id;
    });

    test('✅ Deve atualizar título', async () => {
      const response = await request(app)
        .put(`/api/v1/deals/${dealId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          titulo: 'Título Atualizado'
        })
        .expect(200);

      expect(response.body.data.titulo).toBe('Título Atualizado');
    });

    test('✅ Deve atualizar valor', async () => {
      const response = await request(app)
        .put(`/api/v1/deals/${dealId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          valor_total_cents: 250000
        })
        .expect(200);

      expect(response.body.data.valor_total_cents).toBe(250000);
    });

    test('✅ Deve atualizar probabilidade', async () => {
      const response = await request(app)
        .put(`/api/v1/deals/${dealId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          probabilidade: 90
        })
        .expect(200);

      expect(response.body.data.probabilidade).toBe(90);
    });

    test('❌ Deve retornar 404 para deal inexistente', async () => {
      await request(app)
        .put('/api/v1/deals/999999')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          titulo: 'Teste'
        })
        .expect(404);
    });
  });

  describe('🔄 Mover Etapa do Funil', () => {
    let dealId;

    beforeEach(async () => {
      const deal = await helper.createTestDeal({
        company_id: testCompany.id,
        contato_id: testLead.id,
        etapa_funil: 'novo'
      });
      dealId = deal.id;
    });

    test('✅ Deve mover para próxima etapa', async () => {
      const response = await request(app)
        .put(`/api/v1/deals/${dealId}/stage`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          etapa_funil: 'qualificado'
        })
        .expect(200);

      expect(response.body.data.etapa_funil).toBe('qualificado');
    });

    test('✅ Deve permitir mover para qualquer etapa', async () => {
      const stages = ['novo', 'qualificado', 'proposta', 'negociacao', 'fechado'];

      for (const stage of stages) {
        const response = await request(app)
          .put(`/api/v1/deals/${dealId}/stage`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            etapa_funil: stage
          })
          .expect(200);

        expect(response.body.data.etapa_funil).toBe(stage);
      }
    });

    test('❌ Deve rejeitar sem etapa', async () => {
      await request(app)
        .put(`/api/v1/deals/${dealId}/stage`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(400);
    });
  });

  describe('✅ Marcar como Ganho (Won)', () => {
    let dealId;

    beforeEach(async () => {
      const deal = await helper.createTestDeal({
        company_id: testCompany.id,
        contato_id: testLead.id,
        titulo: 'Deal para ganhar',
        valor_total_cents: 150000
      });
      dealId = deal.id;
    });

    test('✅ Deve marcar deal como ganho', async () => {
      const response = await request(app)
        .put(`/api/v1/deals/${dealId}/win`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.closed_at).not.toBeNull();
      expect(response.body.data.closed_reason).toBe('won');
    });

    test('✅ Deve converter Lead em Cliente automaticamente', async () => {
      await request(app)
        .put(`/api/v1/deals/${dealId}/win`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Verificar se lead virou cliente
      const contactCheck = await query(
        'SELECT tipo, lifetime_value_cents FROM polox.contacts WHERE id = $1',
        [testLead.id]
      );

      expect(contactCheck.rows[0].tipo).toBe('cliente');
      expect(parseInt(contactCheck.rows[0].lifetime_value_cents)).toBeGreaterThan(0);
    });

    test('❌ Deve retornar 404 para deal inexistente', async () => {
      await request(app)
        .put('/api/v1/deals/999999/win')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe('❌ Marcar como Perdido (Lost)', () => {
    let dealId;

    beforeEach(async () => {
      const deal = await helper.createTestDeal({
        company_id: testCompany.id,
        contato_id: testLead.id,
        titulo: 'Deal para perder'
      });
      dealId = deal.id;
    });

    test('✅ Deve marcar deal como perdido', async () => {
      const response = await request(app)
        .put(`/api/v1/deals/${dealId}/lose`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          reason: 'Preço muito alto'
        })
        .expect(200);

      expect(response.body.data.closed_at).not.toBeNull();
      expect(response.body.data.closed_reason).toBe('lost');
    });

    test('✅ Deve aceitar motivo da perda', async () => {
      const response = await request(app)
        .put(`/api/v1/deals/${dealId}/lose`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          reason: 'Concorrente ofereceu melhor preço'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    test('✅ Deve permitir perder sem motivo', async () => {
      const response = await request(app)
        .put(`/api/v1/deals/${dealId}/lose`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('🔓 Reabrir Negociação', () => {
    let dealId;

    beforeEach(async () => {
      const deal = await helper.createTestDeal({
        company_id: testCompany.id,
        contato_id: testLead.id,
        closed_at: new Date(),
        closed_reason: 'lost'
      });
      dealId = deal.id;
    });

    test('✅ Deve reabrir deal fechado', async () => {
      const response = await request(app)
        .put(`/api/v1/deals/${dealId}/reopen`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.closed_at).toBeNull();
      expect(response.body.data.closed_reason).toBeNull();
    });

    test('❌ Deve retornar 404 para deal inexistente', async () => {
      await request(app)
        .put('/api/v1/deals/999999/reopen')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe('🗑️ Deletar Negociação', () => {
    let dealId;

    beforeEach(async () => {
      const deal = await helper.createTestDeal({
        company_id: testCompany.id,
        contato_id: testLead.id
      });
      dealId = deal.id;
    });

    test('✅ Deve fazer soft delete', async () => {
      const response = await request(app)
        .delete(`/api/v1/deals/${dealId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verificar soft delete
      const deletedCheck = await query(
        'SELECT deleted_at FROM deals WHERE id = $1',
        [dealId]
      );

      expect(deletedCheck.rows[0].deleted_at).not.toBeNull();
    });

    test('❌ Deve retornar 404 para deal inexistente', async () => {
      await request(app)
        .delete('/api/v1/deals/999999')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe('📊 Estatísticas do Funil', () => {
    beforeEach(async () => {
      // Criar deals em diferentes etapas
      await helper.createTestDeal({
        company_id: testCompany.id,
        contato_id: testLead.id,
        etapa_funil: 'novo',
        valor_total_cents: 50000
      });

      await helper.createTestDeal({
        company_id: testCompany.id,
        contato_id: testLead.id,
        etapa_funil: 'proposta',
        valor_total_cents: 100000
      });

      await helper.createTestDeal({
        company_id: testCompany.id,
        contato_id: testLead.id,
        closed_at: new Date(),
        closed_reason: 'won',
        valor_total_cents: 150000
      });
    });

    test('✅ Deve retornar estatísticas do funil', async () => {
      const response = await request(app)
        .get('/api/v1/deals/stats')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
    });

    test('✅ Deve filtrar estatísticas por etapa', async () => {
      const response = await request(app)
        .get('/api/v1/deals/stats')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ etapa_funil: 'proposta' })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    test('✅ Deve filtrar estatísticas por origem', async () => {
      const response = await request(app)
        .get('/api/v1/deals/stats')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ origem: 'website' })
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('🔒 Segurança e Permissões', () => {
    test('❌ Deve retornar 401 sem token', async () => {
      await request(app)
        .get('/api/v1/deals')
        .expect(401);
    });

    test('❌ Deve retornar 401 com token inválido', async () => {
      await request(app)
        .get('/api/v1/deals')
        .set('Authorization', 'Bearer token-invalido')
        .expect(401);
    });

    test('❌ Não deve acessar deals de outra empresa', async () => {
      // Criar outra empresa
      const otherCompany = await helper.createTestCompany({
        name: 'Other Company'
      });

      // Criar deal em outra empresa
      const otherContact = await helper.createTestContact({
        company_id: otherCompany.id,
        tipo: 'lead'
      });

      const otherDeal = await helper.createTestDeal({
        company_id: otherCompany.id,
        contato_id: otherContact.id
      });

      // Tentar acessar
      await request(app)
        .get(`/api/v1/deals/${otherDeal.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });
});
