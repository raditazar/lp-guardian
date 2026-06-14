import { Cap, Mono } from "../design/atoms.js";

// Mock data representing a correlation matrix between assets
const ASSETS = ["WETH", "USDC", "ARB", "LINK"];
const MATRIX = [
  [1.00, 0.12, 0.85, 0.65],
  [0.12, 1.00, 0.05, 0.10],
  [0.85, 0.05, 1.00, 0.70],
  [0.65, 0.10, 0.70, 1.00],
];

function getHeatColor(val: number) {
  if (val === 1) return "var(--lp-base)";
  if (val > 0.8) return "color-mix(in oklch, var(--lp-bleed) 60%, transparent)";
  if (val > 0.6) return "color-mix(in oklch, var(--lp-toxic) 60%, transparent)";
  if (val > 0.3) return "color-mix(in oklch, var(--lp-healthy) 30%, transparent)";
  return "color-mix(in oklch, var(--lp-base-deep) 50%, transparent)";
}

export function CorrelationMatrix() {
  return (
    <section className="atlas-scoreboard lp-window" aria-label="Correlation Matrix (Mock)">
      <div className="lp-window-bar">
        <div className="lp-window-dots" aria-hidden>
          <span className="lp-window-dot" style={{ background: "var(--lp-bleed)" }} />
          <span className="lp-window-dot" style={{ background: "var(--lp-toxic)" }} />
          <span className="lp-window-dot" style={{ background: "var(--lp-healthy)" }} />
        </div>
        <span className="lp-window-title">CORRELATION MATRIX (MOCK)</span>
      </div>
      <div style={{ padding: "20px" }}>
        <p style={{ margin: "0 0 16px", color: "var(--lp-ink-soft)", fontSize: 13, lineHeight: 1.5 }}>
          Displays the 30-day price correlation between assets in the portfolio.
          High correlation (&gt; 0.8) indicates concentrated risk exposure to a single market movement.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: `50px repeat(${ASSETS.length}, 1fr)`, gap: 4 }}>
          {/* Header Row */}
          <div></div>
          {ASSETS.map(a => (
            <div key={a} style={{ textAlign: "center", fontSize: 11, fontWeight: 600, color: "var(--lp-ink-ghost)" }}>
              {a}
            </div>
          ))}

          {/* Matrix Rows */}
          {MATRIX.map((row, i) => (
            <div style={{ display: "contents" }} key={ASSETS[i]}>
              <div style={{ display: "flex", alignItems: "center", fontSize: 11, fontWeight: 600, color: "var(--lp-ink-ghost)" }}>
                {ASSETS[i]}
              </div>
              {row.map((val, j) => (
                <div
                  key={`${i}-${j}`}
                  style={{
                    background: getHeatColor(val),
                    border: "1px solid var(--lp-border-soft)",
                    borderRadius: 4,
                    padding: "10px",
                    textAlign: "center",
                    fontFamily: "var(--font-mono)",
                    fontSize: 12,
                    color: val === 1 ? "var(--lp-ink-faint)" : "var(--lp-ink)",
                  }}
                >
                  {val.toFixed(2)}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}