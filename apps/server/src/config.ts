export interface ServerConfig {
    port: number;
    nodeEnv: string;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
    return{
        port: Number(env.PORT ?? 3001),
        nodeEnv: env.NODE_ENV ?? "development",
    }
}