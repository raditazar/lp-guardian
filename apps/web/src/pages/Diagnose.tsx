import { useMemo } from "react";
import { useParams } from "react-router-dom";
import { AppHeader } from "../components/AppHeader.js";
import { ILPanel, type ILBreakdown } from "../components/ILPanel.js";
import {
  HooksPanel,
  type HookDiscoveryResult,
} from "../components/HooksPanel.js";
import { LabelBadge } from "../components/LabelBadge.js";
import {
  MigrationPanel,
  type MigrationPreview,
} from "../components/MigrationPanel.js";
import {
  RegimePanel,
  type RegimeClassification,
} from "../components/RegimePanel.js";
import {
  ReportProvenancePanel,
  type ReportAnchor,
  type ReportProvenance,
} from "../components/ReportProvenancePanel.js";
import { ToolCallBadge } from "../components/ToolCallBadge.js";
import { TypewriterText } from "../components/TypewriterText.js";
import {
  VerdictPanel,
  type VerdictMeta,
} from "../components/VerdictPanel.js";
import {
  HookScoringPanel,
  type HookScoringResult,
} from "../components/HookScoringPanel.js";
import { useDiagnosticStream } from "../hooks/useDiagnosticStream.js";
import type { DiagnosticEvent, Label } from "@lp-guardian/core";
import "../styles/diagnose.css";

type ToolEvent = Extract<
  DiagnosticEvent,
  { type: "tool.call" } | { type: "tool.result" }
>;

type PhaseState = "pending" | "active" | "complete" | "failed";

interface ResolvedPositionOutput {
  pair: string;
  tickLower: number;
  tickUpper: number;
  liquidity: string;
}

const PHASES = [
  { phase: 1, code: "position.resolve", label: "Resolve position" },
  { phase: 3, code: "il.reconstruct", label: "Compute IL" },
  { phase: 4, code: "regime.classify", label: "Classify regime" },
  { phase: 5, code: "hooks.discover", label: "Discover hooks" },
  { phase: 6, code: "hook.score", label: "Replay hooks" },
  { phase: 7, code: "migration.preview", label: "Build migration" },
  { phase: 8, code: "report.upload", label: "Upload report" },
  { phase: 9, code: "anchor.0g", label: "Anchor root" },
  { phase: 10, code: "verdict.synthesize", label: "TEE verdict" },
];

function pickToolResult<T>(events: DiagnosticEvent[], tool: string): T | null {
  const ev = events.find(
    (e) => e.type === "tool.result" && e.tool === tool,
  ) as Extract<DiagnosticEvent, { type: "tool.result" }> | undefined;
  return ev ? (ev.output as T) : null;
}

function pickReportUploaded(events: DiagnosticEvent[]): ReportProvenance | null {
  const ev = events.find((e) => e.type === "report.uploaded") as
    | Extract<DiagnosticEvent, { type: "report.uploaded" }>
    | undefined;
  return ev ? { rootHash: ev.rootHash, storageUrl: ev.storageUrl } : null;
}

function pickReportAnchored(events: DiagnosticEvent[]): ReportAnchor | null {
  const ev = events.find((e) => e.type === "report.anchored") as
    | Extract<DiagnosticEvent, { type: "report.anchored" }>
    | undefined;
  return ev ? { txHash: ev.txHash, chainId: ev.chainId } : null;
}

function pickVerdict(events: DiagnosticEvent[]): VerdictMeta | null {
  const ev = events.find((e) => e.type === "verdict.final") as
    | Extract<DiagnosticEvent, { type: "verdict.final" }>
    | undefined;
  if (!ev) return null;
  return {
    markdown: ev.markdown,
    model: ev.labels?.model,
    provider: ev.labels?.provider,
    stub: ev.labels?.label === "EMULATED",
  };
}

function phaseState(events: DiagnosticEvent[], phase: number): PhaseState {
  if (events.some((e) => e.type === "error" && e.phase === phase)) return "failed";
  if (events.some((e) => e.type === "phase.end" && e.phase === phase)) return "complete";
  if (events.some((e) => e.type === "phase.start" && e.phase === phase)) return "active";
  return "pending";
}

function statusLabel(status: string, error?: string): string {
  if (error || status === "error") return "stream error";
  if (status === "open") return "stream open";
  if (status === "closed") return "stream closed";
  return "waiting";
}

function compactHash(value: string): string {
  if (value.length <= 18) return value;
  return `${value.slice(0, 8)}...${value.slice(-6)}`;
}

export function Diagnose() {
  const { tokenId } = useParams<{ tokenId: string }>();
  const { events, status, error } = useDiagnosticStream(tokenId ?? null);

  const toolEvents = events.filter(
    (e): e is ToolEvent => e.type === "tool.call" || e.type === "tool.result",
  );
  const narratives = events.filter(
    (e): e is Extract<DiagnosticEvent, { type: "narrative" }> =>
      e.type === "narrative",
  );
  const streamErrors = events.filter(
    (e): e is Extract<DiagnosticEvent, { type: "error" }> => e.type === "error",
  );

  const resolved = pickToolResult<ResolvedPositionOutput>(events, "getV3Position");
  const ilBreakdown = pickToolResult<ILBreakdown>(events, "computeIL");
  const regime = pickToolResult<RegimeClassification>(events, "classifyRegime");
  const hooks = pickToolResult<HookDiscoveryResult>(events, "discoverV4Hooks");
  const migration = pickToolResult<MigrationPreview>(
    events,
    "buildMigrationPreview",
  );
  const provenance = pickReportUploaded(events);
  const anchor = pickReportAnchored(events);
  const verdict = pickVerdict(events);
  const scoring = pickToolResult<HookScoringResult>(events, "scoreHook");

  const provenanceFullyVerified =
    provenance !== null &&
    !provenance.rootHash.startsWith("0xstub") &&
    !provenance.storageUrl.startsWith("stub://") &&
    anchor !== null &&
    !anchor.txHash.startsWith("0xstub");

  const token1Symbol = resolved?.pair?.split("/")?.[1] ?? "T1";

  const labels = useMemo(() => {
    const out: Label[] = [];
    if (resolved) out.push("VERIFIED");
    if (ilBreakdown) out.push("COMPUTED");
    if (regime) out.push("ESTIMATED");
    if (hooks) out.push("LABELED");
    if (migration) out.push("EMULATED");
    if (provenance) out.push(provenanceFullyVerified ? "VERIFIED" : "EMULATED");
    if (verdict) out.push(verdict.stub ? "EMULATED" : "ESTIMATED");
    return out;
  }, [
    resolved,
    ilBreakdown,
    regime,
    hooks,
    migration,
    provenance,
    provenanceFullyVerified,
    verdict,
  ]);

  const completed = PHASES.filter((p) => phaseState(events, p.phase) === "complete").length;
  const activePhase = PHASES.find((p) => phaseState(events, p.phase) === "active");
  const latestTool = toolEvents[toolEvents.length - 1];
  const hasEvidence =
    ilBreakdown || regime || hooks || scoring || migration || provenance || verdict;

  return (
    <div className="diagnose-theme">
      <div className="diagnose-grid-bg" aria-hidden />
      <AppHeader />

      <main className="diagnose-shell">
        <header className="diagnose-command">
          <div className="diagnose-command-main">
            <div className="diagnose-kicker">
              <span className="diagnose-pixel-dot" aria-hidden />
              <span>DIAGNOSE STREAM</span>
            </div>
            <h1>Live diagnosis for token {tokenId ?? "missing"}.</h1>
            <p>
              Watch LP Guardian resolve the position, compute IL, replay hook
              alternatives, build a migration preview, and publish a verifiable
              report.
            </p>
            <div className="diagnose-meta-row">
              <span>tokenId <strong>{tokenId ?? "missing"}</strong></span>
              <span>status <strong>{statusLabel(status, error)}</strong></span>
              {resolved && <span>pair <strong>{resolved.pair}</strong></span>}
              {latestTool && (
                <span>
                  latest tool <strong>{latestTool.tool}</strong>
                </span>
              )}
            </div>
          </div>

          <div className="diagnose-score-window">
            <WindowBar title="STREAM SCOREBOARD" />
            <div className="diagnose-score-body">
              <Score label="events" value={String(events.length)} />
              <Score label="phases" value={`${completed}/${PHASES.length}`} />
              <Score label="tools" value={String(toolEvents.length)} />
            </div>
            <div className="diagnose-active-line">
              {activePhase ? activePhase.code : status === "error" ? "stream.error" : "awaiting next frame"}
            </div>
          </div>
        </header>

        <section className="diagnose-phase-window" aria-label="Diagnostic phase progress">
          <WindowBar title="PHASE TIMELINE" />
          <div className="diagnose-phase-grid">
            {PHASES.map((p, i) => (
              <PhaseChip
                key={p.phase}
                code={p.code}
                label={p.label}
                phase={p.phase}
                step={i + 1}
                state={phaseState(events, p.phase)}
              />
            ))}
          </div>
        </section>

        <div className="diagnose-layout">
          <section className="diagnose-panel-list" aria-label="Diagnostic evidence panels">
            {streamErrors.length > 0 && (
              <StateWindow
                title="PHASE ERROR"
                tone="error"
                body={streamErrors[streamErrors.length - 1]?.message ?? "A diagnostic phase failed."}
              />
            )}
            {error && (
              <StateWindow
                title="STREAM ERROR"
                tone="error"
                body={`${error}. The frontend is reachable, but the SSE backend or proxy did not finish the run.`}
              />
            )}
            {!hasEvidence && !error && (
              <StateWindow
                title={status === "open" ? "WAITING FOR EVIDENCE" : "STREAM READY"}
                tone="idle"
                body={
                  status === "open"
                    ? "The EventSource is open. Evidence panels will land here as tool results arrive."
                    : "Open a tokenId route to start a live diagnostic stream."
                }
              />
            )}

            {ilBreakdown && (
              <ILPanel breakdown={ilBreakdown} token1Symbol={token1Symbol} />
            )}
            {regime && <RegimePanel classification={regime} />}
            {hooks && <HooksPanel result={hooks} />}
            {scoring && <HookScoringPanel result={scoring} />}
            {migration && (
              <MigrationPanel preview={migration} lpTokenId={tokenId} />
            )}
            {provenance && (
              <ReportProvenancePanel provenance={provenance} anchor={anchor} />
            )}
            {verdict && <VerdictPanel verdict={verdict} />}
          </section>

          <aside className="diagnose-rail" aria-label="Live stream rail">
            <section className="diagnose-rail-window">
              <WindowBar title="HONESTY LABELS" />
              <div className="diagnose-label-stack">
                {labels.length === 0 ? (
                  <span className="diagnose-muted">labels appear as evidence lands</span>
                ) : (
                  labels.map((label, i) => <LabelBadge key={`${label}-${i}`} label={label} />)
                )}
              </div>
            </section>

            <section className="diagnose-rail-window">
              <WindowBar title="TOOL CALL STACK" />
              <div className="diagnose-tool-stack">
                {toolEvents.length === 0 ? (
                  <span className="diagnose-muted">no tool calls yet</span>
                ) : (
                  toolEvents.map((ev, i) => (
                    <ToolCallBadge key={`${ev.type}-${ev.tool}-${i}`} event={ev} />
                  ))
                )}
              </div>
            </section>

            <section className="diagnose-rail-window">
              <WindowBar title="NARRATIVE" />
              <div className="diagnose-narrative-stack">
                {narratives.length === 0 ? (
                  <span className="diagnose-muted">waiting for narrative...</span>
                ) : (
                  narratives.map((n, i) =>
                    i === narratives.length - 1 ? (
                      <p key={i} className="diagnose-narrative-current">
                        <TypewriterText text={n.text} />
                      </p>
                    ) : (
                      <p key={i}>{n.text}</p>
                    ),
                  )
                )}
              </div>
            </section>

            {provenance?.rootHash && (
              <section className="diagnose-rail-window">
                <WindowBar title="REPORT ROOT" />
                <div className="diagnose-root-hash" title={provenance.rootHash}>
                  {compactHash(provenance.rootHash)}
                </div>
              </section>
            )}
          </aside>
        </div>
      </main>
    </div>
  );
}

function WindowBar({ title }: { title: string }) {
  return (
    <div className="diagnose-window-bar">
      <span className="diagnose-window-dot diagnose-window-dot-red" />
      <span className="diagnose-window-dot diagnose-window-dot-yellow" />
      <span className="diagnose-window-dot diagnose-window-dot-green" />
      <span className="diagnose-window-title">{title}</span>
    </div>
  );
}

function Score({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function PhaseChip({
  phase,
  step,
  code,
  label,
  state,
}: {
  phase: number;
  step: number;
  code: string;
  label: string;
  state: PhaseState;
}) {
  return (
    <div
      className={`diagnose-phase-chip diagnose-phase-chip-${state}`}
      title={`backend phase ${phase}`}
    >
      <span className="diagnose-phase-index">{String(step).padStart(2, "0")}</span>
      <span className="diagnose-phase-copy">
        <strong>{code}</strong>
        <span>{label}</span>
      </span>
      <span className="diagnose-phase-state">{state}</span>
    </div>
  );
}

function StateWindow({
  title,
  body,
  tone,
}: {
  title: string;
  body: string;
  tone: "idle" | "error";
}) {
  return (
    <section className={`diagnose-state-window diagnose-state-window-${tone}`}>
      <WindowBar title={title} />
      <p>
        <span>&gt;</span> {body}
      </p>
    </section>
  );
}
