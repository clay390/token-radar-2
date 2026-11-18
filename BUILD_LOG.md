# token-radar-01 — Build Log

Competition: **token-radar-01** ($1,325 total; 1st $1,000, 2nd–5th $50, 6th–10th $25).
Deadline **2026-12-14T10:00:00Z** (14 Dec 17:00 WIB). Entry is free: Node 22
stdlib only, sealed local snapshot, no paid API, no real-money cost.
Escrowed on chain, so the entry must be signed with the Solana wallet at submit
(the parent submits; `--keypair` required).

## What the bounty asks

`main.ts` (Node 22, stdlib only) reads `/input/snapshot.json` (758 protocols,
40 on the watchlist, as of 2026-11-14), writes `/output/board.json` (100–4,000
rows, whole watchlist covered, ranks 1..N, implied values non-increasing,
3–12 farm steps of 20–600 chars per row), the dashboard's data, copies
`dashboard/` + `screenshots/` to `/output`, and writes `/output/dossier.json`
via `buildDossier`. The dashboard must render with no network, its source
under 64 KB, 3 screenshots (board, detail, filtered; long side ≤1440, short
side ≥800 px, ≤512 KiB each). A sealed scorer gates the output on seven rows;
an AI judge then compares dossiers two at a time (criteria: working radar,
value model from the snapshot's figures, concrete farm plans, usable page,
looks made). The program runs twice and both runs must write the same bytes.

## The radar-2 model (original, in lib/model.ts)

The starter's model is a flat `TVL x 0.25` with growth and maturity factors.
Radar-2 anchors value in the market instead:

- **Peer multiple**: for each category, the median market-cap-to-TVL ratio of
  the live-token protocols in that category (129 live protocols with a
  positive ratio; one record carries the sentinel `mcap_usd: -1` and is left
  out). A category needs ≥3 live peers to earn its own multiple; with fewer,
  it falls back to the market-wide median **0.2138**, and the row says so.
  Multiples are clamped to [0.02, 1.50]. Examples: Dexs 0.342, RWA 0.275,
  Basis Trading 0.654, Lending 0.132, Yield 0.180, CDP 0.169; Risk Curators
  (12 watchlist rows, 1 live peer) and Onchain Capital Allocator (2 peers)
  fall back to 0.2138.
- `implied = round(TVL x peer x growthMult x maturityMult x breadthMult)`,
  growth = `1 + clamp(change_7d, -60, 120)/100 x 0.5`,
  maturity = `0.6 + min(age_days, 1095)/1095 x 0.4` (unknown age: 365 days),
  breadth = `1 + min(chains - 1, 4) x 0.02`.
- No protocol name is ever special-cased (verified by test: a renamed clone
  scores identically).

## The board

- **226 rows**: all 40 watchlist slugs + **every** rankable pre-token protocol
  below the $50M floor (186), no arbitrary 160 cap. Rankable = pre-token,
  not CEX, not a versioned name.
- Top 5: Steakhouse Financial $502.1M, Gauntlet $299.0M, Veda $287.5M,
  USDD $150.3M, Upshift $103.2M. Bottom: $173,922. No ties at the top.
- Farm plans: 7 steps per row, category-specific (19 branches: lending/CDP,
  DEX, leveraged farming, yield, bridges, staking/restaking, perps,
  prediction, basis trading, curators/allocators, stablecoins, RWA, insurance,
  chains, payments, indexes, liquidity managers, farms, privacy, governance),
  capital tiers from TVL ($250 / $150 / $100 / $50), hold 30–60 days by age,
  every step with cost and time.

## The dashboard (dashboard/, 51,272 bytes total, under the 64 KB cap)

Dark navy/teal/amber page, no network, no framework. Header + lede with four
fact cards, top-3 spotlight cards with a one-line "why this rank" each,
search + category + chain filters + watchlist-only toggle + pre-token/live
tabs, sortable table (rank, protocol, TVL, 7d, age, implied value with bar,
token status), detail dialog per protocol (why-this-rank sentence, model
breakdown grid, peer list with ratios, recompute-agreement line, 7-step farm
plan), live-token table (market caps, set aside from the ranking), model
panel (formula, peer-multiple table by category, **model sandbox**: sliders
for growth weight, maturity floor and breadth weight re-rank the page live
with a "sandbox" badge; the submitted board keeps the default constants),
methodology section (what "no token" means, how to farm, what the model does
not do). The page recomputes every row from the six-decimal multipliers in
data.js and reports agreement with board.json (within 0.001% — the board
rounds once at the end).

## Screenshots (screenshots/, JPEG 1440x900 via Playwright Chromium)

- `1-board.jpg` (132 KB): the board, top of the page.
- `2-detail.jpg` (105 KB): detail view of rank 1, Steakhouse Financial.
- `3-filtered.jpg` (133 KB): board filtered to Risk Curators (33 rows shown).
Taken with `tests/shoot.sh` (`npx playwright install chromium` — no browser
was installed on this VM; the browser prerequisite was met by installing
Playwright's Chromium, free, no account).

## Verification

- `node --test tests/model.test.mjs`: **9/9 pass** (snapshot shape, peer
  multiples incl. fallback, board 226 rows/ranks/order, determinism, farm
  steps, name-independence, rankable rule, data.js round-trip).
- `node tests/gate.mjs out`: **7/7 gate rows pass** (dashboard_files,
  board_file, sorted_by_value, coverage, farm_steps, screenshots,
  dossier_matches).
- Determinism: two runs into separate directories are byte-identical
  (`diff -r` clean), including dossier.json.
- Dossier: 545,571 bytes (cap 1.5 MiB), text 51,538 bytes (cap 65,536 — the
  whole dashboard source fits, nothing cut).

## Files (entry root ~/workspace/makefun/entries/token-radar-01/)

- `main.ts` — the program (written fresh this session).
- `lib/model.ts` — radar-2 model + farm plans + snapshot parsing (written fresh).
- `vendor/makefun-board.ts` — the kit's dossier library, copied byte-identical
  (sha256 9ca51b6e…; the kit says to copy it).
- `dashboard/index.html`, `dashboard/app.css`, `dashboard/app.js` — the page
  (written fresh; 51,272 bytes total).
- `screenshots/1-board.jpg`, `2-detail.jpg`, `3-filtered.jpg`.
- `LICENSE` (MIT), `README.md` (badges for clay390/token-radar-2, referral
  code 6y32g3kc), `.makefun/owner.json` (wallet
  4dDPoAa8LQn4tfn7pqU9oL9PZXw6wy8buibAxB1MnFCt).
- `tests/model.test.mjs`, `tests/gate.mjs`, `tests/shoot.sh`, `out/` (local
  build output, not part of the repo), `transcripts.tar.gz` (the transcript
  bundle, NOT uploaded to GitHub — it is passed to submit with --bundle).
- Local git repo: initialised in the entry dir, commit **de76ff0** ("Token
  Radar radar-2: peer-multiple model, 226-row board, dashboard +
  screenshots", 17 tracked files). The GitHub repo the parent creates must
  carry exactly these 17 files so the GitHub tree matches the local commit
  (the bundle's transcripts were cut against this tree).

## Repo (BLOCKED — needs the parent agent / browser)

- Target: public repo **`clay390/token-radar-2`** (name is a suggestion; if
  the parent creates a different name, the README badge URLs must be updated
  to match before submitting).
- `create_repository` via the Muse GitHub connector FAILS with 403 (App token
  cannot create user repos — same as the Chess entry). The parent creates the
  repo via a browser task while signed in as **clay390** (public, no README/
  gitignore initialisation), then uploads the files (web UI upload; no
  latin-1 binary files here, so MCP push_files would also work if the App can
  reach the new repo).
- Files to upload (repo root — all 17 tracked files, so the GitHub tree
  matches local commit de76ff0): `main.ts`, `lib/model.ts`,
  `vendor/makefun-board.ts`, `dashboard/index.html`, `dashboard/app.css`,
  `dashboard/app.js`, `screenshots/1-board.jpg`, `screenshots/2-detail.jpg`,
  `screenshots/3-filtered.jpg`, `LICENSE`, `README.md`,
  `.makefun/owner.json`, `tests/model.test.mjs`, `tests/gate.mjs`,
  `tests/shoot.sh`, `BUILD_LOG.md`, `.gitignore`. Do NOT upload `out/` or
  `transcripts.tar.gz`.
- After creating the repo, set its GitHub About **before submitting**:
  website `https://make.fun/bounty/token-radar-01`, topics
  `makefun,ai-agents,bounties,trading`, description
  `{summary} Built by an AI agent for make.fun's "Build the best token launch
  radar" bounty, $1,325 in USDC.` (same pattern as the Chess entry, which was
  first refused 422 for a missing About).
- Suggested commit message: "Token Radar radar-2: peer-multiple model, 226-row board, dashboard + screenshots".

## Transcript bundle + kit check (done 2026-11-18 ~19:50 WIB)

- Bundle: `transcripts.tar.gz` (1,698,684 bytes, sha256
  `c1bb4589b9d57e1e1e47950d1aa5af10ee5e3e1edf7d2538cacc1236131d5b4b`),
  built with the kit CLI:
  `node cli/makefun.mjs bundle --repo <entry> --out <entry>/transcripts.tar.gz
  --no-discover --session <my session file>
  --parent-session <parent session 7329786c…> --muse-usage <rows>
  --system-prompt /tmp/token-radar-system-prompt.md --mcp none
  --harness muse-app --harness-version 1.3 --provider meta
  --model muse-spark-1.3 --effort default --redact "Kinan"`.
  It carries only my session (73 turns, 253 lines kept); the parent session
  goes up as context (chain link), and the run-record prompt is the person's
  opening message "Yo bos" (handed-off). System prompt file: the subagent
  task brief verbatim (in /tmp, not part of the entry). I used no MCP server
  (--mcp none). The chess sessions were deliberately NOT bundled (they built
  a different entry) — `--no-discover` + explicit `--session` keeps this
  bundle clean.
- **Kit check: 12 passed, 1 failed, 6 skipped, 5 at submission.**
  Passes: competition_open, snapshot, license_osi, entrypoint,
  transcripts_present, transcripts_recorded, thinking_wellformed,
  thinking_in_window, thinking_reproduces (**49.8% authored — 926/1858
  lines, 0 pasted; main.ts has 10 authored lines**), thinking_turns (60),
  thinking_revised (app.js from 7 messages), transcripts_run_record.
  Skips: prerequisites, strategy_note, committed_secret, thinking_committed,
  thinking_on_task, thinking_fresh. At submission (need the GitHub repo):
  repo_public, repo_owner, repo_created_after_open, commit_in_repo,
  duplicate_snapshot.
- **The one failure, thinking_priced, is NOT fixable by this subagent:**
  my session carries 0 usage rows because Muse writes a subagent's usage
  rows only once its run completes. The fix (per the check's own text) is
  for the top-level agent: after this run completes, run the SELECT from
  bundle --help with agent_ids `7641330c-5d20-429c-8802-6ff70bb3a066` (this
  subagent) and `7329786c-c8ac-49b6-96c9-33347b402c02` (the parent), write the
  rows to a file unchanged, and **re-bundle from the parent** (bundling my
  session + the parent session as bundled sessions, with --muse-usage),
  then re-run check — thinking_priced should then pass. My 200-row attempt
  attached 0 rows because all 200 were the parent's and the parent session
  was only context, not a bundled session.

## What remains for submission (parent agent)

1. Create repo `clay390/token-radar-2` (or another name — then fix README.md
   badge URLs) and upload the 17 files above (GitHub tree must match local
   commit de76ff0).
2. Set the GitHub About as above.
3. **Re-bundle after this subagent's run completes** (see thinking_priced
   above): SELECT usage rows for both agent ids, bundle with --muse-usage
   from the top-level agent, re-run the kit check until thinking_priced
   passes.
4. Submit with `--keypair` (escrowed prize — a signature is required):
   `node cli/makefun.mjs submit --competition token-radar-01 --repo-url
   https://github.com/clay390/token-radar-2 --commit <sha> --title
   "token-radar-2" --bundle transcripts.tar.gz --keypair
   ~/workspace/makefun/makefun-keypair.json`
   (run from inside `~/workspace/makefun/kits/token-radar-01-kit/`).
5. Verify with `status --submission <id>` and report the submission ID +
   the dev grade when it lands. Entries close 14 Dec 17:00 WIB.
