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
 * 🌱 SEED: Criar usuário admin para sandbox
 * 
 * Este script cria um usuário super_admin para testes no ambiente sandbox
 * 
 * Uso:
 *   node scripts/seed-admin-sandbox.js
 * 
 * Credenciais criadas:
 *   Email: admin@polox.com
 *   Senha: Admin@2024
 */

require('dotenv').config();
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

const pool = new Pool({
  host: 'database-1.cd2em8e0a6ot.sa-east-1.rds.amazonaws.com',
  port: 5432,
  database: 'app_polox_sandbox',
  user: 'polox_sandbox_user',
  password: 'PoloxHjdfhrhcvfBCSsgdo2x12',
  ssl: {
    rejectUnauthorized: false
  }
});

async function createAdminUser() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 Verificando se usuário admin já existe...');
    
    // Verificar se usuário existe
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
      return;
    }
    
    console.log('👤 Criando novo usuário admin...');
    
    // 1. Primeiro, verificar se existe uma empresa ou criar uma
    let companyId;
    const companyCheck = await client.query(
      'SELECT id FROM polox.companies ORDER BY id LIMIT 1'
    );
    
    if (companyCheck.rows.length > 0) {
      companyId = companyCheck.rows[0].id;
      console.log(`📦 Usando empresa existente: ${companyId}`);
    } else {
      // Criar empresa de teste
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
        RETURNING id
      `, ['Polox CRM Sandbox', 'polox-sandbox', 'enterprise', 'sandbox.polox.com', 'active']);
      
      companyId = companyInsert.rows[0].id;
      console.log(`📦 Empresa criada: ${companyId}`);
    }
    
    // 2. Gerar hash da senha
    const passwordHash = await bcrypt.hash('Admin@2024', 12);
    
    // 3. Inserir usuário
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
      'Administrador Sandbox',
      'super_admin',
      'active'
    ]);
    
    console.log('✅ Usuário criado com sucesso!');
    console.log('📋 Dados:', insertResult.rows[0]);
    console.log('\n🔐 Credenciais:');
    console.log('   Email: admin@polox.com');
    console.log('   Senha: Admin@2024');
    
  } catch (error) {
    console.error('❌ Erro ao criar usuário:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Executar
createAdminUser()
  .then(() => {
    console.log('\n✨ Script concluído com sucesso!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n💥 Erro fatal:', error);
    process.exit(1);
  });
