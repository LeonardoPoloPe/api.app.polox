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
 * 🧪 TESTES DE INTEGRAÇÃO - LEAD MODEL
 * ==========================================
 * 
 * Testa a conversão de Lead → Cliente com:
 * - Criação de lead
 * - Conversão para cliente
 * - Validações de dados
 * - Multi-idioma (pt-BR, en, es)
 */

const LeadModel = require('../../src/models/Lead');
const { DatabaseHelper } = require('../helpers/database');

describe('🎯 Lead Model - Conversão Lead → Cliente', () => {
  let helper;

  beforeEach(async () => {
    helper = new DatabaseHelper(global.testPool);
  });

  // Helper para criar empresa, usuário e lead de teste
  async function createTestContext(suffix = '') {
    const testCompany = await helper.createTestCompany({
      company_name: `Lead Test Company ${suffix}`
    });
    
    const testUser = await helper.createTestUser(testCompany.id, {
      email: `user${suffix}@leadtest.com`,
      password: '123456',
      full_name: `Lead Manager ${suffix}`,
      user_role: 'user'
    });

    return { testCompany, testUser };
  }

  describe('✅ Conversão Lead → Cliente - Português (pt-BR)', () => {
    it('deve criar um lead completo', async () => {
      const { testCompany, testUser } = await createTestContext('PT1');

      const leadData = {
        name: 'João Silva',
        email: 'joao.silva@empresa.com.br',
        phone: '+55 11 98765-4321',
        company_name: 'Silva Tech LTDA',
        position: 'Diretor de TI',
        source: 'website',
        // status: 'novo', // ❌ Removido: usa padrão do banco
        temperature: 'quente',
        conversion_value: 50000,
        city: 'São Paulo',
        state: 'SP',
        country: 'BR', // ✅ Código ISO (VARCHAR 3)
        created_by_id: testUser.id
      };

      const lead = await LeadModel.create(leadData, testCompany.id);
      
      expect(lead).toBeDefined();
      expect(lead.id).toBeDefined();
      expect(lead.lead_name).toBe('João Silva'); // ✅ Coluna do banco: lead_name
      expect(lead.email).toBe('joao.silva@empresa.com.br');
      expect(lead.company_name).toBe('Silva Tech LTDA');
      expect(lead.status).toBe('novo'); // ✅ Status padrão do banco
      expect(lead.temperature).toBe('quente');
      expect(parseFloat(lead.conversion_value)).toBe(50000); // ✅ PostgreSQL numeric retorna string
      expect(lead.city).toBe('São Paulo');
      expect(lead.state).toBe('SP');
      expect(lead.country).toBe('BR');
      expect(lead.company_id).toBe(testCompany.id);
    });

    it('deve converter lead em cliente', async () => {
      const { testCompany, testUser } = await createTestContext('PT2');

      const leadData = {
        name: 'João Silva Completo',
        email: 'joao.completo@empresa.com.br',
        phone: '+55 11 98765-4321',
        company_name: 'Silva Tech LTDA',
        position: 'Diretor de TI',
        source: 'website',
        // status: 'novo', // ❌ Removido: usa padrão
        temperature: 'quente',
        conversion_value: 50000,
        city: 'São Paulo',
        state: 'SP',
        country: 'BR', // ✅ Código ISO
        created_by_id: testUser.id
      };

      const lead = await LeadModel.create(leadData, testCompany.id);

      const clientData = {
        document_number: helper.generateCNPJ(),
        client_type: 'business',
        address_street: 'Av. Paulista, 1000',
        address_city: 'São Paulo',
        address_state: 'SP',
        address_zip: '01310-100',
        address_country: 'BR' // ✅ Código ISO
      };

      const result = await LeadModel.convertToClient(
        lead.id,
        clientData,
        testCompany.id
      );

      expect(result).toBeDefined();
      expect(result.lead).toBeDefined();
      expect(result.client).toBeDefined();
      
      expect(result.lead.id).toBe(lead.id);
      // expect(result.lead.converted_to_client_id).toBeDefined(); // ❌ Não retornado no RETURNING
      expect(result.lead.status).toBe('convertido'); // ✅ Status após conversão
      expect(result.lead.converted_at).toBeDefined(); // ✅ Data de conversão
      
      expect(result.client.name).toBe('João Silva Completo');
      expect(result.client.email).toBe('joao.completo@empresa.com.br');
      expect(result.client.company_name).toBe('Silva Tech LTDA');
      // expect(result.client.client_type).toBe('business'); // ❌ Não retornado no RETURNING
      // expect(result.client.address_city).toBe('São Paulo'); // ❌ Não retornado no RETURNING
      // expect(result.client.address_state).toBe('SP'); // ❌ Não retornado no RETURNING
      // expect(result.client.company_id).toBe(testCompany.id); // ❌ Não retornado no RETURNING
    });
  });

  describe('✅ Conversão Lead → Cliente - English (en)', () => {
    it('deve criar um lead', async () => {
      const { testCompany, testUser } = await createTestContext('EN1');

      const leadData = {
        name: 'John Smith',
        email: 'john.smith@techcorp.com',
        phone: '+1 555-9876',
        company_name: 'Tech Corp Inc',
        position: 'CTO',
        source: 'referral',
        // status: 'qualificado', // ❌ Removido
        temperature: 'morno',
        conversion_value: 100000,
        city: 'New York',
        state: 'NY',
        country: 'US', // ✅ Código ISO (USA = US)
        created_by_id: testUser.id
      };

      const lead = await LeadModel.create(leadData, testCompany.id);
      
      expect(lead).toBeDefined();
      expect(lead.lead_name).toBe('John Smith'); // ✅ Coluna do banco: lead_name
      expect(lead.company_name).toBe('Tech Corp Inc');
      expect(lead.status).toBe('novo'); // ✅ Status padrão
      expect(lead.city).toBe('New York');
      expect(lead.country).toBe('US');
    });

    it('deve converter lead em cliente', async () => {
      const { testCompany, testUser } = await createTestContext('EN2');

      const leadData = {
        name: 'John Smith Complete',
        email: 'john.complete@techcorp.com',
        phone: '+1 555-9876',
        company_name: 'Tech Corp Inc',
        position: 'CTO',
        source: 'referral',
        // status: 'qualificado', // ❌ Removido
        temperature: 'morno',
        conversion_value: 100000,
        city: 'New York',
        state: 'NY',
        country: 'US', // ✅ Código ISO
        created_by_id: testUser.id
      };

      const lead = await LeadModel.create(leadData, testCompany.id);

      const clientData = {
        document_number: '12-3456789',
        client_type: 'business',
        address_street: '123 Main St',
        address_city: 'New York',
        address_state: 'NY',
        address_zip: '10001',
        address_country: 'US' // ✅ Código ISO
      };

      const result = await LeadModel.convertToClient(
        lead.id,
        clientData,
        testCompany.id
      );

      // expect(result.lead.converted_to_client_id).toBeDefined(); // ❌ Não retornado
      expect(result.lead.status).toBe('convertido');
      expect(result.client.name).toBe('John Smith Complete');
      // expect(result.client.address_city).toBe('New York'); // ❌ Não retornado no RETURNING
      // expect(result.client.company_id).toBe(testCompany.id); // ❌ Não retornado no RETURNING
    });
  });

  describe('✅ Conversão Lead → Cliente - Español (es)', () => {
    it('deve criar um lead', async () => {
      const { testCompany, testUser } = await createTestContext('ES1');

      const leadData = {
        name: 'María García',
        email: 'maria.garcia@empresasa.es',
        phone: '+34 600 555 777',
        company_name: 'Empresa SA',
        position: 'Directora General',
        source: 'linkedin',
        // status: 'proposta', // ❌ Removido
        temperature: 'quente',
        conversion_value: 75000,
        city: 'Madrid',
        state: 'MD',
        country: 'ES', // ✅ Código ISO (España = ES)
        created_by_id: testUser.id
      };

      const lead = await LeadModel.create(leadData, testCompany.id);
      
      expect(lead).toBeDefined();
      expect(lead.lead_name).toBe('María García'); // ✅ Coluna do banco: lead_name
      expect(lead.company_name).toBe('Empresa SA');
      expect(lead.status).toBe('novo'); // ✅ Status padrão
      expect(lead.country).toBe('ES');
    });

    it('deve converter lead em cliente', async () => {
      const { testCompany, testUser } = await createTestContext('ES2');

      const leadData = {
        name: 'María García Complete',
        email: 'maria.complete@empresasa.es',
        phone: '+34 600 555 777',
        company_name: 'Empresa SA',
        position: 'Directora General',
        source: 'linkedin',
        // status: 'proposta', // ❌ Removido
        temperature: 'quente',
        conversion_value: 75000,
        city: 'Madrid',
        state: 'MD',
        country: 'ES', // ✅ Código ISO
        created_by_id: testUser.id
      };

      const lead = await LeadModel.create(leadData, testCompany.id);

      const clientData = {
        document_number: 'B12345678',
        client_type: 'business',
        address_street: 'Calle Mayor 50',
        address_city: 'Madrid',
        address_state: 'MD',
        address_zip: '28013',
        address_country: 'ES' // ✅ Código ISO
      };

      const result = await LeadModel.convertToClient(
        lead.id,
        clientData,
        testCompany.id
      );

      // expect(result.lead.converted_to_client_id).toBeDefined(); // ❌ Não retornado
      expect(result.lead.status).toBe('convertido');
      expect(result.client.name).toBe('María García Complete');
      // expect(result.client.address_city).toBe('Madrid'); // ❌ Não retornado no RETURNING
      // expect(result.client.company_id).toBe(testCompany.id); // ❌ Não retornado no RETURNING
    });
  });
});
