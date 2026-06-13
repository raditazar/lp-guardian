import { z } from "zod";

export const DEFAULT_FOUNDATION_WALLET =
  "0x0000000000000000000000000000000000000000";

export const foundationScenarioSchema = z.enum([
  "basic",
  "dust-and-correlation",
  "tee-unavailable",
]);

export const foundationRunRequestSchema = z.object({
  walletAddress: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, "walletAddress must be an EVM address"),
  scenario: foundationScenarioSchema.default("basic"),
});

export type FoundationRunRequest = z.infer<typeof foundationRunRequestSchema>;

export const diagnoseQuerySchema = z.object({
  walletAddress: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, "walletAddress must be an EVM address")
    .default(DEFAULT_FOUNDATION_WALLET),
  scenario: foundationScenarioSchema.default("dust-and-correlation"),
});

export type DiagnoseQuery = z.infer<typeof diagnoseQuerySchema>;
