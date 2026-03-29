const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { config } = require("./config");

function ensureAuditFile() {
  const dir = path.dirname(config.auditPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(config.auditPath)) {
    fs.writeFileSync(config.auditPath, "[]", "utf8");
  }
}

function readAuditLog() {
  ensureAuditFile();
  const raw = fs.readFileSync(config.auditPath, "utf8");
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed) ? parsed : [];
}

function appendAudit(event) {
  const current = readAuditLog();
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
