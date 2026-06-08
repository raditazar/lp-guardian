import { Hono } from "hono";
import { fail, ok } from "../../http/responses.js";
import { foundationRunRequestSchema } from "../../schemas/agent.js";
import type { AgentRuntime } from "../../services/agentRunTime.js";

export function createMockAgentRunRoute(runtime: AgentRuntime): Hono {
  const route = new Hono();

  route.get("/", (c) => {
    const result = runtime.runFoundationDemo();

    return c.json(ok(result));
  });

  route.post("/", async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = foundationRunRequestSchema.safeParse(body);

    if (!parsed.success) {
      return c.json(
        fail(
          "INVALID_AGENT_RUN_REQUEST",
          "Invalid agent run request",
          parsed.error.issues,
        ),
        400,
      );
    }

    const result = runtime.runFoundationDemo(parsed.data);

    return c.json(ok(result));
  });

  return route;
}
