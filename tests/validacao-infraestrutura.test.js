/**
 * ==========================================
 * 🧪 TESTE DE VALIDAÇÃO DA INFRAESTRUTURA
 * ==========================================
 * 
 * Este teste valida se a infraestrutura de testes está funcionando:
 * - Setup global (tests/setup.js)
 * - Conexão com banco de teste
 * - DatabaseHelper
 * - Server de teste (Supertest)
 */

const request = require('supertest');
const app = require('../src/server-test');
const { DatabaseHelper } = require('./helpers/database');

describe('✅ Validação da Infraestrutura de Testes', () => {
  
  describe('Setup Global', () => {
    it('deve ter testPool global configurado', () => {
      expect(global.testPool).toBeDefined();
      expect(typeof global.testPool.query).toBe('function');
    });
    
    it('deve estar em ambiente de teste', () => {
      expect(process.env.NODE_ENV).toBe('test');
    });
    
    it('deve ter variáveis de ambiente configuradas', () => {
      expect(process.env.JWT_SECRET).toBeDefined();
      expect(process.env.DB_NAME).toBe('app_polox_test');
    });
  });
  
  describe('DatabaseHelper', () => {
    let helper;
    
    beforeAll(() => {
      helper = new DatabaseHelper(global.testPool);
    });
    
    it('deve ser instanciado corretamente', () => {
      expect(helper).toBeDefined();
      expect(helper.pool).toBe(global.testPool);
    });
    
    it('deve ter método createTestCompany', () => {
      expect(typeof helper.createTestCompany).toBe('function');
    });
    
    it('deve ter método createTestUser', () => {
      expect(typeof helper.createTestUser).toBe('function');
    });
    
    it('deve ter método generateTestToken', () => {
      expect(typeof helper.generateTestToken).toBe('function');
    });
    
    it('deve criar empresa de teste', async () => {
      const company = await helper.createTestCompany({
        company_name: 'Empresa Teste Validação'
      });
      
      expect(company).toBeDefined();
      expect(company.id).toBeDefined();
      expect(company.company_name).toBe('Empresa Teste Validação');
      expect(company.slug).toBeDefined();
    });
    
    it('deve criar usuário de teste', async () => {
      const company = await helper.createTestCompany();
      const user = await helper.createTestUser(company.id, {
        email: 'validacao@test.com',
        password: '123456',
        full_name: 'Usuário Validação'
      });
      
      expect(user).toBeDefined();
      expect(user.id).toBeDefined();
      expect(user.email).toBe('validacao@test.com');
      expect(user.full_name).toBe('Usuário Validação');
      expect(user.company_id).toBe(company.id);
    });
    
    it('deve gerar token JWT válido', () => {
      const user = {
        id: 1,
        email: 'test@example.com',
        company_id: 1,
        role: 'user'
      };
      
      const token = helper.generateTestToken(user);
      
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.').length).toBe(3); // JWT tem 3 partes
    });
    
    it('deve gerar CNPJ válido', () => {
      const cnpj = helper.generateCNPJ();
      
      expect(cnpj).toBeDefined();
      expect(cnpj).toMatch(/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/);
    });
    
    it('deve gerar CPF válido', () => {
      const cpf = helper.generateCPF();
      
      expect(cpf).toBeDefined();
      expect(cpf).toMatch(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/);
    });
  });
  
  describe('Server de Teste (Supertest)', () => {
    it('GET /health deve retornar 200', async () => {
      const res = await request(app).get('/health');
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('healthy');
      expect(res.body.data.environment).toBe('test');
    });
    
    it('GET / deve retornar info da API', async () => {
      const res = await request(app).get('/');
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('Polox');
      expect(res.body.environment).toBe('test');
    });
    
    it('GET /rota-inexistente deve retornar 404', async () => {
      const res = await request(app).get('/rota-inexistente');
      
      expect(res.status).toBe(404);
    });
    
    it('deve aceitar header Accept-Language', async () => {
      const res = await request(app)
        .get('/health')
        .set('Accept-Language', 'pt-BR');
      
      expect(res.status).toBe(200);
    });
    
    it('deve aceitar header Authorization', async () => {
      const res = await request(app)
        .get('/health')
        .set('Authorization', 'Bearer fake-token');
      
      expect(res.status).toBe(200);
    });
  });
  
  describe('Conexão com Banco de Dados', () => {
    it('deve conseguir executar query simples', async () => {
      const result = await global.testPool.query('SELECT NOW() as now');
      
      expect(result.rows).toBeDefined();
      expect(result.rows.length).toBe(1);
      expect(result.rows[0].now).toBeDefined();
    });
    
    it('deve estar conectado ao banco de teste correto', async () => {
      const result = await global.testPool.query('SELECT current_database()');
      
      expect(result.rows[0].current_database).toBe('app_polox_test');
    });
    
    it('deve ter schema polox criado', async () => {
      const result = await global.testPool.query(`
        SELECT schema_name 
        FROM information_schema.schemata 
        WHERE schema_name = 'polox'
      `);
      
      expect(result.rows.length).toBe(1);
      expect(result.rows[0].schema_name).toBe('polox');
    });
    
    it('deve ter tabela companies criada', async () => {
      const result = await global.testPool.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'polox' 
        AND table_name = 'companies'
      `);
      
      expect(result.rows.length).toBe(1);
    });
    
    it('deve ter tabela users criada', async () => {
      const result = await global.testPool.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'polox' 
        AND table_name = 'users'
      `);
      
      expect(result.rows.length).toBe(1);
    });
  });
});
