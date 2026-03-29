const fs = require("fs");
const path = require("path");
const os = require("os");
const bcrypt = require("bcryptjs");
const request = require("supertest");

const fixturePath = path.join(__dirname, "..", "server", "data", "content.json");
const baseFixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));

describe("App admin and auth flow", () => {
  let app;
  let agent;
  let state;
  let uploadDir;

  beforeAll(() => {
    uploadDir = fs.mkdtempSync(path.join(os.tmpdir(), "portfolio-assets-"));

    process.env.NODE_ENV = "test";
    process.env.PORT = "0";
    process.env.STORAGE_DRIVER = "file";
    process.env.ASSET_UPLOAD_DIR = uploadDir;
    process.env.ADMIN_USERNAME = "admin";
    process.env.ADMIN_PASSWORD_HASH = bcrypt.hashSync("AdminPass#123", 8);
    process.env.JWT_SECRET = "jwt-secret-admin-flow-tests";
    process.env.CSRF_SECRET = "csrf-secret-admin-flow-tests";

    state = {
      content: JSON.parse(JSON.stringify(baseFixture)),
      audit: [],
      failRead: false,
      failWrite: false,
    };

    jest.resetModules();

    jest.doMock("../server/contentStore", () => ({
      readContent: () => {
        if (state.failRead) throw new Error("Read failure");
        return state.content;
      },
      writeContent: (nextContent) => {
        if (state.failWrite) throw new Error("Write failure");
        state.content = nextContent;
        return state.content;
      },
    }));

    jest.doMock("../server/auditStore", () => ({
      appendAudit: (event) => {
        const entry = {
          id: `audit-${state.audit.length + 1}`,
          ts: new Date().toISOString(),
          ...event,
        };
        state.audit.unshift(entry);
        return entry;
      },
      readAuditLog: () => state.audit,
    }));

    ({ app } = require("../server/app"));
    agent = request.agent(app);
  });

  afterAll(() => {
    if (uploadDir) {
      fs.rmSync(uploadDir, { recursive: true, force: true });
    }

    jest.dontMock("../server/contentStore");
    jest.dontMock("../server/auditStore");
    jest.resetModules();
  });

  test("serves root/admin assets and blocks sensitive paths", async () => {
    const rootRes = await request(app).get("/");
    expect(rootRes.statusCode).toBe(200);
    expect(rootRes.text).toContain("<!DOCTYPE html>");

    const adminRes = await request(app).get("/admin/index.html");
    expect(adminRes.statusCode).toBe(200);
    expect(adminRes.headers["cache-control"]).toContain("no-store");

    const faviconRes = await request(app).get("/favicon.ico");
    expect(faviconRes.statusCode).toBe(200);

    const blockedPackage = await request(app).get("/package.json");
    expect(blockedPackage.statusCode).toBe(404);

    const blockedGit = await request(app).get("/.git/config");
    expect(blockedGit.statusCode).toBe(404);

    const blockedServer = await request(app).get("/server/app.js");
    expect(blockedServer.statusCode).toBe(404);
  });

  test("returns content and handles read failures on public route", async () => {
    const okRes = await request(app).get("/api/content");
    expect(okRes.statusCode).toBe(200);
    expect(okRes.body.data).toHaveProperty("skills");

    state.failRead = true;
    const failRes = await request(app).get("/api/content");
    expect(failRes.statusCode).toBe(500);
    expect(failRes.body.error).toBe("Read failure");
    state.failRead = false;
  });

  test("returns json error through global error middleware on malformed JSON", async () => {
    const res = await request(app)
      .post("/admin/auth/login")
      .set("Content-Type", "application/json")
      .send('{"username": "admin"');

    expect(res.statusCode).toBe(500);
    expect(res.body).toHaveProperty("error");
  });

  test("enforces admin auth and csrf across content endpoints", async () => {
    let res = await request(app).get("/admin/api/content");
    expect(res.statusCode).toBe(401);
    expect(res.body.error).toBe("Unauthorized");

    res = await request(app)
      .get("/admin/api/content")
      .set("Cookie", ["admin_session=invalid-token"]);
    expect(res.statusCode).toBe(401);
    expect(res.body.error).toBe("Invalid session");

    res = await agent.post("/admin/auth/login").send({ username: "admin" });
    expect(res.statusCode).toBe(400);

    res = await agent
      .post("/admin/auth/login")
      .send({ username: "admin", password: "Wrong#123" });
    expect(res.statusCode).toBe(401);

    const csrfRes = await agent.get("/admin/auth/csrf");
    expect(csrfRes.statusCode).toBe(200);
    expect(typeof csrfRes.body.csrfToken).toBe("string");

    const csrfToken = csrfRes.body.csrfToken;

    res = await agent
      .post("/admin/auth/login")
      .send({ username: "admin", password: "AdminPass#123" });
    expect(res.statusCode).toBe(200);
    expect(res.body.ok).toBe(true);

    res = await agent.get("/admin/auth/session");
    expect(res.statusCode).toBe(200);
    expect(res.body.user.username).toBe("admin");

    res = await agent.get("/admin/api/content");
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty("fetchedAt");

    state.failRead = true;
    res = await agent.get("/admin/api/content");
    expect(res.statusCode).toBe(500);
    expect(res.body.error).toBe("Read failure");
    state.failRead = false;

    res = await agent.put("/admin/api/content").send({ data: state.content });
    expect(res.statusCode).toBe(403);
    expect(res.body.error).toBe("Missing CSRF token");

    res = await agent
      .put("/admin/api/content")
      .set("x-csrf-token", "mismatch")
      .send({ data: state.content });
    expect(res.statusCode).toBe(403);
    expect(res.body.error).toBe("CSRF token mismatch");

    state.failWrite = true;
    res = await agent
      .put("/admin/api/content")
      .set("x-csrf-token", csrfToken)
      .send({ data: state.content });
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe("Write failure");
    state.failWrite = false;

    res = await agent
      .put("/admin/api/content")
      .set("x-csrf-token", csrfToken)
      .send({ data: state.content });
    expect(res.statusCode).toBe(200);
    expect(res.body.ok).toBe(true);

    res = await agent
      .patch("/admin/api/content/notASection")
      .set("x-csrf-token", csrfToken)
      .send({ data: { value: true } });
    expect(res.statusCode).toBe(404);

    state.failWrite = true;
    res = await agent
      .patch("/admin/api/content/hero")
      .set("x-csrf-token", csrfToken)
      .send({ data: { title: "Updated Hero" } });
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe("Write failure");
    state.failWrite = false;

    res = await agent
      .patch("/admin/api/content/hero")
      .set("x-csrf-token", csrfToken)
      .send({ data: { title: "Updated Hero" } });
    expect(res.statusCode).toBe(200);
    expect(res.body.data).toEqual({ title: "Updated Hero" });

    res = await agent.get("/admin/api/audit");
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);

    res = await agent.get("/admin/api/assets");
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);

    res = await agent
      .post("/admin/api/assets")
      .set("x-csrf-token", csrfToken)
      .attach("asset", Buffer.from("demo text asset"), "portfolio-note.txt");
    expect(res.statusCode).toBe(201);
    expect(res.body.data).toHaveProperty("url");

    const uploadedName = res.body.data.name;

    res = await agent.get("/admin/api/assets");
    expect(res.statusCode).toBe(200);
    expect(res.body.data.some((asset) => asset.name === uploadedName)).toBe(true);
    const uploadedAsset = res.body.data.find((asset) => asset.name === uploadedName);
    expect(uploadedAsset).toBeTruthy();
    expect(uploadedAsset.source).toBe("local-upload");
    expect(uploadedAsset.deletable).toBe(true);

    res = await agent
      .delete("/admin/api/assets")
      .set("x-csrf-token", csrfToken)
      .send({
        id: uploadedAsset.id,
        source: uploadedAsset.source,
        name: uploadedAsset.name,
        url: uploadedAsset.url,
      });
    expect(res.statusCode).toBe(200);
    expect(res.body.ok).toBe(true);

    res = await agent.post("/admin/auth/logout");
    expect(res.statusCode).toBe(200);
    expect(res.body.ok).toBe(true);

    res = await agent.get("/admin/auth/session");
    expect(res.statusCode).toBe(401);
  });
});

describe("App startServer", () => {
  test("starts and closes cleanly", async () => {
    process.env.NODE_ENV = "test";
    process.env.PORT = "0";
    process.env.STORAGE_DRIVER = "file";
    process.env.ADMIN_USERNAME = "admin";
    process.env.ADMIN_PASSWORD_HASH = bcrypt.hashSync("ServerStart#123", 8);
    process.env.JWT_SECRET = "jwt-secret-start-server";
    process.env.CSRF_SECRET = "csrf-secret-start-server";

    jest.resetModules();
    const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    const { startServer } = require("../server/app");

    const server = startServer();
    expect(server.listening).toBe(true);

    await new Promise((resolve) => {
      server.close(resolve);
    });

    logSpy.mockRestore();
  });
});