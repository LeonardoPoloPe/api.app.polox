const swaggerJsdoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");

// Configuração do Swagger/OpenAPI
const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Polox API",
      version: "1.0.0",
      description: "API Node.js Serverless para AWS Lambda com PostgreSQL RDS",
      contact: {
        name: "Polox Team",
        email: "contato@polox.com",
      },
      license: {
        name: "MIT",
        url: "https://opensource.org/licenses/MIT",
      },
    },
    servers: [
      {
        url: "http://localhost:3000/api",
        description: "Servidor Local (Node.js)",
      },
      {
        url: "https://z8ixwvp0qe.execute-api.sa-east-1.amazonaws.com/dev/api",
        description: "Desenvolvimento AWS Lambda",
      },
      {
        url: "https://el0qui6eqj.execute-api.sa-east-1.amazonaws.com/sandbox/api",
        description: "Sandbox AWS Lambda",
      },
      {
        url: "https://18yioqws85.execute-api.sa-east-1.amazonaws.com/prod/api",
        description: "Produção AWS Lambda",
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
              type: "string",
              format: "uuid",
              description: "ID único da empresa",
              example: "550e8400-e29b-41d4-a716-446655440000",
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
              example: 15000.50,
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
              example: 1500.00,
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
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: [
    "./src/routes.js",
    "./src/routes/*.js",
    "./src/controllers/*.js",
    "./src/handler.js",
  ],
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
  },
};

module.exports = {
  swaggerSpec,
  swaggerUi,
  swaggerUiOptions,
};
