import { useEffect, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { useAccount } from "wagmi";
import { ConnectButton } from "./ConnectButton.js";
import { usePermit2Migration } from "../hooks/usePermit2Migration.js";

interface MigrationStep {
  kind: "close" | "swap" | "mint";
  description: string;
  detail?: Record<string, string>;
}

export interface MigrationPreviewMeta {
  fromVersion: 3;
  targetHook?: { address: string; family: string };
  steps: MigrationStep[];
  warnings: string[];
  tokenAddress?: string;
  spender?: string;
  amount?: string;
}

interface Props {
  preview: MigrationPreviewMeta;
  lpTokenId?: string;
  onClose: () => void;
}

const KIND_SYMBOL: Record<MigrationStep["kind"], string> = {
  close: "✕",
  swap: "↔",
  mint: "✦",
};

const KIND_COLOR: Record<MigrationStep["kind"], string> = {
  close: "var(--diagnose-bleed)",
  swap: "var(--diagnose-toxic)",
  mint: "var(--diagnose-healthy)",
};

function shortHash(s: string): string {
  if (s.length <= 18) return s;
  return `${s.slice(0, 10)}…${s.slice(-6)}`;
}

const MODAL_THEME_VARS = {
  "--diagnose-base": "oklch(0.97 0.018 300)",
  "--diagnose-base-deep": "oklch(0.93 0.026 300)",
  "--diagnose-surface": "oklch(0.985 0.012 300)",
  "--diagnose-surface-2": "oklch(0.955 0.018 300)",
  "--diagnose-ink": "oklch(0.15 0.042 288)",
  "--diagnose-ink-soft": "oklch(0.28 0.04 288)",
  "--diagnose-ink-faint": "oklch(0.50 0.035 288)",
  "--diagnose-purple": "oklch(0.50 0.26 296)",
  "--diagnose-magenta": "oklch(0.60 0.27 348)",
  "--diagnose-cobalt": "oklch(0.50 0.23 258)",
  "--diagnose-neon": "oklch(0.90 0.20 99)",
  "--diagnose-bleed": "oklch(0.62 0.24 24)",
  "--diagnose-healthy": "oklch(0.70 0.20 145)",
  "--diagnose-toxic": "oklch(0.78 0.19 88)",
  "--diagnose-border": "oklch(0.18 0.04 290)",
  "--diagnose-border-soft": "oklch(0.18 0.04 290 / 0.14)",
  "--diagnose-border-mid": "oklch(0.18 0.04 290 / 0.24)",
  "--diagnose-shadow": "5px 5px 0 oklch(0.18 0.04 290)",
  "--diagnose-shadow-sm": "3px 3px 0 oklch(0.18 0.04 290)",
  "--font-display": "\"Barlow Condensed\", \"Space Grotesk\", system-ui, sans-serif",
  "--font-mono": "\"JetBrains Mono\", ui-monospace, SFMono-Regular, Menlo, monospace",
} as CSSProperties;

export function MigrationModal({ preview, lpTokenId, onClose }: Props) {
  const { isConnected } = useAccount();
  const { sign, recordMigration, isPending, error, result } = usePermit2Migration();
  const [submitted, setSubmitted] = useState(false);
  const [recordReceipt, setRecordReceipt] = useState<{
    migrationsTriggered: number;
    txHash?: string;
    explorerUrl?: string;
    stub: boolean;
  } | null>(null);
  const [recording, setRecording] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleSign = async () => {
    setSubmitted(true);
    const tokenAddress = (preview.tokenAddress ??
      "0x8d21329ac9d7785333cb41e187e556a8f7b81ec0") as `0x${string}`;
    const spender = (preview.spender ??
      "0x66a9893cc07d91d95644aedd05d03f95e1dba8af") as `0x${string}`;
    const amount = preview.amount ? BigInt(preview.amount) : 1_000_000n;
    const now = Math.floor(Date.now() / 1000);
    const signed = await sign({
      tokenAddress,
      spender,
      amount,
      expiration: now + 30 * 24 * 60 * 60,
      nonce: 0,
      sigDeadline: now + 30 * 60,
    });
    if (signed && lpTokenId) {
      setRecording(true);
      const receipt = await recordMigration(lpTokenId, signed);
      setRecording(false);
      if (receipt) {
        setRecordReceipt({
          migrationsTriggered: receipt.receipt.migrationsTriggered,
          txHash: receipt.receipt.txHash,
          explorerUrl: receipt.receipt.explorerUrl,
          stub: receipt.receipt.stub,
        });
      }
    }
  };

  const modal = (
    <div
      onClick={onClose}
      style={{
        ...MODAL_THEME_VARS,
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "oklch(0.18 0.04 290 / 0.72)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        paddingTop: 100,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 640,
          maxWidth: "92vw",
          background: "linear-gradient(180deg, oklch(0.995 0.006 300 / 0.98), oklch(0.972 0.014 300))",
          border: "2px solid var(--diagnose-border)",
          borderRadius: 3,
          boxShadow: "8px 8px 0 var(--diagnose-border)",
          overflow: "hidden",
        }}
      >
        {/* Title bar */}
        <div className="diagnose-window-bar" style={{ minHeight: 32, padding: "8px 12px" }}>
          <span className="diagnose-window-dot diagnose-window-dot-red" />
          <span className="diagnose-window-dot diagnose-window-dot-yellow" />
          <span className="diagnose-window-dot diagnose-window-dot-green" />
          <span className="diagnose-window-title" style={{ flex: 1 }}>
            permit2.sign &middot;{" "}
            {preview.targetHook
              ? preview.targetHook.family.toLowerCase().replace(/_/g, "-")
              : "v3 rebalance"}
          </span>
          <button
            type="button"
            onClick={onClose}
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              color: "var(--diagnose-ink-faint)",
              letterSpacing: "0.06em",
              padding: "2px 6px",
              background: "transparent",
              border: "1px solid var(--diagnose-border-mid)",
              borderRadius: 2,
              cursor: "pointer",
            }}
          >
            ESC
          </button>
        </div>

        {/* Header */}
        <div
          style={{
            padding: "14px 18px 12px",
            borderBottom: "1px solid var(--diagnose-border-soft)",
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              textTransform: "uppercase",
              letterSpacing: "0.12em",
              color: "var(--diagnose-cobalt)",
              marginBottom: 6,
            }}
          >
            MIGRATE · PERMIT2 BUNDLE
          </div>
          <h2
            style={{
              margin: 0,
              fontFamily: "var(--font-display)",
              fontSize: 18,
              fontWeight: 700,
              color: "var(--diagnose-ink)",
              textTransform: "uppercase",
              letterSpacing: "-0.01em",
            }}
          >
            {preview.targetHook
              ? `Close v3 · swap · mint v4 (${preview.targetHook.family.toLowerCase().replace(/_/g, "-")})`
              : "Close v3 · mint v3 (no v4 target)"}
          </h2>
        </div>

        {/* Body */}
        <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 12 }}>

          {/* Steps */}
          <ol
            style={{
              margin: 0,
              padding: 0,
              listStyle: "none",
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            {preview.steps.map((step, i) => (
              <li
                key={i}
                style={{
                  display: "flex",
                  gap: 10,
                  padding: "9px 12px",
                  border: "1.5px solid var(--diagnose-border-mid)",
                  borderRadius: 3,
                  background: "oklch(0.985 0.012 300 / 0.6)",
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                }}
              >
                <span
                  style={{
                    width: 18,
                    height: 18,
                    lineHeight: "18px",
                    textAlign: "center",
                    borderRadius: 2,
                    background: `color-mix(in oklch, ${KIND_COLOR[step.kind]} 14%, oklch(0.985 0.012 300))`,
                    color: KIND_COLOR[step.kind],
                    fontSize: 10,
                    fontWeight: 800,
                    flexShrink: 0,
                  }}
                >
                  {KIND_SYMBOL[step.kind]}
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{ color: "var(--diagnose-ink)" }}>{step.description}</div>
                  {step.detail && (
                    <div
                      style={{
                        marginTop: 4,
                        color: "var(--diagnose-ink-faint)",
                        fontSize: 10,
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "2px 12px",
                      }}
                    >
                      {Object.entries(step.detail).map(([k, v]) => (
                        <span key={k}>
                          <span style={{ opacity: 0.6 }}>{k}=</span>
                          {v}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ol>

          {/* Warnings */}
          {preview.warnings.length > 0 && (
            <ul
              style={{
                margin: 0,
                padding: "8px 12px 8px 28px",
                border: "1.5px solid oklch(0.78 0.19 88 / 0.40)",
                borderRadius: 3,
                background: "oklch(0.78 0.19 88 / 0.06)",
                fontSize: 10,
                color: "var(--diagnose-toxic)",
                lineHeight: 1.7,
                fontFamily: "var(--font-mono)",
              }}
            >
              {preview.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          )}

          {/* Permit2 data panel */}
          <div
            style={{
              padding: "10px 14px",
              border: "1.5px solid var(--diagnose-border-mid)",
              borderRadius: 3,
              background: "oklch(0.975 0.014 300 / 0.7)",
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              color: "var(--diagnose-ink-soft)",
              lineHeight: 1.8,
            }}
          >
            <div
              style={{
                marginBottom: 6,
                fontWeight: 700,
                fontSize: 9,
                textTransform: "uppercase",
                letterSpacing: "0.10em",
                color: "var(--diagnose-cobalt)",
              }}
            >
              Permit2 EIP-712 typed data
            </div>
            <div>verifyingContract 0x0000…78BA3 (Permit2)</div>
            <div>spender {shortHash(preview.spender ?? "0x66a98…ba8af (Universal Router)")}</div>
            <div>token {shortHash(preview.tokenAddress ?? "0x0000…0000")}</div>
            <div>sigDeadline now + 30 min</div>
          </div>

          {/* Signed result */}
          {result && (
            <div
              style={{
                padding: "10px 14px",
                border: "1.5px solid var(--diagnose-healthy)",
                borderRadius: 3,
                background: "color-mix(in oklch, var(--diagnose-healthy) 6%, oklch(0.985 0.012 300))",
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                color: "var(--diagnose-healthy)",
                lineHeight: 1.7,
                wordBreak: "break-all",
              }}
            >
              <div style={{ marginBottom: 4, fontWeight: 700 }}>
                ✓ signed by {shortHash(result.signer)}
              </div>
              <div style={{ color: "var(--diagnose-ink-faint)" }}>{shortHash(result.signature)}</div>
              <div style={{ marginTop: 4, color: "var(--diagnose-ink-faint)", fontSize: 10 }}>
                digest {shortHash(result.digest)}
              </div>
              {recording && (
                <div style={{ marginTop: 8, color: "var(--diagnose-cobalt)" }}>
                  recording on iNFT…
                </div>
              )}
              {recordReceipt && (
                <div
                  style={{
                    marginTop: 8,
                    paddingTop: 8,
                    borderTop: "1px dashed var(--diagnose-border-mid)",
                    color: recordReceipt.stub ? "var(--diagnose-ink-faint)" : "var(--diagnose-cobalt)",
                  }}
                >
                  iNFT migrationsTriggered → {recordReceipt.migrationsTriggered}
                  {recordReceipt.explorerUrl && !recordReceipt.stub && (
                    <>
                      {" · "}
                      <a
                        href={recordReceipt.explorerUrl}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: "var(--diagnose-cobalt)" }}
                      >
                        tx ↗
                      </a>
                    </>
                  )}
                  {recordReceipt.stub && " (stub — no anchor key)"}
                </div>
              )}
            </div>
          )}

          {/* Error */}
          {error && submitted && (
            <p
              style={{
                margin: 0,
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                color: "var(--diagnose-bleed)",
                padding: "8px 12px",
                border: "1.5px solid oklch(0.62 0.24 24 / 0.35)",
                borderRadius: 3,
                background: "oklch(0.62 0.24 24 / 0.06)",
              }}
            >
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "12px 18px",
            borderTop: "1px solid var(--diagnose-border-soft)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            background: "var(--diagnose-base-deep)",
          }}
        >
          {!isConnected ? (
            <>
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  color: "var(--diagnose-ink-faint)",
                }}
              >
                Connect wallet to sign the Permit2 bundle.
              </span>
              <ConnectButton />
            </>
          ) : (
            <>
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  color: "var(--diagnose-ink-faint)",
                  flex: 1,
                  lineHeight: 1.5,
                }}
              >
                {result
                  ? "Signature captured. Submit via the agent relayer to execute."
                  : "Sign the EIP-712 PermitSingle. The agent never executes — you stay in custody."}
              </span>
              <button
                type="button"
                className="btn-primary"
                onClick={handleSign}
                disabled={isPending || !!result}
                style={{
                  padding: "10px 20px",
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                  fontWeight: 800,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  background: "var(--diagnose-neon)",
                  color: "var(--diagnose-ink)",
                  border: "2px solid var(--diagnose-border)",
                  borderRadius: 2,
                  boxShadow: "var(--diagnose-shadow-sm)",
                  cursor: isPending || !!result ? "not-allowed" : "pointer",
                  opacity: isPending || !!result ? 0.6 : 1,
                  transition: "box-shadow 80ms ease-out, transform 80ms ease-out",
                  whiteSpace: "nowrap",
                }}
                onMouseEnter={(e) => {
                  if (isPending || !!result) return;
                  (e.currentTarget as HTMLButtonElement).style.boxShadow = "2px 2px 0 var(--diagnose-border)";
                  (e.currentTarget as HTMLButtonElement).style.transform = "translate(2px, 2px)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.boxShadow = "var(--diagnose-shadow-sm)";
                  (e.currentTarget as HTMLButtonElement).style.transform = "";
                }}
              >
                {isPending ? "signing…" : result ? "signed ✓" : "Sign Permit2"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
