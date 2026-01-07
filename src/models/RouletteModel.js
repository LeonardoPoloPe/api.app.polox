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

/**
 * Módulo de Acesso a Dados para o Sistema de Roletas (Roulette, Prizes, History)
 * Nota: Os métodos de lógica de negócio complexa (como o sorteio) ficam no Service.
 */
class RouletteModel {
  // =========================================================================
  // Métodos CRUD para Roulettes (Exemplo: Criação de Roleta)
  // =========================================================================
  static async createRoulette(rouletteData, prizes) {
    return await transaction(async (client) => {
      // Insere roleta principal
      const insertRouletteQuery = `
                INSERT INTO polox.roulettes 
                    (company_id, roulette_name, description, max_spins, is_single_use,
                     custom_title, button_text, general_colors, background_image_url,
                     start_date, end_date, is_active)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                RETURNING *;
            `;
      const rouletteValues = [
        rouletteData.companyId,
        rouletteData.name,
        rouletteData.description || null,
        rouletteData.maxSpins || 1,
        rouletteData.isSingleUse || false,
        rouletteData.customTitle || null,
        rouletteData.buttonText || "Rodar agora!",
        rouletteData.generalColors
          ? JSON.stringify(rouletteData.generalColors)
          : null,
        rouletteData.backgroundImageUrl || null,
        rouletteData.startDate || null,
        rouletteData.endDate || null,
        rouletteData.isActive !== undefined ? rouletteData.isActive : true,
      ];
      const rouletteResult = await client.query(
        insertRouletteQuery,
        rouletteValues
      );
      const newRoulette = rouletteResult.rows[0];

      // Insere prêmios
      if (prizes && prizes.length > 0) {
        for (const prize of prizes) {
          const insertPrizeQuery = `
                        INSERT INTO polox.roulette_prizes
                            (roulette_id, prize_description, probability_weight, color_code, 
                             prize_value, prize_type, resend_link_url, redirection_type, quantity_available)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9);
                    `;
          await client.query(insertPrizeQuery, [
            newRoulette.id,
            prize.prizeDescription,
            prize.probabilityWeight || 10,
            prize.colorCode || "#3498DB",
            prize.prizeValue || 0,
            prize.prizeType || "discount_percent",
            prize.resendLinkUrl || null,
            prize.redirectionType || "url",
            prize.quantityAvailable || null,
          ]);
        }
      }

      return newRoulette;
    });
  }

  // Lista roletas ativas da empresa, com contagem de prêmios
  static async listRoulettes(companyId) {
    const sql = `
            SELECT r.id, r.roulette_name, r.is_active,
                (SELECT COUNT(*) FROM polox.roulette_prizes p WHERE p.roulette_id = r.id) AS prizes_count
            FROM polox.roulettes r
            WHERE r.company_id = $1 AND r.deleted_at IS NULL
            ORDER BY r.created_at DESC;
        `;
    const result = await query(sql, [companyId]);
    return result.rows;
  }

  // Detalhes da roleta + prêmios (JOIN)
  static async getRouletteDetails(id, companyId) {
    const rouletteQuery = `
            SELECT * FROM polox.roulettes
            WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL;
        `;
    const prizeQuery = `
            SELECT * FROM polox.roulette_prizes
            WHERE roulette_id = $1;
        `;
    const rouletteResult = await query(rouletteQuery, [id, companyId]);
    if (rouletteResult.rows.length === 0) return null;
    const prizesResult = await query(prizeQuery, [id]);
    return {
      ...rouletteResult.rows[0],
      prizes: prizesResult.rows,
    };
  }

  // Atualiza roleta e prêmios (transação)
  static async updateRoulette(id, companyId, rouletteData, prizes) {
    return await transaction(async (client) => {
      // Atualiza roleta
      const updateRouletteQuery = `
                UPDATE polox.roulettes SET
                    roulette_name = $1,
                    description = $2,
                    max_spins = $3,
                    is_single_use = $4,
                    custom_title = $5,
                    button_text = $6,
                    general_colors = $7,
                    background_image_url = $8,
                    start_date = $9,
                    end_date = $10,
                    is_active = $11,
                    updated_at = NOW()
                WHERE id = $12 AND company_id = $13 AND deleted_at IS NULL
                RETURNING *;
            `;
      const values = [
        rouletteData.name,
        rouletteData.description,
        rouletteData.maxSpins,
        rouletteData.isSingleUse,
        rouletteData.customTitle,
        rouletteData.buttonText,
        rouletteData.generalColors
          ? JSON.stringify(rouletteData.generalColors)
          : null,
        rouletteData.backgroundImageUrl,
        rouletteData.startDate,
        rouletteData.endDate,
        rouletteData.isActive,
        id,
        companyId,
      ];
      const updateResult = await client.query(updateRouletteQuery, values);
      if (updateResult.rows.length === 0)
        throw new Error("Roleta não encontrada");

      // Remove prêmios antigos
      await client.query(
        "DELETE FROM polox.roulette_prizes WHERE roulette_id = $1;",
        [id]
      );

      // Insere novos prêmios
      for (const prize of prizes) {
        const insertPrizeQuery = `
                    INSERT INTO polox.roulette_prizes
                        (roulette_id, prize_description, probability_weight, color_code, prize_value, prize_type, resend_link_url, redirection_type, quantity_available)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9);
                `;
        await client.query(insertPrizeQuery, [
          id,
          prize.prizeDescription,
          prize.probabilityWeight,
          prize.colorCode,
          prize.prizeValue,
          prize.prizeType,
          prize.resendLinkUrl,
          prize.redirectionType,
          prize.quantityAvailable,
        ]);
      }

      return updateResult.rows[0];
    });
  }

  // Busca roleta por ID (usado para validação)
  static async findRouletteById(id, companyId) {
    const sql = `
            SELECT * FROM polox.roulettes
            WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL;
        `;
    const result = await query(sql, [id, companyId]);
    return result.rows[0] || null;
  }

  // Busca prêmios de uma roleta
  static async getPrizesByRouletteId(rouletteId) {
    const sql = `
            SELECT * FROM polox.roulette_prizes
            WHERE roulette_id = $1
            ORDER BY id;
        `;
    const result = await query(sql, [rouletteId]);
    return result.rows;
  }

  // Registra spin no histórico
  static async createSpin(spinData) {
    const sql = `
            INSERT INTO polox.roulette_spins_history
                (roulette_id, contact_id, vendor_user_id, prize_id, spin_count, redeem_code)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *;
        `;
    const values = [
      spinData.rouletteId,
      spinData.contactId || null,
      spinData.vendorUserId || null,
      spinData.prizeId,
      spinData.spinCount,
      spinData.redeemCode,
    ];
    const result = await query(sql, values);
    return result.rows[0];
  }

  // Conta spins de um contato em uma roleta
  static async countSpinsByContact(rouletteId, contactId) {
    const sql = `
            SELECT COUNT(*) as count
            FROM polox.roulette_spins_history
            WHERE roulette_id = $1 AND contact_id = $2;
        `;
    const result = await query(sql, [rouletteId, contactId]);
    return parseInt(result.rows[0].count);
  }

  // Busca spin por código de resgate
  static async findSpinByRedeemCode(redeemCode) {
    const sql = `
            SELECT sh.*, p.resend_link_url, p.prize_description, r.company_id
            FROM polox.roulette_spins_history sh
            JOIN polox.roulette_prizes p ON sh.prize_id = p.id
            JOIN polox.roulettes r ON sh.roulette_id = r.id
            WHERE sh.redeem_code = $1;
        `;
    const result = await query(sql, [redeemCode]);
    return result.rows[0] || null;
  }

  // Marca prêmio como resgatado
  static async markPrizeAsClaimed(redeemCode, claimedMethod = "web") {
    const sql = `
            UPDATE polox.roulette_spins_history
            SET is_claimed = true, claimed_at = NOW(), claimed_method = $2
            WHERE redeem_code = $1
            RETURNING *;
        `;
    const result = await query(sql, [redeemCode, claimedMethod]);
    return result.rows[0];
  }
}

module.exports = RouletteModel;
