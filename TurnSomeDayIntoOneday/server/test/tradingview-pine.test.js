// There is no Pine compiler in this repository. These checks catch the common
// copy/paste failures before the script reaches TradingView: bad brackets,
// non-ASCII editor characters, duplicate top-level names, and mismatched
// function calls. They also pin the two things the script is meant to keep: a
// swing is read from a closed candle body and never a wick, and a level is only
// taken out by a candle that closes through it.
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
    assert.match(lines[1], /^\/\/ Someday - structure and context/);
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
    assert.ok(seen.size > 20);
});

test('the script stays small enough to read at a glance', () => {
    const lines = body().filter((line) => line.trim());
    assert.ok(lines.length < 160, `${lines.length} lines of settings and drawing is more than a quiet chart`);
});

test('each script function is called with the number of values it accepts', () => {
    const text = body().join('\n');
    const functions = new Map();
    for (const match of text.matchAll(/^([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)\s*=>/gm)) {
        functions.set(match[1], match[2].trim() ? topCommas(match[2]) + 1 : 0);
    }
    assert.ok(functions.size >= 3);
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

test('the old prediction panel is gone', () => {
    const text = read();
    assert.doesNotMatch(text, /longOk|shortOk/);
    assert.doesNotMatch(text, /Frame \(sets the level\)/);
    assert.match(text, /request\.security/);
    assert.match(text, /table\.new/);
});

test('context is displayed for the trader\'s workflow', () => {
    const text = read();
    for (const tf of ['contextTf1', 'contextTf2', 'contextTf3', 'contextTf4', 'contextTf5']) assert.match(text, new RegExp(tf));
    assert.match(text, /Body swing high/);
    assert.match(text, /Body swing low/);
});

// The chart used to carry three different swing definitions at once: the H/HH/LH
// markers came from a hardcoded 2-bar pivot that ignored the setting, the table
// used the setting, and the step line came from the 10-bar zone structure. They
// could not agree, which is what "the highs and lows don't line up" meant.
// They agree now because there is one definition, on one number.
test('one swing length drives the labels, the levels and the context box', () => {
    const text = read();
    assert.match(text, /ta\.pivothigh\(bodyTop\(\), swingLen, swingLen\)/);
    assert.match(text, /ta\.pivotlow\(bodyBottom\(\), swingLen, swingLen\)/);
    // Every request goes out from the top level, onto a timeframe that came
    // straight from an input. A timeframe handed through the script's own code
    // must not come back: that is the "Cannot assign a variable to a tuple"
    // fault, which pointed at the left of the line while the right was wrong.
    for (const tf of ['contextTf1', 'contextTf2', 'contextTf3', 'contextTf4', 'contextTf5']) {
        assert.match(text, new RegExp(`request\\.security\\(syminfo\\.tickerid, ${tf}, `));
    }
    assert.doesNotMatch(text, /request\.security\(\s*\w+\(/);
    assert.doesNotMatch(text, /contextLen/);
    assert.doesNotMatch(text, /pivothigh\(high, 2, 2\)/);
    assert.doesNotMatch(text, /pivotlow\(low, 2, 2\)/);
});

// "Wicks are not counted as highs." The body is the only part of a candle that
// is a price, so a swing high is the top of a body and a swing low is the bottom
// of one. Nothing in the script may pivot on a wick again.
test('swings are read from the candle body, never from a wick', () => {
    const text = read();
    assert.match(text, /bodyTop\(\) => math\.max\(open, close\)/);
    assert.match(text, /bodyBottom\(\) => math\.min\(open, close\)/);
    assert.doesNotMatch(text, /pivothigh\(high/);
    assert.doesNotMatch(text, /pivotlow\(low/);
    assert.doesNotMatch(text, /ta\.highest\(/);
    assert.doesNotMatch(text, /ta\.lowest\(/);
});

// "Closed candles breaking structure." A level goes when a candle closes past
// it, and only then, so the break test reads the close and waits for the bar to
// be finished before it counts.
test('a level is only taken out by a candle that closes through it', () => {
    const text = read();
    assert.match(text, /barstate\.isconfirmed and not na\(highLevel\) and na\(highBrokenAt\) and close > highLevel/);
    assert.match(text, /barstate\.isconfirmed and not na\(lowLevel\) and na\(lowBrokenAt\) and close < lowLevel/);
    assert.match(text, /line\.set_x2\(highLine, na\(highBrokenAt\) \? bar_index : highBrokenAt\)/);
    assert.match(text, /line\.set_x2\(lowLine, na\(lowBrokenAt\) \? bar_index : lowBrokenAt\)/);
});

test('the last swing high and low are drawn as levels on the chart', () => {
    const text = read();
    assert.match(text, /showLevels = input\.bool/);
    assert.match(text, /highLine := line\.new\(bar_index - swingLen, swingHigh, bar_index, swingHigh/);
    assert.match(text, /lowLine := line\.new\(bar_index - swingLen, swingLow, bar_index, swingLow/);
});

// The shaded supply and demand boxes, their retracement levels and the
// time-based ranges were taken off: they were read as too busy and the time
// ranges did not look right. This pins them gone.
test('the boxes and the time windows are off the chart', () => {
    const text = read();
    assert.doesNotMatch(text, /zone/i);
    assert.doesNotMatch(text, /TimeRange/);
    assert.doesNotMatch(text, /box\.new/);
    assert.doesNotMatch(text, /bgcolor\(/);
    assert.doesNotMatch(text, /range/i);
    assert.doesNotMatch(text, /max_boxes_count/);
});

test('every context level is drawn on the chart as well as listed in the box', () => {
    const text = read();
    for (const row of ['1', '2', '3', '4', '5']) {
        assert.match(text, new RegExp(`showContextLevels \\? contextHigh${row} : na`));
        assert.match(text, new RegExp(`showContextLevels \\? contextLow${row} : na`));
    }
    assert.match(text, /contextLines = input\.bool/);
});

test('the copy route still serves this script as plain text', () => {
    const server = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
    const route = server.match(/app\.get\('\/someday\.pine'[\s\S]*?\}\);/);
    assert.ok(route, '/someday.pine route exists');
    assert.match(route[0], /res\.type\('text\/plain'\)/);
    assert.match(route[0], /tradingview', 'Someday-Indicator\.pine'/);
});
