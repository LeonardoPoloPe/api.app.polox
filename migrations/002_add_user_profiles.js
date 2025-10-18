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