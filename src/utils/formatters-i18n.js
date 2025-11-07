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

const { format, parseISO, addDays, addHours, addMinutes } = require("date-fns");
const { ptBR, enUS } = require("date-fns/locale");
const { es } = require("date-fns/locale");
const {
  getLocaleFromLanguage,
  getCurrentLanguage,
  t,
} = require("../config/i18n");

// Mapeamento de idiomas para locales do date-fns
const DATE_FNS_LOCALES = {
  pt: ptBR,
  en: enUS,
  es: es,
};

// Mapeamento de idiomas para códigos de moeda
const CURRENCY_CODES = {
  pt: "BRL",
  en: "USD",
  es: "EUR",
};

/**
 * Obtém locale do date-fns baseado no idioma
 * @param {string} language - Código do idioma
 * @returns {Object} Locale do date-fns
 */
const getDateFnsLocale = (language = "pt") => {
  return DATE_FNS_LOCALES[language] || DATE_FNS_LOCALES["pt"];
};

/**
 * Formata uma data com suporte a múltiplos idiomas
 * @param {Date|string} date - Data para formatar
 * @param {string} pattern - Padrão de formatação
 * @param {string} language - Idioma para formatação
 * @returns {string} Data formatada
 */
const formatDate = (date, pattern = "dd/MM/yyyy", language = "pt") => {
  try {
    const dateObj = typeof date === "string" ? parseISO(date) : date;
    const locale = getDateFnsLocale(language);
    return format(dateObj, pattern, { locale });
  } catch (error) {
    // Usar tradução baseada no idioma
    const errorMessages = {
      pt: "Data inválida",
      en: "Invalid date",
      es: "Fecha inválida",
    };
    return errorMessages[language] || errorMessages["pt"];
  }
};

/**
 * Formata uma data com suporte a requisição Express
 * @param {Date|string} date - Data para formatar
 * @param {string} pattern - Padrão de formatação
 * @param {Object} req - Objeto de requisição Express (opcional)
 * @returns {string} Data formatada
 */
const formatDateWithRequest = (date, pattern, req = null) => {
  const language = req ? getCurrentLanguage(req) : "pt";
  return formatDate(date, pattern, language);
};

/**
 * Formata uma data com hora
 * @param {Date|string} date - Data para formatar
 * @param {string} language - Idioma para formatação
 * @returns {string} Data e hora formatadas
 */
const formatDateTime = (date, language = "pt") => {
  return formatDate(date, "dd/MM/yyyy HH:mm:ss", language);
};

/**
 * Obtém padrão de data baseado no idioma
 * @param {string} language - Código do idioma
 * @returns {string} Padrão de data
 */
const getDatePattern = (language = "pt") => {
  const patterns = {
    pt: "dd/MM/yyyy",
    en: "MM/dd/yyyy",
    es: "dd/MM/yyyy",
  };
  return patterns[language] || patterns["pt"];
};

/**
 * Obtém padrão de data e hora baseado no idioma
 * @param {string} language - Código do idioma
 * @returns {string} Padrão de data e hora
 */
const getDateTimePattern = (language = "pt") => {
  const patterns = {
    pt: "dd/MM/yyyy HH:mm:ss",
    en: "MM/dd/yyyy HH:mm:ss",
    es: "dd/MM/yyyy HH:mm:ss",
  };
  return patterns[language] || patterns["pt"];
};

/**
 * Converte string para timestamp UTC
 * @param {string} dateString - String da data
 * @returns {number} Timestamp UTC
 */
const toUTCTimestamp = (dateString) => {
  return new Date(dateString).getTime();
};

/**
 * Obtém a data atual no timezone de São Paulo
 * @returns {Date} Data atual
 */
const getNowSaoPaulo = () => {
  return new Date(
    new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" })
  );
};

/**
 * Formata valores monetários com suporte a múltiplas moedas
 * @param {number} value - Valor em centavos ou unidade base
 * @param {boolean} isInCents - Se o valor está em centavos
 * @param {string} language - Idioma para formatação
 * @returns {string} Valor formatado
 */
const formatCurrency = (value, isInCents = false, language = "pt") => {
  const amount = isInCents ? value / 100 : value;
  const currencyCode = CURRENCY_CODES[language] || CURRENCY_CODES["pt"];
  const locale = getLocaleFromLanguage(language);

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currencyCode,
  }).format(amount);
};

/**
 * Formata valores monetários com contexto de requisição
 * @param {number} value - Valor
 * @param {boolean} isInCents - Se está em centavos
 * @param {Object} req - Objeto de requisição Express
 * @returns {string} Valor formatado
 */
const formatCurrencyWithRequest = (value, isInCents = false, req = null) => {
  const language = req ? getCurrentLanguage(req) : "pt";
  return formatCurrency(value, isInCents, language);
};

/**
 * Converte reais para centavos
 * @param {number} reais - Valor em reais
 * @returns {number} Valor em centavos
 */
const reaisToCents = (reais) => {
  return Math.round(reais * 100);
};

/**
 * Converte centavos para reais
 * @param {number} cents - Valor em centavos
 * @returns {number} Valor em reais
 */
const centsToReais = (cents) => {
  return cents / 100;
};

/**
 * Formata CPF
 * @param {string} cpf - CPF para formatar
 * @returns {string} CPF formatado
 */
const formatCPF = (cpf) => {
  if (!cpf) return "";
  const cleanCPF = cpf.replace(/\D/g, "");
  return cleanCPF.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
};

/**
 * Formata CNPJ
 * @param {string} cnpj - CNPJ para formatar
 * @returns {string} CNPJ formatado
 */
const formatCNPJ = (cnpj) => {
  if (!cnpj) return "";
  const cleanCNPJ = cnpj.replace(/\D/g, "");
  return cleanCNPJ.replace(
    /(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/,
    "$1.$2.$3/$4-$5"
  );
};

/**
 * Formata telefone brasileiro
 * @param {string} phone - Telefone para formatar
 * @returns {string} Telefone formatado
 */
const formatPhone = (phone) => {
  if (!phone) return "";
  const cleanPhone = phone.replace(/\D/g, "");

  if (cleanPhone.length === 11) {
    return cleanPhone.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
  } else if (cleanPhone.length === 10) {
    return cleanPhone.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
  }

  return phone;
};

/**
 * Formata CEP
 * @param {string} cep - CEP para formatar
 * @returns {string} CEP formatado
 */
const formatCEP = (cep) => {
  if (!cep) return "";
  const cleanCEP = cep.replace(/\D/g, "");
  return cleanCEP.replace(/(\d{5})(\d{3})/, "$1-$2");
};

/**
 * Remove formatação de string mantendo apenas números
 * @param {string} str - String para limpar
 * @returns {string} String apenas com números
 */
const removeFormatting = (str) => {
  if (!str) return "";
  return str.replace(/\D/g, "");
};

/**
 * Valida se é um email válido
 * @param {string} email - Email para validar
 * @returns {boolean} True se válido
 */
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Valida CPF
 * @param {string} cpf - CPF para validar
 * @returns {boolean} True se válido
 */
const isValidCPF = (cpf) => {
  const cleanCPF = removeFormatting(cpf);

  if (cleanCPF.length !== 11 || /^(\d)\1+$/.test(cleanCPF)) {
    return false;
  }

  // Validação dos dígitos verificadores
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += cleanCPF[i] * (10 - i);
  }
  let digit1 = 11 - (sum % 11);
  if (digit1 > 9) digit1 = 0;

  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += cleanCPF[i] * (11 - i);
  }
  let digit2 = 11 - (sum % 11);
  if (digit2 > 9) digit2 = 0;

  return cleanCPF[9] == digit1 && cleanCPF[10] == digit2;
};

/**
 * Valida CNPJ
 * @param {string} cnpj - CNPJ para validar
 * @returns {boolean} True se válido
 */
const isValidCNPJ = (cnpj) => {
  const cleanCNPJ = removeFormatting(cnpj);

  if (cleanCNPJ.length !== 14 || /^(\d)\1+$/.test(cleanCNPJ)) {
    return false;
  }

  // Validação do primeiro dígito verificador
  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let sum1 = 0;
  for (let i = 0; i < 12; i++) {
    sum1 += cleanCNPJ[i] * weights1[i];
  }
  let digit1 = sum1 % 11 < 2 ? 0 : 11 - (sum1 % 11);

  // Validação do segundo dígito verificador
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let sum2 = 0;
  for (let i = 0; i < 13; i++) {
    sum2 += cleanCNPJ[i] * weights2[i];
  }
  let digit2 = sum2 % 11 < 2 ? 0 : 11 - (sum2 % 11);

  return cleanCNPJ[12] == digit1 && cleanCNPJ[13] == digit2;
};

/**
 * Gera um slug amigável para URL
 * @param {string} text - Texto para converter
 * @returns {string} Slug gerado
 */
const generateSlug = (text) => {
  if (!text) return "";

  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-") // Substitui espaços por hífens
    .replace(/[àáâãäå]/g, "a") // Remove acentos
    .replace(/[èéêë]/g, "e")
    .replace(/[ìíîï]/g, "i")
    .replace(/[òóôõö]/g, "o")
    .replace(/[ùúûü]/g, "u")
    .replace(/[ç]/g, "c")
    .replace(/[ñ]/g, "n")
    .replace(/[^a-z0-9\-]/g, "") // Remove caracteres especiais
    .replace(/-+/g, "-") // Remove hífens duplicados
    .replace(/^-|-$/g, ""); // Remove hífens do início/fim
};

module.exports = {
  // Funções de data
  formatDate,
  formatDateWithRequest,
  formatDateTime,
  getDatePattern,
  getDateTimePattern,
  toUTCTimestamp,
  getNowSaoPaulo,

  // Funções de moeda
  formatCurrency,
  formatCurrencyWithRequest,
  reaisToCents,
  centsToReais,

  // Funções de formatação
  formatCPF,
  formatCNPJ,
  formatPhone,
  formatCEP,
  removeFormatting,
  generateSlug,

  // Funções de validação
  isValidEmail,
  isValidCPF,
  isValidCNPJ,

  // Funções auxiliares
  getDateFnsLocale,
  CURRENCY_CODES,
  DATE_FNS_LOCALES,
};
