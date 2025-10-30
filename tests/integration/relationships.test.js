/**
 * ==========================================
 * 🧪 TESTES DE RELACIONAMENTOS
 * ==========================================
 * 
 * Testa relacionamentos entre entidades:
 * - Company <-> Users
 * - Company <-> Leads
 * - Company <-> Clients
 * - Company <-> Products
 * - Integridade referencial
 * - Cascata de deleção
 */

const { DatabaseHelper } = require('../helpers/database');

describe('🔗 Relacionamentos entre Entidades', () => {
  let helper;

  beforeAll(() => {
    helper = new DatabaseHelper(global.testPool);
  });

  describe('Company <-> Users', () => {
    it('deve criar múltiplos usuários na mesma empresa', async () => {
      const company = await helper.createTestCompany({
        company_name: 'Company with Multiple Users'
      });

      const user1 = await helper.createTestUser(company.id, {
        email: 'user1@company.com',
        full_name: 'User 1'
      });

      const user2 = await helper.createTestUser(company.id, {
        email: 'user2@company.com',
        full_name: 'User 2'
      });

      const user3 = await helper.createTestUser(company.id, {
        email: 'user3@company.com',
        full_name: 'User 3'
      });

      expect(user1.company_id).toBe(company.id);
      expect(user2.company_id).toBe(company.id);
      expect(user3.company_id).toBe(company.id);

      // Verificar que todos foram criados
      const result = await global.testPool.query(`
        SELECT COUNT(*) as total FROM polox.users 
        WHERE company_id = $1 AND deleted_at IS NULL
      `, [company.id]);

      expect(parseInt(result.rows[0].total)).toBeGreaterThanOrEqual(3);
    });

    it('deve buscar usuários de uma empresa', async () => {
      const company = await helper.createTestCompany({
        company_name: 'Company for User Search'
      });

      await helper.createTestUser(company.id, {
        email: 'search1@company.com'
      });
      await helper.createTestUser(company.id, {
        email: 'search2@company.com'
      });

      const result = await global.testPool.query(`
        SELECT u.*, c.company_name
        FROM polox.users u
        INNER JOIN polox.companies c ON c.id = u.company_id
        WHERE u.company_id = $1 
        AND u.deleted_at IS NULL
        ORDER BY u.created_at DESC
      `, [company.id]);

      expect(result.rows.length).toBeGreaterThanOrEqual(2);
      result.rows.forEach(user => {
        expect(user.company_id).toBe(company.id);
        expect(user.company_name).toBe(company.company_name);
      });
    });

    it('deve respeitar diferentes roles na mesma empresa', async () => {
      const company = await helper.createTestCompany();

      const admin = await helper.createTestUser(company.id, {
        email: 'admin@roles.com',
        user_role: 'admin'
      });

      const user = await helper.createTestUser(company.id, {
        email: 'user@roles.com',
        user_role: 'user'
      });

      const viewer = await helper.createTestUser(company.id, {
        email: 'viewer@roles.com',
        user_role: 'viewer'
      });

      expect(admin.user_role).toBe('admin');
      expect(user.user_role).toBe('user');
      expect(viewer.user_role).toBe('viewer');

      // Todos na mesma empresa
      expect(admin.company_id).toBe(company.id);
      expect(user.company_id).toBe(company.id);
      expect(viewer.company_id).toBe(company.id);
    });
  });

  describe('Company <-> Leads', () => {
    it('deve criar múltiplos leads na mesma empresa', async () => {
      const company = await helper.createTestCompany({
        company_name: 'Company with Leads'
      });

      const leads = [];
      for (let i = 0; i < 5; i++) {
        const lead = await helper.createTestLead(company.id, {
          name: `Lead ${i}`,
          email: `lead${i}@test.com`
        });
        leads.push(lead);
      }

      expect(leads.length).toBe(5);
      leads.forEach(lead => {
        expect(lead.company_id).toBe(company.id);
      });

      // Verificar no banco
      const result = await global.testPool.query(`
        SELECT COUNT(*) as total FROM polox.leads 
        WHERE company_id = $1 AND deleted_at IS NULL
      `, [company.id]);

      expect(parseInt(result.rows[0].total)).toBeGreaterThanOrEqual(5);
    });

    it('deve buscar leads com informações da empresa', async () => {
      const company = await helper.createTestCompany({
        company_name: 'Company for Lead Search'
      });

      const lead = await helper.createTestLead(company.id, {
        name: 'Test Lead',
        email: 'lead@search.com'
      });

      const result = await global.testPool.query(`
        SELECT l.*, c.company_name
        FROM polox.leads l
        INNER JOIN polox.companies c ON c.id = l.company_id
        WHERE l.id = $1 AND l.deleted_at IS NULL
      `, [lead.id]);

      expect(result.rows.length).toBe(1);
      expect(result.rows[0].company_name).toBe(company.company_name);
      expect(result.rows[0].lead_name).toBe('Test Lead');
    });

    it('deve permitir lead atribuído a usuário', async () => {
      const company = await helper.createTestCompany();
      const user = await helper.createTestUser(company.id);

      const lead = await helper.createTestLead(company.id, {
        name: 'Assigned Lead',
        email: 'assigned@lead.com',
        created_by_id: user.id
      });

      expect(lead.created_by_id).toBe(user.id);

      // Verificar relacionamento
      const result = await global.testPool.query(`
        SELECT l.*, u.full_name as created_by_name
        FROM polox.leads l
        LEFT JOIN polox.users u ON u.id = l.created_by_id
        WHERE l.id = $1
      `, [lead.id]);

      expect(result.rows[0].created_by_name).toBe(user.full_name);
    });
  });

  describe('Company <-> Clients', () => {
    it('deve criar múltiplos clientes na mesma empresa', async () => {
      const company = await helper.createTestCompany({
        company_name: 'Company with Clients'
      });

      const client1 = await helper.createTestClient(company.id, {
        name: 'Client 1',
        email: 'client1@test.com'
      });

      const client2 = await helper.createTestClient(company.id, {
        name: 'Client 2',
        email: 'client2@test.com'
      });

      expect(client1.company_id).toBe(company.id);
      expect(client2.company_id).toBe(company.id);

      // Verificar no banco
      const result = await global.testPool.query(`
        SELECT COUNT(*) as total FROM polox.clients 
        WHERE company_id = $1 AND deleted_at IS NULL
      `, [company.id]);

      expect(parseInt(result.rows[0].total)).toBeGreaterThanOrEqual(2);
    });

    it('deve buscar clientes com informações da empresa', async () => {
      const company = await helper.createTestCompany();
      const client = await helper.createTestClient(company.id, {
        name: 'Search Client',
        email: 'search@client.com'
      });

      const result = await global.testPool.query(`
        SELECT cl.*, co.company_name
        FROM polox.clients cl
        INNER JOIN polox.companies co ON co.id = cl.company_id
        WHERE cl.id = $1
      `, [client.id]);

      expect(result.rows[0].company_name).toBe(company.company_name);
      expect(result.rows[0].client_name).toBeDefined();
    });
  });

  describe('Company <-> Products', () => {
    it('deve criar produtos para uma empresa', async () => {
      const company = await helper.createTestCompany({
        company_name: 'Company with Products'
      });

      const product1 = await helper.createTestProduct(company.id, {
        name: 'Product 1',
        price: '100.00'
      });

      const product2 = await helper.createTestProduct(company.id, {
        name: 'Product 2',
        price: '200.00'
      });

      expect(product1.company_id).toBe(company.id);
      expect(product2.company_id).toBe(company.id);
    });

    it('deve buscar produtos da empresa', async () => {
      const company = await helper.createTestCompany();
      
      await helper.createTestProduct(company.id, {
        name: 'Product Search 1'
      });
      await helper.createTestProduct(company.id, {
        name: 'Product Search 2'
      });

      const result = await global.testPool.query(`
        SELECT * FROM polox.products 
        WHERE company_id = $1 AND deleted_at IS NULL
        ORDER BY product_name
      `, [company.id]);

      expect(result.rows.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Relacionamentos Complexos', () => {
    it('deve criar venda com cliente e produtos', async () => {
      const company = await helper.createTestCompany();
      const client = await helper.createTestClient(company.id);
      const product = await helper.createTestProduct(company.id, {
        price: '150.00'
      });

      const sale = await helper.createTestSale(company.id, client.id, {
        total: '150.00'
      });

      expect(sale.company_id).toBe(company.id);
      expect(sale.client_id).toBe(client.id);

      // Verificar JOIN complexo
      const result = await global.testPool.query(`
        SELECT 
          s.id as sale_id,
          s.total_amount,
          c.client_name,
          co.company_name
        FROM polox.sales s
        INNER JOIN polox.clients c ON c.id = s.client_id
        INNER JOIN polox.companies co ON co.id = s.company_id
        WHERE s.id = $1
      `, [sale.id]);

      expect(result.rows[0].client_name).toBe(client.client_name);
      expect(result.rows[0].company_name).toBe(company.company_name);
    });

    it('deve buscar todas as entidades de uma empresa', async () => {
      const company = await helper.createTestCompany({
        company_name: 'Full Company Test'
      });

      // Criar entidades
      await helper.createTestUser(company.id);
      await helper.createTestLead(company.id);
      await helper.createTestClient(company.id);
      await helper.createTestProduct(company.id);

      // Buscar estatísticas
      const result = await global.testPool.query(`
        SELECT 
          (SELECT COUNT(*) FROM polox.users WHERE company_id = $1 AND deleted_at IS NULL) as users,
          (SELECT COUNT(*) FROM polox.leads WHERE company_id = $1 AND deleted_at IS NULL) as leads,
          (SELECT COUNT(*) FROM polox.clients WHERE company_id = $1 AND deleted_at IS NULL) as clients,
          (SELECT COUNT(*) FROM polox.products WHERE company_id = $1 AND deleted_at IS NULL) as products
      `, [company.id]);

      const stats = result.rows[0];
      expect(parseInt(stats.users)).toBeGreaterThanOrEqual(1);
      expect(parseInt(stats.leads)).toBeGreaterThanOrEqual(1);
      expect(parseInt(stats.clients)).toBeGreaterThanOrEqual(1);
      expect(parseInt(stats.products)).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Integridade Referencial', () => {
    it('não deve permitir criar usuário com company_id inválido', async () => {
      await expect(
        helper.createTestUser(99999999, {
          email: 'invalid@test.com'
        })
      ).rejects.toThrow();
    });

    it('não deve permitir criar lead com company_id inválido', async () => {
      await expect(
        helper.createTestLead(99999999, {
          email: 'invalid@test.com'
        })
      ).rejects.toThrow();
    });

    it('não deve permitir criar client com company_id inválido', async () => {
      await expect(
        helper.createTestClient(99999999, {
          email: 'invalid@test.com'
        })
      ).rejects.toThrow();
    });
  });

  describe('Isolamento entre Empresas', () => {
    it('usuários de empresas diferentes devem ser isolados', async () => {
      const company1 = await helper.createTestCompany({
        company_name: 'Company 1'
      });
      const company2 = await helper.createTestCompany({
        company_name: 'Company 2'
      });

      await helper.createTestUser(company1.id, {
        email: 'user@company1.com'
      });
      await helper.createTestUser(company2.id, {
        email: 'user@company2.com'
      });

      // Buscar usuários de cada empresa
      const result1 = await global.testPool.query(`
        SELECT * FROM polox.users 
        WHERE company_id = $1 AND deleted_at IS NULL
      `, [company1.id]);

      const result2 = await global.testPool.query(`
        SELECT * FROM polox.users 
        WHERE company_id = $1 AND deleted_at IS NULL
      `, [company2.id]);

      // Verificar que não há overlap
      const ids1 = result1.rows.map(r => r.id);
      const ids2 = result2.rows.map(r => r.id);
      const overlap = ids1.filter(id => ids2.includes(id));

      expect(overlap.length).toBe(0);
    });

    it('leads de empresas diferentes devem ser isolados', async () => {
      const company1 = await helper.createTestCompany();
      const company2 = await helper.createTestCompany();

      const lead1 = await helper.createTestLead(company1.id, {
        email: 'lead@company1.com'
      });
      const lead2 = await helper.createTestLead(company2.id, {
        email: 'lead@company2.com'
      });

      expect(lead1.company_id).toBe(company1.id);
      expect(lead2.company_id).toBe(company2.id);
      expect(lead1.company_id).not.toBe(lead2.company_id);
    });

    it('produtos de empresas diferentes devem ser isolados', async () => {
      const company1 = await helper.createTestCompany();
      const company2 = await helper.createTestCompany();

      const product1 = await helper.createTestProduct(company1.id, {
        name: 'Product Company 1'
      });
      const product2 = await helper.createTestProduct(company2.id, {
        name: 'Product Company 2'
      });

      // Buscar produtos de cada empresa
      const result1 = await global.testPool.query(`
        SELECT * FROM polox.products WHERE company_id = $1
      `, [company1.id]);

      const result2 = await global.testPool.query(`
        SELECT * FROM polox.products WHERE company_id = $1
      `, [company2.id]);

      const ids1 = result1.rows.map(r => r.id);
      const ids2 = result2.rows.map(r => r.id);
      
      expect(ids1).toContain(product1.id);
      expect(ids2).toContain(product2.id);
      expect(ids1).not.toContain(product2.id);
      expect(ids2).not.toContain(product1.id);
    });
  });

  describe('Agregações e Estatísticas', () => {
    it('deve contar corretamente usuários por empresa', async () => {
      const company = await helper.createTestCompany();

      // Criar 5 usuários
      for (let i = 0; i < 5; i++) {
        await helper.createTestUser(company.id, {
          email: `user${i}@count.com`
        });
      }

      const result = await global.testPool.query(`
        SELECT COUNT(*) as total FROM polox.users 
        WHERE company_id = $1 AND deleted_at IS NULL
      `, [company.id]);

      expect(parseInt(result.rows[0].total)).toBeGreaterThanOrEqual(5);
    });

    it('deve agrupar leads por status', async () => {
      const company = await helper.createTestCompany();

      await helper.createTestLead(company.id, { status: 'new' });
      await helper.createTestLead(company.id, { status: 'new' });
      await helper.createTestLead(company.id, { status: 'qualified' });

      const result = await global.testPool.query(`
        SELECT status, COUNT(*) as total 
        FROM polox.leads 
        WHERE company_id = $1 AND deleted_at IS NULL
        GROUP BY status
        ORDER BY status
      `, [company.id]);

      expect(result.rows.length).toBeGreaterThanOrEqual(2);
      
      const newLeads = result.rows.find(r => r.status === 'new');
      if (newLeads) {
        expect(parseInt(newLeads.total)).toBeGreaterThanOrEqual(2);
      }
    });
  });
});
