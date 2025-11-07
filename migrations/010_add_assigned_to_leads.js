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
 * Migration: Adicionar campo assigned_to_id na tabela leads
 * Descrição: Permite atribuir leads a diferentes usuários além do criador
 * Data: 2025-10-22
 */

exports.up = async function(client) {
  console.log('🔄 Adicionando campo assigned_to_id à tabela leads...');

  // Adicionar coluna assigned_to_id
  await client.query(`
    ALTER TABLE polox.leads 
    ADD COLUMN IF NOT EXISTS assigned_to_id BIGINT;
  `);

  console.log('✅ Campo assigned_to_id adicionado');

  // Adicionar foreign key
  await client.query(`
    DO $$ 
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'fk_leads_assigned_to_user'
      ) THEN
        ALTER TABLE polox.leads 
        ADD CONSTRAINT fk_leads_assigned_to_user 
        FOREIGN KEY (assigned_to_id) 
        REFERENCES polox.users(id) 
        ON DELETE SET NULL;
      END IF;
    END $$;
  `);

  console.log('✅ Foreign key criada para assigned_to_id');

  // Criar índice para performance
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_leads_assigned_to_id 
      ON polox.leads(assigned_to_id) 
      WHERE deleted_at IS NULL;
  `);

  console.log('✅ Índice criado para assigned_to_id');

  // Migrar dados existentes: atribuir ao criador (user_id)
  await client.query(`
    UPDATE polox.leads 
    SET assigned_to_id = user_id 
    WHERE assigned_to_id IS NULL AND user_id IS NOT NULL;
  `);

  console.log('✅ Dados migrados: assigned_to_id = user_id para leads existentes');

  // Adicionar comentário
  await client.query(`
    COMMENT ON COLUMN polox.leads.assigned_to_id IS 
      'ID do usuário responsável pelo lead (pode ser diferente do criador)';
  `);

  console.log('✅ Migration 010_add_assigned_to_leads concluída com sucesso!');
};

exports.down = async function(client) {
  console.log('🔄 Revertendo migration 010_add_assigned_to_leads...');

  // Remover índice
  await client.query('DROP INDEX IF EXISTS polox.idx_leads_assigned_to_id;');
  console.log('✅ Índice removido');

  // Remover foreign key
  await client.query(`
    ALTER TABLE polox.leads 
    DROP CONSTRAINT IF EXISTS fk_leads_assigned_to_user;
  `);
  console.log('✅ Foreign key removida');

  // Remover coluna
  await client.query(`
    ALTER TABLE polox.leads 
    DROP COLUMN IF EXISTS assigned_to_id;
  `);
  console.log('✅ Coluna assigned_to_id removida');

  console.log('✅ Rollback da migration 010_add_assigned_to_leads concluído!');
};
