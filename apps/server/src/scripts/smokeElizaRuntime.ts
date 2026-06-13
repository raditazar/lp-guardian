import { loadLocalEnv } from "../config.js";
import { ElizaAgentRuntime } from "../services/agentRuntime/elizaRuntime.js";
import { MockStrategistAdapter } from "../services/agentRuntime/strategists.js";

loadLocalEnv();

const runtime = new ElizaAgentRuntime(new MockStrategistAdapter());
const result = await runtime.runFoundation({
  walletAddress: "0x0000000000000000000000000000000000000000",
  scenario: "dust-and-correlation",
});

const firstPayload = result.messages[0]?.payload;
const runtimeMetadata =
  firstPayload && typeof firstPayload === "object" && !Array.isArray(firstPayload)
    ? (firstPayload as Record<string, unknown>).runtime
    : undefined;

console.log(
  JSON.stringify(
    {
      provider: runtime.provider,
      runStatus: result.run.status,
      messageCount: result.messages.length,
      recommendation: result.strategistAdvice?.recommendation,
      attestationLabel: result.strategistAdvice?.attestationLabel,
      runtime: runtimeMetadata,
    },
    null,
    2,
  ),
);
