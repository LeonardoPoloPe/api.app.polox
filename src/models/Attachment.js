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

class Attachment {
    constructor(db) {
        this.db = db;
        this.table = 'polox.attachments';
    }

    // Validações
    _validateCompanyAccess(companyId) {
        if (!companyId) {
            throw new Error('Company ID é obrigatório para operações multi-tenant');
        }
    }

    _validateAttachmentData(data) {
        const errors = [];

        if (!data.file_upload_id) {
            errors.push('ID do arquivo é obrigatório');
        }
        if (!data.entity_type) {
            errors.push('Tipo da entidade é obrigatório');
        }
        if (!data.entity_id) {
            errors.push('ID da entidade é obrigatório');
        }
        if (data.entity_type && !['tickets', 'products', 'clients', 'leads', 'companies', 'users', 'sales', 'projects', 'suppliers', 'events'].includes(data.entity_type)) {
            errors.push('Tipo de entidade inválido');
        }
        if (data.attachment_type && !['document', 'image', 'avatar', 'contract', 'invoice', 'photo', 'video', 'audio', 'spreadsheet', 'presentation'].includes(data.attachment_type)) {
            errors.push('Tipo de anexo inválido');
        }

        if (errors.length > 0) {
            throw new Error(`Dados inválidos: ${errors.join(', ')}`);
        }
    }

    // Criar anexo
    async create(companyId, attachmentData, userId) {
        this._validateCompanyAccess(companyId);
        this._validateAttachmentData(attachmentData);

        const client = await this.db.connect();
        
        try {
            await client.query('BEGIN');

            // Verificar se o file_upload existe e pertence à empresa
            const fileResult = await client.query(`
                SELECT id, company_id FROM polox.file_uploads 
                WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL
            `, [attachmentData.file_upload_id, companyId]);

            if (fileResult.rows.length === 0) {
                throw new Error('Arquivo não encontrado ou não pertence à empresa');
            }

            // Definir próxima ordem se não especificada
            let displayOrder = attachmentData.display_order || 0;
            if (!attachmentData.display_order) {
                const orderResult = await client.query(`
                    SELECT COALESCE(MAX(display_order), 0) + 1 as next_order
                    FROM ${this.table}
                    WHERE entity_type = $1 AND entity_id = $2
                `, [attachmentData.entity_type, attachmentData.entity_id]);
                displayOrder = orderResult.rows[0].next_order;
            }

            // Inserir anexo
            const query = `
                INSERT INTO ${this.table} (
                    file_upload_id, entity_type, entity_id, title, description,
                    attachment_type, display_order, is_featured, created_by_user_id
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                RETURNING *
            `;

            const values = [
                attachmentData.file_upload_id,
                attachmentData.entity_type,
                attachmentData.entity_id,
                attachmentData.title || null,
                attachmentData.description || null,
                attachmentData.attachment_type || 'document',
                displayOrder,
                attachmentData.is_featured || false,
                userId
            ];

            const result = await client.query(query, values);
            await client.query('COMMIT');

            return {
                success: true,
                data: result.rows[0],
                message: 'Anexo criado com sucesso'
            };

        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Erro ao criar anexo:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    // Buscar anexo por ID
    async findById(attachmentId, companyId) {
        this._validateCompanyAccess(companyId);

        const query = `
            SELECT 
                a.*,
                f.original_filename, f.file_size, f.mime_type, f.file_url,
                u.full_name as created_by_name
            FROM ${this.table} a
            JOIN polox.file_uploads f ON a.file_upload_id = f.id
            LEFT JOIN polox.users u ON a.created_by_user_id = u.id
            WHERE a.id = $1 AND f.company_id = $2
        `;

        try {
            const result = await this.db.query(query, [attachmentId, companyId]);
            
            if (result.rows.length === 0) {
                return { success: false, message: 'Anexo não encontrado' };
            }

            return {
                success: true,
                data: result.rows[0]
            };

        } catch (error) {
            console.error('Erro ao buscar anexo:', error);
            throw error;
        }
    }

    // Buscar anexos por entidade
    async findByEntity(entityType, entityId, companyId, options = {}) {
        this._validateCompanyAccess(companyId);

        const {
            attachmentType = null,
            onlyFeatured = false,
            limit = 100,
            offset = 0
        } = options;

        let whereConditions = [
            'a.entity_type = $1',
            'a.entity_id = $2',
            'f.company_id = $3',
            'f.deleted_at IS NULL'
        ];
        let params = [entityType, entityId, companyId];
        let paramCount = 3;

        if (attachmentType) {
            whereConditions.push(`a.attachment_type = $${++paramCount}`);
            params.push(attachmentType);
        }

        if (onlyFeatured) {
            whereConditions.push('a.is_featured = true');
        }

        const query = `
            SELECT 
                a.*,
                f.original_filename, f.file_size, f.mime_type, f.file_url,
                u.full_name as created_by_name
            FROM ${this.table} a
            JOIN polox.file_uploads f ON a.file_upload_id = f.id
            LEFT JOIN polox.users u ON a.created_by_user_id = u.id
            WHERE ${whereConditions.join(' AND ')}
            ORDER BY a.display_order ASC, a.created_at DESC
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
            console.error('Erro ao buscar anexos por entidade:', error);
            throw error;
        }
    }

    // Atualizar anexo
    async update(attachmentId, companyId, updateData, userId) {
        this._validateCompanyAccess(companyId);

        const allowedFields = ['title', 'description', 'attachment_type', 'display_order', 'is_featured'];
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

            // Verificar se anexo existe e pertence à empresa
            const checkQuery = `
                SELECT a.id FROM ${this.table} a
                JOIN polox.file_uploads f ON a.file_upload_id = f.id
                WHERE a.id = $1 AND f.company_id = $2
            `;
            const checkResult = await client.query(checkQuery, [attachmentId, companyId]);

            if (checkResult.rows.length === 0) {
                throw new Error('Anexo não encontrado ou sem permissão');
            }

            // Atualizar anexo
            const updateQuery = `
                UPDATE ${this.table} 
                SET ${updates.join(', ')}, updated_at = NOW()
                WHERE id = $${++paramCount}
                RETURNING *
            `;
            values.push(attachmentId);

            const result = await client.query(updateQuery, values);
            await client.query('COMMIT');

            return {
                success: true,
                data: result.rows[0],
                message: 'Anexo atualizado com sucesso'
            };

        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Erro ao atualizar anexo:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    // Definir anexo como featured
    async setFeatured(attachmentId, companyId, userId) {
        const client = await this.db.connect();

        try {
            await client.query('BEGIN');

            // Buscar anexo para obter entity info
            const attachmentResult = await client.query(`
                SELECT a.entity_type, a.entity_id FROM ${this.table} a
                JOIN polox.file_uploads f ON a.file_upload_id = f.id
                WHERE a.id = $1 AND f.company_id = $2
            `, [attachmentId, companyId]);

            if (attachmentResult.rows.length === 0) {
                throw new Error('Anexo não encontrado');
            }

            const { entity_type, entity_id } = attachmentResult.rows[0];

            // Remover featured de outros anexos da mesma entidade
            await client.query(`
                UPDATE ${this.table} 
                SET is_featured = false 
                WHERE entity_type = $1 AND entity_id = $2 AND id != $3
            `, [entity_type, entity_id, attachmentId]);

            // Definir este anexo como featured
            const result = await client.query(`
                UPDATE ${this.table} 
                SET is_featured = true 
                WHERE id = $1
                RETURNING *
            `, [attachmentId]);

            await client.query('COMMIT');

            return {
                success: true,
                data: result.rows[0],
                message: 'Anexo definido como principal'
            };

        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Erro ao definir anexo como featured:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    // Reordenar anexos
    async reorder(entityType, entityId, companyId, attachmentOrders, userId) {
        this._validateCompanyAccess(companyId);

        const client = await this.db.connect();

        try {
            await client.query('BEGIN');

            // Atualizar ordem de cada anexo
            for (const { attachmentId, order } of attachmentOrders) {
                await client.query(`
                    UPDATE ${this.table} 
                    SET display_order = $1 
                    WHERE id = $2 AND entity_type = $3 AND entity_id = $4
                `, [order, attachmentId, entityType, entityId]);
            }

            await client.query('COMMIT');

            return {
                success: true,
                message: 'Ordem dos anexos atualizada com sucesso'
            };

        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Erro ao reordenar anexos:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    // Deletar anexo
    async delete(attachmentId, companyId, userId) {
        this._validateCompanyAccess(companyId);

        const client = await this.db.connect();

        try {
            await client.query('BEGIN');

            // Verificar se anexo existe e pertence à empresa
            const checkQuery = `
                SELECT a.id FROM ${this.table} a
                JOIN polox.file_uploads f ON a.file_upload_id = f.id
                WHERE a.id = $1 AND f.company_id = $2
            `;
            const checkResult = await client.query(checkQuery, [attachmentId, companyId]);

            if (checkResult.rows.length === 0) {
                throw new Error('Anexo não encontrado ou sem permissão');
            }

            // Deletar anexo (CASCADE irá deletar o file_upload se necessário)
            await client.query(`DELETE FROM ${this.table} WHERE id = $1`, [attachmentId]);

            await client.query('COMMIT');

            return {
                success: true,
                message: 'Anexo removido com sucesso'
            };

        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Erro ao deletar anexo:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    // Obter estatísticas de anexos
    async getStats(companyId, options = {}) {
        this._validateCompanyAccess(companyId);

        const { entityType = null, dateFrom = null, dateTo = null } = options;

        let whereConditions = ['f.company_id = $1', 'f.deleted_at IS NULL'];
        let params = [companyId];
        let paramCount = 1;

        if (entityType) {
            whereConditions.push(`a.entity_type = $${++paramCount}`);
            params.push(entityType);
        }

        if (dateFrom) {
            whereConditions.push(`a.created_at >= $${++paramCount}`);
            params.push(dateFrom);
        }

        if (dateTo) {
            whereConditions.push(`a.created_at <= $${++paramCount}`);
            params.push(dateTo);
        }

        const query = `
            SELECT 
                COUNT(*) as total_attachments,
                COUNT(DISTINCT a.entity_type) as entity_types_count,
                COUNT(CASE WHEN a.attachment_type = 'image' THEN 1 END) as images,
                COUNT(CASE WHEN a.attachment_type = 'document' THEN 1 END) as documents,
                COUNT(CASE WHEN a.is_featured = true THEN 1 END) as featured,
                SUM(f.file_size) as total_size_bytes,
                AVG(f.file_size) as avg_size_bytes,
                array_agg(DISTINCT a.entity_type) as entity_types,
                array_agg(DISTINCT a.attachment_type) as attachment_types
            FROM ${this.table} a
            JOIN polox.file_uploads f ON a.file_upload_id = f.id
            WHERE ${whereConditions.join(' AND ')}
        `;

        try {
            const result = await this.db.query(query, params);

            return {
                success: true,
                data: {
                    ...result.rows[0],
                    total_size_mb: result.rows[0].total_size_bytes ? 
                        Math.round(result.rows[0].total_size_bytes / 1024 / 1024 * 100) / 100 : 0,
                    avg_size_mb: result.rows[0].avg_size_bytes ? 
                        Math.round(result.rows[0].avg_size_bytes / 1024 / 1024 * 100) / 100 : 0
                }
            };

        } catch (error) {
            console.error('Erro ao obter estatísticas de anexos:', error);
            throw error;
        }
    }

    // Buscar anexos por tipo
    async findByType(attachmentType, companyId, options = {}) {
        this._validateCompanyAccess(companyId);

        const { limit = 50, offset = 0 } = options;

        const query = `
            SELECT 
                a.*,
                f.original_filename, f.file_size, f.mime_type, f.file_url,
                u.full_name as created_by_name
            FROM ${this.table} a
            JOIN polox.file_uploads f ON a.file_upload_id = f.id
            LEFT JOIN polox.users u ON a.created_by_user_id = u.id
            WHERE a.attachment_type = $1 AND f.company_id = $2 AND f.deleted_at IS NULL
            ORDER BY a.created_at DESC
            LIMIT $3 OFFSET $4
        `;

        try {
            const result = await this.db.query(query, [attachmentType, companyId, limit, offset]);

            return {
                success: true,
                data: result.rows,
                count: result.rows.length
            };

        } catch (error) {
            console.error('Erro ao buscar anexos por tipo:', error);
            throw error;
        }
    }

    // Contar anexos por entidade
    async countByEntity(entityType, entityId, companyId) {
        this._validateCompanyAccess(companyId);

        const query = `
            SELECT COUNT(*) as total
            FROM ${this.table} a
            JOIN polox.file_uploads f ON a.file_upload_id = f.id
            WHERE a.entity_type = $1 AND a.entity_id = $2 
            AND f.company_id = $3 AND f.deleted_at IS NULL
        `;

        try {
            const result = await this.db.query(query, [entityType, entityId, companyId]);

            return {
                success: true,
                data: { total: parseInt(result.rows[0].total) }
            };

        } catch (error) {
            console.error('Erro ao contar anexos:', error);
            throw error;
        }
    }
}

module.exports = Attachment;