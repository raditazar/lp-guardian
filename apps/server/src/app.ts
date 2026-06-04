import {Hono} from "hono";

export const app = new Hono();

app.get("/health", (c) => {
    return c.json({
        status: "ok",
        service: "lp-guardian-server",
        env: process.env.NODE_ENV ?? "development",
    })
})