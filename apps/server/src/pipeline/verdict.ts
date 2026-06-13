import type { ServerConfig } from "../config.js";
import type { ILBreakdown } from "./math/il.js";
import type { RegimeClassification } from "./math/regimeClassifier.js";
import type { HookScoringResult } from "./hooks/hookScorer.js";

export type Recommendation = "hold" | "rebalance" | "migrate" | "monitor";

export interface VerdictResult {
  markdown: string;
  recommendation: Recommendation;
  model: string;
  provider: string;
  /** true when the verdict is not TEE-attested (mock / fallback). */
  stub: boolean;
  label: "EMULATED" | "VERIFIED";
}

export interface VerdictInputs {
  pair: string;
  il: ILBreakdown;
  regime: RegimeClassification;
  hookScore: HookScoringResult;
}

/**
 * Synthesizes the baseline deterministic verdict. This serves as the foundation
 * which can then be overridden or enriched by more advanced strategist advice
 * (like LLM or TEE-based) in the diagnostic pipeline.
 */
export async function synthesizeVerdict(
  _config: ServerConfig,
  i: VerdictInputs,
): Promise<VerdictResult> {
  return buildDeterministicVerdict(i);
}

function buildDeterministicVerdict(i: VerdictInputs): VerdictResult {
  const ilPct = i.il.ilPct * 100;
  const feesBeatIl = i.il.feesValueT1 >= i.il.ilT1;
  const hookHelps = i.hookScore.deltaAprPct > 0.5 || i.hookScore.deltaIlPct < -0.2;
  const regime = i.regime.topLabel;

  let recommendation: Recommendation;
  let headline: string;

  if (i.il.lpValueT1 < 1) {
    recommendation = "monitor";
    headline = "Position is empty/out-of-range — monitor before redeploying.";
  } else if (!feesBeatIl && hookHelps && (regime === "trending" || regime === "high_toxic")) {
    recommendation = "migrate";
    headline = `IL is outrunning fees in a ${regime.replace("_", "-")} regime. A ${i.hookScore.family} hook recovers ~${i.hookScore.deltaAprPct.toFixed(1)}% APR — migrate.`;
  } else if (!feesBeatIl) {
    recommendation = "rebalance";
    headline = "Fees aren't keeping up with IL. Rebalance to a wider, fee-aware range.";
  } else {
    recommendation = "hold";
    headline = "Fees are covering IL. Hold and keep monitoring.";
  }

  const markdown = [
    `**${recommendation.toUpperCase()}** — ${headline}`,
    "",
    `- IL vs HODL: ${ilPct >= 0 ? "-" : "+"}${Math.abs(ilPct).toFixed(2)}%`,
    `- Fees captured: $${i.il.feesValueT1.toFixed(2)}`,
    `- Regime: ${regime.replace("_", "-")} (${Math.round(i.regime.confidence * 100)}%)`,
    `- Best hook: ${i.hookScore.family} (Δapr ${i.hookScore.deltaAprPct.toFixed(1)}%, Δil ${i.hookScore.deltaIlPct.toFixed(2)}%)`,
    "",
    "_Execute remains user-approved only._",
  ].join("\n");

  return {
    markdown,
    recommendation,
    model: "lp-guardian-strategist-v0",
    provider: "deterministic",
    stub: true,
    label: "EMULATED",
  };
}
