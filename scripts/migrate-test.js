const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

// AWS SDK para carregar secrets (opcional)
let SecretsManagerClient, GetSecretValueCommand;
try {
  const awsSdk = require("@aws-sdk/client-secrets-manager");
  SecretsManagerClient = awsSdk.SecretsManagerClient;
  GetSecretValueCommand = awsSdk.GetSecretValueCommand;
} catch (error) {
  // Ambiente sem AWS SDK disponível
}

// Load tests/.env.test if present
const envPath = path.join(__dirname, "..", "tests", ".env.test");
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
  console.log("✅ [migrate-test] tests/.env.test carregado");
} else {
  console.log(
    "ℹ️  [migrate-test] Sem tests/.env.test — tentaremos usar AWS Secrets Manager ou variáveis de ambiente"
  );
}

// Ensure NODE_ENV=test by default for safety
process.env.NODE_ENV = process.env.NODE_ENV || "test";

async function loadSecretsIfNeeded() {
  const hasDB =
    process.env.DB_HOST && process.env.DB_USER && process.env.DB_PASSWORD;
  if (hasDB) return;

  const region = process.env.AWS_REGION || "sa-east-1";
  const secretName = process.env.SECRET_NAME_TEST || "dev-mysql";
  if (!SecretsManagerClient) {
    console.warn(
      "⚠️  [migrate-test] AWS SDK não disponível para carregar secrets"
    );
    return;
  }
  try {
    const client = new SecretsManagerClient({ region });
    const res = await client.send(
      new GetSecretValueCommand({ SecretId: secretName })
    );
    const secretString =
      res.SecretString ||
      Buffer.from(res.SecretBinary, "base64").toString("ascii");
    const secrets = JSON.parse(secretString);

    process.env.DB_HOST =
      process.env.DB_HOST || secrets.DB_HOST || secrets.host;
    process.env.DB_PORT =
      process.env.DB_PORT || String(secrets.DB_PORT || secrets.port || "5432");
    process.env.DB_USER =
      process.env.DB_USER ||
      secrets.DB_USER ||
      secrets.username ||
      secrets.user;
    process.env.DB_PASSWORD =
      process.env.DB_PASSWORD || secrets.DB_PASSWORD || secrets.password;
    // Forçar banco de TESTE, mesmo reutilizando secret de DEV
    process.env.DB_NAME =
      process.env.DB_NAME || process.env.TEST_DB_NAME || "app_polox_test";

    console.log(
      `🔐 [migrate-test] Secrets carregados (${secretName}) na região ${region}`
    );
  } catch (err) {
    console.warn(
      `⚠️  [migrate-test] Falha ao carregar secret '${secretName}': ${err.message}`
    );
  }
}

async function main() {
  const cmd = process.argv[2] || "status";
  await loadSecretsIfNeeded();
  // Importar após carregar secrets para garantir que o runner leia as envs corretas
  const MigrationRunner = require("../migrations/migration-runner");
  const runner = new MigrationRunner();

  try {
    switch (cmd) {
      case "status":
        await runner.createMigrationsTable();
        await runner.showStatus();
        break;
      case "migrate":
      case "up":
        await runner.createMigrationsTable();
        await runner.runPendingMigrations();
        break;
      case "rollback":
      case "down":
        await runner.rollbackLastMigration();
        break;
      default:
        console.log(
          "Uso: node scripts/migrate-test.js [status|migrate|rollback]"
        );
        process.exit(1);
    }
  } finally {
    await runner.close();
  }
}

main().catch((err) => {
  console.error("❌ [migrate-test] Erro:", err.message);
  process.exit(1);
});
