import request from "supertest";
import { createApp } from "../src/app.js";

export const app = createApp();

let counter = 0;

/** Registers a fresh user and returns a Bearer header ready for authenticated requests. */
export async function createUser(name = "Test User") {
  counter += 1;
  const email = `user${counter}-${Date.now()}@example.com`;
  const res = await request(app).post("/api/auth/register").send({ name, email, password: "password123" });
  return {
    email,
    id: res.body.user.id as string,
    token: res.body.token as string,
    auth: { Authorization: `Bearer ${res.body.token}` },
  };
}

export async function createProject(auth: Record<string, string>, name = "Project", description = "") {
  const res = await request(app).post("/api/projects").set(auth).send({ name, description });
  return res.body.project as { id: string };
}

export async function createTask(
  auth: Record<string, string>,
  projectId: string,
  fields: Record<string, unknown> = {},
) {
  const res = await request(app)
    .post("/api/tasks")
    .set(auth)
    .send({ projectId, title: "Task", ...fields });
  return res.body.task as { id: string };
}

export const isoDay = (offsetDays: number) => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
};
