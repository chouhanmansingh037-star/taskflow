import request from "supertest";
import { describe, expect, it } from "vitest";
import { app, createProject, createTask, createUser, isoDay } from "./helpers.js";

describe("GET /api/dashboard", () => {
  it("requires authentication", async () => {
    expect((await request(app).get("/api/dashboard")).status).toBe(401);
  });

  it("returns zeros for a user with no data", async () => {
    const { auth } = await createUser();
    const res = await request(app).get("/api/dashboard").set(auth);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      totalProjects: 0,
      totalTasks: 0,
      completedTasks: 0,
      overdueTasks: 0,
      completionRate: 0,
      tasksByStatus: { todo: 0, in_progress: 0, done: 0 },
      projectProgress: [],
    });
  });

  it("aggregates totals, statuses and overdue tasks", async () => {
    const { auth } = await createUser();
    const alpha = await createProject(auth, "Alpha");
    await createProject(auth, "Empty project");
    await createTask(auth, alpha.id, { status: "done", dueDate: isoDay(-5) }); // done: never overdue
    await createTask(auth, alpha.id, { status: "done" });
    await createTask(auth, alpha.id, { status: "in_progress", dueDate: isoDay(-1) }); // overdue
    await createTask(auth, alpha.id, { status: "todo", dueDate: isoDay(-2) }); // overdue
    await createTask(auth, alpha.id, { status: "todo", dueDate: isoDay(0) }); // due today: not overdue
    await createTask(auth, alpha.id, { status: "todo" });

    const res = await request(app).get("/api/dashboard").set(auth);
    expect(res.body).toMatchObject({
      totalProjects: 2,
      totalTasks: 6,
      completedTasks: 2,
      overdueTasks: 2,
      completionRate: 33,
      tasksByStatus: { todo: 3, in_progress: 1, done: 2 },
    });
    const alphaProgress = res.body.projectProgress.find((p: { name: string }) => p.name === "Alpha");
    expect(alphaProgress).toMatchObject({ taskCount: 6, completedCount: 2, progress: 33 });
  });

  it("never counts another user's data", async () => {
    const mine = await createUser();
    const theirs = await createUser();
    const project = await createProject(theirs.auth);
    await createTask(theirs.auth, project.id, { status: "done" });
    await createTask(theirs.auth, project.id, { dueDate: isoDay(-3) });

    const res = await request(app).get("/api/dashboard").set(mine.auth);
    expect(res.body).toMatchObject({ totalProjects: 0, totalTasks: 0, completedTasks: 0, overdueTasks: 0 });
  });
});
