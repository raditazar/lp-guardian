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

Run the selected agent runtime with:

```http
GET /agent/foundation/run
POST /agent/foundation/run
Content-Type: application/json

{
  "walletAddress": "0x0000000000000000000000000000000000000000",
  "scenario": "dust-and-correlation"
}
```

When `AGENT_RUNTIME=eliza`, this endpoint initializes and uses the ElizaOS
runtime bridge and the `SUMMARIZE_LP_RISK` Eliza action for strategist advice.

## ElizaOS Runtime

ElizaOS is installed in the server workspace and wired through
`ElizaAgentRuntime`. The runtime currently initializes the LP Guardian
character and plugin, then returns the same structured foundation-run contract
as the mock runtime.

Use it with:

```env
AGENT_RUNTIME=eliza
STRATEGIST_PROVIDER=mock
OPENAI_API_KEY=...
```

Smoke test the runtime without starting the server:

```bash
pnpm --filter @lp-guardian/server agent:smoke
pnpm --filter @lp-guardian/server agent:test
```

Current boundary:

- Eliza runtime initialization and LP Guardian plugin registration are real.
- The foundation-run envelope is server-native and labeled `mode: "eliza"`.
- Strategy advice comes from the configured `StrategistAdapter`; the default
  Eliza runtime path uses the registered `SUMMARIZE_LP_RISK` Eliza action.
- Phala-verified strategist output is the next attested integration step.

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
