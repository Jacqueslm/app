// What the people you write for are asking on Reddit, sorted by comments.
//
//     node redditwatch.js YOUR_ID YOUR_SECRET
//     node redditwatch.js YOUR_ID YOUR_SECRET --period week
//     node redditwatch.js YOUR_ID YOUR_SECRET --subs AlAnon,stopdrinking
//
// Uses Reddit's official API with your own credentials. The public .json
// endpoints now answer 403 to anything that isn't a browser, and a browser
// opening this off a local disk gets blocked by CORS — both routes were tried
// and both are shut. This is the one that works, and it is the one Reddit
// actually intends people to use.
//
// Get the two codes once, at https://www.reddit.com/prefs/apps
//   → "create another app…" → type: script → redirect uri: http://localhost:8080
//   → the ID is the short string under the app name, the secret is labelled.

const fs = require('fs');
const path = require('path');

const UA = 'windows:turnsomedayintodayone:v1.0 (by /u/turnsomedayintodayone)';
const DEFAULT_SUBS = ['AlAnon', 'stopdrinking', 'loveafteraddiction', 'SupportforWaywardSpouses'];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function arg(args, name, fallback) {
  const i = args.indexOf('--' + name);
  return i > -1 && args[i + 1] ? args[i + 1] : fallback;
}

async function token(id, secret) {
  const res = await fetch('https://www.reddit.com/api/v1/access_token', {
    method: 'POST',
    headers: {
      // Reddit wants the id and secret as HTTP basic auth, not in the body.
      Authorization: 'Basic ' + Buffer.from(`${id}:${secret}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': UA,
    },
    body: 'grant_type=client_credentials',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) {
    throw new Error(`Reddit refused the credentials (HTTP ${res.status}). `
      + (data.error ? `It said: ${data.error}. ` : '')
      + 'Check the ID and secret, and that the app type is "script".');
  }
  return data.access_token;
}

async function main() {
  const args = process.argv.slice(2);
  const [id, secret] = args.filter((a) => !a.startsWith('--') && args[args.indexOf(a) - 1]?.startsWith('--') !== true);

  if (!id || !secret) {
    console.log('Needs your two Reddit codes:\n');
    console.log('  node redditwatch.js YOUR_ID YOUR_SECRET\n');
    console.log('Get them once at https://www.reddit.com/prefs/apps');
    console.log('  → create another app… → type: script → redirect uri: http://localhost:8080');
    return;
  }

  const period = arg(args, 'period', 'month');
  const subs = arg(args, 'subs', DEFAULT_SUBS.join(',')).split(',').map((s) => s.trim().replace(/^r\//, '')).filter(Boolean);

  console.log('Signing in to Reddit…');
  let tok;
  try { tok = await token(id, secret); }
  catch (e) { console.log('\n✗ ' + e.message); return; }
  console.log('  ✓ signed in\n');

  const L = [];
  L.push(`# Reddit watch — top of the past ${period}\n`);
  L.push(`Generated ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC.\n`);
  L.push('**Sorted by comments, not upvotes.** A question with ninety replies is a '
    + 'script you have not written. Two thousand upvotes and six replies is people '
    + 'agreeing with each other.\n');

  for (const sub of subs) {
    process.stdout.write(`Reading r/${sub}… `);
    let posts = [];
    try {
      const res = await fetch(`https://oauth.reddit.com/r/${encodeURIComponent(sub)}/top?t=${period}&limit=50`, {
        headers: { Authorization: 'Bearer ' + tok, 'User-Agent': UA },
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      posts = (data?.data?.children || []).map((c) => c.data || {});
    } catch (e) {
      console.log('✗ ' + e.message);
      L.push(`\n## r/${sub}\n\nCould not read it (${e.message}).\n`);
      continue;
    }
    posts.sort((a, b) => (b.num_comments || 0) - (a.num_comments || 0));
    const top = posts.slice(0, 12);
    console.log(`✓ ${top.length} posts`);
    L.push(`\n## r/${sub}\n`);
    for (const p of top) {
      L.push(`- **${p.num_comments} comments** · ${p.score} pts — [${String(p.title).slice(0, 120)}](https://reddit.com${p.permalink})`);
    }
    L.push('');
    await sleep(1100); // Reddit asks for one request a second; this stays under it
  }

  L.push('\n---\n');
  L.push('**What to do with it.** Every row with a big comment count is a question '
    + 'this audience keeps asking and nobody has answered well. That is a script. '
    + 'Check it against `KEYWORDS.md` before making anything — a question people ask '
    + 'each other is not always a question people type into a search box.\n');

  const out = path.join(process.cwd(), 'reddit-report.md');
  fs.writeFileSync(out, L.join('\n'));
  console.log(`\nReport written to ${out}`);
}

main();
