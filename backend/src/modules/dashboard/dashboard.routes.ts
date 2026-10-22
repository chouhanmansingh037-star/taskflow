import { Router } from "express";
import { pool } from "../../db.js";
import { currentUser, requireAuth } from "../../middleware/auth.js";
import { listProjects } from "../projects/projects.service.js";

export const dashboardRouter = Router();
dashboardRouter.use(requireAuth);

interface StatsRow {
  total_projects: number;
  total_tasks: number;
  todo: number;
  in_progress: number;
  done: number;
  overdue: number;
}

dashboardRouter.get("/", async (req, res, next) => {
  try {
    const userId = currentUser(req).id;
    // Everything is aggregated in the database; the scalar subquery counts projects that have no tasks yet.
    const { rows } = await pool.query<StatsRow>(
      `SELECT
         (SELECT count(*) FROM projects WHERE user_id = $1) AS total_projects,
         count(t.id) AS total_tasks,
         count(t.id) FILTER (WHERE t.status = 'todo') AS todo,
         count(t.id) FILTER (WHERE t.status = 'in_progress') AS in_progress,
         count(t.id) FILTER (WHERE t.status = 'done') AS done,
         count(t.id) FILTER (
           WHERE t.status <> 'done' AND t.due_date < (now() AT TIME ZONE 'UTC')::date
         ) AS overdue
       FROM tasks t
       JOIN projects p ON p.id = t.project_id
       WHERE p.user_id = $1`,
      [userId],
    );
    const stats = rows[0];
    const projectProgress = await listProjects(userId, { sort: "updated", limit: 5 });

    res.json({
      totalProjects: stats.total_projects,
      totalTasks: stats.total_tasks,
      completedTasks: stats.done,
      overdueTasks: stats.overdue,
      completionRate: stats.total_tasks === 0 ? 0 : Math.round((stats.done / stats.total_tasks) * 100),
      tasksByStatus: { todo: stats.todo, in_progress: stats.in_progress, done: stats.done },
      projectProgress,
    });
  } catch (err) {
    next(err);
  }
});
