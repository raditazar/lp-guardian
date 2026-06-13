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

function createStrategist(config: ServerConfig): StrategistAdapter {
  if (config.strategistProvider === "phala") {
    return new PhalaStrategistAdapter(config);
  }
  return new MockStrategistAdapter();
}

export function createAgentRuntime(config: ServerConfig): AgentRuntime {
  const strategist = createStrategist(config);

  if (config.agentRuntimeProvider === "eliza") {
    return new ElizaAgentRuntime(strategist);
  }

  return new MockAgentRuntime(strategist);
}

export type { AgentRuntime, AgentRuntimeProvider };
