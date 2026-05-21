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

// ── App Search ────────────────────────────────────────────────────────────────
server.tool(
  "st_app_search",
  "Search for apps by name. Returns matching apps with their iOS and Android IDs so they can be used in other tools (downloads, revenue, reviews, etc.).",
  {
    term: z.string().describe("App name to search for (e.g. 'Candy Crush', 'Spotify')"),
    limit: z.number().optional().describe("Number of results to return (default: 5, max: 250)"),
  },
  async ({ term, limit }) => {
    const results = await stFetch(`/v1/unified/search_entities`, {
      entity_type: "app",
      term,
      limit: Math.min(limit ?? 5, 250),
    }) as Array<{
      name?: string;
      publisher_name?: string;
      icon_url?: string;
      app_id?: string;
      ios_apps?: Array<{ app_id?: number }>;
      android_apps?: Array<{ app_id?: string }>;
    }>;

    if (!results.length) {
      return { content: [{ type: "text", text: JSON.stringify({ error: `No apps found for "${term}".` }, null, 2) }] };
    }

    const apps = results.map((r) => {
      const iosId = r.ios_apps?.[0]?.app_id ?? null;
      const androidId = r.android_apps?.[0]?.app_id ?? null;
      const platforms: string[] = [];
      if (iosId) platforms.push("ios");
      if (androidId) platforms.push("android");
      return {
        name: r.name,
        publisher: r.publisher_name,
        available_on: platforms,
        ios_app_id: iosId,
        android_app_id: androidId,
        note: platforms.length === 1
          ? `Only available on ${platforms[0]} — use os="${platforms[0]}" in other tools`
          : null,
      };
    });

    return { content: [{ type: "text", text: JSON.stringify({ apps }, null, 2) }] };
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
    category: z.string().describe("Category ID — iOS uses numeric strings (e.g. '6014' for Games, '6000' for overall); Android uses lowercase strings (e.g. 'game', 'all', 'communication')"),
    chart_type: z.string().describe("Chart type — iOS: 'topfreeapplications', 'toppaidapplications', 'topgrossingapplications'; Android: 'topselling_free', 'topselling_paid', 'topgrossing'"),
    date: z.string().describe("Date in YYYY-MM-DD format"),
    country: z.string().optional().describe("ISO country code (default: US)"),
    limit: z.number().optional().describe("Number of results to return (default: 25, max: 200)"),
  },
  async ({ os, category, chart_type, date, country, limit }) => {
    const data = await stFetch(`/v1/${os}/category_rankings`, {
      category,
      chart_type,
      date,
      country: country ?? "US",
      limit: limit ?? 25,
      ...(os === "ios" ? { device: "iphone" } : {}),
    });
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

// ── App Reviews ───────────────────────────────────────────────────────────────
server.tool(
  "st_app_reviews",
  "Fetch user reviews for an app with review text, ratings, usernames, and dates. Filterable by country, date range, rating, and sentiment.",
  {
    os: z.enum(["ios", "android"]).describe("Operating system"),
    app_id: z.string().describe("Single app ID"),
    start_date: z.string().optional().describe("Start date in YYYY-MM-DD format"),
    end_date: z.string().optional().describe("End date in YYYY-MM-DD format"),
    countries: z.string().optional().describe("Comma-separated ISO country codes (iOS only, e.g. US,GB)"),
    rating_filters: z.string().optional().describe("Comma-separated star ratings to filter by (1–5), e.g. '1,2' for negative reviews"),
    limit: z.number().optional().describe("Number of reviews to return (default: 10, max: 200)"),
    page: z.number().optional().describe("Page number for pagination (default: 1)"),
  },
  async ({ os, app_id, start_date, end_date, countries, rating_filters, limit, page }) => {
    const url = new URL(`${BASE_URL}/v1/${os}/review/get_reviews`);
    url.searchParams.set("auth_token", TOKEN!);
    url.searchParams.set("app_id", app_id);
    if (start_date) url.searchParams.set("start_date", start_date);
    if (end_date) url.searchParams.set("end_date", end_date);
    if (countries) url.searchParams.set("countries", countries);
    if (rating_filters) {
      for (const r of rating_filters.split(",").map(s => s.trim()).filter(Boolean)) {
        url.searchParams.append("rating_filters[]", r);
      }
    }
    url.searchParams.set("limit", String(limit ?? 10));
    url.searchParams.set("page", String(page ?? 1));
    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`Sensor Tower API error ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

// ── Featured Apps ─────────────────────────────────────────────────────────────
server.tool(
  "st_featured_apps",
  "Get apps featured on the iOS App Store's Apps & Games pages. iOS only.",
  {
    category: z.string().describe("Category ID (e.g. '6020' for Apps, '6014' for Games)"),
    country: z.string().optional().describe("ISO country code (default: US)"),
    start_date: z.string().optional().describe("Start date in YYYY-MM-DD format (defaults to 3 days ago)"),
    end_date: z.string().optional().describe("End date in YYYY-MM-DD format (defaults to today)"),
  },
  async ({ category, country, start_date, end_date }) => {
    const data = await stFetch(`/v1/ios/featured/apps`, {
      category,
      country: country ?? "US",
      start_date,
      end_date,
    });
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

// ── Publisher Apps ────────────────────────────────────────────────────────────
server.tool(
  "st_publisher_apps",
  "List all apps by a publisher across iOS and Android. Accepts: publisher name (e.g. 'Metamoki'), numeric iOS publisher ID, 24-char unified hex ID, or a full Sensor Tower dashboard URL (e.g. https://app.sensortower.com/publisher/unified/abc123.../). If multiple publishers match a name, returns candidates with dashboard URLs for the user to confirm.",
  {
    publisher_name: z.string().describe("Publisher name, numeric iOS publisher ID, unified hex ID, or Sensor Tower publisher dashboard URL"),
    sort_by: z.enum(["downloads", "revenue", "rating", "release_date"]).optional().describe("Sort order (default: downloads)"),
  },
  async ({ publisher_name, sort_by }) => {
    const fetchParams = { sort_by: sort_by ?? "downloads" };
    const results: Record<string, unknown> = {};

    type UnifiedPublisher = {
      unified_publisher_id?: string;
      unified_publisher_name?: string;
      itunes_publishers?: Array<{ publisher_id?: number }>;
      android_publishers?: Array<{ publisher_id?: string }>;
    };

    // ── Step 1: resolve publisher — support name, numeric iOS ID, unified hex ID, or dashboard URL ──
    // Extract unified_publisher_id from a dashboard URL if provided
    const urlMatch = publisher_name.match(/\/publisher\/unified\/([a-f0-9]{24})/i);
    const unifiedIdDirect = urlMatch?.[1] ?? (/^[a-f0-9]{24}$/.test(publisher_name) ? publisher_name : null);

    let seedIosId: string | null = /^\d+$/.test(publisher_name) ? publisher_name : null;
    let iosPublisherIds: string[] = [];
    let androidPublisherIds: string[] = [];

    if (unifiedIdDirect) {
      // Go straight to unified lookup — skip search_entities entirely
      const unified = await stFetch(`/v1/unified/publishers`, {
        publisher_ids: unifiedIdDirect,
        publisher_id_type: "unified",
      }) as { publishers?: UnifiedPublisher[] };
      const pub = unified?.publishers?.[0];
      if (pub) {
        results.company_name = pub.unified_publisher_name;
        iosPublisherIds = (pub.itunes_publishers ?? []).map((p) => String(p.publisher_id)).filter(Boolean);
        androidPublisherIds = (pub.android_publishers ?? []).map((p) => p.publisher_id ?? "").filter(Boolean);
      } else {
        return { content: [{ type: "text", text: JSON.stringify({ error: `No publisher found for ID "${publisher_name}". Please verify the URL or ID at https://app.sensortower.com.` }, null, 2) }] };
      }
    } else if (seedIosId) {
      // Numeric iOS publisher ID passed directly — resolve via unified/publishers
      try {
        const unified = await stFetch(`/v1/unified/publishers`, {
          publisher_ids: seedIosId,
          publisher_id_type: "itunes",
        }) as { publishers?: UnifiedPublisher[] };
        const pub = unified?.publishers?.[0];
        if (pub) {
          results.company_name = pub.unified_publisher_name;
          iosPublisherIds = (pub.itunes_publishers ?? []).map((p) => String(p.publisher_id)).filter(Boolean);
          androidPublisherIds = (pub.android_publishers ?? []).map((p) => p.publisher_id ?? "").filter(Boolean);
        } else {
          iosPublisherIds = [seedIosId];
        }
      } catch {
        iosPublisherIds = [seedIosId];
      }
    } else {
      // ── Search unified — both platforms at once, already deduplicated by company ──
      type UnifiedSearchResult = {
        publisher_id?: string;
        publisher_name?: string;
        itunes_app_count?: number;
        android_app_count?: number;
        ios_publishers?: Array<{ publisher_id?: number }>;
        android_publishers?: Array<{ publisher_id?: string }>;
      };

      const search = await stFetch(`/v1/unified/search_entities`, {
        entity_type: "publisher",
        term: publisher_name,
        limit: 10,
      }) as UnifiedSearchResult[];

      // Filter to publishers where the search term appears as a whole word
      const term = publisher_name.toLowerCase();
      const wordBoundary = new RegExp(`(?<![a-z0-9])${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![a-z0-9])`, "i");
      const pool = search.filter((r) => wordBoundary.test(r.publisher_name ?? ""));

      if (!pool.length) {
        return { content: [{ type: "text", text: JSON.stringify({ error: `No publisher found matching "${publisher_name}". Try searching directly at https://app.sensortower.com and paste the publisher URL here.` }, null, 2) }] };
      }

      if (pool.length === 1) {
        // Only one match — auto-proceed
        const picked = pool[0];
        results.company_name = picked.publisher_name;
        iosPublisherIds = (picked.ios_publishers ?? []).map((p) => String(p.publisher_id)).filter(Boolean);
        androidPublisherIds = (picked.android_publishers ?? []).map((p) => p.publisher_id ?? "").filter(Boolean);
      } else {
        // Multiple matches — ask user to pick
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              message: `Found ${pool.length} publishers matching "${publisher_name}". Please open the correct one and paste the URL back here.`,
              candidates: pool.slice(0, 5).map((r) => ({
                publisher_name: r.publisher_name,
                ios_apps: r.itunes_app_count ?? 0,
                android_apps: r.android_app_count ?? 0,
                dashboard_url: `https://app.sensortower.com/publisher/unified/${r.publisher_id}/`,
              })),
            }, null, 2),
          }],
        };
      }
    }

    // Helper: fetch all pages from a publisher/apps endpoint
    async function fetchAllApps(url: string, params: Record<string, string | number | boolean | undefined>): Promise<Array<{ app_id?: number | string }>> {
      const PAGE_SIZE = 200;
      const allApps: Array<{ app_id?: number | string }> = [];
      let page = 1;
      while (true) {
        const res = await stFetch(url, { ...params, limit: PAGE_SIZE, page }) as { meta?: { count?: number }; data?: Array<{ app_id?: number | string }> };
        const batch = res?.data ?? [];
        allApps.push(...batch);
        if (batch.length < PAGE_SIZE) break; // last page
        page++;
      }
      return allApps;
    }

    // ── Step 3: fetch iOS apps from all publisher accounts and deduplicate ────
    try {
      const allApps: unknown[] = [];
      const seenIds = new Set<number>();
      for (const pid of iosPublisherIds) {
        const apps = await fetchAllApps(`/v1/ios/publishers/${pid}/apps`, { sort_by: fetchParams.sort_by });
        for (const app of apps) {
          const id = app.app_id as number;
          if (id && !seenIds.has(id)) { seenIds.add(id); allApps.push(app); }
        }
      }
      results.ios = { meta: { count: allApps.length }, data: allApps };
    } catch (e) {
      results.ios = { error: String(e) };
    }

    // ── Step 4: fetch Android apps from all publisher accounts ───────────────
    const androidIds = androidPublisherIds;
    if (androidIds.length === 0) {
      results.android = { meta: { count: 0 }, data: [], note: "No Android presence found for this publisher." };
    } else try {
      const allAndroidApps: unknown[] = [];
      const seenAndroidIds = new Set<string>();
      for (const pid of androidIds) {
        const apps = await fetchAllApps(`/v1/android/publishers/${encodeURIComponent(pid)}/apps`, { sort_by: fetchParams.sort_by });
        for (const app of apps) {
          const id = app.app_id as string;
          if (id && !seenAndroidIds.has(id)) { seenAndroidIds.add(id); allAndroidApps.push(app); }
        }
      }
      results.android = { meta: { count: allAndroidApps.length }, data: allAndroidApps };
    } catch (e) {
      results.android = { error: String(e) };
    }

    return { content: [{ type: "text", text: JSON.stringify(results, null, 2) }] };
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
