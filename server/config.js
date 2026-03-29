const path = require("path");
const dotenv = require("dotenv");

dotenv.config();

const ROOT_DIR = path.resolve(__dirname, "..");
const DATA_PATH = process.env.CONTENT_FILE_PATH || path.join(__dirname, "data", "content.json");
const AUDIT_PATH = process.env.AUDIT_FILE_PATH || path.join(__dirname, "data", "audit-log.json");
const ASSET_UPLOAD_DIR = process.env.ASSET_UPLOAD_DIR || path.join(ROOT_DIR, "assets", "uploads");
const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN || "";
const BLOB_PREFIX = process.env.BLOB_ASSET_PREFIX || "portfolio-assets/";
const ENV = process.env.NODE_ENV || "development";
const IS_PRODUCTION = ENV === "production";
const STORAGE_DRIVER =
  process.env.STORAGE_DRIVER || (process.env.MONGODB_URI || process.env.DATABASE_URL ? "database" : "file");

const config = {
  env: ENV,
  isProduction: IS_PRODUCTION,
  port: Number(process.env.PORT || 3000),
  rootDir: ROOT_DIR,
  dataPath: DATA_PATH,
  auditPath: AUDIT_PATH,
  assetUploadDir: ASSET_UPLOAD_DIR,
  assets: {
    useBlob: Boolean(BLOB_TOKEN),
    blobToken: BLOB_TOKEN,
    blobPrefix: BLOB_PREFIX,
  },
  storage: {
    driver: STORAGE_DRIVER,
    useDatabase: STORAGE_DRIVER === "database",
    mongoUri: process.env.MONGODB_URI || process.env.DATABASE_URL || "",
    mongoDbName: process.env.MONGODB_DB_NAME || "portfolio",
  },
  admin: {
    username: process.env.ADMIN_USERNAME || "admin",
    passwordHash: process.env.ADMIN_PASSWORD_HASH || "",
  },
  auth: {
    jwtSecret: process.env.JWT_SECRET || "",
    csrfSecret: process.env.CSRF_SECRET || "",
    sessionTtl: "8h",
    cookieName: "admin_session",
  },
};

function assertConfig() {
  const missing = [];
  if (!config.admin.passwordHash) missing.push("ADMIN_PASSWORD_HASH");
  if (!config.auth.jwtSecret) missing.push("JWT_SECRET");
  if (!config.auth.csrfSecret) missing.push("CSRF_SECRET");
  if (config.storage.useDatabase && !config.storage.mongoUri) {
    missing.push("MONGODB_URI");
  }

  if (missing.length) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}. See .env.example.`,
    );
  }
}

module.exports = {
  config,
  assertConfig,
};
