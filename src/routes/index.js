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
