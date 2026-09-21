// There is no Pine compiler in this repository. These checks catch the common
// copy/paste failures before the script reaches TradingView: bad brackets,
// non-ASCII editor characters, duplicate top-level names, and mismatched
// function calls.
//
// The rest of the file pins what the script is FOR, which is Jacques's own
// sentence (17 Sep 2026): "an indicator that aligns with it, letting me know
// high probability swings and zones and the best time to hold a move or scalp."
// Three rebuilds lost sight of that - a box of numbers he could not read, then
// five timeframe rows, then a version cut down to swing letters alone - so the
// pieces he actually asked for are each held here by name.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const PINE = path.join(__dirname, '..', '..', 'tradingview', 'Someday-Indicator.pine');
const read = () => fs.readFileSync(PINE, 'utf8');
const bare = (line) => line.replace(/\/\/.*$/, '').replace(/'[^']*'/g, "''").replace(/"[^"]*"/g, '""');
const body = () => read().split('\n').map(bare);

function inside(text, open) {
    let depth = 0;
    for (let i = open; i < text.length; i++) {
        if ('([{'.includes(text[i])) depth++;
        if (')]}'.includes(text[i])) {
            depth--;
            if (depth === 0) return text.slice(open + 1, i);
        }
    }
    return null;
}

function topCommas(list) {
    let depth = 0;
    let count = 0;
    for (const ch of list) {
        if ('([{'.includes(ch)) depth++;
        else if (')]}'.includes(ch)) depth--;
        else if (ch === ',' && depth === 0) count++;
    }
    return count;
}

test('the file is a Pine v5 script and starts by saying so', () => {
    const lines = read().split('\n');
    assert.strictEqual(lines[0].trim(), '//@version=5');
    assert.match(lines[1], /^\/\/ Someday/);
});

test('the script is plain ASCII and has no tabs', () => {
    read().split('\n').forEach((line, index) => {
        assert.ok(!line.includes('\t'), `line ${index + 1} contains a tab`);
        for (const character of line) {
            assert.ok(character.charCodeAt(0) < 128, `line ${index + 1} contains ${JSON.stringify(character)}`);
        }
    });
});

test('every bracket opens and closes on the same line', () => {
    body().forEach((line, index) => {
        let depth = 0;
        for (const ch of line) {
            if ('([{'.includes(ch)) depth++;
            if (')]}'.includes(ch)) depth--;
            assert.ok(depth >= 0, `line ${index + 1} closes a bracket too early`);
        }
        assert.strictEqual(depth, 0, `line ${index + 1} leaves a bracket open`);
    });
});

test('indentation remains in Pine four-space steps', () => {
    body().forEach((line, index) => {
        if (!line.trim()) return;
        assert.strictEqual(line.match(/^ */)[0].length % 4, 0, `line ${index + 1} is not indented in fours`);
    });
});

test('the top level does not redeclare a name', () => {
    const seen = new Map();
    body().forEach((line, index) => {
        const match = line.match(/^(?:var\s+\S+\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=(?!=)/);
        if (!match) return;
        assert.ok(!seen.has(match[1]), `${match[1]} is redeclared on line ${index + 1}`);
        seen.set(match[1], index + 1);
    });
    assert.ok(seen.size >= 8);
});

test('the script stays small enough to read at a glance', () => {
    const lines = body().filter((line) => line.trim());
    assert.ok(lines.length < 200, `${lines.length} lines of settings and drawing is more than a quiet chart`);
});

test('each script function is called with the number of values it accepts', () => {
    const text = body().join('\n');
    const functions = new Map();
    for (const match of text.matchAll(/^([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)\s*=>/gm)) {
        functions.set(match[1], match[2].trim() ? topCommas(match[2]) + 1 : 0);
    }
    assert.ok(functions.size >= 2);
    for (const [name, wanted] of functions) {
        for (const match of text.matchAll(new RegExp(`(^|[^A-Za-z0-9_.])${name}\\s*\\(`, 'gm'))) {
            const open = match.index + match[0].length - 1;
            const args = inside(text, open);
            assert.notStrictEqual(args, null, `${name} is not closed`);
            const got = args.trim() ? topCommas(args) + 1 : 0;
            assert.strictEqual(got, wanted, `${name} accepts ${wanted} values but got ${got}`);
        }
    }
});

test('every input has a settings group', () => {
    body().forEach((line, index) => {
        if (!/input\./.test(line)) return;
        assert.match(line, /group=/, `line ${index + 1} has an ungrouped setting`);
    });
});

test('nothing on the chart is invented in a comment', () => {
    // Every price on screen is read from a bar that closed. No third-party
    // address either - the same rule the rest of the app keeps.
    assert.doesNotMatch(read(), /https?:\/\//);
});

// "The 5 sec is not even listed." The script used to carry rows of timeframes
// chosen in the settings. A list like that can only ever hold what was thought
// of on the day it was written, so it can never keep up with whatever he
// decides to trade next - and it drifts out of step with the chart in front of
// him. It reads the chart he has open now, so the 5 second chart and the daily
// chart both work with nothing to set and nothing to keep in step.
test('it reads the chart it is on, so every timeframe works', () => {
    const text = read();
    assert.doesNotMatch(text, /input\.timeframe/);
    assert.doesNotMatch(text, /request\.security/);
    assert.doesNotMatch(text, /contextTf/);
    assert.doesNotMatch(text, /Body swing/);
    assert.match(text, /ta\.pivothigh\(bodyTop\(\), swingLen, swingLen\)/);
    assert.match(text, /ta\.pivotlow\(bodyBottom\(\), swingLen, swingLen\)/);
});

test('one swing length drives every letter and the zone', () => {
    const text = read();
    assert.match(text, /ta\.pivothigh\(bodyTop\(\), swingLen, swingLen\)/);
    assert.match(text, /ta\.pivotlow\(bodyBottom\(\), swingLen, swingLen\)/);
    assert.doesNotMatch(text, /contextLen/);
    assert.doesNotMatch(text, /pivothigh\(high, 2, 2\)/);
    assert.doesNotMatch(text, /pivotlow\(low, 2, 2\)/);
});

// 21 Sep 2026, looking at it on the daily: "it still reads every swing". It was
// marking every turn - a letter every few bars, which is noise rather than
// structure. The default is now five bars either side, and the floor is two so
// it cannot be turned back into a letter per twitch by accident.
test('only the turns that held are marked', () => {
    const text = read();
    assert.match(text, /input\.int\(5, "Swing length"/);
    assert.match(text, /minval=2/);
    assert.doesNotMatch(text, /input\.int\(2, "Swing length"/);
});

// "Each letter is coloured by what it says" - green where structure is holding
// up, red where it is failing. It is the letter's own meaning, not a signal and
// not a direction call: HH and HL are one colour, LH and LL the other, and the
// first swing of a kind stays grey because it has earned no name yet.
test('the letter is coloured by what it says, not by direction', () => {
    const text = read();
    assert.match(text, /upCol = input\.color\(#089981/);
    assert.match(text, /downCol = input\.color\(#f23645/);
    assert.match(text, /highName == "HH" \? upCol : highName == "LH" \? downCol : color\.gray/);
    assert.match(text, /lowName == "HL" \? upCol : lowName == "LL" \? downCol : color\.gray/);
});

// "Wicks are not counted as highs." The body is the only part of a candle that
// is a price, so a swing high is the top of a body and a swing low is the bottom
// of one. Nothing in the script may pivot on a wick.
test('swings are read from the candle body, never from a wick', () => {
    const text = read();
    assert.match(text, /bodyTop\(\) => math\.max\(open, close\)/);
    assert.match(text, /bodyBottom\(\) => math\.min\(open, close\)/);
    assert.doesNotMatch(text, /pivothigh\(high/);
    assert.doesNotMatch(text, /pivotlow\(low/);
    assert.doesNotMatch(text, /ta\.highest\(/);
    assert.doesNotMatch(text, /ta\.lowest\(/);
});

// "Remove the words, just keep HH HL LL LH." The four letters are the only
// words written over the candles. A swing that cannot be named yet writes
// nothing at all.
test('the four letters are written, and nothing over the candles but them', () => {
    const text = read();
    assert.doesNotMatch(text, /BROKE/);
    assert.doesNotMatch(text, /showBreaks/);
    for (const letter of ['"HH"', '"LH"', '"HL"', '"LL"']) assert.ok(text.includes(letter), `${letter} is written`);
    assert.match(text, /if highName != ""/);
    assert.match(text, /if lowName != ""/);
    // Two swing letters and the one read - nothing else is ever written.
    assert.strictEqual((text.match(/label\.new\(/g) || []).length, 3);
});

// "Why is that a LL when you have not broken the HL?" A low that dips under the
// last low and closes back above it is not a lower low - the old low is still
// standing. Reaching past a level is only named once a candle has CLOSED through
// it. Stopping short needs no proof: a low that does not reach the last low is a
// higher low by itself, and a high that does not reach the last high is a lower
// high by itself.
test('reaching past a level waits for a candle to close through it', () => {
    const text = read();
    assert.match(text, /barstate\.isconfirmed and not na\(namedLow\) and close < namedLow/);
    assert.match(text, /barstate\.isconfirmed and not na\(namedHigh\) and close > namedHigh/);
    assert.match(text, /lowBroken := true/);
    assert.match(text, /highBroken := true/);
    // Named in this order, so a break wins over the plain comparison and a
    // comparison that stopped short still gets its letter.
    assert.match(text, /na\(namedLow\) \? "L" : lowBroken \? "LL" : swingLow > namedLow \? "HL" : ""/);
    assert.match(text, /na\(namedHigh\) \? "H" : highBroken \? "HH" : swingHigh < namedHigh \? "LH" : ""/);
});

// "high probability swings and zones". The zone is the range the market has
// been dealing between: the last swing high and the last swing low, with the
// middle of it drawn through. Both levels are kept, so ONE box moves when the
// structure moves - it does not stamp a new box on every bar.
test('the zone is drawn, and it is one box that moves rather than a staircase', () => {
    const text = read();
    assert.match(text, /max_boxes_count/);
    assert.match(text, /box\.new\(/);
    assert.strictEqual((text.match(/box\.new\(/g) || []).length, 1);
    assert.match(text, /box\.set_top\(/);
    assert.match(text, /box\.set_bottom\(/);
    assert.match(text, /box\.set_left\(/);
    assert.match(text, /box\.set_right\(/);
    assert.match(text, /line\.new\(/);
    assert.match(text, /line\.set_xy1\(/);
    assert.match(text, /line\.set_xy2\(/);
    // The range is the two tracked levels, and it is up to him whether it is
    // drawn at all.
    assert.match(text, /zoneTop = haveZone \? math\.max\(namedHigh, namedLow\)/);
    assert.match(text, /zoneBot = haveZone \? math\.min\(namedHigh, namedLow\)/);
    assert.match(text, /if not showZone and not na\(zoneBox\)/);
});

// "the best time to hold a move or scalp". The read is a description of where
// price sits in the range and what a hold would need - never a call on what
// comes next, which a chart cannot know. The forecast wording that used to sit
// on this page is gone and stays gone.
test('the read says where in the range price is and what a hold needs', () => {
    const text = read();
    assert.match(text, /label\.style_label_left/);
    assert.match(text, /Near the top of the range/);
    assert.match(text, /Near the bottom of the range/);
    assert.match(text, /Middle of the range/);
    assert.match(text, /A hold needs a close above/);
    assert.match(text, /A hold needs a close below/);
    assert.match(text, /A hold needs one of the edges to go first/);
    assert.match(text, /ticks to the high/);
    assert.match(text, /ticks to the low/);
    // Both edges measured off the symbol's own tick, so the numbers are the
    // ones the chart itself is quoting.
    assert.match(text, /float tick = syminfo\.mintick/);
    // No promise about the future, and none of the old signal panel.
    const code = body().join('\n');
    assert.doesNotMatch(code, /forecast|predict|guaranteed|longOk|shortOk|Frame \(sets the level\)/);
    assert.doesNotMatch(text, /table\.new/);
    assert.doesNotMatch(text, /table\.cell/);
});

test('the copy route still serves this script as plain text', () => {
    const server = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
    const route = server.match(/app\.get\('\/someday\.pine'[\s\S]*?\}\);/);
    assert.ok(route, '/someday.pine route exists');
    assert.match(route[0], /res\.type\('text\/plain'\)/);
    assert.match(route[0], /tradingview', 'Someday-Indicator\.pine'/);
});
