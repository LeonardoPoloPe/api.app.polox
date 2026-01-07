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
 * POLO X - Performance Test Seed with ChatGPT
 * ============================================================================
 *
 * Script para popular banco de dados usando ChatGPT para gerar dados realistas
 * Objetivo: Testar performance com dados de alta qualidade
 */

require("dotenv").config();
const { query } = require("../../../src/config/database");
const axios = require("axios");

// ==========================================
// CONFIGURAÇÕES
// ==========================================
const CONFIG = {
  COMPANY_ID: 1,
  DATABASE: "app_polox_dev",
  BATCH_SIZE: 50, // Menor para não sobrecarregar ChatGPT
  TOTAL_CONTACTS: 100, // Começar com 100, depois aumentar
  CONTACTS_WITH_DEALS_PERCENTAGE: 60,
  DEALS_PER_CONTACT_AVG: 2,

  // ChatGPT API
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  OPENAI_MODEL: "gpt-3.5-turbo",
};

// ==========================================
// CHATGPT INTEGRATION
// ==========================================

/**
 * Gera dados de contatos usando ChatGPT
 */
async function generateContactsWithChatGPT(count) {
  const prompt = `Gere ${count} contatos brasileiros únicos em formato JSON. Cada contato deve ter:
- nome: nome completo brasileiro realista
- email: email único e válido (use domínios variados: gmail.com, outlook.com, yahoo.com, etc)
- phone: telefone celular brasileiro no formato 5511999999999 (com DDD real brasileiro)
- tipo: "lead" (75%) ou "cliente" (25%)
- status: escolha entre "novo", "em_contato", "qualificado", "proposta_enviada", "em_negociacao", "fechado", "perdido"
- lead_source: escolha entre "site", "whatsapp", "indicacao", "facebook", "instagram", "google"
- temperature: "frio", "morno" ou "quente"
- address_street: rua brasileira realista
- address_city: cidade brasileira real
- address_state: sigla de estado brasileiro (SP, RJ, MG, etc)
- address_postal_code: CEP brasileiro no formato 12345678

IMPORTANTE: 
- Todos os emails devem ser ÚNICOS
- Todos os telefones devem ser ÚNICOS
- Use DDDs reais brasileiros: 11, 21, 41, 47, 48, 51, 61, 71, 81, 85
- Não repita nomes

Retorne apenas um array JSON válido, sem explicações.`;

  try {
    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: CONFIG.OPENAI_MODEL,
        messages: [
          {
            role: "system",
            content:
              "Você é um gerador de dados de teste para um CRM brasileiro. Retorne sempre JSON válido, sem markdown ou explicações.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 1.0, // Mais aleatoriedade para garantir unicidade
        max_tokens: 4000,
      },
      {
        headers: {
          Authorization: `Bearer ${CONFIG.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const content = response.data.choices[0].message.content;

    // Limpar markdown se houver
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error("ChatGPT não retornou JSON válido");
    }

    const contacts = JSON.parse(jsonMatch[0]);
    return contacts;
  } catch (error) {
    console.error("Erro ao gerar contatos com ChatGPT:", error.message);
    if (error.response) {
      console.error("Resposta da API:", error.response.data);
    }
    throw error;
  }
}

/**
 * Gera dados de deals usando ChatGPT
 */
async function generateDealsWithChatGPT(count) {
  const prompt = `Gere ${count} oportunidades de vendas (deals) brasileiras em formato JSON. Cada deal deve ter:
- titulo: descrição realista de produto/serviço (ex: "Notebook Dell Inspiron", "Consultoria de TI", "Licença Microsoft 365")
- valor_total_cents: valor em centavos entre 50000 (R$ 500) e 5000000 (R$ 50.000)
- etapa_funil: sempre use "novo"
- origem: escolha entre "site", "whatsapp", "indicacao", "facebook", "instagram", "telefone"

Retorne apenas um array JSON válido, sem explicações.`;

  try {
    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: CONFIG.OPENAI_MODEL,
        messages: [
          {
            role: "system",
            content:
              "Você é um gerador de dados de teste. Retorne sempre JSON válido.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.9,
        max_tokens: 2000,
      },
      {
        headers: {
          Authorization: `Bearer ${CONFIG.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const content = response.data.choices[0].message.content;
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error("ChatGPT não retornou JSON válido");
    }

    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.error("Erro ao gerar deals com ChatGPT:", error.message);
    throw error;
  }
}

// ==========================================
// INSERÇÃO NO BANCO
// ==========================================

/**
 * Insere contatos em batch
 */
async function insertContactsBatch(contacts) {
  const values = [];
  const placeholders = [];

  contacts.forEach((contact, idx) => {
    const base = idx * 13;
    placeholders.push(
      `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${
        base + 5
      }, $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9}, $${
        base + 10
      }, $${base + 11}, $${base + 12}, $${base + 13})`
    );
    values.push(
      contact.nome,
      contact.email,
      contact.phone,
      null, // document_number
      contact.tipo,
      contact.status,
      contact.lead_source,
      contact.temperature,
      contact.address_street,
      contact.address_city,
      contact.address_state,
      contact.address_postal_code,
      CONFIG.COMPANY_ID
    );
  });

  const query_text = `
    INSERT INTO polox.contacts (
      nome, email, phone, document_number, tipo, status, lead_source, temperature,
      address_street, address_city, address_state, address_postal_code, company_id
    ) VALUES ${placeholders.join(", ")}
    RETURNING id
  `;

  try {
    const result = await query(query_text, values);
    return result.rows.map((row) => row.id);
  } catch (error) {
    console.error("Erro ao inserir contatos:", error.message);
    if (error.detail) {
      console.error("Detalhe:", error.detail);
    }
    throw error;
  }
}

/**
 * Insere deals em batch
 */
async function insertDealsBatch(deals) {
  const values = [];
  const placeholders = [];

  deals.forEach((deal, idx) => {
    const base = idx * 6;
    placeholders.push(
      `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${
        base + 5
      }, $${base + 6})`
    );
    values.push(
      CONFIG.COMPANY_ID,
      deal.contato_id,
      null, // owner_id
      deal.titulo,
      deal.etapa_funil,
      deal.valor_total_cents
    );
  });

  const query_text = `
    INSERT INTO polox.deals (
      company_id, contato_id, owner_id, titulo, etapa_funil, valor_total_cents
    ) VALUES ${placeholders.join(", ")}
    RETURNING id
  `;

  const result = await query(query_text, values);
  return result.rows.map((row) => row.id);
}

// ==========================================
// EXECUÇÃO PRINCIPAL
// ==========================================

async function main() {
  console.log("🚀 Iniciando seed com ChatGPT...\n");

  // Validar API Key
  if (!CONFIG.OPENAI_API_KEY) {
    console.error("❌ ERRO: OPENAI_API_KEY não configurada!");
    console.error(
      "   Configure a variável de ambiente OPENAI_API_KEY no arquivo .env"
    );
    console.error(
      "   Obtenha sua chave em: https://platform.openai.com/api-keys\n"
    );
    process.exit(1);
  }

  console.log("📊 Configurações:");
  console.log(`   - Database: ${CONFIG.DATABASE}`);
  console.log(`   - Company ID: ${CONFIG.COMPANY_ID}`);
  console.log(`   - Total de contatos: ${CONFIG.TOTAL_CONTACTS}`);
  console.log(`   - Batch size: ${CONFIG.BATCH_SIZE}`);
  console.log(`   - Usando: ChatGPT ${CONFIG.OPENAI_MODEL}\n`);

  const startTime = Date.now();
  let totalContacts = 0;
  let totalDeals = 0;

  try {
    // Calcular batches
    const batches = Math.ceil(CONFIG.TOTAL_CONTACTS / CONFIG.BATCH_SIZE);

    for (let i = 0; i < batches; i++) {
      const batchSize = Math.min(
        CONFIG.BATCH_SIZE,
        CONFIG.TOTAL_CONTACTS - totalContacts
      );

      console.log(
        `📝 Batch ${
          i + 1
        }/${batches}: Gerando ${batchSize} contatos com ChatGPT...`
      );

      // Gerar contatos com ChatGPT
      const contacts = await generateContactsWithChatGPT(batchSize);

      console.log(`   ✅ ChatGPT gerou ${contacts.length} contatos`);
      console.log(`   💾 Inserindo no banco de dados...`);

      // Inserir no banco
      const contactIds = await insertContactsBatch(contacts);
      totalContacts += contactIds.length;

      console.log(`   ✅ ${contactIds.length} contatos inseridos`);

      // Gerar deals para alguns contatos
      const dealsToCreate = [];

      for (const contactId of contactIds) {
        if (Math.random() * 100 < CONFIG.CONTACTS_WITH_DEALS_PERCENTAGE) {
          const numDeals =
            Math.floor(Math.random() * CONFIG.DEALS_PER_CONTACT_AVG) + 1;

          // Gerar deals com ChatGPT
          const deals = await generateDealsWithChatGPT(numDeals);

          deals.forEach((deal) => {
            dealsToCreate.push({
              ...deal,
              contato_id: contactId,
            });
          });
        }
      }

      // Inserir deals
      if (dealsToCreate.length > 0) {
        console.log(`   💼 Inserindo ${dealsToCreate.length} deals...`);
        const dealIds = await insertDealsBatch(dealsToCreate);
        totalDeals += dealIds.length;
        console.log(`   ✅ ${dealIds.length} deals inseridos`);
      }

      const progress = ((totalContacts / CONFIG.TOTAL_CONTACTS) * 100).toFixed(
        1
      );
      console.log(
        `   📊 Progresso: ${progress}% (${totalContacts}/${CONFIG.TOTAL_CONTACTS})\n`
      );

      // Pequeno delay para não sobrecarregar a API
      if (i < batches - 1) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    console.log("\n✅ Seed concluído com sucesso!\n");

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    console.log("📈 Estatísticas:");
    console.log(`   - Contatos criados: ${totalContacts}`);
    console.log(`   - Deals criados: ${totalDeals}`);
    console.log(`   - Tempo total: ${duration}s`);
    console.log(
      `   - Taxa: ${(totalContacts / duration).toFixed(0)} contatos/s\n`
    );

    console.log(
      "💡 Dica: Para gerar mais contatos, aumente CONFIG.TOTAL_CONTACTS no script\n"
    );
  } catch (error) {
    console.error("\n❌ Erro ao executar seed:", error);
    throw error;
  } finally {
    process.exit(0);
  }
}

// Executar
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main };
