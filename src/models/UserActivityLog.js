const { Client } = require('pg');
const { v4: uuidv4 } = require('uuid');

class UserActivityLog {
    constructor(db) {
        this.db = db;
        this.table = 'polox.user_activity_logs';
    }

    // Validações
    _validateCompanyAccess(companyId) {
        if (!companyId) {
            throw new Error('Company ID é obrigatório para operações multi-tenant');
        }
    }

    _validateActivityData(data) {
        const errors = [];

        if (!data.user_id) {
            errors.push('ID do usuário é obrigatório');
        }
        if (!data.activity_type) {
            errors.push('Tipo de atividade é obrigatório');
        }
        
        const validActivityTypes = [
            'page_view', 'action_click', 'feature_access', 'login', 'logout', 
            'data_export', 'data_import', 'search', 'form_submit', 'file_upload',
            'file_download', 'api_call', 'email_sent', 'report_generated',
            'setting_changed', 'profile_updated', 'password_changed'
        ];
        
        if (data.activity_type && !validActivityTypes.includes(data.activity_type)) {
            errors.push('Tipo de atividade inválido');
        }

        if (errors.length > 0) {
            throw new Error(`Dados inválidos: ${errors.join(', ')}`);
        }
    }

    // Registrar atividade
    async logActivity(companyId, activityData) {
        this._validateCompanyAccess(companyId);
        this._validateActivityData(activityData);

        const client = await this.db.connect();
        
        try {
            await client.query('BEGIN');

            // Verificar se usuário existe e pertence à empresa
            const userResult = await client.query(`
                SELECT id FROM polox.users 
                WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL
            `, [activityData.user_id, companyId]);

            if (userResult.rows.length === 0) {
                throw new Error('Usuário não encontrado ou não pertence à empresa');
            }

            // Inserir log de atividade
            const query = `
                INSERT INTO ${this.table} (
                    user_id, company_id, activity_type, page_url, feature_accessed,
                    action_performed, session_id, browser_info, device_info,
                    duration_seconds, metadata
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                RETURNING *
            `;

            const values = [
                activityData.user_id,
                companyId,
                activityData.activity_type,
                activityData.page_url || null,
                activityData.feature_accessed || null,
                activityData.action_performed || null,
                activityData.session_id || null,
                activityData.browser_info ? JSON.stringify(activityData.browser_info) : null,
                activityData.device_info ? JSON.stringify(activityData.device_info) : null,
                activityData.duration_seconds || null,
                activityData.metadata ? JSON.stringify(activityData.metadata) : '{}'
            ];

            const result = await client.query(query, values);
            await client.query('COMMIT');

            return {
                success: true,
                data: result.rows[0],
                message: 'Atividade registrada com sucesso'
            };

        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Erro ao registrar atividade:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    // Buscar atividades por usuário
    async findByUser(userId, companyId, options = {}) {
        this._validateCompanyAccess(companyId);

        const {
            activityType = null,
            dateFrom = null,
            dateTo = null,
            limit = 100,
            offset = 0
        } = options;

        let whereConditions = [
            'user_id = $1',
            'company_id = $2'
        ];
        let params = [userId, companyId];
        let paramCount = 2;

        if (activityType) {
            whereConditions.push(`activity_type = $${++paramCount}`);
            params.push(activityType);
        }

        if (dateFrom) {
            whereConditions.push(`created_at >= $${++paramCount}`);
            params.push(dateFrom);
        }

        if (dateTo) {
            whereConditions.push(`created_at <= $${++paramCount}`);
            params.push(dateTo);
        }

        const query = `
            SELECT 
                ual.*,
                u.full_name as user_name,
                u.email as user_email
            FROM ${this.table} ual
            JOIN polox.users u ON ual.user_id = u.id
            WHERE ${whereConditions.join(' AND ')}
            ORDER BY ual.created_at DESC
            LIMIT $${++paramCount} OFFSET $${++paramCount}
        `;

        params.push(limit, offset);

        try {
            const result = await this.db.query(query, params);

            // Parsear campos JSON
            const activities = result.rows.map(row => ({
                ...row,
                browser_info: row.browser_info ? JSON.parse(row.browser_info) : null,
                device_info: row.device_info ? JSON.parse(row.device_info) : null,
                metadata: row.metadata ? JSON.parse(row.metadata) : {}
            }));

            return {
                success: true,
                data: activities,
                count: activities.length
            };

        } catch (error) {
            console.error('Erro ao buscar atividades do usuário:', error);
            throw error;
        }
    }

    // Buscar atividades por tipo
    async findByActivityType(activityType, companyId, options = {}) {
        this._validateCompanyAccess(companyId);

        const {
            dateFrom = null,
            dateTo = null,
            limit = 100,
            offset = 0
        } = options;

        let whereConditions = [
            'activity_type = $1',
            'company_id = $2'
        ];
        let params = [activityType, companyId];
        let paramCount = 2;

        if (dateFrom) {
            whereConditions.push(`created_at >= $${++paramCount}`);
            params.push(dateFrom);
        }

        if (dateTo) {
            whereConditions.push(`created_at <= $${++paramCount}`);
            params.push(dateTo);
        }

        const query = `
            SELECT 
                ual.*,
                u.full_name as user_name,
                u.email as user_email
            FROM ${this.table} ual
            JOIN polox.users u ON ual.user_id = u.id
            WHERE ${whereConditions.join(' AND ')}
            ORDER BY ual.created_at DESC
            LIMIT $${++paramCount} OFFSET $${++paramCount}
        `;

        params.push(limit, offset);

        try {
            const result = await this.db.query(query, params);

            // Parsear campos JSON
            const activities = result.rows.map(row => ({
                ...row,
                browser_info: row.browser_info ? JSON.parse(row.browser_info) : null,
                device_info: row.device_info ? JSON.parse(row.device_info) : null,
                metadata: row.metadata ? JSON.parse(row.metadata) : {}
            }));

            return {
                success: true,
                data: activities,
                count: activities.length
            };

        } catch (error) {
            console.error('Erro ao buscar atividades por tipo:', error);
            throw error;
        }
    }

    // Estatísticas de atividade
    async getActivityStats(companyId, options = {}) {
        this._validateCompanyAccess(companyId);

        const {
            userId = null,
            dateFrom = null,
            dateTo = null,
            groupBy = 'day' // day, hour, week, month
        } = options;

        let whereConditions = ['company_id = $1'];
        let params = [companyId];
        let paramCount = 1;

        if (userId) {
            whereConditions.push(`user_id = $${++paramCount}`);
            params.push(userId);
        }

        if (dateFrom) {
            whereConditions.push(`created_at >= $${++paramCount}`);
            params.push(dateFrom);
        }

        if (dateTo) {
            whereConditions.push(`created_at <= $${++paramCount}`);
            params.push(dateTo);
        }

        // Definir agrupamento temporal
        let dateGroup;
        switch (groupBy) {
            case 'hour':
                dateGroup = "date_trunc('hour', created_at)";
                break;
            case 'week':
                dateGroup = "date_trunc('week', created_at)";
                break;
            case 'month':
                dateGroup = "date_trunc('month', created_at)";
                break;
            default:
                dateGroup = "date_trunc('day', created_at)";
        }

        const query = `
            SELECT 
                ${dateGroup} as time_period,
                activity_type,
                COUNT(*) as activity_count,
                COUNT(DISTINCT user_id) as unique_users,
                AVG(duration_seconds) as avg_duration
            FROM ${this.table}
            WHERE ${whereConditions.join(' AND ')}
            GROUP BY ${dateGroup}, activity_type
            ORDER BY time_period DESC, activity_count DESC
        `;

        try {
            const result = await this.db.query(query, params);

            return {
                success: true,
                data: result.rows,
                groupBy: groupBy
            };

        } catch (error) {
            console.error('Erro ao obter estatísticas de atividade:', error);
            throw error;
        }
    }

    // Relatório de usuários mais ativos
    async getMostActiveUsers(companyId, options = {}) {
        this._validateCompanyAccess(companyId);

        const {
            dateFrom = null,
            dateTo = null,
            limit = 10
        } = options;

        let whereConditions = ['ual.company_id = $1'];
        let params = [companyId];
        let paramCount = 1;

        if (dateFrom) {
            whereConditions.push(`ual.created_at >= $${++paramCount}`);
            params.push(dateFrom);
        }

        if (dateTo) {
            whereConditions.push(`ual.created_at <= $${++paramCount}`);
            params.push(dateTo);
        }

        const query = `
            SELECT 
                u.id,
                u.name,
                u.email,
                COUNT(*) as total_activities,
                COUNT(DISTINCT activity_type) as unique_activity_types,
                COUNT(DISTINCT DATE(ual.created_at)) as active_days,
                AVG(ual.duration_seconds) as avg_session_duration,
                MAX(ual.created_at) as last_activity,
                array_agg(DISTINCT activity_type) as activity_types
            FROM ${this.table} ual
            JOIN polox.users u ON ual.user_id = u.id
            WHERE ${whereConditions.join(' AND ')}
            GROUP BY u.id, u.full_name, u.email
            ORDER BY total_activities DESC
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
            console.error('Erro ao obter usuários mais ativos:', error);
            throw error;
        }
    }

    // Páginas mais visitadas
    async getMostVisitedPages(companyId, options = {}) {
        this._validateCompanyAccess(companyId);

        const {
            dateFrom = null,
            dateTo = null,
            limit = 10
        } = options;

        let whereConditions = [
            'company_id = $1',
            'activity_type = \'page_view\'',
            'page_url IS NOT NULL'
        ];
        let params = [companyId];
        let paramCount = 1;

        if (dateFrom) {
            whereConditions.push(`created_at >= $${++paramCount}`);
            params.push(dateFrom);
        }

        if (dateTo) {
            whereConditions.push(`created_at <= $${++paramCount}`);
            params.push(dateTo);
        }

        const query = `
            SELECT 
                page_url,
                COUNT(*) as total_visits,
                COUNT(DISTINCT user_id) as unique_visitors,
                AVG(duration_seconds) as avg_time_on_page,
                MAX(created_at) as last_visit
            FROM ${this.table}
            WHERE ${whereConditions.join(' AND ')}
            GROUP BY page_url
            ORDER BY total_visits DESC
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
            console.error('Erro ao obter páginas mais visitadas:', error);
            throw error;
        }
    }

    // Funcionalidades mais usadas
    async getMostUsedFeatures(companyId, options = {}) {
        this._validateCompanyAccess(companyId);

        const {
            dateFrom = null,
            dateTo = null,
            limit = 10
        } = options;

        let whereConditions = [
            'company_id = $1',
            'feature_accessed IS NOT NULL'
        ];
        let params = [companyId];
        let paramCount = 1;

        if (dateFrom) {
            whereConditions.push(`created_at >= $${++paramCount}`);
            params.push(dateFrom);
        }

        if (dateTo) {
            whereConditions.push(`created_at <= $${++paramCount}`);
            params.push(dateTo);
        }

        const query = `
            SELECT 
                feature_accessed,
                COUNT(*) as total_accesses,
                COUNT(DISTINCT user_id) as unique_users,
                MAX(created_at) as last_access
            FROM ${this.table}
            WHERE ${whereConditions.join(' AND ')}
            GROUP BY feature_accessed
            ORDER BY total_accesses DESC
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
            console.error('Erro ao obter funcionalidades mais usadas:', error);
            throw error;
        }
    }

    // Buscar sessões do usuário
    async getUserSessions(userId, companyId, options = {}) {
        this._validateCompanyAccess(companyId);

        const {
            dateFrom = null,
            dateTo = null,
            limit = 50
        } = options;

        let whereConditions = [
            'user_id = $1',
            'company_id = $2',
            'session_id IS NOT NULL'
        ];
        let params = [userId, companyId];
        let paramCount = 2;

        if (dateFrom) {
            whereConditions.push(`created_at >= $${++paramCount}`);
            params.push(dateFrom);
        }

        if (dateTo) {
            whereConditions.push(`created_at <= $${++paramCount}`);
            params.push(dateTo);
        }

        const query = `
            SELECT 
                session_id,
                MIN(created_at) as session_start,
                MAX(created_at) as session_end,
                COUNT(*) as total_activities,
                COUNT(DISTINCT activity_type) as activity_types_count,
                SUM(duration_seconds) as total_duration,
                array_agg(DISTINCT activity_type) as activity_types,
                MAX(browser_info) as browser_info,
                MAX(device_info) as device_info
            FROM ${this.table}
            WHERE ${whereConditions.join(' AND ')}
            GROUP BY session_id
            ORDER BY session_start DESC
            LIMIT $${++paramCount}
        `;

        params.push(limit);

        try {
            const result = await this.db.query(query, params);

            // Parsear campos JSON e calcular duração da sessão
            const sessions = result.rows.map(row => ({
                ...row,
                browser_info: row.browser_info ? JSON.parse(row.browser_info) : null,
                device_info: row.device_info ? JSON.parse(row.device_info) : null,
                session_duration_minutes: row.session_start && row.session_end ?
                    Math.round((new Date(row.session_end) - new Date(row.session_start)) / 60000) : null
            }));

            return {
                success: true,
                data: sessions
            };

        } catch (error) {
            console.error('Erro ao buscar sessões do usuário:', error);
            throw error;
        }
    }

    // Limpeza de logs antigos
    async cleanOldLogs(companyId, daysToKeep = 90) {
        this._validateCompanyAccess(companyId);

        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

        const query = `
            DELETE FROM ${this.table}
            WHERE company_id = $1 AND created_at < $2
        `;

        try {
            const result = await this.db.query(query, [companyId, cutoffDate]);

            return {
                success: true,
                message: `${result.rowCount} logs antigos removidos`,
                deletedCount: result.rowCount
            };

        } catch (error) {
            console.error('Erro ao limpar logs antigos:', error);
            throw error;
        }
    }
}

module.exports = UserActivityLog;