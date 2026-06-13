import type { ServerConfig } from "../config.js";

export interface RuntimeStatus {
  agentRuntime: ServerConfig["agentRuntimeProvider"];
  strategistProvider: ServerConfig["strategistProvider"];
  elizaReady: boolean;
  phalaReady: boolean;
  robinhoodReady: boolean;
  reportAnchoringReady: boolean;
  noMockDemoReady: boolean;
  notes: string[];
}

export function getRuntimeStatus(config: ServerConfig): RuntimeStatus {
  const elizaReady = Boolean(process.env.OPENAI_API_KEY);
  const robinhoodReady = Boolean(
    config.robinhoodRpcUrl &&
      config.robinhoodChainId &&
      config.robinhoodNfpmAddress &&
      config.lpGuardianRiskEngineContract,
  );
  const reportAnchoringReady = Boolean(
    config.robinhoodRpcUrl &&
      config.robinhoodChainId &&
      config.lpGuardianReportsContract,
  );
  const phalaReady = Boolean(
    config.phalaAgentContract &&
      config.phalaAttestationVerifier &&
      (config.phalaApiUrl || config.robinhoodRpcUrl),
  );
  const noMockDemoReady = robinhoodReady && phalaReady;

  return {
    agentRuntime: config.agentRuntimeProvider,
    strategistProvider: config.strategistProvider,
    elizaReady,
    phalaReady,
    robinhoodReady,
    reportAnchoringReady,
    noMockDemoReady,
    notes: [
      elizaReady
        ? "ElizaOS runtime dependencies are installed and OPENAI_API_KEY is present."
        : "ElizaOS runtime dependencies are installed; set OPENAI_API_KEY before using model-backed actions.",
      robinhoodReady
        ? "Robinhood real-data config is present."
        : "Robinhood real-data config needs RPC, chain ID, NFPM address, and risk engine address.",
      reportAnchoringReady
        ? "Report registry config is present; backend auto-publish additionally needs WALLET_BACKEND_PK or an external signer path."
        : "Report anchoring needs report registry address.",
      phalaReady
        ? "Phala config is present; adapter implementation still needs provider-specific verification calls."
        : "Phala needs agent contract, attestation verifier, and provider/RPC access.",
    ],
  };
}
