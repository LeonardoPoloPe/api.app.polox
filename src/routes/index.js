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
const leadRoutes = require("./leads");
const clientRoutes = require("./clients");
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

// 🎯 Leads
router.use("/leads", leadRoutes);

// 👤 Clientes
router.use("/clients", clientRoutes);

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
