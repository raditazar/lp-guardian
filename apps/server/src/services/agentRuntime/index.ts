import type { ServerConfig } from "../../config.js";
import { ElizaAgentRuntime } from "./elizaRuntime.js";
import { MockAgentRuntime } from "./mockRuntime.js";
import {
  MockStrategistAdapter,
  PhalaStrategistAdapter,
} from "./strategists.js";
import type {
  AgentRuntime,
  AgentRuntimeProvider,
  StrategistAdapter,
} from "./types.js";

type StrategistProvider = StrategistAdapter["provider"];

function createStrategist(provider: StrategistProvider): StrategistAdapter {
  if (provider === "phala") return new PhalaStrategistAdapter();
  return new MockStrategistAdapter();
}

export function createAgentRuntime(config: ServerConfig): AgentRuntime {
  const strategist = createStrategist(config.strategistProvider);

  if (config.agentRuntimeProvider === "eliza") {
    return new ElizaAgentRuntime(strategist);
  }

  return new MockAgentRuntime(strategist);
}

export type { AgentRuntime, AgentRuntimeProvider };
