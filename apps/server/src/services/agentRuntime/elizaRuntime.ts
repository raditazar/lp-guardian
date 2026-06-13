import type { AgentMessage } from "@lp-guardian/core";
import type { AgentRuntime as ElizaRuntime } from "@elizaos/core";
import { createLpGuardianElizaRuntime } from "../../agent/runtime.js";
import type { FoundationRunRequest } from "../../schemas/agent.js";
import { runMockFoundationAgents } from "../agentOrchestrator.js";
import type {
  AgentRuntime,
  AgentRuntimeResult,
  StrategistAdapter,
} from "./types.js";

export class ElizaAgentRuntime implements AgentRuntime {
  readonly provider = "eliza" as const;
  private runtime: ElizaRuntime | null = null;
  private initializePromise: Promise<ElizaRuntime> | null = null;

  constructor(private readonly strategist: StrategistAdapter) {}

  async initialize(): Promise<ElizaRuntime> {
    if (this.runtime) return this.runtime;

    this.initializePromise ??= createLpGuardianElizaRuntime();
    this.runtime = await this.initializePromise;

    return this.runtime;
  }

  async runFoundationDemo(
    input?: FoundationRunRequest,
  ): Promise<AgentRuntimeResult> {
    const runtime = await this.initialize();
    const result = runMockFoundationAgents();
    const advice = await this.strategist.advise(input);

    return {
      ...result,
      strategistAdvice: advice,
      messages: result.messages.map((message) => ({
        ...message,
        payload: mergePayload(message.payload, {
          input,
          runtime: {
            provider: this.provider,
            agentId: runtime.agentId,
            character: runtime.character.name,
            pluginCount: runtime.plugins.length,
          },
          strategist: {
            provider: this.strategist.provider,
            advice,
          },
        }),
      })),
    };
  }
}

function mergePayload(
  payload: AgentMessage["payload"],
  extra: Record<string, unknown>,
): Record<string, unknown> {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    return {
      ...payload,
      ...extra,
    };
  }

  return extra;
}
