import type {
    AgentMessage,
    AgentRun,
} from "@lp-guardian/core";
import {FoundationRunRequest} from "../schemas/agent.js";
import {runMockFoundationAgents} from "./agentOrchestrator.js";

export interface AgentRuntimeResult{
    run: AgentRun;
    messages: AgentMessage[];
}

export interface AgentRuntime {
    runFoundationDemo(input?: FoundationRunRequest): AgentRuntimeResult;
}

export class MockAgentRuntime implements AgentRuntime{
    runFoundationDemo(input?: FoundationRunRequest): AgentRuntimeResult {
        const result = runMockFoundationAgents();
        return {
            ...result,
            messages: result.messages.map((msg) => ({
                ...msg,
                payload: {
                    ...(msg.payload || {}),
                    input,
                },
            })),
        }
    }
}

export function createAgentRuntime(): AgentRuntime {
    return new MockAgentRuntime();
}