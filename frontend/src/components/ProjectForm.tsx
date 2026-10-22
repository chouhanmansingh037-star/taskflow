"use client";

import { useState, type FormEvent } from "react";
import { api, ApiError } from "@/lib/api";
import type { Project } from "@/lib/types";
import { ErrorAlert, Field } from "./ui";

/** Creates a project, or edits one when `project` is given. */
export function ProjectForm({
  project,
  onSaved,
  onCancel,
}: {
  project?: Project;
  onSaved: (project: Project) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(project?.name ?? "");
  const [description, setDescription] = useState(project?.description ?? "");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    if (!name.trim()) {
      setFieldErrors({ name: "Name is required" });
      return;
    }
    setSaving(true);
    setError(null);
    setFieldErrors({});
    try {
      const input = { name: name.trim(), description: description.trim() };
      const result = project ? await api.updateProject(project.id, input) : await api.createProject(input);
      onSaved(result.project);
    } catch (err) {
      if (err instanceof ApiError && err.details.length) setFieldErrors(err.fieldErrors);
      else setError(err instanceof ApiError ? err.message : "Could not save the project");
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      {error && <ErrorAlert message={error} />}
      <Field label="Name" htmlFor="project-name" error={fieldErrors.name}>
        <input
          id="project-name"
          className="input"
          value={name}
          maxLength={120}
          autoFocus
          aria-invalid={!!fieldErrors.name}
          aria-describedby={fieldErrors.name ? "project-name-error" : undefined}
          onChange={(e) => setName(e.target.value)}
        />
      </Field>
      <Field label="Description" htmlFor="project-description" error={fieldErrors.description}>
        <textarea
          id="project-description"
          className="textarea"
          value={description}
          maxLength={2000}
          onChange={(e) => setDescription(e.target.value)}
        />
      </Field>
      <div className="form-actions">
        <button type="button" className="btn" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? "Saving…" : project ? "Save changes" : "Create project"}
        </button>
      </div>
    </form>
  );
}
