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

const { query } = require("../config/database");
const {
  ApiError,
  ValidationError,
  NotFoundError,
  ConflictError,
} = require("../utils/errors");

/**
 * Model para gerenciamento de Perfis de Usuário (multi-tenant)
 * Baseado no schema polox.profiles
 */
class ProfileModel {
  /**
   * Lista perfis com filtros
   * @param {Object} filters - Filtros de busca
   * @param {number} filters.companyId - ID da empresa (opcional)
   * @param {boolean} filters.isActive - Status ativo/inativo (opcional)
   * @param {boolean} filters.isSystemDefault - Perfis do sistema (opcional)
   * @param {string} filters.search - Busca por nome/descrição (opcional)
   * @param {number} filters.limit - Limite de registros (opcional)
   * @param {number} filters.offset - Offset para paginação (opcional)
   * @returns {Promise<Array>} Lista de perfis
   */
  static async findAll(filters = {}) {
    const conditions = ["p.deleted_at IS NULL"];
    const values = [];
    let paramIndex = 1;

    // Filtro por empresa (NULL = perfis sistema, ID = perfis da empresa)
    if (filters.companyId !== undefined) {
      if (filters.companyId === null) {
        conditions.push("p.company_id IS NULL");
      } else {
        conditions.push(`p.company_id = $${paramIndex++}`);
        values.push(filters.companyId);
      }
    }

    // Filtro por status
    if (filters.isActive !== undefined) {
      conditions.push(`p.is_active = $${paramIndex++}`);
      values.push(filters.isActive);
    }

    // Filtro por perfis do sistema
    if (filters.isSystemDefault !== undefined) {
      conditions.push(`p.is_system_default = $${paramIndex++}`);
      values.push(filters.isSystemDefault);
    }

    // Busca textual (nome)
    if (filters.search) {
      conditions.push(`(p.name ILIKE $${paramIndex})`);
      values.push(`%${filters.search}%`);
      paramIndex++;
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const limitClause = filters.limit ? `LIMIT $${paramIndex++}` : "";
    if (filters.limit) values.push(filters.limit);

    const offsetClause = filters.offset ? `OFFSET $${paramIndex++}` : "";
    if (filters.offset) values.push(filters.offset);

    const selectQuery = `
      SELECT 
        p.id, 
        p.company_id, 
        p.name, 
        p.translations,
        p.screen_ids, 
        p.is_active, 
        p.is_system_default,
        p.created_at, 
        p.updated_at,
        COALESCE(
          json_agg(
            json_build_object(
              'id', m.id,
              'label', m.label,
              'icon', m.icon,
              'route', m.route,
              'translations', m.translations
            ) ORDER BY m.order_position
          ) FILTER (WHERE m.id IS NOT NULL),
          '[]'
        ) as menus
      FROM polox.profiles p
      LEFT JOIN polox.menu_items m ON m.id::TEXT = ANY(p.screen_ids) AND m.deleted_at IS NULL
      ${whereClause}
      GROUP BY p.id
      ORDER BY p.is_system_default DESC, p.name ASC
      ${limitClause} ${offsetClause}
    `;

    const result = await query(selectQuery, values);
    return result.rows;
  }

  /**
   * Conta total de perfis com filtros
   * @param {Object} filters - Filtros de busca
   * @returns {Promise<number>} Total de perfis
   */
  static async count(filters = {}) {
    const conditions = ["deleted_at IS NULL"];
    const values = [];
    let paramIndex = 1;

    if (filters.companyId !== undefined) {
      if (filters.companyId === null) {
        conditions.push("company_id IS NULL");
      } else {
        conditions.push(`company_id = $${paramIndex++}`);
        values.push(filters.companyId);
      }
    }

    if (filters.isActive !== undefined) {
      conditions.push(`is_active = $${paramIndex++}`);
      values.push(filters.isActive);
    }

    if (filters.search) {
      conditions.push(`(name ILIKE $${paramIndex})`);
      values.push(`%${filters.search}%`);
      paramIndex++;
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const countQuery = `SELECT COUNT(*) FROM polox.profiles ${whereClause}`;
    const result = await query(countQuery, values);
    return parseInt(result.rows[0].count);
  }

  /**
   * Busca perfil por ID
   * @param {number} profileId - ID do perfil
   * @returns {Promise<Object|null>} Perfil encontrado ou null
   */
  static async findById(profileId) {
    const selectQuery = `
      SELECT 
        p.id, 
        p.company_id, 
        p.name, 
        p.translations,
        p.screen_ids, 
        p.is_active, 
        p.is_system_default,
        p.created_at, 
        p.updated_at,
        COALESCE(
          json_agg(
            json_build_object(
              'id', m.id,
              'label', m.label,
              'icon', m.icon,
              'route', m.route,
              'translations', m.translations
            ) ORDER BY m.order_position
          ) FILTER (WHERE m.id IS NOT NULL),
          '[]'
        ) as menus
      FROM polox.profiles p
      LEFT JOIN polox.menu_items m ON m.id::TEXT = ANY(p.screen_ids) AND m.deleted_at IS NULL
      WHERE p.id = $1 AND p.deleted_at IS NULL
      GROUP BY p.id
    `;

    const result = await query(selectQuery, [profileId]);
    return result.rows[0] || null;
  }

  /**
   * Cria um novo perfil
   * @param {Object} profileData - Dados do perfil
   * @returns {Promise<Object>} Perfil criado
   */
  static async create(profileData) {
    const {
      company_id = null,
      name,
      translations = {},
      screen_ids = [],
      is_active = true,
      is_system_default = false,
    } = profileData;

    // Validações básicas
    if (!name) {
      throw new ValidationError("Nome do perfil é obrigatório");
    }

    if (!Array.isArray(screen_ids) || screen_ids.length === 0) {
      throw new ValidationError(
        "Perfil deve ter ao menos uma permissão (screen_id)"
      );
    }

    // Verificar se nome já existe para esta empresa
    const existingProfile = await query(
      `SELECT id FROM polox.profiles 
       WHERE company_id IS NOT DISTINCT FROM $1 
       AND name = $2 
       AND deleted_at IS NULL`,
      [company_id, name]
    );

    if (existingProfile.rows.length > 0) {
      throw new ConflictError(`Perfil "${name}" já existe para esta empresa`);
    }

    const insertQuery = `
      INSERT INTO polox.profiles (
        company_id, name, translations, screen_ids, 
        is_active, is_system_default, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
      RETURNING 
        id, company_id, name, translations,
        screen_ids, is_active, is_system_default,
        created_at, updated_at
    `;

    const result = await query(insertQuery, [
      company_id,
      name,
      JSON.stringify(translations),
      screen_ids,
      is_active,
      is_system_default,
    ]);

    return result.rows[0];
  }

  /**
   * Atualiza um perfil existente
   * @param {number} profileId - ID do perfil
   * @param {Object} updateData - Dados a atualizar
   * @returns {Promise<Object>} Perfil atualizado
   */
  static async update(profileId, updateData) {
    // Buscar perfil atual
    const currentProfile = await this.findById(profileId);
    if (!currentProfile) {
      throw new NotFoundError("Perfil não encontrado");
    }

    const fields = [];
    const values = [];
    let paramIndex = 1;

    // Campos permitidos para atualização
    const allowedFields = {
      name: "name",
      translations: "translations",
      screen_ids: "screen_ids",
      is_active: "is_active",
      is_system_default: "is_system_default",
    };

    for (const [key, dbField] of Object.entries(allowedFields)) {
      if (updateData[key] !== undefined) {
        if (dbField === "translations") {
          fields.push(`${dbField} = $${paramIndex++}`);
          values.push(JSON.stringify(updateData[key]));
        } else if (dbField === "screen_ids") {
          // Validar que screen_ids não está vazio
          if (!Array.isArray(updateData[key]) || updateData[key].length === 0) {
            throw new ValidationError(
              "Perfil deve ter ao menos uma permissão (screen_id)"
            );
          }
          fields.push(`${dbField} = $${paramIndex++}`);
          values.push(updateData[key]);
        } else {
          fields.push(`${dbField} = $${paramIndex++}`);
          values.push(updateData[key]);
        }
      }
    }

    if (fields.length === 0) {
      throw new ValidationError("Nenhum campo para atualizar");
    }

    // Verificar duplicação de nome se estiver alterando
    if (updateData.name && updateData.name !== currentProfile.name) {
      const existingProfile = await query(
        `SELECT id FROM polox.profiles 
         WHERE company_id IS NOT DISTINCT FROM $1 
         AND name = $2 
         AND id != $3
         AND deleted_at IS NULL`,
        [currentProfile.company_id, updateData.name, profileId]
      );

      if (existingProfile.rows.length > 0) {
        throw new ConflictError(
          `Perfil "${updateData.name}" já existe para esta empresa`
        );
      }
    }

    fields.push("updated_at = NOW()");
    values.push(profileId);

    const updateQuery = `
      UPDATE polox.profiles
      SET ${fields.join(", ")}
      WHERE id = $${paramIndex} AND deleted_at IS NULL
      RETURNING 
        id, company_id, name, translations,
        screen_ids, is_active, is_system_default,
        created_at, updated_at
    `;

    const result = await query(updateQuery, values);

    if (result.rows.length === 0) {
      throw new NotFoundError("Perfil não encontrado");
    }

    return result.rows[0];
  }

  /**
   * Deleta um perfil (soft delete)
   * @param {number} profileId - ID do perfil
   * @returns {Promise<boolean>} True se deletado
   */
  static async delete(profileId) {
    // Verificar se perfil existe
    const profile = await this.findById(profileId);
    if (!profile) {
      throw new NotFoundError("Perfil não encontrado");
    }

    // Verificar se há usuários vinculados
    const usersCount = await query(
      `SELECT COUNT(*) FROM polox.users 
       WHERE profile_id = $1 AND deleted_at IS NULL`,
      [profileId]
    );

    if (parseInt(usersCount.rows[0].count) > 0) {
      throw new ConflictError(
        `Não é possível deletar. ${usersCount.rows[0].count} usuário(s) vinculado(s) a este perfil. ` +
          "Reassign os usuários primeiro."
      );
    }

    // Soft delete
    const deleteQuery = `
      UPDATE polox.profiles
      SET deleted_at = NOW(), updated_at = NOW()
      WHERE id = $1 AND deleted_at IS NULL
      RETURNING id
    `;

    const result = await query(deleteQuery, [profileId]);
    return result.rows.length > 0;
  }

  /**
   * Alterna status ativo/inativo de um perfil
   * @param {number} profileId - ID do perfil
   * @returns {Promise<Object>} Perfil atualizado
   */
  static async toggleStatus(profileId) {
    const toggleQuery = `
      UPDATE polox.profiles
      SET is_active = NOT is_active, updated_at = NOW()
      WHERE id = $1 AND deleted_at IS NULL
      RETURNING 
        id, company_id, name, translations,
        screen_ids, is_active, is_system_default,
        created_at, updated_at
    `;

    const result = await query(toggleQuery, [profileId]);

    if (result.rows.length === 0) {
      throw new NotFoundError("Perfil não encontrado");
    }

    return result.rows[0];
  }

  /**
   * Valida se screen_ids existem e estão ativos
   * @param {Array<string>} screenIds - Array de screen IDs
   * @returns {Promise<Object>} { valid: boolean, invalid: Array }
   */
  static async validateScreenIds(screenIds) {
    if (!Array.isArray(screenIds) || screenIds.length === 0) {
      return {
        valid: false,
        invalid: [],
        message: "screen_ids deve ser um array não vazio",
      };
    }

    // Buscar menus existentes e ativos
    const menusQuery = `
      SELECT id::text FROM polox.menu_items 
      WHERE id::text = ANY($1) AND is_active = true AND deleted_at IS NULL
    `;

    const result = await query(menusQuery, [screenIds]);
    const validIds = result.rows.map((row) => row.id);
    const invalidIds = screenIds.filter((id) => !validIds.includes(id));

    return {
      valid: invalidIds.length === 0,
      invalid: invalidIds,
      message:
        invalidIds.length > 0
          ? `Screen IDs inválidos ou inativos: ${invalidIds.join(", ")}`
          : "Todos screen_ids válidos",
    };
  }

  /**
   * Reassign usuários de um perfil para outro
   * @param {number} fromProfileId - ID do perfil origem
   * @param {number} toProfileId - ID do perfil destino
   * @returns {Promise<number>} Quantidade de usuários reassigned
   */
  static async reassignUsers(fromProfileId, toProfileId) {
    // Verificar se ambos perfis existem
    const fromProfile = await this.findById(fromProfileId);
    const toProfile = await this.findById(toProfileId);

    if (!fromProfile) {
      throw new NotFoundError("Perfil de origem não encontrado");
    }

    if (!toProfile) {
      throw new NotFoundError("Perfil de destino não encontrado");
    }

    if (!toProfile.is_active) {
      throw new ValidationError("Perfil de destino está inativo");
    }

    const reassignQuery = `
      UPDATE polox.users
      SET profile_id = $1, updated_at = NOW()
      WHERE profile_id = $2 AND deleted_at IS NULL
      RETURNING id
    `;

    const result = await query(reassignQuery, [toProfileId, fromProfileId]);
    return result.rows.length;
  }

  /**
   * Lista perfis do sistema (company_id = NULL)
   * @returns {Promise<Array>} Lista de perfis do sistema
   */
  static async getSystemProfiles() {
    return this.findAll({ companyId: null, isActive: true });
  }

  /**
   * Lista perfis de uma empresa específica (incluindo perfis do sistema)
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Array>} Lista de perfis
   */
  static async getProfilesForCompany(companyId) {
    const profilesQuery = `
      SELECT 
        p.id, 
        p.company_id, 
        p.name, 
        p.translations,
        p.screen_ids, 
        p.is_active, 
        p.is_system_default,
        p.created_at, 
        p.updated_at,
        COALESCE(
          json_agg(
            json_build_object(
              'id', m.id,
              'label', m.label,
              'icon', m.icon,
              'route', m.route,
              'translations', m.translations
            ) ORDER BY m.order_position
          ) FILTER (WHERE m.id IS NOT NULL),
          '[]'
        ) as menus
      FROM polox.profiles p
      LEFT JOIN polox.menu_items m ON m.id::TEXT = ANY(p.screen_ids) AND m.deleted_at IS NULL
      WHERE (p.company_id IS NULL OR p.company_id = $1)
        AND p.deleted_at IS NULL
        AND p.is_active = true
      GROUP BY p.id
      ORDER BY p.is_system_default DESC, p.name ASC
    `;

    const result = await query(profilesQuery, [companyId]);
    return result.rows;
  }
}

module.exports = ProfileModel;
