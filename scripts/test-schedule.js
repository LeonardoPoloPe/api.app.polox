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
