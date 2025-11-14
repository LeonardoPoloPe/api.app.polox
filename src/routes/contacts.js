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
 * 👥 ROTAS DE CONTATOS - IDENTIDADE UNIFICADA
 * ==========================================
 *
 * Arquitetura: "Identidade vs. Intenção"
 * - Unifica Leads + Clientes em uma única tabela
 * - Tabela: polox.contacts
 */

const express = require("express");
const ContactController = require("../controllers/ContactController");
const DealController = require("../controllers/DealController");
const ContactNoteController = require("../controllers/ContactNoteController");
const { authenticateToken } = require("../middleware/auth");
const { rateLimiter } = require("../middleware/rateLimiter");

const router = express.Router();

// 🔐 Middleware obrigatório: autenticação
router.use(authenticateToken);

/**
 * @swagger
 * /contacts:
 *   get:
 *     summary: Listar contatos (leads + clientes)
 *     description: Lista todos os contatos com filtros e paginação
 *     tags: [Contacts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/AcceptLanguage'
 *       - in: query
 *         name: tipo
 *         schema:
 *           type: string
 *           enum: [lead, cliente]
 *         description: Filtrar por tipo de contato
 *       - in: query
 *         name: origem
 *         schema:
 *           type: string
 *         description: Filtrar por origem (ex site, whatsapp, indicacao)
 *       - in: query
 *         name: owner_id
 *         schema:
 *           type: integer
 *         description: Filtrar por responsável
 *       - in: query
 *         name: company_id
 *         schema:
 *           type: integer
 *         description: Filtrar por empresa específica
 *         example: 25
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Buscar por nome, email, telefone ou documento
 *       - in: query
 *         name: numerotelefone
 *         schema:
 *           type: string
 *         description: |
 *           Filtro específico por número de telefone (WhatsApp). Regra:
 *           - Remove caracteres não numéricos automaticamente
 *           - Se não começar com 55, o sistema também busca pela variante com 55 prefixado
 *           - Se começar com 55, também busca pela variante sem 55
 *           Exemplo: 11999999999 → busca 11999999999 e 5511999999999
 *           Exemplo: 5511999999999 → busca 5511999999999 e 11999999999
 *       - in: query
 *         name: tags
 *         schema:
 *           type: string
 *         description: Filtrar por tags (separar com vírgula)
 *       - in: query
 *         name: sort_by
 *         schema:
 *           type: string
 *           enum: [created_at, updated_at, nome, lifetime_value_cents]
 *           default: created_at
 *         description: Campo para ordenação
 *       - in: query
 *         name: sort_order
 *         schema:
 *           type: string
 *           enum: [ASC, DESC]
 *           default: DESC
 *         description: Ordem de classificação
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *           maximum: 200
 *         description: Itens por página
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Offset para paginação
 *     responses:
 *       200:
 *         description: Lista de contatos
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Contact'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     offset:
 *                       type: integer
 */
router.get("/", ContactController.list);

/**
 * @swagger
 * /contacts/simplified:
 *   get:
 *     summary: 📋 Listar contatos simplificados
 *     description: |
 *       Lista contatos com apenas os campos essenciais para melhor performance.
 *       
 *       **IMPORTANTE:** O company_id é obtido automaticamente do token JWT.
 *       Não é necessário (nem possível) passar o company_id como parâmetro.
 *       
 *       **Campos retornados:**
 *       - id (string)
 *       - company_id (string) - da empresa do usuário autenticado
 *       - tipo (lead/cliente)
 *       - nome
 *       
 *       **Ideal para:**
 *       - Autocompletes e selects
 *       - Listagens rápidas
 *       - Aplicações móveis
 *       - Widgets e dashboards
 *       
 *       **Segurança:**
 *       - Isolamento multi-tenant automático
 *       - Usuário só vê contatos da própria empresa
 *     tags: [Contacts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/AcceptLanguage'
 *       - in: query
 *         name: tipo
 *         schema:
 *           type: string
 *           enum: [lead, cliente]
 *         description: Filtrar por tipo de contato
 *       - in: query
 *         name: owner_id
 *         schema:
 *           type: integer
 *         description: Filtrar por responsável
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Buscar por nome
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *           maximum: 200
 *         description: Itens por página
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Offset para paginação
 *     responses:
 *       200:
 *         description: Lista simplificada de contatos
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Contatos simplificados carregados com sucesso"
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         example: "67"
 *                       company_id:
 *                         type: string
 *                         example: "25"
 *                       tipo:
 *                         type: string
 *                         enum: [lead, cliente]
 *                         example: "lead"
 *                       nome:
 *                         type: string
 *                         example: "Dani"
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     currentPage:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 *                     totalItems:
 *                       type: integer
 *                     itemsPerPage:
 *                       type: integer
 *                     hasNextPage:
 *                       type: boolean
 *                     hasPreviousPage:
 *                       type: boolean
 */
router.get("/simplified", ContactController.getSimplifiedList);

/**
 * @swagger
 * /contacts/search:
 *   get:
 *     summary: 🔍 Buscar contato por identificador
 *     description: |
 *       Busca rápida por phone/email/document
 *       **Para Extensão WhatsApp**: verificar se contato já existe
 *     tags: [Contacts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/AcceptLanguage'
 *       - in: query
 *         name: phone
 *         schema:
 *           type: string
 *         description: |
 *           Buscar por telefone. Regra do WhatsApp:
 *           - Remove caracteres não numéricos automaticamente
 *           - Se não começar com 55, também busca pela variante com 55 prefixado
 *           - Se começar com 55, também busca pela variante sem 55
 *       - in: query
 *         name: company_id
 *         schema:
 *           type: integer
 *         description: ID da empresa a ser usada na busca (obrigatório)
 *         required: true
 *         example: 25
 *       - in: query
 *         name: email
 *         schema:
 *           type: string
 *         description: Buscar por email
 *       - in: query
 *         name: document
 *         schema:
 *           type: string
 *         description: Buscar por CPF/CNPJ
 *     responses:
 *       200:
 *         description: Resultado da busca
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 found:
 *                   type: boolean
 *                   description: true se encontrou, false se não encontrou
 *                 message:
 *                   type: string
 *                 data:
 *                   oneOf:
 *                     - type: object
 *                       description: Campos mínimos retornados para performance
 *                       properties:
 *                         id:
 *                           type: integer
 *                         company_id:
 *                           type: integer
 *                         nome:
 *                           type: string
 *                         email:
 *                           type: string
 *                         phone:
 *                           type: string
 *                         score:
 *                           type: integer
 *                         temperature:
 *                           type: string
 *                           enum: [frio, morno, quente]
 *                         tipo:
 *                           type: string
 *                           enum: [lead, cliente]
 *                         status:
 *                           type: string
 *                         notes_count:
 *                           type: integer
 *                           description: Quantidade de notas do contato
 *                     - type: null
 */
router.get("/search", ContactController.searchContact);

/**
 * @swagger
 * /contacts/stats:
 *   get:
 *     summary: Estatísticas de contatos
 *     description: Retorna estatísticas gerais (total, leads, clientes, taxa de conversão)
 *     tags: [Contacts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/AcceptLanguage'
 *       - in: query
 *         name: owner_id
 *         schema:
 *           type: integer
 *         description: Filtrar por responsável
 *       - in: query
 *         name: origem
 *         schema:
 *           type: string
 *         description: Filtrar por origem
 *     responses:
 *       200:
 *         description: Estatísticas de contatos
 */
router.get("/stats", ContactController.getStats);

/**
 * @swagger
 * /contacts/get-or-create:
 *   post:
 *     summary: Buscar ou criar contato (Find-or-Restore)
 *     description: |
 *       Busca contato por phone/email/document
 *       - Se encontrar ativo: retorna
 *       - Se encontrar deletado: restaura e retorna
 *       - Se não encontrar: cria novo
 *       (Útil para integração WhatsApp)
 *     tags: [Contacts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/AcceptLanguage'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               phone:
 *                 type: string
 *                 example: "+5511999999999"
 *               email:
 *                 type: string
 *                 example: "joao@example.com"
 *               document:
 *                 type: string
 *                 example: "12345678900"
 *               nome:
 *                 type: string
 *                 example: "João Silva"
 *     responses:
 *       200:
 *         description: Contato encontrado/criado
 *       201:
 *         description: Novo contato criado
 */
router.post("/get-or-create", ContactController.getOrCreate);

/**
 * @swagger
 * /contacts/get-or-create-with-negotiation:
 *   post:
 *     summary: 🔥 ENDPOINT CRÍTICO - Buscar/Criar Contato + Criar Negociação
 *     description: |
 *       ⭐ Este é o CORAÇÃO da solução para Extensão WhatsApp + Landing Pages
 *
 *       **COMPORTAMENTO:**
 *       1. Busca contato existente por phone/email/document (prioridade: phone)
 *       2. Se NÃO encontrar: Cria novo contato como 'lead'
 *       3. Se encontrar deletado: Restaura o contato
 *       4. **SEMPRE** cria uma NOVA negociação para esse contato
 *
 *       **RESOLVE:**
 *       - Cliente que virou lead de novo? ✅ Cria nova negociação
 *       - Múltiplos deals por contato? ✅ Suportado nativamente
 *       - Duplicidade? ✅ Constraints do banco impedem (Migration 036)
 *       - Extensão WhatsApp? ✅ 1 telefone = 1 contato sempre
 *
 *       **USO TÍPICO:**
 *       - Extensão WhatsApp: Novo contato via chat
 *       - Landing Pages: Lead preencheu formulário
 *       - Integração Meta/Google Ads
 *       - Sistema de captura multi-canal
 *     tags: [Contacts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/AcceptLanguage'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - nome
 *             properties:
 *               phone:
 *                 type: string
 *                 example: "+5511999999999"
 *                 description: Telefone (prioridade na busca)
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "joao@example.com"
 *                 description: Email (segunda prioridade)
 *               document:
 *                 type: string
 *                 example: "12345678900"
 *                 description: CPF/CNPJ (terceira prioridade)
 *               nome:
 *                 type: string
 *                 example: "João Silva"
 *                 description: Nome completo (obrigatório)
 *               origem_lp:
 *                 type: string
 *                 example: "LP Meta 04/11"
 *                 description: Origem da captura (Landing Page, WhatsApp, etc)
 *               valor_estimado:
 *                 type: integer
 *                 example: 500000
 *                 description: Valor estimado da negociação em centavos
 *               deal_title:
 *                 type: string
 *                 example: "Interesse em Produto X"
 *                 description: Título da negociação (opcional, gera automático)
 *               deal_stage:
 *                 type: string
 *                 enum: [novo, qualificado, proposta, negociacao, ganhos, perdido]
 *                 default: novo
 *                 description: Etapa inicial do funil
 *             oneOf:
 *               - required: [phone]
 *               - required: [email]
 *               - required: [document]
 *     responses:
 *       201:
 *         description: Contato criado + negociação criada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Contato processado e negociação criada com sucesso"
 *                 data:
 *                   type: object
 *                   properties:
 *                     contact:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: integer
 *                         name:
 *                           type: string
 *                         phone:
 *                           type: string
 *                         email:
 *                           type: string
 *                         tipo:
 *                           type: string
 *                           enum: [lead, cliente]
 *                         action:
 *                           type: string
 *                           enum: [created, found, restored]
 *                           description: Ação executada no contato
 *                     deal:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: integer
 *                         titulo:
 *                           type: string
 *                         etapa_funil:
 *                           type: string
 *                         valor_total_cents:
 *                           type: integer
 *                         origem:
 *                           type: string
 *                 meta:
 *                   type: object
 *                   properties:
 *                     contact_action:
 *                       type: string
 *                     contact_message:
 *                       type: string
 *                     deal_message:
 *                       type: string
 *       200:
 *         description: Contato encontrado + negociação criada
 *       400:
 *         description: Validação falhou (falta phone/email/document ou nome)
 */
router.post(
  "/get-or-create-with-negotiation",
  rateLimiter.general, // Rate limit geral
  ContactController.getOrCreateWithNegotiation
);

/**
 * @swagger
 * /contacts/{id}:
 *   get:
 *     summary: Buscar contato por ID
 *     description: Retorna detalhes completos de um contato
 *     tags: [Contacts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/AcceptLanguage'
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID do contato
 *     responses:
 *       200:
 *         description: Detalhes do contato
 *       404:
 *         description: Contato não encontrado
 */
router.get("/:id", ContactController.show);

/**
 * @swagger
 * /contacts:
 *   post:
 *     summary: Criar novo contato
 *     description: Cria um novo contato (lead ou cliente)
 *     tags: [Contacts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/AcceptLanguage'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - nome
 *             properties:
 *               nome:
 *                 type: string
 *                 minLength: 2
 *                 example: "João Silva"
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "joao@example.com"
 *               phone:
 *                 type: string
 *                 example: "+5511999999999"
 *               document:
 *                 type: string
 *                 example: "12345678900"
 *               tipo:
 *                 type: string
 *                 enum: [lead, cliente]
 *                 default: lead
 *               status:
 *                 type: string
 *                 enum: [novo, em_contato, qualificado, proposta_enviada, em_negociacao, fechado, perdido]
 *                 default: novo
 *                 description: "Status do contato no pipeline de vendas"
 *               origem:
 *                 type: string
 *                 example: "site"
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["vip", "urgente"]
 *               interests:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["produto-a", "servico-b"]
 *               owner_id:
 *                 type: integer
 *                 example: 123
 *               address:
 *                 type: string
 *               city:
 *                 type: string
 *               state:
 *                 type: string
 *               zip_code:
 *                 type: string
 *               metadata:
 *                 type: object
 *     responses:
 *       201:
 *         description: Contato criado com sucesso
 *       400:
 *         description: Dados inválidos
 */
router.post("/", rateLimiter.general, ContactController.create);

/**
 * @swagger
 * /contacts/{id}:
 *   put:
 *     summary: Atualizar contato
 *     description: Atualiza dados de um contato existente
 *     tags: [Contacts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/AcceptLanguage'
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nome:
 *                 type: string
 *                 example: "João Silva"
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "joao@example.com"
 *               phone:
 *                 type: string
 *                 example: "5511999999999"
 *               document:
 *                 type: string
 *                 example: "12345678900"
 *               tipo:
 *                 type: string
 *                 enum: [lead, cliente]
 *                 example: "lead"
 *               status:
 *                 type: string
 *                 enum: [novo, em_contato, qualificado, proposta_enviada, em_negociacao, fechado, perdido]
 *                 description: "Status do contato no pipeline de vendas"
 *                 example: "proposta_enviada"
 *               origem:
 *                 type: string
 *                 example: "whatsapp"
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["vip", "quente"]
 *               interests:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 example: [1, 5, 10]
 *               owner_id:
 *                 type: integer
 *                 example: 59
 *               lifetime_value_cents:
 *                 type: integer
 *                 minimum: 0
 *                 example: 150000
 *               address:
 *                 type: string
 *                 example: "Rua das Flores, 123"
 *               city:
 *                 type: string
 *                 example: "São Paulo"
 *               state:
 *                 type: string
 *                 example: "SP"
 *               zip_code:
 *                 type: string
 *                 example: "01234-567"
 *               metadata:
 *                 type: object
 *                 example: {}
 *           example:
 *             nome: "João Silva"
 *             email: "joao@example.com"
 *             phone: "5511999999999"
 *             status: "proposta_enviada"
 *             owner_id: 59
 *     responses:
 *       200:
 *         description: Contato atualizado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Contato atualizado com sucesso"
 *                 data:
 *                   $ref: '#/components/schemas/Contact'
 *       404:
 *         description: Contato não encontrado
 *       422:
 *         description: Dados inválidos
 */
router.put("/:id", ContactController.update);

/**
 * @swagger
 * /contacts/{id}/status:
 *   patch:
 *     summary: Atualizar apenas o status do contato
 *     description: |
 *       Altera apenas o status do contato sem modificar outros campos.
 *       Útil para mudanças rápidas no funil de vendas.
 *     tags: [Contacts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/AcceptLanguage'
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID do contato
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum:
 *                   - novo
 *                   - em_contato
 *                   - qualificado
 *                   - proposta_enviada
 *                   - em_negociacao
 *                   - fechado
 *                   - perdido
 *                 description: Novo status do contato
 *                 example: "qualificado"
 *     responses:
 *       200:
 *         description: Status do contato atualizado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Status do contato atualizado com sucesso"
 *                 data:
 *                   $ref: '#/components/schemas/Contact'
 *       400:
 *         description: Status inválido ou não fornecido
 *       404:
 *         description: Contato não encontrado
 *       422:
 *         description: Dados de validação inválidos
 */
router.patch("/:id/status", ContactController.updateStatus);

/**
 * @swagger
 * /contacts/{id}/convert:
 *   post:
 *     summary: Converter Lead em Cliente (manual)
 *     description: Converte manualmente um lead para cliente (tipo='lead' → tipo='cliente')
 *     tags: [Contacts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/AcceptLanguage'
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID do lead
 *     responses:
 *       200:
 *         description: Lead convertido para cliente
 *       400:
 *         description: Contato já é um cliente
 *       404:
 *         description: Lead não encontrado
 */
router.post("/:id/convert", ContactController.convertToClient);

/**
 * @swagger
 * /contacts/{id}:
 *   delete:
 *     summary: Excluir contato (soft delete)
 *     description: Exclusão lógica do contato (deleted_at = NOW())
 *     tags: [Contacts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/AcceptLanguage'
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Contato excluído
 *       404:
 *         description: Contato não encontrado
 */
router.delete("/:id", ContactController.delete);

// ==========================================
// ROTAS ANINHADAS: DEALS E NOTES DE UM CONTATO
// ==========================================

/**
 * @swagger
 * /contacts/{contactId}/deals:
 *   get:
 *     summary: Listar negociações de um contato
 *     description: Retorna todas as deals vinculadas a um contato
 *     tags: [Contacts, Deals]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/AcceptLanguage'
 *       - in: path
 *         name: contactId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Lista de negociações do contato
 */
router.get("/:contactId/deals", DealController.listByContact);

/**
 * @swagger
 * /contacts/{contactId}/notes:
 *   get:
 *     summary: Histórico completo do contato
 *     description: Lista todas as anotações/interações de um contato
 *     tags: [Contacts, Contact Notes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/AcceptLanguage'
 *       - in: path
 *         name: contactId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: tipo
 *         schema:
 *           type: string
 *           enum: [nota, ligacao, email, reuniao, whatsapp]
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 100
 *     responses:
 *       200:
 *         description: Histórico de interações do contato
 */
router.get("/:contactId/notes", ContactNoteController.listByContact);

/**
 * @swagger
 * /contacts/{contactId}/notes:
 *   post:
 *     summary: Criar anotação para o contato
 *     description: Adiciona nova anotação/interação ao histórico do contato
 *     tags: [Contacts, Contact Notes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/AcceptLanguage'
 *       - in: path
 *         name: contactId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - content
 *             properties:
 *               content:
 *                 type: string
 *                 minLength: 3
 *                 example: "Cliente ligou perguntando sobre prazos"
 *               tipo:
 *                 type: string
 *                 enum: [nota, ligacao, email, reuniao, whatsapp]
 *                 default: nota
 *                 example: "ligacao"
 *               metadata:
 *                 type: object
 *                 example: { "duracao": "15min", "assunto": "Prazos" }
 *     responses:
 *       201:
 *         description: Anotação criada
 */
router.post(
  "/:contactId/notes",
  rateLimiter.general,
  ContactNoteController.create
);

/**
 * @swagger
 * /contacts/{contactId}/notes/stats:
 *   get:
 *     summary: Estatísticas de interações do contato
 *     description: Retorna contadores de interações por tipo (quantas ligações, emails, etc)
 *     tags: [Contacts, Contact Notes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/AcceptLanguage'
 *       - in: path
 *         name: contactId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Estatísticas de interações
 */
router.get("/:contactId/notes/stats", ContactNoteController.getContactStats);

/**
 * @swagger
 * /contacts/{contactId}/notes/recent:
 *   get:
 *     summary: Anotações recentes do contato
 *     description: Retorna as 5 últimas interações com o contato
 *     tags: [Contacts, Contact Notes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/AcceptLanguage'
 *       - in: path
 *         name: contactId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 5
 *     responses:
 *       200:
 *         description: Anotações recentes
 */
router.get(
  "/:contactId/notes/recent",
  ContactNoteController.getRecentByContact
);

/**
 * @swagger
 * components:
 *   schemas:
 *     Contact:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         company_id:
 *           type: integer
 *         nome:
 *           type: string
 *         email:
 *           type: string
 *         phone:
 *           type: string
 *         document:
 *           type: string
 *         tipo:
 *           type: string
 *           enum: [lead, cliente]
 *         origem:
 *           type: string
 *         owner_id:
 *           type: integer
 *         tags:
 *           type: array
 *           items:
 *             type: string
 *         interests:
 *           type: array
 *           items:
 *             type: string
 *         lifetime_value_cents:
 *           type: integer
 *         last_purchase_date:
 *           type: string
 *           format: date-time
 *         address:
 *           type: string
 *         city:
 *           type: string
 *         state:
 *           type: string
 *         zip_code:
 *           type: string
 *         metadata:
 *           type: object
 *         created_at:
 *           type: string
 *           format: date-time
 *         updated_at:
 *           type: string
 *           format: date-time
 */

module.exports = router;
