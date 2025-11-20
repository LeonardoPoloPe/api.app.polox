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
 *     description: |
 *       Lista todos os contatos com filtros e paginação.
 *
 *       **IMPORTANTE:** O company_id é obtido automaticamente do token JWT.
 *       Não é necessário (nem possível) passar o company_id como parâmetro.
 *       O sistema garante isolamento multi-tenant automático.
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
 * /contacts/check-duplicity:
 *   get:
 *     summary: Verificar duplicidade de contato (email/phone/document)
 *     description: |
 *       Verifica se já existe um contato na empresa autenticada (multi-tenant seguro) usando email, telefone ou documento.
 *       O `company_id` é obtido automaticamente do token JWT.
 *       Retorna uma resposta "gorda" para o front decidir entre modal de bloqueio ou reativação.
 *
 *       Regras:
 *       - type=phone: busca variações (com/sem +55) automaticamente
 *       - type=email: busca por email exato (case-insensitive se implementado no modelo)
 *       - type=document: busca documento exato
 *
 *       Exemplo de resposta quando existe:
 *       {
 *         "exists": true,
 *         "contact": {
 *           "id": 150,
 *           "name": "Danielle Bergnaum",
 *           "type": "cliente",
 *           "status": "fechado",
 *           "owner_id": 5,
 *           "owner_name": "Leonardo Polo"
 *         }
 *       }
 *
 *       Exemplo quando NÃO existe:
 *       {
 *         "exists": false,
 *         "contact": null
 *       }
 *     tags: [Contacts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/AcceptLanguage'
 *       - in: query
 *         name: type
 *         required: true
 *         schema:
 *           type: string
 *           enum: [phone, email, document]
 *         description: Tipo do identificador a consultar
 *       - in: query
 *         name: value
 *         required: true
 *         schema:
 *           type: string
 *         description: Valor do identificador (telefone/email/documento)
 *     responses:
 *       200:
 *         description: Resultado da verificação de duplicidade
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 exists:
 *                   type: boolean
 *                   example: true
 *                 contact:
 *                   type: object
 *                   nullable: true
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 150
 *                     name:
 *                       type: string
 *                       example: "Danielle Bergnaum"
 *                     type:
 *                       type: string
 *                       enum: [lead, cliente]
 *                       example: "cliente"
 *                     status:
 *                       type: string
 *                       example: "fechado"
 *                     owner_id:
 *                       type: integer
 *                       example: 5
 *                     owner_name:
 *                       type: string
 *                       example: "Leonardo Polo"
 */
router.get("/check-duplicity", ContactController.checkDuplicity);

/**
 * @swagger
 * /contacts/autocomplete:
 *   get:
 *     summary: 🔍 Autocomplete - Busca rápida de contatos (paginado)
 *     description: |
 *       Endpoint otimizado para autocomplete/typeahead de contatos.
 *       Busca por nome, email ou telefone simultaneamente com suporte a paginação.
 *
 *       **IMPORTANTE:** O company_id é obtido automaticamente do token JWT.
 *       Não é necessário (nem possível) passar o company_id como parâmetro.
 *       O sistema garante isolamento multi-tenant automático.
 *
 *       **Performance:**
 *       - Query otimizada com ILIKE indexado
 *       - Retorna apenas campos essenciais (7 campos)
 *       - Ordenação por relevância (começa com > contém)
 *       - Limite máximo: 50 resultados por página
 *       - Paginação eficiente com OFFSET/LIMIT
 *
 *       **Busca inteligente:**
 *       - Se o termo parece telefone (8+ dígitos), busca também em phone
 *       - Remove caracteres especiais do telefone automaticamente
 *       - Suporta busca parcial (mínimo 2 caracteres)
 *
 *       **Uso típico:**
 *       - Campos de busca no frontend (typeahead)
 *       - Seleção de contatos em formulários
 *       - Vincular contatos a deals/notas
 *       - Scroll infinito com paginação
 *     tags: [Contacts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/AcceptLanguage'
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *           minLength: 2
 *         description: Termo de busca (nome, email ou telefone)
 *         example: "maria"
 *       - in: query
 *         name: tipo
 *         schema:
 *           type: string
 *           enum: [lead, cliente]
 *         description: Filtrar por tipo de contato (opcional)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 10
 *         description: Número máximo de resultados por página
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           minimum: 0
 *           default: 0
 *         description: Número de registros a pular (para paginação)
 *     responses:
 *       200:
 *         description: Lista paginada de contatos encontrados
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
 *                   example: "Busca realizada com sucesso"
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                         example: 150
 *                       nome:
 *                         type: string
 *                         example: "Maria Silva"
 *                       email:
 *                         type: string
 *                         example: "maria@email.com"
 *                       phone:
 *                         type: string
 *                         example: "11999999999"
 *                       status:
 *                         type: string
 *                         example: "novo"
 *                       temperature:
 *                         type: string
 *                         enum: [frio, morno, quente]
 *                         example: "quente"
 *                       tipo:
 *                         type: string
 *                         enum: [lead, cliente]
 *                         example: "lead"
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                       example: 1
 *                       description: Página atual
 *                     totalPages:
 *                       type: integer
 *                       example: 5
 *                       description: Total de páginas disponíveis
 *                     totalItems:
 *                       type: integer
 *                       example: 42
 *                       description: Total de contatos encontrados
 *                     limit:
 *                       type: integer
 *                       example: 10
 *                       description: Registros por página
 *                     hasNextPage:
 *                       type: boolean
 *                       example: true
 *                       description: Se há próxima página
 *                     hasPreviousPage:
 *                       type: boolean
 *                       example: false
 *                       description: Se há página anterior
 *             example:
 *               success: true
 *               message: "Busca realizada com sucesso"
 *               data:
 *                 - id: 150
 *                   nome: "Maria Silva Santos"
 *                   email: "maria.silva@email.com"
 *                   phone: "11999887766"
 *                   status: "em_contato"
 *                   temperature: "quente"
 *                   tipo: "lead"
 *                 - id: 89
 *                   nome: "Maria Oliveira"
 *                   email: "maria.oliveira@example.com"
 *                   phone: "11988776655"
 *                   status: "novo"
 *                   temperature: "frio"
 *                   tipo: "lead"
 *               pagination:
 *                 page: 1
 *                 totalPages: 5
 *                 totalItems: 42
 *                 limit: 10
 *                 hasNextPage: true
 *                 hasPreviousPage: false
 *       400:
 *         description: Termo de busca muito curto (mínimo 2 caracteres)
 *       401:
 *         description: Token não fornecido ou inválido
 */
router.get("/autocomplete", ContactController.autocomplete);

/**
 * @swagger
 * /contacts/kanban/summary:
 *   get:
 *     summary: 📊 Kanban - Resumo inicial de todas as raias
 *     description: |
 *       Retorna resumo do Kanban com contagem e primeiros leads de cada raia.
 *
 *       **Otimizado para 60k+ leads:**
 *       - Retorna apenas os primeiros N leads de cada raia (padrão: 10)
 *       - Inclui contagem total de cada raia para exibir badges
 *       - Performance: ~100-200ms mesmo com 60k+ registros
 *
 *       **Uso:**
 *       - Renderização inicial do Kanban
 *       - Atualização após drag & drop
 *       - Refresh após criação/edição de lead
 *
 *       **Raias retornadas:**
 *       - novo
 *       - em_contato
 *       - qualificado
 *       - proposta_enviada
 *       - em_negociacao
 *       - fechado
 *       - perdido
 *     tags: [Contacts, Kanban]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/AcceptLanguage'
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 10
 *         description: Quantidade de leads por raia
 *       - in: query
 *         name: owner_id
 *         schema:
 *           type: integer
 *         description: Filtrar por responsável (opcional)
 *     responses:
 *       200:
 *         description: Resumo do Kanban
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
 *                 data:
 *                   type: object
 *                   properties:
 *                     novo:
 *                       type: object
 *                       properties:
 *                         count:
 *                           type: integer
 *                           example: 89
 *                         leads:
 *                           type: array
 *                           maxItems: 10
 *                           items:
 *                             $ref: '#/components/schemas/ContactKanban'
 *                     em_contato:
 *                       type: object
 *                       properties:
 *                         count:
 *                           type: integer
 *                           example: 73
 *                         leads:
 *                           type: array
 *                           maxItems: 10
 *                           items:
 *                             $ref: '#/components/schemas/ContactKanban'
 *             example:
 *               success: true
 *               message: "Resumo do Kanban carregado com sucesso"
 *               data:
 *                 novo:
 *                   count: 89
 *                   leads:
 *                     - id: 1234
 *                       nome: "João Silva"
 *                       email: "joao@example.com"
 *                       phone: "5511999999999"
 *                       status: "novo"
 *                       temperature: "quente"
 *                       score: 85
 *                       owner_id: 10
 *                       origem: "whatsapp"
 *                       deals_count: 2
 *                       created_at: "2025-11-15T10:30:00Z"
 *                 em_contato:
 *                   count: 73
 *                   leads: []
 *                 qualificado:
 *                   count: 45
 *                   leads: []
 */
router.get("/kanban/summary", ContactController.getKanbanSummary);

/**
 * @swagger
 * /contacts/kanban/status/{status}:
 *   get:
 *     summary: 📊 Kanban - Carregar mais leads de uma raia específica
 *     description: |
 *       Paginação de leads dentro de uma raia específica do Kanban.
 *
 *       **Uso:**
 *       - Botão "Carregar mais" no final de cada raia
 *       - Scroll infinito (opcional)
 *       - Busca dentro de uma raia
 *
 *       **Performance:**
 *       - Usa índice no campo `status` para query rápida
 *       - Paginação eficiente com LIMIT/OFFSET
 *       - Retorna indicador `hasMore` para controle do botão
 *     tags: [Contacts, Kanban]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/AcceptLanguage'
 *       - in: path
 *         name: status
 *         required: true
 *         schema:
 *           type: string
 *           enum:
 *             - novo
 *             - em_contato
 *             - qualificado
 *             - proposta_enviada
 *             - em_negociacao
 *             - fechado
 *             - perdido
 *         description: Status da raia do Kanban
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 10
 *         description: Quantidade de leads a carregar
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           minimum: 0
 *           default: 0
 *         description: Offset para paginação (usar nextOffset da resposta anterior)
 *       - in: query
 *         name: owner_id
 *         schema:
 *           type: integer
 *         description: Filtrar por responsável (opcional)
 *     responses:
 *       200:
 *         description: Lista de leads da raia
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
 *                   type: object
 *                   properties:
 *                     leads:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/ContactKanban'
 *                     total:
 *                       type: integer
 *                       description: Total de leads nesta raia
 *                     hasMore:
 *                       type: boolean
 *                       description: Se há mais leads para carregar
 *                     currentOffset:
 *                       type: integer
 *                     nextOffset:
 *                       type: integer
 *                       nullable: true
 *                       description: Offset para próxima página (null se não houver mais)
 *             example:
 *               success: true
 *               message: "Leads da raia carregados com sucesso"
 *               data:
 *                 leads:
 *                   - id: 1235
 *                     nome: "Maria Santos"
 *                     status: "novo"
 *                 total: 89
 *                 hasMore: true
 *                 currentOffset: 10
 *                 nextOffset: 20
 *       400:
 *         description: Status inválido ou parâmetros incorretos
 */
router.get("/kanban/status/:status", ContactController.getKanbanLaneLeads);

/**
 * @swagger
 * /contacts/{id}/kanban-position:
 *   patch:
 *     summary: 📊 Kanban - Atualizar posição do lead (drag & drop)
 *     description: |
 *       Atualiza a posição de um lead no Kanban após drag & drop.
 *
 *       **OTIMIZAÇÃO DE PERFORMANCE - Sistema de GAPS:**
 *       - Usa posições com "gaps" (1000, 2000, 3000...) em vez de sequenciais (1, 2, 3...)
 *       - Inserir entre dois = calcular média: entre 2000 e 3000 = 2500
 *       - **Evita updates em massa**: apenas 1 UPDATE por operação (O(1))
 *       - Rebalanceamento automático quando gaps ficam < 10
 *
 *       **Performance:**
 *       - 99% das operações: **1 único UPDATE** (O(1))
 *       - Sem lock de dezenas/centenas de registros
 *       - Mover 1 item em raia com 1000 leads: ~5-10ms
 *       - Rebalanceamento ocasional: ~100-200ms (apenas quando necessário)
 *
 *       **Como usar no frontend:**
 *       1. Usuário arrasta lead e solta sobre outro lead (targetContact)
 *       2. Frontend detecta: soltar "before" ou "after" do targetContact
 *       3. Envia: { status, targetContactId, position: "before"/"after" }
 *       4. Backend calcula posição automaticamente usando gaps
 *     tags: [Contacts, Kanban]
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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *               - targetContactId
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
 *                 description: Status da raia de destino
 *                 example: "em_contato"
 *               targetContactId:
 *                 type: integer
 *                 description: ID do contato onde o lead foi solto (referência)
 *                 example: 456
 *               position:
 *                 type: string
 *                 enum: [before, after]
 *                 default: after
 *                 description: Soltar antes ou depois do targetContactId
 *                 example: "after"
 *           examples:
 *             dropAfter:
 *               summary: Soltar depois de um contato
 *               value:
 *                 status: "em_contato"
 *                 targetContactId: 123
 *                 position: "after"
 *             dropBefore:
 *               summary: Soltar antes de um contato
 *               value:
 *                 status: "novo"
 *                 targetContactId: 456
 *                 position: "before"
 *     responses:
 *       200:
 *         description: Posição atualizada com sucesso
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
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     nome:
 *                       type: string
 *                     status:
 *                       type: string
 *                     kanban_position:
 *                       type: integer
 *                     updated_at:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Status ou posição inválidos
 *       404:
 *         description: Lead não encontrado
 */
router.patch("/:id/kanban-position", ContactController.updateKanbanPosition);

/**
 * @swagger
 * /contacts/search:
 *   get:
 *     summary: 🔍 Buscar contato por identificador
 *     description: |
 *       Busca rápida por phone/email/document.
 *       **Para Extensão WhatsApp**: verificar se contato já existe.
 *
 *       **IMPORTANTE:** O company_id é obtido automaticamente do token JWT.
 *       Isolamento multi-tenant automático - usuário só busca contatos da própria empresa.
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
 *     description: |
 *       Retorna estatísticas gerais (total, leads, clientes, taxa de conversão).
 *
 *       **IMPORTANTE:** O company_id é obtido automaticamente do token JWT.
 *       Estatísticas apenas da empresa do usuário autenticado.
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
 *
 *       **IMPORTANTE:** O company_id é obtido automaticamente do token JWT.
 *       Não envie company_id no body - ele será ignorado.
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
 *     description: |
 *       Retorna detalhes completos de um contato.
 *
 *       **IMPORTANTE:** O company_id é obtido automaticamente do token JWT.
 *       Isolamento multi-tenant automático.
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
 *     description: |
 *       Cria um novo contato (lead ou cliente).
 *
 *       **IMPORTANTE:** O company_id é obtido automaticamente do token JWT.
 *       Não envie company_id no body - ele será ignorado.
 *       O contato será criado automaticamente na empresa do usuário autenticado.
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
 *                 enum: [novo, em_contato, qualificado, proposta_enviada, em_negociacao, fechado, perdido, descartado]
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
 *     description: |
 *       Atualiza dados de um contato existente.
 *
 *       **IMPORTANTE:** O company_id é obtido automaticamente do token JWT.
 *       Não envie company_id no body - ele será ignorado.
 *       Isolamento multi-tenant automático.
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
 *                 enum: [novo, em_contato, qualificado, proposta_enviada, em_negociacao, fechado, perdido, descartado]
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
 *
 *       **IMPORTANTE:** O company_id é obtido automaticamente do token JWT.
 *       Isolamento multi-tenant automático.
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
 *     description: |
 *       Converte manualmente um lead para cliente (tipo='lead' → tipo='cliente').
 *
 *       **IMPORTANTE:** O company_id é obtido automaticamente do token JWT.
 *       Isolamento multi-tenant automático.
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
 *     description: |
 *       Exclusão lógica do contato (deleted_at = NOW()).
 *
 *       **IMPORTANTE:** O company_id é obtido automaticamente do token JWT.
 *       Isolamento multi-tenant automático.
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
 *     ContactKanban:
 *       type: object
 *       description: Versão simplificada do Contact para visualização em Kanban
 *       properties:
 *         id:
 *           type: integer
 *           example: 1234
 *         nome:
 *           type: string
 *           example: "João Silva"
 *         email:
 *           type: string
 *           example: "joao@example.com"
 *         phone:
 *           type: string
 *           example: "5511999999999"
 *         status:
 *           type: string
 *           enum: [novo, em_contato, qualificado, proposta_enviada, em_negociacao, fechado, perdido, descartado]
 *           example: "novo"
 *         temperature:
 *           type: string
 *           enum: [frio, morno, quente]
 *           example: "quente"
 *         score:
 *           type: integer
 *           minimum: 0
 *           maximum: 100
 *           example: 85
 *         owner_id:
 *           type: integer
 *           example: 10
 *         origem:
 *           type: string
 *           example: "whatsapp"
 *         kanban_position:
 *           type: integer
 *           description: Posição do lead na raia do Kanban (1 = topo)
 *           example: 1
 *         deals_count:
 *           type: integer
 *           description: Quantidade de negociações ativas deste lead
 *           example: 2
 *         created_at:
 *           type: string
 *           format: date-time
 *           example: "2025-11-15T10:30:00Z"
 *         updated_at:
 *           type: string
 *           format: date-time
 *           example: "2025-11-16T14:20:00Z"
 */

module.exports = router;
