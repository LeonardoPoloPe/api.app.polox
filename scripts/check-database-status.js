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
 * Script para verificar o status atual do banco de dados
 */

const { Pool } = require('pg');
require('dotenv').config();

const dbConfig = {
  host: process.env.DB_HOST || 'database-1.cd2em8e0a6ot.sa-east-1.rds.amazonaws.com',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'app_polox_dev',
  user: process.env.DB_USER || 'polox_dev_user',
  password: process.env.DB_PASSWORD,
  ssl: {
    rejectUnauthorized: false
  }
};

async function checkDatabaseStatus() {
  const pool = new Pool(dbConfig);
  
  try {
    console.log('🔍 Verificando status do banco de dados...');
    console.log('🔗 Conectando ao banco:', dbConfig.database, 'em', dbConfig.host);
    
    // Verificar tabelas existentes
    const tablesResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);
    
    console.log('\n📋 Tabelas existentes no banco:');
    if (tablesResult.rows.length === 0) {
      console.log('   ❌ Nenhuma tabela encontrada');
    } else {
      tablesResult.rows.forEach(row => {
        console.log(`   ✅ ${row.table_name}`);
      });
    }
    
    // Verificar se existe tabela migrations
    const migrationsTableExists = tablesResult.rows.some(row => row.table_name === 'migrations');
    
    if (migrationsTableExists) {
      console.log('\n📝 Migrations registradas:');
      const migrationsResult = await pool.query(`
        SELECT name, executed_at 
        FROM migrations 
        ORDER BY executed_at;
      `);
      
      if (migrationsResult.rows.length === 0) {
        console.log('   ❌ Nenhuma migration registrada na tabela');
      } else {
        migrationsResult.rows.forEach(row => {
          console.log(`   ✅ ${row.name} - ${row.executed_at}`);
        });
      }
    } else {
      console.log('\n❌ Tabela migrations não existe');
    }
    
    // Verificar estrutura da tabela users se existe
    const usersTableExists = tablesResult.rows.some(row => row.table_name === 'users');
    if (usersTableExists) {
      console.log('\n🔍 Estrutura da tabela users:');
      const columnsResult = await pool.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_name = 'users' 
        ORDER BY ordinal_position;
      `);
      
      columnsResult.rows.forEach(row => {
        console.log(`   📄 ${row.column_name}: ${row.data_type} ${row.is_nullable === 'NO' ? 'NOT NULL' : ''}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Erro ao verificar banco:', error);
  } finally {
    await pool.end();
  }
}

checkDatabaseStatus();