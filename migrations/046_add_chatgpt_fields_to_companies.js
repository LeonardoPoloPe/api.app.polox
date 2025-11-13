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
 * Migration: 046 - Adicionar campos ChatGPT às companies
 *
 * Adiciona funcionalidade de integração ChatGPT:
 * - enable_chatgpt: Flag para habilitar/desabilitar ChatGPT (default: false)
 * - chatgpt_api_key: Chave da API do ChatGPT (criptografada)
 *
 * Estes campos permitem que empresas configurem integração com ChatGPT.
 */

module.exports = {
  up: async (client) => {
    console.log("🔄 Adicionando campos ChatGPT à tabela companies...");

    // Adicionar coluna enable_chatgpt
    await client.query(`
      ALTER TABLE polox.companies
      ADD COLUMN enable_chatgpt BOOLEAN NOT NULL DEFAULT false;
    `);

    console.log("✅ Coluna enable_chatgpt adicionada");

    // Adicionar coluna chatgpt_api_key
    await client.query(`
      ALTER TABLE polox.companies
      ADD COLUMN chatgpt_api_key TEXT NULL;
    `);

    console.log("✅ Coluna chatgpt_api_key adicionada");

    // Adicionar comentários nas colunas
    await client.query(`
      COMMENT ON COLUMN polox.companies.enable_chatgpt IS 'Habilita integração com ChatGPT para a empresa';
    `);

    await client.query(`
      COMMENT ON COLUMN polox.companies.chatgpt_api_key IS 'Chave da API do ChatGPT (armazenada de forma criptografada)';
    `);

    console.log("✅ Comentários adicionados");

    // Criar índice para otimizar consultas por empresas com ChatGPT habilitado
    await client.query(`
      CREATE INDEX idx_companies_enable_chatgpt 
      ON polox.companies(enable_chatgpt) 
      WHERE deleted_at IS NULL AND enable_chatgpt = true;
    `);

    console.log("✅ Índice idx_companies_enable_chatgpt criado");

    // Backfill: definir enable_chatgpt como false para empresas existentes (já é o default)
    console.log("🔄 Aplicando valores padrão às empresas existentes...");

    await client.query(`
      UPDATE polox.companies 
      SET enable_chatgpt = false 
      WHERE enable_chatgpt IS NULL AND deleted_at IS NULL;
    `);

    console.log("✅ Valores padrão aplicados às empresas existentes");

    console.log("✅ Migration 046 concluída com sucesso!");
  },

  down: async (client) => {
    console.log("🔄 Revertendo migration 046...");

    // Remover índice
    await client.query(`
      DROP INDEX IF EXISTS polox.idx_companies_enable_chatgpt;
    `);

    console.log("✅ Índice removido");

    // Remover colunas
    await client.query(`
      ALTER TABLE polox.companies
      DROP COLUMN IF EXISTS chatgpt_api_key;
    `);

    await client.query(`
      ALTER TABLE polox.companies
      DROP COLUMN IF EXISTS enable_chatgpt;
    `);

    console.log("✅ Colunas ChatGPT removidas");

    console.log("✅ Migration 046 revertida com sucesso!");
  },
};
