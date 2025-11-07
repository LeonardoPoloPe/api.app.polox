/**
 * Script para adicionar header de copyright em todos os arquivos .js do projeto
 * Com proteção contra duplicação
 * Uso: node scripts/add-copyright-headers.js
 */

const fs = require("fs");
const path = require("path");

// Header de copyright a ser adicionado (versão bilíngue PT+EN)
const COPYRIGHT_HEADER = `/**
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

`;

// Diretórios a serem processados
const DIRECTORIES_TO_PROCESS = ["src", "migrations", "scripts", "tests"];

// Diretórios e arquivos a serem ignorados
const IGNORE_PATTERNS = [
  "node_modules",
  "coverage",
  "dist",
  "build",
  ".git",
  "package.json",
  "package-lock.json",
  "pnpm-lock.yaml",
  ".copyright-header.js",
  "add-copyright-headers.js",
];

/**
 * Verifica se o arquivo já tem o header de copyright (EXATO)
 * Evita adicionar múltiplas vezes
 */
function hasExactHeader(content) {
  // Verifica strings específicas do novo header
  return (
    content.includes("POLO X - Proprietary System / Sistema Proprietário") &&
    content.includes("Copyright (c) 2025 Polo X") &&
    content.includes("LICENSING STATUS / STATUS DE LICENCIAMENTO") &&
    content.includes("INPI Registration: In progress / Em andamento")
  );
}

/**
 * Verifica se tem algum header antigo do POLO X
 */
function hasOldHeader(content) {
  return (
    (content.includes("POLO X") || content.includes("Polo X")) &&
    (content.includes("Copyright") || content.includes("Proprietário"))
  );
}

/**
 * Remove qualquer header antigo do POLO X
 * Procura pelo padrão /** ... POLO X ... *\/ no início do arquivo
 */
function removeOldHeaders(content) {
  // Remove shebangs temporariamente
  let shebang = "";
  let cleanContent = content;

  if (content.startsWith("#!")) {
    const firstLineEnd = content.indexOf("\n");
    shebang = content.substring(0, firstLineEnd + 1);
    cleanContent = content.substring(firstLineEnd + 1);
  }

  // Remove todos os comentários de bloco que contenham "POLO X" no início do arquivo
  // Padrão: /**  (conteúdo com POLO X) */
  let result = cleanContent;
  let previousResult = "";

  // Loop para remover múltiplas ocorrências
  while (result !== previousResult) {
    previousResult = result;

    // Remove espaços em branco no início
    result = result.trimStart();

    // Se começa com /**, procura o fim do comentário
    if (result.startsWith("/**")) {
      const endPattern = result.indexOf("*/");
      if (endPattern !== -1) {
        const commentBlock = result.substring(0, endPattern + 2);

        // Se o comentário contém "POLO X", remove
        if (
          commentBlock.includes("POLO X") ||
          commentBlock.includes("Polo X")
        ) {
          result = result.substring(endPattern + 2).trimStart();
          console.log("    🗑️  Header antigo removido");
        } else {
          // Se não contém POLO X, mantém
          break;
        }
      } else {
        break;
      }
    } else {
      // Não começa com comentário, para o loop
      break;
    }
  }

  return shebang + result;
}

/**
 * Verifica se o caminho deve ser ignorado
 */
function shouldIgnore(filePath) {
  return IGNORE_PATTERNS.some((pattern) => filePath.includes(pattern));
}

/**
 * Adiciona o header ao arquivo (com proteção contra duplicação)
 */
function addHeaderToFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, "utf8");

    // 🔒 PROTEÇÃO 1: Se já tem o header EXATO, pula
    if (hasExactHeader(content)) {
      console.log(
        `    ✅ OK (já tem header correto): ${path.basename(filePath)}`
      );
      return false;
    }

    let cleanContent = content;

    // 🔒 PROTEÇÃO 2: Se tem header antigo, remove primeiro
    if (hasOldHeader(content)) {
      console.log(
        `    🔄 Substituindo header antigo: ${path.basename(filePath)}`
      );
      cleanContent = removeOldHeaders(content);
    } else {
      console.log(`    ➕ Adicionando header: ${path.basename(filePath)}`);
    }

    // Adiciona o novo header
    const newContent = COPYRIGHT_HEADER + cleanContent;
    fs.writeFileSync(filePath, newContent, "utf8");

    return true;
  } catch (error) {
    console.error(`    ❌ Erro ao processar ${filePath}:`, error.message);
    return false;
  }
}

/**
 * Processa todos os arquivos .js no diretório recursivamente
 */
function processDirectory(dirPath) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  let filesProcessed = 0;

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);

    // Ignora se estiver na lista de ignorados
    if (shouldIgnore(fullPath)) {
      continue;
    }

    if (entry.isDirectory()) {
      // Processa recursivamente
      filesProcessed += processDirectory(fullPath);
    } else if (entry.isFile() && entry.name.endsWith(".js")) {
      // Processa arquivo .js
      if (addHeaderToFile(fullPath)) {
        filesProcessed++;
      }
    }
  }

  return filesProcessed;
}

/**
 * Função principal
 */
function main() {
  console.log(
    "╔════════════════════════════════════════════════════════════════╗"
  );
  console.log(
    "║          POLO X - Copyright Header Manager (v2.0)             ║"
  );
  console.log(
    "║             Bilingual PT+EN - Safe Mode Enabled               ║"
  );
  console.log(
    "╚════════════════════════════════════════════════════════════════╝"
  );
  console.log("");
  console.log("🔒 Proteções ativas:");
  console.log("   ✅ Detecta header existente (evita duplicação)");
  console.log("   ✅ Remove headers antigos antes de adicionar novo");
  console.log("   ✅ Preserva shebangs (#!/usr/bin/env node)");
  console.log("");

  const rootDir = path.resolve(__dirname, "..");
  let totalFilesProcessed = 0;
  let totalFilesOk = 0;

  console.log("📁 Diretórios a processar:", DIRECTORIES_TO_PROCESS.join(", "));
  console.log("");

  for (const dir of DIRECTORIES_TO_PROCESS) {
    const dirPath = path.join(rootDir, dir);

    if (!fs.existsSync(dirPath)) {
      console.log(`⚠️  Diretório não encontrado: ${dir}`);
      console.log("");
      continue;
    }

    console.log(`📂 Processando: ${dir}/`);
    console.log("─".repeat(70));

    const before = totalFilesProcessed;
    const filesProcessed = processDirectory(dirPath);
    totalFilesProcessed += filesProcessed;

    // Conta os que já estavam OK
    const filesInDir = countJsFiles(dirPath);
    totalFilesOk += filesInDir - filesProcessed;

    console.log(
      `   Modificados: ${filesProcessed} | Total no diretório: ${filesInDir}`
    );
    console.log("");
  }

  console.log("═".repeat(70));
  console.log("");
  console.log("✨ Processo concluído!");
  console.log(`📊 Arquivos modificados: ${totalFilesProcessed}`);
  console.log(`✅ Arquivos já corretos: ${totalFilesOk}`);
  console.log(`📝 Total processado: ${totalFilesProcessed + totalFilesOk}`);
  console.log("");
  console.log(
    "💡 Dica: Execute novamente para verificar (não haverá mudanças)"
  );
  console.log("");
}

/**
 * Conta quantidade de arquivos .js no diretório
 */
function countJsFiles(dirPath) {
  let count = 0;
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);

    if (shouldIgnore(fullPath)) {
      continue;
    }

    if (entry.isDirectory()) {
      count += countJsFiles(fullPath);
    } else if (entry.isFile() && entry.name.endsWith(".js")) {
      count++;
    }
  }

  return count;
}

// Executa o script
if (require.main === module) {
  main();
}

module.exports = { addHeaderToFile, hasExactHeader, removeOldHeaders };
