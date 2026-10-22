"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { ConfirmDialog, Modal } from "@/components/Modal";
import { ProjectForm } from "@/components/ProjectForm";
import { TaskWorkspace } from "@/components/TaskWorkspace";
import { EmptyState, ErrorAlert, LoadingState, ProgressBar } from "@/components/ui";
import { useApiData } from "@/hooks/useApiData";
import { api, ApiError } from "@/lib/api";
import { formatTimestamp, pluralize } from "@/lib/format";

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data, loading, error, reload } = useApiData((signal) => api.getProject(id, signal), [id]);
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleDelete() {
    setDeleteBusy(true);
    try {
      await api.deleteProject(id);
      router.replace("/projects");
    } catch (err) {
      setConfirmingDelete(false);
      setDeleteError(err instanceof ApiError ? err.message : "Could not delete the project");
      setDeleteBusy(false);
    }
  }

  if (loading && !data) return <LoadingState label="Loading project…" />;

  // A missing project and one owned by someone else are indistinguishable by design.
  if (!data) {
    return (
      <>
        <p className="breadcrumb">
          <Link href="/projects">← Projects</Link>
        </p>
        {error && !error.toLowerCase().includes("not found") ? (
          <ErrorAlert message={error} onRetry={reload} />
        ) : (
          <EmptyState
            title="Project not found"
            message="It may have been deleted, or you may not have access to it."
            action={
              <Link href="/projects" className="btn btn-primary">
                Back to projects
              </Link>
            }
          />
        )}
      </>
    );
  }

  const project = data.project;
  return (
    <>
      <p className="breadcrumb">
        <Link href="/projects">← Projects</Link>
      </p>
      <div className="page-head">
        <div>
          <h1>{project.name}</h1>
          <p>{project.description || "No description"}</p>
          <p>Created {formatTimestamp(project.createdAt)}</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" className="btn" onClick={() => setEditing(true)}>
            Edit
          </button>
          <button type="button" className="btn btn-danger" onClick={() => setConfirmingDelete(true)}>
            Delete
          </button>
        </div>
      </div>

      {deleteError && <ErrorAlert message={deleteError} />}

      <section className="card" style={{ marginBottom: 18 }}>
        <div className="progress-row" style={{ marginBottom: 0 }}>
          <div className="meta">
            <span>
              {project.completedCount} of {pluralize(project.taskCount, "task")} completed
            </span>
            <span className="pct">{project.progress}%</span>
          </div>
          <ProgressBar percent={project.progress} label="Project progress" />
        </div>
      </section>

      <TaskWorkspace lockedProjectId={project.id} onChanged={reload} />

      {editing && (
        <Modal title="Edit project" onClose={() => setEditing(false)}>
          <ProjectForm
            project={project}
            onCancel={() => setEditing(false)}
            onSaved={() => {
              setEditing(false);
              reload();
            }}
          />
        </Modal>
      )}
      {confirmingDelete && (
        <ConfirmDialog
          title="Delete project"
          message={`Delete "${project.name}" and all ${pluralize(project.taskCount, "task")} in it? This cannot be undone.`}
          confirmLabel="Delete project"
          busy={deleteBusy}
          onConfirm={() => void handleDelete()}
          onCancel={() => setConfirmingDelete(false)}
        />
      )}
    </>
  );
}
