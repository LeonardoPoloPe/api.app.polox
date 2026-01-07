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
 * Script rápido para popular banco com dados de teste
 * Volume: 1.000 contatos + deals
 */

require("dotenv").config();
const { query } = require("../../../src/config/database");
const { faker } = require("@faker-js/faker");

// Configuração
const CONFIG = {
  COMPANY_ID: 1,
  TOTAL_CONTACTS: 1000, // Começar com 1k
  BATCH_SIZE: 100,
  CONTACTS_WITH_DEALS_PERCENTAGE: 60,
  DEALS_PER_CONTACT_AVG: 2,
};

// Sets para garantir unicidade
const usedEmails = new Set();
const usedPhones = new Set();

function generateUniqueEmail() {
  let email;
  do {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000);
    email = `usuario${timestamp}${random}@teste.com`;
  } while (usedEmails.has(email));
  usedEmails.add(email);
  return email;
}

function generateUniquePhone() {
  let phone;
  do {
    const ddd = faker.helpers.arrayElement(["11", "21", "41", "47", "48"]);
    const timestamp = Date.now().toString().slice(-7);
    phone = `55${ddd}9${timestamp}${Math.floor(Math.random() * 10)}`;
  } while (usedPhones.has(phone));
  usedPhones.add(phone);
  return phone;
}

function generateContactData() {
  const tipo = Math.random() > 0.25 ? "lead" : "cliente";
  const status = faker.helpers.arrayElement([
    "novo",
    "em_contato",
    "qualificado",
  ]);

  return {
    nome: faker.person.fullName(),
    email: generateUniqueEmail(),
    phone: generateUniquePhone(),
    tipo,
    status,
    lead_source: faker.helpers.arrayElement(["site", "whatsapp", "indicacao"]),
    temperature: faker.helpers.arrayElement(["frio", "morno", "quente"]),
    company_id: CONFIG.COMPANY_ID,
  };
}

function generateDealData(contactId) {
  return {
    contato_id: contactId,
    titulo: `${faker.commerce.productName()} - Venda`,
    valor_total_cents: faker.number.int({ min: 50000, max: 5000000 }),
    etapa_funil: "novo",
    company_id: CONFIG.COMPANY_ID,
  };
}

async function insertContactsBatch(contacts) {
  const values = [];
  const placeholders = [];

  contacts.forEach((contact, idx) => {
    const base = idx * 8;
    placeholders.push(
      `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${
        base + 5
      }, $${base + 6}, $${base + 7}, $${base + 8})`
    );
    values.push(
      contact.nome,
      contact.email,
      contact.phone,
      contact.tipo,
      contact.status,
      contact.lead_source,
      contact.temperature,
      contact.company_id
    );
  });

  const queryText = `
    INSERT INTO polox.contacts (
      nome, email, phone, tipo, status, lead_source, temperature, company_id
    ) VALUES ${placeholders.join(", ")}
    RETURNING id
  `;

  const result = await query(queryText, values);
  return result.rows.map((row) => row.id);
}

async function insertDealsBatch(deals) {
  if (deals.length === 0) return [];

  const values = [];
  const placeholders = [];

  deals.forEach((deal, idx) => {
    const base = idx * 5;
    placeholders.push(
      `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5})`
    );
    values.push(
      deal.company_id,
      deal.contato_id,
      deal.titulo,
      deal.etapa_funil,
      deal.valor_total_cents
    );
  });

  const queryText = `
    INSERT INTO polox.deals (
      company_id, contato_id, titulo, etapa_funil, valor_total_cents
    ) VALUES ${placeholders.join(", ")}
    RETURNING id
  `;

  const result = await query(queryText, values);
  return result.rows.map((row) => row.id);
}

async function main() {
  console.log("🚀 Seed rápido - Teste de carga\n");
  console.log(`📊 Criando ${CONFIG.TOTAL_CONTACTS} contatos...\n`);

  const startTime = Date.now();
  let totalContacts = 0;
  let totalDeals = 0;

  try {
    const batches = Math.ceil(CONFIG.TOTAL_CONTACTS / CONFIG.BATCH_SIZE);

    for (let i = 0; i < batches; i++) {
      const batchSize = Math.min(
        CONFIG.BATCH_SIZE,
        CONFIG.TOTAL_CONTACTS - totalContacts
      );
      const contacts = Array.from({ length: batchSize }, generateContactData);

      // Inserir contatos
      const contactIds = await insertContactsBatch(contacts);
      totalContacts += contactIds.length;

      // Criar deals para alguns contatos
      const dealsToCreate = [];
      for (const contactId of contactIds) {
        if (Math.random() * 100 < CONFIG.CONTACTS_WITH_DEALS_PERCENTAGE) {
          const numDeals =
            Math.floor(Math.random() * CONFIG.DEALS_PER_CONTACT_AVG) + 1;
          for (let d = 0; d < numDeals; d++) {
            dealsToCreate.push(generateDealData(contactId));
          }
        }
      }

      // Inserir deals
      if (dealsToCreate.length > 0) {
        const dealIds = await insertDealsBatch(dealsToCreate);
        totalDeals += dealIds.length;
      }

      const progress = ((totalContacts / CONFIG.TOTAL_CONTACTS) * 100).toFixed(
        1
      );
      process.stdout.write(
        `\r   Progresso: ${progress}% (${totalContacts}/${CONFIG.TOTAL_CONTACTS} contatos, ${totalDeals} deals)`
      );
    }

    console.log("\n\n✅ Seed concluído!\n");

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log("📈 Estatísticas:");
    console.log(`   - Contatos: ${totalContacts}`);
    console.log(`   - Deals: ${totalDeals}`);
    console.log(`   - Tempo: ${duration}s`);
    console.log(
      `   - Taxa: ${(totalContacts / duration).toFixed(0)} contatos/s\n`
    );
  } catch (error) {
    console.error("\n❌ Erro:", error.message);
    throw error;
  } finally {
    process.exit(0);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main };
