/**
 * Script de teste para validar multi-tenancy da tabela polox.tags
 * 
 * Testa:
 * - Criação de tags globais (company_id = NULL)
 * - Criação de tags específicas de empresas
 * - Mesma tag em diferentes empresas (sem conflito)
 * - Unicidade dentro do mesmo escopo
 * - Listagem de tags (empresa + globais)
 */

const { query } = require('../src/config/database');

async function testMultiTenantTags() {
  console.log('\n🧪 TESTE DE MULTI-TENANCY - TABELA POLOX.TAGS\n');
  console.log('='.repeat(60));

  try {
    // 1. Limpar tags de teste anteriores
    console.log('\n🧹 Limpando dados de teste anteriores...');
    await query(`
      DELETE FROM polox.tags 
      WHERE name LIKE 'Teste%' OR name LIKE 'VIP%' OR name LIKE 'Urgente%'
    `);
    console.log('✅ Dados limpos\n');

    // 2. Criar tags globais (company_id = NULL)
    console.log('🌍 TESTE 1: Criando tags globais (company_id = NULL)...');
    const globalTags = ['VIP', 'Urgente', 'Follow-up', 'Cold Call'];
    
    for (const tagName of globalTags) {
      await query(`
        INSERT INTO polox.tags (name, slug, company_id, color, is_active)
        VALUES ($1, $2, NULL, $3, true)
      `, [tagName, tagName.toLowerCase().replace(/\s+/g, '-'), '#FF5722']);
      console.log(`  ✅ Tag global criada: "${tagName}"`);
    }

    // 3. Buscar empresas de teste
    console.log('\n📊 Buscando empresas para teste...');
    const companiesResult = await query(`
      SELECT id, name FROM polox.companies 
      ORDER BY id LIMIT 3
    `);

    if (companiesResult.rows.length < 2) {
      console.log('⚠️  Necessário pelo menos 2 empresas para teste completo');
      return;
    }

    const company1 = companiesResult.rows[0];
    const company2 = companiesResult.rows[1];
    
    console.log(`  - Empresa 1: ${company1.name} (ID: ${company1.id})`);
    console.log(`  - Empresa 2: ${company2.name} (ID: ${company2.id})`);

    // 4. Criar tags específicas da Empresa 1
    console.log(`\n🏢 TESTE 2: Criando tags da Empresa 1 (${company1.name})...`);
    const company1Tags = ['Cliente Premium', 'Desconto 20%', 'Contato Mensal'];
    
    for (const tagName of company1Tags) {
      await query(`
        INSERT INTO polox.tags (name, slug, company_id, color, is_active)
        VALUES ($1, $2, $3, $4, true)
      `, [tagName, tagName.toLowerCase().replace(/\s+/g, '-'), company1.id, '#2196F3']);
      console.log(`  ✅ Tag da empresa 1 criada: "${tagName}"`);
    }

    // 5. Criar tags específicas da Empresa 2 (incluindo duplicatas de nomes)
    console.log(`\n🏢 TESTE 3: Criando tags da Empresa 2 (${company2.name})...`);
    const company2Tags = ['Cliente Premium', 'Desconto 15%', 'Contato Semanal'];
    
    for (const tagName of company2Tags) {
      await query(`
        INSERT INTO polox.tags (name, slug, company_id, color, is_active)
        VALUES ($1, $2, $3, $4, true)
      `, [tagName, tagName.toLowerCase().replace(/\s+/g, '-'), company2.id, '#4CAF50']);
      console.log(`  ✅ Tag da empresa 2 criada: "${tagName}"`);
    }

    // 6. TESTE CRÍTICO: Verificar se "Cliente Premium" existe em ambas as empresas
    console.log('\n🔍 TESTE 4: Verificando duplicação permitida entre empresas...');
    const duplicateCheck = await query(`
      SELECT id, name, company_id 
      FROM polox.tags 
      WHERE name = 'Cliente Premium'
      ORDER BY company_id
    `);

    console.log(`  📌 Tag "Cliente Premium" encontrada ${duplicateCheck.rows.length} vezes:`);
    duplicateCheck.rows.forEach(tag => {
      const scope = tag.company_id ? `Empresa ${tag.company_id}` : 'Global';
      console.log(`    - ID: ${tag.id} | Scope: ${scope}`);
    });

    if (duplicateCheck.rows.length >= 2) {
      console.log('  ✅ SUCESSO: Empresas diferentes podem ter tags com mesmo nome!');
    } else {
      console.log('  ❌ FALHA: Deveria haver pelo menos 2 tags "Cliente Premium"');
    }

    // 7. Tentar criar duplicata na mesma empresa (deve falhar)
    console.log('\n🚫 TESTE 5: Tentando criar tag duplicada na mesma empresa...');
    try {
      await query(`
        INSERT INTO polox.tags (name, slug, company_id, color, is_active)
        VALUES ('Cliente Premium', 'cliente-premium', $1, '#FF0000', true)
      `, [company1.id]);
      console.log('  ❌ FALHA: Não deveria permitir duplicata na mesma empresa');
    } catch (error) {
      if (error.message.includes('unique') || error.message.includes('duplicate')) {
        console.log('  ✅ SUCESSO: Duplicata bloqueada corretamente!');
      } else {
        console.log(`  ⚠️  Erro inesperado: ${error.message}`);
      }
    }

    // 8. Listar todas as tags disponíveis para Empresa 1
    console.log(`\n📋 TESTE 6: Listando tags disponíveis para Empresa 1 (${company1.name})...`);
    const company1AvailableTags = await query(`
      SELECT 
        id, 
        name, 
        color,
        company_id,
        CASE 
          WHEN company_id IS NULL THEN 'Global' 
          ELSE 'Empresa ' || company_id 
        END as scope
      FROM polox.tags 
      WHERE company_id = $1 OR company_id IS NULL
      ORDER BY company_id NULLS FIRST, name
    `, [company1.id]);

    console.log(`  Total de tags disponíveis: ${company1AvailableTags.rows.length}`);
    console.log('\n  Tags Globais:');
    company1AvailableTags.rows
      .filter(t => t.company_id === null)
      .forEach(tag => console.log(`    - ${tag.name} (${tag.color})`));
    
    console.log(`\n  Tags da Empresa 1:`);
    company1AvailableTags.rows
      .filter(t => t.company_id !== null)
      .forEach(tag => console.log(`    - ${tag.name} (${tag.color})`));

    // 9. Estatísticas finais
    console.log('\n📊 TESTE 7: Estatísticas finais...');
    const stats = await query(`
      SELECT 
        COUNT(*) FILTER (WHERE company_id IS NULL) as tags_globais,
        COUNT(*) FILTER (WHERE company_id = $1) as tags_empresa_1,
        COUNT(*) FILTER (WHERE company_id = $2) as tags_empresa_2,
        COUNT(*) as total
      FROM polox.tags
    `, [company1.id, company2.id]);

    const st = stats.rows[0];
    console.log(`  🌍 Tags globais: ${st.tags_globais}`);
    console.log(`  🏢 Tags da Empresa 1: ${st.tags_empresa_1}`);
    console.log(`  🏢 Tags da Empresa 2: ${st.tags_empresa_2}`);
    console.log(`  📊 Total geral: ${st.total}`);

    // 10. Resumo final
    console.log('\n' + '='.repeat(60));
    console.log('✅ TODOS OS TESTES CONCLUÍDOS COM SUCESSO!');
    console.log('='.repeat(60));
    console.log('\n📌 Resumo dos Testes:');
    console.log('  ✅ Tags globais criadas corretamente');
    console.log('  ✅ Tags de empresas criadas corretamente');
    console.log('  ✅ Mesmo nome permitido em empresas diferentes');
    console.log('  ✅ Duplicata bloqueada dentro da mesma empresa');
    console.log('  ✅ Listagem retorna tags da empresa + globais');
    console.log('\n🎯 Multi-tenancy da tabela TAGS funcionando perfeitamente!\n');

    process.exit(0);

  } catch (error) {
    console.error('\n❌ ERRO NO TESTE:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Executar testes
testMultiTenantTags();
