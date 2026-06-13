import assert from "node:assert/strict";
import { createApp } from "../app.js";
import { loadConfig, loadLocalEnv } from "../config.js";

loadLocalEnv();
process.env.AGENT_RUNTIME = "eliza";
process.env.STRATEGIST_PROVIDER = "mock";

const app = createApp(loadConfig());
const response = await app.request("/agent/foundation/run", {
  method: "POST",
  headers: {
    "content-type": "application/json",
  },
  body: JSON.stringify({
    walletAddress: "0x0000000000000000000000000000000000000000",
    scenario: "dust-and-correlation",
  }),
});

assert.equal(response.status, 200);

const body = await response.json();
const payload = body.data?.messages?.[0]?.payload;

assert.equal(payload?.mode, "eliza");
assert.equal(payload?.runtime?.provider, "eliza");
assert.equal(payload?.runtime?.character, "LP_Guardian_Agent");
assert.equal(payload?.strategist?.provider, "eliza");
assert.equal(body.data?.strategistAdvice?.recommendation, "migrate");
assert.equal(body.data?.strategistAdvice?.source?.provider, "eliza");
assert.equal(body.data?.strategistAdvice?.source?.actionName, "SUMMARIZE_LP_RISK");

console.log(
  JSON.stringify({
    status: response.status,
    mode: payload?.mode,
    runtimeProvider: payload?.runtime?.provider,
    strategistProvider: payload?.strategist?.provider,
    actionName: body.data?.strategistAdvice?.source?.actionName,
  }),
);
