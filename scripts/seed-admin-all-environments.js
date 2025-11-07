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

#!/usr/bin/env node

/**
 * 🌱 SEED: Criar usuário admin em TODOS os ambientes
 * 
 * Cria usuários super_admin para DEV, SANDBOX e PROD
 * 
 * Credenciais criadas:
 *   Email: admin@polox.com
 *   Senha: Admin@2024
 */

require('dotenv').config();
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

const environments = {
  dev: {
    host: 'database-1.cd2em8e0a6ot.sa-east-1.rds.amazonaws.com',
    port: 5432,
    database: 'app_polox_dev',
    user: 'polox_dev_user',
    password: 'SenhaSeguraDev123!'
  },
  sandbox: {
    host: 'database-1.cd2em8e0a6ot.sa-east-1.rds.amazonaws.com',
    port: 5432,
    database: 'app_polox_sandbox',
    user: 'polox_sandbox_user',
    password: 'PoloxHjdfhrhcvfBCSsgdo2x12'
  }
  // PROD será adicionado quando tiver credenciais
};

async function createAdminInEnvironment(envName, config) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🌍 Processando ambiente: ${envName.toUpperCase()}`);
  console.log('='.repeat(60));
  
  const pool = new Pool({
    ...config,
    ssl: { rejectUnauthorized: false }
  });
  
  const client = await pool.connect();
  
  try {
    // 1. Verificar se usuário já existe
    console.log('🔍 Verificando se usuário admin já existe...');
    
    const checkResult = await client.query(
      'SELECT id, email, full_name, user_role, status FROM polox.users WHERE email = $1',
      ['admin@polox.com']
    );
    
    if (checkResult.rows.length > 0) {
      console.log('⚠️  Usuário admin@polox.com já existe!');
      console.log('📋 Dados:', checkResult.rows[0]);
      
      // Atualizar senha e status
      console.log('🔄 Atualizando senha para Admin@2024...');
      const passwordHash = await bcrypt.hash('Admin@2024', 12);
      
      await client.query(
        'UPDATE polox.users SET password_hash = $1, status = $2, updated_at = NOW() WHERE email = $3',
        [passwordHash, 'active', 'admin@polox.com']
      );
      
      console.log('✅ Senha atualizada com sucesso!');
      return { success: true, action: 'updated' };
    }
    
    // 2. Buscar ou criar empresa
    console.log('👤 Criando novo usuário admin...');
    
    let companyId;
    const companyCheck = await client.query(
      'SELECT id, company_name FROM polox.companies ORDER BY id LIMIT 1'
    );
    
    if (companyCheck.rows.length > 0) {
      companyId = companyCheck.rows[0].id;
      console.log(`📦 Usando empresa existente: ${companyCheck.rows[0].company_name} (ID: ${companyId})`);
    } else {
      // Criar empresa de teste
      const slug = `polox-${envName}`;
      const companyInsert = await client.query(`
        INSERT INTO polox.companies (
          company_name,
          slug,
          plan,
          company_domain,
          status,
          created_at,
          updated_at
        ) VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
        RETURNING id, company_name
      `, [`Polox CRM ${envName.toUpperCase()}`, slug, 'enterprise', `${envName}.polox.com`, 'active']);
      
      companyId = companyInsert.rows[0].id;
      console.log(`📦 Empresa criada: ${companyInsert.rows[0].company_name} (ID: ${companyId})`);
    }
    
    // 3. Gerar hash da senha
    const passwordHash = await bcrypt.hash('Admin@2024', 12);
    
    // 4. Inserir usuário
    const insertResult = await client.query(`
      INSERT INTO polox.users (
        company_id,
        email,
        password_hash,
        full_name,
        user_role,
        status,
        email_verified_at,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW(), NOW())
      RETURNING id, email, full_name, user_role, status, created_at
    `, [
      companyId,
      'admin@polox.com',
      passwordHash,
      `Administrador ${envName.toUpperCase()}`,
      'super_admin',
      'active'
    ]);
    
    console.log('✅ Usuário criado com sucesso!');
    console.log('📋 Dados:', insertResult.rows[0]);
    
    return { success: true, action: 'created' };
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
    return { success: false, error: error.message };
  } finally {
    client.release();
    await pool.end();
  }
}

async function main() {
  console.log('\n🚀 CRIANDO USUÁRIOS ADMIN EM TODOS OS AMBIENTES\n');
  console.log('🔐 Credenciais:');
  console.log('   Email: admin@polox.com');
  console.log('   Senha: Admin@2024');
  console.log('   Role: super_admin');
  
  const results = {};
  
  for (const [envName, config] of Object.entries(environments)) {
    try {
      results[envName] = await createAdminInEnvironment(envName, config);
    } catch (error) {
      console.error(`\n❌ Erro fatal no ambiente ${envName}:`, error.message);
      results[envName] = { success: false, error: error.message };
    }
  }
  
  // Resumo
  console.log('\n' + '='.repeat(60));
  console.log('📊 RESUMO FINAL');
  console.log('='.repeat(60));
  console.log('');
  
  for (const [envName, result] of Object.entries(results)) {
    const icon = result.success ? '✅' : '❌';
    const status = result.success ? 
      (result.action === 'created' ? 'CRIADO' : 'ATUALIZADO') : 
      'FALHOU';
    console.log(`${icon} ${envName.toUpperCase()}: ${status}`);
    if (!result.success && result.error) {
      console.log(`   ⚠️  ${result.error}`);
    }
  }
  
  const allSuccess = Object.values(results).every(r => r.success);
  
  console.log('');
  if (allSuccess) {
    console.log('✨ Todos os usuários foram criados/atualizados com sucesso!');
    process.exit(0);
  } else {
    console.log('⚠️  Alguns ambientes falharam. Verifique os erros acima.');
    process.exit(1);
  }
}

main().catch(error => {
  console.error('\n💥 Erro fatal:', error);
  process.exit(1);
});
