import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

export interface ServerConfig {
  port: number;
  nodeEnv: string;
  agentRuntimeProvider: "mock" | "eliza";
  strategistProvider: "mock" | "phala";
  robinhoodRpcUrl?: string;
  robinhoodChainId?: number;
  robinhoodNfpmAddress?: string;
  robinhoodScanFromBlock?: bigint;
  lpGuardianReportsContract?: string;
  lpGuardianRiskEngineContract?: string;
  walletBackendPrivateKey?: string;
  phalaAgentContract?: string;
  phalaAttestationVerifier?: string;
  phalaApiUrl?: string;
  phalaApiKey?: string;
}

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

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const robinhoodChainId = env.ROBINHOOD_CHAIN_ID
    ? Number(env.ROBINHOOD_CHAIN_ID)
    : undefined;
  const robinhoodScanFromBlock = env.ROBINHOOD_SCAN_FROM_BLOCK
    ? BigInt(env.ROBINHOOD_SCAN_FROM_BLOCK)
    : undefined;

  return {
    port: Number(env.PORT ?? 3001),
    nodeEnv: env.NODE_ENV ?? "development",
    agentRuntimeProvider:
      env.AGENT_RUNTIME === "eliza" ? "eliza" : "mock",
    strategistProvider:
      env.STRATEGIST_PROVIDER === "phala" ? "phala" : "mock",
    robinhoodRpcUrl: env.ROBINHOOD_RPC?.trim() || undefined,
    robinhoodChainId: Number.isFinite(robinhoodChainId)
      ? robinhoodChainId
      : undefined,
    robinhoodNfpmAddress: env.ROBINHOOD_NFPM_ADDRESS?.trim() || undefined,
    robinhoodScanFromBlock,
    lpGuardianReportsContract:
      env.LPGUARDIAN_REPORTS_CONTRACT?.trim() || undefined,
    lpGuardianRiskEngineContract:
      env.LPGUARDIAN_RISK_ENGINE_CONTRACT?.trim() || undefined,
    walletBackendPrivateKey: env.WALLET_BACKEND_PK?.trim() || undefined,
    phalaAgentContract: env.PHALA_AGENT_CONTRACT?.trim() || undefined,
    phalaAttestationVerifier:
      env.PHALA_ATTESTATION_VERIFIER?.trim() || undefined,
    phalaApiUrl: env.PHALA_API_URL?.trim() || undefined,
    phalaApiKey: env.PHALA_API_KEY?.trim() || undefined,
  };
}
