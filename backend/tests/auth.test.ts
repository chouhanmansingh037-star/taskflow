import request from "supertest";
import { describe, expect, it } from "vitest";
import { pool } from "../src/db.js";
import { app, createUser } from "./helpers.js";

const validUser = { name: "Alex", email: "alex@example.com", password: "password123" };

describe("POST /api/auth/register", () => {
  it("creates an account, hashes the password and sets an httpOnly cookie", async () => {
    const res = await request(app).post("/api/auth/register").send(validUser);

    expect(res.status).toBe(201);
    expect(res.body.user).toEqual({ id: expect.any(String), email: "alex@example.com", name: "Alex" });
    expect(res.body.user.password_hash).toBeUndefined();
    expect(res.headers["set-cookie"][0]).toMatch(/taskflow_token=.*HttpOnly/);

    const { rows } = await pool.query("SELECT password_hash FROM users");
    expect(rows[0].password_hash).not.toContain("password123");
    expect(rows[0].password_hash).toMatch(/^\$2[aby]\$/);
  });

  it("rejects a duplicate email regardless of case", async () => {
    await request(app).post("/api/auth/register").send(validUser);
    const res = await request(app)
      .post("/api/auth/register")
      .send({ ...validUser, email: "ALEX@Example.com" });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("CONFLICT");
  });

  it.each([
    ["missing fields", {}],
    ["invalid email", { ...validUser, email: "nope" }],
    ["short password", { ...validUser, password: "short" }],
    ["password over bcrypt's 72-byte limit", { ...validUser, password: "a".repeat(73) }],
    ["empty name", { ...validUser, name: "  " }],
    ["non-string password", { ...validUser, password: 12345678 }],
  ])("returns 400 for %s", async (_label, body) => {
    const res = await request(app).post("/api/auth/register").send(body);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("BAD_REQUEST");
  });

  it("returns 400 for a malformed JSON body", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .set("Content-Type", "application/json")
      .send("{not json");
    expect(res.status).toBe(400);
  });
});

describe("POST /api/auth/login", () => {
  it("signs in with correct credentials, ignoring email case", async () => {
    await request(app).post("/api/auth/register").send(validUser);
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "Alex@Example.com", password: "password123" });
    expect(res.status).toBe(200);
    expect(res.body.token).toEqual(expect.any(String));
  });

  it("gives the same 401 for a wrong password and an unknown email", async () => {
    await request(app).post("/api/auth/register").send(validUser);
    const wrongPassword = await request(app)
      .post("/api/auth/login")
      .send({ email: validUser.email, password: "wrong-password" });
    const unknownEmail = await request(app)
      .post("/api/auth/login")
      .send({ email: "ghost@example.com", password: "password123" });

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(wrongPassword.body).toEqual(unknownEmail.body);
  });
});

describe("session handling", () => {
  it("rejects requests without credentials", async () => {
    const res = await request(app).get("/api/projects");
    expect(res.status).toBe(401);
  });

  it("rejects a garbage token", async () => {
    const res = await request(app).get("/api/projects").set("Authorization", "Bearer abc.def.ghi");
    expect(res.status).toBe(401);
  });

  it("accepts the session cookie", async () => {
    const user = await createUser();
    const res = await request(app).get("/api/auth/me").set("Cookie", `taskflow_token=${user.token}`);
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(user.email);
  });

  it("invalidates the token on logout", async () => {
    const user = await createUser();
    expect((await request(app).get("/api/auth/me").set(user.auth)).status).toBe(200);

    const logout = await request(app).post("/api/auth/logout").set(user.auth);
    expect(logout.status).toBe(204);

    const after = await request(app).get("/api/auth/me").set(user.auth);
    expect(after.status).toBe(401);
  });

  it("rejects a valid token once its user no longer exists", async () => {
    const user = await createUser();
    await pool.query("DELETE FROM users WHERE id = $1", [user.id]);
    const res = await request(app).get("/api/auth/me").set(user.auth);
    expect(res.status).toBe(401);
  });
});

describe("misc", () => {
  it("returns a JSON 404 for unknown routes", async () => {
    const res = await request(app).get("/api/nope");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("reports health", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
  });
});
