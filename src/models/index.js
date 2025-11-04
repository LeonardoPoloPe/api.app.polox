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
