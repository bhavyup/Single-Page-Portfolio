const fs = require("fs");
const path = require("path");
const { config } = require("./config");
const { contentSchema } = require("./contentSchema");

function ensureStore() {
  const dir = path.dirname(config.dataPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(config.dataPath)) {
    throw new Error(
      `Content file not found at ${config.dataPath}. Seed it before starting server.`,
    );
  }
}

function readContent() {
  ensureStore();
  const raw = fs.readFileSync(config.dataPath, "utf8");
  const parsed = JSON.parse(raw);
  const result = contentSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`Invalid content structure: ${result.error.message}`);
  }
  return result.data;
}

function writeContent(nextContent) {
  ensureStore();
  const result = contentSchema.safeParse(nextContent);
  if (!result.success) {
    const firstIssue = result.error.issues[0];
    throw new Error(
      `Validation failed at ${firstIssue.path.join(".") || "root"}: ${firstIssue.message}`,
    );
  }

  const tempPath = `${config.dataPath}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(result.data, null, 2), "utf8");
  fs.renameSync(tempPath, config.dataPath);

  return result.data;
}

module.exports = {
  readContent,
  writeContent,
};
