# BE Agent Priority

Status: working priority for the current repo.

Demo objective: no mock data in the judged path. Mock providers are allowed only
as local development scaffolding and automated-test fixtures.

This document reconciles the portfolio-level technical draft with the codebase
that exists today. Treat the external markdown as target architecture, not as a
source of truth for currently available endpoints.

## Direction

The BE Agent workstream should move toward wallet-level diagnosis.

Chain priority:

1. Robinhood Chain testnet
2. Arbitrum, after the Robinhood path has a real no-mock flow

Primary input:

- `walletAddress`

Secondary input:

- `tokenId`, only when the user drills into or validates a specific LP NFT

The current implementation is still position-led and includes mock providers:

- `GET /api/positions/:address`
- `GET /api/diagnose/:tokenId?walletAddress=...`
- mock foundation runtime for scan/correlate/simulate

These mock providers must not be used as the final demo path.

The next backend shape should be wallet-first while preserving the current
frontend flow:

- Atlas starts from the wallet.
- Diagnose can still inspect a selected tokenId.
- The backend verifies that the selected tokenId belongs to the wallet before
  producing a real verdict.

## API Priority

Do not implement the draft `/api/v1/portfolio/*` API verbatim until the FE/BE
contract is frozen. Use a small compatibility layer first.

Priority order:

1. Keep current endpoints stable for the frontend.
2. Add wallet-first diagnosis behind a new endpoint or internal service.
3. Make MCP a thin adapter over the same service, not a separate logic path.
4. Rename or version public endpoints only after the service contract is stable.

Recommended near-term endpoint:

```http
POST /api/portfolio/diagnose
Content-Type: application/json

{
  "walletAddress": "0x...",
  "tokenId": "605311",
  "scenario": "dust-and-correlation"
}
```

For streaming, prefer reusing the current SSE event model before creating a new
event schema:

```http
GET /api/portfolio/diagnose/:runId/stream
```

## MCP Decision

Implement HTTP backend first, MCP adapter second.

Pros:

- One source of business logic for FE, tests, and future MCP tools.
- Faster to ship the real demo path.
- Easier to debug with browser and curl before agent clients are involved.

Cons:

- The Agentic AI story is less complete until MCP exists.
- Tool names and licensing behavior may drift if not documented early.

Guardrail:

- Define MCP tool names and arguments now.
- Implement the MCP server as an adapter over HTTP/internal services later.
- Do not let MCP create a second diagnose pipeline.

## Ownership Validation

Implement ownership validation now, not later.

Minimum rule:

- If `walletAddress` and `tokenId` are both provided, the backend must verify
  that the LP position owner matches the wallet before producing a real
  diagnosis.

Consequence:

- The backend needs a reliable owner source: subgraph, RPC contract read, or a
  real indexed data service.
- Demo wallets must use tokenIds that actually match the wallet, or the UI must
  show an explicit ownership mismatch.
- The current zero-address fallback should remain demo-only and must not be
  labeled as real.
- Tests need fixtures for valid owner, invalid owner, and unavailable owner
  source.

Recommended behavior:

- Valid owner: continue diagnosis with `VERIFIED` provenance for ownership.
- Mismatch: stop early with an error event and no recommendation.
- Source unavailable: continue only in degraded mode with a visible
  `EMULATED` or `ESTIMATED` label, depending on the fallback.

## Real Data Priority

The next real integration should be selected by demo value and backend risk.

Recommended priority:

1. Real Robinhood Chain wallet connectivity and chain metadata.
2. Real wallet and tokenId ownership validation.
3. Real price or pool state source for the selected position.
4. Deterministic IL calculation from verified inputs.
5. Real quote or pool-state backed migration/rebalance preview.
6. Report persistence from the real run inputs and outputs.
7. MCP adapter over the same real service.
8. TEE signing or no TEE claim if a real provider is unavailable.
9. Stylus, Orbit, Robinhood Chain, Camelot, and Sushi expansion.

Rationale:

- Ownership validation removes the biggest trust gap immediately.
- One real Robinhood Chain data path is more valuable for the demo than many
  mocked protocols.
- TEE, Stylus, Orbit, and Robinhood Chain remain important narrative tracks, but
  they should not block wallet-first diagnosis.
- If any subsystem is not real, the demo must either omit that claim or label it
  as a development-only path that is not part of the judged flow.

## No-Mock Demo Gate

Before demo, the judged flow must pass these gates:

- Wallet positions are fetched from a real source.
- Token ownership is verified against a real chain or canonical index.
- Pool state and price inputs come from real chain/index/price data.
- Calculations are deterministic and reproducible from the captured inputs.
- Report output records the exact input hashes and source metadata.
- Any unavailable production subsystem is excluded from the demo narrative
  instead of being replaced by mock data.

## Priority Adjustments From The Draft

Immediate:

- Wallet-first diagnosis.
- Robinhood Chain testnet as the first real chain.
- Ownership validation.
- Real position data path for at least one curated Robinhood wallet.
- Honest fallback labels.
- Keep current FE-compatible endpoints working.
- Remove mock providers from the demo path.

Next:

- Portfolio-level aggregation and risk summary.
- Internal service boundary that can power both HTTP and MCP.
- MCP tools as an adapter.
- Monitor/alert service in a non-autonomous, demo-safe mode.

Later:

- Full six-agent orchestration with async message bus.
- TEE provider integration.
- Stylus computation contracts.
- Orbit Chain simulation layer.
- Camelot and Sushi ingestion.
- Robinhood Chain stock LP stubs or deployment, depending on available docs and
  testnet readiness.

## Open Decisions

- What is the official Robinhood Chain testnet chain ID?
- Should the first wallet-first diagnose endpoint return SSE immediately, or
  create a run and stream by `runId`?
- Which curated wallet/tokenId pair is the canonical demo case?
- What is the minimum acceptable real signal for the hackathon demo: owner
  check only, full position lookup, or position plus IL?

## Robinhood Testnet Inputs

RPC:

```text
https://rpc.testnet.chain.robinhood.com
```

Canonical demo wallets:

| Scenario | Address |
| --- | --- |
| Portfolio | `0xfd235968e65b0990584585763f837a5b5330e6de` |
| Bleeding | `0x8f4daa33706d70677fd69e4e0d47e595bc820e95` |
| Mixed | `0x4d3e3d1a38505185ba86a1b1f3084195d556bc2a` |
| Whale | `0x4b296808f414ab3775889fa2863e1d73f958a58e` |
| Healthy | `0x90deceec188094f6f6c1ef446d843f70abfc92cb` |
| Drifting | `0x7c6ef14f6890d0fda17fb8e4fb6f649f0355c3be` |
