/**
 * Middleware personalizado para integração com Sentry
 * Usar nos controllers para monitoramento avançado
 */

const {
  captureError,
  captureMessage,
  setUser,
  setTags,
  Sentry,
} = require("../config/sentry");

/**
 * Middleware para adicionar contexto do usuário autenticado ao Sentry
 */
const sentryUserContext = (req, res, next) => {
  if (req.user) {
    setUser({
      id: req.user.id,
      email: req.user.email,
      company_id: req.user.company_id,
      role: req.user.role,
      company_name: req.user.company_name,
    });

    setTags({
      user_role: req.user.role,
      company_id: req.user.company_id,
      authenticated: "true",
    });
  } else {
    setTags({
      authenticated: "false",
    });
  }

  next();
};

/**
 * Middleware para capturar operações de database no Sentry
 */
const sentryDatabaseContext = (operation, table, data = {}) => {
  return (req, res, next) => {
    setTags({
      db_operation: operation,
      db_table: table,
    });

    Sentry.addBreadcrumb({
      message: `Database ${operation} on ${table}`,
      category: "database",
      level: "info",
      data: data,
    });

    next();
  };
};

/**
 * Wrapper para controllers que adiciona contexto automático ao Sentry
 */
const withSentryContext = (controllerName, actionName) => {
  return (handler) => {
    return async (req, res, next) => {
      // Adicionar contexto do controller
      setTags({
        controller: controllerName,
        action: actionName,
        method: req.method,
        route: req.route?.path || req.path,
      });

      // Breadcrumb da operação
      Sentry.addBreadcrumb({
        message: `${controllerName}.${actionName}`,
        category: "controller",
        level: "info",
        data: {
          method: req.method,
          path: req.path,
          query: req.query,
          params: req.params,
        },
      });

      try {
        await handler(req, res, next);
      } catch (error) {
        // Capturar erro com contexto do controller
        captureError(error, {
          controller: {
            name: controllerName,
            action: actionName,
            method: req.method,
            path: req.path,
          },
          request: {
            query: req.query,
            params: req.params,
            body: req.body,
            user: req.user,
          },
        });

        throw error; // Re-throw para que o error handler global pegue
      }
    };
  };
};

/**
 * Wrapper para transações Sentry (para operações longas)
 */
const withSentryTransaction = (transactionName, operation) => {
  return async (data) => {
    const transaction = Sentry.startTransaction({
      name: transactionName,
      op: operation,
    });

    Sentry.getCurrentHub().configureScope((scope) => {
      scope.setSpan(transaction);
    });

    try {
      const result = await data();
      transaction.setStatus("ok");
      return result;
    } catch (error) {
      transaction.setStatus("internal_error");
      captureError(error, {
        transaction: transactionName,
        operation: operation,
      });
      throw error;
    } finally {
      transaction.finish();
    }
  };
};

/**
 * Middleware para capturar performance de queries SQL
 */
const sentryQueryPerformance = (queryName) => {
  return {
    start: () => {
      const span = Sentry.getCurrentHub().getScope()?.getSpan()?.startChild({
        op: "database.query",
        description: queryName,
      });

      const startTime = Date.now();

      return {
        finish: (rowCount = null) => {
          const duration = Date.now() - startTime;

          if (span) {
            span.setData("rows_affected", rowCount);
            span.setData("duration_ms", duration);
            span.finish();
          }

          // Log performance lenta
          if (duration > 1000) {
            captureMessage(`Slow query detected: ${queryName}`, "warning", {
              query: queryName,
              duration_ms: duration,
              rows_affected: rowCount,
            });
          }
        },
      };
    },
  };
};

/**
 * Capturar métricas customizadas
 */
const captureMetric = (metricName, value, tags = {}) => {
  Sentry.addBreadcrumb({
    message: `Metric: ${metricName} = ${value}`,
    category: "metric",
    level: "info",
    data: {
      metric_name: metricName,
      value: value,
      ...tags,
    },
  });
};

/**
 * Capturar eventos de negócio importantes
 */
const captureBusinessEvent = (eventName, data = {}) => {
  captureMessage(`Business Event: ${eventName}`, "info", {
    event_type: "business",
    event_name: eventName,
    ...data,
  });
};

module.exports = {
  sentryUserContext,
  sentryDatabaseContext,
  withSentryContext,
  withSentryTransaction,
  sentryQueryPerformance,
  captureMetric,
  captureBusinessEvent,
};
