const bcrypt = require("bcryptjs");

const originalEnv = {
  ADMIN_PASSWORD_HASH: process.env.ADMIN_PASSWORD_HASH,
  JWT_SECRET: process.env.JWT_SECRET,
  CSRF_SECRET: process.env.CSRF_SECRET,
  STORAGE_DRIVER: process.env.STORAGE_DRIVER,
  MONGODB_URI: process.env.MONGODB_URI,
};

function restoreEnvVar(key, value) {
  if (typeof value === "undefined") {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
}

describe("config.assertConfig", () => {
  afterEach(() => {
    restoreEnvVar("ADMIN_PASSWORD_HASH", originalEnv.ADMIN_PASSWORD_HASH);
    restoreEnvVar("JWT_SECRET", originalEnv.JWT_SECRET);
    restoreEnvVar("CSRF_SECRET", originalEnv.CSRF_SECRET);
    restoreEnvVar("STORAGE_DRIVER", originalEnv.STORAGE_DRIVER);
    restoreEnvVar("MONGODB_URI", originalEnv.MONGODB_URI);
    jest.resetModules();
  });

  test("throws when required auth environment variables are missing", () => {
    process.env.STORAGE_DRIVER = "file";
    process.env.ADMIN_PASSWORD_HASH = "";
    process.env.JWT_SECRET = "";
    process.env.CSRF_SECRET = "";

    jest.resetModules();
    const { assertConfig } = require("../server/config");

    expect(() => assertConfig()).toThrow("Missing required environment variables");
  });

  test("passes when required variables are present", () => {
    process.env.STORAGE_DRIVER = "file";
    process.env.ADMIN_PASSWORD_HASH = bcrypt.hashSync("Present#123", 8);
    process.env.JWT_SECRET = "jwt-secret-config-tests";
    process.env.CSRF_SECRET = "csrf-secret-config-tests";

    jest.resetModules();
    const { assertConfig } = require("../server/config");

    expect(() => assertConfig()).not.toThrow();
  });
});