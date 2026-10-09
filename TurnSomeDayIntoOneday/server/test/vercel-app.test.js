// The Vercel build of The Truth — the door, the AI proxy, and the one rule that
// keeps the private pages private on a host that hands out files before it runs
// any code.
//
// WHY THIS FILE EXISTS
//
// Moving off Railway means moving onto a host whose serverless functions get no
// disk they can keep, so the accounts table cannot come along. What is left is
// one shared password (APP_PASSWORD), the allowlist that decides who belongs
// even with the password, and two AI routes whose key must never reach a phone.
// Every one of those is a privacy boundary, and a privacy boundary that is only
// looked at is a privacy boundary that breaks quietly.
//
// The Vercel-specific half is the nastier one. Vercel's own documentation for
// vercel.json says "precedence is given to the filesystem prior to rewrites
// being applied" — so a page that exists as a file is handed to the world
// before any password check ever runs, and no rewrite can stop it. The answer is
// that the pages are not in the static output at all (outputDirectory is
// webroot, and vercel-build.js is the only thing that fills it). That is a rule
// about set membership, so it can be tested here, and it is.
//
// The app is booted for real, on a spare port, and driven over HTTP the way a
// phone drives it.
//
// Run:  cd TurnSomeDayIntoOneday/server && npm test

// Set before the app is required: it reads its configuration once, at load.
process.env.APP_PASSWORD = 'let-me-in';
process.env.FRIENDLY_EMAILS = 'jacques@example.com, wife@example.com';
// The spare word, and the one email it opens for. Added 5 Oct 2026: one
// password and no way back meant a forgotten word locked the owner out of his
// own app, with the cure sitting on a host's settings screen.
process.env.APP_OWNER_EMAIL = 'jacques@example.com';
process.env.APP_RECOVERY_PASSWORD = 'the-spare-word';
delete process.env.GEMINI_API_KEY;

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const app = require('../vercel-app');
const build = require('../../vercel-build');
const vercelJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));

const PAGE_FILES = ['hub.html', 'key.html', 'herbs.html', 'tax.html', 'fight.html', 'game3d.html', 'music.html', 'trainer.html'];
// The shell at /app and / is not in this list: it is the sign-in screen itself,
// so it opens to everybody and holds nothing but a heading, three links and the
// form. Everything below is behind the door.
const GATED = ['/key', '/herbs', '/herbs.html', '/tax', '/tax.html', '/fight', '/fight.html', '/game3d.html', '/music', '/music.html', '/trainer', '/trainer.html'];

let server, base;
before(async () => {
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server && server.close());

async function get(pathname, cookie) {
  const res = await fetch(base + pathname, {
    redirect: 'manual',
    headers: cookie ? { cookie } : {},
  });
  return res;
}

async function signIn(email, password) {
  const res = await fetch(base + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const cookies = typeof res.headers.getSetCookie === 'function'
    ? res.headers.getSetCookie()
    : [res.headers.get('set-cookie')].filter(Boolean);
  const cookie = cookies[0] ? cookies[0].split(';')[0] : null;
  return { res, cookie, body: await res.json().catch(() => null) };
}

// ------------------------------------------------------------------ the door --

test('every private page sends a stranger to the sign-in screen', async () => {
  for (const route of GATED) {
    const res = await get(route);
    assert.equal(res.status, 302, `${route} must not answer an unsigned visitor`);
    assert.equal(res.headers.get('location'), '/app', `${route} must send them to the door`);
  }
});

test('the sign-in screen itself holds nothing private', async () => {
  for (const route of ['/app', '/']) {
    const res = await get(route);
    assert.equal(res.status, 200, `${route} is the door and has to open`);
    const html = await res.text();
    assert.match(html, /<h1>The Truth<\/h1>/, 'the shell is what the door serves');
    assert.match(html, /Unlock/, 'and it carries the sign-in form');
    assert.doesNotMatch(html, /HERBS = \[/, 'it must not carry the herb library');
    assert.doesNotMatch(html, /periodsFrom/, 'nor any of The Key');
  }
});

// --------------------------------------------- a forgotten word, 7 Oct 2026 --
// Jacques: "add forgot my password sign in option". On the accounts build that
// option emails a one-time link. THIS build has no accounts and no database, so
// there is nowhere to keep a token and nothing to send — and the page must not
// promise a link it cannot send. So the button asks /api/auth/forgot either way
// and reads the answer: 200 means a link really is on its way, a 404 means the
// honest answer is the spare word. What makes the page's spare-word sentence
// correct on this host is the 404 below, which is what these tests hold still.

test('the sign-in screen carries the way back for a forgotten word', async () => {
  const res = await get('/app');
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /id="forgotBtn"/, 'the sign-in screen must offer it');
  assert.match(html, />Forgot your password\?</, 'in the words the reset page points at');
  // A plain button inside the form with no type submits it, which would try to
  // sign in with nothing and print "Both fields, please" instead.
  assert.match(html, /<button class="linkish" id="forgotBtn" type="button">/,
    'and it must not submit the sign-in form when tapped');
});

test('a forgotten word here is a 404, not a link that was never sent', async () => {
  const res = await fetch(base + '/api/auth/forgot', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'jacques@example.com' }),
  });
  assert.equal(res.status, 404, 'no accounts means no reset by email');
  const body = await res.text();
  assert.doesNotMatch(body, /on its way|"message"/, 'and nothing that reads like a link was sent');
  // The page turns that 404 into the sentence that is true here: one shared
  // word, and a second one kept away from the phone.
  const hub = fs.readFileSync(path.join(ROOT, 'hub.html'), 'utf8');
  assert.match(hub, /A spare word opens the same door/, 'the page says what actually works');
  assert.doesNotMatch(hub, /link is on its way/,
    'and never claims a link was sent on its own account — that comes from the server');
});

test('the wrong password gets nothing, and no cookie', async () => {
  const { res, cookie, body } = await signIn('jacques@example.com', 'not-the-password');
  assert.equal(res.status, 401);
  assert.equal(cookie, null, 'a wrong password must not leave a session behind');
  assert.match(body.error, /not right/i);
});

test('the spare word opens the door for the owner, and for nobody else', async () => {
  // The way back in. Same door, same pages, one person.
  const owner = await signIn('jacques@example.com', 'the-spare-word');
  assert.equal(owner.res.status, 200, 'the owner gets in with the spare');
  assert.ok(owner.cookie, 'and a real session comes back');
  assert.equal((await get('/music', owner.cookie)).status, 200, 'and the pages open for him');

  // And it is not a second password for the household: a way back in for one
  // person is not the same thing as a second word for everybody.
  const wife = await signIn('wife@example.com', 'the-spare-word');
  assert.equal(wife.res.status, 401, 'the spare is not a password for the list');
  assert.equal(wife.cookie, null, 'and leaves no session behind');
  const stranger = await signIn('somebody-else@example.com', 'the-spare-word');
  assert.equal(stranger.res.status, 401, 'nor for anybody off it');

  // Stated plainly, so the rule is readable without the HTTP around it.
  assert.deepEqual(app.spareWords('jacques@example.com'), ['let-me-in', 'the-spare-word']);
  assert.deepEqual(app.spareWords('wife@example.com'), ['let-me-in']);
  assert.deepEqual(app.spareWords('WIFE@example.com '), ['let-me-in'], 'case and stray spaces are the same person');
});

test('the spare alone, with no owner to open for, is not a password at all', async () => {
  // A spare belongs to one person, so with no APP_OWNER_EMAIL there is nobody
  // it can open for - and a word that opens the door for whoever guesses it
  // would be a back door, not a way back. The settings are read once, at load,
  // so this is a second instance of the same file with the owner taken away.
  const saved = {
    owner: process.env.APP_OWNER_EMAIL,
    password: process.env.APP_PASSWORD,
  };
  delete process.env.APP_OWNER_EMAIL;
  delete process.env.APP_PASSWORD;
  const modulePath = require.resolve('../vercel-app');
  delete require.cache[modulePath];
  let spare;
  try {
    spare = require('../vercel-app');
    assert.equal(spare.doorConfigured(), false,
      'with no owner the spare opens nothing, so there is no word at all');
    assert.deepEqual(spare.spareWords('jacques@example.com'), [], 'and nobody holds one');
    const server2 = spare.listen(0);
    await new Promise((r) => server2.once('listening', r));
    try {
      const res = await fetch(`http://127.0.0.1:${server2.address().port}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'jacques@example.com', password: 'the-spare-word' }),
      });
      assert.equal(res.status, 503, 'and the door says the truth about why');
    } finally {
      server2.close();
    }
  } finally {
    if (saved.owner === undefined) delete process.env.APP_OWNER_EMAIL;
    else process.env.APP_OWNER_EMAIL = saved.owner;
    if (saved.password === undefined) delete process.env.APP_PASSWORD;
    else process.env.APP_PASSWORD = saved.password;
    delete require.cache[modulePath];
  }
});

test('the right password with an email that is not on the list is still refused', async () => {
  // The password gets somebody through the door; the list decides whether they
  // belong in the room. One without the other is not the door this app needs.
  const { res, cookie } = await signIn('somebody-else@example.com', 'let-me-in');
  assert.equal(res.status, 403);
  assert.equal(cookie, null, 'and no cookie is issued for them either');
});

test('the right password, on the list, opens every page — both addresses of each', async () => {
  const { cookie } = await signIn('jacques@example.com', 'let-me-in');
  assert.ok(cookie, 'a real sign-in hands back a session cookie');
  for (const route of GATED) {
    const res = await get(route, cookie);
    assert.equal(res.status, 200, `${route} must open for him`);
    assert.equal(res.headers.get('cache-control'), 'no-store', `${route} must not be cached by anything shared`);
  }
  // And the pages are the repository's own files, byte for byte: there is no
  // second copy to drift.
  const herbs = await (await get('/herbs', cookie)).text();
  assert.equal(herbs, fs.readFileSync(path.join(ROOT, 'herbs.html'), 'utf8'));
  const byFileName = await (await get('/herbs.html', cookie)).text();
  assert.equal(byFileName, herbs, 'the clean URL and the file name are the same page');
});

test('a cookie that has been edited by hand is not a cookie', async () => {
  const { cookie } = await signIn('jacques@example.com', 'let-me-in');
  const [payload, sig] = cookie.split('=')[1].split('.');
  const forged = 'tsid_pass_v1=' + payload + '.' + sig.replace(/.$/, (c) => (c === 'a' ? 'b' : 'a'));
  for (const route of ['/herbs', '/api/auth/me']) {
    const res = await get(route, forged);
    assert.ok(res.status === 302 || res.status === 401, `${route} must refuse a forged cookie`);
  }
  // And the email inside it is not a way past the list.
  const stolen = 'tsid_pass_v1=' + Buffer.from(JSON.stringify({
    email: 'somebody-else@example.com', exp: Date.now() + 864e5,
  })).toString('base64url') + '.' + sig;
  const res = await get('/herbs', stolen);
  assert.equal(res.status, 302, 'a forged payload does not survive the signature check');
});

test('signing out clears the cookie, and the only way to revoke one is the password', async () => {
  const { cookie } = await signIn('jacques@example.com', 'let-me-in');
  const out = await fetch(base + '/api/auth/logout', { method: 'POST', headers: { cookie } });
  assert.equal(out.status, 200);
  const cleared = typeof out.headers.getSetCookie === 'function'
    ? out.headers.getSetCookie() : [out.headers.get('set-cookie')].filter(Boolean);
  assert.match(cleared.join(';'), /tsid_pass_v1=;/, 'the browser is told to drop it');
  // There is no session table on this host - the cookie is signed, not stored.
  // So signing out is a browser instruction, not a server memory, and a copy of
  // that cookie kept elsewhere would still open the door until it expires. What
  // ends every session at once is changing APP_PASSWORD, because the password is
  // what the signature is made of. That is the property, stated here so nobody
  // later mistakes it for a bug.
  assert.equal(fs.readFileSync(path.join(__dirname, '..', 'vercel-app.js'), 'utf8')
    .includes("process.env.APP_SECRET || PASSWORD"), true,
  'the cookie is signed with the password, so changing it ends every session');
});

// ------------------------------------------------------------- the AI routes --

test('both AI routes refuse anyone who is not through the door', async () => {
  for (const route of ['/api/chat', '/api/key-reading']) {
    const res = await fetch(base + route, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ system: [], messages: [{ role: 'user', content: 'hi' }] }),
    });
    assert.equal(res.status, 401, `${route} must not answer a stranger`);
  }
});

test('with no key on the server it says so plainly, and never hands out a key', async () => {
  const { cookie } = await signIn('jacques@example.com', 'let-me-in');
  for (const route of ['/api/chat', '/api/key-reading']) {
    const res = await fetch(base + route, {
      method: 'POST', headers: { 'Content-Type': 'application/json', cookie },
      body: JSON.stringify({ system: [{ type: 'text', text: 'rules' }], messages: [{ role: 'user', content: 'hi' }] }),
    });
    const text = await res.text();
    assert.equal(res.status, 503, `${route} is honest when it cannot answer`);
    assert.doesNotMatch(text, /AIza/, 'a key must never appear in a response');
    assert.doesNotMatch(text, /GEMINI_API_KEY/, 'nor its name in words a person can read');
  }
});

test('the chat route answers in the shape the page already reads', () => {
  // The tax page reads data.content[0].text. This is the same contract the
  // Railway server keeps, so the page did not have to change for the move — and
  // a contract nothing checks is a contract that changes on a Tuesday.
  const src = fs.readFileSync(path.join(__dirname, '..', 'vercel-app.js'), 'utf8');
  assert.match(src, /content: \[\{ type: 'text', text: out\.text \}\]/);
  assert.match(src, /res\.json\(\{ text: out\.text, model: GEMINI_MODEL \}\)/, 'and The Key gets its own shape');
  const tax = fs.readFileSync(path.join(ROOT, 'tax.html'), 'utf8');
  assert.match(tax, /content\[0\]\.text/, 'which is what the page actually reads');
});

test('anything else is a plain 404, not a page and not the host talking', async () => {
  const res = await get('/definitely-not-a-page');
  assert.equal(res.status, 404);
  assert.equal(await res.text(), 'Not here.');
  // /key.html is a real file in the repository and stays a 404 here, exactly as
  // the Railway server answers it: the Key has one address, and a second one
  // would be a second door.
  const { cookie } = await signIn('jacques@example.com', 'let-me-in');
  assert.equal((await get('/key.html', cookie)).status, 404);
});

// ------------------------------------------------- what Vercel is allowed to serve --

test('the private pages are not static files on Vercel, which is the whole point', () => {
  assert.equal(vercelJson.outputDirectory, 'webroot',
    'the only thing served as a file is the folder the build script fills');
  assert.equal(vercelJson.buildCommand, 'node vercel-build.js');
  // The build copies assets. If a page name were ever added to either list it
  // would be handed to the world before the password check ran, so the lists are
  // checked for pages rather than trusted.
  for (const entry of build.DIRS.concat(build.FILES)) {
    assert.doesNotMatch(entry, /\.html?$/i, `${entry} is a page and must not be copied into the public folder`);
  }
  for (const page of PAGE_FILES) {
    assert.ok(!build.FILES.includes(page), `${page} must never be a public file`);
  }
});

test('every gated address is rewritten into the function, file names included', () => {
  // Vercel checks the filesystem before rewrites, so a rewrite is not what makes
  // the pages private — the missing file is. What this checks is that no address
  // the pages are reachable at is left to answer by itself: both the clean URL
  // and the file name have to reach the function, or the half that does not is
  // the half that leaks.
  const destinations = new Map(vercelJson.rewrites.map((r) => [r.source, r.destination]));
  for (const route of ['/app', '/key', '/key.html', '/herbs', '/herbs.html', '/tax', '/tax.html',
    '/fight', '/fight.html', '/game3d.html', '/music', '/music.html', '/trainer', '/trainer.html', '/']) {
    assert.equal(destinations.get(route), '/api/index.js', `${route} must reach the function`);
  }
  assert.equal(destinations.get('/api/(.*)'), '/api/index.js', 'and so must the API');
});

test('the pages travel inside the function, because they are not files out there', () => {
  const included = vercelJson.functions['api/index.js'].includeFiles;
  // A list here is rejected outright by Vercel: "Invalid request:
  // functions.api/index.js.includeFiles should be string." — a real error, from
  // the first import attempt on 4 Oct 2026. It takes one glob, so the pages
  // are named in a brace expansion and the test reads them back out of it.
  assert.equal(typeof included, 'string', 'includeFiles is a string to Vercel, not a list');
  assert.match(included, /\.html$/, 'a glob that does not end in .html matches no page');
  for (const page of PAGE_FILES) {
    const stem = page.replace('.html', '');
    assert.ok(included.includes(stem),
      `${page} (named "${stem}" in the glob) has to be in the function bundle - nothing else can hand it over`);
  }
});

test('the build copies no page, and says so if one ever appears', () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'tsid-webroot-'));
  try {
    // A real build of the two smallest entries, into a scratch folder: the rule
    // being tested is about what lands there, not about copying 60MB of photos.
    build.build({ out, dirs: ['icons'], files: ['manifest.json'], quiet: true });
    const found = [];
    (function walk(dir) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full); else found.push(entry.name);
      }
    })(out);
    assert.ok(found.length > 0, 'the build actually copied something');
    assert.deepEqual(found.filter((f) => /\.html?$/i.test(f)), [], 'and no page among it');
    // And the guard itself fails loudly rather than letting one through.
    fs.writeFileSync(path.join(out, 'herbs.html'), '<p>private</p>');
    assert.throws(() => build.checkNoPages(out), /Vercel would hand it out/);
  } finally {
    fs.rmSync(out, { recursive: true, force: true });
  }
});

test('robots.txt reaches the site root — a missing one reads as permission', () => {
  // The file sat in the repository and reached no host: the build copied the
  // manifests and sw.js and nothing else, so the live root answered 404 for it
  // until 6 Oct 2026. Most crawlers read an absent robots.txt as "carry on", so
  // the 404 was not a broken link, it was the door standing open. What was wrong
  // was the copy, so that is what is checked — copied, byte for byte, and still
  // saying what it says.
  assert.ok(build.FILES.includes('robots.txt'), 'the build must copy robots.txt to the site root');
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'tsid-robots-'));
  try {
    build.build({ out, dirs: [], files: ['robots.txt'], quiet: true });
    const landed = path.join(out, 'robots.txt');
    assert.ok(fs.existsSync(landed), 'it has to land at /robots.txt, where a crawler asks');
    const text = fs.readFileSync(landed, 'utf8');
    assert.equal(text, fs.readFileSync(path.join(ROOT, 'robots.txt'), 'utf8'),
      'byte for byte, so there is no second copy to drift from');
    assert.match(text, /^Disallow: \/$/m, 'and it still shuts the door it was written to shut');
  } finally {
    fs.rmSync(out, { recursive: true, force: true });
  }
});

test('the pages the function serves are the repository files, read once each', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'vercel-app.js'), 'utf8');
  assert.match(src, /const ROOT = path\.join\(__dirname, '\.\.'\)/, 'the pages come from the repository');
  assert.match(src, /fs\.readFileSync\(path\.join\(ROOT, name\)\)/, 'there is no second copy of a page anywhere');
  assert.doesNotMatch(src, /\bdb\b\s*=\s*require\('\.\/db'\)/, 'and no database is dragged in: this host has nowhere to keep one');
  for (const file of PAGE_FILES) {
    assert.ok(fs.existsSync(path.join(ROOT, file)), `${file} is in the repository`);
  }
});
