// Local replica of the scorer's seven gate rows, run against main.ts's /output.
// Run: node tests/gate.mjs [out-dir]   (default: out)
// Exit 0 when all seven rows pass; prints each row's verdict.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { buildDossier } from '../vendor/makefun-board.ts';

const out = process.argv[2] ?? 'out';
const snap = JSON.parse(readFileSync('/home/hatch/workspace/makefun/kits/token-radar-01-kit/input/snapshot.json', 'utf8'));
const board = JSON.parse(readFileSync(join(out, 'board.json'), 'utf8'));
const rows = Array.isArray(board) ? board : board.rows;
let failures = 0;
const row = (name, ok, detail) => {
  console.log(`${ok ? 'pass' : 'FAIL'}  ${name.padEnd(16)} ${detail}`);
  if (!ok) failures++;
};

// dashboard_files: index.html + a .css + a .js, <=400 files, <=4 MiB, no http(s) in attributes/CSS/imports.
{
  const files = readdirSync(join(out, 'dashboard'));
  const hasHtml = files.includes('index.html');
  const hasCss = files.some((f) => f.endsWith('.css'));
  const hasJs = files.some((f) => f.endsWith('.js'));
  const bytes = files.reduce((n, f) => n + statSync(join(out, 'dashboard', f)).size, 0);
  const text = files.map((f) => readFileSync(join(out, 'dashboard', f), 'utf8')).join('\n');
  const urlInAttr = /<(?:a|link|script|img)[^>]*(?:href|src)\s*=\s*["']https?:\/\//i.test(text);
  const urlInCss = /@import\s+["']https?:\/\//i.test(text) || /url\(\s*["']?https?:\/\//i.test(text);
  const urlInJsImport = /(?:import\s+[^;]*?from\s*["']|require\(\s*["']|import\(\s*["'])https?:\/\//i.test(text);
  row('dashboard_files', hasHtml && hasCss && hasJs && files.length <= 400 && bytes <= 4_194_304 && !urlInAttr && !urlInCss && !urlInJsImport,
    `${files.length} files, ${bytes} bytes, html=${hasHtml} css=${hasCss} js=${hasJs}, network refs: attr=${urlInAttr} css=${urlInCss} js=${urlInJsImport}`);
}
// board_file: 100..4000 rows, slugs in the snapshot, names, positive whole ranks/values, farm steps present.
{
  const slugs = new Set(snap.protocols.map((p) => p.slug));
  const bad = rows.filter((r) => !slugs.has(r.slug) || typeof r.name !== 'string' || !r.name || !Number.isSafeInteger(r.rank) || r.rank <= 0 || !Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0 || r.implied_value_usd > 1e14 || !Array.isArray(r.farm_steps));
  const dupes = rows.length - new Set(rows.map((r) => r.slug)).size;
  row('board_file', rows.length >= 100 && rows.length <= 4000 && bad.length === 0 && dupes === 0, `${rows.length} rows, bad=${bad.length}, dupes=${dupes}`);
}
// sorted_by_value: ranks exactly 1..N, implied non-increasing, not all equal.
{
  const ranks = rows.map((r) => r.rank).sort((a, b) => a - b);
  const ranksOk = ranks.every((v, i) => v === i + 1);
  const orderOk = rows.every((r, i) => i === 0 || r.implied_value_usd <= rows[i - 1].implied_value_usd);
  const allEqual = rows.length >= 2 && rows[0].implied_value_usd === rows[rows.length - 1].implied_value_usd;
  row('sorted_by_value', ranksOk && orderOk && !allEqual, `ranks 1..${rows.length}: ${ranksOk}, non-increasing: ${orderOk}, all equal: ${allEqual}`);
}
// coverage: every watchlist slug appears.
{
  const have = new Set(rows.map((r) => r.slug));
  const missing = snap.watchlist.filter((s) => !have.has(s));
  row('coverage', missing.length === 0, `${snap.watchlist.length} watchlist slugs, missing ${missing.length}`);
}
// farm_steps: 3..12 strings, each 20..600 chars trimmed.
{
  const bad = rows.filter((r) => r.farm_steps.length < 3 || r.farm_steps.length > 12 || r.farm_steps.some((s) => s.trim().length < 20 || s.trim().length > 600));
  row('farm_steps', bad.length === 0, `${rows.length} rows checked, bad=${bad.length}`);
}
// screenshots: 3..4 images, <=512 KiB each, whole PNG/JPEG, long side <=1440, short side >=800.
{
  const shots = readdirSync(join(out, 'screenshots')).filter((f) => !f.startsWith('.'));
  const bad = [];
  for (const f of shots) {
    const b = readFileSync(join(out, 'screenshots', f));
    const isPng = b[0] === 0x89 && b[1] === 0x50;
    const isJpeg = b[0] === 0xff && b[1] === 0xd8;
    let w = 0; let h = 0;
    if (isJpeg) {
      // Walk JPEG markers to the SOF frame for dimensions.
      let i = 2;
      while (i + 9 < b.length) {
        if (b[i] !== 0xff) { i++; continue; }
        const marker = b[i + 1];
        if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
          h = (b[i + 5] << 8) | b[i + 6]; w = (b[i + 7] << 8) | b[i + 8]; break;
        }
        const len = (b[i + 2] << 8) | b[i + 3];
        i += 2 + len;
      }
    } else if (isPng) {
      w = b.readUInt32BE(16); h = b.readUInt32BE(20);
    }
    if (!isPng && !isJpeg) bad.push(`${f}: not PNG/JPEG`);
    else if (b.length > 524_288) bad.push(`${f}: ${b.length} bytes`);
    else if (Math.max(w, h) > 1440 || Math.min(w, h) < 800) bad.push(`${f}: ${w}x${h}`);
  }
  row('screenshots', shots.length >= 3 && shots.length <= 4 && bad.length === 0, `${shots.length} images, bad: ${bad.join('; ') || 'none'}`);
}
// dossier_matches: byte-for-byte what buildDossier writes, at most 1.5 MiB.
{
  const have = readFileSync(join(out, 'dossier.json'));
  const want = buildDossier(out, { text_max_bytes: 65_536, screenshots: { max: 4, max_bytes: 524_288 }, dashboard: { max_files: 400, max_bytes: 4_194_304 } });
  row('dossier_matches', Buffer.compare(have, Buffer.from(want)) === 0 && have.length <= 1_572_864, `${have.length} bytes, identical to buildDossier: ${Buffer.compare(have, Buffer.from(want)) === 0}`);
}

console.log(failures === 0 ? 'gate: 7/7 pass' : `gate: ${failures} row(s) FAIL`);
process.exit(failures === 0 ? 0 : 1);
