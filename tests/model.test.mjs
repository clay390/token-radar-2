// Tests for the radar-2 model. Run: node --test tests/model.test.mjs
// (from the entry root; the kit snapshot is at ../kits/token-radar-01-kit/input/snapshot.json)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ageDays, boardIssue, buildBoard, buildRadar, dataScript, farmSteps, impliedValue,
  isPreToken, isRankable, parseSnapshot, peerMultipleFor, peerMultiples,
} from '../lib/model.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const SNAP = join(here, '..', '..', '..', 'kits', 'token-radar-01-kit', 'input', 'snapshot.json');
const snapshot = parseSnapshot(readFileSync(SNAP, 'utf8'));

test('snapshot parses: 758 protocols, 40 on the watchlist', () => {
  assert.equal(snapshot.protocols.length, 758);
  assert.equal(snapshot.watchlist.length, 40);
  assert.equal(snapshot.floor_usd, 50_000_000);
  assert.equal(snapshot.as_of, '2026-11-14');
});

test('ageDays counts whole days, null for unknown', () => {
  assert.equal(ageDays('2026-11-14', '2025-05-20'), 543);
  assert.equal(ageDays('2026-11-14', '2026-11-14'), 0);
  assert.equal(ageDays('2026-11-14', null), null);
  assert.equal(ageDays('2026-11-14', '2027-01-01'), 0);
});

test('peer multiples: market-wide median ~0.205, RWA has its own, thin categories fall back', () => {
  const peers = peerMultiples(snapshot);
  // The market-wide median is 0.2138 over the 128 live protocols with a positive ratio
  // (one record carries the sentinel mcap -1 and is left out, as a ratio below zero is no ratio).
  assert.ok(Math.abs(peers.global - 0.2138) < 0.001, `global ${peers.global}`);
  const rwa = peers.byCategory.get('RWA');
  assert.ok(rwa && !rwa.fallback && Math.abs(rwa.multiple - 0.275) < 0.001, `RWA ${JSON.stringify(rwa)}`);
  assert.equal(rwa.peer_count, 9);
  const risk = peers.byCategory.get('Risk Curators');
  assert.ok(risk && risk.fallback, 'Risk Curators has 1 peer, so it falls back');
  assert.equal(risk.peer_count, 1);
  assert.equal(risk.multiple, peers.global);
  const cedefi = peerMultipleFor('CeDeFi', peers);
  assert.ok(cedefi.fallback && cedefi.peer_count === 0 && cedefi.multiple === peers.global);
  const lending = peerMultipleFor('Lending', peers);
  assert.ok(!lending.fallback && Math.abs(lending.multiple - 0.132) < 0.001);
});

test('board: 226 rows (40 watchlist + 186 early), ranks 1..N, values non-increasing', () => {
  const board = buildBoard(snapshot);
  assert.equal(board.length, 226);
  const slugs = new Set(board.map((r) => r.slug));
  for (const s of snapshot.watchlist) assert.ok(slugs.has(s), `watchlist ${s} missing`);
  assert.deepEqual(board.map((r) => r.rank), Array.from({ length: 226 }, (_, i) => i + 1));
  for (let i = 1; i < board.length; i++) {
    assert.ok(board[i].implied_value_usd <= board[i - 1].implied_value_usd, `row ${i + 1} outranks row ${i}`);
  }
  assert.notEqual(board[0].implied_value_usd, board[board.length - 1].implied_value_usd);
  assert.equal(board[0].slug, 'steakhouse-financial');
  assert.ok(board[0].implied_value_usd > 400_000_000, `top ${board[0].implied_value_usd}`);
  assert.equal(boardIssue(board, snapshot), null);
});

test('board is deterministic across runs', () => {
  const a = buildBoard(snapshot);
  const b = buildBoard(snapshot);
  assert.equal(JSON.stringify(a), JSON.stringify(b));
});

test('farm steps: 7 steps, each 20..600 chars, category-specific action', () => {
  const board = buildBoard(snapshot);
  for (const r of board) {
    assert.equal(r.farm_steps.length, 7, r.slug);
    for (const s of r.farm_steps) assert.ok(s.length >= 20 && s.length <= 600, `${r.slug}: ${s.length} chars`);
  }
  const p = snapshot.protocols.find((x) => x.slug === 'steakhouse-financial');
  const steps = farmSteps(p, 543).map((s) => `${s.text} Cost: ${s.cost}. Time: ${s.time}.`);
  assert.ok(steps[1].includes('vault'), 'Risk Curators plan deposits into a vault');
  assert.ok(steps[1].includes('$250'), 'top-tier capital is $250');
  const dex = snapshot.protocols.find((x) => x.slug === 'bittensor-dtao');
  assert.ok(farmSteps(dex, 50)[1].text.includes('liquidity'), 'Dexs plan provides liquidity');
});

test('implied value follows the snapshot figures, no name special-cased', () => {
  const peers = peerMultiples(snapshot);
  const p = snapshot.protocols.find((x) => x.slug === 'steakhouse-financial');
  const v = impliedValue(p, snapshot.as_of, peers, { growth_weight: 0.5, growth_floor: -60, growth_cap: 120, maturity_floor: 0.6, maturity_range: 0.4, maturity_days: 1095, unknown_age_days: 365, min_peers: 3, peer_floor: 0.02, peer_cap: 1.5, breadth_weight: 0.02, breadth_max_chains: 4 });
  // TVL 2,754M x 0.2049 x growth(0.989) x maturity(0.799) x breadth(1.08) ≈ 481M
  assert.ok(v.implied > 400_000_000 && v.implied < 550_000_000, `implied ${v.implied}`);
  assert.equal(v.peer.fallback, true);
  // A clone with a different name scores identically: names never matter.
  const clone = { ...p, slug: 'some-other-name', name: 'Some Other Name' };
  const v2 = impliedValue(clone, snapshot.as_of, peers, { growth_weight: 0.5, growth_floor: -60, growth_cap: 120, maturity_floor: 0.6, maturity_range: 0.4, maturity_days: 1095, unknown_age_days: 365, min_peers: 3, peer_floor: 0.02, peer_cap: 1.5, breadth_weight: 0.02, breadth_max_chains: 4 });
  assert.equal(v2.implied, v.implied);
});

test('rankable excludes CEX and versioned names, includes every watchlist slug', () => {
  for (const s of snapshot.watchlist) {
    const p = snapshot.protocols.find((x) => x.slug === s);
    assert.ok(isPreToken(p) && isRankable(p), `${s} should be rankable`);
  }
  const cex = snapshot.protocols.find((x) => x.category === 'CEX' && isPreToken(x));
  if (cex) assert.equal(isRankable(cex), false);
});

test('radar data: data.js parses and matches the board', () => {
  const { board, radar } = buildRadar(snapshot);
  assert.equal(radar.board_size, 226);
  assert.equal(radar.early_size, 186);
  assert.equal(radar.watchlist_slugs.length, 40);
  assert.ok(radar.peers.length > 10);
  const script = dataScript(radar);
  assert.ok(script.startsWith('window.RADAR='));
  const parsed = JSON.parse(script.slice('window.RADAR='.length).replace(/;\n$/, ''));
  assert.equal(parsed.rows.length, 226);
  assert.equal(parsed.rows[0].slug, board[0].slug);
  assert.equal(parsed.rows[0].implied_value_usd, board[0].implied_value_usd);
});
