// There is no Pine compiler in this repository. These checks catch the common
// copy/paste failures before the script reaches TradingView: bad brackets,
// non-ASCII editor characters, duplicate top-level names, ungrouped settings,
// and function calls that pass the wrong number of values. They are not a
// compiler and they say nothing about whether a script runs.
//
// 21 Sep 2026. This file used to hold three scripts - swing letters, tested
// zones, and the strategy. He asked for all three and then said plainly: "drop
// the indicator and delete it, just wanted to backtest my logic i told you
// about." The two indicators were deleted and the backtest stayed.
//
// 23 Sep 2026 he asked for an indicator again - "to give me what i am seeking
// out of an assistant and indicator" - and asked where it should live, and said
// BOTH. So Someday-Frames.pine is here: his frame rules and the frame above
// him, drawn on the chart he executes from. It is a new script for a new
// request. The two deleted addresses below are still deleted and still checked.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', '..', 'tradingview');
const STRAT = path.join(DIR, 'Someday-Strategy.pine');
const FRAMES = path.join(DIR, 'Someday-Frames.pine');
const strat = () => fs.readFileSync(STRAT, 'utf8');
const frames = () => fs.readFileSync(FRAMES, 'utf8');

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

// multiFrame is off for the strategy on purpose and on for the indicator. The
// backtest has to run on the bars it is on, so it may not reach for another
// timeframe at all. The indicator's whole job is the frame above the chart, so
// it reads one - and it is checked that it reads only that one, twice, from the
// chart's own symbol, rather than picking from a list.
function lint(name, text, multiFrame) {
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
    assert.doesNotMatch(text, /input\.timeframe/, name + ' has no timeframe picker');
    if (!multiFrame) assert.doesNotMatch(text, /request\.security/, name + ' reads the chart it is on, not a list of timeframes');
    if (multiFrame) assert.match(text, /request\.security\(syminfo\.tickerid,/, name + ' reads its bridge off the chart\'s own symbol');
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
    // A new lower low that CLOSED under the low before it turns the frame down,
    // and the level is the swing high it dropped from. The close is his 23 Sep
    // correction and it belongs in the backtest too, or the tester would count a
    // wick as a break and disagree with the desk and the game about the same bars.
    assert.match(text, /pivLow < prevLowSwing and close\[swingLen\] < prevLowSwing and not na\(lastHigh\)/);
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

// THE INDICATOR IS BACK, AND THIS IS THE ONE HE ASKED FOR - 23 Sep 2026.
//
// The test that used to be here held the folder to the backtest alone. That was
// his word then ("drop the indicator and delete it, just wanted to backtest my
// logic") and it is his word now that he wants one: "to give me what i am
// seeking out of an assistant and indicator", and to the question of where it
// should live, BOTH. So the folder holds the backtest and Someday-Frames.pine,
// and nothing else - the two scripts he asked for, at the addresses below.
// The two older addresses stay buried, and that is still checked.
test('the indicator is a Pine v5 script and passes the paste-time lint', () => {
    lint('Someday-Frames.pine', frames(), true);
});

// The rules have to be his rules, and they have to be the same ones the desk and
// the practice game run, or three reads of the same bars disagree.
test('the indicator reads the turn on the close and calls a raid a raid', () => {
    const text = frames();
    assert.match(text, /^indicator\(/m, 'it is an indicator, not a strategy: nothing is placed');
    assert.doesNotMatch(text, /strategy\.(entry|exit|order|close)\b/, 'it places nothing');
    // The turn's own bar decides, and the raid is the turn that closed back.
    assert.match(text, /turn := now > before \? \(closeAtTurn > before \? "HH" : "SH"\) : "LH"/);
    assert.match(text, /turn := now < before \? \(closeAtTurn < before \? "LL" : "SL"\) : "HL"/);
    assert.match(text, /turnClose = close\[swingLen\]/, 'the close that decides is the pivot bar\'s own');
    assert.match(text, /if showRaid and wordHigh == "SH"/);
    assert.match(text, /if showRaid and wordLow == "SL"/);
    assert.match(text, /WICK THROUGH, CLOSED BACK/);
    // A raid moves nothing: the side before it stands.
    assert.match(text, /side = before/);
    assert.match(text, /if turn == "HH" or turn == "HL"/);
    assert.match(text, /if turn == "LH" or turn == "LL"/);
    // The frame: down on a lower low that closed under the last one, the level
    // above it, the stop one average bar over the level, the target at the low.
    assert.match(text, /if wordLow == "LL" and not na\(lastHigh\)/);
    assert.match(text, /level := lastHigh/);
    assert.match(text, /stopPx := level \+ stopRoom \* unit/);
    assert.match(text, /targetPx := frameLow/);
    assert.match(text, /if live and close > level/);
    // The bridge, twice, off the chart's own symbol, read after the bar closed.
    const bridge = text.match(/request\.security\(syminfo\.tickerid,[^\n]*/g) || [];
    assert.strictEqual(bridge.length, 6, 'two frames, each read for its high, its low and the close that decides');
    for (const line of bridge) assert.match(line, /barmerge\.gaps_off, barmerge\.lookahead_off/, 'a bridge bar is read after it closed, so the bias cannot move under him');
    // And the panel says which frame each word came off.
    assert.match(text, /table\.cell\(panel, 0, 1, "here"/);
    assert.match(text, /table\.cell\(panel, 1, 1, chartSide/);
});

test('the indicator is served as plain text at its own address', () => {
    const server = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
    const found = server.match(/app\.get\('\/someday-frames\.pine'[\s\S]*?\}\);/);
    assert.ok(found, '/someday-frames.pine route exists');
    assert.match(found[0], /res\.type\('text\/plain'\)/);
    assert.ok(found[0].includes("tradingview', 'Someday-Frames.pine'"), 'the route serves Someday-Frames.pine');
});

// He asked for the read and, asked where it should live, said BOTH, so the app
// has to be able to hand the script over: he carries the desk on his phone, and
// an address nobody told him is not a way in. Both answers are served as text,
// which is the whole reason he can select one and paste it into Pine editor
// instead of opening a file Android has no program for.
test('the desk hands him both scripts, and both come off this app as text', () => {
    const desk = fs.readFileSync(path.join(__dirname, '..', '..', 'desk.html'), 'utf8');
    assert.match(desk, /href="\/someday-frames\.pine"/, 'the desk links the read');
    assert.match(desk, /href="\/someday-strategy\.pine"/, 'and the backtest');
    assert.match(desk, /select all of it, paste it into Pine editor/,
        'with the one instruction that is needed, on the page rather than in a message');

    const server = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
    for (const [route, file] of [['/someday-frames.pine', 'Someday-Frames.pine'], ['/someday-strategy.pine', 'Someday-Strategy.pine']]) {
        const found = server.match(new RegExp("app\\.get\\('" + route + "'[\\s\\S]*?\\}\\);"));
        assert.ok(found, route + ' is served');
        assert.match(found[0], /res\.type\('text\/plain'\)/, route + ' answers as text rather than a download');
        assert.ok(found[0].includes("tradingview', '" + file + "'"), route + ' serves ' + file);
    }
});

// Two scripts, the two he asked for, and no third. The addresses that were
// deleted on 21 Sep stay deleted: this indicator is a new script for a new
// request, not those two coming back.
test('tradingview holds the backtest and the one indicator he asked for', () => {
    const files = fs.readdirSync(DIR).sort();
    assert.deepStrictEqual(files, ['Someday-Frames.pine', 'Someday-Strategy.pine']);
    // The addresses themselves, not the words: the note in server.js says which
    // routes were deleted, and it is allowed to name them.
    const server = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
    assert.doesNotMatch(server, /app\.get\('\/someday\.pine'/, 'the swing indicator route is gone');
    assert.doesNotMatch(server, /app\.get\('\/someday-zones\.pine'/, 'the zones route is gone');
});
