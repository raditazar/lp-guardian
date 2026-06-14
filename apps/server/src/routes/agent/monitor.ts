import { Hono } from "hono";
import type { Address } from "viem";
import { fail, ok } from "../../http/responses.js";
import type { MonitorService } from "../../services/portfolio/monitorService.js";

const addressPattern = /^0x[a-fA-F0-9]{40}$/;

function parseAddress(value: string): Address | null {
  return addressPattern.test(value) ? (value as Address) : null;
}

export function createAgentMonitorRoute(monitorService: MonitorService): Hono {
  const route = new Hono();

  route.get("/", (c) => {
    return c.json(ok(monitorService.snapshot()));
  });

  route.get("/:walletAddress", (c) => {
    const walletAddress = parseAddress(c.req.param("walletAddress"));
    if (!walletAddress) {
      return c.json(fail("BAD_REQUEST", "walletAddress must be an EVM address."), 400);
    }

    const state = monitorService.getWalletState(walletAddress);
    if (!state) {
      return c.json(
        fail("NOT_WATCHED", "Wallet is not currently tracked by the monitor agent."),
        404,
      );
    }

    return c.json(ok(state));
  });

  route.post("/:walletAddress/watch", (c) => {
    const walletAddress = parseAddress(c.req.param("walletAddress"));
    if (!walletAddress) {
      return c.json(fail("BAD_REQUEST", "walletAddress must be an EVM address."), 400);
    }

    return c.json(ok(monitorService.watch(walletAddress)));
  });

  route.delete("/:walletAddress/watch", (c) => {
    const walletAddress = parseAddress(c.req.param("walletAddress"));
    if (!walletAddress) {
      return c.json(fail("BAD_REQUEST", "walletAddress must be an EVM address."), 400);
    }

    const state = monitorService.unwatch(walletAddress);
    if (!state) {
      return c.json(
        fail("NOT_WATCHED", "Wallet is not currently tracked by the monitor agent."),
        404,
      );
    }

    return c.json(ok(state));
  });

  return route;
}
