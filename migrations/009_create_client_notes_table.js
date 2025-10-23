/**
 * Migration: Criar tabela client_notes
 * Descrição: Tabela para armazenar anotações sobre clientes
 * Data: 2025-10-22
 */

exports.up = async function(client) {
  console.log('🔄 Criando tabela client_notes...');

  // Criar tabela client_notes
  await client.query(`
    CREATE TABLE IF NOT EXISTS polox.client_notes (
      id BIGSERIAL PRIMARY KEY,
      client_id BIGINT NOT NULL,
      created_by_id BIGINT NOT NULL,
      content TEXT NOT NULL,
      type VARCHAR(50) DEFAULT 'general',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      deleted_at TIMESTAMP WITH TIME ZONE,
      
      CONSTRAINT fk_client_notes_client 
        FOREIGN KEY (client_id) 
        REFERENCES polox.clients(id) 
        ON DELETE CASCADE,
        
      CONSTRAINT fk_client_notes_user 
        FOREIGN KEY (created_by_id) 
        REFERENCES polox.users(id) 
        ON DELETE RESTRICT,
        
      CONSTRAINT chk_client_notes_type 
        CHECK (type IN ('general', 'call', 'meeting', 'email', 'other'))
    );
  `);

  console.log('✅ Tabela client_notes criada');

  // Criar índices para melhor performance
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_client_notes_client_id 
      ON polox.client_notes(client_id) 
      WHERE deleted_at IS NULL;
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_client_notes_created_by_id 
      ON polox.client_notes(created_by_id) 
      WHERE deleted_at IS NULL;
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_client_notes_created_at 
      ON polox.client_notes(created_at DESC) 
      WHERE deleted_at IS NULL;
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_client_notes_type 
      ON polox.client_notes(type) 
      WHERE deleted_at IS NULL;
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_client_notes_deleted_at 
      ON polox.client_notes(deleted_at) 
      WHERE deleted_at IS NOT NULL;
  `);

  console.log('✅ Índices criados para client_notes');

  // Adicionar comentários para documentação
  await client.query(`
    COMMENT ON TABLE polox.client_notes IS 
      'Tabela de anotações sobre clientes - permite registrar interações, observações e histórico de contatos';
  `);

  await client.query(`
    COMMENT ON COLUMN polox.client_notes.id IS 
      'Identificador único da anotação (UUID)';
  `);

  await client.query(`
    COMMENT ON COLUMN polox.client_notes.client_id IS 
      'Referência ao cliente (FK para clients.id)';
  `);

  await client.query(`
    COMMENT ON COLUMN polox.client_notes.created_by_id IS 
      'Usuário que criou a anotação (FK para users.id)';
  `);

  await client.query(`
    COMMENT ON COLUMN polox.client_notes.content IS 
      'Conteúdo da anotação em formato texto';
  `);

  await client.query(`
    COMMENT ON COLUMN polox.client_notes.type IS 
      'Tipo de anotação: general, call, meeting, email, other';
  `);

  await client.query(`
    COMMENT ON COLUMN polox.client_notes.created_at IS 
      'Data e hora de criação da anotação';
  `);

  await client.query(`
    COMMENT ON COLUMN polox.client_notes.updated_at IS 
      'Data e hora da última atualização';
  `);

  await client.query(`
    COMMENT ON COLUMN polox.client_notes.deleted_at IS 
      'Data e hora de exclusão lógica (soft delete)';
  `);

  console.log('✅ Comentários adicionados à tabela client_notes');

  console.log('✅ Migration 009_create_client_notes_table concluída com sucesso!');
};

exports.down = async function(client) {
  console.log('🔄 Revertendo migration 009_create_client_notes_table...');

  // Remover índices
  await client.query('DROP INDEX IF EXISTS polox.idx_client_notes_deleted_at;');
  await client.query('DROP INDEX IF EXISTS polox.idx_client_notes_type;');
  await client.query('DROP INDEX IF EXISTS polox.idx_client_notes_created_at;');
  await client.query('DROP INDEX IF EXISTS polox.idx_client_notes_created_by_id;');
  await client.query('DROP INDEX IF EXISTS polox.idx_client_notes_client_id;');

  console.log('✅ Índices removidos');

  // Remover tabela
  await client.query('DROP TABLE IF EXISTS polox.client_notes CASCADE;');

  console.log('✅ Tabela client_notes removida');
  console.log('✅ Rollback da migration 009_create_client_notes_table concluído!');
};
