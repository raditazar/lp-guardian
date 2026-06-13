import type { Action } from "@elizaos/core";

export const SUMMARIZE_LP_RISK_ACTION = "SUMMARIZE_LP_RISK";

type Recommendation = "hold" | "rebalance" | "migrate" | "monitor";
type Scenario = "basic" | "dust-and-correlation" | "tee-unavailable";

export const summarizeLpRiskAction: Action = {
  name: SUMMARIZE_LP_RISK_ACTION,
  similes: ["LP_RISK_SUMMARY", "PORTFOLIO_RISK_SUMMARY"],
  description:
    "Summarize LP Guardian risk findings into a concise recommendation with provenance labels.",
  validate: async () => true,
  handler: async (_runtime, message, _state, _options, callback) => {
    const scenario = readScenario(message.content.scenario);
    const walletAddress = readString(message.content.walletAddress);
    const recommendation = recommendationForScenario(scenario);
    const confidence = scenario === "basic" ? 0.64 : 0.76;
    const text = summarizeRecommendation({
      scenario,
      walletAddress,
      recommendation,
    });

    if (callback) {
      await callback(
        {
          text,
          actions: [SUMMARIZE_LP_RISK_ACTION],
        },
        SUMMARIZE_LP_RISK_ACTION,
      );
    }

    return {
      text,
      values: {
        recommendation,
        confidence,
        attestationLabel: "EMULATED",
        sourceAction: SUMMARIZE_LP_RISK_ACTION,
      },
      data: {
        walletAddress,
        scenario,
        recommendation,
        source: "eliza-action",
      },
      success: true,
    };
  },
};

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function readScenario(value: unknown): Scenario {
  return value === "dust-and-correlation" || value === "tee-unavailable"
    ? value
    : "basic";
}

function recommendationForScenario(scenario: Scenario): Recommendation {
  if (scenario === "dust-and-correlation") return "migrate";
  if (scenario === "tee-unavailable") return "monitor";
  return "monitor";
}

function summarizeRecommendation(input: {
  scenario: Scenario;
  walletAddress?: string;
  recommendation: Recommendation;
}): string {
  const wallet = input.walletAddress
    ? ` for wallet ${input.walletAddress}`
    : "";

  if (input.scenario === "dust-and-correlation") {
    return `ElizaOS LP Guardian action recommends ${input.recommendation}${wallet}: dust and correlation risks are present, so migration preview is the safest next step until verified live inputs say otherwise.`;
  }

  if (input.scenario === "tee-unavailable") {
    return `ElizaOS LP Guardian action recommends ${input.recommendation}${wallet}: TEE attestation is unavailable, so keep the result EMULATED and avoid execution guidance.`;
  }

  return `ElizaOS LP Guardian action recommends ${input.recommendation}${wallet}: continue monitoring while wallet ownership, price, IL, risk engine, and Phala provenance remain explicit.`;
}
