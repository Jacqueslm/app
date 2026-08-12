// What your competitors are posting on YouTube.
//
//     node competitorwatch.js @SoberLeon @RecoveryElevator
//     node competitorwatch.js https://www.youtube.com/@SomeChannel --days 14
//
// YOU supply the channels — handles, URLs, or UC… ids. An earlier version had
// four channel ids hardcoded from memory; every one of them 404'd, because
// they were invented. Nothing in this file guesses at data any more.
//
// Reads YouTube's official, key-free channel RSS and nothing else. The Reddit
// half was removed: Reddit now answers 403 to any non-browser client, and the
// only way past that is to pretend to be a browser, which is exactly the kind
// of thing this tool was written to avoid.

const fs = require('fs');
const path = require('path');

const UA = 'turnsomedayintodayone-research/1.0 (+https://www.turnsomedayintodayone.com; turnsomedayintodayone@gmail.com)';
const PAUSE = 1000; // one request a second — be a good guest

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url) {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9' } });
    if (!res.ok) return { __error__: `HTTP ${res.status}` };
    return await res.text();
  } catch (e) {
    return { __error__: String(e.message || e).slice(0, 120) };
  } finally {
    await sleep(PAUSE);
  }
}

// A handle or channel URL is what people actually have; the feed needs a UC…
// id. The channel page carries its own id in the HTML, so one fetch converts.
async function resolveChannel(input) {
  const raw = String(input).trim();
  const direct = raw.match(/(UC[\w-]{20,})/);
  if (direct) return { id: direct[1], label: direct[1] };

  const handle = raw.startsWith('http') ? raw : `https://www.youtube.com/${raw.startsWith('@') ? raw : '@' + raw}`;
  const html = await get(handle);
  if (typeof html !== 'string') return { error: `${raw} — could not open the channel page (${html.__error__})` };
  const m = html.match(/"channelId":"(UC[\w-]+)"/) || html.match(/channel\/(UC[\w-]+)/);
  if (!m) return { error: `${raw} — opened the page but found no channel id on it` };
  const name = (html.match(/<title>([^<]*?)(?: - YouTube)?<\/title>/) || [, raw])[1];
  return { id: m[1], label: name.trim() || raw };
}

// The feed is small, regular Atom. A regex is enough and keeps this
// dependency-free; a real XML parser would mean an npm install.
function parseFeed(xml, cutoff) {
  const out = [];
  for (const m of xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
    const e = m[1];
    const title = (e.match(/<title>([\s\S]*?)<\/title>/) || [, ''])[1]
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
    const href = (e.match(/<link[^>]*href="([^"]+)"/) || [, ''])[1];
    const pub = (e.match(/<published>([\s\S]*?)<\/published>/) || [, ''])[1];
    const when = new Date(pub);
    if (isNaN(when) || when < cutoff) continue;
    out.push({ title, url: href, published: when.toISOString().slice(0, 10) });
  }
  return out;
}

// Titles are the copyable part — a phrasing repeated across a niche is one the
// audience responds to. These map onto the lanes in KEYWORDS.md.
const HOOKS = {
  question: /^\s*(how|what|why|when|is|are|do|does|can|should)\b/i,
  number: /\b\d+\s+(things|ways|signs|reasons|days|rules|lessons)\b/i,
  'day count': /\b(day|days)\s*\d+\b|\b\d+\s*(days|months|years)\s+sober\b/i,
  'partner-facing': /\b(husband|wife|boyfriend|girlfriend|partner|spouse|loved one)\b/i,
  'first person': /\b(i|my|me)\b/i,
  'you-facing': /\byou(r|'re)?\b/i,
};

async function main() {
  const args = process.argv.slice(2);
  const di = args.indexOf('--days');
  const days = di > -1 ? Number(args[di + 1]) || 30 : 30;
  const inputs = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--days');

  if (!inputs.length) {
    console.log('Give me at least one channel. For example:\n');
    console.log('  node competitorwatch.js @SoberLeon @RecoveryElevator\n');
    console.log('Handles, full URLs and UC… ids all work. Add --days 14 to look back further.');
    return;
  }

  const cutoff = new Date(Date.now() - days * 86400000);
  const L = [];
  console.log(`Looking up ${inputs.length} channel${inputs.length > 1 ? 's' : ''}…\n`);

  L.push(`# Competitor watch — last ${days} days\n`);
  L.push(`Generated ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC.\n`);
  L.push('Source: YouTube channel RSS — official, key-free, no login.\n');

  const allTitles = [];
  for (const input of inputs) {
    const ch = await resolveChannel(input);
    if (ch.error) { L.push(`\n**${input}** — ${ch.error}\n`); console.log('  ✗', ch.error); continue; }
    const raw = await get(`https://www.youtube.com/feeds/videos.xml?channel_id=${ch.id}`);
    if (typeof raw !== 'string') { L.push(`\n**${ch.label}** — could not read the feed (${raw.__error__}).\n`); console.log('  ✗', ch.label, raw.__error__); continue; }
    const vids = parseFeed(raw, cutoff);
    console.log('  ✓', ch.label, `— ${vids.length} in ${days} days`);
    const pace = `${vids.length} in ${days} days` + (vids.length ? ` — about one every ${Math.round(days / vids.length)} days` : '');
    L.push(`\n**${ch.label}** — ${pace}\n`);
    if (!vids.length) L.push('\nNothing published in this window.\n');
    for (const v of vids) { L.push(`- \`${v.published}\` [${v.title}](${v.url})`); allTitles.push(v.title); }
    L.push('');
  }

  if (allTitles.length) {
    L.push('\n## What their titles have in common\n');
    L.push(`Across ${allTitles.length} titles:\n`);
    L.push('| Shape | Titles using it |');
    L.push('|---|---|');
    const counts = Object.entries(HOOKS)
      .map(([k, re]) => [k, allTitles.filter((t) => re.test(t)).length])
      .sort((a, b) => b[1] - a[1]);
    for (const [k, c] of counts) L.push(`| ${k} | ${c} of ${allTitles.length} |`);
    L.push('\n**Read it against `KEYWORDS.md`.** If "partner-facing" is low across '
      + 'everyone, that is the moat showing up from a direction that has nothing '
      + 'to do with keyword tools — nobody is making videos for the person who '
      + 'loves someone using.\n');
  } else {
    L.push('\nNo videos read, so there is nothing to compare. Check the channel names.\n');
  }

  const out = path.join(process.cwd(), 'watch-report.md');
  fs.writeFileSync(out, L.join('\n'));
  console.log(`\nReport written to ${out}`);
}

main();
