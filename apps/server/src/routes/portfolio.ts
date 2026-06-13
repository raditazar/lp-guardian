import { Hono } from "hono";
import type { Address, Hex } from "viem";
import { z } from "zod";
import type { ServerConfig } from "../config.js";
import { fail, ok } from "../http/responses.js";
import { portfolioDiagnoseSchema } from "../schemas/portfolio.js";
import { runAggregateRiskPipeline } from "../services/portfolio/aggregateRiskPipeline.js";
import {
  createRobinhoodPublicClient,
  createRobinhoodWalletClient,
} from "../services/robinhood/client.js";

function toBigIntRiskInput(
  input: z.infer<typeof portfolioDiagnoseSchema>["riskInput"],
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

export function createPortfolioRoute(config: ServerConfig): Hono {
  const route = new Hono();

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
    const result = await runAggregateRiskPipeline(
      config,
      publicClient,
      walletClient,
      {
        walletAddress: parsed.data.walletAddress as Address,
        subjectId: BigInt(parsed.data.subjectId),
        riskInput: toBigIntRiskInput(parsed.data.riskInput),
        sources: [
          {
            name: "PortfolioRiskEngine.computeRisk",
            label: "VERIFIED",
            chainId: config.robinhoodChainId,
            blockNumber: latestBlock,
            contractAddress: config.lpGuardianRiskEngineContract,
          },
        ],
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
