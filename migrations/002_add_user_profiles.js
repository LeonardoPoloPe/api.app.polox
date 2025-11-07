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
 * Migration: 002_add_user_profiles
 * Descrição: [Descreva o que esta migration faz]
 * Data: 2025-10-18
 */

const up = async (client) => {
  const query = `
    -- Adicione aqui os comandos SQL para aplicar a migration
    -- Exemplo:
    -- CREATE TABLE exemplo (
    --   id SERIAL PRIMARY KEY,
    --   nome VARCHAR(255) NOT NULL
    -- );
  `;

  await client.query(query);
  console.log('✅ Migration 002_add_user_profiles aplicada com sucesso');
};

const down = async (client) => {
  const query = `
    -- Adicione aqui os comandos SQL para reverter a migration
    -- Exemplo:
    -- DROP TABLE IF EXISTS exemplo;
  `;

  await client.query(query);
  console.log('✅ Migration 002_add_user_profiles revertida com sucesso');
};

module.exports = {
  up,
  down
};