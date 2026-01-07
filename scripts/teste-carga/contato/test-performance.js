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
 * ============================================================================
 * POLO X - Performance Test Suite
 * ============================================================================
 *
 * Script para testar performance de endpoints críticos
 * Simula carga real de usuários
 */

require("dotenv").config();
const axios = require("axios");

// ==========================================
// CONFIGURAÇÕES
// ==========================================
const CONFIG = {
  API_URL: process.env.API_URL || "http://localhost:3000/api",
  TOKEN: process.env.TEST_TOKEN || "", // Cole seu token JWT aqui
  COMPANY_ID: 1,

  // Configurações de teste
  TESTS: {
    LIST_CONTACTS: {
      enabled: true,
      iterations: 50,
      limits: [10, 50, 100, 200], // Diferentes tamanhos de página
    },
    SEARCH_CONTACTS: {
      enabled: true,
      iterations: 30,
      searchTerms: ["Silva", "João", "Maria", "Santos", "11", "21"],
    },
    GET_CONTACT: {
      enabled: true,
      iterations: 100,
    },
    LIST_DEALS: {
      enabled: true,
      iterations: 30,
    },
    LIST_NOTES: {
      enabled: true,
      iterations: 20,
    },
  },
};

// ==========================================
// HELPERS
// ==========================================

class PerformanceMetrics {
  constructor(name) {
    this.name = name;
    this.times = [];
    this.errors = 0;
    this.success = 0;
  }

  addTime(ms) {
    this.times.push(ms);
    this.success++;
  }

  addError() {
    this.errors++;
  }

  getStats() {
    if (this.times.length === 0) {
      return null;
    }

    const sorted = [...this.times].sort((a, b) => a - b);
    const avg = this.times.reduce((a, b) => a + b, 0) / this.times.length;
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const p50 = sorted[Math.floor(sorted.length * 0.5)];
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    const p99 = sorted[Math.floor(sorted.length * 0.99)];

    return {
      name: this.name,
      total: this.times.length + this.errors,
      success: this.success,
      errors: this.errors,
      avg: avg.toFixed(2),
      min: min.toFixed(2),
      max: max.toFixed(2),
      p50: p50.toFixed(2),
      p95: p95.toFixed(2),
      p99: p99.toFixed(2),
    };
  }
}

/**
 * Cria cliente HTTP configurado
 */
function createHttpClient() {
  return axios.create({
    baseURL: CONFIG.API_URL,
    headers: {
      Authorization: `Bearer ${CONFIG.TOKEN}`,
      "Accept-Language": "pt-BR",
    },
    timeout: 30000,
  });
}

/**
 * Executa teste de endpoint
 */
async function testEndpoint(name, request, iterations = 1) {
  const metrics = new PerformanceMetrics(name);
  const client = createHttpClient();

  console.log(`\n🧪 Testando: ${name} (${iterations} iterações)`);

  for (let i = 0; i < iterations; i++) {
    try {
      const start = Date.now();
      await request(client);
      const duration = Date.now() - start;
      metrics.addTime(duration);

      // Progress bar
      if ((i + 1) % 10 === 0 || i === iterations - 1) {
        const progress = (((i + 1) / iterations) * 100).toFixed(0);
        process.stdout.write(
          `\r   Progresso: ${progress}% (${i + 1}/${iterations})`
        );
      }
    } catch (error) {
      metrics.addError();
      if (error.response) {
        console.error(
          `\n   ⚠️  Erro ${error.response.status}: ${
            error.response.data?.message || "Unknown"
          }`
        );
      } else {
        console.error(`\n   ⚠️  Erro de rede: ${error.message}`);
      }
    }

    // Pequeno delay para não sobrecarregar
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  console.log(""); // Nova linha após progress
  return metrics;
}

// ==========================================
// TESTES ESPECÍFICOS
// ==========================================

/**
 * Teste: Listar contatos com diferentes tamanhos de página
 */
async function testListContacts() {
  const results = [];
  const config = CONFIG.TESTS.LIST_CONTACTS;

  if (!config.enabled) {
    console.log("\n⏭️  Teste LIST_CONTACTS desabilitado");
    return results;
  }

  console.log("\n📋 === TESTE: LISTAR CONTATOS ===");

  for (const limit of config.limits) {
    const metrics = await testEndpoint(
      `GET /contacts?limit=${limit}`,
      (client) => client.get(`/contacts?limit=${limit}&offset=0`),
      config.iterations
    );
    results.push(metrics);
  }

  return results;
}

/**
 * Teste: Buscar contatos por termo
 */
async function testSearchContacts() {
  const results = [];
  const config = CONFIG.TESTS.SEARCH_CONTACTS;

  if (!config.enabled) {
    console.log("\n⏭️  Teste SEARCH_CONTACTS desabilitado");
    return results;
  }

  console.log("\n🔍 === TESTE: BUSCAR CONTATOS ===");

  for (const term of config.searchTerms) {
    const metrics = await testEndpoint(
      `GET /contacts?search=${term}`,
      (client) => client.get(`/contacts?search=${term}&limit=50`),
      config.iterations
    );
    results.push(metrics);
  }

  return results;
}

/**
 * Teste: Buscar contato por ID (aleatório)
 */
async function testGetContact() {
  const config = CONFIG.TESTS.GET_CONTACT;

  if (!config.enabled) {
    console.log("\n⏭️  Teste GET_CONTACT desabilitado");
    return [];
  }

  console.log("\n👤 === TESTE: BUSCAR CONTATO POR ID ===");

  // Primeiro, pegar lista de IDs disponíveis
  const client = createHttpClient();
  const response = await client.get("/contacts?limit=100");
  const contactIds = response.data.data.map((c) => c.id);

  if (contactIds.length === 0) {
    console.log("   ⚠️  Nenhum contato encontrado para testar");
    return [];
  }

  const metrics = await testEndpoint(
    "GET /contacts/:id",
    (client) => {
      const randomId =
        contactIds[Math.floor(Math.random() * contactIds.length)];
      return client.get(`/contacts/${randomId}`);
    },
    config.iterations
  );

  return [metrics];
}

/**
 * Teste: Listar deals
 */
async function testListDeals() {
  const config = CONFIG.TESTS.LIST_DEALS;

  if (!config.enabled) {
    console.log("\n⏭️  Teste LIST_DEALS desabilitado");
    return [];
  }

  console.log("\n💼 === TESTE: LISTAR DEALS ===");

  const metrics = await testEndpoint(
    "GET /deals?limit=50",
    (client) => client.get("/deals?limit=50&offset=0"),
    config.iterations
  );

  return [metrics];
}

/**
 * Teste: Listar notas
 */
async function testListNotes() {
  const config = CONFIG.TESTS.LIST_NOTES;

  if (!config.enabled) {
    console.log("\n⏭️  Teste LIST_NOTES desabilitado");
    return [];
  }

  console.log("\n📝 === TESTE: LISTAR NOTAS ===");

  const metrics = await testEndpoint(
    "GET /notes?limit=50",
    (client) => client.get("/notes?limit=50&offset=0"),
    config.iterations
  );

  return [metrics];
}

// ==========================================
// RELATÓRIO
// ==========================================

function printReport(allMetrics) {
  console.log("\n\n");
  console.log("═══════════════════════════════════════════════════════════");
  console.log("📊 RELATÓRIO DE PERFORMANCE");
  console.log("═══════════════════════════════════════════════════════════\n");

  console.log(
    "┌─────────────────────────────────────────────────────────────────────────┐"
  );
  console.log(
    "│ Endpoint                        │  Avg  │  Min  │  Max  │  P95  │  P99  │"
  );
  console.log(
    "├─────────────────────────────────────────────────────────────────────────┤"
  );

  for (const metrics of allMetrics) {
    const stats = metrics.getStats();
    if (!stats) continue;

    const name = stats.name.padEnd(31);
    const avg = `${stats.avg}ms`.padStart(6);
    const min = `${stats.min}ms`.padStart(6);
    const max = `${stats.max}ms`.padStart(6);
    const p95 = `${stats.p95}ms`.padStart(6);
    const p99 = `${stats.p99}ms`.padStart(6);

    const emoji =
      parseFloat(stats.avg) < 100
        ? "🟢"
        : parseFloat(stats.avg) < 500
        ? "🟡"
        : "🔴";
    console.log(
      `│ ${emoji} ${name}│ ${avg} │ ${min} │ ${max} │ ${p95} │ ${p99} │`
    );

    if (stats.errors > 0) {
      console.log(
        `│    ⚠️  Erros: ${stats.errors}/${stats.total}                                           │`
      );
    }
  }

  console.log(
    "└─────────────────────────────────────────────────────────────────────────┘\n"
  );

  // Análise geral
  const totalRequests = allMetrics.reduce((sum, m) => sum + m.times.length, 0);
  const totalErrors = allMetrics.reduce((sum, m) => sum + m.errors, 0);
  const avgTimes = allMetrics.map((m) => m.times).flat();
  const overallAvg =
    avgTimes.length > 0
      ? (avgTimes.reduce((a, b) => a + b, 0) / avgTimes.length).toFixed(2)
      : 0;

  console.log("📈 Resumo Geral:");
  console.log(`   - Total de requisições: ${totalRequests + totalErrors}`);
  console.log(
    `   - Requisições bem-sucedidas: ${totalRequests} (${(
      (totalRequests / (totalRequests + totalErrors)) *
      100
    ).toFixed(1)}%)`
  );
  console.log(`   - Erros: ${totalErrors}`);
  console.log(`   - Tempo médio geral: ${overallAvg}ms`);
  console.log("");

  // Recomendações
  console.log("💡 Recomendações:");
  const slowEndpoints = allMetrics.filter((m) => {
    const stats = m.getStats();
    return stats && parseFloat(stats.avg) > 500;
  });

  if (slowEndpoints.length > 0) {
    console.log("   🔴 Endpoints lentos detectados (>500ms):");
    slowEndpoints.forEach((m) => {
      const stats = m.getStats();
      console.log(`      - ${stats.name}: ${stats.avg}ms`);
    });
    console.log("   → Considere adicionar índices ou otimizar queries");
  } else {
    console.log("   ✅ Todos os endpoints estão com boa performance");
  }

  if (totalErrors > 0) {
    console.log(`\n   ⚠️  ${totalErrors} erros detectados`);
    console.log("   → Verifique logs para mais detalhes");
  }

  console.log(
    "\n═══════════════════════════════════════════════════════════\n"
  );
}

// ==========================================
// EXECUÇÃO PRINCIPAL
// ==========================================

async function main() {
  console.log("🚀 Iniciando testes de performance...\n");
  console.log("⚙️  Configurações:");
  console.log(`   - API URL: ${CONFIG.API_URL}`);
  console.log(`   - Company ID: ${CONFIG.COMPANY_ID}`);
  console.log(`   - Token configurado: ${CONFIG.TOKEN ? "✅" : "❌"}`);

  if (!CONFIG.TOKEN) {
    console.error("\n❌ Erro: TOKEN não configurado!");
    console.error("   Configure a variável TEST_TOKEN no .env ou no script");
    process.exit(1);
  }

  const allMetrics = [];

  try {
    // Executar todos os testes
    const contactsMetrics = await testListContacts();
    allMetrics.push(...contactsMetrics);

    const searchMetrics = await testSearchContacts();
    allMetrics.push(...searchMetrics);

    const getMetrics = await testGetContact();
    allMetrics.push(...getMetrics);

    const dealsMetrics = await testListDeals();
    allMetrics.push(...dealsMetrics);

    const notesMetrics = await testListNotes();
    allMetrics.push(...notesMetrics);

    // Gerar relatório
    printReport(allMetrics.filter((m) => m.times.length > 0));
  } catch (error) {
    console.error("\n❌ Erro ao executar testes:", error.message);
    throw error;
  }
}

// Executar
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main };
