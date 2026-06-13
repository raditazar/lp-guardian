import type { Protocol, V3PositionRaw } from "./types.js";

// Real Arbitrum One token addresses so downstream USD enrichment resolves.
const WETH = "0x82af49447d8a07e3bd95bd0d56f35241523fbab1";
const USDC = "0xaf88d065e77c8cc2239327c5edb3a432268e5831";
const ARBITRUM_CHAIN_ID = 42161;

type Range = "healthy" | "drifting" | "bleeding";

// WETH/USDC pool tick band; current tick varies per scenario.
const TICK_LOWER = -201_000;
const TICK_UPPER = -199_000;

function position(
  owner: string,
  id: string,
  range: Range,
  protocol: Protocol,
): V3PositionRaw {
  const tick =
    range === "bleeding" ? -198_000 : range === "drifting" ? -199_200 : -200_100;
  const fees =
    range === "healthy"
      ? ["0.0142", "44.31"]
      : range === "drifting"
        ? ["0.0021", "6.40"]
        : ["0", "0"];
  const amount0 = range === "bleeding" ? "0" : "1.85";
  const amount1 = range === "bleeding" ? "8200" : "3100";
  const isInRange = tick >= TICK_LOWER && tick < TICK_UPPER;

  return {
    id,
    owner: owner.toLowerCase(),
    liquidity: `${BigInt(id) * 100_000_000_000_000n}`,
    depositedToken0: amount0,
    depositedToken1: amount1,
    collectedFeesToken0: fees[0]!,
    collectedFeesToken1: fees[1]!,
    tickLower: { tickIdx: TICK_LOWER.toString() },
    tickUpper: { tickIdx: TICK_UPPER.toString() },
    pool: {
      id:
        protocol === "camelot"
          ? "0xcamelot-mock-weth-usdc"
          : "0xuni-mock-weth-usdc",
      feeTier: protocol === "camelot" ? "100" : "500",
      tickSpacing: protocol === "camelot" ? "60" : "10",
      tick: tick.toString(),
      token0: { id: WETH, symbol: "WETH", decimals: "18" },
      token1: { id: USDC, symbol: "USDC", decimals: "6" },
    },
    protocol,
    chainId: ARBITRUM_CHAIN_ID,
    isInRange,
  };
}

/** Deterministic Arbitrum LP cartridge used as the demo / hard-failure fallback. */
export function getMockArbitrumPositions(address: string): V3PositionRaw[] {
  return [
    position(address, "605311", "healthy", "camelot"),
    position(address, "605312", "drifting", "uniswap-v3"),
    position(address, "605313", "bleeding", "uniswap-v3"),
  ];
}
