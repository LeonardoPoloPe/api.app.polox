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
