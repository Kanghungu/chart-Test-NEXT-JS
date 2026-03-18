import dotenv from "dotenv";
import { Octokit } from "@octokit/rest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import * as z from "zod/v4";
import { fileURLToPath } from "url";
import path from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, ".env") });

const githubToken = process.env.GITHUB_TOKEN;

if (!githubToken) {
  console.error("GITHUB_TOKEN is not set. Add it in mcp_test/mcp-server/.env");
  process.exit(1);
}

const octokit = new Octokit({ auth: githubToken });

const server = new McpServer({
  name: "github-mcp-server",
  version: "1.0.0",
});

server.registerTool(
  "github_get_me",
  {
    description: "Get the authenticated GitHub user profile.",
    inputSchema: {},
  },
  async () => {
    const { data } = await octokit.rest.users.getAuthenticated();
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              login: data.login,
              name: data.name,
              id: data.id,
              public_repos: data.public_repos,
              followers: data.followers,
              following: data.following,
              html_url: data.html_url,
            },
            null,
            2
          ),
        },
      ],
    };
  }
);

server.registerTool(
  "github_list_my_repos",
  {
    description: "List repositories of the authenticated user.",
    inputSchema: {
      per_page: z.number().int().min(1).max(100).default(20),
      sort: z.enum(["created", "updated", "pushed", "full_name"]).default("updated"),
    },
  },
  async ({ per_page, sort }) => {
    const { data } = await octokit.rest.repos.listForAuthenticatedUser({
      per_page,
      sort,
    });

    const repos = data.map((repo) => ({
      full_name: repo.full_name,
      private: repo.private,
      default_branch: repo.default_branch,
      updated_at: repo.updated_at,
      html_url: repo.html_url,
    }));

    return {
      content: [{ type: "text", text: JSON.stringify(repos, null, 2) }],
    };
  }
);

server.registerTool(
  "github_create_issue",
  {
    description: "Create a GitHub issue in a specific repository.",
    inputSchema: {
      owner: z.string().min(1),
      repo: z.string().min(1),
      title: z.string().min(1),
      body: z.string().optional(),
    },
  },
  async ({ owner, repo, title, body }) => {
    const { data } = await octokit.rest.issues.create({
      owner,
      repo,
      title,
      body,
    });

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              number: data.number,
              title: data.title,
              url: data.html_url,
              state: data.state,
            },
            null,
            2
          ),
        },
      ],
    };
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("GitHub MCP server is running via stdio.");
}

main().catch((error) => {
  console.error("Failed to start MCP server:", error);
  process.exit(1);
});
