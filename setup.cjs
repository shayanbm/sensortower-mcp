#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const os = require("os");
const { execSync } = require("child_process");

const isWindows = process.platform === "win32";
const scriptDir = __dirname;

console.log("Sensor Tower MCP — Setup");
console.log("");

// ── Step 1: Check Node.js version ─────────────────────────────────────────────
const [major] = process.versions.node.split(".").map(Number);
if (major < 18) {
  console.error(`ERROR: Node.js v18+ required. You have v${process.versions.node}.`);
  console.error("Download the latest version from https://nodejs.org");
  process.exit(1);
}
console.log(`[1/4] Node.js v${process.versions.node} OK`);

// ── Step 2: Install & build ───────────────────────────────────────────────────
console.log("[2/4] Installing dependencies and building...");
try {
  execSync("npm install --silent", { cwd: scriptDir, stdio: "inherit" });
  execSync("npm run build", { cwd: scriptDir, stdio: "pipe" });
  console.log("OK: Build complete");
} catch (e) {
  console.error("ERROR: Build failed.", e.message);
  process.exit(1);
}

// ── Step 3: Sensor Tower token ────────────────────────────────────────────────
console.log("[3/4] Sensor Tower API token");
console.log("Find your token at: https://app.sensortower.com/users/edit/api-settings");
console.log("");

const ST_TOKEN = process.env.SENSORTOWER_TOKEN;
if (!ST_TOKEN) {
  console.error("ERROR: SENSORTOWER_TOKEN environment variable is not set.");
  console.error("Please run: SENSORTOWER_TOKEN=your_token node setup.js");
  process.exit(1);
}
console.log("OK: Token loaded from SENSORTOWER_TOKEN env var");

// ── Step 4: Install to stable path ────────────────────────────────────────────
console.log("[4/4] Connecting to Claude desktop...");

const installDir = path.join(os.homedir(), ".sensortower-mcp");
const serverPath = path.join(installDir, "index.js");

fs.mkdirSync(installDir, { recursive: true });
fs.copyFileSync(path.join(scriptDir, "dist", "index.js"), serverPath);
console.log(`OK: Server installed to ${serverPath}`);

// ── Step 5: Update Claude config ──────────────────────────────────────────────
let configPath;
if (isWindows) {
  configPath = path.join(process.env.APPDATA, "Claude", "claude_desktop_config.json");
} else {
  configPath = path.join(os.homedir(), "Library", "Application Support", "Claude", "claude_desktop_config.json");
}

fs.mkdirSync(path.dirname(configPath), { recursive: true });

let config = {};
if (fs.existsSync(configPath)) {
  try {
    config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  } catch {
    console.error("ERROR: Could not parse Claude config file. Please check it manually:", configPath);
    process.exit(1);
  }
}

config.mcpServers = config.mcpServers || {};
config.mcpServers.sensortower = {
  command: "node",
  args: [serverPath],
  env: { SENSORTOWER_TOKEN: ST_TOKEN },
};

fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
console.log("OK: Claude config updated");

console.log("");
console.log("Done! Restart Claude desktop (Cmd+Q on Mac, or close and reopen on Windows) to activate Sensor Tower tools.");
