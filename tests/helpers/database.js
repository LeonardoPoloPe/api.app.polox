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
 * ==========================================
 * 🔧 DATABASE HELPER - Utilitários para Testes
 * ==========================================
 * 
 * Funções auxiliares para criar dados de teste no banco.
 * Facilita a criação de companies, users, leads, clients, products, etc.
 */

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

class DatabaseHelper {
  constructor(pool) {
    this.pool = pool || global.testPool;
  }

  // ==========================================
  // COMPANY
  // ==========================================

  /**
   * Criar empresa de teste
   */
  async createTestCompany(data = {}) {
    const timestamp = Date.now();
    const slug = data.slug || `empresa-teste-${timestamp}`;
    
    const query = `
      INSERT INTO polox.companies (
        company_name, slug, company_domain, admin_email, admin_phone, status
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;

    const values = [
      data.company_name || `Empresa Teste ${timestamp}`,
      slug,
      data.company_domain || `teste${timestamp}.com`,
      data.admin_email || `admin${timestamp}@teste.com`,
      data.admin_phone || '(11) 99999-9999',
      data.status || 'active'
    ];

    const result = await this.pool.query(query, values);
    return result.rows[0];
  }

  // ==========================================
  // USER
  // ==========================================

  /**
   * Criar usuário de teste
   */
  async createTestUser(companyId, data = {}) {
    const hashedPassword = await bcrypt.hash(
      data.password || 'Test@123',
      12
    );

    const query = `
      INSERT INTO polox.users (
        company_id, full_name, email, password_hash, user_role, status
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;

    const values = [
      companyId,
      data.full_name || 'Test User',
      data.email || `test${Date.now()}@test.com`,
      hashedPassword,
      data.user_role || 'viewer',
      data.status || 'active',
    ];

    const result = await this.pool.query(query, values);
    const user = result.rows[0];

    // Remover password_hash da resposta
    delete user.password_hash;

    return user;
  }

  /**
   * Criar usuário admin de teste
   */
  async createTestAdmin(companyId, data = {}) {
    return this.createTestUser(companyId, {
      ...data,
      user_role: 'admin',
    });
  }

  /**
   * Criar usuário super_admin de teste
   */
  async createTestSuperAdmin(companyId, data = {}) {
    return this.createTestUser(companyId, {
      ...data,
      user_role: 'super_admin',
    });
  }

  // ==========================================
  // CLIENT
  // ==========================================

  /**
   * Criar cliente de teste
   */
  async createTestClient(companyId, data = {}) {
    const query = `
      INSERT INTO polox.clients (
        company_id, client_name, email, phone, status
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;

    const values = [
      companyId,
      data.name || data.client_name || 'Test Client',
      data.email || `client${Date.now()}@test.com`,
      data.phone || '11888888888',
      data.status || 'ativo',
    ];

    const result = await this.pool.query(query, values);
    return result.rows[0];
  }

  // ==========================================
  // LEAD
  // ==========================================

  /**
   * Criar lead de teste
   */
  async createTestLead(companyId, data = {}) {
    const query = `
      INSERT INTO polox.leads (
        company_id, lead_name, email, phone, company_name, status, created_by_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;

    const values = [
      companyId,
      data.name || data.lead_name || 'Test Lead',
      data.email || `lead${Date.now()}@test.com`,
      data.phone || '11777777777',
      data.company_name || 'Lead Company',
      data.status || 'new',
      data.created_by_id || null,
    ];

    const result = await this.pool.query(query, values);
    return result.rows[0];
  }

  // ==========================================
  // PRODUCT
  // ==========================================

  /**
   * Criar produto de teste
   */
  async createTestProduct(companyId, data = {}) {
    const query = `
      INSERT INTO polox.products (
        company_id, product_name, description, sale_price, status
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;

    const values = [
      companyId,
      data.name || data.product_name || 'Test Product',
      data.description || 'Test Description',
      data.price || data.sale_price || '100.00',
      data.status || 'active',
    ];

    const result = await this.pool.query(query, values);
    return result.rows[0];
  }

  // ==========================================
  // SALE
  // ==========================================

  /**
   * Criar venda de teste
   */
  async createTestSale(companyId, clientId, data = {}) {
    const query = `
      INSERT INTO polox.sales (
        company_id, client_id, total_amount, net_amount, status, sale_date
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;

    const totalAmount = data.total || data.total_amount || '100.00';
    const netAmount = data.net_amount || totalAmount;

    const values = [
      companyId,
      clientId,
      totalAmount,
      netAmount,
      data.status || 'pending',
      data.sale_date || new Date(),
    ];

    const result = await this.pool.query(query, values);
    return result.rows[0];
  }

  // ==========================================
  // JWT TOKEN
  // ==========================================

  /**
   * Gerar JWT de teste para usuário
   */
  generateTestToken(user) {
    return jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.user_role,
        companyId: user.company_id,
      },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
  }

  // ==========================================
  // LIMPEZA
  // ==========================================

  /**
   * Limpar todas as tabelas
   */
  async cleanDatabase() {
    if (process.env.NODE_ENV !== 'test') {
      throw new Error('cleanDatabase só pode ser usado em testes');
    }

    const tables = [
      'lead_notes',
      'lead_tags',
      'lead_interests',
      'leads',
      'client_notes',
      'clients',
      'sale_items',
      'sales',
      'products',
      'tickets',
      'financial_transactions',
      'gamification_history',
      'events',
      'notifications',
      'custom_field_values',
      'custom_fields',
      'tags',
      'interests',
      'users',
      'companies',
    ];

    for (const table of tables) {
      try {
        await this.pool.query(`TRUNCATE TABLE polox.${table} CASCADE`);
      } catch (error) {
        // Ignorar se tabela não existir
        if (!error.message.includes('does not exist')) {
          throw error;
        }
      }
    }
  }

  /**
   * Limpar apenas tabelas essenciais
   */
  async cleanEssentialTables() {
    if (process.env.NODE_ENV !== 'test') {
      throw new Error('cleanEssentialTables só pode ser usado em testes');
    }

    try {
      await this.pool.query('TRUNCATE TABLE polox.users CASCADE');
      await this.pool.query('TRUNCATE TABLE polox.companies CASCADE');
    } catch (error) {
      if (!error.message.includes('does not exist')) {
        throw error;
      }
    }
  }

  // ==========================================
  // UTILITÁRIOS
  // ==========================================

  /**
   * Gerar CNPJ fake para testes
   */
  generateCNPJ() {
    const random = () => Math.floor(Math.random() * 10);
    return `${random()}${random()}.${random()}${random()}${random()}.${random()}${random()}${random()}/${random()}${random()}${random()}${random()}-${random()}${random()}`;
  }

  /**
   * Gerar CPF fake para testes
   */
  generateCPF() {
    const random = () => Math.floor(Math.random() * 10);
    return `${random()}${random()}${random()}.${random()}${random()}${random()}.${random()}${random()}${random()}-${random()}${random()}`;
  }

  /**
   * Aguardar tempo (útil para testes assíncronos)
   */
  async wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Exportar instância singleton
const dbHelper = new DatabaseHelper(global.testPool);

module.exports = dbHelper;
module.exports.DatabaseHelper = DatabaseHelper;
