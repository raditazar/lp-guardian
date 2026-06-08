export interface ServerConfig {
  port: number;
  nodeEnv: string;
  agentRuntimeProvider: "mock" | "eliza";
  strategistProvider: "mock" | "phala";
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  return {
    port: Number(env.PORT ?? 3001),
    nodeEnv: env.NODE_ENV ?? "development",
    agentRuntimeProvider:
      env.AGENT_RUNTIME === "eliza" ? "eliza" : "mock",
    strategistProvider:
      env.STRATEGIST_PROVIDER === "phala" ? "phala" : "mock",
  };
}
