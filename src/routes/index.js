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
 * 🚀 ROUTER PRINCIPAL - CENTRALIZADOR DE ROTAS
 * ==========================================
 */

const express = require("express");

// Importar todas as rotas de serviço
const authRoutes = require("./auth");
const userRoutes = require("./users");
const companyRoutes = require("./companies");
const contactRoutes = require("./contacts"); // ✨ Identidade Unificada (substitui leads + clients)
const dealRoutes = require("./deals"); // ✨ Pipeline de Vendas
const contactNoteRoutes = require("./contact-notes"); // ✨ Histórico Unificado
const saleRoutes = require("./sales");
const productRoutes = require("./products");
const financeRoutes = require("./finance");
const ticketRoutes = require("./tickets");
const supplierRoutes = require("./suppliers");
const scheduleRoutes = require("./schedule");
const notificationRoutes = require("./notifications");
const gamificationRoutes = require("./gamification");
const analyticsRoutes = require("./analytics");

const router = express.Router();

// ==========================================
// MONTAR ROTAS COM SEUS PREFIXOS ESPECÍFICOS
// ==========================================

// 🔐 Autenticação
router.use("/auth", authRoutes);

// 👥 Usuários
router.use("/users", userRoutes);

// 🏢 Empresas
router.use("/companies", companyRoutes);

// ==========================================
// ✨ NOVA ARQUITETURA: IDENTIDADE VS. INTENÇÃO
// ==========================================

// 👥 Contatos (Identidade Unificada: Leads + Clientes)
router.use("/contacts", contactRoutes);

// 💼 Negociações (Intenção: Pipeline de Vendas)
router.use("/deals", dealRoutes);

// 📝 Anotações (Histórico: Timeline de Interações)
router.use("/notes", contactNoteRoutes);

// 💰 Vendas
router.use("/sales", saleRoutes);

// 📦 Produtos
router.use("/products", productRoutes);

// 💳 Financeiro
router.use("/finance", financeRoutes);

// 🎫 Tickets/Suporte
router.use("/tickets", ticketRoutes);

// 🏭 Fornecedores
router.use("/suppliers", supplierRoutes);

// 📅 Agendamentos
router.use("/schedule", scheduleRoutes);

// 🔔 Notificações
router.use("/notifications", notificationRoutes);

// 🎮 Gamificação
router.use("/gamification", gamificationRoutes);

// 📊 Analytics
router.use("/analytics", analyticsRoutes);

module.exports = router;
