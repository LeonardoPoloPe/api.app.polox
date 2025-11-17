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
 * Migration 047: Criar tabela financial_categories
 * 
 * Objetivos:
 * - Criar tabela de categorias financeiras
 * - Suportar hierarquia de categorias (parent_id)
 * - Categorias podem ser de receita, despesa ou ambas
 * - Multi-tenant (por empresa)
 * 
 * Data: 2025-11-17
 */

const { query } = require('../src/config/database');

/**
 * Aplica as alterações (UP)
 */
async function up(client) {
  console.log('🔄 Iniciando migration 047: Criar tabela financial_categories...');

  try {
    // 1. Criar tabela financial_categories
    console.log('📋 Criando tabela polox.financial_categories...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS polox.financial_categories (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id BIGINT NOT NULL,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        type VARCHAR(20) NOT NULL DEFAULT 'both',
        parent_id UUID,
        is_active BOOLEAN DEFAULT TRUE,
        created_by BIGINT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        deleted_at TIMESTAMP WITH TIME ZONE,
        
        -- Foreign keys
        CONSTRAINT fk_financial_categories_company 
          FOREIGN KEY (company_id) 
          REFERENCES polox.companies(id) 
          ON DELETE CASCADE,
        
        CONSTRAINT fk_financial_categories_parent 
          FOREIGN KEY (parent_id) 
          REFERENCES polox.financial_categories(id) 
          ON DELETE SET NULL,
        
        CONSTRAINT fk_financial_categories_created_by 
          FOREIGN KEY (created_by) 
          REFERENCES polox.users(id) 
          ON DELETE SET NULL,
        
        -- Constraints
        CONSTRAINT chk_financial_categories_type 
          CHECK (type IN ('income', 'expense', 'both')),
        
        -- Unicidade: nome único por empresa
        CONSTRAINT uq_financial_categories_name_company 
          UNIQUE (company_id, name, deleted_at)
      );
    `);
    console.log('✅ Tabela financial_categories criada');

    // 2. Criar índices para performance
    console.log('📌 Criando índices...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_financial_categories_company_id 
      ON polox.financial_categories(company_id) 
      WHERE deleted_at IS NULL;
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_financial_categories_type 
      ON polox.financial_categories(type) 
      WHERE deleted_at IS NULL;
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_financial_categories_parent_id 
      ON polox.financial_categories(parent_id) 
      WHERE deleted_at IS NULL;
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_financial_categories_is_active 
      ON polox.financial_categories(is_active) 
      WHERE deleted_at IS NULL;
    `);
    console.log('✅ Índices criados');

    // 3. Criar trigger para updated_at
    console.log('⚡ Criando trigger para updated_at...');
    await client.query(`
      CREATE TRIGGER trg_financial_categories_updated_at
      BEFORE UPDATE ON polox.financial_categories
      FOR EACH ROW
      EXECUTE FUNCTION polox.update_updated_at_column();
    `);
    console.log('✅ Trigger criado');

    // 4. Adicionar comentários
    console.log('📝 Adicionando comentários...');
    await client.query(`
      COMMENT ON TABLE polox.financial_categories IS 
      'Categorias para organização de transações financeiras (receitas e despesas)';
    `);
    await client.query(`
      COMMENT ON COLUMN polox.financial_categories.id IS 
      'ID único da categoria (UUID)';
    `);
    await client.query(`
      COMMENT ON COLUMN polox.financial_categories.company_id IS 
      'ID da empresa proprietária (multi-tenant)';
    `);
    await client.query(`
      COMMENT ON COLUMN polox.financial_categories.name IS 
      'Nome da categoria (ex: Vendas, Aluguel, Marketing)';
    `);
    await client.query(`
      COMMENT ON COLUMN polox.financial_categories.type IS 
      'Tipo de transações aceitas: income (receita), expense (despesa), both (ambos)';
    `);
    await client.query(`
      COMMENT ON COLUMN polox.financial_categories.parent_id IS 
      'ID da categoria pai para hierarquia/subcategorias';
    `);
    await client.query(`
      COMMENT ON COLUMN polox.financial_categories.is_active IS 
      'Indica se a categoria está ativa e disponível para uso';
    `);
    console.log('✅ Comentários adicionados');

    // 5. Inserir categorias padrão
    console.log('📦 Inserindo categorias padrão...');
    
    // Buscar todas as empresas
    const companies = await client.query(`
      SELECT id FROM polox.companies WHERE deleted_at IS NULL
    `);
    
    console.log(`  📊 Encontradas ${companies.rows.length} empresas`);
    
    const defaultCategories = [
      // Categorias de Receita
      { name: 'Vendas de Produtos', type: 'income', description: 'Receitas provenientes da venda de produtos' },
      { name: 'Prestação de Serviços', type: 'income', description: 'Receitas de serviços prestados' },
      { name: 'Comissões', type: 'income', description: 'Receitas de comissões' },
      { name: 'Juros Recebidos', type: 'income', description: 'Receitas de juros bancários' },
      { name: 'Outras Receitas', type: 'income', description: 'Outras receitas diversas' },
      
      // Categorias de Despesa
      { name: 'Aluguel', type: 'expense', description: 'Despesas com aluguel de imóveis' },
      { name: 'Salários e Encargos', type: 'expense', description: 'Despesas com folha de pagamento' },
      { name: 'Fornecedores', type: 'expense', description: 'Pagamentos a fornecedores' },
      { name: 'Marketing e Publicidade', type: 'expense', description: 'Despesas com marketing e publicidade' },
      { name: 'Água, Luz e Telefone', type: 'expense', description: 'Despesas com serviços públicos' },
      { name: 'Impostos e Taxas', type: 'expense', description: 'Pagamento de impostos e taxas' },
      { name: 'Manutenção', type: 'expense', description: 'Despesas com manutenção' },
      { name: 'Material de Escritório', type: 'expense', description: 'Compra de material de escritório' },
      { name: 'Outras Despesas', type: 'expense', description: 'Outras despesas diversas' },
      
      // Categorias Mistas
      { name: 'Ajustes de Caixa', type: 'both', description: 'Ajustes e correções de valores' },
      { name: 'Transferências', type: 'both', description: 'Transferências entre contas' }
    ];
    
    let insertedCount = 0;
    for (const company of companies.rows) {
      for (const category of defaultCategories) {
        try {
          await client.query(`
            INSERT INTO polox.financial_categories (company_id, name, description, type, is_active)
            VALUES ($1, $2, $3, $4, TRUE)
            ON CONFLICT (company_id, name, deleted_at) DO NOTHING
          `, [company.id, category.name, category.description, category.type]);
          insertedCount++;
        } catch (error) {
          console.log(`  ⚠️  Erro ao inserir categoria ${category.name} para empresa ${company.id}: ${error.message}`);
        }
      }
    }
    
    console.log(`  ✅ ${insertedCount} categorias padrão inseridas`);

    // 6. Adicionar foreign key na tabela financial_transactions (se existir)
    console.log('🔗 Adicionando foreign key em financial_transactions...');
    const transactionsTableExists = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'polox' 
        AND table_name = 'financial_transactions'
    `);

    if (transactionsTableExists.rows.length > 0) {
      // Verificar se coluna category_id existe
      const categoryIdExists = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'polox' 
          AND table_name = 'financial_transactions' 
          AND column_name = 'category_id'
      `);

      if (categoryIdExists.rows.length === 0) {
        // Adicionar coluna category_id
        await client.query(`
          ALTER TABLE polox.financial_transactions 
          ADD COLUMN category_id UUID;
        `);
        console.log('  ✅ Coluna category_id adicionada');
      }

      // Remover constraint antiga se existir
      await client.query(`
        ALTER TABLE polox.financial_transactions 
        DROP CONSTRAINT IF EXISTS fk_financial_transactions_category;
      `);

      // Adicionar foreign key
      await client.query(`
        ALTER TABLE polox.financial_transactions 
        ADD CONSTRAINT fk_financial_transactions_category 
        FOREIGN KEY (category_id) 
        REFERENCES polox.financial_categories(id) 
        ON DELETE SET NULL;
      `);
      console.log('  ✅ Foreign key adicionada');

      // Criar índice
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_financial_transactions_category_id 
        ON polox.financial_transactions(category_id);
      `);
      console.log('  ✅ Índice criado');
    } else {
      console.log('  ℹ️  Tabela financial_transactions não existe, pulando foreign key');
    }

    console.log('✅ Migration 047 concluída com sucesso!');
    console.log('');
    console.log('📋 Resumo das alterações:');
    console.log('  - Tabela financial_categories criada');
    console.log('  - Suporte a hierarquia (parent_id)');
    console.log('  - Tipos: income, expense, both');
    console.log('  - Multi-tenant por empresa');
    console.log(`  - ${insertedCount} categorias padrão inseridas`);
    console.log('  - Foreign key adicionada em financial_transactions');

  } catch (error) {
    console.error('❌ Erro na migration 047:', error.message);
    throw error;
  }
}

/**
 * Reverte as alterações (DOWN)
 */
async function down(client) {
  console.log('🔄 Revertendo migration 047: Criar tabela financial_categories...');

  try {
    // 1. Remover foreign key de financial_transactions
    console.log('🔗 Removendo foreign key de financial_transactions...');
    await client.query(`
      ALTER TABLE polox.financial_transactions 
      DROP CONSTRAINT IF EXISTS fk_financial_transactions_category;
    `);
    await client.query(`
      ALTER TABLE polox.financial_transactions 
      DROP COLUMN IF EXISTS category_id;
    `);
    console.log('✅ Foreign key removida');

    // 2. Remover tabela financial_categories
    console.log('🗑️  Removendo tabela financial_categories...');
    await client.query(`DROP TABLE IF EXISTS polox.financial_categories CASCADE;`);
    console.log('✅ Tabela financial_categories removida');

    console.log('✅ Migration 047 revertida com sucesso');

  } catch (error) {
    console.error('❌ Erro ao reverter migration 047:', error.message);
    throw error;
  }
}

module.exports = { up, down };
