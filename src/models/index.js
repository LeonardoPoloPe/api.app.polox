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

// Exporta todos os models para facilitar importação

// Core Models
const UserModel = require("./User");
const CompanyModel = require("./Company");
const UserSessionModel = require("./UserSession");

// Business Models - Nova Arquitetura: Identidade vs. Intenção
const ContactModel = require("./Contact"); // ✨ NOVO: Identidade Unificada (substitui Lead + Client)
const ContactNoteModel = require("./ContactNote"); // ✨ NOVO: Histórico Unificado
const DealModel = require("./Deal"); // ✨ NOVO: Pipeline de Vendas
const SaleModel = require("./Sale");
const SaleItemModel = require("./SaleItem");
const ProductModel = require("./Product");
const ProductCategoryModel = require("./ProductCategory");

// Sales Pipeline Models
const PipelineModel = require("./Pipeline");

// Financial Models
const FinancialAccountModel = require("./FinancialAccount");
const FinancialTransactionModel = require("./FinancialTransaction");

// Gamification Models
const UserGamificationProfileModel = require("./UserGamificationProfile");
const AchievementModel = require("./Achievement");
const RewardModel = require("./Reward");
const MissionModel = require("./Mission");

// CRM Support Models
const TicketModel = require("./Ticket");
const TicketCommentModel = require("./TicketComment");
const EventModel = require("./Event");
const SupplierModel = require("./Supplier");

// Project Management Models
const ProjectModel = require("./Project");

// Communication Models
const NotificationModel = require("./Notification");
const NotificationTemplateModel = require("./NotificationTemplate");

// Auxiliary Models
const TagModel = require("./Tag");
const FileUploadModel = require("./FileUpload");
const AuditLogModel = require("./AuditLog");

// Database utilities
const {
  initializePool,
  query,
  transaction,
  getPool,
  closePool,
  healthCheck,
  logger,
} = require("./database");

module.exports = {
  // Core Models
  UserModel,
  CompanyModel,
  UserSessionModel,

  // Business Models - Nova Arquitetura
  ContactModel, // ✨ Identidade Unificada (substitui LeadModel + ClientModel)
  ContactNoteModel, // ✨ Histórico Unificado
  DealModel, // ✨ Pipeline de Vendas
  SaleModel,
  SaleItemModel,
  ProductModel,
  ProductCategoryModel,

  // Sales Pipeline Models
  PipelineModel,

  // Financial Models
  FinancialAccountModel,
  FinancialTransactionModel,

  // Gamification Models
  UserGamificationProfileModel,
  AchievementModel,
  RewardModel,
  MissionModel,

  // CRM Support Models
  TicketModel,
  TicketCommentModel,
  EventModel,
  SupplierModel,

  // Project Management Models
  ProjectModel,

  // Communication Models
  NotificationModel,
  NotificationTemplateModel,

  // Auxiliary Models
  TagModel,
  FileUploadModel,
  AuditLogModel,

  // Database utilities
  initializePool,
  query,
  transaction,
  getPool,
  closePool,
  healthCheck,
  logger,
};
