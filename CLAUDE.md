# Sensor Tower MCP Server

This project is a Model Context Protocol (MCP) server that exposes Sensor Tower API endpoints as tools inside Claude — both the desktop app and Claude Code CLI.

## What this gives you

Once wired up, Claude Code gains these tools:

| Tool | What it fetches |
|------|----------------|
| `st_app_overview` | App metadata — name, publisher, categories, rating |
| `st_sales_estimates` | Download & revenue estimates over a date range |
| `st_category_rankings` | Top app rankings for a category and chart type |
| `st_app_reviews` | User reviews, filterable by country and date |
| `st_keyword_search` | Apps ranking for a search term |
| `st_featured_apps` | Apps featured in the store on a given date |
| `st_publisher_apps` | All apps by a publisher |
| `st_usage_active_users` | DAU / MAU estimates |

## Setup (first time)

Just run the setup script — it handles everything automatically:

```bash
cd sensortower-mcp
./setup.sh
```

The script will:
1. Check that Node.js is installed
2. Install dependencies and build the server
3. Ask for your Sensor Tower token (find it at **sensortower.com → Account → API Settings**)
4. Inject the config into Claude automatically

Then restart Claude and you're done.

---

### Manual setup (if you prefer)

<details>
<summary>Click to expand</summary>

**1. Install and build**
```bash
npm install
npm run build
```

**2. Add to Claude desktop app** — `~/Library/Application Support/Claude/claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "sensortower": {
      "command": "node",
      "args": ["/absolute/path/to/sensortower-mcp/dist/index.js"],
      "env": {
        "SENSORTOWER_TOKEN": "your_token_here"
      }
    }
  }
}
```

**Or Claude Code CLI** — `~/.claude/settings.json` (same block as above).

Run `pwd` inside this folder to get the absolute path.

</details>

## Usage examples

Once connected, just ask Claude naturally:

- "Get me the overview for com.example.app on Android"
- "What were the download estimates for these 3 apps in Q1 2025 in the US?"
- "Show me the top 25 free iOS games in the US today"
- "What reviews has com.example.app received this month?"

## Rate limit

Sensor Tower allows **6 requests per second**. Each tool call makes one request.

## Adding more endpoints

All tools are defined in `src/index.ts`. Copy any existing `server.tool(...)` block and adjust the path and parameters. Run `npm run build` after changes.
