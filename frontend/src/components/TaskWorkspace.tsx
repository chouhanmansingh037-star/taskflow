"use client";

import Link from "next/link";
import { useState } from "react";
import { useApiData } from "@/hooks/useApiData";
import { useDebounce } from "@/hooks/useDebounce";
import { api, ApiError } from "@/lib/api";
import { PRIORITY_LABELS, STATUS_LABELS } from "@/lib/format";
import { TASK_PRIORITIES, TASK_STATUSES, type Task, type TaskPriority, type TaskStatus } from "@/lib/types";
import { ConfirmDialog, Modal } from "./Modal";
import { TaskCard } from "./TaskCard";
import { TaskForm } from "./TaskForm";
import { EmptyState, ErrorAlert, LoadingState } from "./ui";

const PAGE_LIMIT = 200;
const STATUS_COLORS: Record<TaskStatus, string> = { todo: "var(--amber)", in_progress: "var(--primary)", done: "var(--green)" };

/**
 * Filterable task board. Used on the Tasks page (all projects) and on a project's
 * page, where `lockedProjectId` pins it to that project.
 */
export function TaskWorkspace({ lockedProjectId, onChanged }: { lockedProjectId?: string; onChanged?: () => void }) {
  const [projectId, setProjectId] = useState("");
  const [status, setStatus] = useState<TaskStatus | "">("");
  const [priority, setPriority] = useState<TaskPriority | "">("");
  const [searchInput, setSearchInput] = useState("");
  const search = useDebounce(searchInput.trim());

  const [editing, setEditing] = useState<Task | "new" | null>(null);
  const [deleting, setDeleting] = useState<Task | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const effectiveProjectId = lockedProjectId ?? projectId;
  const projects = useApiData((signal) => api.listProjects({ sort: "name" }, signal), []);
  const tasks = useApiData(
    (signal) =>
      api.listTasks({ projectId: effectiveProjectId, status, priority, search, sort: "due", order: "asc", limit: PAGE_LIMIT }, signal),
    [effectiveProjectId, status, priority, search],
  );

  const hasFilters = Boolean(status || priority || searchInput || (!lockedProjectId && projectId));
  const visibleStatuses = status ? [status] : TASK_STATUSES;
  const taskList = tasks.data?.tasks ?? [];
  const projectList = projects.data?.projects ?? [];

  function refresh() {
    tasks.reload();
    onChanged?.();
  }

  async function changeStatus(task: Task, next: TaskStatus) {
    setBusyTaskId(task.id);
    setActionError(null);
    try {
      await api.updateTask(task.id, { status: next });
      refresh();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Could not update the task");
    } finally {
      setBusyTaskId(null);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await api.deleteTask(deleting.id);
      setDeleting(null);
      refresh();
    } catch (err) {
      setDeleting(null);
      setActionError(err instanceof ApiError ? err.message : "Could not delete the task");
    } finally {
      setDeleteBusy(false);
    }
  }

  function clearFilters() {
    setStatus("");
    setPriority("");
    setSearchInput("");
    setProjectId("");
  }

  const newTaskButton = (
    <button
      type="button"
      className="btn btn-primary"
      onClick={() => setEditing("new")}
      disabled={projectList.length === 0}
      title={projectList.length === 0 ? "Create a project first" : undefined}
    >
      + New Task
    </button>
  );

  return (
    <>
      <div className="toolbar">
        {!lockedProjectId && (
          <>
            <label className="sr-only" htmlFor="filter-project">
              Project
            </label>
            <select id="filter-project" className="select" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              <option value="">All Projects</option>
              {projectList.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </>
        )}
        <label className="sr-only" htmlFor="filter-status">
          Status
        </label>
        <select id="filter-status" className="select" value={status} onChange={(e) => setStatus(e.target.value as TaskStatus | "")}>
          <option value="">All Statuses</option>
          {TASK_STATUSES.map((value) => (
            <option key={value} value={value}>
              {STATUS_LABELS[value]}
            </option>
          ))}
        </select>
        <label className="sr-only" htmlFor="filter-priority">
          Priority
        </label>
        <select
          id="filter-priority"
          className="select"
          value={priority}
          onChange={(e) => setPriority(e.target.value as TaskPriority | "")}
        >
          <option value="">All Priorities</option>
          {TASK_PRIORITIES.map((value) => (
            <option key={value} value={value}>
              {PRIORITY_LABELS[value]}
            </option>
          ))}
        </select>
        <label className="sr-only" htmlFor="filter-search">
          Search tasks by title
        </label>
        <input
          id="filter-search"
          type="search"
          className="input"
          placeholder="Search tasks…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
        <span className="grow" />
        {newTaskButton}
      </div>

      {actionError && <ErrorAlert message={actionError} />}
      {tasks.error && <ErrorAlert message={tasks.error} onRetry={tasks.reload} />}

      {tasks.loading && !tasks.data ? (
        <LoadingState label="Loading tasks…" />
      ) : tasks.data && taskList.length === 0 ? (
        hasFilters ? (
          <EmptyState
            title="No matching tasks"
            message="Nothing matches your search and filters. Try different keywords or clear the filters."
            action={
              <button type="button" className="btn" onClick={clearFilters}>
                Clear filters
              </button>
            }
          />
        ) : (
          <EmptyState
            title="No tasks yet"
            message={
              projectList.length === 0
                ? "Create a project first, then add tasks to it."
                : "Add your first task to start tracking work."
            }
            action={
              projectList.length === 0 ? (
                <Link href="/projects" className="btn btn-primary">
                  Go to projects
                </Link>
              ) : (
                newTaskButton
              )
            }
          />
        )
      ) : (
        tasks.data && (
          <>
            <div className="board" aria-busy={tasks.loading}>
              {visibleStatuses.map((column) => {
                const columnTasks = taskList.filter((task) => task.status === column);
                return (
                  <section key={column} className="column" aria-labelledby={`col-${column}`}>
                    <h2 className="column-head" id={`col-${column}`}>
                      <span className="dot" style={{ background: STATUS_COLORS[column] }} aria-hidden="true" />
                      {STATUS_LABELS[column]}
                      <span className="count">{columnTasks.length}</span>
                    </h2>
                    {columnTasks.length === 0 && <p className="column-empty">No tasks</p>}
                    {columnTasks.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        showProject={!lockedProjectId}
                        busy={busyTaskId === task.id}
                        onStatusChange={(next) => void changeStatus(task, next)}
                        onEdit={() => setEditing(task)}
                        onDelete={() => setDeleting(task)}
                      />
                    ))}
                  </section>
                );
              })}
            </div>
            {tasks.data.pagination.total > PAGE_LIMIT && (
              <p className="sub" style={{ marginTop: 12, color: "var(--muted)", fontSize: 13 }}>
                Showing the first {PAGE_LIMIT} of {tasks.data.pagination.total} tasks. Use the filters to narrow the list.
              </p>
            )}
          </>
        )
      )}

      {editing && (
        <Modal title={editing === "new" ? "New task" : "Edit task"} onClose={() => setEditing(null)}>
          <TaskForm
            task={editing === "new" ? undefined : editing}
            projects={projectList}
            defaultProjectId={lockedProjectId ?? (projectId || undefined)}
            onCancel={() => setEditing(null)}
            onSaved={() => {
              setEditing(null);
              refresh();
            }}
          />
        </Modal>
      )}
      {deleting && (
        <ConfirmDialog
          title="Delete task"
          message={`Delete "${deleting.title}"? This cannot be undone.`}
          confirmLabel="Delete task"
          busy={deleteBusy}
          onConfirm={() => void confirmDelete()}
          onCancel={() => setDeleting(null)}
        />
      )}
    </>
  );
}
