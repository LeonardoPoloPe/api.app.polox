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

const fs = require("fs");
const path = require("path");

/**
 * Script para criar novas migrations
 * Uso: npm run migrate:create nome_da_migration
 */

function createMigration() {
  const migrationName = process.argv[2];

  if (!migrationName) {
    console.error("❌ Erro: Nome da migration é obrigatório");
    console.log("Uso: npm run migrate:create nome_da_migration");
    console.log("Exemplo: npm run migrate:create add_user_profiles");
    process.exit(1);
  }

  // Validar nome da migration
  if (!/^[a-z0-9_]+$/.test(migrationName)) {
    console.error(
      "❌ Erro: Nome da migration deve conter apenas letras minúsculas, números e underscore"
    );
    process.exit(1);
  }

  const migrationsDir = path.join(__dirname, "..", "migrations");

  // Verificar se o diretório existe
  if (!fs.existsSync(migrationsDir)) {
    fs.mkdirSync(migrationsDir, { recursive: true });
  }

  // Obter próximo número sequencial
  const existingMigrations = fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".js") && file !== "migration-runner.js")
    .map((file) => {
      const match = file.match(/^(\d{3})_/);
      return match ? parseInt(match[1]) : 0;
    })
    .sort((a, b) => b - a);

  const nextNumber = (existingMigrations[0] || 0) + 1;
  const paddedNumber = nextNumber.toString().padStart(3, "0");

  const fileName = `${paddedNumber}_${migrationName}.js`;
  const filePath = path.join(migrationsDir, fileName);

  // Template da migration
  const template = `/**
 * Migration: ${paddedNumber}_${migrationName}
 * Descrição: [Descreva o que esta migration faz]
 * Data: ${new Date().toISOString().split("T")[0]}
 */

const up = async (client) => {
  const query = \`
    -- Adicione aqui os comandos SQL para aplicar a migration
    -- Exemplo:
    -- CREATE TABLE exemplo (
    --   id SERIAL PRIMARY KEY,
    --   nome VARCHAR(255) NOT NULL
    -- );
  \`;

  await client.query(query);
  console.log('✅ Migration ${paddedNumber}_${migrationName} aplicada com sucesso');
};

const down = async (client) => {
  const query = \`
    -- Adicione aqui os comandos SQL para reverter a migration
    -- Exemplo:
    -- DROP TABLE IF EXISTS exemplo;
  \`;

  await client.query(query);
  console.log('✅ Migration ${paddedNumber}_${migrationName} revertida com sucesso');
};

module.exports = {
  up,
  down
};`;

  // Criar arquivo
  try {
    fs.writeFileSync(filePath, template, "utf8");

    console.log("🚀 Migration criada com sucesso!");
    console.log(`📁 Arquivo: ${fileName}`);
    console.log(`📍 Local: ${filePath}`);
    console.log("");
    console.log("📝 Próximos passos:");
    console.log("1. Edite o arquivo e adicione os comandos SQL");
    console.log("2. Execute: npm run migrate:status (para ver o status)");
    console.log("3. Execute: npm run migrate (para aplicar)");
  } catch (error) {
    console.error("❌ Erro ao criar migration:", error.message);
    process.exit(1);
  }
}

createMigration();
