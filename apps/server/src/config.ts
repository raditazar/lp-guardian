import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

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
  /** Alias of robinhoodRpc kept for the robinhood/* services. */
  robinhoodRpcUrl?: string;
  robinhoodChainId: number;
  robinhoodNfpmAddress?: string;
  robinhoodScanFromBlock?: bigint;

  /** Backend signer used to anchor reports on-chain (0x-prefixed, validated).
   *  Falls back to the deployer key when WALLET_BACKEND_PK is empty. */
  anchorSignerPk: `0x${string}` | null;
  /** Same signer as a plain string for the robinhood/* services. */
  walletBackendPrivateKey?: string;

  // --- Data sources ---
  theGraphKey: string | null;
  uniswapV4SubgraphId: string | null;
  coinGeckoApiKey: string | null;

  // --- ElizaOS model provider ---
  geminiApiKey: string | null;
  geminiModel: string;

  // --- Deployed Stylus contracts (Robinhood Chain) ---
  reportRegistryAddress: `0x${string}`;
  riskEngineAddress: `0x${string}`;
  /** Same addresses under the names used by the robinhood/* services. */
  lpGuardianReportsContract?: string;
  lpGuardianRiskEngineContract?: string;

  // --- Phala TEE strategist ---
  phalaAgentContract?: string;
  phalaAttestationVerifier?: string;
  phalaApiUrl?: string;
  phalaApiKey?: string;

  // --- Report storage ---
  storageProvider: StorageProvider;
  ipfsToken: string | null;

  // --- Pipeline tuning ---
  dustThresholdUsd: number;
}

/** Walks up from `startDir` to the nearest .env and loads it into process.env
 *  (without overriding already-set vars). */
export function loadLocalEnv(startDir = process.cwd()): void {
  let current = resolve(startDir);
  let envPath: string | undefined;

  while (true) {
    const candidate = join(current, ".env");
    if (existsSync(candidate)) {
      envPath = candidate;
      break;
    }
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }

  if (!envPath) return;

  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;
    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim().replace(/^"|"$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
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
  const robinhoodRpc =
    nonEmpty(env.ROBINHOOD_RPC) ?? "https://rpc.testnet.chain.robinhood.com";
  const robinhoodChainId = Number(env.ROBINHOOD_CHAIN_ID ?? 46630);
  const robinhoodScanFromBlock = env.ROBINHOOD_SCAN_FROM_BLOCK
    ? BigInt(env.ROBINHOOD_SCAN_FROM_BLOCK)
    : undefined;

  const reportRegistry = address(
    env.PortfolioReportRegistry ?? env.LPGUARDIAN_REPORTS_CONTRACT,
    "0x9803be5349eedf7c28ac1914b743757ce043b7cc",
  );
  const riskEngine = address(
    env.PortfolioRiskEngine ?? env.LPGUARDIAN_RISK_ENGINE_CONTRACT,
    "0x8d21329ac9d7785333cb41e187e556a8f7b81ec0",
  );
  // Prefer a dedicated backend key; fall back to the funded deployer key.
  const anchorSignerPk =
    normalizePk(env.WALLET_BACKEND_PK) ?? normalizePk(env.WALLET_DEPLOYER_PK);

  return {
    port: Number(env.PORT ?? 3001),
    nodeEnv: env.NODE_ENV ?? "development",
    agentRuntimeProvider: env.AGENT_RUNTIME === "eliza" ? "eliza" : "mock",
    strategistProvider: env.STRATEGIST_PROVIDER === "phala" ? "phala" : "mock",

    arbitrumRpc: nonEmpty(env.ARBITRUM_RPC) ?? "https://arb1.arbitrum.io/rpc",
    arbitrumChainId: Number(env.ARBITRUM_CHAIN_ID ?? 42161),
    robinhoodRpc,
    robinhoodRpcUrl: robinhoodRpc,
    robinhoodChainId,
    robinhoodNfpmAddress: nonEmpty(env.ROBINHOOD_NFPM_ADDRESS) ?? undefined,
    robinhoodScanFromBlock,

    anchorSignerPk,
    walletBackendPrivateKey: anchorSignerPk ?? undefined,

    theGraphKey: nonEmpty(env.THE_GRAPH_KEY),
    uniswapV4SubgraphId: nonEmpty(env.UNISWAP_V4_SUBGRAPH_ID),
    coinGeckoApiKey: nonEmpty(env.COINGECKO_API_KEY),
    geminiApiKey: nonEmpty(env.GEMINI_API_KEY),
    geminiModel: nonEmpty(env.GEMINI_MODEL) ?? "gemini-3.5-flash",

    reportRegistryAddress: reportRegistry,
    riskEngineAddress: riskEngine,
    lpGuardianReportsContract: reportRegistry,
    lpGuardianRiskEngineContract: riskEngine,

    phalaAgentContract: nonEmpty(env.PHALA_AGENT_CONTRACT) ?? undefined,
    phalaAttestationVerifier: nonEmpty(env.PHALA_ATTESTATION_VERIFIER) ?? undefined,
    phalaApiUrl: nonEmpty(env.PHALA_API_URL) ?? undefined,
    phalaApiKey: nonEmpty(env.PHALA_API_KEY) ?? undefined,

    storageProvider: env.STORAGE_PROVIDER === "ipfs" ? "ipfs" : "stub",
    ipfsToken: nonEmpty(env.IPFS_TOKEN),

    dustThresholdUsd: Number(env.DUST_THRESHOLD_USD ?? 100),
  };
}
