# BE Agent Execution Plan

Status: execution plan aligned to `docs/portfolio_lp_guardian_technical_docs.md`.

`portfolio_lp_guardian_technical_docs.md` is the source of truth for BE Agent
scope. This file no longer narrows that brief; it only maps the target
architecture to the current repository and branch sequence.

## Source Of Truth

The BE Agent workstream implements Portfolio LP Guardian as a portfolio-level
system, not a position-only diagnostic tool.

Canonical architecture:

```text
SCAN -> CORRELATE -> SIMULATE -> OPTIMIZE -> EXECUTE -> MONITOR
```

Each agent must eventually be callable independently through MCP and must share
one backend service path. MCP must not create a second diagnosis pipeline.

## Current Branch: MCP Adapter

Goal:

- Expose LP Guardian through a local STDIO MCP server.
- Keep MCP as a thin adapter over the existing HTTP backend.
- Publish the canonical portfolio tool surface from the technical docs.

Canonical MCP product tools:

- `portfolio_diagnose` - Scan + Correlate
- `portfolio_simulate` - What-if / deterministic risk simulation
- `portfolio_optimize` - Rebalance recommendation
- `portfolio_execute` - Execution preview now, transaction submission later
- `portfolio_monitor` - Point-in-time monitor snapshot now, scheduler later

Utility tool:

- `lp_guardian_ping`

Compatibility:

- Existing `lp_guardian_*` tool names may remain as internal aliases during the
  transition, but public docs and UI should use the canonical portfolio tools.

## Backend Guardrails

- Portfolio scan starts from `walletAddress`.
- `tokenId` is secondary and is used when the user selects or validates a
  specific LP NFT.
- If both `walletAddress` and `tokenId` are supplied, ownership validation must
  run before a real verdict is produced.
- Wallet risk inputs should be derived by the backend from real wallet
  positions whenever possible.
- Client-supplied `riskInput` is allowed only when explicitly labeled by
  provenance, and defaults to `EMULATED` unless the caller supplies a stronger
  verified source.
- Degraded or unavailable subsystems must surface `EMULATED`, `ESTIMATED`, or a
  clear warning. They must not be hidden behind a real recommendation.

## Current Reality

Implemented or in progress:

- Robinhood Chain wallet position scan through NFPM transfer history.
- Wallet-derived aggregate `portfolioRiskInput`.
- Ownership validation through Robinhood NFPM `ownerOf`.
- Portfolio diagnosis endpoint: `POST /api/portfolio/diagnose`.
- MCP adapter package: `apps/mcp-server`.
- Canonical MCP product tool names for the 5-agent portfolio tool surface.
- Compatibility aliases for earlier `lp_guardian_*` MCP names.

Not final yet:

- Full async message bus between the six agents.
- Independent persistent agent workers.
- Real transaction execution through `portfolio_execute`.
- Persistent monitor scheduler and alert delivery.
- TEE provider enforcement for all computation paths.
- Orbit simulation layer.
- Camelot and Sushi ingestion.

## Next Branch After MCP

Recommended branch:

```text
feat/agent-orchestration
```

Initial scope:

1. Define a shared agent run/message model for all six agents.
2. Promote Scan, Correlate, and Simulate from foundation helpers into explicit
   services.
3. Add Optimize as a recommendation service backed by current risk outputs.
4. Add Execute as approval-gated preview only.
5. Add Monitor as snapshot plus alert-rule evaluation, without background
   autonomy until scheduling is implemented.
6. Wire all six agents to the MCP tool surface without duplicating backend
   business logic.

## No-Mock Demo Gate

Before claiming the judged flow is production-real:

- Wallet positions are fetched from a real source.
- Token ownership is verified against real chain data.
- Pool state and price inputs come from real chain, indexer, or price sources.
- Calculations are deterministic and reproducible from captured inputs.
- Report output records exact input hashes and source metadata.
- Missing production subsystems are labeled as unavailable, degraded, or
  emulated instead of being presented as real.
