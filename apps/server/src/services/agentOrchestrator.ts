import type {
  AgentMessage,
  AgentRun,
  AgentRunStatus,
  AgentType,
  AgentTopic,
} from "@lp-guardian/core";
import type { Address, Hex } from "viem";
import type { ServerConfig } from "../config.js";
import type { FoundationRunRequest } from "../schemas/agent.js";
import { AgentStateStore, type ListRunsFilter } from "./agentStateStore.js";
import { MonitorService } from "./portfolio/monitorService.js";
import { PortfolioService } from "./portfolio/portfolioService.js";
import type { WalletRiskInputResult } from "./portfolio/walletRiskInput.js";
import type { AggregateRiskPipelineResult } from "./portfolio/aggregateRiskPipeline.js";

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

export interface AgentOrchestrationInput {
  walletAddress: Address;
  tokenId?: string;
  scenario?: FoundationRunRequest["scenario"] | string;
  targetAgent?: AgentType;
  dryRun?: boolean;
  userApproved?: boolean;
  publishReport?: boolean;
  requirePhala?: boolean;
  phalaAttestationHash?: Hex;
}

export interface AgentOrchestrationResult {
  run: AgentRun;
  messages: AgentMessage[];
}

export interface StoredAgentRun extends AgentOrchestrationResult {
  input: AgentOrchestrationInput;
}

export interface AgentStreamEvent {
  event: string;
  id?: string;
  data: unknown;
}

type AgentStreamListener = (event: AgentStreamEvent) => void;

interface AgentContext {
  input: AgentOrchestrationInput;
  correlationId: string;
  scan?: WalletRiskInputResult;
  diagnosis?: AggregateRiskPipelineResult;
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

function normalizeForWire(value: unknown): unknown {
  if (typeof value === "bigint") return value.toString();
  if (Array.isArray(value)) return value.map(normalizeForWire);
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value)
      .filter(([, entry]) => entry !== undefined)
      .map(([key, entry]) => [key, normalizeForWire(entry)]),
  );
}

function riskActionName(value: 0 | 1 | 2): "hold" | "rebalance" | "close" {
  switch (value) {
    case 0:
      return "hold";
    case 1:
      return "rebalance";
    case 2:
      return "close";
  }
}

function sequenceFor(target: AgentType): AgentType[] {
  switch (target) {
    case "scan":
      return ["scan"];
    case "correlate":
      return ["scan", "correlate"];
    case "simulate":
      return ["scan", "correlate", "simulate"];
    case "optimize":
      return ["scan", "correlate", "simulate", "optimize"];
    case "execute":
      return ["scan", "correlate", "simulate", "optimize", "execute"];
    case "monitor":
      return ["monitor"];
  }
}

abstract class PortfolioAgent {
  constructor(readonly type: AgentType) {}

  abstract run(context: AgentContext): Promise<unknown>;
}

class ScanAgent extends PortfolioAgent {
  constructor(private readonly portfolioService: PortfolioService) {
    super("scan");
  }

  async run(context: AgentContext): Promise<unknown> {
    const scan = await this.portfolioService.getWalletPositions(
      context.input.walletAddress,
    );
    context.scan = scan;

    return {
      walletAddress: context.input.walletAddress,
      currentlyOwnedTokenIds: scan.scan.currentlyOwnedTokenIds.map((id) =>
        id.toString(),
      ),
      transferCount: scan.scan.transfers.length,
      positionCount: scan.scan.positions.length,
      riskInput: scan.riskInput,
      sources: scan.sources,
    };
  }
}

class CorrelateAgent extends PortfolioAgent {
  constructor() {
    super("correlate");
  }

  async run(context: AgentContext): Promise<unknown> {
    if (!context.scan) {
      throw new Error("CorrelateAgent requires ScanAgent output.");
    }

    return {
      method: "pair-exposure-bps",
      correlatedExposureBps: context.scan.riskInput.correlatedExposureBps,
      concentrationBps: context.scan.riskInput.concentrationBps,
      note:
        "Correlation is currently approximated from wallet pair exposure until price-history matrix computation is wired.",
    };
  }
}

class SimulateAgent extends PortfolioAgent {
  constructor(private readonly portfolioService: PortfolioService) {
    super("simulate");
  }

  async run(context: AgentContext): Promise<unknown> {
    const diagnosis = await this.portfolioService.diagnose({
      walletAddress: context.input.walletAddress,
      tokenId: context.input.tokenId,
      riskInput: context.scan?.riskInput,
      riskInputSource: context.scan
        ? {
            name: "ScanAgent wallet-derived portfolio risk input",
            label: "COMPUTED",
            notes: [
              "SimulateAgent reused ScanAgent output to keep one correlationId-bound run.",
            ],
          }
        : undefined,
      publishReport: context.input.publishReport,
      requirePhala: context.input.requirePhala,
      phalaAttestationHash: context.input.phalaAttestationHash,
    });
    context.diagnosis = diagnosis;

    return {
      scenario: context.input.scenario ?? "baseline",
      riskOutput: diagnosis.report.payload.riskOutput,
      reportRoot: diagnosis.report.rootHash,
      attestationHash: diagnosis.attestationHash,
      anchor: diagnosis.anchor,
    };
  }
}

class OptimizeAgent extends PortfolioAgent {
  constructor() {
    super("optimize");
  }

  async run(context: AgentContext): Promise<unknown> {
    if (!context.diagnosis) {
      throw new Error("OptimizeAgent requires SimulateAgent output.");
    }

    const { riskOutput } = context.diagnosis.report.payload;
    return {
      recommendedAction: riskActionName(riskOutput.recommendedAction),
      riskScoreBps: riskOutput.riskScoreBps,
      riskTier: riskOutput.riskTier,
      proposalStatus: "preview",
      reportRoot: context.diagnosis.report.rootHash,
      note:
        "OptimizeAgent currently converts the deterministic risk engine output into an approval-gated proposal preview.",
    };
  }
}

class ExecuteAgent extends PortfolioAgent {
  constructor() {
    super("execute");
  }

  async run(context: AgentContext): Promise<unknown> {
    return {
      status: context.input.userApproved ? "ready_for_execution_backend" : "waiting_for_user",
      dryRun: context.input.dryRun ?? true,
      userApproved: Boolean(context.input.userApproved),
      tokenId: context.input.tokenId,
      reportRoot: context.diagnosis?.report.rootHash,
      note: context.input.userApproved
        ? "User approval flag is present, but real Permit2 bundle submission is not wired in this build."
        : "Execution remains blocked until the user approves a proposal and signs the Permit2 flow.",
    };
  }
}

class MonitorAgent extends PortfolioAgent {
  constructor(private readonly monitorService: MonitorService) {
    super("monitor");
  }

  async run(context: AgentContext): Promise<unknown> {
    const existing = this.monitorService.getWalletState(context.input.walletAddress);
    return existing ?? this.monitorService.watch(context.input.walletAddress);
  }
}

export class AgentOrchestrator {
  private readonly portfolioService: PortfolioService;
  private readonly agents: Record<AgentType, PortfolioAgent>;
  private readonly runs = new Map<string, StoredAgentRun>();
  private readonly messagesByCorrelationId = new Map<string, AgentMessage[]>();
  private readonly queue: string[] = [];
  private readonly streamListeners = new Map<string, Set<AgentStreamListener>>();
  private processing = false;

  constructor(
    config: ServerConfig,
    private readonly monitorService: MonitorService,
    private readonly stateStore = new AgentStateStore(),
  ) {
    this.portfolioService = new PortfolioService(config);
    this.agents = {
      scan: new ScanAgent(this.portfolioService),
      correlate: new CorrelateAgent(),
      simulate: new SimulateAgent(this.portfolioService),
      optimize: new OptimizeAgent(),
      execute: new ExecuteAgent(),
      monitor: new MonitorAgent(monitorService),
    };

    for (const storedRun of this.stateStore.listRuns()) {
      if (storedRun.run.status === "queued" || storedRun.run.status === "running") {
        storedRun.run = {
          ...storedRun.run,
          status: "queued",
          completedAt: undefined,
        };
        this.queue.push(storedRun.run.id);
        this.stateStore.putRun(storedRun);
      }
      this.runs.set(storedRun.run.id, storedRun);
      this.messagesByCorrelationId.set(
        storedRun.run.correlationId,
        storedRun.messages,
      );
    }
    this.processQueue();
  }

  listRuns(filter: ListRunsFilter = {}): StoredAgentRun[] {
    return this.stateStore.listRuns(filter);
  }

  getRun(runId: string): StoredAgentRun | undefined {
    return this.runs.get(runId) ?? this.stateStore.getRun(runId);
  }

  getRunByCorrelationId(correlationId: string): StoredAgentRun | undefined {
    return this.listRuns().find(
      (entry) => entry.run.correlationId === correlationId,
    );
  }

  getMessages(correlationId: string): AgentMessage[] {
    return (
      this.messagesByCorrelationId.get(correlationId) ??
      this.stateStore.getMessages(correlationId)
    );
  }

  subscribe(
    correlationId: string,
    listener: AgentStreamListener,
  ): () => void {
    const listeners = this.streamListeners.get(correlationId) ?? new Set();
    listeners.add(listener);
    this.streamListeners.set(correlationId, listeners);

    return () => {
      listeners.delete(listener);
      if (listeners.size === 0) {
        this.streamListeners.delete(correlationId);
      }
    };
  }

  enqueue(input: AgentOrchestrationInput): AgentOrchestrationResult {
    const startedAt = Date.now();
    const targetAgent = input.targetAgent ?? "correlate";
    const run: AgentRun = {
      id: createId("run"),
      status: "queued",
      startedAt,
      currentAgent: targetAgent,
      correlationId: createId("correlation"),
    };
    const storedRun: StoredAgentRun = {
      input,
      run,
      messages: [],
    };

    this.persistRun(storedRun);
    this.queue.push(run.id);
    this.emitRun(storedRun, "agent.run.queued");
    this.processQueue();

    return {
      run,
      messages: [],
    };
  }

  async run(input: AgentOrchestrationInput): Promise<AgentOrchestrationResult> {
    const startedAt = Date.now();
    const targetAgent = input.targetAgent ?? "correlate";
    const storedRun: StoredAgentRun = {
      input,
      messages: [],
      run: {
        id: createId("run"),
        status: "running",
        startedAt,
        currentAgent: targetAgent,
        correlationId: createId("correlation"),
      },
    };

    await this.executeStoredRun(storedRun);
    return {
      run: storedRun.run,
      messages: storedRun.messages,
    };
  }

  private processQueue(): void {
    if (this.processing) return;
    this.processing = true;

    setTimeout(() => {
      this.drainQueue().catch((error: unknown) => {
        console.error(`[AgentOrchestrator] Queue drain failed: ${String(error)}`);
      });
    }, 0);
  }

  private async drainQueue(): Promise<void> {
    try {
      while (this.queue.length > 0) {
        const runId = this.queue.shift();
        if (!runId) continue;

        const storedRun = this.getRun(runId);
        if (!storedRun || storedRun.run.status !== "queued") continue;

        storedRun.run = {
          ...storedRun.run,
          status: "running",
          completedAt: undefined,
        };
        this.persistRun(storedRun);
        this.emitRun(storedRun, "agent.run.running");
        await this.executeStoredRun(storedRun);
      }
    } finally {
      this.processing = false;
      if (this.queue.length > 0) this.processQueue();
    }
  }

  private async executeStoredRun(storedRun: StoredAgentRun): Promise<void> {
    const targetAgent = storedRun.input.targetAgent ?? "correlate";
    const context: AgentContext = {
      input: storedRun.input,
      correlationId: storedRun.run.correlationId,
    };
    let currentAgent = storedRun.run.currentAgent;
    let status: AgentRunStatus = "completed";

    try {
      for (const agentType of sequenceFor(targetAgent)) {
        currentAgent = agentType;
        storedRun.run = {
          ...storedRun.run,
          status: "running",
          currentAgent,
        };
        this.persistRun(storedRun);
        this.emitRun(storedRun, "agent.run.running");

        const payload = await this.agents[agentType].run(context);
        this.appendMessage(storedRun, {
          id: createId("msg"),
          timestamp: Date.now(),
          source: agentType,
          target: "all",
          topic: topicForAgent(agentType),
          correlationId: storedRun.run.correlationId,
          payload: normalizeForWire(payload),
        });

        if (
          agentType === "execute" &&
          !storedRun.input.userApproved &&
          !(storedRun.input.dryRun === false)
        ) {
          status = "waiting_for_user";
        }
      }
    } catch (error) {
      status = "failed";
      this.appendMessage(storedRun, {
        id: createId("msg"),
        timestamp: Date.now(),
        source: currentAgent ?? targetAgent,
        target: "all",
        topic: "agent.failed",
        correlationId: storedRun.run.correlationId,
        payload: {
          message: error instanceof Error ? error.message : String(error),
          retryable: true,
        },
      });
    }

    storedRun.run = {
      ...storedRun.run,
      status,
      completedAt: Date.now(),
      currentAgent,
      error:
        status === "failed"
          ? {
              code: "AGENT_RUN_FAILED",
              message: "Agent orchestration failed. Inspect messages for details.",
              retryable: true,
              source: currentAgent,
            }
          : undefined,
    };
    this.persistRun(storedRun);
    this.emitRun(
      storedRun,
      status === "failed" ? "agent.run.failed" : "agent.run.completed",
    );
  }

  private appendMessage(storedRun: StoredAgentRun, message: AgentMessage): void {
    storedRun.messages.push(message);
    this.persistRun(storedRun);
    this.emit(storedRun.run.correlationId, {
      event: message.topic,
      id: message.id,
      data: message,
    });
  }

  private persistRun(storedRun: StoredAgentRun): void {
    this.runs.set(storedRun.run.id, storedRun);
    this.messagesByCorrelationId.set(
      storedRun.run.correlationId,
      storedRun.messages,
    );
    this.stateStore.putRun(storedRun);
  }

  private emitRun(storedRun: StoredAgentRun, event: string): void {
    this.emit(storedRun.run.correlationId, {
      event,
      id: storedRun.run.id,
      data: storedRun.run,
    });
  }

  private emit(correlationId: string, event: AgentStreamEvent): void {
    const listeners = this.streamListeners.get(correlationId);
    if (!listeners) return;
    for (const listener of listeners) {
      listener(event);
    }
  }
}

/**
 * Compatibility helper used by the existing runtime endpoint. It remains
 * lightweight and deterministic while the full AgentOrchestrator powers the
 * portfolio MCP tools and orchestration endpoints.
 */
export function runFoundationAgents(
  options: FoundationAgentRunOptions,
): FoundationAgentRunResult {
  const startedAt = Date.now();
  const correlationId = options.correlationId ?? createId("correlation");
  const activeAgents: AgentType[] = ["scan", "correlate", "simulate"];

  const messages: AgentMessage[] = activeAgents.map((agent) => ({
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
  }));

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
    note: (agent) =>
      `${agent} agent collaborated via the ElizaOS runtime bridge to produce strategic findings.`,
  });
}
