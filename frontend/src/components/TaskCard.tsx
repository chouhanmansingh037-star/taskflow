import { formatDate, STATUS_LABELS } from "@/lib/format";
import { TASK_STATUSES, type Task, type TaskStatus } from "@/lib/types";
import { PriorityBadge } from "./ui";

export function TaskCard({
  task,
  showProject,
  busy,
  onStatusChange,
  onEdit,
  onDelete,
}: {
  task: Task;
  showProject: boolean;
  busy: boolean;
  onStatusChange: (status: TaskStatus) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <article className="task-card" aria-busy={busy}>
      <h3>{task.title}</h3>
      {showProject && <div className="project">{task.projectName}</div>}
      {task.description && <p className="desc">{task.description}</p>}
      <div className="task-meta">
        <PriorityBadge priority={task.priority} />
        <span className={task.overdue ? "task-due overdue" : "task-due"}>
          {task.overdue ? "Overdue · " : ""}
          {formatDate(task.dueDate)}
        </span>
      </div>
      <div className="task-actions">
        <label className="sr-only" htmlFor={`status-${task.id}`}>
          Status of {task.title}
        </label>
        <select
          id={`status-${task.id}`}
          className="select"
          value={task.status}
          disabled={busy}
          onChange={(e) => onStatusChange(e.target.value as TaskStatus)}
        >
          {TASK_STATUSES.map((status) => (
            <option key={status} value={status}>
              {STATUS_LABELS[status]}
            </option>
          ))}
        </select>
        <button type="button" className="btn btn-small" onClick={onEdit} aria-label={`Edit ${task.title}`}>
          Edit
        </button>
        <button type="button" className="btn btn-small btn-ghost" onClick={onDelete} aria-label={`Delete ${task.title}`}>
          Delete
        </button>
      </div>
    </article>
  );
}
