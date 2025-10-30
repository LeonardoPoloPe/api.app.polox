/**
 * ==========================================
 * 🧪 SERVER TEST - Express Instance for Tests
 * ==========================================
 *
 * Instância Express configurada especialmente para testes.
 * NÃO inicia um servidor HTTP, apenas exporta o app.
 *
 * Usado por Supertest para fazer requisições HTTP simuladas.
 */

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
// Usar o roteador modular (com validações/middlewares) em src/routes/index.js
const routes = require("./routes/index.js");
const { i18nMiddleware } = require("./config/i18n");
const { responseHelpers } = require("./utils/response-helpers");
const { errorHandler, notFoundHandler } = require("./utils/errors");
const { logger } = require("./utils/logger");

// Criar instância Express
const app = express();

// Middlewares de segurança (simplificados para testes)
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);

// CORS aberto para testes
app.use(
  cors({
    origin: true,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "Accept-Language",
    ],
  })
);

// Middlewares para parsing
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Middleware de internacionalização
app.use(i18nMiddleware);

// Middleware para helpers de resposta
app.use(responseHelpers);

// Middleware de logging simplificado para testes
app.use((req, res, next) => {
  if (process.env.NODE_ENV !== "test" || process.env.TEST_VERBOSE === "true") {
    logger.info(`[TEST] ${req.method} ${req.url}`);
  }
  next();
});

// Health check simplificado
app.get("/health", (req, res) => {
  res.json({
    success: true,
    message: "API Test Server is running",
    data: {
      status: "healthy",
      timestamp: new Date().toISOString(),
      environment: "test",
    },
  });
});

// Rota raiz
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "API Polox - Test Server",
    environment: "test",
    timestamp: new Date().toISOString(),
  });
});

// Registrar todas as rotas da API com o prefixo usado nos testes
app.use("/api/v1", routes);

// Middleware para rotas não encontradas
app.use("*", notFoundHandler);

// Middleware global de tratamento de erros
app.use(errorHandler);

// Exportar apenas o app (NÃO iniciar servidor)
module.exports = app;
