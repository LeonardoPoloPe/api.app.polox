const { Client } = require('pg');
const { v4: uuidv4 } = require('uuid');

class WheelSpin {
    constructor(db) {
        this.db = db;
        this.table = 'polox.wheel_spins';
    }

    // Validações
    _validateCompanyAccess(companyId) {
        if (!companyId) {
            throw new Error('Company ID é obrigatório para operações multi-tenant');
        }
    }

    _validateSpinData(data) {
        const errors = [];

        if (!data.wheel_id) {
            errors.push('ID da roleta é obrigatório');
        }

        if (!data.user_id) {
            errors.push('ID do usuário é obrigatório');
        }

        if (!data.spin_result) {
            errors.push('Resultado do giro é obrigatório');
        }

        if (data.spin_result && !['won', 'lost'].includes(data.spin_result)) {
            errors.push('Resultado deve ser "won" ou "lost"');
        }

        if (data.coins_spent && data.coins_spent < 0) {
            errors.push('Moedas gastas não pode ser negativo');
        }

        if (data.spin_angle && (data.spin_angle < 0 || data.spin_angle >= 360)) {
            errors.push('Ângulo do giro deve estar entre 0 e 359.99 graus');
        }

        if (errors.length > 0) {
            throw new Error(`Dados inválidos: ${errors.join(', ')}`);
        }
    }

    // Executar giro da roleta
    async executeSpin(companyId, wheelId, userId, options = {}) {
        this._validateCompanyAccess(companyId);

        const client = await this.db.connect();
        
        try {
            await client.query('BEGIN');

            // Verificar se usuário pode girar
            const CustomWheel = require('./CustomWheel');
            const customWheel = new CustomWheel(this.db);
            const canSpinResult = await customWheel.canUserSpin(wheelId, userId, companyId);

            if (!canSpinResult.canSpin) {
                throw new Error(canSpinResult.message);
            }

            // Sortear prêmio
            const WheelPrize = require('./WheelPrize');
            const wheelPrize = new WheelPrize(this.db);
            const drawResult = await wheelPrize.drawPrize(wheelId, userId, companyId);

            let prizeWon = null;
            let spinResult = 'lost';

            if (drawResult.success && drawResult.data) {
                prizeWon = drawResult.data;
                spinResult = 'won';

                // Incrementar contador do prêmio
                await wheelPrize.incrementWins(prizeWon.id, companyId);
            }

            // Calcular ângulo de parada baseado no prêmio sorteado ou aleatório se perdeu
            const spinAngle = this._calculateSpinAngle(prizeWon, options.totalPrizes || 8);

            // Obter custo da roleta
            const wheelResult = await client.query(`
                SELECT cost_in_coins FROM polox.custom_wheels 
                WHERE id = $1 AND company_id = $2
            `, [wheelId, companyId]);

            const costInCoins = wheelResult.rows[0]?.cost_in_coins || 0;

            // Descontar moedas do usuário se necessário
            if (costInCoins > 0) {
                const updateCoinsResult = await client.query(`
                    UPDATE polox.user_gamification_profiles 
                    SET total_coins = total_coins - $1
                    WHERE user_id = $2 AND company_id = $3 AND total_coins >= $1
                    RETURNING total_coins
                `, [costInCoins, userId, companyId]);

                if (updateCoinsResult.rows.length === 0) {
                    throw new Error('Moedas insuficientes');
                }
            }

            // Registrar giro
            const spinData = {
                wheel_id: wheelId,
                user_id: userId,
                prize_id: prizeWon?.id || null,
                spin_result: spinResult,
                coins_spent: costInCoins,
                spin_angle: spinAngle,
                spin_duration: options.spinDuration || 3000
            };

            this._validateSpinData(spinData);

            const insertQuery = `
                INSERT INTO ${this.table} (
                    wheel_id, user_id, prize_id, spin_result, coins_spent,
                    spin_angle, spin_duration
                ) VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING *
            `;

            const insertValues = [
                spinData.wheel_id,
                spinData.user_id,
                spinData.prize_id,
                spinData.spin_result,
                spinData.coins_spent,
                spinData.spin_angle,
                spinData.spin_duration
            ];

            const spinInsertResult = await client.query(insertQuery, insertValues);

            // Se ganhou prêmio, aplicar recompensas
            if (prizeWon) {
                await this._applyPrizeRewards(client, prizeWon, userId, companyId);
            }

            await client.query('COMMIT');

            return {
                success: true,
                data: {
                    spin: spinInsertResult.rows[0],
                    prize: prizeWon,
                    spinAngle: spinAngle,
                    result: spinResult
                },
                message: spinResult === 'won' ? 
                    `Parabéns! Você ganhou: ${prizeWon.name}` : 
                    'Que pena! Tente novamente.'
            };

        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Erro ao executar giro:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    // Calcular ângulo de parada da roleta
    _calculateSpinAngle(prize, totalPrizes) {
        if (!prize) {
            // Se não ganhou, retornar ângulo aleatório em área sem prêmio
            return Math.random() * 360;
        }

        // Calcular ângulo baseado na posição do prêmio
        const sectionSize = 360 / totalPrizes;
        const prizeIndex = prize.display_order || 0;
        const sectionStart = prizeIndex * sectionSize;
        const sectionEnd = sectionStart + sectionSize;
        
        // Ângulo aleatório dentro da seção do prêmio
        return sectionStart + (Math.random() * (sectionEnd - sectionStart));
    }

    // Aplicar recompensas do prêmio
    async _applyPrizeRewards(client, prize, userId, companyId) {
        try {
            // Aplicar moedas
            if (prize.coins_amount > 0) {
                await client.query(`
                    UPDATE polox.user_gamification_profiles 
                    SET total_coins = total_coins + $1
                    WHERE user_id = $2 AND company_id = $3
                `, [prize.coins_amount, userId, companyId]);
            }

            // Aplicar XP
            if (prize.xp_amount > 0) {
                await client.query(`
                    UPDATE polox.user_gamification_profiles 
                    SET total_xp = total_xp + $1
                    WHERE user_id = $2 AND company_id = $3
                `, [prize.xp_amount, userId, companyId]);

                // Log de gamificação
                await client.query(`
                    INSERT INTO polox.gamification_history 
                    (user_id, company_id, type, points_earned, xp_earned, description, metadata)
                    VALUES ($1, $2, 'wheel_spin', 0, $3, $4, $5)
                `, [
                    userId, companyId, prize.xp_amount,
                    `XP ganho na roleta: ${prize.name}`,
                    JSON.stringify({ prize_id: prize.id, wheel_id: prize.wheel_id })
                ]);
            }

            // Para outros tipos de prêmios, você pode implementar lógicas específicas
            // como criar registros em tabelas específicas, enviar emails, etc.

        } catch (error) {
            console.error('Erro ao aplicar recompensas:', error);
            throw error;
        }
    }

    // Buscar giro por ID
    async findById(spinId, companyId) {
        this._validateCompanyAccess(companyId);

        const query = `
            SELECT 
                ws.*,
                u.name as user_name,
                u.email as user_email,
                cw.name as wheel_name,
                wp.name as prize_name,
                wp.prize_type,
                wp.coins_amount as prize_coins,
                wp.xp_amount as prize_xp
            FROM ${this.table} ws
            JOIN polox.users u ON ws.user_id = u.id
            JOIN polox.custom_wheels cw ON ws.wheel_id = cw.id
            LEFT JOIN polox.wheel_prizes wp ON ws.prize_id = wp.id
            WHERE ws.id = $1 AND cw.company_id = $2
        `;

        try {
            const result = await this.db.query(query, [spinId, companyId]);
            
            if (result.rows.length === 0) {
                return { success: false, message: 'Giro não encontrado' };
            }

            return {
                success: true,
                data: result.rows[0]
            };

        } catch (error) {
            console.error('Erro ao buscar giro:', error);
            throw error;
        }
    }

    // Buscar giros por usuário
    async findByUser(userId, companyId, options = {}) {
        this._validateCompanyAccess(companyId);

        const {
            wheelId = null,
            result = null, // 'won' ou 'lost'
            dateFrom = null,
            dateTo = null,
            limit = 50,
            offset = 0
        } = options;

        let whereConditions = [
            'ws.user_id = $1',
            'cw.company_id = $2'
        ];
        let params = [userId, companyId];
        let paramCount = 2;

        if (wheelId) {
            whereConditions.push(`ws.wheel_id = $${++paramCount}`);
            params.push(wheelId);
        }

        if (result) {
            whereConditions.push(`ws.spin_result = $${++paramCount}`);
            params.push(result);
        }

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
                ws.*,
                cw.name as wheel_name,
                wp.name as prize_name,
                wp.prize_type,
                wp.coins_amount as prize_coins,
                wp.xp_amount as prize_xp
            FROM ${this.table} ws
            JOIN polox.custom_wheels cw ON ws.wheel_id = cw.id
            LEFT JOIN polox.wheel_prizes wp ON ws.prize_id = wp.id
            WHERE ${whereConditions.join(' AND ')}
            ORDER BY ws.created_at DESC
            LIMIT $${++paramCount} OFFSET $${++paramCount}
        `;

        params.push(limit, offset);

        try {
            const result = await this.db.query(query, params);

            return {
                success: true,
                data: result.rows,
                count: result.rows.length
            };

        } catch (error) {
            console.error('Erro ao buscar giros do usuário:', error);
            throw error;
        }
    }

    // Buscar giros por roleta
    async findByWheel(wheelId, companyId, options = {}) {
        this._validateCompanyAccess(companyId);

        const {
            result = null,
            dateFrom = null,
            dateTo = null,
            limit = 100,
            offset = 0
        } = options;

        let whereConditions = [
            'ws.wheel_id = $1',
            'cw.company_id = $2'
        ];
        let params = [wheelId, companyId];
        let paramCount = 2;

        if (result) {
            whereConditions.push(`ws.spin_result = $${++paramCount}`);
            params.push(result);
        }

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
                ws.*,
                u.name as user_name,
                u.email as user_email,
                wp.name as prize_name,
                wp.prize_type
            FROM ${this.table} ws
            JOIN polox.custom_wheels cw ON ws.wheel_id = cw.id
            JOIN polox.users u ON ws.user_id = u.id
            LEFT JOIN polox.wheel_prizes wp ON ws.prize_id = wp.id
            WHERE ${whereConditions.join(' AND ')}
            ORDER BY ws.created_at DESC
            LIMIT $${++paramCount} OFFSET $${++paramCount}
        `;

        params.push(limit, offset);

        try {
            const result = await this.db.query(query, params);

            return {
                success: true,
                data: result.rows,
                count: result.rows.length
            };

        } catch (error) {
            console.error('Erro ao buscar giros da roleta:', error);
            throw error;
        }
    }

    // Marcar prêmio como entregue
    async markPrizeDelivered(spinId, companyId, userId) {
        this._validateCompanyAccess(companyId);

        const client = await this.db.connect();

        try {
            await client.query('BEGIN');

            // Verificar se giro existe e tem prêmio
            const checkResult = await client.query(`
                SELECT ws.id FROM ${this.table} ws
                JOIN polox.custom_wheels cw ON ws.wheel_id = cw.id
                WHERE ws.id = $1 AND cw.company_id = $2 
                AND ws.prize_id IS NOT NULL AND ws.prize_delivered = false
            `, [spinId, companyId]);

            if (checkResult.rows.length === 0) {
                throw new Error('Giro não encontrado ou prêmio já entregue');
            }

            // Marcar como entregue
            const result = await client.query(`
                UPDATE ${this.table} 
                SET prize_delivered = true, prize_delivery_date = NOW()
                WHERE id = $1
                RETURNING *
            `, [spinId]);

            await client.query('COMMIT');

            return {
                success: true,
                data: result.rows[0],
                message: 'Prêmio marcado como entregue'
            };

        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Erro ao marcar prêmio como entregue:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    // Obter estatísticas de giros
    async getStats(companyId, options = {}) {
        this._validateCompanyAccess(companyId);

        const {
            wheelId = null,
            userId = null,
            dateFrom = null,
            dateTo = null,
            groupBy = 'day' // day, week, month
        } = options;

        let whereConditions = ['cw.company_id = $1'];
        let params = [companyId];
        let paramCount = 1;

        if (wheelId) {
            whereConditions.push(`ws.wheel_id = $${++paramCount}`);
            params.push(wheelId);
        }

        if (userId) {
            whereConditions.push(`ws.user_id = $${++paramCount}`);
            params.push(userId);
        }

        if (dateFrom) {
            whereConditions.push(`ws.created_at >= $${++paramCount}`);
            params.push(dateFrom);
        }

        if (dateTo) {
            whereConditions.push(`ws.created_at <= $${++paramCount}`);
            params.push(dateTo);
        }

        // Definir agrupamento temporal
        let dateGroup;
        switch (groupBy) {
            case 'week':
                dateGroup = "date_trunc('week', ws.created_at)";
                break;
            case 'month':
                dateGroup = "date_trunc('month', ws.created_at)";
                break;
            default:
                dateGroup = "date_trunc('day', ws.created_at)";
        }

        const query = `
            SELECT 
                ${dateGroup} as time_period,
                COUNT(ws.id) as total_spins,
                COUNT(DISTINCT ws.user_id) as unique_spinners,
                COUNT(CASE WHEN ws.spin_result = 'won' THEN 1 END) as winning_spins,
                COUNT(CASE WHEN ws.spin_result = 'lost' THEN 1 END) as losing_spins,
                ROUND(
                    (COUNT(CASE WHEN ws.spin_result = 'won' THEN 1 END) * 100.0 / 
                     NULLIF(COUNT(ws.id), 0)), 2
                ) as win_rate_percentage,
                SUM(ws.coins_spent) as total_coins_spent,
                AVG(ws.coins_spent) as avg_coins_per_spin
            FROM ${this.table} ws
            JOIN polox.custom_wheels cw ON ws.wheel_id = cw.id
            WHERE ${whereConditions.join(' AND ')}
            GROUP BY ${dateGroup}
            ORDER BY time_period DESC
        `;

        try {
            const result = await this.db.query(query, params);

            return {
                success: true,
                data: result.rows,
                groupBy: groupBy
            };

        } catch (error) {
            console.error('Erro ao obter estatísticas de giros:', error);
            throw error;
        }
    }

    // Ranking de usuários por giros
    async getUserRanking(companyId, options = {}) {
        this._validateCompanyAccess(companyId);

        const {
            wheelId = null,
            dateFrom = null,
            dateTo = null,
            limit = 20
        } = options;

        let whereConditions = ['cw.company_id = $1'];
        let params = [companyId];
        let paramCount = 1;

        if (wheelId) {
            whereConditions.push(`ws.wheel_id = $${++paramCount}`);
            params.push(wheelId);
        }

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
                u.id,
                u.name,
                u.email,
                COUNT(ws.id) as total_spins,
                COUNT(CASE WHEN ws.spin_result = 'won' THEN 1 END) as wins,
                COUNT(CASE WHEN ws.spin_result = 'lost' THEN 1 END) as losses,
                ROUND(
                    (COUNT(CASE WHEN ws.spin_result = 'won' THEN 1 END) * 100.0 / 
                     NULLIF(COUNT(ws.id), 0)), 2
                ) as win_rate_percentage,
                SUM(ws.coins_spent) as total_coins_spent,
                MAX(ws.created_at) as last_spin
            FROM ${this.table} ws
            JOIN polox.custom_wheels cw ON ws.wheel_id = cw.id
            JOIN polox.users u ON ws.user_id = u.id
            WHERE ${whereConditions.join(' AND ')}
            GROUP BY u.id, u.name, u.email
            ORDER BY total_spins DESC, wins DESC
            LIMIT $${++paramCount}
        `;

        params.push(limit);

        try {
            const result = await this.db.query(query, params);

            return {
                success: true,
                data: result.rows
            };

        } catch (error) {
            console.error('Erro ao obter ranking de usuários:', error);
            throw error;
        }
    }

    // Prêmios não entregues
    async getPendingDeliveries(companyId, options = {}) {
        this._validateCompanyAccess(companyId);

        const { wheelId = null, limit = 50, offset = 0 } = options;

        let whereConditions = [
            'cw.company_id = $1',
            'ws.prize_id IS NOT NULL',
            'ws.prize_delivered = false'
        ];
        let params = [companyId];
        let paramCount = 1;

        if (wheelId) {
            whereConditions.push(`ws.wheel_id = $${++paramCount}`);
            params.push(wheelId);
        }

        const query = `
            SELECT 
                ws.*,
                u.name as user_name,
                u.email as user_email,
                cw.name as wheel_name,
                wp.name as prize_name,
                wp.prize_type,
                wp.physical_item_name
            FROM ${this.table} ws
            JOIN polox.custom_wheels cw ON ws.wheel_id = cw.id
            JOIN polox.users u ON ws.user_id = u.id
            JOIN polox.wheel_prizes wp ON ws.prize_id = wp.id
            WHERE ${whereConditions.join(' AND ')}
            ORDER BY ws.created_at ASC
            LIMIT $${++paramCount} OFFSET $${++paramCount}
        `;

        params.push(limit, offset);

        try {
            const result = await this.db.query(query, params);

            return {
                success: true,
                data: result.rows,
                count: result.rows.length
            };

        } catch (error) {
            console.error('Erro ao buscar entregas pendentes:', error);
            throw error;
        }
    }
}

module.exports = WheelSpin;