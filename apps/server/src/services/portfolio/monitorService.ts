import type { Address } from "viem";
import type { ServerConfig } from "../../config.js";
import { PortfolioService } from "./portfolioService.js";
import { runFoundationAgents } from "../agentOrchestrator.js";

const DEFAULT_MONITOR_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export class MonitorService {
  private interval: NodeJS.Timeout | null = null;
  private readonly watchedWallets = new Set<Address>();
  private readonly portfolioService: PortfolioService;

  constructor(private readonly config: ServerConfig) {
    this.portfolioService = new PortfolioService(config);
    
    // Add canonical demo wallets to watch list by default
    const demoWallets: Address[] = [
      "0xfd235968e65b0990584585763f837a5b5330e6de",
      "0x8f4daa33706d70677fd69e4e0d47e595bc820e95",
      "0x4d3e3d1a38505185ba86a1b1f3084195d556bc2a",
      "0x4b296808f414ab3775889fa2863e1d73f958a58e",
      "0x90deceec188094f6f6c1ef446d843f70abfc92cb",
      "0x7c6ef14f6890d0fda17fb8e4fb6f649f0355c3be",
      "0x536A844Ef215dD8A13a06023F24a568e4Ee3cB6B" // Token #225 owner
    ];
    demoWallets.forEach(w => this.watch(w));
  }

  watch(walletAddress: Address): void {
    this.watchedWallets.add(walletAddress.toLowerCase() as Address);
  }

  unwatch(walletAddress: Address): void {
    this.watchedWallets.delete(walletAddress.toLowerCase() as Address);
  }

  start(intervalMs: number = DEFAULT_MONITOR_INTERVAL_MS): void {
    if (this.interval) return;

    console.log(`[MonitorService] Starting autonomous portfolio monitoring every ${intervalMs / 1000}s...`);
    this.interval = setInterval(() => this.tick(), intervalMs);
    
    // Run immediate first tick in background
    this.tick().catch(err => console.error("[MonitorService] Initial tick failed:", err));
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  private async tick(): Promise<void> {
    const wallets = Array.from(this.watchedWallets);
    if (wallets.length === 0) return;

    console.log(`[MonitorService] Ticking: scanning ${wallets.length} watched wallets...`);

    for (const wallet of wallets) {
      try {
        const risk = await this.portfolioService.getWalletPositions(wallet);
        
        // Simple anomaly detection logic:
        // 1. High correlated exposure (> 80%)
        // 2. High concentration (> 70%)
        // 3. Many out-of-range positions
        
        const issues: string[] = [];
        if (risk.riskInput.correlatedExposureBps > 8000n) issues.push("High correlation detected");
        if (risk.riskInput.concentrationBps > 7000n) issues.push("High concentration detected");
        if (risk.riskInput.outOfRangePositions > 0n) issues.push(`${risk.riskInput.outOfRangePositions} positions out-of-range`);

        if (issues.length > 0) {
          console.warn(`[MonitorService] ALERT for ${wallet}: ${issues.join(", ")}`);
          
          // Trigger the agent orchestrator to simulate a real "monitor agent" alert
          runFoundationAgents({
            mode: "mock",
            note: (agent) => `Monitor Agent detected anomalies in wallet ${wallet}: ${issues.join(", ")}. Triggering ${agent} analysis.`,
          });
        } else {
          console.log(`[MonitorService] ${wallet} is healthy.`);
        }
      } catch (err) {
        console.error(`[MonitorService] Failed to scan ${wallet}:`, err);
      }
    }
  }
}

