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

const migrationName = "044_add_view_own_leads_only_to_users";

const up = async (client) => {
  console.log(`🔄 [${migrationName}] Iniciando migration...`);

  try {
    // 1. Adicionar coluna view_own_leads_only na tabela users
    await client.query(`
      ALTER TABLE users 
      ADD COLUMN view_own_leads_only BOOLEAN NOT NULL DEFAULT false
    `);

    console.log(
      `✅ [${migrationName}] Campo view_own_leads_only adicionado à tabela users`
    );

    // 2. Adicionar comentário explicativo
    await client.query(`
      COMMENT ON COLUMN users.view_own_leads_only IS 
      'Controla visibilidade de leads: true = vê apenas próprios leads, false = pode ver leads de outros conforme permissões'
    `);

    console.log(
      `✅ [${migrationName}] Comentário adicionado ao campo view_own_leads_only`
    );

    // 3. Criar índice para performance em consultas filtradas por esse campo
    await client.query(`
      CREATE INDEX idx_users_view_own_leads_only 
      ON users (view_own_leads_only)
    `);

    console.log(
      `✅ [${migrationName}] Índice criado para campo view_own_leads_only`
    );
  } catch (error) {
    console.error(`❌ [${migrationName}] Erro na migration:`, error);
    throw error;
  }

  console.log(`✅ [${migrationName}] Migration concluída com sucesso!`);
};

const down = async (client) => {
  console.log(`🔄 [${migrationName}] Revertendo migration...`);

  try {
    // 1. Remover índice
    await client.query(`DROP INDEX IF EXISTS idx_users_view_own_leads_only`);
    console.log(
      `✅ [${migrationName}] Índice idx_users_view_own_leads_only removido`
    );

    // 2. Remover coluna
    await client.query(
      `ALTER TABLE users DROP COLUMN IF EXISTS view_own_leads_only`
    );
    console.log(
      `✅ [${migrationName}] Campo view_own_leads_only removido da tabela users`
    );
  } catch (error) {
    console.error(`❌ [${migrationName}] Erro ao reverter migration:`, error);
    throw error;
  }

  console.log(`✅ [${migrationName}] Migration revertida com sucesso!`);
};

module.exports = {
  up,
  down,
  migrationName,
};
