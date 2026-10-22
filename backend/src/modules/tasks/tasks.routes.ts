import { Router } from "express";
import { z } from "zod";
import { currentUser, requireAuth } from "../../middleware/auth.js";
import { isoDateSchema, parse, trimmedString, uuidSchema } from "../../validation.js";
import { createTask, deleteTask, getTask, listTasks, updateTask } from "./tasks.service.js";

const statusSchema = z.enum(["todo", "in_progress", "done"]);
const prioritySchema = z.enum(["low", "medium", "high"]);

const createSchema = z
  .object({
    projectId: uuidSchema,
    title: trimmedString(200).min(1, "Title is required"),
    description: trimmedString(5000).default(""),
    status: statusSchema.default("todo"),
    priority: prioritySchema.default("medium"),
    dueDate: isoDateSchema.nullable().default(null),
  })
  .strict();

const updateSchema = z
  .object({
    title: trimmedString(200).min(1, "Title cannot be empty").optional(),
    description: trimmedString(5000).optional(),
    status: statusSchema.optional(),
    priority: prioritySchema.optional(),
    dueDate: isoDateSchema.nullable().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, "Provide at least one field to update");

const listQuerySchema = z.object({
  projectId: uuidSchema.optional(),
  status: statusSchema.optional(),
  priority: prioritySchema.optional(),
  search: trimmedString(200).optional(),
  sort: z.enum(["created", "due", "priority", "title"]).default("created"),
  order: z.enum(["asc", "desc"]).default("desc"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

const idParams = z.object({ id: uuidSchema });

export const tasksRouter = Router();
tasksRouter.use(requireAuth);

tasksRouter.get("/", async (req, res, next) => {
  try {
    res.json(await listTasks(currentUser(req).id, parse(listQuerySchema, req.query)));
  } catch (err) {
    next(err);
  }
});

tasksRouter.post("/", async (req, res, next) => {
  try {
    const task = await createTask(currentUser(req).id, parse(createSchema, req.body));
    res.status(201).json({ task });
  } catch (err) {
    next(err);
  }
});

tasksRouter.get("/:id", async (req, res, next) => {
  try {
    const { id } = parse(idParams, req.params);
    res.json({ task: await getTask(currentUser(req).id, id) });
  } catch (err) {
    next(err);
  }
});

tasksRouter.patch("/:id", async (req, res, next) => {
  try {
    const { id } = parse(idParams, req.params);
    const task = await updateTask(currentUser(req).id, id, parse(updateSchema, req.body));
    res.json({ task });
  } catch (err) {
    next(err);
  }
});

tasksRouter.delete("/:id", async (req, res, next) => {
  try {
    const { id } = parse(idParams, req.params);
    await deleteTask(currentUser(req).id, id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
