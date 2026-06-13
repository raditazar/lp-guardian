import { config as loadDotenv } from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { serve } from "@hono/node-server";

// Load the monorepo-root .env before reading config. apps/server/src → repo root
const __dirname = dirname(fileURLToPath(import.meta.url));
loadDotenv({ path: resolve(__dirname, "../../../.env") });

const { createApp } = await import("./app.js");
const { loadConfig } = await import("./config.js");

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
