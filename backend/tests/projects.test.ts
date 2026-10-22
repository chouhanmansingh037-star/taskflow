import request from "supertest";
import { describe, expect, it } from "vitest";
import { app, createProject, createTask, createUser } from "./helpers.js";

describe("projects CRUD", () => {
  it("creates, reads, updates and deletes a project", async () => {
    const { auth } = await createUser();

    const created = await request(app).post("/api/projects").set(auth).send({ name: "  Alpha  ", description: "First" });
    expect(created.status).toBe(201);
    expect(created.body.project).toMatchObject({ name: "Alpha", description: "First", taskCount: 0, progress: 0 });
    const id = created.body.project.id;

    const fetched = await request(app).get(`/api/projects/${id}`).set(auth);
    expect(fetched.body.project.createdAt).toEqual(expect.any(String));

    const updated = await request(app).patch(`/api/projects/${id}`).set(auth).send({ name: "Beta" });
    expect(updated.status).toBe(200);
    expect(updated.body.project).toMatchObject({ name: "Beta", description: "First" });

    expect((await request(app).delete(`/api/projects/${id}`).set(auth)).status).toBe(204);
    expect((await request(app).get(`/api/projects/${id}`).set(auth)).status).toBe(404);
  });

  it("computes task counts and progress", async () => {
    const { auth } = await createUser();
    const project = await createProject(auth);
    await createTask(auth, project.id, { status: "done" });
    await createTask(auth, project.id, { status: "done" });
    await createTask(auth, project.id, { status: "todo" });

    const res = await request(app).get(`/api/projects/${project.id}`).set(auth);
    expect(res.body.project).toMatchObject({ taskCount: 3, completedCount: 2, progress: 67 });
  });

  it("deletes a project's tasks with it", async () => {
    const { auth } = await createUser();
    const project = await createProject(auth);
    const task = await createTask(auth, project.id);
    await request(app).delete(`/api/projects/${project.id}`).set(auth);
    expect((await request(app).get(`/api/tasks/${task.id}`).set(auth)).status).toBe(404);
  });

  it.each([
    ["missing name", {}],
    ["blank name", { name: "   " }],
    ["name over 120 chars", { name: "x".repeat(121) }],
    ["wrong type", { name: 42 }],
    ["unknown field (mass assignment)", { name: "ok", userId: "someone-else" }],
  ])("rejects create with %s", async (_label, body) => {
    const { auth } = await createUser();
    const res = await request(app).post("/api/projects").set(auth).send(body);
    expect(res.status).toBe(400);
  });

  it("rejects an empty update and malformed ids", async () => {
    const { auth } = await createUser();
    const project = await createProject(auth);
    expect((await request(app).patch(`/api/projects/${project.id}`).set(auth).send({})).status).toBe(400);
    expect((await request(app).get("/api/projects/not-a-uuid").set(auth)).status).toBe(400);
  });

  it("returns 404 for a well-formed id that does not exist", async () => {
    const { auth } = await createUser();
    const res = await request(app).get("/api/projects/00000000-0000-4000-8000-000000000000").set(auth);
    expect(res.status).toBe(404);
  });
});

describe("projects listing", () => {
  it("searches by name, treating % and _ literally", async () => {
    const { auth } = await createUser();
    await createProject(auth, "Roadmap");
    await createProject(auth, "100% Done");
    await createProject(auth, "snake_case");

    const names = async (search: string) =>
      (await request(app).get("/api/projects").set(auth).query({ search })).body.projects.map(
        (p: { name: string }) => p.name,
      );

    expect(await names("road")).toEqual(["Roadmap"]);
    expect(await names("%")).toEqual(["100% Done"]);
    expect(await names("_")).toEqual(["snake_case"]);
    expect(await names("' OR 1=1 --")).toEqual([]);
  });

  it("sorts by name", async () => {
    const { auth } = await createUser();
    await createProject(auth, "banana");
    await createProject(auth, "Apple");
    const res = await request(app).get("/api/projects").set(auth).query({ sort: "name" });
    expect(res.body.projects.map((p: { name: string }) => p.name)).toEqual(["Apple", "banana"]);
  });

  it("returns an empty list for a new user and rejects invalid query values", async () => {
    const { auth } = await createUser();
    expect((await request(app).get("/api/projects").set(auth)).body.projects).toEqual([]);
    expect((await request(app).get("/api/projects").set(auth).query({ sort: "bogus" })).status).toBe(400);
    expect((await request(app).get("/api/projects").set(auth).query({ limit: 0 })).status).toBe(400);
  });
});

describe("project ownership", () => {
  it("hides, and refuses to modify, another user's project", async () => {
    const owner = await createUser("Owner");
    const intruder = await createUser("Intruder");
    const project = await createProject(owner.auth, "Private");

    expect((await request(app).get(`/api/projects/${project.id}`).set(intruder.auth)).status).toBe(404);
    expect(
      (await request(app).patch(`/api/projects/${project.id}`).set(intruder.auth).send({ name: "Hacked" })).status,
    ).toBe(404);
    expect((await request(app).delete(`/api/projects/${project.id}`).set(intruder.auth)).status).toBe(404);

    const list = await request(app).get("/api/projects").set(intruder.auth);
    expect(list.body.projects).toEqual([]);

    const intact = await request(app).get(`/api/projects/${project.id}`).set(owner.auth);
    expect(intact.body.project.name).toBe("Private");
  });
});
