import type { FoundationRunRequest } from "../../schemas/agent.js";
import type { AgentRuntime, AgentRuntimeResult, StrategistAdapter } from "./types.js";

export class ElizaAgentRuntime implements AgentRuntime {
  readonly provider = "eliza" as const;

  constructor(private readonly strategist: StrategistAdapter) {}

  async runFoundationDemo(
    input?: FoundationRunRequest,
  ): Promise<AgentRuntimeResult> {
    void input;
    void this.strategist;

    throw new Error(
      "ElizaAgentRuntime is not installed yet. Install @elizaos/core and wire the runtime bootstrap before selecting AGENT_RUNTIME=eliza.",
    );
  }
}
