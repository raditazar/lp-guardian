# @lp-guardian/server

Hono backend for LP Guardian's BE Agent workstream.

## Current Priority

The active BE Agent priority is wallet-first diagnosis with early ownership
validation. See `../../docs/be-agent-priority.md`.

Treat broader portfolio/MCP endpoint drafts as target architecture until they
are reconciled with the current repo contract.

## Current Runtime

The server defaults to safe mock providers:

```env
AGENT_RUNTIME=mock
STRATEGIST_PROVIDER=mock
```

Runtime status is available at:

```http
GET /agent/runtime
```

The response shows the selected runtime, strategist provider, and whether the
ElizaOS or Phala paths are ready.

## ElizaOS Plan

ElizaOS is planned as the agent orchestration layer, but it is intentionally not
installed in this pnpm workspace yet.

Reason:

- ElizaOS official setup currently uses Bun-first tooling.
- This repository uses pnpm workspaces.
- Mixing Bun install state into the repo before a spike risks lockfile and
  dependency churn.

Recommended path:

1. Keep `AGENT_RUNTIME=mock` in this repo.
2. Create an isolated Bun spike outside the pnpm workspace.
3. Prove one LP strategist agent can return structured advice.
4. Bring the smallest working integration back through `ElizaAgentRuntime`.

## Phala Plan

`PhalaStrategistAdapter` is a placeholder until these are finalized:

- agent contract address
- signer policy
- attestation verification policy
- fallback behavior when the provider is unavailable

Until then, strategist output must be labeled `EMULATED`.

## Robinhood NFPM Transfer Scan

The no-mock demo path starts by discovering real LP NFT token ids for one of
the canonical Robinhood wallets. Set these values first:

```env
ROBINHOOD_RPC=https://robinhood-testnet.g.alchemy.com/v2/<YOUR_API_KEY>
ROBINHOOD_CHAIN_ID=46630
ROBINHOOD_NFPM_ADDRESS=0x...
ROBINHOOD_SCAN_FROM_BLOCK=0
```

Then scan either demo wallet:

```bash
pnpm --filter @lp-guardian/server scan:robinhood-transfers -- --wallet=mixed
pnpm --filter @lp-guardian/server scan:robinhood-transfers -- --wallet=bleeding
```

The script scans `Transfer` events from the configured
`NonfungiblePositionManager`, verifies current ownership with `ownerOf`, and
prints the currently owned token ids plus raw position snapshots from
`positions(tokenId)`.

## Robinhood Contract Smoke Test

These reads do not send transactions:

```bash
pnpm --filter @lp-guardian/server smoke:robinhood-contracts
```

The script verifies RPC chain id, reads `reportCount(subjectId)` from
`PortfolioReportRegistry`, and calls `PortfolioRiskEngine.computeRisk(...)`.

## Aggregate Risk Pipeline

This runs the BE report pipeline without NFPM data. It is useful while waiting
for the position manager address because it exercises the real risk engine and
produces the final report root format:

```bash
pnpm --filter @lp-guardian/server risk:pipeline -- --wallet=mixed
```

By default, it does not publish a transaction. It returns the
`publishReport(...)` arguments that an external signer or future backend signer
can submit.

Publishing from the backend requires a funded signer in `WALLET_BACKEND_PK` and
an explicit flag:

```bash
pnpm --filter @lp-guardian/server risk:pipeline -- --wallet=mixed --publish=true
```

Without `WALLET_BACKEND_PK`, backend auto-publish is unavailable, but the
no-mock read path, deterministic report hash, and manual/external-signing
arguments still work.

The same pipeline is exposed through a BE-only endpoint:

```http
POST /api/portfolio/diagnose
Content-Type: application/json

{
  "walletAddress": "0x4d3e3d1a38505185ba86a1b1f3084195d556bc2a",
  "subjectId": "605311",
  "riskInput": {
    "totalPositions": "10",
    "outOfRangePositions": "9",
    "dustPositions": "3",
    "correlatedExposureBps": "6000",
    "concentrationBps": "7000"
  },
  "publishReport": false,
  "requirePhala": false
}
```

This endpoint does not use mock providers. Until NFPM ingestion is wired,
clients must pass real aggregate inputs from an external/indexed source.
