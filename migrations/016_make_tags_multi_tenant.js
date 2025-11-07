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
 * Migration 016: Tornar tabela tags multi-tenant
 * 
 * Objetivos:
 * - Permitir company_id NULL para tags globais (sistema)
 * - Adicionar FK para polox.companies com CASCADE
 * - Remover índice antigo idx_tags_name
 * - Criar índices únicos parciais para multi-tenancy
 * 
 * Padrão:
 * - company_id NULL = tag global (disponível para todas as empresas)
 * - company_id NOT NULL = tag específica da empresa
 * 
 * Data: 2025-10-23
 */

const { query } = require('../src/config/database');

/**
 * Aplica as alterações (UP)
 */
async function up(client) {
  console.log('🔄 Iniciando migration 016: Tornar tags multi-tenant...');

  try {
    // 1. Alterar coluna company_id para permitir NULL
    console.log('📝 Alterando company_id para permitir NULL...');
    await client.query(`
      ALTER TABLE polox.tags 
      ALTER COLUMN company_id DROP NOT NULL;
    `);
    console.log('✅ Coluna company_id agora permite NULL');

    // 2. Verificar e adicionar FK para companies se não existir
    console.log('🔗 Verificando FK para polox.companies...');
    const fkExists = await client.query(`
      SELECT 1 
      FROM pg_constraint 
      WHERE conname = 'fk_tags_company' 
      AND conrelid = 'polox.tags'::regclass
    `);

    if (fkExists.rows.length === 0) {
      await client.query(`
        ALTER TABLE polox.tags 
        ADD CONSTRAINT fk_tags_company 
        FOREIGN KEY (company_id) 
        REFERENCES polox.companies(id) 
        ON DELETE CASCADE;
      `);
      console.log('✅ Foreign key para companies adicionada');
    } else {
      console.log('ℹ️  Foreign key já existe, pulando...');
    }

    // 3. Remover índice antigo idx_tags_name se existir
    console.log('🗑️  Removendo índice antigo idx_tags_name...');
    const oldIndexExists = await client.query(`
      SELECT 1 
      FROM pg_indexes 
      WHERE schemaname = 'polox' 
      AND tablename = 'tags' 
      AND indexname = 'idx_tags_name'
    `);

    if (oldIndexExists.rows.length > 0) {
      await client.query(`DROP INDEX IF EXISTS polox.idx_tags_name;`);
      console.log('✅ Índice antigo idx_tags_name removido');
    } else {
      console.log('ℹ️  Índice idx_tags_name não existe, pulando...');
    }

    // 4. Remover constraint UNIQUE antiga se existir (name)
    console.log('🗑️  Removendo constraint UNIQUE antiga...');
    const oldUniqueExists = await client.query(`
      SELECT conname 
      FROM pg_constraint 
      WHERE conrelid = 'polox.tags'::regclass 
      AND contype = 'u' 
      AND conname LIKE '%name%'
    `);

    for (const row of oldUniqueExists.rows) {
      await client.query(`
        ALTER TABLE polox.tags 
        DROP CONSTRAINT IF EXISTS ${row.conname};
      `);
      console.log(`✅ Constraint ${row.conname} removida`);
    }

    // 5. Criar índice único parcial para tags da empresa (company_id, name, slug)
    console.log('📌 Criando índice único para tags da empresa...');
    await client.query(`
      CREATE UNIQUE INDEX idx_tags_company_name_slug_unique 
      ON polox.tags (company_id, name, slug) 
      WHERE company_id IS NOT NULL;
    `);
    console.log('✅ Índice único para tags da empresa criado');

    // 6. Criar índice único parcial para tags globais (name, slug)
    console.log('🌍 Criando índice único para tags globais...');
    await client.query(`
      CREATE UNIQUE INDEX idx_tags_global_name_slug_unique 
      ON polox.tags (name, slug) 
      WHERE company_id IS NULL;
    `);
    console.log('✅ Índice único para tags globais criado');

    // 7. Criar índice de performance em company_id
    console.log('⚡ Criando índice de performance em company_id...');
    const perfIndexExists = await client.query(`
      SELECT 1 
      FROM pg_indexes 
      WHERE schemaname = 'polox' 
      AND tablename = 'tags' 
      AND indexname = 'idx_tags_company_id'
    `);

    if (perfIndexExists.rows.length === 0) {
      await client.query(`
        CREATE INDEX idx_tags_company_id 
        ON polox.tags (company_id) 
        WHERE company_id IS NOT NULL;
      `);
      console.log('✅ Índice de performance criado');
    } else {
      console.log('ℹ️  Índice de performance já existe, pulando...');
    }

    // 8. Atualizar comentários da tabela
    console.log('📝 Atualizando comentários...');
    await client.query(`
      COMMENT ON COLUMN polox.tags.company_id IS 
      'ID da empresa (NULL = tag global/sistema, NOT NULL = tag específica da empresa)';
    `);
    console.log('✅ Comentários atualizados');

    console.log('✅ Migration 016 concluída com sucesso!');
    console.log('');
    console.log('📋 Resumo das alterações:');
    console.log('  - company_id agora permite NULL (tags globais)');
    console.log('  - FK para companies com ON DELETE CASCADE');
    console.log('  - Índice único parcial: (company_id, name, slug) para tags da empresa');
    console.log('  - Índice único parcial: (name, slug) para tags globais');
    console.log('  - Índice de performance em company_id');
    console.log('');
    console.log('🎯 Resultado:');
    console.log('  - Tags globais (company_id = NULL) disponíveis para todas as empresas');
    console.log('  - Empresas diferentes podem ter tags com mesmo nome/slug');
    console.log('  - Unicidade garantida dentro do escopo (global ou por empresa)');

  } catch (error) {
    console.error('❌ Erro na migration 016:', error.message);
    throw error;
  }
}

/**
 * Reverte as alterações (DOWN)
 */
async function down(client) {
  console.log('🔄 Revertendo migration 016: Tornar tags multi-tenant...');

  try {
    // 1. Remover índices criados
    console.log('🗑️  Removendo índices parciais...');
    await client.query(`DROP INDEX IF EXISTS polox.idx_tags_company_name_slug_unique;`);
    await client.query(`DROP INDEX IF EXISTS polox.idx_tags_global_name_slug_unique;`);
    await client.query(`DROP INDEX IF EXISTS polox.idx_tags_company_id;`);
    console.log('✅ Índices removidos');

    // 2. Remover FK se foi criada por esta migration
    console.log('🗑️  Removendo FK...');
    await client.query(`
      ALTER TABLE polox.tags 
      DROP CONSTRAINT IF EXISTS fk_tags_company;
    `);
    console.log('✅ FK removida');

    // 3. ATENÇÃO: Não podemos reverter company_id para NOT NULL se houver tags globais
    console.log('⚠️  ATENÇÃO: Não é possível reverter company_id para NOT NULL automaticamente');
    console.log('⚠️  Se houver tags globais (company_id = NULL), você deve:');
    console.log('    1. Atribuir essas tags a uma empresa específica');
    console.log('    2. Executar: ALTER TABLE polox.tags ALTER COLUMN company_id SET NOT NULL;');
    console.log('    3. Recriar o índice antigo se necessário');

    // 4. Remover comentários
    await client.query(`
      COMMENT ON COLUMN polox.tags.company_id IS NULL;
    `);

    console.log('✅ Migration 016 revertida parcialmente');
    console.log('⚠️  Reversão completa requer intervenção manual para company_id');

  } catch (error) {
    console.error('❌ Erro ao reverter migration 016:', error.message);
    throw error;
  }
}

module.exports = { up, down };
