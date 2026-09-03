// =============================================================================
//  MSB ALERT RELAY — makes the grader fill itself when a TradingView alert fires
//
//  What it does, in one line: TradingView webhook → this little server → the
//  grader page (served at http://localhost:4410) auto-fills the trade numbers.
//
//  Pure Node, no npm installs, no dependencies. Start it with the
//  "Start Trade Grader.bat" one folder up, or:  node relay/server.js
//
//  It serves the SAME trade-grader.html that lives in the Trading folder —
//  one grader, two doorways. The webhook needs a public URL (TradingView's
//  servers live on the internet and cannot see your PC), so a tunnel like
//  ngrok points a public address at this server. Setup: GETTING-STARTED.md.
// =============================================================================

const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = 4410;
const SECRET_FILE = path.join(__dirname, "secret.txt");
const LOG_FILE = path.join(__dirname, "alerts.log");
const STATE_FILE = path.join(__dirname, "state.json");

// A private token in the webhook path so random internet noise can't inject
// fake alerts. Generated once, kept in relay/secret.txt.
let secret;
try {
  secret = fs.readFileSync(SECRET_FILE, "utf8").trim();
  if (!/^[a-f0-9]{16}$/.test(secret)) throw new Error("bad secret");
} catch {
  secret = crypto.randomBytes(8).toString("hex");
  fs.writeFileSync(SECRET_FILE, secret);
}

// Last alerts live in memory (and append to alerts.log for your records).
let alerts = [];
let nextId = 1;

// ═══ SIGNALS ═════════════════════════════════════════════════════════════════
// Every "MSB PURE" alert that arrives is parsed and saved to signals.json,
// whether autotrade is on or not. The journal page pulls this file, so a
// signal writes itself into the journal with no typing. The fills and P&L
// still come from the TradingView export — the bot only knows what it said,
// the account knows what actually happened; the journal merges the two.
const SIGNALS_FILE = path.join(__dirname, "signals.json");
let signals = [];
try {
  signals = JSON.parse(fs.readFileSync(SIGNALS_FILE, "utf8"));
  if (!Array.isArray(signals)) signals = [];
} catch {}
function recordSignal(text) {
  const m = text.match(/^(\S+)\s+MSB PURE dir (-?1)(?:\.0+)?\s*\|/);
  if (!m) return;
  const num = re => { const g = text.match(re); return g ? parseFloat(g[1]) : null; };
  signals.push({
    t: Date.now(), tk: m[1], dir: +m[2],
    entry: num(/entry\s+([\d.]+)/i), stop: num(/stop\s+([\d.]+)/i),
    t1: num(/T1\s+([\d.]+)/), t2: num(/T2\s+([\d.]+)/),
    room: num(/room\s+([\d.]+)/i), qty: num(/qty\s+([\d.]+)/i)
  });
  if (signals.length > 500) signals = signals.slice(-500);
  try { fs.writeFileSync(SIGNALS_FILE, JSON.stringify(signals, null, 1)); } catch {}
}


// ═══ THE TUNNEL, STARTED FOR YOU ═════════════════════════════════════════════
// TradingView's servers live on the internet and cannot see a PC behind a
// router, so a tunnel gives this relay one public address. That address is
// reserved to this machine, which is why the webhook URL never changes once it
// has been pasted into an alert.
//
// Starting it here means one button does everything: the relay comes up, the
// tunnel comes up with it, and the address shows on the page that opens. If
// ngrok is missing or already running this fails quietly — the relay itself
// keeps working; only the auto-writing needs the tunnel.
const TUNNEL_HOST = "explicit-sprung-produce.ngrok-free.dev";
function startTunnel() {
  try {
    const ng = require("child_process").spawn(
      "ngrok", ["http", "--url=" + TUNNEL_HOST, String(PORT)],
      { detached: true, stdio: "ignore", windowsHide: true });
    ng.on("error", () => {});
    ng.unref();
  } catch {}
}
startTunnel();

const hookUrl = () => "https://" + TUNNEL_HOST + "/hook/" + secret;

// Through the tunnel, every request arrives with X-Forwarded-For; from a
// browser on this PC, none does. Anything that prints the secret (the hook
// address, the /bot link) is shown only to the local side. The tunnel exists
// for one caller — TradingView — and it only ever needs /hook/<secret>.
const isLocal = req => !req.headers["x-forwarded-for"] && !req.headers["x-forwarded-proto"];

// The one line a person still has to move by hand is the webhook address, so
// put it where it cannot be missed: the top of the bot page, with a button
// that copies it.
function banner() {
  return '<div style="font:15px/1.5 -apple-system,Segoe UI,Roboto,sans-serif;' +
    'background:#0b2b22;border-bottom:2px solid #26a69a;color:#e6edf3;' +
    'padding:12px 16px;display:flex;gap:12px;align-items:center;flex-wrap:wrap">' +
    '<b style="color:#26a69a">AUTO IS ON</b>' +
    '<span style="color:#8b96a5">paste this once into your TradingView alert &rarr; ' +
    'Notifications &rarr; Webhook URL:</span>' +
    '<code id="msbHook" style="background:#161b22;padding:5px 9px;border-radius:6px;' +
    'font-size:13px">' + hookUrl() + '</code>' +
    '<button onclick="navigator.clipboard.writeText(' +
    "document.getElementById('msbHook').textContent);this.textContent='copied';" +
    "this.style.background='#26a69a'" + '" ' +
    'style="background:#238636;color:#fff;border:0;border-radius:6px;padding:7px 14px;' +
    'font-weight:700;cursor:pointer">copy</button>' +
    '</div>';
}
function withBanner(html) {
  const page = html.toString();
  return /<body[^>]*>/i.test(page)
    ? page.replace(/<body[^>]*>/i, m => m + banner())
    : banner() + page;
}

// ═══ AUTOTRADE — the TradingView bot ═════════════════════════════════════════
// When an "MSB PURE" alert arrives, write an order file into NinjaTrader's
// incoming folder (the ATI). NinjaTrader places the bracket: market entry,
// then two OCO pairs — half at T1, half at T2, both protected by the stop.
//
// OFF until you switch it on from the /bot page, and only a sim account can
// be switched on there. NinjaTrader names its practice accounts "Sim101" or,
// on a hosted demo, "DEMO" plus a number — either is sim money.
// Requirements in NinjaTrader: Tools → Options → Automated trading interface
// → tick "AT interface". That folder only exists while NinjaTrader is running.
//
// Between the alert and the order sit the SAFETY RAILS. Every one of them can
// only ever block a trade, never invent one, and every decision is printed
// and written to alerts.log so you can audit what the bot did and why.
//   · kill switch   — /bot page (phone-friendly). DISARMED survives restarts.
//   · one a day     — maxPerDay, counted in state.json, restart-proof.
//   · duplicates    — the same alert text inside dupWindowMin places once.
//   · session gate  — orders only inside that instrument's ET window, Mon–Fri.
//   · sanity        — stop/T1/T2 on the correct side, risk within maxRiskPts.
//   · rollover      — expired contract month blocks; rollover month warns.
const AUTO_FILE = path.join(__dirname, "autotrade.json");
const AUTO_DEFAULT = {
  enabled: false,
  account: "Sim101",
  // Size is COMPUTED, not fixed: contracts = floor( (balance x riskPct%) /
  // (stop points x dollars per point) ). The stop distance comes from the
  // alert, so a wide-stop trade automatically gets fewer contracts and the
  // dollars at risk stay the same. Keep `balance` current — it is the one
  // number here the relay cannot look up for itself, and a stale balance
  // makes every contract count wrong in the same direction.
  balance: 25000,
  riskPct: 10,         // set by choice. Reference: the paper record averages 0.87% a
                       // trade, and the sweeps put 10% at a 30-99% drawdown on the same edge.
  maxContracts: 10,       // a hard ceiling no arithmetic can talk its way past.
                          // 10 is a size you can watch go wrong: on a 20-point MES
                          // stop that is $1,000, on a 40-point MNQ stop $800. The
                          // percentage regularly asks for far more than that.
  lotsSet: false,         // flipped true once the ceiling has been chosen on /bot
  cfgVersion: 0,          // which one-time migrations below have run on this file
  maxPerDay: 2,           // the chart says Bullets 2 / 2; the relay agrees, or it is confusing
  dupWindowMin: 10,       // identical alert text inside this window trades once
  incoming: path.join(process.env.USERPROFILE || require("os").homedir(),
    "Documents", "NinjaTrader 8", "incoming"),
  // TradingView ticker → the actual contract NinjaTrader trades. Update at rollover.
  // session = the ET window orders are allowed; maxRiskPts = a stop wider than
  // this is treated as a bad alert, not a big trade; perPoint = dollars per
  // whole point of price, which is what turns a stop distance into a size.
  instruments: {
    "MNQ1!": { name: "MNQ 09-26", tick: 0.25, perPoint: 2,  session: "0930-1500", maxRiskPts: 250 },
    "MES1!": { name: "MES 09-26", tick: 0.25, perPoint: 5,  session: "0930-1500", maxRiskPts: 90 },
    "MGC1!": { name: "MGC 12-26", tick: 0.10, perPoint: 10, session: "0800-1300", maxRiskPts: 35 }
  }
};
// Sim money or real money, from the name alone. Anything else is treated as real.
const isSim = name => /^(sim|demo)/i.test(String(name || "").trim());
let auto = AUTO_DEFAULT;
let needsMigration = false;
try {
  auto = Object.assign({}, AUTO_DEFAULT, JSON.parse(fs.readFileSync(AUTO_FILE, "utf8")));
} catch {
  fs.writeFileSync(AUTO_FILE, JSON.stringify(AUTO_DEFAULT, null, 2));
}
// The ceiling used to default to 50, which on a six-figure balance at 10% is not
// a ceiling at all — it is the position size, quietly. Existing autotrade.json
// files carry that old number, and the person who has to live with it does not
// edit JSON. So: bring the ceiling down to today's default exactly once, then
// mark it chosen and never touch it again. Any value saved from /bot sticks.
const CFG_VERSION = 2;
if (auto.lotsSet !== true) {                       // v1: the ceiling
  auto.maxContracts = AUTO_DEFAULT.maxContracts;
  auto.lotsSet = true;
  needsMigration = true;
}
if (!(auto.cfgVersion >= 2)) {                     // v2: bullets match the chart
  auto.maxPerDay = AUTO_DEFAULT.maxPerDay;
  needsMigration = true;
}
auto.cfgVersion = CFG_VERSION;
// Autotrade is switched on and its numbers set from the /bot page, not by hand.
// A phone is often the only thing in reach when a number is wrong, and a stale
// `balance` silently mis-sizes every trade. Written back so changes survive a
// restart. Going LIVE still means editing this file on purpose — see /bot/arm.
const saveAuto = () => { try { fs.writeFileSync(AUTO_FILE, JSON.stringify(auto, null, 2)); } catch {} };

// Bot state that must survive a restart: the kill switch, today's trade count,
// and recent alert fingerprints. Lives in relay/state.json.
let state = { killed: false, day: "", placed: [], recent: [] };
try { state = Object.assign(state, JSON.parse(fs.readFileSync(STATE_FILE, "utf8"))); } catch {}
const saveState = () => { try { fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2)); } catch {} };

// Everything the bot decides, on one line: console + alerts.log + the /bot page.
let decisions = [];
function decide(placed, msg) {
  const line = (placed ? "🤖 " : "✗ bot: ") + msg;
  console.log(line);
  fs.appendFile(LOG_FILE, new Date().toISOString() + "  BOT " + (placed ? "PLACED " : "blocked ") + msg + "\n", () => {});
  decisions.push({ t: Date.now(), placed, msg });
  if (decisions.length > 20) decisions = decisions.slice(-20);
}

// New York clock, no libraries: weekday, date and HHMM in ET.
function etNow() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York", hourCycle: "h23", weekday: "short",
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit"
  }).formatToParts(new Date());
  const g = t => (parts.find(p => p.type === t) || {}).value;
  return { wd: g("weekday"), date: `${g("year")}-${g("month")}-${g("day")}`,
           hm: +g("hour") * 100 + +g("minute"), month: +g("month"), year: +g("year") };
}

// "MNQ 09-26" → how close is that contract to the grave?
//   ok        — trades fine
//   rollover  — we're inside the contract month; roll to the next one soon
//   expired   — the month is behind us; the order would hit a dead contract
function contractStatus(name) {
  const m = /(\d{2})-(\d{2})\s*$/.exec(name || "");
  if (!m) return "unknown";
  const cm = +m[1], cy = 2000 + +m[2];
  const now = etNow();
  if (cy < now.year || (cy === now.year && cm < now.month)) return "expired";
  if (cy === now.year && cm === now.month) return "rollover";
  return "ok";
}

// "MES 09-26" → "MES 12-26". Index futures list quarterly; gold every other
// month. Used when a contract has expired (automatically — a dead contract
// cannot trade anyway) and offered as a button during the rollover month.
function rollForward(name) {
  const m = /^(\S+)\s+(\d{2})-(\d{2})\s*$/.exec(name || "");
  if (!m) return name;
  const root = m[1], cm = +m[2], cy = +m[3];
  const months = /^M?GC$/i.test(root) ? [2, 4, 6, 8, 10, 12] : [3, 6, 9, 12];
  const next = months.find(x => x > cm);
  const nm = next || months[0], ny = next ? cy : cy + 1;
  return root + " " + String(nm).padStart(2, "0") + "-" + String(ny).padStart(2, "0");
}
// Expired contracts roll themselves at startup. Rollover month is a choice —
// the old contract still trades — so that one is a button on /bot, not a rule.
for (const [tk, inst] of Object.entries(auto.instruments)) {
  let guard = 0;
  while (contractStatus(inst.name) === "expired" && guard++ < 12) {
    const was = inst.name;
    inst.name = rollForward(inst.name);
    console.log("↻ " + tk + ": " + was + " had expired — rolled to " + inst.name);
    needsMigration = true;
  }
}
if (needsMigration) saveAuto();

function inSession(sess) {
  const m = /^(\d{2})(\d{2})-(\d{2})(\d{2})$/.exec(sess || "");
  if (!m) return true;                              // no window configured = no gate
  const now = etNow();
  if (now.wd === "Sat" || now.wd === "Sun") return false;
  const from = +m[1] * 100 + +m[2], to = +m[3] * 100 + +m[4];
  return now.hm >= from && now.hm <= to;
}

let oifSeq = 0;
function roundTick(px, tick) { return (Math.round(px / tick) * tick).toFixed(tick < 0.25 ? 1 : 2); }

// "MNQ1! MSB PURE dir 1 | entry 29940.00 | stop 29900.00 | risk 40.00 pts | T1 29980.00 | T2 30140.00 | room 5.0R"
function tryAutotrade(text) {
  if (!auto.enabled) return;
  const m = text.match(/^(\S+)\s+MSB PURE dir (-?1)(?:\.0+)?\s*\|/);
  if (!m) return;                                   // not a PURE signal — ignore

  // ── the rails, in order ────────────────────────────────────────────────────
  if (state.killed) { decide(false, "KILL SWITCH is on — no orders until you re-arm at /bot"); return; }

  const today = etNow().date;
  if (state.day !== today) { state.day = today; state.placed = []; saveState(); }

  // Duplicate: TradingView retries, double-fired alerts, a re-sent webhook.
  const hash = crypto.createHash("sha1").update(text).digest("hex").slice(0, 12);
  const winMs = (auto.dupWindowMin || 10) * 60000;
  state.recent = (state.recent || []).filter(r => Date.now() - r.t < Math.max(winMs, 7200000));
  const dup = state.recent.find(r => r.h === hash && Date.now() - r.t < winMs);
  state.recent.push({ h: hash, t: Date.now() });
  saveState();
  if (dup) { decide(false, "duplicate of an alert " + Math.round((Date.now() - dup.t) / 60000) + " min ago — placed once, not twice"); return; }

  if (state.placed.length >= (auto.maxPerDay || 1)) {
    decide(false, "bullet already spent — " + state.placed.length + "/" + (auto.maxPerDay || 1) + " trade(s) placed today. This one is tomorrow's.");
    return;
  }

  const inst = auto.instruments[m[1]];
  if (!inst) { decide(false, "no instrument mapping for " + m[1]); return; }

  // Late is the same as wrong: an alert that lands outside the session window
  // (delayed webhook, relay started mid-day, a stale retry) executes at a
  // price the levels no longer describe.
  if (!inSession(inst.session)) {
    decide(false, m[1] + " alert outside the " + (inst.session || "?") + " ET window — stale levels, no order");
    return;
  }

  const cs = contractStatus(inst.name);
  if (cs === "expired") {
    decide(false, inst.name + " looks EXPIRED — update the contract month in relay/autotrade.json");
    return;
  }

  const num = re => { const g = text.match(re); return g ? parseFloat(g[1]) : NaN; };
  const entrySide = m[2] === "1";
  const entry = num(/entry\s+([\d.]+)/i);
  const stop = num(/stop\s+([\d.]+)/i);
  const t1   = num(/T1\s+([\d.]+)/);
  const t2   = num(/T2\s+([\d.]+)/);
  if (!(stop > 0 && t1 > 0 && t2 > 0)) { decide(false, "bad numbers in alert"); return; }

  // Sanity: every level on the side it belongs. A mangled alert fails here
  // instead of becoming a live position with the stop above a long entry.
  if (entry > 0) {
    const wrong = entrySide
      ? (stop >= entry || t1 <= entry || t2 <= entry)
      : (stop <= entry || t1 >= entry || t2 >= entry);
    if (wrong) { decide(false, "levels on the wrong side of entry for a " + (entrySide ? "LONG" : "SHORT") + " — mangled alert, no order"); return; }
    if (inst.maxRiskPts > 0 && Math.abs(entry - stop) > inst.maxRiskPts) {
      decide(false, "stop is " + Math.abs(entry - stop).toFixed(2) + " pts from entry — over the " + inst.maxRiskPts + " pt cap for " + m[1] + ". That is a bad alert, not a big trade.");
      return;
    }
  }

  // ── size, from the stop distance ───────────────────────────────────────────
  // The alert measured the stop; the config holds the money. Multiply out and
  // the dollars at risk are the same whether the stop is 12 points or 90.
  const riskPts = Math.abs(entry - stop);
  const perPt   = inst.perPoint > 0 ? inst.perPoint : 0;
  if (!(perPt > 0)) { decide(false, "no perPoint set for " + m[1] + " in autotrade.json — cannot size the trade"); return; }
  const riskUsd = (auto.balance || 0) * (auto.riskPct || 0) / 100;
  const qty = Math.min(auto.maxContracts || 50, Math.floor(riskUsd / (riskPts * perPt)));

  // Zero contracts means the stop is too wide for the account at this risk.
  // The answer to that is to skip the trade, never to shrink the stop to fit.
  if (qty < 1) {
    decide(false, "0 contracts — a " + riskPts.toFixed(2) + " pt stop on " + m[1] +
      " costs $" + (riskPts * perPt).toFixed(0) + " per contract, over the $" +
      riskUsd.toFixed(0) + " this trade is allowed to risk. Stop too wide for the account.");
    return;
  }

  // ── the order ──────────────────────────────────────────────────────────────
  // Two contracts or more: half comes off at 1R, the rest runs to T2.
  // One contract cannot be halved, and this relay has no way to move a stop to
  // break-even (it writes an order file and never hears about the fill), so a
  // single contract takes the 1R and is done rather than riding a trade that
  // reached +1R all the way back to -1R.
  const half = Math.floor(qty / 2);
  const rest = qty - half;
  const buy  = entrySide ? "BUY" : "SELL";
  const sell = entrySide ? "SELL" : "BUY";
  const S = roundTick(stop, inst.tick), P1 = roundTick(t1, inst.tick), P2 = roundTick(t2, inst.tick);
  const id = Date.now().toString(36);

  // ATI order-instruction format:
  // COMMAND;ACCOUNT;INSTRUMENT;ACTION;QTY;ORDER TYPE;LIMIT;STOP;TIF;OCO ID;ORDER ID;;
  const lines = [`PLACE;${auto.account};${inst.name};${buy};${qty};MARKET;;;GTC;;${id}E;;`];
  if (half > 0) {
    lines.push(`PLACE;${auto.account};${inst.name};${sell};${half};LIMIT;${P1};;GTC;${id}A;${id}T1;;`);
    lines.push(`PLACE;${auto.account};${inst.name};${sell};${half};STOPMARKET;;${S};GTC;${id}A;${id}S1;;`);
    lines.push(`PLACE;${auto.account};${inst.name};${sell};${rest};LIMIT;${P2};;GTC;${id}B;${id}T2;;`);
    lines.push(`PLACE;${auto.account};${inst.name};${sell};${rest};STOPMARKET;;${S};GTC;${id}B;${id}S2;;`);
  } else {
    lines.push(`PLACE;${auto.account};${inst.name};${sell};${qty};LIMIT;${P1};;GTC;${id}A;${id}T1;;`);
    lines.push(`PLACE;${auto.account};${inst.name};${sell};${qty};STOPMARKET;;${S};GTC;${id}A;${id}S1;;`);
  }
  const dir = findIncoming();
  const file = path.join(dir, "oif" + (++oifSeq) + "." + id + ".txt");
  try {
    fs.writeFileSync(file, lines.join("\r\n") + "\r\n");
    state.placed.push({ t: Date.now(), inst: inst.name, dir: buy, qty });
    saveState();
    decide(true, "AUTOTRADE → " + auto.account + "  " + inst.name + "  " + buy + " " + qty +
      "  stop " + S + "  T1 " + P1 + (half > 0 ? "  T2 " + P2 : "  (1 lot — full exit at 1R)") +
      "   risking $" + (qty * riskPts * perPt).toFixed(0) +
      " of $" + riskUsd.toFixed(0) + " (" + (auto.riskPct || 0) + "% of " + (auto.balance || 0) + ")" +
      (cs === "rollover" ? "   ⚠ rollover month — update the contract soon" : ""));
  } catch (e) {
    decide(false, "could not write to " + dir +
      " — is NinjaTrader running with the AT interface enabled? (" + e.message + ")");
  }
}

// Where NinjaTrader's "incoming" folder actually is. On a PC where OneDrive
// owns Documents, it lives under OneDrive\Documents and the plain Documents
// path is a dead letterbox — an order written there is never seen. So: the
// configured path if it exists, else the two places Windows puts Documents.
// The one that exists wins; if none does, NinjaTrader is not running with the
// AT interface on, and the write fails loudly.
function findIncoming() {
  const home = process.env.USERPROFILE || require("os").homedir();
  const cands = [auto.incoming,
    path.join(home, "Documents", "NinjaTrader 8", "incoming"),
    path.join(home, "OneDrive", "Documents", "NinjaTrader 8", "incoming")];
  for (const c of cands) { try { if (c && fs.statSync(c).isDirectory()) return c; } catch {} }
  return auto.incoming;
}

// ── the /bot page: status + the kill switch, phone-sized ─────────────────────
function botPage() {
  const armed = auto.enabled && !state.killed;
  const today = etNow().date;
  const used = state.day === today ? state.placed.length : 0;
  const live = !isSim(auto.account);
  const rows = Object.entries(auto.instruments).map(([tk, i]) => {
    const cs = contractStatus(i.name);
    const warn = cs === "expired" ? ' <b style="color:#ef5350">EXPIRED</b>'
               : cs === "rollover" ? ' <b style="color:#f0a020">rollover month</b>' : "";
    const roll = cs === "ok" ? "" :
      `<form method="POST" action="/bot/${secret}/roll" style="display:inline;margin-left:8px">
<input type="hidden" name="tk" value="${tk}"><button style="width:auto;padding:6px 10px;font-size:13px;
background:#f0a020;color:#000">Roll to ${rollForward(i.name)}</button></form>`;
    return `<tr><td>${tk}</td><td>${i.name}${warn}${roll}</td><td>${i.session || "—"} ET</td></tr>`;
  }).join("");
  const dec = decisions.slice().reverse().map(d =>
    `<li>${new Date(d.t).toLocaleTimeString()} — ${d.placed ? "✅" : "🚫"} ${d.msg}</li>`).join("") ||
    "<li>Nothing yet this session.</li>";
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>MSB Bot</title>
<style>body{background:#0e1116;color:#e6edf3;font:16px/1.5 -apple-system,Segoe UI,Roboto,sans-serif;
max-width:520px;margin:0 auto;padding:20px}h1{font-size:20px}table{width:100%;border-collapse:collapse;font-size:14px}
td{padding:6px 4px;border-bottom:1px solid #2a3341}li{font-size:13px;color:#8b96a5;margin-bottom:6px}
.big{font-size:26px;font-weight:800;padding:14px;border-radius:10px;text-align:center;margin:14px 0}
button{width:100%;padding:16px;font-size:18px;font-weight:700;border:0;border-radius:10px;cursor:pointer}
.pill{padding:2px 10px;border-radius:20px;font-size:13px;font-weight:700}</style></head><body>
${banner()}
<h1>MSB Bot — ${today}</h1>
<div class="big" style="background:${armed ? "rgba(38,166,154,.15);color:#26a69a" : "rgba(239,83,80,.15);color:#ef5350"}">
${armed ? "ARMED" : state.killed ? "KILLED" : "OFF (autotrade.json)"}</div>
<p>Account: <span class="pill" style="background:${live ? "rgba(239,83,80,.25);color:#ef5350" : "rgba(38,166,154,.25);color:#26a69a"}">
${auto.account}${live ? " — REAL MONEY" : " — sim"}</span>
&nbsp; Bullets: <b>${Math.max(0, (auto.maxPerDay || 1) - used)} / ${auto.maxPerDay || 1}</b> left today</p>
<p>Risk: <b>${auto.riskPct || 0}%</b> of <b>$${(auto.balance || 0).toLocaleString()}</b>
= <b>$${Math.round((auto.balance || 0) * (auto.riskPct || 0) / 100).toLocaleString()}</b> per trade.
Contracts are computed from that and the stop distance in the alert.</p>
<p style="font-size:13px;color:#f0a020">⚠ This path cannot move a stop to break-even — it writes an
order file and never hears about the fill. Trades of 2+ contracts take half at 1R and let the rest
run to T2 against the <i>original</i> stop. For break-even after 1R, run the NinjaScript
(ninjatrader/MSBPure.cs) instead, which sees its own fills.</p>
<form method="POST" action="/bot/${secret}/arm">
<button style="background:${auto.enabled ? "#546e7a" : "#26a69a"};color:#fff">
${auto.enabled ? "TURN AUTOTRADE OFF" : "TURN AUTOTRADE ON — " + auto.account}</button></form>
${live
  ? `<p style="font-size:13px;color:#ef5350">This button only arms a <b>sim</b> account — one named
Sim101 or DEMO…. The account is <b>${auto.account}</b>, which is real money, so autotrade there can
only be switched on by editing relay/autotrade.json deliberately.</p>`
  : `<p style="font-size:13px;color:#8b96a5">Sim money. When a signal fires the bot places the entry,
the stop and both targets in NinjaTrader by itself. It never touches a trade you opened by hand.</p>`}
<form method="POST" action="/bot/${secret}/toggle" style="margin-top:14px">
<button style="background:${state.killed ? "#26a69a" : "#ef5350"};color:#fff">
${state.killed ? "RE-ARM THE BOT" : "KILL — stop placing orders"}</button></form>
<p style="font-size:13px;color:#8b96a5">The kill switch survives restarts. It stops new orders only —
anything already working in NinjaTrader stays yours to manage.</p>
<h1 style="font-size:16px;margin-top:22px">Numbers</h1>
<form method="POST" action="/bot/${secret}/settings">
<div style="display:flex;gap:8px">
${[["account", "Account", auto.account], ["balance", "Balance $", auto.balance], ["riskPct", "Risk %", auto.riskPct],
   ["maxPerDay", "Per day", auto.maxPerDay], ["maxContracts", "Max lots", auto.maxContracts]].map(([k, label, v]) =>
`<label style="flex:1;font-size:12px;color:#8b96a5">${label}<br>
<input name="${k}" value="${v}" inputmode="${k === "account" ? "text" : "decimal"}" style="width:100%;box-sizing:border-box;
padding:10px;margin-top:4px;font-size:16px;border-radius:8px;border:1px solid #2a3341;
background:#161b22;color:#e6edf3"></label>`).join("")}
</div>
<button style="background:#2f81f7;color:#fff;margin-top:10px">Save</button></form>
<p style="font-size:13px;color:#8b96a5">Balance is the one number the relay cannot look up for itself.
If it is wrong, every contract count is wrong the same way. <b>Account</b> is the name NinjaTrader shows
in its Accounts tab — copy it exactly. <b>Max lots</b> is a hard ceiling the risk maths cannot argue
past — when it bites, the ceiling is your real position size, not the percentage.</p>
<table>${rows}</table>
<p style="font-size:13px;color:${(() => { try { return fs.statSync(findIncoming()).isDirectory() ? "#26a69a" : "#ef5350"; } catch { return "#ef5350"; } })()}">
NinjaTrader folder: <code>${findIncoming()}</code> — ${(() => { try { return fs.statSync(findIncoming()).isDirectory() ? "found ✓" : "NOT FOUND"; } catch { return "NOT FOUND — open NinjaTrader with the AT interface ticked"; } })()}</p>
<h1 style="font-size:16px;margin-top:22px">Decisions this session</h1><ul>${dec}</ul>
</body></html>`;
}
// ═════════════════════════════════════════════════════════════════════════════

const server = http.createServer((req, res) => {
  const url = req.url.split("?")[0];

  // The front door. The grader and the file journal are gone — the ledger
  // lives at its own link now — so this is a status line and, from this PC
  // only, the way in to the bot page.
  if (req.method === "GET" && (url === "/" || url === "/index.html")) {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
    res.end(`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>MSB relay</title><style>body{background:#0e1116;color:#e6edf3;font:16px/1.6 -apple-system,Segoe UI,Roboto,sans-serif;
max-width:520px;margin:0 auto;padding:28px 20px}a{color:#8ab4ff}</style></head><body>
<h1 style="font-size:20px">MSB relay is running</h1>
${isLocal(req)
  ? `<p><a href="/bot/${secret}" style="font-size:18px;font-weight:700">Open the Bot switch &rarr;</a></p>
<p style="color:#8b96a5;font-size:14px">Arm and disarm, balance and size, the webhook address to paste, the contract roll.</p>`
  : `<p style="color:#8b96a5">Nothing to see from here. Open it on the PC it runs on.</p>`}
</body></html>`);
    return;
  }

  // The bot's own signal history, for anything on this PC that wants it. The
  // open CORS header lets a page opened from a folder (file://) read it.
  if (req.method === "GET" && url === "/signals.json") {
    if (!isLocal(req)) { res.writeHead(403); res.end(); return; }
    res.writeHead(200, {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-store"
    });
    res.end(JSON.stringify({ signals }));
    return;
  }

  // Bot status + kill switch. Same secret as the webhook — the page is yours alone.
  if (req.method === "GET" && url === "/bot/" + secret) {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
    res.end(botPage());
    return;
  }
  if (req.method === "POST" && url === "/bot/" + secret + "/toggle") {
    state.killed = !state.killed;
    saveState();
    console.log(state.killed ? "🔴 KILL SWITCH ON — the bot will not place orders."
                             : "🟢 Bot re-armed from the /bot page.");
    res.writeHead(303, { Location: "/bot/" + secret });
    res.end();
    return;
  }
  // Switch autotrade on or off from the phone. Turning it ON is only allowed on
  // Sim101: arming a real account is a decision that should cost more than a tap,
  // so it stays a deliberate edit of autotrade.json. Turning it OFF always works.
  if (req.method === "POST" && url === "/bot/" + secret + "/arm") {
    if (!auto.enabled && !isSim(auto.account)) {
      decide(false, "arm refused — " + auto.account + " is not a sim account. Edit relay/autotrade.json to go live on purpose.");
    } else {
      auto.enabled = !auto.enabled;
      saveAuto();
      console.log(auto.enabled ? "🟢 AUTOTRADE ON → " + auto.account + " (sim)"
                               : "⚪ Autotrade OFF — signals arrive, no orders are placed.");
    }
    res.writeHead(303, { Location: "/bot/" + secret });
    res.end();
    return;
  }
  // Roll one instrument to its next contract month, from the phone.
  if (req.method === "POST" && url === "/bot/" + secret + "/roll") {
    let body = "";
    req.on("data", c => { body += c; if (body.length > 1000) req.destroy(); });
    req.on("end", () => {
      const tk = new URLSearchParams(body).get("tk");
      const inst = auto.instruments[tk];
      if (inst) {
        const was = inst.name;
        inst.name = rollForward(inst.name);
        saveAuto();
        console.log("↻ " + tk + ": " + was + " → " + inst.name + " (rolled from the /bot page)");
      }
      res.writeHead(303, { Location: "/bot/" + secret });
      res.end();
    });
    return;
  }
  // Balance / risk / bullets, edited from the same page. Clamped, never trusted raw.
  if (req.method === "POST" && url === "/bot/" + secret + "/settings") {
    let body = "";
    req.on("data", c => { body += c; if (body.length > 4000) req.destroy(); });
    req.on("end", () => {
      const f = new URLSearchParams(body);
      const num = (k, min, max) => {
        const v = parseFloat(String(f.get(k) || "").replace(/[^0-9.]/g, ""));
        return Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : null;
      };
      // The account name: letters and digits only, and switching to a real
      // account from the page disarms the bot — going live is never a side effect.
      const acct = String(f.get("account") || "").trim().replace(/[^A-Za-z0-9_-]/g, "").slice(0, 32);
      if (acct && acct !== auto.account) {
        auto.account = acct;
        if (!isSim(acct) && auto.enabled) { auto.enabled = false; console.log("⚪ Autotrade OFF — account changed to a real one."); }
      }
      const b = num("balance", 0, 1e9), r = num("riskPct", 0, 100),
            d = num("maxPerDay", 0, 10),   c = num("maxContracts", 1, 200);
      if (b !== null) auto.balance = b;
      if (r !== null) auto.riskPct = r;
      if (d !== null) auto.maxPerDay = Math.round(d);
      if (c !== null) { auto.maxContracts = Math.round(c); auto.lotsSet = true; }
      saveAuto();
      console.log("⚙ autotrade: " + auto.account + ", $" + auto.balance + " balance, " + auto.riskPct + "% risk, "
                  + auto.maxPerDay + " a day = $" + Math.round(auto.balance * auto.riskPct / 100)
                  + " a trade, ceiling " + auto.maxContracts + " lots.");
      res.writeHead(303, { Location: "/bot/" + secret });
      res.end();
    });
    return;
  }

  // TradingView posts the alert text here
  if (req.method === "POST" && url === "/hook/" + secret) {
    let body = "";
    req.on("data", c => { body += c; if (body.length > 10000) req.destroy(); });
    req.on("end", () => {
      const text = body.trim();
      if (text) {
        alerts.push({ id: nextId++, t: Date.now(), text });
        if (alerts.length > 20) alerts = alerts.slice(-20);
        fs.appendFile(LOG_FILE, new Date().toISOString() + "  " + text.replace(/\n/g, " | ") + "\n", () => {});
        console.log("⚡ Alert received " + new Date().toLocaleTimeString() + " — " + text.split("\n")[0]);
        recordSignal(text);
        tryAutotrade(text);
      }
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("ok");
    });
    return;
  }

  // Wrong secret on the hook path — say nothing useful to strangers.
  if ((req.method === "POST" || req.method === "GET") && (url.startsWith("/hook/") || url.startsWith("/bot/"))) {
    res.writeHead(403); res.end();
    return;
  }

  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("not found");
});

server.listen(PORT, () => {
  const armed = auto.enabled && !state.killed;
  console.log("");
  console.log("  ┌─────────────────────────────────────────────────────────────┐");
  console.log("  │  MSB ALERT RELAY is running                                 │");
  console.log("  └─────────────────────────────────────────────────────────────┘");
  console.log("");
  console.log("  Webhook path:     /hook/" + secret);
  console.log("  Bot switch:       http://localhost:" + PORT + "/bot/" + secret);
  console.log("");
  console.log("  Autotrade:        " + (armed ? "🟢 ARMED → " + auto.account + (isSim(auto.account) ? " (sim)" : "  ⚠ REAL MONEY")
                                             : state.killed ? "🔴 KILLED — re-arm on the /bot page"
                                             : "⚪ off — tap TURN AUTOTRADE ON on the /bot page"));
  console.log("  Risk per trade:   " + (auto.riskPct || 0) + "% of $" + (auto.balance || 0) +
              " = $" + Math.round((auto.balance || 0) * (auto.riskPct || 0) / 100) +
              "   (contracts computed from the stop distance)");
  console.log("  Never more than:  " + auto.maxContracts + " contracts — the ceiling, whatever the maths says");
  if (armed) console.log("  ⚠ No break-even on this path — it cannot see fills. Use ninjatrader/MSBPure.cs for that.");
  for (const [tk, i] of Object.entries(auto.instruments)) {
    const cs = contractStatus(i.name);
    if (cs === "expired") console.log("  ⚠ " + tk + " → " + i.name + " looks EXPIRED — it will roll itself on the next start.");
    else if (cs === "rollover") console.log("  ⚠ " + tk + " → " + i.name + " is in its rollover month — tap Roll on the Bot switch page.");
  }
  console.log("");
  console.log("  ── PASTE THIS ONCE, then auto runs itself ──────────────────");
  console.log("      " + hookUrl());
  console.log("  In TradingView: open the TRADE SIGNAL alert, Notifications tab,");
  console.log("  tick Webhook URL, paste, Save. The same address, with a copy");
  console.log("  button, sits at the top of the Bot switch page.");
  console.log("");
  console.log("  Keep this window open during the session. Ctrl+C to stop.");
  console.log("");
});
