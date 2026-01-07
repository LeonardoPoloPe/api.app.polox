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
 * POLO X - Companies & Users Seed
 * ============================================================================
 *
 * Script para popular banco de dados com companies e users
 * Objetivo: Criar estrutura hierárquica de empresas e usuários
 */

require("dotenv").config();
const { query } = require("../../src/config/database");
const { faker } = require("@faker-js/faker");
const bcrypt = require("bcryptjs");

// Configurar locale para pt-BR
faker.locale = "pt_BR";

// ==========================================
// CONFIGURAÇÕES
// ==========================================
const CONFIG = {
  TOTAL_COMPANIES: 100, // Total de companies a criar
  TOTAL_USERS: 100, // Total de users a criar
  PARENT_COMPANY_ID: 1, // ID da empresa pai (Polox Demo Company)
  DEFAULT_PASSWORD: "123456@Mudar", // Senha padrão
  CLEAN_BEFORE_INSERT: false, // ⚠️ CUIDADO: true = deleta dados
};

// ==========================================
// HELPERS
// ==========================================

const usedEmails = new Set();
const usedDomains = new Set();
const usedSlugs = new Set();

/**
 * Gera hash de senha usando bcrypt
 */
async function hashPassword(password) {
  return await bcrypt.hash(password, 10);
}

/**
 * Gera email único
 */
function generateUniqueEmail() {
  let email;
  let attempts = 0;
  do {
    const firstName = faker.person.firstName().toLowerCase();
    const lastName = faker.person.lastName().toLowerCase();
    const random = Math.floor(Math.random() * 1000);
    const domain = faker.helpers.arrayElement([
      "gmail.com",
      "outlook.com",
      "hotmail.com",
      "yahoo.com.br",
    ]);
    email = `${firstName}.${lastName}${random}@${domain}`;
    attempts++;
  } while (usedEmails.has(email) && attempts < 100);

  usedEmails.add(email);
  return email;
}

/**
 * Gera domain único para company
 */
function generateUniqueDomain() {
  let domain;
  let attempts = 0;
  do {
    const companyName = faker.company
      .name()
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
    const random = Math.floor(Math.random() * 1000);
    domain = `${companyName}${random}.com.br`;
    attempts++;
  } while (usedDomains.has(domain) && attempts < 100);

  usedDomains.add(domain);
  return domain;
}

/**
 * Gera slug único para company
 */
function generateUniqueSlug(name) {
  let slug;
  let attempts = 0;
  do {
    const baseName = name.toLowerCase().replace(/[^a-z0-9]/g, "-");
    const random = Math.floor(Math.random() * 1000);
    slug = `${baseName}-${random}`;
    attempts++;
  } while (usedSlugs.has(slug) && attempts < 100);

  usedSlugs.add(slug);
  return slug;
}

/**
 * Gera dados de company realistas com hierarquia
 */
function generateCompanyData(parentCompanyId = null) {
  const company_name = faker.company.name();
  const company_domain = generateUniqueDomain();
  const slug = generateUniqueSlug(company_name);

  const subscription_plan = faker.helpers.arrayElement([
    "starter",
    "professional",
    "enterprise",
  ]);
  const status = faker.helpers.arrayElement([
    "active",
    "active",
    "active",
    "trial",
    "suspended",
  ]); // 60% active

  // Adicionar parent_company_id no settings para hierarquia
  const settings = {
    maxUploadSize: "5MB",
    allowPublicRegistration: false,
    requireEmailVerification: true,
    parent_company_id: parentCompanyId,
  };

  return {
    company_name,
    company_domain,
    slug,
    subscription_plan,
    status,
    max_users:
      subscription_plan === "starter"
        ? 5
        : subscription_plan === "professional"
        ? 20
        : 100,
    max_storage_mb:
      subscription_plan === "starter"
        ? 1000
        : subscription_plan === "professional"
        ? 5000
        : 50000,
    industry: faker.helpers.arrayElement([
      "tecnologia",
      "varejo",
      "servicos",
      "industria",
      "saude",
      "educacao",
    ]),
    company_size: faker.helpers.arrayElement([
      "1-10",
      "11-50",
      "51-200",
      "200+",
    ]),
    country: "BR",
    timezone: "America/Sao_Paulo",
    default_language: "pt-BR",
    enabled_modules: JSON.stringify([
      "dashboard",
      "users",
      "contacts",
      "deals",
      "kanban",
    ]),
    settings: JSON.stringify(settings),
    admin_name: faker.person.fullName(),
    admin_email: generateUniqueEmail(),
    admin_phone: faker.phone.number("11#########").substring(0, 20), // Limitar a 20 chars
  };
}

/**
 * Gera dados de user realistas
 */
function generateUserData(companyId) {
  const full_name = faker.person.fullName();
  const email = generateUniqueEmail();

  const user_role = faker.helpers.arrayElement([
    "admin",
    "manager",
    "user",
    "user",
    "user",
  ]); // 60% users
  const status = faker.helpers.arrayElement([
    "active",
    "active",
    "active",
    "inactive",
  ]); // 75% active

  return {
    company_id: companyId,
    full_name,
    email,
    user_role,
    status,
    phone: faker.phone.number("11#########").substring(0, 20), // Limitar a 20 chars
    user_position: faker.person.jobTitle(),
    department: faker.helpers.arrayElement([
      "Vendas",
      "Marketing",
      "TI",
      "RH",
      "Financeiro",
    ]),
    user_language: "pt-BR",
    timezone: "America/Sao_Paulo",
    preferences: JSON.stringify({
      notifications: true,
      emailUpdates: true,
      dashboard_layout: "default",
    }),
  };
}

// ==========================================
// INSERÇÃO
// ==========================================

/**
 * Cria usuários específicos do Polox
 */
async function createPoloxUsers(passwordHash) {
  console.log("👥 Criando usuários Polox...");

  const users = [
    {
      company_id: CONFIG.PARENT_COMPANY_ID,
      full_name: "Leonardo Polo",
      email: "polo@polox.com.br",
      password_hash: passwordHash,
      user_role: "admin",
      status: "active",
      phone: "(11) 98765-4321",
      user_position: "CEO",
      department: "Diretoria",
      user_language: "pt-BR",
      timezone: "America/Sao_Paulo",
    },
    {
      company_id: CONFIG.PARENT_COMPANY_ID,
      full_name: "Rafael",
      email: "rafael@polox.com.br",
      password_hash: passwordHash,
      user_role: "admin",
      status: "active",
      phone: "(11) 98765-1234",
      user_position: "CTO",
      department: "TI",
      user_language: "pt-BR",
      timezone: "America/Sao_Paulo",
    },
  ];

  for (const user of users) {
    // Verificar se já existe
    const existing = await query(
      "SELECT id FROM polox.users WHERE email = $1 AND company_id = $2",
      [user.email, user.company_id]
    );

    if (existing.rows.length > 0) {
      console.log(`   ⏭️  ${user.email} já existe`);
      continue;
    }

    await query(
      `INSERT INTO polox.users (
        company_id, full_name, email, password_hash, user_role, status,
        phone, user_position, department, user_language, timezone
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        user.company_id,
        user.full_name,
        user.email,
        user.password_hash,
        user.user_role,
        user.status,
        user.phone,
        user.user_position,
        user.department,
        user.user_language,
        user.timezone,
      ]
    );

    console.log(`   ✅ ${user.email} criado com sucesso`);
  }
}

/**
 * Cria companies com hierarquia
 */
async function createCompanies() {
  console.log("\n🏢 Criando companies...");

  const createdCompanyIds = [CONFIG.PARENT_COMPANY_ID]; // Começar com parent
  let totalCompanies = 0;

  for (let i = 0; i < CONFIG.TOTAL_COMPANIES; i++) {
    // Escolher parent aleatório entre companies já criadas
    const parentId = faker.helpers.arrayElement(createdCompanyIds);
    const companyData = generateCompanyData(parentId);

    const result = await query(
      `INSERT INTO polox.companies (
        company_name, company_domain, slug, subscription_plan, status, max_users, max_storage_mb,
        industry, company_size, country, timezone, default_language,
        enabled_modules, settings, admin_name, admin_email, admin_phone
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      RETURNING id`,
      [
        companyData.company_name,
        companyData.company_domain,
        companyData.slug,
        companyData.subscription_plan,
        companyData.status,
        companyData.max_users,
        companyData.max_storage_mb,
        companyData.industry,
        companyData.company_size,
        companyData.country,
        companyData.timezone,
        companyData.default_language,
        companyData.enabled_modules,
        companyData.settings,
        companyData.admin_name,
        companyData.admin_email,
        companyData.admin_phone,
      ]
    );

    const newCompanyId = result.rows[0].id;
    createdCompanyIds.push(newCompanyId);
    totalCompanies++;

    if ((i + 1) % 10 === 0) {
      process.stdout.write(
        `\r   Progresso: ${(
          (totalCompanies / CONFIG.TOTAL_COMPANIES) *
          100
        ).toFixed(1)}% (${totalCompanies}/${CONFIG.TOTAL_COMPANIES} companies)`
      );
    }
  }

  console.log(`\n   ✅ ${totalCompanies} companies criadas com sucesso\n`);
  return createdCompanyIds;
}

/**
 * Cria users vinculados às companies
 */
async function createUsers(companyIds, passwordHash) {
  console.log("👤 Criando users...");

  let totalUsers = 0;

  for (let i = 0; i < CONFIG.TOTAL_USERS; i++) {
    // Escolher company aleatória (excluir parent para distribuir melhor)
    const companyId = faker.helpers.arrayElement(
      companyIds.slice(1) // Pular PARENT_COMPANY_ID
    );
    const userData = generateUserData(companyId);

    await query(
      `INSERT INTO polox.users (
        company_id, full_name, email, password_hash, user_role, status,
        phone, user_position, department, user_language, timezone, preferences
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        userData.company_id,
        userData.full_name,
        userData.email,
        passwordHash,
        userData.user_role,
        userData.status,
        userData.phone,
        userData.user_position,
        userData.department,
        userData.user_language,
        userData.timezone,
        userData.preferences,
      ]
    );

    totalUsers++;

    if ((i + 1) % 10 === 0) {
      process.stdout.write(
        `\r   Progresso: ${((totalUsers / CONFIG.TOTAL_USERS) * 100).toFixed(
          1
        )}% (${totalUsers}/${CONFIG.TOTAL_USERS} users)`
      );
    }
  }

  console.log(`\n   ✅ ${totalUsers} users criados com sucesso\n`);
}

// ==========================================
// EXECUÇÃO PRINCIPAL
// ==========================================

async function main() {
  console.log("🚀 Iniciando seed de companies e users...\n");
  console.log("📊 Configurações:");
  console.log(`   - Parent Company ID: ${CONFIG.PARENT_COMPANY_ID}`);
  console.log(`   - Total de companies: ${CONFIG.TOTAL_COMPANIES}`);
  console.log(`   - Total de users: ${CONFIG.TOTAL_USERS}`);
  console.log(`   - Senha padrão: ${CONFIG.DEFAULT_PASSWORD}`);
  console.log(
    `   - Limpar antes de inserir: ${
      CONFIG.CLEAN_BEFORE_INSERT ? "⚠️  SIM" : "NÃO"
    }`
  );

  const startTime = Date.now();

  try {
    // Gerar hash da senha padrão
    console.log("\n🔐 Gerando hash de senha...");
    const passwordHash = await hashPassword(CONFIG.DEFAULT_PASSWORD);
    console.log("   ✅ Hash gerado com sucesso");

    // Limpar dados existentes se solicitado
    if (CONFIG.CLEAN_BEFORE_INSERT) {
      console.log("\n⚠️  LIMPANDO DADOS EXISTENTES...");
      await query("DELETE FROM polox.users WHERE company_id > 1");
      console.log("   ✅ Users deletados");
      await query("DELETE FROM polox.companies WHERE id > 1");
      console.log("   ✅ Companies deletadas\n");
    }

    // Criar usuários Polox específicos
    await createPoloxUsers(passwordHash);

    // Criar companies com hierarquia
    const companyIds = await createCompanies();

    // Criar users aleatórios
    await createUsers(companyIds, passwordHash);

    console.log("✅ Seed concluído com sucesso!\n");

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    console.log("📈 Estatísticas:");
    console.log(`   - Companies criadas: ${CONFIG.TOTAL_COMPANIES}`);
    console.log(
      `   - Users criados: ${CONFIG.TOTAL_USERS + 2} (incluindo polo e rafael)`
    );
    console.log(`   - Tempo total: ${duration}s`);
    console.log(`   - Senha padrão para todos: ${CONFIG.DEFAULT_PASSWORD}\n`);

    console.log("🔑 Credenciais Polox:");
    console.log("   - polo@polox.com.br / 123456@Mudar");
    console.log("   - rafael@polox.com.br / 123456@Mudar\n");
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
