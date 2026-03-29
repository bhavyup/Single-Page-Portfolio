const path = require("path");
const fs = require("fs");
const express = require("express");
const helmetModule = require("helmet");
const cookieParser = require("cookie-parser");
const rateLimitModule = require("express-rate-limit");
const morgan = require("morgan");
const multer = require("multer");
const { put, list, del } = require("@vercel/blob");
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
const staticRoot = config.rootDir;
const faviconPath = path.join(staticRoot, "logo", "logo.png");
const uploadsDir = path.resolve(config.assetUploadDir);
const bundledAssetDirs = [
  path.join(staticRoot, "assets", "images"),
  path.join(staticRoot, "assets", "resume"),
];
const blobPrefix = String(config.assets.blobPrefix || "portfolio-assets/")
  .replace(/^\/+/, "")
  .replace(/\/?$/, "/");

const allowedAssetExtensions = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".svg",
  ".mp4",
  ".webm",
  ".mov",
  ".avi",
  ".m4v",
  ".pdf",
  ".doc",
  ".docx",
  ".ppt",
  ".pptx",
  ".xls",
  ".xlsx",
  ".txt",
  ".zip",
]);

function sanitizeAssetBaseName(name) {
  return String(name || "asset")
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64) || "asset";
}

function toAssetPublicUrl(fileName) {
  return `/assets/uploads/${encodeURIComponent(fileName)}`;
}

function normalizeSlashes(value) {
  return String(value || "").replace(/\\/g, "/");
}

function toStaticAssetUrl(relativeFilePath) {
  const normalized = normalizeSlashes(relativeFilePath).replace(/^\/+/, "");
  return `/${encodeURI(normalized)}`;
}

function stripBlobPrefix(pathName) {
  const normalized = normalizeSlashes(pathName);
  if (normalized.startsWith(blobPrefix)) {
    return normalized.slice(blobPrefix.length);
  }

  return normalized;
}

function isSupportedAssetFile(fileName) {
  const ext = path.extname(fileName || "").toLowerCase();
  return allowedAssetExtensions.has(ext);
}

function buildAssetFilename(originalName) {
  const ext = path.extname(originalName || "").toLowerCase();
  const baseName = sanitizeAssetBaseName(path.basename(originalName || "asset", ext));
  const random = Math.random().toString(36).slice(2, 8);
  return `${Date.now()}-${random}-${baseName}${ext}`;
}

async function listUploadedAssets() {
  const entries = await fs.promises.readdir(uploadsDir, { withFileTypes: true }).catch((error) => {
    if (error && error.code === "ENOENT") return [];
    throw error;
  });

  const files = entries.filter((entry) => entry.isFile()).map((entry) => entry.name);
  const assets = await Promise.all(
    files.map(async (fileName) => {
      const filePath = path.join(uploadsDir, fileName);
      const stats = await fs.promises.stat(filePath).catch(() => null);
      if (!stats || !stats.isFile()) return null;
      return {
        name: fileName,
        url: toAssetPublicUrl(fileName),
        size: stats.size,
        uploadedAt: stats.mtime.toISOString(),
      };
    }),
  );

  return assets
    .filter(Boolean)
    .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
}

async function collectFilesRecursive(dirPath) {
  const entries = await fs.promises.readdir(dirPath, { withFileTypes: true }).catch((error) => {
    if (error && error.code === "ENOENT") return [];
    throw error;
  });

  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      const nested = await collectFilesRecursive(fullPath);
      files.push(...nested);
      continue;
    }

    if (entry.isFile() && isSupportedAssetFile(entry.name)) {
      files.push(fullPath);
    }
  }

  return files;
}

async function listBundledAssets() {
  const assets = [];

  for (const dirPath of bundledAssetDirs) {
    const files = await collectFilesRecursive(dirPath);

    for (const filePath of files) {
      const stats = await fs.promises.stat(filePath).catch(() => null);
      if (!stats || !stats.isFile()) continue;

      const relativeFromRoot = normalizeSlashes(path.relative(staticRoot, filePath));
      assets.push({
        id: `local-static:${relativeFromRoot}`,
        name: relativeFromRoot,
        url: toStaticAssetUrl(relativeFromRoot),
        size: stats.size,
        uploadedAt: stats.mtime.toISOString(),
        source: "local-static",
        deletable: false,
      });
    }
  }

  return assets;
}

async function listLocalUploadedAssets() {
  if (!uploadDirectoryReady) return [];

  const assets = await listUploadedAssets();
  return assets.map((asset) => ({
    id: `local-upload:${asset.name}`,
    name: asset.name,
    url: asset.url,
    size: asset.size,
    uploadedAt: asset.uploadedAt,
    source: "local-upload",
    deletable: true,
  }));
}

async function listBlobAssets() {
  if (!config.assets.useBlob) return [];

  const response = await list({
    token: config.assets.blobToken,
    prefix: blobPrefix,
  });

  return (response.blobs || []).map((blob) => ({
    id: `blob:${blob.url}`,
    name: stripBlobPrefix(blob.pathname || blob.url),
    url: blob.url,
    size: blob.size || 0,
    uploadedAt: new Date(blob.uploadedAt || Date.now()).toISOString(),
    source: "blob",
    deletable: true,
  }));
}

async function listAllAssets() {
  const [blobAssets, localUploadedAssets, bundledAssets] = await Promise.all([
    config.assets.useBlob ? listBlobAssets() : Promise.resolve([]),
    listLocalUploadedAssets(),
    listBundledAssets(),
  ]);

  const byUrl = new Map();
  for (const asset of [...blobAssets, ...localUploadedAssets, ...bundledAssets]) {
    if (!byUrl.has(asset.url)) {
      byUrl.set(asset.url, asset);
    }
  }

  return [...byUrl.values()].sort(
    (a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime(),
  );
}

function resolveLocalUploadName(input) {
  const safeName = path.basename(String(input || ""));
  if (!safeName || safeName !== input) {
    return null;
  }

  return safeName;
}

async function deleteLocalUploadByName(assetName) {
  const safeName = resolveLocalUploadName(assetName);
  if (!safeName) {
    const error = new Error("Invalid asset name");
    /** @type {any} */ (error).status = 400;
    throw error;
  }

  const resolvedPath = path.resolve(path.join(uploadsDir, safeName));
  if (!resolvedPath.startsWith(`${uploadsDir}${path.sep}`)) {
    const error = new Error("Invalid asset path");
    /** @type {any} */ (error).status = 400;
    throw error;
  }

  try {
    await fs.promises.unlink(resolvedPath);
  } catch (error) {
    if (error && error.code === "ENOENT") {
      const notFound = new Error("Asset not found");
      /** @type {any} */ (notFound).status = 404;
      throw notFound;
    }
    throw error;
  }
}

let uploadDirectoryReady = true;
try {
  fs.mkdirSync(uploadsDir, { recursive: true });
} catch {
  uploadDirectoryReady = false;
}

const uploadAsset = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: 1,
    fileSize: 25 * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    if (!allowedAssetExtensions.has(ext)) {
      cb(new Error("Unsupported file type"));
      return;
    }

    cb(null, true);
  },
});

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

app.get("/favicon.ico", (_req, res) => {
  if (!fs.existsSync(faviconPath)) {
    return res.status(404).end();
  }

  res.setHeader("Cache-Control", "public, max-age=86400");
  return res.sendFile(faviconPath);
});

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    env: config.env,
    storage: {
      driver: config.storage.driver,
      useDatabase: config.storage.useDatabase,
      hasMongoUri: Boolean(config.storage.mongoUri),
      mongoDbName: config.storage.mongoDbName,
    },
    ts: new Date().toISOString(),
  });
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

app.get("/admin/api/assets", async (_req, res) => {
  try {
    const assets = await listAllAssets();
    return res.json({ data: assets });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.post("/admin/api/assets", requireCsrf, (req, res) => {
  return uploadAsset.single("asset")(req, res, async (uploadError) => {
    if (uploadError) {
      if (uploadError instanceof multer.MulterError) {
        if (uploadError.code === "LIMIT_FILE_SIZE") {
          return res.status(400).json({ error: "File is too large. Max size is 25 MB." });
        }
      }

      return res.status(400).json({ error: uploadError.message || "Upload failed" });
    }

    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const generatedName = buildAssetFilename(req.file.originalname);
    let createdAsset;

    try {
      if (config.assets.useBlob) {
        const blobPath = `${blobPrefix}${generatedName}`;
        const blob = await put(blobPath, req.file.buffer, {
          access: "public",
          addRandomSuffix: false,
          token: config.assets.blobToken,
          contentType: req.file.mimetype || undefined,
        });

        createdAsset = {
          id: `blob:${blob.url}`,
          name: stripBlobPrefix(blob.pathname || blobPath),
          url: blob.url,
          size: req.file.size,
          uploadedAt: new Date().toISOString(),
          source: "blob",
          deletable: true,
        };
      } else {
        if (!uploadDirectoryReady) {
          return res.status(503).json({ error: "Asset uploads are not available on this host" });
        }

        const filePath = path.join(uploadsDir, generatedName);
        await fs.promises.writeFile(filePath, req.file.buffer);

        createdAsset = {
          id: `local-upload:${generatedName}`,
          name: generatedName,
          url: toAssetPublicUrl(generatedName),
          size: req.file.size,
          uploadedAt: new Date().toISOString(),
          source: "local-upload",
          deletable: true,
        };
      }
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }

    try {
      await appendAudit({
        actor: req.admin.sub,
        action: "asset.upload",
        ip: req.ip,
        userAgent: req.get("user-agent") || "unknown",
        metadata: {
          fileName: createdAsset.name,
          source: createdAsset.source,
          bytes: req.file.size,
        },
      });
    } catch {}

    return res.status(201).json({
      ok: true,
      data: createdAsset,
    });
  });
});

app.delete("/admin/api/assets", requireCsrf, async (req, res) => {
  const source = String(req.body?.source || "");
  const id = String(req.body?.id || "");
  const name = String(req.body?.name || "");
  const url = String(req.body?.url || "");

  try {
    if (source === "blob") {
      if (!config.assets.useBlob) {
        return res.status(400).json({ error: "Blob asset storage is not enabled" });
      }

      const blobUrl =
        url ||
        (id.startsWith("blob:") ? id.slice("blob:".length) : "");
      if (!blobUrl) {
        return res.status(400).json({ error: "Missing blob asset url" });
      }

      await del(blobUrl, {
        token: config.assets.blobToken,
      });
    } else if (source === "local-upload") {
      const candidateName = name || (id.startsWith("local-upload:") ? id.slice("local-upload:".length) : "");
      if (!uploadDirectoryReady) {
        return res.status(503).json({ error: "Asset uploads are not available on this host" });
      }
      await deleteLocalUploadByName(candidateName);
    } else {
      return res.status(400).json({ error: "This asset is read-only and cannot be deleted" });
    }
  } catch (error) {
    const status = Number(error.status || 500);
    return res.status(status).json({ error: error.message });
  }

  try {
    await appendAudit({
      actor: req.admin.sub,
      action: "asset.delete",
      ip: req.ip,
      userAgent: req.get("user-agent") || "unknown",
      metadata: {
        source,
        id,
        name,
        url,
      },
    });
  } catch {}

  return res.json({ ok: true });
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

app.use(
  "/assets/uploads",
  express.static(uploadsDir, {
    index: false,
    etag: false,
    lastModified: false,
    setHeaders: (res) => {
      res.setHeader("Cache-Control", "public, max-age=300");
      res.setHeader("X-Content-Type-Options", "nosniff");
    },
  }),
);

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
