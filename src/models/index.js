// Exporta todos os models para facilitar importação
const UserModel = require("./User");
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
  // Models
  UserModel,

  // Database utilities
  initializePool,
  query,
  transaction,
  getPool,
  closePool,
  healthCheck,
  logger,
};
