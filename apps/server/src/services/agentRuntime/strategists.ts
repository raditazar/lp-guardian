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

  async advise(): Promise<StrategistAdvice> {
    throw new Error(
      "PhalaStrategistAdapter is not implemented yet. Wire the Phala Agent Contract only after contract address, signer policy, and attestation verification are finalized.",
    );
  }
}
