import {Hono} from "hono";
import type {ServerConfig} from "../config.js";

export function createHealthRoute(config: ServerConfig) {
    const route = new Hono();

    route.get("/", (c) => {
        return c.json({
            status: "ok",
            service: "lp-guardian-server",
            env: config.nodeEnv,
        })
    })
    return route;
}