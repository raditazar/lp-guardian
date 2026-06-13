import { Hono } from "hono";
import type { DiagnosticEvent } from "@lp-guardian/core";
import type { ServerConfig } from "../config.js";
import { runDiagnosticPipeline } from "../pipeline/runDiagnosticPipeline.js";

const encoder = new TextEncoder();

function encodeSse(event: DiagnosticEvent): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify(event)}\n\n`);
}

export function createDiagnoseRoute(config: ServerConfig): Hono {
  const route = new Hono();

  route.get("/:tokenId", (c) => {
    const tokenId = c.req.param("tokenId");

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const event of runDiagnosticPipeline(config, tokenId)) {
            controller.enqueue(encodeSse(event));
          }
        } catch (err) {
          controller.enqueue(
            encodeSse({ type: "error", message: String(err) }),
          );
        } finally {
          controller.close();
        }
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
