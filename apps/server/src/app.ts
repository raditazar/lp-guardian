import { Hono } from "hono";
import type { ServerConfig } from "./config.js";
import { createAgentRuntime } from "./services/agentRunTime.js";
import { createDiagnoseRoute } from "./routes/diagnose.js";
import { createHealthRoute } from "./routes/health.js";
import { createMockAgentRunRoute } from "./routes/agent/mockRun.js";
import { createPositionsRoute } from "./routes/positions.js";

export function createApp(config: ServerConfig): Hono {
  const app = new Hono();
  const agentRuntime = createAgentRuntime();

  app.route("/health", createHealthRoute(config));
  app.route("/agent/mock-run", createMockAgentRunRoute(agentRuntime));
  app.route("/api/diagnose", createDiagnoseRoute());
  app.route("/api/positions", createPositionsRoute());

  return app;
}
