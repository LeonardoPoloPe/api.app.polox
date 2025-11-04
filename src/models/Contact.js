const { query, transaction } = require('../config/database');
const { ApiError, ValidationError, NotFoundError } = require('../utils/errors');

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
    return phone.replace(/\D/g, '');
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
    return document.replace(/\D/g, '');
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
      ? 'company_id = $1 AND phone = $2'
      : 'company_id = $1 AND phone = $2 AND deleted_at IS NULL';

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
      ? 'company_id = $1 AND email = $2'
      : 'company_id = $1 AND email = $2 AND deleted_at IS NULL';

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
      ? 'company_id = $1 AND document_number = $2'
      : 'company_id = $1 AND document_number = $2 AND deleted_at IS NULL';

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
   * Busca contato por ID
   * @param {number} id - ID do contato
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object>} Contato
   */
  static async findById(id, companyId) {
    const sql = `
      SELECT 
        id, company_id, owner_id, tipo, nome, email, phone, document_number,
        company_name, lead_source, first_contact_at, score, temperature,
        last_purchase_date, lifetime_value_cents,
        address_street, address_number, address_complement, address_neighborhood,
        address_city, address_state, address_country, address_postal_code,
        created_at, updated_at, deleted_at
      FROM polox.contacts
      WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL
    `;

    const result = await query(sql, [id, companyId]);
    if (result.rows.length === 0) {
      throw new NotFoundError('Contact not found');
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
      sort_by = 'created_at',
      sort_order = 'DESC',
      limit = 50,
      offset = 0
    } = filters;

    const conditions = ['company_id = $1', 'deleted_at IS NULL'];
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

    // Validar sort_by para prevenir SQL injection
    const allowedSortFields = ['created_at', 'updated_at', 'nome', 'score', 'temperature', 'lifetime_value_cents'];
    const sortField = allowedSortFields.includes(sort_by) ? sort_by : 'created_at';
    const sortDirection = sort_order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const sql = `
      SELECT 
        id, company_id, owner_id, tipo, nome, email, phone, document_number,
        company_name, score, temperature, lifetime_value_cents,
        address_city, address_state, created_at, updated_at
      FROM polox.contacts
      WHERE ${conditions.join(' AND ')}
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
      throw new NotFoundError('Deleted contact not found');
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
      tipo = 'lead',
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
      return await transaction(async (client) => {
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
          tipo || null
        ]);

        return result.rows[0];
      });
    }

    // 5️⃣ Se encontrou ATIVO → RETORNAR existente
    if (contact) {
      return contact;
    }

    // 6️⃣ Se NÃO encontrou → CRIAR novo
    return await this.create(companyId, {
      phone: normalizedPhone,
      email: normalizedEmail,
      document_number: normalizedDocument,
      nome,
      tipo,
      owner_id,
      ...otherData
    });
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
      tipo = 'lead',
      owner_id = null,
      lead_source = null,
      first_contact_at = null,
      score = 0,
      temperature = 'frio',
      last_purchase_date = null,
      lifetime_value_cents = 0,
      address_street = null,
      address_number = null,
      address_complement = null,
      address_neighborhood = null,
      address_city = null,
      address_state = null,
      address_country = 'BR',
      address_postal_code = null,
      tags = [], // Array de nomes de tags
      interests = [] // Array de IDs de interesses
    } = data;

    // Validar dados obrigatórios
    if (!nome || nome.trim().length === 0) {
      throw new ValidationError('Nome é obrigatório');
    }

    // Validar tipo
    if (!['lead', 'cliente'].includes(tipo)) {
      throw new ValidationError('Tipo deve ser "lead" ou "cliente"');
    }

    // Normalizar identificadores
    const normalizedPhone = this.normalizePhone(phone);
    const normalizedEmail = this.normalizeEmail(email);
    const normalizedDocument = this.normalizeDocument(document_number);

    // Validar constraint anti-fantasma: pelo menos 1 identificador
    if (!normalizedPhone && !normalizedEmail && !normalizedDocument) {
      throw new ValidationError('Pelo menos um identificador é obrigatório: phone, email ou document_number');
    }

    // Verificar duplicatas (ATIVOS apenas - UNIQUE constraints do banco)
    if (normalizedPhone) {
      const existing = await this.findByPhone(companyId, normalizedPhone, false);
      if (existing) {
        throw new ValidationError(`Já existe um contato ativo com este telefone: ${normalizedPhone}`);
      }
    }

    if (normalizedEmail) {
      const existing = await this.findByEmail(companyId, normalizedEmail, false);
      if (existing) {
        throw new ValidationError(`Já existe um contato ativo com este email: ${normalizedEmail}`);
      }
    }

    if (normalizedDocument) {
      const existing = await this.findByDocument(companyId, normalizedDocument, false);
      if (existing) {
        throw new ValidationError(`Já existe um contato ativo com este documento: ${normalizedDocument}`);
      }
    }

    return await transaction(async (client) => {
      // 1. Criar contato
      const insertQuery = `
        INSERT INTO polox.contacts (
          company_id, owner_id, tipo, nome, email, phone, document_number, document_type,
          company_name, lead_source, first_contact_at, score, temperature,
          last_purchase_date, lifetime_value_cents,
          address_street, address_number, address_complement, address_neighborhood,
          address_city, address_state, address_country, address_postal_code,
          created_at, updated_at
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8,
          $9, $10, $11, $12, $13,
          $14, $15,
          $16, $17, $18, $19,
          $20, $21, $22, $23,
          NOW(), NOW()
        )
        RETURNING 
          id, company_id, owner_id, tipo, nome, email, phone, document_number, document_type,
          company_name, lead_source, first_contact_at, score, temperature,
          last_purchase_date, lifetime_value_cents,
          address_street, address_number, address_complement, address_neighborhood,
          address_city, address_state, address_country, address_postal_code,
          created_at, updated_at, deleted_at
      `;

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
        address_postal_code
      ]);

      const contact = result.rows[0];

      // 2. Adicionar tags (via pivot table contato_tags)
      if (tags && tags.length > 0) {
        for (const tagName of tags) {
          if (tagName && tagName.trim() !== '') {
            const trimmedName = tagName.trim();
            const slug = trimmedName.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');

            // Criar ou buscar tag (multi-tenant)
            const tagResult = await client.query(
              `
              INSERT INTO polox.tags (company_id, name, slug, color, created_at, updated_at)
              VALUES ($1, $2, $3, $4, NOW(), NOW())
              ON CONFLICT (company_id, slug) 
              DO UPDATE SET updated_at = NOW()
              RETURNING id
            `,
              [companyId, trimmedName, slug, '#808080']
            );

            const tagId = tagResult.rows[0].id;

            // Associar tag ao contato
            await client.query(
              `
              INSERT INTO polox.contato_tags (contato_id, tag_id, created_at)
              VALUES ($1, $2, NOW())
              ON CONFLICT (contato_id, tag_id) DO NOTHING
            `,
              [contact.id, tagId]
            );
          }
        }
      }

      // 3. Adicionar interesses (via pivot table contato_interesses)
      if (interests && interests.length > 0) {
        for (const interestId of interests) {
          if (interestId) {
            await client.query(
              `
              INSERT INTO polox.contato_interesses (contato_id, interest_id, created_at)
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
      address_postal_code
    } = data;

    // Normalizar identificadores se fornecidos
    const normalizedEmail = email !== undefined ? this.normalizeEmail(email) : undefined;
    const normalizedPhone = phone !== undefined ? this.normalizePhone(phone) : undefined;
    const normalizedDocument = document_number !== undefined ? this.normalizeDocument(document_number) : undefined;

    const updates = [];
    const params = [id, companyId];
    let paramIndex = 3;

    if (nome !== undefined) {
      if (!nome || nome.trim().length === 0) {
        throw new ValidationError('Nome não pode ser vazio');
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
      throw new ValidationError('Nenhum campo para atualizar');
    }

    updates.push('updated_at = NOW()');

    const sql = `
      UPDATE polox.contacts
      SET ${updates.join(', ')}
      WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL
      RETURNING 
        id, company_id, owner_id, tipo, nome, email, phone, document_number, document_type,
        company_name, lead_source, first_contact_at, score, temperature,
        last_purchase_date, lifetime_value_cents,
        address_street, address_number, address_complement, address_neighborhood,
        address_city, address_state, address_country, address_postal_code,
        created_at, updated_at, deleted_at
    `;

    const result = await query(sql, params);
    if (result.rows.length === 0) {
      throw new NotFoundError('Contact not found');
    }

    return result.rows[0];
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
        company_name, lead_source, first_contact_at, score, temperature,
        last_purchase_date, lifetime_value_cents,
        address_street, address_number, address_complement, address_neighborhood,
        address_city, address_state, address_country, address_postal_code,
        created_at, updated_at, deleted_at
    `;

    const result = await query(sql, [id, companyId]);
    if (result.rows.length === 0) {
      throw new NotFoundError('Lead not found or already converted to client');
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
      throw new NotFoundError('Contact not found');
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
    const { tipo, owner_id } = filters;

    const conditions = ['company_id = $1', 'deleted_at IS NULL'];
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

    const sql = `
      SELECT COUNT(*) as total
      FROM polox.contacts
      WHERE ${conditions.join(' AND ')}
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
}

module.exports = Contact;
