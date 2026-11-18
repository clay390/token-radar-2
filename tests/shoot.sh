#!/bin/sh
# Take the three dashboard screenshots with Playwright's Chromium (installed
# via `npx playwright install chromium`; no npm package needed).
# Run from the entry root: sh tests/shoot.sh
# Reads out/dashboard/index.html (built by main.ts) and writes JPEGs to screenshots/:
#   1-board.jpg    the board, top of the page
#   2-detail.jpg   the detail view of the rank-1 protocol
#   3-filtered.jpg the board filtered to one category
# Viewport 1440x900: the gate wants the long side at most 1440 and the short side at least 800.
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PAGE="file://$ROOT/out/dashboard/index.html"
npx -y playwright@1.49.1 screenshot --viewport-size="1440,900" --wait-for-selector="tbody tr" --wait-for-timeout=400 "$PAGE" "$ROOT/screenshots/1-board.jpg"
npx -y playwright@1.49.1 screenshot --viewport-size="1440,900" --wait-for-selector="tbody tr" --wait-for-timeout=400 "$PAGE#p=steakhouse-financial" "$ROOT/screenshots/2-detail.jpg"
npx -y playwright@1.49.1 screenshot --viewport-size="1440,900" --wait-for-selector="tbody tr" --wait-for-timeout=400 "$PAGE#category=Risk%20Curators" "$ROOT/screenshots/3-filtered.jpg"
ls -la "$ROOT/screenshots/"
