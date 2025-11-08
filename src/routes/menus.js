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

const express = require("express");
const MenuItemController = require("../controllers/MenuItemController");
const { authMiddleware } = require("../middleware/auth");

const router = express.Router();

/**
 * Todas as rotas requerem autenticação
 */
router.use(authMiddleware);

/**
 * @swagger
 * /menu-items:
 *   get:
 *     summary: Lista itens de menu
 *     description: Lista todos os itens de menu do sistema com filtros opcionais
 *     tags: [Menu Items]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/AcceptLanguage'
 *       - in: query
 *         name: is_active
 *         schema:
 *           type: boolean
 *         description: Filtrar por status ativo/inativo
 *       - in: query
 *         name: parent_id
 *         schema:
 *           type: integer
 *         description: Filtrar por menu pai
 *       - in: query
 *         name: visible_to_all
 *         schema:
 *           type: boolean
 *         description: Filtrar menus visíveis para todos
 *     responses:
 *       200:
 *         description: Lista de menus retornada com sucesso
 *       401:
 *         description: Não autorizado
 */
router.get("/", MenuItemController.list);

/**
 * @swagger
 * /menu-items/hierarchy:
 *   get:
 *     summary: Busca hierarquia de menus
 *     description: Retorna menus em estrutura hierárquica com submenus aninhados
 *     tags: [Menu Items]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/AcceptLanguage'
 *     responses:
 *       200:
 *         description: Hierarquia de menus retornada com sucesso
 *       401:
 *         description: Não autorizado
 */
router.get("/hierarchy", MenuItemController.getHierarchy);

/**
 * @swagger
 * /menu-items/for-company:
 *   get:
 *     summary: Busca menus disponíveis para empresa
 *     description: Retorna menus que a empresa do usuário tem permissão para acessar
 *     tags: [Menu Items]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/AcceptLanguage'
 *     responses:
 *       200:
 *         description: Menus da empresa retornados com sucesso
 *       401:
 *         description: Não autorizado
 */
router.get("/for-company", MenuItemController.getForCompany);

/**
 * @swagger
 * /menu-items/reorder:
 *   post:
 *     summary: Reordena múltiplos menus
 *     description: Atualiza a ordem de exibição de múltiplos menus (apenas super_admin)
 *     tags: [Menu Items]
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
 *               - menus
 *             properties:
 *               menus:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     order_position:
 *                       type: integer
 *               parent_id:
 *                 type: integer
 *                 nullable: true
 *     responses:
 *       200:
 *         description: Menus reordenados com sucesso
 *       403:
 *         description: Apenas super_admin pode reordenar menus
 */
router.post("/reorder", MenuItemController.reorder);

/**
 * @swagger
 * /menu-items/batch-reorder:
 *   post:
 *     summary: Reordena múltiplos grupos de menus em lote (RECOMENDADO)
 *     description: |
 *       Reordena múltiplos grupos de menus em uma transação atômica.
 *
 *       **Vantagens sobre /reorder:**
 *       - ✅ Execução atômica (tudo ou nada)
 *       - ✅ Evita conflitos de constraint unique
 *       - ✅ Permite reordenar múltiplos níveis hierárquicos de uma vez
 *       - ✅ Mais performático para grandes volumes
 *
 *       **Apenas super_admin**
 *     tags: [Menu Items]
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
 *               - updates
 *             properties:
 *               updates:
 *                 type: array
 *                 description: Array de grupos de menus a reordenar
 *                 minItems: 1
 *                 items:
 *                   type: object
 *                   required:
 *                     - menus
 *                   properties:
 *                     parent_id:
 *                       type: integer
 *                       nullable: true
 *                       description: ID do menu pai (null para menus raiz)
 *                     menus:
 *                       type: array
 *                       description: Lista de menus com suas novas posições
 *                       minItems: 1
 *                       items:
 *                         type: object
 *                         required:
 *                           - id
 *                           - order_position
 *                         properties:
 *                           id:
 *                             type: integer
 *                             description: ID do menu
 *                           order_position:
 *                             type: integer
 *                             minimum: 0
 *                             description: Nova posição do menu
 *           examples:
 *             menus_raiz_e_submenus:
 *               summary: Reordenar menus raiz e submenus
 *               value:
 *                 updates:
 *                   - parent_id: null
 *                     menus:
 *                       - id: 1
 *                         order_position: 1
 *                       - id: 2
 *                         order_position: 2
 *                       - id: 3
 *                         order_position: 3
 *                   - parent_id: 2
 *                     menus:
 *                       - id: 5
 *                         order_position: 1
 *                       - id: 6
 *                         order_position: 2
 *             apenas_menus_raiz:
 *               summary: Reordenar apenas menus raiz
 *               value:
 *                 updates:
 *                   - parent_id: null
 *                     menus:
 *                       - id: 1
 *                         order_position: 3
 *                       - id: 2
 *                         order_position: 1
 *                       - id: 3
 *                         order_position: 2
 *     responses:
 *       200:
 *         description: Menus reordenados com sucesso
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
 *                   description: Menus atualizados agrupados por parent_id
 *                   additionalProperties:
 *                     type: array
 *                     items:
 *                       type: object
 *       400:
 *         description: Dados inválidos
 *       403:
 *         description: Apenas super_admin pode reordenar menus
 *       404:
 *         description: Um ou mais menus não encontrados
 */
router.post("/batch-reorder", MenuItemController.batchReorder);

/**
 * @swagger
 * /menu-items/{id}:
 *   get:
 *     summary: Busca menu por ID
 *     description: Retorna detalhes completos de um menu específico
 *     tags: [Menu Items]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/AcceptLanguage'
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID do menu
 *     responses:
 *       200:
 *         description: Menu encontrado com sucesso
 *       404:
 *         description: Menu não encontrado
 */
router.get("/:id", MenuItemController.getById);

/**
 * @swagger
 * /menu-items:
 *   post:
 *     summary: Cria novo menu
 *     description: Cria um novo item de menu no sistema (apenas super_admin)
 *     tags: [Menu Items]
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
 *               - label
 *               - translations
 *               - icon
 *               - route
 *               - order_position
 *             properties:
 *               label:
 *                 type: string
 *                 example: "Meu Novo Menu"
 *               translations:
 *                 type: object
 *                 required: ["pt-BR", "en-US", "es-ES"]
 *                 properties:
 *                   pt-BR:
 *                     type: string
 *                     example: "Meu Novo Menu"
 *                   en-US:
 *                     type: string
 *                     example: "My New Menu"
 *                   es-ES:
 *                     type: string
 *                     example: "Mi Nuevo Menú"
 *               icon:
 *                 type: string
 *                 example: "Menu"
 *               route:
 *                 type: string
 *                 example: "/meu-novo-menu"
 *               parent_id:
 *                 type: integer
 *                 nullable: true
 *                 example: null
 *                 description: "ID do menu pai (usar null para menu principal, ou ID existente para submenu)"
 *               order_position:
 *                 type: integer
 *                 example: 100
 *                 description: "Posição de ordenação (usar número alto para evitar conflitos)"
 *               visible_to_all:
 *                 type: boolean
 *                 default: true
 *                 example: true
 *               is_active:
 *                 type: boolean
 *                 default: true
 *                 example: true
 *               svg_color:
 *                 type: string
 *                 pattern: '^#[0-9A-F]{6}$'
 *                 nullable: true
 *                 example: "#3B82F6"
 *                 description: "Cor do ícone SVG em formato hexadecimal (#RRGGBB)"
 *               background_color:
 *                 type: string
 *                 pattern: '^#[0-9A-F]{6}$'
 *                 nullable: true
 *                 example: "#EFF6FF"
 *                 description: "Cor de fundo no hover em formato hexadecimal (#RRGGBB)"
 *               text_color:
 *                 type: string
 *                 pattern: '^#[0-9A-F]{6}$'
 *                 nullable: true
 *                 example: "#1E40AF"
 *                 description: "Cor do texto em formato hexadecimal (#RRGGBB)"
 *           examples:
 *             menu_principal:
 *               summary: Menu Principal
 *               value:
 *                 label: "Analytics"
 *                 translations:
 *                   pt-BR: "Analytics"
 *                   en-US: "Analytics"
 *                   es-ES: "Analytics"
 *                 icon: "BarChart"
 *                 route: "/analytics"
 *                 parent_id: null
 *                 order_position: 100
 *                 visible_to_all: true
 *                 is_active: true
 *                 svg_color: "#10B981"
 *                 background_color: "#D1FAE5"
 *                 text_color: "#065F46"
 *             submenu:
 *               summary: Submenu (filho do menu Configurações - ID 1)
 *               value:
 *                 label: "API Keys"
 *                 translations:
 *                   pt-BR: "Chaves de API"
 *                   en-US: "API Keys"
 *                   es-ES: "Claves de API"
 *                 icon: "Key"
 *                 route: "/settings/api-keys"
 *                 parent_id: 1
 *                 order_position: 50
 *                 visible_to_all: false
 *                 is_active: true
 *                 svg_color: "#F59E0B"
 *                 background_color: "#FEF3C7"
 *                 text_color: "#92400E"
 *     responses:
 *       201:
 *         description: Menu criado com sucesso
 *       403:
 *         description: Apenas super_admin pode criar menus
 *       409:
 *         description: Conflito - rota ou ordem já existe
 */
router.post("/", MenuItemController.create);

/**
 * @swagger
 * /menu-items/{id}:
 *   put:
 *     summary: Atualiza menu
 *     description: |
 *       Atualiza um menu existente (apenas super_admin).
 *
 *       **Dica:** Você pode atualizar apenas os campos necessários. Não precisa enviar todos os campos.
 *
 *       **Casos de uso comuns:**
 *       - Alterar tradução de um menu
 *       - Mudar ícone
 *       - Reorganizar posição (order_position)
 *       - Alterar visibilidade (visible_to_all)
 *       - Mover menu para outro parent (parent_id)
 *     tags: [Menu Items]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/AcceptLanguage'
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID do menu
 *         example: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               label:
 *                 type: string
 *                 description: Nome do menu
 *                 example: "Configurações do Sistema"
 *               translations:
 *                 type: object
 *                 description: Traduções do menu em múltiplos idiomas
 *                 properties:
 *                   pt-BR:
 *                     type: string
 *                     example: "Configurações do Sistema"
 *                   en-US:
 *                     type: string
 *                     example: "System Settings"
 *                   es-ES:
 *                     type: string
 *                     example: "Configuración del Sistema"
 *               icon:
 *                 type: string
 *                 description: Nome do ícone (ex. Material Icons, FontAwesome)
 *                 example: "settings-outline"
 *               route:
 *                 type: string
 *                 nullable: true
 *                 description: Rota do menu (null para menus pai sem rota própria)
 *                 example: "/settings"
 *               parent_id:
 *                 type: integer
 *                 nullable: true
 *                 description: ID do menu pai (null = menu raiz)
 *                 example: null
 *               order_position:
 *                 type: integer
 *                 description: Ordem de exibição do menu
 *                 example: 1
 *               visible_to_all:
 *                 type: boolean
 *                 description: Menu visível para todas as empresas
 *                 example: true
 *               is_active:
 *                 type: boolean
 *                 description: Menu ativo/visível no sistema
 *                 example: true
 *               svg_color:
 *                 type: string
 *                 pattern: '^#[0-9A-F]{6}$'
 *                 nullable: true
 *                 description: "Cor do ícone SVG em formato hexadecimal (#RRGGBB)"
 *                 example: "#3B82F6"
 *               background_color:
 *                 type: string
 *                 pattern: '^#[0-9A-F]{6}$'
 *                 nullable: true
 *                 description: "Cor de fundo no hover em formato hexadecimal (#RRGGBB)"
 *                 example: "#EFF6FF"
 *               text_color:
 *                 type: string
 *                 pattern: '^#[0-9A-F]{6}$'
 *                 nullable: true
 *                 description: "Cor do texto em formato hexadecimal (#RRGGBB)"
 *                 example: "#1E40AF"
 *           examples:
 *             atualizar_traducoes:
 *               summary: Atualizar apenas traduções
 *               description: Exemplo atualizando apenas as traduções de um menu existente
 *               value:
 *                 translations:
 *                   pt-BR: "Configurações Avançadas"
 *                   en-US: "Advanced Settings"
 *                   es-ES: "Configuración Avanzada"
 *             atualizar_icone:
 *               summary: Atualizar ícone
 *               description: Trocar o ícone de um menu
 *               value:
 *                 icon: "settings-outline"
 *             reordenar_menu:
 *               summary: Reorganizar posição
 *               description: Mudar a ordem de exibição do menu
 *               value:
 *                 order_position: 5
 *             tornar_privado:
 *               summary: Tornar menu privado
 *               description: Restringir menu a empresas específicas
 *               value:
 *                 visible_to_all: false
 *             mover_para_submenu:
 *               summary: Transformar em submenu
 *               description: Mover menu para dentro de outro (tornar filho de ID 1)
 *               value:
 *                 parent_id: 1
 *                 order_position: 10
 *             atualizacao_completa:
 *               summary: Atualização completa
 *               description: Exemplo atualizando todos os campos do menu ID 1
 *               value:
 *                 label: "Configurações"
 *                 translations:
 *                   pt-BR: "Configurações"
 *                   en-US: "Settings"
 *                   es-ES: "Configuraciones"
 *                 icon: "settings"
 *                 route: "/settings"
 *                 parent_id: null
 *                 order_position: 1
 *                 visible_to_all: true
 *                 is_active: true
 *                 svg_color: "#8B5CF6"
 *                 background_color: "#EDE9FE"
 *                 text_color: "#5B21B6"
 *             atualizar_cores:
 *               summary: Atualizar cores do menu
 *               description: Personalizar cores de ícone, fundo e texto
 *               value:
 *                 svg_color: "#EF4444"
 *                 background_color: "#FEE2E2"
 *                 text_color: "#991B1B"
 *     responses:
 *       200:
 *         description: Menu atualizado com sucesso
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
 *                   example: "Menu atualizado com sucesso"
 *                 data:
 *                   $ref: '#/components/schemas/MenuItem'
 *       404:
 *         description: Menu não encontrado
 *       403:
 *         description: Apenas super_admin pode atualizar menus
 *       409:
 *         description: Conflito - rota ou ordem já existe para outro menu
 *   delete:
 *     summary: Deleta menu
 *     description: Deleta um menu (soft delete) - apenas super_admin
 *     tags: [Menu Items]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/AcceptLanguage'
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID do menu
 *     responses:
 *       200:
 *         description: Menu deletado com sucesso
 *       404:
 *         description: Menu não encontrado
 *       403:
 *         description: Apenas super_admin pode deletar menus
 */
router.put("/:id", MenuItemController.update);
router.delete("/:id", MenuItemController.delete);

/**
 * @swagger
 * /menu-items/{id}/toggle-status:
 *   patch:
 *     summary: Ativa/desativa menu
 *     description: Alterna o status ativo/inativo de um menu (apenas super_admin)
 *     tags: [Menu Items]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - $ref: '#/components/parameters/AcceptLanguage'
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID do menu
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               force:
 *                 type: boolean
 *                 description: Force para ignorar avisos sobre perfis dependentes
 *     responses:
 *       200:
 *         description: Status do menu alterado com sucesso
 *       404:
 *         description: Menu não encontrado
 *       403:
 *         description: Apenas super_admin pode alterar status de menus
 */
router.patch("/:id/toggle-status", MenuItemController.toggleStatus);

module.exports = router;
