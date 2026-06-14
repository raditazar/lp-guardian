import { Cap } from "../design/atoms.js";

// Mock data for rebalance simulation
const MOCK_DUST_POSITIONS = [
  { id: "405912", pool: "USDC/WETH", value: "$42.15" },
  { id: "408199", pool: "ARB/WETH", value: "$18.90" },
];

export function RebalanceProposal() {
  return (
    <section className="atlas-scoreboard lp-window" aria-label="Rebalance Proposal (Mock)">
      <div className="lp-window-bar">
        <div className="lp-window-dots" aria-hidden>
          <span className="lp-window-dot" style={{ background: "var(--lp-bleed)" }} />
          <span className="lp-window-dot" style={{ background: "var(--lp-toxic)" }} />
          <span className="lp-window-dot" style={{ background: "var(--lp-healthy)" }} />
        </div>
        <span className="lp-window-title">REBALANCE PROPOSAL (MOCK)</span>
      </div>

      <div style={{ padding: "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 20 }}>
          <div style={{ flex: 1 }}>
            <Cap style={{ marginBottom: 12 }}>CONSOLIDATE DUST</Cap>
            <p style={{ margin: "0 0 16px", color: "var(--lp-ink-soft)", fontSize: 13, lineHeight: 1.5 }}>
              The agent has identified {MOCK_DUST_POSITIONS.length} dust positions that are too small to be gas-efficient.
              Consolidating them into a single V4 position reduces overhead.
            </p>

            <div style={{ background: "var(--lp-base-deep)", borderRadius: 4, padding: 12, border: "1px solid var(--lp-border)" }}>
              {MOCK_DUST_POSITIONS.map(p => (
                <div key={p.id} style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 13 }}>
                  <span style={{ fontFamily: "var(--font-mono)", color: "var(--lp-ink-ghost)" }}>#{p.id} ({p.pool})</span>
                  <span style={{ color: "var(--lp-toxic)" }}>{p.value}</span>
                </div>
              ))}
              <div style={{ height: 1, background: "var(--lp-border-mid)", margin: "8px 0" }} />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 600 }}>
                <span>Estimated Gas Saved</span>
                <span style={{ color: "var(--lp-healthy)" }}>~$14.50 / rebalance</span>
              </div>
            </div>
          </div>

          <div style={{ width: "220px", display: "flex", flexDirection: "column", gap: 12 }}>
            <button className="lp-btn-primary" style={{ width: "100%", justifyContent: "center", padding: "12px", color: "var(--lp-ink-hard)" }}>
              Preview Permit2 Bundle
            </button>
            <span style={{ fontSize: 10, color: "var(--lp-ink-ghost)", textAlign: "center", lineHeight: 1.4 }}>
              Generates a gasless signature payload to close V3 positions and mint V4.
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}