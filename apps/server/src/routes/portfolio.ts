import { Hono } from "hono";
import type { Address, Hex } from "viem";
import { z } from "zod";
import type { ServerConfig } from "../config.js";
import { fail, ok } from "../http/responses.js";
import { portfolioDiagnoseSchema } from "../schemas/portfolio.js";
import { validateNfpmTokenOwnership } from "../services/ownership.js";
import { runAggregateRiskPipeline } from "../services/portfolio/aggregateRiskPipeline.js";
import { buildWalletRiskInputFromRobinhood } from "../services/portfolio/walletRiskInput.js";
import {
  createRobinhoodPublicClient,
  createRobinhoodWalletClient,
} from "../services/robinhood/client.js";
import type { NfpmPositionSnapshot } from "../services/robinhood/transferScanner.js";
import type { V3PositionRaw } from "../indexer/types.js";
import type { WalletRiskInputResult } from "../services/portfolio/walletRiskInput.js";

function toBigIntRiskInput(
  input: NonNullable<z.infer<typeof portfolioDiagnoseSchema>["riskInput"]>,
) {
  return {
    totalPositions: BigInt(input.totalPositions),
    outOfRangePositions: BigInt(input.outOfRangePositions),
    dustPositions: BigInt(input.dustPositions),
    correlatedExposureBps: BigInt(input.correlatedExposureBps),
    concentrationBps: BigInt(input.concentrationBps),
  };
}

function toJsonSafe(value: unknown): unknown {
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(toJsonSafe);
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [key, toJsonSafe(entry)]),
  );
}

function ownershipTokenId(
  input: z.infer<typeof portfolioDiagnoseSchema>,
): string | undefined {
  return input.tokenId;
}

function walletSubjectId(walletAddress: string): bigint {
  return BigInt(walletAddress);
}

function positionToWire(
  position: NfpmPositionSnapshot,
  walletRisk: WalletRiskInputResult,
  config: ServerConfig,
): V3PositionRaw {
  const poolState = walletRisk.poolState.positions.find(
    (state) => state.tokenId === position.tokenId,
  );

  return {
    id: position.tokenId.toString(),
    owner: position.owner.toLowerCase(),
    liquidity: position.liquidity.toString(),
    depositedToken0: "0",
    depositedToken1: "0",
    collectedFeesToken0: position.tokensOwed0.toString(),
    collectedFeesToken1: position.tokensOwed1.toString(),
    tickLower: { tickIdx: position.tickLower.toString() },
    tickUpper: { tickIdx: position.tickUpper.toString() },
    pool: {
      id: poolState?.poolAddress.toLowerCase() ?? "",
      feeTier: position.fee.toString(),
      tickSpacing: "0",
      tick: poolState ? poolState.currentTick.toString() : null,
      token0: {
        id: position.token0.toLowerCase(),
        symbol: position.token0.slice(0, 8),
        decimals: "18",
      },
      token1: {
        id: position.token1.toLowerCase(),
        symbol: position.token1.slice(0, 8),
        decimals: "18",
      },
    },
    protocol: "uniswap-v3",
    chainId: config.robinhoodChainId,
    isInRange: poolState?.isInRange,
  };
}

function diagnoseSubjectId(
  input: z.infer<typeof portfolioDiagnoseSchema>,
): bigint {
  if (input.subjectId !== "0") return BigInt(input.subjectId);
  if (input.tokenId) return BigInt(input.tokenId);
  return walletSubjectId(input.walletAddress);
}

function clientRiskInputSource(
  input: z.infer<typeof portfolioDiagnoseSchema>,
) {
  if (!input.riskInput) return [];

  return [
    {
      name: input.riskInputSource?.name ?? "Client supplied aggregate risk input",
      label: input.riskInputSource?.label ?? "EMULATED",
      notes: input.riskInputSource?.notes ?? [
        "Backend did not derive this riskInput from wallet positions for this request.",
      ],
    },
  ];
}

export function createPortfolioRoute(config: ServerConfig): Hono {
  const route = new Hono();

  route.get("/:walletAddress/positions", async (c) => {
    const parsed = z
      .string()
      .regex(/^0x[a-fA-F0-9]{40}$/)
      .safeParse(c.req.param("walletAddress"));

    if (!parsed.success) {
      return c.json(
        fail("BAD_REQUEST", "walletAddress must be an EVM address."),
        400,
      );
    }

    const publicClient = createRobinhoodPublicClient(config);
    const walletRisk = await buildWalletRiskInputFromRobinhood(
      config,
      publicClient,
      parsed.data as Address,
    );

    return c.json(
      ok(
        toJsonSafe({
          address: parsed.data,
          version: 1,
          source: "onchain",
          chainId: config.robinhoodChainId,
          nfpmAddress: walletRisk.scan.nfpmAddress,
          scan: {
            fromBlock: walletRisk.scan.fromBlock,
            toBlock: walletRisk.scan.toBlock,
            transferCount: walletRisk.scan.transfers.length,
            candidateTokenIds: walletRisk.scan.candidateTokenIds,
            currentlyOwnedTokenIds: walletRisk.scan.currentlyOwnedTokenIds,
            movedOutTokenIds: walletRisk.scan.movedOutTokenIds,
          },
          positions: walletRisk.scan.positions.map((position) =>
            positionToWire(position, walletRisk, config),
          ),
          portfolioRiskInput: walletRisk.riskInput,
          sources: walletRisk.sources,
        }),
      ),
    );
  });

  route.post("/diagnose", async (c) => {
    const body = await c.req.json().catch(() => undefined);
    const parsed = portfolioDiagnoseSchema.safeParse(body);

    if (!parsed.success) {
      return c.json(
        fail(
          "BAD_REQUEST",
          "Invalid portfolio diagnose payload",
          parsed.error.issues,
        ),
        400,
      );
    }

    const publicClient = createRobinhoodPublicClient(config);
    const walletClient =
      parsed.data.publishReport && config.walletBackendPrivateKey
        ? createRobinhoodWalletClient(config)
        : undefined;
    const latestBlock = await publicClient.getBlockNumber();
    const tokenId = ownershipTokenId(parsed.data);
    const subjectId = diagnoseSubjectId(parsed.data);
    const ownership = tokenId
      ? await validateNfpmTokenOwnership({
          client: publicClient,
          chainId: config.robinhoodChainId,
          nfpmAddress: config.robinhoodNfpmAddress as Address | undefined,
          walletAddress: parsed.data.walletAddress as Address,
          tokenId,
          blockNumber: latestBlock,
        })
      : undefined;

    if (ownership?.status === "mismatch") {
      return c.json(
        fail(
          "OWNERSHIP_MISMATCH",
          `Token ${ownership.tokenId} is owned by ${ownership.ownerAddress}, not ${ownership.walletAddress}.`,
          toJsonSafe(ownership),
        ),
        409,
      );
    }

    const walletRisk = parsed.data.riskInput
      ? undefined
      : await buildWalletRiskInputFromRobinhood(
          config,
          publicClient,
          parsed.data.walletAddress as Address,
        );

    if (walletRisk && walletRisk.scan.currentlyOwnedTokenIds.length === 0) {
      return c.json(
        fail(
          "NO_POSITIONS",
          "No currently owned Robinhood NFPM positions were found for this wallet.",
          toJsonSafe({
            walletAddress: parsed.data.walletAddress,
            nfpmAddress: walletRisk.scan.nfpmAddress,
            fromBlock: walletRisk.scan.fromBlock,
            toBlock: walletRisk.scan.toBlock,
            transferCount: walletRisk.scan.transfers.length,
          }),
        ),
        404,
      );
    }

    const ownershipSource = ownership
      ? {
          name: "Robinhood NFPM ownerOf",
          label: ownership.label,
          chainId: ownership.chainId,
          blockNumber: ownership.blockNumber,
          contractAddress: ownership.contractAddress,
          notes:
            ownership.status === "unavailable" && ownership.reason
              ? [ownership.reason]
              : undefined,
        }
      : undefined;
    const result = await runAggregateRiskPipeline(
      config,
      publicClient,
      walletClient,
      {
        walletAddress: parsed.data.walletAddress as Address,
        subjectId,
        riskInput: parsed.data.riskInput
          ? toBigIntRiskInput(parsed.data.riskInput)
          : walletRisk!.riskInput,
        sources: [
          ...(ownershipSource ? [ownershipSource] : []),
          ...(walletRisk?.sources ?? []),
          ...clientRiskInputSource(parsed.data),
          {
            name: "PortfolioRiskEngine.computeRisk",
            label: "VERIFIED",
            chainId: config.robinhoodChainId,
            blockNumber: latestBlock,
            contractAddress: config.lpGuardianRiskEngineContract,
          },
        ],
        ownership,
        phalaAttestation: parsed.data.phalaAttestationHash
          ? {
              attestationHash: parsed.data.phalaAttestationHash as Hex,
              verifier: config.phalaAttestationVerifier,
              agentContract: config.phalaAgentContract,
            }
          : undefined,
        requirePhala: parsed.data.requirePhala,
        publishReport: parsed.data.publishReport,
      },
    );

    return c.json(ok(toJsonSafe(result)));
  });

  return route;
}
