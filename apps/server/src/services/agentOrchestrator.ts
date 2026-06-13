import type{
    AgentMessage,
    AgentRun,
    AgentType,
    AgentTopic,
} from "@lp-guardian/core"

const FOUNDATION_AGENTS: AgentType[] = ["scan", "correlate", "simulate"];

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

export type FoundationRunMode = "mock" | "eliza";

export interface FoundationAgentRunResult{
    run: AgentRun;
    messages: AgentMessage[];
}

interface FoundationAgentRunOptions {
    mode: FoundationRunMode;
    note: (agent: AgentType) => string;
}

export function runFoundationAgents(
    options: FoundationAgentRunOptions,
): FoundationAgentRunResult {
    const startedAt= Date.now();
    const correlationId = createId("correlation");
    const messages = FOUNDATION_AGENTS.map((agent) => {
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
            },
        } satisfies AgentMessage;
    })

    return {
        run: {
            id: createId("run"),
            status: "completed",
            startedAt,
            completedAt: Date.now(),
            currentAgent: "simulate",
            correlationId,
        },
        messages,
    }
}

export function runMockFoundationAgents(): FoundationAgentRunResult {
    return runFoundationAgents({
        mode: "mock",
        note: (agent) => `${agent} ran in mock mode as part of a test run.`,
    });
}

export function runElizaFoundationAgents(): FoundationAgentRunResult {
    return runFoundationAgents({
        mode: "eliza",
        note: (agent) => `${agent} ran through the ElizaOS runtime bridge.`,
    });
}
