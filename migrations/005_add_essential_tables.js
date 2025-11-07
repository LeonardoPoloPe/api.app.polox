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
 * Migration: 005_add_essential_tables
 * Descrição: Adiciona tabelas essenciais que ainda não existem
 * Data: 2025-10-21
 */

const up = async (client) => {
  console.log('🚀 Adicionando tabelas essenciais...');

  try {
    // Criar tabela de leads se não existir
    console.log('📊 Criando tabela de leads...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS polox.leads (
          id BIGSERIAL PRIMARY KEY,
          company_id BIGINT NOT NULL,
          user_id BIGINT,
          name VARCHAR(255) NOT NULL,
          email VARCHAR(255),
          phone VARCHAR(20),
          status VARCHAR(50) NOT NULL DEFAULT 'novo',
          source VARCHAR(100),
          score INTEGER DEFAULT 0,
          notes TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          deleted_at TIMESTAMP WITH TIME ZONE NULL
      );
    `);

    // Criar tabela de clientes se não existir
    console.log('👥 Criando tabela de clientes...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS polox.clients (
          id BIGSERIAL PRIMARY KEY,
          company_id BIGINT NOT NULL,
          user_id BIGINT,
          name VARCHAR(255) NOT NULL,
          email VARCHAR(255),
          phone VARCHAR(20),
          status VARCHAR(50) NOT NULL DEFAULT 'ativo',
          notes TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          deleted_at TIMESTAMP WITH TIME ZONE NULL
      );
    `);

    // Criar tabela de vendas se não existir
    console.log('💰 Criando tabela de vendas...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS polox.sales (
          id BIGSERIAL PRIMARY KEY,
          company_id BIGINT NOT NULL,
          client_id BIGINT,
          user_id BIGINT,
          sale_number VARCHAR(50) NOT NULL,
          total_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
          status VARCHAR(50) NOT NULL DEFAULT 'rascunho',
          sale_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          deleted_at TIMESTAMP WITH TIME ZONE NULL
      );
    `);

    // Criar tabela de produtos se não existir
    console.log('📦 Criando tabela de produtos...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS polox.products (
          id BIGSERIAL PRIMARY KEY,
          company_id BIGINT NOT NULL,
          name VARCHAR(255) NOT NULL,
          description TEXT,
          sale_price DECIMAL(15,2) DEFAULT 0,
          is_active BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          deleted_at TIMESTAMP WITH TIME ZONE NULL
      );
    `);

    // Criar tabela de tickets se não existir
    console.log('🎫 Criando tabela de tickets...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS polox.tickets (
          id BIGSERIAL PRIMARY KEY,
          company_id BIGINT NOT NULL,
          client_id BIGINT,
          assigned_user_id BIGINT,
          number VARCHAR(50) NOT NULL,
          title VARCHAR(255) NOT NULL,
          description TEXT,
          status VARCHAR(50) DEFAULT 'open',
          priority VARCHAR(20) DEFAULT 'medium',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          deleted_at TIMESTAMP WITH TIME ZONE NULL
      );
    `);

    // Criar tabela de notificações se não existir
    console.log('🔔 Criando tabela de notificações...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS polox.notifications (
          id BIGSERIAL PRIMARY KEY,
          company_id BIGINT NOT NULL,
          user_id BIGINT,
          number VARCHAR(50) NOT NULL,
          type VARCHAR(100) NOT NULL,
          title VARCHAR(255) NOT NULL,
          message TEXT NOT NULL,
          status VARCHAR(50) DEFAULT 'pending',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // Criar tabela de tags se não existir
    console.log('🏷️ Criando tabela de tags...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS polox.tags (
          id BIGSERIAL PRIMARY KEY,
          company_id BIGINT NOT NULL,
          name VARCHAR(255) NOT NULL,
          slug VARCHAR(255) NOT NULL,
          color VARCHAR(7) DEFAULT '#3498db',
          is_active BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          deleted_at TIMESTAMP WITH TIME ZONE NULL
      );
    `);

    // Criar tabela de arquivos se não existir
    console.log('📎 Criando tabela de arquivos...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS polox.file_uploads (
          id BIGSERIAL PRIMARY KEY,
          company_id BIGINT NOT NULL,
          uploaded_by BIGINT,
          number VARCHAR(50) NOT NULL,
          original_name VARCHAR(255) NOT NULL,
          file_path VARCHAR(500) NOT NULL,
          file_size BIGINT NOT NULL,
          mime_type VARCHAR(100) NOT NULL,
          is_public BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          deleted_at TIMESTAMP WITH TIME ZONE NULL
      );
    `);

    // Criar tabela de audit logs se não existir
    console.log('📝 Criando tabela de audit logs...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS polox.audit_logs (
          id BIGSERIAL PRIMARY KEY,
          company_id BIGINT NOT NULL,
          user_id BIGINT,
          action VARCHAR(50) NOT NULL,
          entity_type VARCHAR(100) NOT NULL,
          entity_id VARCHAR(100) NOT NULL,
          description TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    console.log('✅ Tabelas essenciais criadas com sucesso!');

    // Verificar quantas tabelas existem agora
    const result = await client.query(`
      SELECT COUNT(*) as count
      FROM information_schema.tables 
      WHERE table_schema = 'polox'
    `);

    console.log(`📊 Total de tabelas no schema polox: ${result.rows[0].count}`);

  } catch (error) {
    console.error('❌ Erro na migração:', error.message);
    throw error;
  }
};

const down = async (client) => {
  console.log('⚠️  Rollback não implementado para esta migração');
};

module.exports = { up, down };