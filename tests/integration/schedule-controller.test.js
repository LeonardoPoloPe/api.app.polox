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
 * 🧪 TESTES INTEGRAÇÃO - SCHEDULE CONTROLLER
 * ==========================================
 *
 * Testa todas as funcionalidades do sistema de agendamentos
 * - CRUD completo de eventos
 * - Filtros e busca
 * - Validações
 * - Soft delete
 * - Permissões
 * - Estatísticas
 */

const request = require("supertest");
const app = global.app || require("../../src/app");
const dbHelper = require("../helpers/database");

describe("🧪 Schedule Controller Integration Tests", () => {
  let testData = {};

  beforeAll(async () => {
    // Criar empresa e usuário de teste
    testData.company = await dbHelper.createTestCompany({
      company_name: "Test Schedule Company",
      company_domain: "test-schedule",
      slug: "test-schedule-company",
    });

    testData.user = await dbHelper.createTestUser(testData.company.id, {
      full_name: "Schedule Tester",
      email: "schedule@test.com",
      password: "Test@123",
    });

    // Fazer login para obter token
    const loginResponse = await request(app).post("/api/v1/auth/login").send({
      email: "schedule@test.com",
      password: "Test@123",
    });

    testData.token = loginResponse.body.token;
    testData.headers = {
      Authorization: `Bearer ${testData.token}`,
      "Accept-Language": "pt",
    };
  });

  afterAll(async () => {
    // Limpeza é feita automaticamente pelo Jest setup
  });

  describe("📋 GET /schedule/events - Listar Eventos", () => {
    test("deve retornar lista vazia inicialmente", async () => {
      const response = await request(app)
        .get("/api/v1/schedule/events")
        .set(testData.headers)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual([]);
      expect(response.body.pagination.totalItems).toBe(0);
    });

    test("deve rejeitar acesso sem token", async () => {
      await request(app).get("/api/v1/schedule/events").expect(401);
    });
  });

  describe("➕ POST /schedule/events - Criar Evento", () => {
    test("deve criar evento válido com sucesso", async () => {
      const eventData = {
        title: "Reunião de Teste",
        description: "Teste automatizado",
        start_datetime: "2025-12-01T14:00:00Z",
        end_datetime: "2025-12-01T15:00:00Z",
        event_type: "meeting",
        event_location: "Sala 1",
        meeting_link: "https://meet.google.com/test",
      };

      const response = await request(app)
        .post("/api/v1/schedule/events")
        .set(testData.headers)
        .send(eventData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe(eventData.title);
      expect(response.body.data.event_type).toBe(eventData.event_type);
      expect(response.body.data.company_id).toBe(
        testData.company.id.toString()
      );
      expect(response.body.data.user_id).toBe(testData.user.id.toString());

      // Salvar ID para outros testes
      testData.eventId = response.body.data.id;
    });

    test("deve validar campos obrigatórios", async () => {
      const response = await request(app)
        .post("/api/v1/schedule/events")
        .set(testData.headers)
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("required");
    });

    test("deve validar data fim maior que data início", async () => {
      const eventData = {
        title: "Evento Inválido",
        start_datetime: "2025-12-01T15:00:00Z",
        end_datetime: "2025-12-01T14:00:00Z", // Data fim menor
      };

      const response = await request(app)
        .post("/api/v1/schedule/events")
        .set(testData.headers)
        .send(eventData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    test("deve validar event_type válido", async () => {
      const eventData = {
        title: "Evento Tipo Inválido",
        start_datetime: "2025-12-01T14:00:00Z",
        end_datetime: "2025-12-01T15:00:00Z",
        event_type: "invalid_type",
      };

      const response = await request(app)
        .post("/api/v1/schedule/events")
        .set(testData.headers)
        .send(eventData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe("🔍 GET /schedule/events/:id - Buscar Evento", () => {
    test("deve retornar evento por ID válido", async () => {
      const response = await request(app)
        .get(`/api/v1/schedule/events/${testData.eventId}`)
        .set(testData.headers)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(testData.eventId);
      expect(response.body.data.title).toBe("Reunião de Teste");
      expect(response.body.data.organizer_name).toBe("Schedule Tester");
    });

    test("deve retornar 404 para evento inexistente", async () => {
      await request(app)
        .get("/api/v1/schedule/events/99999")
        .set(testData.headers)
        .expect(404);
    });
  });

  describe("✏️ PUT /schedule/events/:id - Atualizar Evento", () => {
    test("deve atualizar evento com sucesso", async () => {
      const updateData = {
        title: "Reunião Atualizada",
        description: "Descrição atualizada",
        event_location: "Sala 2",
      };

      const response = await request(app)
        .put(`/api/v1/schedule/events/${testData.eventId}`)
        .set(testData.headers)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.title).toBe(updateData.title);
      expect(response.body.data.description).toBe(updateData.description);
      expect(response.body.data.event_location).toBe(updateData.event_location);
    });

    test("deve rejeitar atualização de evento de outro usuário", async () => {
      // Criar outro usuário
      const otherUser = await dbHelper.createTestUser(testData.company.id, {
        full_name: "Other User",
        email: "other@test.com",
        password: "Test@123",
      });

      // Login com outro usuário
      const loginResponse = await request(app).post("/api/v1/auth/login").send({
        email: "other@test.com",
        password: "Test@123",
      });

      const otherHeaders = {
        Authorization: `Bearer ${loginResponse.body.token}`,
        "Accept-Language": "pt",
      };

      await request(app)
        .put(`/api/v1/schedule/events/${testData.eventId}`)
        .set(otherHeaders)
        .send({ title: "Tentativa de hack" })
        .expect(403);
    });
  });

  describe("🔄 PUT /schedule/events/:id/status - Alterar Status", () => {
    test("deve alterar status com sucesso", async () => {
      const response = await request(app)
        .put(`/api/v1/schedule/events/${testData.eventId}/status`)
        .set(testData.headers)
        .send({
          status: "confirmed",
          notes: "Confirmado pelo cliente",
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe("confirmed");
    });

    test("deve validar status válido", async () => {
      await request(app)
        .put(`/api/v1/schedule/events/${testData.eventId}/status`)
        .set(testData.headers)
        .send({ status: "invalid_status" })
        .expect(400);
    });
  });

  describe("🔍 Filtros e Busca", () => {
    beforeAll(async () => {
      // Criar eventos adicionais para testar filtros
      const events = [
        {
          title: "Ligação Comercial",
          description: "Follow-up cliente XYZ",
          start_datetime: "2025-12-02T10:00:00Z",
          end_datetime: "2025-12-02T10:30:00Z",
          event_type: "call",
          status: "scheduled",
        },
        {
          title: "Tarefa Urgente",
          description: "Revisar proposta",
          start_datetime: "2025-12-03T09:00:00Z",
          end_datetime: "2025-12-03T09:30:00Z",
          event_type: "task",
          status: "in_progress",
        },
      ];

      for (const event of events) {
        await request(app)
          .post("/api/v1/schedule/events")
          .set(testData.headers)
          .send(event);
      }
    });

    test("deve filtrar por tipo de evento", async () => {
      const response = await request(app)
        .get("/api/v1/schedule/events?event_type=call")
        .set(testData.headers)
        .expect(200);

      expect(response.body.data.length).toBe(1);
      expect(response.body.data[0].event_type).toBe("call");
    });

    test("deve filtrar por status", async () => {
      const response = await request(app)
        .get("/api/v1/schedule/events?status=confirmed")
        .set(testData.headers)
        .expect(200);

      expect(response.body.data.length).toBe(1);
      expect(response.body.data[0].status).toBe("confirmed");
    });

    test("deve buscar por texto", async () => {
      const response = await request(app)
        .get("/api/v1/schedule/events?search=cliente")
        .set(testData.headers)
        .expect(200);

      expect(response.body.data.length).toBe(1);
      expect(response.body.data[0].description).toContain("cliente");
    });

    test("deve paginar resultados", async () => {
      const response = await request(app)
        .get("/api/v1/schedule/events?limit=2&offset=0")
        .set(testData.headers)
        .expect(200);

      expect(response.body.data.length).toBeLessThanOrEqual(2);
      expect(response.body.pagination).toHaveProperty("totalItems");
      expect(response.body.pagination).toHaveProperty("hasNextPage");
    });
  });

  describe("📊 GET /schedule/stats - Estatísticas", () => {
    test("deve retornar estatísticas dos eventos", async () => {
      const response = await request(app)
        .get("/api/v1/schedule/stats")
        .set(testData.headers)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty("total_events");
      expect(response.body.data).toHaveProperty("scheduled");
      expect(response.body.data).toHaveProperty("confirmed");
      expect(response.body.data).toHaveProperty("meetings");
      expect(response.body.data).toHaveProperty("calls");
      expect(parseInt(response.body.data.total_events)).toBeGreaterThan(0);
    });

    test("deve filtrar estatísticas por data", async () => {
      const response = await request(app)
        .get("/api/v1/schedule/stats?date_from=2025-12-01&date_to=2025-12-01")
        .set(testData.headers)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty("total_events");
    });
  });

  describe("🗑️ DELETE /schedule/events/:id - Soft Delete", () => {
    test("deve fazer soft delete com sucesso", async () => {
      const response = await request(app)
        .delete(`/api/v1/schedule/events/${testData.eventId}`)
        .set(testData.headers)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeNull();
    });

    test("evento deletado não deve aparecer na listagem", async () => {
      const response = await request(app)
        .get("/api/v1/schedule/events")
        .set(testData.headers)
        .expect(200);

      const deletedEvent = response.body.data.find(
        (e) => e.id === testData.eventId
      );
      expect(deletedEvent).toBeUndefined();
    });

    test("deve retornar 404 ao acessar evento deletado", async () => {
      await request(app)
        .get(`/api/v1/schedule/events/${testData.eventId}`)
        .set(testData.headers)
        .expect(404);
    });

    test("deve rejeitar delete de evento inexistente", async () => {
      await request(app)
        .delete("/api/v1/schedule/events/99999")
        .set(testData.headers)
        .expect(404);
    });
  });

  describe("🔐 Testes de Segurança e Permissões", () => {
    test("deve isolar eventos por empresa", async () => {
      // Criar outra empresa
      const otherCompany = await dbHelper.createTestCompany({
        company_name: "Other Company",
        company_domain: "other-company",
        slug: "other-company",
      });

      const otherUser = await dbHelper.createTestUser(otherCompany.id, {
        full_name: "Other Company User",
        email: "other-company@test.com",
        password: "Test@123",
      });

      // Login com usuário de outra empresa
      const loginResponse = await request(app).post("/api/v1/auth/login").send({
        email: "other-company@test.com",
        password: "Test@123",
      });

      const otherHeaders = {
        Authorization: `Bearer ${loginResponse.body.token}`,
        "Accept-Language": "pt",
      };

      // Listar eventos (deve estar vazio)
      const response = await request(app)
        .get("/api/v1/schedule/events")
        .set(otherHeaders)
        .expect(200);

      expect(response.body.data.length).toBe(0);
    });

    test("deve rejeitar token inválido", async () => {
      await request(app)
        .get("/api/v1/schedule/events")
        .set({
          Authorization: "Bearer invalid.token.here",
          "Accept-Language": "pt",
        })
        .expect(401);
    });
  });

  describe("⚡ Testes de Performance", () => {
    test("listagem deve responder rapidamente", async () => {
      const start = Date.now();

      await request(app)
        .get("/api/v1/schedule/events")
        .set(testData.headers)
        .expect(200);

      const duration = Date.now() - start;
      expect(duration).toBeLessThan(500); // Menos de 500ms
    });

    test("criação deve responder rapidamente", async () => {
      const eventData = {
        title: "Evento Performance",
        start_datetime: "2025-12-10T14:00:00Z",
        end_datetime: "2025-12-10T15:00:00Z",
      };

      const start = Date.now();

      await request(app)
        .post("/api/v1/schedule/events")
        .set(testData.headers)
        .send(eventData)
        .expect(201);

      const duration = Date.now() - start;
      expect(duration).toBeLessThan(1000); // Menos de 1s
    });
  });
});
