import type { Dashboard, Project, Task, TaskInput, TaskPriority, TaskStatus, User } from "./types";

export interface FieldError {
  field: string;
  message: string;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details: FieldError[] = [],
  ) {
    super(message);
  }

  /** Server-side validation messages keyed by field name, for showing next to inputs. */
  get fieldErrors(): Record<string, string> {
    return Object.fromEntries(this.details.map((d) => [d.field, d.message]));
  }
}

let onUnauthorized: (() => void) | undefined;

/** Lets the auth layer react when any call comes back 401 (expired or revoked session). */
export function setUnauthorizedHandler(handler: (() => void) | undefined) {
  onUnauthorized = handler;
}

async function request<T>(path: string, options: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, headers, ...rest } = options;
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      ...rest,
      credentials: "same-origin",
      headers: { ...(json !== undefined ? { "Content-Type": "application/json" } : {}), ...headers },
      body: json !== undefined ? JSON.stringify(json) : rest.body,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    throw new ApiError(0, "NETWORK_ERROR", "Cannot reach the server. Check your connection and try again.");
  }

  if (response.status === 204) return undefined as T;

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const error = body?.error;
    // A 401 from these just means "not signed in", not "your session expired".
    const isAuthCall = ["/auth/login", "/auth/register", "/auth/me"].some((p) => path.startsWith(p));
    if (response.status === 401 && !isAuthCall) onUnauthorized?.();
    throw new ApiError(
      response.status,
      error?.code ?? "UNKNOWN",
      error?.message ?? "Something went wrong. Please try again.",
      error?.details ?? [],
    );
  }
  return body as T;
}

export interface TaskQuery {
  projectId?: string;
  status?: TaskStatus | "";
  priority?: TaskPriority | "";
  search?: string;
  sort?: "created" | "due" | "priority" | "title";
  order?: "asc" | "desc";
  page?: number;
  limit?: number;
}

function toQueryString(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}

export const api = {
  register: (input: { name: string; email: string; password: string }) =>
    request<{ user: User }>("/auth/register", { method: "POST", json: input }),
  login: (input: { email: string; password: string }) =>
    request<{ user: User }>("/auth/login", { method: "POST", json: input }),
  logout: () => request<void>("/auth/logout", { method: "POST" }),
  me: () => request<{ user: User }>("/auth/me"),

  dashboard: (signal?: AbortSignal) => request<Dashboard>("/dashboard", { signal }),

  listProjects: (params: { search?: string; sort?: string } = {}, signal?: AbortSignal) =>
    request<{ projects: Project[] }>(`/projects${toQueryString(params)}`, { signal }),
  getProject: (id: string, signal?: AbortSignal) => request<{ project: Project }>(`/projects/${id}`, { signal }),
  createProject: (input: { name: string; description: string }) =>
    request<{ project: Project }>("/projects", { method: "POST", json: input }),
  updateProject: (id: string, input: { name?: string; description?: string }) =>
    request<{ project: Project }>(`/projects/${id}`, { method: "PATCH", json: input }),
  deleteProject: (id: string) => request<void>(`/projects/${id}`, { method: "DELETE" }),

  listTasks: (query: TaskQuery, signal?: AbortSignal) =>
    request<{ tasks: Task[]; pagination: { total: number } }>(`/tasks${toQueryString({ ...query })}`, { signal }),
  createTask: (input: TaskInput) => request<{ task: Task }>("/tasks", { method: "POST", json: input }),
  updateTask: (id: string, input: Partial<Omit<TaskInput, "projectId">>) =>
    request<{ task: Task }>(`/tasks/${id}`, { method: "PATCH", json: input }),
  deleteTask: (id: string) => request<void>(`/tasks/${id}`, { method: "DELETE" }),
};
