// The Certification — 12 Oct 2026.
//
// Jacques: "make each training 90 days test after 30 quiz after every lesson and
// an ultimate quiz to acquire an certificate for both parts", and then, on what
// the fitness track is built from: "My by 10 program in the trainer app and
// mixed with the standard accreditation information."
//
// Two things can go wrong quietly here and neither makes a sound: a track that
// is not actually ninety days (a chunk of lessons lost in an edit), and a quiz
// question whose right answer points at an option that is not there. Both are
// read straight off the page's own arrays, which is the only way to catch them —
// the page renders correctly either way.
//
// Run:  cd TurnSomeDayIntoOneday/server && npm test
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..', '..');
const PAGE = path.join(ROOT, 'certify.html');
const HTML = fs.readFileSync(PAGE, 'utf8');

// The lessons are literal arrays in the page's inline script. Read the literal
// and evaluate just that, so a broken half of the page cannot hide behind a
// render that never runs in a test.
function literal(name) {
  const m = HTML.match(new RegExp('var ' + name + ' = \\[([\\s\\S]*?)\\n\\];'));
  assert.ok(m, name + ' must be a literal array in certify.html');
  return new Function('return [' + m[1] + ']')();
}

const HERB = literal('HERB_DAYS');
const FIT = literal('FIT_DAYS');

test('both tracks are ninety days, numbered one to ninety', () => {
  for (const [name, days] of [['herbalist', HERB], ['trainer', FIT]]) {
    assert.equal(days.length, 90, name + ' must be ninety days');
    days.forEach((d, i) => {
      assert.equal(d.d, i + 1, `${name}: the day at index ${i} must be numbered ${i + 1}`);
    });
  }
});

// 15 Oct 2026. Jacques: "As I'm doing to herb certification i dont its confusing
// rewrite it on the level a 2nd grader would understand in the quiz give 5
// questions." The herbalist track's quizzes were rewritten in plainer words,
// five to a lesson, and the trainer track was left at three. The count is
// asserted per track rather than for both, because that is the shape asked for.
const QUIZ = { herbalist: 5, trainer: 3 };

test('every lesson carries a title, a subject, teaching and a quiz', () => {
  for (const [name, days] of [['herbalist', HERB], ['trainer', FIT]]) {
    for (const d of days) {
      assert.ok(typeof d.t === 'string' && d.t.trim(), `${name} day ${d.d}: no title`);
      assert.ok(typeof d.s === 'string' && d.s.trim(), `${name} day ${d.d}: no subject line`);
      assert.ok(Array.isArray(d.p) && d.p.length > 0, `${name} day ${d.d}: no teaching`);
      d.p.forEach((p) => assert.ok(typeof p === 'string' && p.trim(),
        `${name} day ${d.d}: an empty teaching paragraph`));
      assert.ok(Array.isArray(d.q), `${name} day ${d.d}: no quiz`);
      assert.equal(d.q.length, QUIZ[name], `${name} day ${d.d}: the quiz is ${QUIZ[name]} questions`);
    }
  }
});

// The rewrite is a rewrite, not a relabelling: the herbalist track's questions
// are short, plain sentences a beginner reads straight off, and no lesson leans
// on one question position for its right answer. Both are the kind of thing an
// edit can quietly undo, so both are checked.
test('the herbalist quizzes are plain and short, and no position is always right', () => {
  const at = [0, 0, 0, 0];
  for (const d of HERB) {
    d.q.forEach((q, qi) => {
      const words = q.q.trim().split(/\s+/).length;
      assert.ok(words <= 14, `herbalist day ${d.d} question ${qi + 1} is ${words} words - too long for a beginner`);
      const why = q.w.trim().split(/\s+/).length;
      assert.ok(why <= 22, `herbalist day ${d.d} question ${qi + 1}: the reason is ${why} words long`);
      at[q.k]++;
    });
  }
  // Five questions a day over ninety days: if one position were always right,
  // it would hold 450 answers. Nothing close.
  at.forEach((n, i) => assert.ok(n < 300,
    `the right answer sits at position ${i} ${n} times - that is a pattern, not a quiz`));
  assert.ok(at.filter((n) => n > 0).length === 4, 'all four positions are used');
});

test('every quiz question has one right answer among three or four options', () => {
  // The quiet failure: an option dropped in an edit leaves k pointing past the
  // end, and the page then paints "right" on the wrong line — or on nothing.
  for (const [name, days] of [['herbalist', HERB], ['trainer', FIT]]) {
    for (const d of days) {
      d.q.forEach((q, qi) => {
        const at = `${name} day ${d.d} question ${qi + 1}`;
        assert.ok(typeof q.q === 'string' && q.q.trim(), `${at}: no question text`);
        assert.ok(Array.isArray(q.a), `${at}: no options`);
        assert.ok(q.a.length === 3 || q.a.length === 4, `${at}: ${q.a.length} options, not three or four`);
        q.a.forEach((a) => assert.ok(typeof a === 'string' && a.trim(), `${at}: an empty option`));
        assert.ok(Number.isInteger(q.k) && q.k >= 0 && q.k < q.a.length,
          `${at}: the right answer (${q.k}) is not one of the options`);
        assert.ok(typeof q.w === 'string' && q.w.trim(), `${at}: no reason given with the answer`);
      });
    }
  }
});

test('a test sits after day thirty and after day sixty, and an exam at the end', () => {
  // The shape Jacques asked for, asserted rather than assumed.
  assert.match(HTML, /name:"Block Test One",\s*covers:"Days 1 to 30"/);
  assert.match(HTML, /name:"Block Test Two",\s*covers:"Days 31 to 60"/);
  assert.match(HTML, /The Ultimate Examination/);
  // A block test is one question from every day of its block; the examination is
  // drawn from all ninety. Both are built from the lessons' own quizzes.
  assert.match(HTML, /function blockQuestions\(id,b\)\{/);
  assert.match(HTML, /out\.push\(\{ day:day\.d, q:day\.q\[0\] \}\)/);
  assert.match(HTML, /for \(var d=1; d<=TOTAL; d\+=3\)/);
  assert.match(HTML, /out\.push\(\{ day:day\.d, q:day\.q\[1\] \}\)/);
  // And the passing marks are stated once, at the top.
  assert.match(HTML, /var PASS_DAY = 2;/);
  assert.match(HTML, /var PASS_TEST = 24;/);
  // 15 Oct 2026. The herbalist quizzes went to five questions and the mark had
  // to follow them: the page used to say "2 of 3" whatever the quiz asked, and
  // a five-question quiz passed at two right is a quiz nobody can fail. The
  // mark is per track now, and the copy reads it from the track rather than
  // repeating a number.
  assert.match(HTML, /var PASS_DAY_HERB = 4;/);
  assert.match(HTML, /function passMark\(t\)\{ return t\.id === "herbalist" \? PASS_DAY_HERB : PASS_DAY; \}/);
  assert.match(HTML, /passed at " \+ passMark\(t\) \+ " of " \+ t\.days\[0\]\.q\.length/);
  assert.match(HTML, /passed:passOk\(t\.id,right\)/);
  assert.doesNotMatch(HTML, /of 3 is the pass/, 'the pass is not a fixed three anymore');
});

test('the day pass mark fits the quiz each track asks', () => {
  // Four of five and two of three, measured against the quizzes themselves, so
  // a later edit to either track cannot leave the page passing a day on the
  // wrong fraction of its own questions.
  const { sandbox, byId } = load();
  const C = sandbox.window.CERTIFY;
  const herb = C.TRACKS.find((t) => t.id === 'herbalist');
  const fit = C.TRACKS.find((t) => t.id === 'fitness');
  assert.equal(C.passMark(herb), 4);
  assert.equal(C.passMark(fit), 2);
  assert.equal(C.passMark(herb) / herb.days[0].q.length, 0.8);
  assert.ok(C.passMark(fit) <= fit.days[0].q.length);
  assert.ok(C.passMark(herb) <= herb.days[0].q.length);

  // And the decision the quiz actually makes, through the page's own surface.
  assert.equal(C.passOk('herbalist', 5), true, 'five of five passes an herbalist day');
  assert.equal(C.passOk('herbalist', 4), true, 'four of five passes an herbalist day');
  assert.equal(C.passOk('herbalist', 3), false, 'three of five does not: the old 2-of-3 mark would have');
  assert.equal(C.passOk('herbalist', 2), false, 'and two of five is nowhere near a pass');
  assert.equal(C.passOk('fitness', 3), true, 'the trainer track is unchanged: three of three');
  assert.equal(C.passOk('fitness', 2), true, 'two of three passes it, as it always did');
  assert.equal(C.passOk('fitness', 1), false);

  // And the line a person actually reads on the track screen, rendered. It said
  // "of 3" for both tracks whatever the quiz asked.
  C.go({ track: 'herbalist', day: null, test: null, exam: false, cert: null });
  assert.match(byId('view').innerHTML, /its quiz is passed at 4 of 5\./,
    'the herbalist track states its own mark over its own question count');
  C.go({ track: 'fitness', day: null, test: null, exam: false, cert: null });
  assert.match(byId('view').innerHTML, /its quiz is passed at 2 of 3\./,
    'and the trainer track is unchanged');
});

test('the exam unlocks only on the two passed tests and all ninety days', () => {
  assert.match(HTML, /function examUnlocked\(id\)\{/);
  assert.match(HTML, /testPassed\(id,30\) && testPassed\(id,60\)/);
  assert.match(HTML, /blockDone\(id,BLOCKS\[0\]\) && blockDone\(id,BLOCKS\[1\]\)/);
});

test('a certificate is written, and says honestly what it is not', () => {
  assert.match(HTML, /Certificate of Completion/);
  assert.match(HTML, /function renderCert\(/);
  // The two honesty sentences carry the real credentials, so nobody mistakes
  // this page's record of study for one of them.
  assert.match(HTML, /American Herbalists Guild Registered Herbalist/);
  assert.match(HTML, /No US state licenses herbalists/);
  assert.match(HTML, /NASM, ACE, ACSM, NSCA, ISSA, AFAA and NETA/);
  assert.match(HTML, /it is not one of those credentials and it is not a licence/);
});

test('the trainer track teaches the by-10 as a rule and P90X as the exercises', () => {
  // 18 Oct 2026. Jacques, on what the by-10 actually is: "P90x is just the
  // exercises I'm using by 10 is the theory behind how I train because when I
  // actually train I reorganize p90x", and then the rule itself: "The by 10 is
  // 3-5 sets max reps nomre than 20 and 10 seconds rest that's the gist of it."
  //
  // That is the whole of the by-10, and it is not what this track used to say.
  // The track had grown a programme of its own out of the by-10 - rounds and
  // rotations, two levels with fixed rep counts, a timed last move, twenty
  // minutes of cardio, five cardio choices - none of which he ever gave, all of
  // it stated as though it lived in the Trainer app. The exercises are P90X's
  // and the app holds P90X's rotation; the by-10 is the rule applied to it. So
  // the rule is required here, and the inventions are required to be gone, or
  // the course is certifying a method that does not exist.
  // 19 Oct 2026, the theory behind the rule, in his words: "traditional workouts
  // rest between 30 seconds to 2 minutes ... my by 10 cuts down workout duration
  // so and 1 hour workout becomes 30 minutes ... you do less reps in each set but
  // it guarantees that you burn out and each move is not done in full extension
  // its at about 3/4 both ways to keep the intensity throughout building strength
  // cardiovascular system and promotes muscle growth". So the trade against
  // traditional rest, the halved session, the burnout and the three-quarter range
  // are all required here - and the track used to say the opposite of two of
  // them, calling the by-10 "moderate intensity" and saying training to failure
  // was "not the by-10's choice".
  //
  // 19 Oct 2026, and the rule corrected again, in his words: "By 10 is not based
  // on how much weight you can lift its finding that comfort to pump ot reps
  // with dumbell sets depend on individual starting point 2 to 5 sets no matter
  // your level for a beginners 1 weeknof stretching first ... by 10 can be done
  // everyday as long as workout or rotated and do 2 workouts a day resistance
  // and cardio ... week 4 8 12 rest I dont do I go right intonthe next
  // rotatation or a full week of cardio and a little stretching". So the sets
  // are two to five rather than three to five, the weight is chosen by comfort
  // rather than by what a person can lift, the method can run every day, the
  // day holds two sessions, a beginner's first week is stretching, and the
  // rest weeks are optional. Those are required now, and the claims they
  // replace are required gone.
  assert.match(HTML, /by-10/);
  for (const re of [
    /The by-10 is not a list of exercises/,
    /does not ask how much a person can lift/,
    /dumbbell light enough to pump out the reps with/,
    /two to five sets/i,
    /never more than twenty/,
    /ten seconds between one move and the next/,
    /The exercises are not the by-10's/,
    /thirty seconds to two minutes/,
    /an hour's workout becomes thirty minutes/,
    /guaranteed burnout/,
    /three-quarters/,
    /promotes muscle growth/,
    /can be done every day/,
    /Two sessions a day/,
    /jump rope, a step session, walking, dancing/,
    /first week is stretching/,
    /the by-10 does not require them/,
    /P90X/,
  ]) assert.match(HTML, re);
  for (const gone of [
    /eight rotations/i,
    /ten rotations/i,
    /thirty-second last move/i,
    /sixty-second last move/i,
    /last-move times/i,
    /twenty minutes of cardio/i,
    /thirty minutes of cardio/i,
    /five choices/i,
    /the two levels/i,
    /three lifting days/i,
    /regimen in the Trainer app/i,
    /not the by-10's choice/i,
    /moderate intensity and moderate volume/i,
    /three to five sets/i,
    /Three sets to five/,
    /six days on and one off, the way the rotation runs/,
    /recovery weeks at weeks 4, 8 and 13 are the rotation's own way/,
    /A set of ten at a moderate load/,
  ]) assert.doesNotMatch(HTML, gone, `the by-10's superseded numbers are gone: ${gone} is back`);
  // And the accreditation ground beside it is unchanged.
  assert.match(HTML, /FITT-VP/);
  assert.match(HTML, /AFAA-CGFI/);
  assert.match(HTML, /CPR and AED/);
});

// The source checks above read the page. This one RUNS its script in a small
// sandbox, because the failure they cannot see is a typo in the engine itself -
// a name that does not exist, a function called before it is defined - which
// leaves a page that renders nothing at all while every string test still passes.
// Point and click needs a real DOM, so the surface is driven instead: the same
// window.CERTIFY the page exposes, walked from the home screen into a track and
// into a day.
// opts.canvas swaps document.createElement('canvas') for a recording stand-in,
// which is what lets the export be checked without a browser: the page draws,
// and the drawing is read back, so the name and the honest line have to be on
// it. Every node the page makes is remembered either way, so the download the
// export performs can be looked at too.
function load(opts) {
  const o = opts || {};
  const made = [];    // every node the page creates
  const drawn = [];   // every canvas it draws on
  const said = [];    // every lesson the page reads aloud (opts.speech only)
  const blocks = [...HTML.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)]
    .filter((m) => !/\bsrc=/.test(m[1])).map((m) => m[2]);
  assert.ok(blocks.length > 0, 'the page must carry its own script');

  function element(tag) {
    return {
      tag: tag || '_new',
      innerHTML: '', textContent: '', value: '', hidden: false, disabled: false,
      className: '', style: {}, attrs: {}, href: '', download: '', clicked: false,
      classList: { add() {}, remove() {} },
      // The page mounts its screen bar with insertAdjacentHTML, which a stub
      // without it turns into a crash on every render. The markup is kept so a
      // check can see what was mounted, and on what screen.
      inserted: '', insertions: [],
      insertAdjacentHTML(pos, html) { this.insertions.push({ pos, html: String(html) }); this.inserted += String(html); },
      children: [], parentNode: null, tagName: (tag || 'DIV').toUpperCase(),
      getAttribute: () => null,
      setAttribute() {}, removeAttribute() {}, focus() {}, closest: () => null,
      querySelectorAll: () => [], querySelector: () => null,
      appendChild() {}, removeChild() {}, remove() {},
      addEventListener() {},
      click() { this.clicked = true; },
    };
  }
  function canvasEl() {
    const calls = [];
    const ctx = {
      font: '', fillStyle: '', strokeStyle: '', lineWidth: 1, textAlign: '',
      fillRect() {}, strokeRect() {},
      beginPath() {}, arc() {}, moveTo() {}, lineTo() {}, stroke() {}, closePath() {}, fill() {},
      fillText: (text, x, y) => { calls.push(['fillText', String(text), x, y]); },
      measureText: (text) => ({ width: String(text).length * 12 }),
      createLinearGradient: () => ({ addColorStop() {} }),
    };
    const c = {
      tag: 'canvas', width: 0, height: 0,
      getContext: () => ctx, toDataURL: () => 'data:image/png;base64,AAAA',
    };
    drawn.push({ canvas: c, ctx, calls });
    return c;
  }
  const els = new Map();
  const byId = (n) => {
    if (!els.has(n)) els.set(n, element(n));
    return els.get(n);
  };
  const doc = {
    getElementById: byId,
    querySelectorAll: () => [],
    querySelector: () => null,
    addEventListener() {},
    createElement: (tag) => {
      const el = o.canvas && tag === 'canvas' ? canvasEl() : element(tag);
      made.push(el);
      return el;
    },
    body: element('body'), documentElement: element('html'), readyState: 'complete',
  };
  // opts.store seeds localStorage BEFORE the page's script runs, which is the
  // only way to check what the page does to a phone that already holds scores.
  const store = Object.assign({}, o.store || {});
  const sandbox = {
    document: doc, console,
    setTimeout, clearTimeout, setInterval, clearInterval,
    Math, JSON, Date, Object, Array, String, Number, Boolean, RegExp, Error, Promise, Map, Set, Intl,
    localStorage: {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: (k) => { delete store[k]; },
    },
    location: { href: '/certify' },
    sent: 0,
    printed: 0,
    print() { sandbox.printed += 1; },
    fetch: async () => { sandbox.sent += 1; return { ok: true, status: 200, json: async () => ({}) }; },
    scrollTo() {}, matchMedia: () => ({ matches: false, addEventListener() {} }),
    navigator: { userAgent: 'node' },
  };
  // The voice (13 Oct 2026). Off unless a check asks for it, so the other
  // checks see the page exactly as a phone without a voice sees it — the
  // button says so rather than doing nothing. When it is on, an utterance is
  // recorded and ends at once, which is all that is needed to prove what was
  // read and what was not.
  if (o.speech) {
    sandbox.speechSynthesis = {
      speaking: false,
      speak(u) { said.push(String(u.text)); if (u.onend) u.onend(); },
      cancel() {}, pause() {}, resume() {},
      getVoices() { return []; }, addEventListener() {},
    };
    sandbox.SpeechSynthesisUtterance = function (text) { this.text = text; };
  }
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(blocks[0], sandbox, { filename: 'certify.html' });
  return { sandbox, els, store, byId, made, drawn, said };
}

test('a day recorded against a different quiz opens again, and the tests on it with it', () => {
  // 15 Oct 2026. The herbalist track's quizzes went from three questions a
  // lesson to five, and the day rows on a phone that did the old ones read
  // "3/3 ✓" for ninety days nobody has answered at five questions - with a
  // certificate queued behind a pass earned on the quiz that is gone. A record
  // that no longer describes the quiz on the page is not a record, so the day
  // opens again and the two block tests and the examination, every question of
  // them drawn from those same rewritten quizzes, are owed again with it. The
  // trainer track's three-question quizzes did not change, so nothing of its is
  // touched.
  const { sandbox, store, byId } = load({
    store: {
      tsid_certify_v1: JSON.stringify({
        name: 'Jacques',
        tracks: {
          herbalist: {
            days: { 1: { right: 3, total: 3, passed: true, on: '2026-10-12' },
                    2: { right: 2, total: 3, passed: false, on: '2026-10-12' } },
            tests: { 30: { right: 27, total: 30, passed: true, on: '2026-10-12' } },
            exam: { right: 27, total: 30, passed: true, on: '2026-10-12' },
          },
          fitness: {
            days: { 1: { right: 3, total: 3, passed: true, on: '2026-10-12' } },
            tests: { 30: { right: 25, total: 30, passed: true, on: '2026-10-12' } },
            exam: null,
          },
        },
      }),
    },
  });
  const C = sandbox.window.CERTIFY;

  // Compared by keys, not by an empty object literal: the page's own objects come
  // from its own sandbox, and a bare {} is the wrong prototype to match against.
  assert.deepStrictEqual(Object.keys(C.state.tracks.herbalist.days), [],
    'the herbalist track starts over: a three-question score is not a score on a five-question quiz');
  assert.deepStrictEqual(Object.keys(C.state.tracks.herbalist.tests), [],
    'the block tests are drawn from the rewritten quizzes, so they are owed again');
  assert.strictEqual(C.state.tracks.herbalist.exam, null, 'and so is the examination');

  assert.strictEqual(C.state.tracks.fitness.days['1'].passed, true,
    'the trainer track keeps what it earned: its quizzes are the three they always were');
  assert.strictEqual(C.state.tracks.fitness.tests['30'].passed, true);

  // And the screen a thumb lands on says so, rather than ninety rows of "3/3 ✓".
  C.go({ track: 'herbalist', day: null, test: null, exam: false, cert: null });
  const rows = byId('view').innerHTML;
  assert.doesNotMatch(rows, /3\/3/, 'not one stale score is left on the list');
  assert.match(rows, /0 of 90 days/);
  assert.match(rows, /that day opens again: a score against a different quiz is not a score/,
    'and the rule that emptied them is on the page, not only in the code');

  // The written-back record is the cleaned one, so the phone is not pruned again
  // on every open - the page that keeps its own house in order.
  const kept = JSON.parse(store.tsid_certify_v1);
  assert.deepStrictEqual(Object.keys(kept.tracks.herbalist.days), []);
  assert.strictEqual(kept.tracks.fitness.days['1'].passed, true);
});

test('the page script runs, and its two tracks are drivable', () => {
  const { sandbox, store } = load();
  const C = sandbox.window.CERTIFY;
  assert.ok(C, 'the page must expose its own surface');
  assert.equal(C.TRACKS.length, 2, 'two trainings');
  assert.equal(C.days('herbalist').length, 90);
  assert.equal(C.days('fitness').length, 90);
  assert.equal(C.blocks.length, 2, 'a test after day thirty and after day sixty');
  assert.equal(C.PASS_TEST, 24);
  assert.equal(C.PASS_DAY, 2);

  // Walk it the way a thumb does: home -> track -> day, and save the score the
  // way the quiz does. A thrown error here means the page is blank in a browser.
  C.go({ track: 'herbalist' });
  C.go({ day: 1 });
  assert.ok(sandbox.sent === 0, 'nothing was fetched: the page is entirely on the phone');
});

test('every lesson on both tracks reads itself aloud, and the quiz is not read', () => {
  // 13 Oct 2026. Jacques: "have the lessons all the lessons on both programs to
  // read it to me like everything else." The Herb Library and The Key already
  // read themselves, so a lesson does too — the day's title, its subject line
  // and the teaching, on the herbalist track and on the trainer track, because
  // both come through the one place a lesson is drawn. The quiz is left to the
  // eye: a reading that spells out the right answer spoils the test.
  assert.match(HTML, /speechSynthesis/, 'the voice is the browser\'s own, on the phone');
  assert.match(HTML, /SpeechSynthesisUtterance/);
  assert.match(HTML, /id=\\"sayBtn\\"/, 'and every lesson is drawn with the button');

  const { sandbox, said, byId } = load({ speech: true });
  const C = sandbox.window.CERTIFY;
  for (const tid of ['herbalist', 'fitness']) {
    const first = C.days(tid)[0];
    C.go({ track: tid, day: 1, test: null, exam: false, cert: null });
    // The button is really on the drawn lesson, not only in the template.
    assert.match(byId('view').innerHTML, /id="sayBtn"/, `${tid}: the drawn lesson carries the button`);
    C.sayLesson();
    assert.equal(said.length, 1, `${tid}: the lesson was read once`);
    const spoken = said.pop();
    assert.ok(spoken.includes(first.t), `${tid}: the title is read`);
    assert.ok(spoken.includes(first.s), `${tid}: the subject line is read`);
    first.p.forEach((p) => assert.ok(spoken.includes(p), `${tid}: the teaching is read`));
    first.q.forEach((q) => assert.ok(!spoken.includes(q.q), `${tid}: the quiz is left to the eye`));
  }

  // A phone with no voice says so rather than leaving a dead button behind.
  const plain = load();
  plain.sandbox.window.CERTIFY.go({ track: 'herbalist', day: 1 });
  plain.sandbox.window.CERTIFY.sayLesson();
  assert.match(plain.byId('sayBtn').textContent, /no voice/, 'a phone with no voice says so');
});

test('every screen that is not a lesson or a quiz carries its own read-aloud bar', () => {
  // Jacques, 15 Oct 2026: "the read it to me doesn't work here ... the whole app
  // not just specific sections." A lesson had a button; home, a track and the
  // certificate had none, so half the page could not be listened to. The bar is
  // mounted after every render and reads the screen as it was just drawn.
  assert.match(HTML, /function mountScreenSay\(\)/);
  assert.match(HTML, /mountScreenSay\(\);/, 'and it is mounted after every render');
  assert.ok(HTML.includes('screenSayBtn'), 'the bar carries its own button');
  assert.ok(HTML.includes('screenSayStop'), 'and its own stop');

  const { sandbox, byId } = load({ speech: true });
  const C = sandbox.window.CERTIFY;
  const screens = [
    ['home (no track chosen)', { track: null, day: null, test: null, exam: false, cert: null }],
    ['a track', { track: 'herbalist', day: null, test: null, exam: false, cert: null }],
    ['the certificate', { track: 'herbalist', cert: 'herbalist', day: null, test: null, exam: false }],
  ];
  for (const [name, route] of screens) {
    const v = byId('view');
    v.insertions.length = 0;
    C.go(route);
    const mounted = v.insertions.map((i) => i.html).join('');
    assert.match(mounted, /id="screenSayBtn"/, `${name}: the screen mounts the read-aloud bar`);
  }

  // The two screens that keep their own arrangement get none: a lesson has its
  // own button on the lesson card, and a quiz is left to the eye.
  for (const [name, route] of [
    ['a lesson', { track: 'herbalist', day: 1, test: null, exam: false, cert: null }],
    ['a test', { track: 'herbalist', day: null, test: 1, exam: false, cert: null }],
    ['the examination', { track: 'herbalist', day: null, test: null, exam: true, cert: null }],
  ]) {
    const v = byId('view');
    v.insertions.length = 0;
    C.go(route);
    const mounted = v.insertions.map((i) => i.html).join('');
    assert.doesNotMatch(mounted, /id="screenSayBtn"/, `${name}: left as it was`);
  }

  // And the bar reads the screen, not a fixed line: the words it walks are the
  // ones drawn under it, and it skips its own bar, the lesson row and printing.
  assert.match(HTML, /function screenSayText\(\)/);
  assert.ok(HTML.includes('noprint|sayrow|saybar|saysaid'),
    'the bar, the lesson row and print-only words are never read back');
  assert.ok(HTML.includes('if (view.day || view.test || view.exam) return;'),
    'a lesson and a quiz mount nothing');
});

test('a passed day is remembered, and a passed exam earns the certificate', () => {
  const { sandbox, store } = load();
  const C = sandbox.window.CERTIFY;
  // The page's own state object, written the way wireQuiz writes it when a quiz
  // is passed. Then saved and read back, which is what survives a closed tab.
  C.state.tracks.herbalist.days['1'] = { right: 5, total: 5, passed: true, on: '2026-10-12' };
  C.save();
  assert.ok(/tsid_certify_v1/.test(JSON.stringify(store)) || 'tsid_certify_v1' in store,
    'the day is kept under the page\'s own key');
  const saved = JSON.parse(store.tsid_certify_v1);
  assert.equal(saved.tracks.herbalist.days['1'].passed, true);

  // And the examination and the certificate both render, in the order a person
  // reaches them: into the track, then the exam, then the certificate.
  C.go({ track: 'herbalist' });
  C.go({ exam: true });
  C.go({ cert: 'herbalist' });
});

// 13 Oct 2026. Jacques: "link lessons to certificate, add reload, export
// certificate." The three quiet failures that came with those words:
//
//   1. the certificate reachable only at the very end, which leaves the one
//      thing the whole track is for with no way in from a lesson it is built
//      out of;
//   2. a page that paints a certificate for work nobody has done, which is the
//      single dishonest thing this page could do;
//   3. an export that silently does nothing on a phone - an image never drawn,
//      a name never on it, or a download with no file behind it.

test('every lesson and every test carries the way to the certificate', () => {
  // The seal has to be in the page's own markup, not only in its script: the
  // script wires it up by id at boot, so a header without it is a thrown page.
  assert.match(HTML, /id="certlink"/);
  assert.match(HTML, /id=\\"dayCert\\"/, 'and the lesson footer is drawn with it');
  const { sandbox, byId: look } = load();
  const P = sandbox.window.CERTIFY;

  // The header's seal is on every lesson, and it says what is done so far.
  P.go({ track: 'herbalist', day: null, test: null, exam: false, cert: null });
  assert.ok(!look('certlink').hidden, 'the track carries the seal');
  assert.match(String(look('certlink').title), /0 of 90 days done so far/);
  P.go({ day: 1, test: null, exam: false, cert: null });
  assert.ok(!look('certlink').hidden, 'and a lesson carries it too');
  assert.match(look('view').innerHTML, /id="dayCert"/, 'the lesson links to the certificate');
  assert.match(look('view').innerHTML, /Day 1 of 90 in The Herbalist/,
    'and says where the lesson sits in the ninety');
  P.go({ day: null, test: 1 });
  assert.ok(!look('certlink').hidden, 'and a block test carries it');
  assert.match(look('view').innerHTML, /Block Test One/, 'which is the test that really rendered');
  P.go({ test: null, exam: true });
  assert.ok(!look('certlink').hidden, 'and the examination carries it');
  assert.match(look('view').innerHTML, /The Ultimate Examination/);

  // The track's own button is there from day one, not only at the end.
  P.go({ track: 'herbalist', exam: false, day: null, test: null, cert: null });
  const track = look('view').innerHTML;
  assert.match(track, /id="toCert"/, 'the track links to the certificate from the start');
  assert.match(track, /Day 1 of 90|Days 1 to 30/, 'and it is the track that rendered');
  assert.match(track, /Not yet earned\. Still owed: 90 lessons, Block Test One, Block Test Two and the Ultimate Examination\./,
    'and says plainly what is still owed');

  // On the certificate itself there is nowhere for the seal to go.
  P.go({ cert: 'herbalist', track: null, day: null, test: null, exam: false });
  assert.ok(look('certlink').hidden, 'the seal is not shown on the certificate');
});

test('a certificate is not painted before the examination is passed', () => {
  const { sandbox, byId, store } = load();
  const C = sandbox.window.CERTIFY;
  // What the view is built out of has to be built properly: a stray </div> in a
  // string like this one does not throw, it just eats the next section.
  const balanced = (html) => {
    const open = (html.match(/<(div|p|span|button)\b/g) || []).length;
    const close = (html.match(/<\/(div|p|span|button)>/g) || []).length;
    assert.equal(open, close, `the certificate markup nests: ${open} tags opened, ${close} closed`);
  };

  C.go({ cert: 'herbalist', track: null, day: null, test: null, exam: false });
  const early = byId('view').innerHTML;
  assert.match(early, /Not yet earned/, 'the view says so in the open');
  assert.match(early, /Still owed:/);
  assert.doesNotMatch(early, /awarded to/, 'and it does not award itself anything');
  assert.doesNotMatch(early, /id="image"/, 'with no image to export before it is earned');
  assert.doesNotMatch(early, /id="print"/, 'and nothing to print either');
  assert.match(early, /id="reload"/, 'but the reload is there');
  assert.match(early, /id="backTrack"/, 'and the way back to the lessons is there');
  assert.match(early, /What this certificate records/);
  assert.match(early, /0 of 90 done/);
  assert.match(early, /not yet taken/);
  balanced(early);

  // The record is the page's own store, not a story about it.
  C.state.tracks.herbalist.days['1'] = { right: 5, total: 5, passed: true, on: '2026-10-13' };
  C.state.tracks.herbalist.days['2'] = { right: 4, total: 5, passed: true, on: '2026-10-13' };
  C.save();
  C.go({ cert: 'herbalist', track: null, day: null, test: null, exam: false });
  assert.match(byId('view').innerHTML, /2 of 90 done/);
  assert.ok(store.tsid_certify_v1, 'and it is the same record the page keeps');

  // Earned: the certificate, and the two ways out of it.
  C.state.tracks.herbalist.exam = { right: 27, total: 30, passed: true, on: '2026-10-13' };
  C.go({ cert: 'herbalist', track: null, day: null, test: null, exam: false });
  const earned = byId('view').innerHTML;
  assert.match(earned, /awarded to/);
  assert.match(earned, /Ultimate Examination 27 of 30/);
  assert.match(earned, /id="print"/, 'an earned certificate can be printed');
  assert.match(earned, /id="image"/, 'and saved as an image');
  assert.match(earned, /id="reload"/);
  assert.match(earned, /Back to the lessons/);
  assert.doesNotMatch(earned, /Not yet earned/);
  balanced(earned);
});

test('the export draws the certificate here, name, record and honest line on it', () => {
  const { sandbox, made, drawn } = load({ canvas: true });
  const C = sandbox.window.CERTIFY;
  assert.equal(C.certFilename('herbalist', '2026-10-13'), 'certificate-herbalist-2026-10-13.png');
  assert.equal(C.certFilename('fitness', '2026-10-13'), 'certificate-fitness-2026-10-13.png');

  const fitness = C.TRACKS[1];
  const how = C.exportCert(fitness, 'Jacques', { right: 28, total: 30, on: '2026-10-13' });
  assert.equal(how, 'saved', 'the image is drawn and handed to the browser');
  assert.equal(sandbox.sent, 0, 'nothing was fetched to make it');
  assert.equal(sandbox.printed, 0, 'and the print dialog was not needed');

  const canvas = drawn[drawn.length - 1];
  assert.equal(canvas.canvas.width, 1600, 'a certificate-shaped canvas');
  assert.equal(canvas.canvas.height, 1132);
  const text = canvas.calls.filter((c) => c[0] === 'fillText').map((c) => c[1]).join(' ');
  assert.match(text, /THE TRUTH/, 'the seal line');
  assert.match(text, /CERTIFICATE OF COMPLETION/);
  assert.match(text, /The Trainer/, 'the track it is for');
  assert.match(text, /Jacques/, 'the name it is written for');
  assert.match(text, /awarded to/);
  assert.match(text, /Ultimate Examination 28 of 30/);
  // The honest line has to travel on the image, not just on the page: a picture
  // of a certificate goes further than the page does.
  assert.match(text, /it is not one of those credentials and it is not a licence/);

  const link = made.filter((m) => m.tag === 'a').pop();
  assert.ok(link, 'the export makes a download link');
  assert.equal(link.download, 'certificate-fitness-2026-10-13.png');
  assert.match(link.href, /^data:image\/png/);
  assert.ok(link.clicked, 'and clicks it, which is what saves the file');
});

test('with no canvas to draw on, the export falls back to printing rather than dying', () => {
  const { sandbox } = load();          // no canvas in this sandbox
  const C = sandbox.window.CERTIFY;
  assert.equal(C.drawCert(C.TRACKS[0], 'Jacques', { right: 0, total: 0, on: '2026-10-13' }), null);
  assert.equal(C.exportCert(C.TRACKS[0], 'Jacques', { right: 0, total: 0, on: '2026-10-13' }), 'print');
  assert.equal(sandbox.printed, 1, 'the print dialog is the way out, where Save as PDF lives');
  assert.equal(C.exportCert(C.TRACKS[0], 'Jacques', { right: 0, total: 0, on: '2026-10-13' }), 'print');
});

test('the reload reads the store again rather than throwing', () => {
  const { sandbox, byId, store } = load();
  const C = sandbox.window.CERTIFY;
  assert.match(HTML, /function reloadPage\(\)/);
  assert.match(HTML, /window\.location\.reload/);
  assert.match(HTML, /id=\\"reload\\"/);
  // A record written by another visit is picked up by the reload, which is the
  // part of it that matters on this page.
  store.tsid_certify_v1 = JSON.stringify({
    // Four of the five the herbalist track asks now: a fixture still written as
    // three would be a record of a quiz this page no longer has, and the page
    // would rightly open the day again instead of reading it.
    name: 'Jacques', tracks: { herbalist: { days: { 1: { right: 4, total: 5, passed: true, on: '2026-10-13' } }, tests: {}, exam: null } },
  });
  C.go({ track: 'herbalist', day: null, test: null, exam: false, cert: null });
  C.reload();
  assert.match(byId('view').innerHTML, /Certificate earned|1 of 90 days/);
  assert.ok(sandbox.sent === 0, 'the reload asks the phone, not a server');
});

test('the lesson, the score and the name stay on the phone', () => {
  // This page is private and offline-first like the pages around it: one key in
  // local storage, and nothing sent anywhere.
  assert.match(HTML, /var LS = "tsid_certify_v1";/);
  assert.match(HTML, /localStorage\.setItem\(LS/);
  assert.doesNotMatch(HTML, /fetch\(/, 'nothing on this page goes to a server');
  assert.doesNotMatch(HTML, /XMLHttpRequest/);
  assert.match(HTML, /Nothing is sent anywhere|nothing is sent anywhere/);
});

// 13 Oct 2026. Jacques: "link them and deepen them." Two failures this guards
// against, neither of which throws: a lesson left without its deeper layer (a
// day of GO_DEEPER lost in an edit), and a door that points at nothing real (a
// mistyped tab or day, so the library opens on its ordinary A-Z instead of the
// ground the lesson leaned on).
test('every lesson is deepened, and linked into the library it stands on', () => {
  const { sandbox, byId } = load();
  const C = sandbox.window.CERTIFY;
  for (const id of ['herbalist', 'fitness']) {
    for (let d = 1; d <= 90; d++) {
      const g = C.deeperFor(id, d);
      assert.ok(g, `${id} day ${d}: no deeper layer`);
      assert.ok(typeof g.p === 'string' && g.p.trim().length > 20,
        `${id} day ${d}: the deeper paragraph is too thin to be one`);
      assert.match(g.to, /^\/(herbs|trainer)/, `${id} day ${d}: the door goes nowhere real`);
    }
  }
  // The door names the exact place: a course day, the safety tab, the cards, or
  // the Trainer.
  assert.equal(C.deeperFor('herbalist', 2).label, 'Herb Library - day 1');
  assert.match(C.deeperFor('herbalist', 40).label, /Read this first/);
  assert.match(C.deeperFor('herbalist', 40).to, /#safety/);
  assert.equal(C.deeperFor('fitness', 12).to, '/trainer');
  assert.match(C.deeperFor('fitness', 12).label, /Trainer/);

  // And the lesson view shows both, on the page itself.
  C.go({ track: 'herbalist', day: 2, test: null, exam: false, cert: null });
  const day = byId('view').innerHTML;
  assert.match(day, /Going deeper/, 'the lesson carries the deeper layer');
  assert.match(day, /href="\/herbs#d1"/, 'and the door into the library');
  assert.match(day, /Herb Library - day 1/, 'naming where it lands');

  // The track offers the same door for the whole track.
  C.go({ track: 'fitness', day: null, test: null, exam: false, cert: null });
  assert.match(byId('view').innerHTML, /href="\/trainer"/, 'the trainer track opens the Trainer');
  C.go({ track: 'herbalist', day: null, test: null, exam: false, cert: null });
  assert.match(byId('view').innerHTML, /href="\/herbs"/, 'and the herbalist track opens the library');
});

test('a link from the library or the Trainer opens the lesson it names', () => {
  const { sandbox, byId } = load();
  const C = sandbox.window.CERTIFY;
  // The hash shape the app uses, and the query shape a shared link travels in.
  sandbox.location = { hash: '#herbalist/12', search: '' };
  const dl = C.parseDeepLink();
  assert.equal(dl.track, 'herbalist');
  assert.equal(dl.day, 12);
  C.bootLink();
  assert.match(byId('view').innerHTML, /Day 12 of 90 in The Herbalist/);

  sandbox.location = { hash: '', search: '?track=fitness&day=30' };
  const d2 = C.parseDeepLink();
  assert.equal(d2.track, 'fitness');
  assert.equal(d2.day, 30);
  C.bootLink();
  assert.match(byId('view').innerHTML, /Day 30 of 90 in The Trainer/);

  // An address that names nothing leaves the home screen as it was.
  sandbox.location = { hash: '#nonsense', search: '' };
  assert.equal(C.bootLink(), false);
});

// 13 Oct 2026, at Jacques's next word: "link to plant cards add cross progress
// bridge". A lesson that names a plant now opens that plant's own card, and the
// two pages report each other's progress. Guarded here: a lesson that names
// plants but links none, a plant-card address the library cannot resolve, and a
// bridge that reads a key nothing writes.
test('every plant a lesson names gets a link onto its own card', () => {
  const { sandbox, byId } = load();
  const C = sandbox.window.CERTIFY;
  // The slug is made the same way the library makes it, so the two meet.
  assert.equal(C.plantSlug('St John\u2019s wort'), 'st-john-s-wort');
  assert.equal(C.plantSlug('Pau d\u2019arco'), 'pau-d-arco');

  // The lessons that name plants carry a card link for each of them.
  const wanted = {
    16: ['comfrey'],
    26: ['garlic'],
    27: ['echinacea', 'licorice', 'marshmallow', 'yarrow', 'sage'],
    28: ['valerian', 'catnip', 'fennel', 'dandelion', 'kelp'],
    29: ['aloe', 'comfrey', 'witch-hazel', 'senna', 'pau-d-arco'],
    30: ['gymnema', 'bilberry', 'guggul', 'chickweed', 'goldenseal'],
    43: ['st-john-s-wort', 'ginkgo'],
    83: ['st-john-s-wort', 'ginkgo', 'comfrey', 'kava'],
  };
  for (const d of Object.keys(wanted)) {
    const g = C.deeperFor('herbalist', Number(d));
    const slugs = g.cards.map((c) => c.slug);
    for (const s of wanted[d]) assert.ok(slugs.includes(s), `day ${d} links the ${s} card`);
    for (const c of g.cards) assert.equal(c.to, '/herbs#p-' + c.slug, 'each card is addressed by its slug');
  }
  // A lesson that names no plant carries no plant links, and every plant link
  // is a door into the library.
  assert.equal(C.deeperFor('herbalist', 1).cards.length, 0);
  assert.equal(C.deeperFor('fitness', 12).cards.length, 0);

  // And the lesson view draws them, as doors onto the cards.
  C.go({ track: 'herbalist', day: 27, test: null, exam: false, cert: null });
  const day = byId('view').innerHTML;
  assert.match(day, /The plant cards this lesson names/);
  assert.match(day, /href="\/herbs#p-echinacea"/);
  assert.match(day, /href="\/herbs#p-licorice"/);
  assert.match(day, /href="\/herbs#p-marshmallow"/);
});

test('the herbalist track carries the Herb Library cross progress bridge', () => {
  const { sandbox, byId, store } = load();
  const C = sandbox.window.CERTIFY;
  // Nothing written yet: the library reads as unstarted, not as an error.
  assert.equal(C.herbBridge().done, 0);
  assert.match(C.herbBridgeLine(), /nothing started yet/);

  // What the library writes beside its store is what this page reads.
  store.tsid_herb_progress_v1 = JSON.stringify({ done: 7, total: 59, passed: false });
  assert.equal(C.herbBridge().done, 7);
  assert.match(C.herbBridgeLine(), /7 of 59 days done/);

  // On the track itself, and the passed test is named when it is passed.
  C.go({ track: 'herbalist', day: null, test: null, exam: false, cert: null });
  assert.match(byId('view').innerHTML, /7 of 59 days done/);
  store.tsid_herb_progress_v1 = JSON.stringify({ done: 59, total: 59, passed: true });
  C.go({ track: 'herbalist', day: null, test: null, exam: false, cert: null });
  assert.match(byId('view').innerHTML, /day-60 test passed/);

  // A damaged summary is a library nobody has started, never a thrown page.
  store.tsid_herb_progress_v1 = '{not json';
  assert.equal(C.herbBridge().done, 0);
  C.go({ track: 'herbalist', day: null, test: null, exam: false, cert: null });
  assert.match(byId('view').innerHTML, /nothing started yet/);

  // The trainer track has no library behind it, so it carries no bridge.
  C.go({ track: 'fitness', day: null, test: null, exam: false, cert: null });
  assert.doesNotMatch(byId('view').innerHTML, /Herb Library's own progress/);
});
