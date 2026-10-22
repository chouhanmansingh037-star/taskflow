import request from "supertest";
import { describe, expect, it } from "vitest";
import { app, createProject, createTask, createUser, isoDay } from "./helpers.js";

describe("tasks CRUD", () => {
  it("creates a task with defaults, then updates and deletes it", async () => {
    const { auth } = await createUser();
    const project = await createProject(auth, "Alpha");

    const created = await request(app).post("/api/tasks").set(auth).send({ projectId: project.id, title: "Write docs" });
    expect(created.status).toBe(201);
    expect(created.body.task).toMatchObject({
      title: "Write docs",
      description: "",
      status: "todo",
      priority: "medium",
      dueDate: null,
      projectName: "Alpha",
      overdue: false,
    });
    const id = created.body.task.id;

    const updated = await request(app)
      .patch(`/api/tasks/${id}`)
      .set(auth)
      .send({ status: "in_progress", priority: "high", dueDate: "2030-01-31" });
    expect(updated.status).toBe(200);
    expect(updated.body.task).toMatchObject({ status: "in_progress", priority: "high", dueDate: "2030-01-31" });

    const cleared = await request(app).patch(`/api/tasks/${id}`).set(auth).send({ dueDate: null });
    expect(cleared.body.task.dueDate).toBeNull();

    expect((await request(app).delete(`/api/tasks/${id}`).set(auth)).status).toBe(204);
    expect((await request(app).get(`/api/tasks/${id}`).set(auth)).status).toBe(404);
  });

  it.each([
    ["missing title", { title: undefined }],
    ["blank title", { title: "  " }],
    ["invalid status", { status: "blocked" }],
    ["invalid priority", { priority: "urgent" }],
    ["malformed date", { dueDate: "31/01/2030" }],
    ["impossible date", { dueDate: "2025-02-30" }],
    ["unknown field", { id: "x" }],
  ])("rejects create with %s", async (_label, extra) => {
    const { auth } = await createUser();
    const project = await createProject(auth);
    const res = await request(app)
      .post("/api/tasks")
      .set(auth)
      .send({ projectId: project.id, title: "ok", ...extra });
    expect(res.status).toBe(400);
  });

  it("rejects an update with no fields, a bad status, or a project change", async () => {
    const { auth } = await createUser();
    const project = await createProject(auth);
    const task = await createTask(auth, project.id);
    expect((await request(app).patch(`/api/tasks/${task.id}`).set(auth).send({})).status).toBe(400);
    expect((await request(app).patch(`/api/tasks/${task.id}`).set(auth).send({ status: "nope" })).status).toBe(400);
    expect((await request(app).patch(`/api/tasks/${task.id}`).set(auth).send({ projectId: project.id })).status).toBe(400);
  });
});

describe("task ownership", () => {
  it("does not let a user create tasks in someone else's project", async () => {
    const owner = await createUser();
    const intruder = await createUser();
    const project = await createProject(owner.auth);

    const res = await request(app).post("/api/tasks").set(intruder.auth).send({ projectId: project.id, title: "Sneaky" });
    expect(res.status).toBe(404);

    const tasks = await request(app).get("/api/tasks").set(owner.auth);
    expect(tasks.body.tasks).toHaveLength(0);
  });

  it("hides, and refuses to modify, another user's task", async () => {
    const owner = await createUser();
    const intruder = await createUser();
    const project = await createProject(owner.auth);
    const task = await createTask(owner.auth, project.id, { title: "Secret" });

    expect((await request(app).get(`/api/tasks/${task.id}`).set(intruder.auth)).status).toBe(404);
    expect((await request(app).patch(`/api/tasks/${task.id}`).set(intruder.auth).send({ title: "x" })).status).toBe(404);
    expect((await request(app).delete(`/api/tasks/${task.id}`).set(intruder.auth)).status).toBe(404);
    expect((await request(app).get("/api/tasks").set(intruder.auth)).body.tasks).toEqual([]);
    expect(
      (await request(app).get("/api/tasks").set(intruder.auth).query({ projectId: project.id })).body.tasks,
    ).toEqual([]);

    const intact = await request(app).get(`/api/tasks/${task.id}`).set(owner.auth);
    expect(intact.body.task.title).toBe("Secret");
  });

  it("requires authentication on every task route", async () => {
    const id = "00000000-0000-4000-8000-000000000000";
    expect((await request(app).get("/api/tasks")).status).toBe(401);
    expect((await request(app).post("/api/tasks").send({})).status).toBe(401);
    expect((await request(app).get(`/api/tasks/${id}`)).status).toBe(401);
    expect((await request(app).patch(`/api/tasks/${id}`).send({})).status).toBe(401);
    expect((await request(app).delete(`/api/tasks/${id}`)).status).toBe(401);
  });
});

describe("task filtering and search", () => {
  async function seed() {
    const { auth } = await createUser();
    const project = await createProject(auth, "Alpha");
    const other = await createProject(auth, "Beta");
    await createTask(auth, project.id, { title: "Design homepage", status: "todo", priority: "high" });
    await createTask(auth, project.id, { title: "Design logo", status: "done", priority: "low" });
    await createTask(auth, project.id, { title: "Write tests", status: "todo", priority: "low" });
    await createTask(auth, other.id, { title: "100% coverage", status: "in_progress", priority: "medium" });
    return { auth, project, other };
  }

  const titles = (res: request.Response) => res.body.tasks.map((t: { title: string }) => t.title).sort();

  it("filters by status, priority and project", async () => {
    const { auth, other } = await seed();
    expect(titles(await request(app).get("/api/tasks").set(auth).query({ status: "todo" }))).toEqual([
      "Design homepage",
      "Write tests",
    ]);
    expect(titles(await request(app).get("/api/tasks").set(auth).query({ priority: "low" }))).toEqual([
      "Design logo",
      "Write tests",
    ]);
    expect(titles(await request(app).get("/api/tasks").set(auth).query({ projectId: other.id }))).toEqual([
      "100% coverage",
    ]);
  });

  it("combines search with status and priority filters", async () => {
    const { auth } = await seed();
    const res = await request(app).get("/api/tasks").set(auth).query({ search: "DESIGN", status: "todo", priority: "high" });
    expect(titles(res)).toEqual(["Design homepage"]);
  });

  it("returns an empty list, not an error, when nothing matches", async () => {
    const { auth } = await seed();
    const res = await request(app).get("/api/tasks").set(auth).query({ search: "zzz" });
    expect(res.status).toBe(200);
    expect(res.body.tasks).toEqual([]);
    expect(res.body.pagination.total).toBe(0);
  });

  it("treats LIKE wildcards and SQL in the search text literally", async () => {
    const { auth } = await seed();
    expect(titles(await request(app).get("/api/tasks").set(auth).query({ search: "%" }))).toEqual(["100% coverage"]);
    expect(titles(await request(app).get("/api/tasks").set(auth).query({ search: "_" }))).toEqual([]);
    expect((await request(app).get("/api/tasks").set(auth).query({ search: "'; DROP TABLE tasks; --" })).status).toBe(200);
    expect((await request(app).get("/api/tasks").set(auth)).body.tasks).toHaveLength(4);
  });

  it("rejects invalid filter values", async () => {
    const { auth } = await seed();
    expect((await request(app).get("/api/tasks").set(auth).query({ status: "nope" })).status).toBe(400);
    expect((await request(app).get("/api/tasks").set(auth).query({ projectId: "abc" })).status).toBe(400);
    expect((await request(app).get("/api/tasks").set(auth).query({ page: 0 })).status).toBe(400);
    expect((await request(app).get("/api/tasks").set(auth).query({ limit: 1000 })).status).toBe(400);
  });

  it("paginates and reports totals, including a page past the end", async () => {
    const { auth } = await seed();
    const first = await request(app).get("/api/tasks").set(auth).query({ limit: 3, page: 1, sort: "title", order: "asc" });
    expect(first.body.tasks).toHaveLength(3);
    expect(first.body.pagination).toEqual({ page: 1, limit: 3, total: 4, totalPages: 2 });

    const second = await request(app).get("/api/tasks").set(auth).query({ limit: 3, page: 2, sort: "title", order: "asc" });
    expect(second.body.tasks).toHaveLength(1);

    const beyond = await request(app).get("/api/tasks").set(auth).query({ limit: 3, page: 9 });
    expect(beyond.body.tasks).toEqual([]);
  });

  it("sorts by due date with undated tasks last", async () => {
    const { auth } = await createUser();
    const project = await createProject(auth);
    await createTask(auth, project.id, { title: "undated" });
    await createTask(auth, project.id, { title: "later", dueDate: isoDay(10) });
    await createTask(auth, project.id, { title: "sooner", dueDate: isoDay(2) });
    const res = await request(app).get("/api/tasks").set(auth).query({ sort: "due", order: "asc" });
    expect(res.body.tasks.map((t: { title: string }) => t.title)).toEqual(["sooner", "later", "undated"]);
  });
});

describe("overdue flag", () => {
  it("is true only for open tasks whose due date has passed", async () => {
    const { auth } = await createUser();
    const project = await createProject(auth);
    await createTask(auth, project.id, { title: "late", dueDate: isoDay(-1) });
    await createTask(auth, project.id, { title: "late but done", dueDate: isoDay(-1), status: "done" });
    await createTask(auth, project.id, { title: "due today", dueDate: isoDay(0) });
    await createTask(auth, project.id, { title: "future", dueDate: isoDay(1) });
    await createTask(auth, project.id, { title: "no date" });

    const res = await request(app).get("/api/tasks").set(auth);
    const overdue = res.body.tasks.filter((t: { overdue: boolean }) => t.overdue).map((t: { title: string }) => t.title);
    expect(overdue).toEqual(["late"]);
  });
});
