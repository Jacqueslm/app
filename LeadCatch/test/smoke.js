// End-to-end smoke test. Boots the real server against a throwaway database,
// then drives it over HTTP exactly as a browser would.
//
// The tenant-isolation checks are the ones that matter most: this is a
// multi-tenant product, and "account B can read account A's leads" is the one
// bug that would be unforgivable. Run with: npm test
process.env.DB_PATH = require('path').join(
  require('os').tmpdir(),
  `leadcatch-test-${process.pid}-${Date.now()}.sqlite`
);
process.env.SESSION_SECRET = 'test-secret-not-for-production';
process.env.EMAIL_DRY_RUN = '1';
process.env.NODE_ENV = 'test';

const fs = require('fs');
const assert = require('assert');
const app = require('../server/server');

let failures = 0;
let passes = 0;

function check(name, fn) {
  try {
    fn();
    passes++;
    console.log(`  ok  ${name}`);
  } catch (err) {
    failures++;
    console.error(`  FAIL ${name}\n       ${err.message}`);
  }
}

async function main() {
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;

  // Minimal cookie jar - enough for one session cookie per client.
  function client() {
    const jar = {};
    return async function request(method, path, body) {
      const res = await fetch(base + path, {
        method,
        headers: {
          ...(body ? { 'Content-Type': 'application/json' } : {}),
          ...(Object.keys(jar).length
            ? { Cookie: Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ') }
            : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        redirect: 'manual',
      });
      for (const raw of res.headers.getSetCookie ? res.headers.getSetCookie() : []) {
        const [pair] = raw.split(';');
        const idx = pair.indexOf('=');
        jar[pair.slice(0, idx)] = pair.slice(idx + 1);
      }
      const text = await res.text();
      let data = null;
      try {
        data = JSON.parse(text);
      } catch (_) {
        data = text;
      }
      return { status: res.status, data, headers: res.headers };
    };
  }

  const alice = client();
  const bob = client();
  const visitor = client();

  console.log('\nAccounts');
  let res = await alice('POST', '/api/auth/signup', {
    email: 'alice@example.com',
    password: 'correct horse battery',
    business_name: "Alice's Plumbing",
  });
  check('signup succeeds', () => assert.strictEqual(res.status, 201));

  res = await alice('POST', '/api/auth/signup', {
    email: 'alice@example.com',
    password: 'another password',
    business_name: 'Duplicate',
  });
  check('duplicate email is rejected', () => assert.strictEqual(res.status, 409));

  res = await alice('POST', '/api/auth/signup', { email: 'x@y.com', password: 'short', business_name: 'X' });
  check('short password is rejected', () => assert.strictEqual(res.status, 400));

  res = await bob('POST', '/api/auth/signup', {
    email: 'bob@example.com',
    password: 'a different password',
    business_name: "Bob's Barbers",
  });
  check('second account signs up', () => assert.strictEqual(res.status, 201));

  res = await visitor('GET', '/api/leads');
  check('leads require a session', () => assert.strictEqual(res.status, 401));

  console.log('\nForms');
  res = await alice('GET', '/api/forms');
  const aliceForm = res.data.forms[0];
  check('signup creates a starter form', () => {
    assert.strictEqual(res.data.forms.length, 1);
    assert.ok(aliceForm.key, 'form has a public key');
    assert.strictEqual(aliceForm.notify_email, 'alice@example.com');
  });

  res = await alice('PUT', `/api/forms/${aliceForm.id}`, {
    name: 'Emergency callout',
    headline: 'Burst pipe?',
    button_text: 'Call me back',
    notify_email: 'alice@example.com',
    fields: {
      name: { show: true, required: true, label: 'Your name' },
      email: { show: true, required: false, label: 'Email' },
      phone: { show: true, required: true, label: 'Phone' },
      message: { show: true, required: false, label: 'What is happening?' },
      custom: [{ label: 'Urgency', type: 'select', required: true, options: ['Today', 'This week'] }],
    },
  });
  check('form updates', () => {
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.name, 'Emergency callout');
    assert.strictEqual(res.data.fields.custom.length, 1);
  });

  res = await bob('GET', '/api/forms');
  const bobForm = res.data.forms[0];
  res = await bob('PUT', `/api/forms/${aliceForm.id}`, { name: 'Hijacked' });
  check("another account cannot edit Alice's form", () => assert.strictEqual(res.status, 404));
  res = await bob('DELETE', `/api/forms/${aliceForm.id}`);
  check("another account cannot delete Alice's form", () => assert.strictEqual(res.status, 404));
  res = await alice('GET', `/api/forms/${bobForm.id}`);
  check("Alice cannot read Bob's form", () => assert.strictEqual(res.status, 404));

  console.log('\nPublic capture');
  res = await visitor('GET', `/api/public/form/${aliceForm.key}`);
  check('public config is served', () => {
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.headline, 'Burst pipe?');
  });
  check('public config hides owner data', () => {
    assert.strictEqual(res.data.notify_email, undefined);
    assert.strictEqual(res.data.account_id, undefined);
    assert.strictEqual(res.data.id, undefined);
  });

  res = await visitor('GET', '/api/public/form/not-a-real-key');
  check('unknown form key 404s', () => assert.strictEqual(res.status, 404));

  // Posting JSON from a customer's domain makes the browser send an OPTIONS
  // preflight first. If that answer lacks the CORS headers, every embedded form
  // on every customer site fails silently - so it is checked explicitly.
  res = await visitor('OPTIONS', `/api/public/form/${aliceForm.key}/lead`);
  check('the cross-origin preflight is answered', () => {
    assert.strictEqual(res.status, 204);
    assert.strictEqual(res.headers.get('access-control-allow-origin'), '*');
    assert.match(res.headers.get('access-control-allow-methods') || '', /POST/);
    assert.match(res.headers.get('access-control-allow-headers') || '', /Content-Type/i);
  });

  res = await visitor('POST', `/api/public/form/${aliceForm.key}/lead`, {
    name: 'Dave Smith',
    phone: '555 0100',
    email: 'dave@example.com',
    message: 'Kitchen tap is flooding',
    custom: { Urgency: 'Today' },
    source_url: 'https://alicesplumbing.example/contact',
    _t: 8000,
  });
  check('a lead is captured', () => {
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.ok, true);
  });

  res = await visitor('POST', `/api/public/form/${aliceForm.key}/lead`, {
    name: 'Missing Phone',
    _t: 8000,
  });
  check('required fields are enforced', () => {
    assert.strictEqual(res.status, 400);
    assert.match(res.data.error, /Phone/);
  });

  res = await visitor('POST', `/api/public/form/${aliceForm.key}/lead`, {
    name: 'Bad Email',
    phone: '555 0111',
    email: 'not-an-email',
    custom: { Urgency: 'Today' },
    _t: 8000,
  });
  check('invalid email is rejected', () => assert.strictEqual(res.status, 400));

  res = await visitor('POST', `/api/public/form/${aliceForm.key}/lead`, {
    name: 'Spam Bot',
    phone: '555 0199',
    custom: { Urgency: 'Today' },
    _hp: 'http://spam.example',
    _t: 8000,
  });
  check('honeypot submissions look accepted but are dropped', () => assert.strictEqual(res.status, 200));

  res = await visitor('POST', `/api/public/form/${aliceForm.key}/lead`, {
    name: 'Fast Bot',
    phone: '555 0198',
    custom: { Urgency: 'Today' },
    _t: 40,
  });
  check('instant submissions are dropped', () => assert.strictEqual(res.status, 200));

  res = await visitor('POST', `/api/public/form/${aliceForm.key}/lead`, {
    name: 'Dave Smith',
    phone: '555 0100',
    email: 'dave@example.com',
    message: 'Kitchen tap is flooding',
    custom: { Urgency: 'Today' },
    _t: 8000,
  });
  check('a double submit is de-duplicated', () => assert.strictEqual(res.data.duplicate, true));

  console.log('\nLeads');
  res = await alice('GET', '/api/leads');
  const leads = res.data.leads;
  check('only the real lead was stored', () => {
    assert.strictEqual(res.data.total, 1, `expected 1 lead, got ${res.data.total}`);
    assert.strictEqual(leads[0].name, 'Dave Smith');
    assert.strictEqual(leads[0].status, 'new');
    assert.deepStrictEqual(leads[0].extra, { Urgency: 'Today' });
    assert.strictEqual(leads[0].form_name, 'Emergency callout');
  });

  const leadId = leads[0].id;
  res = await bob('GET', '/api/leads');
  check("Bob's lead list is empty", () => assert.strictEqual(res.data.total, 0));
  res = await bob('PATCH', `/api/leads/${leadId}`, { status: 'lost' });
  check("Bob cannot update Alice's lead", () => assert.strictEqual(res.status, 404));
  res = await bob('DELETE', `/api/leads/${leadId}`);
  check("Bob cannot delete Alice's lead", () => assert.strictEqual(res.status, 404));

  res = await alice('PATCH', `/api/leads/${leadId}`, { status: 'won', value_cents: 24500, notes: 'Booked for Tuesday' });
  check('lead status, value and notes save', () => {
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.status, 'won');
    assert.strictEqual(res.data.value_cents, 24500);
    assert.strictEqual(res.data.notes, 'Booked for Tuesday');
  });

  res = await alice('PATCH', `/api/leads/${leadId}`, { status: 'nonsense' });
  check('unknown status is rejected', () => assert.strictEqual(res.status, 400));

  res = await alice('GET', '/api/leads?q=flooding');
  check('search finds the lead', () => assert.strictEqual(res.data.total, 1));
  res = await alice('GET', '/api/leads?q=nothingmatchesthis');
  check('search excludes non-matches', () => assert.strictEqual(res.data.total, 0));
  res = await alice('GET', '/api/leads?status=new');
  check('status filter works', () => assert.strictEqual(res.data.total, 0));

  res = await alice('GET', '/api/stats');
  check('stats reflect the won lead', () => {
    assert.strictEqual(res.data.total, 1);
    assert.strictEqual(res.data.counts.won, 1);
    assert.strictEqual(res.data.won_value_cents, 24500);
  });

  res = await alice('GET', '/api/leads/export.csv');
  check('CSV export contains the lead', () => {
    assert.match(res.data, /Dave Smith/);
    assert.match(res.data, /Emergency callout/);
  });

  console.log('\nHardening');
  // A lead whose name starts with "=" is a formula to a spreadsheet, so the
  // export has to neutralise it.
  await visitor('POST', `/api/public/form/${bobForm.key}/lead`, {
    name: '=cmd|calc',
    email: 'sneaky@example.com',
    phone: '555 0123',
    _t: 8000,
  });
  res = await bob('GET', '/api/leads/export.csv');
  check('CSV export neutralises spreadsheet formulas', () => assert.match(res.data, /"'=cmd\|calc"/));

  res = await alice('POST', '/api/account/password', {
    current_password: 'wrong password',
    new_password: 'a whole new password',
  });
  check('password change needs the current password', () => assert.strictEqual(res.status, 403));

  res = await alice('POST', '/api/account/password', {
    current_password: 'correct horse battery',
    new_password: 'a whole new password',
  });
  check('password change succeeds', () => assert.strictEqual(res.status, 200));

  res = await alice('GET', '/api/leads');
  check('the session that changed the password still works', () => assert.strictEqual(res.status, 200));

  // A session opened before the password change must be dead afterwards.
  const staleAlice = client();
  await staleAlice('POST', '/api/auth/login', { email: 'alice@example.com', password: 'a whole new password' });
  res = await alice('POST', '/api/account/password', {
    current_password: 'a whole new password',
    new_password: 'yet another password',
  });
  res = await staleAlice('GET', '/api/leads');
  check('older sessions are signed out by a password change', () => assert.strictEqual(res.status, 401));

  console.log('\nDeletion');
  res = await bob('DELETE', '/api/account', { password: 'wrong' });
  check('account deletion needs the password', () => assert.strictEqual(res.status, 403));
  res = await bob('DELETE', '/api/account', { password: 'a different password' });
  check('account deletes', () => assert.strictEqual(res.status, 200));
  res = await visitor('GET', `/api/public/form/${bobForm.key}`);
  check("a deleted account's form stops accepting leads", () => assert.strictEqual(res.status, 404));

  server.close();
  try {
    fs.rmSync(process.env.DB_PATH, { force: true });
    fs.rmSync(process.env.DB_PATH + '-wal', { force: true });
    fs.rmSync(process.env.DB_PATH + '-shm', { force: true });
  } catch (_) {}

  console.log(`\n${passes} passed, ${failures} failed`);
  process.exit(failures ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
