import { Router } from "express";
import { z } from "zod";
import { currentUser, requireAuth } from "../../middleware/auth.js";
import { parse, trimmedString, uuidSchema } from "../../validation.js";
import {
  createProject,
  deleteProject,
  getProject,
  listProjects,
  updateProject,
} from "./projects.service.js";

const createSchema = z
  .object({
    name: trimmedString(120).min(1, "Name is required"),
    description: trimmedString(2000).default(""),
  })
  .strict();

const updateSchema = z
  .object({
    name: trimmedString(120).min(1, "Name cannot be empty").optional(),
    description: trimmedString(2000).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, "Provide at least one field to update");

const listQuerySchema = z.object({
  search: trimmedString(120).optional(),
  sort: z.enum(["updated", "created", "name"]).default("updated"),
  limit: z.coerce.number().int().min(1).max(100).default(100),
});

const idParams = z.object({ id: uuidSchema });

export const projectsRouter = Router();
projectsRouter.use(requireAuth);

projectsRouter.get("/", async (req, res, next) => {
  try {
    const query = parse(listQuerySchema, req.query);
    res.json({ projects: await listProjects(currentUser(req).id, query) });
  } catch (err) {
    next(err);
  }
});

projectsRouter.post("/", async (req, res, next) => {
  try {
    const project = await createProject(currentUser(req).id, parse(createSchema, req.body));
    res.status(201).json({ project });
  } catch (err) {
    next(err);
  }
});

projectsRouter.get("/:id", async (req, res, next) => {
  try {
    const { id } = parse(idParams, req.params);
    res.json({ project: await getProject(currentUser(req).id, id) });
  } catch (err) {
    next(err);
  }
});

projectsRouter.patch("/:id", async (req, res, next) => {
  try {
    const { id } = parse(idParams, req.params);
    const project = await updateProject(currentUser(req).id, id, parse(updateSchema, req.body));
    res.json({ project });
  } catch (err) {
    next(err);
  }
});

projectsRouter.delete("/:id", async (req, res, next) => {
  try {
    const { id } = parse(idParams, req.params);
    await deleteProject(currentUser(req).id, id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
