import { loadConfig, loadLocalEnv } from "../config.js";
import { runDiagnosticPipeline } from "../pipeline/runDiagnosticPipeline.js";
import { createAgentRuntime } from "../services/agentRuntime/index.js";

/**
 * Integration test script that uses real RPC to run the full diagnostic pipeline.
 * Usage: tsx src/scripts/integrationDiagnoseRpc.ts [tokenId]
 */
async function main() {
  loadLocalEnv();
  const config = loadConfig();
  const agentRuntime = createAgentRuntime(config);
  
  const tokenId = process.argv[2] ?? "1"; // Default to tokenId 1
  const walletAddress = "0x0000000000000000000000000000000000000000";

  console.log(`[integration] Running diagnostic for TokenId: ${tokenId} on Arbitrum...`);
  console.log(`[integration] RPC: ${config.arbitrumRpcUrl ? "CONFIGURED" : "MISSING"}`);

  try {
    for await (const event of runDiagnosticPipeline(config, tokenId, {
      agentRuntime,
      foundationInput: { walletAddress, scenario: "basic" },
    })) {
      if (event.type === "phase.start") {
        console.log(`\n>>> Phase ${event.phase}: ${event.label}`);
      } else if (event.type === "tool.call") {
        console.log(`    [Tool] ${event.tool} calling...`);
      } else if (event.type === "tool.result") {
        console.log(`    [Tool] ${event.tool} returned in ${event.latencyMs}ms`);
      } else if (event.type === "narrative") {
        console.log(`    [Narrative] ${event.text}`);
      } else if (event.type === "agent.advice") {
        console.log(`    [Agent] Recommendation: ${event.recommendation} (Confidence: ${event.confidence})`);
        console.log(`    [Agent] Rationale: ${event.rationale}`);
      } else if (event.type === "report.uploaded") {
        console.log(`    [Storage] Uploaded. RootHash: ${event.rootHash}`);
      } else if (event.type === "report.anchored") {
        console.log(`    [Chain] Anchored. TxHash: ${event.txHash}`);
      } else if (event.type === "verdict.final") {
        console.log(`\n=== FINAL VERDICT ===`);
        console.log(event.markdown);
      } else if (event.type === "error") {
        console.error(`\n!!! ERROR: ${event.message}`);
      }
    }
    console.log(`\n[integration] Pipeline completed successfully.`);
  } catch (err) {
    console.error(`\n[integration] Pipeline failed:`, err);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
