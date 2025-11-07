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
 * Migration: 001_create_users_table
 * Descrição: Cria a tabela users com índices e constraints
 * Data: 2025-10-18
 */

const up = async (client) => {
  // Verificar se a tabela users já existe (criada pela migration 000)
  const checkTable = await client.query(`
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'polox' 
      AND table_name = 'users'
    );
  `);

  if (checkTable.rows[0].exists) {
    console.log("⏭️  Tabela users já existe (criada pela migration 000), pulando...");
    return;
  }

  const query = `
    -- Criar tabela users
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      name VARCHAR(255) NOT NULL,
      status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    -- Criar índices para performance
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
    CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);

    -- Comentários para documentação
    COMMENT ON TABLE users IS 'Tabela de usuários do sistema';
    COMMENT ON COLUMN users.id IS 'ID único do usuário';
    COMMENT ON COLUMN users.email IS 'Email único do usuário para login';
    COMMENT ON COLUMN users.password_hash IS 'Hash da senha usando bcrypt';
    COMMENT ON COLUMN users.name IS 'Nome completo do usuário';
    COMMENT ON COLUMN users.status IS 'Status do usuário: active, inactive, suspended';
    COMMENT ON COLUMN users.created_at IS 'Data de criação do registro';
    COMMENT ON COLUMN users.updated_at IS 'Data da última atualização';

    -- Trigger para atualizar updated_at automaticamente
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
    END;
    $$ language 'plpgsql';

    CREATE TRIGGER update_users_updated_at
        BEFORE UPDATE ON users
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
  `;

  await client.query(query);
  console.log("✅ Tabela users criada com sucesso");
};

const down = async (client) => {
  const query = `
    -- Remover trigger
    DROP TRIGGER IF EXISTS update_users_updated_at ON users;
    
    -- Remover função
    DROP FUNCTION IF EXISTS update_updated_at_column();
    
    -- Remover índices (serão removidos automaticamente com a tabela)
    -- DROP INDEX IF EXISTS idx_users_email;
    -- DROP INDEX IF EXISTS idx_users_status;
    -- DROP INDEX IF EXISTS idx_users_created_at;
    
    -- Remover tabela
    DROP TABLE IF EXISTS users CASCADE;
  `;

  await client.query(query);
  console.log("✅ Tabela users removida com sucesso");
};

module.exports = {
  up,
  down,
};
