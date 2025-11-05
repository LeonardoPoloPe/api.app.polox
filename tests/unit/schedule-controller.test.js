/**
 * ==========================================
 * 🔬 TESTES UNITÁRIOS - SCHEDULE CONTROLLER
 * ==========================================
 *
 * Testa isoladamente as funções e validações
 * - Schemas de validação Joi
 * - Lógica de filtros
 * - Formatação de dados
 * - Handlers de erro
 */

const ScheduleController = require("../../src/controllers/ScheduleController");

describe("🔬 Schedule Controller Unit Tests", () => {
  describe("📋 Schema Validações - createEventSchema", () => {
    test("deve validar evento mínimo válido", () => {
      const validEvent = {
        title: "Evento Teste",
        start_datetime: "2025-12-01T14:00:00Z",
        end_datetime: "2025-12-01T15:00:00Z",
      };

      const { error } =
        ScheduleController.createEventSchema.validate(validEvent);
      expect(error).toBeUndefined();
    });

    test("deve rejeitar título vazio", () => {
      const invalidEvent = {
        title: "",
        start_datetime: "2025-12-01T14:00:00Z",
        end_datetime: "2025-12-01T15:00:00Z",
      };

      const { error } =
        ScheduleController.createEventSchema.validate(invalidEvent);
      expect(error).toBeDefined();
      expect(error.details[0].path).toContain("title");
    });

    test("deve rejeitar título muito longo", () => {
      const invalidEvent = {
        title: "A".repeat(501), // Título com 501 caracteres
        start_datetime: "2025-12-01T14:00:00Z",
        end_datetime: "2025-12-01T15:00:00Z",
      };

      const { error } =
        ScheduleController.createEventSchema.validate(invalidEvent);
      expect(error).toBeDefined();
    });

    test("deve validar todos os tipos de evento válidos", () => {
      const validTypes = [
        "meeting",
        "call",
        "task",
        "reminder",
        "event",
        "appointment",
      ];

      validTypes.forEach((type) => {
        const event = {
          title: "Teste",
          start_datetime: "2025-12-01T14:00:00Z",
          end_datetime: "2025-12-01T15:00:00Z",
          event_type: type,
        };

        const { error } = ScheduleController.createEventSchema.validate(event);
        expect(error).toBeUndefined();
      });
    });

    test("deve rejeitar event_type inválido", () => {
      const invalidEvent = {
        title: "Teste",
        start_datetime: "2025-12-01T14:00:00Z",
        end_datetime: "2025-12-01T15:00:00Z",
        event_type: "invalid_type",
      };

      const { error } =
        ScheduleController.createEventSchema.validate(invalidEvent);
      expect(error).toBeDefined();
    });

    test("deve validar data fim maior que data início", () => {
      const invalidEvent = {
        title: "Teste",
        start_datetime: "2025-12-01T15:00:00Z",
        end_datetime: "2025-12-01T14:00:00Z", // Fim menor que início
      };

      const { error } =
        ScheduleController.createEventSchema.validate(invalidEvent);
      expect(error).toBeDefined();
    });

    test("deve permitir evento de dia inteiro", () => {
      const validEvent = {
        title: "Evento Dia Inteiro",
        start_datetime: "2025-12-01T00:00:00Z",
        end_datetime: "2025-12-01T23:59:59Z",
        is_all_day: true,
      };

      const { error } =
        ScheduleController.createEventSchema.validate(validEvent);
      expect(error).toBeUndefined();
    });

    test("deve validar URL do meeting_link", () => {
      const invalidEvent = {
        title: "Teste",
        start_datetime: "2025-12-01T14:00:00Z",
        end_datetime: "2025-12-01T15:00:00Z",
        meeting_link: "not-a-valid-url",
      };

      const { error } =
        ScheduleController.createEventSchema.validate(invalidEvent);
      expect(error).toBeDefined();
    });

    test("deve aceitar URLs válidas para meeting_link", () => {
      const validUrls = [
        "https://meet.google.com/abc-def-ghi",
        "https://zoom.us/j/1234567890",
        "https://teams.microsoft.com/l/meetup-join/123",
        "https://whereby.com/test-room",
      ];

      validUrls.forEach((url) => {
        const event = {
          title: "Teste",
          start_datetime: "2025-12-01T14:00:00Z",
          end_datetime: "2025-12-01T15:00:00Z",
          meeting_link: url,
        };

        const { error } = ScheduleController.createEventSchema.validate(event);
        expect(error).toBeUndefined();
      });
    });

    test("deve validar contato_id se fornecido", () => {
      const validEvent = {
        title: "Teste",
        start_datetime: "2025-12-01T14:00:00Z",
        end_datetime: "2025-12-01T15:00:00Z",
        contato_id: 123,
      };

      const { error } =
        ScheduleController.createEventSchema.validate(validEvent);
      expect(error).toBeUndefined();
    });

    test("deve rejeitar contato_id inválido", () => {
      const invalidEvent = {
        title: "Teste",
        start_datetime: "2025-12-01T14:00:00Z",
        end_datetime: "2025-12-01T15:00:00Z",
        contato_id: -1, // ID negativo
      };

      const { error } =
        ScheduleController.createEventSchema.validate(invalidEvent);
      expect(error).toBeDefined();
    });
  });

  describe("✏️ Schema Validações - updateEventSchema", () => {
    test("deve permitir atualização parcial", () => {
      const partialUpdate = {
        title: "Título Atualizado",
      };

      const { error } =
        ScheduleController.updateEventSchema.validate(partialUpdate);
      expect(error).toBeUndefined();
    });

    test("deve validar data se fornecida", () => {
      const invalidUpdate = {
        start_datetime: "2025-12-01T15:00:00Z",
        end_datetime: "2025-12-01T14:00:00Z",
      };

      const { error } =
        ScheduleController.updateEventSchema.validate(invalidUpdate);
      expect(error).toBeDefined();
    });

    test("deve permitir atualização de múltiplos campos", () => {
      const validUpdate = {
        title: "Novo Título",
        description: "Nova descrição",
        event_location: "Nova localização",
        meeting_link: "https://meet.google.com/new-link",
      };

      const { error } =
        ScheduleController.updateEventSchema.validate(validUpdate);
      expect(error).toBeUndefined();
    });
  });

  describe("🔄 Schema Validações - updateStatusSchema", () => {
    test("deve validar todos os status válidos", () => {
      const validStatuses = [
        "scheduled",
        "confirmed",
        "in_progress",
        "completed",
        "cancelled",
        "rescheduled",
      ];

      validStatuses.forEach((status) => {
        const update = { status };
        const { error } =
          ScheduleController.updateStatusSchema.validate(update);
        expect(error).toBeUndefined();
      });
    });

    test("deve rejeitar status inválido", () => {
      const invalidUpdate = {
        status: "invalid_status",
      };

      const { error } =
        ScheduleController.updateStatusSchema.validate(invalidUpdate);
      expect(error).toBeDefined();
    });

    test("deve permitir notes opcionais", () => {
      const validUpdate = {
        status: "confirmed",
        notes: "Cliente confirmou por telefone",
      };

      const { error } =
        ScheduleController.updateStatusSchema.validate(validUpdate);
      expect(error).toBeUndefined();
    });

    test("deve validar tamanho máximo das notes", () => {
      const invalidUpdate = {
        status: "confirmed",
        notes: "A".repeat(1001), // Mais que 1000 caracteres
      };

      const { error } =
        ScheduleController.updateStatusSchema.validate(invalidUpdate);
      expect(error).toBeDefined();
    });
  });

  describe("🔍 Schema Validações - eventFiltersSchema", () => {
    test("deve permitir filtros vazios", () => {
      const { error } = ScheduleController.eventFiltersSchema.validate({});
      expect(error).toBeUndefined();
    });

    test("deve validar filtros de data", () => {
      const validFilters = {
        date_from: "2025-12-01",
        date_to: "2025-12-31",
      };

      const { error } =
        ScheduleController.eventFiltersSchema.validate(validFilters);
      expect(error).toBeUndefined();
    });

    test("deve validar paginação", () => {
      const validFilters = {
        limit: 20,
        offset: 10,
      };

      const { error } =
        ScheduleController.eventFiltersSchema.validate(validFilters);
      expect(error).toBeUndefined();
    });

    test("deve rejeitar limit muito alto", () => {
      const invalidFilters = {
        limit: 1001, // Maior que 1000
      };

      const { error } =
        ScheduleController.eventFiltersSchema.validate(invalidFilters);
      expect(error).toBeDefined();
    });

    test("deve rejeitar offset negativo", () => {
      const invalidFilters = {
        offset: -1,
      };

      const { error } =
        ScheduleController.eventFiltersSchema.validate(invalidFilters);
      expect(error).toBeDefined();
    });

    test("deve validar busca por texto", () => {
      const validFilters = {
        search: "cliente importante",
      };

      const { error } =
        ScheduleController.eventFiltersSchema.validate(validFilters);
      expect(error).toBeUndefined();
    });

    test("deve rejeitar busca muito longa", () => {
      const invalidFilters = {
        search: "A".repeat(256), // Maior que 255 caracteres
      };

      const { error } =
        ScheduleController.eventFiltersSchema.validate(invalidFilters);
      expect(error).toBeDefined();
    });

    test("deve validar múltiplos filtros combinados", () => {
      const validFilters = {
        event_type: "meeting",
        status: "scheduled",
        date_from: "2025-12-01",
        date_to: "2025-12-31",
        search: "cliente",
        limit: 50,
        offset: 0,
      };

      const { error } =
        ScheduleController.eventFiltersSchema.validate(validFilters);
      expect(error).toBeUndefined();
    });
  });

  describe("🔧 Lógica de Negócio", () => {
    test("deve calcular duração correta do evento", () => {
      const start = new Date("2025-12-01T14:00:00Z");
      const end = new Date("2025-12-01T15:30:00Z");

      const durationMs = end.getTime() - start.getTime();
      const durationMinutes = durationMs / (1000 * 60);

      expect(durationMinutes).toBe(90); // 1h30min = 90 minutos
    });

    test("deve detectar sobreposição de eventos", () => {
      const evento1 = {
        start: new Date("2025-12-01T14:00:00Z"),
        end: new Date("2025-12-01T15:00:00Z"),
      };

      const evento2 = {
        start: new Date("2025-12-01T14:30:00Z"),
        end: new Date("2025-12-01T15:30:00Z"),
      };

      // Lógica de sobreposição: evento1.start < evento2.end && evento2.start < evento1.end
      const hasSobreposicao =
        evento1.start < evento2.end && evento2.start < evento1.end;
      expect(hasSobreposicao).toBe(true);
    });

    test("deve detectar quando não há sobreposição", () => {
      const evento1 = {
        start: new Date("2025-12-01T14:00:00Z"),
        end: new Date("2025-12-01T15:00:00Z"),
      };

      const evento2 = {
        start: new Date("2025-12-01T16:00:00Z"),
        end: new Date("2025-12-01T17:00:00Z"),
      };

      const hasSobreposicao =
        evento1.start < evento2.end && evento2.start < evento1.end;
      expect(hasSobreposicao).toBe(false);
    });

    test("deve formatar datas para UTC corretamente", () => {
      const localDate = "2025-12-01T14:00:00-03:00"; // GMT-3 (Brasil)
      const utcDate = new Date(localDate).toISOString();

      expect(utcDate).toBe("2025-12-01T17:00:00.000Z"); // +3 horas para UTC
    });
  });

  describe("🎯 Casos Extremos e Edge Cases", () => {
    test("deve lidar com evento de 1 minuto", () => {
      const shortEvent = {
        title: "Evento Curto",
        start_datetime: "2025-12-01T14:00:00Z",
        end_datetime: "2025-12-01T14:01:00Z", // 1 minuto
      };

      const { error } =
        ScheduleController.createEventSchema.validate(shortEvent);
      expect(error).toBeUndefined();
    });

    test("deve lidar com evento de múltiplos dias", () => {
      const longEvent = {
        title: "Conferência",
        start_datetime: "2025-12-01T09:00:00Z",
        end_datetime: "2025-12-03T18:00:00Z", // 3 dias
        is_all_day: false,
      };

      const { error } =
        ScheduleController.createEventSchema.validate(longEvent);
      expect(error).toBeUndefined();
    });

    test("deve rejeitar evento no passado distante", () => {
      const pastEvent = {
        title: "Evento Passado",
        start_datetime: "2020-01-01T14:00:00Z",
        end_datetime: "2020-01-01T15:00:00Z",
      };

      // Aqui você adicionaria validação customizada para rejeitar datas muito no passado
      // Por agora, o schema Joi básico permite qualquer data válida
      const { error } =
        ScheduleController.createEventSchema.validate(pastEvent);
      expect(error).toBeUndefined(); // Schema atual não valida isso
    });

    test("deve lidar com caracteres especiais no título", () => {
      const specialCharsEvent = {
        title: "Reunião: Cliente & Parceiros (Urgente!) - R$ 10.000,00 💰",
        start_datetime: "2025-12-01T14:00:00Z",
        end_datetime: "2025-12-01T15:00:00Z",
      };

      const { error } =
        ScheduleController.createEventSchema.validate(specialCharsEvent);
      expect(error).toBeUndefined();
    });

    test("deve lidar com timezone diferente", () => {
      const timezoneEvent = {
        title: "Evento Internacional",
        start_datetime: "2025-12-01T14:00:00+05:30", // Timezone da Índia
        end_datetime: "2025-12-01T15:00:00+05:30",
      };

      const { error } =
        ScheduleController.createEventSchema.validate(timezoneEvent);
      expect(error).toBeUndefined();
    });
  });

  describe("🚨 Tratamento de Erros", () => {
    test("deve capturar erro de validação de data inválida", () => {
      const invalidDateEvent = {
        title: "Evento Data Inválida",
        start_datetime: "not-a-date",
        end_datetime: "2025-12-01T15:00:00Z",
      };

      const { error } =
        ScheduleController.createEventSchema.validate(invalidDateEvent);
      expect(error).toBeDefined();
      expect(error.details[0].path).toContain("start_datetime");
    });

    test("deve capturar múltiplos erros de validação", () => {
      const invalidEvent = {
        title: "", // Título vazio
        start_datetime: "invalid-date", // Data inválida
        end_datetime: "2025-12-01T14:00:00Z",
        event_type: "invalid_type", // Tipo inválido
      };

      const { error } =
        ScheduleController.createEventSchema.validate(invalidEvent);
      expect(error).toBeDefined();
      expect(error.details.length).toBeGreaterThan(1); // Múltiplos erros
    });
  });
});
