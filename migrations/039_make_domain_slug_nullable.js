/**
 * Migration: 039 - Tornar company_domain e slug opcionais
 *
 * Algumas empresas podem não ter domínio próprio (ex: clientes finais),
 * então os campos company_domain e slug devem ser nullable.
 */

module.exports = {
  up: async (client) => {
    console.log("🔄 Tornando company_domain e slug opcionais...");

    // Remover constraint NOT NULL dos campos company_domain e slug
    await client.query(`
      ALTER TABLE polox.companies 
      ALTER COLUMN company_domain DROP NOT NULL,
      ALTER COLUMN slug DROP NOT NULL;
    `);

    console.log("✅ Campos company_domain e slug agora são opcionais");

    // Adicionar comentários para documentar
    await client.query(`
      COMMENT ON COLUMN polox.companies.company_domain IS 
        'Domínio da empresa (opcional - pode ser NULL para empresas sem domínio próprio)';
      
      COMMENT ON COLUMN polox.companies.slug IS 
        'Slug único da empresa (opcional - pode ser NULL para empresas sem domínio)';
    `);

    console.log("✅ Comentários adicionados aos campos");
  },

  down: async (client) => {
    console.log(
      "🔄 Revertendo: tornando company_domain e slug obrigatórios..."
    );

    // Antes de adicionar NOT NULL, precisamos garantir que não há valores NULL
    // Vamos definir um valor padrão baseado no company_name para registros NULL
    await client.query(`
      UPDATE polox.companies 
      SET 
        company_domain = COALESCE(company_domain, LOWER(REGEXP_REPLACE(company_name, '[^a-zA-Z0-9]', '', 'g')) || '.local'),
        slug = COALESCE(slug, LOWER(REGEXP_REPLACE(company_name, '[^a-zA-Z0-9-]', '-', 'g')))
      WHERE company_domain IS NULL OR slug IS NULL;
    `);

    // Adicionar constraint NOT NULL de volta
    await client.query(`
      ALTER TABLE polox.companies 
      ALTER COLUMN company_domain SET NOT NULL,
      ALTER COLUMN slug SET NOT NULL;
    `);

    console.log("✅ Campos company_domain e slug voltaram a ser obrigatórios");
  },
};
