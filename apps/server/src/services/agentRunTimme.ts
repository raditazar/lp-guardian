import type {
    AgentMessage,
    AgentRun,
} from "@lp-guardian/core";
import {runMockFoundationAgents} from "./agentOrchestrator.js";

export interface AgentRuntimeResult{
    run: AgentRun;
    messages: AgentMessage[];
}

export interface AgentRuntime {
    runFoundationDemo(): AgentRuntimeResult;
}

export class MockAgentRuntime implements AgentRuntime{
    runFoundationDemo(): AgentRuntimeResult {
        return runMockFoundationAgents();
    }
}

export function createAgentRuntime(): AgentRuntime {
    return new MockAgentRuntime();
}