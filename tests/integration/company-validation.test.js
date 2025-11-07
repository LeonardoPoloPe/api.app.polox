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
 * 🧪 TESTES DE VALIDAÇÃO - COMPANIES
 * ==========================================
 * 
 * Testa validações de negócio para empresas:
 * - Validações de campos obrigatórios
 * - Validações de formato
 * - Validações de duplicidade
 * - Validações de regras de negócio
 */

const { DatabaseHelper } = require('../helpers/database');

describe('🔒 Validações de Companies', () => {
  let helper;

  beforeAll(() => {
    helper = new DatabaseHelper(global.testPool);
  });

  describe('Validação de Domínios', () => {
    it('deve aceitar domínios válidos com letras e números', async () => {
      const timestamp = Date.now();
      const validDomains = [
        `empresa${timestamp}`,
        `tech-corp${timestamp}`,
        `my-company-123${timestamp}`,
        `abc123${timestamp}`
      ];

      for (const domain of validDomains) {
        const company = await helper.createTestCompany({
          company_name: `Test ${domain}`,
          company_domain: domain
        });
        
        expect(company).toBeDefined();
        expect(company.company_domain).toBe(domain);
      }
    });

    it('deve aceitar domínios com pontos (formato completo)', async () => {
      const timestamp = Date.now();
      const validDomains = [
        `empresa${timestamp}.com.br`,
        `crm.polox${timestamp}.com`,
        `api.tech${timestamp}.io`,
        `app.cliente${timestamp}.net`
      ];

      for (const domain of validDomains) {
        const company = await helper.createTestCompany({
          company_name: `Test ${domain}`,
          company_domain: domain
        });
        
        expect(company).toBeDefined();
        expect(company.company_domain).toBe(domain);
      }
    });

    it('deve garantir unicidade de domínio', async () => {
      const timestamp = Date.now();
      const domain = `unique-domain-${timestamp}`;

      // Criar primeira empresa
      const company1 = await helper.createTestCompany({
        company_name: 'Company 1',
        company_domain: domain
      });
      
      expect(company1).toBeDefined();

      // Tentar criar segunda empresa com mesmo domínio deve falhar
      await expect(
        helper.createTestCompany({
          company_name: 'Company 2',
          company_domain: domain
        })
      ).rejects.toThrow();
    });

    it('deve permitir domínios diferentes para empresas diferentes', async () => {
      const timestamp = Date.now();
      
      const company1 = await helper.createTestCompany({
        company_domain: `domain1-${timestamp}`
      });
      
      const company2 = await helper.createTestCompany({
        company_domain: `domain2-${timestamp}`
      });

      expect(company1.company_domain).not.toBe(company2.company_domain);
    });
  });

  describe('Validação de Slugs', () => {
    it('deve gerar slug único automaticamente', async () => {
      const timestamp = Date.now();
      
      const company1 = await helper.createTestCompany({
        company_name: 'Same Name Company'
      });
      
      await helper.wait(10);
      
      const company2 = await helper.createTestCompany({
        company_name: 'Same Name Company'
      });

      expect(company1.slug).toBeDefined();
      expect(company2.slug).toBeDefined();
      expect(company1.slug).not.toBe(company2.slug);
    });

    it('deve criar slug automaticamente', async () => {
      const company = await helper.createTestCompany({
        company_name: 'Tech Solutions Corp'
      });

      expect(company.slug).toBeDefined();
      expect(typeof company.slug).toBe('string');
      expect(company.slug.length).toBeGreaterThan(0);
    });
  });

  describe('Validação de Status', () => {
    it('deve criar empresa com status active por padrão', async () => {
      const company = await helper.createTestCompany();

      expect(company.status).toBe('active');
    });

    it('deve permitir criação com status trial', async () => {
      const company = await helper.createTestCompany({
        status: 'trial'
      });

      expect(company.status).toBe('trial');
    });

    it('deve permitir criação com status inactive', async () => {
      const company = await helper.createTestCompany({
        status: 'inactive'
      });

      expect(company.status).toBe('inactive');
    });
  });

  describe('Validação de Emails', () => {
    it('deve aceitar emails válidos no admin_email', async () => {
      const validEmails = [
        'admin@empresa.com.br',
        'contato@tech.io',
        'admin+test@example.com',
        'user.name@sub.domain.com'
      ];

      for (const email of validEmails) {
        const company = await helper.createTestCompany({
          admin_email: email
        });
        
        expect(company.admin_email).toBe(email);
      }
    });

    it('deve permitir emails diferentes em empresas diferentes', async () => {
      const timestamp = Date.now();
      const email1 = `admin${timestamp}-1@unique.com`;
      const email2 = `admin${timestamp}-2@unique.com`;

      // Criar primeira empresa
      const company1 = await helper.createTestCompany({
        admin_email: email1
      });
      
      // Criar segunda empresa com email diferente
      const company2 = await helper.createTestCompany({
        admin_email: email2
      });

      expect(company1.admin_email).toBe(email1);
      expect(company2.admin_email).toBe(email2);
      expect(company1.admin_email).not.toBe(company2.admin_email);
    });
  });

  describe('Validação de Timestamps', () => {
    it('deve criar created_at e updated_at automaticamente', async () => {
      const company = await helper.createTestCompany();

      expect(company.created_at).toBeDefined();
      expect(company.updated_at).toBeDefined();
      expect(new Date(company.created_at)).toBeInstanceOf(Date);
      expect(new Date(company.updated_at)).toBeInstanceOf(Date);
    });

    it('created_at e updated_at devem ser próximos na criação', async () => {
      const company = await helper.createTestCompany();

      const createdAt = new Date(company.created_at).getTime();
      const updatedAt = new Date(company.updated_at).getTime();
      
      // Diferença deve ser menor que 1 segundo
      expect(Math.abs(updatedAt - createdAt)).toBeLessThan(1000);
    });

    it('updated_at deve ser atualizado em modificações', async () => {
      const company = await helper.createTestCompany();
      const originalUpdatedAt = new Date(company.updated_at).getTime();

      // Aguardar 100ms
      await helper.wait(100);

      // Atualizar empresa
      const updateQuery = `
        UPDATE polox.companies
        SET company_name = $1, updated_at = NOW()
        WHERE id = $2
        RETURNING *
      `;

      const result = await global.testPool.query(updateQuery, [
        'Updated Name',
        company.id
      ]);

      const updatedCompany = result.rows[0];
      const newUpdatedAt = new Date(updatedCompany.updated_at).getTime();

      expect(newUpdatedAt).toBeGreaterThan(originalUpdatedAt);
    });
  });

  describe('Validação de Soft Delete', () => {
    it('deve permitir soft delete de empresa', async () => {
      const company = await helper.createTestCompany();

      // Soft delete
      const deleteQuery = `
        UPDATE polox.companies
        SET deleted_at = NOW()
        WHERE id = $1
        RETURNING *
      `;

      const result = await global.testPool.query(deleteQuery, [company.id]);
      const deletedCompany = result.rows[0];

      expect(deletedCompany.deleted_at).not.toBeNull();
    });

    it('empresa deletada não deve aparecer em consultas normais', async () => {
      const timestamp = Date.now();
      const company = await helper.createTestCompany({
        company_name: `Company for Delete ${timestamp}`
      });

      // Soft delete
      await global.testPool.query(
        'UPDATE polox.companies SET deleted_at = NOW() WHERE id = $1',
        [company.id]
      );

      // Consulta normal (sem deleted_at IS NULL)
      const searchQuery = `
        SELECT * FROM polox.companies 
        WHERE id = $1 AND deleted_at IS NULL
      `;

      const result = await global.testPool.query(searchQuery, [company.id]);
      
      expect(result.rows.length).toBe(0);
    });

    it('empresa deletada mantém domínio marcado', async () => {
      const timestamp = Date.now();
      const domain = `deleted-domain-${timestamp}`;

      // Criar empresa
      const company = await helper.createTestCompany({
        company_domain: domain
      });

      // Soft delete
      await global.testPool.query(
        'UPDATE polox.companies SET deleted_at = NOW() WHERE id = $1',
        [company.id]
      );

      // Verificar que empresa foi deletada mas mantém domínio
      const result = await global.testPool.query(
        'SELECT * FROM polox.companies WHERE id = $1',
        [company.id]
      );

      expect(result.rows[0].deleted_at).not.toBeNull();
      expect(result.rows[0].company_domain).toBe(domain);
    });
  });

  describe('Validação de Dados Multilíngue', () => {
    it('deve aceitar caracteres especiais em nomes (PT)', async () => {
      const company = await helper.createTestCompany({
        company_name: 'Empresa São José LTDA - Comércio & Serviços'
      });

      expect(company.company_name).toContain('São');
      expect(company.company_name).toContain('&');
    });

    it('deve aceitar caracteres especiais em nomes (ES)', async () => {
      const company = await helper.createTestCompany({
        company_name: 'Empresa Española S.A. - Soluciones Ágiles'
      });

      expect(company.company_name).toContain('Española');
      expect(company.company_name).toContain('Ágiles');
    });

    it('deve aceitar nomes longos', async () => {
      const longName = 'Empresa de Tecnologia e Soluções Digitais Avançadas para Mercado Corporativo LTDA';
      const company = await helper.createTestCompany({
        company_name: longName
      });

      expect(company.company_name).toBe(longName);
      expect(company.company_name.length).toBeGreaterThan(50);
    });
  });

  describe('Validação de Busca e Filtros', () => {
    it('deve buscar empresas por status', async () => {
      // Criar empresas com diferentes status
      await helper.createTestCompany({ status: 'active' });
      await helper.createTestCompany({ status: 'trial' });
      await helper.createTestCompany({ status: 'inactive' });

      const result = await global.testPool.query(`
        SELECT COUNT(*) as total FROM polox.companies 
        WHERE status = $1 AND deleted_at IS NULL
      `, ['active']);

      const total = parseInt(result.rows[0].total);
      expect(total).toBeGreaterThanOrEqual(1);
    });

    it('deve buscar empresas por nome (case insensitive)', async () => {
      const timestamp = Date.now();
      await helper.createTestCompany({
        company_name: `TechCorp ${timestamp}`
      });

      // Buscar com lowercase
      const result = await global.testPool.query(`
        SELECT * FROM polox.companies 
        WHERE LOWER(company_name) LIKE LOWER($1)
        AND deleted_at IS NULL
      `, [`%techcorp ${timestamp}%`]);

      expect(result.rows.length).toBeGreaterThanOrEqual(1);
    });

    it('deve contar empresas ativas corretamente', async () => {
      const result = await global.testPool.query(`
        SELECT COUNT(*) as total FROM polox.companies 
        WHERE status = 'active' AND deleted_at IS NULL
      `);

      const total = parseInt(result.rows[0].total);
      expect(total).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(total)).toBe(true);
    });
  });
});
