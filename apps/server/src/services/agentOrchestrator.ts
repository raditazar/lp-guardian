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

export interface MockAgentRunResult{
    run: AgentRun;
    messages: AgentMessage[];
}

export function runMockFoundationAgents(): MockAgentRunResult {
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
                mode: "mock",
                note: `${agent} ran in mock mode as part of a test run.`,
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