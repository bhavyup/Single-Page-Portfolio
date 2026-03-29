const fs = require("fs");
const os = require("os");
const path = require("path");

const fixturePath = path.join(__dirname, "..", "server", "data", "content.json");
const validFixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));

function withMockedConfig(customConfig, loadModule) {
  jest.resetModules();
  jest.doMock("../server/config", () => ({
    config: customConfig,
  }));

  const loaded = loadModule();

  jest.dontMock("../server/config");
  return loaded;
}

describe("contentStore", () => {
  test("throws when content file is missing", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "portfolio-content-missing-"));
    const dataPath = path.join(tempDir, "nested", "content.json");

    const contentStore = withMockedConfig(
      {
        dataPath,
        auditPath: path.join(tempDir, "audit-log.json"),
      },
      () => require("../server/contentStore"),
    );

    expect(() => contentStore.readContent()).toThrow("Content file not found");
  });

  test("reads and writes valid content safely", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "portfolio-content-valid-"));
    const dataPath = path.join(tempDir, "store", "content.json");
    fs.mkdirSync(path.dirname(dataPath), { recursive: true });
    fs.writeFileSync(dataPath, JSON.stringify(validFixture, null, 2), "utf8");

    const contentStore = withMockedConfig(
      {
        dataPath,
        auditPath: path.join(tempDir, "audit-log.json"),
      },
      () => require("../server/contentStore"),
    );

    const readValue = contentStore.readContent();
    expect(readValue).toHaveProperty("skills");

    const nextContent = {
      ...readValue,
      hero: {
        ...readValue.hero,
        testMarker: "coverage",
      },
    };

    const written = contentStore.writeContent(nextContent);
    expect(written.hero.testMarker).toBe("coverage");
    expect(fs.existsSync(`${dataPath}.tmp`)).toBe(false);
  });

  test("rejects invalid shapes in read and write paths", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "portfolio-content-invalid-"));
    const dataPath = path.join(tempDir, "content.json");
    fs.writeFileSync(dataPath, JSON.stringify({ nav: {} }, null, 2), "utf8");

    const contentStore = withMockedConfig(
      {
        dataPath,
        auditPath: path.join(tempDir, "audit-log.json"),
      },
      () => require("../server/contentStore"),
    );

    expect(() => contentStore.readContent()).toThrow("Invalid content structure");
    expect(() => contentStore.writeContent({ nav: {} })).toThrow("Validation failed at");
  });
});

describe("auditStore", () => {
  test("creates file on first read and appends entries", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "portfolio-audit-init-"));
    const auditPath = path.join(tempDir, "logs", "audit-log.json");

    const auditStore = withMockedConfig(
      {
        dataPath: path.join(tempDir, "content.json"),
        auditPath,
      },
      () => require("../server/auditStore"),
    );

    const initial = auditStore.readAuditLog();
    expect(initial).toEqual([]);
    expect(fs.existsSync(auditPath)).toBe(true);

    const entry = auditStore.appendAudit({
      actor: "admin",
      action: "coverage.test",
      ip: "127.0.0.1",
      userAgent: "jest",
    });

    expect(entry).toHaveProperty("id");
    expect(entry.action).toBe("coverage.test");

    const latest = auditStore.readAuditLog();
    expect(latest.length).toBe(1);
    expect(latest[0].action).toBe("coverage.test");
  });

  test("trims the audit log to 500 entries", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "portfolio-audit-trim-"));
    const auditPath = path.join(tempDir, "audit-log.json");

    const auditStore = withMockedConfig(
      {
        dataPath: path.join(tempDir, "content.json"),
        auditPath,
      },
      () => require("../server/auditStore"),
    );

    for (let i = 0; i < 510; i += 1) {
      auditStore.appendAudit({
        actor: "admin",
        action: `event-${i}`,
        ip: "127.0.0.1",
        userAgent: "jest",
      });
    }

    const log = auditStore.readAuditLog();
    expect(log.length).toBe(500);
    expect(log[0].action).toBe("event-509");
    expect(log[499].action).toBe("event-10");
  });
});