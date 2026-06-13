import type { AgentMessage, AgentRun } from "@lp-guardian/core";
import type { FoundationRunRequest } from "../../schemas/agent.js";

export type AgentRuntimeProvider = "mock" | "eliza";

export interface AgentRuntimeResult {
  run: AgentRun;
  messages: AgentMessage[];
  strategistAdvice?: StrategistAdvice;
}

export interface AgentRuntime {
  readonly provider: AgentRuntimeProvider;
  runFoundation(input?: FoundationRunRequest): Promise<AgentRuntimeResult>;
}

export interface StrategistAdvice {
  recommendation: "hold" | "rebalance" | "migrate" | "monitor";
  rationale: string;
  confidence: number;
  attestationLabel: "EMULATED" | "VERIFIED";
  source: {
    provider: "mock" | "eliza" | "phala";
    label: "EMULATED" | "VERIFIED";
    modelProvider?: "gemini" | "phala" | "deterministic";
    modelName?: string;
    actionName?: string;
    actionText?: string;
    callbackText?: string;
  };
}

export interface StrategistAdapter {
  readonly provider: "mock" | "eliza" | "phala";
  advise(input?: FoundationRunRequest): Promise<StrategistAdvice>;
}
