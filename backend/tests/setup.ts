import { afterAll, beforeAll, beforeEach } from "vitest";

// Must be set before any module reads the config.
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234";
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgres://taskflow:taskflow_dev@localhost:5433/taskflow_test";

beforeAll(async () => {
  const { runMigrations } = await import("../src/migrate.js");
  await runMigrations();
});

beforeEach(async () => {
  const { pool } = await import("../src/db.js");
  await pool.query("TRUNCATE users, projects, tasks CASCADE");
});

afterAll(async () => {
  const { pool } = await import("../src/db.js");
  await pool.end();
});
