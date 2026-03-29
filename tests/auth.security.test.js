const bcrypt = require("bcryptjs");

describe("Auth security helpers", () => {
  let auth;

  beforeAll(() => {
    process.env.ADMIN_USERNAME = "admin";
    process.env.ADMIN_PASSWORD_HASH = bcrypt.hashSync("Secret#123", 8);
    process.env.JWT_SECRET = "jwt-secret-for-tests";
    process.env.CSRF_SECRET = "csrf-secret-for-tests";

    auth = require("../server/auth");
  });

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
});
