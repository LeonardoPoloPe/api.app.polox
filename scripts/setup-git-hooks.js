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
 * Script para instalar Git Hooks automaticamente
 * Uso: npm run setup:git-hooks
 */

const fs = require("fs");
const path = require("path");

const hooks = [
  {
    name: "pre-commit",
    source: "scripts/git-hooks/pre-commit",
    dest: ".git/hooks/pre-commit",
  },
];

console.log("🔧 Installing Git Hooks...\n");

let installed = 0;
let failed = 0;

for (const hook of hooks) {
  try {
    const sourcePath = path.join(__dirname, "..", hook.source);
    const destPath = path.join(__dirname, "..", hook.dest);

    if (!fs.existsSync(sourcePath)) {
      console.log(`⚠️  Source not found: ${hook.source}`);
      failed++;
      continue;
    }

    // Verifica se .git existe
    const gitDir = path.dirname(destPath);
    if (!fs.existsSync(gitDir)) {
      console.log(`⚠️  Git directory not found: ${gitDir}`);
      failed++;
      continue;
    }

    // Copia o hook
    fs.copyFileSync(sourcePath, destPath);

    // Torna executável (Linux/Mac)
    if (process.platform !== "win32") {
      fs.chmodSync(destPath, "755");
    }

    console.log(`✅ Installed: ${hook.name}`);
    installed++;
  } catch (error) {
    console.error(`❌ Failed to install ${hook.name}:`, error.message);
    failed++;
  }
}

console.log("");
console.log("═".repeat(60));
console.log(
  `✨ Installation complete: ${installed} installed, ${failed} failed`
);
console.log("═".repeat(60));
console.log("");

if (installed > 0) {
  console.log("🎉 Git hooks are now active!");
  console.log("   They will run automatically before each commit.");
  console.log("");
}

process.exit(failed > 0 ? 1 : 0);
