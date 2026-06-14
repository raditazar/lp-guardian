import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { createApp } from "../app.js";
import { loadConfig, loadLocalEnv } from "../config.js";

loadLocalEnv();

mkdirSync(".lp-guardian", { recursive: true });
process.env.LPGUARDIAN_AGENT_STATE_FILE = join(
  ".lp-guardian",
  `smoke-agent-reliability-${Date.now()}.json`,
);
process.env.AGENT_RUNTIME = "mock";
process.env.STRATEGIST_PROVIDER = "mock";

const app = createApp(loadConfig());
const walletAddress = "0x0000000000000000000000000000000000000000";
const idempotencyKey = `smoke-agent-reliability-${Date.now()}`;

async function json(response: Response): Promise<any> {
  return response.json();
}

async function readFirstSseEvent(response: Response): Promise<string> {
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type")?.includes("text/event-stream"), true);

  const reader = response.body?.getReader();
  assert.ok(reader);

  try {
    const decoder = new TextDecoder();
    let buffer = "";
    for (let index = 0; index < 5; index += 1) {
      const chunk = await reader.read();
      if (chunk.done) break;
      buffer += decoder.decode(chunk.value, { stream: true });
      if (buffer.includes("\n\n")) return buffer;
    }

    return buffer;
  } finally {
    await reader.cancel().catch(() => undefined);
  }
}

async function waitForCompletedRun(runId: string): Promise<any> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const response = await app.request(`/agent/orchestration/run/${runId}`);
    assert.equal(response.status, 200);
    const body = await json(response);
    const run = body.data;
    if (run.run.status === "completed") return run;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  throw new Error(`Run ${runId} did not complete.`);
}

const watchResponse = await app.request(`/agent/monitor/${walletAddress}/watch`, {
  method: "POST",
});
assert.equal(watchResponse.status, 200);
const monitorStream = await app.request(`/agent/monitor/${walletAddress}/stream`);
const monitorEvent = await readFirstSseEvent(monitorStream);
assert.equal(monitorEvent.includes("event: monitor.wallet.snapshot"), true);

const enqueueBody = {
  walletAddress,
  targetAgent: "monitor",
  idempotencyKey,
};
const firstEnqueue = await app.request("/agent/orchestration/runs", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(enqueueBody),
});
assert.equal(firstEnqueue.status, 202);
const firstBody = await json(firstEnqueue);

const secondEnqueue = await app.request("/agent/orchestration/runs", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(enqueueBody),
});
assert.equal(secondEnqueue.status, 202);
const secondBody = await json(secondEnqueue);
assert.equal(firstBody.data.run.id, secondBody.data.run.id);

const storedRun = await waitForCompletedRun(firstBody.data.run.id);
const messagesResponse = await app.request(
  `/agent/orchestration/messages/${storedRun.run.correlationId}`,
);
assert.equal(messagesResponse.status, 200);
const messagesBody = await json(messagesResponse);
assert.equal(messagesBody.data.messages.length > 0, true);

const runStream = await app.request(
  `/agent/orchestration/stream/${storedRun.run.correlationId}`,
);
const runStreamBody = await runStream.text();
assert.equal(runStreamBody.includes("event: stream.complete"), true);

const runsResponse = await app.request(
  `/agent/orchestration/runs?walletAddress=${walletAddress}&targetAgent=monitor`,
);
assert.equal(runsResponse.status, 200);
const runsBody = await json(runsResponse);
assert.equal(runsBody.data.runs.length >= 1, true);

const deadLetterResponse = await app.request("/agent/orchestration/dead-letter");
assert.equal(deadLetterResponse.status, 200);
const deadLetterBody = await json(deadLetterResponse);
assert.equal(Array.isArray(deadLetterBody.data.runs), true);

const deadLetterStream = await app.request("/agent/orchestration/dead-letter/stream");
assert.equal(deadLetterStream.status, 200);
assert.equal(
  deadLetterStream.headers.get("content-type")?.includes("text/event-stream"),
  true,
);
await deadLetterStream.body?.cancel().catch(() => undefined);

console.log(JSON.stringify({
  assertions: {
    monitorWalletStream: true,
    idempotentEnqueue: true,
    completedRunLookup: true,
    orchestrationStreamReplay: true,
    deadLetterList: true,
    deadLetterStream: true,
  },
  runId: storedRun.run.id,
  correlationId: storedRun.run.correlationId,
}));
