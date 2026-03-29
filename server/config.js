const path = require("path");
const dotenv = require("dotenv");

dotenv.config();

const ROOT_DIR = path.resolve(__dirname, "..");
const DATA_PATH = path.join(__dirname, "data", "content.json");
const AUDIT_PATH = path.join(__dirname, "data", "audit-log.json");

const config = {
  env: process.env.NODE_ENV || "development",
  isProduction: (process.env.NODE_ENV || "development") === "production",
  port: Number(process.env.PORT || 3000),
  rootDir: ROOT_DIR,
  dataPath: DATA_PATH,
  auditPath: AUDIT_PATH,
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
