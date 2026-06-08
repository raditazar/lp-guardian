import { Hono } from "hono";
import type { DiagnosticEvent } from "@lp-guardian/core";
import { createMockDiagnosticEvents } from "../services/mockDiagnosticEvents.js";

const encoder = new TextEncoder();

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function encodeSse(event: DiagnosticEvent): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify(event)}\n\n`);
}

export function createDiagnoseRoute(): Hono {
  const route = new Hono();

  route.get("/:tokenId", (c) => {
    const tokenId = c.req.param("tokenId");
    const events = createMockDiagnosticEvents(tokenId);

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
