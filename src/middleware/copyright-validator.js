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
 * COPYRIGHT VALIDATOR - Sistema de Validação de Propriedade Intelectual
 *
 * Este módulo valida em runtime que:
 * 1. Os headers de copyright estão presentes
 * 2. Os watermarks não foram removidos
 * 3. A integridade do sistema está preservada
 *
 * É executado automaticamente ao iniciar a aplicação
 */

const fs = require("fs");
const path = require("path");
const {
  validateSystemIntegrity,
  getSystemOwnership,
} = require("../utils/watermark");

// Configuração
const CONFIG = {
  enabled:
    process.env.NODE_ENV === "production" || process.env.NODE_ENV === "sandbox",
  strictMode: process.env.COPYRIGHT_STRICT_MODE === "true",
  logToFile: true,
  alertOnViolation: true,
};

/**
 * Verifica se um arquivo possui o header de copyright
 */
function fileHasCopyright(filePath) {
  try {
    const content = fs.readFileSync(filePath, "utf8");

    // Verifica strings específicas do copyright
    const hasPoloX = content.includes("POLO X - Proprietary System");
    const hasCopyright = content.includes("Copyright (c) 2025 Polo X");
    const hasLicense = content.includes("LICENSING STATUS");

    return hasPoloX && hasCopyright && hasLicense;
  } catch (error) {
    return false;
  }
}

/**
 * Valida todos os arquivos fonte críticos
 */
function validateSourceFiles() {
  const rootDir = path.resolve(__dirname, "../..");
  const criticalFiles = [
    "src/handler.js",
    "src/server.js",
    "src/models/index.js",
    "src/controllers/index.js",
    "src/utils/watermark.js",
  ];

  const violations = [];

  for (const file of criticalFiles) {
    const fullPath = path.join(rootDir, file);

    if (fs.existsSync(fullPath)) {
      if (!fileHasCopyright(fullPath)) {
        violations.push({
          file,
          type: "MISSING_COPYRIGHT_HEADER",
          severity: "HIGH",
        });
      }
    }
  }

  return violations;
}

/**
 * Registra violação em log de auditoria
 */
function logViolation(violation) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    event: "COPYRIGHT_VIOLATION",
    ...violation,
    environment: process.env.NODE_ENV || "unknown",
    hostname: require("os").hostname(),
  };

  // Log no console
  console.error("🚨 COPYRIGHT VIOLATION DETECTED:");
  console.error(JSON.stringify(logEntry, null, 2));

  // Em produção, enviar para sistema de logs centralizado
  if (CONFIG.logToFile) {
    const logDir = path.join(__dirname, "../../logs");
    const logFile = path.join(logDir, "copyright-violations.log");

    try {
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }

      fs.appendFileSync(logFile, JSON.stringify(logEntry) + "\n", "utf8");
    } catch (error) {
      console.error("Failed to write violation log:", error.message);
    }
  }

  // Aqui você pode integrar com:
  // - Sentry.captureMessage(violation)
  // - AWS CloudWatch Logs
  // - Slack/Discord webhooks para alertas
  // - Email para administrador

  return logEntry;
}

/**
 * Executa validação completa do sistema
 */
function runCopyrightValidation() {
  if (!CONFIG.enabled) {
    return {
      status: "SKIPPED",
      message: "Validation disabled in current environment",
    };
  }

  const results = {
    status: "PASS",
    timestamp: new Date().toISOString(),
    violations: [],
    warnings: [],
  };

  // 1. Valida integridade dos watermarks
  const integrityCheck = validateSystemIntegrity();
  if (!integrityCheck.valid) {
    results.status = "FAIL";
    results.violations.push({
      type: "WATERMARK_INTEGRITY_FAILED",
      severity: "CRITICAL",
      details: integrityCheck.warnings,
    });
  }

  // 2. Valida headers de copyright nos arquivos
  const fileViolations = validateSourceFiles();
  if (fileViolations.length > 0) {
    results.status = "FAIL";
    results.violations.push(...fileViolations);
  }

  // 3. Registra violações encontradas
  if (results.violations.length > 0) {
    results.violations.forEach((violation) => {
      logViolation(violation);
    });

    // Em modo estrito, impede inicialização
    if (CONFIG.strictMode) {
      throw new Error(
        "COPYRIGHT VALIDATION FAILED - System initialization blocked. " +
          "Contact system administrator."
      );
    }
  }

  // 4. Exibe informações de propriedade
  results.ownership = getSystemOwnership();

  return results;
}

/**
 * Exibe banner de propriedade ao iniciar
 */
function displayOwnershipBanner() {
  const ownership = getSystemOwnership();

  console.log("");
  console.log("═".repeat(70));
  console.log(`  ${ownership.company}`);
  console.log(`  CNPJ: ${ownership.cnpj}`);
  console.log(`  Developer: ${ownership.developer}`);
  console.log(`  License: ${ownership.license}`);
  console.log(`  System ID: ${ownership.fingerprint}`);
  console.log("═".repeat(70));
  console.log("");
}

/**
 * Middleware Express para validação de copyright
 */
function copyrightMiddleware(req, res, next) {
  // Adiciona header customizado nas respostas
  res.setHeader(
    "X-Copyright",
    "Polo X Manutencao de Equipamentos de Informatica LTDA"
  );
  res.setHeader("X-Developer", "Leonardo Polo Pereira");
  res.setHeader("X-License", "Proprietary");

  next();
}

/**
 * Inicializa o validador (chamado ao iniciar a aplicação)
 */
function initializeCopyrightValidator() {
  console.log("🔒 Initializing Copyright Validator...");

  try {
    const results = runCopyrightValidation();

    if (results.status === "PASS") {
      console.log("✅ Copyright validation passed");
      displayOwnershipBanner();
    } else if (results.status === "FAIL") {
      console.error("❌ Copyright validation failed");
      console.error(`Found ${results.violations.length} violation(s)`);

      if (!CONFIG.strictMode) {
        console.warn("⚠️  Continuing in permissive mode");
      }
    }

    return results;
  } catch (error) {
    console.error("💥 Copyright validation error:", error.message);
    throw error;
  }
}

module.exports = {
  initializeCopyrightValidator,
  runCopyrightValidation,
  copyrightMiddleware,
  displayOwnershipBanner,
  validateSourceFiles,
  CONFIG,
};
