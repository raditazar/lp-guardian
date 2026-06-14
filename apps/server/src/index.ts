import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { loadConfig, loadLocalEnv } from "./config.js";
import { MonitorService } from "./services/portfolio/monitorService.js";

loadLocalEnv();
const config = loadConfig();
const app = createApp(config);

// Start autonomous background monitoring
const monitor = new MonitorService(config);
monitor.start();

serve(
  {
    fetch: app.fetch,
    port: config.port,
  },
  (info) => {
    console.log(
      `LP Guardian server listening on http://localhost:${info.port}`,
    );
  },
);

