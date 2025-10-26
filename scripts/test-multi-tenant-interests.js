require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: { rejectUnauthorized: false }
});

async function testMultiTenantInterests() {
  const client = await pool.connect();
  
  try {
    console.log('\n🧪 TESTE: Tabela polox.interests Multi-Tenant\n');
    console.log('=' .repeat(60));
    
    // 1. Criar interesses globais (company_id = NULL)
    console.log('\n📌 1. Criando interesses GLOBAIS (sistema):\n');
    
    const globalInterests = ['ERP', 'CRM', 'Cloud Computing', 'Machine Learning'];
    
    for (const name of globalInterests) {
      await client.query(`
        INSERT INTO polox.interests (name, category, company_id)
        VALUES ($1, 'technology', NULL)
        ON CONFLICT (name) WHERE company_id IS NULL 
        DO NOTHING
      `, [name]);
      console.log(`  ✅ ${name} (global)`);
    }
    
    // 2. Buscar IDs de empresas para teste
    const companies = await client.query(`
      SELECT id, name FROM polox.companies LIMIT 2
    `);
    
    if (companies.rows.length < 2) {
      console.log('\n⚠️  Necessário pelo menos 2 empresas para testar multi-tenancy');
      return;
    }
    
    const company1 = companies.rows[0];
    const company2 = companies.rows[1];
    
    console.log(`\n📌 2. Testando com empresas:\n`);
    console.log(`  Empresa 1: ${company1.name} (ID: ${company1.id})`);
    console.log(`  Empresa 2: ${company2.name} (ID: ${company2.id})`);
    
    // 3. Criar interesses específicos para Empresa 1
    console.log(`\n📌 3. Criando interesses para ${company1.name}:\n`);
    
    await client.query(`
      INSERT INTO polox.interests (name, category, company_id)
      VALUES 
        ('Marketing Digital', 'service', $1),
        ('Vendas B2B', 'service', $1),
        ('Automação', 'technology', $1)
      ON CONFLICT (company_id, name) WHERE company_id IS NOT NULL 
      DO NOTHING
    `, [company1.id]);
    console.log(`  ✅ Marketing Digital (empresa ${company1.id})`);
    console.log(`  ✅ Vendas B2B (empresa ${company1.id})`);
    console.log(`  ✅ Automação (empresa ${company1.id})`);
    
    // 4. Criar interesses específicos para Empresa 2
    console.log(`\n📌 4. Criando interesses para ${company2.name}:\n`);
    
    await client.query(`
      INSERT INTO polox.interests (name, category, company_id)
      VALUES 
        ('Marketing Digital', 'service', $1),
        ('Consultoria TI', 'service', $1),
        ('Treinamento', 'service', $1)
      ON CONFLICT (company_id, name) WHERE company_id IS NOT NULL 
      DO NOTHING
    `, [company2.id]);
    console.log(`  ✅ Marketing Digital (empresa ${company2.id}) - MESMO NOME!`);
    console.log(`  ✅ Consultoria TI (empresa ${company2.id})`);
    console.log(`  ✅ Treinamento (empresa ${company2.id})`);
    
    // 5. Testar que interesses com mesmo nome podem existir para empresas diferentes
    console.log(`\n📌 5. Verificando interesses "Marketing Digital":\n`);
    
    const marketingInterests = await client.query(`
      SELECT id, name, company_id, category,
        CASE WHEN company_id IS NULL THEN 'GLOBAL' ELSE 'EMPRESA ' || company_id END as tipo
      FROM polox.interests
      WHERE name = 'Marketing Digital'
      ORDER BY company_id NULLS FIRST
    `);
    
    marketingInterests.rows.forEach(row => {
      console.log(`  ID: ${row.id} | Nome: ${row.name} | Tipo: ${row.tipo} | Categoria: ${row.category}`);
    });
    
    // 6. Listar todos os interesses disponíveis para Empresa 1 (globais + seus próprios)
    console.log(`\n📌 6. Interesses disponíveis para ${company1.name}:\n`);
    
    const availableForCompany1 = await client.query(`
      SELECT 
        id, 
        name, 
        category,
        CASE 
          WHEN company_id IS NULL THEN '🌍 GLOBAL'
          WHEN company_id = $1 THEN '🏢 PRÓPRIO'
          ELSE '🔒 OUTRA EMPRESA'
        END as tipo
      FROM polox.interests
      WHERE company_id IS NULL OR company_id = $1
      ORDER BY company_id NULLS FIRST, name
    `, [company1.id]);
    
    console.log(`  Total: ${availableForCompany1.rows.length} interesses\n`);
    availableForCompany1.rows.forEach(row => {
      console.log(`  ${row.tipo} | ${row.name} (${row.category})`);
    });
    
    // 7. Tentar criar interesse duplicado dentro da mesma empresa (deve falhar silenciosamente)
    console.log(`\n📌 7. Tentando criar interesse duplicado na mesma empresa:\n`);
    
    try {
      const result = await client.query(`
        INSERT INTO polox.interests (name, category, company_id)
        VALUES ('Marketing Digital', 'service', $1)
        ON CONFLICT (company_id, name) WHERE company_id IS NOT NULL 
        DO NOTHING
        RETURNING id
      `, [company1.id]);
      
      if (result.rows.length === 0) {
        console.log(`  ✅ Conflict detectado e ignorado (comportamento esperado)`);
      } else {
        console.log(`  ⚠️  Interesse criado (não esperado)`);
      }
    } catch (error) {
      console.log(`  ❌ Erro: ${error.message}`);
    }
    
    // 8. Estatísticas finais
    console.log(`\n📌 8. Estatísticas finais:\n`);
    
    const stats = await client.query(`
      SELECT 
        COUNT(*) FILTER (WHERE company_id IS NULL) as globais,
        COUNT(*) FILTER (WHERE company_id IS NOT NULL) as empresas,
        COUNT(DISTINCT company_id) FILTER (WHERE company_id IS NOT NULL) as num_empresas,
        COUNT(*) as total
      FROM polox.interests
    `);
    
    const s = stats.rows[0];
    console.log(`  🌍 Interesses globais: ${s.globais}`);
    console.log(`  🏢 Interesses de empresas: ${s.empresas}`);
    console.log(`  🏭 Número de empresas com interesses: ${s.num_empresas}`);
    console.log(`  📊 Total de interesses: ${s.total}`);
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ TESTE CONCLUÍDO COM SUCESSO!\n');
    
  } catch (error) {
    console.error('\n❌ Erro no teste:', error.message);
    console.error(error.stack);
  } finally {
    client.release();
    await pool.end();
  }
}

testMultiTenantInterests();
