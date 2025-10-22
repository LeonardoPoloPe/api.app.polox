/**
 * Migration: 007_fix_add_missing_columns
 * Descrição: [Descreva o que esta migration faz]
 * Data: 2025-10-22
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
  console.log('✅ Migration 007_fix_add_missing_columns aplicada com sucesso');
};

const down = async (client) => {
  const query = `
    -- Adicione aqui os comandos SQL para reverter a migration
    -- Exemplo:
    -- DROP TABLE IF EXISTS exemplo;
  `;

  await client.query(query);
  console.log('✅ Migration 007_fix_add_missing_columns revertida com sucesso');
};

module.exports = {
  up,
  down
};