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
 * Migration: 012_create_lead_notes_table
 * Descrição: Cria tabela de notas para leads (relação Um-para-Muitos)
 * Data: 2025-10-22
 * 
 * Normaliza o campo 'notes' que antes era TEXT na tabela leads.
 * Agora cada lead pode ter múltiplas notas com histórico completo.
 */

const up = async (client) => {
  console.log('🔄 Criando tabela lead_notes...');

  // Criar tabela lead_notes
  await client.query(`
    CREATE TABLE IF NOT EXISTS polox.lead_notes (
      id BIGSERIAL PRIMARY KEY,
      lead_id BIGINT NOT NULL,
      created_by_id BIGINT NOT NULL,
      content TEXT NOT NULL,
      type VARCHAR(50) DEFAULT 'general',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      deleted_at TIMESTAMPTZ,
      
      CONSTRAINT fk_lead_notes_lead 
        FOREIGN KEY (lead_id) 
        REFERENCES polox.leads(id) 
        ON DELETE CASCADE,
        
      CONSTRAINT fk_lead_notes_user 
        FOREIGN KEY (created_by_id) 
        REFERENCES polox.users(id) 
        ON DELETE RESTRICT,
        
      CONSTRAINT chk_lead_notes_type 
        CHECK (type IN ('general', 'call', 'meeting', 'email', 'whatsapp', 'other'))
    );
  `);

  console.log('✅ Tabela lead_notes criada');

  // Criar índices para melhor performance
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_lead_notes_lead_id 
      ON polox.lead_notes(lead_id) 
      WHERE deleted_at IS NULL;
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_lead_notes_created_by_id 
      ON polox.lead_notes(created_by_id) 
      WHERE deleted_at IS NULL;
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_lead_notes_created_at 
      ON polox.lead_notes(created_at DESC) 
      WHERE deleted_at IS NULL;
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_lead_notes_type 
      ON polox.lead_notes(type) 
      WHERE deleted_at IS NULL;
  `);

  console.log('✅ Índices criados para lead_notes');

  // Adicionar comentários para documentação
  await client.query(`
    COMMENT ON TABLE polox.lead_notes IS 
      'Tabela de anotações sobre leads - permite registrar interações, observações e histórico de contatos';
  `);

  await client.query(`
    COMMENT ON COLUMN polox.lead_notes.id IS 
      'Identificador único da anotação';
  `);

  await client.query(`
    COMMENT ON COLUMN polox.lead_notes.lead_id IS 
      'Referência ao lead (FK para leads.id)';
  `);

  await client.query(`
    COMMENT ON COLUMN polox.lead_notes.created_by_id IS 
      'Usuário que criou a anotação (FK para users.id)';
  `);

  await client.query(`
    COMMENT ON COLUMN polox.lead_notes.content IS 
      'Conteúdo da anotação em formato texto';
  `);

  await client.query(`
    COMMENT ON COLUMN polox.lead_notes.type IS 
      'Tipo de anotação: general, call, meeting, email, whatsapp, other';
  `);

  console.log('✅ Comentários adicionados à tabela lead_notes');

  // Migrar dados antigos do backup (se existir e tiver a coluna notes)
  await client.query(`
    DO $$ 
    DECLARE
      lead_record RECORD;
      has_notes_column BOOLEAN;
    BEGIN
      -- Verificar se a tabela de backup existe
      IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'polox' 
        AND table_name = 'leads_backup_011'
      ) THEN
        -- Verificar se a coluna notes existe no backup
        SELECT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_schema = 'polox' 
            AND table_name = 'leads_backup_011' 
            AND column_name = 'notes'
        ) INTO has_notes_column;
        
        IF has_notes_column THEN
          -- Migrar notas do backup
          FOR lead_record IN 
            SELECT id, notes, (SELECT created_at FROM polox.leads WHERE id = leads_backup_011.id) as created_at
            FROM polox.leads_backup_011 
            WHERE notes IS NOT NULL AND notes != ''
          LOOP
            INSERT INTO polox.lead_notes (lead_id, created_by_id, content, type, created_at, updated_at)
            SELECT 
              lead_record.id,
              COALESCE(l.created_by_id, l.user_id, 1), -- Tenta created_by_id, depois user_id, senão ID 1
              lead_record.notes,
              'general',
              COALESCE(lead_record.created_at, NOW()),
              COALESCE(lead_record.created_at, NOW())
            FROM polox.leads l
            WHERE l.id = lead_record.id;
          END LOOP;
          
          RAISE NOTICE 'Notas antigas migradas do backup';
        ELSE
          RAISE NOTICE 'Backup não possui coluna notes, pulando migração';
        END IF;
      ELSE
        RAISE NOTICE 'Backup não encontrado, pulando migração de dados';
      END IF;
    END $$;
  `);

  console.log('✅ Migration 012_create_lead_notes_table concluída com sucesso!');
};

const down = async (client) => {
  console.log('🔄 Revertendo migration 012_create_lead_notes_table...');

  // Remover índices
  await client.query('DROP INDEX IF EXISTS polox.idx_lead_notes_type;');
  await client.query('DROP INDEX IF EXISTS polox.idx_lead_notes_created_at;');
  await client.query('DROP INDEX IF EXISTS polox.idx_lead_notes_created_by_id;');
  await client.query('DROP INDEX IF EXISTS polox.idx_lead_notes_lead_id;');

  console.log('✅ Índices removidos');

  // Remover tabela
  await client.query('DROP TABLE IF EXISTS polox.lead_notes CASCADE;');

  console.log('✅ Tabela lead_notes removida');
  console.log('✅ Rollback da migration 012_create_lead_notes_table concluído!');
};

module.exports = { up, down };
