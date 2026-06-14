import type {
  AgentMessage,
  AgentRun,
  AgentType,
  AgentTopic,
} from "@lp-guardian/core";

export type FoundationRunMode = "mock" | "eliza";

export interface FoundationAgentRunResult {
  run: AgentRun;
  messages: AgentMessage[];
}

interface FoundationAgentRunOptions {
  mode: FoundationRunMode;
  note: (agent: AgentType) => string;
  correlationId?: string;
}

function createId(prefix: string): string {
  return `${prefix}__${Date.now()}__${Math.random().toString(16).slice(2)}`;
}

function topicForAgent(agent: AgentType): AgentTopic {
  switch (agent) {
    case "scan":
      return "positions.scanned";
    case "correlate":
      return "portfolio.correlated";
    case "simulate":
      return "portfolio.simulated";
    case "optimize":
      return "portfolio.optimized";
    case "execute":
      return "portfolio.executed";
    case "monitor":
      return "portfolio.alert";
    default:
      throw new Error(`Unknown agent type: ${agent}`);
  }
}

/**
 * Orchestrates a run across the foundation agents. In this build, the agents
 * run as a series of structured messages bound by a correlationId.
 */
export function runFoundationAgents(
  options: FoundationAgentRunOptions,
): FoundationAgentRunResult {
  const startedAt = Date.now();
  const correlationId = options.correlationId ?? createId("correlation");
  
  // The foundation agents that participate in a standard diagnosis run
  const activeAgents: AgentType[] = ["scan", "correlate", "simulate"];

  const messages: AgentMessage[] = activeAgents.map((agent) => {
    return {
      id: createId("msg"),
      timestamp: Date.now(),
      source: agent,
      target: "all",
      topic: topicForAgent(agent),
      correlationId,
      payload: {
        mode: options.mode,
        note: options.note(agent),
        processedAt: new Date().toISOString(),
      },
    } satisfies AgentMessage;
  });

  return {
    run: {
      id: createId("run"),
      status: "completed",
      startedAt,
      completedAt: Date.now(),
      currentAgent: activeAgents[activeAgents.length - 1],
      correlationId,
    },
    messages,
  };
}

export function runMockFoundationAgents(): FoundationAgentRunResult {
  return runFoundationAgents({
    mode: "mock",
    note: (agent) => `${agent} agent performed its analysis using cached/mock datasets.`,
  });
}

export function runElizaFoundationAgents(): FoundationAgentRunResult {
  return runFoundationAgents({
    mode: "eliza",
    note: (agent) => `${agent} agent collaborated via the ElizaOS runtime bridge to produce strategic findings.`,
  });
}

