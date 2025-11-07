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
 * MIGRATION 038: Adicionar "license" ao company_type
 * ==========================================
 * 
 * Adiciona o valor "license" ao check constraint de company_type
 * para permitir empresas licenciadas no sistema.
 */

async function up(client) {
  console.log('🚀 Iniciando migration 038: Adicionar license ao company_type...');
  
  // Remover a constraint existente
  console.log('📝 Removendo constraint antiga...');
  await client.query(`
    ALTER TABLE polox.companies 
    DROP CONSTRAINT IF EXISTS companies_company_type_check;
  `);

  // Adicionar nova constraint com "license"
  console.log('📝 Adicionando nova constraint com "license"...');
  await client.query(`
    ALTER TABLE polox.companies
    ADD CONSTRAINT companies_company_type_check 
    CHECK (company_type IN ('tenant', 'partner', 'license'));
  `);

  console.log('✅ Migration 038 concluída com sucesso!');
}

async function down(client) {
  console.log('🔄 Revertendo migration 038...');
  
  // Remover constraint atual
  await client.query(`
    ALTER TABLE polox.companies 
    DROP CONSTRAINT IF EXISTS companies_company_type_check;
  `);

  // Restaurar constraint original (sem "license")
  await client.query(`
    ALTER TABLE polox.companies
    ADD CONSTRAINT companies_company_type_check 
    CHECK (company_type IN ('tenant', 'partner'));
  `);

  console.log('✅ Migration 038 revertida com sucesso!');
}

module.exports = { up, down };
