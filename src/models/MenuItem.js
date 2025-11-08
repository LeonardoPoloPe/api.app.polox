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
 * Model para gerenciamento de Menus do Sistema
 * Baseado no schema polox.menu_items
 */
class MenuItemModel {
  /**
   * Lista menus com filtros
   * @param {Object} filters - Filtros de busca
   * @param {boolean} filters.isActive - Status ativo/inativo (opcional)
   * @param {boolean} filters.adminOnly - Apenas menus admin (opcional)
   * @param {boolean} filters.isSpecial - Menus de gamificação (opcional)
   * @param {number} filters.parentId - ID do menu pai (opcional)
   * @param {string} filters.search - Busca por label/descrição (opcional)
   * @returns {Promise<Array>} Lista de menus
   */
  static async findAll(filters = {}) {
    const conditions = ["deleted_at IS NULL"];
    const values = [];
    let paramIndex = 1;

    // Filtro por status
    if (filters.isActive !== undefined) {
      conditions.push(`is_active = $${paramIndex++}`);
      values.push(filters.isActive);
    }

    // Nota: Colunas admin_only e is_special foram removidas do schema

    // Filtro por menu pai
    if (filters.parentId !== undefined) {
      if (filters.parentId === null) {
        conditions.push("parent_id IS NULL");
      } else {
        conditions.push(`parent_id = $${paramIndex++}`);
        values.push(filters.parentId);
      }
    }

    // Busca textual (label)
    if (filters.search) {
      conditions.push(`(label ILIKE $${paramIndex})`);
      values.push(`%${filters.search}%`);
      paramIndex++;
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const selectQuery = `
      SELECT 
        id, label, icon, route, translations,
        order_position, parent_id, is_active,
        visible_to_all,
        created_at, updated_at
      FROM polox.menu_items
      ${whereClause}
      ORDER BY order_position ASC
    `;

    const result = await query(selectQuery, values);
    return result.rows;
  }

  /**
   * Busca menu por ID
   * @param {number} menuId - ID do menu
   * @returns {Promise<Object|null>} Menu encontrado ou null
   */
  static async findById(menuId) {
    const selectQuery = `
      SELECT 
        id, label, icon, route, translations,
        order_position, parent_id, is_active,
        visible_to_all,
        created_at, updated_at
      FROM polox.menu_items
      WHERE id = $1 AND deleted_at IS NULL
    `;

    const result = await query(selectQuery, [menuId]);
    return result.rows[0] || null;
  }

  /**
   * Busca menu por rota
   * @param {string} route - Rota do menu
   * @returns {Promise<Object|null>} Menu encontrado ou null
   */
  static async findByRoute(route) {
    const selectQuery = `
      SELECT 
        id, label, icon, route, translations,
        order_position, parent_id, is_active,
        visible_to_all,
        created_at, updated_at
      FROM polox.menu_items
      WHERE route = $1 AND deleted_at IS NULL
    `;

    const result = await query(selectQuery, [route]);
    return result.rows[0] || null;
  }

  /**
   * Cria um novo menu
   * @param {Object} menuData - Dados do menu
   * @returns {Promise<Object>} Menu criado
   */
  static async create(menuData) {
    const {
      label,
      icon,
      route,
      translations = {},
      order_position = 0,
      parent_id = null,
      is_active = true,
      visible_to_all = true,
    } = menuData;

    // Validações básicas
    if (!label || !icon || !route) {
      throw new ValidationError("Label, ícone e rota são obrigatórios");
    }

    // Verificar se rota já existe
    const existingMenu = await this.findByRoute(route);
    if (existingMenu) {
      throw new ConflictError(`Menu com rota "${route}" já existe`);
    }

    // Verificar se order_position já existe para o mesmo parent_id
    const conflictQuery = `
      SELECT id FROM polox.menu_items 
      WHERE parent_id IS NOT DISTINCT FROM $1 
      AND order_position = $2 
      AND deleted_at IS NULL
    `;
    const conflict = await query(conflictQuery, [parent_id, order_position]);

    if (conflict.rows.length > 0) {
      throw new ConflictError(
        `Já existe um menu com order_position ${order_position} neste nível. ` +
          "Use um número diferente ou reordene os menus."
      );
    }

    const insertQuery = `
      INSERT INTO polox.menu_items (
        label, icon, route, translations, order_position,
        parent_id, is_active, visible_to_all,
        created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
      RETURNING 
        id, label, icon, route, translations,
        order_position, parent_id, is_active,
        visible_to_all,
        created_at, updated_at
    `;

    const result = await query(insertQuery, [
      label,
      icon,
      route,
      JSON.stringify(translations),
      order_position,
      parent_id,
      is_active,
      visible_to_all,
    ]);

    return result.rows[0];
  }

  /**
   * Atualiza um menu existente
   * @param {number} menuId - ID do menu
   * @param {Object} updateData - Dados a atualizar
   * @returns {Promise<Object>} Menu atualizado
   */
  static async update(menuId, updateData) {
    // Buscar menu atual
    const currentMenu = await this.findById(menuId);
    if (!currentMenu) {
      throw new NotFoundError("Menu não encontrado");
    }

    const fields = [];
    const values = [];
    let paramIndex = 1;

    // Campos permitidos para atualização
    const allowedFields = {
      label: "label",
      icon: "icon",
      route: "route",
      translations: "translations",
      order_position: "order_position",
      parent_id: "parent_id",
      is_active: "is_active",
      visible_to_all: "visible_to_all",
    };

    for (const [key, dbField] of Object.entries(allowedFields)) {
      if (updateData[key] !== undefined) {
        if (dbField === "translations") {
          fields.push(`${dbField} = $${paramIndex++}`);
          values.push(JSON.stringify(updateData[key]));
        } else {
          fields.push(`${dbField} = $${paramIndex++}`);
          values.push(updateData[key]);
        }
      }
    }

    if (fields.length === 0) {
      throw new ValidationError("Nenhum campo para atualizar");
    }

    // Verificar duplicação de rota se estiver alterando
    if (updateData.route && updateData.route !== currentMenu.route) {
      const existingMenu = await this.findByRoute(updateData.route);
      if (existingMenu) {
        throw new ConflictError(
          `Menu com rota "${updateData.route}" já existe`
        );
      }
    }

    // Verificar conflito de order_position se estiver alterando
    if (
      updateData.order_position !== undefined ||
      updateData.parent_id !== undefined
    ) {
      const newOrderPosition =
        updateData.order_position !== undefined
          ? updateData.order_position
          : currentMenu.order_position;

      const newParentId =
        updateData.parent_id !== undefined
          ? updateData.parent_id
          : currentMenu.parent_id;

      const conflictQuery = `
        SELECT id FROM polox.menu_items 
        WHERE parent_id IS NOT DISTINCT FROM $1 
        AND order_position = $2 
        AND id != $3
        AND deleted_at IS NULL
      `;
      const conflict = await query(conflictQuery, [
        newParentId,
        newOrderPosition,
        menuId,
      ]);

      if (conflict.rows.length > 0) {
        throw new ConflictError(
          `Já existe um menu com order_position ${newOrderPosition} neste nível`
        );
      }
    }

    fields.push("updated_at = NOW()");
    values.push(menuId);

    const updateQuery = `
      UPDATE polox.menu_items
      SET ${fields.join(", ")}
      WHERE id = $${paramIndex} AND deleted_at IS NULL
      RETURNING 
        id, label, icon, route, translations,
        order_position, parent_id, is_active,
        visible_to_all,
        created_at, updated_at
    `;

    const result = await query(updateQuery, values);

    if (result.rows.length === 0) {
      throw new NotFoundError("Menu não encontrado");
    }

    return result.rows[0];
  }

  /**
   * Deleta um menu (soft delete)
   * @param {number} menuId - ID do menu
   * @returns {Promise<boolean>} True se deletado
   */
  static async delete(menuId) {
    // Verificar se menu existe
    const menu = await this.findById(menuId);
    if (!menu) {
      throw new NotFoundError("Menu não encontrado");
    }

    // Verificar se há perfis usando este menu
    const profilesQuery = `
      SELECT id, name FROM polox.profiles 
      WHERE $1::text = ANY(screen_ids) 
      AND deleted_at IS NULL
      LIMIT 5
    `;
    const profiles = await query(profilesQuery, [menuId.toString()]);

    if (profiles.rows.length > 0) {
      const profileNames = profiles.rows.map((p) => p.name).join(", ");
      throw new ConflictError(
        `Não é possível deletar. Este menu está sendo usado por ${profiles.rows.length} perfil(is): ${profileNames}. ` +
          "Remova das permissões primeiro."
      );
    }

    // Verificar se há submenus
    const submenuQuery = `
      SELECT COUNT(*) FROM polox.menu_items 
      WHERE parent_id = $1 AND deleted_at IS NULL
    `;
    const submenus = await query(submenuQuery, [menuId]);

    if (parseInt(submenus.rows[0].count) > 0) {
      throw new ConflictError(
        `Não é possível deletar. Este menu possui ${submenus.rows[0].count} submenu(s). ` +
          "Delete os submenus primeiro."
      );
    }

    // Soft delete
    const deleteQuery = `
      UPDATE polox.menu_items
      SET deleted_at = NOW(), updated_at = NOW()
      WHERE id = $1 AND deleted_at IS NULL
      RETURNING id
    `;

    const result = await query(deleteQuery, [menuId]);
    return result.rows.length > 0;
  }

  /**
   * Alterna status ativo/inativo de um menu
   * @param {number} menuId - ID do menu
   * @returns {Promise<Object>} Menu atualizado
   */
  static async toggleStatus(menuId) {
    // Buscar menu atual
    const menu = await this.findById(menuId);
    if (!menu) {
      throw new NotFoundError("Menu não encontrado");
    }

    // Se vai desativar, avisar sobre perfis afetados
    if (menu.is_active) {
      const profilesQuery = `
        SELECT id, name FROM polox.profiles 
        WHERE $1::text = ANY(screen_ids) 
        AND deleted_at IS NULL
        LIMIT 3
      `;
      const profiles = await query(profilesQuery, [menuId.toString()]);

      if (profiles.rows.length > 0) {
        // Retornar warning mas não bloquear (decisão do controller)
        return {
          ...menu,
          _warning: {
            affected_profiles: profiles.rows.length,
            profiles: profiles.rows,
          },
        };
      }
    }

    const toggleQuery = `
      UPDATE polox.menu_items
      SET is_active = NOT is_active, updated_at = NOW()
      WHERE id = $1 AND deleted_at IS NULL
      RETURNING 
        id, label, icon, route, translations,
        order_position, parent_id, is_active,
        visible_to_all,
        created_at, updated_at
    `;

    const result = await query(toggleQuery, [menuId]);

    if (result.rows.length === 0) {
      throw new NotFoundError("Menu não encontrado");
    }

    return result.rows[0];
  }

  /**
   * Reordena múltiplos menus
   * @param {Array<Object>} reorderData - Array de { id, order_position }
   * @param {number} parentId - ID do menu pai (null para menus principais)
   * @returns {Promise<Array>} Menus reordenados
   */
  static async reorder(reorderData, parentId = null) {
    if (!Array.isArray(reorderData) || reorderData.length === 0) {
      throw new ValidationError("reorderData deve ser um array não vazio");
    }

    // Validar estrutura de dados
    for (const item of reorderData) {
      if (!item.id || item.order_position === undefined) {
        throw new ValidationError("Cada item deve ter id e order_position");
      }
    }

    // Verificar se todos menus existem e pertencem ao mesmo parent
    const ids = reorderData.map((item) => item.id);
    const menusQuery = `
      SELECT id, parent_id FROM polox.menu_items 
      WHERE id = ANY($1) AND deleted_at IS NULL
    `;
    const menus = await query(menusQuery, [ids]);

    if (menus.rows.length !== ids.length) {
      throw new NotFoundError("Um ou mais menus não encontrados");
    }

    // Verificar se todos têm o mesmo parent_id
    const parentIds = menus.rows.map((m) => m.parent_id);
    const allSameParent = parentIds.every(
      (pid) => (pid === null && parentId === null) || pid === parentId
    );

    if (!allSameParent) {
      throw new ValidationError("Todos os menus devem ter o mesmo parent_id");
    }

    // Atualizar order_position de cada menu
    const updates = [];
    for (const item of reorderData) {
      const updateQuery = `
        UPDATE polox.menu_items
        SET order_position = $1, updated_at = NOW()
        WHERE id = $2 AND deleted_at IS NULL
      `;
      updates.push(query(updateQuery, [item.order_position, item.id]));
    }

    await Promise.all(updates);

    // Retornar menus atualizados
    return this.findAll({ parentId });
  }

  /**
   * Busca menus hierárquicos (com submenus)
   * @returns {Promise<Array>} Menus em estrutura hierárquica
   */
  static async getHierarchy() {
    // Buscar todos menus ativos
    const menusQuery = `
      SELECT 
        id, label, icon, route, translations,
        order_position, parent_id, is_active,
        visible_to_all
      FROM polox.menu_items
      WHERE deleted_at IS NULL AND is_active = true
      ORDER BY order_position ASC
    `;

    const result = await query(menusQuery);
    const menus = result.rows;

    // Construir hierarquia
    const menuMap = new Map();
    const rootMenus = [];

    // Primeiro, criar map de todos menus
    menus.forEach((menu) => {
      menuMap.set(menu.id, { ...menu, children: [] });
    });

    // Depois, construir hierarquia
    menus.forEach((menu) => {
      if (menu.parent_id === null) {
        rootMenus.push(menuMap.get(menu.id));
      } else {
        const parent = menuMap.get(menu.parent_id);
        if (parent) {
          parent.children.push(menuMap.get(menu.id));
        }
      }
    });

    return rootMenus;
  }

  /**
   * Buscar menus disponíveis para uma empresa
   * @param {number} companyId - ID da empresa
   * @param {boolean} isAdmin - Se usuário é admin (incluído para compatibilidade, sem efeito)
   * @returns {Promise<Array>} Menus disponíveis
   */
  static async getMenusForCompany(companyId, isAdmin = false) {
    const conditions = ["deleted_at IS NULL", "is_active = true"];
    const values = [];
    let paramIndex = 1;

    // Filtrar por menus visíveis para a empresa
    conditions.push(`(
      visible_to_all = true 
      OR EXISTS (
        SELECT 1 FROM polox.menu_company_permissions 
        WHERE menu_item_id = polox.menu_items.id 
        AND company_id = $${paramIndex}
      )
    )`);
    values.push(companyId);

    const whereClause = conditions.join(" AND ");

    const menusQuery = `
      SELECT 
        id, label, icon, route, translations,
        order_position, parent_id, is_active,
        visible_to_all
      FROM polox.menu_items
      WHERE ${whereClause}
      ORDER BY order_position ASC
    `;

    const result = await query(menusQuery, values);
    return result.rows;
  }
}

module.exports = MenuItemModel;
