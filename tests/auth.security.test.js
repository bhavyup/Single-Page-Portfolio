const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

describe("Auth security helpers", () => {
  let auth;

  beforeAll(() => {
    process.env.ADMIN_USERNAME = "admin";
    process.env.ADMIN_PASSWORD_HASH = bcrypt.hashSync("Secret#123", 8);
    process.env.JWT_SECRET = "jwt-secret-for-tests";
    process.env.CSRF_SECRET = "csrf-secret-for-tests";

    auth = require("../server/auth");
  });

  function createResponseRecorder() {
    return {
      statusCode: 200,
      payload: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(body) {
        this.payload = body;
        return this;
      },
    };
  }

  test("issues and validates a CSRF token", () => {
    const token = auth.issueCsrfToken();

    expect(typeof token).toBe("string");
    expect(token.includes(".")).toBe(true);
    expect(auth.verifyCsrfToken(token)).toBe(true);
  });

  test("rejects tampered CSRF token", () => {
    const token = auth.issueCsrfToken();
    const tampered = `${token}x`;

    expect(auth.verifyCsrfToken(tampered)).toBe(false);
  });

  test("validates credentials against configured bcrypt hash", async () => {
    await expect(auth.verifyCredentials("admin", "Secret#123")).resolves.toBe(true);
    await expect(auth.verifyCredentials("admin", "WrongPass")).resolves.toBe(false);
    await expect(auth.verifyCredentials("other", "Secret#123")).resolves.toBe(false);
  });

  test("signs and verifies a session token", () => {
    const token = auth.signSession("admin");
    const payload = jwt.verify(token, process.env.JWT_SECRET, {
      issuer: "portfolio-admin",
      audience: "portfolio-admin-ui",
    });

    expect(payload.sub).toBe("admin");
    expect(payload.role).toBe("admin");
  });

  test("returns strict session cookie options", () => {
    const options = auth.getSessionCookieOptions();

    expect(options.httpOnly).toBe(true);
    expect(options.sameSite).toBe("strict");
    expect(options.maxAge).toBe(8 * 60 * 60 * 1000);
  });

  test("requireAdmin rejects missing and invalid sessions", () => {
    const missingReq = { cookies: {} };
    const missingRes = createResponseRecorder();
    let nextCalled = false;

    auth.requireAdmin(missingReq, missingRes, () => {
      nextCalled = true;
    });

    expect(nextCalled).toBe(false);
    expect(missingRes.statusCode).toBe(401);
    expect(missingRes.payload).toEqual({ error: "Unauthorized" });

    const invalidReq = {
      cookies: {
        admin_session: "bad.token.value",
      },
    };
    const invalidRes = createResponseRecorder();

    auth.requireAdmin(invalidReq, invalidRes, () => {
      nextCalled = true;
    });

    expect(invalidRes.statusCode).toBe(401);
    expect(invalidRes.payload).toEqual({ error: "Invalid session" });
  });

  test("requireAdmin accepts a valid session", () => {
    const token = auth.signSession("admin");
    const req = {
      cookies: {
        admin_session: token,
      },
    };
    const res = createResponseRecorder();
    let nextCalled = false;

    auth.requireAdmin(req, res, () => {
      nextCalled = true;
    });

    expect(nextCalled).toBe(true);
    expect(req.admin.sub).toBe("admin");
  });

  test("requireCsrf handles missing, mismatched, and valid tokens", () => {
    const missingReq = {
      cookies: {},
      get: () => undefined,
    };
    const missingRes = createResponseRecorder();

    auth.requireCsrf(missingReq, missingRes, () => {});
    expect(missingRes.statusCode).toBe(403);
    expect(missingRes.payload).toEqual({ error: "Missing CSRF token" });

    const token = auth.issueCsrfToken();
    const mismatchReq = {
      cookies: { csrf_token: token },
      get: () => "not-the-same-token",
    };
    const mismatchRes = createResponseRecorder();

    auth.requireCsrf(mismatchReq, mismatchRes, () => {});
    expect(mismatchRes.statusCode).toBe(403);
    expect(mismatchRes.payload).toEqual({ error: "CSRF token mismatch" });

    let nextCalled = false;
    const validReq = {
      cookies: { csrf_token: token },
      get: () => token,
    };
    const validRes = createResponseRecorder();

    auth.requireCsrf(validReq, validRes, () => {
      nextCalled = true;
    });

    expect(nextCalled).toBe(true);
    expect(validRes.statusCode).toBe(200);
  });
});
