import { Hono } from "hono";
import type { AgentRunStatus, AgentType } from "@lp-guardian/core";
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

  route.get("/runs", (c) => {
    const walletAddress = c.req.query("walletAddress");
    const targetAgent = c.req.query("targetAgent");
    const status = c.req.query("status");
    const limit = c.req.query("limit");

    const parsedWallet = walletAddress
      ? z.string().regex(/^0x[a-fA-F0-9]{40}$/).safeParse(walletAddress)
      : undefined;
    if (parsedWallet && !parsedWallet.success) {
      return c.json(fail("BAD_REQUEST", "walletAddress must be an EVM address."), 400);
    }

    const parsedAgent = targetAgent
      ? z.enum(["scan", "correlate", "simulate", "optimize", "execute", "monitor"]).safeParse(targetAgent)
      : undefined;
    if (parsedAgent && !parsedAgent.success) {
      return c.json(fail("BAD_REQUEST", "targetAgent is invalid."), 400);
    }

    const parsedStatus = status
      ? z
          .enum(["queued", "running", "waiting_for_user", "completed", "failed", "cancelled"])
          .safeParse(status)
      : undefined;
    if (parsedStatus && !parsedStatus.success) {
      return c.json(fail("BAD_REQUEST", "status is invalid."), 400);
    }

    const parsedLimit = limit ? Number(limit) : 50;
    if (!Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > 500) {
      return c.json(fail("BAD_REQUEST", "limit must be an integer from 1 to 500."), 400);
    }

    return c.json(ok({
      runs: orchestrator.listRuns({
        walletAddress: parsedWallet?.success ? parsedWallet.data as Address : undefined,
        targetAgent: parsedAgent?.success ? parsedAgent.data as AgentType : undefined,
        status: parsedStatus?.success ? parsedStatus.data as AgentRunStatus : undefined,
        limit: parsedLimit,
      }),
    }));
  });

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

  route.get("/stream/:correlationId", (c) => {
    const messages = orchestrator.getMessages(c.req.param("correlationId"));
    const body = [
      ...messages.map((message) => {
        return [
          `event: ${message.topic}`,
          `id: ${message.id}`,
          `data: ${JSON.stringify(message)}`,
          "",
        ].join("\n");
      }),
      "event: stream.complete",
      `data: ${JSON.stringify({ correlationId: c.req.param("correlationId") })}`,
      "",
    ].join("\n");

    return new Response(body, {
      headers: {
        "content-type": "text/event-stream",
        "cache-control": "no-cache",
      },
    });
  });

  return route;
}
