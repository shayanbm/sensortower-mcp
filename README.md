# Sensor Tower MCP Server

A [Model Context Protocol](https://modelcontextprotocol.io/) server that connects Claude to the [Sensor Tower API](https://app.sensortower.com/api/docs/app_analysis), giving you live app intelligence directly in chat.

---

## Getting started

Open Claude Code and say:

> "Get this repo and set it up: https://github.com/shayanbm/sensortower-mcp"

Claude will clone the repo, ask for your Sensor Tower API token (find it at https://app.sensortower.com/users/edit/api-settings), and handle everything automatically. Restart Claude desktop when prompted.

## Querying Sensor Tower data

Once set up, ask Claude to use Sensor Tower in your question. Examples:

- "Using Sensor Tower, show me all apps by Supercell"
- "Using Sensor Tower, how many downloads did Spotify get on iOS in the US last month?"
- "Using Sensor Tower, what are the top 10 free games on Android in Germany today?"
- "Using Sensor Tower, show me 1-star reviews for TikTok on iOS this week"
- "Using Sensor Tower, search for meditation apps"
- "Using Sensor Tower, what's the MAU trend for Candy Crush over the last 6 months?"

---

## Available tools

Once connected, Claude gains 8 tools it can call automatically when you ask questions about apps.

### `st_app_overview`
Fetch metadata for one or more apps — name, publisher, categories, rating, description, screenshots, and more.

**Example:**
> "What's the overview for TikTok on iOS?"
> "Give me the details for these 5 Android apps: ..."

---

### `st_sales_estimates`
Get download and revenue estimates for apps over a date range, broken down by country and granularity (daily / weekly / monthly).

**Parameters:** app IDs, start date, end date, countries, granularity

**Example:**
> "How many downloads did Instagram get in the US in Q1 2026?"
> "Compare Spotify and Apple Music revenue worldwide last month"

---

### `st_category_rankings`
Get the top apps in a specific category and chart type (free, paid, grossing) on a given date.

**Parameters:** OS, category ID, chart type, date, country, limit

**Example:**
> "What are the top 10 grossing iOS games in the US today?"
> "Show me the top free Android apps in Germany this week"

---

### `st_app_reviews`
Fetch user reviews for an app, filterable by country and date range.

**Parameters:** app ID, start date, end date, country, limit

**Example:**
> "What are users saying about Duolingo on iOS this month?"
> "Show me the latest 20 reviews for com.example.app in the UK"

---

### `st_app_search`
Search for apps by name and get their iOS and Android IDs.

**Parameters:** term, limit

**Example:**
> "Search for meditation apps"
> "Find apps called budget tracker"

---

### `st_featured_apps`
Get apps that were featured in the App Store or Google Play on a given date.

**Parameters:** OS, date, country

**Example:**
> "Which apps were featured on the App Store in the US yesterday?"

---

### `st_publisher_apps`
List all apps published by a specific publisher.

**Parameters:** OS, publisher ID

**Example:**
> "What apps does Supercell have on iOS?"

---

### `st_usage_active_users`
Get Daily Active Users (DAU) or Monthly Active Users (MAU) estimates for apps.

**Parameters:** app IDs, start date, end date, countries, granularity (daily / monthly)

**Example:**
> "What's the MAU trend for Twitter on iOS in the US over the last 6 months?"
> "Compare DAU for these 3 apps in January 2026"

---

## How to use it

Just ask Claude naturally — no commands or syntax needed:

```
"Get me the download estimates for com.spotify.music on Android in the US for Q1 2026"
"What are the top 25 free iOS apps in France right now?"
"Show me reviews for TikTok from the last 30 days"
"How many monthly active users does Candy Crush have?"
```

Claude will pick the right tool, make the API call, and present the results in a readable format.

---

## Requirements

- [Node.js](https://nodejs.org) v18 or higher
- A Sensor Tower account with API access — get your token at **sensortower.com → Account → API Settings**: https://app.sensortower.com/users/edit/api-settings
- Claude desktop app or Claude Code CLI

---

## Manual setup

If you prefer not to use the setup script, add this to your Claude config manually:

**Claude desktop app** — `~/Library/Application Support/Claude/claude_desktop_config.json`

**Claude Code CLI** — `~/.claude/settings.json`

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

Run `pwd` inside this folder to get the absolute path. Restart Claude after saving.

---

## Rate limit

Sensor Tower allows **6 requests per second**. Each tool call makes one API request.

## Adding more endpoints

All tools are defined in `src/index.ts`. Copy any existing `server.tool(...)` block, adjust the path and parameters, then run `npm run build`.
