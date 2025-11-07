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

class CustomWheel {
    constructor(db) {
        this.db = db;
        this.table = 'polox.custom_wheels';
    }

    // Validações
    _validateCompanyAccess(companyId) {
        if (!companyId) {
            throw new Error('Company ID é obrigatório para operações multi-tenant');
        }
    }

    _validateWheelData(data) {
        const errors = [];

        if (!data.name || data.name.trim().length < 3) {
            errors.push('Nome da roleta é obrigatório (mínimo 3 caracteres)');
        }

        if (data.background_color && !/^#[0-9A-Fa-f]{6}$/.test(data.background_color)) {
            errors.push('Cor de fundo deve estar no formato hexadecimal (#RRGGBB)');
        }

        if (data.border_color && !/^#[0-9A-Fa-f]{6}$/.test(data.border_color)) {
            errors.push('Cor da borda deve estar no formato hexadecimal (#RRGGBB)');
        }

        if (data.text_color && !/^#[0-9A-Fa-f]{6}$/.test(data.text_color)) {
            errors.push('Cor do texto deve estar no formato hexadecimal (#RRGGBB)');
        }

        if (data.max_spins_per_user && (data.max_spins_per_user < 1 || data.max_spins_per_user > 100)) {
            errors.push('Máximo de giros por usuário deve estar entre 1 e 100');
        }

        if (data.cost_in_coins && data.cost_in_coins < 0) {
            errors.push('Custo em moedas não pode ser negativo');
        }

        if (data.animation_duration && (data.animation_duration < 1000 || data.animation_duration > 10000)) {
            errors.push('Duração da animação deve estar entre 1000ms e 10000ms');
        }

        if (errors.length > 0) {
            throw new Error(`Dados inválidos: ${errors.join(', ')}`);
        }
    }

    // Criar roleta personalizada
    async create(companyId, wheelData, userId) {
        this._validateCompanyAccess(companyId);
        this._validateWheelData(wheelData);

        const client = await this.db.connect();
        
        try {
            await client.query('BEGIN');

            // Verificar se usuário existe e pertence à empresa
            if (userId) {
                const userResult = await client.query(`
                    SELECT id FROM polox.users 
                    WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL
                `, [userId, companyId]);

                if (userResult.rows.length === 0) {
                    throw new Error('Usuário não encontrado ou não pertence à empresa');
                }
            }

            // Inserir roleta
            const query = `
                INSERT INTO ${this.table} (
                    company_id, created_by_user_id, name, description, background_color,
                    border_color, text_color, max_spins_per_user, max_spins_per_day,
                    requires_level, cost_in_coins, is_active, starts_at, ends_at,
                    show_probabilities, animation_duration
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
                RETURNING *
            `;

            const values = [
                companyId,
                userId || null,
                wheelData.name.trim(),
                wheelData.description || null,
                wheelData.background_color || '#FFFFFF',
                wheelData.border_color || '#000000',
                wheelData.text_color || '#000000',
                wheelData.max_spins_per_user || 1,
                wheelData.max_spins_per_day || null,
                wheelData.requires_level || 1,
                wheelData.cost_in_coins || 0,
                wheelData.is_active !== undefined ? wheelData.is_active : true,
                wheelData.starts_at || null,
                wheelData.ends_at || null,
                wheelData.show_probabilities || false,
                wheelData.animation_duration || 3000
            ];

            const result = await client.query(query, values);
            await client.query('COMMIT');

            return {
                success: true,
                data: result.rows[0],
                message: 'Roleta criada com sucesso'
            };

        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Erro ao criar roleta:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    // Buscar roleta por ID
    async findById(wheelId, companyId) {
        this._validateCompanyAccess(companyId);

        const query = `
            SELECT 
                cw.*,
                u.full_name as created_by_name,
                COUNT(wp.id) as prizes_count,
                COUNT(ws.id) as total_spins
            FROM ${this.table} cw
            LEFT JOIN polox.users u ON cw.created_by_user_id = u.id
            LEFT JOIN polox.wheel_prizes wp ON cw.id = wp.wheel_id AND wp.is_active = true
            LEFT JOIN polox.wheel_spins ws ON cw.id = ws.wheel_id
            WHERE cw.id = $1 AND cw.company_id = $2
            GROUP BY cw.id, u.full_name
        `;

        try {
            const result = await this.db.query(query, [wheelId, companyId]);
            
            if (result.rows.length === 0) {
                return { success: false, message: 'Roleta não encontrada' };
            }

            return {
                success: true,
                data: result.rows[0]
            };

        } catch (error) {
            console.error('Erro ao buscar roleta:', error);
            throw error;
        }
    }

    // Listar roletas da empresa
    async findByCompany(companyId, options = {}) {
        this._validateCompanyAccess(companyId);

        const {
            isActive = null,
            includeInactive = true,
            limit = 50,
            offset = 0
        } = options;

        let whereConditions = ['cw.company_id = $1'];
        let params = [companyId];
        let paramCount = 1;

        if (isActive !== null) {
            whereConditions.push(`cw.is_active = $${++paramCount}`);
            params.push(isActive);
        }

        // Verificar se está no período ativo
        if (!includeInactive) {
            whereConditions.push(`(cw.starts_at IS NULL OR cw.starts_at <= NOW())`);
            whereConditions.push(`(cw.ends_at IS NULL OR cw.ends_at >= NOW())`);
        }

        const query = `
            SELECT 
                cw.*,
                u.full_name as created_by_name,
                COUNT(wp.id) as prizes_count,
                COUNT(DISTINCT ws.user_id) as unique_spinners,
                COUNT(ws.id) as total_spins
            FROM ${this.table} cw
            LEFT JOIN polox.users u ON cw.created_by_user_id = u.id
            LEFT JOIN polox.wheel_prizes wp ON cw.id = wp.wheel_id AND wp.is_active = true
            LEFT JOIN polox.wheel_spins ws ON cw.id = ws.wheel_id
            WHERE ${whereConditions.join(' AND ')}
            GROUP BY cw.id, u.full_name
            ORDER BY cw.created_at DESC
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
            console.error('Erro ao listar roletas:', error);
            throw error;
        }
    }

    // Atualizar roleta
    async update(wheelId, companyId, updateData, userId) {
        this._validateCompanyAccess(companyId);
        
        if (Object.keys(updateData).length > 0) {
            this._validateWheelData(updateData);
        }

        const allowedFields = [
            'name', 'description', 'background_color', 'border_color', 'text_color',
            'max_spins_per_user', 'max_spins_per_day', 'requires_level', 'cost_in_coins',
            'is_active', 'starts_at', 'ends_at', 'show_probabilities', 'animation_duration'
        ];

        const updates = [];
        const values = [];
        let paramCount = 0;

        // Construir query de update dinamicamente
        for (const [key, value] of Object.entries(updateData)) {
            if (allowedFields.includes(key)) {
                updates.push(`${key} = $${++paramCount}`);
                values.push(value);
            }
        }

        if (updates.length === 0) {
            throw new Error('Nenhum campo válido para atualização');
        }

        const client = await this.db.connect();

        try {
            await client.query('BEGIN');

            // Verificar se roleta existe e pertence à empresa
            const checkResult = await client.query(`
                SELECT id FROM ${this.table} 
                WHERE id = $1 AND company_id = $2
            `, [wheelId, companyId]);

            if (checkResult.rows.length === 0) {
                throw new Error('Roleta não encontrada');
            }

            // Atualizar roleta
            const updateQuery = `
                UPDATE ${this.table} 
                SET ${updates.join(', ')}, updated_at = NOW()
                WHERE id = $${++paramCount} AND company_id = $${++paramCount}
                RETURNING *
            `;
            values.push(wheelId, companyId);

            const result = await client.query(updateQuery, values);
            await client.query('COMMIT');

            return {
                success: true,
                data: result.rows[0],
                message: 'Roleta atualizada com sucesso'
            };

        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Erro ao atualizar roleta:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    // Verificar se usuário pode girar
    async canUserSpin(wheelId, userId, companyId) {
        this._validateCompanyAccess(companyId);

        const client = await this.db.connect();

        try {
            // Buscar informações da roleta
            const wheelResult = await client.query(`
                SELECT 
                    cw.*,
                    ugp.current_level,
                    ugp.total_coins
                FROM ${this.table} cw
                LEFT JOIN polox.user_gamification_profiles ugp 
                    ON ugp.user_id = $1 AND ugp.company_id = cw.company_id
                WHERE cw.id = $2 AND cw.company_id = $3
            `, [userId, wheelId, companyId]);

            if (wheelResult.rows.length === 0) {
                return { success: false, message: 'Roleta não encontrada', canSpin: false };
            }

            const wheel = wheelResult.rows[0];

            // Verificar se a roleta está ativa
            if (!wheel.is_active) {
                return { success: false, message: 'Roleta não está ativa', canSpin: false };
            }

            // Verificar período de atividade
            const now = new Date();
            if (wheel.starts_at && new Date(wheel.starts_at) > now) {
                return { success: false, message: 'Roleta ainda não começou', canSpin: false };
            }
            if (wheel.ends_at && new Date(wheel.ends_at) < now) {
                return { success: false, message: 'Roleta já terminou', canSpin: false };
            }

            // Verificar nível mínimo
            if (wheel.requires_level > (wheel.current_level || 1)) {
                return { 
                    success: false, 
                    message: `Nível mínimo necessário: ${wheel.requires_level}`, 
                    canSpin: false 
                };
            }

            // Verificar moedas suficientes
            if (wheel.cost_in_coins > (wheel.total_coins || 0)) {
                return { 
                    success: false, 
                    message: `Moedas insuficientes. Necessário: ${wheel.cost_in_coins}`, 
                    canSpin: false 
                };
            }

            // Verificar limite de giros por usuário
            const userSpinsResult = await client.query(`
                SELECT COUNT(*) as user_spins
                FROM polox.wheel_spins
                WHERE wheel_id = $1 AND user_id = $2
            `, [wheelId, userId]);

            const userSpins = parseInt(userSpinsResult.rows[0].user_spins);
            if (userSpins >= wheel.max_spins_per_user) {
                return { 
                    success: false, 
                    message: 'Limite de giros por usuário atingido', 
                    canSpin: false 
                };
            }

            // Verificar limite de giros por dia
            if (wheel.max_spins_per_day) {
                const todaySpinsResult = await client.query(`
                    SELECT COUNT(*) as today_spins
                    FROM polox.wheel_spins
                    WHERE wheel_id = $1 AND DATE(created_at) = CURRENT_DATE
                `, [wheelId]);

                const todaySpins = parseInt(todaySpinsResult.rows[0].today_spins);
                if (todaySpins >= wheel.max_spins_per_day) {
                    return { 
                        success: false, 
                        message: 'Limite diário de giros atingido', 
                        canSpin: false 
                    };
                }
            }

            return {
                success: true,
                canSpin: true,
                spinsRemaining: wheel.max_spins_per_user - userSpins,
                costInCoins: wheel.cost_in_coins,
                message: 'Usuário pode girar a roleta'
            };

        } catch (error) {
            console.error('Erro ao verificar se usuário pode girar:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    // Obter roletas ativas disponíveis para o usuário
    async getAvailableWheels(userId, companyId) {
        this._validateCompanyAccess(companyId);

        const query = `
            SELECT 
                cw.*,
                ugp.current_level,
                ugp.total_coins,
                COUNT(ws.id) as user_spins,
                (cw.max_spins_per_user - COUNT(ws.id)) as spins_remaining
            FROM ${this.table} cw
            LEFT JOIN polox.user_gamification_profiles ugp 
                ON ugp.user_id = $1 AND ugp.company_id = cw.company_id
            LEFT JOIN polox.wheel_spins ws 
                ON cw.id = ws.wheel_id AND ws.user_id = $1
            WHERE cw.company_id = $2 
            AND cw.is_active = true
            AND (cw.starts_at IS NULL OR cw.starts_at <= NOW())
            AND (cw.ends_at IS NULL OR cw.ends_at >= NOW())
            AND (ugp.current_level IS NULL OR ugp.current_level >= cw.requires_level)
            GROUP BY cw.id, ugp.current_level, ugp.total_coins
            HAVING COUNT(ws.id) < cw.max_spins_per_user
            ORDER BY cw.created_at DESC
        `;

        try {
            const result = await this.db.query(query, [userId, companyId]);

            return {
                success: true,
                data: result.rows
            };

        } catch (error) {
            console.error('Erro ao buscar roletas disponíveis:', error);
            throw error;
        }
    }

    // Deletar roleta
    async delete(wheelId, companyId, userId) {
        this._validateCompanyAccess(companyId);

        const client = await this.db.connect();

        try {
            await client.query('BEGIN');

            // Verificar se roleta existe
            const checkResult = await client.query(`
                SELECT id FROM ${this.table} 
                WHERE id = $1 AND company_id = $2
            `, [wheelId, companyId]);

            if (checkResult.rows.length === 0) {
                throw new Error('Roleta não encontrada');
            }

            // Deletar roleta (CASCADE irá deletar prêmios e giros)
            await client.query(`DELETE FROM ${this.table} WHERE id = $1`, [wheelId]);

            await client.query('COMMIT');

            return {
                success: true,
                message: 'Roleta removida com sucesso'
            };

        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Erro ao deletar roleta:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    // Obter estatísticas da roleta
    async getStats(wheelId, companyId, options = {}) {
        this._validateCompanyAccess(companyId);

        const { dateFrom = null, dateTo = null } = options;

        let whereConditions = ['ws.wheel_id = $1'];
        let params = [wheelId];
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
                COUNT(ws.id) as total_spins,
                COUNT(DISTINCT ws.user_id) as unique_users,
                COUNT(CASE WHEN ws.prize_id IS NOT NULL THEN 1 END) as winning_spins,
                ROUND(
                    (COUNT(CASE WHEN ws.prize_id IS NOT NULL THEN 1 END) * 100.0 / COUNT(ws.id)), 2
                ) as win_rate_percentage,
                DATE_TRUNC('day', ws.created_at) as spin_date,
                COUNT(*) as daily_spins
            FROM polox.wheel_spins ws
            WHERE ${whereConditions.join(' AND ')}
            GROUP BY DATE_TRUNC('day', ws.created_at)
            ORDER BY spin_date DESC
        `;

        try {
            const result = await this.db.query(query, params);

            // Também buscar estatísticas gerais
            const generalStatsQuery = `
                SELECT 
                    COUNT(ws.id) as total_spins,
                    COUNT(DISTINCT ws.user_id) as unique_users,
                    COUNT(CASE WHEN ws.prize_id IS NOT NULL THEN 1 END) as winning_spins,
                    ROUND(
                        (COUNT(CASE WHEN ws.prize_id IS NOT NULL THEN 1 END) * 100.0 / 
                         NULLIF(COUNT(ws.id), 0)), 2
                    ) as win_rate_percentage
                FROM polox.wheel_spins ws
                WHERE ws.wheel_id = $1
            `;

            const generalResult = await this.db.query(generalStatsQuery, [wheelId]);

            return {
                success: true,
                data: {
                    general: generalResult.rows[0],
                    daily: result.rows
                }
            };

        } catch (error) {
            console.error('Erro ao obter estatísticas da roleta:', error);
            throw error;
        }
    }
}

module.exports = CustomWheel;