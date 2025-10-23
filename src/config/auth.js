const crypto = require("crypto");

/**
 * Configurações de autenticação JWT para sistema multi-tenant
 * Configuração enterprise com múltiplos níveis de segurança
 */

// Configurações JWT
const jwtConfig = {
  // Configurações de token de acesso
  accessToken: {
    secret:
      process.env.JWT_SECRET ||
      (() => {
        throw new Error(
          "JWT_SECRET não configurado! Configure via AWS Secrets Manager ou variável de ambiente."
        );
      })(),
    expiresIn: process.env.JWT_EXPIRES_IN || "24h",
    algorithm: "HS256",
    issuer: "polox-crm",
    audience: "polox-users",
  },

  // Configurações de refresh token
  refreshToken: {
    secret:
      process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET + "_refresh",
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
    algorithm: "HS256",
    issuer: "polox-crm",
    audience: "polox-users",
  },

  // Configurações de reset de senha
  resetToken: {
    secret: process.env.JWT_RESET_SECRET || process.env.JWT_SECRET + "_reset",
    expiresIn: "1h", // Tokens de reset expiram em 1 hora
    algorithm: "HS256",
    issuer: "polox-crm",
    audience: "polox-password-reset",
  },
};

// Configurações de bcrypt para hash de senhas
const bcryptConfig = {
  rounds: parseInt(process.env.BCRYPT_ROUNDS) || 12, // Rounds mais altos = mais seguro mas mais lento
  pepper: process.env.BCRYPT_PEPPER || "polox_pepper_2025", // Pepper adicional para segurança extra
};

// Configurações de sessão
const sessionConfig = {
  maxSessions: parseInt(process.env.MAX_SESSIONS_PER_USER) || 5, // Máximo de sessões simultâneas por usuário
  sessionTimeout: parseInt(process.env.SESSION_TIMEOUT) || 24 * 60 * 60 * 1000, // 24 horas em ms
  cleanupInterval:
    parseInt(process.env.SESSION_CLEANUP_INTERVAL) || 60 * 60 * 1000, // 1 hora em ms
  extendOnActivity: process.env.EXTEND_SESSION_ON_ACTIVITY !== "false", // Estender sessão com atividade
};

// Configurações de segurança adicional
const securityConfig = {
  // Rate limiting por usuário
  rateLimiting: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW) || 15 * 60 * 1000, // 15 minutos
    maxAttempts: parseInt(process.env.RATE_LIMIT_MAX_ATTEMPTS) || 100, // 100 requests por window
    skipSuccessfulRequests: true,
    skipFailedRequests: false,
  },

  // Configurações de login
  login: {
    maxFailedAttempts: parseInt(process.env.MAX_FAILED_ATTEMPTS) || 5,
    lockoutDuration: parseInt(process.env.LOCKOUT_DURATION) || 30 * 60 * 1000, // 30 minutos
    progressiveDelay: true, // Delay progressivo após falhas
  },

  // Configurações de senha
  password: {
    minLength: parseInt(process.env.PASSWORD_MIN_LENGTH) || 8,
    maxLength: parseInt(process.env.PASSWORD_MAX_LENGTH) || 128,
    requireUppercase: process.env.PASSWORD_REQUIRE_UPPERCASE !== "false",
    requireLowercase: process.env.PASSWORD_REQUIRE_LOWERCASE !== "false",
    requireNumbers: process.env.PASSWORD_REQUIRE_NUMBERS !== "false",
    requireSpecialChars: process.env.PASSWORD_REQUIRE_SPECIAL !== "false",
    preventReuse: parseInt(process.env.PASSWORD_PREVENT_REUSE) || 5, // Últimas 5 senhas não podem ser reutilizadas
  },

  // Configurações de auditoria
  audit: {
    logFailedLogins: true,
    logSuccessfulLogins: process.env.NODE_ENV === "production",
    logPermissionDenied: true,
    logPasswordChanges: true,
    logTokenRefresh: process.env.NODE_ENV === "development",
    retentionDays: parseInt(process.env.AUDIT_RETENTION_DAYS) || 90,
  },
};

// Roles e permissões do sistema
const rolesConfig = {
  // Hierarquia de roles
  hierarchy: {
    super_admin: 1000, // Acesso total a todas as empresas
    company_admin: 500, // Acesso total à própria empresa
    manager: 200, // Acesso de gestão com algumas limitações
    user: 100, // Acesso básico aos módulos permitidos
    viewer: 50, // Acesso apenas de visualização
  },

  // Permissões por módulo
  modules: {
    dashboard: ["super_admin", "company_admin", "manager", "user", "viewer"],
    users: ["super_admin", "company_admin"],
    companies: ["super_admin"],
    leads: ["super_admin", "company_admin", "manager", "user"],
    clients: ["super_admin", "company_admin", "manager", "user"],
    sales: ["super_admin", "company_admin", "manager", "user"],
    products: ["super_admin", "company_admin", "manager", "user"],
    finance: ["super_admin", "company_admin", "manager"],
    schedule: ["super_admin", "company_admin", "manager", "user"],
    tickets: ["super_admin", "company_admin", "manager", "user"],
    suppliers: ["super_admin", "company_admin", "manager"],
    analytics: ["super_admin", "company_admin", "manager"],
    gamification: ["super_admin", "company_admin", "manager", "user"],
    notifications: ["super_admin", "company_admin", "manager", "user"],
  },

  // Ações específicas por role
  actions: {
    super_admin: ["*"], // Todas as ações
    company_admin: ["create", "read", "update", "delete", "manage"],
    manager: ["create", "read", "update", "assign", "report"],
    user: ["create", "read", "update_own"],
    viewer: ["read"],
  },
};

// Configurações de multi-tenancy
const tenantConfig = {
  isolation: {
    level: "row", // row-level security
    enforceOnQueries: true,
    allowSuperAdminOverride: true,
  },

  // Configurações por plano
  plans: {
    starter: {
      maxUsers: 5,
      maxStorage: 1024 * 1024 * 1024, // 1GB
      modules: ["dashboard", "leads", "clients", "sales", "gamification"],
      features: ["basic_reporting", "email_notifications"],
    },
    professional: {
      maxUsers: 25,
      maxStorage: 5 * 1024 * 1024 * 1024, // 5GB
      modules: [
        "dashboard",
        "leads",
        "clients",
        "sales",
        "products",
        "finance",
        "schedule",
        "tickets",
        "gamification",
      ],
      features: [
        "advanced_reporting",
        "email_notifications",
        "sms_notifications",
        "api_access",
      ],
    },
    enterprise: {
      maxUsers: -1, // Ilimitado
      maxStorage: -1, // Ilimitado
      modules: ["*"], // Todos os módulos
      features: ["*"], // Todas as funcionalidades
    },
  },
};

// Função para gerar chaves seguras
const generateSecureKey = (length = 32) => {
  return crypto.randomBytes(length).toString("hex");
};

// Função para validar configuração JWT
const validateJWTConfig = () => {
  const warnings = [];

  // Verificar se está usando chaves padrão em produção
  if (process.env.NODE_ENV === "production") {
    if (jwtConfig.accessToken.secret.includes("polox_super_secret_key")) {
      warnings.push(
        "⚠️  Usando JWT_SECRET padrão em produção! Altere imediatamente."
      );
    }

    if (bcryptConfig.rounds < 12) {
      warnings.push(
        "⚠️  BCRYPT_ROUNDS muito baixo para produção. Recomendado: 12+"
      );
    }
  }

  return warnings;
};

// Função para obter configuração baseada no ambiente
const getEnvironmentConfig = () => {
  const isProduction = process.env.NODE_ENV === "production";

  return {
    isDevelopment: !isProduction,
    isProduction,
    enableDebugLogs: process.env.DEBUG_AUTH === "true",
    strictMode: isProduction,
    allowInsecurePasswords:
      !isProduction && process.env.ALLOW_WEAK_PASSWORDS === "true",
  };
};

module.exports = {
  jwt: jwtConfig,
  bcrypt: bcryptConfig,
  session: sessionConfig,
  security: securityConfig,
  roles: rolesConfig,
  tenant: tenantConfig,
  environment: getEnvironmentConfig(),
  utils: {
    generateSecureKey,
    validateJWTConfig,
  },
};
