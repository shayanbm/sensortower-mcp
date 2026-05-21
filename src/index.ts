import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const TOKEN = process.env.SENSORTOWER_TOKEN;
if (!TOKEN) {
  console.error("SENSORTOWER_TOKEN environment variable is required");
  process.exit(1);
}

const BASE_URL = "https://api.sensortower.com";

async function stFetch(path: string, params: Record<string, string | number | boolean | undefined>) {
  const url = new URL(`${BASE_URL}${path}`);
  url.searchParams.set("auth_token", TOKEN!);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") {
      url.searchParams.set(k, String(v));
    }
  }
  const res = await fetch(url.toString());
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Sensor Tower API error ${res.status}: ${text}`);
  }
  return res.json();
}

const server = new McpServer({
  name: "sensortower",
  version: "1.0.0",
});

// ── App Overview ──────────────────────────────────────────────────────────────
server.tool(
  "st_app_overview",
  "Fetch metadata for one or more apps (name, publisher, categories, rating, description). Up to 100 app IDs per call.",
  {
    os: z.enum(["ios", "android"]).describe("Operating system"),
    app_ids: z.string().describe("Comma-separated app IDs (bundle IDs for iOS, package names for Android)"),
  },
  async ({ os, app_ids }) => {
    const data = await stFetch(`/v1/${os}/apps`, { app_ids });
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

// ── Downloads & Revenue Estimates ─────────────────────────────────────────────
server.tool(
  "st_sales_estimates",
  "Get download and revenue estimates for apps over a date range.",
  {
    os: z.enum(["ios", "android"]).describe("Operating system"),
    app_ids: z.string().describe("Comma-separated app IDs"),
    start_date: z.string().describe("Start date in YYYY-MM-DD format"),
    end_date: z.string().describe("End date in YYYY-MM-DD format"),
    countries: z.string().optional().describe("Comma-separated ISO country codes, e.g. US,GB. Defaults to WW (worldwide)"),
    date_granularity: z.enum(["daily", "weekly", "monthly"]).optional().describe("Granularity of the results (default: monthly)"),
  },
  async ({ os, app_ids, start_date, end_date, countries, date_granularity }) => {
    const data = await stFetch(`/v1/${os}/sales_report_estimates`, {
      app_ids,
      start_date,
      end_date,
      countries: countries ?? "WW",
      date_granularity: date_granularity ?? "monthly",
    });
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

// ── Category Rankings ─────────────────────────────────────────────────────────
server.tool(
  "st_category_rankings",
  "Get app rankings for a specific category and chart type on a given date.",
  {
    os: z.enum(["ios", "android"]).describe("Operating system"),
    category: z.string().describe("Category ID (e.g. '6014' for Games on iOS, 'GAME' for Android)"),
    chart_type: z.enum(["topfreeapplications", "toppaidapplications", "topgrossingapplications"]).describe("Chart type"),
    date: z.string().describe("Date in YYYY-MM-DD format"),
    country: z.string().optional().describe("ISO country code (default: US)"),
    limit: z.number().optional().describe("Number of results to return (default: 25, max: 200)"),
  },
  async ({ os, category, chart_type, date, country, limit }) => {
    const data = await stFetch(`/v1/${os}/ranking/get_category_rankings`, {
      category,
      chart_type,
      date,
      country: country ?? "US",
      limit: limit ?? 25,
    });
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

// ── App Reviews ───────────────────────────────────────────────────────────────
server.tool(
  "st_app_reviews",
  "Fetch user reviews for an app, optionally filtered by country and date range.",
  {
    os: z.enum(["ios", "android"]).describe("Operating system"),
    app_id: z.string().describe("Single app ID"),
    start_date: z.string().optional().describe("Start date in YYYY-MM-DD format"),
    end_date: z.string().optional().describe("End date in YYYY-MM-DD format"),
    country: z.string().optional().describe("ISO country code (default: US)"),
    limit: z.number().optional().describe("Number of reviews to return (default: 10, max: 100)"),
  },
  async ({ os, app_id, start_date, end_date, country, limit }) => {
    const data = await stFetch(`/v1/${os}/reviews/get_reviews`, {
      app_id,
      start_date,
      end_date,
      country: country ?? "US",
      limit: limit ?? 10,
    });
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

// ── Keyword Search ────────────────────────────────────────────────────────────
server.tool(
  "st_keyword_search",
  "Search for apps by keyword and get their store rankings for that term.",
  {
    os: z.enum(["ios", "android"]).describe("Operating system"),
    term: z.string().describe("Search keyword"),
    country: z.string().optional().describe("ISO country code (default: US)"),
    limit: z.number().optional().describe("Number of results (default: 10, max: 50)"),
  },
  async ({ os, term, country, limit }) => {
    const data = await stFetch(`/v1/${os}/search_results/top_apps`, {
      term,
      country: country ?? "US",
      limit: limit ?? 10,
    });
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

// ── Featured Apps ─────────────────────────────────────────────────────────────
server.tool(
  "st_featured_apps",
  "Get apps that were featured in the App Store or Google Play on a given date.",
  {
    os: z.enum(["ios", "android"]).describe("Operating system"),
    date: z.string().describe("Date in YYYY-MM-DD format"),
    country: z.string().optional().describe("ISO country code (default: US)"),
  },
  async ({ os, date, country }) => {
    const data = await stFetch(`/v1/${os}/featured/get_featured_apps`, {
      date,
      country: country ?? "US",
    });
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

// ── Publisher Apps ────────────────────────────────────────────────────────────
server.tool(
  "st_publisher_apps",
  "List all apps by a specific publisher.",
  {
    os: z.enum(["ios", "android"]).describe("Operating system"),
    publisher_id: z.string().describe("Publisher ID"),
  },
  async ({ os, publisher_id }) => {
    const data = await stFetch(`/v1/${os}/publishers/${publisher_id}/apps`, {});
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

// ── Usage Active Users (DAU/MAU) ──────────────────────────────────────────────
server.tool(
  "st_usage_active_users",
  "Get Daily Active Users (DAU) or Monthly Active Users (MAU) estimates for apps.",
  {
    os: z.enum(["ios", "android"]).describe("Operating system"),
    app_ids: z.string().describe("Comma-separated app IDs"),
    start_date: z.string().describe("Start date in YYYY-MM-DD format"),
    end_date: z.string().describe("End date in YYYY-MM-DD format"),
    countries: z.string().optional().describe("Comma-separated ISO country codes (default: US)"),
    granularity: z.enum(["daily", "monthly"]).optional().describe("DAU or MAU (default: monthly)"),
  },
  async ({ os, app_ids, start_date, end_date, countries, granularity }) => {
    const data = await stFetch(`/v1/${os}/usage/active_users`, {
      app_ids,
      start_date,
      end_date,
      countries: countries ?? "US",
      granularity: granularity ?? "monthly",
    });
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
