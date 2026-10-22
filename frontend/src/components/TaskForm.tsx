"use client";

import { useState, type FormEvent } from "react";
import { api, ApiError } from "@/lib/api";
import { PRIORITY_LABELS, STATUS_LABELS } from "@/lib/format";
import { TASK_PRIORITIES, TASK_STATUSES, type Project, type Task, type TaskPriority, type TaskStatus } from "@/lib/types";
import { ErrorAlert, Field } from "./ui";

/** Creates a task, or edits one when `task` is given. The project can only be chosen at creation. */
export function TaskForm({
  task,
  projects,
  defaultProjectId,
  onSaved,
  onCancel,
}: {
  task?: Task;
  projects: Project[];
  defaultProjectId?: string;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [projectId, setProjectId] = useState(task?.projectId ?? defaultProjectId ?? projects[0]?.id ?? "");
  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [status, setStatus] = useState<TaskStatus>(task?.status ?? "todo");
  const [priority, setPriority] = useState<TaskPriority>(task?.priority ?? "medium");
  const [dueDate, setDueDate] = useState(task?.dueDate ?? "");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;

    const problems: Record<string, string> = {};
    if (!title.trim()) problems.title = "Title is required";
    if (!task && !projectId) problems.projectId = "Choose a project";
    if (Object.keys(problems).length) {
      setFieldErrors(problems);
      return;
    }

    setSaving(true);
    setError(null);
    setFieldErrors({});
    try {
      const fields = {
        title: title.trim(),
        description: description.trim(),
        status,
        priority,
        dueDate: dueDate || null,
      };
      if (task) await api.updateTask(task.id, fields);
      else await api.createTask({ projectId, ...fields });
      onSaved();
    } catch (err) {
      if (err instanceof ApiError && err.details.length) setFieldErrors(err.fieldErrors);
      else setError(err instanceof ApiError ? err.message : "Could not save the task");
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      {error && <ErrorAlert message={error} />}
      {!task && (
        <Field label="Project" htmlFor="task-project" error={fieldErrors.projectId}>
          <select
            id="task-project"
            className="select"
            value={projectId}
            aria-invalid={!!fieldErrors.projectId}
            onChange={(e) => setProjectId(e.target.value)}
          >
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </Field>
      )}
      <Field label="Title" htmlFor="task-title" error={fieldErrors.title}>
        <input
          id="task-title"
          className="input"
          value={title}
          maxLength={200}
          autoFocus
          aria-invalid={!!fieldErrors.title}
          aria-describedby={fieldErrors.title ? "task-title-error" : undefined}
          onChange={(e) => setTitle(e.target.value)}
        />
      </Field>
      <Field label="Description" htmlFor="task-description" error={fieldErrors.description}>
        <textarea
          id="task-description"
          className="textarea"
          value={description}
          maxLength={5000}
          onChange={(e) => setDescription(e.target.value)}
        />
      </Field>
      <div className="form-row">
        <Field label="Status" htmlFor="task-status">
          <select id="task-status" className="select" value={status} onChange={(e) => setStatus(e.target.value as TaskStatus)}>
            {TASK_STATUSES.map((value) => (
              <option key={value} value={value}>
                {STATUS_LABELS[value]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Priority" htmlFor="task-priority">
          <select
            id="task-priority"
            className="select"
            value={priority}
            onChange={(e) => setPriority(e.target.value as TaskPriority)}
          >
            {TASK_PRIORITIES.map((value) => (
              <option key={value} value={value}>
                {PRIORITY_LABELS[value]}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Due date" htmlFor="task-due" error={fieldErrors.dueDate}>
        <input
          id="task-due"
          type="date"
          className="input"
          value={dueDate}
          aria-invalid={!!fieldErrors.dueDate}
          onChange={(e) => setDueDate(e.target.value)}
        />
      </Field>
      <div className="form-actions">
        <button type="button" className="btn" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? "Saving…" : task ? "Save changes" : "Create task"}
        </button>
      </div>
    </form>
  );
}
