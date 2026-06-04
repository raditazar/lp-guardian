import {Hono} from "hono";
import type {AgentRuntime} from "../../services/agentRunTime.js";

export function createMockAgentRunRoute(runtime: AgentRuntime): Hono{
    const route = new Hono();

    route.get("/", (c) =>{
        const result = runtime.runFoundationDemo();

        return c.json({
            status: "ok",
            result,
        })
    })
    return route;
}