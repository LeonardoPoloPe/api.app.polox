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

const i18next = require("i18next");
const Backend = require("i18next-fs-backend");
const middleware = require("i18next-http-middleware");
const path = require("path");

/**
 * Configuração do sistema de internacionalização (i18n)
 * Suporta português (pt), inglês (en) e espanhol (es)
 */

// Configuração dos idiomas suportados
const SUPPORTED_LANGUAGES = ["pt", "en", "es"];
const DEFAULT_LANGUAGE = "pt";

// Mapeamento de códigos de idioma para locales completos
const LANGUAGE_LOCALE_MAP = {
  pt: "pt-BR",
  en: "en-US",
  es: "es-ES",
};

// Inicializar i18next
i18next
  .use(Backend)
  .use(middleware.LanguageDetector)
  .init({
    // Configurações básicas
    lng: DEFAULT_LANGUAGE,
    fallbackLng: DEFAULT_LANGUAGE,
    supportedLngs: SUPPORTED_LANGUAGES,

    // Configurações de detecção de idioma
    detection: {
      // Ordem de prioridade para detectar idioma
      order: ["header", "querystring", "cookie", "body"],

      // Configurações para headers HTTP
      lookupHeader: "accept-language",
      lookupQuerystring: "lang",
      lookupCookie: "language",
      lookupBody: "language",

      // Cache do idioma detectado
      caches: ["cookie"],
      cookieExpirationDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 ano
    },

    // Configurações do backend (arquivos de tradução)
    backend: {
      loadPath: [
        path.join(__dirname, "../locales/{{lng}}/{{ns}}.json"),
        path.join(__dirname, "../locales/controllers/{{lng}}/{{ns}}.json"),
      ],
      addPath: path.join(__dirname, "../locales/{{lng}}/{{ns}}.missing.json"),
    },

    // Configurações de interpolação
    interpolation: {
      escapeValue: false, // React já faz escape
      format: function (value, format, lng) {
        if (format === "uppercase") return value.toUpperCase();
        if (format === "lowercase") return value.toLowerCase();
        if (format === "capitalize")
          return value.charAt(0).toUpperCase() + value.slice(1);
        return value;
      },
    },

    // Namespaces (arquivos de tradução)
    ns: [
      "common",
      "authController",
      "userController",
      "companyController",
      "contactController", // ✨ NOVO: Identidade Unificada (Contacts)
      "dealController", // ✨ NOVO: Pipeline de Vendas (Deals)
      "contactNoteController", // ✨ NOVO: Histórico Unificado (Contact Notes)
      "salesController",
      "productController",
      "saleController",
      "ticketController",
      "gamificationController",
      "scheduleController",
      "supplierController",
      "notificationController",
      "analyticsController",
      "financeController",
      "profileController", // 🆕 NOVO: Perfis de Acesso
      "menuItemController", // 🆕 NOVO: Menus Hierárquicos
      "appConfig",
    ],
    defaultNS: "common",

    // Configurações de debug (desabilitado em produção)
    debug: process.env.NODE_ENV === "development",

    // Configurações de carregamento
    load: "languageOnly", // Carrega apenas 'en' ao invés de 'en-US'
    preload: SUPPORTED_LANGUAGES,

    // Configurações de recursos
    resources: {}, // Os recursos serão carregados do filesystem
  });

/**
 * Middleware para Express.js que adiciona suporte a i18n
 */
const i18nMiddleware = middleware.handle(i18next, {
  // Opções do middleware
  removeLngFromUrl: false,
  ignoreRoutes: ["/health", "/favicon.ico", "/robots.txt"],
});

/**
 * Obtém o idioma atual baseado na requisição
 * @param {Object} req - Objeto de requisição do Express
 * @returns {string} Código do idioma
 */
function getCurrentLanguage(req) {
  if (req && req.language) {
    return req.language;
  }
  return DEFAULT_LANGUAGE;
}

/**
 * Obtém o locale completo baseado no idioma
 * @param {string} language - Código do idioma
 * @returns {string} Locale completo (ex: pt-BR)
 */
function getLocaleFromLanguage(language) {
  return LANGUAGE_LOCALE_MAP[language] || LANGUAGE_LOCALE_MAP[DEFAULT_LANGUAGE];
}

/**
 * Traduz uma chave usando o idioma da requisição
 * @param {Object} req - Objeto de requisição do Express
 * @param {string} key - Chave de tradução
 * @param {Object} options - Opções de interpolação
 * @returns {string} Texto traduzido
 */
function t(req, key, options = {}) {
  if (req && req.t) {
    return req.t(key, options);
  }

  // Fallback para tradução sem contexto de requisição
  return i18next.t(key, { ...options, lng: DEFAULT_LANGUAGE });
}

/**
 * Traduz uma chave usando um idioma específico
 * @param {string} language - Código do idioma
 * @param {string} key - Chave de tradução
 * @param {Object} options - Opções de interpolação
 * @returns {string} Texto traduzido
 */
function tWithLanguage(language, key, namespace = "common", options = {}) {
  return i18next.t(key, { ...options, lng: language, ns: namespace });
}

/**
 * Verifica se um idioma é suportado
 * @param {string} language - Código do idioma
 * @returns {boolean} True se o idioma é suportado
 */
function isLanguageSupported(language) {
  return SUPPORTED_LANGUAGES.includes(language);
}

/**
 * Obtém lista de idiomas suportados
 * @returns {Array} Array com códigos dos idiomas suportados
 */
function getSupportedLanguages() {
  return [...SUPPORTED_LANGUAGES];
}

/**
 * Obtém informações completas sobre idiomas suportados
 * @returns {Array} Array com informações dos idiomas
 */
function getLanguagesInfo() {
  return SUPPORTED_LANGUAGES.map((lang) => ({
    code: lang,
    locale: LANGUAGE_LOCALE_MAP[lang],
    name: {
      pt: { pt: "Português", en: "Inglês", es: "Espanhol" }[lang],
      en: { pt: "Portuguese", en: "English", es: "Spanish" }[lang],
      es: { pt: "Portugués", en: "Inglés", es: "Español" }[lang],
    },
  }));
}

/**
 * Helper específico para controllers - facilita o uso de traduções em controllers
 * @param {Object} req - Objeto de requisição do Express
 * @param {string} controllerName - Nome do controller (ex: 'authController')
 * @param {string} key - Chave da tradução (ex: 'login.success')
 * @param {Object} options - Opções de interpolação
 * @returns {string} Texto traduzido
 */
function tc(req, controllerName, key, options = {}) {
  try {
    const language = getCurrentLanguage(req);
    const fullKey = `${key}`;
    const translation = i18next.t(fullKey, {
      lng: language,
      ns: controllerName,
      ...options,
    });

    // Se a tradução não foi encontrada, tenta fallback
    if (translation === fullKey) {
      console.warn(
        `Tradução não encontrada: ${controllerName}:${key} (${language})`
      );

      // Tentativa de fallback manual: carregar arquivo JSON diretamente
      try {
        const fs = require("fs");
        const path = require("path");
        const tryFiles = [
          path.join(
            __dirname,
            `../locales/controllers/${language}/${controllerName}.json`
          ),
          path.join(
            __dirname,
            `../locales/controllers/${DEFAULT_LANGUAGE}/${controllerName}.json`
          ),
        ];

        for (const filePath of tryFiles) {
          if (!fs.existsSync(filePath)) continue;
          const raw = fs.readFileSync(filePath, "utf8");
          const json = JSON.parse(raw);

          // navegar pela chave dotted
          const parts = fullKey.split(".");
          let v = json;
          let found = true;
          for (const p of parts) {
            if (v && Object.prototype.hasOwnProperty.call(v, p)) {
              v = v[p];
            } else {
              found = false;
              break;
            }
          }

          if (found && typeof v === "string") {
            return v;
          }
        }
      } catch (err) {
        console.warn(
          `Erro ao carregar tradução manual para ${controllerName}:${key} - ${err.message}`
        );
      }

      // Se falhar, tentar o idioma padrão via i18next (como antes)
      return i18next.t(fullKey, {
        lng: DEFAULT_LANGUAGE,
        ns: controllerName,
        ...options,
      });
    }

    return translation;
  } catch (error) {
    console.error("Erro na tradução do controller:", error);
    return key; // Retorna a chave como fallback
  }
}

module.exports = {
  i18next,
  i18nMiddleware,
  getCurrentLanguage,
  getLocaleFromLanguage,
  t,
  tc, // Helper para controllers
  tWithLanguage,
  isLanguageSupported,
  getSupportedLanguages,
  getLanguagesInfo,
  SUPPORTED_LANGUAGES,
  DEFAULT_LANGUAGE,
  LANGUAGE_LOCALE_MAP,
};
