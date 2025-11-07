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
