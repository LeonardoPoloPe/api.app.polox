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

const { ApiError } = require('../utils/errors');
const { logger } = require('../utils/logger');

/**
 * Middleware de isolamento multi-tenant
 * Garante que todas as queries incluam company_id para isolamento completo
 */

/**
 * Middleware principal de multi-tenancy
 * Aplica isolamento baseado na empresa do usuário autenticado
 */
const tenantMiddleware = (req, res, next) => {
  // Verificar se usuário está autenticado (deve vir após authMiddleware)
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Autenticação requerida para isolamento multi-tenant',
      code: 'AUTH_REQUIRED',
      timestamp: new Date().toISOString()
    });
  }

  // Super admin pode override o isolamento via header especial
  const bypassTenant = req.headers['x-bypass-tenant'] === 'true';
  if (bypassTenant && req.user.role === 'super_admin') {
    // Super admin pode acessar dados de qualquer empresa
    const targetCompanyId = req.headers['x-target-company-id'];
    
    if (targetCompanyId) {
      req.companyId = parseInt(targetCompanyId);
      req.tenantBypass = true;
      
      logger.info('Super admin bypass multi-tenant:', {
        userId: req.user.id,
        originalCompanyId: req.user.companyId,
        targetCompanyId: req.companyId,
        endpoint: `${req.method} ${req.path}`,
        timestamp: new Date().toISOString()
      });
    } else {
      req.companyId = req.user.companyId;
      req.tenantBypass = false;
    }
  } else {
    // Isolamento normal - usar company_id do usuário
    req.companyId = req.user.companyId;
    req.tenantBypass = false;
  }

  // Verificar se empresa está ativa
  if (!req.tenantBypass && req.user.company.status !== 'active') {
    return res.status(403).json({
      success: false,
      error: 'Empresa inativa ou suspensa',
      code: 'COMPANY_INACTIVE',
      timestamp: new Date().toISOString()
    });
  }

  // Adicionar helper para queries com isolamento automático
  req.queryWithTenant = (query, params = []) => {
    // Verificar se query já inclui WHERE
    const hasWhere = query.toLowerCase().includes('where');
    const tenantClause = hasWhere ? 
      ' AND company_id = $' + (params.length + 1) :
      ' WHERE company_id = $' + (params.length + 1);
    
    // Adicionar company_id automaticamente
    const tenantQuery = query + tenantClause;
    const tenantParams = [...params, req.companyId];
    
    return { query: tenantQuery, params: tenantParams };
  };

  // Log de atividade multi-tenant
  if (process.env.NODE_ENV === 'development') {
    logger.debug('Multi-tenant context:', {
      userId: req.user.id,
      companyId: req.companyId,
      bypass: req.tenantBypass,
      endpoint: `${req.method} ${req.path}`,
      timestamp: new Date().toISOString()
    });
  }

  next();
};

/**
 * Middleware para super admin que pode acessar qualquer empresa
 * Usado em rotas administrativas globais
 */
const superAdminTenantMiddleware = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Autenticação requerida',
      code: 'AUTH_REQUIRED',
      timestamp: new Date().toISOString()
    });
  }

  if (req.user.role !== 'super_admin') {
    return res.status(403).json({
      success: false,
      error: 'Acesso restrito a super administradores',
      code: 'SUPER_ADMIN_REQUIRED',
      timestamp: new Date().toISOString()
    });
  }

  // Super admin pode especificar company_id via parâmetro ou header
  const targetCompanyId = req.params.companyId || 
                         req.query.companyId || 
                         req.headers['x-target-company-id'] ||
                         req.body.companyId;

  if (targetCompanyId) {
    req.companyId = parseInt(targetCompanyId);
    req.tenantBypass = true;
  } else {
    // Se não especificado, usar empresa do super admin (geralmente null)
    req.companyId = null;
    req.tenantBypass = true;
  }

  // Helper para queries sem isolamento (para listagens globais)
  req.queryGlobal = (query, params = []) => {
    return { query, params };
  };

  // Helper para queries com empresa específica
  req.queryWithCompany = (query, params = [], companyId = null) => {
    const targetCompany = companyId || req.companyId;
    
    if (!targetCompany) {
      throw new ApiError(400, 'Company ID requerido para esta operação');
    }
    
    const hasWhere = query.toLowerCase().includes('where');
    const tenantClause = hasWhere ? 
      ' AND company_id = $' + (params.length + 1) :
      ' WHERE company_id = $' + (params.length + 1);
    
    const tenantQuery = query + tenantClause;
    const tenantParams = [...params, targetCompany];
    
    return { query: tenantQuery, params: tenantParams };
  };

  next();
};

/**
 * Middleware para validar e sanitizar company_id em requests
 * Usado quando company_id vem como parâmetro da URL
 */
const validateCompanyIdParam = (req, res, next) => {
  const companyId = req.params.companyId;
  
  if (!companyId) {
    return res.status(400).json({
      success: false,
      error: 'Company ID é obrigatório',
      code: 'MISSING_COMPANY_ID',
      timestamp: new Date().toISOString()
    });
  }

  // Converter para número e validar
  const parsedCompanyId = parseInt(companyId);
  if (isNaN(parsedCompanyId) || parsedCompanyId <= 0) {
    return res.status(400).json({
      success: false,
      error: 'Company ID inválido',
      code: 'INVALID_COMPANY_ID',
      timestamp: new Date().toISOString()
    });
  }

  // Para não-super-admin, verificar se está tentando acessar própria empresa
  if (req.user && req.user.role !== 'super_admin') {
    if (parsedCompanyId !== req.user.companyId) {
      return res.status(403).json({
        success: false,
        error: 'Acesso negado a esta empresa',
        code: 'COMPANY_ACCESS_DENIED',
        timestamp: new Date().toISOString()
      });
    }
  }

  // Adicionar company_id validado ao request
  req.validatedCompanyId = parsedCompanyId;
  
  next();
};

/**
 * Middleware para verificar se usuário tem acesso a módulo específico
 * @param {string} moduleName - Nome do módulo a verificar
 */
const requireModule = (moduleName) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Autenticação requerida',
        code: 'AUTH_REQUIRED',
        timestamp: new Date().toISOString()
      });
    }

    // Super admin tem acesso a todos os módulos
    if (req.user.role === 'super_admin') {
      return next();
    }

    // Verificar se empresa tem o módulo habilitado
    const companyModules = req.user.company.modules || [];
    if (!companyModules.includes(moduleName) && !companyModules.includes('*')) {
      logger.warn('Acesso negado a módulo:', {
        userId: req.user.id,
        companyId: req.user.companyId,
        module: moduleName,
        availableModules: companyModules,
        endpoint: `${req.method} ${req.path}`,
        timestamp: new Date().toISOString()
      });

      return res.status(403).json({
        success: false,
        error: `Módulo '${moduleName}' não habilitado para sua empresa`,
        code: 'MODULE_NOT_ENABLED',
        timestamp: new Date().toISOString()
      });
    }

    // Verificar permissões específicas do usuário
    const userPermissions = req.user.permissions || [];
    if (!userPermissions.includes(moduleName) && 
        !userPermissions.includes('*') && 
        req.user.role !== 'company_admin') {
      
      logger.warn('Acesso negado por permissão:', {
        userId: req.user.id,
        companyId: req.user.companyId,
        module: moduleName,
        userPermissions: userPermissions,
        endpoint: `${req.method} ${req.path}`,
        timestamp: new Date().toISOString()
      });

      return res.status(403).json({
        success: false,
        error: `Sem permissão para acessar módulo '${moduleName}'`,
        code: 'MODULE_PERMISSION_DENIED',
        timestamp: new Date().toISOString()
      });
    }

    next();
  };
};

/**
 * Middleware para log de atividades multi-tenant
 */
const logTenantActivity = (req, res, next) => {
  // Capturar dados da resposta para log
  const originalSend = res.send;
  res.send = function(data) {
    // Log de atividade apenas para operações de escrita
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      logger.info('Atividade multi-tenant:', {
        userId: req.user?.id,
        companyId: req.companyId,
        method: req.method,
        endpoint: req.path,
        statusCode: res.statusCode,
        userAgent: req.get('User-Agent'),
        ip: req.ip,
        timestamp: new Date().toISOString()
      });
    }
    
    return originalSend.call(this, data);
  };

  next();
};

module.exports = {
  tenantMiddleware,
  superAdminTenantMiddleware,
  validateCompanyIdParam,
  requireModule,
  logTenantActivity
};