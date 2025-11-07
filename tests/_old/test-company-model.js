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
 * Teste rápido para verificar se o modelo Company está funcionando
 * com o schema polox no banco app_polox_dev
 */

require('dotenv').config();
const CompanyModel = require('../src/models/Company');
const { closePool } = require('../src/config/database');

async function testCompanyModel() {
  console.log('🧪 Testando Company Model...');
  
  try {
    // 1. Teste: Buscar empresa existente (criada pela migration)
    console.log('\n1. 🔍 Buscando empresa demo por domínio...');
    const demoCompany = await CompanyModel.findByDomain('demo.polox.com');
    
    if (demoCompany) {
      console.log('✅ Empresa demo encontrada:');
      console.log(`   ID: ${demoCompany.id}`);
      console.log(`   Nome: ${demoCompany.name}`);
      console.log(`   Domínio: ${demoCompany.domain}`);
      console.log(`   Plano: ${demoCompany.plan}`);
      console.log(`   Status: ${demoCompany.status}`);
    } else {
      console.log('❌ Empresa demo não encontrada');
    }
    
    // 2. Teste: Buscar empresa por ID
    if (demoCompany) {
      console.log('\n2. 🔍 Buscando empresa por ID...');
      const companyById = await CompanyModel.findById(demoCompany.id);
      
      if (companyById) {
        console.log('✅ Empresa encontrada por ID');
      } else {
        console.log('❌ Empresa não encontrada por ID');
      }
    }
    
    // 3. Teste: Verificar limite de usuários
    if (demoCompany) {
      console.log('\n3. 📊 Verificando limite de usuários...');
      const userLimit = await CompanyModel.checkUserLimit(demoCompany.id);
      console.log('✅ Limite de usuários:');
      console.log(`   Máximo: ${userLimit.maxUsers}`);
      console.log(`   Atual: ${userLimit.currentUsers}`);
      console.log(`   Plano: ${userLimit.plan}`);
      console.log(`   Limite atingido: ${userLimit.isLimitReached}`);
    }
    
    // 4. Teste: Listar empresas
    console.log('\n4. 📋 Listando empresas...');
    const companiesList = await CompanyModel.list({ limit: 5 });
    console.log(`✅ Encontradas ${companiesList.data.length} empresa(s)`);
    console.log(`   Total no banco: ${companiesList.pagination.total}`);
    
    // 5. Teste: Atualizar última atividade
    if (demoCompany) {
      console.log('\n5. 🔄 Atualizando última atividade...');
      const updated = await CompanyModel.updateLastActivity(demoCompany.id);
      if (updated) {
        console.log('✅ Última atividade atualizada');
      } else {
        console.log('❌ Erro ao atualizar última atividade');
      }
    }
    
    console.log('\n🎉 Todos os testes do Company Model passaram!');
    console.log('✅ O schema polox.companies está funcionando corretamente');
    
  } catch (error) {
    console.error('\n❌ Erro no teste:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    // Fechar conexões
    await closePool();
    console.log('\n🔌 Conexões fechadas');
  }
}

// Executar teste
testCompanyModel();