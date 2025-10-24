/**
 * Migration: Criar tabela gamification_history
 * 
 * Histórico completo de eventos de gamificação:
 * - Pontos ganhos/perdidos
 * - Conquistas desbloqueadas
 * - Missões completadas
 * - Level ups
 * - Recompensas resgatadas
 * 
 * @created 2025-10-24
 */

const up = async (client) => {
  console.log('🎮 Criando tabela gamification_history...');

  // Primeiro, verificar se a tabela existe com estrutura antiga e fazer backup/drop
  await client.query(`
    DO $$
    BEGIN
      -- Se a tabela existe, fazer backup antes de dropar
      IF EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'polox' 
        AND table_name = 'gamification_history'
      ) THEN
        -- Criar tabela de backup se não existir
        CREATE TABLE IF NOT EXISTS polox.gamification_history_backup_20251024 AS 
        SELECT * FROM polox.gamification_history;
        
        -- Dropar tabela antiga
        DROP TABLE polox.gamification_history CASCADE;
        
        RAISE NOTICE 'Tabela antiga movida para gamification_history_backup_20251024';
      END IF;
    END $$;
  `);

  await client.query(`
    -- Tabela de histórico de gamificação
    CREATE TABLE IF NOT EXISTS polox.gamification_history (
      id SERIAL PRIMARY KEY,
      
      -- Usuário que recebeu/perdeu pontos
      user_id INTEGER NOT NULL REFERENCES polox.users(id) ON DELETE CASCADE,
      
      -- Tipo de evento
      event_type VARCHAR(50) NOT NULL,
      -- Tipos comuns: client_created, sale_completed, lead_converted, 
      --               achievement_unlocked, mission_completed, level_up,
      --               reward_claimed, coins_awarded, daily_login, etc.
      
      -- Pontos (pode ter awarded OU deducted, nunca ambos no mesmo evento)
      points_awarded INTEGER DEFAULT 0 CHECK (points_awarded >= 0),
      points_deducted INTEGER DEFAULT 0 CHECK (points_deducted >= 0),
      
      -- Descrição do evento
      description TEXT,
      
      -- Metadados adicionais (JSON)
      metadata JSONB DEFAULT '{}'::jsonb,
      
      -- Entidade relacionada ao evento (polimórfico)
      related_entity_type VARCHAR(50), -- client, sale, lead, achievement, mission, etc.
      related_entity_id INTEGER,
      
      -- Usuário que acionou o evento (pode ser diferente de user_id)
      -- Ex: Admin concedendo pontos manualmente
      triggered_by_user_id INTEGER REFERENCES polox.users(id) ON DELETE SET NULL,
      
      -- Timestamps
      created_at TIMESTAMP DEFAULT NOW(),
      
      -- Constraints
      CONSTRAINT check_points_mutually_exclusive 
        CHECK (
          (points_awarded > 0 AND points_deducted = 0) OR 
          (points_awarded = 0 AND points_deducted > 0) OR
          (points_awarded = 0 AND points_deducted = 0)
        )
    );

    -- Índices para performance
    CREATE INDEX IF NOT EXISTS idx_gamification_history_user_id 
      ON polox.gamification_history(user_id);
    
    CREATE INDEX IF NOT EXISTS idx_gamification_history_event_type 
      ON polox.gamification_history(event_type);
    
    CREATE INDEX IF NOT EXISTS idx_gamification_history_created_at 
      ON polox.gamification_history(created_at DESC);
    
    CREATE INDEX IF NOT EXISTS idx_gamification_history_entity 
      ON polox.gamification_history(related_entity_type, related_entity_id);
    
    CREATE INDEX IF NOT EXISTS idx_gamification_history_user_event 
      ON polox.gamification_history(user_id, event_type);
    
    CREATE INDEX IF NOT EXISTS idx_gamification_history_metadata 
      ON polox.gamification_history USING GIN(metadata);
    
    -- Comentários
    COMMENT ON TABLE polox.gamification_history IS 
      'Histórico completo de eventos de gamificação do sistema';
    
    COMMENT ON COLUMN polox.gamification_history.event_type IS 
      'Tipo do evento: client_created, sale_completed, achievement_unlocked, etc.';
    
    COMMENT ON COLUMN polox.gamification_history.metadata IS 
      'Dados adicionais do evento em formato JSON';
    
    COMMENT ON COLUMN polox.gamification_history.related_entity_type IS 
      'Tipo da entidade relacionada (polimórfico): client, sale, lead, achievement, etc.';
  `);

  console.log('✅ Tabela gamification_history criada com sucesso!');
};

const down = async (client) => {
  console.log('🎮 Revertendo tabela gamification_history...');

  await client.query(`
    DROP TABLE IF EXISTS polox.gamification_history CASCADE;
  `);

  console.log('✅ Tabela gamification_history removida!');
};

module.exports = { up, down };
