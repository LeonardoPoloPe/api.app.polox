const { format, parseISO, addDays, addHours, addMinutes } = require("date-fns");
const { ptBR } = require("date-fns/locale");

/**
 * Formata uma data para o padrão brasileiro
 * @param {Date|string} date - Data para formatar
 * @param {string} pattern - Padrão de formatação
 * @returns {string} Data formatada
 */
const formatDate = (date, pattern = "dd/MM/yyyy") => {
  try {
    const dateObj = typeof date === "string" ? parseISO(date) : date;
    return format(dateObj, pattern, { locale: ptBR });
  } catch (error) {
    return "Data inválida";
  }
};

/**
 * Formata uma data com hora
 * @param {Date|string} date - Data para formatar
 * @returns {string} Data e hora formatadas
 */
const formatDateTime = (date) => {
  return formatDate(date, "dd/MM/yyyy HH:mm:ss");
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
 * Formata valores monetários em reais
 * @param {number} value - Valor em centavos ou reais
 * @param {boolean} isInCents - Se o valor está em centavos
 * @returns {string} Valor formatado
 */
const formatCurrency = (value, isInCents = false) => {
  const amount = isInCents ? value / 100 : value;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(amount);
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
 * @param {string} cpf - CPF sem formatação
 * @returns {string} CPF formatado
 */
const formatCPF = (cpf) => {
  if (!cpf) return "";
  const cleaned = cpf.replace(/\D/g, "");
  return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
};

/**
 * Formata CNPJ
 * @param {string} cnpj - CNPJ sem formatação
 * @returns {string} CNPJ formatado
 */
const formatCNPJ = (cnpj) => {
  if (!cnpj) return "";
  const cleaned = cnpj.replace(/\D/g, "");
  return cleaned.replace(
    /(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/,
    "$1.$2.$3/$4-$5"
  );
};

/**
 * Formata telefone brasileiro
 * @param {string} phone - Telefone sem formatação
 * @returns {string} Telefone formatado
 */
const formatPhone = (phone) => {
  if (!phone) return "";
  const cleaned = phone.replace(/\D/g, "");

  if (cleaned.length === 11) {
    return cleaned.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
  } else if (cleaned.length === 10) {
    return cleaned.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
  }

  return phone;
};

/**
 * Remove formatação de string (deixa apenas números)
 * @param {string} value - Valor formatado
 * @returns {string} Apenas números
 */
const removeFormatting = (value) => {
  if (!value) return "";
  return value.replace(/\D/g, "");
};

/**
 * Valida CPF
 * @param {string} cpf - CPF para validar
 * @returns {boolean} True se CPF válido
 */
const isValidCPF = (cpf) => {
  if (!cpf) return false;

  const cleaned = removeFormatting(cpf);

  if (cleaned.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cleaned)) return false; // Todos os dígitos iguais

  // Validação dos dígitos verificadores
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cleaned[i]) * (10 - i);
  }
  let digit1 = 11 - (sum % 11);
  if (digit1 >= 10) digit1 = 0;

  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cleaned[i]) * (11 - i);
  }
  let digit2 = 11 - (sum % 11);
  if (digit2 >= 10) digit2 = 0;

  return digit1 === parseInt(cleaned[9]) && digit2 === parseInt(cleaned[10]);
};

/**
 * Valida CNPJ
 * @param {string} cnpj - CNPJ para validar
 * @returns {boolean} True se CNPJ válido
 */
const isValidCNPJ = (cnpj) => {
  if (!cnpj) return false;

  const cleaned = removeFormatting(cnpj);

  if (cleaned.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(cleaned)) return false; // Todos os dígitos iguais

  // Validação do primeiro dígito verificador
  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(cleaned[i]) * weights1[i];
  }
  let digit1 = sum % 11;
  digit1 = digit1 < 2 ? 0 : 11 - digit1;

  // Validação do segundo dígito verificador
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  sum = 0;
  for (let i = 0; i < 13; i++) {
    sum += parseInt(cleaned[i]) * weights2[i];
  }
  let digit2 = sum % 11;
  digit2 = digit2 < 2 ? 0 : 11 - digit2;

  return digit1 === parseInt(cleaned[12]) && digit2 === parseInt(cleaned[13]);
};

/**
 * Trunca texto mantendo palavras completas
 * @param {string} text - Texto para truncar
 * @param {number} maxLength - Comprimento máximo
 * @returns {string} Texto truncado
 */
const truncateText = (text, maxLength = 100) => {
  if (!text || text.length <= maxLength) return text;

  const truncated = text.substr(0, maxLength);
  const lastSpace = truncated.lastIndexOf(" ");

  return lastSpace > 0
    ? truncated.substr(0, lastSpace) + "..."
    : truncated + "...";
};

/**
 * Capitaliza primeira letra de cada palavra
 * @param {string} text - Texto para capitalizar
 * @returns {string} Texto capitalizado
 */
const titleCase = (text) => {
  if (!text) return "";

  return text
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

/**
 * Remove acentos de uma string
 * @param {string} text - Texto com acentos
 * @returns {string} Texto sem acentos
 */
const removeAccents = (text) => {
  if (!text) return "";

  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
};

/**
 * Gera slug a partir de uma string
 * @param {string} text - Texto para gerar slug
 * @returns {string} Slug gerado
 */
const generateSlug = (text) => {
  if (!text) return "";

  return removeAccents(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "") // Remove caracteres especiais
    .replace(/\s+/g, "-") // Substitui espaços por hífens
    .replace(/-+/g, "-") // Remove hífens múltiplos
    .replace(/^-|-$/g, ""); // Remove hífens do início e fim
};

module.exports = {
  formatDate,
  formatDateTime,
  toUTCTimestamp,
  getNowSaoPaulo,
  formatCurrency,
  reaisToCents,
  centsToReais,
  formatCPF,
  formatCNPJ,
  formatPhone,
  removeFormatting,
  isValidCPF,
  isValidCNPJ,
  truncateText,
  titleCase,
  removeAccents,
  generateSlug,
};
