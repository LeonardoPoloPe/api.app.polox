/**
 * Configuração simplificada do Sentry para monitoramento e captura de erros
 * AWS Lambda + Node.js + Express.js
 * Implementação leve sem dependências pesadas do SDK oficial
 */

const https = require("https");
const crypto = require("crypto");

// Configuração global do Sentry
let sentryConfig = {
  dsn: "",
  environment: "dev",
  enabled: false,
  projectId: "",
  publicKey: "",
  host: "o4510250740285440.ingest.de.sentry.io",
};

/**
 * Inicializa o Sentry simplificado
 */
function initSentry() {
  const environment = process.env.NODE_ENV || "dev";
  const dsn = process.env.SENTRY_DSN;

  if (!dsn) {
    console.warn("⚠️ SENTRY_DSN não configurado - Sentry desabilitado");
    return;
  }

  // Parse do DSN: https://PUBLIC_KEY@HOST/PROJECT_ID
  const dsnMatch = dsn.match(/https:\/\/([^@]+)@([^\/]+)\/(\d+)/);
  if (!dsnMatch) {
    console.error("❌ DSN do Sentry inválido");
    return;
  }

  sentryConfig = {
    dsn: dsn,
    environment: environment,
    enabled: true,
    publicKey: dsnMatch[1],
    host: dsnMatch[2],
    projectId: dsnMatch[3],
  };

  console.log(
    `✅ Sentry simplificado inicializado - Environment: ${environment}`
  );
}

/**
 * Middleware Express simplificado para capturar erros
 */
function getSentryMiddleware() {
  return {
    // Request handler - adiciona contexto
    requestHandler: (req, res, next) => {
      req.sentryContext = {
        method: req.method,
        url: req.url,
        headers: req.headers,
        query: req.query,
        timestamp: new Date().toISOString(),
      };
      next();
    },

    // Tracing handler (placeholder)
    tracingHandler: (req, res, next) => {
      next();
    },

    // Error handler - captura erros
    errorHandler: (error, req, res, next) => {
      captureError(error, { request: req.sentryContext });
      next(error);
    },
  };
}

/**
 * Wrapper para funções Lambda com Sentry simplificado
 */
function wrapLambdaHandler(handler) {
  return async (event, context) => {
    try {
      return await handler(event, context);
    } catch (error) {
      captureError(error, {
        lambda: {
          function_name: process.env.AWS_LAMBDA_FUNCTION_NAME,
          request_id: context.awsRequestId,
          event: event,
        },
      });
      await flushSentry(1000);
      throw error;
    }
  };
}

/**
 * Envia dados para o Sentry via HTTP
 */
function sendToSentry(data) {
  if (!sentryConfig.enabled) return Promise.resolve();

  return new Promise((resolve) => {
    const payload = JSON.stringify(data);
    const timestamp = Math.floor(Date.now() / 1000);
    const auth = `Sentry sentry_version=7, sentry_client=api-polox/1.0.0, sentry_timestamp=${timestamp}, sentry_key=${sentryConfig.publicKey}`;

    const options = {
      hostname: sentryConfig.host,
      port: 443,
      path: `/api/${sentryConfig.projectId}/store/`,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload),
        "X-Sentry-Auth": auth,
        "User-Agent": "api-polox/1.0.0",
      },
    };

    const req = https.request(options, (res) => {
      res.on("data", () => {}); // Consumir dados
      res.on("end", () => resolve());
    });

    req.on("error", (err) => {
      console.error("Erro ao enviar para Sentry:", err.message);
      resolve();
    });

    req.setTimeout(2000, () => {
      req.destroy();
      resolve();
    });

    req.write(payload);
    req.end();
  });
}

/**
 * Captura erro manualmente com contexto adicional
 */
function captureError(error, context = {}) {
  if (!sentryConfig.enabled) return;

  const errorData = {
    event_id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    level: "error",
    platform: "node",
    environment: sentryConfig.environment,
    server_name: process.env.AWS_LAMBDA_FUNCTION_NAME || "api-polox",
    release: process.env.SENTRY_RELEASE || "api-polox@1.0.0",
    exception: {
      values: [
        {
          type: error.name || "Error",
          value: error.message,
          stacktrace: {
            frames: parseStackTrace(error.stack),
          },
        },
      ],
    },
    extra: context,
    tags: {
      component: "api-polox",
      runtime: "aws-lambda",
      framework: "express",
      ...context.tags,
    },
  };

  sendToSentry(errorData).catch(() => {});
}

/**
 * Captura mensagem/evento customizado
 */
function captureMessage(message, level = "info", context = {}) {
  if (!sentryConfig.enabled) return;

  const messageData = {
    event_id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    level: level,
    platform: "node",
    environment: sentryConfig.environment,
    server_name: process.env.AWS_LAMBDA_FUNCTION_NAME || "api-polox",
    release: process.env.SENTRY_RELEASE || "api-polox@1.0.0",
    message: {
      message: message,
    },
    extra: context,
    tags: {
      component: "api-polox",
      runtime: "aws-lambda",
      framework: "express",
      ...context.tags,
    },
  };

  sendToSentry(messageData).catch(() => {});
}

/**
 * Parse stack trace para formato Sentry
 */
function parseStackTrace(stack) {
  if (!stack) return [];

  return stack
    .split("\n")
    .slice(1)
    .map((line) => {
      const match = line.match(/\s*at\s+(.+?)\s+\((.+):(\d+):(\d+)\)/);
      if (match) {
        return {
          function: match[1],
          filename: match[2],
          lineno: parseInt(match[3]),
          colno: parseInt(match[4]),
        };
      }
      return { function: line.trim() };
    })
    .filter((frame) => frame.function);
}

/**
 * Placeholders para compatibilidade
 */
function setUser(userData) {
  // Placeholder - context será adicionado nos próximos eventos
}

function setTags(tags) {
  // Placeholder - tags serão adicionadas nos próximos eventos
}

/**
 * Flush Sentry (não necessário na implementação HTTP)
 */
async function flushSentry(timeout = 2000) {
  // Na implementação HTTP, os dados já são enviados imediatamente
  return Promise.resolve();
}

module.exports = {
  initSentry,
  getSentryMiddleware,
  wrapLambdaHandler,
  captureError,
  captureMessage,
  setUser,
  setTags,
  flushSentry,
  Sentry: {
    // Objeto compatível para não quebrar imports existentes
    setUser,
    setTags,
    captureException: captureError,
    captureMessage,
    flush: flushSentry,
  },
};
