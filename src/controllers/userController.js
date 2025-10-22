/**
 * ==========================================
 * 👥 CONTROLLER DE USUÁRIOS ENTERPRISE
 * ==========================================
 */

const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

// Importar módulos internos
const { query, beginTransaction, commitTransaction, rollbackTransaction } = require('../config/database');
const { logger, auditLogger } = require('../utils/logger');
const { ApiError, asyncHandler } = require('../utils/errors');
const { cache } = require('../config/cache');
const { trackUser } = require('../config/monitoring');
const { 
  hashPassword,
  validatePermissions,
  hasPermission
} = require('../utils/auth');
const { 
  validateUserData,
  validateUpdateData,
  sanitizeUserOutput,
  formatPaginatedResponse
} = require('../utils/validation');

/**
 * Controller de usuários enterprise
 * Gerencia CRUD de usuários com permissões granulares e segurança avançada
 */
class UserController {

  /**
   * 📋 GET ALL USERS - Listar usuários com filtros e paginação
   */
  static getUsers = asyncHandler(async (req, res) => {
    const { 
      page = 1, 
      limit = 20, 
      search = '', 
      role = '', 
      department = '',
      isActive = '',
      sortBy = 'created_at',
      sortOrder = 'DESC'
    } = req.query;

    try {
      // 1. Verificar permissão de listar usuários
      if (!hasPermission(req.user, 'users', 'read')) {
        throw new ApiError(403, 'Sem permissão para listar usuários');
      }

      // 2. Construir query com filtros
      let whereConditions = ['u.company_id = $1', 'u.deleted_at IS NULL'];
      let queryParams = [req.user.companyId];
      let paramCount = 1;

      // Filtro de busca por nome ou email
      if (search) {
        paramCount++;
        whereConditions.push(`(u.name ILIKE $${paramCount} OR u.email ILIKE $${paramCount})`);
        queryParams.push(`%${search}%`);
      }

      // Filtro por role
      if (role) {
        paramCount++;
        whereConditions.push(`u.role = $${paramCount}`);
        queryParams.push(role);
      }

      // Filtro por departamento
      if (department) {
        paramCount++;
        whereConditions.push(`u.department = $${paramCount}`);
        queryParams.push(department);
      }

      // Filtro por status ativo
      if (isActive !== '') {
        paramCount++;
        whereConditions.push(`u.is_active = $${paramCount}`);
        queryParams.push(isActive === 'true');
      }

      const whereClause = whereConditions.join(' AND ');

      // 3. Query para contar total de registros
      const countResult = await query(`
        SELECT COUNT(*) as total
        FROM users u
        WHERE ${whereClause}
      `, queryParams);

      const total = parseInt(countResult.rows[0].total);

      // 4. Calcular paginação
      const offset = (page - 1) * limit;
      const totalPages = Math.ceil(total / limit);

      // 5. Validar ordenação
      const allowedSortFields = ['name', 'email', 'role', 'department', 'created_at', 'last_login'];
      const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'created_at';
      const order = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

      // 6. Query principal com dados dos usuários
      const usersResult = await query(`
        SELECT 
          u.id, u.name, u.email, u.role, u.department, u.position, u.phone,
          u.is_active, u.permissions, u.created_at, u.updated_at, u.last_login,
          COALESCE(
            (SELECT COUNT(*) FROM user_sessions WHERE user_id = u.id AND expires_at > NOW()), 0
          ) as active_sessions
        FROM users u
        WHERE ${whereClause}
        ORDER BY u.${sortField} ${order}
        LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
      `, [...queryParams, limit, offset]);

      // 7. Sanitizar dados de saída
      const users = usersResult.rows.map(user => sanitizeUserOutput(user));

      // 8. Log de auditoria
      auditLogger('Lista de usuários consultada', {
        userId: req.user.id,
        companyId: req.user.companyId,
        filters: { search, role, department, isActive },
        totalResults: total,
        page,
        limit
      });

      // 9. Resposta com paginação
      res.json({
        success: true,
        data: {
          users,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            totalPages,
            hasNext: page < totalPages,
            hasPrev: page > 1
          },
          filters: {
            search,
            role,
            department,
            isActive: isActive !== '' ? isActive === 'true' : null
          }
        }
      });

    } catch (error) {
      trackUser.operation(req.user.companyId, 'list', 'failure');
      throw error;
    }
  });

  /**
   * 👤 GET USER BY ID - Obter usuário específico
   */
  static getUserById = asyncHandler(async (req, res) => {
    const { id } = req.params;

    try {
      // 1. Verificar permissão
      if (!hasPermission(req.user, 'users', 'read')) {
        throw new ApiError(403, 'Sem permissão para visualizar usuário');
      }

      // 2. Buscar usuário
      const userResult = await query(`
        SELECT 
          u.id, u.name, u.email, u.role, u.department, u.position, u.phone,
          u.is_active, u.permissions, u.created_at, u.updated_at, u.last_login,
          COALESCE(
            (SELECT COUNT(*) FROM user_sessions WHERE user_id = u.id AND expires_at > NOW()), 0
          ) as active_sessions,
          c.name as company_name, c.plan as company_plan
        FROM users u
        INNER JOIN companies c ON u.company_id = c.id
        WHERE u.id = $1 AND u.company_id = $2 AND u.deleted_at IS NULL
      `, [id, req.user.companyId]);

      if (userResult.rows.length === 0) {
        throw new ApiError(404, 'Usuário não encontrado');
      }

      const user = sanitizeUserOutput(userResult.rows[0]);

      res.json({
        success: true,
        data: { user }
      });

    } catch (error) {
      throw error;
    }
  });

  /**
   * 👤 GET PROFILE - Obter perfil do usuário autenticado (LEGACY - compatibilidade)
   */
  static getProfile = asyncHandler(async (req, res) => {
    try {
      const userResult = await query(`
        SELECT 
          u.id, u.name, u.email, u.role, u.department, u.position, u.phone,
          u.permissions, u.created_at, u.last_login,
          c.id as company_id, c.name as company_name, c.plan as company_plan,
          c.modules as company_modules
        FROM users u
        INNER JOIN companies c ON u.company_id = c.id
        WHERE u.id = $1 AND u.deleted_at IS NULL
      `, [req.user.id]);

      if (userResult.rows.length === 0) {
        throw new ApiError(404, 'Usuário não encontrado');
      }

      const user = sanitizeUserOutput(userResult.rows[0]);

      res.json({
        success: true,
        message: "Perfil recuperado com sucesso",
        data: { user },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      throw error;
    }
  });

  /**
   * ✏️ UPDATE PROFILE - Atualizar perfil do usuário autenticado (LEGACY - compatibilidade)
   */
  static updateProfile = asyncHandler(async (req, res) => {
    const updateData = req.body;

    const transaction = await beginTransaction();

    try {
      // 1. Validar dados de entrada
      const validationResult = validateUpdateData(updateData);
      if (!validationResult.isValid) {
        throw new ApiError(400, 'Dados inválidos', validationResult.errors);
      }

      // 2. Buscar usuário existente
      const existingUserResult = await query(`
        SELECT * FROM users 
        WHERE id = $1 AND deleted_at IS NULL
      `, [req.user.id]);

      if (existingUserResult.rows.length === 0) {
        throw new ApiError(404, 'Usuário não encontrado');
      }

      const existingUser = existingUserResult.rows[0];

      // 3. Preparar campos para atualização
      const updateFields = [];
      const updateParams = [];
      let paramCount = 0;

      // Nome
      if (updateData.name && updateData.name !== existingUser.name) {
        paramCount++;
        updateFields.push(`name = $${paramCount}`);
        updateParams.push(updateData.name.trim());
      }

      // Email (verificar se não está em uso)
      if (updateData.email && updateData.email.toLowerCase() !== existingUser.email) {
        const emailCheck = await query(`
          SELECT id FROM users 
          WHERE email = $1 AND id != $2 AND deleted_at IS NULL
        `, [updateData.email.toLowerCase(), req.user.id]);

        if (emailCheck.rows.length > 0) {
          throw new ApiError(409, 'Email já em uso');
        }

        paramCount++;
        updateFields.push(`email = $${paramCount}`);
        updateParams.push(updateData.email.toLowerCase());
      }

      // Telefone
      if (updateData.phone !== undefined && updateData.phone !== existingUser.phone) {
        paramCount++;
        updateFields.push(`phone = $${paramCount}`);
        updateParams.push(updateData.phone?.trim());
      }

      // Nova senha (se fornecida)
      if (updateData.password) {
        const hashedPassword = await hashPassword(updateData.password);
        paramCount++;
        updateFields.push(`password = $${paramCount}`);
        updateParams.push(hashedPassword);

        // Invalidar outras sessões por segurança
        await query('DELETE FROM user_sessions WHERE user_id = $1 AND id != $2', [req.user.id, req.user.sessionId]);
      }

      // 4. Verificar se há campos para atualizar
      if (updateFields.length === 0) {
        return res.json({
          success: true,
          message: 'Nenhuma alteração necessária',
          data: {
            user: sanitizeUserOutput(existingUser)
          },
          timestamp: new Date().toISOString()
        });
      }

      // 5. Executar atualização
      updateFields.push(`updated_at = NOW()`);
      paramCount++;
      updateParams.push(req.user.id);

      const updateQuery = `
        UPDATE users 
        SET ${updateFields.join(', ')}
        WHERE id = $${paramCount}
        RETURNING id, name, email, role, department, position, phone, 
                  is_active, permissions, created_at, updated_at
      `;

      const updatedUserResult = await query(updateQuery, updateParams);
      const updatedUser = updatedUserResult.rows[0];

      await commitTransaction(transaction);

      // 6. Limpar cache do usuário
      await cache.del(`user:${req.user.id}`, req.user.companyId);

      // 7. Log de auditoria
      auditLogger('Perfil atualizado pelo usuário', {
        userId: req.user.id,
        changes: updateFields.map(field => field.split(' = ')[0]),
        ip: req.ip
      });

      res.json({
        success: true,
        message: "Perfil atualizado com sucesso",
        data: { user: sanitizeUserOutput(updatedUser) },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      await rollbackTransaction(transaction);
      throw error;
    }
  });

  /**
   * ➕ CREATE USER - Criar novo usuário
   */
  static createUser = asyncHandler(async (req, res) => {
    const userData = req.body;

    const transaction = await beginTransaction();

    try {
      // 1. Verificar permissão
      if (!hasPermission(req.user, 'users', 'create')) {
        throw new ApiError(403, 'Sem permissão para criar usuários');
      }

      // 2. Validar dados de entrada
      const validationResult = validateUserData(userData);
      if (!validationResult.isValid) {
        throw new ApiError(400, 'Dados inválidos', validationResult.errors);
      }

      const { 
        name, email, password, role = 'viewer',
        department, position, phone, permissions = []
      } = userData;

      // 3. Verificar se email já existe
      const existingUser = await query(`
        SELECT id FROM users 
        WHERE email = $1 AND deleted_at IS NULL
      `, [email.toLowerCase()]);

      if (existingUser.rows.length > 0) {
        throw new ApiError(409, 'Email já cadastrado');
      }

      // 4. Verificar permissões do usuário criador
      if (!validatePermissions(req.user, role, permissions)) {
        throw new ApiError(403, 'Sem permissão para criar usuário com esse role ou permissões');
      }

      // 5. Buscar dados da empresa
      const companyResult = await query(`
        SELECT plan, modules FROM companies 
        WHERE id = $1 AND is_active = true
      `, [req.user.companyId]);

      if (companyResult.rows.length === 0) {
        throw new ApiError(403, 'Empresa inativa');
      }

      const company = companyResult.rows[0];

      // 6. Validar role de acordo com o plano
      const allowedRoles = UserController.getRolesForPlan(company.plan);
      if (!allowedRoles.includes(role)) {
        throw new ApiError(403, `Role '${role}' não permitida para o plano ${company.plan}`);
      }

      // 7. Criptografar senha
      const hashedPassword = await hashPassword(password);

      // 8. Criar usuário
      const userResult = await query(`
        INSERT INTO users (
          id, name, email, password, role, company_id,
          department, position, phone, permissions,
          is_active, created_at, updated_at
        ) VALUES (
          gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, true, NOW(), NOW()
        ) RETURNING id, name, email, role, company_id, created_at
      `, [
        name.trim(),
        email.toLowerCase(),
        hashedPassword,
        role,
        req.user.companyId,
        department?.trim(),
        position?.trim(),
        phone?.trim(),
        JSON.stringify(permissions)
      ]);

      const newUser = userResult.rows[0];

      await commitTransaction(transaction);

      // 9. Log de auditoria
      auditLogger('Usuário criado', {
        userId: req.user.id,
        createdUserId: newUser.id,
        createdUserEmail: newUser.email,
        role: newUser.role,
        companyId: req.user.companyId,
        ip: req.ip
      });

      // 10. Métricas
      trackUser.operation(req.user.companyId, 'create', 'success');

      // 11. Resposta
      res.status(201).json({
        success: true,
        message: 'Usuário criado com sucesso',
        data: {
          user: sanitizeUserOutput(newUser)
        }
      });

    } catch (error) {
      await rollbackTransaction(transaction);
      trackUser.operation(req.user.companyId, 'create', 'failure');
      throw error;
    }
  });

  /**
   * ✏️ UPDATE USER - Atualizar usuário existente
   */
  static updateUser = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const updateData = req.body;

    const transaction = await beginTransaction();

    try {
      // 1. Verificar permissão
      if (!hasPermission(req.user, 'users', 'update')) {
        throw new ApiError(403, 'Sem permissão para atualizar usuários');
      }

      // 2. Validar dados de entrada
      const validationResult = validateUpdateData(updateData);
      if (!validationResult.isValid) {
        throw new ApiError(400, 'Dados inválidos', validationResult.errors);
      }

      // 3. Buscar usuário existente
      const existingUserResult = await query(`
        SELECT * FROM users 
        WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL
      `, [id, req.user.companyId]);

      if (existingUserResult.rows.length === 0) {
        throw new ApiError(404, 'Usuário não encontrado');
      }

      const existingUser = existingUserResult.rows[0];

      // 4. Verificar se é auto-edição ou se tem permissão para editar outros
      const isSelfEdit = existingUser.id === req.user.id;
      if (!isSelfEdit && !hasPermission(req.user, 'users', 'update_others')) {
        throw new ApiError(403, 'Sem permissão para editar outros usuários');
      }

      // 5. Preparar campos para atualização
      const updateFields = [];
      const updateParams = [];
      let paramCount = 0;

      // Nome
      if (updateData.name && updateData.name !== existingUser.name) {
        paramCount++;
        updateFields.push(`name = $${paramCount}`);
        updateParams.push(updateData.name.trim());
      }

      // Email
      if (updateData.email && updateData.email.toLowerCase() !== existingUser.email) {
        // Verificar se novo email já existe
        const emailCheck = await query(`
          SELECT id FROM users 
          WHERE email = $1 AND id != $2 AND deleted_at IS NULL
        `, [updateData.email.toLowerCase(), id]);

        if (emailCheck.rows.length > 0) {
          throw new ApiError(409, 'Email já em uso');
        }

        paramCount++;
        updateFields.push(`email = $${paramCount}`);
        updateParams.push(updateData.email.toLowerCase());
      }

      // Role (apenas se não for auto-edição)
      if (!isSelfEdit && updateData.role && updateData.role !== existingUser.role) {
        if (!validatePermissions(req.user, updateData.role, updateData.permissions)) {
          throw new ApiError(403, 'Sem permissão para alterar para esse role');
        }

        paramCount++;
        updateFields.push(`role = $${paramCount}`);
        updateParams.push(updateData.role);
      }

      // Status ativo (apenas se não for auto-edição)
      if (!isSelfEdit && updateData.isActive !== undefined && updateData.isActive !== existingUser.is_active) {
        if (!hasPermission(req.user, 'users', 'activate_deactivate')) {
          throw new ApiError(403, 'Sem permissão para ativar/desativar usuários');
        }

        paramCount++;
        updateFields.push(`is_active = $${paramCount}`);
        updateParams.push(updateData.isActive);
      }

      // Nova senha (se fornecida)
      if (updateData.password) {
        const hashedPassword = await hashPassword(updateData.password);
        paramCount++;
        updateFields.push(`password = $${paramCount}`);
        updateParams.push(hashedPassword);

        // Se alterando senha de outro usuário, invalidar sessões
        if (!isSelfEdit) {
          await query('DELETE FROM user_sessions WHERE user_id = $1', [id]);
        }
      }

      // 6. Verificar se há campos para atualizar
      if (updateFields.length === 0) {
        return res.json({
          success: true,
          message: 'Nenhuma alteração necessária',
          data: {
            user: sanitizeUserOutput(existingUser)
          }
        });
      }

      // 7. Executar atualização
      updateFields.push(`updated_at = NOW()`);
      paramCount++;
      updateParams.push(id);

      const updateQuery = `
        UPDATE users 
        SET ${updateFields.join(', ')}
        WHERE id = $${paramCount}
        RETURNING id, name, email, role, department, position, phone, 
                  is_active, permissions, created_at, updated_at
      `;

      const updatedUserResult = await query(updateQuery, updateParams);
      const updatedUser = updatedUserResult.rows[0];

      await commitTransaction(transaction);

      // 8. Limpar cache do usuário
      await cache.del(`user:${id}`, req.user.companyId);

      // 9. Log de auditoria
      auditLogger('Usuário atualizado', {
        userId: req.user.id,
        updatedUserId: id,
        changes: updateFields.map(field => field.split(' = ')[0]),
        isSelfEdit,
        companyId: req.user.companyId,
        ip: req.ip
      });

      // 10. Métricas
      trackUser.operation(req.user.companyId, 'update', 'success');

      res.json({
        success: true,
        message: 'Usuário atualizado com sucesso',
        data: {
          user: sanitizeUserOutput(updatedUser)
        }
      });

    } catch (error) {
      await rollbackTransaction(transaction);
      trackUser.operation(req.user.companyId, 'update', 'failure');
      throw error;
    }
  });

  /**
   * 🗑️ DELETE USER - Remover usuário (soft delete)
   */
  static deleteUser = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const transaction = await beginTransaction();

    try {
      // 1. Verificar permissão
      if (!hasPermission(req.user, 'users', 'delete')) {
        throw new ApiError(403, 'Sem permissão para remover usuários');
      }

      // 2. Verificar se não está tentando deletar a si mesmo
      if (id === req.user.id) {
        throw new ApiError(400, 'Não é possível deletar seu próprio usuário');
      }

      // 3. Buscar usuário
      const userResult = await query(`
        SELECT id, name, email FROM users 
        WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL
      `, [id, req.user.companyId]);

      if (userResult.rows.length === 0) {
        throw new ApiError(404, 'Usuário não encontrado');
      }

      const user = userResult.rows[0];

      // 4. Soft delete do usuário
      await query(`
        UPDATE users 
        SET deleted_at = NOW(), updated_at = NOW()
        WHERE id = $1
      `, [id]);

      // 5. Invalidar todas as sessões do usuário
      await query('DELETE FROM user_sessions WHERE user_id = $1', [id]);

      // 6. Limpar cache
      await cache.del(`user:${id}`, req.user.companyId);

      await commitTransaction(transaction);

      // 7. Log de auditoria
      auditLogger('Usuário removido', {
        userId: req.user.id,
        deletedUserId: id,
        deletedUserEmail: user.email,
        companyId: req.user.companyId,
        ip: req.ip
      });

      // 8. Métricas
      trackUser.operation(req.user.companyId, 'delete', 'success');

      res.json({
        success: true,
        message: 'Usuário removido com sucesso'
      });

    } catch (error) {
      await rollbackTransaction(transaction);
      trackUser.operation(req.user.companyId, 'delete', 'failure');
      throw error;
    }
  });

  /**
   * 🗑️ DELETE PROFILE - Desativar conta própria (LEGACY - compatibilidade)
   */
  static deleteProfile = asyncHandler(async (req, res) => {
    try {
      // 1. Desativar usuário (não deletar)
      await query(`
        UPDATE users 
        SET is_active = false, updated_at = NOW()
        WHERE id = $1
      `, [req.user.id]);

      // 2. Invalidar todas as sessões
      await query('DELETE FROM user_sessions WHERE user_id = $1', [req.user.id]);

      // 3. Limpar cache
      await cache.del(`user:${req.user.id}`, req.user.companyId);

      // 4. Log de auditoria
      auditLogger('Conta desativada pelo usuário', {
        userId: req.user.id,
        ip: req.ip
      });

      res.json({
        success: true,
        message: "Conta desativada com sucesso",
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      throw error;
    }
  });

  /**
   * 📊 GET USER STATS - Estatísticas dos usuários da empresa
   */
  static getUserStats = asyncHandler(async (req, res) => {
    try {
      // 1. Verificar permissão
      if (!hasPermission(req.user, 'users', 'read_stats')) {
        throw new ApiError(403, 'Sem permissão para visualizar estatísticas');
      }

      // 2. Buscar estatísticas
      const statsResult = await query(`
        SELECT 
          COUNT(*) as total_users,
          COUNT(*) FILTER (WHERE is_active = true) as active_users,
          COUNT(*) FILTER (WHERE is_active = false) as inactive_users,
          COUNT(*) FILTER (WHERE role = 'admin') as admin_users,
          COUNT(*) FILTER (WHERE role = 'editor') as editor_users,
          COUNT(*) FILTER (WHERE role = 'viewer') as viewer_users,
          COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days') as new_users_30d,
          COUNT(*) FILTER (WHERE last_login >= NOW() - INTERVAL '7 days') as active_7d
        FROM users 
        WHERE company_id = $1 AND deleted_at IS NULL
      `, [req.user.companyId]);

      const stats = statsResult.rows[0];

      // 3. Buscar estatísticas por departamento
      const departmentStatsResult = await query(`
        SELECT 
          department,
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE is_active = true) as active
        FROM users 
        WHERE company_id = $1 AND deleted_at IS NULL AND department IS NOT NULL
        GROUP BY department
        ORDER BY total DESC
      `, [req.user.companyId]);

      res.json({
        success: true,
        message: "Estatísticas recuperadas com sucesso",
        data: {
          stats: {
            overview: {
              totalUsers: parseInt(stats.total_users),
              activeUsers: parseInt(stats.active_users),
              inactiveUsers: parseInt(stats.inactive_users),
              newUsers30d: parseInt(stats.new_users_30d),
              activeUsers7d: parseInt(stats.active_7d)
            },
            byRole: {
              admin: parseInt(stats.admin_users),
              editor: parseInt(stats.editor_users),
              viewer: parseInt(stats.viewer_users)
            },
            byDepartment: departmentStatsResult.rows.map(dept => ({
              department: dept.department,
              total: parseInt(dept.total),
              active: parseInt(dept.active)
            }))
          }
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      throw error;
    }
  });

  /**
   * 📋 LIST USERS - Método de compatibilidade com sistema legado
   */
  static listUsers = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, status = "active" } = req.query;

    try {
      // Mapear status para filtro isActive
      let isActive = '';
      if (status === 'active') isActive = 'true';
      if (status === 'inactive') isActive = 'false';

      // Usar o método getUsers com parâmetros compatíveis
      req.query = { page, limit, isActive };
      
      await UserController.getUsers(req, res);

    } catch (error) {
      throw error;
    }
  });

  /**
   * 🔍 GET USER BY EMAIL - Buscar usuário por email (LEGACY - compatibilidade)
   */
  static getUserByEmail = asyncHandler(async (req, res) => {
    const { email } = req.query;

    try {
      if (!email) {
        throw new ApiError(400, 'Parâmetro email é obrigatório');
      }

      // 1. Verificar permissão
      if (!hasPermission(req.user, 'users', 'read')) {
        throw new ApiError(403, 'Sem permissão para buscar usuários');
      }

      // 2. Buscar usuário
      const userResult = await query(`
        SELECT 
          u.id, u.name, u.email, u.role, u.department, u.position, u.phone,
          u.is_active, u.permissions, u.created_at, u.updated_at, u.last_login
        FROM users u
        WHERE u.email = $1 AND u.company_id = $2 AND u.deleted_at IS NULL
      `, [email.toLowerCase(), req.user.companyId]);

      if (userResult.rows.length === 0) {
        throw new ApiError(404, 'Nenhum usuário encontrado com este email');
      }

      const user = sanitizeUserOutput(userResult.rows[0]);

      res.json({
        success: true,
        message: "Usuário encontrado com sucesso",
        data: { user },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      throw error;
    }
  });

  /**
   * 🔐 CHECK USER ACCESS - Middleware de compatibilidade para verificar acesso
   */
  static checkUserAccess = asyncHandler(async (req, res, next) => {
    try {
      const requestedUserId = req.params.id;
      const currentUserId = req.user.id;

      // Se é o próprio usuário ou tem permissão para gerenciar usuários
      if (requestedUserId === currentUserId || hasPermission(req.user, 'users', 'read')) {
        return next();
      }

      // Senão, nega acesso
      throw new ApiError(403, 'Você só pode acessar seus próprios dados');

    } catch (error) {
      if (error instanceof ApiError) {
        return res.status(error.statusCode).json({
          success: false,
          error: "Acesso negado",
          message: error.message,
          timestamp: new Date().toISOString()
        });
      }

      logger.error("Erro no middleware checkUserAccess:", {
        error: error.message,
        params: req.params,
        user: req.user
      });

      res.status(500).json({
        success: false,
        error: "Erro interno",
        timestamp: new Date().toISOString()
      });
    }
  });

  /**
   * 🔄 TOGGLE USER STATUS - Ativar/Desativar usuário
   */
  static toggleUserStatus = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const transaction = await beginTransaction();

    try {
      // 1. Verificar permissão
      if (!hasPermission(req.user, 'users', 'activate_deactivate')) {
        throw new ApiError(403, 'Sem permissão para ativar/desativar usuários');
      }

      // 2. Verificar se não está tentando alterar o próprio status
      if (id === req.user.id) {
        throw new ApiError(400, 'Não é possível alterar seu próprio status');
      }

      // 3. Buscar usuário
      const userResult = await query(`
        SELECT id, name, email, is_active FROM users 
        WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL
      `, [id, req.user.companyId]);

      if (userResult.rows.length === 0) {
        throw new ApiError(404, 'Usuário não encontrado');
      }

      const user = userResult.rows[0];
      const newStatus = !user.is_active;

      // 4. Atualizar status
      const updatedUserResult = await query(`
        UPDATE users 
        SET is_active = $1, updated_at = NOW()
        WHERE id = $2
        RETURNING id, name, email, role, department, position, phone, 
                  is_active, permissions, created_at, updated_at
      `, [newStatus, id]);

      const updatedUser = updatedUserResult.rows[0];

      // 5. Se desativando usuário, invalidar sessões
      if (!newStatus) {
        await query('DELETE FROM user_sessions WHERE user_id = $1', [id]);
      }

      await commitTransaction(transaction);

      // 6. Limpar cache
      await cache.del(`user:${id}`, req.user.companyId);

      // 7. Log de auditoria
      auditLogger('Status de usuário alterado', {
        userId: req.user.id,
        targetUserId: id,
        targetUserEmail: user.email,
        oldStatus: user.is_active,
        newStatus: newStatus,
        action: newStatus ? 'activated' : 'deactivated',
        companyId: req.user.companyId,
        ip: req.ip
      });

      // 8. Métricas
      trackUser.operation(req.user.companyId, 'toggle_status', 'success');

      res.json({
        success: true,
        message: `Usuário ${newStatus ? 'ativado' : 'desativado'} com sucesso`,
        data: {
          user: sanitizeUserOutput(updatedUser),
          previousStatus: user.is_active,
          newStatus: newStatus
        }
      });

    } catch (error) {
      await rollbackTransaction(transaction);
      trackUser.operation(req.user.companyId, 'toggle_status', 'failure');
      throw error;
    }
  });

  /**
   * 🏢 HELPER - Obter roles permitidas por plano
   */
  static getRolesForPlan(plan) {
    const rolesByPlan = {
      'basic': ['viewer'],
      'professional': ['viewer', 'editor'],
      'enterprise': ['viewer', 'editor', 'admin'],
      'premium': ['viewer', 'editor', 'admin', 'super_admin']
    };

    return rolesByPlan[plan] || ['viewer'];
  }
}

module.exports = UserController;
