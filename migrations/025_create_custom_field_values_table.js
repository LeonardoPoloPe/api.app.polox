/**
 * Migration 025: Criar Tabela de Valores de Campos Customizados (Valor/EAV)
 * 
 * Sistema EAV (Entity-Attribute-Value):
 * Esta tabela armazena os VALORES preenchidos pelos usuários.
 * 
 * Arquitetura Polimórfica:
 * - entity_id é polimórfico: pode ser lead_id, client_id, product_id, etc.
 * - O tipo da entidade é determinado pelo custom_field.entity_type
 * - NÃO há Foreign Key em entity_id (trade-off do padrão EAV)
 * 
 * Colunas de Valor Tipadas:
 * - text_value: Para 'text', 'textarea', 'url', 'options'
 * - numeric_value: Para 'numeric'
 * - date_value: Para 'date'
 * - boolean_value: Para 'checkbox'
 * 
 * ⚠️ RESPONSABILIDADE DA APLICAÇÃO:
 * A integridade referencial (entity_id válido) DEVE ser mantida pela API!
 * Ao deletar uma entidade (Lead, Client, etc.), SEMPRE chamar:
 *   CustomFieldValue.deleteAllByEntity(entityId)
 * 
 * Data: 23/10/2025
 */

async function up(client) {
  console.log('📋 Iniciando Migration 025: Criar tabela custom_field_values...');

  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS polox.custom_field_values (
      id bigserial NOT NULL PRIMARY KEY,
      
      -- O ID da definição do campo (FK para polox.custom_fields)
      custom_field_id int8 NOT NULL,
      
      -- A parte polimórfica: o ID da entidade
      -- Exemplos:
      --   Se custom_field.entity_type = 'lead', então entity_id = lead.id
      --   Se custom_field.entity_type = 'client', então entity_id = client.id
      -- ⚠️ CRÍTICO: NÃO há Foreign Key aqui! A aplicação DEVE garantir integridade.
      entity_id int8 NOT NULL,
      
      -- Colunas de valor tipadas para performance e validação
      -- Apenas UMA dessas colunas será preenchida por linha
      
      -- Usado para tipos: 'text', 'textarea', 'url'
      -- Para 'options': armazena o valor selecionado (ex: "Alto")
      text_value text NULL,
      
      -- Usado para tipo: 'numeric'
      -- Precisão: 15 dígitos totais, 2 casas decimais
      numeric_value numeric(15, 2) NULL,
      
      -- Usado para tipo: 'date'
      date_value timestamptz NULL,
      
      -- Usado para tipo: 'checkbox'
      boolean_value bool NULL,
      
      -- Timestamps
      created_at timestamptz DEFAULT now() NOT NULL,
      updated_at timestamptz DEFAULT now() NOT NULL,

      -- FK para custom_fields (ON DELETE CASCADE = se campo for deletado, valores vão junto)
      CONSTRAINT fk_custom_field_values_field 
        FOREIGN KEY (custom_field_id) 
        REFERENCES polox.custom_fields(id) 
        ON DELETE CASCADE,
      
      -- ⚠️ AVISO DE ARQUITETURA:
      -- NÃO podemos criar Foreign Key em (entity_id) porque não sabemos
      -- se ela aponta para 'polox.leads', 'polox.clients', 'polox.products', etc.
      -- A integridade DEVE ser gerenciada pela aplicação (API):
      --   - Validar que entity_id existe antes de criar valor
      --   - Deletar valores antes de deletar entidade
      --   - Usar transações para garantir atomicidade

      -- Garante que uma entidade (ex: lead 123) não tenha dois valores
      -- para o mesmo campo customizado (ex: field 45)
      -- Esta constraint permite UPSERT: INSERT ... ON CONFLICT ... DO UPDATE
      CONSTRAINT custom_field_values_entity_field_key
        UNIQUE (custom_field_id, entity_id)
    );
  `;

  console.log('🔧 Criando tabela custom_field_values...');
  await client.query(createTableQuery);
  console.log('✅ Tabela custom_field_values criada com sucesso');

  console.log('🔧 Criando índices...');
  
  // Índice CRUCIAL para buscar "todos os valores customizados para a entidade 123"
  // Query comum: SELECT * WHERE entity_id = ?
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_custom_field_values_entity 
    ON polox.custom_field_values(entity_id);
  `);
  console.log('✅ Índice idx_custom_field_values_entity criado');

  // Índice para buscar valores de um campo específico
  // Query comum: SELECT * WHERE custom_field_id = ?
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_custom_field_values_field 
    ON polox.custom_field_values(custom_field_id);
  `);
  console.log('✅ Índice idx_custom_field_values_field criado');

  // Índice composto para JOINs otimizados
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_custom_field_values_field_entity 
    ON polox.custom_field_values(custom_field_id, entity_id);
  `);
  console.log('✅ Índice idx_custom_field_values_field_entity criado');

  console.log('✅ Migration 025 concluída com sucesso!');
  console.log('');
  console.log('📌 RESUMO:');
  console.log('   ✓ Tabela custom_field_values criada');
  console.log('   ✓ 4 colunas de valor tipadas: text_value, numeric_value, date_value, boolean_value');
  console.log('   ✓ Polimorfismo via entity_id (SEM Foreign Key)');
  console.log('   ✓ FK CASCADE para custom_fields');
  console.log('   ✓ Constraint UNIQUE (custom_field_id, entity_id) - permite UPSERT');
  console.log('   ✓ Índices criados para performance');
  console.log('');
  console.log('⚠️  RESPONSABILIDADE DA APLICAÇÃO:');
  console.log('   - Validar entity_id antes de INSERT');
  console.log('   - Deletar valores antes de deletar entidade');
  console.log('   - Usar CustomFieldValue.deleteAllByEntity(entityId)');
}

async function down(client) {
  console.log('🔄 Revertendo Migration 025: Remover tabela custom_field_values...');
  
  await client.query('DROP TABLE IF EXISTS polox.custom_field_values CASCADE;');
  
  console.log('✅ Migration 025 revertida com sucesso');
  console.log('⚠️  AVISO: Todos os valores de campos customizados foram removidos!');
  console.log('⚠️  Dados de clientes/leads podem ter perdido informações customizadas.');
}

module.exports = { up, down };
