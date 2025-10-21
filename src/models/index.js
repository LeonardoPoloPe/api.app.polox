// Exporta todos os models para facilitar importação

// Core Models
const UserModel = require("./User");
const CompanyModel = require("./Company");

// Business Models
const LeadModel = require("./Lead");
const ClientModel = require("./Client");
const SaleModel = require("./Sale");
const ProductModel = require("./Product");

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
const EventModel = require("./Event");
const SupplierModel = require("./Supplier");

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

  // Business Models
  LeadModel,
  ClientModel,
  SaleModel,
  ProductModel,

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
  EventModel,
  SupplierModel,

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
