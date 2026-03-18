import path from "path";
import { fileURLToPath } from "url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverPath = path.join(__dirname, "index.js");

const client = new Client(
  {
    name: "github-mcp-check-client",
    version: "1.0.0",
  },
  {
    capabilities: {},
  }
);

const transport = new StdioClientTransport({
  command: "node",
  args: [serverPath],
  cwd: __dirname,
});

try {
  await client.connect(transport);
  const toolsResult = await client.listTools();
  const toolNames = toolsResult.tools.map((t) => t.name);

  const meResult = await client.callTool({
    name: "github_get_me",
    arguments: {},
  });

  console.log(JSON.stringify({
    connected: true,
    tools: toolNames,
    github_get_me: meResult,
  }, null, 2));
} catch (error) {
  console.error(JSON.stringify({
    connected: false,
    error: error?.message ?? String(error),
  }, null, 2));
  process.exitCode = 1;
} finally {
  await transport.close();
}
