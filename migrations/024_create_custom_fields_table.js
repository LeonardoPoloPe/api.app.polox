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
 * Migration 024: Criar Tabela de Campos Customizados (Atributo/Definição)
 * 
 * Sistema EAV (Entity-Attribute-Value):
 * Esta tabela armazena a DEFINIÇÃO dos campos customizados.
 * 
 * Casos de Uso:
 * - Admin da empresa cria campo "Orçamento" (tipo: numeric) para Leads
 * - Admin cria campo "Prioridade" (tipo: options) para Tickets
 * - Admin cria campo "Data da Visita" (tipo: date) para Clientes
 * 
 * Polimorfismo:
 * - entity_type define a qual módulo o campo se aplica: 'lead', 'client', 'product', etc.
 * - Permite expandir para qualquer entidade sem alterar esquema
 * 
 * Data: 23/10/2025
 */

async function up(client) {
  console.log('📋 Iniciando Migration 024: Criar tabela custom_fields...');

  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS polox.custom_fields (
      id bigserial NOT NULL PRIMARY KEY,
      
      -- Multi-tenant: A qual empresa este campo pertence
      -- NULL = Campo Global/Root do sistema (acessível por todas empresas)
      company_id int8 NULL,
      
      -- Polimorfismo: A qual entidade este campo se aplica
      -- Valores válidos: 'lead', 'client', 'product', 'sale', 'ticket', 'event', etc.
      entity_type varchar(50) NOT NULL,
      
      -- O nome/label do campo (ex: "Orçamento", "Data da Visita", "Prioridade")
      name varchar(100) NOT NULL,
      
      -- O tipo do campo
      -- Tipos suportados:
      --   'text'     -> Linha única (varchar)
      --   'textarea' -> Múltiplas linhas (text)
      --   'numeric'  -> Números (15,2)
      --   'url'      -> URLs (validação no frontend)
      --   'options'  -> Dropdown/Select (array JSON em 'options')
      --   'date'     -> Data/Hora (timestamptz)
      --   'checkbox' -> Booleano (true/false)
      field_type varchar(50) NOT NULL 
        CHECK (field_type IN ('text', 'textarea', 'numeric', 'url', 'options', 'date', 'checkbox')),
      
      -- Armazena o array de opções se field_type = 'options'
      -- Exemplo: '["Alto", "Médio", "Baixo"]' ou '["Sim", "Não", "Talvez"]'
      -- NULL para todos os outros tipos
      options jsonb NULL,
      
      -- Se o campo é obrigatório (validação no frontend/backend)
      is_required bool DEFAULT false NOT NULL,
      
      -- Ordem de exibição no formulário (ASC = primeiro)
      sort_order int4 DEFAULT 0 NOT NULL,
      
      -- Timestamps
      created_at timestamptz DEFAULT now() NOT NULL,
      updated_at timestamptz DEFAULT now() NOT NULL,

      -- FK para companies (ON DELETE CASCADE = se empresa for deletada, campos vão junto)
      CONSTRAINT fk_custom_fields_company 
        FOREIGN KEY (company_id) 
        REFERENCES polox.companies(id) 
        ON DELETE CASCADE,

      -- Garante que uma empresa não crie dois campos com o mesmo nome
      -- para a mesma entidade (ex: não pode ter dois "Orçamento" em Leads)
      -- IMPORTANTE: company_id pode ser NULL, então a constraint permite múltiplos NULLs
      CONSTRAINT custom_fields_company_entity_name_key
        UNIQUE (company_id, entity_type, name)
    );
  `;

  console.log('🔧 Criando tabela custom_fields...');
  await client.query(createTableQuery);
  console.log('✅ Tabela custom_fields criada com sucesso');

  console.log('🔧 Criando índices...');
  
  // Índice composto para buscar campos de uma empresa + entidade
  // Query comum: SELECT * WHERE company_id = ? AND entity_type = ?
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_custom_fields_company_entity 
    ON polox.custom_fields(company_id, entity_type);
  `);
  console.log('✅ Índice idx_custom_fields_company_entity criado');

  // Índice para buscar apenas por entidade (para campos globais)
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_custom_fields_entity_type 
    ON polox.custom_fields(entity_type);
  `);
  console.log('✅ Índice idx_custom_fields_entity_type criado');

  console.log('✅ Migration 024 concluída com sucesso!');
  console.log('');
  console.log('📌 RESUMO:');
  console.log('   ✓ Tabela custom_fields criada');
  console.log('   ✓ 7 tipos de campos suportados: text, textarea, numeric, url, options, date, checkbox');
  console.log('   ✓ Polimorfismo via entity_type');
  console.log('   ✓ Multi-tenant via company_id');
  console.log('   ✓ Constraint UNIQUE (company_id, entity_type, name)');
  console.log('   ✓ Índices criados para performance');
}

async function down(client) {
  console.log('🔄 Revertendo Migration 024: Remover tabela custom_fields...');
  
  await client.query('DROP TABLE IF EXISTS polox.custom_fields CASCADE;');
  
  console.log('✅ Migration 024 revertida com sucesso');
  console.log('⚠️  AVISO: Todos os campos customizados foram removidos!');
  console.log('⚠️  Os valores em custom_field_values ficarão órfãos se essa tabela não for removida também.');
}

module.exports = { up, down };
