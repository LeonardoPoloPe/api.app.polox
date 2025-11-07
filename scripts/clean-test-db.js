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
 * Script para limpar o banco de teste
 * Uso: node scripts/clean-test-db.js
 */

const { Pool } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

// Carregar .env.test
dotenv.config({ path: path.join(__dirname, '../.env.test') });

async function cleanTestDatabase() {
  const pool = new Pool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: process.env.DB_HOST && process.env.DB_HOST.includes('rds.amazonaws.com') ? {
      rejectUnauthorized: false
    } : false,
  });

  try {
    console.log('🧹 Limpando banco de teste...');
    console.log(`📊 Host: ${process.env.DB_HOST}`);
    console.log(`🗄️  Banco: ${process.env.DB_NAME}`);

    // Remover schema polox (cascade remove todas as tabelas)
    await pool.query('DROP SCHEMA IF EXISTS polox CASCADE');
    console.log('✅ Schema polox removido');

    // Remover tabela de migrations se existir no schema public
    await pool.query('DROP TABLE IF EXISTS migrations CASCADE');
    console.log('✅ Tabela migrations removida');

    console.log('\n🎉 Banco de teste limpo com sucesso!');
    console.log('💡 Execute os testes para recriar as tabelas: npm test\n');
  } catch (error) {
    console.error('❌ Erro ao limpar banco:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

cleanTestDatabase();
