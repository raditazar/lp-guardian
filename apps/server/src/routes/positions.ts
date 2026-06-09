import { Hono } from "hono";
import { getMockPositions } from "../services/mockPositions.js";

export function createPositionsRoute(): Hono {
  const route = new Hono();

  route.get("/:address", (c) => {
    const address = c.req.param("address");
    return c.json(getMockPositions(address));
  });

  return route;
}
