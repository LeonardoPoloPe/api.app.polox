const { Client } = require('pg');
const { v4: uuidv4 } = require('uuid');

class PushNotificationToken {
    constructor(db) {
        this.db = db;
        this.table = 'polox.push_notification_tokens';
    }

    // Validações
    _validateCompanyAccess(companyId) {
        if (!companyId) {
            throw new Error('Company ID é obrigatório para operações multi-tenant');
        }
    }

    _validateTokenData(data) {
        const errors = [];

        if (!data.user_id) {
            errors.push('ID do usuário é obrigatório');
        }

        if (!data.token || data.token.trim().length < 10) {
            errors.push('Token de push notification é obrigatório (mínimo 10 caracteres)');
        }

        if (!data.platform) {
            errors.push('Plataforma é obrigatória');
        }

        const validPlatforms = ['ios', 'android', 'web', 'desktop'];
        if (data.platform && !validPlatforms.includes(data.platform.toLowerCase())) {
            errors.push('Plataforma deve ser: ios, android, web ou desktop');
        }

        if (errors.length > 0) {
            throw new Error(`Dados inválidos: ${errors.join(', ')}`);
        }
    }

    // Registrar ou atualizar token
    async registerToken(companyId, tokenData) {
        this._validateCompanyAccess(companyId);
        this._validateTokenData(tokenData);

        const client = await this.db.connect();
        
        try {
            await client.query('BEGIN');

            // Verificar se usuário existe e pertence à empresa
            const userResult = await client.query(`
                SELECT id FROM polox.users 
                WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL
            `, [tokenData.user_id, companyId]);

            if (userResult.rows.length === 0) {
                throw new Error('Usuário não encontrado ou não pertence à empresa');
            }

            // Verificar se token já existe
            const existingResult = await client.query(`
                SELECT id, user_id, is_active FROM ${this.table} 
                WHERE token = $1
            `, [tokenData.token.trim()]);

            let result;

            if (existingResult.rows.length > 0) {
                const existingToken = existingResult.rows[0];
                
                // Se token existe para outro usuário, desativá-lo
                if (existingToken.user_id !== tokenData.user_id) {
                    await client.query(`
                        UPDATE ${this.table} 
                        SET is_active = false, updated_at = NOW()
                        WHERE token = $1
                    `, [tokenData.token.trim()]);
                }

                // Atualizar/recriar token para o usuário atual
                const updateQuery = `
                    UPDATE ${this.table} 
                    SET user_id = $1, platform = $2, device_id = $3, device_name = $4,
                        app_version = $5, is_active = true, last_used_at = NOW(), updated_at = NOW()
                    WHERE token = $6
                    RETURNING *
                `;

                const updateValues = [
                    tokenData.user_id,
                    tokenData.platform.toLowerCase(),
                    tokenData.device_id || null,
                    tokenData.device_name || null,
                    tokenData.app_version || null,
                    tokenData.token.trim()
                ];

                result = await client.query(updateQuery, updateValues);

            } else {
                // Desativar tokens antigos do mesmo usuário e plataforma
                await client.query(`
                    UPDATE ${this.table} 
                    SET is_active = false, updated_at = NOW()
                    WHERE user_id = $1 AND platform = $2 AND is_active = true
                `, [tokenData.user_id, tokenData.platform.toLowerCase()]);

                // Inserir novo token
                const insertQuery = `
                    INSERT INTO ${this.table} (
                        user_id, token, platform, device_id, device_name, app_version, is_active
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
                    RETURNING *
                `;

                const insertValues = [
                    tokenData.user_id,
                    tokenData.token.trim(),
                    tokenData.platform.toLowerCase(),
                    tokenData.device_id || null,
                    tokenData.device_name || null,
                    tokenData.app_version || null,
                    true
                ];

                result = await client.query(insertQuery, insertValues);
            }

            await client.query('COMMIT');

            return {
                success: true,
                data: result.rows[0],
                message: 'Token registrado com sucesso'
            };

        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Erro ao registrar token:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    // Buscar tokens ativos por usuário
    async findByUser(userId, companyId, options = {}) {
        this._validateCompanyAccess(companyId);

        const {
            platform = null,
            onlyActive = true,
            limit = 10,
            offset = 0
        } = options;

        let whereConditions = [
            'pnt.user_id = $1',
            'u.company_id = $2',
            'u.deleted_at IS NULL'
        ];
        let params = [userId, companyId];
        let paramCount = 2;

        if (onlyActive) {
            whereConditions.push('pnt.is_active = true');
        }

        if (platform) {
            whereConditions.push(`pnt.platform = $${++paramCount}`);
            params.push(platform.toLowerCase());
        }

        const query = `
            SELECT 
                pnt.*,
                u.full_name as user_name,
                u.email as user_email
            FROM ${this.table} pnt
            JOIN polox.users u ON pnt.user_id = u.id
            WHERE ${whereConditions.join(' AND ')}
            ORDER BY pnt.last_used_at DESC
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
            console.error('Erro ao buscar tokens do usuário:', error);
            throw error;
        }
    }

    // Buscar tokens por empresa (para envio em massa)
    async findByCompany(companyId, options = {}) {
        this._validateCompanyAccess(companyId);

        const {
            platform = null,
            userIds = null,
            onlyActive = true,
            excludeQuietHours = true,
            limit = 1000,
            offset = 0
        } = options;

        let whereConditions = [
            'u.company_id = $1',
            'u.deleted_at IS NULL'
        ];
        let params = [companyId];
        let paramCount = 1;

        if (onlyActive) {
            whereConditions.push('pnt.is_active = true');
        }

        if (platform) {
            whereConditions.push(`pnt.platform = $${++paramCount}`);
            params.push(platform.toLowerCase());
        }

        if (userIds && Array.isArray(userIds) && userIds.length > 0) {
            whereConditions.push(`pnt.user_id = ANY($${++paramCount})`);
            params.push(userIds);
        }

        // Adicionar filtro de preferências de notificação se necessário
        let joinClause = '';
        if (excludeQuietHours) {
            joinClause = `
                LEFT JOIN polox.notification_preferences np ON pnt.user_id = np.user_id
            `;
            // Aqui você pode adicionar lógica mais complexa para horário de silêncio
            whereConditions.push('(np.push_enabled IS NULL OR np.push_enabled = true)');
        }

        const query = `
            SELECT 
                pnt.*,
                u.full_name as user_name,
                u.email as user_email,
                u.timezone as user_timezone
            FROM ${this.table} pnt
            JOIN polox.users u ON pnt.user_id = u.id
            ${joinClause}
            WHERE ${whereConditions.join(' AND ')}
            ORDER BY pnt.last_used_at DESC
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
            console.error('Erro ao buscar tokens da empresa:', error);
            throw error;
        }
    }

    // Atualizar último uso do token
    async updateLastUsed(tokenId, companyId) {
        this._validateCompanyAccess(companyId);

        const query = `
            UPDATE ${this.table} 
            SET last_used_at = NOW(), updated_at = NOW()
            FROM polox.users u
            WHERE ${this.table}.id = $1 
            AND ${this.table}.user_id = u.id 
            AND u.company_id = $2
            RETURNING ${this.table}.*
        `;

        try {
            const result = await this.db.query(query, [tokenId, companyId]);

            if (result.rows.length === 0) {
                return { success: false, message: 'Token não encontrado' };
            }

            return {
                success: true,
                data: result.rows[0],
                message: 'Último uso atualizado'
            };

        } catch (error) {
            console.error('Erro ao atualizar último uso:', error);
            throw error;
        }
    }

    // Desativar token
    async deactivateToken(tokenId, companyId, reason = 'user_request') {
        this._validateCompanyAccess(companyId);

        const client = await this.db.connect();

        try {
            await client.query('BEGIN');

            // Verificar se token existe e pertence à empresa
            const checkResult = await client.query(`
                SELECT pnt.id FROM ${this.table} pnt
                JOIN polox.users u ON pnt.user_id = u.id
                WHERE pnt.id = $1 AND u.company_id = $2
            `, [tokenId, companyId]);

            if (checkResult.rows.length === 0) {
                throw new Error('Token não encontrado');
            }

            // Desativar token
            const result = await client.query(`
                UPDATE ${this.table} 
                SET is_active = false, updated_at = NOW()
                WHERE id = $1
                RETURNING *
            `, [tokenId]);

            await client.query('COMMIT');

            return {
                success: true,
                data: result.rows[0],
                message: 'Token desativado com sucesso'
            };

        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Erro ao desativar token:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    // Desativar token por string do token
    async deactivateByToken(token, reason = 'invalid_token') {
        const client = await this.db.connect();

        try {
            await client.query('BEGIN');

            const result = await client.query(`
                UPDATE ${this.table} 
                SET is_active = false, updated_at = NOW()
                WHERE token = $1 AND is_active = true
                RETURNING *
            `, [token]);

            await client.query('COMMIT');

            return {
                success: true,
                data: result.rows,
                message: 'Token desativado',
                deactivatedCount: result.rows.length
            };

        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Erro ao desativar token por string:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    // Limpar tokens inativos antigos
    async cleanupOldTokens(companyId, daysOld = 30) {
        this._validateCompanyAccess(companyId);

        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysOld);

        const query = `
            DELETE FROM ${this.table} 
            USING polox.users u
            WHERE ${this.table}.user_id = u.id
            AND u.company_id = $1
            AND ${this.table}.is_active = false
            AND ${this.table}.updated_at < $2
        `;

        try {
            const result = await this.db.query(query, [companyId, cutoffDate]);

            return {
                success: true,
                message: `${result.rowCount} tokens antigos removidos`,
                deletedCount: result.rowCount
            };

        } catch (error) {
            console.error('Erro ao limpar tokens antigos:', error);
            throw error;
        }
    }

    // Obter estatísticas de tokens
    async getStats(companyId, options = {}) {
        this._validateCompanyAccess(companyId);

        const { dateFrom = null, dateTo = null } = options;

        let whereConditions = ['u.company_id = $1', 'u.deleted_at IS NULL'];
        let params = [companyId];
        let paramCount = 1;

        if (dateFrom) {
            whereConditions.push(`pnt.created_at >= $${++paramCount}`);
            params.push(dateFrom);
        }

        if (dateTo) {
            whereConditions.push(`pnt.created_at <= $${++paramCount}`);
            params.push(dateTo);
        }

        const query = `
            SELECT 
                COUNT(pnt.id) as total_tokens,
                COUNT(CASE WHEN pnt.is_active = true THEN 1 END) as active_tokens,
                COUNT(CASE WHEN pnt.is_active = false THEN 1 END) as inactive_tokens,
                COUNT(DISTINCT pnt.user_id) as users_with_tokens,
                COUNT(CASE WHEN pnt.platform = 'ios' THEN 1 END) as ios_tokens,
                COUNT(CASE WHEN pnt.platform = 'android' THEN 1 END) as android_tokens,
                COUNT(CASE WHEN pnt.platform = 'web' THEN 1 END) as web_tokens,
                COUNT(CASE WHEN pnt.platform = 'desktop' THEN 1 END) as desktop_tokens,
                AVG(EXTRACT(EPOCH FROM (NOW() - pnt.last_used_at)) / 86400) as avg_days_since_last_use
            FROM ${this.table} pnt
            JOIN polox.users u ON pnt.user_id = u.id
            WHERE ${whereConditions.join(' AND ')}
        `;

        try {
            const result = await this.db.query(query, params);

            return {
                success: true,
                data: {
                    ...result.rows[0],
                    avg_days_since_last_use: result.rows[0].avg_days_since_last_use ? 
                        Math.round(result.rows[0].avg_days_since_last_use * 100) / 100 : 0
                }
            };

        } catch (error) {
            console.error('Erro ao obter estatísticas de tokens:', error);
            throw error;
        }
    }

    // Buscar tokens por plataforma
    async findByPlatform(platform, companyId, options = {}) {
        this._validateCompanyAccess(companyId);

        const { onlyActive = true, limit = 100, offset = 0 } = options;

        let whereConditions = [
            'pnt.platform = $1',
            'u.company_id = $2',
            'u.deleted_at IS NULL'
        ];
        let params = [platform.toLowerCase(), companyId];
        let paramCount = 2;

        if (onlyActive) {
            whereConditions.push('pnt.is_active = true');
        }

        const query = `
            SELECT 
                pnt.*,
                u.full_name as user_name,
                u.email as user_email
            FROM ${this.table} pnt
            JOIN polox.users u ON pnt.user_id = u.id
            WHERE ${whereConditions.join(' AND ')}
            ORDER BY pnt.last_used_at DESC
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
            console.error('Erro ao buscar tokens por plataforma:', error);
            throw error;
        }
    }

    // Verificar se token é válido
    async isValidToken(token) {
        const query = `
            SELECT pnt.id, pnt.user_id, u.company_id, pnt.is_active
            FROM ${this.table} pnt
            JOIN polox.users u ON pnt.user_id = u.id
            WHERE pnt.token = $1 AND u.deleted_at IS NULL
        `;

        try {
            const result = await this.db.query(query, [token]);

            if (result.rows.length === 0) {
                return { valid: false, reason: 'Token não encontrado' };
            }

            const tokenData = result.rows[0];

            if (!tokenData.is_active) {
                return { valid: false, reason: 'Token inativo' };
            }

            return {
                valid: true,
                data: {
                    tokenId: tokenData.id,
                    userId: tokenData.user_id,
                    companyId: tokenData.company_id
                }
            };

        } catch (error) {
            console.error('Erro ao verificar validade do token:', error);
            return { valid: false, reason: 'Erro interno' };
        }
    }

    // Contar tokens ativos por usuário
    async countByUser(userId, companyId) {
        this._validateCompanyAccess(companyId);

        const query = `
            SELECT 
                COUNT(*) as total_tokens,
                COUNT(CASE WHEN platform = 'ios' THEN 1 END) as ios_count,
                COUNT(CASE WHEN platform = 'android' THEN 1 END) as android_count,
                COUNT(CASE WHEN platform = 'web' THEN 1 END) as web_count,
                COUNT(CASE WHEN platform = 'desktop' THEN 1 END) as desktop_count
            FROM ${this.table} pnt
            JOIN polox.users u ON pnt.user_id = u.id
            WHERE pnt.user_id = $1 AND u.company_id = $2 
            AND pnt.is_active = true AND u.deleted_at IS NULL
        `;

        try {
            const result = await this.db.query(query, [userId, companyId]);

            return {
                success: true,
                data: result.rows[0]
            };

        } catch (error) {
            console.error('Erro ao contar tokens do usuário:', error);
            throw error;
        }
    }

    // Deletar token permanentemente
    async delete(tokenId, companyId) {
        this._validateCompanyAccess(companyId);

        const client = await this.db.connect();

        try {
            await client.query('BEGIN');

            // Verificar se token existe e pertence à empresa
            const checkResult = await client.query(`
                SELECT pnt.id FROM ${this.table} pnt
                JOIN polox.users u ON pnt.user_id = u.id
                WHERE pnt.id = $1 AND u.company_id = $2
            `, [tokenId, companyId]);

            if (checkResult.rows.length === 0) {
                throw new Error('Token não encontrado');
            }

            // Deletar token
            await client.query(`DELETE FROM ${this.table} WHERE id = $1`, [tokenId]);

            await client.query('COMMIT');

            return {
                success: true,
                message: 'Token removido permanentemente'
            };

        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Erro ao deletar token:', error);
            throw error;
        } finally {
            client.release();
        }
    }
}

module.exports = PushNotificationToken;