import { type CSSProperties, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { AppHeader } from "../components/AppHeader.js";
import { Cap } from "../design/atoms.js";
import "../styles/landing.css";

/* ─── Shared inline primitives ──────────────────────────────────────── */

type StickerVariant = "purple" | "magenta" | "cobalt" | "yellow";

function StickerBadge({
  children,
  variant = "purple",
  style,
}: {
  children: ReactNode;
  variant?: StickerVariant;
  style?: CSSProperties;
}) {
  return (
    <span className={`lp-sticker lp-sticker-${variant}`} style={style}>
      {children}
    </span>
  );
}

function WindowPanel({
  title,
  children,
  style,
}: {
  title: string;
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <div className="lp-window" style={style}>
      <div className="lp-window-bar">
        <div className="lp-window-dots">
          <div className="lp-window-dot" style={{ background: "var(--lp-bleed)" }} />
          <div className="lp-window-dot" style={{ background: "var(--lp-toxic)" }} />
          <div className="lp-window-dot" style={{ background: "var(--lp-healthy)" }} />
        </div>
        <span className="lp-window-title">{title}</span>
      </div>
      <div className="lp-window-body">{children}</div>
    </div>
  );
}

function PixelArrow() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden>
      <path
        d="M2.5 6.5h8M7 2.5l4 4-4 4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="square"
        strokeLinejoin="miter"
      />
    </svg>
  );
}

/* ─── MCP tool manifest ──────────────────────────────────────────────── */

const CURRENT_MCP_TOOLS = [
  { name: "portfolio_diagnose", gated: true, desc: "Scan and correlate a wallet portfolio, with token ownership validation when tokenId is supplied." },
  { name: "portfolio_simulate", gated: true, desc: "Run deterministic portfolio risk simulation through the shared backend service." },
  { name: "portfolio_optimize", gated: true, desc: "Return the portfolio-level recommended action from the risk engine." },
  { name: "portfolio_execute", gated: true, desc: "Prepare an execution preview. This build never submits a transaction bundle." },
  { name: "portfolio_monitor", gated: false, desc: "Fetch a point-in-time wallet portfolio snapshot for monitor and alert agents." },
];

export function Agent() {
  return (
    <div className="landing-theme" style={{ minHeight: "100vh" }}>
      <div className="lp-grid-bg" />

      <AppHeader />

      {/* ── Hero ──────────────────────────────────────────────────────── */}
      <section
        style={{
          position: "relative",
          zIndex: 1,
          padding: "64px 36px 0",
          maxWidth: 1280,
          margin: "0 auto",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: 24, flexWrap: "wrap", marginBottom: 16 }}>
          <StickerBadge variant="magenta">ERC-7857</StickerBadge>
          <StickerBadge variant="cobalt">ROBINHOOD CHAIN</StickerBadge>
          <StickerBadge variant="yellow">LIVE · ONCHAIN</StickerBadge>
        </div>

        <Cap style={{ marginBottom: 12 }}>AGENT IDENTITY · LP GUARDIAN/01</Cap>

        <h1
          style={{
            margin: "0 0 20px",
            fontFamily: "var(--font-display)",
            fontSize: "clamp(2.8rem, 6vw, 5.6rem)",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "-0.01em",
            lineHeight: 0.95,
            color: "var(--lp-ink)",
          }}
        >
          The iNFT,{" "}
          <span style={{ color: "var(--lp-purple)" }}>in real time.</span>
        </h1>

        <p
          style={{
            maxWidth: "56ch",
            margin: "0 0 48px",
            color: "var(--lp-ink-soft)",
            fontSize: 15,
            lineHeight: 1.65,
          }}
        >
          LP Guardian/01 coordinates portfolio diagnosis, MCP tools, and migration previews
          for Robinhood Chain LP positions. The live agent identity panel is hidden until
          the deployed iNFT contract is configured.
        </p>
      </section>

      {/* ── Agent economy + MCP tools ─────────────────────────────────── */}
      <section
        style={{
          position: "relative",
          zIndex: 1,
          padding: "0 36px 60px",
          maxWidth: 1280,
          margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "minmax(300px, 1fr) minmax(400px, 1.6fr)",
          gap: 28,
          alignItems: "start",
        }}
        className="lp-agent-detail-grid"
      >
        {/* License + economy */}
        <WindowPanel title="agent.economy">
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {[
              {
                tag: "01",
                title: "mintLicense — 0.1 ETH / 24 h",
                desc: "Pay 0.1 ETH to unlock gated MCP tools for 24 hours. Owner gets 80% of the fee; 20% to protocol treasury.",
                accent: "var(--lp-yellow)",
              },
              {
                tag: "02",
                title: "memoryRoot evolves per run",
                desc: "Every diagnosis writes a new storage blob and updates agents(1).memoryRoot on chain. The agent's memory is an on-chain cursor.",
                accent: "var(--lp-purple)",
              },
              {
                tag: "03",
                title: "reputation + migrationsTriggered",
                desc: "Two on-chain counters increment per run. recordMigration bumps migrationsTriggered only when a user signs the Permit2 bundle.",
                accent: "var(--lp-healthy)",
              },
            ].map((c) => (
              <div
                key={c.tag}
                style={{
                  padding: "12px 14px",
                  border: "1.5px solid var(--lp-border-soft)",
                  borderRadius: 2,
                  background: "var(--lp-base-deep)",
                }}
              >
                <div
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 9,
                    fontWeight: 700,
                    letterSpacing: "0.06em",
                    color: c.accent,
                    marginBottom: 6,
                  }}
                >
                  {c.tag}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--lp-ink)",
                    marginBottom: 4,
                    lineHeight: 1.3,
                  }}
                >
                  {c.title}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: "var(--lp-ink-faint)",
                    lineHeight: 1.55,
                  }}
                >
                  {c.desc}
                </div>
              </div>
            ))}
          </div>
        </WindowPanel>

        {/* MCP tools table */}
        <WindowPanel title="mcp.tools · 5 product tools">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr auto",
              fontSize: 11,
              fontFamily: "var(--font-mono)",
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: "7px 12px",
                background: "var(--lp-base-deep)",
                borderBottom: "1.5px solid var(--lp-border)",
                color: "var(--lp-ink-ghost)",
                fontSize: 9,
                letterSpacing: "0.10em",
                textTransform: "uppercase",
              }}
            >
              TOOL
            </div>
            <div
              style={{
                padding: "7px 12px",
                background: "var(--lp-base-deep)",
                borderBottom: "1.5px solid var(--lp-border)",
                borderLeft: "1px solid var(--lp-border-soft)",
                color: "var(--lp-ink-ghost)",
                fontSize: 9,
                letterSpacing: "0.10em",
                textTransform: "uppercase",
                textAlign: "center",
              }}
            >
              ACCESS
            </div>

            {CURRENT_MCP_TOOLS.map((tool, i) => (
              <>
                <div
                  key={`name-${tool.name}`}
                  style={{
                    padding: "10px 12px",
                    borderBottom: i < CURRENT_MCP_TOOLS.length - 1 ? "1px solid var(--lp-border-soft)" : "none",
                    background: i % 2 === 0 ? "transparent" : "color-mix(in oklch, var(--lp-purple) 2%, transparent)",
                  }}
                >
                  <div style={{ color: "var(--lp-purple)", fontWeight: 700, marginBottom: 3 }}>
                    {tool.name}
                  </div>
                  <div style={{ fontSize: 10, color: "var(--lp-ink-faint)", lineHeight: 1.45, fontFamily: "var(--font-sans)" }}>
                    {tool.desc}
                  </div>
                </div>
                <div
                  key={`access-${tool.name}`}
                  style={{
                    padding: "10px 12px",
                    borderBottom: i < CURRENT_MCP_TOOLS.length - 1 ? "1px solid var(--lp-border-soft)" : "none",
                    borderLeft: "1px solid var(--lp-border-soft)",
                    background: i % 2 === 0 ? "transparent" : "color-mix(in oklch, var(--lp-purple) 2%, transparent)",
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "center",
                    paddingTop: 12,
                  }}
                >
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 8,
                      fontWeight: 700,
                      letterSpacing: "0.06em",
                      padding: "2px 6px",
                      border: "1px solid",
                      borderRadius: 1,
                      borderColor: tool.gated ? "var(--lp-yellow)" : "var(--lp-healthy)",
                      color: tool.gated ? "var(--lp-yellow)" : "var(--lp-healthy)",
                      background: tool.gated
                        ? "color-mix(in oklch, var(--lp-yellow) 8%, transparent)"
                        : "color-mix(in oklch, var(--lp-healthy) 8%, transparent)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {tool.gated ? "GATED" : "FREE"}
                  </span>
                </div>
              </>
            ))}
          </div>
        </WindowPanel>
      </section>

      {/* ── CTA ───────────────────────────────────────────────────────── */}
      <section
        style={{
          position: "relative",
          zIndex: 1,
          padding: "0 36px 100px",
          maxWidth: 1280,
          margin: "0 auto",
          display: "flex",
          gap: 16,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <Link
          to="/atlas"
          className="lp-btn-primary"
          style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 8 }}
        >
          Run a Diagnosis <PixelArrow />
        </Link>
      </section>
    </div>
  );
}
