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

const { Client } = require('pg');
const { v4: uuidv4 } = require('uuid');

class WheelPrize {
    constructor(db) {
        this.db = db;
        this.table = 'polox.wheel_prizes';
    }

    // Validações
    _validateCompanyAccess(companyId) {
        if (!companyId) {
            throw new Error('Company ID é obrigatório para operações multi-tenant');
        }
    }

    _validatePrizeData(data) {
        const errors = [];

        if (!data.wheel_id) {
            errors.push('ID da roleta é obrigatório');
        }

        if (!data.name || data.name.trim().length < 2) {
            errors.push('Nome do prêmio é obrigatório (mínimo 2 caracteres)');
        }

        if (!data.prize_type) {
            errors.push('Tipo do prêmio é obrigatório');
        }

        const validPrizeTypes = [
            'coins', 'xp', 'physical_item', 'discount', 'free_spin', 
            'custom_reward', 'virtual_item', 'bonus_points', 'achievement'
        ];
        
        if (data.prize_type && !validPrizeTypes.includes(data.prize_type)) {
            errors.push('Tipo de prêmio inválido');
        }

        if (data.color && !/^#[0-9A-Fa-f]{6}$/.test(data.color)) {
            errors.push('Cor deve estar no formato hexadecimal (#RRGGBB)');
        }

        if (data.probability_weight && (data.probability_weight < 1 || data.probability_weight > 1000)) {
            errors.push('Peso da probabilidade deve estar entre 1 e 1000');
        }

        if (data.coins_amount && data.coins_amount < 0) {
            errors.push('Quantidade de moedas não pode ser negativa');
        }

        if (data.xp_amount && data.xp_amount < 0) {
            errors.push('Quantidade de XP não pode ser negativa');
        }

        if (data.discount_percentage && (data.discount_percentage < 0 || data.discount_percentage > 100)) {
            errors.push('Porcentagem de desconto deve estar entre 0 e 100');
        }

        if (data.max_wins_per_user && data.max_wins_per_user < 1) {
            errors.push('Máximo de vitórias por usuário deve ser pelo menos 1');
        }

        if (errors.length > 0) {
            throw new Error(`Dados inválidos: ${errors.join(', ')}`);
        }
    }

    // Criar prêmio
    async create(companyId, prizeData) {
        this._validateCompanyAccess(companyId);
        this._validatePrizeData(prizeData);

        const client = await this.db.connect();
        
        try {
            await client.query('BEGIN');

            // Verificar se a roleta existe e pertence à empresa
            const wheelResult = await client.query(`
                SELECT id FROM polox.custom_wheels 
                WHERE id = $1 AND company_id = $2
            `, [prizeData.wheel_id, companyId]);

            if (wheelResult.rows.length === 0) {
                throw new Error('Roleta não encontrada ou não pertence à empresa');
            }

            // Definir próxima ordem se não especificada
            let displayOrder = prizeData.display_order || 0;
            if (!prizeData.display_order) {
                const orderResult = await client.query(`
                    SELECT COALESCE(MAX(display_order), 0) + 1 as next_order
                    FROM ${this.table}
                    WHERE wheel_id = $1
                `, [prizeData.wheel_id]);
                displayOrder = orderResult.rows[0].next_order;
            }

            // Inserir prêmio
            const query = `
                INSERT INTO ${this.table} (
                    wheel_id, name, description, icon, color, prize_type,
                    coins_amount, xp_amount, physical_item_name, discount_percentage,
                    custom_reward, probability_weight, max_wins_total, max_wins_per_user,
                    is_active, display_order
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
                RETURNING *
            `;

            const values = [
                prizeData.wheel_id,
                prizeData.name.trim(),
                prizeData.description || null,
                prizeData.icon || null,
                prizeData.color || '#FFD700',
                prizeData.prize_type,
                prizeData.coins_amount || 0,
                prizeData.xp_amount || 0,
                prizeData.physical_item_name || null,
                prizeData.discount_percentage || null,
                prizeData.custom_reward ? JSON.stringify(prizeData.custom_reward) : null,
                prizeData.probability_weight || 1,
                prizeData.max_wins_total || null,
                prizeData.max_wins_per_user || 1,
                prizeData.is_active !== undefined ? prizeData.is_active : true,
                displayOrder
            ];

            const result = await client.query(query, values);
            await client.query('COMMIT');

            return {
                success: true,
                data: result.rows[0],
                message: 'Prêmio criado com sucesso'
            };

        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Erro ao criar prêmio:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    // Buscar prêmio por ID
    async findById(prizeId, companyId) {
        this._validateCompanyAccess(companyId);

        const query = `
            SELECT 
                wp.*,
                cw.name as wheel_name,
                COUNT(ws.id) as times_won
            FROM ${this.table} wp
            JOIN polox.custom_wheels cw ON wp.wheel_id = cw.id
            LEFT JOIN polox.wheel_spins ws ON wp.id = ws.prize_id
            WHERE wp.id = $1 AND cw.company_id = $2
            GROUP BY wp.id, cw.name
        `;

        try {
            const result = await this.db.query(query, [prizeId, companyId]);
            
            if (result.rows.length === 0) {
                return { success: false, message: 'Prêmio não encontrado' };
            }

            const prize = result.rows[0];
            
            // Parsear custom_reward se existir
            if (prize.custom_reward) {
                prize.custom_reward = JSON.parse(prize.custom_reward);
            }

            return {
                success: true,
                data: prize
            };

        } catch (error) {
            console.error('Erro ao buscar prêmio:', error);
            throw error;
        }
    }

    // Buscar prêmios por roleta
    async findByWheel(wheelId, companyId, options = {}) {
        this._validateCompanyAccess(companyId);

        const {
            isActive = null,
            includeStats = true,
            limit = 100,
            offset = 0
        } = options;

        let whereConditions = [
            'wp.wheel_id = $1',
            'cw.company_id = $2'
        ];
        let params = [wheelId, companyId];
        let paramCount = 2;

        if (isActive !== null) {
            whereConditions.push(`wp.is_active = $${++paramCount}`);
            params.push(isActive);
        }

        const selectFields = includeStats ? 
            'wp.*, COUNT(ws.id) as times_won' : 'wp.*';

        const joinClause = includeStats ? 
            'LEFT JOIN polox.wheel_spins ws ON wp.id = ws.prize_id' : '';

        const groupBy = includeStats ? 'GROUP BY wp.id' : '';

        const query = `
            SELECT ${selectFields}
            FROM ${this.table} wp
            JOIN polox.custom_wheels cw ON wp.wheel_id = cw.id
            ${joinClause}
            WHERE ${whereConditions.join(' AND ')}
            ${groupBy}
            ORDER BY wp.display_order ASC, wp.created_at ASC
            LIMIT $${++paramCount} OFFSET $${++paramCount}
        `;

        params.push(limit, offset);

        try {
            const result = await this.db.query(query, params);

            // Parsear custom_reward para cada prêmio
            const prizes = result.rows.map(prize => ({
                ...prize,
                custom_reward: prize.custom_reward ? JSON.parse(prize.custom_reward) : null
            }));

            return {
                success: true,
                data: prizes,
                count: prizes.length
            };

        } catch (error) {
            console.error('Erro ao buscar prêmios da roleta:', error);
            throw error;
        }
    }

    // Atualizar prêmio
    async update(prizeId, companyId, updateData) {
        this._validateCompanyAccess(companyId);
        
        if (Object.keys(updateData).length > 0) {
            // Validar apenas os campos que estão sendo atualizados
            const tempData = { wheel_id: 1, name: 'temp', prize_type: 'coins', ...updateData };
            this._validatePrizeData(tempData);
        }

        const allowedFields = [
            'name', 'description', 'icon', 'color', 'prize_type', 'coins_amount',
            'xp_amount', 'physical_item_name', 'discount_percentage', 'custom_reward',
            'probability_weight', 'max_wins_total', 'max_wins_per_user', 'is_active',
            'display_order'
        ];

        const updates = [];
        const values = [];
        let paramCount = 0;

        // Construir query de update dinamicamente
        for (const [key, value] of Object.entries(updateData)) {
            if (allowedFields.includes(key)) {
                if (key === 'custom_reward' && value) {
                    updates.push(`${key} = $${++paramCount}`);
                    values.push(JSON.stringify(value));
                } else {
                    updates.push(`${key} = $${++paramCount}`);
                    values.push(value);
                }
            }
        }

        if (updates.length === 0) {
            throw new Error('Nenhum campo válido para atualização');
        }

        const client = await this.db.connect();

        try {
            await client.query('BEGIN');

            // Verificar se prêmio existe e pertence à empresa
            const checkResult = await client.query(`
                SELECT wp.id FROM ${this.table} wp
                JOIN polox.custom_wheels cw ON wp.wheel_id = cw.id
                WHERE wp.id = $1 AND cw.company_id = $2
            `, [prizeId, companyId]);

            if (checkResult.rows.length === 0) {
                throw new Error('Prêmio não encontrado');
            }

            // Atualizar prêmio
            const updateQuery = `
                UPDATE ${this.table} 
                SET ${updates.join(', ')}, updated_at = NOW()
                WHERE id = $${++paramCount}
                RETURNING *
            `;
            values.push(prizeId);

            const result = await client.query(updateQuery, values);
            await client.query('COMMIT');

            // Parsear custom_reward se existir
            const prize = result.rows[0];
            if (prize.custom_reward) {
                prize.custom_reward = JSON.parse(prize.custom_reward);
            }

            return {
                success: true,
                data: prize,
                message: 'Prêmio atualizado com sucesso'
            };

        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Erro ao atualizar prêmio:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    // Reordenar prêmios
    async reorder(wheelId, companyId, prizeOrders) {
        this._validateCompanyAccess(companyId);

        const client = await this.db.connect();

        try {
            await client.query('BEGIN');

            // Verificar se roleta pertence à empresa
            const wheelResult = await client.query(`
                SELECT id FROM polox.custom_wheels 
                WHERE id = $1 AND company_id = $2
            `, [wheelId, companyId]);

            if (wheelResult.rows.length === 0) {
                throw new Error('Roleta não encontrada');
            }

            // Atualizar ordem de cada prêmio
            for (const { prizeId, order } of prizeOrders) {
                await client.query(`
                    UPDATE ${this.table} 
                    SET display_order = $1, updated_at = NOW() 
                    WHERE id = $2 AND wheel_id = $3
                `, [order, prizeId, wheelId]);
            }

            await client.query('COMMIT');

            return {
                success: true,
                message: 'Ordem dos prêmios atualizada com sucesso'
            };

        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Erro ao reordenar prêmios:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    // Incrementar contador de vitórias
    async incrementWins(prizeId, companyId) {
        this._validateCompanyAccess(companyId);

        const client = await this.db.connect();

        try {
            await client.query('BEGIN');

            // Verificar se prêmio existe e se ainda pode ser ganho
            const prizeResult = await client.query(`
                SELECT wp.*, cw.company_id
                FROM ${this.table} wp
                JOIN polox.custom_wheels cw ON wp.wheel_id = cw.id
                WHERE wp.id = $1 AND cw.company_id = $2
            `, [prizeId, companyId]);

            if (prizeResult.rows.length === 0) {
                throw new Error('Prêmio não encontrado');
            }

            const prize = prizeResult.rows[0];

            // Verificar se ainda não atingiu o limite máximo
            if (prize.max_wins_total && prize.current_wins >= prize.max_wins_total) {
                throw new Error('Prêmio atingiu o limite máximo de vitórias');
            }

            // Incrementar contador
            const result = await client.query(`
                UPDATE ${this.table} 
                SET current_wins = current_wins + 1
                WHERE id = $1
                RETURNING *
            `, [prizeId]);

            await client.query('COMMIT');

            return {
                success: true,
                data: result.rows[0],
                message: 'Contador de vitórias atualizado'
            };

        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Erro ao incrementar vitórias:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    // Verificar se prêmio ainda pode ser ganho por um usuário específico
    async canUserWin(prizeId, userId, companyId) {
        this._validateCompanyAccess(companyId);

        const client = await this.db.connect();

        try {
            // Buscar informações do prêmio
            const prizeResult = await client.query(`
                SELECT wp.*, cw.company_id
                FROM ${this.table} wp
                JOIN polox.custom_wheels cw ON wp.wheel_id = cw.id
                WHERE wp.id = $1 AND cw.company_id = $2
            `, [prizeId, companyId]);

            if (prizeResult.rows.length === 0) {
                return { success: false, message: 'Prêmio não encontrado', canWin: false };
            }

            const prize = prizeResult.rows[0];

            // Verificar se prêmio está ativo
            if (!prize.is_active) {
                return { success: false, message: 'Prêmio não está ativo', canWin: false };
            }

            // Verificar limite total
            if (prize.max_wins_total && prize.current_wins >= prize.max_wins_total) {
                return { success: false, message: 'Limite total de vitórias atingido', canWin: false };
            }

            // Verificar limite por usuário
            const userWinsResult = await client.query(`
                SELECT COUNT(*) as user_wins
                FROM polox.wheel_spins
                WHERE prize_id = $1 AND user_id = $2
            `, [prizeId, userId]);

            const userWins = parseInt(userWinsResult.rows[0].user_wins);
            if (userWins >= prize.max_wins_per_user) {
                return { 
                    success: false, 
                    message: 'Limite de vitórias por usuário atingido', 
                    canWin: false 
                };
            }

            return {
                success: true,
                canWin: true,
                userWinsRemaining: prize.max_wins_per_user - userWins,
                totalWinsRemaining: prize.max_wins_total ? 
                    prize.max_wins_total - prize.current_wins : null
            };

        } catch (error) {
            console.error('Erro ao verificar se usuário pode ganhar prêmio:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    // Obter prêmios elegíveis para sorteio
    async getEligiblePrizes(wheelId, userId, companyId) {
        this._validateCompanyAccess(companyId);

        const query = `
            SELECT 
                wp.*,
                COUNT(ws.id) as user_wins
            FROM ${this.table} wp
            JOIN polox.custom_wheels cw ON wp.wheel_id = cw.id
            LEFT JOIN polox.wheel_spins ws ON wp.id = ws.prize_id AND ws.user_id = $2
            WHERE wp.wheel_id = $1 
            AND cw.company_id = $3
            AND wp.is_active = true
            AND (wp.max_wins_total IS NULL OR wp.current_wins < wp.max_wins_total)
            GROUP BY wp.id
            HAVING COUNT(ws.id) < wp.max_wins_per_user
            ORDER BY wp.display_order ASC
        `;

        try {
            const result = await this.db.query(query, [wheelId, userId, companyId]);

            // Parsear custom_reward e preparar para sorteio
            const prizes = result.rows.map(prize => ({
                ...prize,
                custom_reward: prize.custom_reward ? JSON.parse(prize.custom_reward) : null
            }));

            return {
                success: true,
                data: prizes
            };

        } catch (error) {
            console.error('Erro ao buscar prêmios elegíveis:', error);
            throw error;
        }
    }

    // Sortear prêmio baseado nas probabilidades
    async drawPrize(wheelId, userId, companyId) {
        this._validateCompanyAccess(companyId);

        try {
            // Obter prêmios elegíveis
            const eligibleResult = await this.getEligiblePrizes(wheelId, userId, companyId);
            
            if (!eligibleResult.success || eligibleResult.data.length === 0) {
                return { success: false, message: 'Nenhum prêmio disponível para sorteio' };
            }

            const prizes = eligibleResult.data;

            // Calcular peso total
            const totalWeight = prizes.reduce((sum, prize) => sum + prize.probability_weight, 0);
            
            if (totalWeight === 0) {
                return { success: false, message: 'Nenhum prêmio tem peso de probabilidade' };
            }

            // Sortear número aleatório
            const random = Math.random() * totalWeight;
            let currentWeight = 0;

            // Encontrar prêmio sorteado
            for (const prize of prizes) {
                currentWeight += prize.probability_weight;
                if (random <= currentWeight) {
                    return {
                        success: true,
                        data: prize,
                        probability: (prize.probability_weight / totalWeight * 100).toFixed(2)
                    };
                }
            }

            // Fallback para o último prêmio (não deveria acontecer)
            return {
                success: true,
                data: prizes[prizes.length - 1],
                probability: (prizes[prizes.length - 1].probability_weight / totalWeight * 100).toFixed(2)
            };

        } catch (error) {
            console.error('Erro ao sortear prêmio:', error);
            throw error;
        }
    }

    // Deletar prêmio
    async delete(prizeId, companyId) {
        this._validateCompanyAccess(companyId);

        const client = await this.db.connect();

        try {
            await client.query('BEGIN');

            // Verificar se prêmio existe e pertence à empresa
            const checkResult = await client.query(`
                SELECT wp.id FROM ${this.table} wp
                JOIN polox.custom_wheels cw ON wp.wheel_id = cw.id
                WHERE wp.id = $1 AND cw.company_id = $2
            `, [prizeId, companyId]);

            if (checkResult.rows.length === 0) {
                throw new Error('Prêmio não encontrado');
            }

            // Deletar prêmio
            await client.query(`DELETE FROM ${this.table} WHERE id = $1`, [prizeId]);

            await client.query('COMMIT');

            return {
                success: true,
                message: 'Prêmio removido com sucesso'
            };

        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Erro ao deletar prêmio:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    // Obter estatísticas do prêmio
    async getStats(prizeId, companyId, options = {}) {
        this._validateCompanyAccess(companyId);

        const { dateFrom = null, dateTo = null } = options;

        let whereConditions = ['ws.prize_id = $1'];
        let params = [prizeId];
        let paramCount = 1;

        if (dateFrom) {
            whereConditions.push(`ws.created_at >= $${++paramCount}`);
            params.push(dateFrom);
        }

        if (dateTo) {
            whereConditions.push(`ws.created_at <= $${++paramCount}`);
            params.push(dateTo);
        }

        const query = `
            SELECT 
                COUNT(ws.id) as total_wins,
                COUNT(DISTINCT ws.user_id) as unique_winners,
                DATE_TRUNC('day', ws.created_at) as win_date,
                COUNT(*) as daily_wins
            FROM polox.wheel_spins ws
            WHERE ${whereConditions.join(' AND ')}
            GROUP BY DATE_TRUNC('day', ws.created_at)
            ORDER BY win_date DESC
        `;

        try {
            const result = await this.db.query(query, params);

            return {
                success: true,
                data: result.rows
            };

        } catch (error) {
            console.error('Erro ao obter estatísticas do prêmio:', error);
            throw error;
        }
    }
}

module.exports = WheelPrize;