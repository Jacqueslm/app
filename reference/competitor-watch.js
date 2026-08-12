// Who is winning in the recovery niche, and what are they posting.
//
//     node reference/competitor-watch.js
//     node reference/competitor-watch.js --days 14
//
// Node, not Python — Studio already needs Node, so this runs with nothing to
// install. (competitor-watch.py is the same tool for anyone who has Python.)
//
// Reads only what the platforms publish for reading:
//   * YouTube channel RSS — youtube.com/feeds/videos.xml, official, no key.
//   * Reddit's public .json listings, read-only and rate limited.
// No logins, no headless browser, no TikTok or Instagram — neither publishes a
// key-free endpoint, and the only way in is against their terms.

const fs = require('fs');
const path = require('path');

const UA = 'turnsomedayintodayone-research/1.0 (+https://www.turnsomedayintodayone.com; turnsomedayintodayone@gmail.com)';
const PAUSE = 1000; // one request a second — be a good guest

// Channel ids start "UC" and are on a channel's page under Share > Copy channel ID.
const CHANNELS = [
  ['Put The Shovel Down', 'UCTQF_wGnLPHqPRHnvJ2xVaQ'],
  ['Sober Leon', 'UCkKDGkC0Ye6iL6zqHUbxYUw'],
  ['Recovery Elevator', 'UCWy6y5Cx6hHUvGiJHKfHRJA'],
  ['The Sober Experiment', 'UCjOxHOjJ0ycTv0h5C8yqL0w'],
];

// Partner rooms first — the lane KEYWORDS.md says is winnable.
const SUBREDDITS = ['AlAnon', 'stopdrinking', 'loveafteraddiction', 'SupportforWaywardSpouses'];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url, asJson) {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9' } });
    if (!res.ok) return { __error__: `HTTP ${res.status}` };
    return asJson ? await res.json() : await res.text();
  } catch (e) {
    return { __error__: String(e.message || e).slice(0, 120) };
  } finally {
    await sleep(PAUSE);
  }
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
  const i = process.argv.indexOf('--days');
  const days = i > -1 ? Number(process.argv[i + 1]) || 30 : 30;
  const cutoff = new Date(Date.now() - days * 86400000);
  const L = [];

  console.log(`Reading ${CHANNELS.length} YouTube feeds and ${SUBREDDITS.length} subreddits `
    + `(one request a second, so about ${CHANNELS.length + SUBREDDITS.length} seconds)…\n`);

  L.push(`# Competitor watch — last ${days} days\n`);
  L.push(`Generated ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC by \`reference/competitor-watch.js\`.\n`);
  L.push('Sources: YouTube channel RSS (official, key-free) and Reddit public JSON '
    + 'listings. No logins, no scraping, no TikTok or Instagram.\n');

  L.push('\n## YouTube — what they published, and how often\n');
  const allTitles = [];
  for (const [name, cid] of CHANNELS) {
    const raw = await get(`https://www.youtube.com/feeds/videos.xml?channel_id=${cid}`);
    if (typeof raw !== 'string') { L.push(`\n**${name}** — could not read (${raw.__error__}).\n`); continue; }
    const vids = parseFeed(raw, cutoff);
    const pace = `${vids.length} in ${days} days` + (vids.length ? ` — about one every ${Math.round(days / vids.length)} days` : '');
    L.push(`\n**${name}** — ${pace}\n`);
    if (!vids.length) L.push('\nNothing published in this window.\n');
    for (const v of vids) { L.push(`- \`${v.published}\` [${v.title}](${v.url})`); allTitles.push(v.title); }
    L.push('');
  }

  if (allTitles.length) {
    L.push('\n### What their titles have in common\n');
    L.push(`Across ${allTitles.length} titles:\n`);
    L.push('| Shape | Titles using it |');
    L.push('|---|---|');
    const counts = Object.entries(HOOKS)
      .map(([k, re]) => [k, allTitles.filter((t) => re.test(t)).length])
      .sort((a, b) => b[1] - a[1]);
    for (const [k, c] of counts) L.push(`| ${k} | ${c} of ${allTitles.length} |`);
    L.push('\n**Read it against `KEYWORDS.md`.** If "partner-facing" is low across '
      + 'everyone, that is the moat showing up from a third direction — nobody is '
      + 'making videos for the person who loves someone using.\n');
  }

  L.push('\n## Reddit — what this audience is actually saying\n');
  L.push('Sorted by comments, not upvotes: a post with 200 comments is a question '
    + 'people need answered, which is a video subject. A post with 2,000 upvotes '
    + 'and 6 comments is just agreement.\n');
  const rCut = Date.now() / 1000 - days * 86400;
  for (const sub of SUBREDDITS) {
    const data = await get(`https://www.reddit.com/r/${sub}/top.json?t=month&limit=25`, true);
    L.push(`\n### r/${sub}\n`);
    if (data.__error__) { L.push(`Could not read (${data.__error__}).\n`); continue; }
    const posts = (data?.data?.children || [])
      .map((c) => c.data || {})
      .filter((d) => (d.created_utc || 0) >= rCut)
      .sort((a, b) => (b.num_comments || 0) - (a.num_comments || 0))
      .slice(0, 10);
    if (!posts.length) L.push('Nothing in this window.\n');
    for (const p of posts) {
      L.push(`- **${p.num_comments} comments** · ${p.score} pts — [${String(p.title).slice(0, 110)}](https://reddit.com${p.permalink})`);
    }
    L.push('');
  }

  L.push('\n---\n');
  L.push('**How to use this.** The titles are the copyable part — a phrasing that '
    + 'repeats across four channels is one the audience responds to. The Reddit '
    + 'rows are subject matter: a question asked over and over with a hundred '
    + 'replies is a script you have not written yet. Check either against '
    + '`KEYWORDS.md` before making anything — search volume beats a hunch.\n');

  const out = path.join(__dirname, 'watch-report.md');
  const md = L.join('\n');
  fs.writeFileSync(out, md);
  console.log(md.slice(0, 1500));
  console.log(`\n… full report written to ${out}`);
}

main();
