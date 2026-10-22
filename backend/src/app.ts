import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import swaggerUi from "swagger-ui-express";
import { config } from "./config.js";
import { pool } from "./db.js";
import { errorHandler, notFoundHandler } from "./middleware/error.js";
import { openApiSpec } from "./openapi.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { dashboardRouter } from "./modules/dashboard/dashboard.routes.js";
import { projectsRouter } from "./modules/projects/projects.routes.js";
import { tasksRouter } from "./modules/tasks/tasks.routes.js";

const rateLimitMessage = {
  error: { code: "RATE_LIMITED", message: "Too many requests, please try again later" },
};

export function createApp() {
  const app = express();
  // The API sits behind the Next.js proxy / a load balancer; trust one hop for client IPs.
  app.set("trust proxy", 1);
  app.disable("x-powered-by");

  // Swagger UI needs inline scripts, so it is mounted ahead of the strict helmet policy.
  app.get("/api/openapi.json", (_req, res) => void res.json(openApiSpec));
  app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(openApiSpec));

  app.use(helmet());
  app.use(cors({ origin: config.corsOrigins, credentials: true }));
  app.use(express.json({ limit: "100kb" }));
  app.use(cookieParser());

  app.use(
    "/api",
    rateLimit({ windowMs: 60_000, limit: 300, skip: () => config.isTest, message: rateLimitMessage }),
  );
  // Brute-force protection for credential endpoints.
  const authLimiter = rateLimit({
    windowMs: 15 * 60_000,
    limit: 20,
    skip: () => config.isTest,
    message: rateLimitMessage,
  });

  app.get("/api/health", async (_req, res) => {
    try {
      await pool.query("SELECT 1");
      res.json({ status: "ok" });
    } catch {
      res.status(503).json({ error: { code: "UNAVAILABLE", message: "Database unavailable" } });
    }
  });

  app.use("/api/auth/login", authLimiter);
  app.use("/api/auth/register", authLimiter);
  app.use("/api/auth", authRouter);
  app.use("/api/projects", projectsRouter);
  app.use("/api/tasks", tasksRouter);
  app.use("/api/dashboard", dashboardRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
