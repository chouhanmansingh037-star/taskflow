const errorResponse = (description: string) => ({
  description,
  content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
});

const idParam = { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } };
const secured = [{ cookieAuth: [] }, { bearerAuth: [] }];

const jsonBody = (ref: string) => ({
  required: true,
  content: { "application/json": { schema: { $ref: `#/components/schemas/${ref}` } } },
});

const ok = (description: string, ref?: string) => ({
  description,
  ...(ref ? { content: { "application/json": { schema: { $ref: `#/components/schemas/${ref}` } } } } : {}),
});

const standardErrors = {
  400: errorResponse("Validation failed"),
  401: errorResponse("Not authenticated"),
  404: errorResponse("Not found (also returned for resources owned by someone else)"),
};

export const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "TaskFlow API",
    version: "1.0.0",
    description:
      "REST API for TaskFlow. Authenticate via /auth/login; the session is an httpOnly cookie, and the same token is also accepted as a Bearer header. Every project and task is scoped to its owner on the server.",
  },
  servers: [{ url: "/api" }],
  components: {
    securitySchemes: {
      cookieAuth: { type: "apiKey", in: "cookie", name: "taskflow_token" },
      bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
    },
    schemas: {
      Error: {
        type: "object",
        properties: {
          error: {
            type: "object",
            properties: {
              code: { type: "string", example: "NOT_FOUND" },
              message: { type: "string" },
              details: { type: "array", items: { type: "object" } },
            },
          },
        },
      },
      RegisterInput: {
        type: "object",
        required: ["name", "email", "password"],
        properties: {
          name: { type: "string" },
          email: { type: "string", format: "email" },
          password: { type: "string", minLength: 8 },
        },
      },
      LoginInput: {
        type: "object",
        required: ["email", "password"],
        properties: { email: { type: "string", format: "email" }, password: { type: "string" } },
      },
      User: {
        type: "object",
        properties: { id: { type: "string" }, email: { type: "string" }, name: { type: "string" } },
      },
      AuthResult: {
        type: "object",
        properties: { user: { $ref: "#/components/schemas/User" }, token: { type: "string" } },
      },
      Project: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          name: { type: "string" },
          description: { type: "string" },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
          taskCount: { type: "integer" },
          completedCount: { type: "integer" },
          progress: { type: "integer", description: "Percent of tasks done (0-100)" },
        },
      },
      ProjectInput: {
        type: "object",
        required: ["name"],
        properties: { name: { type: "string", maxLength: 120 }, description: { type: "string", maxLength: 2000 } },
      },
      Task: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          projectId: { type: "string", format: "uuid" },
          projectName: { type: "string" },
          title: { type: "string" },
          description: { type: "string" },
          status: { type: "string", enum: ["todo", "in_progress", "done"] },
          priority: { type: "string", enum: ["low", "medium", "high"] },
          dueDate: { type: "string", format: "date", nullable: true },
          overdue: { type: "boolean" },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      TaskInput: {
        type: "object",
        required: ["projectId", "title"],
        properties: {
          projectId: { type: "string", format: "uuid" },
          title: { type: "string", maxLength: 200 },
          description: { type: "string", maxLength: 5000 },
          status: { type: "string", enum: ["todo", "in_progress", "done"] },
          priority: { type: "string", enum: ["low", "medium", "high"] },
          dueDate: { type: "string", format: "date", nullable: true },
        },
      },
      TaskUpdate: {
        type: "object",
        description: "Any subset of the task fields except projectId.",
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          status: { type: "string", enum: ["todo", "in_progress", "done"] },
          priority: { type: "string", enum: ["low", "medium", "high"] },
          dueDate: { type: "string", format: "date", nullable: true },
        },
      },
      TaskList: {
        type: "object",
        properties: {
          tasks: { type: "array", items: { $ref: "#/components/schemas/Task" } },
          pagination: {
            type: "object",
            properties: {
              page: { type: "integer" },
              limit: { type: "integer" },
              total: { type: "integer" },
              totalPages: { type: "integer" },
            },
          },
        },
      },
      Dashboard: {
        type: "object",
        properties: {
          totalProjects: { type: "integer" },
          totalTasks: { type: "integer" },
          completedTasks: { type: "integer" },
          overdueTasks: { type: "integer" },
          completionRate: { type: "integer" },
          tasksByStatus: {
            type: "object",
            properties: {
              todo: { type: "integer" },
              in_progress: { type: "integer" },
              done: { type: "integer" },
            },
          },
          projectProgress: { type: "array", items: { $ref: "#/components/schemas/Project" } },
        },
      },
    },
  },
  paths: {
    "/auth/register": {
      post: {
        tags: ["Auth"],
        summary: "Create an account and start a session",
        requestBody: jsonBody("RegisterInput"),
        responses: { 201: ok("Created", "AuthResult"), 400: standardErrors[400], 409: errorResponse("Email already registered") },
      },
    },
    "/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "Sign in",
        requestBody: jsonBody("LoginInput"),
        responses: { 200: ok("Signed in", "AuthResult"), 400: standardErrors[400], 401: errorResponse("Invalid credentials") },
      },
    },
    "/auth/logout": {
      post: {
        tags: ["Auth"],
        summary: "Sign out and invalidate all existing tokens for the user",
        security: secured,
        responses: { 204: ok("Signed out"), 401: standardErrors[401] },
      },
    },
    "/auth/me": {
      get: {
        tags: ["Auth"],
        summary: "Current user",
        security: secured,
        responses: { 200: ok("Current user"), 401: standardErrors[401] },
      },
    },
    "/projects": {
      get: {
        tags: ["Projects"],
        summary: "List the caller's projects with task counts and progress",
        security: secured,
        parameters: [
          { name: "search", in: "query", schema: { type: "string" } },
          { name: "sort", in: "query", schema: { type: "string", enum: ["updated", "created", "name"] } },
          { name: "limit", in: "query", schema: { type: "integer", maximum: 100 } },
        ],
        responses: { 200: ok("Projects"), 400: standardErrors[400], 401: standardErrors[401] },
      },
      post: {
        tags: ["Projects"],
        summary: "Create a project",
        security: secured,
        requestBody: jsonBody("ProjectInput"),
        responses: { 201: ok("Created", "Project"), 400: standardErrors[400], 401: standardErrors[401] },
      },
    },
    "/projects/{id}": {
      parameters: [idParam],
      get: { tags: ["Projects"], summary: "Get a project", security: secured, responses: { 200: ok("Project", "Project"), ...standardErrors } },
      patch: {
        tags: ["Projects"],
        summary: "Update a project",
        security: secured,
        requestBody: jsonBody("ProjectInput"),
        responses: { 200: ok("Updated", "Project"), ...standardErrors },
      },
      delete: {
        tags: ["Projects"],
        summary: "Delete a project and its tasks",
        security: secured,
        responses: { 204: ok("Deleted"), ...standardErrors },
      },
    },
    "/tasks": {
      get: {
        tags: ["Tasks"],
        summary: "List the caller's tasks, filterable and searchable",
        security: secured,
        parameters: [
          { name: "projectId", in: "query", schema: { type: "string", format: "uuid" } },
          { name: "status", in: "query", schema: { type: "string", enum: ["todo", "in_progress", "done"] } },
          { name: "priority", in: "query", schema: { type: "string", enum: ["low", "medium", "high"] } },
          { name: "search", in: "query", description: "Case-insensitive match on title", schema: { type: "string" } },
          { name: "sort", in: "query", schema: { type: "string", enum: ["created", "due", "priority", "title"] } },
          { name: "order", in: "query", schema: { type: "string", enum: ["asc", "desc"] } },
          { name: "page", in: "query", schema: { type: "integer", minimum: 1 } },
          { name: "limit", in: "query", schema: { type: "integer", maximum: 200 } },
        ],
        responses: { 200: ok("Tasks", "TaskList"), 400: standardErrors[400], 401: standardErrors[401] },
      },
      post: {
        tags: ["Tasks"],
        summary: "Create a task in one of the caller's projects",
        security: secured,
        requestBody: jsonBody("TaskInput"),
        responses: { 201: ok("Created", "Task"), ...standardErrors },
      },
    },
    "/tasks/{id}": {
      parameters: [idParam],
      get: { tags: ["Tasks"], summary: "Get a task", security: secured, responses: { 200: ok("Task", "Task"), ...standardErrors } },
      patch: {
        tags: ["Tasks"],
        summary: "Update a task (including status changes)",
        security: secured,
        requestBody: jsonBody("TaskUpdate"),
        responses: { 200: ok("Updated", "Task"), ...standardErrors },
      },
      delete: { tags: ["Tasks"], summary: "Delete a task", security: secured, responses: { 204: ok("Deleted"), ...standardErrors } },
    },
    "/dashboard": {
      get: {
        tags: ["Dashboard"],
        summary: "Totals, completion and overdue statistics",
        security: secured,
        responses: { 200: ok("Dashboard", "Dashboard"), 401: standardErrors[401] },
      },
    },
    "/health": {
      get: { tags: ["System"], summary: "Liveness and database check", responses: { 200: ok("Healthy"), 503: errorResponse("Database unavailable") } },
    },
  },
};
