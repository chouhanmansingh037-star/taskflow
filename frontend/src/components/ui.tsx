import type { ReactNode } from "react";
import { PRIORITY_LABELS } from "@/lib/format";
import type { TaskPriority } from "@/lib/types";

export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="loading" role="status">
      <div className="spinner" aria-hidden="true" />
      {label}
    </div>
  );
}

export function ErrorAlert({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="alert alert-error" role="alert">
      {message}
      {onRetry && (
        <button type="button" className="btn btn-small" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}

export function EmptyState({ title, message, action }: { title: string; message: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      <p>{message}</p>
      {action}
    </div>
  );
}

export function PriorityBadge({ priority }: { priority: TaskPriority }) {
  return <span className={`badge badge-${priority}`}>{PRIORITY_LABELS[priority]}</span>;
}

export function ProgressBar({ percent, color, label }: { percent: number; color?: string; label: string }) {
  return (
    <div
      className="progress"
      role="progressbar"
      aria-label={label}
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <span style={{ width: `${percent}%`, background: color }} />
    </div>
  );
}

export function Field({
  label,
  htmlFor,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="field">
      <label htmlFor={htmlFor}>{label}</label>
      {children}
      {error && (
        <span id={`${htmlFor}-error`} className="field-error">
          {error}
        </span>
      )}
    </div>
  );
}
