interface V3PositionRaw {
  id: string;
  owner: string;
  liquidity: string;
  depositedToken0: string;
  depositedToken1: string;
  collectedFeesToken0: string;
  collectedFeesToken1: string;
  tickLower: { tickIdx: string };
  tickUpper: { tickIdx: string };
  pool: {
    id: string;
    feeTier: string;
    tickSpacing: string;
    tick: string | null;
    token0: { id: string; symbol: string; decimals: string };
    token1: { id: string; symbol: string; decimals: string };
  };
}

export interface MockPositionsResponse {
  address: string;
  version: number;
  positions: V3PositionRaw[];
}

function createPosition(
  owner: string,
  id: string,
  range: "healthy" | "drifting" | "bleeding",
): V3PositionRaw {
  const tick =
    range === "bleeding" ? "209500" : range === "drifting" ? "205200" : "199800";
  const fees =
    range === "healthy" ? ["42.35", "181.44"] : range === "drifting" ? ["2.10", "9.85"] : ["0", "0"];

  return {
    id,
    owner,
    liquidity: `${BigInt(id) * 10_000_000_000_000n}`,
    depositedToken0: range === "bleeding" ? "4.2" : "2.4",
    depositedToken1: range === "bleeding" ? "12800" : "7300",
    collectedFeesToken0: fees[0],
    collectedFeesToken1: fees[1],
    tickLower: { tickIdx: "193200" },
    tickUpper: { tickIdx: range === "drifting" ? "205800" : "204600" },
    pool: {
      id: "0xpool-mock-eth-usdc",
      feeTier: "500",
      tickSpacing: "10",
      tick,
      token0: {
        id: "0x0000000000000000000000000000000000000001",
        symbol: "ETH",
        decimals: "18",
      },
      token1: {
        id: "0x0000000000000000000000000000000000000002",
        symbol: "USDC",
        decimals: "6",
      },
    },
  };
}

export function getMockPositions(address: string): MockPositionsResponse {
  const owner = address.toLowerCase();

  return {
    address: owner,
    version: 1,
    positions: [
      createPosition(owner, "605311", "healthy"),
      createPosition(owner, "605312", "drifting"),
      createPosition(owner, "605313", "bleeding"),
    ],
  };
}
