import { pool } from "../../db.js";
import { notFound } from "../../errors.js";
import { escapeLike } from "../../validation.js";

interface ProjectRow {
  id: string;
  name: string;
  description: string;
  created_at: Date;
  updated_at: Date;
  task_count: number;
  completed_count: number;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
  taskCount: number;
  completedCount: number;
  progress: number;
}

export const toProject = (row: ProjectRow): Project => ({
  id: row.id,
  name: row.name,
  description: row.description,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  taskCount: row.task_count,
  completedCount: row.completed_count,
  progress: row.task_count === 0 ? 0 : Math.round((row.completed_count / row.task_count) * 100),
});

// Every query filters on user_id, so a project that belongs to someone else behaves exactly like a missing one.
const PROJECT_SELECT = `
  SELECT p.id, p.name, p.description, p.created_at, p.updated_at,
         count(t.id) AS task_count,
         count(t.id) FILTER (WHERE t.status = 'done') AS completed_count
  FROM projects p
  LEFT JOIN tasks t ON t.project_id = p.id`;

const SORT_COLUMNS = {
  updated: "p.updated_at DESC",
  created: "p.created_at DESC",
  name: "lower(p.name) ASC",
} as const;

export type ProjectSort = keyof typeof SORT_COLUMNS;

export async function listProjects(
  userId: string,
  opts: { search?: string; sort: ProjectSort; limit: number },
): Promise<Project[]> {
  const params: unknown[] = [userId];
  let where = "WHERE p.user_id = $1";
  if (opts.search) {
    params.push(`%${escapeLike(opts.search)}%`);
    where += ` AND p.name ILIKE $${params.length} ESCAPE '\\'`;
  }
  params.push(opts.limit);
  const { rows } = await pool.query<ProjectRow>(
    `${PROJECT_SELECT} ${where} GROUP BY p.id ORDER BY ${SORT_COLUMNS[opts.sort]}, p.id LIMIT $${params.length}`,
    params,
  );
  return rows.map(toProject);
}

export async function getProject(userId: string, projectId: string): Promise<Project> {
  const { rows } = await pool.query<ProjectRow>(
    `${PROJECT_SELECT} WHERE p.id = $1 AND p.user_id = $2 GROUP BY p.id`,
    [projectId, userId],
  );
  if (!rows[0]) throw notFound("Project");
  return toProject(rows[0]);
}

export async function createProject(userId: string, input: { name: string; description: string }) {
  const { rows } = await pool.query<{ id: string }>(
    "INSERT INTO projects (user_id, name, description) VALUES ($1, $2, $3) RETURNING id",
    [userId, input.name, input.description],
  );
  return getProject(userId, rows[0].id);
}

export async function updateProject(
  userId: string,
  projectId: string,
  input: { name?: string; description?: string },
) {
  const { rowCount } = await pool.query(
    `UPDATE projects
     SET name = COALESCE($3, name), description = COALESCE($4, description), updated_at = now()
     WHERE id = $1 AND user_id = $2`,
    [projectId, userId, input.name ?? null, input.description ?? null],
  );
  if (!rowCount) throw notFound("Project");
  return getProject(userId, projectId);
}

export async function deleteProject(userId: string, projectId: string): Promise<void> {
  // Tasks are removed by the ON DELETE CASCADE foreign key.
  const { rowCount } = await pool.query("DELETE FROM projects WHERE id = $1 AND user_id = $2", [
    projectId,
    userId,
  ]);
  if (!rowCount) throw notFound("Project");
}
