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

const { query, transaction } = require("../config/database");
const { ApiError, ValidationError, NotFoundError } = require("../utils/errors");

/**
 * Model para gerenciamento de contatos (identidade unificada de leads + clientes)
 * Tabela: polox.contacts
 *
 * Arquitetura: "Identidade vs. Intenção"
 * - Identidade (Contact): Quem a pessoa é (nome, telefone, email, documento)
 * - Intenção (Deal): O que a pessoa quer comprar (negociações/pipeline)
 *
 * Constraints implementadas (banco de dados):
 * 1. UNIQUE (company_id, phone) - Previne duplicação por telefone
 * 2. UNIQUE (company_id, email) - Previne duplicação por email
 * 3. UNIQUE (company_id, document_number) - Previne duplicação por CPF/CNPJ
 * 4. CHECK (phone IS NOT NULL OR email IS NOT NULL OR document_number IS NOT NULL) - Anti-fantasma
 */
class Contact {
  /**
   * Normaliza telefone para formato padrão (apenas dígitos)
   * @param {string} phone - Telefone bruto
   * @returns {string|null} Telefone normalizado ou null
   */
  static normalizePhone(phone) {
    if (!phone) return null;
    return phone.replace(/\D/g, "");
  }

  /**
   * Normaliza email para lowercase
   * @param {string} email - Email bruto
   * @returns {string|null} Email normalizado ou null
   */
  static normalizeEmail(email) {
    if (!email) return null;
    return email.toLowerCase().trim();
  }

  /**
   * Normaliza documento (CPF/CNPJ) para apenas dígitos
   * @param {string} document - Documento bruto
   * @returns {string|null} Documento normalizado ou null
   */
  static normalizeDocument(document) {
    if (!document) return null;
    return document.replace(/\D/g, "");
  }

  /**
   * Gera variantes do telefone considerando a regra do WhatsApp (prefixo 55)
   * - Sempre normaliza para dígitos
   * - Se começar com 55, também tenta a variante sem 55
   * - Se não começar com 55, também tenta a variante com 55 prefixado
   * @param {string} rawPhone
   * @returns {string[]} Lista de variantes únicas (dígitos)
   */
  static generatePhoneVariants(rawPhone) {
    const digits = this.normalizePhone(rawPhone);
    if (!digits) return [];

    const variantsSet = new Set();
    variantsSet.add(digits);

    if (digits.startsWith("55")) {
      const without55 = digits.slice(2);
      if (without55 && without55.length >= 8) {
        variantsSet.add(without55);
      }
    } else {
      variantsSet.add(`55${digits}`);
    }

    return Array.from(variantsSet);
  }

  /**
   * Busca contato por múltiplas variantes de telefone (com/sem 55)
   * @param {number} companyId
   * @param {string} phone
   * @param {boolean} includeDeleted
   * @returns {Promise<Object|null>}
   */
  static async findByPhoneVariants(companyId, phone, includeDeleted = false) {
    const variants = this.generatePhoneVariants(phone);
    if (!variants || variants.length === 0) return null;

    const whereDeleted = includeDeleted ? "" : "AND deleted_at IS NULL";

    const sql = `
      SELECT 
        id, company_id, tipo, status, nome, email, phone, score, temperature,
        (
          SELECT COUNT(*) 
          FROM polox.contact_notes cn 
          WHERE cn.contato_id = polox.contacts.id AND cn.deleted_at IS NULL
        )::int AS notes_count
      FROM polox.contacts
      WHERE company_id = $1 AND phone = ANY($2) ${whereDeleted}
      ORDER BY deleted_at IS NULL DESC, created_at DESC
      LIMIT 1
    `;

    const result = await query(sql, [companyId, variants]);
    return result.rows[0] || null;
  }

  /**
   * Busca minimal por email (campos essenciais + notes_count)
   */
  static async findMinimalByEmail(companyId, email, includeDeleted = false) {
    if (!email) return null;
    const normalizedEmail = this.normalizeEmail(email);
    if (!normalizedEmail) return null;

    const whereDeleted = includeDeleted ? "" : "AND deleted_at IS NULL";
    const sql = `
      SELECT 
        id, company_id, tipo, status, nome, email, phone, score, temperature,
        (
          SELECT COUNT(*) 
          FROM polox.contact_notes cn 
          WHERE cn.contato_id = polox.contacts.id AND cn.deleted_at IS NULL
        )::int AS notes_count
      FROM polox.contacts
      WHERE company_id = $1 AND email = $2 ${whereDeleted}
      ORDER BY deleted_at IS NULL DESC, created_at DESC
      LIMIT 1
    `;
    const result = await query(sql, [companyId, normalizedEmail]);
    return result.rows[0] || null;
  }

  /**
   * Busca minimal por documento (campos essenciais + notes_count)
   */
  static async findMinimalByDocument(
    companyId,
    document,
    includeDeleted = false
  ) {
    if (!document) return null;
    const normalizedDocument = this.normalizeDocument(document);
    if (!normalizedDocument) return null;

    const whereDeleted = includeDeleted ? "" : "AND deleted_at IS NULL";
    const sql = `
      SELECT 
        id, company_id, tipo, status, nome, email, phone, score, temperature,
        (
          SELECT COUNT(*) 
          FROM polox.contact_notes cn 
          WHERE cn.contato_id = polox.contacts.id AND cn.deleted_at IS NULL
        )::int AS notes_count
      FROM polox.contacts
      WHERE company_id = $1 AND document_number = $2 ${whereDeleted}
      ORDER BY deleted_at IS NULL DESC, created_at DESC
      LIMIT 1
    `;
    const result = await query(sql, [companyId, normalizedDocument]);
    return result.rows[0] || null;
  }

  /**
   * Busca contato por telefone
   * @param {number} companyId - ID da empresa
   * @param {string} phone - Telefone
   * @param {boolean} includeDeleted - Incluir registros deletados
   * @returns {Promise<Object|null>} Contato ou null
   */
  static async findByPhone(companyId, phone, includeDeleted = false) {
    if (!phone) return null;

    const normalizedPhone = this.normalizePhone(phone);
    if (!normalizedPhone) return null;

    const whereClause = includeDeleted
      ? "company_id = $1 AND phone = $2"
      : "company_id = $1 AND phone = $2 AND deleted_at IS NULL";

    const sql = `
      SELECT 
        id, company_id, owner_id, tipo, nome, email, phone, document_number,
        company_name, lead_source, first_contact_at, score, temperature,
        last_purchase_date, lifetime_value_cents,
        address_street, address_number, address_complement, address_neighborhood,
        address_city, address_state, address_country, address_postal_code,
        created_at, updated_at, deleted_at
      FROM polox.contacts
      WHERE ${whereClause}
      ORDER BY deleted_at IS NULL DESC, created_at DESC
      LIMIT 1
    `;

    const result = await query(sql, [companyId, normalizedPhone]);
    return result.rows[0] || null;
  }

  /**
   * Busca contato por email
   * @param {number} companyId - ID da empresa
   * @param {string} email - Email
   * @param {boolean} includeDeleted - Incluir registros deletados
   * @returns {Promise<Object|null>} Contato ou null
   */
  static async findByEmail(companyId, email, includeDeleted = false) {
    if (!email) return null;

    const normalizedEmail = this.normalizeEmail(email);
    if (!normalizedEmail) return null;

    const whereClause = includeDeleted
      ? "company_id = $1 AND email = $2"
      : "company_id = $1 AND email = $2 AND deleted_at IS NULL";

    const sql = `
      SELECT 
        id, company_id, owner_id, tipo, nome, email, phone, document_number,
        company_name, lead_source, first_contact_at, score, temperature,
        last_purchase_date, lifetime_value_cents,
        address_street, address_number, address_complement, address_neighborhood,
        address_city, address_state, address_country, address_postal_code,
        created_at, updated_at, deleted_at
      FROM polox.contacts
      WHERE ${whereClause}
      ORDER BY deleted_at IS NULL DESC, created_at DESC
      LIMIT 1
    `;

    const result = await query(sql, [companyId, normalizedEmail]);
    return result.rows[0] || null;
  }

  /**
   * Busca contato por documento (CPF/CNPJ)
   * @param {number} companyId - ID da empresa
   * @param {string} document - Documento
   * @param {boolean} includeDeleted - Incluir registros deletados
   * @returns {Promise<Object|null>} Contato ou null
   */
  static async findByDocument(companyId, document, includeDeleted = false) {
    if (!document) return null;

    const normalizedDocument = this.normalizeDocument(document);
    if (!normalizedDocument) return null;

    const whereClause = includeDeleted
      ? "company_id = $1 AND document_number = $2"
      : "company_id = $1 AND document_number = $2 AND deleted_at IS NULL";

    const sql = `
      SELECT 
        id, company_id, owner_id, tipo, nome, email, phone, document_number,
        company_name, lead_source, first_contact_at, score, temperature,
        last_purchase_date, lifetime_value_cents,
        address_street, address_number, address_complement, address_neighborhood,
        address_city, address_state, address_country, address_postal_code,
        created_at, updated_at, deleted_at
      FROM polox.contacts
      WHERE ${whereClause}
      ORDER BY deleted_at IS NULL DESC, created_at DESC
      LIMIT 1
    `;

    const result = await query(sql, [companyId, normalizedDocument]);
    return result.rows[0] || null;
  }

  /**
   * Busca contato por qualquer identificador (phone, email ou document)
   * Busca na ordem: phone -> email -> document
   * @param {number} companyId - ID da empresa
   * @param {Object} identifiers - Objeto com phone, email e/ou document
   * @param {boolean} includeDeleted - Incluir registros deletados
   * @returns {Promise<Object|null>} Contato ou null
   */
  static async findByIdentifier(
    companyId,
    identifiers = {},
    includeDeleted = false
  ) {
    const { phone, email, document } = identifiers;

    // Buscar por telefone primeiro
    if (phone) {
      const contact = await this.findByPhone(companyId, phone, includeDeleted);
      if (contact) return contact;
    }

    // Buscar por email se não encontrou por telefone
    if (email) {
      const contact = await this.findByEmail(companyId, email, includeDeleted);
      if (contact) return contact;
    }

    // Buscar por documento se não encontrou pelos anteriores
    if (document) {
      const contact = await this.findByDocument(
        companyId,
        document,
        includeDeleted
      );
      if (contact) return contact;
    }

    return null;
  }

  /**
   * Busca contato por ID
   * @param {number} id - ID do contato
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object>} Contato
   */
  static async findById(id, companyId) {
    const sql = `
      SELECT 
        id, company_id, owner_id, tipo, nome, email, phone, document_number,
        company_name, status, lead_source, first_contact_at, score, temperature,
        last_purchase_date, lifetime_value_cents,
        address_street, address_number, address_complement, address_neighborhood,
        address_city, address_state, address_country, address_postal_code,
        created_at, updated_at, deleted_at
      FROM polox.contacts
      WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL
    `;

    const result = await query(sql, [id, companyId]);
    if (result.rows.length === 0) {
      throw new NotFoundError("Contact not found");
    }

    return result.rows[0];
  }

  /**
   * Lista contatos com filtros
   * @param {number} companyId - ID da empresa
   * @param {Object} filters - Filtros opcionais
   * @returns {Promise<Array>} Lista de contatos
   */
  static async list(companyId, filters = {}) {
    const {
      tipo, // 'lead' | 'cliente'
      owner_id,
      search,
      numerotelefone,
      sort_by = "created_at",
      sort_order = "DESC",
      limit = 50,
      offset = 0,
      company_id, // Filtro adicional por company_id específico
    } = filters;

    const conditions = ["company_id = $1", "deleted_at IS NULL"];
    const params = [companyId];
    let paramIndex = 2;

    if (tipo) {
      conditions.push(`tipo = $${paramIndex}`);
      params.push(tipo);
      paramIndex++;
    }

    if (owner_id) {
      conditions.push(`owner_id = $${paramIndex}`);
      params.push(owner_id);
      paramIndex++;
    }

    if (search) {
      conditions.push(`(
        nome ILIKE $${paramIndex} OR
        email ILIKE $${paramIndex} OR
        phone ILIKE $${paramIndex} OR
        document_number ILIKE $${paramIndex} OR
        company_name ILIKE $${paramIndex}
      )`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    // Filtro específico por número de telefone com regra do WhatsApp (55)
    if (numerotelefone) {
      const onlyDigits = (numerotelefone || "").toString().replace(/\D/g, "");
      if (onlyDigits.length > 0) {
        let variantA = onlyDigits; // como veio
        let variantB = null; // com/sem 55
        if (onlyDigits.startsWith("55")) {
          variantB = onlyDigits.slice(2);
        } else {
          variantB = `55${onlyDigits}`;
        }

        if (variantB && variantB !== variantA) {
          conditions.push(`(phone = $${paramIndex} OR phone = $${paramIndex + 1})`);
          params.push(variantA, variantB);
          paramIndex += 2;
        } else {
          conditions.push(`phone = $${paramIndex}`);
          params.push(variantA);
          paramIndex += 1;
        }
      }
    }

    // Se company_id específico for fornecido, sobrescreve o companyId do usuário autenticado
    if (company_id && company_id !== companyId) {
      conditions[0] = "company_id = $1"; // Mantém a mesma condição mas com valor diferente
      params[0] = company_id; // Substitui o valor
    }

    // Validar sort_by para prevenir SQL injection
    const allowedSortFields = [
      "created_at",
      "updated_at",
      "nome",
      "status",
      "score",
      "temperature",
      "lifetime_value_cents",
    ];
    const sortField = allowedSortFields.includes(sort_by)
      ? sort_by
      : "created_at";
    const sortDirection = sort_order.toUpperCase() === "ASC" ? "ASC" : "DESC";

    const sql = `
      SELECT 
        id, company_id, owner_id, tipo, nome, email, phone, document_number,
        company_name, status, score, temperature, lifetime_value_cents,
        address_city, address_state, created_at, updated_at,
        (
          SELECT COUNT(*) 
          FROM polox.contact_notes cn 
          WHERE cn.contato_id = polox.contacts.id AND cn.deleted_at IS NULL
        )::int AS notes_count
      FROM polox.contacts
      WHERE ${conditions.join(" AND ")}
      ORDER BY ${sortField} ${sortDirection}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    params.push(limit, offset);

    const result = await query(sql, params);
    return result.rows;
  }

  /**
   * Restaura contato deletado (reverte soft delete)
   * @param {number} id - ID do contato
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object>} Contato restaurado
   */
  static async restore(id, companyId) {
    const sql = `
      UPDATE polox.contacts
      SET 
        deleted_at = NULL,
        updated_at = NOW()
      WHERE id = $1 AND company_id = $2 AND deleted_at IS NOT NULL
      RETURNING 
        id, company_id, owner_id, tipo, nome, email, phone, document_number,
        company_name, lead_source, first_contact_at, score, temperature,
        last_purchase_date, lifetime_value_cents,
        address_street, address_number, address_complement, address_neighborhood,
        address_city, address_state, address_country, address_postal_code,
        created_at, updated_at, deleted_at
    `;

    const result = await query(sql, [id, companyId]);
    if (result.rows.length === 0) {
      throw new NotFoundError("Deleted contact not found");
    }

    return result.rows[0];
  }

  /**
   * Lógica inteligente "Find-or-Restore-or-Create"
   *
   * Previne duplicatas lógicas (1 ativo + 1 deletado com mesmo identificador)
   *
   * Fluxo:
   * 1. Busca por phone/email/document (INCLUINDO deletados)
   * 2. Se encontrar DELETADO → RESTAURA + ATUALIZA
   * 3. Se encontrar ATIVO → RETORNA existente
   * 4. Se NÃO encontrar → CRIA novo
   *
   * Usado por: Landing Pages, Extensão WhatsApp, Integrações
   *
   * @param {number} companyId - ID da empresa
   * @param {Object} data - Dados do contato
   * @returns {Promise<Object>} Contato (existente, restaurado ou novo)
   */
  static async getOrCreate(companyId, data) {
    const {
      phone,
      email,
      document_number,
      nome,
      tipo = "lead",
      owner_id = null,
      ...otherData
    } = data;

    // Normalizar identificadores
    const normalizedPhone = this.normalizePhone(phone);
    const normalizedEmail = this.normalizeEmail(email);
    const normalizedDocument = this.normalizeDocument(document_number);

    // 1️⃣ Buscar por phone (INCLUINDO deletados)
    let contact = null;
    if (normalizedPhone) {
      contact = await this.findByPhone(companyId, normalizedPhone, true);
    }

    // 2️⃣ Buscar por email se não encontrou por phone
    if (!contact && normalizedEmail) {
      contact = await this.findByEmail(companyId, normalizedEmail, true);
    }

    // 3️⃣ Buscar por documento se não encontrou
    if (!contact && normalizedDocument) {
      contact = await this.findByDocument(companyId, normalizedDocument, true);
    }

    // 4️⃣ Se encontrou DELETADO → RESTAURAR + ATUALIZAR
    if (contact && contact.deleted_at) {
      const restoredContact = await transaction(async (client) => {
        const restoreQuery = `
          UPDATE polox.contacts
          SET 
            deleted_at = NULL,
            nome = COALESCE($3, nome),
            email = COALESCE($4, email),
            phone = COALESCE($5, phone),
            document_number = COALESCE($6, document_number),
            owner_id = COALESCE($7, owner_id),
            tipo = COALESCE($8, tipo),
            updated_at = NOW()
          WHERE id = $1 AND company_id = $2
          RETURNING 
            id, company_id, owner_id, tipo, nome, email, phone, document_number,
            company_name, lead_source, first_contact_at, score, temperature,
            last_purchase_date, lifetime_value_cents,
            address_street, address_number, address_complement, address_neighborhood,
            address_city, address_state, address_country, address_postal_code,
            created_at, updated_at, deleted_at
        `;

        const result = await client.query(restoreQuery, [
          contact.id,
          companyId,
          nome || null,
          normalizedEmail || null,
          normalizedPhone || null,
          normalizedDocument || null,
          owner_id || null,
          tipo || null,
        ]);

        return result.rows[0];
      });

      return { contact: restoredContact, created: false, restored: true };
    }

    // 5️⃣ Se encontrou ATIVO → RETORNAR existente
    if (contact) {
      return { contact, created: false, restored: false };
    }

    // 6️⃣ Se NÃO encontrou → CRIAR novo
    const newContact = await this.create(companyId, {
      phone: normalizedPhone,
      email: normalizedEmail,
      document_number: normalizedDocument,
      nome,
      tipo,
      owner_id,
      ...otherData,
    });

    return { contact: newContact, created: true, restored: false };
  }

  /**
   * Cria um novo contato
   * @param {number} companyId - ID da empresa
   * @param {Object} data - Dados do contato
   * @returns {Promise<Object>} Contato criado
   */
  static async create(companyId, data) {
    const {
      nome,
      email,
      phone,
      document_number,
      document_type = null,
      company_name = null,
      status = "novo",
      tipo = "lead",
      owner_id = null,
      lead_source = null,
      first_contact_at = null,
      score = 0,
      temperature = "frio",
      last_purchase_date = null,
      lifetime_value_cents = 0,
      address_street = null,
      address_number = null,
      address_complement = null,
      address_neighborhood = null,
      address_city = null,
      address_state = null,
      address_country = "BR",
      address_postal_code = null,
      tags = [], // Array de nomes de tags
      interests = [], // Array de IDs de interesses
    } = data;

    // Validar dados obrigatórios
    if (!nome || nome.trim().length === 0) {
      throw new ValidationError("Nome é obrigatório");
    }

    // Validar tipo
    if (!["lead", "cliente"].includes(tipo)) {
      throw new ValidationError('Tipo deve ser "lead" ou "cliente"');
    }

    // Normalizar identificadores
    const normalizedPhone = this.normalizePhone(phone);
    const normalizedEmail = this.normalizeEmail(email);
    const normalizedDocument = this.normalizeDocument(document_number);

    // Validar constraint anti-fantasma: pelo menos 1 identificador
    if (!normalizedPhone && !normalizedEmail && !normalizedDocument) {
      throw new ValidationError(
        "Pelo menos um identificador é obrigatório: phone, email ou document_number"
      );
    }

    // Verificar duplicatas (ATIVOS apenas - UNIQUE constraints do banco)
    if (normalizedPhone) {
      const existing = await this.findByPhone(
        companyId,
        normalizedPhone,
        false
      );
      if (existing) {
        throw new ValidationError(
          `Já existe um contato ativo com este telefone: ${normalizedPhone}`
        );
      }
    }

    if (normalizedEmail) {
      const existing = await this.findByEmail(
        companyId,
        normalizedEmail,
        false
      );
      if (existing) {
        throw new ValidationError(
          `Já existe um contato ativo com este email: ${normalizedEmail}`
        );
      }
    }

    if (normalizedDocument) {
      const existing = await this.findByDocument(
        companyId,
        normalizedDocument,
        false
      );
      if (existing) {
        throw new ValidationError(
          `Já existe um contato ativo com este documento: ${normalizedDocument}`
        );
      }
    }

    return await transaction(async (client) => {
      // 1. Criar contato
      const insertQuery = `
        INSERT INTO polox.contacts (
            company_id, owner_id, tipo, nome, email, phone, document_number, document_type,
            company_name, status, lead_source, first_contact_at, score, temperature,
            last_purchase_date, lifetime_value_cents,
            address_street, address_number, address_complement, address_neighborhood,
            address_city, address_state, address_country, address_postal_code,
            kanban_position,
            created_at, updated_at
          )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8,
          $9, $10, $11, $12, $13, $14,
          $15, $16,
          $17, $18, $19, $20,
          $21, $22, $23, $24,
          1000,
          NOW(), NOW()
        )
        RETURNING 
          id, company_id, owner_id, tipo, nome, email, phone, document_number, document_type,
          company_name, status, lead_source, first_contact_at, score, temperature,
          last_purchase_date, lifetime_value_cents,
          address_street, address_number, address_complement, address_neighborhood,
          address_city, address_state, address_country, address_postal_code,
          kanban_position,
          created_at, updated_at, deleted_at
      `;

      // Validate status value (application-level)
      const allowedStatuses = [
        "novo",
        "em_contato",
        "qualificado",
        "proposta_enviada",
        "em_negociacao",
        "fechado",
        "perdido",
      ];
      const normalizedStatus = (status || "novo").toString().toLowerCase();
      if (!allowedStatuses.includes(normalizedStatus)) {
        throw new ValidationError("Status inválido");
      }

      const result = await client.query(insertQuery, [
        companyId,
        owner_id,
        tipo,
        nome,
        normalizedEmail,
        normalizedPhone,
        normalizedDocument,
        document_type,
        company_name,
        normalizedStatus,
        lead_source,
        first_contact_at,
        score,
        temperature,
        last_purchase_date,
        lifetime_value_cents,
        address_street,
        address_number,
        address_complement,
        address_neighborhood,
        address_city,
        address_state,
        address_country,
        address_postal_code,
      ]);

      const contact = result.rows[0];

      // 2. Adicionar tags (via pivot table contact_tags)
      if (tags && tags.length > 0) {
        for (const tagName of tags) {
          if (tagName && tagName.trim() !== "") {
            const trimmedName = tagName.trim();
            const slug = trimmedName
              .toLowerCase()
              .replace(/\s+/g, "-")
              .replace(/[^\w-]/g, "");

            // Primeiro tenta buscar a tag existente
            let tagResult = await client.query(
              `
              SELECT id FROM polox.tags 
              WHERE company_id = $1 AND tag_name = $2 AND slug = $3
              LIMIT 1
            `,
              [companyId, trimmedName, slug]
            );

            let tagId;
            if (tagResult.rows.length > 0) {
              // Tag já existe, usar o ID existente
              tagId = tagResult.rows[0].id;
            } else {
              // Tag não existe, criar nova
              const insertResult = await client.query(
                `
                INSERT INTO polox.tags (company_id, tag_name, slug, color, created_at, updated_at)
                VALUES ($1, $2, $3, $4, NOW(), NOW())
                RETURNING id
              `,
                [companyId, trimmedName, slug, "#808080"]
              );
              tagId = insertResult.rows[0].id;
            }

            // Associar tag ao contato
            await client.query(
              `
              INSERT INTO polox.contact_tags (contato_id, tag_id, created_at)
              VALUES ($1, $2, NOW())
              ON CONFLICT (contato_id, tag_id) DO NOTHING
            `,
              [contact.id, tagId]
            );
          }
        }
      }

      // 3. Adicionar interesses (via pivot table contact_interests)
      if (interests && interests.length > 0) {
        for (const interestId of interests) {
          if (interestId) {
            await client.query(
              `
              INSERT INTO polox.contact_interests (contato_id, interest_id, created_at)
              VALUES ($1, $2, NOW())
              ON CONFLICT (contato_id, interest_id) DO NOTHING
            `,
              [contact.id, interestId]
            );
          }
        }
      }

      return contact;
    });
  }

  /**
   * Atualiza contato existente
   * @param {number} id - ID do contato
   * @param {number} companyId - ID da empresa
   * @param {Object} data - Dados para atualizar
   * @returns {Promise<Object>} Contato atualizado
   */
  static async update(id, companyId, data) {
    const {
      nome,
      email,
      phone,
      document_number,
      document_type,
      company_name,
      status,
      owner_id,
      lead_source,
      score,
      temperature,
      last_purchase_date,
      lifetime_value_cents,
      address_street,
      address_number,
      address_complement,
      address_neighborhood,
      address_city,
      address_state,
      address_country,
      address_postal_code,
    } = data;

    // Normalizar identificadores se fornecidos
    const normalizedEmail =
      email !== undefined ? this.normalizeEmail(email) : undefined;
    const normalizedPhone =
      phone !== undefined ? this.normalizePhone(phone) : undefined;
    const normalizedDocument =
      document_number !== undefined
        ? this.normalizeDocument(document_number)
        : undefined;

    const updates = [];
    const params = [id, companyId];
    let paramIndex = 3;

    if (nome !== undefined) {
      if (!nome || nome.trim().length === 0) {
        throw new ValidationError("Nome não pode ser vazio");
      }
      updates.push(`nome = $${paramIndex}`);
      params.push(nome);
      paramIndex++;
    }

    if (normalizedEmail !== undefined) {
      updates.push(`email = $${paramIndex}`);
      params.push(normalizedEmail);
      paramIndex++;
    }

    if (normalizedPhone !== undefined) {
      updates.push(`phone = $${paramIndex}`);
      params.push(normalizedPhone);
      paramIndex++;
    }

    if (normalizedDocument !== undefined) {
      updates.push(`document_number = $${paramIndex}`);
      params.push(normalizedDocument);
      paramIndex++;
    }

    if (document_type !== undefined) {
      updates.push(`document_type = $${paramIndex}`);
      params.push(document_type);
      paramIndex++;
    }

    if (company_name !== undefined) {
      updates.push(`company_name = $${paramIndex}`);
      params.push(company_name);
      paramIndex++;
    }

    if (owner_id !== undefined) {
      updates.push(`owner_id = $${paramIndex}`);
      params.push(owner_id);
      paramIndex++;
    }

    if (status !== undefined) {
      // Validar status
      const allowedStatuses = [
        "novo",
        "em_contato",
        "qualificado",
        "proposta_enviada",
        "em_negociacao",
        "fechado",
        "perdido",
      ];
      const normalizedStatus = status.toString().toLowerCase();
      if (!allowedStatuses.includes(normalizedStatus)) {
        throw new ValidationError("Status inválido");
      }
      updates.push(`status = $${paramIndex}`);
      params.push(normalizedStatus);
      paramIndex++;
    }

    if (lead_source !== undefined) {
      updates.push(`lead_source = $${paramIndex}`);
      params.push(lead_source);
      paramIndex++;
    }

    if (score !== undefined) {
      updates.push(`score = $${paramIndex}`);
      params.push(score);
      paramIndex++;
    }

    if (temperature !== undefined) {
      updates.push(`temperature = $${paramIndex}`);
      params.push(temperature);
      paramIndex++;
    }

    if (last_purchase_date !== undefined) {
      updates.push(`last_purchase_date = $${paramIndex}`);
      params.push(last_purchase_date);
      paramIndex++;
    }

    if (lifetime_value_cents !== undefined) {
      updates.push(`lifetime_value_cents = $${paramIndex}`);
      params.push(lifetime_value_cents);
      paramIndex++;
    }

    if (address_street !== undefined) {
      updates.push(`address_street = $${paramIndex}`);
      params.push(address_street);
      paramIndex++;
    }

    if (address_number !== undefined) {
      updates.push(`address_number = $${paramIndex}`);
      params.push(address_number);
      paramIndex++;
    }

    if (address_complement !== undefined) {
      updates.push(`address_complement = $${paramIndex}`);
      params.push(address_complement);
      paramIndex++;
    }

    if (address_neighborhood !== undefined) {
      updates.push(`address_neighborhood = $${paramIndex}`);
      params.push(address_neighborhood);
      paramIndex++;
    }

    if (address_city !== undefined) {
      updates.push(`address_city = $${paramIndex}`);
      params.push(address_city);
      paramIndex++;
    }

    if (address_state !== undefined) {
      updates.push(`address_state = $${paramIndex}`);
      params.push(address_state);
      paramIndex++;
    }

    if (address_country !== undefined) {
      updates.push(`address_country = $${paramIndex}`);
      params.push(address_country);
      paramIndex++;
    }

    if (address_postal_code !== undefined) {
      updates.push(`address_postal_code = $${paramIndex}`);
      params.push(address_postal_code);
      paramIndex++;
    }

    if (updates.length === 0) {
      throw new ValidationError("Nenhum campo para atualizar");
    }

    updates.push("updated_at = NOW()");

    const sql = `
      UPDATE polox.contacts
      SET ${updates.join(", ")}
      WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL
      RETURNING 
        id, company_id, owner_id, tipo, nome, email, phone, document_number, document_type,
        company_name, status, lead_source, first_contact_at, score, temperature,
        last_purchase_date, lifetime_value_cents,
        address_street, address_number, address_complement, address_neighborhood,
        address_city, address_state, address_country, address_postal_code,
        created_at, updated_at, deleted_at
    `;

    try {
      const result = await query(sql, params);
      if (result.rows.length === 0) {
        throw new NotFoundError("Contact not found");
      }

      return result.rows[0];
    } catch (error) {
      // Map common unique constraint DB errors to validation errors
      // Postgres unique violation code = '23505'
      if (error && error.code === "23505") {
        const constraint = error.constraint || "";
        let friendly = "Duplicate value violates unique constraint";
        if (constraint.includes("phone")) {
          friendly = "Telefone já está em uso por outro contato nesta empresa";
        } else if (constraint.includes("email")) {
          friendly = "Email já está em uso por outro contato nesta empresa";
        } else if (constraint.includes("document")) {
          friendly = "Documento já está em uso por outro contato nesta empresa";
        }
        throw new ValidationError(friendly);
      }

      // Re-throw other errors
      throw error;
    }
  }

  /**
   * Converte lead em cliente (muda campo 'tipo')
   * @param {number} id - ID do contato (lead)
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object>} Contato atualizado (agora cliente)
   */
  static async convertToClient(id, companyId) {
    const sql = `
      UPDATE polox.contacts
      SET 
        tipo = 'cliente',
        last_purchase_date = COALESCE(last_purchase_date, NOW()),
        updated_at = NOW()
      WHERE id = $1 AND company_id = $2 AND tipo = 'lead' AND deleted_at IS NULL
      RETURNING 
        id, company_id, owner_id, tipo, nome, email, phone, document_number,
        company_name, status, lead_source, first_contact_at, score, temperature,
        last_purchase_date, lifetime_value_cents,
        address_street, address_number, address_complement, address_neighborhood,
        address_city, address_state, address_country, address_postal_code,
        created_at, updated_at, deleted_at
    `;

    const result = await query(sql, [id, companyId]);
    if (result.rows.length === 0) {
      throw new NotFoundError("Lead not found or already converted to client");
    }

    return result.rows[0];
  }

  /**
   * Soft delete de contato
   * @param {number} id - ID do contato
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object>} Contato deletado
   */
  static async softDelete(id, companyId) {
    const sql = `
      UPDATE polox.contacts
      SET 
        deleted_at = NOW(),
        updated_at = NOW()
      WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL
      RETURNING 
        id, company_id, owner_id, tipo, nome, email, phone, document_number,
        created_at, updated_at, deleted_at
    `;

    const result = await query(sql, [id, companyId]);
    if (result.rows.length === 0) {
      throw new NotFoundError("Contact not found");
    }

    return result.rows[0];
  }

  /**
   * Conta total de contatos
   * @param {number} companyId - ID da empresa
   * @param {Object} filters - Filtros opcionais
   * @returns {Promise<number>} Total de contatos
   */
  static async count(companyId, filters = {}) {
    const { tipo, owner_id, company_id, numerotelefone } = filters;

    const conditions = ["company_id = $1", "deleted_at IS NULL"];
    const params = [companyId];
    let paramIndex = 2;

    if (tipo) {
      conditions.push(`tipo = $${paramIndex}`);
      params.push(tipo);
      paramIndex++;
    }

    if (owner_id) {
      conditions.push(`owner_id = $${paramIndex}`);
      params.push(owner_id);
      paramIndex++;
    }

    // Aplicar mesma lógica de filtro de telefone que na listagem
    if (numerotelefone) {
      const onlyDigits = (numerotelefone || "").toString().replace(/\D/g, "");
      if (onlyDigits.length > 0) {
        let variantA = onlyDigits;
        let variantB = null;
        if (onlyDigits.startsWith("55")) {
          variantB = onlyDigits.slice(2);
        } else {
          variantB = `55${onlyDigits}`;
        }
        if (variantB && variantB !== variantA) {
          conditions.push(`(phone = $${paramIndex} OR phone = $${paramIndex + 1})`);
          params.push(variantA, variantB);
          paramIndex += 2;
        } else {
          conditions.push(`phone = $${paramIndex}`);
          params.push(variantA);
          paramIndex += 1;
        }
      }
    }

    // Se company_id específico for fornecido, sobrescreve o companyId do usuário autenticado
    if (company_id && company_id !== companyId) {
      conditions[0] = "company_id = $1"; // Mantém a mesma condição mas com valor diferente
      params[0] = company_id; // Substitui o valor
    }

    const sql = `
      SELECT COUNT(*) as total
      FROM polox.contacts
      WHERE ${conditions.join(" AND ")}
    `;

    const result = await query(sql, params);
    return parseInt(result.rows[0].total, 10);
  }

  /**
   * Calcula estatísticas de contatos
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object>} Estatísticas
   */
  static async getStats(companyId) {
    const sql = `
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN tipo = 'lead' THEN 1 END) as total_leads,
        COUNT(CASE WHEN tipo = 'cliente' THEN 1 END) as total_clientes,
        SUM(CASE WHEN tipo = 'cliente' THEN lifetime_value_cents ELSE 0 END) as lifetime_value_total_cents,
        AVG(CASE WHEN tipo = 'lead' THEN score ELSE NULL END) as avg_lead_score,
        COUNT(CASE WHEN created_at >= NOW() - INTERVAL '30 days' THEN 1 END) as new_last_30_days,
        COUNT(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN 1 END) as new_last_7_days
      FROM polox.contacts
      WHERE company_id = $1 AND deleted_at IS NULL
    `;

    const result = await query(sql, [companyId]);
    return result.rows[0];
  }

  /**
   * 📊 KANBAN: Resumo inicial de todas as raias
   * Retorna contagem + primeiros registros de cada status
   * @param {number} companyId - ID da empresa
   * @param {number} limit - Limite de leads por raia (padrão: 10)
   * @param {number|null} ownerId - Filtrar por responsável (opcional)
   * @returns {Promise<Object>} Objeto com dados por status
   */
  static async getKanbanSummary(companyId, limit = 10, ownerId = null) {
    const statuses = [
      'novo',
      'em_contato', 
      'qualificado',
      'proposta_enviada',
      'em_negociacao',
      'fechado',
      'perdido'
    ];

    const ownerFilter = ownerId ? 'AND owner_id = $3' : '';
    const params = ownerId ? [companyId, limit, ownerId] : [companyId, limit];

    // Query otimizada: uma única consulta usando LATERAL JOIN
    const sql = `
      WITH status_counts AS (
        SELECT 
          status,
          COUNT(*) as total_count
        FROM polox.contacts
        WHERE company_id = $1 
          AND tipo = 'lead'
          AND deleted_at IS NULL
          ${ownerFilter}
        GROUP BY status
      )
      SELECT 
        sc.status,
        sc.total_count,
        (
          SELECT json_agg(lead_row)
          FROM (
            SELECT 
              json_build_object(
                'id', c.id,
                'nome', c.nome,
                'email', c.email,
                'phone', c.phone,
                'status', c.status,
                'temperature', c.temperature,
                'score', c.score,
                'owner_id', c.owner_id,
                'origem', c.lead_source,
                'kanban_position', c.kanban_position,
                'created_at', c.created_at,
                'updated_at', c.updated_at,
                'deals_count', (
                  SELECT COUNT(*) 
                  FROM polox.deals d 
                  WHERE d.contato_id = c.id AND d.deleted_at IS NULL
                )
              ) as lead_row
            FROM polox.contacts c
            WHERE c.company_id = $1
              AND c.tipo = 'lead'
              AND c.status = sc.status
              AND c.deleted_at IS NULL
              ${ownerFilter}
            ORDER BY c.kanban_position ASC NULLS LAST, c.created_at DESC
            LIMIT $2
          ) subquery
        ) as leads
      FROM status_counts sc
      ORDER BY 
        CASE sc.status
          WHEN 'novo' THEN 1
          WHEN 'em_contato' THEN 2
          WHEN 'qualificado' THEN 3
          WHEN 'proposta_enviada' THEN 4
          WHEN 'em_negociacao' THEN 5
          WHEN 'fechado' THEN 6
          WHEN 'perdido' THEN 7
        END
    `;

    const result = await query(sql, params);
    
    // Formatar resposta: garantir que todos os status apareçam (mesmo com count 0)
    const summary = {};
    statuses.forEach(status => {
      summary[status] = {
        count: 0,
        leads: []
      };
    });

    // Preencher com dados do banco
    result.rows.forEach(row => {
      summary[row.status] = {
        count: parseInt(row.total_count, 10),
        leads: row.leads || []
      };
    });

    return summary;
  }

  /**
   * 📊 KANBAN: Atualizar posição do lead no Kanban (drag & drop)
   * 
   * OTIMIZAÇÃO DE PERFORMANCE:
   * - Usa sistema de GAPS (1000, 2000, 3000...)
   * - Inserir entre dois = calcular média (ex: entre 2000 e 3000 = 2500)
   * - Evita updates em massa (O(1) em 99% dos casos)
   * - Rebalanceia automaticamente quando gaps ficam < 10
   * 
   * @param {number} contactId - ID do contato a ser movido
   * @param {number} companyId - ID da empresa
   * @param {string} newStatus - Novo status (raia de destino)
   * @param {number} targetContactId - ID do contato de referência (onde foi solto)
   * @param {string} position - 'before' ou 'after' do targetContactId
   * @returns {Promise<Object>} Contato atualizado
   */
  static async updateKanbanPosition(contactId, companyId, newStatus, targetContactId, position = 'after') {
    // 1. Buscar contato atual
    const currentContact = await query(
      `SELECT id, status, kanban_position 
       FROM polox.contacts 
       WHERE id = $1 AND company_id = $2 AND tipo = 'lead' AND deleted_at IS NULL`,
      [contactId, companyId]
    );

    if (currentContact.rows.length === 0) {
      throw new NotFoundError("Lead não encontrado");
    }

    // 2. Buscar posição do contato de referência (onde foi solto)
    // Se targetContactId for null/undefined, será o primeiro da raia
    let targetPosition = 1000; // Posição padrão
    
    if (targetContactId) {
      const targetContact = await query(
        `SELECT id, kanban_position, status
         FROM polox.contacts 
         WHERE id = $1 AND company_id = $2 AND tipo = 'lead' AND deleted_at IS NULL`,
        [targetContactId, companyId]
      );

      if (targetContact.rows.length === 0) {
        throw new NotFoundError("Contato de referência não encontrado");
      }

      // Se o target está em outra raia, buscar a última posição da raia de destino
      if (targetContact.rows[0].status !== newStatus) {
        const lastInLane = await query(
          `SELECT kanban_position
           FROM polox.contacts
           WHERE company_id = $1
             AND status = $2
             AND tipo = 'lead'
             AND deleted_at IS NULL
           ORDER BY kanban_position DESC NULLS LAST
           LIMIT 1`,
          [companyId, newStatus]
        );
        
        // Coloca no final da raia de destino
        targetPosition = lastInLane.rows.length > 0 
          ? (lastInLane.rows[0].kanban_position || 0) + 1000
          : 1000;
      } else {
        targetPosition = targetContact.rows[0].kanban_position || 1000;
      }
    }

    // 3. Calcular nova posição usando GAPS
    let newPosition;
    
    if (position === 'before') {
      // Solto ANTES do target: buscar o item anterior
      const prevContact = await query(
        `SELECT kanban_position 
         FROM polox.contacts 
         WHERE company_id = $1 
           AND status = $2 
           AND tipo = 'lead'
           AND deleted_at IS NULL
           AND kanban_position < $3
         ORDER BY kanban_position DESC
         LIMIT 1`,
        [companyId, newStatus, targetPosition]
      );

      if (prevContact.rows.length === 0) {
        // É o primeiro da lista
        newPosition = Math.max(1, targetPosition - 1000);
      } else {
        const prevPosition = prevContact.rows[0].kanban_position;
        newPosition = Math.floor((prevPosition + targetPosition) / 2);
      }
    } else {
      // Solto DEPOIS do target: buscar o próximo item
      const nextContact = await query(
        `SELECT kanban_position 
         FROM polox.contacts 
         WHERE company_id = $1 
           AND status = $2 
           AND tipo = 'lead'
           AND deleted_at IS NULL
           AND kanban_position > $3
         ORDER BY kanban_position ASC
         LIMIT 1`,
        [companyId, newStatus, targetPosition]
      );

      if (nextContact.rows.length === 0) {
        // É o último da lista
        newPosition = targetPosition + 1000;
      } else {
        const nextPosition = nextContact.rows[0].kanban_position;
        newPosition = Math.floor((targetPosition + nextPosition) / 2);
      }
    }

    // 4. Verificar se gap é muito pequeno (< 10) e rebalancear se necessário
    const needsRebalance = await query(
      `SELECT EXISTS(
         SELECT 1 FROM polox.contacts c1
         INNER JOIN polox.contacts c2 
           ON c1.company_id = c2.company_id 
           AND c1.status = c2.status
           AND c2.kanban_position > c1.kanban_position
         WHERE c1.company_id = $1
           AND c1.status = $2
           AND c1.tipo = 'lead'
           AND c1.deleted_at IS NULL
           AND c2.tipo = 'lead'
           AND c2.deleted_at IS NULL
           AND (c2.kanban_position - c1.kanban_position) < 10
         LIMIT 1
       ) as needs_rebalance`,
      [companyId, newStatus]
    );

    if (needsRebalance.rows[0].needs_rebalance) {
      console.log(`🔄 Rebalanceando raia ${newStatus} da empresa ${companyId} (gaps muito pequenos)`);
      await query(
        `SELECT polox.rebalance_kanban_lane($1, $2)`,
        [companyId, newStatus]
      );
      
      // Recalcular newPosition após rebalanceamento
      const recalcTarget = await query(
        `SELECT kanban_position FROM polox.contacts WHERE id = $1`,
        [targetContactId]
      );
      
      if (recalcTarget.rows.length > 0) {
        const recalcPosition = recalcTarget.rows[0].kanban_position || 1000;
        if (position === 'before') {
          newPosition = Math.max(1, recalcPosition - 1000);
        } else {
          newPosition = recalcPosition + 1000;
        }
      }
    }

    // 5. Atualizar posição do contato (apenas 1 UPDATE! Performance O(1))
    const result = await query(
      `UPDATE polox.contacts 
       SET status = $1,
           kanban_position = $2,
           updated_at = NOW()
       WHERE id = $3 AND company_id = $4
       RETURNING id, nome, status, kanban_position, updated_at`,
      [newStatus, newPosition, contactId, companyId]
    );

    return result.rows[0];
  }

  /**
   * 📊 KANBAN: Buscar mais leads de uma raia específica (paginação)
   * @param {number} companyId - ID da empresa
   * @param {string} status - Status da raia
   * @param {number} limit - Limite de registros
   * @param {number} offset - Offset para paginação
   * @param {number|null} ownerId - Filtrar por responsável (opcional)
   * @returns {Promise<Object>} { leads: [], total: number, hasMore: boolean }
   */
  static async getKanbanLaneLeads(companyId, status, limit = 10, offset = 0, ownerId = null) {
    const ownerFilter = ownerId ? 'AND owner_id = $5' : '';
    const params = ownerId 
      ? [companyId, status, limit, offset, ownerId]
      : [companyId, status, limit, offset];

    // Buscar leads da raia
    const leadsSQL = `
      SELECT 
        c.id,
        c.nome,
        c.email,
        c.phone,
        c.status,
        c.temperature,
        c.score,
        c.owner_id,
        c.lead_source as origem,
        c.kanban_position,
        c.created_at,
        c.updated_at,
        (
          SELECT COUNT(*) 
          FROM polox.deals d 
          WHERE d.contato_id = c.id AND d.deleted_at IS NULL
        ) as deals_count
      FROM polox.contacts c
      WHERE c.company_id = $1
        AND c.tipo = 'lead'
        AND c.status = $2
        AND c.deleted_at IS NULL
        ${ownerFilter}
      ORDER BY c.kanban_position ASC NULLS LAST, c.created_at DESC
      LIMIT $3 OFFSET $4
    `;

    // Contar total
    const countSQL = `
      SELECT COUNT(*) as total
      FROM polox.contacts
      WHERE company_id = $1
        AND tipo = 'lead'
        AND status = $2
        AND deleted_at IS NULL
        ${ownerFilter}
    `;

    const [leadsResult, countResult] = await Promise.all([
      query(leadsSQL, params),
      query(countSQL, ownerId ? [companyId, status, ownerId] : [companyId, status])
    ]);

    const total = parseInt(countResult.rows[0].total, 10);
    const leads = leadsResult.rows;
    const hasMore = (offset + limit) < total;

    return {
      leads,
      total,
      hasMore,
      currentOffset: offset,
      nextOffset: hasMore ? offset + limit : null
    };
  }
}

module.exports = Contact;
