import { z } from "zod";

export const foundationRunRequestSchema = z.object({
  walletAddress: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, "walletAddress must be an EVM address"),
  scenario: z
    .enum(["basic", "dust-and-correlation", "tee-unavailable"])
    .default("basic"),
});

export type FoundationRunRequest = z.infer<typeof foundationRunRequestSchema>;
