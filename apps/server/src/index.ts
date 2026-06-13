import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { loadConfig, loadLocalEnv } from "./config.js";

loadLocalEnv();
const config = loadConfig();
const app = createApp(config);

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
