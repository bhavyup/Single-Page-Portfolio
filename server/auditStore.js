const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { config } = require("./config");
const { isDatabaseEnabled, insertAudit, listAudit } = require("./dbStore");

function ensureAuditFile() {
  const dir = path.dirname(config.auditPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(config.auditPath)) {
    fs.writeFileSync(config.auditPath, "[]", "utf8");
  }
}

function readAuditLogFromFile() {
  ensureAuditFile();
  const raw = fs.readFileSync(config.auditPath, "utf8");
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed) ? parsed : [];
}

async function readAuditLog() {
  if (isDatabaseEnabled()) {
    return listAudit(500);
  }

  return readAuditLogFromFile();
}

async function appendAudit(event) {
  if (isDatabaseEnabled()) {
    return insertAudit(event);
  }

  const current = readAuditLogFromFile();
  const entry = {
    id: crypto.randomUUID(),
    ts: new Date().toISOString(),
    ...event,
  };

  current.unshift(entry);
  const trimmed = current.slice(0, 500);
  fs.writeFileSync(config.auditPath, JSON.stringify(trimmed, null, 2), "utf8");

  return entry;
}

module.exports = {
  readAuditLog,
  appendAudit,
};
