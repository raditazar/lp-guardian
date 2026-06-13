import type { ServerConfig } from "../../config.js";
import type { FoundationRunRequest } from "../../schemas/agent.js";
import type { StrategistAdapter, StrategistAdvice } from "./types.js";

export class MockStrategistAdapter implements StrategistAdapter {
  readonly provider = "mock" as const;

  async advise(input?: FoundationRunRequest): Promise<StrategistAdvice> {
    const scenario = input?.scenario ?? "basic";

    return {
      recommendation:
        scenario === "dust-and-correlation" ? "migrate" : "monitor",
      rationale:
        scenario === "tee-unavailable"
          ? "TEE strategist unavailable; using deterministic fallback advice."
          : scenario === "dust-and-correlation"
            ? "Dust and correlation risks are present; migration preview is the safest next step."
          : "Mock strategist recommends monitoring unless dust and correlation risks are present.",
      confidence: scenario === "basic" ? 0.62 : 0.74,
      attestationLabel: "EMULATED",
    };
  }
}

export class PhalaStrategistAdapter implements StrategistAdapter {
  readonly provider = "phala" as const;

  constructor(private readonly config: ServerConfig) {}

  async advise(): Promise<StrategistAdvice> {
    if (
      !this.config.phalaAgentContract ||
      !this.config.phalaAttestationVerifier
    ) {
      throw new Error(
        "Real Phala requires PHALA_AGENT_CONTRACT and PHALA_ATTESTATION_VERIFIER.",
      );
    }
    if (!this.config.phalaApiUrl && !this.config.robinhoodRpcUrl) {
      throw new Error(
        "Real Phala requires PHALA_API_URL or Robinhood RPC access for contract calls.",
      );
    }

    throw new Error(
      "PhalaStrategistAdapter is configured but not wired to the provider call yet. Add the Phala request/verification contract once the SC and Phala interfaces are finalized.",
    );
  }
}
