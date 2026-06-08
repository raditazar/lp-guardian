import type { DiagnosticEvent } from "@lp-guardian/core";

export function createMockDiagnosticEvents(tokenId: string): DiagnosticEvent[] {
  const pair = "ETH/USDC";
  const hookAddress = "0x1111111111111111111111111111111111111111";
  const poolId = "0xpool-mock-eth-usdc";

  return [
    { type: "phase.start", phase: 1, label: "Resolve position" },
    { type: "tool.call", tool: "getV3Position", input: { tokenId } },
    {
      type: "tool.result",
      tool: "getV3Position",
      latencyMs: 82,
      output: {
        pair,
        tickLower: 193_200,
        tickUpper: 205_800,
        liquidity: "1849200000000000000",
      },
    },
    {
      type: "narrative",
      text: `Position #${tokenId} resolved. Range is active, but exposure is concentrated in the ETH cluster.`,
    },
    { type: "phase.end", phase: 1, durationMs: 92 },

    { type: "phase.start", phase: 3, label: "Compute IL" },
    { type: "tool.call", tool: "computeIL", input: { tokenId, pair } },
    {
      type: "tool.result",
      tool: "computeIL",
      latencyMs: 116,
      output: {
        hodlValueT1: 12_420.35,
        lpValueT1: 11_982.14,
        feesValueT1: 122.49,
        ilT1: 315.72,
        ilPct: 0.0254,
      },
    },
    {
      type: "narrative",
      text: "Fees helped, but not enough. LP underperformed HODL by 2.54%.",
    },
    { type: "phase.end", phase: 3, durationMs: 128 },

    { type: "phase.start", phase: 4, label: "Classify regime" },
    { type: "tool.call", tool: "classifyRegime", input: { pair, hours: 72 } },
    {
      type: "tool.result",
      tool: "classifyRegime",
      latencyMs: 91,
      output: {
        topLabel: "trending",
        confidence: 0.72,
        scores: {
          mean_reverting: 0.12,
          trending: 0.72,
          high_toxic: 0.09,
          jit_dominated: 0.07,
        },
        features: {
          volRealized: 0.38,
          hurst: 0.63,
          slope: 0.00042,
          rSquared: 0.71,
          toxicityProxy: 0.18,
          jitProxy: 0.11,
          hoursAnalyzed: 72,
        },
      },
    },
    {
      type: "narrative",
      text: "Market regime is trending. Narrow LP ranges are paying rent to volatility.",
    },
    { type: "phase.end", phase: 4, durationMs: 101 },

    { type: "phase.start", phase: 5, label: "Discover hooks" },
    { type: "tool.call", tool: "discoverV4Hooks", input: { pair } },
    {
      type: "tool.result",
      tool: "discoverV4Hooks",
      latencyMs: 74,
      output: {
        count: 1,
        topFamily: "DYNAMIC_FEE_ADVANCED",
        candidates: [
          {
            poolId,
            hookAddress,
            family: "DYNAMIC_FEE_ADVANCED",
            flagsBitmap: 0b10101010101010,
            activeFlags: ["beforeSwap", "afterSwap", "dynamicFee"],
            feeTier: 8_388_608,
            tickSpacing: 60,
            tvlUsd: 4_850_000,
            volumeUsd: 18_400_000,
            pair,
          },
        ],
      },
    },
    { type: "phase.end", phase: 5, durationMs: 88 },

    { type: "phase.start", phase: 6, label: "Replay hooks" },
    { type: "tool.call", tool: "scoreHook", input: { hookAddress, poolId } },
    {
      type: "tool.result",
      tool: "scoreHook",
      latencyMs: 142,
      output: {
        hookAddress,
        family: "DYNAMIC_FEE_ADVANCED",
        baselineAprPct: 18.4,
        simulatedAprPct: 22.7,
        deltaAprPct: 4.3,
        baselineIlPct: 2.54,
        simulatedIlPct: 1.92,
        deltaIlPct: -0.62,
        feeCapturePct: 63.4,
        multipliers: {
          feeApr: 1.18,
          volume: 0.96,
          ilImpact: 0.82,
          retention: 0.91,
          rationale:
            "Dynamic fee hooks tend to retain more fee capture during trending regimes while softening IL drag.",
        },
        hoursScored: 72,
        warnings: ["EMULATED: not an EVM-state replay yet."],
      },
    },
    { type: "phase.end", phase: 6, durationMs: 156 },

    { type: "phase.start", phase: 7, label: "Build migration" },
    { type: "tool.call", tool: "buildMigrationPreview", input: { tokenId } },
    {
      type: "tool.result",
      tool: "buildMigrationPreview",
      latencyMs: 119,
      output: {
        fromVersion: 3,
        targetHook: { address: hookAddress, family: "DYNAMIC_FEE_ADVANCED", poolId },
        steps: [
          {
            kind: "close",
            description: `Close Uniswap v3 position #${tokenId}`,
            detail: { reason: "range too narrow for trending regime" },
          },
          {
            kind: "swap",
            description: "Rebalance token ratio for wider range",
            detail: { routing: "mock-universal-router" },
          },
          {
            kind: "mint",
            description: "Mint v4 position against dynamic fee hook",
            detail: { range: "wider", hook: "dynamic-fee" },
          },
        ],
        swapQuote: {
          routing: "mock-universal-router",
          amountIn: "0.42 ETH",
          amountOut: "1492.00 USDC",
          priceImpact: 0.0018,
          slippageTolerance: 0.005,
          gasFeeUsd: "3.82",
          routeKinds: ["v3-close", "swap", "v4-mint"],
        },
        warnings: ["Preview only. Execute Agent remains gated by user approval."],
      },
    },
    { type: "phase.end", phase: 7, durationMs: 131 },

    { type: "phase.start", phase: 8, label: "Upload report" },
    {
      type: "report.uploaded",
      rootHash: "0xstub_report_root_eth_usdc_trending_0001",
      storageUrl: "stub://lp-guardian/reports/mock-eth-usdc",
    },
    { type: "phase.end", phase: 8, durationMs: 64 },

    { type: "phase.start", phase: 9, label: "Anchor root" },
    {
      type: "report.anchored",
      txHash: "0xstub_anchor_tx_eth_usdc_trending_0001",
      chainId: 42161,
    },
    { type: "phase.end", phase: 9, durationMs: 58 },

    { type: "phase.start", phase: 10, label: "TEE verdict" },
    {
      type: "verdict.final",
      markdown:
        "**Hold off on blind rebalancing.** Your pool is trending, IL is outrunning fees, and the safest demo action is a wider-range migration preview. Execute remains user-approved only.",
      labels: {
        model: "mock-strategist-v0",
        provider: "stub",
        label: "EMULATED",
      },
    },
    { type: "phase.end", phase: 10, durationMs: 74 },
  ];
}
