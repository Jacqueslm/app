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
    assert.match(lines[1], /^\/\/ Someday - swings and structure breaks/);
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
    // Smaller on purpose: the box, the five timeframe rows and the ten drawn
    // levels are gone, so there are fewer top-level names to redeclare.
    assert.ok(seen.size >= 10);
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
    // The script is deliberately two helpers long now, so the guard only has to
    // prove the scan found them.
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

test('the old prediction panel is gone', () => {
    const text = read();
    assert.doesNotMatch(text, /longOk|shortOk/);
    assert.doesNotMatch(text, /Frame \(sets the level\)/);
});

// "The box it doesn't explain nothing, it's confusing." The box of numbers, the
// five timeframe rows behind it and the requests that filled them are gone. What
// is left is the two things he asked to look at: the swings and the breaks.
test('the numbers box and the timeframe rows are gone', () => {
    const text = read();
    assert.doesNotMatch(text, /table\.new/);
    assert.doesNotMatch(text, /table\.cell/);
    assert.doesNotMatch(text, /Body swing/);
    assert.doesNotMatch(text, /request\.security/);
});

// "The 5 sec is not even listed." The script used to carry five rows of
// timeframes chosen in the settings. A list like that can never hold everything
// he trades, and it could drift out of step with the chart in front of him. It
// reads the chart he has open now, so the 5 second chart and the daily chart
// both work with nothing to set and nothing to keep in step.
test('the script reads the chart it is on, so every timeframe works', () => {
    const text = read();
    assert.doesNotMatch(text, /input\.timeframe/);
    assert.doesNotMatch(text, /contextTf/);
    assert.match(text, /ta\.pivothigh\(bodyTop\(\), swingLen, swingLen\)/);
    assert.match(text, /ta\.pivotlow\(bodyBottom\(\), swingLen, swingLen\)/);
});

// The chart used to carry three different swing definitions at once: the H/HH/LH
// markers came from a hardcoded 2-bar pivot that ignored the setting, the table
// used the setting, and the step line came from the 10-bar zone structure. They
// could not agree, which is what "the highs and lows don't line up" meant.
// They agree now because there is one definition, on one number.
test('one swing length drives the letters, the two levels and the breaks', () => {
    const text = read();
    assert.match(text, /ta\.pivothigh\(bodyTop\(\), swingLen, swingLen\)/);
    assert.match(text, /ta\.pivotlow\(bodyBottom\(\), swingLen, swingLen\)/);
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
    assert.match(text, /barstate\.isconfirmed and not na\(upLevel\) and na\(upBrokenAt\) and close > upLevel/);
    assert.match(text, /barstate\.isconfirmed and not na\(downLevel\) and na\(downBrokenAt\) and close < downLevel/);
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

// "I want to see when structure is broken." A break is marked on the bar that
// made it, in the direction it went, and once per level: the level is not raised
// again until the next swing of the same kind is confirmed, so a run of candles
// through one level is one break rather than five.
test('a break is marked on the chart, once per level', () => {
    const text = read();
    assert.match(text, /showBreaks = input\.bool/);
    assert.match(text, /label\.new\(bar_index, upLevel, "BROKE UP"/);
    assert.match(text, /label\.new\(bar_index, downLevel, "BROKE DOWN"/);
    assert.match(text, /upBrokenAt := bar_index/);
    assert.match(text, /downBrokenAt := bar_index/);
    assert.match(text, /na\(upBrokenAt\)/);
    assert.match(text, /na\(downBrokenAt\)/);
});

// "No lines." Nothing is drawn across the chart at all now: the two watched
// levels are kept in the script and never drawn, so the swing letters and the
// break marks are the only things on top of the candles.
test('nothing is drawn across the chart, only the letters and the break marks', () => {
    const text = read();
    assert.doesNotMatch(text, /line\./);
    assert.doesNotMatch(text, /plot\.style_stepline/);
    assert.doesNotMatch(text, /(^|[^.\w])plot\(/m);
    assert.doesNotMatch(text, /hline\(/);
    assert.doesNotMatch(text, /fill\(/);
    assert.match(text, /label\.new\(bar_index - swingLen, swingHigh, highName/);
    assert.match(text, /label\.new\(bar_index, upLevel, "BROKE UP"/);
});

test('the copy route still serves this script as plain text', () => {
    const server = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
    const route = server.match(/app\.get\('\/someday\.pine'[\s\S]*?\}\);/);
    assert.ok(route, '/someday.pine route exists');
    assert.match(route[0], /res\.type\('text\/plain'\)/);
    assert.match(route[0], /tradingview', 'Someday-Indicator\.pine'/);
});
