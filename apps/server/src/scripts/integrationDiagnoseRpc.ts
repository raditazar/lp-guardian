import { loadConfig, loadLocalEnv } from "../config.js";
import { PortfolioService } from "../services/portfolio/portfolioService.js";
import type { Address } from "viem";

/**
 * Integration test script that uses real RPC to run the full diagnostic pipeline.
 * Usage: tsx src/scripts/integrationDiagnoseRpc.ts [tokenId]
 */
async function main() {
  loadLocalEnv();
  const config = loadConfig();
  const service = new PortfolioService(config);
  
  const tokenId = process.argv[2] ?? "225";
  const walletAddress = "0x536A844Ef215dD8A13a06023F24a568e4Ee3cB6B";

  console.log(`[integration] Running diagnostic for TokenId: ${tokenId} on Robinhood...`);
  console.log(`[integration] Wallet: ${walletAddress}`);

  try {
    const result = await service.diagnose({
      walletAddress: walletAddress as Address,
      tokenId,
      publishReport: true,
    });

    console.log("\n=== DIAGNOSIS COMPLETE ===");
    console.log(`Root Hash: ${result.report.rootHash}`);
    console.log(`Attestation Hash: ${result.attestationHash}`);
    console.log(`Anchor Status: ${result.anchor.status}`);
    if (result.anchor.status === "published") {
      console.log(`Tx Hash: ${result.anchor.txHash}`);
    }

    console.log("\n=== FINAL VERDICT ===");
    console.log(result.report.payload.verdict.markdown);

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

