"use client";

import Link from "next/link";
import { ErrorAlert, EmptyState, LoadingState, ProgressBar } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useApiData } from "@/hooks/useApiData";
import { api } from "@/lib/api";
import { greeting, pluralize, STATUS_LABELS } from "@/lib/format";
import { TASK_STATUSES, type Dashboard, type TaskStatus } from "@/lib/types";

const STATUS_COLORS: Record<TaskStatus, string> = { done: "#16a34a", in_progress: "#2563eb", todo: "#d97706" };
const PROJECT_COLORS = ["#2563eb", "#7c3aed", "#16a34a", "#d97706", "#0891b2"];

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="card stat">
      <div className="label">{label}</div>
      <div className="value" style={{ color }}>
        {value}
      </div>
      <div className="hint">Across all projects</div>
    </div>
  );
}

/** Conic-gradient donut built from the real status counts. */
function StatusDonut({ data }: { data: Dashboard }) {
  const total = data.totalTasks;
  let offset = 0;
  const segments = (["done", "in_progress", "todo"] as TaskStatus[]).map((status) => {
    const start = offset;
    offset += total === 0 ? 0 : (data.tasksByStatus[status] / total) * 100;
    return `${STATUS_COLORS[status]} ${start}% ${offset}%`;
  });
  const background = total === 0 ? "#e2e8f0" : `conic-gradient(${segments.join(", ")})`;

  return (
    <div className="donut-wrap">
      <div className="donut" style={{ background }} role="img" aria-label={`${data.completionRate}% of tasks complete`}>
        <div className="donut-hole">
          <div>
            <strong>{data.completionRate}%</strong>
            <span>complete</span>
          </div>
        </div>
      </div>
      <ul className="legend">
        {TASK_STATUSES.slice()
          .reverse()
          .map((status) => (
            <li key={status}>
              <span className="dot" style={{ background: STATUS_COLORS[status] }} aria-hidden="true" />
              {status === "done" ? "Completed" : STATUS_LABELS[status]}
              <b>{data.tasksByStatus[status]}</b>
            </li>
          ))}
      </ul>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { data, loading, error, reload } = useApiData((signal) => api.dashboard(signal), []);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Dashboard</h1>
          <p>
            {greeting()}, {user?.name.split(" ")[0]}! Here&apos;s what&apos;s happening with your projects today.
          </p>
        </div>
      </div>

      {error && <ErrorAlert message={error} onRetry={reload} />}
      {loading && !data && <LoadingState label="Loading dashboard…" />}

      {data && (
        <>
          <div className="stats">
            <StatCard label="Total Projects" value={data.totalProjects} color="var(--primary)" />
            <StatCard label="Total Tasks" value={data.totalTasks} color="var(--purple)" />
            <StatCard label="Completed" value={data.completedTasks} color="var(--green)" />
            <StatCard label="Overdue" value={data.overdueTasks} color="var(--red)" />
          </div>

          {data.totalProjects === 0 ? (
            <EmptyState
              title="Nothing here yet"
              message="Create your first project to start tracking tasks and progress."
              action={
                <Link href="/projects" className="btn btn-primary">
                  Create a project
                </Link>
              }
            />
          ) : (
            <div className="panels">
              <section className="card">
                <h2>Project progress</h2>
                <p className="sub">Completion across your most recently updated projects</p>
                {data.projectProgress.map((project, index) => {
                  const color = PROJECT_COLORS[index % PROJECT_COLORS.length];
                  return (
                    <div className="progress-row" key={project.id}>
                      <div className="meta">
                        <span>
                          <Link href={`/projects/${project.id}`}>
                            <strong>{project.name}</strong>
                          </Link>
                          <small>
                            {project.completedCount} of {pluralize(project.taskCount, "task")}
                          </small>
                        </span>
                        <span className="pct" style={{ color }}>
                          {project.progress}%
                        </span>
                      </div>
                      <ProgressBar percent={project.progress} color={color} label={`${project.name} progress`} />
                    </div>
                  );
                })}
              </section>
              <section className="card">
                <h2>Tasks by status</h2>
                <p className="sub">Across all projects</p>
                <StatusDonut data={data} />
              </section>
            </div>
          )}
        </>
      )}
    </>
  );
}
