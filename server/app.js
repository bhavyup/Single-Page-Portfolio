const path = require("path");
const fs = require("fs");
const express = require("express");
const helmetModule = require("helmet");
const cookieParser = require("cookie-parser");
const rateLimitModule = require("express-rate-limit");
const morgan = require("morgan");
const { config, assertConfig } = require("./config");
const {
  signSession,
  verifyCredentials,
  getSessionCookieOptions,
  issueCsrfToken,
  requireAdmin,
  requireCsrf,
} = require("./auth");
const { readContent, writeContent } = require("./contentStore");
const { appendAudit, readAuditLog } = require("./auditStore");

const helmet = /** @type {any} */ (helmetModule.default || helmetModule);
const rateLimit = /** @type {any} */ (
  rateLimitModule.default || rateLimitModule
);

assertConfig();

const app = express();

app.disable("x-powered-by");
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        "script-src": [
          "'self'",
          "https://kit.fontawesome.com",
          "https://cdnjs.cloudflare.com",
        ],
        "style-src": [
          "'self'",
          "'unsafe-inline'",
          "https://fonts.googleapis.com",
          "https://cdnjs.cloudflare.com",
          "https://cdn.jsdelivr.net",
          "https://ka-f.fontawesome.com",
        ],
        "font-src": [
          "'self'",
          "https://fonts.gstatic.com",
          "https://cdnjs.cloudflare.com",
          "https://cdn.jsdelivr.net",
          "https://ka-f.fontawesome.com",
        ],
        "img-src": ["'self'", "data:", "https:"],
        "connect-src": [
          "'self'",
          "https://ka-f.fontawesome.com", 
          "https://calculator-bhavy.netlify.app",
          "https://bhavyup.github.io",
          "https://bhavyupreti.me",
        ],
        "frame-src": ["'self'", "https:"],
      },
    },
    crossOriginEmbedderPolicy: false,
  }),
);

app.use(morgan(config.isProduction ? "combined" : "dev"));
app.use(express.json({ limit: "2mb" }));
app.use(cookieParser());

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts. Try again later." },
});

const adminLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
});

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", env: config.env, ts: new Date().toISOString() });
});

app.get("/api/content", async (_req, res) => {
  try {
    const content = await readContent();
    res.json({ data: content });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/admin/auth/csrf", (req, res) => {
  const token = issueCsrfToken();
  res.cookie("csrf_token", token, {
    httpOnly: false,
    secure: config.isProduction,
    sameSite: "strict",
    path: "/",
    maxAge: 8 * 60 * 60 * 1000,
  });

  res.json({ csrfToken: token });
});

app.post("/admin/auth/login", loginLimiter, async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res
      .status(400)
      .json({ error: "Username and password are required" });
  }

  const valid = await verifyCredentials(username, password);
  if (!valid) {
    try {
      await appendAudit({
        actor: username,
        action: "login.failed",
        ip: req.ip,
        userAgent: req.get("user-agent") || "unknown",
      });
    } catch {}
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const token = signSession(username);
  res.cookie(config.auth.cookieName, token, getSessionCookieOptions());

  try {
    await appendAudit({
      actor: username,
      action: "login.success",
      ip: req.ip,
      userAgent: req.get("user-agent") || "unknown",
    });
  } catch {}

  return res.json({ ok: true });
});

app.post("/admin/auth/logout", requireAdmin, async (req, res) => {
  try {
    await appendAudit({
      actor: req.admin.sub,
      action: "logout",
      ip: req.ip,
      userAgent: req.get("user-agent") || "unknown",
    });
  } catch {}

  res.clearCookie(config.auth.cookieName, getSessionCookieOptions());
  res.clearCookie("csrf_token", {
    httpOnly: false,
    secure: config.isProduction,
    sameSite: "strict",
    path: "/",
  });

  res.json({ ok: true });
});

app.get("/admin/auth/session", requireAdmin, (req, res) => {
  res.json({
    ok: true,
    user: {
      username: req.admin.sub,
      role: req.admin.role,
    },
  });
});

app.use("/admin/api", adminLimiter, requireAdmin);

app.get("/admin/api/content", async (req, res) => {
  try {
    const content = await readContent();
    res.json({ data: content, fetchedAt: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put("/admin/api/content", requireCsrf, async (req, res) => {
  try {
    const updated = await writeContent(req.body?.data);

    try {
      await appendAudit({
        actor: req.admin.sub,
        action: "content.replace",
        ip: req.ip,
        userAgent: req.get("user-agent") || "unknown",
        metadata: {
          topLevelKeys: Object.keys(updated),
        },
      });
    } catch {}

    res.json({ ok: true, data: updated });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.patch("/admin/api/content/:section", requireCsrf, async (req, res) => {
  const { section } = req.params;

  try {
    const current = await readContent();
    if (!(section in current)) {
      return res.status(404).json({ error: `Unknown section: ${section}` });
    }

    current[section] = req.body?.data;
    const updated = await writeContent(current);

    try {
      await appendAudit({
        actor: req.admin.sub,
        action: "content.section.update",
        ip: req.ip,
        userAgent: req.get("user-agent") || "unknown",
        metadata: { section },
      });
    } catch {}

    return res.json({ ok: true, data: updated[section] });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

app.get("/admin/api/audit", async (req, res) => {
  try {
    const log = await readAuditLog();
    res.json({ data: log });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const adminDir = path.join(__dirname, "public", "admin");
if (!fs.existsSync(adminDir)) {
  fs.mkdirSync(adminDir, { recursive: true });
}

app.use(
  "/admin",
  express.static(adminDir, {
    extensions: ["html"],
    etag: false,
    lastModified: false,
    setHeaders: (res) => {
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
    },
  }),
);

const staticRoot = config.rootDir;
app.use((req, res, next) => {
  const blockedPaths = [
    "/server",
    "/data.js",
    "/package.json",
    "/package-lock.json",
    "/.env",
    "/.env.example",
  ];

  if (
    blockedPaths.some(
      (blocked) => req.path === blocked || req.path.startsWith(`${blocked}/`),
    ) ||
    req.path.startsWith("/.git")
  ) {
    return res.status(404).send("Not Found");
  }

  return next();
});

app.use(express.static(staticRoot, { index: false }));

app.get("/", (_req, res) => {
  res.sendFile(path.join(staticRoot, "index.html"));
});

app.use((err, _req, res, _next) => {
  const message = config.isProduction ? "Internal server error" : err.message;
  res.status(500).json({ error: message });
});

function startServer() {
  return app.listen(config.port, () => {
    console.log(`Server running on http://localhost:${config.port}`);
  });
}

if (require.main === module) {
  startServer();
}

module.exports = {
  app,
  startServer,
};
