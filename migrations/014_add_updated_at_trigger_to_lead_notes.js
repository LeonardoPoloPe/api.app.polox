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
