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
        url: "http://localhost:3000/dev/api",
        description: "Servidor de Desenvolvimento Local",
      },
      {
        url: "https://api-dev.polox.com/api",
        description: "Servidor de Desenvolvimento AWS",
      },
      {
        url: "https://api-sandbox.polox.com/api",
        description: "Servidor de Sandbox/Testes",
      },
      {
        url: "https://api.polox.com/api",
        description: "Servidor de Produção",
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
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: ["./src/routes.js", "./src/controllers/*.js", "./src/handler.js"],
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
