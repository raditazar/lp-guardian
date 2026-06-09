import type { ServerConfig } from "../config.js";

export interface RuntimeStatus {
  agentRuntime: ServerConfig["agentRuntimeProvider"];
  strategistProvider: ServerConfig["strategistProvider"];
  elizaReady: boolean;
  phalaReady: boolean;
  notes: string[];
}

export function getRuntimeStatus(config: ServerConfig): RuntimeStatus {
  return {
    agentRuntime: config.agentRuntimeProvider,
    strategistProvider: config.strategistProvider,
    elizaReady: false,
    phalaReady: false,
    notes: [
      "ElizaOS is planned but not installed in this pnpm workspace.",
      "Use an isolated Bun spike before wiring AGENT_RUNTIME=eliza.",
      "Phala strategist integration is a placeholder until contract, signer, and attestation policy are finalized.",
    ],
  };
}
