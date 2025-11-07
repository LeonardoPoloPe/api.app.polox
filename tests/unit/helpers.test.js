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
 * 🧪 TESTES UNITÁRIOS - HELPERS E UTILITÁRIOS
 * ==========================================
 * 
 * Testa funções auxiliares e utilitários:
 * - Geradores de dados
 * - Validadores
 * - Formatadores
 * - Helpers de teste
 */

const { DatabaseHelper } = require('../helpers/database');

describe('🔧 Testes Unitários - Helpers', () => {
  let helper;

  beforeAll(() => {
    helper = new DatabaseHelper(global.testPool);
  });

  describe('Gerador de CNPJ', () => {
    it('deve gerar CNPJ no formato correto', () => {
      const cnpj = helper.generateCNPJ();

      expect(cnpj).toMatch(/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/);
    });

    it('deve gerar CNPJs únicos', () => {
      const cnpjs = new Set();
      
      for (let i = 0; i < 100; i++) {
        cnpjs.add(helper.generateCNPJ());
      }

      expect(cnpjs.size).toBe(100);
    });

    it('deve ter formato brasileiro válido', () => {
      const cnpj = helper.generateCNPJ();
      const parts = cnpj.split(/[.\/-]/);

      expect(parts[0].length).toBe(2);  // 12
      expect(parts[1].length).toBe(3);  // 345
      expect(parts[2].length).toBe(3);  // 678
      expect(parts[3].length).toBe(4);  // 0001
      expect(parts[4].length).toBe(2);  // 90
    });
  });

  describe('Gerador de CPF', () => {
    it('deve gerar CPF no formato correto', () => {
      const cpf = helper.generateCPF();

      expect(cpf).toMatch(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/);
    });

    it('deve gerar CPFs únicos', () => {
      const cpfs = new Set();
      
      for (let i = 0; i < 100; i++) {
        cpfs.add(helper.generateCPF());
      }

      expect(cpfs.size).toBe(100);
    });

    it('deve ter formato brasileiro válido', () => {
      const cpf = helper.generateCPF();
      const parts = cpf.split(/[.-]/);

      expect(parts[0].length).toBe(3);  // 123
      expect(parts[1].length).toBe(3);  // 456
      expect(parts[2].length).toBe(3);  // 789
      expect(parts[3].length).toBe(2);  // 01
    });
  });

  describe('Gerador de Token JWT', () => {
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
      expect(token.length).toBeGreaterThan(100);
    });

    it('token deve ter formato JWT (3 partes)', () => {
      const user = {
        id: 1,
        email: 'test@example.com',
        company_id: 1,
        user_role: 'user'
      };

      const token = helper.generateTestToken(user);
      const parts = token.split('.');

      expect(parts.length).toBe(3); // header.payload.signature
      expect(parts[0].length).toBeGreaterThan(0);
      expect(parts[1].length).toBeGreaterThan(0);
      expect(parts[2].length).toBeGreaterThan(0);
    });

    it('deve gerar tokens diferentes para usuários diferentes', () => {
      const user1 = {
        id: 1,
        email: 'user1@test.com',
        company_id: 1,
        user_role: 'user'
      };

      const user2 = {
        id: 2,
        email: 'user2@test.com',
        company_id: 1,
        user_role: 'admin'
      };

      const token1 = helper.generateTestToken(user1);
      const token2 = helper.generateTestToken(user2);

      expect(token1).not.toBe(token2);
    });

    it('deve gerar mesmo token para mesmo usuário (em curto período)', () => {
      const user = {
        id: 1,
        email: 'test@example.com',
        company_id: 1,
        user_role: 'user'
      };

      const token1 = helper.generateTestToken(user);
      const token2 = helper.generateTestToken(user);

      // Tokens devem ser iguais se gerados no mesmo segundo
      expect(token1).toBe(token2);
    });
  });

  describe('Helper de Espera (wait)', () => {
    it('deve aguardar tempo especificado', async () => {
      const startTime = Date.now();
      
      await helper.wait(100);
      
      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeGreaterThanOrEqual(95); // Tolerância de -5ms
      expect(duration).toBeLessThan(300); // Margem maior para sistemas sob carga
    });

    it('deve aguardar tempos diferentes', async () => {
      const times = [50, 100, 150];
      
      for (const time of times) {
        const startTime = Date.now();
        await helper.wait(time);
        const duration = Date.now() - startTime;

        expect(duration).toBeGreaterThanOrEqual(time);
        expect(duration).toBeLessThan(time + 50);
      }
    });
  });

  describe('DatabaseHelper - Instância', () => {
    it('deve ter pool de conexão definido', () => {
      expect(helper.pool).toBeDefined();
      expect(helper.pool).toBe(global.testPool);
    });

    it('deve ter métodos essenciais', () => {
      expect(typeof helper.createTestCompany).toBe('function');
      expect(typeof helper.createTestUser).toBe('function');
      expect(typeof helper.createTestLead).toBe('function');
      expect(typeof helper.createTestClient).toBe('function');
      expect(typeof helper.generateTestToken).toBe('function');
      expect(typeof helper.generateCNPJ).toBe('function');
      expect(typeof helper.generateCPF).toBe('function');
      expect(typeof helper.wait).toBe('function');
    });

    it('deve permitir criar nova instância com pool customizado', () => {
      const customHelper = new DatabaseHelper(global.testPool);
      
      expect(customHelper).toBeInstanceOf(DatabaseHelper);
      expect(customHelper.pool).toBe(global.testPool);
    });
  });

  describe('Validação de Dados de Teste', () => {
    it('createTestCompany deve aceitar parâmetros opcionais', async () => {
      const company1 = await helper.createTestCompany();
      const company2 = await helper.createTestCompany({
        company_name: 'Custom Company'
      });

      expect(company1.company_name).toBeDefined();
      expect(company2.company_name).toBe('Custom Company');
    });

    it('createTestUser deve aceitar parâmetros opcionais', async () => {
      const company = await helper.createTestCompany();
      
      const user1 = await helper.createTestUser(company.id);
      const user2 = await helper.createTestUser(company.id, {
        full_name: 'Custom User',
        email: 'custom@test.com'
      });

      expect(user1.full_name).toBeDefined();
      expect(user2.full_name).toBe('Custom User');
      expect(user2.email).toBe('custom@test.com');
    });

    it('deve gerar valores padrão quando não especificado', async () => {
      const company = await helper.createTestCompany();

      expect(company.company_name).toBeDefined();
      expect(company.slug).toBeDefined();
      expect(company.company_domain).toBeDefined();
      expect(company.admin_email).toBeDefined();
      expect(company.status).toBe('active');
    });
  });

  describe('Testes de Tipos de Dados', () => {
    it('IDs devem ser válidos e numéricos', async () => {
      const company = await helper.createTestCompany();

      expect(company.id).toBeDefined();
      // PostgreSQL pode retornar como string ou number dependendo da config
      const id = typeof company.id === 'string' ? parseInt(company.id) : company.id;
      expect(Number.isInteger(id)).toBe(true);
      expect(id).toBeGreaterThan(0);
    });

    it('Timestamps devem ser válidos', async () => {
      const company = await helper.createTestCompany();

      expect(company.created_at).toBeDefined();
      expect(company.updated_at).toBeDefined();
      
      const createdDate = new Date(company.created_at);
      const updatedDate = new Date(company.updated_at);

      expect(createdDate).toBeInstanceOf(Date);
      expect(updatedDate).toBeInstanceOf(Date);
      expect(createdDate.getTime()).not.toBeNaN();
      expect(updatedDate.getTime()).not.toBeNaN();
    });

    it('Status deve ser string válida', async () => {
      const company = await helper.createTestCompany();

      expect(typeof company.status).toBe('string');
      expect(['active', 'inactive', 'trial']).toContain(company.status);
    });
  });

  describe('Testes de Limites', () => {
    it('deve aceitar nomes de empresa muito longos', async () => {
      const longName = 'A'.repeat(255);
      const company = await helper.createTestCompany({
        company_name: longName
      });

      expect(company.company_name).toBe(longName);
      expect(company.company_name.length).toBe(255);
    });

    it('deve aceitar emails longos mas válidos', async () => {
      const longEmail = `muito-longo-${Date.now()}@dominio-super-grande.com.br`;
      const company = await helper.createTestCompany({
        admin_email: longEmail
      });

      expect(company.admin_email).toBe(longEmail);
    });

    it('deve aceitar telefones em diversos formatos', async () => {
      const phones = [
        '+55 11 98888-7777',
        '(11) 98888-7777',
        '11988887777',
        '+1 555-1234'
      ];

      for (const phone of phones) {
        const company = await helper.createTestCompany({
          admin_phone: phone
        });
        
        expect(company.admin_phone).toBe(phone);
      }
    });
  });

  describe('Testes de Segurança', () => {
    it('password_hash não deve ser retornado em createTestUser', async () => {
      const company = await helper.createTestCompany();
      const user = await helper.createTestUser(company.id, {
        password: 'SecretPass@123'
      });

      expect(user.password_hash).toBeUndefined();
      expect(user.password).toBeUndefined();
    });

    it('senha deve ser hasheada no banco', async () => {
      const company = await helper.createTestCompany();
      const password = 'MySecretPassword@123';
      
      const user = await helper.createTestUser(company.id, {
        email: 'hashtest@test.com',
        password: password
      });

      // Buscar hash do banco
      const result = await global.testPool.query(
        'SELECT password_hash FROM polox.users WHERE id = $1',
        [user.id]
      );

      const hash = result.rows[0].password_hash;

      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(50); // bcrypt hash é longo
      expect(hash).toMatch(/^\$2[aby]\$/); // bcrypt format
    });

    it('deve gerar hashes diferentes para mesma senha', async () => {
      const company = await helper.createTestCompany();
      const password = 'SamePassword@123';
      
      const user1 = await helper.createTestUser(company.id, {
        email: 'user1@hash.com',
        password: password
      });

      const user2 = await helper.createTestUser(company.id, {
        email: 'user2@hash.com',
        password: password
      });

      const result1 = await global.testPool.query(
        'SELECT password_hash FROM polox.users WHERE id = $1',
        [user1.id]
      );

      const result2 = await global.testPool.query(
        'SELECT password_hash FROM polox.users WHERE id = $1',
        [user2.id]
      );

      // Hashes devem ser diferentes (salt diferente)
      expect(result1.rows[0].password_hash).not.toBe(result2.rows[0].password_hash);
    });
  });
});
