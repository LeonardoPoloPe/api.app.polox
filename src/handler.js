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

// Sentry será carregado automaticamente via Layer e NODE_OPTIONS

const serverless = require("serverless-http");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const routes = require("./routes");
const { initializePool, closePool, logger, healthCheck } = require("./models");
const { i18nMiddleware, i18next } = require("./config/i18n");
const {
  responseHelpers,
  errorHandler,
  notFoundHandler,
} = require("./utils/response-helpers");

// ============================================================================
// COPYRIGHT PROTECTION - Validação de Propriedade Intelectual
// ============================================================================
const {
  initializeCopyrightValidator,
  copyrightMiddleware,
} = require("./middleware/copyright-validator");

// Executa validação ao iniciar (apenas em produção/sandbox)
if (
  process.env.NODE_ENV === "production" ||
  process.env.NODE_ENV === "sandbox"
) {
  try {
    initializeCopyrightValidator();
  } catch (error) {
    logger.error("Copyright validation failed:", error);
    // Em modo estrito, não permite inicialização
    if (process.env.COPYRIGHT_STRICT_MODE === "true") {
      throw error;
    }
  }
}
// ============================================================================

// Configuração do Express
const app = express();

// Importar configuração customizada do Sentry
const {
  initSentry,
  captureError,
  captureMessage,
  wrapLambdaHandler,
  flushSentry,
  Sentry,
} = require("./config/sentry");

// Middlewares de segurança
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);

/**
 * ============================================================================
 * 🌐 CONFIGURAÇÃO CORS (Cross-Origin Resource Sharing)
 * ============================================================================
 *
 * Define as origens (domínios) permitidas para acessar a API.
 *
 * 📖 DOCUMENTAÇÃO COMPLETA: docs/CONFIGURACAO_CORS.md
 *
 * ⚠️  IMPORTANTE:
 * - URLs devem ser EXATAS (http/https, com/sem www)
 * - Separadas por ambiente (dev, sandbox, prod)
 * - Após adicionar nova origem, fazer DEPLOY no ambiente
 * - Testar com: curl -H "Origin: https://nova-url.com" [endpoint] -v
 *
 * 🔍 TROUBLESHOOTING:
 * - Se CORS bloquear, verificar logs: "CORS bloqueou origem: [url]"
 * - Verificar se NODE_ENV está correto no Lambda
 * - Confirmar que a URL é exatamente como o navegador envia
 *
 * ============================================================================
 */
const getAllowedOrigins = () => {
  const env = process.env.NODE_ENV || "dev";

  // 🌐 URLs das APIs (para Swagger UI poder testar os endpoints)
  const apiUrls = [
    "https://z8ixwvp0qe.execute-api.sa-east-1.amazonaws.com", // DEV API
    "https://el0qui6eqj.execute-api.sa-east-1.amazonaws.com", // SANDBOX API
    "https://18yioqws85.execute-api.sa-east-1.amazonaws.com", // PROD API
  ];

  const origins = {
    // 🔴 PRODUÇÃO - Domínios oficiais e white-labels
    prod: [
      "https://app.polox.com", // App principal
      "https://app.polox.com.br", // App principal (.br)
      "https://polox.com", // Site institucional
      "https://polox.com.br", // Site institucional (.br)
      "https://bomelo.com.br", // White-label: Bomelo (parceiro)
      ...apiUrls, // URLs da API (Swagger)
      // 📝 Para adicionar novo white-label, adicione aqui e faça deploy
    ],

    // 🟡 SANDBOX - Ambiente de homologação/testes
    sandbox: [
      "https://app-sandbox.polox.com", // App de testes
      "https://app-sandbox.polox.com.br", // App de testes (.br)
      "https://sandbox.polox.com", // Sandbox alternativo
      "https://sandbox.polox.com.br", // Sandbox alternativo (.br)
      "http://localhost:3000", // Dev local (React padrão)
      "http://localhost:3001", // Dev local (porta alternativa)
      ...apiUrls, // URLs da API (Swagger)
    ],

    // 🟢 DESENVOLVIMENTO - Apenas localhost
    dev: [
      "http://localhost:3000", // React/Next.js padrão
      "http://localhost:3001", // Porta alternativa
      "http://localhost:5173", // Vite padrão
      "http://localhost:5174", // Vite alternativa
      ...apiUrls, // URLs da API (Swagger)
    ],
  };

  // Retorna origens do ambiente ou dev como fallback
  return origins[env] || origins.dev;
};

/**
 * ============================================================================
 * 🔧 MIDDLEWARE CORS - Configuração do Express
 * ============================================================================
 *
 * Valida e permite requisições de diferentes origens (cross-origin).
 *
 * 📋 CONFIGURAÇÕES:
 *
 * • origin: Função que valida se a origem é permitida
 *   - Permite requisições sem origin (mobile apps, Postman, curl)
 *   - Valida contra a lista getAllowedOrigins()
 *   - Loga tentativas bloqueadas para debugging
 *
 * • credentials: true
 *   - Permite envio de cookies e headers de autenticação
 *   - Necessário para JWT em headers Authorization
 *
 * • methods: Métodos HTTP permitidos
 *   - GET, POST, PUT, DELETE, PATCH: Operações normais
 *   - OPTIONS: Obrigatório para preflight requests do navegador
 *
 * • allowedHeaders: Headers que o cliente pode enviar
 *   - Content-Type: Tipo de conteúdo (application/json)
 *   - Authorization: Token JWT (Bearer token)
 *   - Accept-Language: Idioma preferido (pt, en, es)
 *   - X-Requested-With: Identificação de requisições AJAX
 *
 * • exposedHeaders: Headers que o cliente pode ler na resposta
 *   - Content-Language: Idioma da resposta
 *
 * • maxAge: 86400 (24 horas)
 *   - Cache da resposta de preflight no navegador
 *   - Reduz número de requests OPTIONS
 *
 * 🔍 PREFLIGHT REQUEST:
 * Navegadores fazem um request OPTIONS antes de POST/PUT/DELETE para verificar
 * se a origem é permitida. Esta configuração responde automaticamente.
 *
 * 📖 Docs completas: docs/CONFIGURACAO_CORS.md
 * ============================================================================
 */
app.use(
  cors({
    origin: (origin, callback) => {
      const allowedOrigins = getAllowedOrigins();

      // Permitir requisições sem origin (como mobile apps, Postman, etc)
      if (!origin) return callback(null, true);

      if (allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        logger.warn(`CORS bloqueou origem: ${origin}`, {
          origin,
          allowedOrigins,
          env: process.env.NODE_ENV,
        });
        callback(new Error(`Origem ${origin} não permitida por CORS`));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "Accept",
      "Accept-Language",
      "Origin",
    ],
    exposedHeaders: ["Content-Language"],
    maxAge: 86400, // 24 horas
  })
);

// Middlewares para parsing
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Middleware de internacionalização
app.use(i18nMiddleware);

// Middleware de fallback para req.t (caso o i18n middleware falhe)
app.use((req, res, next) => {
  if (!req.t || typeof req.t !== 'function') {
    req.t = (key, options = {}) => {
      const language = req.language || req.headers['accept-language'] || 'pt';
      return i18next.t(key, { ...options, lng: language });
    };
  }
  next();
});

// Middleware de copyright (adiciona headers de propriedade)
app.use(copyrightMiddleware);

// Middleware para helpers de resposta
app.use(responseHelpers);

// Inicializar Sentry
initSentry();

// Middleware de logging de requisições (integrado com Sentry)
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
 *     parameters:
 *       - in: header
 *         name: Accept-Language
 *         schema:
 *           type: string
 *           enum: [pt, en, es]
 *           default: pt
 *         description: "Define o idioma da resposta (pt, en, es)."
 *         required: false
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
    const statusCode = dbHealthy ? 200 : 503;

    res.status(statusCode).json({
      success: true,
      message: req.t("api.status"),
      data: {
        status: dbHealthy ? req.t("api.healthy") : "unhealthy",
        timestamp: new Date().toISOString(),
        environment: req.t("api.environment") + ": " + process.env.NODE_ENV,
        database: dbHealthy ? req.t("api.database_connected") : "disconnected",
        language: {
          current: req.language || "pt",
          supported: ["pt", "en", "es"],
        },
        version: process.env.npm_package_version || "1.0.0",
      },
    });
  } catch (error) {
    logger.error("Health check falhou:", error);
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

/**
 * @swagger
 * /:
 *   get:
 *     summary: Informações da API
 *     description: Retorna informações básicas sobre a API Polox
 *     tags: [Health]
 *     security: []
 *     parameters:
 *       - in: header
 *         name: Accept-Language
 *         schema:
 *           type: string
 *           enum: [pt, en, es]
 *           default: pt
 *         description: "Define o idioma da resposta (pt, en, es)."
 *         required: false
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
// Rota raiz com suporte a i18n
app.get("/", (req, res) => {
  res.sendSuccess(
    {
      message: req.t("api.welcome"),
      version:
        req.t("api.version") +
        ": " +
        (process.env.npm_package_version || "1.0.0"),
      environment: req.t("api.environment") + ": " + process.env.NODE_ENV,
      timestamp: new Date().toISOString(),
      language: {
        current: req.language || "pt",
        supported: ["pt", "en", "es"],
      },
      endpoints: {
        health: "/health",
        api: "/api/v1",
        docs: "/api/v1/docs",
        languages: "/languages",
      },
    },
    "api.welcome"
  );
});

/**
 * @swagger
 * /languages:
 *   get:
 *     summary: Obter informações de idiomas suportados
 *     description: Retorna informações sobre os idiomas suportados pela API
 *     tags: [Multi-Idiomas]
 *     security: []
 *     parameters:
 *       - in: header
 *         name: Accept-Language
 *         schema:
 *           type: string
 *           enum: [pt, en, es]
 *           default: pt
 *         description: "Define o idioma da resposta (pt, en, es)."
 *         required: false
 *     responses:
 *       200:
 *         description: Informações de idiomas obtidas com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Operação realizada com sucesso"
 *                 data:
 *                   type: object
 *                   properties:
 *                     current:
 *                       type: string
 *                       example: "pt"
 *                     supported:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: ["pt", "en", "es"]
 *                     details:
 *                       type: array
 *                       items:
 *                         type: object
 */
// Endpoint para informações de idiomas
app.get("/languages", (req, res) => {
  const { getSupportedLanguages, getLanguagesInfo } = require("./config/i18n");

  res.sendSuccess(
    {
      current: req.language || "pt",
      supported: getSupportedLanguages(),
      details: getLanguagesInfo(),
    },
    "messages.success"
  );
});

/**
 * @swagger
 * /test-sentry:
 *   get:
 *     summary: Teste do Sentry - Gera erro intencional
 *     description: Endpoint para testar se o Sentry está capturando erros corretamente
 *     tags: [Health]
 *     security: []
 *     responses:
 *       500:
 *         description: Erro intencional para teste do Sentry
 */
// Rota de teste do Sentry
app.get("/test-sentry", (req, res) => {
  captureMessage("Teste de mensagem do Sentry", "info", {
    test_type: "manual",
    user_agent: req.get("User-Agent"),
    ip: req.ip,
  });

  // Erro intencional para testar Sentry
  throw new Error("This should show up in Sentry!");
});

/**
 * @swagger
 * /test-sentry-message:
 *   get:
 *     summary: Teste do Sentry - Mensagem personalizada
 *     description: Endpoint para testar mensagens personalizadas no Sentry
 *     tags: [Health]
 *     security: []
 *     responses:
 *       200:
 *         description: Mensagem enviada ao Sentry com sucesso
 */
// Rota de teste de mensagem do Sentry
app.get("/test-sentry-message", (req, res) => {
  captureMessage("Teste de mensagem personalizada do Sentry", "warning", {
    test_type: "message",
    timestamp: new Date().toISOString(),
    user_agent: req.get("User-Agent"),
    path: req.path,
  });

  res.json({
    message: "Mensagem de teste enviada para o Sentry",
    timestamp: new Date().toISOString(),
    sentry_enabled: process.env.SENTRY_DSN ? true : false,
  });
});

// Registra todas as rotas da API (versão 1)
app.use("/api/v1", routes);

// Error handling middleware personalizado será aplicado automaticamente

// Middleware para rotas não encontradas (com i18n)
app.use("*", notFoundHandler);

// Middleware global de tratamento de erros (com i18n)
app.use(errorHandler);

// Middleware original de tratamento de erros (para casos específicos do Sentry)
app.use((error, req, res, next) => {
  // Capturar erro no Sentry com contexto completo
  captureError(error, {
    request: {
      method: req.method,
      url: req.url,
      body: req.body,
      headers: req.headers,
      user: req.user,
    },
    lambda: {
      function_name: process.env.AWS_LAMBDA_FUNCTION_NAME,
      function_version: process.env.AWS_LAMBDA_FUNCTION_VERSION,
      memory_size: process.env.AWS_LAMBDA_FUNCTION_MEMORY_SIZE,
    },
  });

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

      // Executar migrations automaticamente (apenas se não estiver skipando)
      if (process.env.SKIP_MIGRATIONS !== "true") {
        logger.info("Executando migrations...");
        const MigrationRunner = require("../migrations/migration-runner");
        const migrationRunner = new MigrationRunner();
        await migrationRunner.runPendingMigrations();
        await migrationRunner.close();
      } else {
        logger.info("Migrations puladas (SKIP_MIGRATIONS=true)");
      }

      isDbInitialized = true;
      logger.info("Banco de dados inicializado com sucesso");
    } catch (error) {
      logger.error("Erro ao inicializar banco de dados:", error);
      throw error;
    }
  }
};

// Handler principal para AWS Lambda (com Sentry wrapper)
const lambdaHandler = async (event, context) => {
  // Configurações do Lambda
  context.callbackWaitsForEmptyEventLoop = false;

  try {
    // Adicionar contexto Lambda ao Sentry (placeholder para compatibilidade)
    // setTags será implementado automaticamente

    // Inicializa banco de dados se necessário
    await initializeDatabase();

    // Processa a requisição através do serverless-http
    const serverlessHandler = serverless(app, {
      request: (request, event, context) => {
        request.serverless = { event, context };
      },
    });

    const result = await serverlessHandler(event, context);

    // Flush Sentry antes de retornar
    await flushSentry(1000);

    return result;
  } catch (error) {
    // Capturar erro crítico no Sentry
    captureError(error, {
      lambda: {
        function_name: process.env.AWS_LAMBDA_FUNCTION_NAME,
        request_id: context.awsRequestId,
        remaining_time: context.getRemainingTimeInMillis(),
        memory_limit: context.memoryLimitInMB,
      },
      event: {
        httpMethod: event.httpMethod,
        path: event.path,
        queryStringParameters: event.queryStringParameters,
        headers: event.headers,
      },
    });

    logger.error("Erro no handler principal:", error);

    // Flush Sentry antes de retornar erro
    await flushSentry(1000);

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

// Wrapper do Sentry para o handler
const handler = wrapLambdaHandler(lambdaHandler);

// Processo de cleanup quando Lambda é reciclado
process.on("SIGTERM", async () => {
  logger.info("Recebido SIGTERM, fechando conexões...");
  try {
    await flushSentry(2000); // Garantir que logs do Sentry sejam enviados
    await closePool();
    logger.info("Conexões fechadas com sucesso");
  } catch (error) {
    logger.error("Erro ao fechar conexões:", error);
    captureError(error, { process: "cleanup" });
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
