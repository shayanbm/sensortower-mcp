#!/bin/bash

set -e

# ── Colors ────────────────────────────────────────────────────────────────────
BOLD="\033[1m"
GREEN="\033[0;32m"
YELLOW="\033[0;33m"
RED="\033[0;31m"
CYAN="\033[0;36m"
RESET="\033[0m"

# ── Helpers ───────────────────────────────────────────────────────────────────
print_step() { echo -e "\n${CYAN}${BOLD}$1${RESET}"; }
print_ok()   { echo -e "${GREEN}✓ $1${RESET}"; }
print_warn() { echo -e "${YELLOW}⚠ $1${RESET}"; }
print_err()  { echo -e "${RED}✗ $1${RESET}"; }

# ── Banner ────────────────────────────────────────────────────────────────────
clear
echo -e "${BOLD}"
echo "  ╔══════════════════════════════════════════╗"
echo "  ║      Sensor Tower MCP — Setup            ║"
echo "  ╚══════════════════════════════════════════╝"
echo -e "${RESET}"
echo -e "  This script will connect Sensor Tower to Claude."
echo -e "  It takes about ${BOLD}30 seconds${RESET}.\n"

# ── Step 1: Check Node.js ─────────────────────────────────────────────────────
print_step "Step 1/4 — Checking requirements"

if ! command -v node &>/dev/null; then
  print_err "Node.js is not installed."
  echo -e "  → Download it from ${BOLD}https://nodejs.org${RESET} and re-run this script."
  exit 1
fi

NODE_VERSION=$(node -v)
print_ok "Node.js found ($NODE_VERSION)"

# ── Step 2: Install & build ───────────────────────────────────────────────────
print_step "Step 2/4 — Installing dependencies"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

npm install --silent
print_ok "Dependencies installed and server built"

# ── Step 3: Sensor Tower token ────────────────────────────────────────────────
print_step "Step 3/4 — Sensor Tower API token"

echo -e "  You can find your token at:"
echo -e "  ${BOLD}sensortower.com → Account → API Settings${RESET}\n"

while true; do
  read -rp "  Paste your token here: " ST_TOKEN
  ST_TOKEN="$(echo "$ST_TOKEN" | tr -d '[:space:]')"
  if [[ -n "$ST_TOKEN" ]]; then
    break
  fi
  print_warn "Token cannot be empty. Please try again."
done

print_ok "Token saved"

# ── Step 4: Update Claude config ──────────────────────────────────────────────
print_step "Step 4/4 — Connecting to Claude"

CONFIG_FILE="$HOME/Library/Application Support/Claude/claude_desktop_config.json"
SERVER_PATH="$SCRIPT_DIR/dist/index.js"

# Create config file if it doesn't exist
if [[ ! -f "$CONFIG_FILE" ]]; then
  mkdir -p "$(dirname "$CONFIG_FILE")"
  echo "{}" > "$CONFIG_FILE"
  print_ok "Created Claude config file"
fi

# Check for jq
if ! command -v jq &>/dev/null; then
  # Fallback: do a simple text-based merge
  EXISTING=$(cat "$CONFIG_FILE")

  MCP_BLOCK="\"mcpServers\": { \"sensortower\": { \"command\": \"node\", \"args\": [\"$SERVER_PATH\"], \"env\": { \"SENSORTOWER_TOKEN\": \"$ST_TOKEN\" } } }"

  if echo "$EXISTING" | grep -q '"mcpServers"'; then
    # Already has mcpServers — update just the sensortower entry
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
  else
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
  fi
else
  # Use jq for a clean merge
  UPDATED=$(jq \
    --arg path "$SERVER_PATH" \
    --arg token "$ST_TOKEN" \
    '.mcpServers.sensortower = {"command": "node", "args": [$path], "env": {"SENSORTOWER_TOKEN": $token}}' \
    "$CONFIG_FILE")
  echo "$UPDATED" > "$CONFIG_FILE"
fi

print_ok "Claude config updated"

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}${BOLD}  ✓ All done!${RESET}"
echo ""
echo -e "  ${BOLD}Last step:${RESET} Restart the Claude app (⌘Q then reopen)."
echo -e "  Sensor Tower tools will be available immediately after restart.\n"
