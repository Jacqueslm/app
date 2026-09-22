// There is no Pine compiler in this repository. These checks catch the common
// copy/paste failures before the script reaches TradingView: bad brackets,
// non-ASCII editor characters, duplicate top-level names, ungrouped settings,
// and function calls that pass the wrong number of values.
//
// 21 Sep 2026. This file used to hold three scripts - swing letters, tested
// zones, and the strategy. He asked for all three and then said plainly: "drop
// the indicator and delete it, just wanted to backtest my logic i told you
// about." So the two indicators were deleted, and what is left is the one thing
// he asked for: his frame rules, entered and priced the way he trades them. The
// last test below holds that door shut, so an indicator cannot quietly come back
// into this folder.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', '..', 'tradingview');
const STRAT = path.join(DIR, 'Someday-Strategy.pine');
const strat = () => fs.readFileSync(STRAT, 'utf8');

const bare = (line) => line.replace(/\/\/.*$/, '').replace(/'[^']*'/g, "''").replace(/"[^"]*"/g, '""');
const code = (text) => text.split('\n').map(bare).join('\n');

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

function lint(name, text) {
    const lines = text.split('\n');
    assert.strictEqual(lines[0].trim(), '//@version=5', name + ' is a Pine v5 script');
    assert.match(lines[1], /^\/\/ Someday/, name + ' says what it is on line two');
    lines.forEach((line, i) => {
        assert.ok(!line.includes('\t'), name + ' line ' + (i + 1) + ' contains a tab');
        for (const ch of line) assert.ok(ch.charCodeAt(0) < 128, name + ' line ' + (i + 1) + ' contains ' + JSON.stringify(ch));
    });
    text.split('\n').map(bare).forEach((line, i) => {
        let depth = 0;
        for (const ch of line) {
            if ('([{'.includes(ch)) depth++;
            if (')]}'.includes(ch)) depth--;
        }
        assert.strictEqual(depth, 0, name + ' line ' + (i + 1) + ' leaves a bracket open');
        if (line.trim()) assert.strictEqual(line.match(/^ */)[0].length % 4, 0, name + ' line ' + (i + 1) + ' is not indented in fours');
    });
    assert.doesNotMatch(text, /https?:\/\//, name + ' names no third-party address');
    assert.doesNotMatch(text, /input\.timeframe|request\.security/, name + ' reads the chart it is on, not a list of timeframes');
    text.split('\n').forEach((line, i) => {
        if (/input\./.test(line)) assert.match(line, /group=/, name + ' line ' + (i + 1) + ' has an ungrouped setting');
    });

    // The top level declares each name once. A second copy of the script pasted
    // into the same Pine tab is the exact failure he hit on the 21st - "1 of 5
    // problems: swingLen is already defined" - so it is checked here, before the
    // paste ever reaches TradingView.
    const seen = new Map();
    text.split('\n').map(bare).forEach((line, i) => {
        const match = line.match(/^(?:var\s+\S+\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=(?!=)/);
        if (!match) return;
        assert.ok(!seen.has(match[1]), name + ': ' + match[1] + ' is declared twice (line ' + seen.get(match[1]) + ' and line ' + (i + 1) + ')');
        seen.set(match[1], i + 1);
    });

    // Every call passes the number of values the function accepts. A Pine script
    // fails to compile on a mismatch, and the failure names a line the reader has
    // to go and count by hand.
    const body = code(text);
    const functions = new Map();
    for (const match of body.matchAll(/^([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)\s*=>/gm)) {
        functions.set(match[1], match[2].trim() ? topCommas(match[2]) + 1 : 0);
    }
    for (const [fn, wanted] of functions) {
        for (const match of body.matchAll(new RegExp(`(^|[^A-Za-z0-9_.])${fn}\\s*\\(`, 'gm'))) {
            const open = match.index + match[0].length - 1;
            const args = inside(body, open);
            assert.notStrictEqual(args, null, name + ': ' + fn + ' is not closed');
            assert.strictEqual(args.trim() ? topCommas(args) + 1 : 0, wanted, name + ': ' + fn + ' accepts ' + wanted + ' values');
        }
    }
}

test('the strategy is a Pine v5 script and passes the paste-time lint', () => {
    lint('Someday-Strategy.pine', strat());
});

// The strategy is the desk's backtest in a form TradingView itself can run, so
// the rules have to be the same ones, in the same order, and priced with what he
// actually pays: .39 a contract a side, which is .78 in and out.
test('the strategy enters his frame rules and prices them at what he pays', () => {
    const text = strat();
    assert.match(text, /^strategy\(/m);
    assert.match(text, /commission_type=strategy\.commission\.cash_per_contract/);
    assert.match(text, /commission_value=0\.39/, 'TradingView charges this on every order, so it is one side');
    assert.match(text, /\.39 a contract a side/);
    assert.match(text, /\.78 a contract/);
    assert.match(text, /default_qty_value=1/);
    // A new lower low turns the frame down, and the level is the swing high it
    // dropped from.
    assert.match(text, /pivLow < prevLowSwing and not na\(lastHigh\)/);
    assert.match(text, /level := lastHigh/);
    assert.match(text, /frameLow := pivLow/);
    // Only a close above the level cancels it, and the order is pulled with it.
    assert.match(text, /if live and close > level/);
    assert.match(text, /strategy\.cancel\("frame"\)/);
    // The short is the level, the stop is one average bar above it, the target
    // is the frame low.
    assert.match(text, /strategy\.entry\("frame", strategy\.short, limit=level\)/);
    assert.match(text, /stopPx := level \+ stopRoom \* unit/);
    assert.match(text, /targetPx := frameLow/);
    assert.match(text, /strategy\.exit\("out", from_entry="frame", stop=stopPx/);
    // And it says what a tester cannot show.
    assert.match(text, /the spread, slippage, and a fill he might not/);
    assert.match(text, /best case rather than what he would have kept/);
});

test('the strategy is served as plain text at its own address', () => {
    const server = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
    const found = server.match(/app\.get\('\/someday-strategy\.pine'[\s\S]*?\}\);/);
    assert.ok(found, '/someday-strategy.pine route exists');
    assert.match(found[0], /res\.type\('text\/plain'\)/);
    assert.ok(found[0].includes("tradingview', 'Someday-Strategy.pine'"), 'the route serves Someday-Strategy.pine');
});

// "drop the indicator and delete it, just wanted to backtest my logic."
// The folder holds the backtest and nothing else. This is not a rule about the
// TradingView folder in general - it is this folder, on his word, after he asked
// for it twice.
test('tradingview holds the backtest and no indicator script', () => {
    const files = fs.readdirSync(DIR).sort();
    assert.deepStrictEqual(files, ['Someday-Strategy.pine']);
    // The addresses themselves, not the words: the note in server.js says which
    // routes were deleted, and it is allowed to name them.
    const server = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
    assert.doesNotMatch(server, /app\.get\('\/someday\.pine'/, 'the swing indicator route is gone');
    assert.doesNotMatch(server, /app\.get\('\/someday-zones\.pine'/, 'the zones route is gone');
});
