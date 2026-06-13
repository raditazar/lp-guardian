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
  if (config.agentRuntimeProvider === "eliza") {
    const strategist =
      config.strategistProvider === "phala" ? createStrategist(config) : undefined;
    return new ElizaAgentRuntime(strategist);
  }

  const strategist = createStrategist(config);
  return new MockAgentRuntime(strategist);
}

export type { AgentRuntime, AgentRuntimeProvider };
