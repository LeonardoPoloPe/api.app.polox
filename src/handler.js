const serverless = require("serverless-http");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const routes = require("./routes");
const { initializePool, closePool, logger, healthCheck } = require("./models");

// Configuração do Express
const app = express();

// Middlewares de segurança
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);

// Configuração CORS
app.use(
  cors({
    origin:
      process.env.NODE_ENV === "prod"
        ? ["https://app.polox.com", "https://polox.com"]
        : ["http://localhost:3000", "http://localhost:3001"],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  })
);

// Middlewares para parsing
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Middleware de logging de requisições
app.use((req, res, next) => {
  const start = Date.now();

  // Log da requisição
  logger.info("Requisição recebida:", {
    method: req.method,
    url: req.url,
    userAgent: req.get("User-Agent"),
    ip: req.ip,
    timestamp: new Date().toISOString(),
  });

  // Log da resposta
  res.on("finish", () => {
    const duration = Date.now() - start;
    logger.info("Resposta enviada:", {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString(),
    });
  });

  next();
});

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Health check da aplicação
 *     description: Verifica o status da aplicação e conexão com banco de dados
 *     tags: [Health]
 *     security: []
 *     responses:
 *       200:
 *         description: Aplicação saudável
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/HealthCheck'
 *       503:
 *         description: Aplicação com problemas
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/HealthCheck'
 */
// Health check endpoint
app.get("/health", async (req, res) => {
  try {
    const dbHealthy = await healthCheck();
    const status = dbHealthy ? "healthy" : "unhealthy";
    const statusCode = dbHealthy ? 200 : 503;

    res.status(statusCode).json({
      status,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      database: dbHealthy ? "connected" : "disconnected",
      version: process.env.npm_package_version || "1.0.0",
    });
  } catch (error) {
    logger.error("Health check falhou:", error);
    res.status(503).json({
      status: "unhealthy",
      timestamp: new Date().toISOString(),
      error: error.message,
    });
  }
});

/**
 * @swagger
 * /:
 *   get:
 *     summary: Informações da API
 *     description: Retorna informações básicas sobre a API Polox
 *     tags: [Health]
 *     security: []
 *     responses:
 *       200:
 *         description: Informações da API
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: API Polox - Serverless AWS Lambda
 *                 environment:
 *                   type: string
 *                   example: dev
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                   example: 2025-10-18T22:30:00Z
 *                 endpoints:
 *                   type: object
 *                   properties:
 *                     health:
 *                       type: string
 *                       example: /health
 *                     api:
 *                       type: string
 *                       example: /api
 *                     docs:
 *                       type: string
 *                       example: /docs
 */
// Rota raiz
app.get("/", (req, res) => {
  res.json({
    message: "API Polox - Serverless AWS Lambda",
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
    endpoints: {
      health: "/health",
      api: "/api",
      docs: "/api/docs", // Swagger será servido via rotas da API
    },
  });
});

// Registra todas as rotas da API
app.use("/api", routes);

// Middleware para rotas não encontradas
app.use("*", (req, res) => {
  res.status(404).json({
    error: "Rota não encontrada",
    method: req.method,
    url: req.originalUrl,
    timestamp: new Date().toISOString(),
  });
});

// Middleware global de tratamento de erros
app.use((error, req, res, next) => {
  logger.error("Erro não tratado:", {
    error: error.message,
    stack: error.stack,
    method: req.method,
    url: req.url,
    body: req.body,
    timestamp: new Date().toISOString(),
  });

  // Não expor detalhes do erro em produção
  const isDev = process.env.NODE_ENV === "dev";

  res.status(error.statusCode || 500).json({
    error: "Erro interno do servidor",
    message: isDev ? error.message : "Algo deu errado. Tente novamente.",
    timestamp: new Date().toISOString(),
    ...(isDev && { stack: error.stack }),
  });
});

// Inicialização do banco de dados
let isDbInitialized = false;

const initializeDatabase = async () => {
  if (!isDbInitialized) {
    try {
      logger.info("Inicializando conexão com banco de dados...");
      await initializePool();

      // Executar migrations automaticamente
      logger.info("Executando migrations...");
      const MigrationRunner = require("../migrations/migration-runner");
      const migrationRunner = new MigrationRunner();
      await migrationRunner.runPendingMigrations();
      await migrationRunner.close();

      isDbInitialized = true;
      logger.info("Banco de dados inicializado com sucesso");
    } catch (error) {
      logger.error("Erro ao inicializar banco de dados:", error);
      throw error;
    }
  }
};

// Handler principal para AWS Lambda
const handler = async (event, context) => {
  // Configurações do Lambda
  context.callbackWaitsForEmptyEventLoop = false;

  try {
    // Inicializa banco de dados se necessário
    await initializeDatabase();

    // Processa a requisição através do serverless-http
    const serverlessHandler = serverless(app, {
      request: (request, event, context) => {
        request.serverless = { event, context };
      },
    });

    return await serverlessHandler(event, context);
  } catch (error) {
    logger.error("Erro no handler principal:", error);

    return {
      statusCode: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type,Authorization",
      },
      body: JSON.stringify({
        error: "Erro interno do servidor",
        timestamp: new Date().toISOString(),
      }),
    };
  }
};

// Processo de cleanup quando Lambda é reciclado
process.on("SIGTERM", async () => {
  logger.info("Recebido SIGTERM, fechando conexões...");
  try {
    await closePool();
    logger.info("Conexões fechadas com sucesso");
  } catch (error) {
    logger.error("Erro ao fechar conexões:", error);
  }
});

// Para desenvolvimento local
if (require.main === module) {
  const port = process.env.PORT || 3000;

  initializeDatabase()
    .then(() => {
      app.listen(port, () => {
        logger.info(`Servidor rodando localmente na porta ${port}`);
        logger.info(`Health check: http://localhost:${port}/health`);
        logger.info(`API: http://localhost:${port}/api`);
      });
    })
    .catch((error) => {
      logger.error("Erro ao iniciar servidor local:", error);
      process.exit(1);
    });
}

module.exports = { handler, app };
