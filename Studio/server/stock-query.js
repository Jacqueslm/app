// Turning a line of a plan into something a stock library can answer.
//
// This lives in its own file for one reason: it is the part that decides
// whether automatic footage-finding works at all, and it is pure — words in,
// words out, no network, no database — so it can be unit-tested. studio.js
// requires it; nothing else here touches Pexels.

// Words that are true of every shot in every video and so tell Pexels nothing.
const STOCK_STOP = new Set(('a an the and or but of to in on at by for with from into onto over under' +
  ' is are was were be been being it its his her their they he she him them we us you your my mine i' +
  ' this that these those there here then than so as if not no nothing something anything' +
  ' close closeup wide shot scene frame camera view looking seen shows showing' +
  ' very really just already again more most much many some any every all one two three' +
  ' up down out off back around through across between behind beside' +
  // Verbs and hedges that carry a story but describe no picture. These are what
  // narration is made of, and every one of them returns junk.
  ' what who when where why how says say said tell told calls called know knew' +
  ' makes made make does did done goes went gone comes came get got gets' +
  ' saw see seen look looks looked hold holds held keep kept stop stopped' +
  ' find found buy bought hide hid miss missed give gave take took' +
  ' hard easy good bad right wrong nobody somebody everybody anybody' +
  ' always never ever once again year years day days night nights time times like').split(/\s+/));

// Panel names in a pasted plan carry the subject: 01_toywheel, 04_report,
// 09_setdown. Leading numbers and separators come off, camel humps split.
function stockWordsFromName(name) {
  return String(name || '')
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/^[\d\W_]+/, '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_\-.]+/g, ' ')
    .toLowerCase();
}

function usefulWords(src, limit) {
  return String(src || '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOCK_STOP.has(w))
    .slice(0, limit);
}

// What to search for, best guess first.
//
// The big lesson from running this over the real shot tables: **do not mix the
// two sources.** The panel name is a subject ("sofa", "calendar", "wrappers")
// and the narration is a feeling ("Nobody calls this an addiction"). Glued
// together you get "drive nobody calls addiction", which is worse than either
// half and returns nothing. So they stay separate attempts, in order:
//
//   1. the panel name — almost always the right picture
//   2. the narration's concrete words — for rows with no name
//   3. the name's first word alone — for glued names like "toywheel" that
//      match nothing whole
//
// CHARACTER NAMES NEVER APPEAR. They are written in caps in a plan, and no
// stock library has your Hector in it — searching for him returns strangers.
function stockQueriesFrom(name, text) {
  const nameWords = usefulWords(stockWordsFromName(name), 3);
  const textWords = usefulWords(String(text || '').replace(/\b[A-Z][A-Z']{2,}\b/g, ' ').toLowerCase(), 3);
  const tries = [];
  const add = (q) => { if (q && !tries.includes(q)) tries.push(q); };
  add(nameWords.join(' '));
  add(textWords.join(' '));
  if (nameWords.length) add(nameWords[0]);
  return tries;
}

// The words shown to you next to a filled shot, so you can see what it went
// looking for. Always the best attempt.
function stockQueryFrom(name, text) {
  return stockQueriesFrom(name, text)[0] || '';
}

module.exports = { stockQueriesFrom, stockQueryFrom, stockWordsFromName, STOCK_STOP };
