import {Hono} from "hono";
import {runMockFoundationAgents} from "../../services/agentOrchestrator.js";

export function createMockAgentRunRoute(): Hono{
    const route = new Hono();

    route.get("/", (c) =>{
        const result = runMockFoundationAgents();

        return c.json({
            status: "ok",
            result,
        })
    })
    return route;
}