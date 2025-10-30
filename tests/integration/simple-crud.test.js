/**
 * ==========================================
 * 🧪 TESTES SIMPLES - CRIAÇÃO DE DADOS
 * ==========================================
 * 
 * Testa operações básicas de CRUD diretamente no banco:
 * - Criação de empresas
 * - Criação de usuários
 * - Validação de dados
 * - Multi-idioma (testando estrutura)
 */

const { DatabaseHelper } = require('../helpers/database');

describe('✅ Testes Simples - Criação de Dados', () => {
  let helper;

  beforeAll(() => {
    helper = new DatabaseHelper(global.testPool);
  });

  describe('🏢 Criação de Empresas', () => {
    it('deve criar empresa em português (pt-BR)', async () => {
      const company = await helper.createTestCompany({
        company_name: 'Empresa Teste Brasil LTDA',
        company_domain: 'empresa-brasil'
      });

      expect(company).toBeDefined();
      expect(company.id).toBeDefined();
      expect(company.company_name).toBe('Empresa Teste Brasil LTDA');
      expect(company.company_domain).toBe('empresa-brasil');
      expect(company.slug).toContain('empresa-teste'); // slug é gerado automaticamente com timestamp
      // industry pode ser null se não for passado nas migrations
    });

    it('deve criar empresa em inglês (en)', async () => {
      const company = await helper.createTestCompany({
        company_name: 'Test Company USA Inc',
        company_domain: 'test-company-usa',
        industry: 'Technology',
        admin_email: 'admin@testcompany.com',
        admin_name: 'Admin Manager',
        admin_phone: '+1 555-1234'
      });

      expect(company).toBeDefined();
      expect(company.company_name).toBe('Test Company USA Inc');
      expect(company.company_domain).toBe('test-company-usa');
    });

    it('deve criar empresa em espanhol (es)', async () => {
      const company = await helper.createTestCompany({
        company_name: 'Empresa Prueba España SA',
        company_domain: 'empresa-espana',
        industry: 'Tecnología',
        admin_email: 'admin@empresaespana.es',
        admin_name: 'Administrador España',
        admin_phone: '+34 600 123 456'
      });

      expect(company).toBeDefined();
      expect(company.company_name).toBe('Empresa Prueba España SA');
      expect(company.company_domain).toBe('empresa-espana');
    });

    it('deve gerar slug único automaticamente', async () => {
      const company1 = await helper.createTestCompany({
        company_name: 'Empresa Slug Test'
      });

      const company2 = await helper.createTestCompany({
        company_name: 'Outra Empresa'
      });

      expect(company1.slug).toBeDefined();
      expect(company2.slug).toBeDefined();
      expect(company1.slug).not.toBe(company2.slug);
    });

    it('deve ter timestamps criados automaticamente', async () => {
      const company = await helper.createTestCompany();

      expect(company.created_at).toBeDefined();
      expect(company.updated_at).toBeDefined();
      expect(new Date(company.created_at)).toBeInstanceOf(Date);
    });

    it('deve aceitar domínios com pontos (ex: bomelo.com.br)', async () => {
      const timestamp = Date.now();
      const company = await helper.createTestCompany({
        company_name: 'Bomelo E-commerce',
        company_domain: `bomelo${timestamp}.com.br`,
        industry: 'E-commerce',
        admin_email: 'admin@bomelo.com.br'
      });

      expect(company).toBeDefined();
      expect(company.company_domain).toBe(`bomelo${timestamp}.com.br`);
    });

    it('deve aceitar subdomínios com pontos (ex: crm.polox.com.br)', async () => {
      const timestamp = Date.now();
      const company = await helper.createTestCompany({
        company_name: 'CRM Polox',
        company_domain: `crm.polox${timestamp}.com.br`,
        industry: 'SaaS',
        admin_email: 'admin@polox.com.br'
      });

      expect(company).toBeDefined();
      expect(company.company_domain).toBe(`crm.polox${timestamp}.com.br`);
    });
  });

  describe('👤 Criação de Usuários', () => {
    // Criar empresa DENTRO de cada teste para evitar problemas com afterEach cleanup
    
    it('deve criar usuário português (pt-BR)', async () => {
      const testCompany = await helper.createTestCompany({
        company_name: 'Company for PT User'
      });

      const user = await helper.createTestUser(testCompany.id, {
        email: 'usuario.br@test.com',
        password: 'senha123',
        full_name: 'Usuário Brasileiro',
        user_role: 'user'
      });

      expect(user).toBeDefined();
      expect(user.id).toBeDefined();
      expect(user.email).toBe('usuario.br@test.com');
      expect(user.full_name).toBe('Usuário Brasileiro');
      expect(user.company_id).toBe(testCompany.id);
      expect(user.user_role).toBe('user');
      expect(user.password_hash).toBeUndefined(); // Não retorna hash
    });

    it('deve criar usuário inglês (en)', async () => {
      const testCompany = await helper.createTestCompany({
        company_name: 'Company for EN User'
      });

      const user = await helper.createTestUser(testCompany.id, {
        email: 'user.en@test.com',
        password: 'password123',
        full_name: 'English User',
        user_role: 'admin'
      });

      expect(user).toBeDefined();
      expect(user.full_name).toBe('English User');
      expect(user.user_role).toBe('admin');
    });

    it('deve criar usuário espanhol (es)', async () => {
      const testCompany = await helper.createTestCompany({
        company_name: 'Company for ES User'
      });

      const user = await helper.createTestUser(testCompany.id, {
        email: 'usuario.es@test.com',
        password: 'contraseña123',
        full_name: 'Usuario Español',
        user_role: 'company_admin'
      });

      expect(user).toBeDefined();
      expect(user.full_name).toBe('Usuario Español');
      expect(user.user_role).toBe('company_admin');
    });

    it('deve hash a senha automaticamente', async () => {
      const testCompany = await helper.createTestCompany({
        company_name: 'Company for Hash Test'
      });

      const password = 'minha-senha-secreta';
      
      const user = await helper.createTestUser(testCompany.id, {
        email: 'hashtest@test.com',
        password: password,
        full_name: 'Hash Test User'
      });

      // Buscar usuário no banco para verificar hash
      const result = await global.testPool.query(
        'SELECT password_hash FROM polox.users WHERE id = $1',
        [user.id]
      );

      expect(result.rows[0].password_hash).toBeDefined();
      expect(result.rows[0].password_hash).not.toBe(password); // Hash != senha
      expect(result.rows[0].password_hash.length).toBeGreaterThan(50); // bcrypt hash
    });

    it('deve criar usuários com diferentes roles', async () => {
      const testCompany = await helper.createTestCompany({
        company_name: 'Company for Roles Test'
      });

      const roles = ['user', 'admin', 'company_admin', 'super_admin'];
      
      for (const role of roles) {
        const user = await helper.createTestUser(testCompany.id, {
          email: `${role}@test.com`,
          password: '123456',
          full_name: `Test ${role}`,
          user_role: role
        });

        expect(user.user_role).toBe(role);
      }
    });
  });

  describe('🔐 Geração de Tokens JWT', () => {
    it('deve gerar token JWT válido', () => {
      const user = {
        id: 1,
        email: 'test@example.com',
        company_id: 1,
        user_role: 'user'
      };

      const token = helper.generateTestToken(user);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.').length).toBe(3); // header.payload.signature
      expect(token.length).toBeGreaterThan(100);
    });

    it('deve gerar tokens diferentes para usuários diferentes', () => {
      const user1 = { id: 1, email: 'user1@test.com', company_id: 1, user_role: 'user' };
      const user2 = { id: 2, email: 'user2@test.com', company_id: 1, user_role: 'admin' };

      const token1 = helper.generateTestToken(user1);
      const token2 = helper.generateTestToken(user2);

      expect(token1).not.toBe(token2);
    });
  });

  describe('📋 Geradores de Dados Fake', () => {
    it('deve gerar CNPJ válido (formato brasileiro)', () => {
      const cnpj = helper.generateCNPJ();

      expect(cnpj).toBeDefined();
      expect(cnpj).toMatch(/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/);
      
      // Exemplo: 12.345.678/0001-90
      const parts = cnpj.split(/[.\/-]/);
      expect(parts.length).toBe(5);
      expect(parts[0].length).toBe(2);
      expect(parts[1].length).toBe(3);
      expect(parts[2].length).toBe(3);
      expect(parts[3].length).toBe(4);
      expect(parts[4].length).toBe(2);
    });

    it('deve gerar múltiplos CNPJs únicos', () => {
      const cnpjs = new Set();
      
      for (let i = 0; i < 10; i++) {
        cnpjs.add(helper.generateCNPJ());
      }

      expect(cnpjs.size).toBe(10); // Todos únicos
    });

    it('deve gerar CPF válido (formato brasileiro)', () => {
      const cpf = helper.generateCPF();

      expect(cpf).toBeDefined();
      expect(cpf).toMatch(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/);
      
      // Exemplo: 123.456.789-01
      const parts = cpf.split(/[.-]/);
      expect(parts.length).toBe(4);
      expect(parts[0].length).toBe(3);
      expect(parts[1].length).toBe(3);
      expect(parts[2].length).toBe(3);
      expect(parts[3].length).toBe(2);
    });

    it('deve gerar múltiplos CPFs únicos', () => {
      const cpfs = new Set();
      
      for (let i = 0; i < 10; i++) {
        cpfs.add(helper.generateCPF());
      }

      expect(cpfs.size).toBe(10); // Todos únicos
    });
  });

  describe('🌐 Validação Multi-Idioma (Estrutura)', () => {
    it('deve criar dados para teste em português', async () => {
      const company = await helper.createTestCompany({
        company_name: 'Empresa PT',
        admin_name: 'Admin Português',
        admin_email: 'admin.pt@test.com'
      });

      const user = await helper.createTestUser(company.id, {
        full_name: 'Usuário Português',
        email: 'usuario.pt@test.com',
        password: 'senha123'
      });

      expect(company.company_name).toBe('Empresa PT');
      expect(user.full_name).toBe('Usuário Português');
    });

    it('deve criar dados para teste em inglês', async () => {
      const company = await helper.createTestCompany({
        company_name: 'Company EN',
        admin_name: 'Admin English',
        admin_email: 'admin.en@test.com'
      });

      const user = await helper.createTestUser(company.id, {
        full_name: 'English User',
        email: 'user.en@test.com',
        password: 'password123'
      });

      expect(company.company_name).toBe('Company EN');
      expect(user.full_name).toBe('English User');
    });

    it('deve criar dados para teste em espanhol', async () => {
      const company = await helper.createTestCompany({
        company_name: 'Empresa ES',
        admin_name: 'Admin Español',
        admin_email: 'admin.es@test.com'
      });

      const user = await helper.createTestUser(company.id, {
        full_name: 'Usuario Español',
        email: 'usuario.es@test.com',
        password: 'contraseña123'
      });

      expect(company.company_name).toBe('Empresa ES');
      expect(user.full_name).toBe('Usuario Español');
    });
  });

  describe('📊 Consultas Diretas ao Banco', () => {
    it('deve conseguir consultar empresas criadas', async () => {
      const company = await helper.createTestCompany({
        company_name: 'Query Test Company'
      });

      const result = await global.testPool.query(
        'SELECT * FROM polox.companies WHERE id = $1',
        [company.id]
      );

      expect(result.rows.length).toBe(1);
      expect(result.rows[0].company_name).toBe('Query Test Company');
    });

    it('deve conseguir consultar usuários criados', async () => {
      const company = await helper.createTestCompany();
      const user = await helper.createTestUser(company.id, {
        email: 'queryuser@test.com',
        full_name: 'Query Test User',
        password: '123456'
      });

      const result = await global.testPool.query(
        'SELECT * FROM polox.users WHERE id = $1',
        [user.id]
      );

      expect(result.rows.length).toBe(1);
      expect(result.rows[0].full_name).toBe('Query Test User');
    });

    it('deve conseguir contar total de empresas', async () => {
      // Criar uma empresa para garantir que existe pelo menos uma
      await helper.createTestCompany({
        company_name: 'Company for Count Test'
      });

      const result = await global.testPool.query(
        'SELECT COUNT(*) as total FROM polox.companies WHERE deleted_at IS NULL'
      );

      expect(result.rows[0].total).toBeDefined();
      expect(parseInt(result.rows[0].total)).toBeGreaterThan(0);
    });

    it('deve conseguir contar total de usuários', async () => {
      // Criar empresa e usuário para garantir que existe pelo menos um
      const company = await helper.createTestCompany({
        company_name: 'Company for User Count'
      });

      await helper.createTestUser(company.id, {
        email: 'countuser@test.com',
        full_name: 'Count Test User',
        password: '123456'
      });

      const result = await global.testPool.query(
        'SELECT COUNT(*) as total FROM polox.users WHERE deleted_at IS NULL'
      );

      expect(result.rows[0].total).toBeDefined();
      expect(parseInt(result.rows[0].total)).toBeGreaterThan(0);
    });
  });
});
