"use client";

import Link from "next/link";
import { useState } from "react";
import { Modal } from "@/components/Modal";
import { ProjectForm } from "@/components/ProjectForm";
import { EmptyState, ErrorAlert, LoadingState, ProgressBar } from "@/components/ui";
import { useApiData } from "@/hooks/useApiData";
import { useDebounce } from "@/hooks/useDebounce";
import { api } from "@/lib/api";
import { formatTimestamp, pluralize } from "@/lib/format";

export default function ProjectsPage() {
  const [searchInput, setSearchInput] = useState("");
  const [sort, setSort] = useState("updated");
  const [creating, setCreating] = useState(false);
  const search = useDebounce(searchInput.trim());

  const { data, loading, error, reload } = useApiData(
    (signal) => api.listProjects({ search, sort }, signal),
    [search, sort],
  );
  const projects = data?.projects ?? [];

  const newProjectButton = (
    <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
      + New Project
    </button>
  );

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Projects</h1>
          <p>Manage your projects and track progress.</p>
        </div>
        {newProjectButton}
      </div>

      <div className="toolbar">
        <label className="sr-only" htmlFor="project-search">
          Search projects
        </label>
        <input
          id="project-search"
          type="search"
          className="input"
          placeholder="Search projects…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
        <span className="grow" />
        <label htmlFor="project-sort" className="sr-only">
          Sort projects
        </label>
        <select id="project-sort" className="select" value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="updated">Sort: Recently updated</option>
          <option value="created">Sort: Newest</option>
          <option value="name">Sort: Name</option>
        </select>
      </div>

      {error && <ErrorAlert message={error} onRetry={reload} />}
      {loading && !data ? (
        <LoadingState label="Loading projects…" />
      ) : data && projects.length === 0 ? (
        search ? (
          <EmptyState title="No matching projects" message={`No projects match "${search}".`} />
        ) : (
          <EmptyState title="No projects yet" message="Create a project to start adding tasks." action={newProjectButton} />
        )
      ) : (
        <div className="project-grid" aria-busy={loading}>
          {projects.map((project) => (
            <Link key={project.id} href={`/projects/${project.id}`} className="card project-card">
              <h3>{project.name}</h3>
              <p>{project.description || "No description"}</p>
              <div className="meta">
                <span>
                  {project.completedCount} of {pluralize(project.taskCount, "task")} completed
                </span>
                <strong>{project.progress}%</strong>
              </div>
              <ProgressBar percent={project.progress} label={`${project.name} progress`} />
              <div className="meta">
                <span>Created {formatTimestamp(project.createdAt)}</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {creating && (
        <Modal title="New project" onClose={() => setCreating(false)}>
          <ProjectForm
            onCancel={() => setCreating(false)}
            onSaved={() => {
              setCreating(false);
              reload();
            }}
          />
        </Modal>
      )}
    </>
  );
}
