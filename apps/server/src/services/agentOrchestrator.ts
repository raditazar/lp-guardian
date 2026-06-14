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
import {
  AgentStateStore,
  type AgentStateRepository,
  type ListRunsFilter,
} from "./agentStateStore.js";
import {
  InMemoryAgentRunQueue,
  type AgentRunQueue,
  type AgentRunQueueSnapshot,
} from "./agentRunQueue.js";
import { MonitorService } from "./portfolio/monitorService.js";
import { PortfolioService } from "./portfolio/portfolioService.js";
import type { WalletRiskInputResult } from "./portfolio/walletRiskInput.js";
import type { AggregateRiskPipelineResult } from "./portfolio/aggregateRiskPipeline.js";
import type { PortfolioRiskInput } from "./robinhood/riskEngine.js";

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
  idempotencyKey?: string;
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

export type AgentStepStatus = "pending" | "running" | "completed" | "failed";

export interface AgentStepProgress {
  agent: AgentType;
  status: AgentStepStatus;
  attempts: number;
  maxAttempts: number;
  startedAt?: number;
  completedAt?: number;
  lastError?: string;
  outputMessageId?: string;
}

export interface StoredAgentRun extends AgentOrchestrationResult {
  input: AgentOrchestrationInput;
  meta?: {
    idempotencyKey?: string;
    attempts: number;
    maxAttempts: number;
    nextAttemptAt?: number;
    lastError?: string;
    deadLetter?: boolean;
    steps?: Partial<Record<AgentType, AgentStepProgress>>;
  };
}

export interface AgentStreamEvent {
  event: string;
  id?: string;
  data: unknown;
}

type AgentStreamListener = (event: AgentStreamEvent) => void;

const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_STEP_MAX_ATTEMPTS = 2;
const RETRY_BASE_DELAY_MS = 1_000;
const RETRY_MAX_DELAY_MS = 30_000;

interface AgentContext {
  input: AgentOrchestrationInput;
  correlationId: string;
  scan?: WalletRiskInputResult;
  diagnosis?: AggregateRiskPipelineResult;
}

function createId(prefix: string): string {
  return `${prefix}__${Date.now()}__${Math.random().toString(16).slice(2)}`;
}

function idempotencyKeyFor(input: AgentOrchestrationInput): string {
  return input.idempotencyKey ?? [
    input.walletAddress.toLowerCase(),
    input.targetAgent ?? "correlate",
    input.tokenId ?? "",
    input.scenario ?? "",
    input.dryRun === false ? "execute" : "dry-run",
  ].join(":");
}

function retryDelayMs(attempts: number): number {
  return Math.min(
    RETRY_BASE_DELAY_MS * (2 ** Math.max(0, attempts - 1)),
    RETRY_MAX_DELAY_MS,
  );
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTerminalStatus(status: AgentRunStatus): boolean {
  return ["waiting_for_user", "completed", "failed", "cancelled"].includes(status);
}

function pendingStep(agent: AgentType): AgentStepProgress {
  return {
    agent,
    status: "pending",
    attempts: 0,
    maxAttempts: DEFAULT_STEP_MAX_ATTEMPTS,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function bigintFromWire(value: unknown): bigint | undefined {
  if (typeof value === "bigint") return value;
  if (typeof value === "number" && Number.isInteger(value)) return BigInt(value);
  if (typeof value === "string" && /^\d+$/.test(value)) return BigInt(value);
  return undefined;
}

function riskInputFromWire(value: unknown): PortfolioRiskInput | undefined {
  if (!isRecord(value)) return undefined;
  const totalPositions = bigintFromWire(value.totalPositions);
  const outOfRangePositions = bigintFromWire(value.outOfRangePositions);
  const dustPositions = bigintFromWire(value.dustPositions);
  const correlatedExposureBps = bigintFromWire(value.correlatedExposureBps);
  const concentrationBps = bigintFromWire(value.concentrationBps);

  if (
    totalPositions === undefined ||
    outOfRangePositions === undefined ||
    dustPositions === undefined ||
    correlatedExposureBps === undefined ||
    concentrationBps === undefined
  ) {
    return undefined;
  }

  return {
    totalPositions,
    outOfRangePositions,
    dustPositions,
    correlatedExposureBps,
    concentrationBps,
  };
}

function ensureMeta(
  storedRun: StoredAgentRun,
  sequence: AgentType[],
): NonNullable<StoredAgentRun["meta"]> {
  const steps: Partial<Record<AgentType, AgentStepProgress>> = {
    ...(storedRun.meta?.steps ?? {}),
  };
  storedRun.meta = {
    idempotencyKey: storedRun.meta?.idempotencyKey ?? idempotencyKeyFor(storedRun.input),
    attempts: storedRun.meta?.attempts ?? 0,
    maxAttempts: storedRun.meta?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS,
    nextAttemptAt: storedRun.meta?.nextAttemptAt,
    lastError: storedRun.meta?.lastError,
    deadLetter: storedRun.meta?.deadLetter,
    steps,
  };

  for (const agent of sequence) {
    steps[agent] = {
      ...pendingStep(agent),
      ...steps[agent],
      agent,
      maxAttempts: steps[agent]?.maxAttempts ?? DEFAULT_STEP_MAX_ATTEMPTS,
    };
  }

  return storedRun.meta;
}

function findStepMessage(
  storedRun: StoredAgentRun,
  agentType: AgentType,
): AgentMessage | undefined {
  const outputMessageId = storedRun.meta?.steps?.[agentType]?.outputMessageId;
  if (outputMessageId) {
    const byId = storedRun.messages.find((message) => message.id === outputMessageId);
    if (byId) return byId;
  }

  const expectedTopic = topicForAgent(agentType);
  return [...storedRun.messages]
    .reverse()
    .find(
      (message) =>
        message.source === agentType && message.topic === expectedTopic,
    );
}

function hydrateCompletedStepContext(
  storedRun: StoredAgentRun,
  context: AgentContext,
  agentType: AgentType,
): boolean {
  const message = findStepMessage(storedRun, agentType);

  switch (agentType) {
    case "scan": {
      const payload = isRecord(message?.payload) ? message.payload : undefined;
      const riskInput = riskInputFromWire(payload?.riskInput);
      if (!riskInput) return false;

      context.scan = {
        riskInput,
        sources: Array.isArray(payload?.sources) ? payload.sources : [],
        scan: {
          walletAddress: context.input.walletAddress,
          nfpmAddress: "0x0000000000000000000000000000000000000000",
          fromBlock: 0n,
          toBlock: 0n,
          transfers: [],
          candidateTokenIds: Array.isArray(payload?.currentlyOwnedTokenIds)
            ? payload.currentlyOwnedTokenIds.map((id) => BigInt(String(id)))
            : [],
          positions: [],
          currentlyOwnedTokenIds: Array.isArray(payload?.currentlyOwnedTokenIds)
            ? payload.currentlyOwnedTokenIds.map((id) => BigInt(String(id)))
            : [],
          movedOutTokenIds: [],
        },
        poolState: {
          positions: [],
          source: {
            status: "unavailable",
            reason: "Rehydrated from completed ScanAgent message.",
          },
        },
      } as unknown as WalletRiskInputResult;
      return true;
    }
    case "simulate": {
      const payload = isRecord(message?.payload) ? message.payload : undefined;
      if (!payload?.riskOutput || !payload?.reportRoot) return false;

      context.diagnosis = {
        report: {
          rootHash: payload.reportRoot,
          payload: {
            riskOutput: payload.riskOutput,
          },
        },
        attestationHash: payload.attestationHash,
        anchor: payload.anchor,
      } as AggregateRiskPipelineResult;
      return true;
    }
    case "correlate":
    case "optimize":
    case "execute":
    case "monitor":
      return true;
  }
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
  private readonly streamListeners = new Map<string, Set<AgentStreamListener>>();
  private readonly deadLetterListeners = new Set<AgentStreamListener>();
  private processing = false;

  constructor(
    config: ServerConfig,
    private readonly monitorService: MonitorService,
    private readonly stateStore: AgentStateRepository = new AgentStateStore(),
    private readonly queue: AgentRunQueue = new InMemoryAgentRunQueue(),
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
        this.queue.enqueue(storedRun.run.id);
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

  listDeadLetters(filter: ListRunsFilter = {}): StoredAgentRun[] {
    return this.stateStore.listDeadLetters(filter);
  }

  getQueueSnapshot(): AgentRunQueueSnapshot {
    return this.queue.snapshot(this.processing);
  }

  getRun(runId: string): StoredAgentRun | undefined {
    return this.runs.get(runId) ?? this.stateStore.getRun(runId);
  }

  getRunByCorrelationId(correlationId: string): StoredAgentRun | undefined {
    return this.listRuns().find(
      (entry) => entry.run.correlationId === correlationId,
    );
  }

  retryDeadLetter(runId: string): AgentOrchestrationResult | undefined {
    const storedRun = this.getRun(runId);
    if (!storedRun?.meta?.deadLetter) return undefined;

    storedRun.messages = [];
    storedRun.run = {
      ...storedRun.run,
      status: "queued",
      completedAt: undefined,
      error: undefined,
    };
    storedRun.meta = {
      ...storedRun.meta,
      attempts: 0,
      nextAttemptAt: undefined,
      lastError: undefined,
      deadLetter: false,
      steps: undefined,
    };
    this.persistRun(storedRun);
    this.queue.enqueue(storedRun.run.id);
    this.emitRun(storedRun, "agent.run.queued");
    this.processQueue();

    return {
      run: storedRun.run,
      messages: storedRun.messages,
    };
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

  subscribeDeadLetters(listener: AgentStreamListener): () => void {
    this.deadLetterListeners.add(listener);
    return () => {
      this.deadLetterListeners.delete(listener);
    };
  }

  enqueue(input: AgentOrchestrationInput): AgentOrchestrationResult {
    const idempotencyKey = idempotencyKeyFor(input);
    const existing = this.stateStore.getRunByIdempotencyKey(idempotencyKey);
    if (existing) {
      return {
        run: existing.run,
        messages: existing.messages,
      };
    }

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
      meta: {
        idempotencyKey,
        attempts: 0,
        maxAttempts: DEFAULT_MAX_ATTEMPTS,
      },
    };

    this.persistRun(storedRun);
    this.queue.enqueue(run.id);
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
      meta: {
        idempotencyKey: idempotencyKeyFor(input),
        attempts: 0,
        maxAttempts: 1,
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
      while (this.queue.size() > 0) {
        const runId = this.queue.dequeue();
        if (!runId) continue;

        const storedRun = this.getRun(runId);
        if (!storedRun || storedRun.run.status !== "queued") continue;
        if (
          storedRun.meta?.nextAttemptAt &&
          storedRun.meta.nextAttemptAt > Date.now()
        ) {
          this.queue.enqueue(runId);
          const delay = storedRun.meta.nextAttemptAt - Date.now();
          setTimeout(() => this.processQueue(), delay);
          break;
        }

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
      if (this.queue.size() > 0) this.processQueue();
    }
  }

  private async executeStoredRun(storedRun: StoredAgentRun): Promise<void> {
    const targetAgent = storedRun.input.targetAgent ?? "correlate";
    const sequence = sequenceFor(targetAgent);
    const context: AgentContext = {
      input: storedRun.input,
      correlationId: storedRun.run.correlationId,
    };
    let currentAgent = storedRun.run.currentAgent;
    let status: AgentRunStatus = "completed";
    const meta = ensureMeta(storedRun, sequence);
    meta.attempts += 1;
    meta.nextAttemptAt = undefined;
    meta.lastError = undefined;
    meta.deadLetter = false;
    this.persistRun(storedRun);

    try {
      for (const agentType of sequence) {
        currentAgent = agentType;
        storedRun.run = {
          ...storedRun.run,
          status: "running",
          currentAgent,
        };
        this.persistRun(storedRun);
        this.emitRun(storedRun, "agent.run.running");

        const step = storedRun.meta?.steps?.[agentType];
        if (step?.status === "completed") {
          const hydrated = hydrateCompletedStepContext(storedRun, context, agentType);
          if (hydrated) {
            this.emit(storedRun.run.correlationId, {
              event: "agent.step.resumed",
              id: `${storedRun.run.id}:${agentType}:resumed`,
              data: {
                runId: storedRun.run.id,
                correlationId: storedRun.run.correlationId,
                agent: agentType,
                outputMessageId: step.outputMessageId,
              },
            });
          } else {
            meta.steps![agentType] = pendingStep(agentType);
            this.persistRun(storedRun);
          }
        }

        await this.executeAgentStep(storedRun, context, agentType);

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
      const message = error instanceof Error ? error.message : String(error);
      this.appendMessage(storedRun, {
        id: createId("msg"),
        timestamp: Date.now(),
        source: currentAgent ?? targetAgent,
        target: "all",
        topic: "agent.failed",
        correlationId: storedRun.run.correlationId,
        payload: {
          message,
          retryable: true,
          attempt: storedRun.meta?.attempts ?? 0,
          maxAttempts: storedRun.meta?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS,
          step: currentAgent ?? targetAgent,
          stepAttempts:
            storedRun.meta?.steps?.[currentAgent ?? targetAgent]?.attempts ?? 0,
          stepMaxAttempts:
            storedRun.meta?.steps?.[currentAgent ?? targetAgent]?.maxAttempts ??
            DEFAULT_STEP_MAX_ATTEMPTS,
        },
      });
      storedRun.meta = {
        ...ensureMeta(storedRun, sequence),
        lastError: message,
      };
    }

    if (
      status === "failed" &&
      storedRun.meta &&
      storedRun.meta.attempts < storedRun.meta.maxAttempts
    ) {
      const nextAttemptAt = Date.now() + retryDelayMs(storedRun.meta.attempts);
      storedRun.meta = {
        ...storedRun.meta,
        nextAttemptAt,
        deadLetter: false,
      };
      storedRun.run = {
        ...storedRun.run,
        status: "queued",
        completedAt: undefined,
        error: undefined,
      };
      this.persistRun(storedRun);
      this.queue.enqueue(storedRun.run.id);
      this.emit(storedRun.run.correlationId, {
        event: "agent.run.retry_scheduled",
        id: storedRun.run.id,
        data: {
          runId: storedRun.run.id,
          correlationId: storedRun.run.correlationId,
          attempt: storedRun.meta.attempts,
          maxAttempts: storedRun.meta.maxAttempts,
          nextAttemptAt,
        },
      });
      setTimeout(() => this.processQueue(), Math.max(0, nextAttemptAt - Date.now()));
      return;
    }

    const deadLetter = status === "failed";
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
    storedRun.meta = storedRun.meta
      ? {
          ...storedRun.meta,
          nextAttemptAt: undefined,
          deadLetter,
        }
      : undefined;
    this.persistRun(storedRun);
    this.emitRun(
      storedRun,
      status === "failed"
        ? "agent.run.dead_lettered"
        : "agent.run.completed",
    );
  }

  private async executeAgentStep(
    storedRun: StoredAgentRun,
    context: AgentContext,
    agentType: AgentType,
  ): Promise<void> {
    const meta = ensureMeta(storedRun, sequenceFor(storedRun.input.targetAgent ?? "correlate"));
    let step = meta.steps?.[agentType] ?? pendingStep(agentType);
    step = {
      ...step,
      agent: agentType,
      maxAttempts: step.maxAttempts || DEFAULT_STEP_MAX_ATTEMPTS,
    };
    meta.steps = {
      ...(meta.steps ?? {}),
      [agentType]: step,
    };

    if (step.status === "completed") {
      const hydrated = hydrateCompletedStepContext(storedRun, context, agentType);
      if (hydrated) return;

      step = pendingStep(agentType);
      meta.steps[agentType] = step;
      this.persistRun(storedRun);
    }

    while (step.attempts < step.maxAttempts) {
      step.status = "running";
      step.attempts += 1;
      step.startedAt = Date.now();
      step.completedAt = undefined;
      step.lastError = undefined;
      this.persistRun(storedRun);

      try {
        const payload = await this.agents[agentType].run(context);
        const message: AgentMessage = {
          id: createId("msg"),
          timestamp: Date.now(),
          source: agentType,
          target: "all",
          topic: topicForAgent(agentType),
          correlationId: storedRun.run.correlationId,
          payload: normalizeForWire(payload),
        };
        step.status = "completed";
        step.completedAt = Date.now();
        step.outputMessageId = message.id;
        this.appendMessage(storedRun, message);
        return;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        step.status = "failed";
        step.completedAt = Date.now();
        step.lastError = message;
        this.persistRun(storedRun);

        if (step.attempts >= step.maxAttempts) {
          throw error;
        }

        const nextAttemptAt = Date.now() + retryDelayMs(step.attempts);
        this.emit(storedRun.run.correlationId, {
          event: "agent.step.retry_scheduled",
          id: `${storedRun.run.id}:${agentType}:${step.attempts}`,
          data: {
            runId: storedRun.run.id,
            correlationId: storedRun.run.correlationId,
            agent: agentType,
            attempt: step.attempts,
            maxAttempts: step.maxAttempts,
            nextAttemptAt,
            error: message,
          },
        });
        await wait(Math.max(0, nextAttemptAt - Date.now()));
      }
    }
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
    const streamEvent = {
      event,
      id: storedRun.run.id,
      data: storedRun.run,
    };
    this.emit(storedRun.run.correlationId, streamEvent);
    if (event === "agent.run.dead_lettered") {
      this.emitDeadLetter(streamEvent);
    }
  }

  private emit(correlationId: string, event: AgentStreamEvent): void {
    const listeners = this.streamListeners.get(correlationId);
    if (!listeners) return;
    for (const listener of listeners) {
      listener(event);
    }
  }

  private emitDeadLetter(event: AgentStreamEvent): void {
    for (const listener of this.deadLetterListeners) {
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
