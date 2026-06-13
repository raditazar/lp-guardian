import { z } from "zod";

const bigintStringSchema = z
  .string()
  .regex(/^\d+$/, "must be an unsigned integer string");

export const portfolioRiskInputSchema = z.object({
  totalPositions: bigintStringSchema,
  outOfRangePositions: bigintStringSchema,
  dustPositions: bigintStringSchema,
  correlatedExposureBps: bigintStringSchema,
  concentrationBps: bigintStringSchema,
});

export const portfolioDiagnoseSchema = z.object({
  walletAddress: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, "walletAddress must be an EVM address"),
  subjectId: bigintStringSchema.default("0"),
  riskInput: portfolioRiskInputSchema,
  publishReport: z.boolean().default(false),
  requirePhala: z.boolean().default(false),
  phalaAttestationHash: z
    .string()
    .regex(/^0x[a-fA-F0-9]{64}$/, "phalaAttestationHash must be bytes32")
    .optional(),
});

export type PortfolioDiagnoseRequest = z.infer<typeof portfolioDiagnoseSchema>;
