import type { Action } from "@elizaos/core";

export const summarizeLpRiskAction: Action = {
  name: "SUMMARIZE_LP_RISK",
  similes: ["LP_RISK_SUMMARY", "PORTFOLIO_RISK_SUMMARY"],
  description:
    "Summarize LP Guardian risk findings into a concise recommendation with provenance labels.",
  validate: async () => true,
  handler: async (_runtime, _message, _state, _options, callback) => {
    const text =
      "LP Guardian should verify wallet ownership, read real pool state, calculate IL deterministically, call the risk engine, and attach Phala/report provenance before making a final recommendation.";

    if (callback) {
      await callback(
        {
          text,
          actions: ["SUMMARIZE_LP_RISK"],
        },
        "SUMMARIZE_LP_RISK",
      );
    }

    return {
      text,
      values: {
        recommendation: "monitor",
        attestationLabel: "EMULATED",
      },
      success: true,
    };
  },
};
