const bcrypt = require("bcryptjs");
const request = require("supertest");

let app;

beforeAll(() => {
  process.env.ADMIN_USERNAME = "admin";
  process.env.ADMIN_PASSWORD_HASH = bcrypt.hashSync("TestPass@123", 8);
  process.env.JWT_SECRET = "test-jwt-secret-for-ci";
  process.env.CSRF_SECRET = "test-csrf-secret-for-ci";

  ({ app } = require("../server/app"));
});

describe("Public API", () => {
  test("GET /api/health returns healthy status", async () => {
    const res = await request(app).get("/api/health");

    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(typeof res.body.ts).toBe("string");
  });

  test("GET /api/content returns data payload", async () => {
    const res = await request(app).get("/api/content");

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty("data");
    expect(res.body.data).toHaveProperty("skills");
    expect(res.body.data).toHaveProperty("work");
    expect(res.body.data).toHaveProperty("journey");
  });
});
