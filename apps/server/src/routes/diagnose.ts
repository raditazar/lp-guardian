import { Hono } from "hono";
import type { DiagnosticEvent } from "@lp-guardian/core";
import { diagnoseQuerySchema } from "../schemas/agent.js";
import type { AgentRuntime } from "../services/agentRuntime/index.js";
import type { StrategistAdvice } from "../services/agentRuntime/types.js";
import { createMockDiagnosticEvents } from "../services/mockDiagnosticEvents.js";

const encoder = new TextEncoder();

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function encodeSse(event: DiagnosticEvent): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify(event)}\n\n`);
}

const FALLBACK_ADVICE: StrategistAdvice = {
  recommendation: "monitor",
  rationale:
    "Strategist runtime failed, so LP Guardian emitted a deterministic fallback verdict.",
  confidence: 0.35,
  attestationLabel: "EMULATED",
};

export function createDiagnoseRoute(runtime: AgentRuntime): Hono {
  const route = new Hono();

  route.get("/:tokenId", async (c) => {
    const tokenId = c.req.param("tokenId");
    const parsed = diagnoseQuerySchema.safeParse(c.req.query());

    const events: DiagnosticEvent[] = [];

    if (!parsed.success) {
      events.push({
        type: "error",
        phase: 1,
        message: "Invalid diagnose query parameters",
      });
    } else {
      try {
        const result = await runtime.runFoundationDemo(parsed.data);
        events.push(
          ...createMockDiagnosticEvents(tokenId, {
            input: parsed.data,
            advice: result.strategistAdvice ?? FALLBACK_ADVICE,
            runtimeProvider: runtime.provider,
          }),
        );
      } catch {
        events.push(
          {
            type: "error",
            phase: 10,
            message: "Strategist runtime failed; using fallback verdict",
          },
          ...createMockDiagnosticEvents(tokenId, {
            input: parsed.data,
            advice: FALLBACK_ADVICE,
            runtimeProvider: "fallback",
          }),
        );
      }
    }

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        for (const event of events) {
          controller.enqueue(encodeSse(event));
          await sleep(90);
        }
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  });

  return route;
}
