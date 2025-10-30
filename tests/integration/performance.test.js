/**
 * ==========================================
 * 🧪 TESTES DE PERFORMANCE E CARGA
 * ==========================================
 * 
 * Testa performance e capacidade do sistema:
 * - Criação em massa
 * - Consultas complexas
 * - Tempo de resposta
 * - Concorrência
 */

const { DatabaseHelper } = require('../helpers/database');

describe('⚡ Performance e Carga', () => {
  let helper;

  beforeAll(() => {
    helper = new DatabaseHelper(global.testPool);
  });

  describe('Criação em Massa', () => {
    it('deve criar 10 empresas rapidamente', async () => {
      const startTime = Date.now();
      const companies = [];

      for (let i = 0; i < 10; i++) {
        const company = await helper.createTestCompany({
          company_name: `Bulk Company ${Date.now()}-${i}`,
          company_domain: `bulk-${Date.now()}-${i}`
        });
        companies.push(company);
        await helper.wait(10); // Pequena pausa para evitar conflitos
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(companies.length).toBe(10);
      expect(duration).toBeLessThan(10000); // Menos de 10 segundos
      
      console.log(`✅ Criou 10 empresas em ${duration}ms`);
    });

    it('deve criar 20 usuários em empresas diferentes', async () => {
      const startTime = Date.now();
      const users = [];

      // Criar 5 empresas
      const companies = [];
      for (let i = 0; i < 5; i++) {
        const company = await helper.createTestCompany({
          company_name: `Company for Users ${Date.now()}-${i}`
        });
        companies.push(company);
        await helper.wait(10);
      }

      // Criar 4 usuários por empresa
      for (const company of companies) {
        for (let j = 0; j < 4; j++) {
          const user = await helper.createTestUser(company.id, {
            email: `user-${Date.now()}-${j}@company${company.id}.com`,
            full_name: `User ${j} Company ${company.id}`
          });
          users.push(user);
        }
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(users.length).toBe(20);
      expect(duration).toBeLessThan(15000); // Menos de 15 segundos
      
      console.log(`✅ Criou 20 usuários em 5 empresas em ${duration}ms`);
    });

    it('deve criar 50 leads rapidamente', async () => {
      const company = await helper.createTestCompany({
        company_name: 'Company for Leads Performance Test'
      });

      const startTime = Date.now();
      const leads = [];

      for (let i = 0; i < 50; i++) {
        const lead = await helper.createTestLead(company.id, {
          name: `Lead ${i}`,
          email: `lead${Date.now()}-${i}@test.com`,
          phone: `119${String(i).padStart(8, '0')}`
        });
        leads.push(lead);
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(leads.length).toBe(50);
      expect(duration).toBeLessThan(15000); // Menos de 15 segundos
      
      console.log(`✅ Criou 50 leads em ${duration}ms`);
    });
  });

  describe('Consultas de Performance', () => {
    it('deve buscar empresas por ID rapidamente', async () => {
      const company = await helper.createTestCompany();

      const startTime = Date.now();
      
      const result = await global.testPool.query(`
        SELECT * FROM polox.companies 
        WHERE id = $1 AND deleted_at IS NULL
      `, [company.id]);

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(result.rows.length).toBe(1);
      expect(duration).toBeLessThan(100); // Menos de 100ms
      
      console.log(`✅ Busca por ID em ${duration}ms`);
    });

    it('deve contar registros rapidamente', async () => {
      const startTime = Date.now();
      
      const result = await global.testPool.query(`
        SELECT 
          (SELECT COUNT(*) FROM polox.companies WHERE deleted_at IS NULL) as companies,
          (SELECT COUNT(*) FROM polox.users WHERE deleted_at IS NULL) as users,
          (SELECT COUNT(*) FROM polox.leads WHERE deleted_at IS NULL) as leads
      `);

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(result.rows[0]).toBeDefined();
      expect(duration).toBeLessThan(500); // Menos de 500ms
      
      console.log(`✅ Contagem de múltiplas tabelas em ${duration}ms`);
      console.log(`   Companies: ${result.rows[0].companies}`);
      console.log(`   Users: ${result.rows[0].users}`);
      console.log(`   Leads: ${result.rows[0].leads}`);
    });

    it('deve fazer JOIN de companies e users rapidamente', async () => {
      const company = await helper.createTestCompany();
      await helper.createTestUser(company.id);

      const startTime = Date.now();
      
      const result = await global.testPool.query(`
        SELECT 
          c.id as company_id,
          c.company_name,
          u.id as user_id,
          u.full_name,
          u.email
        FROM polox.companies c
        INNER JOIN polox.users u ON u.company_id = c.id
        WHERE c.id = $1 
        AND c.deleted_at IS NULL 
        AND u.deleted_at IS NULL
      `, [company.id]);

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(result.rows.length).toBeGreaterThanOrEqual(1);
      expect(duration).toBeLessThan(200); // Menos de 200ms
      
      console.log(`✅ JOIN Companies-Users em ${duration}ms`);
    });

    it('deve buscar com LIKE rapidamente', async () => {
      const timestamp = Date.now();
      await helper.createTestCompany({
        company_name: `SearchTest ${timestamp}`
      });

      const startTime = Date.now();
      
      const result = await global.testPool.query(`
        SELECT * FROM polox.companies 
        WHERE company_name ILIKE $1
        AND deleted_at IS NULL
        LIMIT 10
      `, [`%SearchTest%`]);

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(result.rows.length).toBeGreaterThanOrEqual(1);
      expect(duration).toBeLessThan(500); // Menos de 500ms
      
      console.log(`✅ Busca LIKE em ${duration}ms`);
    });
  });

  describe('Paginação', () => {
    it('deve paginar resultados corretamente', async () => {
      // Criar algumas empresas para teste
      for (let i = 0; i < 5; i++) {
        await helper.createTestCompany({
          company_name: `Pagination Test ${Date.now()}-${i}`
        });
        await helper.wait(10);
      }

      // Página 1 (5 por página)
      const page1 = await global.testPool.query(`
        SELECT * FROM polox.companies 
        WHERE deleted_at IS NULL
        ORDER BY created_at DESC
        LIMIT 5 OFFSET 0
      `);

      // Página 2 (5 por página)
      const page2 = await global.testPool.query(`
        SELECT * FROM polox.companies 
        WHERE deleted_at IS NULL
        ORDER BY created_at DESC
        LIMIT 5 OFFSET 5
      `);

      expect(page1.rows.length).toBeGreaterThanOrEqual(1);
      expect(page1.rows.length).toBeLessThanOrEqual(5);
      
      // IDs das páginas devem ser diferentes
      const page1Ids = page1.rows.map(r => r.id);
      const page2Ids = page2.rows.map(r => r.id);
      const commonIds = page1Ids.filter(id => page2Ids.includes(id));
      
      expect(commonIds.length).toBe(0);
    });

    it('deve calcular total de páginas corretamente', async () => {
      const totalResult = await global.testPool.query(`
        SELECT COUNT(*) as total FROM polox.companies 
        WHERE deleted_at IS NULL
      `);

      const total = parseInt(totalResult.rows[0].total);
      const perPage = 10;
      const totalPages = Math.ceil(total / perPage);

      expect(totalPages).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(totalPages)).toBe(true);
      
      console.log(`✅ Total: ${total} | Per Page: ${perPage} | Pages: ${totalPages}`);
    });
  });

  describe('Transações e Concorrência', () => {
    it('deve criar empresa e usuário na mesma transação', async () => {
      const client = await global.testPool.connect();
      
      try {
        await client.query('BEGIN');

        // Criar empresa
        const companyResult = await client.query(`
          INSERT INTO polox.companies (
            company_name, slug, company_domain, admin_email
          ) VALUES ($1, $2, $3, $4)
          RETURNING *
        `, [
          `Transaction Test ${Date.now()}`,
          `transaction-${Date.now()}`,
          `trans${Date.now()}.com`,
          `admin${Date.now()}@trans.com`
        ]);

        const company = companyResult.rows[0];

        // Criar usuário
        const hashedPassword = await require('bcryptjs').hash('Test@123', 12);
        const userResult = await client.query(`
          INSERT INTO polox.users (
            company_id, full_name, email, password_hash
          ) VALUES ($1, $2, $3, $4)
          RETURNING *
        `, [
          company.id,
          'Transaction User',
          `user${Date.now()}@trans.com`,
          hashedPassword
        ]);

        const user = userResult.rows[0];

        await client.query('COMMIT');

        expect(company).toBeDefined();
        expect(user).toBeDefined();
        expect(user.company_id).toBe(company.id);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    });

    it('deve fazer rollback em caso de erro', async () => {
      const client = await global.testPool.connect();
      
      let companyId;
      try {
        await client.query('BEGIN');

        // Criar empresa
        const companyResult = await client.query(`
          INSERT INTO polox.companies (
            company_name, slug, company_domain, admin_email
          ) VALUES ($1, $2, $3, $4)
          RETURNING *
        `, [
          `Rollback Test ${Date.now()}`,
          `rollback-${Date.now()}`,
          `rollback${Date.now()}.com`,
          `admin${Date.now()}@rollback.com`
        ]);

        companyId = companyResult.rows[0].id;

        // Forçar erro (email duplicado)
        await client.query(`
          INSERT INTO polox.companies (
            company_name, slug, company_domain, admin_email
          ) VALUES ($1, $2, $3, $4)
        `, [
          'Another Company',
          `another-${Date.now()}`,
          `another${Date.now()}.com`,
          `admin${Date.now()}@rollback.com` // Mesmo email
        ]);

        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        
        // Verificar que empresa não foi criada
        const checkResult = await global.testPool.query(`
          SELECT * FROM polox.companies WHERE id = $1
        `, [companyId]);

        expect(checkResult.rows.length).toBe(0);
      } finally {
        client.release();
      }
    });
  });

  describe('Índices e Otimização', () => {
    it('deve ter índice em company_domain', async () => {
      const result = await global.testPool.query(`
        SELECT indexname, indexdef 
        FROM pg_indexes 
        WHERE tablename = 'companies' 
        AND schemaname = 'polox'
        AND indexdef ILIKE '%company_domain%'
      `);

      expect(result.rows.length).toBeGreaterThanOrEqual(1);
      console.log('✅ Índices em company_domain:', result.rows.length);
    });

    it('deve ter índice em email para users', async () => {
      const result = await global.testPool.query(`
        SELECT indexname, indexdef 
        FROM pg_indexes 
        WHERE tablename = 'users' 
        AND schemaname = 'polox'
        AND indexdef ILIKE '%email%'
      `);

      expect(result.rows.length).toBeGreaterThanOrEqual(1);
      console.log('✅ Índices em email:', result.rows.length);
    });
  });
});
