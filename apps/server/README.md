# @lp-guardian/server

Hono backend for LP Guardian's BE Agent workstream.

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
