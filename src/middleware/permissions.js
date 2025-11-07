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

const { roles } = require('../config/auth');
const { ApiError } = require('../utils/errors');
const { logger } = require('../utils/logger');

/**
 * Middleware de verificação de permissões granulares
 * Sistema flexível de autorizações baseado em roles e ações específicas
 */

/**
 * Middleware para verificar permissão específica
 * @param {string} action - Ação a ser verificada (create, read, update, delete, etc.)
 * @param {string} resource - Recurso sendo acessado (opcional)
 */
const requirePermission = (action, resource = null) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Autenticação requerida',
        code: 'AUTH_REQUIRED',
        timestamp: new Date().toISOString()
      });
    }

    // Super admin tem todas as permissões
    if (req.user.role === 'super_admin') {
      return next();
    }

    // Verificar se role tem permissão para a ação
    const roleActions = roles.actions[req.user.role] || [];
    const hasWildcard = roleActions.includes('*');
    const hasSpecificAction = roleActions.includes(action);

    if (!hasWildcard && !hasSpecificAction) {
      logger.warn('Permissão negada por ação:', {
        userId: req.user.id,
        companyId: req.user.companyId,
        role: req.user.role,
        action: action,
        resource: resource,
        endpoint: `${req.method} ${req.path}`,
        timestamp: new Date().toISOString()
      });

      return res.status(403).json({
        success: false,
        error: `Sem permissão para '${action}'`,
        code: 'ACTION_NOT_PERMITTED',
        timestamp: new Date().toISOString()
      });
    }

    // Verificar permissões específicas do usuário se definidas
    const userPermissions = req.user.permissions || [];
    if (userPermissions.length > 0 && req.user.role !== 'company_admin') {
      const hasUserPermission = userPermissions.includes(action) || 
                               userPermissions.includes('*') ||
                               (resource && userPermissions.includes(`${action}:${resource}`));

      if (!hasUserPermission) {
        logger.warn('Permissão negada por permissão específica:', {
          userId: req.user.id,
          companyId: req.user.companyId,
          action: action,
          resource: resource,
          userPermissions: userPermissions,
          endpoint: `${req.method} ${req.path}`,
          timestamp: new Date().toISOString()
        });

        return res.status(403).json({
          success: false,
          error: `Sem permissão específica para '${action}'`,
          code: 'USER_PERMISSION_DENIED',
          timestamp: new Date().toISOString()
        });
      }
    }

    // Log de permissão concedida (apenas em desenvolvimento)
    if (process.env.NODE_ENV === 'development') {
      logger.debug('Permissão concedida:', {
        userId: req.user.id,
        role: req.user.role,
        action: action,
        resource: resource,
        endpoint: `${req.method} ${req.path}`
      });
    }

    next();
  };
};

/**
 * Middleware para verificar se usuário pode acessar dados de outro usuário
 * @param {string} userIdParam - Nome do parâmetro que contém o user ID
 */
const requireOwnershipOrAdmin = (userIdParam = 'userId') => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Autenticação requerida',
        code: 'AUTH_REQUIRED',
        timestamp: new Date().toISOString()
      });
    }

    const targetUserId = req.params[userIdParam] || req.body[userIdParam];
    
    if (!targetUserId) {
      return res.status(400).json({
        success: false,
        error: 'ID do usuário requerido',
        code: 'USER_ID_REQUIRED',
        timestamp: new Date().toISOString()
      });
    }

    // Super admin e company admin podem acessar qualquer usuário da empresa
    if (['super_admin', 'company_admin', 'manager'].includes(req.user.role)) {
      return next();
    }

    // Usuário comum só pode acessar próprios dados
    if (parseInt(targetUserId) !== req.user.id) {
      logger.warn('Tentativa de acesso a dados de outro usuário:', {
        userId: req.user.id,
        targetUserId: targetUserId,
        role: req.user.role,
        endpoint: `${req.method} ${req.path}`,
        timestamp: new Date().toISOString()
      });

      return res.status(403).json({
        success: false,
        error: 'Acesso negado aos dados de outro usuário',
        code: 'OWNERSHIP_DENIED',
        timestamp: new Date().toISOString()
      });
    }

    next();
  };
};

/**
 * Middleware para verificar limites do plano da empresa
 * @param {string} limitType - Tipo de limite (users, storage, api_calls, etc.)
 * @param {number} incrementBy - Quanto será incrementado (default: 1)
 */
const checkPlanLimits = (limitType, incrementBy = 1) => {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Autenticação requerida',
        code: 'AUTH_REQUIRED',
        timestamp: new Date().toISOString()
      });
    }

    // Super admin bypassa limites
    if (req.user.role === 'super_admin') {
      return next();
    }

    const companyPlan = req.user.company.plan;
    const planConfig = roles.tenant.plans[companyPlan];

    if (!planConfig) {
      logger.error('Plano da empresa não encontrado:', {
        companyId: req.user.companyId,
        plan: companyPlan
      });
      
      return res.status(500).json({
        success: false,
        error: 'Configuração do plano não encontrada',
        code: 'PLAN_CONFIG_ERROR',
        timestamp: new Date().toISOString()
      });
    }

    // Verificar se plano tem limite para este tipo
    const limitKey = `max${limitType.charAt(0).toUpperCase() + limitType.slice(1)}`;
    const maxLimit = planConfig[limitKey];

    // -1 significa ilimitado
    if (maxLimit === -1) {
      return next();
    }

    try {
      // Buscar uso atual baseado no tipo de limite
      let currentUsage = 0;
      
      switch (limitType) {
        case 'users':
          const userCount = await query(`
            SELECT COUNT(*) as count 
            FROM users 
            WHERE company_id = $1 AND status = 'active'
          `, [req.user.companyId]);
          currentUsage = parseInt(userCount.rows[0].count);
          break;
          
        case 'storage':
          const storageUsage = await query(`
            SELECT COALESCE(SUM(file_size), 0) as total_size
            FROM file_uploads 
            WHERE company_id = $1 AND status = 'active'
          `, [req.user.companyId]);
          currentUsage = parseInt(storageUsage.rows[0].total_size);
          break;
          
        default:
          logger.warn('Tipo de limite não implementado:', { limitType });
          return next(); // Permitir se não sabemos como verificar
      }

      // Verificar se excederá o limite
      if (currentUsage + incrementBy > maxLimit) {
        logger.warn('Limite do plano excedido:', {
          companyId: req.user.companyId,
          plan: companyPlan,
          limitType: limitType,
          currentUsage: currentUsage,
          maxLimit: maxLimit,
          attempted: incrementBy
        });

        return res.status(402).json({
          success: false,
          error: `Limite do plano ${companyPlan} excedido para ${limitType}`,
          code: 'PLAN_LIMIT_EXCEEDED',
          details: {
            current: currentUsage,
            limit: maxLimit,
            plan: companyPlan
          },
          timestamp: new Date().toISOString()
        });
      }

      // Adicionar informações de limite ao request
      req.planUsage = {
        type: limitType,
        current: currentUsage,
        limit: maxLimit,
        plan: companyPlan
      };

      next();
    } catch (error) {
      logger.error('Erro ao verificar limites do plano:', error);
      
      // Em caso de erro, permitir a operação mas logar
      logger.warn('Permitindo operação devido a erro na verificação de limite');
      next();
    }
  };
};

/**
 * Middleware para verificar hierarquia de roles
 * Impede que usuários modifiquem usuários com role superior
 */
const checkRoleHierarchy = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Autenticação requerida',
      code: 'AUTH_REQUIRED',
      timestamp: new Date().toISOString()
    });
  }

  // Super admin pode fazer qualquer coisa
  if (req.user.role === 'super_admin') {
    return next();
  }

  const targetRole = req.body.role;
  if (!targetRole) {
    return next(); // Se não está alterando role, continuar
  }

  const userLevel = roles.hierarchy[req.user.role] || 0;
  const targetLevel = roles.hierarchy[targetRole] || 0;

  // Usuário não pode criar/modificar usuário com role superior ou igual
  if (targetLevel >= userLevel) {
    logger.warn('Tentativa de criar/modificar usuário com role superior:', {
      userId: req.user.id,
      userRole: req.user.role,
      userLevel: userLevel,
      targetRole: targetRole,
      targetLevel: targetLevel,
      endpoint: `${req.method} ${req.path}`
    });

    return res.status(403).json({
      success: false,
      error: 'Não é possível criar/modificar usuário com role superior ou igual',
      code: 'ROLE_HIERARCHY_VIOLATION',
      timestamp: new Date().toISOString()
    });
  }

  next();
};

/**
 * Middleware para log de auditoria de permissões
 */
const auditPermissions = (action, resource = null) => {
  return (req, res, next) => {
    // Interceptar resposta para log de auditoria
    const originalSend = res.send;
    res.send = function(data) {
      // Log apenas se operação foi bem-sucedida
      if (res.statusCode < 400) {
        logger.info('Ação autorizada executada:', {
          userId: req.user?.id,
          companyId: req.user?.companyId,
          role: req.user?.role,
          action: action,
          resource: resource,
          method: req.method,
          endpoint: req.path,
          statusCode: res.statusCode,
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          timestamp: new Date().toISOString()
        });
      }
      
      return originalSend.call(this, data);
    };

    next();
  };
};

module.exports = {
  requirePermission,
  requireOwnershipOrAdmin,
  checkPlanLimits,
  checkRoleHierarchy,
  auditPermissions
};