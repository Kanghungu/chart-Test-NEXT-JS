# GitHub MCP Server

This server exposes GitHub tools over MCP (`stdio`).

## 1) Environment

Create or update `.env` in this folder:

```env
GITHUB_TOKEN=your_github_personal_access_token
```

Recommended token scopes:
- `repo` (private repos / issues)
- `read:user`

## 2) Run locally

```bash
npm install
npm start
```

## 3) MCP client config example

Add this to your MCP client settings (example JSON):

```json
{
  "mcpServers": {
    "github-local": {
      "command": "node",
      "args": ["d:/practice/TradingView/mcp_test/mcp-server/index.js"]
    }
  }
}
```

## 4) Available tools

- `github_get_me`
- `github_list_my_repos`
- `github_create_issue`
