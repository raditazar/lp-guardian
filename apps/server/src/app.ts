import { Hono } from "hono";
import type { ServerConfig } from "./config.js";
import { errorHandler, notFoundHandler } from "./http/handlers.js";
import { requestContext } from "./middleware/requestContext.js";
import { requestLogger } from "./middleware/requestLogger.js";
import { createAgentRuntime } from "./services/agentRuntime/index.js";
import { createDiagnoseRoute } from "./routes/diagnose.js";
import { createHealthRoute } from "./routes/health.js";
import { createMockAgentRunRoute } from "./routes/agent/mockRun.js";
import { createPositionsRoute } from "./routes/positions.js";
import { createReportRoute } from "./routes/report.js";

export function createApp(config: ServerConfig): Hono {
  const app = new Hono();
  const agentRuntime = createAgentRuntime(config);

  app.use("*", requestContext());
  app.use("*", requestLogger());

  app.route("/health", createHealthRoute(config));
  app.route("/agent/mock-run", createMockAgentRunRoute(agentRuntime));
  app.route("/api/diagnose", createDiagnoseRoute(config));
  app.route("/api/positions", createPositionsRoute(config));
  app.route("/api/report", createReportRoute(config));

  app.notFound(notFoundHandler);
  app.onError(errorHandler);

  return app;
}
