const { DatabaseHelper } = require('../helpers/database');
const { query } = require('../../src/config/database');

describe('Company Model - CRUD Operations', () => {
  let helper;

  beforeAll(() => {
    helper = new DatabaseHelper(global.testPool);
  });

  describe('Criação de Empresas - Português (pt-BR)', () => {
    it('deve criar empresa em português', async () => {
      const timestamp = Date.now();
      const company = await helper.createTestCompany({
        company_name: `Empresa Teste Brasil ${timestamp}`,
        company_domain: `empresa-brasil-${timestamp}`,
        admin_email: `admin${timestamp}@empresa.com.br`,
        admin_phone: '+55 11 98765-4321'
      });

      expect(company.id).toBeDefined();
      expect(company.company_name).toContain('Empresa Teste Brasil');
      expect(company.company_domain).toContain('empresa-brasil');
      expect(company.admin_email).toContain('@empresa.com.br');
      expect(company.slug).toBeDefined();
      expect(company.status).toBe('active');
    });

    it('deve atualizar dados da empresa', async () => {
      const timestamp = Date.now();
      const company = await helper.createTestCompany({
        company_name: `Empresa Original ${timestamp}`,
        company_domain: `original-${timestamp}`
      });

      const updateQuery = `
        UPDATE polox.companies
        SET company_name = $1, updated_at = NOW()
        WHERE id = $2
        RETURNING *
      `;

      const newName = `Empresa Atualizada ${timestamp}`;
      const result = await query(updateQuery, [newName, company.id]);
      const updatedCompany = result.rows[0];

      expect(updatedCompany.company_name).toBe(newName);
      expect(updatedCompany.id).toBe(company.id);
    });

    it('deve buscar empresa por ID', async () => {
      const timestamp = Date.now();
      const company = await helper.createTestCompany({
        company_name: `Empresa Busca ${timestamp}`
      });

      const searchQuery = `
        SELECT * FROM polox.companies 
        WHERE id = $1 AND deleted_at IS NULL
      `;

      const result = await query(searchQuery, [company.id]);
      expect(result.rows.length).toBe(1);
      expect(result.rows[0].id).toBe(company.id);
    });
  });

  describe('Criação de Empresas - English (en)', () => {
    it('should create a company in English', async () => {
      const timestamp = Date.now();
      const company = await helper.createTestCompany({
        company_name: `Test Company USA ${timestamp}`,
        company_domain: `test-usa-${timestamp}`,
        admin_email: `admin${timestamp}@testcompany.com`,
        admin_phone: '+1 555-123-4567'
      });

      expect(company.id).toBeDefined();
      expect(company.company_name).toContain('Test Company USA');
      expect(company.admin_email).toContain('@testcompany.com');
      expect(company.status).toBe('active');
    });

    it('should update company data', async () => {
      const timestamp = Date.now();
      const company = await helper.createTestCompany({
        company_name: `Original Company ${timestamp}`
      });

      const updateQuery = `
        UPDATE polox.companies
        SET company_name = $1, updated_at = NOW()
        WHERE id = $2
        RETURNING *
      `;

      const newName = `Updated Company ${timestamp}`;
      const result = await query(updateQuery, [newName, company.id]);
      
      expect(result.rows[0].company_name).toBe(newName);
    });

    it('should search company by domain', async () => {
      const timestamp = Date.now();
      const domain = `search-domain-${timestamp}`;
      const company = await helper.createTestCompany({
        company_name: `Search Company ${timestamp}`,
        company_domain: domain
      });

      const searchQuery = `
        SELECT * FROM polox.companies 
        WHERE company_domain = $1 AND deleted_at IS NULL
      `;

      const result = await query(searchQuery, [domain]);
      expect(result.rows.length).toBe(1);
      expect(result.rows[0].company_domain).toBe(domain);
    });
  });

  describe('Criação de Empresas - Español (es)', () => {
    it('debe crear una empresa en español', async () => {
      const timestamp = Date.now();
      const company = await helper.createTestCompany({
        company_name: `Empresa Prueba España ${timestamp}`,
        company_domain: `empresa-espana-${timestamp}`,
        admin_email: `admin${timestamp}@empresa.es`,
        admin_phone: '+34 912 345 678'
      });

      expect(company.id).toBeDefined();
      expect(company.company_name).toContain('Empresa Prueba España');
      expect(company.admin_email).toContain('@empresa.es');
      expect(company.status).toBe('active');
    });

    it('debe actualizar datos de la empresa', async () => {
      const timestamp = Date.now();
      const company = await helper.createTestCompany({
        company_name: `Empresa Original ${timestamp}`
      });

      const updateQuery = `
        UPDATE polox.companies
        SET company_name = $1, updated_at = NOW()
        WHERE id = $2
        RETURNING *
      `;

      const newName = `Empresa Actualizada ${timestamp}`;
      const result = await query(updateQuery, [newName, company.id]);
      
      expect(result.rows[0].company_name).toBe(newName);
    });

    it('debe buscar empresa por email', async () => {
      const timestamp = Date.now();
      const email = `admin${timestamp}@buscar.es`;
      const company = await helper.createTestCompany({
        company_name: `Empresa Buscar ${timestamp}`,
        admin_email: email
      });

      const searchQuery = `
        SELECT * FROM polox.companies 
        WHERE admin_email = $1 AND deleted_at IS NULL
      `;

      const result = await query(searchQuery, [email]);
      expect(result.rows.length).toBe(1);
      expect(result.rows[0].admin_email).toBe(email);
    });
  });

  describe('Validações e Consultas', () => {
    it('deve criar múltiplas empresas sem conflito', async () => {
      const company1 = await helper.createTestCompany({
        company_name: `Empresa 1 ${Date.now()}`,
        company_domain: `empresa1-${Date.now()}`
      });
      
      await helper.wait(10); // Espera 10ms para garantir timestamp diferente
      
      const company2 = await helper.createTestCompany({
        company_name: `Empresa 2 ${Date.now()}`,
        company_domain: `empresa2-${Date.now()}`
      });
      
      await helper.wait(10);
      
      const company3 = await helper.createTestCompany({
        company_name: `Empresa 3 ${Date.now()}`,
        company_domain: `empresa3-${Date.now()}`
      });

      const companies = [company1, company2, company3];
      const ids = companies.map(c => c.id);
      const uniqueIds = [...new Set(ids)];
      expect(uniqueIds.length).toBe(3);

      const slugs = companies.map(c => c.slug);
      const uniqueSlugs = [...new Set(slugs)];
      expect(uniqueSlugs.length).toBe(3);
    });

    it('deve ter timestamps criados automaticamente', async () => {
      const company = await helper.createTestCompany();
      
      expect(company.created_at).toBeDefined();
      expect(company.updated_at).toBeDefined();
      expect(new Date(company.created_at)).toBeInstanceOf(Date);
    });

    it('deve contar empresas corretamente', async () => {
      // Criar algumas empresas primeiro
      await helper.createTestCompany({
        company_name: `Empresa Count 1 ${Date.now()}`
      });
      await helper.createTestCompany({
        company_name: `Empresa Count 2 ${Date.now()}`
      });
      
      const countQuery = `
        SELECT COUNT(*) as total 
        FROM polox.companies 
        WHERE deleted_at IS NULL
      `;

      const result = await query(countQuery);
      const total = parseInt(result.rows[0].total);
      expect(total).toBeGreaterThanOrEqual(2);
    });
  });
});
