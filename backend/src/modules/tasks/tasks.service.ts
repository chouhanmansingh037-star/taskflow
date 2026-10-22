import { pool } from "../../db.js";
import { notFound } from "../../errors.js";
import { escapeLike } from "../../validation.js";

export type TaskStatus = "todo" | "in_progress" | "done";
export type TaskPriority = "low" | "medium" | "high";

interface TaskRow {
  id: string;
  project_id: string;
  project_name: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  overdue: boolean;
  created_at: Date;
  updated_at: Date;
}

const toTask = (row: TaskRow) => ({
  id: row.id,
  projectId: row.project_id,
  projectName: row.project_name,
  title: row.title,
  description: row.description,
  status: row.status,
  priority: row.priority,
  dueDate: row.due_date,
  overdue: row.overdue,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

// A task is overdue when its due date (a plain date, compared in UTC) is before today and it isn't done.
const TASK_SELECT = `
  SELECT t.id, t.project_id, p.name AS project_name, t.title, t.description, t.status, t.priority,
         t.due_date, t.created_at, t.updated_at,
         (t.due_date IS NOT NULL AND t.status <> 'done' AND t.due_date < (now() AT TIME ZONE 'UTC')::date) AS overdue
  FROM tasks t
  JOIN projects p ON p.id = t.project_id`;

const PRIORITY_RANK = "CASE t.priority WHEN 'high' THEN 3 WHEN 'medium' THEN 2 ELSE 1 END";
const SORT_EXPRESSIONS = {
  created: "t.created_at",
  due: "t.due_date",
  priority: PRIORITY_RANK,
  title: "lower(t.title)",
} as const;

export type TaskSort = keyof typeof SORT_EXPRESSIONS;

export interface TaskFilters {
  projectId?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  search?: string;
  sort: TaskSort;
  order: "asc" | "desc";
  page: number;
  limit: number;
}

export async function listTasks(userId: string, filters: TaskFilters) {
  const params: unknown[] = [userId];
  const conditions = ["p.user_id = $1"];
  const add = (sql: string, value: unknown) => {
    params.push(value);
    conditions.push(sql.replace("?", `$${params.length}`));
  };

  if (filters.projectId) add("t.project_id = ?", filters.projectId);
  if (filters.status) add("t.status = ?", filters.status);
  if (filters.priority) add("t.priority = ?", filters.priority);
  if (filters.search) add("t.title ILIKE ? ESCAPE '\\'", `%${escapeLike(filters.search)}%`);

  const where = `WHERE ${conditions.join(" AND ")}`;
  const direction = filters.order === "asc" ? "ASC" : "DESC";
  // Tasks without a due date always sort last; created_at/id keep paging stable.
  const orderBy = `${SORT_EXPRESSIONS[filters.sort]} ${direction} NULLS LAST, t.created_at DESC, t.id`;

  const countResult = await pool.query<{ total: number }>(
    `SELECT count(*) AS total FROM tasks t JOIN projects p ON p.id = t.project_id ${where}`,
    params,
  );
  const { rows } = await pool.query<TaskRow>(
    `${TASK_SELECT} ${where} ORDER BY ${orderBy} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, filters.limit, (filters.page - 1) * filters.limit],
  );

  return {
    tasks: rows.map(toTask),
    pagination: {
      page: filters.page,
      limit: filters.limit,
      total: countResult.rows[0].total,
      totalPages: Math.max(1, Math.ceil(countResult.rows[0].total / filters.limit)),
    },
  };
}

export async function getTask(userId: string, taskId: string) {
  const { rows } = await pool.query<TaskRow>(`${TASK_SELECT} WHERE t.id = $1 AND p.user_id = $2`, [
    taskId,
    userId,
  ]);
  if (!rows[0]) throw notFound("Task");
  return toTask(rows[0]);
}

export interface NewTask {
  projectId: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null;
}

export async function createTask(userId: string, input: NewTask) {
  // Ownership is checked in the same statement that inserts, so there is no window between check and write.
  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO tasks (project_id, title, description, status, priority, due_date)
     SELECT p.id, $3, $4, $5, $6, $7 FROM projects p WHERE p.id = $1 AND p.user_id = $2
     RETURNING id`,
    [input.projectId, userId, input.title, input.description, input.status, input.priority, input.dueDate],
  );
  if (!rows[0]) throw notFound("Project");
  return getTask(userId, rows[0].id);
}

export type TaskChanges = Partial<Omit<NewTask, "projectId">>;

const UPDATABLE_COLUMNS: Record<keyof TaskChanges, string> = {
  title: "title",
  description: "description",
  status: "status",
  priority: "priority",
  dueDate: "due_date",
};

export async function updateTask(userId: string, taskId: string, changes: TaskChanges) {
  const params: unknown[] = [taskId, userId];
  const assignments: string[] = [];
  for (const key of Object.keys(UPDATABLE_COLUMNS) as (keyof TaskChanges)[]) {
    if (changes[key] === undefined) continue;
    params.push(changes[key]);
    assignments.push(`${UPDATABLE_COLUMNS[key]} = $${params.length}`);
  }

  const { rowCount } = await pool.query(
    `UPDATE tasks t SET ${assignments.join(", ")}, updated_at = now()
     FROM projects p
     WHERE t.id = $1 AND t.project_id = p.id AND p.user_id = $2`,
    params,
  );
  if (!rowCount) throw notFound("Task");
  return getTask(userId, taskId);
}

export async function deleteTask(userId: string, taskId: string): Promise<void> {
  const { rowCount } = await pool.query(
    `DELETE FROM tasks t USING projects p
     WHERE t.id = $1 AND t.project_id = p.id AND p.user_id = $2`,
    [taskId, userId],
  );
  if (!rowCount) throw notFound("Task");
}
