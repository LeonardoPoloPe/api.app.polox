/**
 * Migration: 014_add_updated_at_trigger_to_lead_notes
 * Descrição: Adiciona trigger para atualizar automaticamente o campo updated_at na tabela lead_notes
 * Data: 2025-10-22
 * 
 * Adiciona um TRIGGER (BEFORE UPDATE) que executa a função polox.update_updated_at_column()
 * para atualizar automaticamente o campo updated_at quando um registro é modificado.
 */

const up = async (client) => {
  console.log('🔄 Adicionando trigger de updated_at para lead_notes...');

  // Verificar se a função update_updated_at_column existe, senão criar
  await client.query(`
    CREATE OR REPLACE FUNCTION polox.update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);

  console.log('✅ Função update_updated_at_column verificada/criada');

  // Criar trigger para lead_notes
  await client.query(`
    DROP TRIGGER IF EXISTS set_updated_at ON polox.lead_notes;
    
    CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON polox.lead_notes
    FOR EACH ROW
    EXECUTE FUNCTION polox.update_updated_at_column();
  `);

  console.log('✅ Trigger set_updated_at criado para lead_notes');

  // Adicionar comentário
  await client.query(`
    COMMENT ON TRIGGER set_updated_at ON polox.lead_notes IS 
      'Atualiza automaticamente o campo updated_at quando um registro é modificado';
  `);

  console.log('✅ Migration 014_add_updated_at_trigger_to_lead_notes concluída com sucesso!');
};

const down = async (client) => {
  console.log('🔄 Revertendo migration 014_add_updated_at_trigger_to_lead_notes...');

  // Remover trigger
  await client.query(`
    DROP TRIGGER IF EXISTS set_updated_at ON polox.lead_notes;
  `);

  console.log('✅ Trigger set_updated_at removido de lead_notes');
  console.log('✅ Rollback da migration 014_add_updated_at_trigger_to_lead_notes concluído!');
};

module.exports = { up, down };
