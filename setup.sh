#!/bin/bash

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Sensor Tower MCP — Setup"
echo ""

# ── Step 1: Check Node.js ─────────────────────────────────────────────────────
echo "[1/4] Checking Node.js..."

if ! command -v node &>/dev/null; then
  echo "ERROR: Node.js is not installed. Download it from https://nodejs.org and re-run this script."
  exit 1
fi

NODE_VERSION=$(node -v)
echo "OK: Node.js $NODE_VERSION found"

# ── Step 2: Install & build ───────────────────────────────────────────────────
echo "[2/4] Installing dependencies and building..."

cd "$SCRIPT_DIR"
npm install --silent
npm run build --silent
echo "OK: Build complete"

# ── Step 3: Sensor Tower token ────────────────────────────────────────────────
echo "[3/4] Sensor Tower API token"
echo "Find your token at: https://app.sensortower.com/users/edit/api-settings"
echo ""

if [ -t 0 ]; then
  # Running interactively — prompt for token
  while true; do
    read -rp "Paste your token here: " ST_TOKEN
    ST_TOKEN="$(echo "$ST_TOKEN" | tr -d '[:space:]')"
    if [[ -n "$ST_TOKEN" ]]; then
      break
    fi
    echo "Token cannot be empty. Please try again."
  done
else
  # Running non-interactively (e.g. Claude Code) — read from env or ask user to set it
  if [[ -z "$SENSORTOWER_TOKEN" ]]; then
    echo "ERROR: Not running in an interactive terminal and SENSORTOWER_TOKEN env var is not set."
    echo "Please run: SENSORTOWER_TOKEN=your_token_here ./setup.sh"
    exit 1
  fi
  ST_TOKEN="$SENSORTOWER_TOKEN"
  echo "OK: Token loaded from SENSORTOWER_TOKEN env var"
fi

# ── Step 4: Update Claude config ──────────────────────────────────────────────
echo "[4/4] Connecting to Claude desktop..."

CONFIG_FILE="$HOME/Library/Application Support/Claude/claude_desktop_config.json"
SERVER_PATH="$SCRIPT_DIR/dist/index.js"

if [[ ! -f "$CONFIG_FILE" ]]; then
  mkdir -p "$(dirname "$CONFIG_FILE")"
  echo "{}" > "$CONFIG_FILE"
  echo "OK: Created Claude config file"
fi

python3 - "$CONFIG_FILE" "$SERVER_PATH" "$ST_TOKEN" <<'EOF'
import json, sys
path, server_path, token = sys.argv[1], sys.argv[2], sys.argv[3]
with open(path) as f:
    config = json.load(f)
config.setdefault("mcpServers", {})["sensortower"] = {
    "command": "node",
    "args": [server_path],
    "env": {"SENSORTOWER_TOKEN": token}
}
with open(path, "w") as f:
    json.dump(config, f, indent=2)
EOF

echo "OK: Claude config updated"
echo ""
echo "Done! Restart Claude desktop (Cmd+Q then reopen) to activate Sensor Tower tools."
