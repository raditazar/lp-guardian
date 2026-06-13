export type StorageProvider = "stub" | "ipfs";

export interface ServerConfig {
  port: number;
  nodeEnv: string;
  agentRuntimeProvider: "mock" | "eliza";
  strategistProvider: "mock" | "phala";

  // --- Chains ---
  arbitrumRpc: string;
  arbitrumChainId: number;
  robinhoodRpc: string;
  robinhoodChainId: number;
  /** Backend signer used to anchor reports on-chain. Falls back to the
   *  deployer key when WALLET_BACKEND_PK is empty. Null disables real writes. */
  anchorSignerPk: `0x${string}` | null;

  // --- Data sources ---
  theGraphKey: string | null;
  coinGeckoApiKey: string | null;

  // --- Deployed Stylus contracts (Robinhood Chain) ---
  reportRegistryAddress: `0x${string}`;
  riskEngineAddress: `0x${string}`;

  // --- Report storage ---
  storageProvider: StorageProvider;
  ipfsToken: string | null;

  // --- Pipeline tuning ---
  dustThresholdUsd: number;
}

function nonEmpty(value: string | undefined): string | null {
  if (value === undefined) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizePk(value: string | undefined): `0x${string}` | null {
  const raw = nonEmpty(value);
  if (!raw) return null;
  const hex = raw.startsWith("0x") ? raw : `0x${raw}`;
  return /^0x[0-9a-fA-F]{64}$/.test(hex) ? (hex as `0x${string}`) : null;
}

function address(value: string | undefined, fallback: string): `0x${string}` {
  const raw = nonEmpty(value) ?? fallback;
  return raw as `0x${string}`;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  return {
    port: Number(env.PORT ?? 3001),
    nodeEnv: env.NODE_ENV ?? "development",
    agentRuntimeProvider: env.AGENT_RUNTIME === "eliza" ? "eliza" : "mock",
    strategistProvider: env.STRATEGIST_PROVIDER === "phala" ? "phala" : "mock",

    arbitrumRpc: nonEmpty(env.ARBITRUM_RPC) ?? "https://arb1.arbitrum.io/rpc",
    arbitrumChainId: Number(env.ARBITRUM_CHAIN_ID ?? 42161),
    robinhoodRpc:
      nonEmpty(env.ROBINHOOD_RPC) ?? "https://rpc.testnet.chain.robinhood.com",
    robinhoodChainId: Number(env.ROBINHOOD_CHAIN_ID ?? 46630),
    // Prefer a dedicated backend key; fall back to the funded deployer key so
    // anchoring works out of the box on the testnet.
    anchorSignerPk:
      normalizePk(env.WALLET_BACKEND_PK) ?? normalizePk(env.WALLET_DEPLOYER_PK),

    theGraphKey: nonEmpty(env.THE_GRAPH_KEY),
    coinGeckoApiKey: nonEmpty(env.COINGECKO_API_KEY),

    reportRegistryAddress: address(
      env.PortfolioReportRegistry ?? env.LPGUARDIAN_REPORTS_CONTRACT,
      "0x9803be5349eedf7c28ac1914b743757ce043b7cc",
    ),
    riskEngineAddress: address(
      env.PortfolioRiskEngine,
      "0x8d21329ac9d7785333cb41e187e556a8f7b81ec0",
    ),

    storageProvider: env.STORAGE_PROVIDER === "ipfs" ? "ipfs" : "stub",
    ipfsToken: nonEmpty(env.IPFS_TOKEN),

    dustThresholdUsd: Number(env.DUST_THRESHOLD_USD ?? 100),
  };
}
