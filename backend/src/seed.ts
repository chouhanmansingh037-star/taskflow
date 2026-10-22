import bcrypt from "bcryptjs";
import { pool } from "./db.js";
import { logger } from "./logger.js";
import { runMigrations } from "./migrate.js";

const DEMO_EMAIL = "demo@taskflow.dev";
const DEMO_PASSWORD = "demo12345";

const daysFromToday = (offset: number) => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
};

const projects = [
  {
    name: "Website Redesign",
    description: "Modernize the company website with a new design.",
    tasks: [
      ["Design homepage", "in_progress", "high", 3],
      ["Create wireframes", "done", "medium", -5],
      ["Set up analytics", "todo", "low", 10],
      ["Write launch copy", "todo", "medium", -2],
    ],
  },
  {
    name: "Mobile App",
    description: "iOS and Android companion application.",
    tasks: [
      ["Integrate APIs", "in_progress", "medium", 6],
      ["Design system", "done", "low", -8],
      ["Push notifications", "todo", "high", 14],
    ],
  },
  {
    name: "Marketing Campaign",
    description: "Launch campaign for the product launch.",
    tasks: [
      ["Draft press release", "done", "high", -3],
      ["Book ad placements", "done", "medium", -1],
    ],
  },
] as const;

/** Creates a demo account with sample data. Safe to re-run: it skips if the demo user already exists. */
async function seed() {
  await runMigrations();
  const existing = await pool.query("SELECT 1 FROM users WHERE lower(email) = $1", [DEMO_EMAIL]);
  if (existing.rowCount) {
    logger.info("demo user already exists, skipping seed");
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const hash = await bcrypt.hash(DEMO_PASSWORD, 12);
    const user = await client.query<{ id: string }>(
      "INSERT INTO users (email, name, password_hash) VALUES ($1, 'Demo User', $2) RETURNING id",
      [DEMO_EMAIL, hash],
    );
    for (const project of projects) {
      const created = await client.query<{ id: string }>(
        "INSERT INTO projects (user_id, name, description) VALUES ($1, $2, $3) RETURNING id",
        [user.rows[0].id, project.name, project.description],
      );
      for (const [title, status, priority, dueOffset] of project.tasks) {
        await client.query(
          "INSERT INTO tasks (project_id, title, status, priority, due_date) VALUES ($1, $2, $3, $4, $5)",
          [created.rows[0].id, title, status, priority, daysFromToday(dueOffset)],
        );
      }
    }
    await client.query("COMMIT");
    logger.info("seeded demo user", { email: DEMO_EMAIL });
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

seed()
  .then(() => pool.end())
  .catch((err) => {
    logger.error("seed failed", { error: String(err) });
    process.exit(1);
  });
