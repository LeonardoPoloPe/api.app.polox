// Exporta todos os models para facilitar importação

// Core Models
const UserModel = require("./User");
const CompanyModel = require("./Company");
const UserSessionModel = require("./UserSession");

// Business Models
const LeadModel = require("./Lead");
const ClientModel = require("./Client");
const SaleModel = require("./Sale");
const SaleItemModel = require("./SaleItem");
const ProductModel = require("./Product");
const ProductCategoryModel = require("./ProductCategory");

// Sales Pipeline Models
const PipelineModel = require("./Pipeline");
const DealModel = require("./Deal");

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

  // Business Models
  LeadModel,
  ClientModel,
  SaleModel,
  SaleItemModel,
  ProductModel,
  ProductCategoryModel,

  // Sales Pipeline Models
  PipelineModel,
  DealModel,

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
