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
 * POLO X - Performance Test Seed
 * ============================================================================
 *
 * Script para popular banco de dados com volume massivo de contatos
 * Objetivo: Testar performance da aplicação com muitos registros
 */

require("dotenv").config();
const { query, pool } = require("../../../src/config/database");
const { faker } = require("@faker-js/faker");
const { pt_BR } = require("@faker-js/faker");

// Configurar locale para pt-BR
faker.locale = "pt_BR";

// ==========================================
// CONFIGURAÇÕES
// ==========================================
const CONFIG = {
  COMPANY_ID: 1, // Empresa Polox Demo Company
  BATCH_SIZE: 100, // Registros por batch
  TOTAL_CONTACTS: 11000000, // Total de contatos a criar (11000000milhoes para teste de performance)
  CONTACTS_WITH_DEALS_PERCENTAGE: 60, // 60% terão deals
  DEALS_PER_CONTACT_AVG: 2, // Média de deals por contato
  NOTES_PER_CONTACT_AVG: 0, // Média de notas por contato (desabilitado - requer user válido)
  OWNER_ID: null, // ID do usuário responsável (null = sem responsável)
  CREATED_BY_ID: null, // ID do usuário que cria notas (requer user ID válido)
  CLEAN_BEFORE_INSERT: false, // ⚠️ CUIDADO: true = deleta todos os dados da empresa antes de inserir
};

// ==========================================
// HELPERS
// ==========================================

// Sets para rastrear valores únicos
const usedEmails = new Set();
const usedPhones = new Set();
const usedDocuments = new Set();

/**
 * Gera telefone brasileiro válido e único
 * Usa timestamp para garantir unicidade total
 */
function generateBrazilianPhone() {
  let phone;
  let attempts = 0;
  do {
    const ddd = faker.helpers.arrayElement([
      "11",
      "21",
      "41",
      "47",
      "48",
      "51",
      "61",
      "71",
      "81",
      "85",
    ]);
    const prefix = faker.helpers.arrayElement(["9", "8", "7"]);
    // Usar timestamp nos últimos dígitos para garantir unicidade
    const timestamp = Date.now().toString();
    const uniqueDigits = timestamp.slice(-7); // Últimos 7 dígitos do timestamp
    const extraDigit = Math.floor(Math.random() * 10);
    phone = `55${ddd}${prefix}${uniqueDigits}${extraDigit}`;
    attempts++;
  } while (usedPhones.has(phone) && attempts < 100);

  usedPhones.add(phone);
  return phone;
}

/**
 * Gera email único com timestamp para garantir unicidade total
 */
function generateUniqueEmail() {
  let email;
  let attempts = 0;
  do {
    const firstName = faker.person.firstName().toLowerCase();
    const lastName = faker.person.lastName().toLowerCase();
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000);
    const domain = faker.helpers.arrayElement([
      "gmail.com",
      "outlook.com",
      "hotmail.com",
      "yahoo.com.br",
      "uol.com.br",
    ]);
    email = `${firstName}.${lastName}.${timestamp}${random}@${domain}`;
    attempts++;
  } while (usedEmails.has(email) && attempts < 100);

  usedEmails.add(email);
  return email;
}

/**
 * Gera CPF/CNPJ válido e único (simplificado)
 */
function generateDocument(isCNPJ = false) {
  let document;
  let attempts = 0;
  do {
    if (isCNPJ) {
      document = faker.string.numeric(14);
    } else {
      document = faker.string.numeric(11);
    }
    attempts++;
  } while (usedDocuments.has(document) && attempts < 100);

  usedDocuments.add(document);
  return document;
}

/**
 * Gera dados de contato realistas com valores únicos
 */
function generateContactData() {
  const tipo = faker.helpers.arrayElement(["lead", "lead", "lead", "cliente"]); // 75% leads
  const status = faker.helpers.arrayElement([
    "novo",
    "em_contato",
    "qualificado",
    "perdido",
    "descartado",
  ]);
  const lead_source = faker.helpers.arrayElement([
    "site",
    "whatsapp",
    "indicacao",
    "facebook",
    "instagram",
    "google",
  ]);
  const temperature = faker.helpers.arrayElement(["frio", "morno", "quente"]);

  // loss_reason é obrigatório para status perdido/descartado
  const loss_reason =
    status === "perdido" || status === "descartado"
      ? faker.helpers.arrayElement([
          "preco_alto",
          "sem_interesse",
          "sem_orcamento",
          "comprou_concorrente",
          "nao_respondeu",
          "fora_perfil",
        ])
      : null;

  return {
    nome: faker.person.fullName(),
    email: generateUniqueEmail(),
    phone: generateBrazilianPhone(),
    document:
      tipo === "cliente" ? generateDocument(faker.datatype.boolean()) : null,
    tipo,
    status,
    loss_reason,
    lead_source,
    temperature,
    address_street: faker.location.streetAddress(),
    address_city: faker.location.city(),
    address_state: faker.location.state({ abbreviated: true }),
    address_postal_code: faker.location.zipCode(),
    metadata: {
      source_detail: faker.helpers.arrayElement([
        "landing_page_1",
        "campanha_black_friday",
        "evento_local",
      ]),
      last_interaction: faker.date.recent({ days: 30 }).toISOString(),
    },
    owner_id: CONFIG.OWNER_ID,
    company_id: CONFIG.COMPANY_ID,
  };
}

/**
 * Gera dados de deal realistas
 */
function generateDealData(contactId) {
  const value = faker.number.int({ min: 50000, max: 5000000 }); // R$ 500 a R$ 50.000
  const origem = faker.helpers.arrayElement([
    "site",
    "whatsapp",
    "indicacao",
    "facebook",
    "instagram",
    "telefone",
  ]);

  return {
    contato_id: contactId,
    titulo: `${faker.commerce.productName()} - ${faker.company.buzzPhrase()}`,
    valor_total_cents: value,
    etapa_funil: "novo", // Usar valor padrão seguro
    origem,
    owner_id: CONFIG.OWNER_ID,
    company_id: CONFIG.COMPANY_ID,
  };
}

/**
 * Gera dados de nota realistas
 */
function generateNoteData(contactId) {
  const tipo = faker.helpers.arrayElement([
    "nota",
    "ligacao",
    "email",
    "reuniao",
    "whatsapp",
  ]);
  const templates = {
    nota: () => `Observação: ${faker.lorem.sentence()}`,
    ligacao: () =>
      `Ligação realizada às ${faker.date
        .recent()
        .toLocaleTimeString()}. ${faker.lorem.sentence()}`,
    email: () => `Email enviado: ${faker.lorem.paragraph()}`,
    reuniao: () =>
      `Reunião agendada para ${faker.date
        .future()
        .toLocaleDateString()}. ${faker.lorem.sentence()}`,
    whatsapp: () => `Mensagem WhatsApp: ${faker.lorem.sentences(2)}`,
  };

  return {
    contato_id: contactId,
    created_by_id: CONFIG.CREATED_BY_ID,
    content: templates[tipo](),
    type: tipo,
    company_id: CONFIG.COMPANY_ID,
  };
}

// ==========================================
// INSERÇÃO EM BATCH
// ==========================================

/**
 * Insere contatos em batch
 */
async function insertContactsBatch(contacts) {
  const values = [];
  const placeholders = [];

  contacts.forEach((contact, idx) => {
    const base = idx * 14;
    placeholders.push(
      `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${
        base + 5
      }, $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9}, $${
        base + 10
      }, $${base + 11}, $${base + 12}, $${base + 13}, $${base + 14})`
    );
    values.push(
      contact.nome,
      contact.email,
      contact.phone,
      contact.document,
      contact.tipo,
      contact.status,
      contact.loss_reason,
      contact.lead_source,
      contact.temperature,
      contact.address_street,
      contact.address_city,
      contact.address_state,
      contact.address_postal_code,
      contact.company_id
    );
  });

  const query_text = `
    INSERT INTO polox.contacts (
      nome, email, phone, document_number, tipo, status, loss_reason, lead_source, temperature,
      address_street, address_city, address_state, address_postal_code, company_id
    ) VALUES ${placeholders.join(", ")}
    RETURNING id
  `;

  const result = await query(query_text, values);
  return result.rows.map((row) => row.id);
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
      deal.company_id,
      deal.contato_id,
      deal.owner_id,
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

/**
 * Insere notas em batch
 */
async function insertNotesBatch(notes) {
  const values = [];
  const placeholders = [];

  notes.forEach((note, idx) => {
    const base = idx * 5;
    placeholders.push(
      `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5})`
    );
    values.push(
      note.company_id,
      note.contato_id,
      note.created_by_id,
      note.content,
      note.type
    );
  });

  const query_text = `
    INSERT INTO polox.contact_notes (
      company_id, contato_id, created_by_id, note_content, note_type
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
  console.log("🚀 Iniciando seed de performance...\n");
  console.log("📊 Configurações:");
  console.log(`   - Company ID: ${CONFIG.COMPANY_ID}`);
  console.log(`   - Total de contatos: ${CONFIG.TOTAL_CONTACTS}`);
  console.log(`   - Batch size: ${CONFIG.BATCH_SIZE}`);
  console.log(
    `   - Contatos com deals: ${CONFIG.CONTACTS_WITH_DEALS_PERCENTAGE}%`
  );
  console.log(
    `   - Média de deals por contato: ${CONFIG.DEALS_PER_CONTACT_AVG}`
  );
  console.log(
    `   - Média de notas por contato: ${CONFIG.NOTES_PER_CONTACT_AVG}`
  );
  console.log(
    `   - Limpar antes de inserir: ${
      CONFIG.CLEAN_BEFORE_INSERT ? "⚠️  SIM" : "NÃO"
    }`
  );

  const startTime = Date.now();
  let totalContacts = 0;
  let totalDeals = 0;
  let totalNotes = 0;

  try {
    // Limpar dados existentes se solicitado
    if (CONFIG.CLEAN_BEFORE_INSERT) {
      console.log("\n⚠️  LIMPANDO DADOS EXISTENTES...");

      await query("DELETE FROM polox.contact_notes WHERE company_id = $1", [
        CONFIG.COMPANY_ID,
      ]);
      console.log("   ✅ Notas deletadas");

      await query("DELETE FROM polox.deals WHERE company_id = $1", [
        CONFIG.COMPANY_ID,
      ]);
      console.log("   ✅ Deals deletados");

      await query("DELETE FROM polox.contacts WHERE company_id = $1", [
        CONFIG.COMPANY_ID,
      ]);
      console.log("   ✅ Contatos deletados\n");
    }

    // Criar contatos em batches
    console.log("👥 Criando contatos...");
    const batches = Math.ceil(CONFIG.TOTAL_CONTACTS / CONFIG.BATCH_SIZE);

    for (let i = 0; i < batches; i++) {
      const batchSize = Math.min(
        CONFIG.BATCH_SIZE,
        CONFIG.TOTAL_CONTACTS - totalContacts
      );
      const contacts = Array.from({ length: batchSize }, generateContactData);

      const contactIds = await insertContactsBatch(contacts);
      totalContacts += contactIds.length;

      // Criar deals para alguns contatos
      const dealsToCreate = [];
      const notesToCreate = [];

      for (const contactId of contactIds) {
        // Decidir se este contato terá deals
        if (Math.random() * 100 < CONFIG.CONTACTS_WITH_DEALS_PERCENTAGE) {
          const numDeals = faker.number.int({
            min: 1,
            max: CONFIG.DEALS_PER_CONTACT_AVG * 2,
          });
          for (let d = 0; d < numDeals; d++) {
            dealsToCreate.push(generateDealData(contactId));
          }
        }

        // Criar notas para o contato (se habilitado)
        if (CONFIG.NOTES_PER_CONTACT_AVG > 0) {
          const numNotes = faker.number.int({
            min: 1,
            max: CONFIG.NOTES_PER_CONTACT_AVG * 2,
          });
          for (let n = 0; n < numNotes; n++) {
            notesToCreate.push(generateNoteData(contactId));
          }
        }
      }

      // Inserir deals em batch
      if (dealsToCreate.length > 0) {
        const dealIds = await insertDealsBatch(dealsToCreate);
        totalDeals += dealIds.length;
      }

      // Inserir notas em batch
      if (notesToCreate.length > 0) {
        const noteIds = await insertNotesBatch(notesToCreate);
        totalNotes += noteIds.length;
      }

      const progress = ((totalContacts / CONFIG.TOTAL_CONTACTS) * 100).toFixed(
        1
      );
      process.stdout.write(
        `\r   Progresso: ${progress}% (${totalContacts}/${CONFIG.TOTAL_CONTACTS} contatos, ${totalDeals} deals, ${totalNotes} notas)`
      );
    }

    console.log("\n\n✅ Seed concluído com sucesso!\n");

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    console.log("📈 Estatísticas:");
    console.log(`   - Contatos criados: ${totalContacts}`);
    console.log(`   - Deals criados: ${totalDeals}`);
    console.log(`   - Notas criadas: ${totalNotes}`);
    console.log(`   - Tempo total: ${duration}s`);
    console.log(
      `   - Taxa: ${(totalContacts / duration).toFixed(0)} contatos/s`
    );
    console.log(
      `   - Taxa total: ${(
        (totalContacts + totalDeals + totalNotes) /
        duration
      ).toFixed(0)} registros/s\n`
    );
  } catch (error) {
    console.error("\n❌ Erro ao executar seed:", error);
    throw error;
  } finally {
    // Pool é gerenciado automaticamente pelo database config
    process.exit(0);
  }
}

// Executar
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main };
