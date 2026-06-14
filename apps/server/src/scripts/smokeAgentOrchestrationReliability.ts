import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { createApp } from "../app.js";
import { loadConfig, loadLocalEnv } from "../config.js";
import { AgentStateStore } from "../services/agentStateStore.js";
import type { StoredAgentRun } from "../services/agentOrchestrator.js";

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

async function waitForCompletedRun(targetApp: typeof app, runId: string): Promise<any> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const response = await targetApp.request(`/agent/orchestration/run/${runId}`);
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

const storedRun = await waitForCompletedRun(app, firstBody.data.run.id);
assert.equal(storedRun.meta.steps.monitor.status, "completed");
assert.equal(storedRun.meta.steps.monitor.attempts, 1);

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

const queueResponse = await app.request("/agent/orchestration/queue");
assert.equal(queueResponse.status, 200);
const queueBody = await json(queueResponse);
assert.equal(queueBody.data.provider, "in-memory");
assert.equal(typeof queueBody.data.pendingCount, "number");
assert.equal(typeof queueBody.data.processing, "boolean");

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

const resumeStore = new AgentStateStore(
  join(".lp-guardian", `smoke-agent-resume-${Date.now()}.json`),
);
const resumeRunId = `run__resume__${Date.now()}`;
const resumeCorrelationId = `correlation__resume__${Date.now()}`;
const resumeMessageId = `msg__resume__${Date.now()}`;
const startedAt = Date.now();
const resumeRun: StoredAgentRun = {
  input: {
    walletAddress,
    targetAgent: "monitor",
    idempotencyKey: `resume-${idempotencyKey}`,
  },
  run: {
    id: resumeRunId,
    status: "queued",
    startedAt,
    currentAgent: "monitor",
    correlationId: resumeCorrelationId,
  },
  messages: [
    {
      id: resumeMessageId,
      timestamp: startedAt,
      source: "monitor",
      target: "all",
      topic: "portfolio.alert",
      correlationId: resumeCorrelationId,
      payload: {
        walletAddress,
        status: "unknown",
        watched: true,
        resumedFromSmoke: true,
      },
    },
  ],
  meta: {
    idempotencyKey: `resume-${idempotencyKey}`,
    attempts: 0,
    maxAttempts: 3,
    steps: {
      monitor: {
        agent: "monitor",
        status: "completed",
        attempts: 1,
        maxAttempts: 2,
        startedAt,
        completedAt: startedAt,
        outputMessageId: resumeMessageId,
      },
    },
  },
};
resumeStore.putRun(resumeRun);
const resumeApp = createApp(loadConfig(), {
  agentStateStore: resumeStore,
});
const resumedRun = await waitForCompletedRun(resumeApp, resumeRunId);
assert.equal(resumedRun.run.status, "completed");
assert.equal(resumedRun.meta.steps.monitor.status, "completed");
assert.equal(resumedRun.meta.steps.monitor.attempts, 1);
assert.equal(resumedRun.messages.length, 1);

console.log(JSON.stringify({
  assertions: {
    monitorWalletStream: true,
    idempotentEnqueue: true,
    stepProgress: true,
    completedRunLookup: true,
    orchestrationStreamReplay: true,
    queueSnapshot: true,
    deadLetterList: true,
    deadLetterStream: true,
    restartResumeSkipsCompletedStep: true,
  },
  runId: storedRun.run.id,
  correlationId: storedRun.run.correlationId,
}));
