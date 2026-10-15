// Reading books on the player — 15 Oct 2026.
//
// Jacques: "make my player able to read audio books and pdf and text files."
//
// An audiobook is audio, and the player already played audio; what a book needed
// was a place it remembers, a jump back and on, and a speed. A PDF is not a
// sound at all until the words are lifted out of it, and that is the part with
// real ways to go wrong: a compressed stream that is not decompressed holds the
// whole book and yields nothing; a page break read as a paragraph break would
// make a two-sentence page a hundred paragraphs; an image stream read as text
// would put bytes where the words should be. So the reading is RUN here against
// real PDFs — built in this file with Node's own deflater, the same way a
// generator writes them — rather than read as text.
//
// Run:  cd TurnSomeDayIntoOneday/server && npm test
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const zlib = require('node:zlib');

const ROOT = path.join(__dirname, '..', '..');
const PAGE = fs.readFileSync(path.join(ROOT, 'music.html'), 'utf8');

// The reading itself: from its first line to the buttons that wire it to a page.
function blockSource() {
  const a = PAGE.indexOf("var BOOK_DB = 'tsid-books';");
  const b = PAGE.indexOf("// ── the reading tab's buttons ─");
  assert.ok(a > -1, 'the reading block must be in music.html');
  assert.ok(b > a, 'and the reading must come before the buttons that use it');
  return PAGE.slice(a, b);
}
const BLOCK = blockSource();

// The whole script the reading lives in, for the checks that are about the
// page rather than about the reading: one voice, one store, no network.
function readerScript() {
  const blocks = [...PAGE.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)]
    .filter((m) => !/\bsrc=/.test(m[1])).map((m) => m[2]);
  const mine = blocks.filter((b) => b.includes('tsid-books'));
  assert.equal(mine.length, 1, 'the reading is one script block');
  return mine[0];
}

/* A stand-in for the phone's storage. broken makes it behave like a private
   window, which is the case every one of these has to survive. */
function harness(stored, opts) {
  stored = stored || {};
  const broken = !!(opts && opts.broken);
  const ctx = {
    Promise, Uint8Array, TextDecoder, DecompressionStream, WritableStream,
    Math, Number, String, Array, Object, JSON, console, isFinite, parseInt,
    window: {
      localStorage: {
        getItem: (k) => {
          if (broken) throw new Error('private window');
          return Object.prototype.hasOwnProperty.call(stored, k) ? stored[k] : null;
        },
        setItem: (k, v) => {
          if (broken) throw new Error('private window');
          stored[k] = String(v);
        },
      },
    },
  };
  vm.createContext(ctx);
  vm.runInContext(BLOCK, ctx, { filename: 'music-reader.js' });
  return { ctx, stored, run: (expr) => vm.runInContext(expr, ctx) };
}

/* A PDF, written the way a generator writes one: a stream of text operators,
   deflated, between the keywords. Only the parts this reads are here. */
function pdfWith(content, deflate) {
  const stream = deflate === false ? Buffer.from(content, 'latin1') : zlib.deflateSync(Buffer.from(content, 'latin1'));
  return Buffer.concat([
    Buffer.from('%PDF-1.4\n1 0 obj\n<< /Length ' + stream.length + ' >>\nstream\n', 'latin1'),
    stream,
    Buffer.from('\nendstream\nendobj\n%%EOF\n', 'latin1'),
  ]);
}

const PAGE_OF_STYLE = 'BT /F1 12 Tf 72 720 Td (The cleaning certificate is the record of the study.) Tj '
  + '(It is not a licence.) Tj ET';

/* ASCII85, the way ReportLab writes every stream: five characters to four bytes,
   'z' for four zero bytes, '~>' at the end. This encoder is here because the
   decoder in the page has to be tested against the shape the PDFs in this repo
   actually are — START-HERE.pdf and the Studio guide are both ASCII85 on top of
   Flate, and a reader that only knew plain Flate got nothing out of either. */
function ascii85Encode(buf) {
  let out = '';
  for (let i = 0; i < buf.length; i += 4) {
    const chunk = Buffer.concat([buf.subarray(i, i + 4), Buffer.alloc(Math.max(0, 4 - (buf.length - i)))]);
    const pad = 4 - Math.min(4, buf.length - i);
    let n = ((chunk[0] * 256 + chunk[1]) * 256 + chunk[2]) * 256 + chunk[3];
    const five = [];
    for (let k = 4; k >= 0; k--) { five[k] = String.fromCharCode(33 + (n % 85)); n = Math.floor(n / 85); }
    out += five.slice(0, 5 - pad).join('');
  }
  return out + '~>';
}
function pdfWithAscii85(content) {
  const inner = zlib.deflateSync(Buffer.from(content, 'latin1'));
  const stream = Buffer.from(ascii85Encode(inner), 'latin1');
  return Buffer.concat([
    Buffer.from('%PDF-1.4\n1 0 obj\n<< /Length ' + stream.length + ' /Filter [ /ASCII85Decode /FlateDecode ] >>\nstream\n', 'latin1'),
    stream,
    Buffer.from('\nendstream\nendobj\n%%EOF\n', 'latin1'),
  ]);
}

/* ------------------------------------------------------------ a real PDF */

test('the words come out of a PDF whose streams are deflated', async () => {
  const h = harness();
  h.ctx.buf = new Uint8Array(pdfWith(PAGE_OF_STYLE, true));
  const text = await h.run('pdfText(buf)');
  assert.match(text, /The cleaning certificate is the record of the study\./,
    'the words inside the compressed stream, read back');
  assert.match(text, /It is not a licence\./, 'and the second line with them');
  assert.ok(!/Tj|BT|ET|\/F1/.test(text), 'and none of the operators around them');
});

test('an uncompressed stream is read too, because not every PDF is deflated', async () => {
  const h = harness();
  h.ctx.buf = new Uint8Array(pdfWith(PAGE_OF_STYLE, false));
  const text = await h.run('pdfText(buf)');
  assert.match(text, /The cleaning certificate is the record of the study\./);
});

test('a PDF whose streams are ASCII85 on top of Flate is read — the shape ReportLab writes', async () => {
  const h = harness();
  h.ctx.buf = new Uint8Array(pdfWithAscii85(PAGE_OF_STYLE));
  const text = await h.run('pdfText(buf)');
  assert.match(text, /The cleaning certificate is the record of the study\./,
    'one encoding on top of another is still just words');
  assert.match(text, /It is not a licence\./);
  assert.ok(!/^[!-u]{20}/.test(text), 'and none of the ASCII85 itself came through');
});

test('a photograph is skipped by name rather than decoded into noise', async () => {
  const h = harness();
  // A JPEG-compressed stream whose bytes happen to decode to text is still a
  // photograph: the filter says so, and the filter is what is believed.
  const jpegish = zlib.deflateSync(Buffer.from(PAGE_OF_STYLE, 'latin1'));
  const buf = Buffer.concat([
    Buffer.from('%PDF-1.4\n3 0 obj\n<< /Length ' + jpegish.length + ' /Filter [ /FlateDecode /DCTDecode ] >>\nstream\n', 'latin1'),
    jpegish,
    Buffer.from('\nendstream\nendobj\n%%EOF\n', 'latin1'),
  ]);
  h.ctx.buf = new Uint8Array(buf);
  assert.strictEqual(await h.run('pdfText(buf)'), '', 'an image contributes nothing');
});

test('a stream that is not words is left alone rather than read as text', async () => {
  const h = harness();
  // An image: bytes that decompress to bytes. It must contribute nothing at all.
  const noise = Buffer.alloc(600);
  for (let i = 0; i < noise.length; i++) noise[i] = (i * 7 + 13) % 256;
  const raw = zlib.deflateSync(noise);
  const buf = Buffer.concat([
    Buffer.from('%PDF-1.4\n2 0 obj\n<< /Length ' + raw.length + ' >>\nstream\n', 'latin1'),
    raw,
    Buffer.from('\nendstream\nendobj\n%%EOF\n', 'latin1'),
  ]);
  h.ctx.buf = new Uint8Array(buf);
  const text = await h.run('pdfText(buf)');
  assert.strictEqual(text, '', 'nothing was claimed as words when there were none');
});

test('a scan is refused as having no words, not read as gibberish', () => {
  const h = harness();
  assert.strictEqual(h.run('wordsEnough("").ok'), false, 'an empty lift is not a book');
  assert.strictEqual(h.run('wordsEnough("\\u0001\\u0002\\u0003\\u0004").ok'), false, 'nor is a page of bytes');
  const pageOfWords = 'The body clears what it can and the rest is stored until it can be dealt with. '
    + 'That is the whole of the claim and it is a plain one, printed as its own claim and not as '
    + 'a conclusion anyone else drew from it, which is exactly why the page carries it in the '
    + 'book\'s words rather than in the words of the person reading it.';
  h.ctx.pageOfWords = pageOfWords;
  const real = h.run('wordsEnough(pageOfWords)');
  assert.strictEqual(real.ok, true, 'a page of writing is a book');
  const short = h.run('wordsEnough("Two words.")');
  assert.strictEqual(short.ok, false, 'and a line is not, so a scan cannot slip through');
});

/* ------------------------------------------------------- paragraphs, not lines */

test('splitting a book gives paragraphs, not the lines the PDF was laid out in', () => {
  const h = harness();
  const parts = h.run('split("One sentence ends here.\\nThe next line is the same paragraph.\\n\\nA second paragraph is here.")');
  assert.strictEqual(parts.length, 2, 'the line break inside a paragraph is not a paragraph');
  assert.match(parts[0], /One sentence ends here\. The next line is the same paragraph\./);
  assert.match(parts[1], /^A second paragraph/);
});

test('a paragraph too long for a phone to speak is cut at a sentence, and nothing is lost', () => {
  const h = harness();
  const sentence = 'This is a sentence that carries on for a while. ';
  const long = sentence.repeat(60).trim();
  h.ctx.long = long;
  const parts = h.run('split(long)');
  const max = h.run('MAX_PARA');
  assert.ok(parts.length > 1, 'a long paragraph is cut');
  for (const p of parts) assert.ok(p.length <= max, `every piece is speakable (${p.length} <= ${max})`);
  const rejoined = parts.join(' ').replace(/\s+/g, ' ');
  assert.strictEqual(rejoined, long.replace(/\s+/g, ' '), 'the words are all still there');
});

test('a Markdown file is read as words, not as punctuation', () => {
  const h = harness();
  const out = h.run('markdownOff("# The Body\\n\\nThis is **bold** and this is a [link](https://example.com).\\n")');
  assert.match(out, /The Body/);
  assert.match(out, /This is bold and this is a link\./);
  assert.ok(!/#|\*\*|\[|\]\(/.test(out), 'the marks a renderer wants never reach the voice');
});

/* -------------------------------------------------------------- the place */

test('the place in a book is kept, and it is that book\'s own', () => {
  const h = harness();
  h.run('keep(POS_KEY, 0)');
  h.run('keepPosition("book-a", 41)');
  h.run('keepPosition("book-b", 7)');
  assert.strictEqual(h.run('whereItWas("book-a")'), 41);
  assert.strictEqual(h.run('whereItWas("book-b")'), 7, 'one book does not move another');
  assert.strictEqual(h.run('whereItWas("never-opened")'), 0, 'a book never opened starts at the top');
});

test('there is nowhere to keep it in a private window, and nothing breaks', () => {
  const h = harness({}, { broken: true });
  assert.strictEqual(h.run('kept(RATE_KEY, 1)'), 1, 'the setting falls back');
  assert.strictEqual(h.run('whereItWas("a-book")'), 0);
  h.run('keepPosition("a-book", 12)');
  assert.strictEqual(h.run('whereItWas("a-book")'), 0, 'nothing was written, and nothing threw');
});

test('the middle of a book is kept, and the end of one is not', () => {
  const h = harness();
  h.run('keepPosition("b", 12)');
  assert.strictEqual(JSON.parse(h.stored['tsid-book-pos']).b, 12, 'kept under the book\'s own key');
  h.run('keepPosition("b", 0)');
  assert.strictEqual(JSON.parse(h.stored['tsid-book-pos']).b, undefined,
    'finished or restarted clears it, so it opens at the top next time');
});

test('the place in an audiobook is kept apart from the place in a book', () => {
  const h = harness();
  h.run('keepPosition("chapter-01.mp3|9|17", 5120, AUDIO_POS_KEY)');
  assert.strictEqual(h.run('whereItWas("chapter-01.mp3|9|17", AUDIO_POS_KEY)'), 5120);
  assert.strictEqual(h.run('whereItWas("chapter-01.mp3|9|17")'), 0, 'and is not a paragraph of anything');
  assert.strictEqual(JSON.parse(h.stored['tsid-book-pos'] || '{}')['chapter-01.mp3|9|17'], undefined);
});

test('a speed is kept as a number, and reads back as one', () => {
  const h = harness({ 'tsid-book-rate': '1.5' });
  assert.strictEqual(h.run('kept(RATE_KEY, 1)'), 1.5);
  h.run('keep(RATE_KEY, 2)');
  assert.strictEqual(h.stored['tsid-book-rate'], '2', 'written as the number the reader uses');
  assert.strictEqual(h.run('kept("tsid-book-rate", 1)'), 2);
  const bad = harness({ 'tsid-book-rate': 'fast' });
  assert.strictEqual(bad.run('kept(RATE_KEY, 1)'), 1, 'a setting that is not a number falls back');
});

/* ------------------------------------------- the tab, driven as a person would
   The place in a book is only worth anything if opening the book again starts
   where it stopped, and that is wiring, not arithmetic: it is the tab's own
   buttons and its own list. So the whole script is run here against a stand-in
   page, with a voice that says one paragraph and waits to be told it finished —
   the phone's real behaviour, not an instant read-through. */
function standInPage(stored) {
  const made = {};
  const chip = (rate) => {
    const c = { className: 'chip', _a: { 'data-rate': rate, 'aria-pressed': 'false' }, listeners: {},
      getAttribute: (k) => c._a[k],
      setAttribute: (k, v) => { c._a[k] = String(v); },
      addEventListener: (t, fn) => { (c.listeners[t] = c.listeners[t] || []).push(fn); },
      click: () => (c.listeners.click || []).forEach((fn) => fn({ stopPropagation() {} })) };
    return c;
  };
  const node = (tag) => ({
    tagName: tag, children: [], listeners: {}, attrs: { 'data-i': '' }, className: '', textContent: '',
    innerHTML: '', hidden: false, type: '', value: '', files: [],
    appendChild(c) { this.children.push(c); return c; },
    addEventListener(t, fn) { (this.listeners[t] = this.listeners[t] || []).push(fn); },
    setAttribute(k, v) { this.attrs[k] = String(v); },
    getAttribute(k) { return this.attrs[k]; },
    querySelectorAll(sel) { return this.children.filter((c) => (sel.charAt(0) === '.'
      ? (c.className || '').split(/\s+/).includes(sel.slice(1))
      : String(c.tagName || '').toLowerCase() === sel.toLowerCase())); },
    scrollIntoView() {},
    clear() { this.children.length = 0; },
    click() { (this.listeners.click || []).forEach((fn) => fn({ stopPropagation() {} })); },
    fire(t) { (this.listeners[t] || []).forEach((fn) => fn.call(this, {})); },
  });
  const doc = { getElementById: (id) => (made[id] = made[id] || node('DIV')), createElement: (tag) => node(tag) };
  // The two chip rows the rate choices hang off.
  ['bookRateChips', 'rateChips'].forEach((id) => {
    doc.getElementById(id).children = ['0.8', '1', '1.25', '1.5', '2'].map(chip);
  });
  const spoken = [];
  let lastDone = null;
  const say = {
    speak(text, done) { spoken.push(text); lastDone = done; return true; },
    stop() { /* the phone is told to stop; it may still report the end */ },
    pause() {}, resume() {},
  };
  const audio = doc.getElementById('audio');
  audio.duration = 0; audio.currentTime = 0;
  const sandbox = {
    document: doc, console, Math, Number, String, Array, Object, JSON, RegExp, Error, Promise,
    Uint8Array, TextDecoder, DecompressionStream, WritableStream, isFinite, parseInt,
    setTimeout, clearTimeout,
    window: {
      localStorage: {
        getItem: (k) => (Object.prototype.hasOwnProperty.call(stored, k) ? stored[k] : null),
        setItem: (k, v) => { stored[k] = String(v); },
      },
      SAY: say,
      PLAYER: { key: () => 'chapter-01.mp3|100|7', name: () => 'Chapter one', audio: () => audio },
      addEventListener: () => {},
      indexedDB: null,
    },
  };
  sandbox.window.window = sandbox.window;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(readerScript(), sandbox, { filename: 'music-reader.js' });
  return {
    made, doc, spoken, sandbox, audio,
    // What a phone does when a cancelled utterance still reports itself finished.
    phoneReportsTheEnd() { if (lastDone) lastDone(true); },
  };
}

const BOOK = 'Chapter one.\n\nThe place in a book is kept.\n\nAnd it is kept for this book only.\n';

function bookFile(name, text) {
  return { name, size: text.length, lastModified: 7, type: 'text/plain',
    text: () => Promise.resolve(text), arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)) };
}

async function choose(p, file, wait) {
  p.made.bookInput.files = [file];
  p.made.bookInput.fire('change');
  await new Promise((r) => setTimeout(r, wait || 25));
}

test('a book chosen from the phone opens, and the paragraph it is on is the place', async () => {
  const stored = {};
  const p = standInPage(stored);
  await choose(p, bookFile('chapter-one.txt', BOOK));
  assert.equal(p.made.readName.textContent, 'chapter one', 'the book is named from the file');
  assert.equal(p.made.bookText.children.length, 3, 'its paragraphs are drawn');
  assert.equal(p.made.readStatus.textContent, 'Ready. Press Read aloud.');

  p.made.readPlay.click();
  assert.equal(p.spoken.length, 1, 'the first paragraph is spoken, and only it');
  assert.equal(p.spoken[0], 'Chapter one.', 'and the phone is handed the words, not a control');
  assert.equal(p.made.readPlay.textContent, '❚❚ Pause', 'the button becomes a way to pause');

  p.made.readNext.click();
  assert.equal(p.spoken[1], 'The place in a book is kept.', 'a paragraph on speaks the next one');
  const key = Object.keys(JSON.parse(stored['tsid-book-pos'] || '{}'))[0];
  assert.ok(/^chapter-one\.txt\|/.test(key), 'the place is kept under the file itself, not its name alone');
  assert.strictEqual(JSON.parse(stored['tsid-book-pos'])[key], 1, 'at the paragraph it moved on to');
  // The paragraph it is on is the place: paragraph one is where a book opens
  // anyway, so the first paragraph is never written down as a bookmark.
  const fresh = {};
  const q = standInPage(fresh);
  await choose(q, bookFile('chapter-one.txt', BOOK));
  q.made.readPlay.click();
  assert.deepStrictEqual(JSON.parse(fresh['tsid-book-pos'] || '{}'), {},
    'nothing is bookmarked at the very first paragraph, which is where it starts anyway');
});

test('a book opened again starts where it stopped, and says so', async () => {
  const stored = {};
  const p = standInPage(stored);
  await choose(p, bookFile('chapter-one.txt', BOOK));
  p.made.readPlay.click();          // paragraph 0
  p.made.readNext.click();          // paragraph 1 — the place is kept here
  const key = Object.keys(JSON.parse(stored['tsid-book-pos'] || '{}'))[0];
  assert.ok(key && /^chapter-one\.txt\|/.test(key), 'the place is kept under the file itself');
  assert.equal(JSON.parse(stored['tsid-book-pos'])[key], 1, 'at the paragraph it is on');

  p.made.readStop.click();
  const rows = p.made.bookList.children.filter((c) => (c.className || '').includes('song'));
  assert.ok(rows.length, 'the book is listed on the tab');
  rows[0].click();
  assert.match(p.made.readStatus.textContent, /Left off at paragraph 2 of 3/,
    'opening it again says where it stopped rather than starting over');
  assert.equal(p.made.bookText.children[1].className, 'now', 'and the paragraph it is on is marked');
});

test('a stopped book does not read on when the phone reports the paragraph ended', async () => {
  // speechSynthesis.cancel() and a finished utterance are not distinguishable
  // from the callback alone. A reader that only listened to the callback would
  // speak the next paragraph after every Stop — the sound stops and the book
  // carries on, which is the worst of both.
  const p = standInPage({});
  await choose(p, bookFile('chapter-one.txt', BOOK));
  p.made.readPlay.click();
  const said = p.spoken.length;
  p.made.readStop.click();
  p.phoneReportsTheEnd();
  assert.equal(p.spoken.length, said, 'nothing more is spoken after Stop');
  assert.equal(p.made.readPlay.textContent, '▶ Read aloud', 'and the button is ready to start again');

  // The page's own Stop reaches the book the same way, or the two voices fight.
  p.made.readPlay.click();
  const again = p.spoken.length;
  p.sandbox.window.READER.stop();
  p.phoneReportsTheEnd();
  assert.equal(p.spoken.length, again, 'and a stop that came from outside is honoured too');
  assert.match(PAGE, /function sayStop\(\)\{[\s\S]{0,900}window\.READER\.stop\(\)/,
    'the page voice tells the reading to stop');
});

test('a PDF and a text file both arrive as a book, through the same button', async () => {
  const p = standInPage({});
  // Long enough to be a page of writing rather than a stray running head: a real
  // PDF is, and the floor that tells a scan apart from a letter must not refuse
  // the letter.
  const pdf = pdfWithAscii85(PAGE_OF_STYLE + ' ' + PAGE_OF_STYLE);
  const file = { name: 'the-certificate.pdf', size: pdf.length, lastModified: 3, type: 'application/pdf',
    arrayBuffer: () => Promise.resolve(pdf.buffer.slice(pdf.byteOffset, pdf.byteOffset + pdf.byteLength)),
    text: () => Promise.resolve('') };
  await choose(p, file, 80);
  assert.ok(p.made.readName, 'a book was opened from the PDF - status: ' + (p.made.bookStatus || {}).textContent);
  assert.equal(p.made.readName.textContent, 'the certificate', 'named from the file, as the songs are');
  assert.match(p.made.readMeta.textContent, /A PDF/, 'it is known to have come from a PDF');
  assert.match(p.made.readMeta.textContent, /words/, 'and carries a word count');
  assert.equal(p.made.bookText.children.length, 1, 'the sentence in it is one paragraph');
  assert.match(p.made.bookText.children[0].textContent, /The cleaning certificate is the record of the study\./);
});

test('a phone that cannot unzip is told apart from a PDF with no words in it', () => {
  // Two different failures that must not read as one: a scan really has no text,
  // and a browser too old to decompress a stream was never given a fair look.
  const h = harness();
  assert.equal(h.run('canUnzip()'), true, 'this Node can inflate, which is what a phone does too');
  const noZip = { ...h.ctx, DecompressionStream: undefined, WritableStream: undefined };
  const ctxNoZip = { ...noZip, window: h.ctx.window };
  vm.createContext(ctxNoZip);
  vm.runInContext(BLOCK, ctxNoZip, { filename: 'music-reader-nozip.js' });
  assert.equal(vm.runInContext('canUnzip()', ctxNoZip), false);
  assert.match(PAGE, /too old to open a PDF/, 'and the page says which of the two it was');
  assert.match(PAGE, /has no words to read/, 'while a scan is still named as a scan');
});

test('the repo\'s own PDFs read, which is the file he would actually choose', async () => {
  const real = path.join(ROOT, '..', 'START-HERE.pdf');
  if (!fs.existsSync(real)) return;                 // not in this checkout, nothing to prove
  const bytes = fs.readFileSync(real);
  const h = harness();
  h.ctx.buf = new Uint8Array(bytes);
  const text = await h.run('pdfText(buf)');
  const words = h.run('countWords')(text);
  assert.ok(words > 1000, `START-HERE.pdf should read as words, got ${words}`);
  assert.match(text, /START HERE/, 'and its first line is the first line of the document');
  assert.ok(!/[!-u]{25}/.test(text.slice(0, 400)), 'with none of the ASCII85 it is stored as');
});

/* ------------------------------------------------------------- the page */

test('the reading tab is on the page, wired to its own panel', () => {
  assert.match(PAGE, /\['tab-read', 'panel-read'\]/, 'the tab pair is in the page\'s own tab list');
  assert.match(PAGE, /id="tab-read"/, 'the tab is in the markup');
  assert.match(PAGE, /id="panel-read"/, 'and so is the panel it opens');
});

test('a PDF, a text file and a Markdown file can all be chosen', () => {
  const input = (PAGE.match(/<input[^>]*id="bookInput"[^>]*>/) || [])[0];
  assert.ok(input, 'the file chooser is on the page');
  for (const kind of ['.pdf', '.txt', '.md']) assert.ok(input.includes(kind), `it takes ${kind} files`);
  assert.match(input, /application\/pdf/, 'and the PDF type, for a phone that reports one');
  assert.match(input, /multiple/, 'and more than one book at a time');
});

test('the book is read by the phone\'s own voice, and never by a second one', () => {
  const reader = readerScript();
  assert.match(reader, /window\.SAY/, 'the reading is handed to the page\'s own voice');
  assert.match(reader, /\.speak\(parts\[i\]|v\.speak\(/, 'and speaks through it, a paragraph at a time');
  assert.ok(!/SpeechSynthesisUtterance/.test(reader),
    'there is only one voice on the page - a second one would fight the first');
  assert.match(PAGE, /window\.SAY = \{[^}]*speak: speakText/, 'the voice lends itself out');
  assert.match(PAGE, /window\.READER && typeof window\.READER\.stop === 'function'/,
    'and reading the screen stops a book being read at the same time');
});

test('the reading needs no server and no signal', () => {
  const reader = readerScript();
  assert.ok(!/\bfetch\(|XMLHttpRequest/.test(reader), 'a book is never uploaded to be read');
  assert.ok(!/https?:\/\//.test(reader), 'and nothing is fetched to read it');
});

test('everything the reading draws is kept out of the page\'s own reading', () => {
  // The card holds the whole book. If the page's voice could walk into it, the
  // "Read it to me" button would read several hundred paragraphs back.
  const card = (PAGE.match(/<div[^>]*id="readCard"[^>]*>/) || [])[0];
  assert.ok(card, 'the open-book card is in the markup');
  assert.match(card, /noSay/, 'and it is marked noSay, so the page voice skips it');
  assert.match(PAGE, /className = \(el\.id === 'abNote' \? 'note' : 'status'\)/,
    'and the reading writes only into its own lines, never over the player\'s note');
  assert.match(PAGE, /class="abrow noSay" id="abRow"/, 'the audiobook bar stays out of the page reading too');
});

/* --------------------------------------------------------- the audiobook */

test('the player carries a place, a jump and a speed', () => {
  for (const id of ['back15', 'fwd30', 'fromStart', 'rateChips', 'abNote']) {
    assert.match(PAGE, new RegExp(`id="${id}"`), `${id} must be on the player card`);
  }
  for (const rate of ['0.8', '1', '1.25', '1.5', '2']) {
    assert.match(PAGE, new RegExp(`data-rate="${rate.replace('.', '\\.')}"`), `the ${rate}x chip must exist`);
  }
  assert.match(PAGE, /id="abRow"[^>]*class="[^"]*noSay"|class="abrow noSay"/,
    'the controls stay out of the page\'s own reading');
});

test('the place in an audiobook is asked of the player, not guessed from the card', () => {
  assert.match(PAGE, /window\.PLAYER = \{/,
    'the player leaves one window open, and it is the track and its key');
  assert.match(PAGE, /key: function\(\)\{ var t = nowTrack\(\); return t \? \(t\.key \|\| t\.url \|\| ''\) : ''; \}/,
    'a place is only meaningful against the track it belongs to');
  assert.match(PAGE, /function player\(\)\{\s*return window\.PLAYER \|\| null;\s*\}/,
    'the reading goes through that window and not around it');
  assert.match(PAGE, /function playerEl\(\)\{/, 'and asks which element is the player');
  assert.match(PAGE, /if \(el !== playerEl\(\)\) return;/,
    'the cross-fade\'s next song is not the track being listened to, and is left alone');
});

test('the speed is applied to both elements, so a cross-fade cannot quietly lose it', () => {
  assert.match(PAGE, /function applyRate\(\)\{[\s\S]{0,200}\$\('audio'\), \$\('xfade'\)/,
    'the rate is applied to both audio elements, not only the one playing');
  assert.match(PAGE, /if \(el\.playbackRate !== audioRate\) applyRate\(\);/,
    'and a rate chosen mid-book is corrected where it is playing');
  assert.match(PAGE, /if \(el !== playerEl\(\)\) return;\s*applyRate\(\);\s*setTimeout\(offerResume, 0\);/,
    'while the next song the cross-fade loaded is left exactly where it starts');
});
