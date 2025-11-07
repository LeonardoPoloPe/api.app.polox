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

class NotificationPreference {
    constructor(db) {
        this.db = db;
        this.table = 'polox.notification_preferences';
    }

    // Validações
    _validateCompanyAccess(companyId) {
        if (!companyId) {
            throw new Error('Company ID é obrigatório para operações multi-tenant');
        }
    }

    _validatePreferenceData(data) {
        const errors = [];

        if (!data.user_id) {
            errors.push('ID do usuário é obrigatório');
        }

        // Validar horários de silêncio se fornecidos
        if (data.quiet_hours_start && !/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/.test(data.quiet_hours_start)) {
            errors.push('Horário de início do silêncio deve estar no formato HH:MM:SS');
        }

        if (data.quiet_hours_end && !/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/.test(data.quiet_hours_end)) {
            errors.push('Horário de fim do silêncio deve estar no formato HH:MM:SS');
        }

        // Validar frequência de digest
        if (data.email_digest_frequency && !['none', 'daily', 'weekly'].includes(data.email_digest_frequency)) {
            errors.push('Frequência de digest deve ser: none, daily ou weekly');
        }

        if (errors.length > 0) {
            throw new Error(`Dados inválidos: ${errors.join(', ')}`);
        }
    }

    // Criar ou atualizar preferências
    async createOrUpdate(companyId, userId, preferenceData = {}) {
        this._validateCompanyAccess(companyId);

        const validatedData = { user_id: userId, ...preferenceData };
        this._validatePreferenceData(validatedData);

        const client = await this.db.connect();
        
        try {
            await client.query('BEGIN');

            // Verificar se usuário existe e pertence à empresa
            const userResult = await client.query(`
                SELECT id FROM polox.users 
                WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL
            `, [userId, companyId]);

            if (userResult.rows.length === 0) {
                throw new Error('Usuário não encontrado ou não pertence à empresa');
            }

            // Verificar se preferências já existem
            const existingResult = await client.query(`
                SELECT id FROM ${this.table} WHERE user_id = $1
            `, [userId]);

            let result;

            if (existingResult.rows.length > 0) {
                // Atualizar preferências existentes
                const allowedFields = [
                    'email_enabled', 'sms_enabled', 'push_enabled', 'in_app_enabled',
                    'business_notifications', 'gamification_notifications', 'system_notifications',
                    'quiet_hours_start', 'quiet_hours_end', 'timezone', 'email_digest_frequency'
                ];

                const updates = [];
                const values = [];
                let paramCount = 0;

                for (const [key, value] of Object.entries(preferenceData)) {
                    if (allowedFields.includes(key)) {
                        if (['business_notifications', 'gamification_notifications', 'system_notifications'].includes(key)) {
                            updates.push(`${key} = $${++paramCount}`);
                            values.push(JSON.stringify(value));
                        } else {
                            updates.push(`${key} = $${++paramCount}`);
                            values.push(value);
                        }
                    }
                }

                if (updates.length > 0) {
                    const updateQuery = `
                        UPDATE ${this.table} 
                        SET ${updates.join(', ')}, updated_at = NOW()
                        WHERE user_id = $${++paramCount}
                        RETURNING *
                    `;
                    values.push(userId);

                    result = await client.query(updateQuery, values);
                } else {
                    result = await client.query(`SELECT * FROM ${this.table} WHERE user_id = $1`, [userId]);
                }
            } else {
                // Criar novas preferências com valores padrão
                const defaultBusinessNotifications = {
                    "new_lead": {"email": true, "push": true, "sms": false},
                    "sale_completed": {"email": true, "push": true, "sms": true},
                    "task_reminder": {"email": true, "push": true, "sms": false},
                    "client_message": {"email": true, "push": true, "sms": false},
                    "deadline_approaching": {"email": true, "push": true, "sms": false}
                };

                const defaultGamificationNotifications = {
                    "level_up": {"email": false, "push": true, "sms": false},
                    "achievement_unlocked": {"email": false, "push": true, "sms": false},
                    "mission_completed": {"email": false, "push": true, "sms": false},
                    "reward_available": {"email": false, "push": true, "sms": false}
                };

                const defaultSystemNotifications = {
                    "security_alert": {"email": true, "push": true, "sms": true},
                    "system_maintenance": {"email": true, "push": true, "sms": false},
                    "account_update": {"email": true, "push": true, "sms": false},
                    "backup_completed": {"email": false, "push": false, "sms": false}
                };

                const insertQuery = `
                    INSERT INTO ${this.table} (
                        user_id, email_enabled, sms_enabled, push_enabled, in_app_enabled,
                        business_notifications, gamification_notifications, system_notifications,
                        quiet_hours_start, quiet_hours_end, timezone, email_digest_frequency
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                    RETURNING *
                `;

                const values = [
                    userId,
                    preferenceData.email_enabled !== undefined ? preferenceData.email_enabled : true,
                    preferenceData.sms_enabled !== undefined ? preferenceData.sms_enabled : false,
                    preferenceData.push_enabled !== undefined ? preferenceData.push_enabled : true,
                    preferenceData.in_app_enabled !== undefined ? preferenceData.in_app_enabled : true,
                    JSON.stringify(preferenceData.business_notifications || defaultBusinessNotifications),
                    JSON.stringify(preferenceData.gamification_notifications || defaultGamificationNotifications),
                    JSON.stringify(preferenceData.system_notifications || defaultSystemNotifications),
                    preferenceData.quiet_hours_start || '22:00:00',
                    preferenceData.quiet_hours_end || '08:00:00',
                    preferenceData.timezone || 'America/Sao_Paulo',
                    preferenceData.email_digest_frequency || 'daily'
                ];

                result = await client.query(insertQuery, values);
            }

            await client.query('COMMIT');

            // Parsear campos JSON
            const preference = result.rows[0];
            preference.business_notifications = JSON.parse(preference.business_notifications);
            preference.gamification_notifications = JSON.parse(preference.gamification_notifications);
            preference.system_notifications = JSON.parse(preference.system_notifications);

            return {
                success: true,
                data: preference,
                message: existingResult.rows.length > 0 ? 
                    'Preferências atualizadas com sucesso' : 
                    'Preferências criadas com sucesso'
            };

        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Erro ao criar/atualizar preferências:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    // Buscar preferências por usuário
    async findByUser(userId, companyId) {
        this._validateCompanyAccess(companyId);

        const query = `
            SELECT np.*
            FROM ${this.table} np
            JOIN polox.users u ON np.user_id = u.id
            WHERE np.user_id = $1 AND u.company_id = $2 AND u.deleted_at IS NULL
        `;

        try {
            const result = await this.db.query(query, [userId, companyId]);
            
            if (result.rows.length === 0) {
                // Criar preferências padrão se não existirem
                return await this.createOrUpdate(companyId, userId);
            }

            // Parsear campos JSON
            const preference = result.rows[0];
            preference.business_notifications = JSON.parse(preference.business_notifications);
            preference.gamification_notifications = JSON.parse(preference.gamification_notifications);
            preference.system_notifications = JSON.parse(preference.system_notifications);

            return {
                success: true,
                data: preference
            };

        } catch (error) {
            console.error('Erro ao buscar preferências:', error);
            throw error;
        }
    }

    // Atualizar preferência específica de categoria
    async updateCategoryPreference(userId, companyId, category, notificationType, channelSettings) {
        this._validateCompanyAccess(companyId);

        const validCategories = ['business_notifications', 'gamification_notifications', 'system_notifications'];
        
        if (!validCategories.includes(category)) {
            throw new Error('Categoria inválida');
        }

        const client = await this.db.connect();

        try {
            await client.query('BEGIN');

            // Verificar se usuário existe e pertence à empresa
            const userResult = await client.query(`
                SELECT id FROM polox.users 
                WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL
            `, [userId, companyId]);

            if (userResult.rows.length === 0) {
                throw new Error('Usuário não encontrado');
            }

            // Buscar preferências atuais
            const currentResult = await client.query(`
                SELECT ${category} FROM ${this.table} WHERE user_id = $1
            `, [userId]);

            if (currentResult.rows.length === 0) {
                // Criar preferências se não existir
                await this.createOrUpdate(companyId, userId);
                const newResult = await client.query(`
                    SELECT ${category} FROM ${this.table} WHERE user_id = $1
                `, [userId]);
                currentResult.rows = newResult.rows;
            }

            // Parsear JSON atual
            const currentSettings = JSON.parse(currentResult.rows[0][category]);
            
            // Atualizar configuração específica
            currentSettings[notificationType] = channelSettings;

            // Salvar de volta
            const updateResult = await client.query(`
                UPDATE ${this.table} 
                SET ${category} = $1, updated_at = NOW()
                WHERE user_id = $2
                RETURNING *
            `, [JSON.stringify(currentSettings), userId]);

            await client.query('COMMIT');

            // Parsear todos os campos JSON para retorno
            const preference = updateResult.rows[0];
            preference.business_notifications = JSON.parse(preference.business_notifications);
            preference.gamification_notifications = JSON.parse(preference.gamification_notifications);
            preference.system_notifications = JSON.parse(preference.system_notifications);

            return {
                success: true,
                data: preference,
                message: 'Preferência atualizada com sucesso'
            };

        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Erro ao atualizar preferência de categoria:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    // Verificar se deve enviar notificação
    async shouldSendNotification(userId, companyId, category, notificationType, channel) {
        this._validateCompanyAccess(companyId);

        try {
            const preferencesResult = await this.findByUser(userId, companyId);
            
            if (!preferencesResult.success) {
                return { shouldSend: true, reason: 'Preferências não encontradas, assumindo padrão' };
            }

            const preferences = preferencesResult.data;

            // Verificar se o canal está habilitado globalmente
            const channelEnabled = preferences[`${channel}_enabled`];
            if (!channelEnabled) {
                return { shouldSend: false, reason: `Canal ${channel} desabilitado globalmente` };
            }

            // Verificar configuração específica da categoria
            const categorySettings = preferences[category];
            if (!categorySettings || !categorySettings[notificationType]) {
                return { shouldSend: true, reason: 'Configuração específica não encontrada, assumindo padrão' };
            }

            const typeSettings = categorySettings[notificationType];
            const shouldSend = typeSettings[channel] === true;

            // Verificar horário de silêncio para push e SMS
            if (shouldSend && (channel === 'push' || channel === 'sms')) {
                const isQuietHour = await this._isQuietHour(preferences);
                if (isQuietHour) {
                    return { shouldSend: false, reason: 'Horário de silêncio ativo' };
                }
            }

            return {
                shouldSend,
                reason: shouldSend ? 'Notificação autorizada' : 'Notificação desabilitada pelo usuário'
            };

        } catch (error) {
            console.error('Erro ao verificar se deve enviar notificação:', error);
            // Em caso de erro, assumir que deve enviar (comportamento seguro)
            return { shouldSend: true, reason: 'Erro ao verificar preferências, assumindo padrão' };
        }
    }

    // Verificar se está no horário de silêncio
    async _isQuietHour(preferences) {
        try {
            const now = new Date();
            const timezone = preferences.timezone || 'America/Sao_Paulo';
            
            // Converter para timezone do usuário (simplificado)
            const currentTime = now.toLocaleTimeString('pt-BR', { 
                timeZone: timezone,
                hour12: false 
            });

            const quietStart = preferences.quiet_hours_start;
            const quietEnd = preferences.quiet_hours_end;

            if (!quietStart || !quietEnd) {
                return false;
            }

            // Se horário de fim é menor que início, significa que passa da meia-noite
            if (quietEnd < quietStart) {
                return currentTime >= quietStart || currentTime <= quietEnd;
            } else {
                return currentTime >= quietStart && currentTime <= quietEnd;
            }

        } catch (error) {
            console.error('Erro ao verificar horário de silêncio:', error);
            return false;
        }
    }

    // Atualizar horários de silêncio
    async updateQuietHours(userId, companyId, startTime, endTime, timezone = null) {
        this._validateCompanyAccess(companyId);

        // Validar formatos de horário
        if (!/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/.test(startTime)) {
            throw new Error('Horário de início inválido');
        }

        if (!/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/.test(endTime)) {
            throw new Error('Horário de fim inválido');
        }

        const updateData = {
            quiet_hours_start: startTime,
            quiet_hours_end: endTime
        };

        if (timezone) {
            updateData.timezone = timezone;
        }

        return await this.createOrUpdate(companyId, userId, updateData);
    }

    // Obter usuários que habilitaram email digest
    async getUsersForEmailDigest(companyId, frequency = 'daily') {
        this._validateCompanyAccess(companyId);

        const query = `
            SELECT 
                u.id,
                u.name,
                u.email,
                u.timezone,
                np.email_digest_frequency,
                np.quiet_hours_start,
                np.quiet_hours_end
            FROM ${this.table} np
            JOIN polox.users u ON np.user_id = u.id
            WHERE u.company_id = $1 
            AND u.deleted_at IS NULL
            AND np.email_enabled = true
            AND np.email_digest_frequency = $2
        `;

        try {
            const result = await this.db.query(query, [companyId, frequency]);

            return {
                success: true,
                data: result.rows
            };

        } catch (error) {
            console.error('Erro ao buscar usuários para email digest:', error);
            throw error;
        }
    }

    // Obter estatísticas de preferências
    async getPreferencesStats(companyId) {
        this._validateCompanyAccess(companyId);

        const query = `
            SELECT 
                COUNT(*) as total_users,
                COUNT(CASE WHEN np.email_enabled = true THEN 1 END) as email_enabled_count,
                COUNT(CASE WHEN np.sms_enabled = true THEN 1 END) as sms_enabled_count,
                COUNT(CASE WHEN np.push_enabled = true THEN 1 END) as push_enabled_count,
                COUNT(CASE WHEN np.in_app_enabled = true THEN 1 END) as in_app_enabled_count,
                COUNT(CASE WHEN np.email_digest_frequency = 'daily' THEN 1 END) as daily_digest_count,
                COUNT(CASE WHEN np.email_digest_frequency = 'weekly' THEN 1 END) as weekly_digest_count,
                COUNT(CASE WHEN np.email_digest_frequency = 'none' THEN 1 END) as no_digest_count
            FROM polox.users u
            LEFT JOIN ${this.table} np ON u.id = np.user_id
            WHERE u.company_id = $1 AND u.deleted_at IS NULL
        `;

        try {
            const result = await this.db.query(query, [companyId]);

            return {
                success: true,
                data: result.rows[0]
            };

        } catch (error) {
            console.error('Erro ao obter estatísticas de preferências:', error);
            throw error;
        }
    }

    // Resetar preferências para padrão
    async resetToDefault(userId, companyId) {
        this._validateCompanyAccess(companyId);

        const client = await this.db.connect();

        try {
            await client.query('BEGIN');

            // Verificar se usuário existe
            const userResult = await client.query(`
                SELECT id FROM polox.users 
                WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL
            `, [userId, companyId]);

            if (userResult.rows.length === 0) {
                throw new Error('Usuário não encontrado');
            }

            // Deletar preferências existentes
            await client.query(`DELETE FROM ${this.table} WHERE user_id = $1`, [userId]);

            await client.query('COMMIT');

            // Criar preferências padrão
            return await this.createOrUpdate(companyId, userId);

        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Erro ao resetar preferências:', error);
            throw error;
        } finally {
            client.release();
        }
    }
}

module.exports = NotificationPreference;