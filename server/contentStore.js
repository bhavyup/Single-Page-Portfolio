const fs = require("fs");
const path = require("path");
const { config } = require("./config");
const { contentSchema } = require("./contentSchema");
const {
  isDatabaseEnabled,
  getStoredContent,
  saveContent,
} = require("./dbStore");

function ensureStore() {
  const dir = path.dirname(config.dataPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(config.dataPath)) {
    throw new Error(
      `Content file not found at ${config.dataPath}. Seed it before starting server.`,
    );
  }
}

function readContentFromFile() {
  ensureStore();
  const raw = fs.readFileSync(config.dataPath, "utf8");
  return JSON.parse(raw);
}

function validateContent(payload) {
  const result = contentSchema.safeParse(payload);
  if (!result.success) {
    throw new Error(`Invalid content structure: ${result.error.message}`);
  }

  return result.data;
}

async function readContent() {
  if (isDatabaseEnabled()) {
    const stored = await getStoredContent();
    if (stored) {
      return validateContent(stored);
    }

    const seeded = validateContent(readContentFromFile());
    await saveContent(seeded);
    return seeded;
  }

  return validateContent(readContentFromFile());
}

async function writeContent(nextContent) {
  const validated = contentSchema.safeParse(nextContent);
  if (!validated.success) {
    const firstIssue = validated.error.issues[0];
    throw new Error(
      `Validation failed at ${firstIssue.path.join(".") || "root"}: ${firstIssue.message}`,
    );
  }

  if (isDatabaseEnabled()) {
    await saveContent(validated.data);
    return validated.data;
  }

  ensureStore();
  const tempPath = `${config.dataPath}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(validated.data, null, 2), "utf8");
  fs.renameSync(tempPath, config.dataPath);

  return validated.data;
}

module.exports = {
  readContent,
  writeContent,
};
