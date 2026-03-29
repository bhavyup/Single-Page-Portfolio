const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { config } = require("./config");

function signSession(user) {
  return jwt.sign(
    {
      sub: user,
      role: "admin",
    },
    config.auth.jwtSecret,
    {
      expiresIn: config.auth.sessionTtl,
      issuer: "portfolio-admin",
      audience: "portfolio-admin-ui",
    },
  );
}

function verifySessionToken(token) {
  return jwt.verify(token, config.auth.jwtSecret, {
    issuer: "portfolio-admin",
    audience: "portfolio-admin-ui",
  });
}

function getSessionCookieOptions() {
  return {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: "strict",
    path: "/",
    maxAge: 8 * 60 * 60 * 1000,
  };
}

function issueCsrfToken() {
  const nonce = crypto.randomBytes(24).toString("hex");
  const sig = crypto
    .createHmac("sha256", config.auth.csrfSecret)
    .update(nonce)
    .digest("hex");

  return `${nonce}.${sig}`;
}

function verifyCsrfToken(token) {
  if (!token || typeof token !== "string") return false;
  const [nonce, sig] = token.split(".");
  if (!nonce || !sig) return false;

  const expected = crypto
    .createHmac("sha256", config.auth.csrfSecret)
    .update(nonce)
    .digest("hex");

  try {
    return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  } catch {
    return false;
  }
}

async function verifyCredentials(username, password) {
  if (username !== config.admin.username) return false;
  return bcrypt.compare(password, config.admin.passwordHash);
}

function requireAdmin(req, res, next) {
  const token = req.cookies?.[config.auth.cookieName];
  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const payload = verifySessionToken(token);
    req.admin = payload;
    return next();
  } catch {
    return res.status(401).json({ error: "Invalid session" });
  }
}

function requireCsrf(req, res, next) {
  const headerToken = req.get("x-csrf-token");
  const cookieToken = req.cookies?.csrf_token;

  if (!headerToken || !cookieToken) {
    return res.status(403).json({ error: "Missing CSRF token" });
  }

  if (headerToken !== cookieToken || !verifyCsrfToken(headerToken)) {
    return res.status(403).json({ error: "CSRF token mismatch" });
  }

  return next();
}

module.exports = {
  signSession,
  verifyCredentials,
  getSessionCookieOptions,
  issueCsrfToken,
  verifyCsrfToken,
  requireAdmin,
  requireCsrf,
};
