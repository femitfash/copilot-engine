#!/usr/bin/env bash
# tools/test.sh — Run test suite
# Usage: bash tools/test.sh

set -e

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║        Copilot Engine — Tests                ║"
echo "╚══════════════════════════════════════════════╝"
echo ""

# Quick smoke test: health check (requires server to be running)
echo "🔍  Health check..."
HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3100/health 2>/dev/null || echo "000")
if [ "$HEALTH" = "200" ]; then
  echo "✅  GET /health → 200"
else
  echo "⚠️   Server not running on port 3100 (skipping live API tests)"
  echo "    Run 'npm run dev' in another terminal, then re-run this script."
fi

# TypeScript type-check (no emit)
echo ""
echo "🔍  TypeScript type-check..."
npx tsc --noEmit && echo "✅  No type errors" || echo "❌  TypeScript errors found above"

echo ""
echo "ℹ️   Full test suite: add tests in a /tests directory and run with npm test"
