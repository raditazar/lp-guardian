import { callTool, tools } from "./tools.js";

const ping = await callTool("lp_guardian_ping", {});

console.log(JSON.stringify({
  toolCount: tools.length,
  toolNames: tools.map((tool) => tool.name),
  ping,
}, null, 2));
