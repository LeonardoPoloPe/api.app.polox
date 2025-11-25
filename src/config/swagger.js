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

const fastGlob = require("fast-glob");
const swaggerJsdoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");

// =================================================================
// 2. Definir os padrões de busca e usar fastGlob
// O sync() é crucial e garante que a lista de arquivos seja gerada
// antes de swaggerJsdoc() ser executado.
// =================================================================
const files = fastGlob.sync(
  [
    "./src/routes.js",
    "./src/routes/**/*.js",
    "./src/controllers/**/*.js",
    "./src/handler.js",
  ],
  {
    cwd: process.cwd(),
    absolute: false,
  }
);

// Configuração do Swagger/OpenAPI
const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Polox API",
      version: "1.0.0",
      description: `
        API Node.js Serverless para AWS Lambda com PostgreSQL RDS
        
        ## 🌐 Suporte Multi-Idiomas
        
        Esta API oferece suporte completo a internacionalização (i18n) com 3 idiomas:
        - **pt** - Português (padrão)
        - **en** - English
        - **es** - Español
        
        ### Como usar:
        1. Adicione o header \`Accept-Language\` com o valor desejado (pt, en, es)
        2. Ou use o parâmetro de query \`?lang=en\`
        3. A API responderá automaticamente no idioma selecionado
        
        ### Exemplos:
        - \`Accept-Language: pt\` → Respostas em português
        - \`Accept-Language: en\` → Respostas em inglês
        - \`Accept-Language: es\` → Respostas em espanhol
      `,
      contact: {
        name: "Polox Team",
        email: "contato@polox.com",
      },
      license: {
        name: "MIT",
        url: "https://opensource.org/licenses/MIT",
      },
    },
    servers:
      process.env.NODE_ENV === "development"
        ? [
            {
              url: "http://localhost:3000/api/v1",
              description: "Servidor Local (Node.js) - Desenvolvimento",
            },
          ]
        : [
            {
              url: "http://localhost:3000/api/v1",
              description: "Servidor Local (Node.js)",
            },
            {
              url: "https://z8ixwvp0qe.execute-api.sa-east-1.amazonaws.com/dev/api/v1",
              description: "Desenvolvimento AWS Lambda",
            },
            {
              url: "https://el0qui6eqj.execute-api.sa-east-1.amazonaws.com/sandbox/api/v1",
              description: "Sandbox AWS Lambda",
            },
            {
              url: "https://18yioqws85.execute-api.sa-east-1.amazonaws.com/prod/api/v1",
              description: "Produção AWS Lambda",
            },
          ],
    tags: [
      {
        name: "Auth",
        description: "Autenticação e gerenciamento de usuários",
      },
      {
        name: "Companies",
        description: "Gerenciamento de empresas (multi-tenant)",
      },
      {
        name: "Clients",
        description: "Gerenciamento de clientes (CRM)",
      },
      {
        name: "Leads",
        description: "Gerenciamento de leads e oportunidades",
      },
      {
        name: "Schedule",
        description: "Agendamentos e eventos",
      },
      {
        name: "Profiles",
        description: "Perfis de acesso e permissões",
      },
      {
        name: "Menu Items",
        description: "Gerenciamento de menus hierárquicos",
      },
      {
        name: "Tags",
        description: "Sistema de tags/etiquetas para categorização",
      },
      {
        name: "Health",
        description: "Verificação de saúde da aplicação",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "JWT Token obtido via login",
        },
      },
      parameters: {
        AcceptLanguage: {
          in: "header",
          name: "Accept-Language",
          schema: {
            type: "string",
            enum: ["pt", "en", "es"],
            default: "pt",
          },
          description:
            "Define o idioma da resposta (pt=Português, en=English, es=Español).",
          required: false,
        },
      },
      schemas: {
        User: {
          type: "object",
          required: ["email", "password", "name"],
          properties: {
            id: {
              type: "integer",
              description: "ID único do usuário",
              example: 1,
            },
            email: {
              type: "string",
              format: "email",
              description: "Email do usuário",
              example: "usuario@polox.com",
            },
            name: {
              type: "string",
              description: "Nome completo do usuário",
              example: "João Silva",
            },
            role: {
              type: "string",
              enum: ["super_admin", "company_admin", "manager", "user"],
              description: "Papel do usuário no sistema",
              example: "user",
            },
            companyId: {
              type: "string",
              format: "uuid",
              description: "ID da empresa do usuário",
              example: "550e8400-e29b-41d4-a716-446655440000",
            },
            profileId: {
              type: "integer",
              nullable: true,
              description: "ID do perfil de acesso do usuário",
              example: 5,
            },
            profileName: {
              type: "string",
              nullable: true,
              description: "Nome do perfil de acesso do usuário",
              example: "Gerente Comercial",
            },
            created_at: {
              type: "string",
              format: "date-time",
              description: "Data de criação do usuário",
              example: "2025-10-18T22:30:00Z",
            },
            updated_at: {
              type: "string",
              format: "date-time",
              description: "Data da última atualização",
              example: "2025-10-18T22:30:00Z",
            },
          },
        },
        UserRegistration: {
          type: "object",
          required: ["email", "password", "name"],
          properties: {
            email: {
              type: "string",
              format: "email",
              description: "Email do usuário",
              example: "novo.usuario@polox.com",
            },
            password: {
              type: "string",
              minLength: 6,
              description: "Senha do usuário (mínimo 6 caracteres)",
              example: "minhasenha123",
            },
            name: {
              type: "string",
              description: "Nome completo do usuário",
              example: "João Silva",
            },
            profile_id: {
              type: "integer",
              nullable: true,
              description: "ID do perfil de acesso a ser atribuído ao usuário",
              example: 5,
            },
          },
        },
        UserLogin: {
          type: "object",
          required: ["email", "password"],
          properties: {
            email: {
              type: "string",
              format: "email",
              description: "Email do usuário",
              example: "usuario@polox.com",
            },
            password: {
              type: "string",
              description: "Senha do usuário",
              example: "minhasenha123",
            },
          },
        },
        AuthResponse: {
          type: "object",
          properties: {
            token: {
              type: "string",
              description: "JWT Token de acesso",
              example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
            },
            refreshToken: {
              type: "string",
              description: "Token para renovação",
              example: "refresh_token_example_123456",
            },
            user: {
              $ref: "#/components/schemas/User",
            },
            expiresIn: {
              type: "string",
              description: "Tempo de expiração do token",
              example: "1h",
            },
          },
        },
        Error: {
          type: "object",
          properties: {
            error: {
              type: "string",
              description: "Mensagem de erro",
              example: "Erro na validação dos dados",
            },
            message: {
              type: "string",
              description: "Detalhes do erro",
              example: "Email já está em uso",
            },
            timestamp: {
              type: "string",
              format: "date-time",
              description: "Timestamp do erro",
              example: "2025-10-18T22:30:00Z",
            },
          },
        },
        Company: {
          type: "object",
          required: ["name", "domain"],
          properties: {
            id: {
              type: "integer",
              minimum: 1,
              description: "ID único da empresa",
              example: 1,
            },
            name: {
              type: "string",
              description: "Nome da empresa",
              example: "TechCorp Solutions",
            },
            domain: {
              type: "string",
              description: "Domínio único da empresa",
              example: "techcorp",
            },
            plan: {
              type: "string",
              enum: ["starter", "professional", "enterprise"],
              description: "Plano da empresa",
              example: "professional",
            },
            status: {
              type: "string",
              enum: ["active", "inactive", "trial"],
              description: "Status da empresa",
              example: "active",
            },
            industry: {
              type: "string",
              description: "Setor da empresa",
              example: "Tecnologia",
            },
            company_size: {
              type: "string",
              description: "Tamanho da empresa",
              example: "21-50 funcionários",
            },
            admin_name: {
              type: "string",
              description: "Nome do administrador",
              example: "João Silva",
            },
            admin_email: {
              type: "string",
              format: "email",
              description: "Email do administrador",
              example: "joao@techcorp.com",
            },
            admin_phone: {
              type: "string",
              description: "Telefone do administrador",
              example: "+55 11 99999-1234",
            },
            enabled_modules: {
              type: "array",
              items: {
                type: "string",
              },
              description: "Módulos habilitados",
              example: ["dashboard", "users", "leads", "sales"],
            },
            settings: {
              type: "object",
              description: "Configurações da empresa",
              example: {
                maxUploadSize: "5MB",
                maxTextLength: 40,
                supportEmail: "suporte@techcorp.com",
              },
            },
            users_count: {
              type: "integer",
              description: "Quantidade de usuários",
              example: 15,
            },
            active_users: {
              type: "integer",
              description: "Usuários ativos",
              example: 12,
            },
            created_at: {
              type: "string",
              format: "date-time",
              description: "Data de criação",
              example: "2025-10-18T22:30:00Z",
            },
            updated_at: {
              type: "string",
              format: "date-time",
              description: "Data de atualização",
              example: "2025-10-22T14:15:00Z",
            },
          },
        },
        HealthCheck: {
          type: "object",
          properties: {
            status: {
              type: "string",
              enum: ["healthy", "unhealthy"],
              description: "Status da aplicação",
              example: "healthy",
            },
            timestamp: {
              type: "string",
              format: "date-time",
              description: "Timestamp da verificação",
              example: "2025-10-18T22:30:00Z",
            },
            environment: {
              type: "string",
              description: "Ambiente atual",
              example: "dev",
            },
            database: {
              type: "string",
              enum: ["connected", "disconnected"],
              description: "Status da conexão com o banco",
              example: "connected",
            },
            version: {
              type: "string",
              description: "Versão da aplicação",
              example: "1.0.0",
            },
          },
        },
        Client: {
          type: "object",
          required: ["name"],
          properties: {
            id: {
              type: "string",
              format: "uuid",
              description: "ID único do cliente",
              example: "123e4567-e89b-12d3-a456-426614174000",
            },
            company_id: {
              type: "string",
              format: "uuid",
              description: "ID da empresa",
              example: "550e8400-e29b-41d4-a716-446655440000",
            },
            name: {
              type: "string",
              description: "Nome do cliente",
              example: "Maria Santos",
            },
            email: {
              type: "string",
              format: "email",
              description: "Email do cliente",
              example: "maria@exemplo.com",
            },
            phone: {
              type: "string",
              description: "Telefone do cliente",
              example: "(11) 88888-8888",
            },
            company: {
              type: "string",
              description: "Empresa do cliente",
              example: "Empresa XYZ",
            },
            position: {
              type: "string",
              description: "Cargo do cliente",
              example: "CEO",
            },
            source: {
              type: "string",
              description: "Origem do cliente",
              example: "referral",
            },
            status: {
              type: "string",
              enum: ["active", "inactive", "vip", "blacklist"],
              description: "Status do cliente",
              example: "active",
            },
            category: {
              type: "string",
              description: "Categoria do cliente",
              example: "premium",
            },
            description: {
              type: "string",
              description: "Descrição do cliente",
              example: "Cliente VIP com desconto especial",
            },
            tags: {
              type: "array",
              items: {
                type: "string",
              },
              description: "Tags do cliente",
              example: ["vip", "fidelizado"],
            },
            custom_fields: {
              type: "object",
              description: "Campos customizados",
              example: { preferencia: "email", desconto: "10%" },
            },
            total_spent: {
              type: "number",
              description: "Total gasto pelo cliente",
              example: 15000.5,
            },
            total_purchases: {
              type: "integer",
              description: "Total de compras realizadas",
              example: 12,
            },
            average_ticket: {
              type: "number",
              description: "Ticket médio do cliente",
              example: 1250.04,
            },
            last_purchase_at: {
              type: "string",
              format: "date-time",
              description: "Data da última compra",
              example: "2025-10-20T14:30:00Z",
            },
            first_purchase_at: {
              type: "string",
              format: "date-time",
              description: "Data da primeira compra",
              example: "2025-01-15T10:00:00Z",
            },
            created_at: {
              type: "string",
              format: "date-time",
              description: "Data de criação",
              example: "2025-10-18T22:30:00Z",
            },
            updated_at: {
              type: "string",
              format: "date-time",
              description: "Data de atualização",
              example: "2025-10-22T14:15:00Z",
            },
          },
        },
        ClientNote: {
          type: "object",
          required: ["client_id", "note"],
          properties: {
            id: {
              type: "string",
              format: "uuid",
              description: "ID único da nota",
              example: "223e4567-e89b-12d3-a456-426614174001",
            },
            client_id: {
              type: "string",
              format: "uuid",
              description: "ID do cliente",
              example: "123e4567-e89b-12d3-a456-426614174000",
            },
            user_id: {
              type: "integer",
              description: "ID do usuário que criou a nota",
              example: 1,
            },
            note: {
              type: "string",
              description: "Conteúdo da nota",
              example: "Cliente interessado em novos produtos",
            },
            type: {
              type: "string",
              enum: ["general", "call", "meeting", "email", "other"],
              description: "Tipo da nota",
              example: "call",
            },
            created_at: {
              type: "string",
              format: "date-time",
              description: "Data de criação",
              example: "2025-10-18T22:30:00Z",
            },
            updated_at: {
              type: "string",
              format: "date-time",
              description: "Data de atualização",
              example: "2025-10-18T22:30:00Z",
            },
          },
        },
        Sale: {
          type: "object",
          properties: {
            id: {
              type: "string",
              format: "uuid",
              description: "ID único da venda",
              example: "333e4567-e89b-12d3-a456-426614174002",
            },
            client_id: {
              type: "string",
              format: "uuid",
              description: "ID do cliente",
              example: "123e4567-e89b-12d3-a456-426614174000",
            },
            user_id: {
              type: "integer",
              description: "ID do vendedor",
              example: 1,
            },
            total_amount: {
              type: "number",
              description: "Valor total da venda",
              example: 1500.0,
            },
            status: {
              type: "string",
              enum: ["pending", "completed", "cancelled"],
              description: "Status da venda",
              example: "completed",
            },
            payment_method: {
              type: "string",
              description: "Método de pagamento",
              example: "credit_card",
            },
            items: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  product_id: {
                    type: "string",
                  },
                  product_name: {
                    type: "string",
                  },
                  quantity: {
                    type: "integer",
                  },
                  unit_price: {
                    type: "number",
                  },
                  total_price: {
                    type: "number",
                  },
                },
              },
              description: "Itens da venda",
            },
            sale_date: {
              type: "string",
              format: "date-time",
              description: "Data da venda",
              example: "2025-10-20T14:30:00Z",
            },
            created_at: {
              type: "string",
              format: "date-time",
              description: "Data de criação",
              example: "2025-10-20T14:30:00Z",
            },
          },
        },
        ScheduleEvent: {
          type: "object",
          required: ["title", "start_datetime", "end_datetime"],
          properties: {
            id: {
              type: "integer",
              description: "ID único do evento",
              example: 1,
            },
            title: {
              type: "string",
              description: "Título do evento",
              example: "Reunião com cliente",
            },
            description: {
              type: "string",
              description: "Descrição do evento",
              example: "Reunião para discutir proposta comercial",
            },
            start_datetime: {
              type: "string",
              format: "date-time",
              description: "Data e hora de início",
              example: "2025-11-05T14:00:00Z",
            },
            end_datetime: {
              type: "string",
              format: "date-time",
              description: "Data e hora de fim",
              example: "2025-11-05T15:00:00Z",
            },
            all_day: {
              type: "boolean",
              description: "Evento de dia inteiro",
              example: false,
            },
            event_type: {
              type: "string",
              enum: [
                "meeting",
                "call",
                "task",
                "reminder",
                "event",
                "appointment",
              ],
              description: "Tipo do evento",
              example: "meeting",
            },
            priority: {
              type: "string",
              enum: ["low", "medium", "high", "urgent"],
              description: "Prioridade do evento",
              example: "medium",
            },
            status: {
              type: "string",
              enum: [
                "scheduled",
                "confirmed",
                "in_progress",
                "completed",
                "cancelled",
                "no_show",
              ],
              description: "Status do evento",
              example: "scheduled",
            },
            location: {
              type: "string",
              description: "Local do evento",
              example: "Sala de reunião 1",
            },
            contato_id: {
              type: "integer",
              description: "ID do contato relacionado",
              example: 123,
            },
            timezone: {
              type: "string",
              description: "Fuso horário",
              example: "America/Sao_Paulo",
            },
            visibility: {
              type: "string",
              enum: ["public", "private"],
              description: "Visibilidade do evento",
              example: "private",
            },
            reminder_minutes: {
              type: "integer",
              description: "Minutos antes do evento para lembrete",
              example: 15,
            },
            metadata: {
              type: "object",
              description: "Metadados adicionais",
              example: { zoom_link: "https://zoom.us/j/123456789" },
            },
            contact_name: {
              type: "string",
              description: "Nome do contato",
              example: "João Silva",
            },
            organizer_name: {
              type: "string",
              description: "Nome do organizador",
              example: "Maria Santos",
            },
            created_at: {
              type: "string",
              format: "date-time",
              description: "Data de criação",
              example: "2025-11-04T18:00:00Z",
            },
            updated_at: {
              type: "string",
              format: "date-time",
              description: "Data de atualização",
              example: "2025-11-04T18:00:00Z",
            },
          },
        },
        PaginationInfo: {
          type: "object",
          properties: {
            current_page: {
              type: "integer",
              description: "Página atual",
              example: 1,
            },
            total_pages: {
              type: "integer",
              description: "Total de páginas",
              example: 5,
            },
            total_items: {
              type: "integer",
              description: "Total de itens",
              example: 98,
            },
            items_per_page: {
              type: "integer",
              description: "Itens por página",
              example: 20,
            },
            has_next: {
              type: "boolean",
              description: "Tem próxima página",
              example: true,
            },
            has_prev: {
              type: "boolean",
              description: "Tem página anterior",
              example: false,
            },
          },
        },
        Profile: {
          type: "object",
          required: ["name", "translations", "screen_ids"],
          properties: {
            id: {
              type: "integer",
              description: "ID único do perfil",
              example: 1,
            },
            name: {
              type: "string",
              description: "Nome do perfil",
              example: "Gerente Comercial",
            },
            company_id: {
              type: "integer",
              nullable: true,
              description:
                "ID da empresa (NULL = perfil do sistema, número = perfil customizado da empresa)",
              example: 1,
            },
            translations: {
              type: "object",
              description: "Traduções do nome do perfil em múltiplos idiomas",
              properties: {
                "pt-BR": {
                  type: "string",
                  example: "Gerente Comercial",
                },
                "en-US": {
                  type: "string",
                  example: "Sales Manager",
                },
                "es-ES": {
                  type: "string",
                  example: "Gerente Comercial",
                },
              },
              example: {
                "pt-BR": "Gerente Comercial",
                "en-US": "Sales Manager",
                "es-ES": "Gerente Comercial",
              },
            },
            screen_ids: {
              type: "array",
              items: {
                type: "string",
              },
              description:
                "Array de IDs de telas (menu_items) que o perfil pode acessar",
              example: ["2", "3", "4", "5", "7", "8"],
            },
            is_system_default: {
              type: "boolean",
              description:
                "Indica se é um perfil padrão do sistema (não pode ser editado por admins)",
              example: false,
            },
            is_active: {
              type: "boolean",
              description: "Status do perfil (ativo/inativo)",
              example: true,
            },
            deleted_at: {
              type: "string",
              format: "date-time",
              nullable: true,
              description: "Data de exclusão (soft delete)",
              example: null,
            },
            created_at: {
              type: "string",
              format: "date-time",
              description: "Data de criação",
              example: "2025-11-07T10:00:00Z",
            },
            updated_at: {
              type: "string",
              format: "date-time",
              description: "Data de atualização",
              example: "2025-11-07T10:00:00Z",
            },
            company_name: {
              type: "string",
              nullable: true,
              description: "Nome da empresa (retornado nas listagens)",
              example: "TechCorp Solutions",
            },
            users_count: {
              type: "integer",
              description: "Quantidade de usuários com este perfil",
              example: 5,
            },
          },
        },
        MenuItem: {
          type: "object",
          required: ["label", "translations"],
          properties: {
            id: {
              type: "integer",
              description: "ID único do menu",
              example: 1,
            },
            label: {
              type: "string",
              description: "Label do menu",
              example: "Configurações",
            },
            translations: {
              type: "object",
              description: "Traduções do label em múltiplos idiomas",
              properties: {
                "pt-BR": {
                  type: "string",
                  example: "Configurações",
                },
                "en-US": {
                  type: "string",
                  example: "Settings",
                },
                "es-ES": {
                  type: "string",
                  example: "Configuraciones",
                },
              },
              example: {
                "pt-BR": "Configurações",
                "en-US": "Settings",
                "es-ES": "Configuraciones",
              },
            },
            icon: {
              type: "string",
              nullable: true,
              description: "Ícone do menu (ex: lucide-react)",
              example: "settings",
            },
            route: {
              type: "string",
              nullable: true,
              description: "Rota do menu (NULL para menus pai)",
              example: "/settings",
            },
            parent_id: {
              type: "integer",
              nullable: true,
              description: "ID do menu pai (NULL para menus raiz)",
              example: null,
            },
            order_position: {
              type: "integer",
              description: "Ordem de exibição",
              example: 1,
            },
            visible_to_all: {
              type: "boolean",
              description:
                "Se TRUE, visível para todas empresas. Se FALSE, apenas para empresas com permissão",
              example: true,
            },
            is_active: {
              type: "boolean",
              description: "Status do menu",
              example: true,
            },
            deleted_at: {
              type: "string",
              format: "date-time",
              nullable: true,
              description: "Data de exclusão (soft delete)",
              example: null,
            },
            created_at: {
              type: "string",
              format: "date-time",
              description: "Data de criação",
              example: "2025-11-07T10:00:00Z",
            },
            updated_at: {
              type: "string",
              format: "date-time",
              description: "Data de atualização",
              example: "2025-11-07T10:00:00Z",
            },
            children: {
              type: "array",
              items: {
                $ref: "#/components/schemas/MenuItem",
              },
              description: "Submenus (retornado em /hierarchy)",
            },
          },
        },
        Tag: {
          type: "object",
          properties: {
            id: {
              type: "integer",
              minimum: 1,
              description: "ID único da tag",
              example: 1,
            },
            name: {
              type: "string",
              description: "Nome da tag",
              example: "Importante",
            },
            slug: {
              type: "string",
              description: "Slug único da tag (gerado automaticamente)",
              example: "importante",
            },
            color: {
              type: "string",
              pattern: "^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$",
              description: "Cor da tag em formato hexadecimal",
              example: "#e74c3c",
            },
            is_active: {
              type: "boolean",
              description: "Se a tag está ativa",
              example: true,
            },
            created_at: {
              type: "string",
              format: "date-time",
              description: "Data de criação da tag",
              example: "2025-11-12T10:00:00Z",
            },
            updated_at: {
              type: "string",
              format: "date-time",
              description: "Data de atualização da tag",
              example: "2025-11-12T10:00:00Z",
            },
          },
        },
        TagWithStats: {
          allOf: [
            {
              $ref: "#/components/schemas/Tag",
            },
            {
              type: "object",
              properties: {
                usage_count: {
                  type: "integer",
                  description: "Número de vezes que a tag foi usada",
                  example: 15,
                },
                entity_types_count: {
                  type: "integer",
                  description: "Número de tipos de entidades que usam esta tag",
                  example: 3,
                },
              },
            },
          ],
        },
        Pagination: {
          type: "object",
          properties: {
            page: {
              type: "integer",
              minimum: 1,
              description: "Página atual",
              example: 1,
            },
            limit: {
              type: "integer",
              minimum: 1,
              description: "Items por página",
              example: 20,
            },
            total: {
              type: "integer",
              minimum: 0,
              description: "Total de items",
              example: 150,
            },
            totalPages: {
              type: "integer",
              minimum: 0,
              description: "Total de páginas",
              example: 8,
            },
            hasNext: {
              type: "boolean",
              description: "Se existe próxima página",
              example: true,
            },
            hasPrev: {
              type: "boolean",
              description: "Se existe página anterior",
              example: false,
            },
          },
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: [...files],
};

// Gera a especificação Swagger
const swaggerSpec = swaggerJsdoc(swaggerOptions);

// Configuração customizada do Swagger UI
const swaggerUiOptions = {
  customCss: `
    .swagger-ui .topbar { display: none; }
    .swagger-ui .info .title { color: #2c3e50; }
    .swagger-ui .scheme-container { 
      background: #f8f9fa; 
      border: 1px solid #dee2e6; 
      border-radius: 5px; 
      padding: 10px; 
      margin: 10px 0;
    }
  `,
  customSiteTitle: "Polox API Documentation",
  customfavIcon: "/favicon.ico",
  swaggerOptions: {
    persistAuthorization: true,
    displayRequestDuration: true,
    docExpansion: "none",
    filter: true,
    showExtensions: true,
    showCommonExtensions: true,
    tryItOutEnabled: true,
    defaultServerIndex: 0, // Força usar o primeiro servidor (localhost)
    validatorUrl: null, // Desabilita validação externa
  },
};

module.exports = {
  swaggerSpec,
  swaggerUi,
  swaggerUiOptions,
};
