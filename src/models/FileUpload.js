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
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

/**
 * Model para uploads de arquivos
 * Baseado no schema polox.file_uploads
 */
class FileUploadModel {
  /**
   * Cria um novo registro de upload
   * @param {Object} fileData - Dados do arquivo
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object>} Arquivo registrado
   */
  static async create(fileData, companyId) {
    const {
      original_name,
      file_name,
      file_path,
      file_size,
      mime_type,
      file_extension,
      uploaded_by,
      entity_type = null,
      entity_id = null,
      category = 'general',
      is_public = false,
      description = null,
      metadata = null,
      checksum = null
    } = fileData;

    // Validar dados obrigatórios
    if (!original_name) {
      throw new ValidationError('Nome original do arquivo é obrigatório');
    }

    if (!file_name) {
      throw new ValidationError('Nome do arquivo é obrigatório');
    }

    if (!file_path) {
      throw new ValidationError('Caminho do arquivo é obrigatório');
    }

    if (!file_size || file_size <= 0) {
      throw new ValidationError('Tamanho do arquivo deve ser maior que zero');
    }

    if (!mime_type) {
      throw new ValidationError('Tipo MIME do arquivo é obrigatório');
    }

    if (!uploaded_by) {
      throw new ValidationError('Usuário que fez upload é obrigatório');
    }

    return await transaction(async (client) => {
      // Gerar número único para o arquivo
      const numberResult = await client.query(
        'SELECT COALESCE(MAX(CAST(SUBSTRING(number FROM 4) AS INTEGER)), 0) + 1 as next_number FROM polox.file_uploads WHERE company_id = $1 AND number ~ $2',
        [companyId, '^FIL\\d{6}$']
      );

      const nextNumber = numberResult.rows[0].next_number;
      const fileNumber = `FIL${nextNumber.toString().padStart(6, '0')}`;

      // Calcular hash do arquivo se não fornecido
      let calculatedChecksum = checksum;
      if (!calculatedChecksum && file_path) {
        try {
          const fileBuffer = await fs.readFile(file_path);
          calculatedChecksum = crypto.createHash('sha256').update(fileBuffer).digest('hex');
        } catch (error) {
          console.error('Erro ao calcular checksum:', error);
        }
      }

      const insertQuery = `
        INSERT INTO polox.file_uploads (
          company_id, number, original_name, file_name, file_path,
          file_size, mime_type, file_extension, uploaded_by,
          entity_type, entity_id, category, is_public, description,
          metadata, checksum, uploaded_at, created_at, updated_at
        )
        VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8, $9, $10, $11, $12, $13, $14,
          $15, $16, NOW(), NOW(), NOW()
        )
        RETURNING 
          id, number, original_name, file_name, file_size,
          mime_type, file_extension, category, is_public,
          uploaded_at, created_at, updated_at
      `;

      const result = await client.query(insertQuery, [
        companyId, fileNumber, original_name, file_name, file_path,
        file_size, mime_type, file_extension, uploaded_by,
        entity_type, entity_id, category, is_public, description,
        metadata, calculatedChecksum
      ]);

      return result.rows[0];
    }, { companyId });
  }

  /**
   * Busca arquivo por ID
   * @param {number} id - ID do arquivo
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object|null>} Arquivo encontrado ou null
   */
  static async findById(id, companyId) {
    const selectQuery = `
      SELECT 
        f.*,
        u.full_name as uploaded_by_name,
        u.email as uploaded_by_email,
        CASE 
          WHEN f.entity_type = 'clients' THEN c.client_name
          WHEN f.entity_type = 'leads' THEN l.lead_name
          WHEN f.entity_type = 'sales' THEN s.sale_number
          WHEN f.entity_type = 'products' THEN p.product_name
          WHEN f.entity_type = 'tickets' THEN t.number
          ELSE NULL
        END as entity_name
      FROM polox.file_uploads f
      LEFT JOIN polox.users u ON f.uploaded_by = u.id
      LEFT JOIN polox.clients c ON f.entity_type = 'clients' AND f.entity_id = c.id::text
      LEFT JOIN polox.leads l ON f.entity_type = 'leads' AND f.entity_id = l.id::text
      LEFT JOIN polox.sales s ON f.entity_type = 'sales' AND f.entity_id = s.id::text
      LEFT JOIN polox.products p ON f.entity_type = 'products' AND f.entity_id = p.id::text
      LEFT JOIN polox.tickets t ON f.entity_type = 'tickets' AND f.entity_id = t.id::text
      WHERE f.id = $1 AND f.company_id = $2 AND f.deleted_at IS NULL
    `;

    try {
      const result = await query(selectQuery, [id, companyId], { companyId });
      return result.rows[0] || null;
    } catch (error) {
      throw new ApiError(500, `Erro ao buscar arquivo: ${error.message}`);
    }
  }

  /**
   * Busca arquivo por número
   * @param {string} number - Número do arquivo
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object|null>} Arquivo encontrado ou null
   */
  static async findByNumber(number, companyId) {
    const selectQuery = `
      SELECT * FROM polox.file_uploads
      WHERE number = $1 AND company_id = $2 AND deleted_at IS NULL
    `;

    try {
      const result = await query(selectQuery, [number, companyId], { companyId });
      return result.rows[0] || null;
    } catch (error) {
      throw new ApiError(500, `Erro ao buscar arquivo por número: ${error.message}`);
    }
  }

  /**
   * Lista arquivos com filtros e paginação
   * @param {Object} options - Opções de busca
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object>} Lista de arquivos e metadados
   */
  static async list(options = {}, companyId) {
    const {
      page = 1,
      limit = 20,
      entity_type = null,
      entity_id = null,
      uploaded_by = null,
      category = null,
      mime_type = null,
      is_public = null,
      search = null,
      date_from = null,
      date_to = null,
      size_min = null,
      size_max = null,
      sortBy = 'uploaded_at',
      sortOrder = 'DESC'
    } = options;

    const offset = (page - 1) * limit;
    const conditions = ['company_id = $1', 'deleted_at IS NULL'];
    const values = [companyId];
    let paramCount = 2;

    // Adicionar filtros
    if (entity_type) {
      conditions.push(`entity_type = $${paramCount}`);
      values.push(entity_type);
      paramCount++;
    }

    if (entity_id) {
      conditions.push(`entity_id = $${paramCount}`);
      values.push(entity_id);
      paramCount++;
    }

    if (uploaded_by) {
      conditions.push(`uploaded_by = $${paramCount}`);
      values.push(uploaded_by);
      paramCount++;
    }

    if (category) {
      conditions.push(`category = $${paramCount}`);
      values.push(category);
      paramCount++;
    }

    if (mime_type) {
      if (mime_type.includes('*')) {
        // Busca por tipo geral (ex: image/*)
        const baseType = mime_type.replace('*', '');
        conditions.push(`mime_type LIKE $${paramCount}`);
        values.push(`${baseType}%`);
      } else {
        conditions.push(`mime_type = $${paramCount}`);
        values.push(mime_type);
      }
      paramCount++;
    }

    if (is_public !== null) {
      conditions.push(`is_public = $${paramCount}`);
      values.push(is_public);
      paramCount++;
    }

    if (search) {
      conditions.push(`(original_name ILIKE $${paramCount} OR description ILIKE $${paramCount} OR number ILIKE $${paramCount})`);
      values.push(`%${search}%`);
      paramCount++;
    }

    if (date_from) {
      conditions.push(`uploaded_at >= $${paramCount}`);
      values.push(date_from);
      paramCount++;
    }

    if (date_to) {
      conditions.push(`uploaded_at <= $${paramCount}`);
      values.push(date_to);
      paramCount++;
    }

    if (size_min) {
      conditions.push(`file_size >= $${paramCount}`);
      values.push(size_min);
      paramCount++;
    }

    if (size_max) {
      conditions.push(`file_size <= $${paramCount}`);
      values.push(size_max);
      paramCount++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Query para contar total
    const countQuery = `
      SELECT COUNT(*) 
      FROM polox.file_uploads 
      ${whereClause}
    `;

    // Query para buscar dados
    const selectQuery = `
      SELECT 
        f.id, f.number, f.original_name, f.file_name, f.file_size,
        f.mime_type, f.file_extension, f.category, f.is_public,
        f.entity_type, f.entity_id, f.description, f.uploaded_at,
        u.full_name as uploaded_by_name,
        CASE 
          WHEN f.entity_type = 'clients' THEN c.client_name
          WHEN f.entity_type = 'leads' THEN l.lead_name
          WHEN f.entity_type = 'sales' THEN s.sale_number
          WHEN f.entity_type = 'products' THEN p.product_name
          WHEN f.entity_type = 'tickets' THEN t.number
          ELSE NULL
        END as entity_name
      FROM polox.file_uploads f
      LEFT JOIN polox.users u ON f.uploaded_by = u.id
      LEFT JOIN polox.clients c ON f.entity_type = 'clients' AND f.entity_id = c.id::text
      LEFT JOIN polox.leads l ON f.entity_type = 'leads' AND f.entity_id = l.id::text
      LEFT JOIN polox.sales s ON f.entity_type = 'sales' AND f.entity_id = s.id::text
      LEFT JOIN polox.products p ON f.entity_type = 'products' AND f.entity_id = p.id::text
      LEFT JOIN polox.tickets t ON f.entity_type = 'tickets' AND f.entity_id = t.id::text
      ${whereClause}
      ORDER BY ${sortBy} ${sortOrder}
      LIMIT $${paramCount} OFFSET $${paramCount + 1}
    `;

    try {
      const [countResult, dataResult] = await Promise.all([
        query(countQuery, values, { companyId }),
        query(selectQuery, [...values, limit, offset], { companyId })
      ]);

      const total = parseInt(countResult.rows[0].count);
      const totalPages = Math.ceil(total / limit);

      return {
        data: dataResult.rows.map(file => ({
          ...file,
          file_size_formatted: this.formatFileSize(file.file_size),
          is_image: file.mime_type && file.mime_type.startsWith('image/'),
          is_document: file.mime_type && (
            file.mime_type.includes('pdf') ||
            file.mime_type.includes('document') ||
            file.mime_type.includes('spreadsheet') ||
            file.mime_type.includes('presentation')
          )
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      };
    } catch (error) {
      throw new ApiError(500, `Erro ao listar arquivos: ${error.message}`);
    }
  }

  /**
   * Busca arquivos de uma entidade
   * @param {string} entityType - Tipo da entidade
   * @param {number} entityId - ID da entidade
   * @param {number} companyId - ID da empresa
   * @param {Object} options - Opções de filtro
   * @returns {Promise<Array>} Lista de arquivos da entidade
   */
  static async getEntityFiles(entityType, entityId, companyId, options = {}) {
    const { category = null, mime_type = null, is_public = null } = options;

    const conditions = [
      'entity_type = $1',
      'entity_id = $2',
      'company_id = $3',
      'deleted_at IS NULL'
    ];
    const values = [entityType, entityId, companyId];
    let paramCount = 4;

    if (category) {
      conditions.push(`category = $${paramCount}`);
      values.push(category);
      paramCount++;
    }

    if (mime_type) {
      if (mime_type.includes('*')) {
        const baseType = mime_type.replace('*', '');
        conditions.push(`mime_type LIKE $${paramCount}`);
        values.push(`${baseType}%`);
      } else {
        conditions.push(`mime_type = $${paramCount}`);
        values.push(mime_type);
      }
      paramCount++;
    }

    if (is_public !== null) {
      conditions.push(`is_public = $${paramCount}`);
      values.push(is_public);
      paramCount++;
    }

    const selectQuery = `
      SELECT 
        f.*,
        u.full_name as uploaded_by_name
      FROM polox.file_uploads f
      LEFT JOIN polox.users u ON f.uploaded_by = u.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY f.uploaded_at DESC
    `;

    try {
      const result = await query(selectQuery, values, { companyId });
      return result.rows.map(file => ({
        ...file,
        file_size_formatted: this.formatFileSize(file.file_size),
        is_image: file.mime_type && file.mime_type.startsWith('image/'),
        download_url: this.generateDownloadUrl(file.id, file.number)
      }));
    } catch (error) {
      throw new ApiError(500, `Erro ao buscar arquivos da entidade: ${error.message}`);
    }
  }

  /**
   * Atualiza dados do arquivo
   * @param {number} id - ID do arquivo
   * @param {Object} updateData - Dados para atualizar
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object|null>} Arquivo atualizado ou null
   */
  static async update(id, updateData, companyId) {
    const allowedFields = [
      'original_name', 'description', 'category', 'is_public', 'metadata'
    ];

    const updates = [];
    const values = [];
    let paramCount = 1;

    // Construir query dinamicamente
    for (const [key, value] of Object.entries(updateData)) {
      if (allowedFields.includes(key)) {
        updates.push(`${key} = $${paramCount}`);
        values.push(value);
        paramCount++;
      }
    }

    if (updates.length === 0) {
      throw new ValidationError('Nenhum campo válido para atualizar');
    }

    updates.push('updated_at = NOW()');
    values.push(id, companyId);

    const updateQuery = `
      UPDATE polox.file_uploads 
      SET ${updates.join(', ')}
      WHERE id = $${paramCount} AND company_id = $${paramCount + 1} AND deleted_at IS NULL
      RETURNING 
        id, number, original_name, description, category,
        is_public, updated_at
    `;

    try {
      const result = await query(updateQuery, values, { companyId });
      return result.rows[0] || null;
    } catch (error) {
      throw new ApiError(500, `Erro ao atualizar arquivo: ${error.message}`);
    }
  }

  /**
   * Associa arquivo a uma entidade
   * @param {number} fileId - ID do arquivo
   * @param {string} entityType - Tipo da entidade
   * @param {number} entityId - ID da entidade
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object|null>} Arquivo atualizado
   */
  static async attachToEntity(fileId, entityType, entityId, companyId) {
    const validEntityTypes = [
      'clients', 'leads', 'sales', 'products', 'tickets',
      'events', 'suppliers', 'users', 'companies'
    ];

    if (!validEntityTypes.includes(entityType)) {
      throw new ValidationError(`Tipo de entidade inválido. Deve ser um de: ${validEntityTypes.join(', ')}`);
    }

    const updateQuery = `
      UPDATE polox.file_uploads 
      SET 
        entity_type = $3,
        entity_id = $4,
        updated_at = NOW()
      WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL
      RETURNING id, entity_type, entity_id, updated_at
    `;

    try {
      const result = await query(updateQuery, [fileId, companyId, entityType, entityId], { companyId });
      return result.rows[0] || null;
    } catch (error) {
      throw new ApiError(500, `Erro ao associar arquivo à entidade: ${error.message}`);
    }
  }

  /**
   * Desassocia arquivo de uma entidade
   * @param {number} fileId - ID do arquivo
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object|null>} Arquivo atualizado
   */
  static async detachFromEntity(fileId, companyId) {
    const updateQuery = `
      UPDATE polox.file_uploads 
      SET 
        entity_type = NULL,
        entity_id = NULL,
        updated_at = NOW()
      WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL
      RETURNING id, entity_type, entity_id, updated_at
    `;

    try {
      const result = await query(updateQuery, [fileId, companyId], { companyId });
      return result.rows[0] || null;
    } catch (error) {
      throw new ApiError(500, `Erro ao desassociar arquivo da entidade: ${error.message}`);
    }
  }

  /**
   * Verifica se arquivo existe fisicamente
   * @param {number} id - ID do arquivo
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object>} Status do arquivo
   */
  static async checkFileExists(id, companyId) {
    const file = await this.findById(id, companyId);
    
    if (!file) {
      throw new NotFoundError('Arquivo não encontrado');
    }

    let exists = false;
    let size = 0;

    try {
      const stats = await fs.stat(file.file_path);
      exists = true;
      size = stats.size;
    } catch (error) {
      exists = false;
    }

    return {
      file_id: file.id,
      number: file.number,
      exists,
      database_size: file.file_size,
      filesystem_size: size,
      size_match: file.file_size === size,
      file_path: file.file_path
    };
  }

  /**
   * Calcula checksum de um arquivo
   * @param {string} filePath - Caminho do arquivo
   * @returns {Promise<string>} Checksum SHA256
   */
  static async calculateChecksum(filePath) {
    try {
      const fileBuffer = await fs.readFile(filePath);
      return crypto.createHash('sha256').update(fileBuffer).digest('hex');
    } catch (error) {
      throw new ApiError(500, `Erro ao calcular checksum: ${error.message}`);
    }
  }

  /**
   * Verifica integridade do arquivo
   * @param {number} id - ID do arquivo
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Object>} Status da integridade
   */
  static async verifyIntegrity(id, companyId) {
    const file = await this.findById(id, companyId);
    
    if (!file) {
      throw new NotFoundError('Arquivo não encontrado');
    }

    const fileExists = await this.checkFileExists(id, companyId);
    
    if (!fileExists.exists) {
      return {
        file_id: file.id,
        number: file.number,
        is_valid: false,
        error: 'Arquivo não encontrado no sistema de arquivos'
      };
    }

    if (!fileExists.size_match) {
      return {
        file_id: file.id,
        number: file.number,
        is_valid: false,
        error: 'Tamanho do arquivo não confere'
      };
    }

    // Verificar checksum se disponível
    if (file.checksum) {
      try {
        const currentChecksum = await this.calculateChecksum(file.file_path);
        const checksumMatch = currentChecksum === file.checksum;
        
        return {
          file_id: file.id,
          number: file.number,
          is_valid: checksumMatch,
          error: checksumMatch ? null : 'Checksum não confere - arquivo pode estar corrompido'
        };
      } catch (error) {
        return {
          file_id: file.id,
          number: file.number,
          is_valid: false,
          error: `Erro ao verificar checksum: ${error.message}`
        };
      }
    }

    return {
      file_id: file.id,
      number: file.number,
      is_valid: true,
      error: null
    };
  }

  /**
   * Obtém estatísticas de arquivos
   * @param {number} companyId - ID da empresa
   * @param {Object} filters - Filtros opcionais
   * @returns {Promise<Object>} Estatísticas dos arquivos
   */
  static async getStats(companyId, filters = {}) {
    const { date_from, date_to, entity_type, category } = filters;
    
    const conditions = ['company_id = $1', 'deleted_at IS NULL'];
    const values = [companyId];
    let paramCount = 2;

    if (date_from) {
      conditions.push(`uploaded_at >= $${paramCount}`);
      values.push(date_from);
      paramCount++;
    }

    if (date_to) {
      conditions.push(`uploaded_at <= $${paramCount}`);
      values.push(date_to);
      paramCount++;
    }

    if (entity_type) {
      conditions.push(`entity_type = $${paramCount}`);
      values.push(entity_type);
      paramCount++;
    }

    if (category) {
      conditions.push(`category = $${paramCount}`);
      values.push(category);
      paramCount++;
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const statsQuery = `
      SELECT 
        COUNT(*) as total_files,
        COUNT(CASE WHEN is_public = TRUE THEN 1 END) as public_files,
        COUNT(CASE WHEN is_public = FALSE THEN 1 END) as private_files,
        COUNT(CASE WHEN mime_type LIKE 'image/%' THEN 1 END) as image_files,
        COUNT(CASE WHEN mime_type LIKE 'video/%' THEN 1 END) as video_files,
        COUNT(CASE WHEN mime_type LIKE 'audio/%' THEN 1 END) as audio_files,
        COUNT(CASE WHEN mime_type = 'application/pdf' THEN 1 END) as pdf_files,
        COUNT(CASE WHEN mime_type LIKE 'application/vnd.ms-%' OR mime_type LIKE 'application/vnd.openxmlformats-%' THEN 1 END) as office_files,
        SUM(file_size) as total_size_bytes,
        AVG(file_size) as avg_size_bytes,
        MAX(file_size) as max_size_bytes,
        MIN(file_size) as min_size_bytes,
        COUNT(DISTINCT uploaded_by) as unique_uploaders,
        COUNT(DISTINCT entity_type) as entity_types_count,
        COUNT(DISTINCT category) as categories_count
      FROM polox.file_uploads 
      ${whereClause}
    `;

    try {
      const result = await query(statsQuery, values, { companyId });
      const stats = result.rows[0];

      // Formatar tamanhos
      stats.total_size_formatted = this.formatFileSize(stats.total_size_bytes || 0);
      stats.avg_size_formatted = this.formatFileSize(stats.avg_size_bytes || 0);
      stats.max_size_formatted = this.formatFileSize(stats.max_size_bytes || 0);
      stats.min_size_formatted = this.formatFileSize(stats.min_size_bytes || 0);

      return stats;
    } catch (error) {
      throw new ApiError(500, `Erro ao obter estatísticas: ${error.message}`);
    }
  }

  /**
   * Obtém estatísticas por tipo MIME
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Array>} Estatísticas por tipo MIME
   */
  static async getStatsByMimeType(companyId) {
    const statsQuery = `
      SELECT 
        CASE 
          WHEN mime_type LIKE 'image/%' THEN 'Imagens'
          WHEN mime_type LIKE 'video/%' THEN 'Vídeos'
          WHEN mime_type LIKE 'audio/%' THEN 'Áudios'
          WHEN mime_type = 'application/pdf' THEN 'PDFs'
          WHEN mime_type LIKE 'application/vnd.ms-%' OR mime_type LIKE 'application/vnd.openxmlformats-%' THEN 'Office'
          WHEN mime_type LIKE 'text/%' THEN 'Textos'
          WHEN mime_type LIKE 'application/%' THEN 'Aplicações'
          ELSE 'Outros'
        END as file_type,
        COUNT(*) as file_count,
        SUM(file_size) as total_size,
        AVG(file_size) as avg_size,
        STRING_AGG(DISTINCT file_extension, ', ' ORDER BY file_extension) as extensions
      FROM polox.file_uploads 
      WHERE company_id = $1 AND deleted_at IS NULL
      GROUP BY 
        CASE 
          WHEN mime_type LIKE 'image/%' THEN 'Imagens'
          WHEN mime_type LIKE 'video/%' THEN 'Vídeos'
          WHEN mime_type LIKE 'audio/%' THEN 'Áudios'
          WHEN mime_type = 'application/pdf' THEN 'PDFs'
          WHEN mime_type LIKE 'application/vnd.ms-%' OR mime_type LIKE 'application/vnd.openxmlformats-%' THEN 'Office'
          WHEN mime_type LIKE 'text/%' THEN 'Textos'
          WHEN mime_type LIKE 'application/%' THEN 'Aplicações'
          ELSE 'Outros'
        END
      ORDER BY file_count DESC
    `;

    try {
      const result = await query(statsQuery, [companyId], { companyId });
      
      return result.rows.map(row => ({
        ...row,
        total_size_formatted: this.formatFileSize(row.total_size),
        avg_size_formatted: this.formatFileSize(row.avg_size),
        percentage: 0 // Será calculado no frontend se necessário
      }));
    } catch (error) {
      throw new ApiError(500, `Erro ao obter estatísticas por tipo: ${error.message}`);
    }
  }

  /**
   * Limpa arquivos órfãos (sem referência a entidade)
   * @param {number} companyId - ID da empresa
   * @param {number} daysOld - Número de dias (padrão: 30)
   * @returns {Promise<Array>} Arquivos removidos
   */
  static async cleanOrphanFiles(companyId, daysOld = 30) {
    return await transaction(async (client) => {
      // Buscar arquivos órfãos antigos
      const selectQuery = `
        SELECT id, number, file_path, original_name
        FROM polox.file_uploads 
        WHERE company_id = $1 
          AND entity_type IS NULL 
          AND entity_id IS NULL
          AND uploaded_at < NOW() - INTERVAL '${daysOld} days'
          AND deleted_at IS NULL
      `;

      const orphanFiles = await client.query(selectQuery, [companyId]);

      const removedFiles = [];

      for (const file of orphanFiles.rows) {
        try {
          // Tentar deletar arquivo físico
          await fs.unlink(file.file_path);
        } catch (error) {
          console.error(`Erro ao deletar arquivo físico ${file.file_path}:`, error);
        }

        // Fazer soft delete no banco
        await client.query(
          'UPDATE polox.file_uploads SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1',
          [file.id]
        );

        removedFiles.push({
          id: file.id,
          number: file.number,
          name: file.original_name
        });
      }

      return removedFiles;
    }, { companyId });
  }

  /**
   * Soft delete do arquivo
   * @param {number} id - ID do arquivo
   * @param {number} companyId - ID da empresa
   * @param {boolean} deletePhysical - Se deve deletar arquivo físico
   * @returns {Promise<Object>} Resultado da operação
   */
  static async softDelete(id, companyId, deletePhysical = false) {
    return await transaction(async (client) => {
      const file = await client.query(
        'SELECT file_path, original_name FROM polox.file_uploads WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL',
        [id, companyId]
      );

      if (file.rows.length === 0) {
        throw new NotFoundError('Arquivo não encontrado');
      }

      const fileData = file.rows[0];

      // Fazer soft delete no banco
      await client.query(
        'UPDATE polox.file_uploads SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1',
        [id]
      );

      let physicalDeleted = false;

      // Deletar arquivo físico se solicitado
      if (deletePhysical) {
        try {
          await fs.unlink(fileData.file_path);
          physicalDeleted = true;
        } catch (error) {
          console.error(`Erro ao deletar arquivo físico:`, error);
        }
      }

      return {
        id,
        name: fileData.original_name,
        deleted_from_database: true,
        deleted_from_filesystem: physicalDeleted
      };
    }, { companyId });
  }

  /**
   * Formatar tamanho do arquivo
   * @param {number} bytes - Tamanho em bytes
   * @returns {string} Tamanho formatado
   */
  static formatFileSize(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
  }

  /**
   * Gerar URL de download
   * @param {number} fileId - ID do arquivo
   * @param {string} fileNumber - Número do arquivo
   * @returns {string} URL de download
   */
  static generateDownloadUrl(fileId, fileNumber) {
    // URL será implementada no controller/routes
    return `/api/files/${fileId}/download?n=${fileNumber}`;
  }

  /**
   * Buscar arquivos duplicados (mesmo checksum)
   * @param {number} companyId - ID da empresa
   * @returns {Promise<Array>} Grupos de arquivos duplicados
   */
  static async findDuplicates(companyId) {
    const duplicatesQuery = `
      SELECT 
        checksum,
        COUNT(*) as duplicate_count,
        SUM(file_size) as total_size,
        ARRAY_AGG(
          JSON_BUILD_OBJECT(
            'id', id,
            'number', number,
            'original_name', original_name,
            'file_size', file_size,
            'uploaded_at', uploaded_at
          )
        ) as files
      FROM polox.file_uploads 
      WHERE company_id = $1 
        AND checksum IS NOT NULL 
        AND deleted_at IS NULL
      GROUP BY checksum
      HAVING COUNT(*) > 1
      ORDER BY duplicate_count DESC, total_size DESC
    `;

    try {
      const result = await query(duplicatesQuery, [companyId], { companyId });
      
      return result.rows.map(group => ({
        ...group,
        total_size_formatted: this.formatFileSize(group.total_size),
        potential_savings: this.formatFileSize(group.total_size - group.files[0].file_size)
      }));
    } catch (error) {
      throw new ApiError(500, `Erro ao buscar arquivos duplicados: ${error.message}`);
    }
  }

  /**
   * Obtém arquivos mais recentes
   * @param {number} companyId - ID da empresa
   * @param {number} limit - Limite de resultados
   * @returns {Promise<Array>} Arquivos mais recentes
   */
  static async getRecent(companyId, limit = 10) {
    const selectQuery = `
      SELECT 
        f.id, f.number, f.original_name, f.file_size, f.mime_type,
        f.uploaded_at, f.entity_type, f.entity_id,
        u.full_name as uploaded_by_name
      FROM polox.file_uploads f
      LEFT JOIN polox.users u ON f.uploaded_by = u.id
      WHERE f.company_id = $1 AND f.deleted_at IS NULL
      ORDER BY f.uploaded_at DESC
      LIMIT $2
    `;

    try {
      const result = await query(selectQuery, [companyId, limit], { companyId });
      
      return result.rows.map(file => ({
        ...file,
        file_size_formatted: this.formatFileSize(file.file_size),
        is_image: file.mime_type && file.mime_type.startsWith('image/'),
        download_url: this.generateDownloadUrl(file.id, file.number)
      }));
    } catch (error) {
      throw new ApiError(500, `Erro ao buscar arquivos recentes: ${error.message}`);
    }
  }
}

module.exports = FileUploadModel;