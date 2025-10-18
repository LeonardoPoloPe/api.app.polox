const crypto = require("crypto");

/**
 * Gera um hash seguro para senhas usando crypto nativo
 * @param {string} password - Senha para fazer hash
 * @param {string} salt - Salt opcional (será gerado se não fornecido)
 * @returns {Object} Objeto com hash e salt
 */
const hashPassword = (password, salt = null) => {
  if (!salt) {
    salt = crypto.randomBytes(32).toString("hex");
  }

  const hash = crypto
    .pbkdf2Sync(password, salt, 100000, 64, "sha512")
    .toString("hex");

  return {
    hash: `${salt}:${hash}`,
    salt,
  };
};

/**
 * Verifica se uma senha corresponde ao hash
 * @param {string} password - Senha para verificar
 * @param {string} storedHash - Hash armazenado (formato: salt:hash)
 * @returns {boolean} True se a senha estiver correta
 */
const verifyPassword = (password, storedHash) => {
  try {
    const [salt, hash] = storedHash.split(":");
    const verifyHash = crypto
      .pbkdf2Sync(password, salt, 100000, 64, "sha512")
      .toString("hex");
    return hash === verifyHash;
  } catch (error) {
    return false;
  }
};

/**
 * Gera um ID único usando UUID v4
 * @returns {string} UUID único
 */
const generateUUID = () => {
  return crypto.randomUUID();
};

/**
 * Gera um token aleatório seguro
 * @param {number} length - Comprimento do token em bytes
 * @returns {string} Token em hexadecimal
 */
const generateSecureToken = (length = 32) => {
  return crypto.randomBytes(length).toString("hex");
};

/**
 * Gera um código numérico aleatório
 * @param {number} digits - Número de dígitos (padrão: 6)
 * @returns {string} Código numérico
 */
const generateNumericCode = (digits = 6) => {
  const min = Math.pow(10, digits - 1);
  const max = Math.pow(10, digits) - 1;
  return Math.floor(Math.random() * (max - min + 1) + min).toString();
};

/**
 * Criptografa dados usando AES-256-GCM
 * @param {string} data - Dados para criptografar
 * @param {string} key - Chave de criptografia (32 bytes)
 * @returns {Object} Dados criptografados com IV e tag
 */
const encrypt = (data, key = process.env.ENCRYPTION_KEY) => {
  if (!key) {
    throw new Error("Chave de criptografia não fornecida");
  }

  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipher("aes-256-gcm", key);
  cipher.setAAD(Buffer.from("polox-api"));

  let encrypted = cipher.update(data, "utf8", "hex");
  encrypted += cipher.final("hex");

  const tag = cipher.getAuthTag();

  return {
    encrypted,
    iv: iv.toString("hex"),
    tag: tag.toString("hex"),
  };
};

/**
 * Descriptografa dados usando AES-256-GCM
 * @param {Object} encryptedData - Dados criptografados
 * @param {string} key - Chave de criptografia
 * @returns {string} Dados descriptografados
 */
const decrypt = (encryptedData, key = process.env.ENCRYPTION_KEY) => {
  if (!key) {
    throw new Error("Chave de criptografia não fornecida");
  }

  const { encrypted, iv, tag } = encryptedData;

  const decipher = crypto.createDecipher("aes-256-gcm", key);
  decipher.setAAD(Buffer.from("polox-api"));
  decipher.setAuthTag(Buffer.from(tag, "hex"));

  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
};

/**
 * Gera um hash MD5 (para casos não críticos de segurança)
 * @param {string} data - Dados para fazer hash
 * @returns {string} Hash MD5
 */
const md5Hash = (data) => {
  return crypto.createHash("md5").update(data).digest("hex");
};

/**
 * Gera um hash SHA-256
 * @param {string} data - Dados para fazer hash
 * @returns {string} Hash SHA-256
 */
const sha256Hash = (data) => {
  return crypto.createHash("sha256").update(data).digest("hex");
};

/**
 * Cria uma assinatura HMAC-SHA256
 * @param {string} data - Dados para assinar
 * @param {string} secret - Chave secreta
 * @returns {string} Assinatura HMAC
 */
const createHmacSignature = (data, secret) => {
  return crypto.createHmac("sha256", secret).update(data).digest("hex");
};

/**
 * Verifica uma assinatura HMAC-SHA256
 * @param {string} data - Dados originais
 * @param {string} signature - Assinatura para verificar
 * @param {string} secret - Chave secreta
 * @returns {boolean} True se a assinatura for válida
 */
const verifyHmacSignature = (data, signature, secret) => {
  const expectedSignature = createHmacSignature(data, secret);
  return crypto.timingSafeEqual(
    Buffer.from(signature, "hex"),
    Buffer.from(expectedSignature, "hex")
  );
};

/**
 * Compara strings de forma segura contra timing attacks
 * @param {string} a - Primeira string
 * @param {string} b - Segunda string
 * @returns {boolean} True se as strings forem iguais
 */
const safeStringCompare = (a, b) => {
  if (a.length !== b.length) {
    return false;
  }

  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
};

module.exports = {
  hashPassword,
  verifyPassword,
  generateUUID,
  generateSecureToken,
  generateNumericCode,
  encrypt,
  decrypt,
  md5Hash,
  sha256Hash,
  createHmacSignature,
  verifyHmacSignature,
  safeStringCompare,
};
