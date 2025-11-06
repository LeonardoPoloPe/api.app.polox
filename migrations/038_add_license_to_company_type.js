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
