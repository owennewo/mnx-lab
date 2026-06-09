#!/bin/bash
# Legacy entry point, kept for muscle memory.
# Since the Cloudflare Workers migration, `npm run dev` runs everything:
# the Vite dev server hosts the Worker (worker/index.ts) via the Cloudflare
# Vite plugin, so there is no separate Express process to start.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR" && exec npm run dev
