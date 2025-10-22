/**
 * Migration: 006_exemplo_nova_tabela
 * Descrição: Adiciona tabela de configurações de sistema
 * Data: 2025-10-22
 */

const up = async (client) => {
  const query = `
    -- Criar tabela de configurações do sistema
    CREATE TABLE IF NOT EXISTS polox.system_settings (
      id SERIAL PRIMARY KEY,
      setting_key VARCHAR(100) UNIQUE NOT NULL,
      setting_value TEXT,
      setting_type VARCHAR(50) DEFAULT 'string',
      description TEXT,
      is_public BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    -- Criar índices para melhor performance
    CREATE INDEX IF NOT EXISTS idx_system_settings_key ON polox.system_settings(setting_key);
    CREATE INDEX IF NOT EXISTS idx_system_settings_public ON polox.system_settings(is_public);

    -- Inserir configurações padrão
    INSERT INTO polox.system_settings (setting_key, setting_value, setting_type, description, is_public) VALUES
      ('app_version', '1.0.0', 'string', 'Versão atual da aplicação', TRUE),
      ('maintenance_mode', 'false', 'boolean', 'Modo de manutenção ativo', TRUE),
      ('max_upload_size', '10485760', 'number', 'Tamanho máximo de upload em bytes', FALSE),
      ('default_language', 'pt-BR', 'string', 'Idioma padrão do sistema', TRUE)
    ON CONFLICT (setting_key) DO NOTHING;

    -- Comentário na tabela
    COMMENT ON TABLE polox.system_settings IS 'Configurações globais do sistema';
  `;

  await client.query(query);
  console.log('✅ Migration 006_exemplo_nova_tabela aplicada com sucesso');
};

const down = async (client) => {
  const query = `
    -- Remover tabela de configurações
    DROP TABLE IF EXISTS polox.system_settings CASCADE;
  `;

  await client.query(query);
  console.log('✅ Migration 006_exemplo_nova_tabela revertida com sucesso');
};

module.exports = {
  up,
  down
};