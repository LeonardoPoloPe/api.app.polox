#!/usr/bin/env node

/**
 * 🚀 POLOX CRM API - SERVER
 *
 * Entry point para desenvolvimento local seguindo COPILOT_PROMPT_1
 * Para produção, usar handler.js via Lambda
 */

require("dotenv").config();

const express = require("express");
const {
  createApp,
  configureProduction,
  configureErrorHandling,
} = require("./config/app");
const { healthCheck } = require("./config/database");
const { logger } = require("./utils/logger");
const { utils } = require("./config/auth");
const { i18nMiddleware } = require("./config/i18n");
const {
  responseHelpers,
  healthCheckResponse,
} = require("./utils/response-helpers");

async function startServer() {
  try {
    // Validar configurações críticas
    const warnings = utils.validateJWTConfig();
    if (warnings.length > 0) {
      warnings.forEach((warning) => logger.warn(warning));
    }

    // Criar aplicação Express
    const app = createApp();

    // Configurar para produção se necessário
    configureProduction(app);

    // ==========================================
    // ROTAS DA APLICAÇÃO
    // ==========================================

    // Rota raiz com informações da API (com i18n)
    app.get("/", (req, res) => {
      res.sendSuccess(
        {
          message: req.t("api.welcome"),
          version:
            req.t("api.version") +
            ": " +
            (process.env.npm_package_version || "1.0.0"),
          environment:
            req.t("api.environment") +
            ": " +
            (process.env.NODE_ENV || "development"),
          timestamp: new Date().toISOString(),
          language: {
            current: req.language || "pt",
            supported: ["pt", "en", "es"],
          },
          documentation:
            process.env.ENABLE_SWAGGER === "true" ? "/api/v1/docs" : null,
          endpoints: {
            health: "/health",
            languages: "/languages",
            auth: "/api/v1/auth",
            users: "/api/v1/users",
            companies: "/api/v1/companies",
            leads: "/api/v1/leads",
            clients: "/api/v1/clients",
            sales: "/api/v1/sales",
            products: "/api/v1/products",
            finance: "/api/v1/finance",
            tickets: "/api/v1/tickets",
            suppliers: "/api/v1/suppliers",
            schedule: "/api/v1/schedule",
            notifications: "/api/v1/notifications",
            gamification: "/api/v1/gamification",
            analytics: "/api/v1/analytics",
          },
          features: {
            multiTenant: true,
            multiLanguage: true,
            authentication: "JWT Enterprise",
            database: "PostgreSQL",
            gamification: process.env.GAMIFICATION_ENABLED === "true",
            swagger: process.env.ENABLE_SWAGGER === "true",
            rateLimiting: true,
            monitoring: true,
            auditLogs: true,
          },
        },
        "api.welcome"
      );
    });

    // Endpoint para informações de idiomas
    app.get("/languages", (req, res) => {
      const {
        getSupportedLanguages,
        getLanguagesInfo,
      } = require("./config/i18n");

      res.sendSuccess(
        {
          current: req.language || "pt",
          supported: getSupportedLanguages(),
          details: getLanguagesInfo(),
        },
        "messages.success"
      );
    });

    // ==========================================
    // CONFIGURAÇÃO DE ROTAS COM PREFIXO /api/v1/
    // ==========================================

    // Importar todas as rotas da API
    const apiRoutes = require("./routes");

    // Criar um router principal para a v1
    const v1Router = express.Router();

    // Montar todas as rotas de serviço DENTRO do v1Router
    v1Router.use(apiRoutes);

    // Montar o v1Router principal no 'app' com o prefixo
    app.use("/api/v1", v1Router);

    // ==========================================
    // CONFIGURAÇÃO DO SWAGGER
    // ==========================================
    if (process.env.NODE_ENV !== "production") {
      try {
        const swaggerUi = require("swagger-ui-express");
        const { swaggerSpec, swaggerUiOptions } = require("./config/swagger");

        app.use("/api/v1/docs", swaggerUi.serve);
        app.get("/api/v1/docs", swaggerUi.setup(swaggerSpec, swaggerUiOptions));

        // Endpoint para o JSON da especificação OpenAPI
        app.get("/api/v1/api-docs.json", (req, res) => {
          res.setHeader("Content-Type", "application/json");
          res.json(swaggerSpec);
        });

        console.log("📚 Swagger UI configurado em /api/v1/docs");
        console.log("📄 Swagger JSON disponível em /api/v1/api-docs.json");
      } catch (error) {
        console.warn("Swagger não pôde ser carregado:", error.message);
      }
    }

    // Health check endpoint expandido (com i18n)
    app.get("/health", async (req, res) => {
      try {
        const dbHealthy = await healthCheck();
        const statusCode = dbHealthy ? 200 : 503;

        const healthData = {
          success: dbHealthy,
          message: req.t("api.status"),
          data: {
            status: dbHealthy ? req.t("api.healthy") : "unhealthy",
            timestamp: new Date().toISOString(),
            environment:
              req.t("api.environment") +
              ": " +
              (process.env.NODE_ENV || "development"),
            database: dbHealthy
              ? req.t("api.database_connected")
              : "disconnected",
            language: {
              current: req.language || "pt",
              supported: ["pt", "en", "es"],
            },
            version: process.env.npm_package_version || "1.0.0",
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            checks: {
              database: dbHealthy ? "OK" : "FAIL",
            },
          },
        };

        res.status(statusCode).json(healthData);
      } catch (error) {
        res.status(503).json({
          success: false,
          message: req.t("errors.internal_server_error"),
          error: {
            code: "HEALTH_CHECK_FAILED",
            message: error.message,
            timestamp: new Date().toISOString(),
          },
        });
      }
    });

    // Configurar tratamento de erros
    configureErrorHandling(app);

    // ==========================================
    // TESTAR CONEXÃO COM BANCO
    // ==========================================

    logger.info("🔍 Testando conexão com banco de dados...");
    const dbHealthy = await healthCheck();

    if (!dbHealthy) {
      logger.error("❌ Falha na conexão com banco de dados");
      logger.error("Verifique as configurações de DB no arquivo .env");
      process.exit(1);
    }

    logger.info("✅ Conexão com banco de dados estabelecida");

    // ==========================================
    // INICIAR SERVIDOR
    // ==========================================

    const PORT = process.env.PORT || 3000;
    const server = app.listen(PORT, () => {
      logger.info("🚀 Polox CRM API iniciada com sucesso!");
      logger.info(`📍 Servidor rodando na porta: ${PORT}`);
      logger.info(`🌍 Ambiente: ${process.env.NODE_ENV || "development"}`);
      logger.info(`🔗 URL local: http://localhost:${PORT}`);
      logger.info(`❤️  Health check: http://localhost:${PORT}/health`);
      logger.info(`📚 API info: http://localhost:${PORT}/`);

      if (process.env.ENABLE_SWAGGER === "true") {
        logger.info(`📖 Swagger docs: http://localhost:${PORT}/api/v1/docs`);
      }

      logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
      logger.info("🎯 COPILOT_PROMPT_1 - ESTRUTURA BASE IMPLEMENTADA");
      logger.info("");
      logger.info("✅ Express.js configurado com middleware de segurança");
      logger.info("✅ Conexão PostgreSQL multi-tenant");
      logger.info("✅ Sistema de autenticação JWT");
      logger.info("✅ Middleware de isolamento multi-tenant");
      logger.info("✅ Tratamento de erros padronizado");
      logger.info("✅ Sistema de logs estruturado");
      logger.info("✅ Rate limiting configurado");
      logger.info("✅ Health check funcionando");
      logger.info("");
      logger.info("📝 PRÓXIMO PASSO: COPILOT_PROMPT_2");
      logger.info("   → Implementar AuthController e rotas de autenticação");
      logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    });

    // ==========================================
    // GRACEFUL SHUTDOWN
    // ==========================================

    const gracefulShutdown = (signal) => {
      logger.info(
        `📥 Recebido sinal ${signal}, iniciando shutdown graceful...`
      );

      server.close(() => {
        logger.info("🔒 Servidor HTTP fechado");

        // Fechar conexões do banco
        const { closePool } = require("./config/database");
        closePool()
          .then(() => {
            logger.info("🗄️  Pool de conexões PostgreSQL fechado");
            logger.info("✅ Shutdown completo");
            process.exit(0);
          })
          .catch((error) => {
            logger.error("❌ Erro ao fechar pool de conexões:", error);
            process.exit(1);
          });
      });

      // Force shutdown after 10 seconds
      setTimeout(() => {
        logger.error("⏰ Shutdown forçado após timeout");
        process.exit(1);
      }, 10000);
    };

    // Registrar handlers de shutdown
    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
    process.on("SIGINT", () => gracefulShutdown("SIGINT"));

    // Handler para erros não capturados
    process.on("uncaughtException", (error) => {
      logger.error("💥 Uncaught Exception:", error);
      gracefulShutdown("UNCAUGHT_EXCEPTION");
    });

    process.on("unhandledRejection", (reason, promise) => {
      logger.error("💥 Unhandled Rejection:", { reason, promise });
      gracefulShutdown("UNHANDLED_REJECTION");
    });
  } catch (error) {
    logger.error("❌ Falha ao iniciar servidor:", error);
    process.exit(1);
  }
}

// Iniciar servidor apenas se executado diretamente
if (require.main === module) {
  startServer();
}

module.exports = { startServer };
