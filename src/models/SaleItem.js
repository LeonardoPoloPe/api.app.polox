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

const { query, transaction } = require('../config/database');
const { ApiError, ValidationError, NotFoundError } = require('../utils/errors');

/**
 * Model para itens de venda
 * Baseado no schema polox.sale_items
 */
class SaleItemModel {
  /**
   * Cria um novo item de venda
   * @param {Object} itemData - Dados do item
   * @returns {Promise<Object>} Item criado
   */
  static async create(itemData) {
    const {
      sale_id,
      product_id,
      quantity,
      unit_price,
      discount_amount = 0,
      total_amount
    } = itemData;

    // Validar dados obrigatórios
    if (!sale_id || !product_id || !quantity || !unit_price) {
      throw new ValidationError('Sale ID, Product ID, quantidade e preço unitário são obrigatórios');
    }

    if (quantity <= 0) {
      throw new ValidationError('Quantidade deve ser maior que zero');
    }

    if (unit_price < 0) {
      throw new ValidationError('Preço unitário não pode ser negativo');
    }

    if (discount_amount < 0) {
      throw new ValidationError('Desconto não pode ser negativo');
    }

    // Calcular total se não fornecido
    const finalTotalAmount = total_amount || ((quantity * unit_price) - discount_amount);

    const insertQuery = `
      INSERT INTO polox.sale_items (
        sale_id, product_id, quantity, unit_price, discount_amount, total_amount,
        created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      RETURNING 
        id, sale_id, product_id, quantity, unit_price, discount_amount, total_amount,
        created_at
    `;

    try {
      const result = await query(insertQuery, [
        sale_id, product_id, quantity, unit_price, discount_amount, finalTotalAmount
      ]);

      return result.rows[0];
    } catch (error) {
      if (error.code === '23503') {
        if (error.constraint?.includes('sale')) {
          throw new ValidationError('Venda informada não existe');
        }
        if (error.constraint?.includes('product')) {
          throw new ValidationError('Produto informado não existe');
        }
      }
      throw new ApiError(500, `Erro ao criar item de venda: ${error.message}`);
    }
  }

  /**
   * Busca item por ID
   * @param {number} id - ID do item
   * @returns {Promise<Object|null>} Item encontrado ou null
   */
  static async findById(id) {
    const selectQuery = `
      SELECT 
        si.id, si.sale_id, si.product_id, si.quantity, si.unit_price, 
        si.discount_amount, si.total_amount, si.created_at,
        p.product_name,
        p.code as product_code,
        p.barcode as product_barcode,
        s.sale_number,
        s.company_id
      FROM polox.sale_items si
      INNER JOIN polox.products p ON si.product_id = p.id
      INNER JOIN polox.sales s ON si.sale_id = s.id
      WHERE si.id = $1
    `;

    try {
      const result = await query(selectQuery, [id]);
      return result.rows[0] || null;
    } catch (error) {
      throw new ApiError(500, `Erro ao buscar item: ${error.message}`);
    }
  }

  /**
   * Lista itens de uma venda
   * @param {number} saleId - ID da venda
   * @param {number} companyId - ID da empresa (para validação multi-tenant)
   * @returns {Promise<Array>} Lista de itens
   */
  static async findBySale(saleId, companyId) {
    const selectQuery = `
      SELECT 
        si.id, si.sale_id, si.product_id, si.quantity, si.unit_price, 
        si.discount_amount, si.total_amount, si.created_at,
        p.product_name,
        p.code as product_code,
        p.barcode as product_barcode,
        p.description as product_description,
        p.featured_image_url as product_image
      FROM polox.sale_items si
      INNER JOIN polox.products p ON si.product_id = p.id
      INNER JOIN polox.sales s ON si.sale_id = s.id
      WHERE si.sale_id = $1 AND s.company_id = $2 AND s.deleted_at IS NULL
      ORDER BY si.created_at ASC
    `;

    try {
      const result = await query(selectQuery, [saleId, companyId], { companyId });
      return result.rows;
    } catch (error) {
      throw new ApiError(500, `Erro ao buscar itens da venda: ${error.message}`);
    }
  }

  /**
   * Lista itens por produto
   * @param {number} productId - ID do produto
   * @param {number} companyId - ID da empresa
   * @param {Object} options - Opções de filtro
   * @returns {Promise<Array>} Lista de itens
   */
  static async findByProduct(productId, companyId, options = {}) {
    const { 
      page = 1, 
      limit = 10,
      start_date = null,
      end_date = null
    } = options;
    
    const offset = (page - 1) * limit;
    
    let whereClause = `
      WHERE si.product_id = $1 AND s.company_id = $2 AND s.deleted_at IS NULL
    `;
    const params = [productId, companyId];
    
    if (start_date) {
      whereClause += ` AND s.sale_date >= $${params.length + 1}`;
      params.push(start_date);
    }

    if (end_date) {
      whereClause += ` AND s.sale_date <= $${params.length + 1}`;
      params.push(end_date);
    }

    const selectQuery = `
      SELECT 
        si.id, si.sale_id, si.product_id, si.quantity, si.unit_price, 
        si.discount_amount, si.total_amount, si.created_at,
        s.sale_number,
        s.sale_date,
        s.status as sale_status,
        c.client_name
      FROM polox.sale_items si
      INNER JOIN polox.sales s ON si.sale_id = s.id
      LEFT JOIN polox.clients c ON s.client_id = c.id
      ${whereClause}
      ORDER BY s.sale_date DESC, si.created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    params.push(limit, offset);

    try {
      const result = await query(selectQuery, params, { companyId });
      return result.rows;
    } catch (error) {
      throw new ApiError(500, `Erro ao buscar vendas do produto: ${error.message}`);
    }
  }

  /**
   * Atualiza um item de venda
   * @param {number} id - ID do item
   * @param {Object} updateData - Dados para atualização
   * @returns {Promise<Object>} Item atualizado
   */
  static async update(id, updateData) {
    // Verificar se item existe
    const existing = await this.findById(id);
    if (!existing) {
      throw new NotFoundError('Item não encontrado');
    }

    const {
      quantity,
      unit_price,
      discount_amount
    } = updateData;

    // Validações
    if (quantity !== undefined && quantity <= 0) {
      throw new ValidationError('Quantidade deve ser maior que zero');
    }

    if (unit_price !== undefined && unit_price < 0) {
      throw new ValidationError('Preço unitário não pode ser negativo');
    }

    if (discount_amount !== undefined && discount_amount < 0) {
      throw new ValidationError('Desconto não pode ser negativo');
    }

    const updateFields = [];
    const params = [];
    let paramCount = 1;

    if (quantity !== undefined) {
      updateFields.push(`quantity = $${paramCount++}`);
      params.push(quantity);
    }

    if (unit_price !== undefined) {
      updateFields.push(`unit_price = $${paramCount++}`);
      params.push(unit_price);
    }

    if (discount_amount !== undefined) {
      updateFields.push(`discount_amount = $${paramCount++}`);
      params.push(discount_amount);
    }

    if (updateFields.length === 0) {
      throw new ValidationError('Nenhum campo para atualizar');
    }

    // Recalcular total se algum valor mudou
    const newQuantity = quantity !== undefined ? quantity : existing.quantity;
    const newUnitPrice = unit_price !== undefined ? unit_price : existing.unit_price;
    const newDiscountAmount = discount_amount !== undefined ? discount_amount : existing.discount_amount;
    const newTotalAmount = (newQuantity * newUnitPrice) - newDiscountAmount;

    updateFields.push(`total_amount = $${paramCount++}`);
    params.push(newTotalAmount);

    params.push(id);

    const updateQuery = `
      UPDATE polox.sale_items 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramCount++}
      RETURNING 
        id, sale_id, product_id, quantity, unit_price, discount_amount, total_amount,
        created_at
    `;

    try {
      const result = await query(updateQuery, params);
      
      if (result.rows.length === 0) {
        throw new NotFoundError('Item não encontrado');
      }

      return result.rows[0];
    } catch (error) {
      throw new ApiError(500, `Erro ao atualizar item: ${error.message}`);
    }
  }

  /**
   * Remove um item de venda
   * @param {number} id - ID do item
   * @returns {Promise<boolean>} True se removido com sucesso
   */
  static async delete(id) {
    const deleteQuery = `
      DELETE FROM polox.sale_items 
      WHERE id = $1
    `;

    try {
      const result = await query(deleteQuery, [id]);
      return result.rowCount > 0;
    } catch (error) {
      throw new ApiError(500, `Erro ao remover item: ${error.message}`);
    }
  }

  /**
   * Cria múltiplos itens para uma venda
   * @param {number} saleId - ID da venda
   * @param {Array} items - Array de itens
   * @returns {Promise<Array>} Itens criados
   */
  static async createMultiple(saleId, items) {
    if (!Array.isArray(items) || items.length === 0) {
      throw new ValidationError('Lista de itens é obrigatória');
    }

    return await transaction(async (client) => {
      const createdItems = [];

      for (const item of items) {
        const {
          product_id,
          quantity,
          unit_price,
          discount_amount = 0
        } = item;

        // Validações
        if (!product_id || !quantity || !unit_price) {
          throw new ValidationError('Product ID, quantidade e preço unitário são obrigatórios para todos os itens');
        }

        if (quantity <= 0) {
          throw new ValidationError('Quantidade deve ser maior que zero');
        }

        if (unit_price < 0) {
          throw new ValidationError('Preço unitário não pode ser negativo');
        }

        const total_amount = (quantity * unit_price) - discount_amount;

        const insertQuery = `
          INSERT INTO polox.sale_items (
            sale_id, product_id, quantity, unit_price, discount_amount, total_amount,
            created_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, NOW())
          RETURNING 
            id, sale_id, product_id, quantity, unit_price, discount_amount, total_amount,
            created_at
        `;

        const result = await client.query(insertQuery, [
          saleId, product_id, quantity, unit_price, discount_amount, total_amount
        ]);

        createdItems.push(result.rows[0]);
      }

      return createdItems;
    });
  }

  /**
   * Calcula totais dos itens de uma venda
   * @param {number} saleId - ID da venda
   * @returns {Promise<Object>} Totais calculados
   */
  static async calculateTotals(saleId) {
    const totalsQuery = `
      SELECT 
        COUNT(*) as items_count,
        SUM(quantity) as total_quantity,
        SUM(total_amount) as subtotal,
        SUM(discount_amount) as total_discount,
        AVG(unit_price) as average_unit_price
      FROM polox.sale_items 
      WHERE sale_id = $1
    `;

    try {
      const result = await query(totalsQuery, [saleId]);
      const totals = result.rows[0];

      return {
        items_count: parseInt(totals.items_count) || 0,
        total_quantity: parseFloat(totals.total_quantity) || 0,
        subtotal: parseFloat(totals.subtotal) || 0,
        total_discount: parseFloat(totals.total_discount) || 0,
        average_unit_price: parseFloat(totals.average_unit_price) || 0
      };
    } catch (error) {
      throw new ApiError(500, `Erro ao calcular totais: ${error.message}`);
    }
  }

  /**
   * Estatísticas de vendas por produto
   * @param {number} productId - ID do produto
   * @param {number} companyId - ID da empresa
   * @param {Object} dateRange - Período para análise
   * @returns {Promise<Object>} Estatísticas
   */
  static async getProductStats(productId, companyId, dateRange = {}) {
    const { start_date, end_date } = dateRange;

    let whereClause = `
      WHERE si.product_id = $1 AND s.company_id = $2 
      AND s.deleted_at IS NULL AND s.status = 'confirmed'
    `;
    const params = [productId, companyId];

    if (start_date) {
      whereClause += ` AND s.sale_date >= $${params.length + 1}`;
      params.push(start_date);
    }

    if (end_date) {
      whereClause += ` AND s.sale_date <= $${params.length + 1}`;
      params.push(end_date);
    }

    const statsQuery = `
      SELECT 
        COUNT(DISTINCT s.id) as sales_count,
        SUM(si.quantity) as total_quantity_sold,
        SUM(si.total_amount) as total_revenue,
        AVG(si.unit_price) as average_price,
        MIN(si.unit_price) as min_price,
        MAX(si.unit_price) as max_price,
        SUM(si.discount_amount) as total_discounts
      FROM polox.sale_items si
      INNER JOIN polox.sales s ON si.sale_id = s.id
      ${whereClause}
    `;

    try {
      const result = await query(statsQuery, params, { companyId });
      const stats = result.rows[0];

      return {
        sales_count: parseInt(stats.sales_count) || 0,
        total_quantity_sold: parseFloat(stats.total_quantity_sold) || 0,
        total_revenue: parseFloat(stats.total_revenue) || 0,
        average_price: parseFloat(stats.average_price) || 0,
        min_price: parseFloat(stats.min_price) || 0,
        max_price: parseFloat(stats.max_price) || 0,
        total_discounts: parseFloat(stats.total_discounts) || 0
      };
    } catch (error) {
      throw new ApiError(500, `Erro ao buscar estatísticas: ${error.message}`);
    }
  }

  /**
   * Lista produtos mais vendidos
   * @param {number} companyId - ID da empresa
   * @param {Object} options - Opções de filtro
   * @returns {Promise<Array>} Lista de produtos mais vendidos
   */
  static async getTopProducts(companyId, options = {}) {
    const {
      limit = 10,
      start_date = null,
      end_date = null
    } = options;

    let whereClause = `
      WHERE s.company_id = $1 AND s.deleted_at IS NULL AND s.status = 'confirmed'
    `;
    const params = [companyId];

    if (start_date) {
      whereClause += ` AND s.sale_date >= $${params.length + 1}`;
      params.push(start_date);
    }

    if (end_date) {
      whereClause += ` AND s.sale_date <= $${params.length + 1}`;
      params.push(end_date);
    }

    const topProductsQuery = `
      SELECT 
        p.id,
        p.product_name,
        p.code,
        p.featured_image_url,
        COUNT(DISTINCT s.id) as sales_count,
        SUM(si.quantity) as total_quantity_sold,
        SUM(si.total_amount) as total_revenue,
        AVG(si.unit_price) as average_price
      FROM polox.sale_items si
      INNER JOIN polox.sales s ON si.sale_id = s.id
      INNER JOIN polox.products p ON si.product_id = p.id
      ${whereClause}
      GROUP BY p.id, p.product_name, p.code, p.featured_image_url
      ORDER BY total_quantity_sold DESC
      LIMIT $${params.length + 1}
    `;

    params.push(limit);

    try {
      const result = await query(topProductsQuery, params, { companyId });
      return result.rows.map(row => ({
        ...row,
        sales_count: parseInt(row.sales_count),
        total_quantity_sold: parseFloat(row.total_quantity_sold),
        total_revenue: parseFloat(row.total_revenue),
        average_price: parseFloat(row.average_price)
      }));
    } catch (error) {
      throw new ApiError(500, `Erro ao buscar produtos mais vendidos: ${error.message}`);
    }
  }
}

module.exports = SaleItemModel;