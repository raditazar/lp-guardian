import {Hono} from "hono";
import type {ServerConfig} from "./config.js";
import {createHealthRoute} from "./routes/health.js";

export function createApp(config: ServerConfig): Hono{
    const app = new Hono();
    app.route("/health", createHealthRoute(config));
    return app;
}
