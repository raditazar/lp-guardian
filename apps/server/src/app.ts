import { Hono } from "hono";
import type { ServerConfig } from "./config.js";
import { errorHandler, notFoundHandler } from "./http/handlers.js";
import { requestContext } from "./middleware/requestContext.js";
import { requestLogger } from "./middleware/requestLogger.js";
import { createAgentRuntime } from "./services/agentRuntime/index.js";
import { createDiagnoseRoute } from "./routes/diagnose.js";
import { createAgentOrchestrationRoute } from "./routes/agent/orchestration.js";
import { createAgentRuntimeRoute } from "./routes/agent/runtime.js";
import { createHealthRoute } from "./routes/health.js";
import { createAgentMonitorRoute } from "./routes/agent/monitor.js";
import { createAgentFoundationRunRoute } from "./routes/agent/run.js";
import { createPositionsRoute } from "./routes/positions.js";
import { createReportRoute } from "./routes/report.js";
import { createPortfolioRoute } from "./routes/portfolio.js";
import { AgentOrchestrator } from "./services/agentOrchestrator.js";
import { MonitorService } from "./services/portfolio/monitorService.js";

export interface AppServices {
  monitorService?: MonitorService;
  agentOrchestrator?: AgentOrchestrator;
}

export function createApp(config: ServerConfig, services: AppServices = {}): Hono {
  const app = new Hono();
  const agentRuntime = createAgentRuntime(config);
  const monitorService = services.monitorService ?? new MonitorService(config);
  const agentOrchestrator =
    services.agentOrchestrator ?? new AgentOrchestrator(config, monitorService);

  app.use("*", requestContext());
  app.use("*", requestLogger());

  app.route("/health", createHealthRoute(config));
  app.route("/agent/runtime", createAgentRuntimeRoute(config));
  app.route("/agent/monitor", createAgentMonitorRoute(monitorService));
  app.route("/agent/orchestration", createAgentOrchestrationRoute(agentOrchestrator));
  app.route("/agent/foundation/run", createAgentFoundationRunRoute(agentRuntime));
  app.route("/api/diagnose", createDiagnoseRoute(config, agentRuntime));
  app.route("/api/positions", createPositionsRoute(config));
  app.route("/api/report", createReportRoute(config));
  app.route("/api/portfolio", createPortfolioRoute(config));

  app.notFound(notFoundHandler);
  app.onError(errorHandler);

  return app;
}
