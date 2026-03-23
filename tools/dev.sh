#!/usr/bin/env bash
# tools/dev.sh — Full setup + dev server start
# Usage: bash tools/dev.sh

set -e

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║        Copilot Engine — Dev Setup            ║"
echo "╚══════════════════════════════════════════════╝"
echo ""

# Check Node version
NODE_MAJOR=$(node --version | sed 's/v//' | cut -d. -f1)
if [ "$NODE_MAJOR" -lt 18 ]; then
  echo "❌  Node.js v18+ required (found $(node --version))"
  echo "    Install: https://nodejs.org  or  nvm use 18"
  exit 1
fi
echo "✅  Node $(node --version)"

# Copy .env if missing
if [ ! -f ".env" ]; then
  cp .env.example .env
  echo "⚠️   Created .env from .env.example — set your ANTHROPIC_API_KEY before continuing"
  echo ""
  echo "    Edit .env and re-run this script."
  exit 1
fi
echo "✅  .env found"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
  echo "📦  Installing dependencies..."
  npm install
fi
echo "✅  Dependencies ready"

echo ""
echo "🚀  Starting copilot-engine on http://localhost:3100"
echo "    Keep this terminal open alongside your frontend app."
echo "    Health check: curl http://localhost:3100/health"
echo ""

npm run dev
