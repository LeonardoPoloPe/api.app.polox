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
 * Migration 032: Criar função cleanup_custom_field_values
 * 
 * Esta migration cria a função genérica polox.cleanup_custom_field_values()
 * que é usada pelos triggers de limpeza automática de custom field values.
 * 
 * IMPORTANTE: Esta função DEVE existir ANTES dos triggers que a utilizam.
 * Se você criou triggers manualmente, esta migration garante que a função existe.
 * 
 * Criado em: 24/10/2025
 * Autor: Sistema de Migrations Polox
 */

/**
 * UP: Cria a função polox.cleanup_custom_field_values()
 */
const up = async (client) => {
  console.log('🔧 Criando função polox.cleanup_custom_field_values()...');

  // 1. Verificar se a função já existe
  const checkFunction = `
    SELECT EXISTS (
      SELECT 1 
      FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'polox' 
      AND p.proname = 'cleanup_custom_field_values'
    ) as exists;
  `;

  const checkResult = await client.query(checkFunction);
  
  if (checkResult.rows[0].exists) {
    console.log('⚠️  Função polox.cleanup_custom_field_values() já existe. Pulando criação...');
    return;
  }

  // 2. Criar a função
  const createFunction = `
    CREATE OR REPLACE FUNCTION polox.cleanup_custom_field_values()
    RETURNS TRIGGER
    LANGUAGE plpgsql
    AS $$
    DECLARE
      entity_type_arg TEXT;
      deleted_count INTEGER;
    BEGIN
      -- Obter o tipo de entidade passado como argumento pelo trigger
      -- Exemplo: 'client', 'lead', 'product', etc.
      entity_type_arg := TG_ARGV[0];

      -- Deletar valores customizados relacionados à entidade que foi deletada
      -- Usa OLD.id (ID da linha deletada) e filtra por entity_type
      DELETE FROM polox.custom_field_values
      WHERE entity_id = OLD.id
        AND custom_field_id IN (
          SELECT id 
          FROM polox.custom_fields 
          WHERE entity_type = entity_type_arg
        );

      -- Obter número de registros deletados
      GET DIAGNOSTICS deleted_count = ROW_COUNT;

      -- Log opcional (pode ser removido em produção para performance)
      IF deleted_count > 0 THEN
        RAISE NOTICE 'Deletados % custom field values para entity_type=% com entity_id=%', 
                     deleted_count, entity_type_arg, OLD.id;
      END IF;

      -- Retornar OLD é obrigatório para triggers AFTER DELETE
      RETURN OLD;
    END;
    $$;
  `;

  await client.query(createFunction);

  // 3. Adicionar comentário à função
  const addComment = `
    COMMENT ON FUNCTION polox.cleanup_custom_field_values() IS 
    'Função trigger genérica que deleta valores de campos customizados quando uma entidade é deletada. 
     Recebe entity_type via TG_ARGV[0] (ex: ''client'', ''lead'', ''product'').
     Garante integridade referencial polimórfica sem foreign keys.
     Criada em: Migration 032 (24/10/2025)';
  `;

  await client.query(addComment);

  console.log('✅ Função polox.cleanup_custom_field_values() criada com sucesso!');
  console.log('📋 A função está pronta para ser usada pelos triggers de limpeza.');
};

/**
 * DOWN: Remove a função polox.cleanup_custom_field_values()
 */
const down = async (client) => {
  console.log('🔄 Revertendo Migration 032...');

  // 1. Verificar se existem triggers usando esta função
  const checkTriggers = `
    SELECT 
      t.tgname as trigger_name,
      c.relname as table_name
    FROM pg_trigger t
    JOIN pg_class c ON t.tgrelid = c.oid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    JOIN pg_proc p ON t.tgfoid = p.oid
    WHERE n.nspname = 'polox'
      AND p.proname = 'cleanup_custom_field_values';
  `;

  const triggersResult = await client.query(checkTriggers);

  if (triggersResult.rows.length > 0) {
    console.log('⚠️  AVISO: Existem triggers usando esta função:');
    triggersResult.rows.forEach(row => {
      console.log(`   - ${row.trigger_name} na tabela ${row.table_name}`);
    });
    console.log('');
    console.log('🚨 ERRO: Não é possível deletar a função enquanto triggers a utilizam!');
    console.log('💡 Solução: Delete os triggers primeiro ou rode Migration 031 down.');
    
    throw new Error(
      'Não é possível deletar polox.cleanup_custom_field_values(): triggers dependentes existem. ' +
      'Delete os triggers primeiro.'
    );
  }

  // 2. Deletar a função
  const dropFunction = `
    DROP FUNCTION IF EXISTS polox.cleanup_custom_field_values() CASCADE;
  `;

  await client.query(dropFunction);

  console.log('✅ Função polox.cleanup_custom_field_values() removida com sucesso!');
};

module.exports = { up, down };
