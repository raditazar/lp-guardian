import { Hono } from "hono";
import type { Address, Hex } from "viem";
import { z } from "zod";
import { fail, ok } from "../../http/responses.js";
import type {
  AgentOrchestrationInput,
  AgentOrchestrator,
} from "../../services/agentOrchestrator.js";

const orchestrationRunSchema = z.object({
  walletAddress: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, "walletAddress must be an EVM address"),
  tokenId: z.string().regex(/^\d+$/, "tokenId must be an unsigned integer string").optional(),
  scenario: z.string().optional(),
  targetAgent: z
    .enum(["scan", "correlate", "simulate", "optimize", "execute", "monitor"])
    .default("correlate"),
  dryRun: z.boolean().default(true),
  userApproved: z.boolean().default(false),
  publishReport: z.boolean().default(false),
  requirePhala: z.boolean().default(false),
  phalaAttestationHash: z
    .string()
    .regex(/^0x[a-fA-F0-9]{64}$/, "phalaAttestationHash must be bytes32")
    .optional(),
});

function toInput(value: z.infer<typeof orchestrationRunSchema>): AgentOrchestrationInput {
  return {
    ...value,
    walletAddress: value.walletAddress as Address,
    phalaAttestationHash: value.phalaAttestationHash as Hex | undefined,
  };
}

export function createAgentOrchestrationRoute(
  orchestrator: AgentOrchestrator,
): Hono {
  const route = new Hono();

  route.post("/run", async (c) => {
    const body = await c.req.json().catch(() => undefined);
    const parsed = orchestrationRunSchema.safeParse(body);

    if (!parsed.success) {
      return c.json(
        fail(
          "INVALID_AGENT_ORCHESTRATION_REQUEST",
          "Invalid agent orchestration request",
          parsed.error.issues,
        ),
        400,
      );
    }

    const result = await orchestrator.run(toInput(parsed.data));
    return c.json(ok(result), result.run.status === "failed" ? 500 : 200);
  });

  route.get("/run/:runId", (c) => {
    const run = orchestrator.getRun(c.req.param("runId"));
    if (!run) {
      return c.json(fail("RUN_NOT_FOUND", "Agent run was not found."), 404);
    }

    return c.json(ok(run));
  });

  route.get("/messages/:correlationId", (c) => {
    return c.json(ok({
      correlationId: c.req.param("correlationId"),
      messages: orchestrator.getMessages(c.req.param("correlationId")),
    }));
  });

  return route;
}
