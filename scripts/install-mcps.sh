#!/usr/bin/env bash
# ------------------------------------------------------------
# Install the recommended Cline Marketplace (MCP) extensions.
# This script is intended to be run from a real interactive terminal
# (TTY). The Cline CLI’s MCP installer launches a small wizard that
# cannot run in the non‑interactive sandbox used by this assistant.
# ------------------------------------------------------------
set -euo pipefail

# ---------------------------------------------------------------------
# 1️⃣  Make sure the Cline CLI is installed and you are logged in.
# ---------------------------------------------------------------------
if ! command -v cline >/dev/null 2>&1; then
  echo "ERROR: 'cline' command not found. Install the CLI first (npm i -g @cline/cli)."
  exit 1
fi

# If you have never logged in on this machine, the following will open a
# browser window for OAuth authentication.
echo "Ensuring you are logged into Cline…"
cline login || true   # ignore if already logged in

# ---------------------------------------------------------------------
# 2️⃣  List of MCPs to install (core set for complex Transferly work).
# ---------------------------------------------------------------------
MCP_LIST=(
  auth0
  riza
  paypal
  stripe
  redis
  valkey
  aws-infrastructure
  aws-cdk
  aws-step-functions
  sentry
  prometheus-query
  cloudwatch-logs
  playwright
  appium
  code-documentation-generator
  perplexity-research
  openai
  markdownify
  codegen
  openapi-proxy
  asana
  linear
  notion
  dice-roller
  ip-geolocation
  transloadit
)

echo "=== Installing MCPs ==="
for mcp in "${MCP_LIST[@]}"; do
  echo "↳ Installing $mcp …"
  # The '--yes' flag tells the wizard to skip the confirmation prompt.
  # NOTE: This still requires an interactive TTY; run this script from a
  # normal terminal (e.g., VS Code terminal, iTerm, etc.).
  cline mcp install "$mcp" --yes
done

# ---------------------------------------------------------------------
# 3️⃣  Verify installation
# ---------------------------------------------------------------------
echo "=== Installed MCPs ==="
cline mcp list

# ---------------------------------------------------------------------
# 4️⃣  Create a .env template for required secrets (if it does not exist).
# ---------------------------------------------------------------------
ENV_FILE=.env
if [ ! -f "$ENV_FILE" ]; then
  cat <<'EOF' > "$ENV_FILE"
# ==== MCP‑related secret placeholders (populate with real values) ====
# AWS
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_DEFAULT_REGION=us-east-1

# PayPal
PAYPAL_CLIENT_ID=
PAYPAL_CLIENT_SECRET=

# Stripe
STRIPE_SECRET_KEY=

# Auth0
AUTH0_DOMAIN=
AUTH0_CLIENT_ID=
AUTH0_CLIENT_SECRET=

# Sentry (optional)
SENTRY_DSN=

# OpenAI (if you intend to use the OpenAI MCP)
OPENAI_API_KEY=

# Perplexity (if you intend to use the Perplexity research MCP)
PERPLEXITY_API_KEY=

# Transloadit (for file‑processing MCP)
TRANSLOADIT_KEY=
TRANSLOADIT_SECRET=
EOF
  echo "Created $ENV_FILE template. Add real secret values and keep this file out of version control."
else
  echo "$ENV_FILE already exists – leaving it unchanged."
fi

echo "✅ All recommended MCPs have been installed (if the script completed without error)."
echo "   Remember to populate $ENV_FILE with your actual credentials and add it to .gitignore."
