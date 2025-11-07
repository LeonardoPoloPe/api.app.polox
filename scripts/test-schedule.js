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
 * 🧪 SCRIPT DE TESTES - SCHEDULE CONTROLLER
 * ==========================================
 *
 * Execute: npm run test:schedule
 * ou: node scripts/test-schedule.js
 */

const { execSync } = require("child_process");
const path = require("path");

console.log("\n🧪 ========================================");
console.log("   TESTES AUTOMATIZADOS - SCHEDULE       ");
console.log("========================================\n");

try {
  const projectRoot = path.join(__dirname, "..");
  process.chdir(projectRoot);

  console.log("📋 1. Executando Testes Unitários...\n");
  try {
    execSync("npx jest tests/unit/schedule-controller.test.js --verbose", {
      stdio: "inherit",
      cwd: projectRoot,
    });
    console.log("\n✅ Testes unitários concluídos!\n");
  } catch (error) {
    console.error("\n❌ Falha nos testes unitários");
    console.error("Detalhes:", error.message);
  }

  console.log("\n📋 2. Executando Testes de Integração...\n");
  try {
    execSync(
      "npx jest tests/integration/schedule-controller.test.js --verbose",
      {
        stdio: "inherit",
        cwd: projectRoot,
      }
    );
    console.log("\n✅ Testes de integração concluídos!\n");
  } catch (error) {
    console.error("\n❌ Falha nos testes de integração");
    console.error("Detalhes:", error.message);
  }

  console.log("\n📊 3. Executando com Coverage...\n");
  try {
    execSync(
      'npx jest tests/**/schedule-controller.test.js --coverage --collectCoverageFrom="src/controllers/ScheduleController.js"',
      {
        stdio: "inherit",
        cwd: projectRoot,
      }
    );
    console.log("\n✅ Coverage gerado em coverage/lcov-report/index.html\n");
  } catch (error) {
    console.error("\n❌ Falha na geração do coverage");
    console.error("Detalhes:", error.message);
  }
} catch (error) {
  console.error("\n❌ Erro geral na execução dos testes:", error);
  process.exit(1);
}

console.log("\n🎉 ========================================");
console.log("    TESTES CONCLUÍDOS!                   ");
console.log("========================================\n");
