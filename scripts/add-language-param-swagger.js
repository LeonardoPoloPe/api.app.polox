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
 * Script para adicionar parâmetro Accept-Language em todos os endpoints do Swagger
 */

const fs = require('fs');
const path = require('path');

const routesDir = path.join(__dirname, '../src/routes');

// Função para adicionar Accept-Language após 'parameters:'
function addLanguageParam(content) {
  // Padrão: encontra 'parameters:' seguido de nova linha e espaços/tabs
  const regex = /(parameters:\s*\n(\s+)-)/g;
  
  // Substitui adicionando a referência ao AcceptLanguage primeiro
  const newContent = content.replace(
    regex,
    (match, p1, p2) => {
      // Se já tem AcceptLanguage, não adiciona
      if (content.includes("$ref: '#/components/parameters/AcceptLanguage'")) {
        return match;
      }
      return `parameters:\n${p2}$ref: '#/components/parameters/AcceptLanguage'\n${p2}-`;
    }
  );
  
  // Para endpoints sem parameters ainda, adiciona após security ou tags
  const regex2 = /(security:\s*\n\s+-\s+bearerAuth:\s+\[\]\s*\n)/g;
  
  const finalContent = newContent.replace(
    regex2,
    (match) => {
      const nextLine = newContent.substr(newContent.indexOf(match) + match.length, 50);
      if (nextLine.includes('parameters:')) {
        return match; // Já tem parameters
      }
      return `${match}     parameters:\n       - $ref: '#/components/parameters/AcceptLanguage'\n`;
    }
  );
  
  return finalContent;
}

// Processa todos os arquivos de rotas
function processRoutes() {
  const files = fs.readdirSync(routesDir);
  let updated = 0;
  let skipped = 0;
  
  files.forEach(file => {
    if (file.endsWith('.js')) {
      const filePath = path.join(routesDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      
      // Verifica se tem swagger docs
      if (!content.includes('@swagger')) {
        skipped++;
        return;
      }
      
      // Verifica se já tem todos os AcceptLanguage
      const swaggerBlocks = content.match(/@swagger[\s\S]*?(?=\*\/)/g) || [];
      const totalBlocks = swaggerBlocks.length;
      const blocksWithLang = swaggerBlocks.filter(block => 
        block.includes("AcceptLanguage")
      ).length;
      
      if (blocksWithLang === totalBlocks) {
        console.log(`✅ ${file} - Já possui Accept-Language em todos os endpoints`);
        skipped++;
        return;
      }
      
      const newContent = addLanguageParam(content);
      
      if (newContent !== content) {
        fs.writeFileSync(filePath, newContent, 'utf8');
        console.log(`✅ ${file} - Accept-Language adicionado`);
        updated++;
      } else {
        console.log(`⚠️  ${file} - Não foi possível adicionar automaticamente`);
        skipped++;
      }
    }
  });
  
  console.log(`\n📊 Resumo:`);
  console.log(`   ✅ Arquivos atualizados: ${updated}`);
  console.log(`   ⏭️  Arquivos ignorados: ${skipped}`);
}

// Executa
console.log('🚀 Adicionando Accept-Language aos endpoints do Swagger...\n');
processRoutes();
console.log('\n✨ Concluído!');
