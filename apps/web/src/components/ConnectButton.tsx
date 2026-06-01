import { useAccount, useChainId, useConnect, useDisconnect } from "wagmi";

function shortAddr(addr: string): string {
  return addr.length <= 10 ? addr : `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

const CHAIN_NAME: Record<number, string> = {
  1: "wallet",
  11155111: "wallet",
};

export function ConnectButton() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();

  if (isConnected && address) {
    return (
      <button
        type="button"
        onClick={() => disconnect()}
        className="btn btn-ghost"
        style={{ padding: "10px 14px", fontSize: 12, fontFamily: "var(--font-mono)" }}
        title={`${address} on ${CHAIN_NAME[chainId] ?? `chain ${chainId}`}`}
      >
        <span
          className="wallet-dot"
          style={{
            width: 6,
            height: 6,
            borderRadius: 999,
            background: "var(--healthy)",
            boxShadow: "0 0 6px var(--healthy-glow)",
            display: "inline-block",
          }}
        />
        {shortAddr(address)}
        <span className="wallet-chain" style={{ color: "var(--text-tertiary)", fontSize: 10, marginLeft: 4 }}>
          {CHAIN_NAME[chainId] ?? "wallet"}
        </span>
      </button>
    );
  }

  const primary = connectors[0];
  return (
    <button
      type="button"
      onClick={() => primary && connect({ connector: primary })}
      disabled={isPending || !primary}
      className="btn btn-primary"
      style={{ padding: "10px 14px", fontSize: 13 }}
    >
      {isPending ? "connecting…" : "Connect wallet"}
    </button>
  );
}
