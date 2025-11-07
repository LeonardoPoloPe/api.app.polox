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

/**
 * ==========================================
 * 🚀 CONFIGURAÇÕES DE CACHE
 * ==========================================
 */

const Redis = require('redis');
const { logger } = require('../utils/logger');

/**
 * Sistema de cache distribuído com Redis
 * Suporta invalidação automática e namespacing por empresa
 */

class CacheManager {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.defaultTTL = parseInt(process.env.CACHE_DEFAULT_TTL) || 3600; // 1 hora
    this.keyPrefix = process.env.CACHE_KEY_PREFIX || 'crm:';
    
    this.init();
  }

  async init() {
    try {
      if (process.env.REDIS_URL) {
        this.client = Redis.createClient({
          url: process.env.REDIS_URL,
          socket: {
            connectTimeout: 10000,
            lazyConnect: true,
            reconnectStrategy: (retries) => {
              if (retries > 3) {
                logger.error('Redis: Máximo de tentativas de reconexão atingido');
                return false;
              }
              return Math.min(retries * 50, 500);
            }
          }
        });

        this.client.on('connect', () => {
          logger.info('Redis: Conectado com sucesso');
          this.isConnected = true;
        });

        this.client.on('error', (error) => {
          logger.error('Redis: Erro de conexão', { error: error.message });
          this.isConnected = false;
        });

        this.client.on('end', () => {
          logger.warn('Redis: Conexão encerrada');
          this.isConnected = false;
        });

        await this.client.connect();
      } else {
        logger.warn('Redis: REDIS_URL não configurada, cache desabilitado');
      }
    } catch (error) {
      logger.error('Redis: Falha na inicialização', { error: error.message });
      this.isConnected = false;
    }
  }

  /**
   * Gera chave namespaced para a empresa
   */
  generateKey(key, companyId = null) {
    const baseKey = `${this.keyPrefix}${key}`;
    return companyId ? `${baseKey}:company:${companyId}` : baseKey;
  }

  /**
   * Define valor no cache
   */
  async set(key, value, ttl = this.defaultTTL, companyId = null) {
    if (!this.isConnected) return false;

    try {
      const cacheKey = this.generateKey(key, companyId);
      const serializedValue = JSON.stringify({
        data: value,
        timestamp: Date.now(),
        companyId: companyId
      });

      if (ttl > 0) {
        await this.client.setEx(cacheKey, ttl, serializedValue);
      } else {
        await this.client.set(cacheKey, serializedValue);
      }

      logger.debug('Cache: Valor definido', { key: cacheKey, ttl });
      return true;
    } catch (error) {
      logger.error('Cache: Erro ao definir valor', { 
        key, 
        error: error.message 
      });
      return false;
    }
  }

  /**
   * Obtém valor do cache
   */
  async get(key, companyId = null) {
    if (!this.isConnected) return null;

    try {
      const cacheKey = this.generateKey(key, companyId);
      const value = await this.client.get(cacheKey);

      if (!value) {
        logger.debug('Cache: Miss', { key: cacheKey });
        return null;
      }

      const parsed = JSON.parse(value);
      logger.debug('Cache: Hit', { key: cacheKey });
      
      return parsed.data;
    } catch (error) {
      logger.error('Cache: Erro ao obter valor', { 
        key, 
        error: error.message 
      });
      return null;
    }
  }

  /**
   * Remove valor do cache
   */
  async del(key, companyId = null) {
    if (!this.isConnected) return false;

    try {
      const cacheKey = this.generateKey(key, companyId);
      const result = await this.client.del(cacheKey);
      
      logger.debug('Cache: Valor removido', { key: cacheKey });
      return result > 0;
    } catch (error) {
      logger.error('Cache: Erro ao remover valor', { 
        key, 
        error: error.message 
      });
      return false;
    }
  }

  /**
   * Remove múltiplas chaves por padrão
   */
  async delPattern(pattern, companyId = null) {
    if (!this.isConnected) return 0;

    try {
      const searchPattern = this.generateKey(pattern, companyId);
      const keys = await this.client.keys(searchPattern);
      
      if (keys.length === 0) return 0;
      
      const result = await this.client.del(keys);
      logger.debug('Cache: Padrão removido', { pattern: searchPattern, count: result });
      
      return result;
    } catch (error) {
      logger.error('Cache: Erro ao remover padrão', { 
        pattern, 
        error: error.message 
      });
      return 0;
    }
  }

  /**
   * Incrementa contador no cache
   */
  async incr(key, companyId = null) {
    if (!this.isConnected) return null;

    try {
      const cacheKey = this.generateKey(key, companyId);
      const result = await this.client.incr(cacheKey);
      
      logger.debug('Cache: Contador incrementado', { key: cacheKey, value: result });
      return result;
    } catch (error) {
      logger.error('Cache: Erro ao incrementar', { 
        key, 
        error: error.message 
      });
      return null;
    }
  }

  /**
   * Define TTL para uma chave existente
   */
  async expire(key, ttl, companyId = null) {
    if (!this.isConnected) return false;

    try {
      const cacheKey = this.generateKey(key, companyId);
      const result = await this.client.expire(cacheKey, ttl);
      
      logger.debug('Cache: TTL definido', { key: cacheKey, ttl });
      return result === 1;
    } catch (error) {
      logger.error('Cache: Erro ao definir TTL', { 
        key, 
        error: error.message 
      });
      return false;
    }
  }

  /**
   * Limpa cache de uma empresa específica
   */
  async clearCompanyCache(companyId) {
    if (!this.isConnected) return 0;

    try {
      const pattern = this.generateKey('*', companyId);
      return await this.delPattern(pattern);
    } catch (error) {
      logger.error('Cache: Erro ao limpar cache da empresa', { 
        companyId, 
        error: error.message 
      });
      return 0;
    }
  }

  /**
   * Obtém informações do cache
   */
  async getInfo() {
    if (!this.isConnected) return null;

    try {
      const info = await this.client.info('memory');
      return {
        connected: this.isConnected,
        memory: info
      };
    } catch (error) {
      logger.error('Cache: Erro ao obter informações', { error: error.message });
      return null;
    }
  }

  /**
   * Encerra conexão
   */
  async disconnect() {
    if (this.client && this.isConnected) {
      try {
        await this.client.quit();
        logger.info('Redis: Desconectado');
      } catch (error) {
        logger.error('Redis: Erro ao desconectar', { error: error.message });
      }
    }
  }
}

// Instância singleton
const cache = new CacheManager();

// Middleware para cache de resposta
const cacheMiddleware = (ttl = 300, keyGenerator = null) => {
  return async (req, res, next) => {
    if (req.method !== 'GET') {
      return next();
    }

    try {
      const companyId = req.user?.companyId;
      const cacheKey = keyGenerator 
        ? keyGenerator(req) 
        : `route:${req.originalUrl}:${JSON.stringify(req.query)}`;

      const cachedData = await cache.get(cacheKey, companyId);
      
      if (cachedData) {
        logger.debug('Cache: Resposta servida do cache', { 
          route: req.originalUrl,
          cacheKey 
        });
        
        return res.json({
          success: true,
          data: cachedData,
          cached: true,
          timestamp: new Date().toISOString()
        });
      }

      // Interceptar res.json para cachear a resposta
      const originalJson = res.json;
      res.json = function(data) {
        if (res.statusCode === 200 && data.success) {
          cache.set(cacheKey, data.data, ttl, companyId);
        }
        return originalJson.call(this, data);
      };

      next();
    } catch (error) {
      logger.error('Cache middleware: Erro', { error: error.message });
      next();
    }
  };
};

module.exports = {
  cache,
  cacheMiddleware,
  CacheManager
};