import type { ServerConfig } from "../config.js";
import { getCurrentPricesUSD } from "../prices/coinGecko.js";
import { fetchUniswapV3Positions } from "./uniswapV3.js";
import { fetchUniswapV4Positions } from "./uniswapV4.js";
import { fetchCamelotPositions } from "./camelot.js";
import { getMockArbitrumPositions } from "./mockArbitrum.js";
import type { PositionsResult, V3PositionRaw } from "./types.js";

/**
 * Aggregates a wallet's LP positions across protocols on Arbitrum One.
 * Priority order (per project decision): Camelot → Uniswap v3/v4.
 * Falls back to deterministic mock data only on a hard failure, or when
 * `forceMock` is set (demo cartridges).
 */
export async function fetchPositions(
  config: ServerConfig,
  address: string,
  opts: { forceMock?: boolean } = {},
): Promise<PositionsResult> {
  if (opts.forceMock) {
    return withUsdValue(config, {
      address: address.toLowerCase(),
      version: 1,
      positions: getMockArbitrumPositions(address),
      source: "mock",
      warnings: ["Mock Arbitrum positions (forceMock)."],
    });
  }

  const warnings: string[] = [];
  const settled = await Promise.allSettled([
    fetchCamelotPositions(config, address),
    fetchUniswapV3Positions(config, address),
    fetchUniswapV4Positions(config, address),
  ]);

  const positions: V3PositionRaw[] = [];
  const labels = ["camelot", "uniswap-v3", "uniswap-v4"];
  settled.forEach((r, i) => {
    if (r.status === "fulfilled") positions.push(...r.value);
    else warnings.push(`${labels[i]} indexing failed: ${String(r.reason)}`);
  });

  if (positions.length === 0) {
    warnings.push(
      "No live Arbitrum positions found for this wallet; serving mock cartridge.",
    );
    return withUsdValue(config, {
      address: address.toLowerCase(),
      version: 1,
      positions: getMockArbitrumPositions(address),
      source: "mock",
      warnings,
    });
  }

  return withUsdValue(config, {
    address: address.toLowerCase(),
    version: 1,
    positions,
    source: "onchain",
    warnings,
  });
}

/** Attaches currentValueUSD to each position from current token prices. */
async function withUsdValue(
  config: ServerConfig,
  result: PositionsResult,
): Promise<PositionsResult> {
  const tokenAddrs = new Set<string>();
  for (const p of result.positions) {
    tokenAddrs.add(p.pool.token0.id);
    tokenAddrs.add(p.pool.token1.id);
  }
  if (tokenAddrs.size === 0) return result;

  let prices: Record<string, number> = {};
  try {
    prices = await getCurrentPricesUSD(config, [...tokenAddrs]);
  } catch (err) {
    result.warnings.push(`price enrichment failed: ${String(err)}`);
    return result;
  }

  for (const p of result.positions) {
    const p0 = prices[p.pool.token0.id.toLowerCase()] ?? 0;
    const p1 = prices[p.pool.token1.id.toLowerCase()] ?? 0;
    const amt0 = Number(p.depositedToken0);
    const amt1 = Number(p.depositedToken1);
    p.currentValueUSD = amt0 * p0 + amt1 * p1;
  }

  return result;
}
